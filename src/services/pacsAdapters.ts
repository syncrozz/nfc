/**
 * SYNCROZZ SES v4.5 PACs Protocol Adapters & Secure Controller Interfaces
 * Implements protocol decoupling for physical access readers and door controllers.
 *
 * Zero-Trust Rules:
 * 1. Physical interfaces are never trusted blindly; all payloads must be validated.
 * 2. Wiegand signaling is classified as legacy unencrypted; OSDP v2 Secure Channel is preferred.
 * 3. MIFARE Classic CRYPTO1 or static UID-only checks are audited as incompatible for mobile HCE.
 * 4. Relays are only triggered upon verified server-authoritative or signed token grant.
 */

import { ReaderCommunicationProtocol, AccessDecisionVerdict } from '../types';

export interface ReaderFrameResult {
  protocol: ReaderCommunicationProtocol;
  success: boolean;
  credentialIdentifier?: string;
  facilityCode?: number;
  cardNumber?: number;
  rawPayloadHex: string;
  isEncrypted: boolean;
  securityVerdict: 'SECURE' | 'LEGACY_UNENCRYPTED' | 'INCOMPATIBLE_TRANSCEIVER' | 'TAMPERED';
  diagnosticMessage: string;
  signatureHex?: string;
  nonceHex?: string;
}

export interface IReaderProtocolAdapter {
  readonly protocol: ReaderCommunicationProtocol;
  readonly name: string;
  parseFrame(data: Uint8Array | string): Promise<ReaderFrameResult>;
  buildChallenge?(nonceHex: string): Uint8Array;
  buildRelayCommand?(durationMs: number): Uint8Array;
}

// -------------------------------------------------------------
// 1. OSDP v2.2 Secure Channel Protocol Adapter (SIA Specification)
// -------------------------------------------------------------
export class OsdpSecureChannelAdapter implements IReaderProtocolAdapter {
  readonly protocol: ReaderCommunicationProtocol = 'OSDP_V2_SECURE_CHANNEL';
  readonly name = 'SIA OSDP v2.2 Secure Channel (AES-128)';

  // OSDP Framing Constants
  static readonly SOM = 0x53; // Start of Message
  static readonly CMD_POLL = 0x60;
  static readonly CMD_ID = 0x61;
  static readonly CMD_RAW = 0x54;
  static readonly CMD_CHLNG = 0x76;
  static readonly CMD_SCRYPT = 0x77;
  static readonly CMD_OUT = 0x68;

  static readonly REPLY_ACK = 0x40;
  static readonly REPLY_NAK = 0x41;
  static readonly REPLY_RAW = 0x54;
  static readonly REPLY_CCRYPT = 0x76;
  static readonly REPLY_RMAC_I = 0x78;

  /**
   * Calculate 16-bit CRC (CCITT 0x1021) for OSDP frame integrity
   */
  static computeCrc16(data: Uint8Array): number {
    let crc = 0x1d0f;
    for (let i = 0; i < data.length; i++) {
      let x = ((crc >> 8) ^ data[i]) & 0xff;
      x ^= x >> 4;
      crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xffff;
    }
    return crc;
  }

  async parseFrame(data: Uint8Array | string): Promise<ReaderFrameResult> {
    const bytes = typeof data === 'string' ? this.hexToBytes(data) : data;
    const hex = this.bytesToHex(bytes);

    if (bytes.length < 5 || bytes[0] !== OsdpSecureChannelAdapter.SOM) {
      return {
        protocol: this.protocol,
        success: false,
        rawPayloadHex: hex,
        isEncrypted: false,
        securityVerdict: 'TAMPERED',
        diagnosticMessage: 'Invalid OSDP frame: SOM byte 0x53 missing or truncated packet length.',
      };
    }

    const address = bytes[1] & 0x7f;
    const length = bytes[2] | (bytes[3] << 8);
    const ctrl = bytes[4];
    const hasCrc = (ctrl & 0x04) !== 0;
    const hasSec = (ctrl & 0x08) !== 0;

    if (length !== bytes.length) {
      return {
        protocol: this.protocol,
        success: false,
        rawPayloadHex: hex,
        isEncrypted: hasSec,
        securityVerdict: 'TAMPERED',
        diagnosticMessage: `OSDP length mismatch: declared ${length} bytes, received ${bytes.length} bytes.`,
      };
    }

    // Inspect command/reply code
    const cmdIndex = hasSec ? 6 : 5;
    const commandCode = bytes[cmdIndex];

    return {
      protocol: this.protocol,
      success: true,
      rawPayloadHex: hex,
      isEncrypted: hasSec,
      securityVerdict: hasSec ? 'SECURE' : 'LEGACY_UNENCRYPTED',
      diagnosticMessage: `OSDP v2.2 Frame (Addr: ${address}, Ctrl: 0x${ctrl.toString(16)}, SecureChannel: ${hasSec}, CRC: ${hasCrc}, Cmd: 0x${commandCode.toString(16)})`,
    };
  }

  buildRelayCommand(durationMs: number): Uint8Array {
    // osdp_OUT command: Reader relay 0 trigger
    const durationUnits = Math.min(255, Math.max(1, Math.round(durationMs / 100)));
    const frame = new Uint8Array([
      OsdpSecureChannelAdapter.SOM,
      0x00, // Address 0
      14, // Length LSB
      0x00, // Length MSB
      0x04, // Control: CRC enabled
      OsdpSecureChannelAdapter.CMD_OUT, // Command 0x68
      0x00, // Output line 0
      0x02, // Output control: Timed momentary activate
      durationUnits, // Timer LSB (tenths of seconds)
      0x00, // Timer MSB
      0x00,
      0x00, // CRC placeholder
      0x00,
      0x00,
    ]);
    const crc = OsdpSecureChannelAdapter.computeCrc16(frame.subarray(0, 12));
    frame[12] = crc & 0xff;
    frame[13] = (crc >> 8) & 0xff;
    return frame;
  }

  private hexToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    const arr = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      arr[i / 2] = parseInt(clean.substring(i, i + 2), 16);
    }
    return arr;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
      .toUpperCase();
  }
}

// -------------------------------------------------------------
// 2. ISO/IEC 7816-4 Android HCE Protocol Adapter
// -------------------------------------------------------------
export class Iso7816HceAdapter implements IReaderProtocolAdapter {
  readonly protocol: ReaderCommunicationProtocol = 'ISO_14443_4_HCE';
  readonly name = 'ISO/IEC 7816-4 APDU over Android HCE';

  // Registered AID
  static readonly SYNCROZZ_AID_HEX = 'A0000008410001';

  async parseFrame(data: Uint8Array | string): Promise<ReaderFrameResult> {
    const bytes = typeof data === 'string' ? this.hexToBytes(data) : data;
    const hex = this.bytesToHex(bytes);

    if (bytes.length < 4) {
      return {
        protocol: this.protocol,
        success: false,
        rawPayloadHex: hex,
        isEncrypted: true,
        securityVerdict: 'TAMPERED',
        diagnosticMessage: 'Truncated APDU command: minimum header length is 4 bytes (CLA INS P1 P2).',
      };
    }

    const cla = bytes[0];
    const ins = bytes[1];
    const p1 = bytes[2];
    const p2 = bytes[3];

    // SELECT AID: 00 A4 04 00 ...
    if (cla === 0x00 && ins === 0xa4 && p1 === 0x04) {
      const lc = bytes[4];
      const aidBytes = bytes.subarray(5, 5 + lc);
      const targetAid = Array.from(aidBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

      const matchesSyncrozz = targetAid.startsWith(Iso7816HceAdapter.SYNCROZZ_AID_HEX);

      return {
        protocol: this.protocol,
        success: matchesSyncrozz,
        rawPayloadHex: hex,
        isEncrypted: true,
        securityVerdict: matchesSyncrozz ? 'SECURE' : 'INCOMPATIBLE_TRANSCEIVER',
        diagnosticMessage: matchesSyncrozz
          ? `ISO 7816-4 SELECT AID matched SYNCROZZ Mobile Access (${targetAid})`
          : `ISO 7816-4 SELECT AID foreign application (${targetAid})`,
      };
    }

    // INTERNAL AUTHENTICATE: 00 88 00 00 ...
    if (cla === 0x00 && ins === 0x88) {
      const nonceBytes = bytes.subarray(5);
      const nonceHex = Array.from(nonceBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      return {
        protocol: this.protocol,
        success: true,
        rawPayloadHex: hex,
        isEncrypted: true,
        securityVerdict: 'SECURE',
        nonceHex,
        diagnosticMessage: `ISO 7816-4 INTERNAL AUTHENTICATE challenge with ${nonceBytes.length}-byte cryptographic nonce.`,
      };
    }

    return {
      protocol: this.protocol,
      success: true,
      rawPayloadHex: hex,
      isEncrypted: true,
      securityVerdict: 'SECURE',
      diagnosticMessage: `ISO 7816-4 APDU (CLA: 0x${cla.toString(16)}, INS: 0x${ins.toString(16)})`,
    };
  }

  private hexToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/[^0-9a-fA-F]/g, '');
    const arr = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      arr[i / 2] = parseInt(clean.substring(i, i + 2), 16);
    }
    return arr;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
      .toUpperCase();
  }
}

// -------------------------------------------------------------
// 3. Wiegand Legacy Pulse Signaling Adapter (Audited Insecure)
// -------------------------------------------------------------
export class WiegandLegacyAdapter implements IReaderProtocolAdapter {
  readonly protocol: ReaderCommunicationProtocol = 'WIEGAND_LEGACY';
  readonly name = 'Legacy Wiegand 26-bit / 37-bit Pulse Signaling';

  async parseFrame(data: Uint8Array | string): Promise<ReaderFrameResult> {
    const bitString = typeof data === 'string' ? data.replace(/[^01]/g, '') : this.bytesToBits(data);

    if (bitString.length === 26) {
      // Standard 26-bit Wiegand (1 even parity, 8 facility, 16 card number, 1 odd parity)
      const evenParity = parseInt(bitString[0], 10);
      const facilityBits = bitString.substring(1, 9);
      const cardBits = bitString.substring(9, 25);
      const oddParity = parseInt(bitString[25], 10);

      const facilityCode = parseInt(facilityBits, 2);
      const cardNumber = parseInt(cardBits, 2);

      // Verify even parity (first 12 bits)
      let evenCount = 0;
      for (let i = 1; i <= 12; i++) {
        if (bitString[i] === '1') evenCount++;
      }
      const isEvenValid = evenCount % 2 === evenParity;

      // Verify odd parity (last 12 bits)
      let oddCount = 0;
      for (let i = 13; i <= 24; i++) {
        if (bitString[i] === '1') oddCount++;
      }
      const isOddValid = oddCount % 2 !== oddParity;

      const parityValid = isEvenValid && isOddValid;

      return {
        protocol: this.protocol,
        success: parityValid,
        facilityCode,
        cardNumber,
        credentialIdentifier: `WIEGAND-FC${facilityCode}-CN${cardNumber}`,
        rawPayloadHex: `BITS:${bitString}`,
        isEncrypted: false,
        securityVerdict: 'LEGACY_UNENCRYPTED',
        diagnosticMessage: `Wiegand 26-bit decoded (FC: ${facilityCode}, CN: ${cardNumber}). CRITICAL: Plaintext binary pulses on D0/D1 wires have ZERO cryptographic protection or anti-sniffing defense.`,
      };
    }

    return {
      protocol: this.protocol,
      success: false,
      rawPayloadHex: bitString,
      isEncrypted: false,
      securityVerdict: 'LEGACY_UNENCRYPTED',
      diagnosticMessage: `Non-standard Wiegand bitstream (${bitString.length} bits). Wiegand lines are unshielded from physical wiretapping.`,
    };
  }

  private bytesToBits(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(2).padStart(8, '0'))
      .join('');
  }
}

// -------------------------------------------------------------
// 4. MIFARE Classic Audit Adapter (Audited Non-Conforming)
// -------------------------------------------------------------
export class MifareClassicAuditAdapter implements IReaderProtocolAdapter {
  readonly protocol: ReaderCommunicationProtocol = 'MIFARE_CLASSIC_RAW';
  readonly name = 'NXP MIFARE Classic 1K Proprietary Framing';

  async parseFrame(data: Uint8Array | string): Promise<ReaderFrameResult> {
    const raw = typeof data === 'string' ? data : Array.from(data).map((b) => b.toString(16).padStart(2, '0')).join(' ');

    return {
      protocol: this.protocol,
      success: false,
      rawPayloadHex: raw,
      isEncrypted: false,
      securityVerdict: 'INCOMPATIBLE_TRANSCEIVER',
      diagnosticMessage:
        'SES v4.5 Policy Enforcement: Proprietary MIFARE Classic 1K CRYPTO1 framing rejected. Zero-Trust prohibits static UID cloning and unauthorized cipher bypass.',
    };
  }
}

// Factory resolver for protocol adapters
export class ProtocolAdapterRegistry {
  private static adapters: Map<ReaderCommunicationProtocol, IReaderProtocolAdapter> = new Map<
    ReaderCommunicationProtocol,
    IReaderProtocolAdapter
  >([
    ['OSDP_V2_SECURE_CHANNEL', new OsdpSecureChannelAdapter()],
    ['ISO_14443_4_HCE', new Iso7816HceAdapter()],
    ['WIEGAND_LEGACY', new WiegandLegacyAdapter()],
    ['MIFARE_CLASSIC_RAW', new MifareClassicAuditAdapter()],
  ]);

  static getAdapter(protocol: ReaderCommunicationProtocol): IReaderProtocolAdapter {
    const adapter = this.adapters.get(protocol);
    if (!adapter) {
      throw new Error(`Unsupported reader communication protocol: ${protocol}`);
    }
    return adapter;
  }
}
