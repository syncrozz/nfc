import React from 'react';
import { useAuth } from '../services/AuthContext';
import { Clock, ShieldAlert, CheckCircle, RefreshCw, LogOut, Building, Phone, Mail, User } from 'lucide-react';

interface ApplicationStatusBannerProps {
  onOpenAuth: () => void;
}

export const ApplicationStatusBanner: React.FC<ApplicationStatusBannerProps> = ({ onOpenAuth }) => {
  const { appUser, currentUser, logout, refreshUserProfile } = useAuth();

  if (!currentUser) {
    return (
      <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-800/60 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Sesi Tamu • Mod Simulasi & Ujian (DEMO)</h3>
            <p className="text-xs text-slate-400">
              Log masuk akaun staf KPMBP atau daftar permohonan baharu untuk pengesahan akses pintu fasiliti.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenAuth}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow-lg shadow-emerald-950/40 self-start sm:self-auto"
        >
          Log Masuk / Daftar Staf
        </button>
      </div>
    );
  }

  // If user profile is pending
  if (appUser?.status === 'PENDING') {
    return (
      <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border border-amber-800/70 rounded-2xl p-5 mb-6 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white">Permohonan Akses Staf: PENDING VERIFICATION</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  MENUNGGU KELULUSAN
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Permohonan anda ({appUser.staffId} • {appUser.fullName}) telah direkodkan. Kredensial digital disekat sehingga disahkan oleh Master Admin.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              onClick={refreshUserProfile}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition border border-slate-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Semak Status</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center space-x-1 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 px-3 py-1.5 rounded-lg text-xs transition border border-slate-700"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Keluar</span>
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
          <span>ID Staf: <strong className="text-slate-200">{appUser.staffId}</strong></span>
          <span>Jabatan: <strong className="text-slate-200">{appUser.department}</strong></span>
          <span>Email: <strong className="text-slate-200">{appUser.email}</strong></span>
          <span>No. Telefon: <strong className="text-slate-200">{appUser.phoneNumber}</strong></span>
        </div>
      </div>
    );
  }

  // If user profile is suspended or rejected
  if (appUser?.status === 'SUSPENDED' || appUser?.status === 'REJECTED') {
    return (
      <div className="bg-rose-950/60 border border-rose-800/70 rounded-2xl p-5 mb-6 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                AKSES DISEKAT: STATUS {appUser.status}
              </h3>
              <p className="text-xs text-rose-300 mt-0.5">
                {appUser.rejectionReason || 'Sila rujuk Unit Keselamatan & Pentadbiran Fasiliti KPMBP untuk semakan.'}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition border border-slate-700 self-start sm:self-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Keluar</span>
          </button>
        </div>
      </div>
    );
  }

  // User is APPROVED
  return (
    <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-800/60 rounded-2xl p-4 mb-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
          <CheckCircle className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-white">{appUser?.fullName || currentUser.displayName || 'Staf KPMBP'}</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              DISAHKAN • {appUser?.role || 'USER'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {appUser?.staffId} • {appUser?.department} • Kredensial NFC Dibenarkan
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2 self-start sm:self-auto">
        <button
          onClick={logout}
          className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition border border-slate-700"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Keluar</span>
        </button>
      </div>
    </div>
  );
};
