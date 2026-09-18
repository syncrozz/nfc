import { auth } from './firebase';
import { AccessGroup } from '../types';

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
  private activeElevatedSessionToken: string | null = null;

  public setElevatedSessionToken(token: string | null) {
    this.activeElevatedSessionToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        sessionStorage.setItem('ses_master_admin_session_token', token);
      } else {
        sessionStorage.removeItem('ses_master_admin_session_token');
      }
    }
  }

  public getElevatedSessionToken(): string | null {
    if (!this.activeElevatedSessionToken && typeof window !== 'undefined') {
      this.activeElevatedSessionToken = sessionStorage.getItem('ses_master_admin_session_token');
    }
    return this.activeElevatedSessionToken;
  }

  private async getHeaders(idempotencyKey?: string): Promise<HeadersInit> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('SES-SEC-4.5.5: Pengguna mesti log masuk sebelum memanggil operasi berautoriti ini.');
    }

    const token = await currentUser.getIdToken();
    const key = idempotencyKey || `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const elevatedToken = this.getElevatedSessionToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Idempotency-Key': key,
    };

    if (elevatedToken) {
      headers['X-Admin-Session-Token'] = elevatedToken;
    }

    return headers;
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
   * 4b. Deactivate User (SES-SEC-4.5.5)
   */
  async deactivateUser(targetUserId: string, reason?: string): Promise<ServerActionResponse> {
    return this.post('/api/admin/deactivate-user', { targetUserId, reason });
  }

  /**
   * Check Server-side Master Admin Bootstrap Status
   */
  async checkBootstrapStatus(): Promise<{ masterAdminExists: boolean; canBootstrap: boolean; totalAdmins: number }> {
    try {
      const res = await fetch('/api/admin/bootstrap-status');
      if (!res.ok) {
        return { masterAdminExists: true, canBootstrap: false, totalAdmins: 1 };
      }
      return await res.json();
    } catch {
      return { masterAdminExists: true, canBootstrap: false, totalAdmins: 1 };
    }
  }

  /**
   * Secure Bootstrap for the FIRST Master Admin (SES-SEC-4.5.5)
   */
  async bootstrapFirstAdmin(): Promise<ServerActionResponse> {
    const res = await this.post('/api/admin/bootstrap-first-admin', {});
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
    }
    return res;
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
  // MASTER ADMIN PIN & ELEVATED SESSION (SES-SEC-4.5.5)
  // ==============================================================

  /**
   * Verify Master Admin PIN (e.g. 5313) securely on server
   */
  async verifyAdminPin(pin: string): Promise<{
    success: boolean;
    authenticated: boolean;
    sessionToken: string;
    expiresIn: number;
    expiresAt: string;
    message: string;
  }> {
    const res = await this.post('/api/admin/verify-pin', { pin });
    if (res && (res as any).sessionToken) {
      this.setElevatedSessionToken((res as any).sessionToken);
    }
    return res as any;
  }

  /**
   * Check if current Master Admin elevated session is active
   */
  async checkAdminSessionStatus(): Promise<{
    hasElevatedSession: boolean;
    remainingSeconds?: number;
    expiresAt?: string;
    reason?: string;
  }> {
    try {
      const headers = await this.getHeaders();
      const res = await fetch('/api/admin/session-status', {
        headers,
      });
      if (!res.ok) {
        return { hasElevatedSession: false, reason: 'HTTP_ERROR' };
      }
      const data = await res.json();
      if (!data.hasElevatedSession) {
        this.setElevatedSessionToken(null);
      }
      return data;
    } catch {
      return { hasElevatedSession: false, reason: 'NETWORK_ERROR' };
    }
  }

  /**
   * Lock Master Admin session immediately
   */
  async lockAdminSession(): Promise<ServerActionResponse> {
    try {
      const res = await this.post('/api/admin/lock-session', {});
      this.setElevatedSessionToken(null);
      return res;
    } catch (err) {
      this.setElevatedSessionToken(null);
      throw err;
    }
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

  /**
   * 15. Create Door (Master Admin)
   */
  async createDoor(doorData: {
    doorId: string;
    doorName: string;
    building: string;
    floor: string;
    location: string;
    zoneId: string;
    zoneName?: string;
    readerType: string;
    controllerType: string;
    integrationStatus?: string;
    operationalStatus?: string;
    assignedAccessGroups?: string[];
  }): Promise<{ success: boolean; message: string; door: any }> {
    return this.post('/api/admin/doors/create', doorData) as any;
  }

  /**
   * 16. Update Door (Master Admin)
   */
  async updateDoor(doorData: {
    doorId: string;
    doorName?: string;
    building?: string;
    floor?: string;
    location?: string;
    zoneId?: string;
    zoneName?: string;
    readerType?: string;
    controllerType?: string;
    integrationStatus?: string;
    assignedAccessGroups?: string[];
  }): Promise<{ success: boolean; message: string; updates: any }> {
    return this.post('/api/admin/doors/update', doorData) as any;
  }

  /**
   * 17. Toggle Door Operational Status (Master Admin)
   */
  async toggleDoorStatus(params: {
    doorId: string;
    newStatus: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'LOCKDOWN';
    reason?: string;
  }): Promise<{ success: boolean; message: string; doorId: string; newStatus: string }> {
    return this.post('/api/admin/doors/toggle-status', params) as any;
  }

  /**
   * 18. Get Door Audit History (Master Admin)
   */
  async getDoorAuditHistory(doorId: string): Promise<{ doorId: string; auditEntries: any[] }> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/admin/doors/${doorId}/audit-history`, { headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil sejarah audit pintu.');
    }
    return res.json();
  }

  /**
   * 19. Get Campus Zones (Authenticated)
   */
  async getZones(): Promise<{ zones: any[] }> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/admin/zones', { headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil senarai zon kampus.');
    }
    return res.json();
  }

  /**
   * 20. Get Single Zone with Doors
   */
  async getZone(zoneId: string): Promise<{ zone: any; doors: any[] }> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/admin/zones/${zoneId}`, { headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || `Gagal mengambil maklumat zon ${zoneId}.`);
    }
    return res.json();
  }

  /**
   * 21. Create Campus Zone (Master Admin)
   */
  async createZone(zoneData: {
    zoneId: string;
    zoneName: string;
    zoneCode?: string;
    description?: string;
    building?: string;
    floor?: string;
    location?: string;
    status?: string;
    securityLevel?: string;
  }): Promise<{ success: boolean; message: string; zone: any }> {
    return this.post('/api/admin/zones/create', zoneData) as any;
  }

  /**
   * 22. Update Campus Zone (Master Admin)
   */
  async updateZone(zoneData: {
    zoneId: string;
    zoneName?: string;
    zoneCode?: string;
    description?: string;
    building?: string;
    floor?: string;
    location?: string;
    securityLevel?: string;
  }): Promise<{ success: boolean; message: string; updates: any }> {
    return this.post('/api/admin/zones/update', zoneData) as any;
  }

  /**
   * 23. Toggle Zone Status (Master Admin)
   */
  async toggleZoneStatus(params: {
    zoneId: string;
    newStatus: 'ACTIVE' | 'INACTIVE';
    reason: string;
    force?: boolean;
  }): Promise<{ success: boolean; message: string; zoneId: string; newStatus: string }> {
    return this.post('/api/admin/zones/toggle-status', params) as any;
  }

  /**
   * 24. Get Zone Audit History (Master Admin)
   */
  async getZoneAuditHistory(zoneId: string): Promise<{ zoneId: string; auditEntries: any[] }> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/admin/zones/${zoneId}/audit-history`, { headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil sejarah audit zon.');
    }
    return res.json();
  }

  /**
   * 25. Assign Door to Zone (Master Admin)
   */
  async assignDoorToZone(params: {
    zoneId: string;
    doorId: string;
    reason?: string;
  }): Promise<{ success: boolean; message: string; zoneId: string; doorId: string; assignedDoors: string[] }> {
    return this.post('/api/admin/zones/assign-door', params) as any;
  }

  /**
   * 26. Remove Door from Zone (Master Admin)
   */
  async removeDoorFromZone(params: {
    zoneId: string;
    doorId: string;
    reason?: string;
  }): Promise<{ success: boolean; message: string; zoneId: string; doorId: string; assignedDoors: string[] }> {
    return this.post('/api/admin/zones/remove-door', params) as any;
  }

  /**
   * ==============================================================
   * PHASE 3 — MODULE 3: ACCESS GROUP MANAGEMENT (SES v4.5)
   * ==============================================================
   */

  /**
   * 27. Get All Access Groups
   */
  async getAccessGroups(): Promise<{ success: boolean; accessGroups: AccessGroup[] }> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/admin/access-groups', { headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil senarai kumpulan akses.');
    }
    return res.json();
  }

  /**
   * 28. Get Single Access Group with users, doors, and zones
   */
  async getAccessGroup(groupId: string): Promise<{
    success: boolean;
    accessGroup: AccessGroup;
    users: any[];
    doors: any[];
    zones: any[];
  }> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/admin/access-groups/${groupId}`, { headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil maklumat kumpulan akses.');
    }
    return res.json();
  }

  /**
   * 29. Create Access Group (Master Admin)
   */
  async createAccessGroup(params: {
    groupId: string;
    groupName: string;
    description?: string;
    groupType?: string;
    assignedUsers?: string[];
    assignedDoors?: string[];
    assignedZones?: string[];
    allowedSchedule?: any;
    validFrom?: string;
    validUntil?: string;
    status?: 'ACTIVE' | 'INACTIVE';
  }, idempotencyKey?: string): Promise<{ success: boolean; message: string; accessGroup: AccessGroup }> {
    return this.post('/api/admin/access-groups/create', params, idempotencyKey) as any;
  }

  /**
   * 30. Update Access Group (Master Admin)
   */
  async updateAccessGroup(params: {
    groupId: string;
    groupName?: string;
    description?: string;
    groupType?: string;
    assignedZones?: string[];
    allowedSchedule?: any;
    validFrom?: string;
    validUntil?: string;
  }, idempotencyKey?: string): Promise<{ success: boolean; message: string; accessGroup: AccessGroup }> {
    return this.post('/api/admin/access-groups/update', params, idempotencyKey) as any;
  }

  /**
   * 31. Toggle Access Group Status (Master Admin with Mandatory Reason)
   */
  async toggleAccessGroupStatus(params: {
    groupId: string;
    newStatus: 'ACTIVE' | 'INACTIVE';
    reason: string;
  }, idempotencyKey?: string): Promise<{
    success: boolean;
    message: string;
    groupId: string;
    previousStatus: string;
    newStatus: string;
  }> {
    return this.post('/api/admin/access-groups/toggle-status', params, idempotencyKey) as any;
  }

  /**
   * 32. Assign User to Access Group (Master Admin)
   */
  async assignUserToGroup(params: {
    groupId: string;
    userId: string;
    reason?: string;
  }, idempotencyKey?: string): Promise<{
    success: boolean;
    message: string;
    groupId: string;
    userId: string;
    assignedUsers: string[];
  }> {
    return this.post('/api/admin/access-groups/assign-user', params, idempotencyKey) as any;
  }

  /**
   * 33. Remove User from Access Group (Master Admin)
   */
  async removeUserFromGroup(params: {
    groupId: string;
    userId: string;
    reason?: string;
  }, idempotencyKey?: string): Promise<{
    success: boolean;
    message: string;
    groupId: string;
    userId: string;
    assignedUsers: string[];
  }> {
    return this.post('/api/admin/access-groups/remove-user', params, idempotencyKey) as any;
  }

  /**
   * 34. Assign Door to Access Group (Master Admin)
   */
  async assignDoorToGroup(params: {
    groupId: string;
    doorId: string;
    reason?: string;
  }, idempotencyKey?: string): Promise<{
    success: boolean;
    message: string;
    groupId: string;
    doorId: string;
    assignedDoors: string[];
  }> {
    return this.post('/api/admin/access-groups/assign-door', params, idempotencyKey) as any;
  }

  /**
   * 35. Remove Door from Access Group (Master Admin)
   */
  async removeDoorFromGroup(params: {
    groupId: string;
    doorId: string;
    reason?: string;
  }, idempotencyKey?: string): Promise<{
    success: boolean;
    message: string;
    groupId: string;
    doorId: string;
    assignedDoors: string[];
  }> {
    return this.post('/api/admin/access-groups/remove-door', params, idempotencyKey) as any;
  }

  /**
   * 36. Get Access Group Audit History (Master Admin)
   */
  async getAccessGroupAuditHistory(groupId: string): Promise<{ groupId: string; auditEntries: any[] }> {
    const headers = await this.getHeaders();
    const res = await fetch(`/api/admin/access-groups/${groupId}/audit-history`, { headers });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal mengambil sejarah audit kumpulan akses.');
    }
    return res.json();
  }
}

export const serverFunctions = new FunctionsService();
