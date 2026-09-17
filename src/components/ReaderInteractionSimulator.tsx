import React, { useState } from 'react';
import {
  Wifi,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RotateCcw,
  Shield,
  Layers,
  Radio,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { AccessLocation, ReaderInteractionStep } from '../types';

interface ReaderInteractionSimulatorProps {
  locations: AccessLocation[];
  initialLocationId?: string;
}

export const ReaderInteractionSimulator: React.FC<ReaderInteractionSimulatorProps> = ({
  locations,
  initialLocationId,
}) => {
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    initialLocationId || locations[0]?.id || 'loc-kp-001'
  );
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simulationComplete, setSimulationComplete] = useState<boolean>(false);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId) || locations[0];
  const isUpgradedReader = selectedLocation?.authenticationMode === 'ISO_7816_APDU';

  // Define steps dynamically based on reader technology
  const steps: ReaderInteractionStep[] = isUpgradedReader
    ? [
        {
          stepNumber: 1,
          title: '13.56 MHz Carrier Induction & ISO 14443-4 RATS',
          actor: 'READER',
          payloadOrCommand: 'POLL: RATS (Request for Answer to Select)',
          outcome: 'SUCCESS',
          technicalExplanation:
            'Reader activates 13.56 MHz RF field. Android device wakes up and returns ATS (Answer to Select) indicating ISO 14443-4 capability.',
        },
        {
          stepNumber: 2,
          title: 'ISO 7816-4 Application Selection (SELECT AID)',
          actor: 'READER',
          payloadOrCommand: 'APDU: 00 A4 04 00 06 F0 01 02 03 04 05 00',
          outcome: 'SUCCESS',
          technicalExplanation:
            'Reader transmits APDU command targeting registered SYNCROZZ Enterprise AID (F0 01 02 03 04 05).',
        },
        {
          stepNumber: 3,
          title: 'Android HostApduService Processing',
          actor: 'PHONE_ANDROID',
          payloadOrCommand: 'AOSP Kernel -> HostApduService.processCommandApdu()',
          outcome: 'SUCCESS',
          technicalExplanation:
            'Android OS routes the APDU packet directly to SyncrozzHostApduService. StrongBox KeyStore signs reader challenge nonce.',
        },
        {
          stepNumber: 4,
          title: 'Cryptographic Token Response & Door Unlock',
          actor: 'SECURITY_KERNEL',
          payloadOrCommand: 'RESPONSE: [Signed Session Token] + 90 00 (SW_SUCCESS)',
          outcome: 'SUCCESS',
          technicalExplanation:
            'Reader verifies NIST P-256 ECDSA signature, relays OSDP v2 Grant packet to electronic strike, and unlocks access point.',
        },
      ]
    : [
        {
          stepNumber: 1,
          title: '13.56 MHz Carrier Induction & REQA/WUPA Request',
          actor: 'READER',
          payloadOrCommand: 'POLL: ISO 14443-3A WUPA (0x52) 7-bit Frame',
          outcome: 'SUCCESS',
          technicalExplanation:
            'KPMBP legacy door reader emits 13.56 MHz carrier and broadcasts short 7-bit Wake-Up All (WUPA) frame expecting MIFARE transponder.',
        },
        {
          stepNumber: 2,
          title: 'Anticollision & Dynamic UID Presentation',
          actor: 'PHONE_ANDROID',
          payloadOrCommand: 'ANTICOLLISION: Random Dynamic UID (08 D3 A1 49)',
          outcome: 'FAILURE',
          technicalExplanation:
            'Android AOSP enforces randomized UID starting with 0x08 for consumer privacy. Reader database expects fixed physical 4-byte NXP UID.',
        },
        {
          stepNumber: 3,
          title: 'Proprietary CRYPTO1 Mutual Auth Challenge',
          actor: 'READER',
          payloadOrCommand: 'CMD: 0x60 [Sector 00] [Key A Challenge Nonce]',
          outcome: 'BLOCKED',
          technicalExplanation:
            'Door reader initiates proprietary 3-pass CRYPTO1 authentication. Standard Android NFC chip and AOSP HCE stack drop non-APDU frame.',
        },
        {
          stepNumber: 4,
          title: 'Access Control Controller Decision: REJECTED',
          actor: 'SECURITY_KERNEL',
          payloadOrCommand: 'TIMEOUT / PARITY ERROR -> Access Denied (Red LED)',
          outcome: 'FAILURE',
          technicalExplanation:
            'Reader receives no valid CRYPTO1 response. Door remains locked. Physical MIFARE Classic badge is required for entry.',
        },
      ];

  const handleStartSimulation = () => {
    setIsRunning(true);
    setCurrentStepIndex(0);
    setSimulationComplete(false);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < steps.length) {
        setCurrentStepIndex(step);
      } else {
        clearInterval(interval);
        setIsRunning(false);
        setSimulationComplete(true);
      }
    }, 1200);
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentStepIndex(0);
    setSimulationComplete(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <Wifi className="w-5 h-5 text-emerald-400" />
          <span>Interactive NFC Reader Protocol Probe Simulator</span>
        </h2>
        <p className="text-xs text-slate-400">
          Visual protocol analyzer illustrating RF field interaction between Android HCE and door readers.
        </p>
      </div>

      {/* Mandatory Safety Notice */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex items-center space-x-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
        <span>
          <strong>SES v4.5 Diagnostic Notice:</strong> This simulator operates as an evidence-based protocol evaluation
          tool. It visualizes actual hardware framing and does <strong>not</strong> claim to bypass or replace physical
          badges on unverified access systems.
        </span>
      </div>

      {/* Controls & Target Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div className="sm:col-span-8">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Target KPMBP Door Access Point:
            </label>
            <select
              id="select-target-location"
              value={selectedLocationId}
              onChange={(e) => {
                setSelectedLocationId(e.target.value);
                handleReset();
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.facilityCode}) — {loc.authenticationMode.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4 flex items-end space-x-2 pt-1 sm:pt-0">
            <button
              id="btn-run-simulation"
              onClick={handleStartSimulation}
              disabled={isRunning}
              className="flex-1 flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold py-2.5 px-4 rounded-lg shadow transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunning ? 'Probing...' : 'Simulate Tap'}</span>
            </button>
            <button
              id="btn-reset-simulation"
              onClick={handleReset}
              disabled={isRunning}
              className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs p-2.5 rounded-lg border border-slate-700 transition"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Target Reader Specs Bar */}
        <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div>
            <span className="text-slate-500">Physical Card Tech: </span>
            <span className="text-slate-300 font-semibold">{selectedLocation?.physicalCardTech}</span>
          </div>
          <div>
            <span className="text-slate-500">Auth Mechanism: </span>
            <span className="text-slate-300 font-mono font-medium">
              {selectedLocation?.authenticationMode.replace(/_/g, ' ')}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Predicted Verdict: </span>
            <span
              className={`font-semibold ${
                isUpgradedReader ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isUpgradedReader ? 'Compatible via HCE' : 'Incompatible (Physical Card Required)'}
            </span>
          </div>
        </div>
      </div>

      {/* Protocol Interaction Trace Canvas */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">RF Carrier & Frame Transmission Trace</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Step {currentStepIndex + 1} of {steps.length}
          </span>
        </div>

        {/* Step Progress Visualizer */}
        <div className="grid grid-cols-4 gap-2">
          {steps.map((s, idx) => {
            const isPassed = idx < currentStepIndex || simulationComplete;
            const isCurrent = idx === currentStepIndex && isRunning;
            return (
              <div
                key={s.stepNumber}
                className={`p-2 rounded-lg border text-center transition-all ${
                  isCurrent
                    ? 'bg-emerald-950/60 border-emerald-500 text-white scale-[1.02]'
                    : isPassed
                    ? s.outcome === 'SUCCESS'
                      ? 'bg-emerald-950/20 border-emerald-900 text-slate-300'
                      : 'bg-rose-950/20 border-rose-900 text-slate-300'
                    : 'bg-slate-950/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="text-[10px] font-mono uppercase font-bold">Step {s.stepNumber}</div>
                <div className="text-[11px] font-semibold truncate">{s.actor}</div>
              </div>
            );
          })}
        </div>

        {/* Active Step Details */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4.5 space-y-3">
          {steps[currentStepIndex] && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      steps[currentStepIndex].outcome === 'SUCCESS'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : steps[currentStepIndex].outcome === 'FAILURE'
                        ? 'bg-rose-950 text-rose-400 border border-rose-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {steps[currentStepIndex].stepNumber}
                  </span>
                  <span className="text-sm font-bold text-white">{steps[currentStepIndex].title}</span>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    steps[currentStepIndex].outcome === 'SUCCESS'
                      ? 'bg-emerald-900/60 text-emerald-300'
                      : steps[currentStepIndex].outcome === 'FAILURE'
                      ? 'bg-rose-900/60 text-rose-300'
                      : 'bg-amber-900/60 text-amber-300'
                  }`}
                >
                  {steps[currentStepIndex].outcome}
                </span>
              </div>

              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 break-all">
                <span className="text-slate-500 block text-[10px] uppercase">Command / Transmission:</span>
                {steps[currentStepIndex].payloadOrCommand}
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800/80">
                {steps[currentStepIndex].technicalExplanation}
              </p>
            </>
          )}
        </div>

        {/* Final Simulation Verdict Banner */}
        {simulationComplete && (
          <div
            className={`p-4 rounded-xl border text-xs leading-relaxed space-y-1.5 ${
              isUpgradedReader
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
                : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
            }`}
          >
            <div className="font-bold flex items-center space-x-2 text-sm">
              {isUpgradedReader ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>Protocol Exchange Succeeded (Authorized APDU)</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-400" />
                  <span>Access Rejected: MIFARE Classic Incompatibility Verified</span>
                </>
              )}
            </div>
            <p>
              {isUpgradedReader
                ? 'The simulated reader supports ISO 14443-4 APDU commands. The SYNCROZZ Virtual Credential responded with a valid cryptographic token (SW 90 00).'
                : 'The door reader expects raw ISO 14443-3A framing with static UID or CRYPTO1 sector authentication. Standard Android HCE drops this exchange. Entry is denied. Physical badge must be used.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
