package my.edu.kpmbp.syncrozz

import my.edu.kpmbp.syncrozz.anticloning.AntiCloningPolicy
import my.edu.kpmbp.syncrozz.hce.ApduCommandProcessor
import my.edu.kpmbp.syncrozz.hce.ApduProtocol
import my.edu.kpmbp.syncrozz.lifecycle.CredentialLifecycleManager
import my.edu.kpmbp.syncrozz.lifecycle.CredentialStatus
import my.edu.kpmbp.syncrozz.lifecycle.LocalCredentialRecord
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class HceAndApduProtocolTest {

    private lateinit var processor: ApduCommandProcessor
    private lateinit var testHsm: JvmTestHardwareSecurityModule
    private lateinit var lifecycleManager: CredentialLifecycleManager

    @Before
    fun setUp() {
        testHsm = JvmTestHardwareSecurityModule()
        testHsm.generateKeyPair("syncrozz_ses_credential_key")
        lifecycleManager = CredentialLifecycleManager()

        processor = ApduCommandProcessor(
            hsm = testHsm,
            lifecycleManager = lifecycleManager,
            currentKeyAlias = "syncrozz_ses_credential_key"
        )
    }

    @Test
    fun testSelectAid_Success() {
        // SELECT AID APDU: 00 A4 04 00 07 A0 00 00 08 41 00 01
        val selectAidApdu = byteArrayOf(
            0x00.toByte(), 0xA4.toByte(), 0x04.toByte(), 0x00.toByte(),
            0x07.toByte(),
            0xA0.toByte(), 0x00.toByte(), 0x00.toByte(), 0x08.toByte(), 0x41.toByte(), 0x00.toByte(), 0x01.toByte()
        )

        val response = processor.processCommandApdu(selectAidApdu)
        val statusWord = response.takeLast(2).toByteArray()

        assertArrayEquals("Must return 9000 SW_SUCCESS on valid AID", ApduProtocol.SW_SUCCESS, statusWord)
    }

    @Test
    fun testSelectAid_NotFound() {
        // Wrong AID
        val wrongAidApdu = byteArrayOf(
            0x00.toByte(), 0xA4.toByte(), 0x04.toByte(), 0x00.toByte(),
            0x07.toByte(),
            0x11.toByte(), 0x22.toByte(), 0x33.toByte(), 0x44.toByte(), 0x55.toByte(), 0x66.toByte(), 0x77.toByte()
        )

        val response = processor.processCommandApdu(wrongAidApdu)
        assertArrayEquals("Must return 6A82 on invalid AID", ApduProtocol.SW_APP_NOT_FOUND, response)
    }

    @Test
    fun testAntiCloning_MifareClassicCommandBlocked() {
        // Legacy MIFARE Classic AUTH_A command (0x60)
        val mifareApdu = byteArrayOf(0x00.toByte(), 0x60.toByte(), 0x04.toByte(), 0x00.toByte())
        assertTrue("Anti-Cloning policy must detect forbidden MIFARE command",
            AntiCloningPolicy.isForbiddenMifareCommand(0x00.toByte(), 0x60.toByte())
        )

        val response = processor.processCommandApdu(mifareApdu)
        assertArrayEquals("Must reject MIFARE command with SW_CLA_NOT_SUPPORTED",
            ApduProtocol.SW_CLA_NOT_SUPPORTED, response
        )
    }

    @Test
    fun testHce_RejectsWhenCredentialRevoked() {
        // Mark credential as REVOKED
        lifecycleManager.setCredential(
            LocalCredentialRecord(
                credentialId = "cred-1",
                userId = "usr-1",
                staffId = "STF001",
                deviceId = "dev-1",
                keyAlias = "syncrozz_ses_credential_key",
                status = CredentialStatus.REVOKED,
                issuedAt = System.currentTimeMillis() - 100000,
                expiresAt = System.currentTimeMillis() + 100000,
                lastServerSyncAt = System.currentTimeMillis()
            )
        )

        // GET_CHALLENGE APDU
        val getChallengeApdu = byteArrayOf(0x80.toByte(), 0x84.toByte(), 0x00.toByte(), 0x00.toByte(), 0x00.toByte())
        val response = processor.processCommandApdu(getChallengeApdu)

        assertArrayEquals("Must return 6982 Security Status Not Satisfied when credential is REVOKED",
            ApduProtocol.SW_SECURITY_STATUS_NOT_SATISFIED, response
        )
    }

    @Test
    fun testHce_MutualAuthenticate_SignsWithKeystore() {
        // Activate credential
        lifecycleManager.setCredential(
            LocalCredentialRecord(
                credentialId = "cred-live",
                userId = "usr-1",
                staffId = "STF001",
                deviceId = "dev-1",
                keyAlias = "syncrozz_ses_credential_key",
                status = CredentialStatus.ACTIVE,
                issuedAt = System.currentTimeMillis(),
                expiresAt = System.currentTimeMillis() + 900000,
                lastServerSyncAt = System.currentTimeMillis()
            )
        )

        // MUTUAL_AUTHENTICATE APDU with 32-byte nonce
        val nonce = "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff"
        val nonceBytes = ApduProtocol.hexToBytes(nonce)
        val authApdu = byteArrayOf(
            0x80.toByte(),
            ApduProtocol.INS_MUTUAL_AUTHENTICATE,
            0x00.toByte(),
            0x00.toByte(),
            nonceBytes.size.toByte()
        ) + nonceBytes

        val response = processor.processCommandApdu(authApdu)
        val statusWord = response.takeLast(2).toByteArray()

        assertArrayEquals("Must successfully authenticate with 9000", ApduProtocol.SW_SUCCESS, statusWord)
        assertTrue("Must return signed payload", response.size > 2)
    }
}
