package my.edu.kpmbp.syncrozz.hce

import my.edu.kpmbp.syncrozz.anticloning.AntiCloningPolicy
import my.edu.kpmbp.syncrozz.hal.IHardwareSecurityModule
import my.edu.kpmbp.syncrozz.lifecycle.CredentialLifecycleManager
import java.nio.charset.StandardCharsets

/**
 * SES v4.5 APDU Command Processor (Hardware Abstraction Layer)
 *
 * Implements the core ISO/IEC 7816-4 APDU processing state machine independently
 * of Android Service bindings to enable headless verification, zero-trust unit testing,
 * and clean separation of concerns.
 */
class ApduCommandProcessor(
    private val hsm: IHardwareSecurityModule,
    private val lifecycleManager: CredentialLifecycleManager,
    var currentKeyAlias: String = "syncrozz_ses_credential_key"
) {

    fun processCommandApdu(commandApdu: ByteArray): ByteArray {
        if (commandApdu.size < 4) {
            return ApduProtocol.SW_WRONG_LENGTH
        }

        val cla = commandApdu[0]
        val ins = commandApdu[1]

        // 1. Anti-Cloning & Security Boundary Check
        if (AntiCloningPolicy.isForbiddenMifareCommand(cla, ins)) {
            // Rejects legacy MIFARE Classic CRYPTO1 commands immediately
            return ApduProtocol.SW_CLA_NOT_SUPPORTED
        }

        // 2. Handle ISO 7816-4 SELECT AID
        if (cla == 0x00.toByte() && ins == ApduProtocol.INS_SELECT) {
            return handleSelectAid(commandApdu)
        }

        // 3. Credential Status Verification - Hardware Access Gate
        if (!lifecycleManager.isCredentialActive) {
            // Credential is REVOKED, SUSPENDED, or EXPIRED
            return ApduProtocol.SW_SECURITY_STATUS_NOT_SATISFIED
        }

        // 4. Handle Challenge-Response Handshake
        return when (ins) {
            ApduProtocol.INS_GET_CHALLENGE -> handleGetChallenge()
            ApduProtocol.INS_MUTUAL_AUTHENTICATE -> handleMutualAuthenticate(commandApdu)
            ApduProtocol.INS_GET_CREDENTIAL_STATUS -> handleGetStatus()
            else -> ApduProtocol.SW_INS_NOT_SUPPORTED
        }
    }

    private fun handleSelectAid(apdu: ByteArray): ByteArray {
        if (apdu.size < 5) return ApduProtocol.SW_WRONG_LENGTH
        val lc = apdu[4].toInt() and 0xFF
        if (apdu.size < 5 + lc) return ApduProtocol.SW_WRONG_LENGTH

        val selectedAid = apdu.copyOfRange(5, 5 + lc)
        if (!selectedAid.contentEquals(ApduProtocol.SYNCROZZ_AID_BYTES)) {
            return ApduProtocol.SW_APP_NOT_FOUND
        }

        // Return SES v4.5 protocol version and hardware security indicator
        val securityLevel = hsm.getSecurityLevel()
        val responseData = "SES45|SEC:${securityLevel.name}".toByteArray(StandardCharsets.UTF_8)
        return ApduProtocol.buildResponse(responseData, ApduProtocol.SW_SUCCESS)
    }

    private fun handleGetChallenge(): ByteArray {
        val cred = lifecycleManager.getCredential()
        val payload = if (cred != null) {
            "ID:${cred.credentialId}|STAFF:${cred.staffId}".toByteArray(StandardCharsets.UTF_8)
        } else {
            "NO_CREDENTIAL".toByteArray(StandardCharsets.UTF_8)
        }
        return ApduProtocol.buildResponse(payload, ApduProtocol.SW_SUCCESS)
    }

    private fun handleMutualAuthenticate(apdu: ByteArray): ByteArray {
        if (apdu.size < 5) return ApduProtocol.SW_WRONG_LENGTH
        val lc = apdu[4].toInt() and 0xFF
        if (apdu.size < 5 + lc) return ApduProtocol.SW_WRONG_LENGTH

        val challengeNonceBytes = apdu.copyOfRange(5, 5 + lc)
        if (challengeNonceBytes.isEmpty()) {
            return ApduProtocol.SW_CONDITIONS_NOT_SATISFIED
        }

        return try {
            // Sign challenge nonce inside Android Keystore hardware
            val sigResult = hsm.signChallenge(currentKeyAlias, challengeNonceBytes)
            ApduProtocol.buildResponse(sigResult.signatureBytes, ApduProtocol.SW_SUCCESS)
        } catch (e: Exception) {
            ApduProtocol.SW_SECURITY_STATUS_NOT_SATISFIED
        }
    }

    private fun handleGetStatus(): ByteArray {
        val status = lifecycleManager.getStatus().name
        return ApduProtocol.buildResponse(status.toByteArray(StandardCharsets.UTF_8), ApduProtocol.SW_SUCCESS)
    }
}
