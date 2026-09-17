import { NfcDiagnosticResult } from '../types';

export class NfcDiagnosticService {
  /**
   * Evaluates the current runtime environment for NFC and hardware capabilities.
   */
  public static async runDeviceDiagnostic(): Promise<NfcDiagnosticResult> {
    const isBrowser = typeof window !== 'undefined';
    const nav = isBrowser ? window.navigator : ({} as Navigator);
    const ua = nav.userAgent || 'Unknown UserAgent';

    // Real Web NFC API detection
    const webNfcSupported = isBrowser && 'NDEFReader' in window;
    let webNfcPermissionState: 'granted' | 'prompt' | 'denied' | 'unsupported' = 'unsupported';

    if (webNfcSupported && 'permissions' in navigator) {
      try {
        const status = await (navigator.permissions as any).query({ name: 'nfc' });
        webNfcPermissionState = status.state || 'prompt';
      } catch {
        webNfcPermissionState = 'prompt';
      }
    }

    const isAndroid = /Android/i.test(ua);
    const devicePlatform = nav.platform || 'Unknown Platform';
    const hardwareConcurrency = nav.hardwareConcurrency || 4;
    const deviceMemoryGb = (nav as any).deviceMemory || undefined;
    const touchPoints = nav.maxTouchPoints || 0;
    const screenResolution = isBrowser ? `${window.screen.width}x${window.screen.height}` : 'N/A';

    return {
      webNfcSupported,
      webNfcPermissionState,
      isAndroid,
      devicePlatform,
      userAgent: ua,
      touchPoints,
      hardwareConcurrency,
      deviceMemoryGb,
      screenResolution,
      hceSupport: {
        standardHceIso7816: true, // Native Android HostApduService supports standard ISO 7816-4 APDU
        mifareClassic1kEmulation: false, // Standard Android NFC CANNOT emulate MIFARE Classic 1K
        reasonMifareClassicUnsupported:
          'MIFARE Classic requires ISO 14443-3A raw bit-level framing with proprietary NXP CRYPTO1 stream cipher. Standard Android AOSP HCE only supports ISO 14443-4 APDU exchange and generates dynamic randomized UIDs for privacy.',
        randomizedUidPolicy: true, // Android HCE randomizes UID with 0x08 prefix
      },
      supportedTechnologies: [
        {
          name: 'Android Host-based Card Emulation (HCE)',
          standard: 'ISO/IEC 7816-4 / ISO 14443-4 (Type A)',
          supportedByAndroidHce: true,
          frequency: '13.56 MHz',
          notes: 'Supported natively in Android 4.4+ via HostApduService with registered AID routing.',
        },
        {
          name: 'Bluetooth Low Energy (BLE) Access',
          standard: 'Bluetooth Core v4.2 / 5.0+ GATT',
          supportedByAndroidHce: true,
          frequency: '2.4 GHz',
          notes: 'Supported natively via Android BluetoothLeAdvertiser and GATT peripheral mode.',
        },
        {
          name: 'NFC Data Exchange Format (NDEF)',
          standard: 'NFC Forum Type 1-5 / NDEF',
          supportedByAndroidHce: true,
          frequency: '13.56 MHz',
          notes: 'Supported for tag reading/writing via Android NfcAdapter and Web NFC API.',
        },
        {
          name: 'MIFARE DESFire (EV1/EV2/EV3)',
          standard: 'ISO/IEC 14443-4 Type A + AES/3DES',
          supportedByAndroidHce: true,
          frequency: '13.56 MHz',
          notes: 'Standard APDU commands can be emulated via HCE; custom crypto requires software key handling.',
        },
        {
          name: 'NXP MIFARE Classic 1K / 4K',
          standard: 'ISO/IEC 14443-3A (Proprietary Framing)',
          supportedByAndroidHce: false,
          frequency: '13.56 MHz',
          notes:
            'STRICTLY UNSUPPORTED for standard Android HCE. Requires hardware CRYPTO1 cipher & 4-byte static UID.',
        },
        {
          name: 'Vicinity Cards (HID iClass legacy / ISO 15693)',
          standard: 'ISO/IEC 15693 (NFC-V)',
          supportedByAndroidHce: false,
          frequency: '13.56 MHz',
          notes: 'Standard Android HCE does not support ISO 15693 card emulation.',
        },
      ],
    };
  }
}
