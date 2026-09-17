package my.edu.kpmbp.syncrozz

import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.PackageManager
import android.nfc.NfcAdapter
import android.nfc.cardemulation.CardEmulation
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import my.edu.kpmbp.syncrozz.bridge.SyncrozzNativeBridge
import my.edu.kpmbp.syncrozz.hce.SyncrozzHostApduService

/**
 * Main Activity hosting the SES v4.5 Android Hybrid Interface
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private var nfcAdapter: NfcAdapter? = null
    private var cardEmulation: CardEmulation? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        // Verify NFC & HCE capabilities
        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        if (nfcAdapter != null && packageManager.hasSystemFeature(PackageManager.FEATURE_NFC_HOST_CARD_EMULATION)) {
            cardEmulation = CardEmulation.getInstance(nfcAdapter)
        }

        // Configure WebView settings
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            allowContentAccess = false
            allowFileAccess = false
        }

        // Register the Native Android Hardware Bridge
        webView.addJavascriptInterface(
            SyncrozzNativeBridge(),
            "AndroidNativeBridge"
        )

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Notify the web application that native hardware is available
                webView.evaluateJavascript(
                    "window.__SYNCROZZ_NATIVE_ANDROID_ACTIVE__ = true;",
                    null
                )
            }
        }

        // Load local asset or deployed URL
        webView.loadUrl("https://localhost:3000")
    }

    override fun onResume() {
        super.onResume()
        // Ensure HCE service is preferred when activity is in foreground
    }
}
