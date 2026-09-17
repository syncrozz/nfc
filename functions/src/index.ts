import * as functions from 'firebase-functions/v1';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import crypto from 'crypto';

// Initialize Firebase Admin if not already initialized
let appInstance: App;
if (getApps().length === 0) {
  appInstance = initializeApp();
} else {
  appInstance = getApps()[0];
}

const db: Firestore = getFirestore(appInstance);
const auth: Auth = getAuth(appInstance);

// Interface for Audit Log
interface AuditLogPayload {
  actorId: string;
  actorEmail: string;
  targetId: string;
  targetType: 'USER' | 'DEVICE' | 'CREDENTIAL' | 'ROLE' | 'ACCESS_REQUEST';
  action: string;
  previousStatus?: string;
  newStatus?: string;
  result: 'SUCCESS' | 'FAILED';
  reason?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Helper to record immutable audit log in Firestore
 */
async function recordAuditLog(log: AuditLogPayload) {
  const logRef = db.collection('accessLogs').doc();
  const entry = {
    id: logRef.id,
    timestamp: new Date().toISOString(),
    actorId: log.actorId,
    actorEmail: log.actorEmail,
    targetId: log.targetId,
    targetType: log.targetType,
    action: log.action,
    previousStatus: log.previousStatus || 'N/A',
    newStatus: log.newStatus || 'N/A',
    result: log.result,
    reason: log.reason || null,
    details: log.details || `${log.action} performed on ${log.targetId}`,
    ipAddress: log.ipAddress || 'UNKNOWN',
    userAgent: log.userAgent || 'CLOUD_FUNCTION',
    simulated: false,
  };
  await logRef.set(entry);
  return entry;
}

/**
 * Authoritative Master Admin check helper
 * Checks Firebase Custom Claims `token.admin === true` or `token.role === 'MASTER_ADMIN'`
 */
async function assertMasterAdmin(context: functions.https.CallableContext): Promise<{ uid: string; email: string }> {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'SES-SEC-4.5.5: Pengesahan identiti diperlukan sebelum memanggil fungsi ini.'
    );
  }

  const { uid, token } = context.auth;
  const isClaimAdmin = token.admin === true || token.role === 'MASTER_ADMIN';

  if (!isClaimAdmin) {
    // Check Firestore user document as authoritative backup
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== 'MASTER_ADMIN' || userData.status !== 'APPROVED') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'SES-SEC-4.5.5: Akses ditolak. Hanya MASTER_ADMIN berdaftar dan aktif dibenarkan.'
      );
    }
  }

  return { uid, email: context.auth.token.email || 'unknown@kpmbp.edu.my' };
}

/**
 * SES-SEC-4.5.5 Cloud Functions Idempotency Engine
 */
async function checkFunctionIdempotency(key?: string, userId?: string, actionName?: string): Promise<{ isDuplicate: boolean; cachedResponse?: any }> {
  if (!key || typeof key !== 'string') return { isDuplicate: false };
  const idempRef = db.collection('_idempotencyKeys').doc(key);
  const snap = await idempRef.get();

  if (snap.exists) {
    const data = snap.data()!;
    if (data.status === 'COMPLETED') {
      return { isDuplicate: true, cachedResponse: data.response };
    }
    if (data.status === 'PROCESSING') {
      throw new functions.https.HttpsError(
        'already-exists',
        'SES-SEC-4.5.5: Permintaan pendua sedang diproses. Sila tunggu.'
      );
    }
  }

  await idempRef.set({
    idempotencyKey: key,
    userId: userId || 'SYSTEM',
    action: actionName || 'UNKNOWN',
    status: 'PROCESSING',
    createdAt: new Date().toISOString(),
  });

  return { isDuplicate: false };
}

async function completeFunctionIdempotency(key?: string, response?: any): Promise<void> {
  if (!key || typeof key !== 'string') return;
  const idempRef = db.collection('_idempotencyKeys').doc(key);
  await idempRef.set({
    status: 'COMPLETED',
    response: response || { success: true },
    completedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * 1. approveUser (onCall)
 * Approves a pending staff registration, issues cryptographic credential, and updates request
 */
export const approveUser = functions.https.onCall(async (data, context) => {
  const adminActor = await assertMasterAdmin(context);
  const { targetUserId, requestId, idempotencyKey } = data;

  if (!targetUserId || typeof targetUserId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'targetUserId diperlukan.');
  }

  const idemp = await checkFunctionIdempotency(idempotencyKey, adminActor.uid, 'APPROVE_USER');
  if (idemp.isDuplicate) {
    return { ...idemp.cachedResponse, idempotent: true };
  }

  const result = await db.runTransaction(async (transaction) => {
    const userRef = db.collection('users').doc(targetUserId);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Pengguna tidak ditemui.');
    }

    const userData = userSnap.data()!;
    const previousStatus = userData.status;

    // Idempotency check: if already approved, return without duplicating
    if (previousStatus === 'APPROVED') {
      return { success: true, message: 'Pengguna telah diluluskan sebelumnya (Idempotent).', userId: targetUserId, idempotent: true };
    }

    // 1. Update user to APPROVED
    transaction.update(userRef, {
      status: 'APPROVED',
      rejectionReason: FieldValue.delete(),
      updatedAt: new Date().toISOString(),
      updatedBy: adminActor.uid,
    });

    // 2. Update Access Request if provided
    if (requestId) {
      const reqRef = db.collection('accessRequests').doc(requestId);
      transaction.update(reqRef, {
        status: 'APPROVED',
        reviewedBy: adminActor.email,
        reviewedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 3. Issue or update Credential in transaction
    const credId = `cred-${targetUserId}`;
    const credRef = db.collection('credentials').doc(credId);
    transaction.set(credRef, {
      id: credId,
      userId: targetUserId,
      status: 'ACTIVE',
      applicationIdentifier: 'A0000008410001',
      alias: `kpmbp_nfc_${userData.staffId?.toLowerCase() || targetUserId}`,
      holderName: userData.fullName,
      facilityId: userData.staffId,
      department: userData.department,
      authorizedZones: ['ZONE-A-ACADEMIC', 'ZONE-C-ICT', 'ZONE-D-ADMIN'],
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // 4. Record Audit Log
    await recordAuditLog({
      actorId: adminActor.uid,
      actorEmail: adminActor.email,
      targetId: targetUserId,
      targetType: 'USER',
      action: 'APPROVE_USER',
      previousStatus,
      newStatus: 'APPROVED',
      result: 'SUCCESS',
      details: `Permohonan staf ${userData.fullName} (${userData.staffId}) diluluskan oleh ${adminActor.email}.`,
    });

    return { success: true, message: 'Pengguna berjaya diluluskan.', userId: targetUserId };
  });

  await completeFunctionIdempotency(idempotencyKey, result);
  return result;
});

/**
 * 2. rejectUser (onCall)
 * Rejects a user registration with mandatory justification reason
 */
export const rejectUser = functions.https.onCall(async (data, context) => {
  const adminActor = await assertMasterAdmin(context);
  const { targetUserId, reason, requestId } = data;

  if (!targetUserId || typeof targetUserId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'targetUserId diperlukan.');
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Alasan penolakan rasmi (sekurang-kurangnya 5 aksara) wajib dinyatakan mengikut SES-SEC-4.5.5.'
    );
  }

  const userRef = db.collection('users').doc(targetUserId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Pengguna tidak ditemui.');
  }

  const userData = userSnap.data()!;
  const previousStatus = userData.status;

  await userRef.update({
    status: 'REJECTED',
    rejectionReason: reason.trim(),
    updatedAt: new Date().toISOString(),
    updatedBy: adminActor.uid,
  });

  if (requestId) {
    await db.collection('accessRequests').doc(requestId).update({
      status: 'REJECTED',
      decisionReason: reason.trim(),
      reviewedBy: adminActor.email,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  await recordAuditLog({
    actorId: adminActor.uid,
    actorEmail: adminActor.email,
    targetId: targetUserId,
    targetType: 'USER',
    action: 'REJECT_USER',
    previousStatus,
    newStatus: 'REJECTED',
    result: 'SUCCESS',
    reason: reason.trim(),
    details: `Permohonan staf ${userData.fullName} ditolak. Sebab: ${reason.trim()}`,
  });

  return { success: true, message: 'Permohonan pengguna ditolak.', userId: targetUserId };
});

/**
 * 3. suspendUser (onCall)
 * Suspends an active user and freezes their digital credentials
 */
export const suspendUser = functions.https.onCall(async (data, context) => {
  const adminActor = await assertMasterAdmin(context);
  const { targetUserId, reason } = data;

  if (!targetUserId || typeof targetUserId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'targetUserId diperlukan.');
  }

  const userRef = db.collection('users').doc(targetUserId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Pengguna tidak ditemui.');
  }

  const userData = userSnap.data()!;
  if (userData.role === 'MASTER_ADMIN') {
    throw new functions.https.HttpsError('failed-precondition', 'Akaun MASTER_ADMIN tidak boleh digantung secara automatik.');
  }

  const previousStatus = userData.status;

  await userRef.update({
    status: 'SUSPENDED',
    rejectionReason: reason || 'Penggantungan sementara oleh pentadbir.',
    updatedAt: new Date().toISOString(),
    updatedBy: adminActor.uid,
  });

  // Freeze credentials
  const credRef = db.collection('credentials').doc(`cred-${targetUserId}`);
  const credSnap = await credRef.get();
  if (credSnap.exists) {
    await credRef.update({
      status: 'SUSPENDED',
      updatedAt: new Date().toISOString(),
    });
  }

  await recordAuditLog({
    actorId: adminActor.uid,
    actorEmail: adminActor.email,
    targetId: targetUserId,
    targetType: 'USER',
    action: 'SUSPEND_USER',
    previousStatus,
    newStatus: 'SUSPENDED',
    result: 'SUCCESS',
    reason: reason || 'Pencegahan risiko keselamatan',
    details: `Akaun ${userData.fullName} digantung oleh ${adminActor.email}.`,
  });

  return { success: true, message: 'Pengguna digantung.', userId: targetUserId };
});

/**
 * 4. reactivateUser (onCall)
 * Restores a suspended user back to APPROVED
 */
export const reactivateUser = functions.https.onCall(async (data, context) => {
  const adminActor = await assertMasterAdmin(context);
  const { targetUserId } = data;

  if (!targetUserId || typeof targetUserId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'targetUserId diperlukan.');
  }

  const userRef = db.collection('users').doc(targetUserId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Pengguna tidak ditemui.');
  }

  const userData = userSnap.data()!;
  const previousStatus = userData.status;

  await userRef.update({
    status: 'APPROVED',
    rejectionReason: FieldValue.delete(),
    updatedAt: new Date().toISOString(),
    updatedBy: adminActor.uid,
  });

  // Restore credential
  const credRef = db.collection('credentials').doc(`cred-${targetUserId}`);
  const credSnap = await credRef.get();
  if (credSnap.exists) {
    await credRef.update({
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
    });
  }

  await recordAuditLog({
    actorId: adminActor.uid,
    actorEmail: adminActor.email,
    targetId: targetUserId,
    targetType: 'USER',
    action: 'REACTIVATE_USER',
    previousStatus,
    newStatus: 'APPROVED',
    result: 'SUCCESS',
    details: `Akaun ${userData.fullName} diaktifkan semula oleh ${adminActor.email}.`,
  });

  return { success: true, message: 'Akaun pengguna telah diaktifkan semula.', userId: targetUserId };
});

/**
 * 5. activateDevice (onCall)
 * Enforces single active device policy: revokes existing devices for user, activates target device
 */
export const activateDevice = functions.https.onCall(async (data, context) => {
  const adminActor = await assertMasterAdmin(context);
  const { deviceId, userId } = data;

  if (!deviceId || !userId) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId dan userId diperlukan.');
  }

  const batch = db.batch();

  // Find other active devices for this user
  const userDevicesSnap = await db.collection('devices')
    .where('userId', '==', userId)
    .where('status', '==', 'ACTIVE')
    .get();

  userDevicesSnap.forEach((doc) => {
    if (doc.id !== deviceId) {
      batch.update(doc.ref, {
        status: 'REVOKED',
        revokedAt: new Date().toISOString(),
        revokedReason: 'Digantikan oleh pendaftaran telefon baharu (Dasar SES 1-Peranti)',
      });
    }
  });

  // Activate the target device
  const targetDeviceRef = db.collection('devices').doc(deviceId);
  batch.update(targetDeviceRef, {
    status: 'ACTIVE',
    updatedAt: new Date().toISOString(),
    approvedBy: adminActor.email,
  });

  // Update activeDeviceId on User document
  batch.update(db.collection('users').doc(userId), {
    activeDeviceId: deviceId,
    updatedAt: new Date().toISOString(),
  });

  await batch.commit();

  await recordAuditLog({
    actorId: adminActor.uid,
    actorEmail: adminActor.email,
    targetId: deviceId,
    targetType: 'DEVICE',
    action: 'ACTIVATE_DEVICE',
    previousStatus: 'PENDING',
    newStatus: 'ACTIVE',
    result: 'SUCCESS',
    details: `Peranti ${deviceId} diaktifkan untuk pengguna ${userId}. Peranti lain dibatalkan.`,
  });

  return { success: true, message: 'Peranti berjaya diaktifkan.' };
});

/**
 * 6. revokeDevice (onCall)
 * Revokes a device (e.g. lost phone or decommissioning)
 */
export const revokeDevice = functions.https.onCall(async (data, context) => {
  const adminActor = await assertMasterAdmin(context);
  const { deviceId, reason } = data;

  if (!deviceId) {
    throw new functions.https.HttpsError('invalid-argument', 'deviceId diperlukan.');
  }

  const devRef = db.collection('devices').doc(deviceId);
  const devSnap = await devRef.get();
  if (!devSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Peranti tidak ditemui.');
  }

  const devData = devSnap.data()!;
  const previousStatus = devData.status;

  await devRef.update({
    status: 'REVOKED',
    lostReported: true,
    revokedReason: reason || 'Dibatalkan oleh Master Admin',
    updatedAt: new Date().toISOString(),
  });

  // Clear activeDeviceId on User doc if it was active
  if (devData.userId) {
    const userRef = db.collection('users').doc(devData.userId);
    const userSnap = await userRef.get();
    if (userSnap.exists && userSnap.data()?.activeDeviceId === deviceId) {
      await userRef.update({
        activeDeviceId: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  await recordAuditLog({
    actorId: adminActor.uid,
    actorEmail: adminActor.email,
    targetId: deviceId,
    targetType: 'DEVICE',
    action: 'REVOKE_DEVICE',
    previousStatus,
    newStatus: 'REVOKED',
    result: 'SUCCESS',
    reason: reason || 'Kehilangan / pembatalan peranti',
    details: `Peranti ${devData.deviceModel || deviceId} dibatalkan.`,
  });

  return { success: true, message: 'Peranti berjaya dibatalkan.' };
});

/**
 * 7. revokeCredential (onCall)
 * Explicitly revokes a cryptographic credential container
 */
export const revokeCredential = functions.https.onCall(async (data, context) => {
  const adminActor = await assertMasterAdmin(context);
  const { credentialId, reason } = data;

  if (!credentialId) {
    throw new functions.https.HttpsError('invalid-argument', 'credentialId diperlukan.');
  }

  const credRef = db.collection('credentials').doc(credentialId);
  const credSnap = await credRef.get();
  if (!credSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Kredensial tidak ditemui.');
  }

  const credData = credSnap.data()!;
  const previousStatus = credData.status;

  await credRef.update({
    status: 'REVOKED',
    revokedAt: new Date().toISOString(),
    revokedBy: adminActor.email,
    revocationReason: reason || 'Dibatalkan oleh Master Admin',
    updatedAt: new Date().toISOString(),
  });

  await recordAuditLog({
    actorId: adminActor.uid,
    actorEmail: adminActor.email,
    targetId: credentialId,
    targetType: 'CREDENTIAL',
    action: 'REVOKE_CREDENTIAL',
    previousStatus,
    newStatus: 'REVOKED',
    result: 'SUCCESS',
    reason: reason || 'Pembatalan sijil digital',
    details: `Kredensial ${credentialId} staf ${credData.holderName} dibatalkan.`,
  });

  return { success: true, message: 'Kredensial berjaya dibatalkan.' };
});

/**
 * 8. assignOrRevokeAdminRole (onCall)
 * Authoritatively sets Firebase Custom User Claims (admin: true/false, role: 'MASTER_ADMIN'/'USER')
 */
export const assignOrRevokeAdminRole = functions.https.onCall(async (data, context) => {
  const adminActor = await assertMasterAdmin(context);
  const { targetUserId, newRole } = data;

  if (!targetUserId || !newRole || !['USER', 'MASTER_ADMIN'].includes(newRole)) {
    throw new functions.https.HttpsError('invalid-argument', 'targetUserId dan newRole (USER atau MASTER_ADMIN) diperlukan.');
  }

  // Prevent self-demotion if caller is target
  if (targetUserId === adminActor.uid && newRole === 'USER') {
    throw new functions.https.HttpsError('failed-precondition', 'Anda tidak boleh melucutkan peranan Master Admin anda sendiri.');
  }

  // 1. Set Custom User Claims on Firebase Auth
  const isMasterAdmin = newRole === 'MASTER_ADMIN';
  await auth.setCustomUserClaims(targetUserId, {
    admin: isMasterAdmin,
    role: newRole,
  });

  // 2. Update Firestore user document
  const userRef = db.collection('users').doc(targetUserId);
  const userSnap = await userRef.get();
  const previousRole = userSnap.data()?.role || 'USER';

  await userRef.update({
    role: newRole,
    updatedAt: new Date().toISOString(),
    updatedBy: adminActor.uid,
  });

  // 3. Record Audit Log
  await recordAuditLog({
    actorId: adminActor.uid,
    actorEmail: adminActor.email,
    targetId: targetUserId,
    targetType: 'ROLE',
    action: isMasterAdmin ? 'ASSIGN_MASTER_ADMIN' : 'REVOKE_MASTER_ADMIN',
    previousStatus: previousRole,
    newStatus: newRole,
    result: 'SUCCESS',
    details: `Peranan ${newRole} diberikan kepada ${userSnap.data()?.email || targetUserId} oleh ${adminActor.email}.`,
  });

  return {
    success: true,
    message: `Peranan ${newRole} berjaya dikemaskini. Token claims telah dikonfigurasi.`,
    targetUserId,
    newRole,
  };
});

/**
 * 9. createAuditLog (onCall)
 * Server-authoritative audit logging endpoint for application events
 */
export const createAuditLog = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Pengesahan identiti diperlukan.');
  }

  const { targetId, targetType, action, previousStatus, newStatus, reason, details } = data;

  if (!targetId || !action || !targetType) {
    throw new functions.https.HttpsError('invalid-argument', 'targetId, action, dan targetType wajib disertakan.');
  }

  const entry = await recordAuditLog({
    actorId: context.auth.uid,
    actorEmail: context.auth.token.email || 'authenticated-user@kpmbp.edu.my',
    targetId,
    targetType,
    action,
    previousStatus,
    newStatus,
    result: 'SUCCESS',
    reason,
    details,
    ipAddress: context.rawRequest ? context.rawRequest.ip : undefined,
  });

  return { success: true, logId: entry.id };
});

// =========================================================================
// PHASE 3A MODULE 2: CALLABLE FUNCTIONS FOR CRYPTOGRAPHIC WORKFLOWS
// =========================================================================

/**
 * 10. requestAuthChallenge (onCall)
 */
export const requestAuthChallenge = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Pengesahan identiti diperlukan.');
  }

  const { deviceId } = data || {};
  const nonce = crypto.randomBytes(32).toString('hex');
  const challengeId = `chall-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();

  await db.collection('_authNonces').doc(challengeId).set({
    challengeId,
    nonce,
    userId: context.auth.uid,
    deviceId: deviceId || null,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    expiresAt,
  });

  return { success: true, challengeId, nonce, expiresAt };
});

/**
 * 11. verifyAuthChallenge (onCall)
 */
export const verifyAuthChallenge = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Pengesahan identiti diperlukan.');
  }

  const { challengeId, deviceId, signatureHex, idempotencyKey } = data;
  if (!challengeId || !deviceId || !signatureHex) {
    throw new functions.https.HttpsError('invalid-argument', 'challengeId, deviceId, dan signatureHex diperlukan.');
  }

  const idemp = await checkFunctionIdempotency(idempotencyKey, context.auth.uid, 'verifyAuthChallenge');
  if (idemp.isDuplicate) return idemp.cachedResponse;

  // 1. Fetch & Burn Nonce
  const nonceRef = db.collection('_authNonces').doc(challengeId);
  const nonceSnap = await nonceRef.get();

  if (!nonceSnap.exists) {
    throw new functions.https.HttpsError('invalid-argument', 'Cabaran keselamatan tidak sah.');
  }

  const nonceData = nonceSnap.data()!;
  if (nonceData.status !== 'ACTIVE') {
    throw new functions.https.HttpsError('already-exists', 'SES-SEC-4.5.5: Replay attack dicegah. Nonce telah digunakan.');
  }

  if (new Date(nonceData.expiresAt).getTime() < Date.now()) {
    await nonceRef.update({ status: 'EXPIRED' });
    throw new functions.https.HttpsError('deadline-exceeded', 'Cabaran keselamatan telah tamat tempoh.');
  }

  if (nonceData.userId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Cabaran tidak terikat kepada pengguna semasa.');
  }

  await nonceRef.update({
    status: 'BURNED',
    burnedAt: new Date().toISOString(),
    burnedBy: context.auth.uid,
  });

  // 2. Validate Device
  const devRef = db.collection('devices').doc(deviceId);
  const devSnap = await devRef.get();
  if (!devSnap.exists || devSnap.data()?.userId !== context.auth.uid || devSnap.data()?.status !== 'ACTIVE') {
    throw new functions.https.HttpsError('permission-denied', 'Peranti tidak aktif atau tidak sah.');
  }

  const devData = devSnap.data()!;

  // 3. Validate Credential Lifecycle
  const credRef = db.collection('credentials').doc(`cred-${context.auth.uid}`);
  const credSnap = await credRef.get();
  if (!credSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Kredensial digital tidak ditemui.');
  }

  const credData = credSnap.data()!;
  let evaluatedStatus = credData.status;

  if (credData.expiresAt && new Date(credData.expiresAt).getTime() < Date.now()) {
    evaluatedStatus = 'EXPIRED';
    await credRef.update({ status: 'EXPIRED', updatedAt: new Date().toISOString() });
    throw new functions.https.HttpsError('permission-denied', 'Kredensial digital telah tamat tempoh.');
  }

  if (evaluatedStatus !== 'ACTIVE') {
    throw new functions.https.HttpsError('permission-denied', `Kredensial berstatus ${evaluatedStatus}.`);
  }

  // 4. Verify ECDSA signature
  let pubJwk = devData.publicKeyJwk || credData.publicKeyJwk;
  if (typeof pubJwk === 'string') {
    try { pubJwk = JSON.parse(pubJwk); } catch { /* ignore */ }
  }

  const subtle = crypto.webcrypto.subtle;
  const keyObj = await subtle.importKey(
    'jwk',
    pubJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  const isValid = await subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    keyObj,
    Buffer.from(signatureHex, 'hex'),
    Buffer.from(nonceData.nonce, 'hex')
  );

  if (!isValid) {
    await recordAuditLog({
      actorId: context.auth.uid,
      actorEmail: context.auth.token.email || 'user@kpmbp.edu.my',
      targetId: deviceId,
      targetType: 'DEVICE',
      action: 'CHALLENGE_RESPONSE_AUTH',
      result: 'FAILED',
      reason: 'Tandatangan ECDSA tidak sepadan',
    });
    throw new functions.https.HttpsError('unauthenticated', 'Tandatangan kriptografi tidak sah.');
  }

  const sessionExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const sessionToken = Buffer.from(JSON.stringify({
    sub: context.auth.uid,
    dev: deviceId,
    exp: sessionExpiry,
  })).toString('base64url');

  await recordAuditLog({
    actorId: context.auth.uid,
    actorEmail: context.auth.token.email || 'user@kpmbp.edu.my',
    targetId: deviceId,
    targetType: 'DEVICE',
    action: 'CHALLENGE_RESPONSE_AUTH',
    result: 'SUCCESS',
    details: 'Pengesahan sesi kriptografi Keystore berjaya.',
  });

  const response = {
    verified: true,
    sessionToken,
    expiresAt: sessionExpiry,
    credential: {
      id: credSnap.id,
      status: evaluatedStatus,
      authorizedZones: credData.authorizedZones,
      expiresAt: credData.expiresAt,
    },
  };

  await completeFunctionIdempotency(idempotencyKey, response);
  return response;
});

/**
 * 12. enrollCredential (onCall)
 * Enforces one-active-device policy and registers Keystore public key
 */
export const enrollCredential = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Pengesahan identiti diperlukan.');
  }

  const { deviceId, modelName, platform, fingerprint, publicKeyJwk, signatureHex, challengeId, idempotencyKey } = data;
  if (!deviceId || !publicKeyJwk || !signatureHex || !challengeId) {
    throw new functions.https.HttpsError('invalid-argument', 'Maklumat pendaftaran tidak lengkap.');
  }

  const idemp = await checkFunctionIdempotency(idempotencyKey, context.auth.uid, 'enrollCredential');
  if (idemp.isDuplicate) return idemp.cachedResponse;

  // 1. Verify User is APPROVED
  const userRef = db.collection('users').doc(context.auth.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists || userSnap.data()?.status !== 'APPROVED') {
    throw new functions.https.HttpsError('permission-denied', 'Hanya staf berstatus APPROVED dibenarkan mendaftar.');
  }

  const userData = userSnap.data()!;

  // 2. Verify and Burn Challenge
  const nonceRef = db.collection('_authNonces').doc(challengeId);
  const nonceSnap = await nonceRef.get();
  if (!nonceSnap.exists || nonceSnap.data()?.status !== 'ACTIVE') {
    throw new functions.https.HttpsError('invalid-argument', 'Cabaran pendaftaran tidak sah atau telah digunakan.');
  }

  const nonceData = nonceSnap.data()!;
  await nonceRef.update({ status: 'BURNED', burnedAt: new Date().toISOString() });

  // 3. Verify Signature
  const subtle = crypto.webcrypto.subtle;
  const parsedJwk = typeof publicKeyJwk === 'string' ? JSON.parse(publicKeyJwk) : publicKeyJwk;
  const keyObj = await subtle.importKey('jwk', parsedJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const isValid = await subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    keyObj,
    Buffer.from(signatureHex, 'hex'),
    Buffer.from(nonceData.nonce, 'hex')
  );

  if (!isValid) {
    throw new functions.https.HttpsError('unauthenticated', 'Tandatangan cabaran pendaftaran tidak sah.');
  }

  // 4. One-Active-Device Enforcement
  const batch = db.batch();
  const existingDevices = await db.collection('devices')
    .where('userId', '==', context.auth.uid)
    .where('status', '==', 'ACTIVE')
    .get();

  existingDevices.forEach((doc) => {
    if (doc.id !== deviceId) {
      batch.update(doc.ref, {
        status: 'REVOKED',
        revokedAt: new Date().toISOString(),
        revokedReason: 'Digantikan oleh pendaftaran telefon baharu (Dasar SES v4.5 1-Peranti Aktif)',
      });
    }
  });

  const devRef = db.collection('devices').doc(deviceId);
  batch.set(devRef, {
    id: deviceId,
    userId: context.auth.uid,
    deviceModel: modelName || 'Android Device',
    platform: platform || 'Android',
    fingerprint: fingerprint || 'hw-' + deviceId,
    publicKeyJwk: JSON.stringify(parsedJwk),
    keystoreAlias: `syncrozz_hw_${context.auth.uid}`,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  }, { merge: true });

  batch.update(userRef, {
    activeDeviceId: deviceId,
    updatedAt: new Date().toISOString(),
  });

  const credId = `cred-${context.auth.uid}`;
  const credRef = db.collection('credentials').doc(credId);
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  batch.set(credRef, {
    id: credId,
    userId: context.auth.uid,
    deviceId,
    status: 'ACTIVE',
    applicationIdentifier: 'A0000008410001',
    alias: `kpmbp_nfc_${userData.staffId?.toLowerCase() || context.auth.uid}`,
    keystoreAlias: `syncrozz_hw_${context.auth.uid}`,
    publicKeyJwk: JSON.stringify(parsedJwk),
    holderName: userData.fullName,
    facilityId: userData.staffId,
    department: userData.department,
    authorizedZones: ['ZONE-A-ACADEMIC', 'ZONE-C-ICT', 'ZONE-D-ADMIN'],
    issuedAt,
    expiresAt,
    createdAt: issuedAt,
    updatedAt: issuedAt,
  }, { merge: true });

  await batch.commit();

  await recordAuditLog({
    actorId: context.auth.uid,
    actorEmail: context.auth.token.email || 'user@kpmbp.edu.my',
    targetId: credId,
    targetType: 'CREDENTIAL',
    action: 'ENROLL_CREDENTIAL',
    newStatus: 'ACTIVE',
    result: 'SUCCESS',
    details: `Kredensial digital didaftarkan ke Keystore perkakasan.`,
  });

  const response = {
    success: true,
    credentialId: credId,
    status: 'ACTIVE',
    deviceId,
    message: 'Kredensial berjaya didaftarkan ke Keystore perkakasan.',
  };

  await completeFunctionIdempotency(idempotencyKey, response);
  return response;
});

/**
 * 13. revokeAndReplaceCredential (onCall)
 */
export const revokeAndReplaceCredential = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Pengesahan identiti diperlukan.');
  }

  const { deviceId, reason, reportLost, idempotencyKey } = data;
  const idemp = await checkFunctionIdempotency(idempotencyKey, context.auth.uid, 'revokeAndReplaceCredential');
  if (idemp.isDuplicate) return idemp.cachedResponse;

  const batch = db.batch();
  if (deviceId) {
    const devRef = db.collection('devices').doc(deviceId);
    batch.update(devRef, {
      status: 'REVOKED',
      lostReported: !!reportLost,
      revokedReason: reason || 'Laporan kehilangan peranti oleh staf',
      updatedAt: new Date().toISOString(),
    });
  } else {
    const userDevices = await db.collection('devices').where('userId', '==', context.auth.uid).get();
    userDevices.forEach((d) => {
      batch.update(d.ref, {
        status: 'REVOKED',
        lostReported: !!reportLost,
        revokedReason: reason || 'Pembatalan kredensial dan peranti oleh staf',
        updatedAt: new Date().toISOString(),
      });
    });
  }

  const userRef = db.collection('users').doc(context.auth.uid);
  batch.update(userRef, {
    activeDeviceId: FieldValue.delete(),
    updatedAt: new Date().toISOString(),
  });

  const credId = `cred-${context.auth.uid}`;
  const credRef = db.collection('credentials').doc(credId);
  const credSnap = await credRef.get();
  if (credSnap.exists) {
    batch.update(credRef, {
      status: 'REVOKED',
      revokedAt: new Date().toISOString(),
      revokedBy: context.auth.token.email || 'staf',
      revocationReason: reason || 'Laporan peranti hilang / penggantian',
      updatedAt: new Date().toISOString(),
    });
  }

  await batch.commit();

  await recordAuditLog({
    actorId: context.auth.uid,
    actorEmail: context.auth.token.email || 'user@kpmbp.edu.my',
    targetId: credId,
    targetType: 'CREDENTIAL',
    action: 'REVOKE_CREDENTIAL',
    newStatus: 'REVOKED',
    result: 'SUCCESS',
    details: 'Kredensial dan peranti dibatalkan untuk penggantian.',
  });

  const response = {
    success: true,
    message: 'Kredensial dan peranti lama telah dibatalkan dengan selamat.',
  };

  await completeFunctionIdempotency(idempotencyKey, response);
  return response;
});

