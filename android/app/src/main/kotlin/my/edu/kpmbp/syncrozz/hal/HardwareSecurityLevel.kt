package my.edu.kpmbp.syncrozz.hal

/**
 * SES v4.5 Cryptographic Hardware Isolation Levels
 */
enum class HardwareSecurityLevel(val description: String, val isProductionCertified: Boolean) {
    STRONGBOX("Dedicated Secure Element (StrongBox Keymaster)", true),
    TEE("Trusted Execution Environment (ARM TrustZone)", true),
    SOFTWARE_EMULATION("Software KeyStore (Development Only - Non-Compliant with SES v4.5)", false);

    companion object {
        fun fromSecurityLevel(securityLevel: Int): HardwareSecurityLevel {
            return when (securityLevel) {
                2 -> STRONGBOX  // SecurityLevel.STRONGBOX
                1 -> TEE        // SecurityLevel.TRUSTED_ENVIRONMENT
                else -> SOFTWARE_EMULATION
            }
        }
    }
}
