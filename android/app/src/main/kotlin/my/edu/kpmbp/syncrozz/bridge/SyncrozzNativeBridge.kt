package my.edu.kpmbp.syncrozz.bridge

import android.webkit.JavascriptInterface
import my.edu.kpmbp.syncrozz.hal.IHardwareSecurityModule
import my.edu.kpmbp.syncrozz.hce.ApduProtocol
import my.edu.kpmbp.syncrozz.hce.SyncrozzHostApduService
import my.edu.kpmbp.syncrozz.keystore.AndroidKeystoreProvider
import my.edu.kpmbp.syncrozz.lifecycle.CredentialLifecycleManager
import my.edu.kpmbp.syncrozz.lifecycle.CredentialStatus
import my.edu.kpmbp.syncrozz.lifecycle.LocalCredentialRecord
import org.json.JSONArray
import org.json.JSONObject
import java.util.Base64

/**
 * JavaScript Bridge for Android Native Container (SES v4.5)
 *
 * Allows the React frontend running inside Android WebView to directly access
 * genuine Android Keystore hardware keys and HCE service without relying on
 * browser WebCrypto simulation.
 */
class SyncrozzNativeBridge(
    private val hsm: IHardwareSecurityModule = AndroidKeystoreProvider(),
    private val lifecycleManager: CredentialLifecycleManager = SyncrozzHostApduService.lifecycleManager
) {

    @JavascriptInterface
    fun isNativeAndroid(): Boolean = true

    @JavascriptInterface
    fun getHardwareSecurityLevel(): String {
        return hsm.getSecurityLevel().name
    }

    @JavascriptInterface
    fun generateHardwareKey(alias: String, challengeHex: String?): String {
        return try {
            val challengeBytes = if (!challengeHex.isNullOrBlank()) {
                ApduProtocol.hexToBytes(challengeHex)
            } else null

            val meta = hsm.generateKeyPair(alias, challengeBytes)
            JSONObject().apply {
                put("success", true)
                put("alias", meta.alias)
                put("algorithm", meta.algorithm)
                put("curve", meta.curve)
                put("securityLevel", meta.securityLevel.name)
                put("isInsideSecureHardware", meta.isInsideSecureHardware)
                put("isExtractable", meta.isExtractable)
                put("publicKeyPem", meta.publicKeyPem)
                put("attestationSupported", meta.attestationSupported)
            }.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Failed to generate key in Android Keystore")
            }.toString()
        }
    }

    @JavascriptInterface
    fun signChallengeNonce(alias: String, nonceHex: String): String {
        return try {
            val nonceBytes = ApduProtocol.hexToBytes(nonceHex)
            val result = hsm.signChallenge(alias, nonceBytes)
            JSONObject().apply {
                put("success", true)
                put("signatureHex", result.signatureHex)
                put("algorithm", result.algorithm)
                put("durationMs", result.durationMs)
            }.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Failed to sign challenge in Android Keystore")
            }.toString()
        }
    }

    @JavascriptInterface
    fun getAttestationChain(alias: String): String {
        return try {
            val certs = hsm.getCertificateChain(alias)
            val jsonArray = JSONArray()
            for (cert in certs) {
                val b64 = Base64.getEncoder().encodeToString(cert.encoded)
                jsonArray.put(b64)
            }
            JSONObject().apply {
                put("success", true)
                put("certificates", jsonArray)
            }.toString()
        } catch (e: Exception) {
            JSONObject().apply {
                put("success", false)
                put("error", e.message ?: "Failed to get certificate chain")
            }.toString()
        }
    }

    @JavascriptInterface
    fun getHceStatus(): String {
        val cred = lifecycleManager.getCredential()
        return JSONObject().apply {
            put("aid", ApduProtocol.SYNCROZZ_AID_HEX)
            put("isServiceActive", lifecycleManager.isCredentialActive)
            put("lifecycleStatus", lifecycleManager.getStatus().name)
            put("hasCredential", cred != null)
            if (cred != null) {
                put("credentialId", cred.credentialId)
                put("staffId", cred.staffId)
                put("expiresAt", cred.expiresAt)
            }
        }.toString()
    }

    @JavascriptInterface
    fun updateCredentialState(credentialJson: String): Boolean {
        return try {
            val json = JSONObject(credentialJson)
            val record = LocalCredentialRecord(
                credentialId = json.getString("credentialId"),
                userId = json.getString("userId"),
                staffId = json.getString("staffId"),
                deviceId = json.getString("deviceId"),
                keyAlias = json.getString("keyAlias"),
                status = CredentialStatus.valueOf(json.getString("status")),
                issuedAt = json.getLong("issuedAt"),
                expiresAt = json.getLong("expiresAt"),
                lastServerSyncAt = System.currentTimeMillis()
            )
            lifecycleManager.setCredential(record)
            true
        } catch (e: Exception) {
            false
        }
    }
}
