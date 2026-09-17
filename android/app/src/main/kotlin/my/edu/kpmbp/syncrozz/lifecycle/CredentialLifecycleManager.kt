package my.edu.kpmbp.syncrozz.lifecycle

enum class CredentialStatus {
    PENDING,
    ACTIVE,
    SUSPENDED,
    REVOKED,
    EXPIRED;

    fun canAccessDoor(): Boolean = this == ACTIVE
}

data class LocalCredentialRecord(
    val credentialId: String,
    val userId: String,
    val staffId: String,
    val deviceId: String,
    val keyAlias: String,
    val status: CredentialStatus,
    val issuedAt: Long,
    val expiresAt: Long,
    val lastServerSyncAt: Long
)

/**
 * Android Credential Lifecycle Manager
 *
 * Enforces the 5-Stage SES v4.5 Finite State Machine:
 * PENDING -> ACTIVE -> SUSPENDED -> REVOKED -> EXPIRED
 */
class CredentialLifecycleManager {

    private var currentCredential: LocalCredentialRecord? = null

    val isCredentialActive: Boolean
        get() {
            val cred = currentCredential ?: return false
            if (System.currentTimeMillis() > cred.expiresAt) {
                currentCredential = cred.copy(status = CredentialStatus.EXPIRED)
                return false
            }
            return cred.status == CredentialStatus.ACTIVE
        }

    fun getStatus(): CredentialStatus {
        val cred = currentCredential ?: return CredentialStatus.PENDING
        if (System.currentTimeMillis() > cred.expiresAt && cred.status == CredentialStatus.ACTIVE) {
            currentCredential = cred.copy(status = CredentialStatus.EXPIRED)
            return CredentialStatus.EXPIRED
        }
        return cred.status
    }

    fun setCredential(record: LocalCredentialRecord) {
        currentCredential = record
    }

    fun getCredential(): LocalCredentialRecord? = currentCredential

    fun suspendCredential(reason: String) {
        val cred = currentCredential ?: return
        if (cred.status == CredentialStatus.ACTIVE) {
            currentCredential = cred.copy(status = CredentialStatus.SUSPENDED)
        }
    }

    fun reactivateCredential() {
        val cred = currentCredential ?: return
        if (cred.status == CredentialStatus.SUSPENDED) {
            currentCredential = cred.copy(status = CredentialStatus.ACTIVE)
        }
    }

    fun revokeCredential(reason: String) {
        val cred = currentCredential ?: return
        currentCredential = cred.copy(status = CredentialStatus.REVOKED)
    }

    fun clearCredential() {
        currentCredential = null
    }

    fun canTransition(from: CredentialStatus, to: CredentialStatus): Boolean {
        return when (from) {
            CredentialStatus.PENDING -> to == CredentialStatus.ACTIVE || to == CredentialStatus.REVOKED
            CredentialStatus.ACTIVE -> to == CredentialStatus.SUSPENDED || to == CredentialStatus.REVOKED || to == CredentialStatus.EXPIRED
            CredentialStatus.SUSPENDED -> to == CredentialStatus.ACTIVE || to == CredentialStatus.REVOKED
            CredentialStatus.REVOKED -> false // Terminal state
            CredentialStatus.EXPIRED -> to == CredentialStatus.REVOKED // Can only transition to REVOKED
        }
    }
}
