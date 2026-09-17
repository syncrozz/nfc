import { CredentialProfile, CredentialType, ReaderInteractionStep } from '../types';

export interface CredentialExchangeResult {
  success: boolean;
  statusCode: string;
  responseApdu?: string;
  message: string;
  auditTrail: ReaderInteractionStep[];
}

/**
 * SES v4.5 Credential Abstraction Layer
 * Pluggable provider interface for authorized credential technologies.
 */
export interface AccessCredentialProvider {
  readonly providerType: CredentialType;
  readonly isAuthorized: boolean;
  getPublicDescriptor(): string;
  processReaderChallenge(readerCommandHex: string): Promise<CredentialExchangeResult>;
}

/**
 * Standard Android HCE Credential Provider (ISO 7816-4 APDU)
 * Compliant with SES v4.5, using registered enterprise AID.
 */
export class AndroidHceCredentialProvider implements AccessCredentialProvider {
  readonly providerType: CredentialType = 'ANDROID_HCE_APDU';
  readonly isAuthorized: boolean = true;

  constructor(private profile: CredentialProfile) {}

  getPublicDescriptor(): string {
    return `Android HCE Provider [AID: ${this.profile.applicationIdentifier}] - ${this.profile.credentialIdentifier}`;
  }

  async processReaderChallenge(readerCommandHex: string): Promise<CredentialExchangeResult> {
    const cleanCmd = readerCommandHex.replace(/\s+/g, '').toUpperCase();
    const trail: ReaderInteractionStep[] = [];

    // Step 1: Reader polls with ISO 14443-4 Select AID
    trail.push({
      stepNumber: 1,
      title: 'Carrier Activation & RATS Exchange',
      actor: 'READER',
      payloadOrCommand: 'ISO 14443-4 RATS (Request for Answer to Select)',
      outcome: 'SUCCESS',
      technicalExplanation:
        'Phone replies with ATS indicating ISO 14443-4 compliance (FSCI=8, FSDI=8, NAD/CID supported).',
    });

    // Check if command is SELECT AID: 00 A4 04 00 ...
    if (cleanCmd.startsWith('00A40400')) {
      const aidHex = this.profile.applicationIdentifier.replace(/\s+/g, '').toUpperCase();
      trail.push({
        stepNumber: 2,
        title: 'Application Selection (SELECT AID)',
        actor: 'PHONE_ANDROID',
        payloadOrCommand: `00 A4 04 00 06 ${aidHex} 00`,
        outcome: 'SUCCESS',
        technicalExplanation: `Android HostApduService routes command to registered SYNCROZZ AID (${this.profile.applicationIdentifier}).`,
      });

      trail.push({
        stepNumber: 3,
        title: 'Cryptographic Token Presentation (APDU 90 00)',
        actor: 'PHONE_ANDROID',
        payloadOrCommand: 'Response: [Encrypted Payload] 90 00 (SW_NO_ERROR)',
        outcome: 'SUCCESS',
        technicalExplanation:
          'HostApduService signs challenge with Android KeyStore secp256r1 key and returns authorization token to reader.',
      });

      return {
        success: true,
        statusCode: '9000',
        responseApdu: '9000',
        message: 'APDU exchange completed successfully with authorized OSDP / ISO 7816-4 reader.',
        auditTrail: trail,
      };
    }

    // Unrecognized APDU command
    trail.push({
      stepNumber: 2,
      title: 'Command Processing Error',
      actor: 'PHONE_ANDROID',
      payloadOrCommand: cleanCmd,
      outcome: 'FAILURE',
      technicalExplanation: 'Unsupported APDU instruction sent to SYNCROZZ AID handler.',
    });

    return {
      success: false,
      statusCode: '6D00',
      message: 'Instruction not supported (SW_INS_NOT_SUPPORTED).',
      auditTrail: trail,
    };
  }
}

/**
 * Unsupported MIFARE Classic 1K Emulation Provider
 * Strictly prohibited by SES v4.5 and technically unviable on standard Android.
 */
export class MifareClassicEmulationAttempt {
  public static simulateReaderAttempt(): CredentialExchangeResult {
    const trail: ReaderInteractionStep[] = [
      {
        stepNumber: 1,
        title: '13.56 MHz Field Induction & Polling (WUPA)',
        actor: 'READER',
        payloadOrCommand: 'ISO 14443-3A WUPA (0x52) / REQA (0x26)',
        outcome: 'SUCCESS',
        technicalExplanation:
          'KPMBP legacy door reader polls for ISO 14443-3A transponder using short 7-bit framing.',
      },
      {
        stepNumber: 2,
        title: 'Anticollision & Cascade UID Exchange',
        actor: 'PHONE_ANDROID',
        payloadOrCommand: 'Anticollision Loop -> Dynamic UID (e.g. 08 B4 2F 91)',
        outcome: 'FAILURE',
        technicalExplanation:
          'Android HCE generates a random dynamic UID with 0x08 prefix. The door reader expecting a physical card static 4-byte NXP UID fails matching.',
      },
      {
        stepNumber: 3,
        title: 'CRYPTO1 Mutual Authentication Attempt',
        actor: 'READER',
        payloadOrCommand: '0x60 [Sector 00] [Key A Challenge]',
        outcome: 'BLOCKED',
        technicalExplanation:
          'Reader sends proprietary NXP CRYPTO1 three-pass authentication challenge. Standard Android NFC transceiver drops this frame because Android HCE only handles ISO 14443-4 APDUs.',
      },
      {
        stepNumber: 4,
        title: 'Access Control Controller Decision',
        actor: 'SECURITY_KERNEL',
        payloadOrCommand: 'TIMEOUT / PARITY ERROR -> Access Denied',
        outcome: 'FAILURE',
        technicalExplanation:
          'Door reader emits red LED / error buzzer. The transaction is abandoned. Physical MIFARE Classic card is required until reader hardware is upgraded.',
      },
    ];

    return {
      success: false,
      statusCode: 'INCOMPATIBLE_TRANSCEIVER_PROTOCOL',
      message:
        'Transaction Rejected: Standard Android HCE cannot execute proprietary ISO 14443-3A CRYPTO1 framing or static 4-byte UID emulation.',
      auditTrail: trail,
    };
  }
}

/**
 * Validates credential profile data in accordance with SES v4.5 Secure Data Handling.
 */
export function validateCredentialProfile(profile: CredentialProfile): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!profile.holderName || profile.holderName.trim().length < 2) {
    errors.push('Holder name must be at least 2 characters long.');
  }

  if (!profile.credentialIdentifier || !profile.credentialIdentifier.startsWith('SYN-')) {
    errors.push('Credential identifier must follow the format SYN-[FACILITY]-[ID].');
  }

  if (!profile.applicationIdentifier || profile.applicationIdentifier.replace(/\s+/g, '').length < 10) {
    errors.push('Application Identifier (AID) must be a valid hex string of at least 5 bytes.');
  }

  const validFrom = new Date(profile.validFrom);
  const validUntil = new Date(profile.validUntil);
  if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime())) {
    errors.push('Validity dates must be valid ISO format strings.');
  } else if (validFrom >= validUntil) {
    errors.push('Credential expiration date must be after the issue date.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
