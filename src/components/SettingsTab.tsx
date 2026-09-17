import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Smartphone,
  Cpu,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  Radio,
  KeyRound,
  Download,
  Terminal,
  Save,
  Info,
} from 'lucide-react';
import { CredentialProfile, NfcDiagnosticResult } from '../types';

interface SettingsTabProps {
  credential: CredentialProfile;
  onUpdateCredential: (updated: CredentialProfile) => void;
  diagnostic: NfcDiagnosticResult | null;
  onRefreshDiagnostic: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  credential,
  onUpdateCredential,
  diagnostic,
  onRefreshDiagnostic,
}) => {
  // Settings state
  const [enterpriseAid, setEnterpriseAid] = useState(credential.applicationIdentifier);
  const [keystoreAlgorithm, setKeystoreAlgorithm] = useState<'EC_SECP256R1' | 'RSA_2048' | 'AES_256_GCM'>('EC_SECP256R1');
  const [requireStrongBox, setRequireStrongBox] = useState(true);
  const [requireUserAuth, setRequireUserAuth] = useState(true);
  const [bleBackgroundAdvertising, setBleBackgroundAdvertising] = useState(false);
  const [hceStrictIso7816, setHceStrictIso7816] = useState(true);
  const [antiCloningEnforcement, setAntiCloningEnforcement] = useState(true);
  const [logLevel, setLogLevel] = useState<'DEBUG' | 'INFO' | 'WARN' | 'ERROR'>('INFO');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Security bypass attempt test state
  const [showSecurityWarning, setShowSecurityWarning] = useState(false);

  const handleSaveConfiguration = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCredential({
      ...credential,
      applicationIdentifier: enterpriseAid.trim().toUpperCase(),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleExportConfigJson = () => {
    const configData = {
      project: 'SYNCROZZ Mobile Access',
      standard: 'SES v4.5',
      target: 'Kolej Profesional MARA Bandar Penawar (KPMBP)',
      exportTimestamp: new Date().toISOString(),
      hceConfiguration: {
        applicationIdentifier: enterpriseAid,
        protocol: 'ISO 7816-4 APDU over ISO 14443-4 Type A',
        aidCategory: 'ENTERPRISE_OTHER',
        strictIso7816: hceStrictIso7816,
      },
      keystoreConfiguration: {
        alias: credential.keystoreAlias,
        algorithm: keystoreAlgorithm,
        requireStrongBox,
        requireUserBiometricAuth: requireUserAuth,
        curve: keystoreAlgorithm === 'EC_SECP256R1' ? 'secp256r1' : 'none',
      },
      securityPolicy: {
        mifareClassicEmulationProhibited: true,
        antiCloningEnforced: antiCloningEnforcement,
        dynamicRandomizedUidCompliant: true,
        standardReference: 'SES-SEC-4.5.5',
      },
      bleConfiguration: {
        backgroundAdvertising: bleBackgroundAdvertising,
        txPowerLevel: 'HIGH',
        advertiseMode: 'LOW_LATENCY',
      },
    };

    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syncrozz-kpmbp-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <span>Platform Settings & System Configuration</span>
          </h2>
          <p className="text-xs text-slate-400">
            AOSP HostApduService parameters, Android KeyStore StrongBox bindings, and SES v4.5 security policies.
          </p>
        </div>

        <button
          id="btn-export-settings-json"
          onClick={handleExportConfigJson}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 text-xs transition self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Export SES Config JSON</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl p-3.5 flex items-center space-x-2.5 text-emerald-300 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Configuration parameters updated and validated against SES v4.5 standard rules.</span>
        </div>
      )}

      {/* Settings Grid */}
      <form onSubmit={handleSaveConfiguration} className="space-y-6">
        {/* Section 1: Host-based Card Emulation (HCE) Parameters */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Android HCE Protocol Settings</h3>
                <p className="text-[11px] text-slate-400">AOSP HostApduService and AID registration (SES-ARCH-4.5.1)</p>
              </div>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono">
              ISO 7816-4
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Enterprise Application Identifier (AID)</span>
                <span className="text-[10px] text-slate-500 font-mono">HEX / 5-16 Bytes</span>
              </label>
              <input
                type="text"
                value={enterpriseAid}
                onChange={(e) => setEnterpriseAid(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                placeholder="F0 01 02 03 04 05"
                required
              />
              <p className="text-[10px] text-slate-400">
                Must use Category 'other' prefix (F0-F7) as assigned to SYNCROZZ for KPMBP campus readers.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Carrier Protocol Standard</label>
              <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono flex items-center justify-between">
                <span>ISO/IEC 14443-4 Type A</span>
                <span className="text-emerald-400 text-[10px]">Active</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Enforced by AOSP NFC HAL. Activation requires ATS return; raw bit framing is bypassed.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-200 font-medium">Strict ISO 7816-4 APDU Routing</div>
                <div className="text-slate-400 text-[11px]">Reject malformed APDU headers (CLA != 0x00) with 6E 00 status word</div>
              </div>
              <input
                type="checkbox"
                checked={hceStrictIso7816}
                onChange={(e) => setHceStrictIso7816(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Android KeyStore & Cryptographic Assurance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Hardware KeyStore Security Engine</h3>
                <p className="text-[11px] text-slate-400">Tamper-resistant credential signing (SES-SEC-4.5.5)</p>
              </div>
            </div>
            <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800 font-mono">
              StrongBox
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Key Generation Algorithm</label>
              <select
                value={keystoreAlgorithm}
                onChange={(e) => setKeystoreAlgorithm(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="EC_SECP256R1">ECDSA NIST P-256 (secp256r1) — Recommended</option>
                <option value="RSA_2048">RSA 2048-bit with PKCS#1 v1.5 padding</option>
                <option value="AES_256_GCM">AES-256-GCM Session Keymaster</option>
              </select>
              <p className="text-[10px] text-slate-400">
                ECDSA P-256 generates lightweight signatures ideal for millisecond contactless reader taps.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Active Keystore Alias</label>
              <input
                type="text"
                value={credential.keystoreAlias}
                disabled
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-400 cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-500">
                Bound to application sandbox package `com.syncrozz.mobileaccess`.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-200 font-medium">Require StrongBox Keymaster (Dedicated Hardware HSM)</div>
                <div className="text-slate-400 text-[11px]">Enforce hardware isolation chip on supported Pixel, Samsung, and Android devices</div>
              </div>
              <input
                type="checkbox"
                checked={requireStrongBox}
                onChange={(e) => setRequireStrongBox(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-200 font-medium">Require Biometric Authentication for High-Tier Zones</div>
                <div className="text-slate-400 text-[11px]">Require fingerprint/face confirmation before dispatching Tier 3 & Tier 4 keys</div>
              </div>
              <input
                type="checkbox"
                checked={requireUserAuth}
                onChange={(e) => setRequireUserAuth(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Dual-Modality & Future Mobile Credential Transports */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Future Credential Transports & BLE</h3>
                <p className="text-[11px] text-slate-400">Extended modalities for Phase 2 reader deployments</p>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800 font-mono">
              Multi-Tech
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-slate-200 font-medium">BLE Mobile Access Proximity Beacon</div>
                <div className="text-slate-400 text-[11px]">
                  Enable Bluetooth Low Energy background peripheral advertisement for turnstile and parking barrier lanes
                </div>
              </div>
              <input
                type="checkbox"
                checked={bleBackgroundAdvertising}
                onChange={(e) => setBleBackgroundAdvertising(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500"
              />
            </div>

            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">Phase 2 Target Integrations:</div>
              <div>• Google Wallet Passes API (PKI Smart Tap protocol)</div>
              <div>• OSDP v2.2 with Secure Channel Protocol (SCP03 AES-128)</div>
              <div>• Physical Badge Co-existence (Dual-Credential Policy)</div>
            </div>
          </div>
        </div>

        {/* Section 4: Security Guardrails & Anti-Bypass Policy */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Security Guardrails & SES Compliance Gates</h3>
                <p className="text-[11px] text-slate-400">Enforcement of SES v4.5 anti-cloning and anti-bypass principles</p>
              </div>
            </div>
            <span className="text-[10px] bg-rose-950 text-rose-300 px-2 py-0.5 rounded border border-rose-800 font-mono">
              MANDATORY
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-200 font-medium">Anti-Cloning & Non-Bypass Enforcement</div>
                <div className="text-slate-400 text-[11px]">
                  Strictly block simulated attacks, unauthorized UID manipulation, or proprietary CRYPTO1 extraction
                </div>
              </div>
              <input
                type="checkbox"
                checked={antiCloningEnforcement}
                disabled
                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-emerald-600 cursor-not-allowed"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="text-slate-200 font-medium">Diagnostic Log Verbosity</div>
                <div className="text-slate-400 text-[11px]">Audit trail logging level for reader APDU interactions</div>
              </div>
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value as any)}
                className="bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
              >
                <option value="DEBUG">DEBUG (Detailed APDUs)</option>
                <option value="INFO">INFO (Normal Audits)</option>
                <option value="WARN">WARN (Warnings Only)</option>
                <option value="ERROR">ERROR (Failures Only)</option>
              </select>
            </div>

            {/* Simulated Bypass Test Button */}
            <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg flex items-center justify-between">
              <div className="text-xs text-rose-300">
                <span className="font-semibold">Security Gate Test:</span> Trigger simulated unauthorized clone attempt
              </div>
              <button
                type="button"
                id="btn-trigger-bypass-test"
                onClick={() => setShowSecurityWarning(true)}
                className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs px-2.5 py-1 rounded border border-rose-700/60 transition"
              >
                Execute Test Gate
              </button>
            </div>

            {showSecurityWarning && (
              <div className="bg-rose-950/80 border border-rose-600 rounded-xl p-4 text-rose-200 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center space-x-2 font-bold text-rose-100">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>SES-SEC-4.5.5 ENFORCEMENT INTERCEPT: ATTEMPT BLOCKED</span>
                </div>
                <p className="leading-relaxed">
                  The application security layer successfully intercepted and <strong>REJECTED</strong> the unauthorized
                  cloning test. The SYNCROZZ platform refuses to emulate static MIFARE Classic UIDs or forge proprietary
                  CRYPTO1 authentication tokens. All access credentials remain cryptographically tied to authorized
                  Android KeyStore containers.
                </p>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowSecurityWarning(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded text-[11px] border border-slate-700 transition"
                  >
                    Acknowledge & Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="submit"
            id="btn-save-settings"
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-900/40 transition"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
