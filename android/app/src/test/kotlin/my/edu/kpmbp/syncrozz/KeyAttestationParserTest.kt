package my.edu.kpmbp.syncrozz

import my.edu.kpmbp.syncrozz.keystore.KeyAttestationParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.math.BigInteger
import java.security.KeyPairGenerator
import java.security.cert.Certificate
import java.security.cert.X509Certificate
import java.util.Date

class KeyAttestationParserTest {

    @Test
    fun testEmptyCertificateChain_FailsValidation() {
        val emptyChain = emptyList<Certificate>()
        val result = KeyAttestationParser.verifyCertificateChain(emptyChain, "challenge_123")

        assertFalse("Empty certificate chain must be rejected", result.isValid)
        assertEquals("Attestation certificate chain is empty", result.failureReason)
    }

    @Test
    fun testKeyAttestationOidConstant() {
        // Standard Android Key Attestation Extension OID
        assertEquals("1.3.6.1.4.1.11129.2.1.17", KeyAttestationParser.KEY_ATTESTATION_OID)
    }
}
