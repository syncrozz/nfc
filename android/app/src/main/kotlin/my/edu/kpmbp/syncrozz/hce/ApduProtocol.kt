package my.edu.kpmbp.syncrozz.hce

/**
 * ISO/IEC 7816-4 APDU Protocol Specification for SES v4.5 Door Access
 */
object ApduProtocol {

    // SES v4.5 Proprietary Application Identifier (AID)
    const val SYNCROZZ_AID_HEX = "A0000008410001"
    val SYNCROZZ_AID_BYTES = hexToBytes(SYNCROZZ_AID_HEX)

    // ISO 7816-4 Status Words
    val SW_SUCCESS = byteArrayOf(0x90.toByte(), 0x00.toByte())
    val SW_APP_NOT_FOUND = byteArrayOf(0x6A.toByte(), 0x82.toByte())
    val SW_SECURITY_STATUS_NOT_SATISFIED = byteArrayOf(0x69.toByte(), 0x82.toByte())
    val SW_CONDITIONS_NOT_SATISFIED = byteArrayOf(0x69.toByte(), 0x85.toByte())
    val SW_WRONG_LENGTH = byteArrayOf(0x67.toByte(), 0x00.toByte())
    val SW_INS_NOT_SUPPORTED = byteArrayOf(0x6D.toByte(), 0x00.toByte())
    val SW_CLA_NOT_SUPPORTED = byteArrayOf(0x6E.toByte(), 0x00.toByte())
    val SW_UNKNOWN_ERROR = byteArrayOf(0x6F.toByte(), 0x00.toByte())

    // Instructions
    const val INS_SELECT: Byte = 0xA4.toByte()
    const val INS_GET_CHALLENGE: Byte = 0x84.toByte()
    const val INS_MUTUAL_AUTHENTICATE: Byte = 0x82.toByte()
    const val INS_GET_CREDENTIAL_STATUS: Byte = 0xF0.toByte()

    fun buildResponse(data: ByteArray, statusWord: ByteArray): ByteArray {
        return data + statusWord
    }

    fun hexToBytes(hex: String): ByteArray {
        val clean = hex.replace(" ", "").trim()
        val result = ByteArray(clean.length / 2)
        for (i in clean.indices step 2) {
            result[i / 2] = clean.substring(i, i + 2).toInt(16).toByte()
        }
        return result
    }

    fun bytesToHex(bytes: ByteArray): String {
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
