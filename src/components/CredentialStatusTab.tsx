import React, { useState, useEffect } from 'react';
import {
  Key,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Layers,
  Zap,
  RefreshCw,
  Clock,
  Smartphone,
  ShieldAlert,
  Flame,
  CheckCheck,
} from 'lucide-react';
import { CredentialProfile, CredentialLifecycleStatus, ReaderInteractionStep } from '../types';
import { validateCredentialProfile } from '../services/credentialService';
import { sessionService, SessionAuthResult } from '../services/sessionService';
import { keystoreAdapter } from '../services/keystoreAdapter';
import { useAuth } from '../services/AuthContext';
import { serverFunctions } from '../services/functionsService';

interface CredentialStatusTabProps {
  credential: CredentialProfile;
  onUpdateCredential: (updated: CredentialProfile) => void;
}

export const CredentialStatusTab: React.FC<CredentialStatusTabProps> = ({
  credential,
  onUpdateCredential,
}) => {
  const { appUser } = useAuth();
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState(sessionService.getSession());
  const [authenticating, setAuthenticating] = useState(false);
  const [authResult, setAuthResult] = useState<SessionAuthResult | null>(null);
  const [serverCredential, setServerCredential] = useState<any>(null);
  const [keystoreMeta, setKeystoreMeta] = useState<any>(null);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceReason, setReplaceReason] = useState('');
  const [processingReplace, setProcessingReplace] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(0);

  const validation = validateCredentialProfile(credential);
  const currentUserId = appUser?.id || credential.holderId || 'default-user';
  const keystoreAlias = `syncrozz_hw_${currentUserId}`;

  // Subscribe to session state
  useEffect(() => {
    const unsub = sessionService.subscribe((s) => {
      setSession(s);
      if (s) {
        const remaining = Math.max(0, Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 1000));
        setSessionTimeLeft(remaining);
      } else {
        setSessionTimeLeft(0);
      }
    });
    return () => unsub();
  }, []);

  // Countdown timer for session
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
      setSessionTimeLeft(remaining);
      if (remaining <= 0) {
        sessionService.clearSession();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Load Keystore Metadata & Server Credential Status
  const loadStatus = async () => {
    try {
      const meta = await keystoreAdapter.getKeyMetadata(keystoreAlias);
      setKeystoreMeta(meta);

      if (appUser) {
        const remote = await serverFunctions.getMyCredentialStatus();
        if (remote.hasCredential && remote.credential) {
          setServerCredential(remote.credential);
        }
      }
    } catch (e) {
      console.warn('Could not load keystore/credential status', e);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [appUser, keystoreAlias]);

  // Handle Challenge-Response Session Authentication
  const handleAuthenticateSession = async () => {
    const deviceId = appUser?.activeDeviceId || 'dev-android-current';
    setAuthenticating(true);
    setAuthResult(null);

    try {
      // If hardware key doesn't exist yet, auto-initialize
      let meta = keystoreMeta;
      if (!meta) {
        meta = await keystoreAdapter.initializeKey(keystoreAlias);
        setKeystoreMeta(meta);
      }

      const result = await sessionService.authenticateDeviceSession(currentUserId, deviceId);
      setAuthResult(result);
      if (result.success) {
        loadStatus();
      }
    } catch (err: any) {
      setAuthResult({
        success: false,
        error: err.message,
        exchangeSteps: [],
      });
    } finally {
      setAuthenticating(false);
    }
  };

  // Handle Credential Enrollment Flow
  const handleEnrollCredential = async () => {
    setEnrolling(true);
    setEnrollMsg(null);
    try {
      const deviceId = appUser?.activeDeviceId || `dev-${Date.now().toString(36)}`;
      const modelName = navigator.userAgent.includes('Android') ? 'Android Secure Phone' : 'Enterprise Mobile Client';
      const platform = navigator.userAgent.includes('Android') ? 'Android' : 'Web/PWA';

      const res = await sessionService.enrollDeviceAndCredential(currentUserId, deviceId, modelName, platform);
      setEnrollMsg('Kredensial berjaya didaftarkan ke Android Keystore & terikat kepada peranti ini.');
      await loadStatus();
    } catch (err: any) {
      alert('Ralat pendaftaran kredensial: ' + err.message);
    } finally {
      setEnrolling(false);
    }
  };

  // Handle Revocation & Replacement Flow (Lost phone)
  const handleRevokeAndReplace = async () => {
    if (!replaceReason.trim()) {
      alert('Sila nyatakan sebab pembatalan / penggantian.');
      return;
    }
    setProcessingReplace(true);
    try {
      await sessionService.revokeAndReplace(currentUserId, appUser?.activeDeviceId, replaceReason);
      setShowReplaceModal(false);
      setReplaceReason('');
      setAuthResult(null);
      await loadStatus();
      alert('Kredensial dan peranti lama telah dibatalkan dengan selamat. Anda kini boleh mendaftar peranti pengganti.');
    } catch (err: any) {
      alert('Ralat pembatalan: ' + err.message);
    } finally {
      setProcessingReplace(false);
    }
  };

  const handleCopyDescriptor = () => {
    navigator.clipboard.writeText(JSON.stringify({ ...credential, serverState: serverCredential }, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine current lifecycle status
  const currentStatus: CredentialLifecycleStatus =
    serverCredential?.status || (credential.status as CredentialLifecycleStatus) || 'ACTIVE';

  const getStatusBadge = (status: CredentialLifecycleStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="text-xs bg-emerald-950 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-800 font-mono flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ACTIVE (AKTIF)</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="text-xs bg-amber-950 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-800 font-mono">
            PENDING (MENUNGGU)
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="text-xs bg-orange-950 text-orange-300 px-2.5 py-0.5 rounded-full border border-orange-800 font-mono">
            SUSPENDED (DIGANTUNG)
          </span>
        );
      case 'REVOKED':
        return (
          <span className="text-xs bg-rose-950 text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-800 font-mono">
            REVOKED (DIBATALKAN)
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-700 font-mono">
            EXPIRED (TAMAT TEMPOH)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Key className="w-5 h-5 text-emerald-400" />
            <span>Kredensial Digital & Sesi Kriptografi (SES v4.5)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Penyimpanan perkakasan Android Keystore, pendaftaran peranti tunggal, dan pengesahan sesi cabaran-tindak balas.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            id="btn-enroll-credential"
            onClick={handleEnrollCredential}
            disabled={enrolling}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-500 transition shadow-lg shadow-emerald-950/40"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{enrolling ? 'Mendaftar...' : 'Daftar ke Keystore'}</span>
          </button>

          <button
            id="btn-replace-credential"
            onClick={() => setShowReplaceModal(true)}
            className="flex items-center space-x-1.5 bg-rose-900/60 hover:bg-rose-800/80 text-rose-200 text-xs px-3 py-1.5 rounded-lg border border-rose-700/80 transition"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Lapor Hilang / Ganti</span>
          </button>

          <button
            id="btn-copy-credential-json"
            onClick={handleCopyDescriptor}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Disalin' : 'Eksport JSON'}</span>
          </button>
        </div>
      </div>

      {enrollMsg && (
        <div className="bg-emerald-950/80 border border-emerald-700/60 rounded-xl p-3 text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{enrollMsg}</span>
        </div>
      )}

      {/* Main Credential Lifecycle Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-950/90 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shadow-inner">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="text-base font-bold text-white">
                  {serverCredential?.holderName || credential.holderName}
                </span>
                {getStatusBadge(currentStatus)}
              </div>
              <p className="text-xs text-slate-400">
                {credential.holderTitle} • {credential.department} • No. Staf:{' '}
                <span className="font-mono text-slate-300">{credential.facilityId}</span>
              </p>
            </div>
          </div>

          <div className="text-right sm:self-auto self-start">
            <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Kitaran Hayat (Lifecycle)
            </div>
            <div className="text-xs text-slate-300 font-mono mt-0.5">
              Tamat: {serverCredential?.expiresAt ? new Date(serverCredential.expiresAt).toLocaleDateString() : credential.validUntil}
            </div>
          </div>
        </div>

        {/* Technical Attributes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Hardware Keystore Integration Card */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold uppercase text-slate-400 font-mono tracking-wider flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Android Keystore Perkakasan (SES v4.5)</span>
              </h4>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                keystoreAdapter.isNativeAndroid()
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              }`}>
                {keystoreAdapter.isNativeAndroid() ? 'NATIVE ANDROID KOTLIN' : 'WEB DEV CLIENT'}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Tahap Keselamatan:</span>
                <span className="text-emerald-400 font-medium font-mono">
                  {keystoreMeta?.securityLevel || keystoreAdapter.getSecurityLevel()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">HCE Service (ISO 7816-4):</span>
                <span className="text-cyan-300 font-mono font-medium">
                  {keystoreAdapter.isNativeAndroid() ? 'AKTIF (AID: A0000008410001)' : 'TERSEDIA DALAM APK KOTLIN'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Algoritma Kriptografi:</span>
                <span className="text-slate-300 font-mono">ECDSA P-256 (SHA-256)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pengekstrakan Kunci:</span>
                <span className="text-emerald-400 font-mono font-semibold">
                  TIDAK DIEKSTRAK (Non-Exportable Keystore)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Anti-Kloning & UID:</span>
                <span className="text-amber-300 font-mono text-[10px]">
                  Randomized UID / MIFARE Classic Disekat
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Alias Perkakasan:</span>
                <span className="text-indigo-300 font-mono text-[11px] truncate max-w-[180px]">
                  {keystoreAlias}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Cap Jari Kunci Awam:</span>
                <span className="text-slate-400 font-mono text-[10px] truncate max-w-[180px]">
                  {keystoreMeta?.publicKeyFingerprint
                    ? `${keystoreMeta.publicKeyFingerprint.substring(0, 16)}...`
                    : 'Tersedia selepas inisialisasi'}
                </span>
              </div>
            </div>
          </div>

          {/* Enterprise Authority & Bound Device */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <h4 className="text-[11px] font-bold uppercase text-slate-400 font-mono tracking-wider flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pengecam Aplikasi & Peranti Berikat</span>
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Application ID (AID):</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {credential.applicationIdentifier}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Organisasi:</span>
                <span className="text-white font-medium">{credential.organization}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Peranti Aktif Tunggal:</span>
                <span className="text-slate-300 font-mono">
                  {appUser?.activeDeviceId || 'Aktif pada peranti semasa'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status Pengesahan Server:</span>
                <span className="text-emerald-300 font-medium">Berautoriti (Server-Side SOT)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Authorized Access Zones */}
        <div className="space-y-2 pt-1">
          <span className="text-xs font-semibold text-slate-300">Zon Akses Diberi Kuasa (Authorized Zones):</span>
          <div className="flex flex-wrap gap-2">
            {(serverCredential?.authorizedZones || credential.allowedZones).map((zone: string, idx: number) => (
              <span
                key={idx}
                className="text-xs bg-slate-950 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-[11px]">{zone}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ZERO-TRUST CRYPTOGRAPHIC SESSION AUTHENTICATION PANEL */}
      {/* ========================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Pengesahan Sesi Kriptografi (Challenge-Response)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pelayan mengeluarkan Nonce rawak 256-bit (TTL 90s); Keystore menandatangani cabaran tanpa mendedahkan kunci; Nonce dibakar serta-merta untuk menghalang serangan ulangan (Replay Attack).
            </p>
          </div>

          <button
            id="btn-run-challenge-response"
            onClick={handleAuthenticateSession}
            disabled={authenticating || currentStatus !== 'ACTIVE'}
            className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition shadow-lg shadow-amber-950/40 self-start sm:self-auto shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${authenticating ? 'animate-spin' : ''}`} />
            <span>{authenticating ? 'Mengesahkan Sesi...' : 'Uji Sesi Kriptografi'}</span>
          </button>
        </div>

        {/* Active Session Status Banner */}
        {session ? (
          <div className="bg-emerald-950/60 border border-emerald-700/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-900/80 border border-emerald-600/80 flex items-center justify-center text-emerald-300">
                <CheckCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-emerald-200 flex items-center space-x-2">
                  <span>Sesi Kriptografi Aktif (Zero-Trust Session)</span>
                  <span className="bg-emerald-900 text-emerald-300 text-[10px] px-2 py-0.5 rounded border border-emerald-700 font-mono">
                    VALID
                  </span>
                </div>
                <p className="text-[11px] text-emerald-400/90 font-mono mt-0.5 truncate max-w-sm sm:max-w-md">
                  Token: {session.token.substring(0, 32)}... | Peranti: {session.deviceId}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-emerald-900/80 px-3 py-1.5 rounded-lg border border-emerald-700 text-emerald-200 font-mono self-start sm:self-auto">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {Math.floor(sessionTimeLeft / 60)}m {sessionTimeLeft % 60}s
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center space-x-3 text-xs text-slate-400">
            <Clock className="w-5 h-5 text-slate-500 shrink-0" />
            <div>
              <span className="text-slate-300 font-semibold">Tiada Sesi Kriptografi Aktif.</span> Sila klik &apos;Uji Sesi Kriptografi&apos; untuk memulakan jabat tangan cabaran-tindak balas (ECDSA P-256) dengan pelayan.
            </div>
          </div>
        )}

        {/* Challenge-Response Step-by-Step Audit Trail */}
        {authResult && authResult.exchangeSteps.length > 0 && (
          <div className="space-y-2 pt-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Jejak Audit Pertukaran Kriptografi (Audit Trail):</span>
              {authResult.burnedNonce && (
                <span className="flex items-center space-x-1 text-amber-400 text-[11px] font-mono">
                  <Flame className="w-3 h-3" />
                  <span>Nonce Terbakar: {authResult.burnedNonce}</span>
                </span>
              )}
            </div>

            <div className="space-y-2">
              {authResult.exchangeSteps.map((step) => (
                <div
                  key={step.stepNumber}
                  className={`p-3 rounded-lg border text-xs flex items-start space-x-3 ${
                    step.outcome === 'SUCCESS'
                      ? 'bg-slate-950/80 border-slate-800 text-slate-300'
                      : 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                      step.outcome === 'SUCCESS'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {step.stepNumber}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{step.title}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {step.actor}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-emerald-400 bg-slate-900/90 p-1.5 rounded border border-slate-800 break-all">
                      {step.payloadOrCommand}
                    </p>
                    <p className="text-[11px] text-slate-400">{step.technicalExplanation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Laporkan Kehilangan & Penggantian Peranti */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 border-b border-slate-800 pb-3">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="font-bold text-white text-base">Laporkan Kehilangan & Penggantian</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tindakan ini akan <strong>membatalkan serta-merta (REVOKE)</strong> kredensial digital semasa dan memutuskan pautan peranti aktif anda di pelayan mengikut dasar keselamatan SES v4.5.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Alasan Pembatalan / Kehilangan <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={replaceReason}
                onChange={(e) => setReplaceReason(e.target.value)}
                placeholder="Contoh: Telefon pintar hilang di Blok Akademik / Rosak sepenuhnya."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 transition"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReplaceModal(false)}
                disabled={processingReplace}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRevokeAndReplace}
                disabled={processingReplace}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-rose-950/50 flex items-center space-x-1.5"
              >
                {processingReplace ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Sahkan Pembatalan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
