package my.edu.kpmbp.syncrozz.anticloning

/**
 * SES v4.5 Anti-Cloning & Security Hardening Policy
 *
 * Mandates:
 * 1. Android HCE operates over standard ISO/IEC 14443-4 with randomized UIDs.
 * 2. Doors MUST NOT rely on static UIDs (which are trivial to clone with cheap Chinese magic cards).
 * 3. Rejects legacy proprietary MIFARE Classic CRYPTO1 commands.
 * 4. Demands server-authoritative challenge-response with ECDSA P-256 signatures for every access grant.
 */
object AntiCloningPolicy {

    // Forbidden MIFARE Classic proprietary command codes
    private val FORBIDDEN_MIFARE_OPCODES = setOf(
        0x60.toByte(), // MIFARE AUTH_A
        0x61.toByte(), // MIFARE AUTH_B
        0x30.toByte(), // MIFARE READ
        0xA0.toByte(), // MIFARE WRITE
    )

    fun isForbiddenMifareCommand(cla: Byte, ins: Byte): Boolean {
        // Native MIFARE Classic uses proprietary framing outside standard ISO 7816-4 APDU
        return FORBIDDEN_MIFARE_OPCODES.contains(ins)
    }

    fun isStaticUidAccessAttempt(readerExpectsStaticUid: Boolean): Boolean {
        // SES v4.5 forbids reader-side authorization based only on UID
        return readerExpectsStaticUid
    }
}
