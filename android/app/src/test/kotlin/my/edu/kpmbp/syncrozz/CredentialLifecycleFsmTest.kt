package my.edu.kpmbp.syncrozz

import my.edu.kpmbp.syncrozz.lifecycle.CredentialLifecycleManager
import my.edu.kpmbp.syncrozz.lifecycle.CredentialStatus
import my.edu.kpmbp.syncrozz.lifecycle.LocalCredentialRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CredentialLifecycleFsmTest {

    private lateinit var fsm: CredentialLifecycleManager

    @Before
    fun setUp() {
        fsm = CredentialLifecycleManager()
    }

    @Test
    fun testDoorAccessGate_OnlyActiveAllowed() {
        assertTrue(CredentialStatus.ACTIVE.canAccessDoor())
        assertFalse(CredentialStatus.PENDING.canAccessDoor())
        assertFalse(CredentialStatus.SUSPENDED.canAccessDoor())
        assertFalse(CredentialStatus.REVOKED.canAccessDoor())
        assertFalse(CredentialStatus.EXPIRED.canAccessDoor())
    }

    @Test
    fun testValidLifecycleTransitions() {
        assertTrue("PENDING -> ACTIVE must be allowed",
            fsm.canTransition(CredentialStatus.PENDING, CredentialStatus.ACTIVE))
        assertTrue("ACTIVE -> SUSPENDED must be allowed",
            fsm.canTransition(CredentialStatus.ACTIVE, CredentialStatus.SUSPENDED))
        assertTrue("SUSPENDED -> ACTIVE must be allowed",
            fsm.canTransition(CredentialStatus.SUSPENDED, CredentialStatus.ACTIVE))
        assertTrue("ACTIVE -> REVOKED must be allowed",
            fsm.canTransition(CredentialStatus.ACTIVE, CredentialStatus.REVOKED))
        assertTrue("ACTIVE -> EXPIRED must be allowed",
            fsm.canTransition(CredentialStatus.ACTIVE, CredentialStatus.EXPIRED))
    }

    @Test
    fun testRevokedIsTerminalState() {
        assertFalse("REVOKED -> ACTIVE must be strictly BLOCKED",
            fsm.canTransition(CredentialStatus.REVOKED, CredentialStatus.ACTIVE))
        assertFalse("REVOKED -> SUSPENDED must be strictly BLOCKED",
            fsm.canTransition(CredentialStatus.REVOKED, CredentialStatus.SUSPENDED))
        assertFalse("REVOKED -> PENDING must be strictly BLOCKED",
            fsm.canTransition(CredentialStatus.REVOKED, CredentialStatus.PENDING))
    }

    @Test
    fun testAutoExpirationEvaluation() {
        val expiredRecord = LocalCredentialRecord(
            credentialId = "cred-exp-1",
            userId = "usr-1",
            staffId = "STF001",
            deviceId = "dev-1",
            keyAlias = "test_alias",
            status = CredentialStatus.ACTIVE,
            issuedAt = System.currentTimeMillis() - 1000000,
            expiresAt = System.currentTimeMillis() - 5000, // Expired 5 seconds ago
            lastServerSyncAt = System.currentTimeMillis()
        )

        fsm.setCredential(expiredRecord)

        assertFalse("Expired credential must not be active", fsm.isCredentialActive)
        assertEquals(CredentialStatus.EXPIRED, fsm.getStatus())
    }

    @Test
    fun testOneActiveDeviceReplacementFlow() {
        // Enrolling staff member
        val phone1Record = LocalCredentialRecord(
            credentialId = "cred-phone-1",
            userId = "usr-1",
            staffId = "STF001",
            deviceId = "dev-pixel7",
            keyAlias = "key_pixel7",
            status = CredentialStatus.ACTIVE,
            issuedAt = System.currentTimeMillis() - 86400000,
            expiresAt = System.currentTimeMillis() + 86400000,
            lastServerSyncAt = System.currentTimeMillis()
        )
        fsm.setCredential(phone1Record)
        assertTrue(fsm.isCredentialActive)

        // Replacement initiated: Phone 1 credential is permanently revoked
        fsm.revokeCredential("Replaced with new mobile device (Dasar SES v4.5 1-Peranti Aktif)")
        assertEquals(CredentialStatus.REVOKED, fsm.getStatus())
        assertFalse(fsm.isCredentialActive)

        // New Phone 2 is enrolled with its own hardware key
        val phone2Record = LocalCredentialRecord(
            credentialId = "cred-phone-2",
            userId = "usr-1",
            staffId = "STF001",
            deviceId = "dev-pixel8",
            keyAlias = "key_pixel8",
            status = CredentialStatus.ACTIVE,
            issuedAt = System.currentTimeMillis(),
            expiresAt = System.currentTimeMillis() + 86400000,
            lastServerSyncAt = System.currentTimeMillis()
        )
        fsm.setCredential(phone2Record)
        assertEquals(CredentialStatus.ACTIVE, fsm.getStatus())
        assertTrue(fsm.isCredentialActive)
    }
}
