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
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AppUser, AccessRequest, RegisteredDevice, AccessLogRecord, IssuedCredential } from '../types';

export const MasterAdminDashboard: React.FC = () => {
  const {
    isMasterAdmin,
    adminApproveUser,
    adminRejectUser,
    adminSuspendUser,
    adminReactivateUser,
    adminActivateDevice,
    adminRevokeDevice,
    adminRevokeCredential,
    adminAssignRole,
    currentUser,
  } = useAuth();

  const [activeSection, setActiveSection] = useState<'requests' | 'users' | 'devices' | 'credentials' | 'logs'>('requests');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [credentials, setCredentials] = useState<IssuedCredential[]>([]);
  const [logs, setLogs] = useState<AccessLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<AccessRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('Maklumat staf tidak sepadan dengan rekod rasmi KPMBP.');

  // Suspend modal
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [selectedUserToSuspend, setSelectedUserToSuspend] = useState<AppUser | null>(null);
  const [suspendReason, setSuspendReason] = useState('Penggantungan pencegahan keselamatan SES v4.5.');

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

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');

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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Direktori Staf & Pengurusan Peranan (RBAC & Custom Claims)</span>
            </h3>
            <span className="text-[11px] text-slate-400">Server-enforced role assignments</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Nama Staf</th>
                    <th className="p-3">ID Staf</th>
                    <th className="p-3">Jabatan</th>
                    <th className="p-3">Peranan (Custom Claim)</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Tindakan Pentadbir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {users.map((u) => (
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
                              : 'bg-rose-950 text-rose-300 border border-rose-900'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* Role Toggle Button */}
                          <button
                            onClick={() => handleRoleToggle(u)}
                            className={`text-[10px] px-2 py-1 rounded border transition ${
                              u.role === 'MASTER_ADMIN'
                                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-rose-300'
                                : 'bg-indigo-950/70 border-indigo-800 text-indigo-300 hover:bg-indigo-900'
                            }`}
                          >
                            {u.role === 'MASTER_ADMIN' ? 'Lucutkan Admin' : 'Lantik Master Admin'}
                          </button>

                          {/* Suspend or Reactivate */}
                          {u.role !== 'MASTER_ADMIN' && (
                            <>
                              {u.status === 'APPROVED' ? (
                                <button
                                  onClick={() => {
                                    setSelectedUserToSuspend(u);
                                    setSuspendModalOpen(true);
                                  }}
                                  className="text-rose-400 hover:text-rose-300 text-[11px] underline"
                                >
                                  Gantung
                                </button>
                              ) : u.status === 'SUSPENDED' ? (
                                <button
                                  onClick={async () => {
                                    await adminReactivateUser(u.id);
                                    showFeedback(`Akaun ${u.fullName} diaktifkan semula.`);
                                  }}
                                  className="text-emerald-400 hover:text-emerald-300 text-[11px] underline"
                                >
                                  Aktifkan Semula
                                </button>
                              ) : null}
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
    </div>
  );
};
