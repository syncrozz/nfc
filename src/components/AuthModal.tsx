import React, { useState } from 'react';
import { useAuth } from '../services/AuthContext';
import { Shield, Lock, Mail, User, Phone, Building, KeyRound, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { loginWithEmail, loginWithGoogle, registerWithEmail, error, clearError, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [staffId, setStaffId] = useState('');
  const [department, setDepartment] = useState('Jabatan Pengkomputeran & Sains');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalSuccess(null);

    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        onClose();
      } else {
        await registerWithEmail({
          email,
          pass: password,
          fullName,
          staffId,
          department,
          phoneNumber,
        });
        setLocalSuccess('Pendaftaran berjaya dihantar! Status akaun anda: PENDING kelulusan Master Admin.');
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch {
      // Error handled by AuthContext
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
      onClose();
    } catch {
      // Handled in context
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Top Accent */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-800/80 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                {mode === 'login' ? 'Log Masuk Staf KPMBP' : 'Pendaftaran Pengguna Baharu'}
              </h3>
              <p className="text-xs text-slate-400">SYNCROZZ Mobile Access • SES v4.5 Zero-Trust</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none p-1 rounded-lg hover:bg-slate-800 transition"
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Error Banner */}
          {error && (
            <div className="bg-rose-950/60 border border-rose-800/70 text-rose-300 text-xs p-3 rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {localSuccess && (
            <div className="bg-emerald-950/60 border border-emerald-800/70 text-emerald-300 text-xs p-3 rounded-xl flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{localSuccess}</span>
            </div>
          )}

          {/* Google Sign-in Option */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2.5 bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 font-medium py-2.5 px-4 rounded-xl text-xs transition duration-150 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.54 0 2.9.56 3.96 1.48l2.96-2.96C17.07 1.83 14.68 1 12 1 7.42 1 3.55 3.59 1.63 7.37l3.6 2.79C6.18 7.33 8.86 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.28c0-.79-.07-1.54-.19-2.28H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.68 2.86c2.14-1.98 3.75-4.89 3.75-8.67z"
              />
              <path
                fill="#FBBC05"
                d="M5.23 14.84c-.25-.74-.39-1.53-.39-2.34s.14-1.6.39-2.34L1.63 7.37C.6 9.44 0 11.66 0 14s.6 4.56 1.63 6.63l3.6-2.79z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.68-2.86c-1.07.72-2.45 1.16-4.25 1.16-3.14 0-5.82-2.33-6.77-5.16L1.63 16.02C3.55 19.8 7.42 23 12 23z"
              />
            </svg>
            <span>Log masuk menggunakan akaun Google</span>
          </button>

          <div className="flex items-center space-x-2 text-slate-500 text-[10px]">
            <div className="flex-1 h-px bg-slate-800" />
            <span>ATAU EMAIL RASMI</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <>
                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Nama Penuh (Mengikut Kad Pengenalan)</label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Ts. Khairul Anwar bin Azman"
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">ID Staf KPMBP</label>
                    <input
                      type="text"
                      required
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                      placeholder="e.g. KPMBP-8841"
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">No. Telefon</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="tel"
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="012-3456789"
                        className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-300 block mb-1">Jabatan / Unit</label>
                  <div className="relative">
                    <Building className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Jabatan Pengkomputeran & Sains">Jabatan Pengkomputeran & Sains</option>
                      <option value="Jabatan Pengurusan Perniagaan">Jabatan Pengurusan Perniagaan</option>
                      <option value="Unit Teknologi Maklumat & Rangkaian">Unit Teknologi Maklumat & Rangkaian</option>
                      <option value="Unit Pentadbiran & Keselamatan Fasiliti">Unit Pentadbiran & Keselamatan Fasiliti</option>
                      <option value="Pusat Sumber & Perpustakaan">Pusat Sumber & Perpustakaan</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Alamat Email</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staf@kpmbp.edu.my"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-300 block mb-1">Kata Laluan</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {mode === 'register' && (
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-[10px] text-slate-400 space-y-1">
                <div className="font-semibold text-emerald-400">Dasar Keselamatan SES-SEC-4.5.5:</div>
                <p>
                  Setiap pendaftaran bermula dengan status <strong>PENDING</strong>. Akses kepada kredensial digital NFC
                  hanya diaktifkan setelah semakan integriti oleh Master Admin.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-900/30 disabled:opacity-50 mt-2"
            >
              <span>{mode === 'login' ? 'Log Masuk' : 'Hantar Permohonan Akses'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Toggle Login/Register */}
          <div className="pt-2 text-center text-xs text-slate-400">
            {mode === 'login' ? (
              <span>
                Belum mendaftar?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    clearError();
                  }}
                  className="text-emerald-400 hover:underline font-medium"
                >
                  Daftar akaun staf
                </button>
              </span>
            ) : (
              <span>
                Sudah mempunyai akaun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    clearError();
                  }}
                  className="text-emerald-400 hover:underline font-medium"
                >
                  Log masuk di sini
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
