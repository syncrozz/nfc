/**
 * SYNCROZZ SES v4.5 Client Cryptographic Session & Zero-Trust Coordinator
 * Orchestrates Android Keystore operations, challenge-response session authentication,
 * and credential lifecycle synchronization.
 */

import { keystoreAdapter } from './keystoreAdapter';
import { serverFunctions } from './functionsService';
import { CryptographicSession, KeystoreKeyMetadata, ReaderInteractionStep } from '../types';

export interface SessionAuthResult {
  success: boolean;
  sessionToken?: string;
  expiresAt?: string;
  error?: string;
  exchangeSteps: ReaderInteractionStep[];
  burnedNonce?: string;
}

class SessionService {
  private currentSession: CryptographicSession | null = null;
  private subscribers: Set<(session: CryptographicSession | null) => void> = new Set();

  subscribe(callback: (session: CryptographicSession | null) => void): () => void {
    this.subscribers.add(callback);
    callback(this.currentSession);
    return () => this.subscribers.delete(callback);
  }

  private notify() {
    this.subscribers.forEach((cb) => cb(this.currentSession));
  }

  getSession(): CryptographicSession | null {
    if (!this.currentSession) return null;
    // Check if expired
    if (new Date(this.currentSession.expiresAt).getTime() < Date.now()) {
      this.currentSession = null;
      this.notify();
      return null;
    }
    return this.currentSession;
  }

  clearSession() {
    this.currentSession = null;
    this.notify();
  }

  /**
   * Complete Challenge-Response Authentication Workflow
   * 1. Requests single-use challenge nonce from server.
   * 2. Retrieves non-exportable hardware key from Android Keystore.
   * 3. Signs challenge using ECDSA P-256 / SHA-256.
   * 4. Sends signature to server for authoritative verification.
   * 5. Burns nonce, establishes ephemeral session token.
   */
  async authenticateDeviceSession(userId: string, deviceId: string): Promise<SessionAuthResult> {
    const steps: ReaderInteractionStep[] = [];
    const alias = `syncrozz_hw_${userId}`;

    try {
      // Step 1: Request Challenge Nonce from Server
      steps.push({
        stepNumber: 1,
        title: 'Permintaan Cabaran Kriptografi (Server Nonce Request)',
        actor: 'PHONE_ANDROID',
        payloadOrCommand: `POST /api/auth/challenge { deviceId: "${deviceId}" }`,
        outcome: 'SUCCESS',
        technicalExplanation: 'Telefon pintar memohon cabaran keselamatan rawak 256-bit daripada pelayan berautoriti.',
      });

      const challenge = await serverFunctions.requestAuthChallenge(deviceId);

      steps.push({
        stepNumber: 2,
        title: 'Penerimaan Nonce 256-bit Berkelajuan Singkat (TTL 90s)',
        actor: 'READER',
        payloadOrCommand: `Nonce: ${challenge.nonce.substring(0, 16)}... (ID: ${challenge.challengeId})`,
        outcome: 'SUCCESS',
        technicalExplanation: `Pelayan menjana nonce rawak dengan tempoh sah 90 saat untuk menghalang serangan ulangan (Replay Attack).`,
      });

      // Step 2: Keystore Hardware Sign
      const keyMeta = await keystoreAdapter.getKeyMetadata(alias);
      if (!keyMeta) {
        throw new Error(`Kunci perkakasan untuk '${alias}' tidak wujud dalam Keystore. Sila lakukan pendaftaran kredensial terlebih dahulu.`);
      }

      steps.push({
        stepNumber: 3,
        title: 'Penandatanganan Perkakasan (Android Keystore ECDSA P-256)',
        actor: 'PHONE_ANDROID',
        payloadOrCommand: `Hardware Alias: ${alias} | Security Level: ${keyMeta.securityLevel}`,
        outcome: 'SUCCESS',
        technicalExplanation: 'Modul keselamatan perkakasan (TEE / StrongBox) menandatangani nonce tanpa mendedahkan kunci peribadi yang tidak boleh diekstrak (extractable: false).',
      });

      const { signatureHex, timestamp } = await keystoreAdapter.signChallenge(alias, challenge.nonce);

      steps.push({
        stepNumber: 4,
        title: 'Penyerahan Tandatangan Digital ke Pelayan',
        actor: 'PHONE_ANDROID',
        payloadOrCommand: `ECDSA Sig: ${signatureHex.substring(0, 24)}... (Timestamp: ${timestamp})`,
        outcome: 'SUCCESS',
        technicalExplanation: 'Tandatangan digital diserahkan bersama pengecam cabaran untuk pengesahan berautoriti pelayan.',
      });

      // Step 3: Server Verification & Nonce Burn
      const verification = await serverFunctions.verifyAuthChallenge({
        challengeId: challenge.challengeId,
        deviceId,
        signatureHex,
        clientTimestamp: timestamp,
      });

      steps.push({
        stepNumber: 5,
        title: 'Pengesahan Pelayan, Pembakaran Nonce & Pengeluaran Sesi',
        actor: 'READER',
        payloadOrCommand: `Status: VERIFIED | Token Expiry: ${verification.expiresAt} | Nonce BURNED`,
        outcome: 'SUCCESS',
        technicalExplanation: 'Pelayan mengesahkan tandatangan kunci awam berdaftar, membakar nonce serta-merta, dan mengeluarkan Sesi Kriptografi 15 Minit.',
      });

      const session: CryptographicSession = {
        token: verification.sessionToken,
        expiresAt: verification.expiresAt,
        deviceId,
        userId,
        securityLevel: keyMeta.securityLevel,
        authenticatedAt: new Date().toISOString(),
      };

      this.currentSession = session;
      this.notify();

      return {
        success: true,
        sessionToken: verification.sessionToken,
        expiresAt: verification.expiresAt,
        exchangeSteps: steps,
        burnedNonce: challenge.challengeId,
      };
    } catch (err: any) {
      steps.push({
        stepNumber: steps.length + 1,
        title: 'Kegagalan Pengesahan Kriptografi',
        actor: 'READER',
        payloadOrCommand: err.message || 'Ralat pengesahan',
        outcome: 'FAILURE',
        technicalExplanation: `Akses disekat: ${err.message}`,
      });

      return {
        success: false,
        error: err.message,
        exchangeSteps: steps,
      };
    }
  }

  /**
   * Enroll Current Device with Hardware Keystore
   */
  async enrollDeviceAndCredential(
    userId: string,
    deviceId: string,
    modelName: string,
    platform: string
  ): Promise<{ success: boolean; message: string; metadata?: KeystoreKeyMetadata }> {
    const alias = `syncrozz_hw_${userId}`;

    // 1. Initialize or generate non-exportable hardware keypair
    const metadata = await keystoreAdapter.initializeKey(alias);

    // 2. Request enrollment challenge
    const challenge = await serverFunctions.requestAuthChallenge(deviceId);

    // 3. Sign challenge to prove ownership of private key
    const { signatureHex } = await keystoreAdapter.signChallenge(alias, challenge.nonce);

    // 4. Enroll with authoritative server (enforces one active device)
    const result = await serverFunctions.enrollCredential({
      deviceId,
      modelName,
      platform,
      fingerprint: metadata.publicKeyFingerprint,
      publicKeyJwk: metadata.publicKeyJwk,
      signatureHex,
      challengeId: challenge.challengeId,
    });

    return {
      success: result.success,
      message: result.message,
      metadata,
    };
  }

  /**
   * Revoke device and credential (lost phone flow)
   */
  async revokeAndReplace(userId: string, deviceId?: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const alias = `syncrozz_hw_${userId}`;
    const res = await serverFunctions.revokeAndReplaceCredential({
      deviceId,
      reason: reason || 'Kehilangan telefon / Penggantian peranti oleh staf',
      reportLost: true,
    });

    // Clear local keystore key and active session
    await keystoreAdapter.deleteKey(alias);
    this.clearSession();

    return res;
  }
}

export const sessionService = new SessionService();
