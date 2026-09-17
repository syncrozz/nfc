import React, { useState } from 'react';
import {
  Cpu,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Info,
  Radio,
  FileCode,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { NfcDiagnosticResult } from '../types';

interface CompatibilityMatrixTabProps {
  diagnostic: NfcDiagnosticResult | null;
  onRefreshDiagnostic: () => void;
}

export const CompatibilityMatrixTab: React.FC<CompatibilityMatrixTabProps> = ({
  diagnostic,
  onRefreshDiagnostic,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'mifare_analysis' | 'device_probe' | 'migration'>('matrix');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <span>NFC Capability & Technology Compatibility Matrix</span>
          </h2>
          <p className="text-xs text-slate-400">
            Evidence-based technical assessment of Android NFC vs NXP MIFARE Classic 1K under SES v4.5.
          </p>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('matrix')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeSubTab === 'matrix' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Technology Matrix
          </button>
          <button
            onClick={() => setActiveSubTab('mifare_analysis')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeSubTab === 'mifare_analysis' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            MIFARE Classic Analysis
          </button>
          <button
            onClick={() => setActiveSubTab('device_probe')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeSubTab === 'device_probe' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Device Probe
          </button>
          <button
            onClick={() => setActiveSubTab('migration')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              activeSubTab === 'migration' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Migration Roadmap
          </button>
        </div>
      </div>

      {/* SUBTAB 1: Technology Compatibility Matrix */}
      {activeSubTab === 'matrix' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Access Technology</th>
                    <th className="py-3 px-4">Radio Standard</th>
                    <th className="py-3 px-4">Android HCE Support</th>
                    <th className="py-3 px-4">Cryptographic Layer</th>
                    <th className="py-3 px-4">SES v4.5 Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {/* Android HCE */}
                  <tr className="hover:bg-slate-850/50">
                    <td className="py-3 px-4 font-semibold text-white flex items-center space-x-2">
                      <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Android Host Card Emulation (HCE)</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">ISO/IEC 14443-4 Type A</td>
                    <td className="py-3 px-4 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                      Fully Supported (Android 4.4+)
                    </td>
                    <td className="py-3 px-4 text-slate-300">ISO 7816-4 APDU / AES-128 / EC</td>
                    <td className="py-3 px-4">
                      <span className="bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 text-[10px] font-semibold">
                        APPROVED PLATFORM
                      </span>
                    </td>
                  </tr>

                  {/* MIFARE Classic 1K */}
                  <tr className="hover:bg-slate-850/50 bg-rose-950/10">
                    <td className="py-3 px-4 font-semibold text-rose-200 flex items-center space-x-2">
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <div>
                        <span>NXP MIFARE Classic 1K / 4K</span>
                        <span className="block text-[10px] text-rose-400/80 font-normal">
                          Identified in KPMBP physical badge
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">ISO/IEC 14443-3A (Proprietary)</td>
                    <td className="py-3 px-4 text-rose-400 font-medium">
                      <XCircle className="w-3.5 h-3.5 inline mr-1 text-rose-400" />
                      Strictly Unsupported
                    </td>
                    <td className="py-3 px-4 text-slate-300">Proprietary CRYPTO1 (48-bit Key)</td>
                    <td className="py-3 px-4">
                      <span className="bg-rose-950/80 text-rose-300 px-2 py-0.5 rounded border border-rose-800 text-[10px] font-semibold">
                        HARDWARE INCOMPATIBLE
                      </span>
                    </td>
                  </tr>

                  {/* BLE Mobile Access */}
                  <tr className="hover:bg-slate-850/50">
                    <td className="py-3 px-4 font-semibold text-white flex items-center space-x-2">
                      <Radio className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Bluetooth Low Energy (BLE) Access</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">BLE 4.2 / 5.0 GATT (2.4 GHz)</td>
                    <td className="py-3 px-4 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                      Fully Supported (Peripheral Mode)
                    </td>
                    <td className="py-3 px-4 text-slate-300">AES-128 / ECDH Secure Channel</td>
                    <td className="py-3 px-4">
                      <span className="bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 text-[10px] font-semibold">
                        RECOMMENDED PARALLEL
                      </span>
                    </td>
                  </tr>

                  {/* MIFARE DESFire EV2/EV3 */}
                  <tr className="hover:bg-slate-850/50">
                    <td className="py-3 px-4 font-semibold text-white flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>MIFARE DESFire (EV1 / EV2 / EV3)</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">ISO/IEC 14443-4 Type A</td>
                    <td className="py-3 px-4 text-amber-300 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-amber-400" />
                      Partial (Software APDU Emulation)
                    </td>
                    <td className="py-3 px-4 text-slate-300">3DES / AES-128 Session Keys</td>
                    <td className="py-3 px-4">
                      <span className="bg-blue-950/80 text-blue-300 px-2 py-0.5 rounded border border-blue-800 text-[10px] font-semibold">
                        APPROVED MIGRATION TARGET
                      </span>
                    </td>
                  </tr>

                  {/* NDEF Data Exchange */}
                  <tr className="hover:bg-slate-850/50">
                    <td className="py-3 px-4 font-semibold text-white flex items-center space-x-2">
                      <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>NFC Forum NDEF Tag Exchange</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">NFC Forum Type 4 Tag</td>
                    <td className="py-3 px-4 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                      Fully Supported (Read / Write / HCE)
                    </td>
                    <td className="py-3 px-4 text-slate-300">Unencrypted / Signatures Only</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 text-[10px] font-semibold">
                        CONFIGURATION ONLY
                      </span>
                    </td>
                  </tr>

                  {/* Embedded Secure Element (eSE) */}
                  <tr className="hover:bg-slate-850/50">
                    <td className="py-3 px-4 font-semibold text-white flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Embedded Secure Element (eSE / UICC)</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">GlobalPlatform Card Spec</td>
                    <td className="py-3 px-4 text-slate-400 font-medium">
                      Restricted to Carrier / OEM (Google Wallet)
                    </td>
                    <td className="py-3 px-4 text-slate-300">Hardware Tamper-Resistant Crypto</td>
                    <td className="py-3 px-4">
                      <span className="bg-purple-950/80 text-purple-300 px-2 py-0.5 rounded border border-purple-800 text-[10px] font-semibold">
                        OEM WALLET CHANNEL
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: MIFARE Classic Technical Limitation Breakdown */}
      {activeSubTab === 'mifare_analysis' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Evidence-Based Technical Analysis: Why Standard Android Cannot Emulate MIFARE Classic 1K</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              When evaluating mobile access compatibility for KPMBP, users frequently ask why an Android phone cannot simply
              &quot;copy&quot; or &quot;emulate&quot; their existing physical card. Under SYNCROZZ ENGINEERING STANDARD (SES) v4.5,
              all architectural decisions must be grounded in physical and cryptographic reality:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Pillar 1 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-white text-xs font-bold">
                  <span className="w-5 h-5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 flex items-center justify-center font-mono text-[10px]">
                    1
                  </span>
                  <span>Physical & Framing Protocol Disconnect</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  MIFARE Classic cards operate at the <strong>ISO 14443-3A</strong> layer using proprietary bit-level commands
                  (7-bit WUPA/REQA request, proprietary 4-bit and 1-bit ACK/NAK responses). Standard Android Host-based Card Emulation
                  (HCE) only activates after full ISO 14443-4 transport handshake (RATS/ATS). An unrooted Android NFC controller
                  does not allow third-party apps to intercept or formulate raw ISO 14443-3A frames.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-white text-xs font-bold">
                  <span className="w-5 h-5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 flex items-center justify-center font-mono text-[10px]">
                    2
                  </span>
                  <span>Proprietary NXP CRYPTO1 Stream Cipher</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  MIFARE Classic 1K sectors are protected by 48-bit secret keys (Key A and Key B) utilizing a proprietary
                  stream cipher called <strong>CRYPTO1</strong> with a 48-bit Linear Feedback Shift Register (LFSR). Modern smartphone
                  NFC transceivers (Broadcom BCM series, STMicroelectronics ST21N, Samsung Shannon) do not contain hardware CRYPTO1
                  co-processors for emulation, and AOSP HCE exposes no hook to compute CRYPTO1 challenges.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-white text-xs font-bold">
                  <span className="w-5 h-5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 flex items-center justify-center font-mono text-[10px]">
                    3
                  </span>
                  <span>Mandatory Anti-Collision UID Randomization</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Legacy door systems that only check the physical card serial number (CSN/UID) cannot work with Android HCE.
                  Android OS strictly enforces <strong>UID randomization</strong> for consumer privacy (UID prefix starts with
                  <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded ml-1">0x08</code>). The phone presents a completely
                  different 4-byte UID on every single tap, which door controllers reject as an unknown card.
                </p>
              </div>

              {/* Pillar 4 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-white text-xs font-bold">
                  <span className="w-5 h-5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 flex items-center justify-center font-mono text-[10px]">
                    4
                  </span>
                  <span>SES v4.5 Anti-Bypass & Security Standard</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  While unauthorized &quot;UID-spoofing&quot; tools exist on modified/rooted Android kernels with custom NFC firmware,
                  SYNCROZZ ENGINEERING STANDARD <strong>strictly forbids</strong> bypassing access control through credential extraction,
                  UID spoofing, or card cloning. Mobile access must be deployed on standardized, cryptographically verifiable protocols.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Live Device & Browser NFC Probe */}
      {activeSubTab === 'device_probe' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Live Host Runtime & Hardware Inspection</h3>
              </div>
              <button
                id="btn-refresh-device-probe"
                onClick={onRefreshDiagnostic}
                className="flex items-center space-x-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-slate-800 px-2.5 py-1.5 rounded-md border border-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-probe Environment</span>
              </button>
            </div>

            {diagnostic ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">NFC Subsystem Status</span>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Web NFC API (`NDEFReader`):</span>
                    <span className={diagnostic.webNfcSupported ? 'text-emerald-400 font-bold' : 'text-slate-500 font-mono'}>
                      {diagnostic.webNfcSupported ? 'Detected in Runtime' : 'Not Supported in this Browser Engine'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Web NFC Permission:</span>
                    <span className="text-slate-300 font-mono">{diagnostic.webNfcPermissionState}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Android HostApduService Spec:</span>
                    <span className="text-emerald-400 font-semibold">Available via Native Companion</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">MIFARE Classic 1K Emulation:</span>
                    <span className="text-rose-400 font-bold">BLOCKED / IMPOSSIBLE</span>
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <span className="text-[10px] font-mono uppercase text-slate-500 block">Host Platform Diagnostics</span>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Detected OS:</span>
                    <span className="text-white font-medium">{diagnostic.isAndroid ? 'Android OS' : 'Desktop / Non-Android'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Screen Resolution:</span>
                    <span className="text-slate-300 font-mono">{diagnostic.screenResolution}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">CPU Concurrency:</span>
                    <span className="text-slate-300 font-mono">{diagnostic.hardwareConcurrency} Cores</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Touch Capabilities:</span>
                    <span className="text-slate-300 font-mono">{diagnostic.touchPoints} Touchpoints</span>
                  </div>
                </div>

                <div className="col-span-full bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 font-mono break-all">
                  <span className="text-slate-500 block mb-1">User Agent String:</span>
                  {diagnostic.userAgent}
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-xs text-center py-6">Initializing diagnostic engine...</div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: Migration Roadmap */}
      {activeSubTab === 'migration' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <span>Recommended KPMBP Physical-to-Mobile Access Migration Roadmap</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Because standard Android phones cannot emulate MIFARE Classic 1K, KPMBP facilities must execute a phased
              migration strategy to achieve seamless mobile door access:
            </p>

            <div className="space-y-3 pt-2">
              {/* Phase 1 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-start space-x-3">
                <div className="w-7 h-7 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">
                    Phase 1: Foundation, Compatibility Assessment & Audit (Current Phase)
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Audit all door readers at KPMBP (office rooms, library, labs). Confirm reader models and whether any
                    support ISO 14443-4 APDU or BLE. Implement the SYNCROZZ mobile access foundation and credential abstraction
                    layer. <strong>Maintain 100% of physical MIFARE Classic badges.</strong>
                  </p>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-start space-x-3">
                <div className="w-7 h-7 rounded-full bg-blue-950 text-blue-400 border border-blue-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">
                    Phase 2: Reader Migration to Dual-Technology (OSDP v2 + BLE + APDU)
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Prioritize high-traffic turnstiles (Library) and critical facilities (Engineering Lab, Server Room) by
                    installing dual-frequency multi-technology readers (e.g., STid Architect, HID Signo, or Salto KS). These
                    readers read existing MIFARE Classic physical cards while simultaneously accepting Android HCE ISO 7816-4 APDUs
                    and BLE mobile credentials.
                  </p>
                </div>
              </div>

              {/* Phase 3 */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-start space-x-3">
                <div className="w-7 h-7 rounded-full bg-purple-950 text-purple-400 border border-purple-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">
                    Phase 3: Digital Credential Rollout & Physical Card Decommissioning
                  </h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Provision SYNCROZZ Virtual Mobile Passes to authorized faculty and students via enterprise PKI. Activate
                    mutual challenge-response using hardware-backed Android KeyStore. Decommission unencrypted MIFARE Classic 1K
                    cards across all KPMBP zones.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
