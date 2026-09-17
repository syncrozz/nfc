import React from 'react';
import {
  ShieldAlert,
  Smartphone,
  Cpu,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Wifi,
  Key,
  Layers,
} from 'lucide-react';
import { CredentialProfile, AccessLocation, NfcDiagnosticResult } from '../types';

interface DashboardTabProps {
  credential: CredentialProfile;
  locations: AccessLocation[];
  diagnostic: NfcDiagnosticResult | null;
  onNavigate: (tab: string) => void;
  onSimulateReader: (locationId?: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  credential,
  locations,
  diagnostic,
  onNavigate,
  onSimulateReader,
}) => {
  const unsupportedCount = locations.filter((l) => l.compatibilityRating === 'UNSUPPORTED').length;
  const conditionalCount = locations.filter((l) => l.compatibilityRating === 'CONDITIONAL_SUPPORT').length;
  const investigationCount = locations.filter((l) => l.compatibilityRating === 'INVESTIGATION_REQUIRED').length;

  return (
    <div className="space-y-6">
      {/* Critical Verification Notice Banner */}
      <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 sm:p-5 text-amber-200">
        <div className="flex items-start space-x-3">
          <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-semibold text-amber-100 text-sm sm:text-base flex items-center space-x-2">
              <span>SYNCROZZ SES v4.5 Engineering Notice</span>
              <span className="text-xs bg-amber-900/60 text-amber-300 px-2 py-0.5 rounded border border-amber-700/50">
                Phase 1 Foundation
              </span>
            </h3>
            <p className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
              Standard Android NFC (Host-based Card Emulation) <strong>cannot</strong> emulate or replace physical
              NXP MIFARE Classic 1K cards due to transceiver layer differences (ISO 14443-3A vs ISO 14443-4) and
              proprietary CRYPTO1 encryption. <strong>Physical badge must be retained</strong> until door readers
              are upgraded to OSDP v2 with ISO 7816-4 APDU or BLE mobile credentials.
            </p>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>KPMBP Facilities</span>
            <MapPin className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white">{locations.length}</div>
          <div className="text-xs text-slate-400 mt-1 flex items-center space-x-1">
            <span className="text-emerald-400 font-medium">{conditionalCount} HCE Ready</span>
            <span>•</span>
            <span className="text-rose-400 font-medium">{unsupportedCount} Legacy</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Target Physical Card</span>
            <Cpu className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-sm font-bold text-amber-300 truncate">MIFARE Classic 1K</div>
          <div className="text-xs text-slate-400 mt-1 truncate">ISO 14443-A (13.56 MHz)</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Android HCE Standard</span>
            <Wifi className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm font-bold text-emerald-300">ISO 7816-4 APDU</div>
          <div className="text-xs text-slate-400 mt-1 truncate">AID: A0000008410001</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Standard Compliance</span>
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-sm font-bold text-indigo-300">SES v4.5 Certified</div>
          <div className="text-xs text-emerald-400 mt-1 font-medium">Phase 3B Gateways Active</div>
        </div>
      </div>

      {/* Phase 3B PACs Gateway Discovery Banner */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white">Fasa 3B: Penemuan Gerbang PACs & Audit Perkakasan Pembaca</span>
              <span className="text-[10px] bg-indigo-900/60 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded font-mono font-bold">
                SIAP
              </span>
            </div>
            <p className="text-xs text-slate-400">
              SIA OSDP v2.2 Secure Channel, penyesuai Wiegand, telemetri mTLS 1.3 edge controller, dan penilaian ancaman STRIDE.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('pacs_gateway')}
          className="self-start sm:self-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 shadow-md shadow-indigo-950/40 whitespace-nowrap"
        >
          <span>Buka PACs Gateway</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Grid: Interactive Credential Pass & Technical Verdict */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Digital Pass Preview & Probe Trigger */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 border border-slate-700/80 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            {/* Holographic Chip Background Accents */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Authorized Mobile Credential
                </span>
              </div>
              <span className="text-xs font-mono bg-slate-800 text-emerald-300 px-2 py-0.5 rounded border border-slate-700">
                {credential.status}
              </span>
            </div>

            {/* Smart Card Visual Layout */}
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-mono">Organization</p>
                  <p className="text-sm font-bold text-white tracking-tight">{credential.organization}</p>
                  <p className="text-xs text-slate-300">{credential.department}</p>
                </div>
                <div className="w-10 h-8 rounded bg-gradient-to-tr from-amber-300 to-amber-500 flex items-center justify-center shadow-inner border border-amber-200/40">
                  <div className="grid grid-cols-2 gap-0.5 p-1">
                    <div className="w-3 h-2 border border-amber-900/60 rounded-xs" />
                    <div className="w-3 h-2 border border-amber-900/60 rounded-xs" />
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Cardholder:</span>
                  <span className="text-white font-semibold">{credential.holderName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Identifier:</span>
                  <span className="text-slate-300 font-mono text-[11px]">{credential.credentialIdentifier}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Application ID (AID):</span>
                  <span className="text-emerald-400 font-mono text-[11px]">{credential.applicationIdentifier}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Keystore Level:</span>
                  <span className="text-indigo-300 text-[11px] flex items-center space-x-1">
                    <Key className="w-3 h-3 text-indigo-400 inline" />
                    <span>Android StrongBox EC</span>
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-xs text-slate-400">
                <span>Valid: {credential.validFrom.slice(0, 4)} - {credential.validUntil.slice(0, 4)}</span>
                <span className="text-emerald-400 font-medium">HCE Profile Active</span>
              </div>
            </div>

            {/* Quick Diagnostic Trigger */}
            <div className="mt-5 pt-4 border-t border-slate-800/80">
              <button
                id="btn-quick-reader-probe"
                onClick={() => onSimulateReader()}
                className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 px-4 rounded-lg shadow-md transition"
              >
                <Wifi className="w-4 h-4" />
                <span>Simulate Reader Interaction Test</span>
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-1.5">
                Evaluates response against both Legacy MIFARE Classic and Upgraded APDU readers.
              </p>
            </div>
          </div>
        </div>

        {/* Right Col: Evidence-Based Compatibility Analysis */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>KPMBP Facility Compatibility Assessment</span>
              </h3>
              <button
                onClick={() => onNavigate('locations')}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
              >
                <span>View All Locations ({locations.length})</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Based on the identification of existing credentials as <strong>NXP MIFARE Classic 1K (ISO 14443-A)</strong>,
              here is the verified compatibility breakdown across monitored access points:
            </p>

            {/* Location Sample Cards */}
            <div className="space-y-2.5">
              {locations.slice(0, 3).map((loc) => {
                const isUnsupported = loc.compatibilityRating === 'UNSUPPORTED';
                const isConditional = loc.compatibilityRating === 'CONDITIONAL_SUPPORT';
                return (
                  <div
                    key={loc.id}
                    className={`p-3 rounded-lg border text-xs transition ${
                      isUnsupported
                        ? 'bg-rose-950/20 border-rose-900/40 text-slate-300'
                        : isConditional
                        ? 'bg-emerald-950/20 border-emerald-900/40 text-slate-300'
                        : 'bg-amber-950/20 border-amber-900/40 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-white">{loc.name}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          isUnsupported
                            ? 'bg-rose-900/60 text-rose-300'
                            : isConditional
                            ? 'bg-emerald-900/60 text-emerald-300'
                            : 'bg-amber-900/60 text-amber-300'
                        }`}
                      >
                        {loc.compatibilityRating.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{loc.technicalLimitationNote}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono">{loc.facilityCode}</span>
                      <button
                        onClick={() => onSimulateReader(loc.id)}
                        className="text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Probe Location →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Architecture Rationale Summary */}
            <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 space-y-2 text-xs">
              <div className="font-semibold text-slate-200">Key Technical Limitations Identified:</div>
              <ul className="space-y-1.5 text-slate-400">
                <li className="flex items-start space-x-2">
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Framing Mismatch:</strong> MIFARE Classic relies on ISO 14443-3A raw bits; Android HCE only
                    dispatches ISO 14443-4 APDU commands.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Proprietary CRYPTO1:</strong> Secret sector keys A/B cannot be executed by Android HCE
                    without specialized non-standard chipsets.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Recommended Path:</strong> Deploy multi-technology OSDP v2 readers or BLE Mobile Access,
                    allowing graceful migration from physical cards to Android HCE.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
