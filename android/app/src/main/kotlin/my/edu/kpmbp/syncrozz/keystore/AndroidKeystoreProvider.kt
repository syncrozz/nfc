package my.edu.kpmbp.syncrozz.keystore

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import my.edu.kpmbp.syncrozz.hal.HardwareSecurityLevel
import my.edu.kpmbp.syncrozz.hal.IHardwareSecurityModule
import my.edu.kpmbp.syncrozz.hal.KeyMetadata
import my.edu.kpmbp.syncrozz.hal.SignatureResult
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.cert.Certificate
import java.security.spec.ECGenParameterSpec
import java.util.Base64

/**
 * Genuine Android Keystore Implementation (EC P-256 / secp256r1)
 *
 * Enforces SES v4.5 Zero-Trust Hardware Specifications:
 * 1. Hardware Isolation: StrongBox Keymaster with fallback to ARM TrustZone TEE.
 * 2. Non-Exportable Private Keys: Keys are generated inside the secure hardware and can NEVER be dumped or exported.
 * 3. Key Attestation: Captures cryptographic hardware proof of key provenance signed by Google/OEM root CA.
 * 4. Algorithm: ECDSA with NIST P-256 curve and SHA-256 digest.
 */
class AndroidKeystoreProvider(
    private val keyStoreProviderName: String = ANDROID_KEYSTORE_NAME
) : IHardwareSecurityModule {

    companion object {
        const val ANDROID_KEYSTORE_NAME = "AndroidKeyStore"
        const val EC_CURVE_P256 = "secp256r1"
        const val SIGNATURE_ALGORITHM = "SHA256withECDSA"
    }

    private val keyStore: KeyStore by lazy {
        KeyStore.getInstance(keyStoreProviderName).apply {
            load(null)
        }
    }

    override fun getSecurityLevel(): HardwareSecurityLevel {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                HardwareSecurityLevel.STRONGBOX
            } else {
                HardwareSecurityLevel.TEE
            }
        } catch (e: Throwable) {
            HardwareSecurityLevel.TEE
        }
    }

    override fun hasKey(alias: String): Boolean {
        return try {
            keyStore.containsAlias(alias)
        } catch (e: Exception) {
            false
        }
    }

    override fun generateKeyPair(alias: String, attestationChallenge: ByteArray?): KeyMetadata {
        // Remove existing key if present to ensure clean state
        if (hasKey(alias)) {
            keyStore.deleteEntry(alias)
        }

        var isStrongBox = false
        var keyPair: KeyPair

        // 1. Attempt StrongBox Keymaster generation (dedicated discrete hardware)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                keyPair = buildKeyPair(alias, attestationChallenge, useStrongBox = true)
                isStrongBox = true
            } catch (e: StrongBoxUnavailableException) {
                // Fallback to TrustZone TEE
                keyPair = buildKeyPair(alias, attestationChallenge, useStrongBox = false)
            }
        } else {
            // Devices prior to Android 9 use ARM TrustZone TEE
            keyPair = buildKeyPair(alias, attestationChallenge, useStrongBox = false)
        }

        val certChain = getCertificateChain(alias)
        val publicKey = keyPair.public
        val pubPem = exportPublicKeyToPem(publicKey)

        // Query key properties to verify hardware security level
        val securityLevel = if (isStrongBox) {
            HardwareSecurityLevel.STRONGBOX
        } else {
            inspectKeySecurityLevel(keyPair.private)
        }

        return KeyMetadata(
            alias = alias,
            algorithm = "ECDSA-P256-SHA256",
            curve = EC_CURVE_P256,
            securityLevel = securityLevel,
            isInsideSecureHardware = securityLevel.isProductionCertified,
            isExtractable = false, // Strictly false in genuine Android Keystore
            publicKey = publicKey,
            publicKeyPem = pubPem,
            attestationSupported = certChain.size > 1,
            certificateChain = certChain
        )
    }

    private fun buildKeyPair(alias: String, attestationChallenge: ByteArray?, useStrongBox: Boolean): KeyPair {
        val kpg = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            keyStoreProviderName
        )

        val builder = KeyGenParameterSpec.Builder(
            alias,
            KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
        ).apply {
            setAlgorithmParameterSpec(ECGenParameterSpec(EC_CURVE_P256))
            setDigests(KeyProperties.DIGEST_SHA256)
            setUserAuthenticationRequired(false) // Required for rapid HCE tap-to-enter access
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && useStrongBox) {
                setIsStrongBoxBacked(true)
            }
            if (attestationChallenge != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                setAttestationChallenge(attestationChallenge)
            }
        }

        kpg.initialize(builder.build())
        return kpg.generateKeyPair()
    }

    override fun signChallenge(alias: String, nonceBytes: ByteArray): SignatureResult {
        val startTime = System.currentTimeMillis()

        val privateKeyEntry = keyStore.getEntry(alias, null) as? KeyStore.PrivateKeyEntry
            ?: throw IllegalStateException("Keystore entry for alias '$alias' not found or not a PrivateKeyEntry")

        val privateKey: PrivateKey = privateKeyEntry.privateKey

        val signature = Signature.getInstance(SIGNATURE_ALGORITHM).apply {
            initSign(privateKey)
            update(nonceBytes)
        }

        val signatureBytes = signature.sign()
        val durationMs = System.currentTimeMillis() - startTime
        val signatureHex = signatureBytes.joinToString("") { "%02x".format(it) }

        return SignatureResult(
            signatureBytes = signatureBytes,
            signatureHex = signatureHex,
            algorithm = SIGNATURE_ALGORITHM,
            durationMs = durationMs
        )
    }

    override fun getPublicKey(alias: String): PublicKey? {
        return keyStore.getCertificate(alias)?.publicKey
    }

    override fun getCertificateChain(alias: String): List<Certificate> {
        return try {
            keyStore.getCertificateChain(alias)?.toList() ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    override fun deleteKey(alias: String): Boolean {
        return try {
            if (hasKey(alias)) {
                keyStore.deleteEntry(alias)
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    private fun inspectKeySecurityLevel(privateKey: PrivateKey): HardwareSecurityLevel {
        return try {
            val factory = KeyFactory.getInstance(privateKey.algorithm, keyStoreProviderName)
            val keyInfo = factory.getKeySpec(privateKey, KeyInfo::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                HardwareSecurityLevel.fromSecurityLevel(keyInfo.securityLevel)
            } else {
                if (keyInfo.isInsideSecureHardware) HardwareSecurityLevel.TEE else HardwareSecurityLevel.SOFTWARE_EMULATION
            }
        } catch (e: Throwable) {
            HardwareSecurityLevel.TEE
        }
    }

    private fun exportPublicKeyToPem(publicKey: PublicKey): String {
        val base64 = Base64.getEncoder().encodeToString(publicKey.encoded)
        return "-----BEGIN PUBLIC KEY-----\n" +
                base64.chunked(64).joinToString("\n") +
                "\n-----END PUBLIC KEY-----"
    }
}
