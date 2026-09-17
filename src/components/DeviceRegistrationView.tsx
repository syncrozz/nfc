import React, { useState } from 'react';
import { useAuth } from '../services/AuthContext';
import {
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  Key,
  CheckCircle2,
  Lock,
  Cpu,
} from 'lucide-react';
import { RegisteredDevice } from '../types';
import { sessionService } from '../services/sessionService';

interface DeviceRegistrationViewProps {
  devices: RegisteredDevice[];
  onRefresh: () => void;
}

export const DeviceRegistrationView: React.FC<DeviceRegistrationViewProps> = ({ devices, onRefresh }) => {
  const { appUser, reportDeviceLost } = useAuth();
  const [modelName, setModelName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activeDevice = devices.find((d) => d.status === 'ACTIVE');
  const userDevices = devices.filter((d) => d.userId === appUser?.id);

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim()) return;
    if (!appUser) return;
    setLoading(true);
    setSuccessMsg(null);
    try {
      const deviceId = `dev-${Date.now().toString(36)}`;
      const platform = navigator.userAgent.includes('Android') ? 'Android' : 'Web/PWA';
      const res = await sessionService.enrollDeviceAndCredential(appUser.id, deviceId, modelName.trim(), platform);
      setModelName('');
      setShowAddForm(false);
      setSuccessMsg(`Peranti '${modelName.trim()}' berjaya didaftarkan ke Android Keystore. Dasar 1-Peranti Aktif dikuatkuasakan secara automatik.`);
      onRefresh();
    } catch (err) {
      alert('Ralat mendaftar peranti: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleReportLost = async (deviceId: string) => {
    if (confirm('Adakah anda pasti ingin melaporkan telefon ini HILANG? Kredensial digital pada telefon ini akan dibatalkan serta-merta mengikut standard SES-SEC-4.5.5.')) {
      try {
        if (appUser) {
          await sessionService.revokeAndReplace(appUser.id, deviceId, 'Laporan kehilangan telefon oleh pengguna');
        } else {
          await reportDeviceLost(deviceId);
        }
        onRefresh();
        alert('Telefon dan kredensial telah dibatalkan dengan selamat.');
      } catch (err) {
        alert('Ralat laporan kehilangan: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            <span>Pendaftaran Peranti Mudah Alih & Pautan Keystore</span>
          </h2>
          <p className="text-xs text-slate-400">
            Dasar SES v4.5: Satu (1) peranti aktif sahaja dibenarkan menyimpan kredensial digital bagi setiap staf KPMBP.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition self-start sm:self-auto shadow-lg shadow-emerald-900/30"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Daftar / Ganti Telefon</span>
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl p-3.5 flex items-center space-x-2.5 text-emerald-300 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Register Form */}
      {showAddForm && (
        <form onSubmit={handleRegisterDevice} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 animate-in fade-in">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Pendaftaran Telefon & Penjanaan Kunci Keystore Baharu</span>
          </h3>
          <p className="text-xs text-slate-400">
            Peranti ini akan menjana pasangan kunci kriptografi ECDSA P-256 yang tidak boleh diekstrak (extractable: false) dan mengikatnya ke pelayan. Pendaftaran baharu akan membatalkan peranti aktif sedia ada secara automatik.
          </p>
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">Model Telefon Pintar</label>
            <input
              type="text"
              required
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g. Samsung Galaxy S24 / Google Pixel 8"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-lg text-xs text-white bg-emerald-600 hover:bg-emerald-500 font-semibold flex items-center space-x-1.5"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>Jana Kunci & Ikat Peranti</span>
            </button>
          </div>
        </form>
      )}

      {/* Device List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {userDevices.length === 0 ? (
          <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
            Tiada peranti didaftarkan. Klik butang <strong>&quot;Daftar / Ganti Telefon&quot;</strong> di atas.
          </div>
        ) : (
          userDevices.map((dev) => (
            <div
              key={dev.id}
              className={`bg-slate-900 border rounded-2xl p-5 space-y-3 transition ${
                dev.status === 'ACTIVE'
                  ? 'border-emerald-500/50 shadow-lg shadow-emerald-950/20'
                  : 'border-slate-800 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      dev.status === 'ACTIVE'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : dev.status === 'REVOKED'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{dev.deviceModel}</h4>
                    <div className="text-[11px] text-slate-400">{dev.platform}</div>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    dev.status === 'ACTIVE'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : dev.status === 'REVOKED'
                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                      : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}
                >
                  {dev.status}
                </span>
              </div>

              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Hardware Fingerprint:</span>
                  <span className="font-mono text-slate-300 truncate max-w-[170px]">{dev.fingerprint}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Keystore Alias:</span>
                  <span className="font-mono text-indigo-300 truncate max-w-[170px]">
                    {dev.keystoreAlias || `syncrozz_hw_${dev.userId}`}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tarikh Daftar:</span>
                  <span className="text-slate-300">{new Date(dev.createdAt).toLocaleDateString('ms-MY')}</span>
                </div>
              </div>

              {dev.status === 'ACTIVE' && (
                <div className="pt-2 flex justify-between items-center text-xs">
                  <span className="text-emerald-400 flex items-center space-x-1 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Kredensial Aktif pada Telefon Ini</span>
                  </span>
                  <button
                    onClick={() => handleReportLost(dev.id)}
                    className="text-rose-400 hover:text-rose-300 text-[11px] font-medium underline flex items-center space-x-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Lapor Telefon Hilang</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Security Note */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-1.5">
        <div className="font-semibold text-white flex items-center space-x-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>Integriti Peranti & Pencegahan Pengklonan (SES-SEC-4.5.5)</span>
        </div>
        <p>
          Kredensial akses SYNCROZZ diikat secara kriptografi kepada modul keselamatan perkakasan (Android KeyStore StrongBox / TEE)
          telefon ini. Kredensial tidak boleh diekstrak, disalin, atau dipindahkan ke telefon lain tanpa pengesahan semula
          oleh Master Admin.
        </p>
      </div>
    </div>
  );
};
