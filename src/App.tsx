import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardTab } from './components/DashboardTab';
import { LocationsTab } from './components/LocationsTab';
import { PacsGatewayTab } from './components/PacsGatewayTab';
import { CompatibilityMatrixTab } from './components/CompatibilityMatrixTab';
import { CredentialStatusTab } from './components/CredentialStatusTab';
import { ArchitectureTab } from './components/ArchitectureTab';
import { ReaderInteractionSimulator } from './components/ReaderInteractionSimulator';
import { AutomatedTestsRunner } from './components/AutomatedTestsRunner';
import { SettingsTab } from './components/SettingsTab';
import { MasterAdminDashboard } from './components/MasterAdminDashboard';
import { DeviceRegistrationView } from './components/DeviceRegistrationView';
import { ApplicationStatusBanner } from './components/ApplicationStatusBanner';
import { AuthModal } from './components/AuthModal';
import { MobileFrameWrapper } from './components/MobileFrameWrapper';
import { AuthProvider, useAuth } from './services/AuthContext';
import { NfcDiagnosticService } from './services/nfcDiagnosticService';
import { KPMBP_LOCATIONS, INITIAL_CREDENTIAL_PROFILE } from './data/mockData';
import { AccessLocation, CredentialProfile, NfcDiagnosticResult, RegisteredDevice } from './types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './services/firebase';

function MainContent() {
  const { currentUser, appUser, isMasterAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [locations, setLocations] = useState<AccessLocation[]>(KPMBP_LOCATIONS);
  const [credential, setCredential] = useState<CredentialProfile>(INITIAL_CREDENTIAL_PROFILE);
  const [diagnostic, setDiagnostic] = useState<NfcDiagnosticResult | null>(null);
  const [targetProbeLocationId, setTargetProbeLocationId] = useState<string | undefined>(undefined);
  const [userDevices, setUserDevices] = useState<RegisteredDevice[]>([]);

  const fetchDiagnostic = async () => {
    try {
      const result = await NfcDiagnosticService.runDeviceDiagnostic();
      setDiagnostic(result);
    } catch (err) {
      console.error('Failed to run NFC diagnostic', err);
    }
  };

  useEffect(() => {
    fetchDiagnostic();
  }, []);

  // Listen to authoritative devices for the user
  useEffect(() => {
    if (!currentUser) {
      setUserDevices([]);
      return;
    }
    const qDev = query(collection(db, 'devices'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(qDev, (snap) => {
      const devs = snap.docs.map((d) => d.data() as RegisteredDevice);
      setUserDevices(devs);
    });
    return () => unsub();
  }, [currentUser]);

  // If user profile becomes approved in Firestore, sync credential status
  useEffect(() => {
    if (appUser) {
      setCredential((prev) => ({
        ...prev,
        holderName: appUser.fullName,
        department: appUser.department,
        facilityId: appUser.staffId,
        status: appUser.status === 'APPROVED' ? 'ACTIVE' : appUser.status === 'PENDING' ? 'PENDING_AUDIT' : 'REVOKED',
        isEnrolled: appUser.status === 'APPROVED',
      }));
    }
  }, [appUser]);

  const handleAddLocation = (newLoc: AccessLocation) => {
    setLocations((prev) => [newLoc, ...prev]);
  };

  const handleSimulateReader = (locationId?: string) => {
    if (locationId) {
      setTargetProbeLocationId(locationId);
    }
    setActiveTab('diagnostics');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Application Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileFrame={isMobileFrame}
        setIsMobileFrame={setIsMobileFrame}
        webNfcSupported={diagnostic?.webNfcSupported || false}
        onOpenAuth={() => setAuthModalOpen(true)}
        currentUser={currentUser}
        isMasterAdmin={isMasterAdmin}
      />

      {/* Main Viewport Content */}
      <main className="flex-1">
        <MobileFrameWrapper isMobileFrame={isMobileFrame}>
          {/* Status & Session Banner */}
          <ApplicationStatusBanner onOpenAuth={() => setAuthModalOpen(true)} />

          {activeTab === 'dashboard' && (
            <DashboardTab
              credential={credential}
              locations={locations}
              diagnostic={diagnostic}
              onNavigate={setActiveTab}
              onSimulateReader={handleSimulateReader}
            />
          )}

          {activeTab === 'locations' && (
            <LocationsTab
              locations={locations}
              onAddLocation={handleAddLocation}
              onSimulateReader={handleSimulateReader}
            />
          )}

          {activeTab === 'pacs_gateway' && <PacsGatewayTab />}

          {activeTab === 'compatibility' && (
            <CompatibilityMatrixTab
              diagnostic={diagnostic}
              onRefreshDiagnostic={fetchDiagnostic}
            />
          )}

          {activeTab === 'credentials' && (
            <CredentialStatusTab
              credential={credential}
              onUpdateCredential={setCredential}
            />
          )}

          {activeTab === 'devices' && (
            <DeviceRegistrationView
              devices={userDevices}
              onRefresh={() => {}}
            />
          )}

          {activeTab === 'admin' && <MasterAdminDashboard />}

          {activeTab === 'architecture' && <ArchitectureTab />}

          {activeTab === 'diagnostics' && (
            <ReaderInteractionSimulator
              locations={locations}
              initialLocationId={targetProbeLocationId}
            />
          )}

          {activeTab === 'tests' && <AutomatedTestsRunner />}

          {activeTab === 'settings' && (
            <SettingsTab
              credential={credential}
              onUpdateCredential={setCredential}
              diagnostic={diagnostic}
              onRefreshDiagnostic={fetchDiagnostic}
            />
          )}
        </MobileFrameWrapper>
      </main>

      {/* Auth Modal (Login / Register) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Footer Standard Compliance Tag */}
      <footer className="bg-slate-900/60 border-t border-slate-900 py-3 text-center text-[11px] text-slate-500">
        SYNCROZZ ENGINEERING STANDARD (SES) v4.5 • Kolej Profesional MARA Bandar Penawar (KPMBP) Mobile Access Platform • Phase 2 Authenticated Foundation
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
