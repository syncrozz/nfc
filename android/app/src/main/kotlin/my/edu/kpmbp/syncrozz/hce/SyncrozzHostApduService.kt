package my.edu.kpmbp.syncrozz.hce

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import my.edu.kpmbp.syncrozz.hal.IHardwareSecurityModule
import my.edu.kpmbp.syncrozz.keystore.AndroidKeystoreProvider
import my.edu.kpmbp.syncrozz.lifecycle.CredentialLifecycleManager

/**
 * Android Host Card Emulation (HCE) Service for SES v4.5
 *
 * Implements ISO/IEC 7816-4 APDU interface for contactless NFC door readers.
 * Delegates command processing to [ApduCommandProcessor] via the Hardware Abstraction Layer.
 */
class SyncrozzHostApduService : HostApduService() {

    companion object {
        var hardwareModule: IHardwareSecurityModule? = null
        var lifecycleManager: CredentialLifecycleManager = CredentialLifecycleManager()
        var currentKeyAlias: String = "syncrozz_ses_credential_key"
    }

    private val hsm: IHardwareSecurityModule by lazy {
        hardwareModule ?: AndroidKeystoreProvider()
    }

    private val processor: ApduCommandProcessor by lazy {
        ApduCommandProcessor(hsm, lifecycleManager, currentKeyAlias)
    }

    override fun processCommandApdu(commandApdu: ByteArray, extras: Bundle?): ByteArray {
        return processor.processCommandApdu(commandApdu)
    }

    override fun onDeactivated(reason: Int) {
        // Reader session terminated
    }
}
