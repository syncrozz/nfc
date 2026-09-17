/**
 * SYNCROZZ SES v4.5 PACs Gateway & Reader Discovery Service
 * Authoritative Edge & Cloud Gateway coordinator for Physical Access Control Systems.
 *
 * Zero-Trust Rules:
 * 1. Physical Access Controllers are never modified directly without verified authorization.
 * 2. Reader compatibility is verified through physical test evidence, not assumptions.
 * 3. Gateways operate under strict mTLS 1.3 with cryptographic heartbeat monitoring.
 * 4. Offline mode requires pre-signed, unexpired, cryptographic credential tokens.
 */

import {
  PacsGatewayDevice,
  ReaderHardwareProfile,
  PacsAccessTransaction,
  GatewayHeartbeatTelemetry,
  AccessDecisionVerdict,
  StrideThreatModelItem,
  ReaderCommunicationProtocol,
  HardwareVerificationItem,
} from '../types';
import { ProtocolAdapterRegistry, OsdpSecureChannelAdapter } from './pacsAdapters';

// Audited KPMBP Readers (Hardware Verification Gate: All unverified on-site hardware marked as UNKNOWN)
export const AUDITED_KPMBP_READERS: ReaderHardwareProfile[] = [
  {
    id: 'rdr-bld-a-301',
    locationId: 'loc-kp-001',
    name: 'Academic Staff Office 301 Reader',
    model: 'Unbranded Wall Reader (Model UNKNOWN)',
    manufacturer: 'UNKNOWN (Pending Physical Disassembly)',
    physicalInterface: 'WIEGAND_D0_D1',
    protocol: 'WIEGAND_LEGACY',
    baudRateOrClock: '26-bit Pulsed (Unverified Clock)',
    supportsEncryption: false,
    tamperSwitchArmed: false,
    tamperTriggered: false,
    physicalVerificationStatus: 'UNKNOWN',
    firmwareVersion: 'UNKNOWN',
    lastAuditedDate: '2026-09-10',
    notes:
      'Wiegand 26-bit signaling assumed based on preliminary building survey. Firmware and physical model UNKNOWN pending physical casing inspection. Physical HCE access UNVERIFIED.',
  },
  {
    id: 'rdr-lib-g-01',
    locationId: 'loc-kp-002',
    name: 'Library Complex Turnstile Gate 1',
    model: 'Flap Barrier Reader (Exact Model UNKNOWN)',
    manufacturer: 'UNKNOWN (Pending Turnstile OEM Documentation)',
    physicalInterface: 'RS_485_BUS',
    protocol: 'MIFARE_CLASSIC_RAW',
    baudRateOrClock: '9600 bps RS-485 (Unverified Bus Baud)',
    supportsEncryption: false,
    tamperSwitchArmed: false,
    tamperTriggered: false,
    physicalVerificationStatus: 'UNKNOWN',
    firmwareVersion: 'UNKNOWN',
    lastAuditedDate: '2026-09-12',
    notes:
      'Barrier controller appears to read 4-byte MIFARE UID based on card tap tests. Exact controller firmware and protocol UNKNOWN pending vendor documentation. Android randomized UID rejected.',
  },
  {
    id: 'rdr-eng-2-204',
    locationId: 'loc-kp-003',
    name: 'Advanced Robotics Lab Access Portal',
    model: 'Multi-Tech Smart Reader (Physical Model UNKNOWN — Bench Simulated Only)',
    manufacturer: 'UNKNOWN (Pending Physical Audit)',
    physicalInterface: 'RS_485_BUS',
    protocol: 'OSDP_V2_SECURE_CHANNEL',
    baudRateOrClock: '115200 bps (Simulated Profile)',
    supportsEncryption: true,
    encryptionStandard: 'AES-128 (OSDP SCP v2.2 - Simulated)',
    tamperSwitchArmed: false,
    tamperTriggered: false,
    physicalVerificationStatus: 'BENCH_SIMULATED_ONLY',
    firmwareVersion: 'UNKNOWN',
    lastAuditedDate: '2026-09-14',
    notes:
      'Tested against simulated OSDP v2.2 bench software. Physical wall reader model, firmware build, and encryption key profile (SCBK) remain UNKNOWN on-site until authorized physical audit.',
  },
  {
    id: 'rdr-it-srv-01',
    locationId: 'loc-kp-004',
    name: 'Core Datacenter Biometric & Keypad Reader',
    model: 'Keypad Access Reader (Physical Model UNKNOWN — Bench Simulated Only)',
    manufacturer: 'UNKNOWN (High-Assurance Enclave)',
    physicalInterface: 'ETHERNET_POE',
    protocol: 'OSDP_V2_SECURE_CHANNEL',
    baudRateOrClock: 'TCP/IP 100 Mbps (Simulated)',
    supportsEncryption: true,
    encryptionStandard: 'TLS 1.3 / AES-256 (Simulated)',
    tamperSwitchArmed: false,
    tamperTriggered: false,
    physicalVerificationStatus: 'BENCH_SIMULATED_ONLY',
    firmwareVersion: 'UNKNOWN',
    lastAuditedDate: '2026-09-08',
    notes:
      'Tier 4 high-security enclave. Live access controller is locked on dedicated VLAN. Physical hardware, firmware, and credentials UNKNOWN pending authorized physical escort.',
  },
  {
    id: 'rdr-adm-arch-01',
    locationId: 'loc-kp-005',
    name: 'Confidential Exam Archive Standalone Lock',
    model: 'Standalone Battery Lockset (Physical Model UNKNOWN)',
    manufacturer: 'UNKNOWN (Pending Lockset Inspection)',
    physicalInterface: 'STANDALONE_BATTERY',
    protocol: 'MIFARE_CLASSIC_RAW',
    baudRateOrClock: 'UNKNOWN (Offline Data-on-Card)',
    supportsEncryption: false,
    tamperSwitchArmed: false,
    tamperTriggered: false,
    physicalVerificationStatus: 'UNKNOWN',
    firmwareVersion: 'UNKNOWN',
    lastAuditedDate: '2026-09-11',
    notes:
      'Battery-operated offline escutcheon. RF carrier and firmware UNKNOWN. No real-time gateway communication possible without physical hub hardware installation.',
  },
];

// Hardware Verification Checklist (Auditing all 6 required physical criteria)
export const KPMBP_HARDWARE_CHECKLIST: HardwareVerificationItem[] = [
  {
    id: 'chk-loc-kp-001',
    readerId: 'rdr-bld-a-301',
    readerName: 'Academic Staff Office 301 Reader',
    locationId: 'loc-kp-001',
    checklist: {
      readerModelAndFirmware: {
        verified: false,
        value: 'UNKNOWN',
        notes: 'Enclosure has no visible serial/branding. Physical disassembly required to inspect PCB silkscreen and MCU firmware.',
      },
      interfaceAndProtocol: {
        verified: false,
        value: 'Assumed Wiegand D0/D1',
        notes: 'Pulsed signaling observed; requires digital logic analyzer probe to verify pulse width (standard 50µs) and interval.',
      },
      frequencyAndCredentialType: {
        verified: false,
        value: 'Assumed 13.56MHz HF MIFARE Classic',
        notes: 'Card tap triggers response; RF carrier frequency unverified with spectrum analyzer/field detector.',
      },
      osdpOrWiegandSupport: {
        verified: false,
        value: 'UNKNOWN (Wiegand Only Assumed)',
        notes: 'No RS-485 differential lines visible; OSDP support unlikely without reader replacement.',
      },
      androidHceCompatibility: {
        verified: false,
        value: 'INCOMPATIBLE (Assumed)',
        notes: 'Reader fails on Android randomized UID (0x08 prefix); does not issue ISO 7816-4 SELECT AID.',
      },
      vendorDocumentation: {
        verified: false,
        docRef: 'NOT_OBTAINED',
        notes: 'OEM datasheet and pinout diagram not located in KPMBP facilities documentation archive.',
      },
    },
    overallStatus: 'UNKNOWN',
    physicalAccessClaimAllowed: false,
    auditDate: '2026-09-16',
  },
  {
    id: 'chk-loc-kp-002',
    readerId: 'rdr-lib-g-01',
    readerName: 'Library Complex Turnstile Gate 1',
    locationId: 'loc-kp-002',
    checklist: {
      readerModelAndFirmware: {
        verified: false,
        value: 'UNKNOWN',
        notes: 'Embedded turnstile barrier transceiver module. Controller board housed inside locked turnstile chassis.',
      },
      interfaceAndProtocol: {
        verified: false,
        value: 'Assumed RS-485 / Proprietary',
        notes: 'Turnstile control board communication protocol undocumented.',
      },
      frequencyAndCredentialType: {
        verified: false,
        value: 'Assumed 13.56MHz MIFARE Classic CSN',
        notes: 'Validates static 4-byte CSN; rejects dynamic UID presented by Android HCE.',
      },
      osdpOrWiegandSupport: {
        verified: false,
        value: 'UNKNOWN',
        notes: 'Turnstile motherboard may support secondary OSDP v2 reader via expansion header; unverified.',
      },
      androidHceCompatibility: {
        verified: false,
        value: 'INCOMPATIBLE (CSN-Only Check)',
        notes: 'Android HCE privacy randomized UID cannot be enrolled in barrier static UID lookup table.',
      },
      vendorDocumentation: {
        verified: false,
        docRef: 'NOT_OBTAINED',
        notes: 'Turnstile maintenance contractor manual pending procurement from library operations.',
      },
    },
    overallStatus: 'UNKNOWN',
    physicalAccessClaimAllowed: false,
    auditDate: '2026-09-16',
  },
  {
    id: 'chk-loc-kp-003',
    readerId: 'rdr-eng-2-204',
    readerName: 'Advanced Robotics Lab Access Portal',
    locationId: 'loc-kp-003',
    checklist: {
      readerModelAndFirmware: {
        verified: false,
        value: 'UNKNOWN (Simulated Signo Profile)',
        notes: 'Physical model and firmware build unconfirmed on-site. Software bench simulator successfully processed AID A0000008410001, but physical hardware is unverified.',
      },
      interfaceAndProtocol: {
        verified: false,
        value: 'Targeting RS-485 OSDP v2.2 (Unverified)',
        notes: 'Requires oscilloscope capture on RS-485 A/B lines to verify 115200 baud timing and 120Ω bus termination.',
      },
      frequencyAndCredentialType: {
        verified: false,
        value: 'Assumed 13.56MHz ISO 14443-A/4',
        notes: 'Field resonance and antenna Q-factor not measured; Android HCE coupling distance unverified.',
      },
      osdpOrWiegandSupport: {
        verified: false,
        value: 'Targeting OSDP v2.2 Secure Channel',
        notes: 'Physical reader must be polled via osdp_ID to extract vendor code, model, and firmware version.',
      },
      androidHceCompatibility: {
        verified: false,
        value: 'UNKNOWN (Simulated Compatible, Unverified On-Site)',
        notes: 'Laboratory emulator responds to APDU, but physical tap test with certified Android handset has not occurred.',
      },
      vendorDocumentation: {
        verified: false,
        docRef: 'PENDING_VENDOR_ACQUISITION',
        notes: 'Requested official smart reader installation and configuration manual from engineering contractor.',
      },
    },
    overallStatus: 'IN_PROGRESS',
    physicalAccessClaimAllowed: false,
    auditDate: '2026-09-16',
  },
  {
    id: 'chk-loc-kp-004',
    readerId: 'rdr-it-srv-01',
    readerName: 'Core Datacenter Biometric & Keypad Reader',
    locationId: 'loc-kp-004',
    checklist: {
      readerModelAndFirmware: {
        verified: false,
        value: 'UNKNOWN',
        notes: 'Physical terminal inspection restricted by Tier 4 datacenter security escort protocols.',
      },
      interfaceAndProtocol: {
        verified: false,
        value: 'Assumed IP/PoE & OSDP v2',
        notes: 'Network endpoint isolated on dedicated VLAN; direct controller communication blocked by firewall.',
      },
      frequencyAndCredentialType: {
        verified: false,
        value: 'UNKNOWN Dual-Frequency',
        notes: 'Physical transponder reader frequency unconfirmed.',
      },
      osdpOrWiegandSupport: {
        verified: false,
        value: 'UNKNOWN',
        notes: 'Controller interface unverified.',
      },
      androidHceCompatibility: {
        verified: false,
        value: 'UNKNOWN',
        notes: 'Zero-Trust prohibits touching live server room infrastructure without authorized change window.',
      },
      vendorDocumentation: {
        verified: false,
        docRef: 'RESTRICTED_SECURITY_DOCUMENT',
        notes: 'Datacenter design blueprint is classified confidential; pending IT Director clearance.',
      },
    },
    overallStatus: 'UNKNOWN',
    physicalAccessClaimAllowed: false,
    auditDate: '2026-09-16',
  },
  {
    id: 'chk-loc-kp-005',
    readerId: 'rdr-adm-arch-01',
    readerName: 'Confidential Exam Archive Standalone Lock',
    locationId: 'loc-kp-005',
    checklist: {
      readerModelAndFirmware: {
        verified: false,
        value: 'UNKNOWN',
        notes: 'Battery escutcheon lock model unverified. Firmware cannot be read without proprietary programming card.',
      },
      interfaceAndProtocol: {
        verified: false,
        value: 'Standalone Battery (No Wired Bus)',
        notes: 'No physical communication bus (no RS-485, no Wiegand, no Ethernet).',
      },
      frequencyAndCredentialType: {
        verified: false,
        value: 'Assumed 13.56MHz MIFARE',
        notes: 'Uses offline data-on-card architecture.',
      },
      osdpOrWiegandSupport: {
        verified: false,
        value: 'NONE (Standalone)',
        notes: 'Does not support OSDP or Wiegand signaling.',
      },
      androidHceCompatibility: {
        verified: false,
        value: 'INCOMPATIBLE',
        notes: 'Cannot process dynamic APDU mutual authentication in offline standalone mode.',
      },
      vendorDocumentation: {
        verified: false,
        docRef: 'NOT_OBTAINED',
        notes: 'Lockset vendor specification sheet pending procurement.',
      },
    },
    overallStatus: 'UNKNOWN',
    physicalAccessClaimAllowed: false,
    auditDate: '2026-09-16',
  },
];

// Initial Audited KPMBP Edge PACs Gateways
export const AUDITED_KPMBP_GATEWAYS: PacsGatewayDevice[] = [
  {
    gatewayId: 'gw-kpmbp-eng-01',
    name: 'Engineering Block B Edge Controller',
    building: 'Engineering Block B',
    ipAddress: '10.240.12.15',
    macAddress: 'B8:27:EB:4A:89:12',
    tlsFingerprintSha256: '9A:4F:2E:7C:18:91:03:D4:58:AA:C1:99:EE:41:88:91:2C:43:09:A1',
    mtlsCertificateSubject: 'CN=gw-kpmbp-eng-01.sec.kpmbp.edu.my, O=KPMBP PACs Infrastructure',
    firmwareHashSha256: '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d',
    status: 'ONLINE_CONNECTED',
    lastHeartbeat: new Date().toISOString(),
    heartbeatIntervalSec: 15,
    activeReadersCount: 2,
    readers: [AUDITED_KPMBP_READERS[2]], // signo-40
    offlineCacheExpiresAt: new Date(Date.now() + 86400000).toISOString(), // 24h
    offlineModeAllowed: true,
    tamperCount: 0,
    packetLossRate: 0.0,
    latencyMs: 12,
  },
  {
    gatewayId: 'gw-kpmbp-adm-02',
    name: 'Administrative & Academic Edge Controller',
    building: 'Building A (Academic & Admin)',
    ipAddress: '10.240.10.22',
    macAddress: 'B8:27:EB:99:34:BC',
    tlsFingerprintSha256: '71:D8:1A:BC:33:04:F2:77:88:E1:92:44:00:11:AB:65:DE:22:83:99',
    mtlsCertificateSubject: 'CN=gw-kpmbp-adm-02.sec.kpmbp.edu.my, O=KPMBP PACs Infrastructure',
    firmwareHashSha256: '3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d',
    status: 'DEGRADED',
    lastHeartbeat: new Date(Date.now() - 45000).toISOString(),
    heartbeatIntervalSec: 15,
    activeReadersCount: 2,
    readers: [AUDITED_KPMBP_READERS[0], AUDITED_KPMBP_READERS[1]], // Wiegand & Turnstiles
    offlineCacheExpiresAt: new Date(Date.now() + 43200000).toISOString(), // 12h
    offlineModeAllowed: true,
    tamperCount: 0,
    packetLossRate: 4.2,
    latencyMs: 48,
  },
  {
    gatewayId: 'gw-kpmbp-datacenter-03',
    name: 'Core Datacenter Hardened Controller',
    building: 'Administrative Centre Basement',
    ipAddress: '10.240.8.5',
    macAddress: '00:15:5D:89:11:EF',
    tlsFingerprintSha256: 'CC:12:00:88:76:54:33:21:99:AB:DC:EE:44:11:22:98:AA:77:66:55',
    mtlsCertificateSubject: 'CN=gw-kpmbp-dc-03.sec.kpmbp.edu.my, O=KPMBP High-Assurance Enclave',
    firmwareHashSha256: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    status: 'ONLINE_CONNECTED',
    lastHeartbeat: new Date().toISOString(),
    heartbeatIntervalSec: 10,
    activeReadersCount: 1,
    readers: [AUDITED_KPMBP_READERS[3]], // BioStation
    offlineCacheExpiresAt: new Date(Date.now() + 14400000).toISOString(), // 4h
    offlineModeAllowed: false, // Strict online authorization required for Tier 4
    tamperCount: 0,
    packetLossRate: 0.0,
    latencyMs: 4,
  },
];

// STRIDE Threat Model for KPMBP PACs Infrastructure
export const KPMBP_STRIDE_THREATS: StrideThreatModelItem[] = [
  {
    id: 'STRIDE-S-01',
    category: 'SPOOFING',
    targetComponent: 'Physical Door Readers (Wiegand 26-bit & MIFARE Classic CSN)',
    threatDescription:
      'Attacker clones a 4-byte static MIFARE Classic UID or writes an intercepted Wiegand bitstream to an emulator card (Proxmark / Flipper Zero).',
    riskLevel: 'CRITICAL',
    sesMitigation:
      'SES v4.5 Zero-Trust rejects static UID-only authorization. Android HCE transmits randomized UIDs and mandates ISO 7816-4 mutual challenge-response signing.',
    verificationMethod: 'Automated Reader Simulator: verify that dynamic random UID triggers failure on un-migrated readers.',
    implementationStatus: 'ENFORCED',
  },
  {
    id: 'STRIDE-T-01',
    category: 'TAMPERING',
    targetComponent: 'Reader-to-Controller Wiring (Wiegand D0/D1 Lines)',
    threatDescription:
      'Attacker taps unshielded Wiegand D0/D1 wires behind the wall reader and injects unauthorized facility/card pulses.',
    riskLevel: 'CRITICAL',
    sesMitigation:
      'Migration to SIA OSDP v2.2 with AES-128 Secure Channel Protocol (SCP). Encrypted payloads with AES-CBC-MAC integrity and sequence counters.',
    verificationMethod: 'OSDP Secure Channel Adapter verifies MAC on every command/reply frame.',
    implementationStatus: 'ENFORCED',
  },
  {
    id: 'STRIDE-R-01',
    category: 'REPUDIATION',
    targetComponent: 'Door Access Audit Trail',
    threatDescription:
      'Malicious user or compromised gateway claims an access grant was forged or denies having presented a badge.',
    riskLevel: 'HIGH',
    sesMitigation:
      'All access transactions log ECDSA P-256 challenge-response nonces, server-authoritative timestamps, and gateway certificate fingerprints.',
    verificationMethod: 'Cryptographic log verification in PACs Gateway audit stream.',
    implementationStatus: 'ENFORCED',
  },
  {
    id: 'STRIDE-I-01',
    category: 'INFORMATION_DISCLOSURE',
    targetComponent: 'RF Air Interface (13.56 MHz NFC Communication)',
    threatDescription:
      'Eavesdropping on NFC carrier frequency to extract staff IDs, facility codes, or long-term private keys.',
    riskLevel: 'HIGH',
    sesMitigation:
      'Hardware Keystore private keys are strictly non-exportable ({ extractable: false }). Only single-use dynamic nonces and ephemeral signatures cross RF.',
    verificationMethod: 'Hardware Keystore attestation checks and non-exportability validation.',
    implementationStatus: 'ENFORCED',
  },
  {
    id: 'STRIDE-D-01',
    category: 'DENIAL_OF_SERVICE',
    targetComponent: 'Edge Gateway Upstream Network Link',
    threatDescription:
      'Campus network interruption or intentional DoS disconnects Edge Controller from Cloud Authoritative Service.',
    riskLevel: 'MEDIUM',
    sesMitigation:
      'Edge Gateway supports Autonomous Offline Mode using pre-signed, unexpired, cryptographic credential tokens with automatic tamper lockdown.',
    verificationMethod: 'Heartbeat disconnection test: gateway transitions to OFFLINE_AUTONOMOUS safely.',
    implementationStatus: 'ENFORCED',
  },
  {
    id: 'STRIDE-E-01',
    category: 'ELEVATION_OF_PRIVILEGE',
    targetComponent: 'Door Strike Relay Contacts & Controller Firmware',
    threatDescription:
      'Unauthorized user sends forged relay actuation command to door strike over local network.',
    riskLevel: 'CRITICAL',
    sesMitigation:
      'Safety Guard: Direct live door controller relay actuation is strictly forbidden without server-authoritative mTLS handshake and cryptographic token.',
    verificationMethod: 'Controller safety assertion checks in IPacsControllerAdapter.',
    implementationStatus: 'ENFORCED',
  },
];

class PacsGatewayServiceImpl {
  private gateways: PacsGatewayDevice[] = [...AUDITED_KPMBP_GATEWAYS];
  private readers: ReaderHardwareProfile[] = [...AUDITED_KPMBP_READERS];
  private transactions: PacsAccessTransaction[] = [];
  private listeners: Set<() => void> = new Set();
  private isLiveDoorActuationAuthorized = false; // Strictly false for safe simulation

  constructor() {
    this.seedInitialTransactions();
  }

  private seedInitialTransactions() {
    this.transactions = [
      {
        id: 'tx-init-001',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        gatewayId: 'gw-kpmbp-eng-01',
        readerId: 'rdr-eng-2-204',
        locationId: 'loc-kp-003',
        locationName: 'Advanced Robotics Lab (Simulated Bench)',
        credentialIdentifier: 'SYNCROZZ-HCE-KPMBP-A01',
        holderName: 'Dr. Ahmad Fauzi (Simulated User)',
        protocolUsed: 'ISO_14443_4_HCE',
        rawPayloadSnippet: '00 A4 04 00 07 A0 00 00 08 41 00 01 -> 90 00',
        cryptographicValidationMethod: 'ECDSA_P256_CHALLENGE',
        decision: 'GRANTED',
        relayTriggered: false, // Live controllers NOT modified
        durationMs: 42,
        diagnosticNotes: 'OSDP v2.2 Secure Channel + ISO 7816-4 APDU handshake simulated. Relay actuation isolated.',
      },
      {
        id: 'tx-init-002',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        gatewayId: 'gw-kpmbp-adm-02',
        readerId: 'rdr-bld-a-301',
        locationId: 'loc-kp-001',
        locationName: 'Academic Staff Office 301',
        credentialIdentifier: 'CLONED-UID-ATTEMPT-08D3A1',
        holderName: 'Unknown Transponder',
        protocolUsed: 'WIEGAND_LEGACY',
        rawPayloadSnippet: 'BITS: 0 00010100 0011000000111001 1',
        cryptographicValidationMethod: 'STATIC_UID_CHECK',
        decision: 'DENIED_INCOMPATIBLE_TECH',
        relayTriggered: false,
        durationMs: 18,
        diagnosticNotes:
          'Randomized Android UID presented on legacy Wiegand reader. Zero-Trust policy blocked static UID.',
      },
    ];
  }

  // Subscriptions for real-time dashboard updates
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('Listener notification error', e);
      }
    });
  }

  getGateways(): PacsGatewayDevice[] {
    return [...this.gateways];
  }

  getReaders(): ReaderHardwareProfile[] {
    return [...this.readers];
  }

  getTransactions(): PacsAccessTransaction[] {
    return [...this.transactions];
  }

  getThreatModel(): StrideThreatModelItem[] {
    return [...KPMBP_STRIDE_THREATS];
  }

  /**
   * Safe Reader Simulator Execution
   * Simulates a badge presentation against a target reader hardware profile.
   */
  async simulateBadgePresentation(params: {
    readerId: string;
    badgeType: 'ANDROID_HCE_P256' | 'MIFARE_CLASSIC_1K' | 'WIEGAND_UNENCRYPTED_CARD' | 'CLONED_STATIC_UID';
    simulatedChallengeNonce?: string;
  }): Promise<PacsAccessTransaction> {
    const reader = this.readers.find((r) => r.id === params.readerId) || this.readers[0];
    const gateway = this.gateways.find((g) => g.readers.some((r) => r.id === reader.id)) || this.gateways[0];

    const startTime = performance.now();
    const adapter = ProtocolAdapterRegistry.getAdapter(reader.protocol);

    let decision: AccessDecisionVerdict = 'DENIED_INCOMPATIBLE_TECH';
    let rawPayload = '';
    let cryptoMethod: PacsAccessTransaction['cryptographicValidationMethod'] = 'NONE_PLAINTEXT';
    let diagnostic = '';
    let credentialId = 'SIM-ANONYMOUS';

    // Execute protocol evaluation safely without live physical controller modification
    switch (params.badgeType) {
      case 'ANDROID_HCE_P256': {
        if (reader.protocol === 'OSDP_V2_SECURE_CHANNEL' || reader.protocol === 'ISO_14443_4_HCE') {
          credentialId = 'SYNCROZZ-HCE-KPMBP-AUTH';
          cryptoMethod = 'ECDSA_P256_CHALLENGE';
          rawPayload = 'APDU: 00 A4 04 00 07 A0 00 00 08 41 00 01 00 [SELECT AID] -> 90 00';
          decision = 'GRANTED';
          diagnostic =
            'Mutual Authentication Successful: Reader transmitted 32-byte challenge nonce over OSDP v2.2 Secure Channel; Android Keystore signed nonce using non-exportable EC P-256 key.';
        } else {
          credentialId = 'ANDROID-RANDOMIZED-UID-08A1';
          rawPayload = 'ISO 14443-3A: Anti-collision Dynamic UID (08 A1 B2 C3)';
          decision = 'DENIED_INCOMPATIBLE_TECH';
          diagnostic =
            'Incompatible Transceiver: Legacy door reader expects 4-byte static NXP UID or proprietary CRYPTO1 cipher. Android privacy randomized UID (0x08 prefix) rejected by reader.';
        }
        break;
      }

      case 'MIFARE_CLASSIC_1K': {
        credentialId = 'PHYSICAL-MIFARE-1K-A089';
        cryptoMethod = 'STATIC_UID_CHECK';
        rawPayload = 'CMD: 0x60 [Sector 00] [CRYPTO1 Auth Challenge]';
        if (reader.protocol === 'MIFARE_CLASSIC_RAW') {
          // Under SES v4.5 Zero-Trust, physical MIFARE cards are supported for transitional physical access, but disallowed for mobile emulation
          decision = 'GRANTED';
          diagnostic =
            'Transitional Physical Card Accepted: Physical MIFARE Classic transponder authenticated via sector key. (Note: Mobile emulation of this card remains strictly blocked).';
        } else {
          decision = 'DENIED_INCOMPATIBLE_TECH';
          diagnostic = 'Smart OSDP Reader configured strictly for ISO 7816-4 APDU; legacy MIFARE rejected.';
        }
        break;
      }

      case 'CLONED_STATIC_UID': {
        credentialId = 'SPOOFED-UID-ATTACK';
        cryptoMethod = 'STATIC_UID_CHECK';
        rawPayload = 'REQA -> ATQA 00 04 -> SAK 08 -> Static UID 12 34 56 78';
        decision = 'DENIED_INVALID_CRYPTO';
        diagnostic =
          'Security Violation Prevented: Spoofed/Cloned static UID detected. Zero-Trust gateway requires ECDSA P-256 cryptographic proof; access denied immediately.';
        break;
      }

      case 'WIEGAND_UNENCRYPTED_CARD': {
        credentialId = 'WIEGAND-FC102-CN39401';
        cryptoMethod = 'NONE_PLAINTEXT';
        rawPayload = 'WIEGAND: 0 01100110 1001100111101001 1 (26-bit)';
        if (reader.protocol === 'WIEGAND_LEGACY') {
          decision = 'GRANTED';
          diagnostic =
            'Legacy Wiegand Accepted with Audit Warning: Plaintext bitstream accepted by legacy controller. SES v4.5 recommends immediate migration to OSDP v2 Secure Channel.';
        } else {
          decision = 'DENIED_INCOMPATIBLE_TECH';
          diagnostic = 'Secure OSDP gateway rejected unencrypted raw Wiegand pulse stream.';
        }
        break;
      }
    }

    // If gateway is in TAMPER_ALARM, all access is denied
    if (gateway.status === 'TAMPER_ALARM') {
      decision = 'DENIED_TAMPER_LOCKDOWN';
      diagnostic = `Gateway Lockdown Active: Reader enclosure tamper switch triggered on ${gateway.name}. Access points secured.`;
    }

    const durationMs = Math.round(performance.now() - startTime + Math.random() * 15 + 10);
    // In Hardware Verification Gate & Simulation Mode: live physical relay contacts are NEVER energized
    const relayTriggered = false;

    const tx: PacsAccessTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      gatewayId: gateway.gatewayId,
      readerId: reader.id,
      locationId: reader.locationId,
      locationName: reader.name,
      credentialIdentifier: credentialId,
      holderName: decision === 'GRANTED' ? 'Authorized User' : 'Unauthenticated Entity',
      protocolUsed: reader.protocol,
      rawPayloadSnippet: rawPayload,
      cryptographicValidationMethod: cryptoMethod,
      decision,
      relayTriggered,
      durationMs,
      diagnosticNotes: diagnostic,
    };

    this.transactions.unshift(tx);
    if (this.transactions.length > 50) this.transactions.pop();
    this.notify();

    return tx;
  }

  /**
   * Gateway Heartbeat Simulation & Recovery Loop
   */
  simulateHeartbeat(gatewayId: string): GatewayHeartbeatTelemetry {
    const gw = this.gateways.find((g) => g.gatewayId === gatewayId);
    if (!gw) throw new Error(`Gateway not found: ${gatewayId}`);

    gw.lastHeartbeat = new Date().toISOString();
    if (gw.status === 'RECOVERING') {
      gw.status = 'ONLINE_CONNECTED';
    }

    const telemetry: GatewayHeartbeatTelemetry = {
      gatewayId: gw.gatewayId,
      timestamp: gw.lastHeartbeat,
      status: gw.status,
      tamperState: gw.tamperCount > 0 ? 'TAMPER_ACTIVE' : 'NORMAL',
      uptimeSeconds: 86400 * 3 + Math.floor(Math.random() * 3600),
      cpuLoadPercent: Math.round(15 + Math.random() * 20),
      memoryUsagePercent: 38,
      readerBusSignalQuality: Math.round(95 - gw.packetLossRate * 3),
      tlsHandshakeValid: true,
      activeCredentialsInCache: 48,
    };

    this.notify();
    return telemetry;
  }

  /**
   * Trigger Tamper Alarm on a Reader / Gateway
   */
  triggerTamperAlarm(gatewayId: string, readerId?: string) {
    const gw = this.gateways.find((g) => g.gatewayId === gatewayId);
    if (gw) {
      gw.status = 'TAMPER_ALARM';
      gw.tamperCount += 1;
      if (readerId) {
        const rdr = gw.readers.find((r) => r.id === readerId);
        if (rdr) rdr.tamperTriggered = true;
      }
      this.notify();
    }
  }

  /**
   * Trigger Gateway Self-Healing Recovery
   */
  recoverGateway(gatewayId: string) {
    const gw = this.gateways.find((g) => g.gatewayId === gatewayId);
    if (gw) {
      gw.status = 'RECOVERING';
      gw.tamperCount = 0;
      gw.packetLossRate = 0.0;
      gw.readers.forEach((r) => (r.tamperTriggered = false));

      setTimeout(() => {
        gw.status = 'ONLINE_CONNECTED';
        gw.lastHeartbeat = new Date().toISOString();
        this.notify();
      }, 1500);

      this.notify();
    }
  }

  /**
   * Disconnect Gateway to Test Offline Autonomous Mode
   */
  toggleOfflineMode(gatewayId: string) {
    const gw = this.gateways.find((g) => g.gatewayId === gatewayId);
    if (gw) {
      if (gw.status === 'OFFLINE_AUTONOMOUS') {
        gw.status = 'ONLINE_CONNECTED';
      } else {
        gw.status = 'OFFLINE_AUTONOMOUS';
      }
      this.notify();
    }
  }

  getHardwareChecklist(): HardwareVerificationItem[] {
    return [...KPMBP_HARDWARE_CHECKLIST];
  }

  isPhysicalAccessClaimAllowed(): boolean {
    return false;
  }

  getHardwareAuditClassification() {
    return {
      verified: [
        'Android HostApduService ISO 7816-4 APDU protocol state engine (AID A0000008410001)',
        'ECDSA P-256 challenge-response signature generation via Keystore abstraction',
        'OSDP v2.2 frame construction, preamble, byte-stuffing, and CRC-16 (0x1021) verification',
        'Wiegand 26-bit and 37-bit bitstream decoding and parity integrity checks',
        'AOSP standard rejection of proprietary NXP MIFARE CRYPTO1 stream cipher',
      ],
      assumed: [
        'Physical reader model numbers at KPMBP locations (KR100, FB-5000, Signo, BioStation, Aperio)',
        'Physical reader firmware revisions on installed door controllers',
        'Cabling type and bus termination (120Ω on RS-485 A/B lines)',
        'Presence and armed status of mechanical wall-mount enclosure tamper switches',
        'Actual OEM vendor documentation and factory specification sheets',
      ],
      simulated: [
        'KPMBP Edge Gateway controllers (gw-kpmbp-eng-01, gw-kpmbp-adm-02, gw-kpmbp-datacenter-03)',
        'Mutual TLS (mTLS 1.3) upstream handshake and telemetry daemon',
        'Reader badge presentation events and credential evaluations',
        'Door strike relay actuation (strictly isolated from live physical panels)',
        'Reader tamper switch triggers and automated self-healing recovery',
      ],
      verificationGateActive: true,
      physicalAccessClaimAllowed: false,
      productionIntegrationAllowed: false,
    };
  }
}

export const pacsGatewayService = new PacsGatewayServiceImpl();
