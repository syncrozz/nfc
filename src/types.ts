/**
 * SYNCROZZ Mobile Access Platform - Types & Interfaces
 * In compliance with SYNCROZZ ENGINEERING STANDARD (SES) v4.5
 */

export type NfcTechnologyType =
  | 'ISO_14443_3A_MIFARE_CLASSIC'
  | 'ISO_14443_4_TYPE_A'
  | 'ISO_14443_4_TYPE_B'
  | 'ANDROID_HCE_ISO_7816'
  | 'NDEF_EXCHANGE'
  | 'BLE_MOBILE_ACCESS'
  | 'SECURE_ELEMENT_UICC'
  | 'MIFARE_DESFIRE_EV2_EV3';

export type CompatibilityRating =
  | 'UNSUPPORTED'
  | 'FULLY_COMPATIBLE'
  | 'HARDWARE_UPGRADE_REQUIRED'
  | 'INVESTIGATION_REQUIRED'
  | 'CONDITIONAL_SUPPORT';

export type SecurityTier = 'TIER_1_GENERAL' | 'TIER_2_RESTRICTED' | 'TIER_3_CRITICAL' | 'TIER_4_INFRASTRUCTURE';

export interface AccessLocation {
  id: string;
  name: string;
  facilityCode: string;
  building: string;
  floor: string;
  zone: string;
  readerModel: string;
  readerFrequency: string; // e.g., '13.56 MHz'
  physicalCardTech: string; // e.g., 'NXP MIFARE Classic 1K (ISO 14443-A)'
  authenticationMode: 'UID_ONLY' | 'CRYPTO1_SECTOR_KEYS' | 'ISO_7816_APDU' | 'UNKNOWN_PENDING_AUDIT';
  compatibilityRating: CompatibilityRating;
  compatibilityVerdict: string;
  technicalLimitationNote: string;
  recommendedAction: string;
  securityTier: SecurityTier;
  isVerified: boolean;
  lastAuditedDate: string;
  requiresEscort: boolean;
}

export type CredentialType =
  | 'ANDROID_HCE_APDU'
  | 'BLE_PROXIMITY'
  | 'CLOUD_AUTHENTICATED_PASS'
  | 'PHYSICAL_MIFARE_CLASSIC_REF' // Reference only, not cloneable
  | 'SECURE_ELEMENT_APPLE_GOOGLE_WALLET';

export interface CredentialProfile {
  id: string;
  credentialIdentifier: string; // Non-sensitive public handle
  holderName: string;
  holderTitle: string;
  department: string;
  organization: string; // e.g. 'KPMBP'
  facilityId: string;
  credentialType: CredentialType;
  applicationIdentifier: string; // AID e.g. 'F0 01 02 03 04 05'
  securityLevel: 'STANDARD' | 'HIGH_ASSURANCE' | 'HARDWARE_BACKED_KEYSTORE';
  isEnrolled: boolean;
  status: 'ACTIVE' | 'PENDING_AUDIT' | 'REVOKED' | 'SUSPENDED';
  validFrom: string;
  validUntil: string;
  keystoreBacked: boolean;
  keystoreAlias: string;
  allowedZones: string[];
}

export interface NfcDiagnosticResult {
  webNfcSupported: boolean;
  webNfcPermissionState: 'granted' | 'prompt' | 'denied' | 'unsupported';
  isAndroid: boolean;
  devicePlatform: string;
  userAgent: string;
  touchPoints: number;
  hardwareConcurrency: number;
  deviceMemoryGb?: number;
  screenResolution: string;
  hceSupport: {
    standardHceIso7816: boolean;
    mifareClassic1kEmulation: boolean;
    reasonMifareClassicUnsupported: string;
    randomizedUidPolicy: boolean;
  };
  supportedTechnologies: {
    name: string;
    standard: string;
    supportedByAndroidHce: boolean;
    frequency: string;
    notes: string;
  }[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: 'DIAGNOSTIC' | 'ACCESS_REQUEST' | 'SECURITY_CHECK' | 'SES_VALIDATION';
  summary: string;
  detail: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
}

export interface SesRuleVerification {
  id: string;
  principle: string;
  standardClause: string;
  complianceStatus: 'PASSED' | 'VERIFIED' | 'STRICTLY_ENFORCED';
  evidence: string;
  implementationDetail: string;
}

export interface ReaderInteractionStep {
  stepNumber: number;
  title: string;
  actor: 'READER' | 'PHONE_ANDROID' | 'SECURITY_KERNEL';
  payloadOrCommand: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'IGNORED';
  technicalExplanation: string;
}

// ==========================================
// PHASE 2: FIREBASE & AUTH MODELS (SES v4.5)
// ==========================================

export type UserRole = 'USER' | 'MASTER_ADMIN';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type DeviceStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'REVOKED';

export interface AppUser {
  id: string; // Firebase Auth UID
  fullName: string;
  email: string;
  staffId: string; // Nombor staf / ID organisasi KPMBP
  department: string; // Jabatan atau unit
  phoneNumber: string;
  role: UserRole;
  status: UserStatus;
  rejectionReason?: string;
  activeDeviceId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface AccessRequest {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  staffId: string;
  department: string;
  requestedZones: string[];
  status: UserStatus;
  decisionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisteredDevice {
  id: string;
  userId: string;
  deviceModel: string;
  platform: string;
  userAgent: string;
  fingerprint: string;
  publicKeyJwk?: string;
  keystoreAlias?: string;
  securityLevel?: KeystoreSecurityLevel;
  status: DeviceStatus;
  isReplacementRequest?: boolean;
  lostReported?: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
}

export interface AccessLogRecord {
  id: string;
  timestamp: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: 'USER' | 'DEVICE' | 'CREDENTIAL' | 'ROLE' | 'ACCESS_REQUEST' | 'SYSTEM' | 'SECURITY';
  targetId: string;
  previousStatus?: string;
  newStatus?: string;
  result?: 'SUCCESS' | 'FAILED' | string;
  reason?: string;
  details: string;
  ipAddress?: string;
  simulated?: boolean;
}

export type CredentialLifecycleStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';

export interface IssuedCredential {
  id: string;
  userId: string;
  deviceId?: string;
  status: CredentialLifecycleStatus;
  applicationIdentifier: string;
  alias?: string;
  keystoreAlias?: string;
  publicKeyJwk?: string;
  holderName?: string;
  facilityId?: string;
  department?: string;
  authorizedZones: string[];
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ==============================================================
// PHASE 3A MODULE 2: ANDROID KEYSTORE & CRYPTOGRAPHIC SESSIONS
// ==============================================================

export type KeystoreSecurityLevel =
  | 'NATIVE_ANDROID_KEYSTORE_STRONGBOX'
  | 'NATIVE_ANDROID_KEYSTORE_TEE'
  | 'STRONGBOX'
  | 'TEE_HARDWARE'
  | 'WEB_CRYPTO_HARDWARE'
  | 'BROWSER_SIMULATED'
  | 'SECURE_ELEMENT';

export interface KeystoreKeyMetadata {
  keyAlias: string;
  algorithm: string; // e.g. 'ECDSA-P256-SHA256'
  securityLevel: KeystoreSecurityLevel;
  hardwareBacked: boolean;
  extractable: boolean; // Must be false for Zero-Trust
  publicKeyJwk: JsonWebKey;
  publicKeyFingerprint: string; // SHA-256 hex string
  createdAt: string;
  attestationDetails?: string;
  isNativeAndroid?: boolean;
  nativeHceActive?: boolean;
}

export interface AuthChallenge {
  challengeId: string;
  nonce: string;
  userId: string;
  deviceId?: string;
  expiresAt: string;
  createdAt: string;
  status: 'ACTIVE' | 'BURNED' | 'EXPIRED';
}

export interface ChallengeVerificationResult {
  verified: boolean;
  sessionToken?: string;
  expiresAt?: string;
  failureReason?: string;
  userStatus?: UserStatus;
  credentialStatus?: CredentialLifecycleStatus;
  credential?: {
    id: string;
    status: CredentialLifecycleStatus;
    authorizedZones: string[];
    expiresAt: string;
  };
}

export interface CryptographicSession {
  token: string;
  expiresAt: string;
  deviceId: string;
  userId: string;
  securityLevel: KeystoreSecurityLevel;
  authenticatedAt: string;
}

// ==============================================================
// PHASE 3B: PACS GATEWAY & READER HARDWARE INTEGRATION
// ==============================================================

export type ReaderCommunicationProtocol =
  | 'OSDP_V2_SECURE_CHANNEL'
  | 'WIEGAND_LEGACY'
  | 'ISO_14443_4_HCE'
  | 'MIFARE_CLASSIC_RAW'
  | 'VENDOR_SPECIFIC_ICLASS'
  | 'DESFIRE_EV3_APDU';

export type PhysicalInterfaceType = 'RS_485_BUS' | 'WIEGAND_D0_D1' | 'ETHERNET_POE' | 'STANDALONE_BATTERY';

export type PacsGatewayStatus =
  | 'ONLINE_CONNECTED'
  | 'OFFLINE_AUTONOMOUS'
  | 'TAMPER_ALARM'
  | 'DEGRADED'
  | 'RECOVERING';

export type AccessDecisionVerdict =
  | 'GRANTED'
  | 'DENIED_INCOMPATIBLE_TECH'
  | 'DENIED_INVALID_CRYPTO'
  | 'DENIED_UNAUTHORIZED_ZONE'
  | 'DENIED_REVOKED_CREDENTIAL'
  | 'DENIED_EXPIRED'
  | 'DENIED_TAMPER_LOCKDOWN'
  | 'DENIED_UNREGISTERED_DEVICE';

export type PhysicalVerificationStatus =
  | 'UNKNOWN'
  | 'UNVERIFIED_PENDING_PHYSICAL_AUDIT'
  | 'BENCH_SIMULATED_ONLY'
  | 'FIELD_VERIFIED_CERTIFIED';

export interface ReaderHardwareProfile {
  id: string;
  locationId: string;
  name: string;
  model: string;
  manufacturer: string;
  physicalInterface: PhysicalInterfaceType;
  protocol: ReaderCommunicationProtocol;
  baudRateOrClock?: string;
  supportsEncryption: boolean;
  encryptionStandard?: string; // e.g. 'AES-128 (OSDP SCP)'
  tamperSwitchArmed: boolean;
  tamperTriggered: boolean;
  physicalVerificationStatus: PhysicalVerificationStatus;
  firmwareVersion: string;
  lastAuditedBy?: string;
  lastAuditedDate: string;
  notes: string;
}

export interface HardwareVerificationItem {
  id: string;
  readerId: string;
  readerName: string;
  locationId: string;
  checklist: {
    readerModelAndFirmware: { verified: boolean; value: string; notes: string };
    interfaceAndProtocol: { verified: boolean; value: string; notes: string };
    frequencyAndCredentialType: { verified: boolean; value: string; notes: string };
    osdpOrWiegandSupport: { verified: boolean; value: string; notes: string };
    androidHceCompatibility: { verified: boolean; value: string; notes: string };
    vendorDocumentation: { verified: boolean; docRef: string; notes: string };
  };
  overallStatus: 'UNKNOWN' | 'IN_PROGRESS' | 'FIELD_VERIFIED';
  physicalAccessClaimAllowed: boolean; // Must be false unless certified
  authorizedAuditor?: string;
  auditDate?: string;
}

export interface PacsGatewayDevice {
  gatewayId: string;
  name: string;
  building: string;
  ipAddress: string;
  macAddress: string;
  tlsFingerprintSha256: string;
  mtlsCertificateSubject: string;
  firmwareHashSha256: string;
  status: PacsGatewayStatus;
  lastHeartbeat: string;
  heartbeatIntervalSec: number;
  activeReadersCount: number;
  readers: ReaderHardwareProfile[];
  offlineCacheExpiresAt: string;
  offlineModeAllowed: boolean;
  tamperCount: number;
  packetLossRate: number;
  latencyMs: number;
}

export interface GatewayHeartbeatTelemetry {
  gatewayId: string;
  timestamp: string;
  status: PacsGatewayStatus;
  tamperState: 'NORMAL' | 'TAMPER_ACTIVE';
  uptimeSeconds: number;
  cpuLoadPercent: number;
  memoryUsagePercent: number;
  readerBusSignalQuality: number; // 0 - 100%
  tlsHandshakeValid: boolean;
  activeCredentialsInCache: number;
}

export interface PacsAccessTransaction {
  id: string;
  timestamp: string;
  gatewayId: string;
  readerId: string;
  locationId: string;
  locationName: string;
  credentialIdentifier: string;
  holderName?: string;
  protocolUsed: ReaderCommunicationProtocol;
  rawPayloadSnippet: string; // Sanitized hex packet or APDU
  cryptographicValidationMethod: 'ECDSA_P256_CHALLENGE' | 'OSDP_AES_MAC' | 'STATIC_UID_CHECK' | 'NONE_PLAINTEXT';
  decision: AccessDecisionVerdict;
  relayTriggered: boolean;
  durationMs: number;
  diagnosticNotes: string;
}

export interface StrideThreatModelItem {
  id: string;
  category: 'SPOOFING' | 'TAMPERING' | 'REPUDIATION' | 'INFORMATION_DISCLOSURE' | 'DENIAL_OF_SERVICE' | 'ELEVATION_OF_PRIVILEGE';
  targetComponent: string;
  threatDescription: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sesMitigation: string;
  verificationMethod: string;
  implementationStatus: 'ENFORCED' | 'UNDER_EVALUATION' | 'PLANNED';
}



