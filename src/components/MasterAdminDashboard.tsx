import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  Smartphone,
  History,
  FileText,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Key,
  ShieldCheck,
  UserPlus,
  Lock,
  Eye,
  User,
  Building,
  Phone,
  Mail,
  UserMinus,
  DoorClosed,
  Plus,
  Edit3,
  Power,
  Sliders,
  Radio,
  Layers,
  MapPin,
  Users,
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppUser, AccessRequest, RegisteredDevice, AccessLogRecord, IssuedCredential, Door, DoorOperationalStatus } from '../types';
import { serverFunctions } from '../services/functionsService';
import { CampusZoneManagement } from './CampusZoneManagement';
import { AccessGroupManagement } from './AccessGroupManagement';

export const MasterAdminDashboard: React.FC = () => {
  const {
    isMasterAdmin,
    adminApproveUser,
    adminRejectUser,
    adminSuspendUser,
    adminReactivateUser,
    adminDeactivateUser,
    adminActivateDevice,
    adminRevokeDevice,
    adminRevokeCredential,
    adminAssignRole,
    bootstrapFirstMasterAdmin,
    masterAdminExists,
    checkBootstrapStatus,
    currentUser,
  } = useAuth();

  const [activeSection, setActiveSection] = useState<'requests' | 'users' | 'doors' | 'zones' | 'access-groups' | 'devices' | 'credentials' | 'logs'>('requests');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [credentials, setCredentials] = useState<IssuedCredential[]>([]);
  const [logs, setLogs] = useState<AccessLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Door search & filter state
  const [doorSearchTerm, setDoorSearchTerm] = useState('');
  const [doorBuildingFilter, setDoorBuildingFilter] = useState<string>('ALL');
  const [doorStatusFilter, setDoorStatusFilter] = useState<string>('ALL');

  // Door modals
  const [doorModalOpen, setDoorModalOpen] = useState(false);
  const [editingDoor, setEditingDoor] = useState<Door | null>(null);
  const [doorFormId, setDoorFormId] = useState('');
  const [doorFormName, setDoorFormName] = useState('');
  const [doorFormBuilding, setDoorFormBuilding] = useState('Bangunan Akademik A');
  const [doorFormFloor, setDoorFormFloor] = useState('Aras Bawah');
  const [doorFormLocation, setDoorFormLocation] = useState('');
  const [doorFormZoneId, setDoorFormZoneId] = useState('ZONE-ACADEMIC');
  const [doorFormZoneName, setDoorFormZoneName] = useState('Zon Akademik');
  const [doorFormReaderType, setDoorFormReaderType] = useState('ISO/IEC 14443-4 HCE APDU');
  const [doorFormControllerType, setDoorFormControllerType] = useState('Syncrozz IP-Controller v4.5');
  const [doorFormStatus, setDoorFormStatus] = useState<DoorOperationalStatus>('ACTIVE');
  const [doorSubmitting, setDoorSubmitting] = useState(false);

  // Door status toggle modal
  const [doorToggleModalOpen, setDoorToggleModalOpen] = useState(false);
  const [selectedDoorForToggle, setSelectedDoorForToggle] = useState<Door | null>(null);
  const [targetDoorStatus, setTargetDoorStatus] = useState<DoorOperationalStatus>('INACTIVE');
  const [doorToggleReason, setDoorToggleReason] = useState('Penyelenggaraan berkala atau kawalan akses keselamatan.');

  // Door audit history modal
  const [doorAuditModalOpen, setDoorAuditModalOpen] = useState(false);
  const [selectedDoorForAudit, setSelectedDoorForAudit] = useState<Door | null>(null);
  const [doorAuditLogs, setDoorAuditLogs] = useState<any[]>([]);
  const [loadingDoorAudit, setLoadingDoorAudit] = useState(false);

  // User search & filtering
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');

  // User profile modal
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<AppUser | null>(null);

  // Deactivate modal
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [selectedUserToDeactivate, setSelectedUserToDeactivate] = useState<AppUser | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('Nyahaktifkan akaun rasmi staf oleh Master Admin.');

  // Bootstrap state
  const [bootstrapping, setBootstrapping] = useState(false);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<AccessRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('Maklumat staf tidak sepadan dengan rekod rasmi KPMBP.');

  // Suspend modal
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selectedUserToSuspend, setSelectedUserToSuspend] = useState<AppUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('Penggantungan pencegahan keselamatan SES v4.5.');

  // ==============================================================
  // MASTER ADMIN PIN ELEVATION STATE (SES-SEC-4.5.5)
  // ==============================================================
  const [isPinElevated, setIsPinElevated] = useState<boolean>(false);
  const [checkingElevatedSession, setCheckingElevatedSession] = useState<boolean>(true);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinSubmitting, setPinSubmitting] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinRemainingSeconds, setPinRemainingSeconds] = useState<number>(0);
  const [pinLocked, setPinLocked] = useState<boolean>(false);
  const [lockoutRemainingSeconds, setLockoutRemainingSeconds] = useState<number>(0);

  // Check elevated session on mount or when active
  useEffect(() => {
    let timer: NodeJS.Timeout;

    const checkSession = async () => {
      if (!isMasterAdmin) {
        setIsPinElevated(false);
        setCheckingElevatedSession(false);
        return;
      }
      try {
        const res = await serverFunctions.checkAdminSessionStatus();
        if (res.hasElevatedSession) {
          setIsPinElevated(true);
          setPinRemainingSeconds(res.remainingSeconds || 900);
        } else {
          setIsPinElevated(false);
        }
      } catch {
        setIsPinElevated(false);
      } finally {
        setCheckingElevatedSession(false);
      }
    };

    checkSession();

    // Periodic countdown
    timer = setInterval(() => {
      setPinRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (isPinElevated) {
            setIsPinElevated(false);
          }
          return 0;
        }
        return prev - 1;
      });

      setLockoutRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isMasterAdmin, isPinElevated]);

  const handleVerifyPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setPinError('Sila masukkan Master Admin PIN 4-digit.');
      return;
    }
    setPinSubmitting(true);
    setPinError(null);
    try {
      const res = await serverFunctions.verifyAdminPin(pinInput.trim());
      if (res.success && res.authenticated) {
        setIsPinElevated(true);
        setPinRemainingSeconds(res.expiresIn || 900);
        setPinInput('');
        setPinLocked(false);
        showFeedback('Pengesahan Master Admin PIN berjaya! Sesi elevasi diaktifkan.');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Pengesahan PIN gagal.';
      setPinError(errMsg);
      if (errMsg.includes('dikunci') || errMsg.includes('TOO_MANY_REQUESTS')) {
        setPinLocked(true);
        setLockoutRemainingSeconds(15 * 60);
      }
    } finally {
      setPinSubmitting(false);
    }
  };

  const handleLockConsole = async () => {
    try {
      await serverFunctions.lockAdminSession();
      setIsPinElevated(false);
      setPinRemainingSeconds(0);
      showFeedback('Sesi Master Admin telah dikunci dengan selamat.');
    } catch {
      setIsPinElevated(false);
    }
  };

  // Realtime listeners for Master Admin
  useEffect(() => {
    if (!isMasterAdmin) return;

    // 1. AccessRequests
    const qReq = query(collection(db, 'accessRequests'), orderBy('createdAt', 'desc'));
    const unsubReq = onSnapshot(qReq, (snap) => {
      const items = snap.docs.map((d) => d.data() as AccessRequest);
      setRequests(items);
      setLoading(false);
    });

    // 2. Users
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const items = snap.docs.map((d) => d.data() as AppUser);
      setUsers(items);
    });

    // 2b. Doors (Authoritative Realtime Listener)
    const qDoors = query(collection(db, 'doors'), orderBy('createdAt', 'desc'));
    const unsubDoors = onSnapshot(qDoors, (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          doorId: data.doorId || d.id,
          doorName: data.doorName || data.name || 'Pintu Tanpa Nama',
          name: data.doorName || data.name || 'Pintu Tanpa Nama',
          building: data.building || 'Bangunan Akademik A',
          floor: data.floor || 'Aras Bawah',
          location: data.location || 'KPMBP',
          zoneId: data.zoneId || 'ZONE-ACADEMIC',
          zoneName: data.zoneName || 'Zon Akademik',
          readerType: data.readerType || 'ISO/IEC 14443-4 HCE APDU',
          controllerType: data.controllerType || 'Syncrozz IP-Controller v4.5',
          isOnline: data.isOnline ?? true,
          integrationStatus: data.integrationStatus || 'SIMULATED',
          operationalStatus: data.operationalStatus || (data.isActive ? 'ACTIVE' : 'INACTIVE'),
          isActive: data.operationalStatus ? data.operationalStatus === 'ACTIVE' : (data.isActive ?? true),
          assignedAccessGroups: data.assignedAccessGroups || [],
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          createdBy: data.createdBy,
          updatedBy: data.updatedBy,
        } as Door;
      });
      setDoors(items);
    });

    // 3. Devices
    const qDev = query(collection(db, 'devices'), orderBy('createdAt', 'desc'));
    const unsubDev = onSnapshot(qDev, (snap) => {
      const items = snap.docs.map((d) => d.data() as RegisteredDevice);
      setDevices(items);
    });

    // 4. Credentials
    const qCred = query(collection(db, 'credentials'), orderBy('createdAt', 'desc'));
    const unsubCred = onSnapshot(qCred, (snap) => {
      const items = snap.docs.map((d) => d.data() as IssuedCredential);
      setCredentials(items);
    });

    // 5. Audit Logs
    const qLogs = query(collection(db, 'accessLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const items = snap.docs.map((d) => d.data() as AccessLogRecord);
      setLogs(items);
    });

    return () => {
      unsubReq();
      unsubUsers();
      unsubDoors();
      unsubDev();
      unsubCred();
      unsubLogs();
    };
  }, [isMasterAdmin]);

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 4500);
  };

  if (!isMasterAdmin) {
    if (!masterAdminExists) {
      return (
        <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-2xl p-8 max-w-2xl mx-auto space-y-6 shadow-2xl animate-in fade-in">
          <div className="flex items-center space-x-3 text-indigo-400">
            <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                INISIALISASI MASTER ADMIN PERTAMA (SES-SEC-4.5.5)
              </h3>
              <p className="text-xs text-indigo-300">Authoritative Server-Side Deployment Bootstrap</p>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-3 leading-relaxed">
            <p>
              Sistem Zero-Trust mengesan bahawa <strong className="text-amber-300">tiada Master Admin</strong> wujud dalam pangkalan data Kolej Profesional MARA Bandar Penawar (KPMBP) pada saat ini.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="font-semibold text-slate-200 block">Akaun Semasa:</span>
                <span className="font-mono text-indigo-300">{currentUser?.email || 'Tiada Sesi'}</span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <span className="font-semibold text-slate-200 block">UID Sesi:</span>
                <span className="font-mono text-slate-400 truncate block">{currentUser?.uid || '-'}</span>
              </div>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
              <li>Mekanisme ini tidak menggunakan PIN hardcoded frontend (Pematuhan SES v4.5).</li>
              <li>Custom Claims Firebase akan ditetapkan secara terus melalui pelayan (Firebase Admin SDK).</li>
              <li>Tindakan ini direkodkan secara kekal ke dalam Immutable Audit Log.</li>
              <li>Endpoint bootstrap akan <strong className="text-rose-400">dikunci secara automatik</strong> serta-merta selepas admin pertama dilantik.</li>
            </ul>
          </div>

          <button
            onClick={async () => {
              setBootstrapping(true);
              try {
                await bootstrapFirstMasterAdmin();
                showFeedback('Master Admin pertama berjaya diwujudkan! Sila tunggu...');
              } catch (err: any) {
                alert('Ralat Bootstrap: ' + (err.message || String(err)));
              } finally {
                setBootstrapping(false);
              }
            }}
            disabled={bootstrapping || !currentUser}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 px-4 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-900/30 transition"
          >
            {bootstrapping ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses Authoritative Bootstrap...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Inisialisasi Sebagai Master Admin Pertama</span>
              </>
            )}
          </button>
        </div>
      );
    }

    return (
      <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-8 text-center space-y-3">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">AKSES DISEKAT: KEBENARAN MASTER ADMIN DIPERLUKAN</h3>
        <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
          Mengikut standard SYNCROZZ SES-SEC-4.5.5, konsol pentadbiran ini hanya boleh diakses oleh akaun dengan peranan{' '}
          <strong className="text-rose-300">MASTER_ADMIN</strong> yang telah disahkan melalui Firebase Custom Claims atau rekod rasmi.
        </p>
      </div>
    );
  }

  const handleApprove = async (req: AccessRequest) => {
    try {
      await adminApproveUser(req.userId, req.id);
      showFeedback(`Permohonan ${req.fullName} berjaya diluluskan (Server-Side Authorized).`);
    } catch (err) {
      alert('Ralat kelulusan: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleRejectConfirm = async () => {
    if (!selectedReq) return;
    try {
      await adminRejectUser(selectedReq.userId, rejectReason, selectedReq.id);
      setRejectModalOpen(false);
      setSelectedReq(null);
      showFeedback(`Permohonan ${selectedReq.fullName} telah ditolak dengan rekod rasmi.`);
    } catch (err) {
      alert('Ralat penolakan: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleSuspendConfirm = async () => {
    if (!selectedUserToSuspend) return;
    try {
      await adminSuspendUser(selectedUserToSuspend.id, suspendReason);
      setSuspendModalOpen(false);
      setSelectedUserToSuspend(null);
      showFeedback(`Akaun ${selectedUserToSuspend.fullName} telah digantung dan kredensial dibekukan.`);
    } catch (err) {
      alert('Ralat penggantungan: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!selectedUserToDeactivate) return;
    try {
      await adminDeactivateUser(selectedUserToDeactivate.id, deactivateReason);
      setDeactivateModalOpen(false);
      setSelectedUserToDeactivate(null);
      showFeedback(`Akaun ${selectedUserToDeactivate.fullName} telah dinyahaktifkan secara autoritatif.`);
    } catch (err) {
      alert('Ralat nyahaktif: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleRoleToggle = async (user: AppUser) => {
    const targetRole = user.role === 'MASTER_ADMIN' ? 'USER' : 'MASTER_ADMIN';
    const confirmMsg =
      targetRole === 'MASTER_ADMIN'
        ? `Adakah anda pasti mahu melantik ${user.fullName} sebagai MASTER_ADMIN? Ini akan mengkonfigurasi Firebase Custom User Claims.`
        : `Adakah anda pasti mahu melucutkan peranan MASTER_ADMIN daripada ${user.fullName}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await adminAssignRole(user.id, targetRole);
      showFeedback(`Peranan ${user.fullName} telah ditukar kepada ${targetRole}.`);
    } catch (err) {
      alert('Ralat peranan: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeviceActivate = async (dev: RegisteredDevice) => {
    if (!window.confirm(`Aktifkan telefon ${dev.deviceModel}? Sebarang peranti aktif lain milik pengguna ini akan dibatalkan (Dasar 1-Peranti).`)) {
      return;
    }
    try {
      await adminActivateDevice(dev.id, dev.userId);
      showFeedback(`Peranti ${dev.deviceModel} diaktifkan secara eksklusif.`);
    } catch (err) {
      alert('Ralat peranti: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeviceRevoke = async (dev: RegisteredDevice) => {
    const reason = window.prompt('Nyatakan sebab pembatalan peranti:', 'Dibatalkan oleh Master Admin');
    if (!reason) return;
    try {
      await adminRevokeDevice(dev.id, reason);
      showFeedback(`Peranti ${dev.deviceModel} telah dibatalkan.`);
    } catch (err) {
      alert('Ralat pembatalan peranti: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleCredentialRevoke = async (cred: IssuedCredential) => {
    const reason = window.prompt('Nyatakan sebab pembatalan kredensial:', 'Pembatalan sijil keselamatan');
    if (!reason) return;
    try {
      await adminRevokeCredential(cred.id, reason);
      showFeedback(`Kredensial digital ${cred.id} telah dibatalkan.`);
    } catch (err) {
      alert('Ralat pembatalan kredensial: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // --- DOOR HANDLERS (Module 1 SES-SEC-4.5.5) ---
  const handleOpenCreateDoor = () => {
    setEditingDoor(null);
    setDoorFormId(`DOOR-KPMBP-A${Math.floor(100 + Math.random() * 900)}`);
    setDoorFormName('');
    setDoorFormBuilding('Bangunan Akademik A');
    setDoorFormFloor('Aras Bawah');
    setDoorFormLocation('');
    setDoorFormZoneId('ZONE-ACADEMIC');
    setDoorFormZoneName('Zon Akademik');
    setDoorFormReaderType('ISO/IEC 14443-4 HCE APDU');
    setDoorFormControllerType('Syncrozz IP-Controller v4.5');
    setDoorFormStatus('ACTIVE');
    setDoorModalOpen(true);
  };

  const handleOpenEditDoor = (door: Door) => {
    setEditingDoor(door);
    setDoorFormId(door.doorId || door.id);
    setDoorFormName(door.doorName || door.name);
    setDoorFormBuilding(door.building || 'Bangunan Akademik A');
    setDoorFormFloor(door.floor || 'Aras Bawah');
    setDoorFormLocation(door.location || '');
    setDoorFormZoneId(door.zoneId || 'ZONE-ACADEMIC');
    setDoorFormZoneName(door.zoneName || 'Zon Akademik');
    setDoorFormReaderType(door.readerType || 'ISO/IEC 14443-4 HCE APDU');
    setDoorFormControllerType(door.controllerType || 'Syncrozz IP-Controller v4.5');
    setDoorFormStatus(door.operationalStatus || (door.isActive ? 'ACTIVE' : 'INACTIVE'));
    setDoorModalOpen(true);
  };

  const handleSaveDoorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doorFormId.trim() || !doorFormName.trim()) {
      alert('Sila lengkapkan Door ID dan Nama Pintu.');
      return;
    }

    setDoorSubmitting(true);
    try {
      if (editingDoor) {
        await serverFunctions.updateDoor({
          doorId: editingDoor.doorId || editingDoor.id,
          doorName: doorFormName.trim(),
          building: doorFormBuilding.trim(),
          floor: doorFormFloor.trim(),
          location: doorFormLocation.trim(),
          zoneId: doorFormZoneId.trim(),
          zoneName: doorFormZoneName.trim(),
          readerType: doorFormReaderType.trim(),
          controllerType: doorFormControllerType.trim(),
        });
        showFeedback(`Pintu ${doorFormName} berjaya dikemaskini.`);
      } else {
        await serverFunctions.createDoor({
          doorId: doorFormId.trim(),
          doorName: doorFormName.trim(),
          building: doorFormBuilding.trim(),
          floor: doorFormFloor.trim(),
          location: doorFormLocation.trim(),
          zoneId: doorFormZoneId.trim(),
          zoneName: doorFormZoneName.trim(),
          readerType: doorFormReaderType.trim(),
          controllerType: doorFormControllerType.trim(),
          operationalStatus: doorFormStatus,
          integrationStatus: 'SIMULATED', // honest non-claim
        });
        showFeedback(`Pintu baharu ${doorFormName} (${doorFormId}) berjaya didaftarkan.`);
      }
      setDoorModalOpen(false);
    } catch (err: any) {
      alert('Ralat menyimpan pintu: ' + (err?.message || err));
    } finally {
      setDoorSubmitting(false);
    }
  };

  const handleOpenToggleStatus = (door: Door, nextStatus: DoorOperationalStatus) => {
    setSelectedDoorForToggle(door);
    setTargetDoorStatus(nextStatus);
    setDoorToggleReason(`Penukaran status operasi kepada ${nextStatus} oleh Master Admin.`);
    setDoorToggleModalOpen(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!selectedDoorForToggle) return;
    try {
      await serverFunctions.toggleDoorStatus({
        doorId: selectedDoorForToggle.doorId || selectedDoorForToggle.id,
        newStatus: targetDoorStatus,
        reason: doorToggleReason,
      });
      showFeedback(`Status pintu ${selectedDoorForToggle.doorName || selectedDoorForToggle.id} ditukar ke ${targetDoorStatus}.`);
      setDoorToggleModalOpen(false);
      setSelectedDoorForToggle(null);
    } catch (err: any) {
      alert('Ralat penukaran status pintu: ' + (err?.message || err));
    }
  };

  const handleViewDoorAudit = async (door: Door) => {
    setSelectedDoorForAudit(door);
    setDoorAuditLogs([]);
    setLoadingDoorAudit(true);
    setDoorAuditModalOpen(true);
    try {
      const res = await serverFunctions.getDoorAuditHistory(door.doorId || door.id);
      setDoorAuditLogs(res.auditEntries || []);
    } catch (err: any) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoadingDoorAudit(false);
    }
  };

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');

  // Format countdown minutes:seconds
  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 1. PIN ELEVATION CHALLENGE SCREEN (Step-up auth gate)
  if (!isPinElevated && !checkingElevatedSession) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-950/80 border border-indigo-700/80 flex items-center justify-center mx-auto text-indigo-400 shadow-lg shadow-indigo-950/50">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide">Pengesahan Master Admin</h2>
          <p className="text-xs text-slate-400">
            Sistem memerlukan pengesahan Master Admin PIN rasmi untuk memulakan sesi pentadbiran berautoriti.
          </p>
        </div>

        {/* User Identity & Zero-Trust Notice */}
        <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Pengguna Semasa:</span>
            <span className="font-mono text-emerald-300 font-semibold">{currentUser?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Peranan Berkuasa:</span>
            <span className="text-indigo-300 font-semibold">MASTER_ADMIN (APPROVED)</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
            <span>Piawaian Keselamatan:</span>
            <span className="font-mono text-slate-300">SES-SEC-4.5.5 PBKDF2</span>
          </div>
        </div>

        {/* Error / Lockout Banner */}
        {pinError && (
          <div className={`p-3.5 rounded-xl text-xs flex items-start space-x-2.5 ${
            pinLocked ? 'bg-rose-950/90 border border-rose-700 text-rose-200' : 'bg-amber-950/80 border border-amber-700/80 text-amber-200'
          }`}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">{pinError}</span>
              {lockoutRemainingSeconds > 0 && (
                <span className="text-[11px] block font-mono text-rose-300">
                  Kunci keselamatan aktif: Baki {formatCountdown(lockoutRemainingSeconds)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* PIN Input Form */}
        <form onSubmit={handleVerifyPinSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Master Admin PIN (4-Digit)</span>
              <span className="text-[10px] text-slate-400 font-normal">Maks 5 cubaan</span>
            </label>
            <div className="relative">
              <input
                id="master-admin-pin-input"
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                disabled={pinSubmitting || (lockoutRemainingSeconds > 0)}
                placeholder="••••"
                className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-4 py-3 text-center text-xl tracking-widest font-mono text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                autoFocus
              />
              <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Masukkan Master Admin PIN rasmi. Pengesahan disahkan secara berwibawa di pelayan (server-side PBKDF2 hash).
            </p>
          </div>

          <button
            id="btn-verify-admin-pin"
            type="submit"
            disabled={pinSubmitting || !pinInput.trim() || (lockoutRemainingSeconds > 0)}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-950/50"
          >
            {pinSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Mengesahkan PIN di Pelayan...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Buka Kunci Konsol Pentadbir</span>
              </>
            )}
          </button>
        </form>

        <div className="text-[10px] text-slate-400 text-center border-t border-slate-800/80 pt-3">
          Sesi elevasi ini sah selama 15 minit. Kunci sementara 15 minit dikuatkuasakan secara automatik sekiranya gagal 5 kali berturut-turut.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Zero-Trust & Server-Side Authorization Badges */}
      <div className="bg-gradient-to-r from-indigo-950/90 via-slate-900 to-slate-900 border border-indigo-800/60 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <ShieldAlert className="w-4 h-4" />
              <span>SYNCROZZ Master Admin Console • Phase 3A</span>
            </div>
            <h2 className="text-xl font-bold text-white">Pengurusan Kuasa Akses KPMBP</h2>
            <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
              Server-Side Authorization Engine: Menguatkuasakan Firebase Custom Claims, transaksi atomik, dasar 1-peranti aktif, dan log audit kekal (immutable).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Elevated Session Status Badge & Console Lock Button */}
            <div className="bg-slate-950/90 border border-indigo-500/50 px-3 py-1.5 rounded-xl flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <div className="text-[11px] font-mono text-indigo-200">
                <span>PIN DISAHKAN: </span>
                <span className="text-emerald-400 font-bold">{formatCountdown(pinRemainingSeconds)}</span>
              </div>
              <button
                id="btn-lock-master-console"
                onClick={handleLockConsole}
                title="Kunci Konsol Sekarang (Tamatkan Sesi Elevasi)"
                className="ml-1 p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-slate-950/80 border border-emerald-800/60 px-3 py-1.5 rounded-xl flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] font-mono text-emerald-300">SES-SEC-4.5.5 ACTIVE</span>
            </div>
            <div className="bg-indigo-950/80 border border-indigo-700/60 px-3 py-1.5 rounded-xl text-center">
              <div className="text-xs font-bold text-indigo-200">{pendingRequests.length}</div>
              <div className="text-[9px] text-indigo-300 uppercase tracking-wide">Menunggu Kelulusan</div>
            </div>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className="mt-4 bg-emerald-950/80 border border-emerald-700/70 rounded-xl p-3 text-xs text-emerald-200 flex items-center space-x-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Sub-tabs */}
        <div className="flex items-center space-x-2 mt-6 pt-4 border-t border-slate-800/80 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveSection('requests')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition font-medium whitespace-nowrap ${
              activeSection === 'requests'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Permohonan Akses ({pendingRequests.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('users')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition font-medium whitespace-nowrap ${
              activeSection === 'users'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Direktori Staf & Peranan ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('doors')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition font-medium whitespace-nowrap ${
              activeSection === 'doors'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <DoorClosed className="w-3.5 h-3.5" />
            <span>Pengurusan Pintu SES ({doors.length})</span>
          </button>

          <button
            id="tab-btn-zones"
            onClick={() => setActiveSection('zones')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition font-medium whitespace-nowrap ${
              activeSection === 'zones'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Zon Kampus (Campus Zones)</span>
          </button>

          <button
            id="tab-btn-access-groups"
            onClick={() => setActiveSection('access-groups')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition font-medium whitespace-nowrap ${
              activeSection === 'access-groups'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Kumpulan Akses (Access Groups)</span>
          </button>

          <button
            onClick={() => setActiveSection('devices')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition font-medium whitespace-nowrap ${
              activeSection === 'devices'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Peranti Berdaftar ({devices.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('credentials')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition font-medium whitespace-nowrap ${
              activeSection === 'credentials'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Kredensial Digital ({credentials.length})</span>
          </button>

          <button
            onClick={() => setActiveSection('logs')}
            className={`flex items-center space-x-2 px-3 py-2 rounded-xl transition font-medium whitespace-nowrap ${
              activeSection === 'logs'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail SES v4.5 ({logs.length})</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Permohonan Akses */}
      {activeSection === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Senarai Permohonan Akses Staf KPMBP</span>
            </h3>
            <span className="text-[11px] text-slate-400">Menunjukkan permohonan terkini</span>
          </div>

          {requests.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400 text-xs">
              Tiada rekod permohonan akses ditemui dalam pangkalan data.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
                >
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white text-sm">{req.fullName}</span>
                      <span className="font-mono text-slate-400 text-[11px]">({req.staffId})</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                          req.status === 'APPROVED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : req.status === 'REJECTED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] flex flex-wrap gap-x-4 gap-y-1">
                      <span>Jabatan: {req.department}</span>
                      <span>Email: {req.email}</span>
                      <span>Tarikh: {new Date(req.createdAt).toLocaleDateString('ms-MY')}</span>
                    </div>
                    {req.decisionReason && (
                      <div className="text-[11px] text-rose-400 font-medium">
                        Alasan Penolakan: {req.decisionReason}
                      </div>
                    )}
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleApprove(req)}
                        className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Luluskan</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedReq(req);
                          setRejectModalOpen(true);
                        }}
                        className="flex items-center space-x-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60 px-3.5 py-1.5 rounded-lg text-xs font-medium transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Tolak</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: Direktori Staf & Role Management */}
      {activeSection === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Direktori Staf & Pengurusan Peranan (RBAC & Custom Claims)</span>
            </h3>
            <span className="text-[11px] text-slate-400">Server-enforced role assignments (SES-SEC-4.5.5)</span>
          </div>

          {/* Search & Filtering Controls */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="Cari nama, email, ID staf, atau jabatan..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="DEACTIVATED">DEACTIVATED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Semua Peranan</option>
                <option value="USER">USER</option>
                <option value="MASTER_ADMIN">MASTER_ADMIN</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Nama Staf</th>
                    <th className="p-3">ID Staf</th>
                    <th className="p-3">Jabatan</th>
                    <th className="p-3">Peranan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Tindakan Pentadbir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users
                    .filter((u) => {
                      const term = userSearchTerm.toLowerCase();
                      const matchSearch =
                        !term ||
                        u.fullName?.toLowerCase().includes(term) ||
                        u.email?.toLowerCase().includes(term) ||
                        u.staffId?.toLowerCase().includes(term) ||
                        u.department?.toLowerCase().includes(term);
                      const matchStatus = userStatusFilter === 'ALL' || u.status === userStatusFilter;
                      const matchRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
                      return matchSearch && matchStatus && matchRole;
                    })
                    .map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-3">
                          <div className="font-semibold text-white">{u.fullName}</div>
                          <div className="text-[11px] text-slate-500">{u.email}</div>
                        </td>
                        <td className="p-3 font-mono text-slate-300">{u.staffId}</td>
                        <td className="p-3 text-slate-400">{u.department}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              u.role === 'MASTER_ADMIN'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              u.status === 'APPROVED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-900'
                                : u.status === 'PENDING'
                                ? 'bg-amber-950 text-amber-300 border border-amber-900'
                                : u.status === 'SUSPENDED'
                                ? 'bg-orange-950 text-orange-300 border border-orange-900'
                                : u.status === 'DEACTIVATED'
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : 'bg-rose-950 text-rose-300 border border-rose-900'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {/* View User Profile */}
                            <button
                              onClick={() => {
                                setSelectedUserForProfile(u);
                                setProfileModalOpen(true);
                              }}
                              className="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center space-x-1 transition"
                              title="Lihat Profil Penuh"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Profil</span>
                            </button>

                            {/* Role Toggle Button */}
                            <button
                              onClick={() => handleRoleToggle(u)}
                              className={`text-[10px] px-2 py-1 rounded border transition ${
                                u.role === 'MASTER_ADMIN'
                                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-rose-300'
                                  : 'bg-indigo-950/70 border-indigo-800 text-indigo-300 hover:bg-indigo-900'
                              }`}
                            >
                              {u.role === 'MASTER_ADMIN' ? 'Lucutkan Admin' : 'Lantik Admin'}
                            </button>

                            {/* Suspend / Deactivate / Reactivate */}
                            {u.role !== 'MASTER_ADMIN' && (
                              <>
                                {u.status === 'APPROVED' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedUserToSuspend(u);
                                        setSuspendModalOpen(true);
                                      }}
                                      className="text-orange-400 hover:text-orange-300 text-[11px] underline"
                                    >
                                      Gantung
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedUserToDeactivate(u);
                                        setDeactivateModalOpen(true);
                                      }}
                                      className="text-rose-400 hover:text-rose-300 text-[11px] underline"
                                    >
                                      Nyahaktif
                                    </button>
                                  </>
                                )}

                                {u.status === 'SUSPENDED' && (
                                  <>
                                    <button
                                      onClick={async () => {
                                        await adminReactivateUser(u.id);
                                        showFeedback(`Akaun ${u.fullName} diaktifkan semula.`);
                                      }}
                                      className="text-emerald-400 hover:text-emerald-300 text-[11px] underline"
                                    >
                                      Aktifkan
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedUserToDeactivate(u);
                                        setDeactivateModalOpen(true);
                                      }}
                                      className="text-rose-400 hover:text-rose-300 text-[11px] underline"
                                    >
                                      Nyahaktif
                                    </button>
                                  </>
                                )}

                                {u.status === 'DEACTIVATED' && (
                                  <button
                                    onClick={async () => {
                                      await adminReactivateUser(u.id);
                                      showFeedback(`Akaun ${u.fullName} diaktifkan semula.`);
                                    }}
                                    className="text-emerald-400 hover:text-emerald-300 text-[11px] underline"
                                  >
                                    Aktifkan Semula
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2b: Pengurusan Pintu Fizikal & Zon (SES-SEC-4.5.5 Module 1) */}
      {activeSection === 'doors' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <DoorClosed className="w-4 h-4 text-indigo-400" />
                <span>Pengurusan Pintu Fizikal & Akses Zon (SES v4.5)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Kawalan autoritatif pelayan ke atas pintu bilik kuliah, makmal, dan pejabat berkuasa NFC/HCE KPMBP.
              </p>
            </div>
            <button
              onClick={handleOpenCreateDoor}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg transition self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Daftar Pintu Baharu</span>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari Door ID, nama, lokasi..."
                value={doorSearchTerm}
                onChange={(e) => setDoorSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Building className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={doorBuildingFilter}
                onChange={(e) => setDoorBuildingFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Semua Bangunan</option>
                <option value="Bangunan Akademik A">Bangunan Akademik A</option>
                <option value="Bangunan Akademik B">Bangunan Akademik B</option>
                <option value="Blok Pentadbiran">Blok Pentadbiran</option>
                <option value="Pusat Sumber & Makmal">Pusat Sumber & Makmal</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={doorStatusFilter}
                onChange={(e) => setDoorStatusFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Semua Status Operasi</option>
                <option value="ACTIVE">ACTIVE (Beroperasi Penuh)</option>
                <option value="INACTIVE">INACTIVE (Dinyahaktifkan)</option>
                <option value="MAINTENANCE">MAINTENANCE (Penyelenggaraan)</option>
                <option value="LOCKDOWN">LOCKDOWN (Sekatan Keselamatan)</option>
              </select>
            </div>
          </div>

          {/* Door Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {doors
              .filter((d) => {
                const search = doorSearchTerm.toLowerCase();
                const matchSearch =
                  (d.doorId && d.doorId.toLowerCase().includes(search)) ||
                  (d.doorName && d.doorName.toLowerCase().includes(search)) ||
                  (d.name && d.name.toLowerCase().includes(search)) ||
                  (d.location && d.location.toLowerCase().includes(search)) ||
                  (d.zoneId && d.zoneId.toLowerCase().includes(search));
                const matchBuilding =
                  doorBuildingFilter === 'ALL' || d.building === doorBuildingFilter;
                const currentStatus = d.operationalStatus || (d.isActive ? 'ACTIVE' : 'INACTIVE');
                const matchStatus =
                  doorStatusFilter === 'ALL' || currentStatus === doorStatusFilter;
                return matchSearch && matchBuilding && matchStatus;
              })
              .map((d) => {
                const status = d.operationalStatus || (d.isActive ? 'ACTIVE' : 'INACTIVE');
                const isVerified = d.integrationStatus === 'VERIFIED';
                return (
                  <div
                    key={d.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-3 transition flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-[10px] text-indigo-400 font-bold bg-indigo-950/70 border border-indigo-900/50 px-2 py-0.5 rounded">
                            {d.doorId || d.id}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-1">
                            {d.doorName || d.name}
                          </h4>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 font-semibold ${
                            status === 'ACTIVE'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : status === 'MAINTENANCE'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : status === 'LOCKDOWN'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 space-y-1">
                        <div className="flex items-center space-x-1.5 text-slate-300">
                          <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>
                            {d.building} • {d.floor}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{d.location || 'Lokasi tidak dinyatakan'}</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Zon: <strong className="text-slate-300">{d.zoneName || d.zoneId}</strong></span>
                        </div>
                        <div className="flex items-center space-x-1.5 font-mono text-[10px] text-slate-500">
                          <Radio className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{d.readerType || 'ISO/IEC 14443-4 HCE'}</span>
                        </div>
                      </div>

                      {/* SES v4.5 Hardware Integrity Badge */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Status Perkakasan:</span>
                        <span
                          className={`px-2 py-0.5 rounded font-mono ${
                            isVerified
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/60'
                              : d.integrationStatus === 'HARDWARE_VERIFICATION_REQUIRED'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                              : 'bg-slate-800/90 text-cyan-300 border border-cyan-800/60'
                          }`}
                        >
                          {d.integrationStatus || 'SIMULATED'}
                        </span>
                      </div>
                    </div>

                    {/* Action Toolbar */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-1 text-[11px]">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenEditDoor(d)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center space-x-1 transition"
                          title="Sunting Konfigurasi Pintu"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sunting</span>
                        </button>
                        <button
                          onClick={() => handleViewDoorAudit(d)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 flex items-center space-x-1 transition"
                          title="Lihat Sejarah Audit Pintu"
                        >
                          <History className="w-3 h-3" />
                          <span>Audit</span>
                        </button>
                      </div>

                      {/* Status Buttons */}
                      <div className="flex items-center space-x-1">
                        {status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleOpenToggleStatus(d, 'INACTIVE')}
                            className="px-2 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded transition font-medium"
                          >
                            Nyahaktif
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenToggleStatus(d, 'ACTIVE')}
                            className="px-2 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded transition font-medium"
                          >
                            Aktifkan
                          </button>
                        )}
                        {status !== 'MAINTENANCE' && (
                          <button
                            onClick={() => handleOpenToggleStatus(d, 'MAINTENANCE')}
                            className="px-1.5 py-1 bg-amber-950/70 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded transition text-[10px]"
                            title="Tukar status ke Penyelenggaraan"
                          >
                            Servis
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {doors.length === 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <DoorClosed className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-white">Tiada Pintu Didaftarkan</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Sistem belum mengandungi rekod pintu fizikal. Daftarkan pintu pertama untuk memulakan tadbir urus zon akses.
              </p>
              <button
                onClick={handleOpenCreateDoor}
                className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Daftar Pintu Pertama</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2c: Pengurusan Zon Kampus (SES-SEC-4.5.5 Module 2) */}
      {activeSection === 'zones' && (
        <CampusZoneManagement doors={doors} />
      )}

      {/* SECTION 2d: Pengurusan Kumpulan Akses (SES-SEC-4.5.5 Module 3) */}
      {activeSection === 'access-groups' && (
        <AccessGroupManagement doors={doors} users={users} />
      )}

      {/* SECTION 3: Peranti & Single-Device Enforcement */}
      {activeSection === 'devices' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Pengurusan Peranti Mudah Alih (Dasar SES v4.5 1-Peranti Aktif)</span>
            </h3>
            <span className="text-[11px] text-slate-400">Hanya satu peranti aktif dibenarkan bagi setiap identiti staf</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {devices.map((dev) => (
              <div key={dev.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white text-sm">{dev.deviceModel}</div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      dev.status === 'ACTIVE'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold'
                        : dev.status === 'REVOKED'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {dev.status}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 space-y-1">
                  <div>ID Pengguna: <span className="text-slate-300 font-mono">{dev.userId}</span></div>
                  <div>Platform: <span className="text-slate-300">{dev.platform}</span></div>
                  <div>
                    Fingerprint: <span className="font-mono text-emerald-400">{dev.fingerprint || 'HARDWARE-BOUND'}</span>
                  </div>
                  <div>Didaftarkan: {new Date(dev.createdAt).toLocaleDateString('ms-MY')}</div>
                  {dev.lostReported && (
                    <div className="text-rose-400 font-semibold flex items-center space-x-1 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Dilaporkan Hilang: Kredensial telah dibatalkan secara automatik.</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                  {dev.status !== 'ACTIVE' && (
                    <button
                      onClick={() => handleDeviceActivate(dev)}
                      className="bg-emerald-600/80 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition"
                    >
                      Aktifkan (1-Peranti)
                    </button>
                  )}
                  {dev.status !== 'REVOKED' && (
                    <button
                      onClick={() => handleDeviceRevoke(dev)}
                      className="bg-rose-900/50 hover:bg-rose-800 text-rose-200 border border-rose-800/60 px-3 py-1.5 rounded-lg text-[11px] transition"
                    >
                      Batalkan Peranti
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: Kredensial Digital */}
      {activeSection === 'credentials' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <span>Sijil Kredensial Digital (HCE ISO 7816 AID A0000008410001)</span>
            </h3>
            <span className="text-[11px] text-slate-400">Kredensial kriptografi berasaskan perkakasan</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {credentials.map((cred) => (
              <div key={cred.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{cred.holderName || cred.userId}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      cred.status === 'ACTIVE'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : cred.status === 'SUSPENDED'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {cred.status}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 space-y-1">
                  <div>AID: <span className="font-mono text-indigo-300">{cred.applicationIdentifier}</span></div>
                  <div>Alias: <span className="font-mono text-slate-300">{cred.alias || cred.keystoreAlias || cred.id}</span></div>
                  <div>Zon Dibenarkan: <span className="text-slate-300">{(cred.authorizedZones || []).join(', ')}</span></div>
                  <div>Tamat Tempoh: <span className="text-slate-300">{new Date(cred.expiresAt).toLocaleDateString('ms-MY')}</span></div>
                </div>

                {cred.status === 'ACTIVE' && (
                  <div className="pt-2 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={() => handleCredentialRevoke(cred)}
                      className="text-rose-400 hover:text-rose-300 text-[11px] underline"
                    >
                      Batalkan Sijil Kredensial
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 5: Audit Logs (Immutable SES Audit Trail) */}
      {activeSection === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <History className="w-4 h-4 text-indigo-400" />
              <span>Audit Trail Log Pentadbiran (SES Immutable Record)</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Append-Only • Tamper-Resistant</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2 max-h-[500px] overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs flex flex-col md:flex-row md:items-start justify-between gap-3 hover:border-slate-700 transition"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-indigo-400 px-1.5 py-0.5 bg-indigo-950/70 rounded border border-indigo-900/50 font-semibold">
                      {log.action}
                    </span>
                    <span className="text-slate-300 font-medium">{log.details}</span>
                    {log.result && (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                          log.result === 'SUCCESS' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                        }`}
                      >
                        {log.result}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-0.5">
                    <div>
                      Pelaku: <span className="text-slate-400">{log.actorEmail}</span> ({log.actorId.slice(0, 8)}...)
                    </div>
                    <div>
                      Sasaran: <span className="text-slate-400 font-mono">{log.targetId.slice(0, 12)}</span> [{log.targetType}]
                    </div>
                    {log.previousStatus && log.newStatus && log.previousStatus !== 'N/A' && (
                      <div>
                        Status: <span className="text-amber-300/80">{log.previousStatus}</span> →{' '}
                        <span className="text-emerald-300 font-semibold">{log.newStatus}</span>
                      </div>
                    )}
                  </div>

                  {log.reason && (
                    <div className="text-[11px] text-amber-400/90 font-medium bg-amber-950/30 border border-amber-900/40 rounded px-2 py-1 mt-1">
                      Alasan Rasmi: {log.reason}
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 font-mono whitespace-nowrap self-end md:self-auto shrink-0">
                  {new Date(log.timestamp).toLocaleString('ms-MY')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejection Modal with mandatory Reason */}
      {rejectModalOpen && selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-rose-400">
              <XCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Tolak Permohonan Akses</h3>
            </div>
            <p className="text-xs text-slate-300">
              Mengikut SES-SEC-4.5.5, alasan penolakan rasmi wajib dinyatakan dalam audit trail bagi staf{' '}
              <strong className="text-white">{selectedReq.fullName}</strong> ({selectedReq.staffId}):
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              placeholder="Nyatakan sebab penolakan (min. 5 aksara)..."
            />
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800 transition"
              >
                Batal
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={rejectReason.trim().length < 5}
                className="px-4 py-2 rounded-xl text-xs text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 font-semibold transition"
              >
                Sahkan Penolakan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {suspendModalOpen && selectedUserToSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-orange-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Gantung Akaun Pengguna</h3>
            </div>
            <p className="text-xs text-slate-300">
              Penggantungan akaun akan membekukan sijil digital secara automatik bagi{' '}
              <strong className="text-white">{selectedUserToSuspend.fullName}</strong>:
            </p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
              placeholder="Nyatakan sebab penggantungan..."
            />
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setSuspendModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800 transition"
              >
                Batal
              </button>
              <button
                onClick={handleSuspendConfirm}
                className="px-4 py-2 rounded-xl text-xs text-white bg-orange-600 hover:bg-orange-500 font-semibold transition"
              >
                Sahkan Penggantungan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {deactivateModalOpen && selectedUserToDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-rose-400">
              <UserMinus className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Nyahaktifkan Akaun Staf</h3>
            </div>
            <p className="text-xs text-slate-300">
              Pennyahaktifan akaun akan menetapkan status kepada <strong className="text-slate-100">DEACTIVATED</strong> dan membatalkan semua kredensial aktif bagi{' '}
              <strong className="text-white">{selectedUserToDeactivate.fullName}</strong> ({selectedUserToDeactivate.staffId}):
            </p>
            <textarea
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
              placeholder="Nyatakan sebab rasmi penyahaktifan..."
            />
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeactivateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white bg-slate-800 transition"
              >
                Batal
              </button>
              <button
                onClick={handleDeactivateConfirm}
                className="px-4 py-2 rounded-xl text-xs text-white bg-rose-600 hover:bg-rose-500 font-semibold transition"
              >
                Sahkan Penyahaktifan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {profileModalOpen && selectedUserForProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-300">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedUserForProfile.fullName}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedUserForProfile.email}</p>
                </div>
              </div>
              <div className="flex flex-col items-end space-y-1">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    selectedUserForProfile.role === 'MASTER_ADMIN'
                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {selectedUserForProfile.role}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    selectedUserForProfile.status === 'APPROVED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-900'
                      : selectedUserForProfile.status === 'PENDING'
                      ? 'bg-amber-950 text-amber-300 border border-amber-900'
                      : selectedUserForProfile.status === 'SUSPENDED'
                      ? 'bg-orange-950 text-orange-300 border border-orange-900'
                      : selectedUserForProfile.status === 'DEACTIVATED'
                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                      : 'bg-rose-950 text-rose-300 border border-rose-900'
                  }`}
                >
                  {selectedUserForProfile.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">ID Staf / Matrik</span>
                <span className="text-slate-200 font-mono font-medium">{selectedUserForProfile.staffId}</span>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Jabatan / Bahagian</span>
                <span className="text-slate-200 font-medium">{selectedUserForProfile.department}</span>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Organisasi</span>
                <span className="text-slate-200 font-medium">{selectedUserForProfile.organization || 'KPMBP'}</span>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">No. Telefon</span>
                <span className="text-slate-200 font-medium">{selectedUserForProfile.phoneNumber || '-'}</span>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 sm:col-span-2">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Firebase User UID</span>
                <span className="text-indigo-300 font-mono text-[11px] break-all">{selectedUserForProfile.id}</span>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 sm:col-span-2">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">ID Peranti Aktif (Dasar 1-Peranti)</span>
                <span className="text-slate-300 font-mono text-[11px]">{selectedUserForProfile.activeDeviceId || 'Tiada Peranti Aktif Didaftar'}</span>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Didaftarkan Pada</span>
                <span className="text-slate-400 text-[11px]">{new Date(selectedUserForProfile.createdAt).toLocaleString('ms-MY')}</span>
              </div>
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Kemaskini Terakhir</span>
                <span className="text-slate-400 text-[11px]">{new Date(selectedUserForProfile.updatedAt).toLocaleString('ms-MY')}</span>
              </div>
            </div>

            {selectedUserForProfile.rejectionReason && (
              <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-3 text-xs text-rose-300">
                <span className="font-semibold block mb-0.5">Catatan Rasmi / Sebab Penolakan:</span>
                <p className="text-[11px]">{selectedUserForProfile.rejectionReason}</p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setProfileModalOpen(false);
                  setSelectedUserForProfile(null);
                }}
                className="px-4 py-2 rounded-xl text-xs text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DAFTAR / SUNTING PINTU (Module 1) */}
      {doorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-indigo-400">
                <DoorClosed className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">
                  {editingDoor ? 'Sunting Konfigurasi Pintu' : 'Daftar Pintu Fizikal Baharu'}
                </h3>
              </div>
              <button
                onClick={() => setDoorModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDoorSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Door ID <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!!editingDoor}
                    value={doorFormId}
                    onChange={(e) => setDoorFormId(e.target.value.toUpperCase())}
                    placeholder="DOOR-KPMBP-A101"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    required
                  />
                  <span className="text-[10px] text-slate-500">Pengecam unik autoritatif</span>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Status Operasi
                  </label>
                  <select
                    value={doorFormStatus}
                    onChange={(e) => setDoorFormStatus(e.target.value as DoorOperationalStatus)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE (Beroperasi)</option>
                    <option value="INACTIVE">INACTIVE (Nyahaktif)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Servis)</option>
                    <option value="LOCKDOWN">LOCKDOWN (Sekatan)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Nama Rasmi Pintu <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={doorFormName}
                  onChange={(e) => setDoorFormName(e.target.value)}
                  placeholder="Contoh: Pintu Utama Makmal Komputer 1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Bangunan</label>
                  <select
                    value={doorFormBuilding}
                    onChange={(e) => setDoorFormBuilding(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Bangunan Akademik A">Bangunan Akademik A</option>
                    <option value="Bangunan Akademik B">Bangunan Akademik B</option>
                    <option value="Blok Pentadbiran">Blok Pentadbiran</option>
                    <option value="Pusat Sumber & Makmal">Pusat Sumber & Makmal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Aras</label>
                  <select
                    value={doorFormFloor}
                    onChange={(e) => setDoorFormFloor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Aras Bawah">Aras Bawah</option>
                    <option value="Aras 1">Aras 1</option>
                    <option value="Aras 2">Aras 2</option>
                    <option value="Aras 3">Aras 3</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Lokasi Khusus</label>
                <input
                  type="text"
                  value={doorFormLocation}
                  onChange={(e) => setDoorFormLocation(e.target.value)}
                  placeholder="Contoh: Sayap Kanan, Koridor Makmal A-101"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Zon Akses</label>
                  <select
                    value={doorFormZoneId}
                    onChange={(e) => {
                      const zid = e.target.value;
                      setDoorFormZoneId(zid);
                      if (zid === 'ZONE-ACADEMIC') setDoorFormZoneName('Zon Akademik');
                      else if (zid === 'ZONE-LABS') setDoorFormZoneName('Zon Makmal Komputer');
                      else if (zid === 'ZONE-ADMIN') setDoorFormZoneName('Zon Pentadbiran & Pejabat');
                      else if (zid === 'ZONE-SERVER') setDoorFormZoneName('Bilik Pelayan Terhad');
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ZONE-ACADEMIC">ZONE-ACADEMIC (Akademik)</option>
                    <option value="ZONE-LABS">ZONE-LABS (Makmal Komputer)</option>
                    <option value="ZONE-ADMIN">ZONE-ADMIN (Pentadbiran)</option>
                    <option value="ZONE-SERVER">ZONE-SERVER (Bilik Pelayan - Terhad)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Jenis Reader NFC</label>
                  <select
                    value={doorFormReaderType}
                    onChange={(e) => setDoorFormReaderType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="ISO/IEC 14443-4 HCE APDU">ISO/IEC 14443-4 HCE APDU</option>
                    <option value="MIFARE DESFire EV3">MIFARE DESFire EV3</option>
                    <option value="OSDP v2.2 Encrypted Reader">OSDP v2.2 Encrypted Reader</option>
                    <option value="Wiegand 26-bit Legacy">Wiegand 26-bit Legacy</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Jenis Controller PACS</label>
                <input
                  type="text"
                  value={doorFormControllerType}
                  onChange={(e) => setDoorFormControllerType(e.target.value)}
                  placeholder="Syncrozz IP-Controller v4.5"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center space-x-1 text-amber-300 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>SES v4.5 Zero False-Claim Policy</span>
                </div>
                <p>
                  Pintu yang didaftarkan melalui konsol web ini diklasifikasikan sebagai <strong className="text-cyan-300">SIMULATED</strong> secara jujur sehingga unit perkakasan fizikal diuji di lapangan KPMBP.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDoorModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={doorSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold rounded-xl shadow-md transition"
                >
                  {doorSubmitting ? 'Memproses...' : editingDoor ? 'Simpan Kemaskini' : 'Daftar Pintu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TOGGLE DOOR STATUS (Activate / Deactivate / Service) */}
      {doorToggleModalOpen && selectedDoorForToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-amber-400">
              <Sliders className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Tukar Status Operasi Pintu</h3>
            </div>
            <p className="text-xs text-slate-300">
              Anda sedang menukar status operasi bagi pintu <strong className="text-white">{selectedDoorForToggle.doorName || selectedDoorForToggle.id}</strong> kepada:
            </p>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-center">
              <span className="font-mono text-sm font-bold text-indigo-300">
                {targetDoorStatus}
              </span>
            </div>
            <div>
              <label className="block text-slate-300 text-xs font-medium mb-1">
                Alasan Rasmi (Wajib untuk SES Immutable Audit Trail):
              </label>
              <textarea
                value={doorToggleReason}
                onChange={(e) => setDoorToggleReason(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setDoorToggleModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmToggleStatus}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition"
              >
                Sahkan Penukaran Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW DOOR AUDIT TRAIL */}
      {doorAuditModalOpen && selectedDoorForAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-indigo-400">
                <History className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">
                  Sejarah Audit: {selectedDoorForAudit.doorName || selectedDoorForAudit.id}
                </h3>
              </div>
              <button
                onClick={() => setDoorAuditModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-400">
              Rekod log audit kekal (immutable) yang melibatkan penciptaan, kemaskini konfigurasi, dan penukaran status operasi pintu ini.
            </div>

            {loadingDoorAudit ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-2" />
                <span>Memuatkan log audit pintu daripada pangkalan data...</span>
              </div>
            ) : doorAuditLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl">
                Tiada rekod audit khusus ditemui bagi pintu ini.
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {doorAuditLogs.map((log: any, idx: number) => (
                  <div
                    key={log.id || idx}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-indigo-400 font-bold px-1.5 py-0.5 bg-indigo-950/80 rounded border border-indigo-900/50">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleString('ms-MY')}
                      </span>
                    </div>
                    <div className="text-slate-300">{log.details || log.reason}</div>
                    <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-3">
                      <span>Pelaku: <strong className="text-slate-400">{log.actorEmail}</strong></span>
                      {log.previousStatus && log.newStatus && (
                        <span>Status: <span className="text-amber-300">{log.previousStatus}</span> → <span className="text-emerald-300">{log.newStatus}</span></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setDoorAuditModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
