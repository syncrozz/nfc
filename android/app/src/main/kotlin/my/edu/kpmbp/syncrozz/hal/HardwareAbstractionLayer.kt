package my.edu.kpmbp.syncrozz.hal

import java.security.PublicKey
import java.security.cert.Certificate

data class KeyMetadata(
    val alias: String,
    val algorithm: String,
    val curve: String,
    val securityLevel: HardwareSecurityLevel,
    val isInsideSecureHardware: Boolean,
    val isExtractable: Boolean,
    val publicKey: PublicKey,
    val publicKeyPem: String,
    val attestationSupported: Boolean,
    val certificateChain: List<Certificate> = emptyList()
)

data class SignatureResult(
    val signatureBytes: ByteArray,
    val signatureHex: String,
    val algorithm: String,
    val durationMs: Long
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false
        other as SignatureResult
        return signatureBytes.contentEquals(other.signatureBytes) && signatureHex == other.signatureHex
    }

    override fun hashCode(): Int {
        var result = signatureBytes.contentHashCode()
        result = 31 * result + signatureHex.hashCode()
        return result
    }
}

/**
 * Hardware Abstraction Layer for SES v4.5 Cryptographic Operations
 */
interface IHardwareSecurityModule {
    fun getSecurityLevel(): HardwareSecurityLevel
    fun hasKey(alias: String): Boolean
    fun generateKeyPair(alias: String, attestationChallenge: ByteArray? = null): KeyMetadata
    fun signChallenge(alias: String, nonceBytes: ByteArray): SignatureResult
    fun getPublicKey(alias: String): PublicKey?
    fun getCertificateChain(alias: String): List<Certificate>
    fun deleteKey(alias: String): Boolean
}
