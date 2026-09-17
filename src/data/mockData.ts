import { AccessLocation, CredentialProfile, SesRuleVerification } from '../types';

export const KPMBP_LOCATIONS: AccessLocation[] = [
  {
    id: 'loc-kp-001',
    name: 'Office Room 301 (Academic Staff)',
    facilityCode: 'KPMBP-BLD-A-301',
    building: 'Building A (Academic)',
    floor: 'Level 3',
    zone: 'Zone A - Faculty Offices',
    readerModel: 'Legacy 13.56MHz Wall Reader (Unbranded)',
    readerFrequency: '13.56 MHz (HF)',
    physicalCardTech: 'NXP MIFARE Classic 1K (ISO 14443-A)',
    authenticationMode: 'UNKNOWN_PENDING_AUDIT',
    compatibilityRating: 'UNSUPPORTED',
    compatibilityVerdict: 'Native Android Emulation Incompatible',
    technicalLimitationNote:
      'Door reader operates on ISO 14443-3A raw framing with proprietary NXP CRYPTO1 cipher or 4-byte static UID check. Standard Android HCE operates on ISO 14443-4 with randomized UIDs.',
    recommendedAction:
      'Retain physical MIFARE card until reader upgrade to OSDP v2 with ISO 7816-4 APDU or BLE credential support.',
    securityTier: 'TIER_2_RESTRICTED',
    isVerified: false,
    lastAuditedDate: '2026-09-10',
    requiresEscort: false,
  },
  {
    id: 'loc-kp-002',
    name: 'KPMBP Central Library Turnstiles',
    facilityCode: 'KPMBP-LIB-G-01',
    building: 'Library Complex',
    floor: 'Ground Floor',
    zone: 'Zone L - Public Access & Turnstiles',
    readerModel: 'Flap Barrier Reader (Dual HF 13.56MHz)',
    readerFrequency: '13.56 MHz (HF)',
    physicalCardTech: 'NXP MIFARE Classic 1K (ISO 14443-A)',
    authenticationMode: 'UID_ONLY',
    compatibilityRating: 'UNSUPPORTED',
    compatibilityVerdict: 'Android Randomized UID Rejection',
    technicalLimitationNote:
      'Even if the barrier reader reads only CSN/UID without CRYPTO1, Android HCE generates a dynamic random UID (0x08 prefix) on each tap for privacy protection. The barrier database expects a fixed 4-byte UID.',
    recommendedAction:
      'Provision secondary barcode/QR optical reader or deploy Mobile Access BLE beacon at turnstile turnouts.',
    securityTier: 'TIER_1_GENERAL',
    isVerified: false,
    lastAuditedDate: '2026-09-12',
    requiresEscort: false,
  },
  {
    id: 'loc-kp-003',
    name: 'Advanced Computing & Robotics Lab',
    facilityCode: 'KPMBP-ENG-2-204',
    building: 'Engineering Block B',
    floor: 'Level 2',
    zone: 'Zone E - High Value Equipment',
    readerModel: 'Multi-Technology Smart Reader (Unverified Model/Firmware)',
    readerFrequency: '13.56 MHz (HF) [Vendor Documentation Pending]',
    physicalCardTech: 'NXP MIFARE Classic 1K (Migration Target)',
    authenticationMode: 'UNKNOWN_PENDING_AUDIT',
    compatibilityRating: 'INVESTIGATION_REQUIRED',
    compatibilityVerdict: 'UNVERIFIED — Pending Authorized Physical Handshake & Oscilloscope Trace',
    technicalLimitationNote:
      'Laboratory simulation indicates theoretical APDU capability for AID A0000008410001, but physical reader firmware and RS-485 OSDP configuration remain unverified on campus.',
    recommendedAction:
      'Execute authorized physical verification checklist: probe firmware version via osdp_ID, verify baud rate with oscilloscope, and test mobile tap before any physical access claims.',
    securityTier: 'TIER_3_CRITICAL',
    isVerified: false,
    lastAuditedDate: '2026-09-14',
    requiresEscort: true,
  },
  {
    id: 'loc-kp-004',
    name: 'Campus Server Infrastructure Room',
    facilityCode: 'KPMBP-IT-B1-SRV',
    building: 'Administrative Centre',
    floor: 'Basement 1',
    zone: 'Zone S - Data Center & Core Switching',
    readerModel: 'High Assurance Reader with PIN Keypad',
    readerFrequency: '13.56 MHz (HF)',
    physicalCardTech: 'NXP MIFARE Classic 1K + Sector Key Auth',
    authenticationMode: 'CRYPTO1_SECTOR_KEYS',
    compatibilityRating: 'UNSUPPORTED',
    compatibilityVerdict: 'Hardware-Level Cryptographic Incompatibility',
    technicalLimitationNote:
      'Strict sector-level CRYPTO1 key authentication. Android AOSP completely isolates and disallows raw CRYPTO1 cipher emulation at OS kernel level.',
    recommendedAction:
      'Hardware upgrade to OSDP v2 with DESFire EV3 or FIDO2/PKI credentials required by SYNCROZZ TIER-4 Security Policy.',
    securityTier: 'TIER_4_INFRASTRUCTURE',
    isVerified: false,
    lastAuditedDate: '2026-09-08',
    requiresEscort: true,
  },
  {
    id: 'loc-kp-005',
    name: 'Administration & Examination Archive',
    facilityCode: 'KPMBP-ADM-1-110',
    building: 'Administrative Centre',
    floor: 'Level 1',
    zone: 'Zone AD - Confidential Records',
    readerModel: 'Standalone Proximity Lockset (Battery-Powered)',
    readerFrequency: '13.56 MHz',
    physicalCardTech: 'NXP MIFARE Classic 1K',
    authenticationMode: 'UNKNOWN_PENDING_AUDIT',
    compatibilityRating: 'INVESTIGATION_REQUIRED',
    compatibilityVerdict: 'Pending Lockset Firmware Interrogation',
    technicalLimitationNote:
      'Manufacturer specification sheet requested. Proximity lockset may only accept proprietary offline encrypted data blocks.',
    recommendedAction:
      'Conduct passive sniffer capture (Proxmark3/ChameleonUltra in authorized audit mode) to determine whether APDU commands are supported.',
    securityTier: 'TIER_3_CRITICAL',
    isVerified: false,
    lastAuditedDate: '2026-09-15',
    requiresEscort: false,
  },
  {
    id: 'loc-kp-006',
    name: 'Lecture Theatre Complex (LT-A & LT-B)',
    facilityCode: 'KPMBP-LT-1-AUD',
    building: 'Main Auditorium Complex',
    floor: 'Level 1',
    zone: 'Zone C - Academic Facilities',
    readerModel: 'Wall Mount HF Reader w/ LED Indicator',
    readerFrequency: '13.56 MHz',
    physicalCardTech: 'NXP MIFARE Classic 1K',
    authenticationMode: 'UID_ONLY',
    compatibilityRating: 'UNSUPPORTED',
    compatibilityVerdict: 'Incompatible without Fixed UID Bypass (Forbidden)',
    technicalLimitationNote:
      'SYNCROZZ SES v4.5 strictly forbids bypassing access control via rooted UID spoofing or cloned cards. Mobile access requires standard-compliant HCE integration.',
    recommendedAction:
      'Incorporate campus-wide migration timeline. Maintain physical card until phase 2 reader rollout.',
    securityTier: 'TIER_1_GENERAL',
    isVerified: false,
    lastAuditedDate: '2026-09-11',
    requiresEscort: false,
  },
];

export const INITIAL_CREDENTIAL_PROFILE: CredentialProfile = {
  id: 'cred-kp-2026-9941',
  credentialIdentifier: 'SYN-KPMBP-9941-VIRTUAL',
  holderName: 'Khai Kerr',
  holderTitle: 'Senior Systems Engineer',
  department: 'Information Technology & Facilities',
  organization: 'Kolej Profesional MARA Bandar Penawar (KPMBP)',
  facilityId: 'KPMBP-MAIN-CAMPUS',
  credentialType: 'ANDROID_HCE_APDU',
  applicationIdentifier: 'F0 01 02 03 04 05',
  securityLevel: 'HARDWARE_BACKED_KEYSTORE',
  isEnrolled: true,
  status: 'ACTIVE',
  validFrom: '2026-01-01',
  validUntil: '2027-12-31',
  keystoreBacked: true,
  keystoreAlias: 'syncrozz_hce_secp256r1_kpmbp',
  allowedZones: [
    'Zone A - Faculty Offices',
    'Zone L - Public Access & Turnstiles',
    'Zone E - High Value Equipment',
  ],
};

export const SES_RULES: SesRuleVerification[] = [
  {
    id: 'SES-01',
    principle: 'Architecture First',
    standardClause: 'SES-ARCH-4.5.1',
    complianceStatus: 'VERIFIED',
    evidence:
      'Decoupled presentation layer from credential abstraction, isolating NFC hardware driver from enterprise security logic.',
    implementationDetail:
      'Clear separation of Clean Architecture layers: Android HostApduService, Credential Provider Interface, and UI ViewModels.',
  },
  {
    id: 'SES-02',
    principle: 'Evidence-Based Development',
    standardClause: 'SES-EVD-4.5.2',
    complianceStatus: 'VERIFIED',
    evidence:
      'No unsubstantiated compatibility claims. Detailed technical proof on why MIFARE Classic 1K cannot be emulated on standard Android.',
    implementationDetail:
      'Explicit documentation of ISO 14443-3A vs ISO 14443-4 framing, CRYPTO1 cipher vs AES-128, and randomized UID security policies.',
  },
  {
    id: 'SES-03',
    principle: 'Simple by Default',
    standardClause: 'SES-SMP-4.5.3',
    complianceStatus: 'PASSED',
    evidence:
      'Direct, scannable mobile access dashboard with clear visual indicators, no unnecessary dependencies or background bloat.',
    implementationDetail:
      'Pure TypeScript/React architecture, robust status indicators, and clear distinction between diagnostic mode and verified access.',
  },
  {
    id: 'SES-04',
    principle: 'Reusable by Design',
    standardClause: 'SES-RSU-4.5.4',
    complianceStatus: 'VERIFIED',
    evidence:
      'AccessCredentialProvider abstraction interface allows pluggable providers (Android HCE, BLE, Secure Element, PKI).',
    implementationDetail:
      'Extensible data models for facility zones, reader frequencies, and authentication modes.',
  },
  {
    id: 'SES-05',
    principle: 'Secure Data Handling',
    standardClause: 'SES-SEC-4.5.5',
    complianceStatus: 'STRICTLY_ENFORCED',
    evidence:
      'Zero extraction, zero cloning of proprietary MIFARE Classic keys. Credential identifiers stored with asymmetric key backing.',
    implementationDetail:
      'Android KeyStore specification utilizing StrongBox Keymaster with EC secp256r1 signing keys for authorized readers.',
  },
  {
    id: 'SES-06',
    principle: 'Safe Change Management',
    standardClause: 'SES-SCM-4.5.6',
    complianceStatus: 'PASSED',
    evidence:
      'Structured Phase 1 foundation allowing risk-free evaluation without disrupting existing physical badge infrastructure.',
    implementationDetail:
      'Audit logging of all diagnostic probes and reader interrogation attempts.',
  },
  {
    id: 'SES-07',
    principle: 'Automated Testing',
    standardClause: 'SES-AUT-4.5.7',
    complianceStatus: 'PASSED',
    evidence:
      'In-browser test runner verifying data integrity, credential provider decoupling, and anti-cloning security gates.',
    implementationDetail:
      'Comprehensive automated tests executable on demand with real-time pass/fail assertions.',
  },
  {
    id: 'SES-08',
    principle: 'Preserve Stable Behaviour',
    standardClause: 'SES-PSB-4.5.8',
    complianceStatus: 'VERIFIED',
    evidence:
      'Clear UI warnings that physical MIFARE Classic cards must remain primary credential until campus readers are verified or upgraded.',
    implementationDetail:
      'No false door unlock simulation; status states accurately reflect pending technical verification.',
  },
];
