import React, { useState, useEffect } from 'react';
import {
  Server,
  Radio,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Unlock,
  Cpu,
  RefreshCw,
  Activity,
  Terminal,
  Wifi,
  WifiOff,
  Layers,
  AlertOctagon,
  ArrowRight,
  Clock,
  KeyRound,
  ShieldAlert,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
  ClipboardCheck,
  HelpCircle,
  ShieldOff,
} from 'lucide-react';
import {
  pacsGatewayService,
  AUDITED_KPMBP_READERS,
  AUDITED_KPMBP_GATEWAYS,
  KPMBP_STRIDE_THREATS,
} from '../services/pacsGatewayService';
import {
  PacsGatewayDevice,
  ReaderHardwareProfile,
  PacsAccessTransaction,
  StrideThreatModelItem,
  HardwareVerificationItem,
} from '../types';

export const PacsGatewayTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'verification' | 'architecture' | 'readers' | 'simulator' | 'stride' | 'audit'>('verification');
  const [gateways, setGateways] = useState<PacsGatewayDevice[]>(pacsGatewayService.getGateways());
  const [readers, setReaders] = useState<ReaderHardwareProfile[]>(pacsGatewayService.getReaders());
  const [transactions, setTransactions] = useState<PacsAccessTransaction[]>(pacsGatewayService.getTransactions());
  const [strideThreats] = useState<StrideThreatModelItem[]>(pacsGatewayService.getThreatModel());
  const [checklist] = useState<HardwareVerificationItem[]>(pacsGatewayService.getHardwareChecklist());
  const [auditClass] = useState(pacsGatewayService.getHardwareAuditClassification());

  // Simulator state
  const [simReaderId, setSimReaderId] = useState<string>(readers[2]?.id || 'rdr-eng-2-204');
  const [simBadgeType, setSimBadgeType] = useState<'ANDROID_HCE_P256' | 'MIFARE_CLASSIC_1K' | 'WIEGAND_UNENCRYPTED_CARD' | 'CLONED_STATIC_UID'>('ANDROID_HCE_P256');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [lastTx, setLastTx] = useState<PacsAccessTransaction | null>(null);

  // Subscribe to gateway service updates
  useEffect(() => {
    const unsub = pacsGatewayService.subscribe(() => {
      setGateways(pacsGatewayService.getGateways());
      setReaders(pacsGatewayService.getReaders());
      setTransactions(pacsGatewayService.getTransactions());
    });
    return () => unsub();
  }, []);

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const tx = await pacsGatewayService.simulateBadgePresentation({
        readerId: simReaderId,
        badgeType: simBadgeType,
      });
      setLastTx(tx);
    } catch (e) {
      console.error('Simulation error', e);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleHeartbeat = (gwId: string) => {
    pacsGatewayService.simulateHeartbeat(gwId);
  };

  const handleToggleOffline = (gwId: string) => {
    pacsGatewayService.toggleOfflineMode(gwId);
  };

  const handleTriggerTamper = (gwId: string) => {
    pacsGatewayService.triggerTamperAlarm(gwId);
  };

  const handleRecoverGateway = (gwId: string) => {
    pacsGatewayService.recoverGateway(gwId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Server className="w-5 h-5 text-indigo-400" />
            <span>PACs Gateway & Reader Hardware Integration</span>
          </h2>
          <p className="text-xs text-slate-400">
            Phase 3B: Hardware audit, SIA OSDP v2.2 / Wiegand protocol adapters, mTLS edge gateway, and Zero-Trust access simulation.
          </p>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveSubTab('verification')}
            className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap flex items-center space-x-1.5 ${
              activeSubTab === 'verification' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Hardware Verification Gate</span>
          </button>
          <button
            onClick={() => setActiveSubTab('architecture')}
            className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              activeSubTab === 'architecture' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Gateway Topology
          </button>
          <button
            onClick={() => setActiveSubTab('readers')}
            className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              activeSubTab === 'readers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Reader Compatibility Audit
          </button>
          <button
            onClick={() => setActiveSubTab('simulator')}
            className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              activeSubTab === 'simulator' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Mock Reader Simulator
          </button>
          <button
            onClick={() => setActiveSubTab('stride')}
            className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              activeSubTab === 'stride' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            STRIDE Threat Model
          </button>
          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              activeSubTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Audit Logs ({transactions.length})
          </button>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-4 flex items-start space-x-3 text-xs">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-200 flex items-center space-x-2">
            <span>SES v4.5 Zero-Trust Hardware Verification Gate: ENFORCED</span>
            <span className="text-[10px] bg-amber-900/80 text-amber-200 px-2 py-0.5 rounded border border-amber-700">
              SIMULATION MODE ONLY
            </span>
          </p>
          <p className="text-amber-300/80 leading-relaxed">
            All physical campus reader models, firmware revisions, and RS-485 bus wiring remain <strong>UNVERIFIED (Marked as UNKNOWN)</strong> until authorized on-site physical disassembly and oscilloscope bus traces are conducted. No live access controllers are connected or modified, and physical access compatibility is strictly not claimed.
          </p>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* SUBTAB 0: Hardware Verification Gate (Checklist & Classification) */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'verification' && (
        <div className="space-y-6">
          {/* Classification Breakdown: Verified vs Assumed vs Simulated */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Verified */}
            <div className="bg-slate-900 border border-emerald-900/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-2 border-b border-emerald-900/40 pb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Komponen Disahkan (Verified)
                </h3>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {auditClass.verified.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-[11px] leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. Assumed (Marked as UNKNOWN) */}
            <div className="bg-slate-900 border border-amber-900/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-2 border-b border-amber-900/40 pb-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Komponen Diandaikan (UNKNOWN)
                </h3>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {auditClass.assumed.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-[11px] leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 3. Simulated */}
            <div className="bg-slate-900 border border-indigo-900/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center space-x-2 border-b border-indigo-900/40 pb-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Komponen Simulasi (Bench Mode)
                </h3>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                {auditClass.simulated.map((item, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-[11px] leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 6-Point Physical Hardware Verification Checklist */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <ClipboardCheck className="w-4 h-4 text-amber-400" />
                  <span>Senarai Semak Pengesahan Perkakasan Fizikal (6 Kriteria SES v4.5)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Setiap lokasi fizikal mesti diaudit sebelum sebarang pengesahan keserasian akses sebenar dibenarkan.
                </p>
              </div>

              <span className="px-2.5 py-1 bg-rose-950 text-rose-300 border border-rose-800 rounded-md text-[11px] font-mono font-bold self-start sm:self-auto">
                Tuntutan Keserasian Fizikal: DISEKAT
              </span>
            </div>

            <div className="space-y-4">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                    <div>
                      <span className="text-sm font-bold text-white">{item.readerName}</span>
                      <span className="text-xs text-slate-500 font-mono ml-2">ID: {item.readerId} • Lokasi: {item.locationId}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        Status Keseluruhan: <strong className="text-amber-400">{item.overallStatus}</strong>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                        Akses Fizikal: DILARANG
                      </span>
                    </div>
                  </div>

                  {/* 6 Criteria Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                    {/* 1. Model & Firmware */}
                    <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
                        <span>1. Model & Firmware</span>
                        <span className="text-rose-400 font-bold">UNVERIFIED</span>
                      </div>
                      <div className="font-semibold text-slate-200">{item.checklist.readerModelAndFirmware.value}</div>
                      <div className="text-[11px] text-slate-400">{item.checklist.readerModelAndFirmware.notes}</div>
                    </div>

                    {/* 2. Interface & Protocol */}
                    <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
                        <span>2. Antara Muka & Protokol</span>
                        <span className="text-rose-400 font-bold">UNVERIFIED</span>
                      </div>
                      <div className="font-semibold text-slate-200">{item.checklist.interfaceAndProtocol.value}</div>
                      <div className="text-[11px] text-slate-400">{item.checklist.interfaceAndProtocol.notes}</div>
                    </div>

                    {/* 3. Frequency & Credential Type */}
                    <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
                        <span>3. Frekuensi & Jenis Kad</span>
                        <span className="text-rose-400 font-bold">UNVERIFIED</span>
                      </div>
                      <div className="font-semibold text-slate-200">{item.checklist.frequencyAndCredentialType.value}</div>
                      <div className="text-[11px] text-slate-400">{item.checklist.frequencyAndCredentialType.notes}</div>
                    </div>

                    {/* 4. OSDP/Wiegand Support */}
                    <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
                        <span>4. Sokongan OSDP / Wiegand</span>
                        <span className="text-rose-400 font-bold">UNVERIFIED</span>
                      </div>
                      <div className="font-semibold text-slate-200">{item.checklist.osdpOrWiegandSupport.value}</div>
                      <div className="text-[11px] text-slate-400">{item.checklist.osdpOrWiegandSupport.notes}</div>
                    </div>

                    {/* 5. Android HCE Compatibility */}
                    <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
                        <span>5. Keserasian Android HCE</span>
                        <span className="text-rose-400 font-bold">UNVERIFIED</span>
                      </div>
                      <div className="font-semibold text-slate-200">{item.checklist.androidHceCompatibility.value}</div>
                      <div className="text-[11px] text-slate-400">{item.checklist.androidHceCompatibility.notes}</div>
                    </div>

                    {/* 6. Vendor Documentation */}
                    <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1">
                      <div className="text-[10px] uppercase font-mono text-slate-400 flex items-center justify-between">
                        <span>6. Dokumentasi Vendor</span>
                        <span className="text-rose-400 font-bold">UNVERIFIED</span>
                      </div>
                      <div className="font-semibold text-slate-200">{item.checklist.vendorDocumentation.docRef}</div>
                      <div className="text-[11px] text-slate-400">{item.checklist.vendorDocumentation.notes}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SUBTAB 1: Gateway Architecture & Telemetry */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'architecture' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {gateways.map((gw) => (
              <div
                key={gw.gatewayId}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                      <Server className="w-4 h-4 text-indigo-400" />
                      <span>{gw.name}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{gw.gatewayId}</p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold border ${
                      gw.status === 'ONLINE_CONNECTED'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        : gw.status === 'DEGRADED'
                        ? 'bg-amber-950/60 text-amber-300 border-amber-800'
                        : gw.status === 'TAMPER_ALARM'
                        ? 'bg-rose-950/60 text-rose-300 border-rose-800 animate-pulse'
                        : gw.status === 'OFFLINE_AUTONOMOUS'
                        ? 'bg-blue-950/60 text-blue-300 border-blue-800'
                        : 'bg-purple-950/60 text-purple-300 border-purple-800'
                    }`}
                  >
                    {gw.status}
                  </span>
                </div>

                {/* Gateway Metadata Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Lokasi Bangunan</span>
                    <span className="text-slate-200">{gw.building}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">IP / MAC Enclave</span>
                    <span className="text-slate-300">{gw.ipAddress}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Kependaman (Latency)</span>
                    <span className="text-emerald-400">{gw.latencyMs} ms</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Keciciran Paket</span>
                    <span className={gw.packetLossRate > 0 ? 'text-amber-400' : 'text-slate-300'}>
                      {gw.packetLossRate}%
                    </span>
                  </div>
                </div>

                {/* Security & Cryptographic Provenance */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center space-x-1">
                      <Lock className="w-3 h-3 text-indigo-400" />
                      <span>mTLS 1.3 Sijil:</span>
                    </span>
                    <span className="text-emerald-400 font-mono text-[10px]">SAH (SHA-256)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono truncate">{gw.mtlsCertificateSubject}</p>
                </div>

                {/* Connected Readers */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-300 block">
                    Pembaca Bersambung ({gw.readers.length}):
                  </span>
                  <div className="space-y-1">
                    {gw.readers.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between bg-slate-950/50 px-2.5 py-1.5 rounded text-[11px] border border-slate-800/60"
                      >
                        <span className="text-slate-300 truncate max-w-[150px]">{r.name}</span>
                        <span className="text-indigo-400 font-mono text-[10px]">{r.protocol}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gateway Control Actions */}
                <div className="pt-2 flex items-center space-x-2">
                  <button
                    onClick={() => handleHeartbeat(gw.gatewayId)}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition flex items-center justify-center space-x-1"
                  >
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Heartbeat</span>
                  </button>

                  <button
                    onClick={() => handleToggleOffline(gw.gatewayId)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium transition"
                    title="Uji Mod Luar Talian Berautonomi"
                  >
                    {gw.status === 'OFFLINE_AUTONOMOUS' ? (
                      <Wifi className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  {gw.status === 'TAMPER_ALARM' ? (
                    <button
                      onClick={() => handleRecoverGateway(gw.gatewayId)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Pulihkan</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTriggerTamper(gw.gatewayId)}
                      className="px-2.5 py-1.5 bg-rose-900/40 hover:bg-rose-900/70 border border-rose-800 text-rose-300 rounded text-xs font-medium transition"
                      title="Uji Penggera Tamper Enclosure"
                    >
                      <AlertOctagon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Architecture Topology Description */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>SES v4.5 Topologi Edge PACs Gateway & Rangkaian Selamat</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <h4 className="font-semibold text-white flex items-center space-x-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Downstream: Bus Pembaca (RS-485)</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  Menggunakan protokol SIA OSDP v2.2 dengan Secure Channel AES-128. Menggantikan talian nadi Wiegand terdedah untuk menghalang serangan pintasan fizikal (wire-tapping).
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <h4 className="font-semibold text-white flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Upstream: Saluran Autoriti mTLS 1.3</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  Pengesahan dwi-hala berasaskan sijil X.509 EC P-256 antara Edge Gateway dan Cloud Authority. Semua keputusan akses disahkan secara berpusat dengan audit kriptografi.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                <h4 className="font-semibold text-white flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Mod Berautonomi (Zero-Trust Fallback)</span>
                </h4>
                <p className="text-slate-400 text-[11px]">
                  Semasa gangguan sambungan, get laluan mengesahkan token kelayakan yang telah ditandatangani dan belum luput daripada cache selamat, dengan pengasingan serta-merta jika suis tamper tercetus.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SUBTAB 2: Reader Compatibility Audit */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'readers' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Pembaca & Model</th>
                    <th className="py-3 px-4">Antara Muka Fizikal</th>
                    <th className="py-3 px-4">Protokol Komunikasi</th>
                    <th className="py-3 px-4">Penyulitan</th>
                    <th className="py-3 px-4">Status Pengesahan</th>
                    <th className="py-3 px-4">Keserasian HCE Android</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {readers.map((r) => {
                    const isHceReady = r.protocol === 'OSDP_V2_SECURE_CHANNEL' || r.protocol === 'ISO_14443_4_HCE';
                    return (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-white block">{r.name}</span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {r.model} • {r.manufacturer}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {r.physicalInterface.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded font-medium ${
                              r.protocol === 'OSDP_V2_SECURE_CHANNEL'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                : r.protocol === 'WIEGAND_LEGACY'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {r.protocol}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {r.supportsEncryption ? (
                            <span className="text-emerald-400 font-medium flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{r.encryptionStandard || 'Ya (AES)'}</span>
                            </span>
                          ) : (
                            <span className="text-rose-400 font-medium flex items-center space-x-1">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Tiada (Unencrypted)</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium ${
                              r.physicalVerificationStatus === 'BENCH_SIMULATED_ONLY'
                                ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {r.physicalVerificationStatus === 'BENCH_SIMULATED_ONLY'
                              ? 'BENCH_SIMULATED_ONLY'
                              : 'UNKNOWN (Unverified)'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {r.physicalVerificationStatus === 'BENCH_SIMULATED_ONLY' ? (
                            <span className="text-indigo-400 font-medium flex items-center space-x-1">
                              <Cpu className="w-4 h-4" />
                              <span>SIMULASI OSDP (Fizikal Belum Sah)</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium flex items-center space-x-1">
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                              <span>UNKNOWN (Perlu Audit Fizikal)</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SUBTAB 3: Mock Reader Simulator */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Simulation Controls */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Play className="w-4 h-4 text-emerald-400" />
              <span>Konfigurasi Ujian Tap Pembaca</span>
            </h3>

            {/* Target Reader Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Pilih Pembaca Sasaran (Target Reader):</label>
              <select
                value={simReaderId}
                onChange={(e) => setSimReaderId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              >
                {readers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.protocol})
                  </option>
                ))}
              </select>
            </div>

            {/* Badge Type Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Jenis Peranti / Lencana Dibentangkan:</label>
              <div className="space-y-2">
                {[
                  {
                    id: 'ANDROID_HCE_P256',
                    title: 'Telefon Pintar Android HCE (SES v4.5)',
                    desc: 'Keystore EC P-256 challenge-response, AID A0000008410001.',
                  },
                  {
                    id: 'MIFARE_CLASSIC_1K',
                    title: 'Kad Fizikal NXP MIFARE Classic 1K',
                    desc: 'Transponder fizikal legasi KPMBP (CRYPTO1 sector keys).',
                  },
                  {
                    id: 'CLONED_STATIC_UID',
                    title: 'Serangan Pengklonan UID (Flipper Zero / Proxmark)',
                    desc: 'Percubaan replikasi CSN 4-byte statik tanpa bukti kriptografi.',
                  },
                  {
                    id: 'WIEGAND_UNENCRYPTED_CARD',
                    title: 'Lencana Legasi Wiegand 26-bit',
                    desc: 'Nadi D0/D1 tanpa penyulitan (Facility Code + Card Number).',
                  },
                ].map((b) => (
                  <label
                    key={b.id}
                    onClick={() => setSimBadgeType(b.id as any)}
                    className={`block p-3 rounded-lg border cursor-pointer transition ${
                      simBadgeType === b.id
                        ? 'bg-indigo-950/40 border-indigo-500 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs">{b.title}</span>
                      <input
                        type="radio"
                        name="badgeType"
                        checked={simBadgeType === b.id}
                        onChange={() => {}}
                        className="text-indigo-600 focus:ring-0"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{b.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            {/* Execute Button */}
            <button
              id="btn-execute-reader-sim"
              onClick={handleSimulate}
              disabled={isSimulating}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/40"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses Jabat Tangan Kriptografi...</span>
                </>
              ) : (
                <>
                  <Radio className="w-4 h-4" />
                  <span>Simulasi Tap Lencana Sekarang</span>
                </>
              )}
            </button>
          </div>

          {/* Simulation Output Display */}
          <div className="lg:col-span-7 space-y-4">
            {lastTx ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span>Keputusan Penilaian Protokol & Gerbang</span>
                  </h3>
                  <span
                    className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                      lastTx.decision === 'GRANTED'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                        : lastTx.decision === 'DENIED_TAMPER_LOCKDOWN'
                        ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                        : 'bg-amber-950/60 text-amber-300 border-amber-800'
                    }`}
                  >
                    {lastTx.decision}
                  </span>
                </div>

                {/* Technical Diagnostic Details */}
                <div className="space-y-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Pengecam Transaksi:</span>
                      <span className="text-slate-300">{lastTx.id}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Protokol Digunakan:</span>
                      <span className="text-indigo-400 font-bold">{lastTx.protocolUsed}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Kaedah Pengesahan:</span>
                      <span className="text-cyan-400">{lastTx.cryptographicValidationMethod}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Tempoh Respons (Latency):</span>
                      <span className="text-emerald-400 font-bold">{lastTx.durationMs} ms</span>
                    </div>
                  </div>

                  {/* Packet Snippet */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400">Paket Protokol Diterima:</span>
                    <div className="bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-emerald-400 break-all">
                      {lastTx.rawPayloadSnippet}
                    </div>
                  </div>

                  {/* Diagnostic Explanation */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400">Penerangan Keselamatan SES v4.5:</span>
                    <p className="text-slate-300 text-xs bg-slate-950/50 p-3 rounded border border-slate-800 leading-relaxed">
                      {lastTx.diagnosticNotes}
                    </p>
                  </div>

                  {/* Relay Safety Guard Notice */}
                  <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-800/60 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Lock className="w-4 h-4 text-indigo-400" />
                      <span className="text-[11px] text-indigo-200">
                        Kawalan Geganti Fizikal: <strong>{lastTx.relayTriggered ? 'TERPANDU (SIMULASI)' : 'TERKUNCI'}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Safety-Guarded Relay</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400 space-y-3">
                <Radio className="w-12 h-12 text-slate-600 mx-auto" />
                <h4 className="text-sm font-semibold text-white">Sedia untuk Simulasi</h4>
                <p className="text-xs max-w-sm mx-auto">
                  Pilih pembaca sasaran dan jenis lencana di sebelah kiri, kemudian klik "Simulasi Tap Lencana Sekarang" untuk menguji pengesahan protokol.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SUBTAB 4: STRIDE Threat Model Assessment */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'stride' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Penilaian Ancaman STRIDE — Infrastruktur PACs & Reader Bus</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Analisis ancaman sistematik terhadap perkakasan pembaca, talian wayar, dan gerbang kawalan akses mengikut piawaian SYNCROZZ Zero-Trust.
            </p>

            <div className="space-y-3 pt-2">
              {strideThreats.map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-indigo-400">{t.id}</span>
                      <span className="text-xs font-semibold text-white">[{t.category}]</span>
                      <span className="text-xs text-slate-300 truncate">— {t.targetComponent}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold self-start sm:self-auto ${
                        t.riskLevel === 'CRITICAL'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : t.riskLevel === 'HIGH'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}
                    >
                      RISIKO: {t.riskLevel}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400">{t.threatDescription}</p>

                  <div className="pt-1.5 border-t border-slate-800/80 text-[11px] grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 font-semibold">Mitigasi SES v4.5:</span>
                      <p className="text-emerald-400">{t.sesMitigation}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold">Kaedah Pengesahan:</span>
                      <p className="text-slate-300">{t.verificationMethod}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* SUBTAB 5: Real-Time Audit Logs */}
      {/* ----------------------------------------------------------------- */}
      {activeSubTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden space-y-3">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Log Transaksi & Pengesahan Gerbang PACs</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">Jumlah Entri: {transactions.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Masa</th>
                  <th className="py-2.5 px-4">Pembaca / Lokasi</th>
                  <th className="py-2.5 px-4">Protokol</th>
                  <th className="py-2.5 px-4">Kelayakan</th>
                  <th className="py-2.5 px-4">Pengesahan</th>
                  <th className="py-2.5 px-4">Keputusan</th>
                  <th className="py-2.5 px-4">Kependaman</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                      {new Date(tx.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 text-slate-200">
                      <span className="font-sans font-medium block">{tx.locationName}</span>
                      <span className="text-[10px] text-slate-500">{tx.readerId}</span>
                    </td>
                    <td className="py-2.5 px-4 text-indigo-400">{tx.protocolUsed}</td>
                    <td className="py-2.5 px-4 text-slate-300 truncate max-w-[140px]">
                      {tx.credentialIdentifier}
                    </td>
                    <td className="py-2.5 px-4 text-cyan-300 text-[10px]">
                      {tx.cryptographicValidationMethod}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          tx.decision === 'GRANTED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {tx.decision}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-emerald-400">{tx.durationMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
