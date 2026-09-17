package my.edu.kpmbp.syncrozz

import my.edu.kpmbp.syncrozz.hal.HardwareSecurityLevel
import my.edu.kpmbp.syncrozz.hal.IHardwareSecurityModule
import my.edu.kpmbp.syncrozz.hal.KeyMetadata
import my.edu.kpmbp.syncrozz.hal.SignatureResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.PublicKey
import java.security.Signature
import java.security.cert.Certificate
import java.security.spec.ECGenParameterSpec
import java.util.Base64

/**
 * Standard JVM Simulation of Android Hardware Security Module
 * for headless unit testing without physical Android device.
 */
class JvmTestHardwareSecurityModule : IHardwareSecurityModule {
    private val keyStore = mutableMapOf<String, KeyPair>()

    override fun getSecurityLevel(): HardwareSecurityLevel = HardwareSecurityLevel.TEE

    override fun hasKey(alias: String): Boolean = keyStore.containsKey(alias)

    override fun generateKeyPair(alias: String, attestationChallenge: ByteArray?): KeyMetadata {
        val kpg = KeyPairGenerator.getInstance("EC")
        kpg.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair = kpg.generateKeyPair()
        keyStore[alias] = keyPair

        val pubPem = "-----BEGIN PUBLIC KEY-----\n" +
                Base64.getEncoder().encodeToString(keyPair.public.encoded) +
                "\n-----END PUBLIC KEY-----"

        return KeyMetadata(
            alias = alias,
            algorithm = "ECDSA-P256-SHA256",
            curve = "secp256r1",
            securityLevel = HardwareSecurityLevel.TEE,
            isInsideSecureHardware = true,
            isExtractable = false, // Strictly enforced invariant
            publicKey = keyPair.public,
            publicKeyPem = pubPem,
            attestationSupported = true
        )
    }

    override fun signChallenge(alias: String, nonceBytes: ByteArray): SignatureResult {
        val keyPair = keyStore[alias] ?: throw IllegalStateException("Key not found")
        val sig = Signature.getInstance("SHA256withECDSA")
        sig.initSign(keyPair.private)
        sig.update(nonceBytes)
        val sigBytes = sig.sign()
        val sigHex = sigBytes.joinToString("") { "%02x".format(it) }

        return SignatureResult(
            signatureBytes = sigBytes,
            signatureHex = sigHex,
            algorithm = "SHA256withECDSA",
            durationMs = 5L
        )
    }

    override fun getPublicKey(alias: String): PublicKey? = keyStore[alias]?.public

    override fun getCertificateChain(alias: String): List<Certificate> = emptyList()

    override fun deleteKey(alias: String): Boolean = keyStore.remove(alias) != null
}

class AndroidKeystoreAndCryptoTest {

    private lateinit var hsm: IHardwareSecurityModule

    @Before
    fun setUp() {
        hsm = JvmTestHardwareSecurityModule()
    }

    @Test
    fun testKeyGeneration_EcP256_NonExtractable() {
        val alias = "test_staff_key_01"
        val meta = hsm.generateKeyPair(alias)

        assertEquals(alias, meta.alias)
        assertEquals("ECDSA-P256-SHA256", meta.algorithm)
        assertEquals("secp256r1", meta.curve)
        assertFalse("Private key must never be extractable", meta.isExtractable)
        assertTrue("Must report inside secure hardware", meta.isInsideSecureHardware)
        assertNotNull(meta.publicKey)
        assertTrue(meta.publicKeyPem.contains("BEGIN PUBLIC KEY"))
    }

    @Test
    fun testChallengeSigningAndCryptographicVerification() {
        val alias = "test_staff_key_02"
        val meta = hsm.generateKeyPair(alias)

        val challengeNonce = "a1b2c3d4e5f60718293a4b5c6d7e8f900102030405060708090a0b0c0d0e0f10".toByteArray()
        val signResult = hsm.signChallenge(alias, challengeNonce)

        assertNotNull(signResult.signatureBytes)
        assertTrue(signResult.signatureBytes.isNotEmpty())
        assertEquals("SHA256withECDSA", signResult.algorithm)

        // Verify cryptographic signature against public key
        val verifier = Signature.getInstance("SHA256withECDSA")
        verifier.initVerify(meta.publicKey)
        verifier.update(challengeNonce)
        val verified = verifier.verify(signResult.signatureBytes)

        assertTrue("ECDSA signature must cryptographically verify against enrolled public key", verified)
    }

    @Test
    fun testTamperedSignatureRejection() {
        val alias = "test_staff_key_03"
        val meta = hsm.generateKeyPair(alias)

        val challengeNonce = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20".toByteArray()
        val signResult = hsm.signChallenge(alias, challengeNonce)

        // Tamper with signature bytes
        val tamperedBytes = signResult.signatureBytes.clone()
        tamperedBytes[tamperedBytes.size - 1] = (tamperedBytes[tamperedBytes.size - 1].toInt() xor 0xFF).toByte()

        val verifier = Signature.getInstance("SHA256withECDSA")
        verifier.initVerify(meta.publicKey)
        verifier.update(challengeNonce)

        var isValid = false
        try {
            isValid = verifier.verify(tamperedBytes)
        } catch (e: Exception) {
            isValid = false
        }

        assertFalse("Tampered signature must be completely rejected", isValid)
    }
}
