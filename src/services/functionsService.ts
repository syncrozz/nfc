import { auth } from './firebase';

export interface ServerActionResponse {
  success: boolean;
  message?: string;
  userId?: string;
  targetUserId?: string;
  newRole?: string;
  idempotent?: boolean;
  logId?: string;
}

/**
 * Service to execute sensitive administrative actions via Server-Side Authorization
 * Adheres strictly to SES-SEC-4.5.5 Zero-Trust principles
 */
class FunctionsService {
  private async getHeaders(idempotencyKey?: string): Promise<HeadersInit> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('SES-SEC-4.5.5: Pengguna mesti log masuk sebelum memanggil operasi berautoriti ini.');
    }

    const token = await currentUser.getIdToken();
    const key = idempotencyKey || `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': key,
    };
  }

  private async post(endpoint: string, body: any, idempotencyKey?: string): Promise<ServerActionResponse> {
    const headers = await this.getHeaders(idempotencyKey);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Ralat pelayan (${res.status}): ${data.error || 'Operasi gagal.'}`);
    }

    return data;
  }

  /**
   * 1. Approve User
   */
  async approveUser(targetUserId: string, requestId?: string): Promise<ServerActionResponse> {
    return this.post('/api/admin/approve-user', { targetUserId, requestId });
  }

  /**
   * 2. Reject User with mandatory reason
   */
  async rejectUser(targetUserId: string, reason: string, requestId?: string): Promise<ServerActionResponse> {
    if (!reason || reason.trim().length < 5) {
      throw new Error('SES-SEC-4.5.5: Alasan penolakan rasmi sekurang-kurangnya 5 aksara wajib dinyatakan.');
    }
    return this.post('/api/admin/reject-user', { targetUserId, reason: reason.trim(), requestId });
  }

  /**
   * 3. Suspend User
   */
  async suspendUser(targetUserId: string, reason?: string): Promise<ServerActionResponse> {
    return this.post('/api/admin/suspend-user', { targetUserId, reason });
  }

  /**
   * 4. Reactivate User
   */
  async reactivateUser(targetUserId: string): Promise<ServerActionResponse> {
    return this.post('/api/admin/reactivate-user', { targetUserId });
  }

  /**
   * 5. Activate Device (Enforces 1 active device policy)
   */
  async activateDevice(deviceId: string, userId: string): Promise<ServerActionResponse> {
    return this.post('/api/admin/activate-device', { deviceId, userId });
  }

  /**
   * 6. Revoke Device (Lost phone / decommissioning)
   */
  async revokeDevice(deviceId: string, reason?: string): Promise<ServerActionResponse> {
    return this.post('/api/admin/revoke-device', { deviceId, reason });
  }

  /**
   * 7. Revoke Credential
   */
  async revokeCredential(credentialId: string, reason?: string): Promise<ServerActionResponse> {
    return this.post('/api/admin/revoke-credential', { credentialId, reason });
  }

  /**
   * 8. Assign or Revoke MASTER_ADMIN Role
   */
  async assignRole(targetUserId: string, newRole: 'USER' | 'MASTER_ADMIN'): Promise<ServerActionResponse> {
    const res = await this.post('/api/admin/assign-role', { targetUserId, newRole });
    // Force refresh token if changing current user's role
    if (auth.currentUser?.uid === targetUserId) {
      await auth.currentUser.getIdToken(true);
    }
    return res;
  }

  /**
   * 9. Create Authoritative Audit Log
   */
  async createAuditLog(payload: {
    targetId: string;
    targetType: string;
    action: string;
    previousStatus?: string;
    newStatus?: string;
    reason?: string;
    details?: string;
  }): Promise<ServerActionResponse> {
    return this.post('/api/admin/audit-log', payload);
  }

  // ==============================================================
  // PHASE 3A MODULE 2: CRYPTOGRAPHIC SESSIONS & ENROLLMENT FLOW
  // ==============================================================

  /**
   * 10. Request Single-Use Challenge Nonce
   */
  async requestAuthChallenge(deviceId?: string): Promise<{ success: boolean; challengeId: string; nonce: string; expiresAt: string }> {
    return this.post('/api/auth/challenge', { deviceId }) as any;
  }

  /**
   * 11. Verify Challenge & Establish Ephemeral Cryptographic Session
   */
  async verifyAuthChallenge(params: {
    challengeId: string;
    deviceId: string;
    signatureHex: string;
    clientTimestamp?: string;
  }): Promise<{
    verified: boolean;
    sessionToken: string;
    expiresAt: string;
    credential: {
      id: string;
      status: string;
      authorizedZones: string[];
      expiresAt: string;
    };
  }> {
    return this.post('/api/auth/verify-challenge', params) as any;
  }

  /**
   * 12. Enroll Credential into Android Keystore & Bind Single Active Device
   */
  async enrollCredential(params: {
    deviceId: string;
    modelName: string;
    platform: string;
    fingerprint: string;
    publicKeyJwk: any;
    signatureHex: string;
    challengeId: string;
  }): Promise<{
    success: boolean;
    credentialId: string;
    status: string;
    deviceId: string;
    message: string;
  }> {
    return this.post('/api/credentials/enroll', params) as any;
  }

  /**
   * 13. Revoke and Replace Credential / Device (Lost Phone Flow)
   */
  async revokeAndReplaceCredential(params: {
    deviceId?: string;
    reason: string;
    reportLost: boolean;
  }): Promise<{ success: boolean; message: string }> {
    return this.post('/api/credentials/revoke-and-replace', params) as any;
  }

  /**
   * 14. Get Real-Time Authoritative Credential Lifecycle Status
   */
  async getMyCredentialStatus(): Promise<{
    hasCredential: boolean;
    credential?: any;
    activeDevice?: any;
    status: string;
  }> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/credentials/my-credential', { headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil status kredensial.');
    }
    return res.json();
  }
}

export const serverFunctions = new FunctionsService();
