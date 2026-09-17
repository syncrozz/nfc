import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  getIdTokenResult,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  onSnapshot,
  orderBy,
  addDoc,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirebaseError } from './firebase';
import { AppUser, UserRole, UserStatus, RegisteredDevice, AccessRequest, AccessLogRecord } from '../types';
import { serverFunctions } from './functionsService';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  appUser: AppUser | null;
  isMasterAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  registerWithEmail: (data: {
    email: string;
    pass: string;
    fullName: string;
    staffId: string;
    department: string;
    phoneNumber: string;
  }) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  refreshToken: () => Promise<void>;
  submitDeviceRegistration: (modelName: string) => Promise<void>;
  reportDeviceLost: (deviceId: string) => Promise<void>;
  // Master Admin operations (SES-SEC-4.5.5 server-side authorization)
  adminApproveUser: (targetUserId: string, targetRequestId?: string) => Promise<void>;
  adminRejectUser: (targetUserId: string, reason: string, targetRequestId?: string) => Promise<void>;
  adminSuspendUser: (targetUserId: string, reason: string) => Promise<void>;
  adminReactivateUser: (targetUserId: string) => Promise<void>;
  adminActivateDevice: (deviceId: string, userId: string) => Promise<void>;
  adminRevokeDevice: (deviceId: string, reason?: string) => Promise<void>;
  adminRevokeCredential: (credentialId: string, reason?: string) => Promise<void>;
  adminAssignRole: (targetUserId: string, newRole: 'USER' | 'MASTER_ADMIN') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isMasterAdmin, setIsMasterAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Authoritative user profile fetcher
  const fetchUserProfile = async (user: FirebaseUser): Promise<AppUser | null> => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);

      // Verify custom claims
      const tokenResult = await getIdTokenResult(user, true);
      const hasAdminClaim =
        tokenResult.claims.admin === true ||
        tokenResult.claims.role === 'MASTER_ADMIN';

      if (snap.exists()) {
        const data = snap.data() as AppUser;
        const adminVerified = hasAdminClaim || (data.role === 'MASTER_ADMIN' && data.status === 'APPROVED');
        setIsMasterAdmin(adminVerified);
        return data;
      }
      return null;
    } catch (err) {
      console.error('[AuthContext] Failed to fetch user profile:', err);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsLoading(true);
      if (user) {
        setCurrentUser(user);
        const profile = await fetchUserProfile(user);
        setAppUser(profile);
      } else {
        setCurrentUser(null);
        setAppUser(null);
        setIsMasterAdmin(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserProfile = async () => {
    if (currentUser) {
      const profile = await fetchUserProfile(currentUser);
      setAppUser(profile);
    }
  };

  // 1. Register with Email (Mandatory: starts as PENDING, role USER)
  const registerWithEmail = async ({
    email,
    pass,
    fullName,
    staffId,
    department,
    phoneNumber,
  }: {
    email: string;
    pass: string;
    fullName: string;
    staffId: string;
    department: string;
    phoneNumber: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const uid = cred.user.uid;
      const nowIso = new Date().toISOString();

      const newUserData: AppUser = {
        id: uid,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        staffId: staffId.trim().toUpperCase(),
        department: department.trim(),
        phoneNumber: phoneNumber.trim(),
        role: 'USER', // Strict default: cannot self-assign MASTER_ADMIN
        status: 'PENDING', // Strict default: cannot self-approve
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: uid,
      };

      // 1. Create User Document
      await setDoc(doc(db, 'users', uid), newUserData);

      // 2. Create AccessRequest Document
      const accessReqRef = doc(collection(db, 'accessRequests'));
      const reqData: AccessRequest = {
        id: accessReqRef.id,
        userId: uid,
        fullName: newUserData.fullName,
        email: newUserData.email,
        staffId: newUserData.staffId,
        department: newUserData.department,
        requestedZones: ['ZONE_GENERAL_ACADEMIC', 'ZONE_LIBRARY'],
        status: 'PENDING',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await setDoc(accessReqRef, reqData);

      // 3. Register current browser/mobile device
      const deviceRef = doc(collection(db, 'devices'));
      const deviceData: RegisteredDevice = {
        id: deviceRef.id,
        userId: uid,
        deviceModel: navigator.userAgent.includes('Android') ? 'Android Mobile' : navigator.platform || 'Client Device',
        platform: navigator.platform || 'Web/Mobile',
        userAgent: navigator.userAgent.slice(0, 100),
        fingerprint: `DEV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        status: 'PENDING',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await setDoc(deviceRef, deviceData);

      // 4. Log Audit Record via Server
      try {
        await serverFunctions.createAuditLog({
          targetType: 'USER',
          targetId: uid,
          action: 'USER_REGISTRATION_SUBMITTED',
          details: `Permohonan pendaftaran staf KPMBP (${newUserData.staffId}) dihantar. Menunggu kelulusan Master Admin.`,
        });
      } catch (logErr) {
        console.warn('[Audit Log] Failed to record registration audit on server:', logErr);
      }

      setAppUser(newUserData);
    } catch (err) {
      const msg = handleFirebaseError(err, 'Pendaftaran Pengguna');
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Login with Email
  const loginWithEmail = async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const profile = await fetchUserProfile(cred.user);
      setAppUser(profile);

      // Log login audit
      if (profile) {
        try {
          await serverFunctions.createAuditLog({
            targetType: 'USER',
            targetId: cred.user.uid,
            action: 'USER_LOGIN_SUCCESS',
            details: `Log masuk berjaya. Status akaun: ${profile.status}`,
          });
        } catch (logErr) {
          console.warn('[Audit Log] Failed to log login event:', logErr);
        }
      }
    } catch (err) {
      const msg = handleFirebaseError(err, 'Log Masuk Email');
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Login with Google
  const loginWithGoogle = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const uid = cred.user.uid;
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        // Create initial pending profile
        const nowIso = new Date().toISOString();
        const newUserData: AppUser = {
          id: uid,
          fullName: cred.user.displayName || 'Staf KPMBP',
          email: (cred.user.email || '').toLowerCase(),
          staffId: 'STAFF-PENDING',
          department: 'Akademik / Pengurusan',
          phoneNumber: cred.user.phoneNumber || '-',
          role: 'USER',
          status: 'PENDING',
          createdAt: nowIso,
          updatedAt: nowIso,
          createdBy: uid,
        };
        await setDoc(userRef, newUserData);

        // Auto create access request
        const accessReqRef = doc(collection(db, 'accessRequests'));
        await setDoc(accessReqRef, {
          id: accessReqRef.id,
          userId: uid,
          fullName: newUserData.fullName,
          email: newUserData.email,
          staffId: newUserData.staffId,
          department: newUserData.department,
          requestedZones: ['ZONE_GENERAL_ACADEMIC', 'ZONE_LIBRARY'],
          status: 'PENDING',
          createdAt: nowIso,
          updatedAt: nowIso,
        });

        setAppUser(newUserData);
      } else {
        const profile = await fetchUserProfile(cred.user);
        setAppUser(profile);
      }
    } catch (err) {
      const msg = handleFirebaseError(err, 'Log Masuk Google');
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Logout
  const logout = async () => {
    setIsLoading(true);
    try {
      if (currentUser && appUser) {
        try {
          await serverFunctions.createAuditLog({
            targetType: 'USER',
            targetId: currentUser.uid,
            action: 'USER_LOGOUT',
            details: 'Sesi tamat / log keluar pengguna.',
          });
        } catch (logErr) {
          console.warn('[Audit Log] Failed to log logout event:', logErr);
        }
      }
      await fbSignOut(auth);
      setCurrentUser(null);
      setAppUser(null);
      setIsMasterAdmin(false);
    } catch (err) {
      console.error('[AuthContext] Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Submit Device Registration
  const submitDeviceRegistration = async (modelName: string) => {
    if (!currentUser || !appUser) return;
    try {
      const nowIso = new Date().toISOString();
      const devRef = doc(collection(db, 'devices'));
      const newDev: RegisteredDevice = {
        id: devRef.id,
        userId: currentUser.uid,
        deviceModel: modelName,
        platform: navigator.platform || 'Mobile Phone',
        userAgent: navigator.userAgent.slice(0, 100),
        fingerprint: `DEV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        status: 'PENDING',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await setDoc(devRef, newDev);

      try {
        await serverFunctions.createAuditLog({
          targetType: 'DEVICE',
          targetId: devRef.id,
          action: 'DEVICE_REGISTRATION_SUBMITTED',
          details: `Pendaftaran peranti baharu [${modelName}]. Menunggu kelulusan pentadbir.`,
        });
      } catch (logErr) {
        console.warn('[Audit Log] Failed to record device registration audit:', logErr);
      }
    } catch (err) {
      throw err;
    }
  };

  // 6. Report Device Lost
  const reportDeviceLost = async (deviceId: string) => {
    if (!currentUser) return;
    try {
      const nowIso = new Date().toISOString();
      const devRef = doc(db, 'devices', deviceId);
      await updateDoc(devRef, {
        status: 'REVOKED',
        lostReported: true,
        updatedAt: nowIso,
      });

      try {
        await serverFunctions.createAuditLog({
          targetType: 'DEVICE',
          targetId: deviceId,
          action: 'DEVICE_LOST_REPORTED',
          details: `Laporan peranti hilang diterima. Peranti dibatalkan (REVOKED) serta-merta mengikut SES-SEC-4.5.5.`,
        });
      } catch (logErr) {
        console.warn('[Audit Log] Failed to record device lost audit:', logErr);
      }
    } catch (err) {
      throw err;
    }
  };

  // 7. Force token refresh
  const refreshToken = async () => {
    if (currentUser) {
      await currentUser.getIdToken(true);
      const profile = await fetchUserProfile(currentUser);
      setAppUser(profile);
    }
  };

  // 8. MASTER ADMIN OPERATIONS (SES-SEC-4.5.5 Server-Side Authorization & Idempotency)
  const adminApproveUser = async (targetUserId: string, targetRequestId?: string) => {
    if (!currentUser || !isMasterAdmin) {
      throw new Error('SES-SEC-4.5.5: Hanya Master Admin yang dibenarkan meluluskan akaun.');
    }
    await serverFunctions.approveUser(targetUserId, targetRequestId);
  };

  const adminRejectUser = async (targetUserId: string, reason: string, targetRequestId?: string) => {
    if (!currentUser || !isMasterAdmin) {
      throw new Error('SES-SEC-4.5.5: Hanya Master Admin yang dibenarkan menolak akaun.');
    }
    if (!reason || reason.trim().length < 5) {
      throw new Error('SES-SEC-4.5.5: Alasan penolakan rasmi (minimum 5 aksara) wajib dinyatakan.');
    }
    await serverFunctions.rejectUser(targetUserId, reason.trim(), targetRequestId);
  };

  const adminSuspendUser = async (targetUserId: string, reason: string) => {
    if (!currentUser || !isMasterAdmin) {
      throw new Error('SES-SEC-4.5.5: Hanya Master Admin yang dibenarkan menggantung akaun.');
    }
    await serverFunctions.suspendUser(targetUserId, reason);
  };

  const adminReactivateUser = async (targetUserId: string) => {
    if (!currentUser || !isMasterAdmin) {
      throw new Error('SES-SEC-4.5.5: Hanya Master Admin yang dibenarkan mengaktifkan semula akaun.');
    }
    await serverFunctions.reactivateUser(targetUserId);
  };

  const adminActivateDevice = async (deviceId: string, userId: string) => {
    if (!currentUser || !isMasterAdmin) {
      throw new Error('SES-SEC-4.5.5: Hanya Master Admin yang dibenarkan mengaktifkan peranti.');
    }
    await serverFunctions.activateDevice(deviceId, userId);
  };

  const adminRevokeDevice = async (deviceId: string, reason?: string) => {
    if (!currentUser || !isMasterAdmin) {
      throw new Error('SES-SEC-4.5.5: Hanya Master Admin yang dibenarkan membatalkan peranti.');
    }
    await serverFunctions.revokeDevice(deviceId, reason);
  };

  const adminRevokeCredential = async (credentialId: string, reason?: string) => {
    if (!currentUser || !isMasterAdmin) {
      throw new Error('SES-SEC-4.5.5: Hanya Master Admin yang dibenarkan membatalkan kredensial.');
    }
    await serverFunctions.revokeCredential(credentialId, reason);
  };

  const adminAssignRole = async (targetUserId: string, newRole: 'USER' | 'MASTER_ADMIN') => {
    if (!currentUser || !isMasterAdmin) {
      throw new Error('SES-SEC-4.5.5: Hanya Master Admin yang dibenarkan mengubah peranan pengguna.');
    }
    await serverFunctions.assignRole(targetUserId, newRole);
    if (currentUser.uid === targetUserId) {
      await currentUser.getIdToken(true);
      await refreshUserProfile();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        appUser,
        isMasterAdmin,
        isLoading,
        error,
        clearError,
        registerWithEmail,
        loginWithEmail,
        loginWithGoogle,
        logout,
        refreshUserProfile,
        refreshToken,
        submitDeviceRegistration,
        reportDeviceLost,
        adminApproveUser,
        adminRejectUser,
        adminSuspendUser,
        adminReactivateUser,
        adminActivateDevice,
        adminRevokeDevice,
        adminRevokeCredential,
        adminAssignRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
