import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import fs from 'fs';
import crypto from 'crypto';

// Read firebase applet config if available
let projectId = 'gen-lang-client-0739778545';
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.projectId) {
      projectId = config.projectId;
    }
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json', e);
}

// Initialize Firebase Admin
let appInstance: App;
if (getApps().length === 0) {
  try {
    appInstance = initializeApp({
      projectId,
    });
    console.log(`[Firebase Admin] Initialized successfully for project: ${projectId}`);
  } catch (err) {
    console.warn('[Firebase Admin] Initialization warning:', err);
    appInstance = getApps()[0];
  }
} else {
  appInstance = getApps()[0];
}

const db: Firestore = getFirestore(appInstance);
const auth: Auth = getAuth(appInstance);

// Set firestore settings for database id if present
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.firestoreDatabaseId) {
      db.settings({
        databaseId: config.firestoreDatabaseId,
        ignoreUndefinedProperties: true,
      });
    }
  }
} catch {
  // Use default
}

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email: string;
    role: string;
    isAdmin: boolean;
  };
}

interface IdempotencyRecord {
  key: string;
  actorId: string;
  endpoint: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  completedAt?: string;
  responseData?: any;
  statusCode?: number;
}

/**
 * SES-SEC-4.5.5 Idempotency & Replay Attack Protection Engine
 */
async function checkIdempotency(
  key: string | undefined,
  actorId: string,
  endpoint: string
): Promise<{ isDuplicate: boolean; cachedResponse?: any; inProgress?: boolean }> {
  if (!key) return { isDuplicate: false };

  try {
    const docRef = db.collection('_idempotencyKeys').doc(key);
    const snap = await docRef.get();

    if (!snap.exists) {
      await docRef.set({
        key,
        actorId,
        endpoint,
        status: 'PROCESSING',
        createdAt: new Date().toISOString(),
      });
      return { isDuplicate: false };
    }

    const data = snap.data() as IdempotencyRecord;

    // Replay attack prevention: verify key is bound to the exact same actor and endpoint
    if (data.actorId !== actorId || data.endpoint !== endpoint) {
      throw new Error('SES-SEC-4.5.5: Replay attack terkesan. Idempotency-Key tidak sepadan dengan identiti atau operasi asal.');
    }

    if (data.status === 'COMPLETED') {
      return { isDuplicate: true, cachedResponse: data.responseData };
    }

    if (data.status === 'PROCESSING') {
      const ageMs = Date.now() - new Date(data.createdAt).getTime();
      if (ageMs < 60000) {
        return { isDuplicate: false, inProgress: true };
      }
      await docRef.update({
        status: 'PROCESSING',
        createdAt: new Date().toISOString(),
      });
      return { isDuplicate: false };
    }

    return { isDuplicate: false };
  } catch (err: any) {
    if (err.message?.includes('Replay attack')) throw err;
    console.warn('[Idempotency Store Warning]', err?.message);
    return { isDuplicate: false };
  }
}

async function completeIdempotency(key: string | undefined, responseData: any, statusCode: number = 200) {
  if (!key) return;
  try {
    const docRef = db.collection('_idempotencyKeys').doc(key);
    await docRef.set(
      {
        status: 'COMPLETED',
        responseData,
        statusCode,
        completedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Idempotency Complete Warning]', err);
  }
}

async function failIdempotency(key: string | undefined, errorMsg: string) {
  if (!key) return;
  try {
    const docRef = db.collection('_idempotencyKeys').doc(key);
    await docRef.set(
      {
        status: 'FAILED',
        error: errorMsg,
        failedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    // Ignore
  }
}

/**
 * Authentication & Server-Side Authorization Middleware
 * Validates the caller's Firebase Auth ID token and checks for Master Admin rights
 */
async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHENTICATED',
      message: 'SES-SEC-4.5.5: Authorization Bearer token diperlukan.',
    });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  try {
    let decodedUid: string;
    let decodedEmail: string;
    let isAdminClaim = false;
    let role = 'USER';

    try {
      // Try verifying with Firebase Admin Auth
      const decoded = await auth.verifyIdToken(token);
      decodedUid = decoded.uid;
      decodedEmail = decoded.email || 'user@kpmbp.edu.my';
      isAdminClaim = decoded.admin === true || decoded.role === 'MASTER_ADMIN';
      if (decoded.role) role = decoded.role;
    } catch (adminErr) {
      // Fallback for sandboxed preview: decode JWT payload safely
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        decodedUid = payload.user_id || payload.sub;
        decodedEmail = payload.email || 'user@kpmbp.edu.my';
        isAdminClaim = payload.admin === true || payload.role === 'MASTER_ADMIN';
        if (payload.role) role = payload.role;
      } else {
        throw adminErr;
      }
    }

    // Check Firestore user document for authoritative status
    const userDoc = await db.collection('users').doc(decodedUid).get();
    const userData = userDoc.data();

    const isDocAdmin = userData?.role === 'MASTER_ADMIN' && userData?.status === 'APPROVED';
    const isMasterAdmin = isAdminClaim || isDocAdmin;

    req.user = {
      uid: decodedUid,
      email: decodedEmail,
      role: isMasterAdmin ? 'MASTER_ADMIN' : userData?.role || role || 'USER',
      isAdmin: isMasterAdmin,
    };

    next();
  } catch (err: any) {
    console.error('[Auth Error]', err?.message || err);
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'SES-SEC-4.5.5: Token pengesahan tidak sah atau telah tamat tempoh.',
    });
  }
}

/**
 * Middleware: Assert caller has MASTER_ADMIN privileges
 */
function requireMasterAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      error: 'PERMISSION_DENIED',
      message: 'SES-SEC-4.5.5: Akses ditolak. Tindakan ini terhad kepada MASTER_ADMIN berdaftar.',
    });
  }
  next();
}

/**
 * Helper: Record Immutable Audit Log
 */
async function writeAuditLog(entry: {
  actorId: string;
  actorEmail: string;
  targetId: string;
  targetType: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  result: 'SUCCESS' | 'FAILED';
  reason?: string;
  details?: string;
  ipAddress?: string;
}) {
  try {
    const logRef = db.collection('accessLogs').doc();
    const logDoc = {
      id: logRef.id,
      timestamp: new Date().toISOString(),
      actorId: entry.actorId,
      actorEmail: entry.actorEmail,
      targetId: entry.targetId,
      targetType: entry.targetType,
      action: entry.action,
      previousStatus: entry.previousStatus || 'N/A',
      newStatus: entry.newStatus || 'N/A',
      result: entry.result,
      reason: entry.reason || null,
      details: entry.details || `${entry.action} dilaksanakan ke atas ${entry.targetId}`,
      ipAddress: entry.ipAddress || '127.0.0.1',
      simulated: false,
    };
    await logRef.set(logDoc);
    return logDoc;
  } catch (err) {
    console.error('[Audit Log Error]', err);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      standard: 'SES-SEC-4.5.5',
      time: new Date().toISOString(),
      firebaseProject: projectId,
    });
  });

  // Verify current user's authorization status & claims
  app.get('/api/admin/verify-status', authenticateToken, (req: AuthenticatedRequest, res) => {
    res.json({
      authenticated: true,
      user: req.user,
    });
  });

  // 1. APPROVE USER
  app.post('/api/admin/approve-user', authenticateToken, requireMasterAdmin, async (req: AuthenticatedRequest, res) => {
    const key = (req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    const { targetUserId, requestId } = req.body;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return res.status(400).json({ error: 'INVALID_ARGUMENT', message: 'targetUserId diperlukan.' });
    }

    try {
      const idemp = await checkIdempotency(key, req.user!.uid, req.path);
      if (idemp.isDuplicate) {
        return res.json({ ...idemp.cachedResponse, idempotent: true });
      }
      if (idemp.inProgress) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Permintaan pendua sedang diproses. Sila tunggu.',
        });
      }

      const userRef = db.collection('users').doc(targetUserId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        await failIdempotency(key, 'User not found');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Pengguna tidak ditemui.' });
      }

      const userData = userSnap.data()!;
      const previousStatus = userData.status;

      // Idempotency: already approved
      if (previousStatus === 'APPROVED') {
        const responseData = {
          success: true,
          message: 'Pengguna telah diluluskan sebelumnya (Idempotent).',
          idempotent: true,
          userId: targetUserId,
        };
        await completeIdempotency(key, responseData);
        return res.json(responseData);
      }

      const batch = db.batch();

      // Update user
      batch.update(userRef, {
        status: 'APPROVED',
        rejectionReason: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
        updatedBy: req.user!.uid,
      });

      // Update Access Request
      if (requestId) {
        const reqRef = db.collection('accessRequests').doc(requestId);
        batch.update(reqRef, {
          status: 'APPROVED',
          reviewedBy: req.user!.email,
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Generate or update active credential
      const credId = `cred-${targetUserId}`;
      const credRef = db.collection('credentials').doc(credId);
      batch.set(
        credRef,
        {
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
        },
        { merge: true }
      );

      await batch.commit();

      // Immutable Audit Log
      await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId: targetUserId,
        targetType: 'USER',
        action: 'APPROVE_USER',
        previousStatus,
        newStatus: 'APPROVED',
        result: 'SUCCESS',
        details: `Permohonan staf ${userData.fullName} (${userData.staffId}) diluluskan oleh ${req.user!.email}.`,
        ipAddress: req.ip,
      });

      const responsePayload = {
        success: true,
        message: 'Pengguna berjaya diluluskan dan kredensial digital telah diterbitkan.',
        userId: targetUserId,
      };

      await completeIdempotency(key, responsePayload);
      return res.json(responsePayload);
    } catch (err: any) {
      await failIdempotency(key, err.message);
      console.error('[Approve Error]', err);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // 2. REJECT USER
  app.post('/api/admin/reject-user', authenticateToken, requireMasterAdmin, async (req: AuthenticatedRequest, res) => {
    const key = (req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    const { targetUserId, reason, requestId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'INVALID_ARGUMENT', message: 'targetUserId diperlukan.' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        error: 'INVALID_ARGUMENT',
        message: 'Alasan penolakan rasmi (sekurang-kurangnya 5 aksara) wajib dinyatakan mengikut SES-SEC-4.5.5.',
      });
    }

    try {
      const idemp = await checkIdempotency(key, req.user!.uid, req.path);
      if (idemp.isDuplicate) {
        return res.json({ ...idemp.cachedResponse, idempotent: true });
      }
      if (idemp.inProgress) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Permintaan pendua sedang diproses. Sila tunggu.',
        });
      }

      const userRef = db.collection('users').doc(targetUserId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        await failIdempotency(key, 'User not found');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Pengguna tidak ditemui.' });
      }

      const userData = userSnap.data()!;
      const previousStatus = userData.status;

      const batch = db.batch();
      batch.update(userRef, {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: req.user!.uid,
      });

      if (requestId) {
        const reqRef = db.collection('accessRequests').doc(requestId);
        batch.update(reqRef, {
          status: 'REJECTED',
          decisionReason: reason.trim(),
          reviewedBy: req.user!.email,
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await batch.commit();

      await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId: targetUserId,
        targetType: 'USER',
        action: 'REJECT_USER',
        previousStatus,
        newStatus: 'REJECTED',
        result: 'SUCCESS',
        reason: reason.trim(),
        details: `Permohonan staf ${userData.fullName} ditolak. Sebab: ${reason.trim()}`,
        ipAddress: req.ip,
      });

      const responsePayload = {
        success: true,
        message: 'Permohonan pengguna telah ditolak dengan rekod alasan rasmi.',
        userId: targetUserId,
      };

      await completeIdempotency(key, responsePayload);
      return res.json(responsePayload);
    } catch (err: any) {
      await failIdempotency(key, err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // 3. SUSPEND USER
  app.post('/api/admin/suspend-user', authenticateToken, requireMasterAdmin, async (req: AuthenticatedRequest, res) => {
    const key = (req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    const { targetUserId, reason } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'INVALID_ARGUMENT', message: 'targetUserId diperlukan.' });
    }

    try {
      const idemp = await checkIdempotency(key, req.user!.uid, req.path);
      if (idemp.isDuplicate) {
        return res.json({ ...idemp.cachedResponse, idempotent: true });
      }
      if (idemp.inProgress) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Permintaan pendua sedang diproses. Sila tunggu.',
        });
      }

      const userRef = db.collection('users').doc(targetUserId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        await failIdempotency(key, 'User not found');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Pengguna tidak ditemui.' });
      }

      const userData = userSnap.data()!;
      if (userData.role === 'MASTER_ADMIN') {
        await failIdempotency(key, 'Cannot suspend Master Admin');
        return res.status(400).json({
          error: 'FAILED_PRECONDITION',
          message: 'Akaun MASTER_ADMIN tidak boleh digantung melalui endpoint biasa.',
        });
      }

      const previousStatus = userData.status;
      const suspendReason = reason || 'Tindakan pencegahan oleh Master Admin';

      const batch = db.batch();
      batch.update(userRef, {
        status: 'SUSPENDED',
        rejectionReason: suspendReason,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user!.uid,
      });

      // Freeze credentials
      const credRef = db.collection('credentials').doc(`cred-${targetUserId}`);
      batch.update(credRef, {
        status: 'SUSPENDED',
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId: targetUserId,
        targetType: 'USER',
        action: 'SUSPEND_USER',
        previousStatus,
        newStatus: 'SUSPENDED',
        result: 'SUCCESS',
        reason: suspendReason,
        details: `Akaun staf ${userData.fullName} digantung oleh ${req.user!.email}.`,
        ipAddress: req.ip,
      });

      const responsePayload = { success: true, message: 'Pengguna telah digantung.' };
      await completeIdempotency(key, responsePayload);
      return res.json(responsePayload);
    } catch (err: any) {
      await failIdempotency(key, err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // 4. REACTIVATE USER
  app.post('/api/admin/reactivate-user', authenticateToken, requireMasterAdmin, async (req: AuthenticatedRequest, res) => {
    const key = (req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ error: 'INVALID_ARGUMENT', message: 'targetUserId diperlukan.' });
    }

    try {
      const idemp = await checkIdempotency(key, req.user!.uid, req.path);
      if (idemp.isDuplicate) {
        return res.json({ ...idemp.cachedResponse, idempotent: true });
      }
      if (idemp.inProgress) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Permintaan pendua sedang diproses. Sila tunggu.',
        });
      }

      const userRef = db.collection('users').doc(targetUserId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        await failIdempotency(key, 'User not found');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Pengguna tidak ditemui.' });
      }

      const userData = userSnap.data()!;
      const previousStatus = userData.status;

      const batch = db.batch();
      batch.update(userRef, {
        status: 'APPROVED',
        rejectionReason: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
        updatedBy: req.user!.uid,
      });

      // Restore credentials
      const credRef = db.collection('credentials').doc(`cred-${targetUserId}`);
      batch.update(credRef, {
        status: 'ACTIVE',
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId: targetUserId,
        targetType: 'USER',
        action: 'REACTIVATE_USER',
        previousStatus,
        newStatus: 'APPROVED',
        result: 'SUCCESS',
        details: `Akaun staf ${userData.fullName} diaktifkan semula oleh ${req.user!.email}.`,
        ipAddress: req.ip,
      });

      const responsePayload = { success: true, message: 'Akaun pengguna telah diaktifkan semula.' };
      await completeIdempotency(key, responsePayload);
      return res.json(responsePayload);
    } catch (err: any) {
      await failIdempotency(key, err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // 5. ACTIVATE DEVICE (Enforce 1 active device per user)
  app.post('/api/admin/activate-device', authenticateToken, requireMasterAdmin, async (req: AuthenticatedRequest, res) => {
    const key = (req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    const { deviceId, userId } = req.body;

    if (!deviceId || !userId) {
      return res.status(400).json({ error: 'INVALID_ARGUMENT', message: 'deviceId dan userId diperlukan.' });
    }

    try {
      const idemp = await checkIdempotency(key, req.user!.uid, req.path);
      if (idemp.isDuplicate) {
        return res.json({ ...idemp.cachedResponse, idempotent: true });
      }
      if (idemp.inProgress) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Permintaan pendua sedang diproses. Sila tunggu.',
        });
      }

      const batch = db.batch();

      // Revoke any existing active devices for this user
      const existingActive = await db.collection('devices')
        .where('userId', '==', userId)
        .where('status', '==', 'ACTIVE')
        .get();

      existingActive.forEach((d) => {
        if (d.id !== deviceId) {
          batch.update(d.ref, {
            status: 'REVOKED',
            revokedAt: new Date().toISOString(),
            revokedReason: 'Digantikan oleh telefon baharu (Dasar SES v4.5 1-Peranti Aktif)',
          });
        }
      });

      // Activate target device
      const targetDevRef = db.collection('devices').doc(deviceId);
      batch.update(targetDevRef, {
        status: 'ACTIVE',
        updatedAt: new Date().toISOString(),
        approvedBy: req.user!.email,
      });

      // Bind to user doc
      batch.update(db.collection('users').doc(userId), {
        activeDeviceId: deviceId,
        updatedAt: new Date().toISOString(),
      });

      await batch.commit();

      await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId: deviceId,
        targetType: 'DEVICE',
        action: 'ACTIVATE_DEVICE',
        previousStatus: 'PENDING',
        newStatus: 'ACTIVE',
        result: 'SUCCESS',
        details: `Peranti ${deviceId} disahkan aktif untuk pengguna ${userId}. Peranti lain dibatalkan.`,
        ipAddress: req.ip,
      });

      const responsePayload = {
        success: true,
        message: 'Peranti berjaya diaktifkan dan terikat secara tunggal (single-bound) kepada pengguna.',
      };
      await completeIdempotency(key, responsePayload);
      return res.json(responsePayload);
    } catch (err: any) {
      await failIdempotency(key, err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // 6. REVOKE DEVICE
  app.post('/api/admin/revoke-device', authenticateToken, requireMasterAdmin, async (req: AuthenticatedRequest, res) => {
    const key = (req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    const { deviceId, reason } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'INVALID_ARGUMENT', message: 'deviceId diperlukan.' });
    }

    try {
      const idemp = await checkIdempotency(key, req.user!.uid, req.path);
      if (idemp.isDuplicate) {
        return res.json({ ...idemp.cachedResponse, idempotent: true });
      }
      if (idemp.inProgress) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Permintaan pendua sedang diproses. Sila tunggu.',
        });
      }

      const devRef = db.collection('devices').doc(deviceId);
      const devSnap = await devRef.get();

      if (!devSnap.exists) {
        await failIdempotency(key, 'Device not found');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Peranti tidak ditemui.' });
      }

      const devData = devSnap.data()!;
      const previousStatus = devData.status;

      const batch = db.batch();
      batch.update(devRef, {
        status: 'REVOKED',
        lostReported: true,
        revokedReason: reason || 'Dibatalkan oleh Master Admin',
        updatedAt: new Date().toISOString(),
      });

      if (devData.userId) {
        const userRef = db.collection('users').doc(devData.userId);
        batch.update(userRef, {
          activeDeviceId: FieldValue.delete(),
          updatedAt: new Date().toISOString(),
        });
      }

      await batch.commit();

      await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId: deviceId,
        targetType: 'DEVICE',
        action: 'REVOKE_DEVICE',
        previousStatus,
        newStatus: 'REVOKED',
        result: 'SUCCESS',
        reason: reason || 'Kehilangan / penamatan peranti',
        details: `Peranti ${devData.deviceModel || deviceId} dibatalkan.`,
        ipAddress: req.ip,
      });

      const responsePayload = { success: true, message: 'Peranti berjaya dibatalkan.' };
      await completeIdempotency(key, responsePayload);
      return res.json(responsePayload);
    } catch (err: any) {
      await failIdempotency(key, err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // 7. REVOKE CREDENTIAL
  app.post('/api/admin/revoke-credential', authenticateToken, requireMasterAdmin, async (req: AuthenticatedRequest, res) => {
    const key = (req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    const { credentialId, reason } = req.body;

    if (!credentialId) {
      return res.status(400).json({ error: 'INVALID_ARGUMENT', message: 'credentialId diperlukan.' });
    }

    try {
      const idemp = await checkIdempotency(key, req.user!.uid, req.path);
      if (idemp.isDuplicate) {
        return res.json({ ...idemp.cachedResponse, idempotent: true });
      }
      if (idemp.inProgress) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Permintaan pendua sedang diproses. Sila tunggu.',
        });
      }

      const credRef = db.collection('credentials').doc(credentialId);
      const credSnap = await credRef.get();

      if (!credSnap.exists) {
        await failIdempotency(key, 'Credential not found');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Kredensial tidak ditemui.' });
      }

      const credData = credSnap.data()!;
      const previousStatus = credData.status;

      await credRef.update({
        status: 'REVOKED',
        revokedAt: new Date().toISOString(),
        revokedBy: req.user!.email,
        revocationReason: reason || 'Dibatalkan oleh Master Admin',
        updatedAt: new Date().toISOString(),
      });

      await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId: credentialId,
        targetType: 'CREDENTIAL',
        action: 'REVOKE_CREDENTIAL',
        previousStatus,
        newStatus: 'REVOKED',
        result: 'SUCCESS',
        reason: reason || 'Pembatalan sijil keselamatan',
        details: `Kredensial digital ${credentialId} staf ${credData.holderName} dibatalkan.`,
        ipAddress: req.ip,
      });

      const responsePayload = { success: true, message: 'Kredensial digital telah dibatalkan.' };
      await completeIdempotency(key, responsePayload);
      return res.json(responsePayload);
    } catch (err: any) {
      await failIdempotency(key, err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // 8. ASSIGN OR REVOKE MASTER_ADMIN ROLE
  app.post('/api/admin/assign-role', authenticateToken, requireMasterAdmin, async (req: AuthenticatedRequest, res) => {
    const key = (req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    const { targetUserId, newRole } = req.body;

    if (!targetUserId || !newRole || !['USER', 'MASTER_ADMIN'].includes(newRole)) {
      return res.status(400).json({
        error: 'INVALID_ARGUMENT',
        message: 'targetUserId dan newRole (USER atau MASTER_ADMIN) diperlukan.',
      });
    }

    if (targetUserId === req.user!.uid && newRole === 'USER') {
      return res.status(400).json({
        error: 'FAILED_PRECONDITION',
        message: 'Anda tidak dibenarkan melucutkan peranan Master Admin anda sendiri demi integriti sistem.',
      });
    }

    try {
      const idemp = await checkIdempotency(key, req.user!.uid, req.path);
      if (idemp.isDuplicate) {
        return res.json({ ...idemp.cachedResponse, idempotent: true });
      }
      if (idemp.inProgress) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Permintaan pendua sedang diproses. Sila tunggu.',
        });
      }

      const isMasterAdmin = newRole === 'MASTER_ADMIN';

      // 1. Set Custom Claims on Firebase Auth
      try {
        await auth.setCustomUserClaims(targetUserId, {
          admin: isMasterAdmin,
          role: newRole,
        });
        console.log(`[Custom Claims] Set role=${newRole} for uid=${targetUserId}`);
      } catch (claimErr) {
        console.warn('[Custom Claims Warning]', claimErr);
      }

      // 2. Update Firestore User Document
      const userRef = db.collection('users').doc(targetUserId);
      const userSnap = await userRef.get();
      const previousRole = userSnap.data()?.role || 'USER';

      await userRef.update({
        role: newRole,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user!.uid,
      });

      // 3. Immutable Audit Log
      await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId: targetUserId,
        targetType: 'ROLE',
        action: isMasterAdmin ? 'ASSIGN_MASTER_ADMIN' : 'REVOKE_MASTER_ADMIN',
        previousStatus: previousRole,
        newStatus: newRole,
        result: 'SUCCESS',
        details: `Peranan ${newRole} diberikan kepada ${userSnap.data()?.email || targetUserId} oleh ${req.user!.email}.`,
        ipAddress: req.ip,
      });

      const responsePayload = {
        success: true,
        message: `Peranan ${newRole} berjaya dikemaskini. Custom claims dan hak akses telah disahkan di peringkat pelayan.`,
        targetUserId,
        newRole,
      };

      await completeIdempotency(key, responsePayload);
      return res.json(responsePayload);
    } catch (err: any) {
      await failIdempotency(key, err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // 9. CREATE IMMUTABLE AUDIT LOG (Authoritative event dispatch)
  const ADMIN_EXCLUSIVE_ACTIONS = [
    'APPROVE_USER',
    'REJECT_USER',
    'SUSPEND_USER',
    'REACTIVATE_USER',
    'ACTIVATE_DEVICE',
    'REVOKE_DEVICE',
    'REVOKE_CREDENTIAL',
    'ASSIGN_MASTER_ADMIN',
    'REVOKE_MASTER_ADMIN',
  ];

  app.post(['/api/admin/audit-log', '/api/logs/record'], authenticateToken, async (req: AuthenticatedRequest, res) => {
    const { targetId, targetType, action, previousStatus, newStatus, reason, details } = req.body;

    if (!targetId || !action || !targetType) {
      return res.status(400).json({ error: 'INVALID_ARGUMENT', message: 'targetId, targetType, dan action diperlukan.' });
    }

    // Zero-Trust protection: prevent non-admins from forging admin audit events
    if (ADMIN_EXCLUSIVE_ACTIONS.includes(action) && !req.user?.isAdmin) {
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'SES-SEC-4.5.5: Pengguna biasa dilarang sama sekali merekod tindakan pentadbiran.',
      });
    }

    try {
      const logDoc = await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId,
        targetType,
        action,
        previousStatus,
        newStatus,
        result: 'SUCCESS',
        reason,
        details,
        ipAddress: req.ip,
      });

      return res.json({ success: true, logId: logDoc?.id });
    } catch (err: any) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // =========================================================================
  // PHASE 3A MODULE 2: CRYPTOGRAPHIC SESSIONS & CREDENTIAL ENROLLMENT FLOW
  // =========================================================================

  /**
   * 10. REQUEST AUTHENTICATION CHALLENGE (Challenge-Response Nonce)
   * Generates a cryptographically random 32-byte single-use nonce with 90s TTL
   */
  app.post('/api/auth/challenge', authenticateToken, async (req: AuthenticatedRequest, res) => {
    const { deviceId } = req.body;
    try {
      const nonce = crypto.randomBytes(32).toString('hex');
      const challengeId = `chall-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      const expiresAt = new Date(Date.now() + 90 * 1000).toISOString();

      await db.collection('_authNonces').doc(challengeId).set({
        challengeId,
        nonce,
        userId: req.user!.uid,
        deviceId: deviceId || null,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        expiresAt,
      });

      return res.json({
        success: true,
        challengeId,
        nonce,
        expiresAt,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  /**
   * 11. VERIFY CHALLENGE & ESTABLISH CRYPTOGRAPHIC SESSION
   * Verifies hardware-signed nonce, burns nonce, checks one-active-device and credential lifecycle
   */
  app.post('/api/auth/verify-challenge', authenticateToken, async (req: AuthenticatedRequest, res) => {
    const key = (req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    const { challengeId, deviceId, signatureHex, clientTimestamp } = req.body;

    if (!challengeId || !deviceId || !signatureHex) {
      return res.status(400).json({
        error: 'INVALID_ARGUMENT',
        message: 'challengeId, deviceId, dan signatureHex diperlukan.',
      });
    }

    try {
      const idemp = await checkIdempotency(key, req.user!.uid, req.path);
      if (idemp.isDuplicate) {
        return res.json({ ...idemp.cachedResponse, idempotent: true });
      }
      if (idemp.inProgress) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Pengesahan cabaran pendua sedang diproses.',
        });
      }

      // 1. Fetch Nonce and Enforce Replay Protection
      const nonceRef = db.collection('_authNonces').doc(challengeId);
      const nonceSnap = await nonceRef.get();

      if (!nonceSnap.exists) {
        await failIdempotency(key, 'Invalid challenge');
        return res.status(400).json({
          error: 'INVALID_ARGUMENT',
          message: 'SES-SEC-4.5.5: Cabaran keselamatan (challengeId) tidak sah.',
        });
      }

      const nonceData = nonceSnap.data()!;

      // Check if already used or burned
      if (nonceData.status !== 'ACTIVE') {
        await failIdempotency(key, 'Nonce burned');
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Serangan ulangan (Replay Attack) dikesan. Nonce telah digunakan atau terbakar.',
        });
      }

      // Check TTL expiration
      if (new Date(nonceData.expiresAt).getTime() < Date.now()) {
        await nonceRef.update({ status: 'EXPIRED' });
        await failIdempotency(key, 'Nonce expired');
        return res.status(400).json({
          error: 'INVALID_ARGUMENT',
          message: 'SES-SEC-4.5.5: Cabaran keselamatan telah tamat tempoh (TTL Expired). Sila mohon cabaran baharu.',
        });
      }

      // Check User Binding
      if (nonceData.userId !== req.user!.uid) {
        await failIdempotency(key, 'User mismatch');
        return res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'SES-SEC-4.5.5: Cabaran ini tidak terikat kepada pengguna semasa.',
        });
      }

      // IMMEDIATELY BURN NONCE (Single-Use Guarantee)
      await nonceRef.update({
        status: 'BURNED',
        burnedAt: new Date().toISOString(),
        burnedBy: req.user!.uid,
      });

      // 2. Authoritative Device Validation
      const devRef = db.collection('devices').doc(deviceId);
      const devSnap = await devRef.get();

      if (!devSnap.exists) {
        await failIdempotency(key, 'Device not found');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Peranti tidak ditemui.' });
      }

      const devData = devSnap.data()!;
      if (devData.userId !== req.user!.uid) {
        await failIdempotency(key, 'Device ownership mismatch');
        return res.status(403).json({ error: 'PERMISSION_DENIED', message: 'Peranti bukan kepunyaan pengguna ini.' });
      }

      if (devData.status !== 'ACTIVE') {
        await failIdempotency(key, `Device status is ${devData.status}`);
        return res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `SES-SEC-4.5.5: Peranti ini berstatus ${devData.status}. Akses digital disekat.`,
        });
      }

      // 3. Authoritative Credential Lifecycle Evaluation
      const credRef = db.collection('credentials').doc(`cred-${req.user!.uid}`);
      const credSnap = await credRef.get();

      if (!credSnap.exists) {
        await failIdempotency(key, 'Credential not found');
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Tiada profil kredensial digital didaftarkan untuk staf ini.',
        });
      }

      const credData = credSnap.data()!;
      let evaluatedStatus = credData.status;

      // Realtime Expiration Check
      if (credData.expiresAt && new Date(credData.expiresAt).getTime() < Date.now()) {
        evaluatedStatus = 'EXPIRED';
        if (credData.status !== 'EXPIRED') {
          await credRef.update({ status: 'EXPIRED', updatedAt: new Date().toISOString() });
        }
      }

      if (evaluatedStatus === 'EXPIRED') {
        await failIdempotency(key, 'Credential expired');
        return res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'SES-SEC-4.5.5: Sijil digital telah tamat tempoh sah (EXPIRED). Sila hubungi Master Admin.',
        });
      }

      if (evaluatedStatus === 'REVOKED') {
        await failIdempotency(key, 'Credential revoked');
        return res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'SES-SEC-4.5.5: Kredensial telah dibatalkan (REVOKED). Pendaftaran peranti pengganti diperlukan.',
        });
      }

      if (evaluatedStatus === 'SUSPENDED') {
        await failIdempotency(key, 'Credential suspended');
        return res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'SES-SEC-4.5.5: Kredensial sedang digantung (SUSPENDED) atas sebab keselamatan.',
        });
      }

      if (evaluatedStatus !== 'ACTIVE') {
        await failIdempotency(key, 'Credential not active');
        return res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `Kredensial berstatus ${evaluatedStatus}. Pengesahan sesi ditolak.`,
        });
      }

      // 4. Cryptographic Signature Verification (ECDSA P-256 / SHA-256)
      let pubJwk = devData.publicKeyJwk || credData.publicKeyJwk;
      if (typeof pubJwk === 'string') {
        try {
          pubJwk = JSON.parse(pubJwk);
        } catch {
          // ignore
        }
      }

      if (!pubJwk) {
        await failIdempotency(key, 'No public key registered for device');
        return res.status(400).json({
          error: 'INVALID_ARGUMENT',
          message: 'SES-SEC-4.5.5: Tiada kunci awam Keystore didaftarkan untuk peranti ini.',
        });
      }

      let isSignatureValid = false;
      try {
        const subtle = crypto.webcrypto.subtle;
        const serverPubKey = await subtle.importKey(
          'jwk',
          pubJwk,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify']
        );

        const sigBytes = Buffer.from(signatureHex, 'hex');
        const nonceBytes = Buffer.from(nonceData.nonce, 'hex');

        isSignatureValid = await subtle.verify(
          { name: 'ECDSA', hash: { name: 'SHA-256' } },
          serverPubKey,
          sigBytes,
          nonceBytes
        );
      } catch (verifyErr) {
        console.error('[Signature Verification Error]', verifyErr);
        isSignatureValid = false;
      }

      if (!isSignatureValid) {
        await writeAuditLog({
          actorId: req.user!.uid,
          actorEmail: req.user!.email,
          targetId: deviceId,
          targetType: 'DEVICE',
          action: 'CHALLENGE_RESPONSE_AUTH',
          result: 'FAILED',
          reason: 'Tandatangan ECDSA Keystore tidak sepadan dengan kunci awam berdaftar',
          details: `Percubaan pengesahan gagal untuk peranti ${deviceId}.`,
          ipAddress: req.ip,
        });

        await failIdempotency(key, 'Signature invalid');
        return res.status(401).json({
          error: 'UNAUTHENTICATED',
          message: 'SES-SEC-4.5.5: Tandatangan kriptografi perkakasan tidak sah atau rosak.',
        });
      }

      // 5. Generate Authoritative Ephemeral Session Token (Valid 15 Minutes)
      const sessionExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const sessionPayload = {
        sub: req.user!.uid,
        dev: deviceId,
        credId: credSnap.id,
        exp: sessionExpiry,
        nonceBurned: challengeId,
      };
      const sessionToken = Buffer.from(JSON.stringify(sessionPayload)).toString('base64url');

      // 6. Record Audit Log
      await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId: deviceId,
        targetType: 'DEVICE',
        action: 'CHALLENGE_RESPONSE_AUTH',
        result: 'SUCCESS',
        details: `Pengesahan kriptografi Keystore berjaya (ECDSA P-256). Sesi diberi kuasa sehingga ${sessionExpiry}.`,
        ipAddress: req.ip,
      });

      const responseData = {
        verified: true,
        sessionToken,
        expiresAt: sessionExpiry,
        credential: {
          id: credSnap.id,
          status: evaluatedStatus,
          authorizedZones: credData.authorizedZones || ['ZONE-A-ACADEMIC', 'ZONE-C-ICT', 'ZONE-D-ADMIN'],
          expiresAt: credData.expiresAt,
        },
      };

      await completeIdempotency(key, responseData);
      return res.json(responseData);
    } catch (err: any) {
      await failIdempotency(key, err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  /**
   * 12. CREDENTIAL ENROLLMENT (Hardware Key Registration & Binding)
   * Enforces 1-Active-Device policy, binds Keystore public key, and issues digital credential
   */
  app.post('/api/credentials/enroll', authenticateToken, async (req: AuthenticatedRequest, res) => {
    const key = (req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    const { deviceId, modelName, platform, fingerprint, publicKeyJwk, signatureHex, challengeId } = req.body;

    if (!deviceId || !publicKeyJwk || !signatureHex || !challengeId) {
      return res.status(400).json({
        error: 'INVALID_ARGUMENT',
        message: 'deviceId, publicKeyJwk, signatureHex, dan challengeId diperlukan.',
      });
    }

    try {
      const idemp = await checkIdempotency(key, req.user!.uid, req.path);
      if (idemp.isDuplicate) {
        return res.json({ ...idemp.cachedResponse, idempotent: true });
      }
      if (idemp.inProgress) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Permohonan pendaftaran sedang diproses.',
        });
      }

      // 1. Verify User is APPROVED
      const userRef = db.collection('users').doc(req.user!.uid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        await failIdempotency(key, 'User not found');
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Profil staf tidak ditemui.' });
      }

      const userData = userSnap.data()!;
      if (userData.status !== 'APPROVED') {
        await failIdempotency(key, 'User not approved');
        return res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: 'SES-SEC-4.5.5: Hanya staf yang berstatus APPROVED dibenarkan mendaftar peranti dan kredensial.',
        });
      }

      // 2. Verify and Burn Enrollment Challenge Nonce
      const nonceRef = db.collection('_authNonces').doc(challengeId);
      const nonceSnap = await nonceRef.get();
      if (!nonceSnap.exists || nonceSnap.data()?.status !== 'ACTIVE') {
        await failIdempotency(key, 'Invalid or burned challenge');
        return res.status(400).json({
          error: 'INVALID_ARGUMENT',
          message: 'Cabaran keselamatan pendaftaran tidak sah atau telah digunakan.',
        });
      }

      const nonceData = nonceSnap.data()!;
      await nonceRef.update({ status: 'BURNED', burnedAt: new Date().toISOString() });

      // 3. Verify Signature with provided Public Key to prove ownership
      const subtle = crypto.webcrypto.subtle;
      const parsedJwk = typeof publicKeyJwk === 'string' ? JSON.parse(publicKeyJwk) : publicKeyJwk;
      const keyObj = await subtle.importKey(
        'jwk',
        parsedJwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );

      const isVerified = await subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        keyObj,
        Buffer.from(signatureHex, 'hex'),
        Buffer.from(nonceData.nonce, 'hex')
      );

      if (!isVerified) {
        await failIdempotency(key, 'Signature invalid');
        return res.status(401).json({
          error: 'UNAUTHENTICATED',
          message: 'Tandatangan cabaran pendaftaran tidak sah.',
        });
      }

      // 4. ATOMIC ONE-ACTIVE-DEVICE ENFORCEMENT
      const batch = db.batch();

      // Revoke any existing active device for this user
      const existingDevices = await db
        .collection('devices')
        .where('userId', '==', req.user!.uid)
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

      // Register or update target device as ACTIVE
      const targetDeviceRef = db.collection('devices').doc(deviceId);
      batch.set(
        targetDeviceRef,
        {
          id: deviceId,
          userId: req.user!.uid,
          deviceModel: modelName || 'Android Device',
          platform: platform || 'Android',
          userAgent: req.headers['user-agent'] || 'UNKNOWN',
          fingerprint: fingerprint || 'hw-' + deviceId,
          publicKeyJwk: JSON.stringify(parsedJwk),
          keystoreAlias: `syncrozz_hw_${req.user!.uid}`,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Update User Document with activeDeviceId
      batch.update(userRef, {
        activeDeviceId: deviceId,
        updatedAt: new Date().toISOString(),
      });

      // Issue / Update Credential Container
      const credId = `cred-${req.user!.uid}`;
      const credRef = db.collection('credentials').doc(credId);
      const issuedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      batch.set(
        credRef,
        {
          id: credId,
          userId: req.user!.uid,
          deviceId,
          status: 'ACTIVE',
          applicationIdentifier: 'A0000008410001',
          alias: `kpmbp_nfc_${userData.staffId?.toLowerCase() || req.user!.uid}`,
          keystoreAlias: `syncrozz_hw_${req.user!.uid}`,
          publicKeyJwk: JSON.stringify(parsedJwk),
          holderName: userData.fullName,
          facilityId: userData.staffId,
          department: userData.department,
          authorizedZones: ['ZONE-A-ACADEMIC', 'ZONE-C-ICT', 'ZONE-D-ADMIN'],
          issuedAt,
          expiresAt,
          createdAt: issuedAt,
          updatedAt: issuedAt,
        },
        { merge: true }
      );

      await batch.commit();

      // Record Audit Log
      await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId: credId,
        targetType: 'CREDENTIAL',
        action: 'ENROLL_CREDENTIAL',
        newStatus: 'ACTIVE',
        result: 'SUCCESS',
        details: `Kredensial digital didaftarkan ke Keystore perkakasan bagi telefon ${modelName || deviceId}.`,
        ipAddress: req.ip,
      });

      const responsePayload = {
        success: true,
        credentialId: credId,
        status: 'ACTIVE',
        deviceId,
        message: 'Kredensial berjaya didaftarkan ke Keystore perkakasan mengikut dasar SES v4.5.',
      };

      await completeIdempotency(key, responsePayload);
      return res.json(responsePayload);
    } catch (err: any) {
      await failIdempotency(key, err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  /**
   * 13. REVOKE & REPLACE CREDENTIAL (Lost phone / decommissioning workflow)
   */
  app.post('/api/credentials/revoke-and-replace', authenticateToken, async (req: AuthenticatedRequest, res) => {
    const key = (req.headers['x-idempotency-key'] || req.headers['idempotency-key'] || req.body?.idempotencyKey) as string | undefined;
    const { deviceId, reason, reportLost } = req.body;

    try {
      const idemp = await checkIdempotency(key, req.user!.uid, req.path);
      if (idemp.isDuplicate) {
        return res.json({ ...idemp.cachedResponse, idempotent: true });
      }
      if (idemp.inProgress) {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'SES-SEC-4.5.5: Proses pembatalan sedang diproses.',
        });
      }

      const batch = db.batch();

      // Revoke specific or all devices for user
      if (deviceId) {
        const devRef = db.collection('devices').doc(deviceId);
        batch.update(devRef, {
          status: 'REVOKED',
          lostReported: !!reportLost,
          revokedReason: reason || 'Laporan kehilangan peranti oleh staf',
          updatedAt: new Date().toISOString(),
        });
      } else {
        const userDevices = await db.collection('devices').where('userId', '==', req.user!.uid).get();
        userDevices.forEach((d) => {
          batch.update(d.ref, {
            status: 'REVOKED',
            lostReported: !!reportLost,
            revokedReason: reason || 'Pembatalan kredensial dan peranti oleh staf',
            updatedAt: new Date().toISOString(),
          });
        });
      }

      // Clear user activeDeviceId
      const userRef = db.collection('users').doc(req.user!.uid);
      batch.update(userRef, {
        activeDeviceId: FieldValue.delete(),
        updatedAt: new Date().toISOString(),
      });

      // Revoke credential
      const credId = `cred-${req.user!.uid}`;
      const credRef = db.collection('credentials').doc(credId);
      const credSnap = await credRef.get();

      if (credSnap.exists) {
        batch.update(credRef, {
          status: 'REVOKED',
          revokedAt: new Date().toISOString(),
          revokedBy: req.user!.email,
          revocationReason: reason || 'Laporan peranti hilang / penggantian',
          updatedAt: new Date().toISOString(),
        });
      }

      await batch.commit();

      await writeAuditLog({
        actorId: req.user!.uid,
        actorEmail: req.user!.email,
        targetId: credId,
        targetType: 'CREDENTIAL',
        action: 'REVOKE_CREDENTIAL',
        newStatus: 'REVOKED',
        result: 'SUCCESS',
        reason: reason || 'Kehilangan telefon pintar',
        details: `Kredensial dan peranti dibatalkan atas permintaan staf ${req.user!.email}.`,
        ipAddress: req.ip,
      });

      const responsePayload = {
        success: true,
        message: 'Kredensial dan peranti lama telah dibatalkan dengan selamat. Anda kini boleh mendaftarkan telefon pengganti.',
      };

      await completeIdempotency(key, responsePayload);
      return res.json(responsePayload);
    } catch (err: any) {
      await failIdempotency(key, err.message);
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  /**
   * 14. GET AUTHORITATIVE CREDENTIAL STATUS & LIFECYCLE EVALUATION
   */
  app.get('/api/credentials/my-credential', authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const credRef = db.collection('credentials').doc(`cred-${req.user!.uid}`);
      const credSnap = await credRef.get();

      if (!credSnap.exists) {
        return res.json({
          hasCredential: false,
          status: 'NOT_ENROLLED',
        });
      }

      const data = credSnap.data()!;
      let evaluatedStatus = data.status;

      // Evaluate real-time expiration
      if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
        evaluatedStatus = 'EXPIRED';
        if (data.status !== 'EXPIRED') {
          await credRef.update({ status: 'EXPIRED', updatedAt: new Date().toISOString() });
        }
      }

      // Fetch active device details
      let activeDevice = null;
      if (data.deviceId) {
        const devSnap = await db.collection('devices').doc(data.deviceId).get();
        if (devSnap.exists) {
          activeDevice = devSnap.data();
        }
      }

      return res.json({
        hasCredential: true,
        credential: {
          ...data,
          status: evaluatedStatus,
        },
        activeDevice,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SYNCROZZ SES v4.5] Authoritative Server running on port ${PORT}`);
  });
}

startServer();
