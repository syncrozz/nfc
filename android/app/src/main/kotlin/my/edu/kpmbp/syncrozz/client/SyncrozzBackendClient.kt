package my.edu.kpmbp.syncrozz.client

import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

data class AuthChallengeResponse(
    val success: Boolean,
    val challengeId: String,
    val nonce: String,
    val expiresAt: Long,
    val message: String? = null
)

data class VerificationResponse(
    val success: Boolean,
    val sessionToken: String?,
    val error: String? = null
)

/**
 * Native Android Backend Client for SES v4.5 Zero-Trust APIs
 */
class SyncrozzBackendClient(private val baseUrl: String) {

    fun requestChallenge(deviceId: String): AuthChallengeResponse {
        val url = URL("$baseUrl/api/auth/challenge")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            connectTimeout = 5000
            readTimeout = 5000
        }

        val jsonBody = JSONObject().apply {
            put("deviceId", deviceId)
        }

        OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(jsonBody.toString()) }

        val responseCode = conn.responseCode
        val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
        val responseText = BufferedReader(InputStreamReader(stream, StandardCharsets.UTF_8)).use { it.readText() }

        val json = JSONObject(responseText)
        return if (json.optBoolean("success", false)) {
            AuthChallengeResponse(
                success = true,
                challengeId = json.getString("challengeId"),
                nonce = json.getString("nonce"),
                expiresAt = json.getLong("expiresAt")
            )
        } else {
            AuthChallengeResponse(
                success = false,
                challengeId = "",
                nonce = "",
                expiresAt = 0,
                message = json.optString("error", "Failed to obtain challenge")
            )
        }
    }

    fun verifyChallenge(
        challengeId: String,
        signatureHex: String,
        deviceId: String,
        userId: String
    ): VerificationResponse {
        val url = URL("$baseUrl/api/auth/verify-challenge")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            connectTimeout = 5000
            readTimeout = 5000
        }

        val jsonBody = JSONObject().apply {
            put("challengeId", challengeId)
            put("signatureHex", signatureHex)
            put("deviceId", deviceId)
            put("userId", userId)
        }

        OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(jsonBody.toString()) }

        val responseCode = conn.responseCode
        val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
        val responseText = BufferedReader(InputStreamReader(stream, StandardCharsets.UTF_8)).use { it.readText() }

        val json = JSONObject(responseText)
        return if (json.optBoolean("success", false)) {
            VerificationResponse(
                success = true,
                sessionToken = json.optString("sessionToken", null)
            )
        } else {
            VerificationResponse(
                success = false,
                sessionToken = null,
                error = json.optString("error", "Challenge verification failed")
            )
        }
    }

    fun enrollCredential(
        userId: String,
        staffId: String,
        deviceId: String,
        deviceModel: String,
        publicKeyPem: String,
        keyAlias: String
    ): JSONObject {
        val url = URL("$baseUrl/api/credentials/enroll")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            connectTimeout = 5000
            readTimeout = 5000
        }

        val jsonBody = JSONObject().apply {
            put("userId", userId)
            put("staffId", staffId)
            put("deviceId", deviceId)
            put("deviceModel", deviceModel)
            put("publicKeyPem", publicKeyPem)
            put("keyAlias", keyAlias)
        }

        OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(jsonBody.toString()) }

        val responseCode = conn.responseCode
        val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
        val responseText = BufferedReader(InputStreamReader(stream, StandardCharsets.UTF_8)).use { it.readText() }

        return JSONObject(responseText)
    }

    fun revokeAndReplace(
        userId: String,
        deviceId: String,
        reason: String
    ): JSONObject {
        val url = URL("$baseUrl/api/credentials/revoke-and-replace")
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            connectTimeout = 5000
            readTimeout = 5000
        }

        val jsonBody = JSONObject().apply {
            put("userId", userId)
            put("deviceId", deviceId)
            put("reason", reason)
        }

        OutputStreamWriter(conn.outputStream, StandardCharsets.UTF_8).use { it.write(jsonBody.toString()) }

        val responseCode = conn.responseCode
        val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
        val responseText = BufferedReader(InputStreamReader(stream, StandardCharsets.UTF_8)).use { it.readText() }

        return JSONObject(responseText)
    }
}
