import React from 'react';
import { Shield, Smartphone, AlertTriangle, Monitor, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileFrame: boolean;
  setIsMobileFrame: (val: boolean) => void;
  webNfcSupported: boolean;
  onOpenAuth: () => void;
  currentUser: any;
  isMasterAdmin: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isMobileFrame,
  setIsMobileFrame,
  webNfcSupported,
  onOpenAuth,
  currentUser,
  isMasterAdmin,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'locations', label: 'Access Locations' },
    { id: 'pacs_gateway', label: '🚪 PACs Gateway' },
    { id: 'compatibility', label: 'Device & NFC Matrix' },
    { id: 'credentials', label: 'Credential Status' },
    { id: 'devices', label: 'Device Registration' },
    ...(isMasterAdmin ? [{ id: 'admin', label: '🛡️ Master Admin' }] : []),
    { id: 'architecture', label: 'Architecture & SES' },
    { id: 'diagnostics', label: 'Reader Probe' },
    { id: 'tests', label: 'Automated Tests' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Badge */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-900/40">
              <Shield className="w-6 h-6 text-emerald-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-white font-bold tracking-tight text-base sm:text-lg">SYNCROZZ</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono">
                  SES v4.5
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">KPMBP Mobile Access Diagnostic Platform</p>
            </div>
          </div>

          {/* Right Controls: Device Status & View Mode Toggle */}
          <div className="flex items-center space-x-3">
            {/* NFC Status Indicator */}
            <div
              className={`flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-full border ${
                webNfcSupported
                  ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-800/80 text-amber-300'
              }`}
            >
              {webNfcSupported ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden md:inline">Web NFC API Ready</span>
                  <span className="md:hidden">NFC</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">Android HCE Model Active</span>
                  <span className="md:hidden">HCE</span>
                </>
              )}
            </div>

            {/* Auth Action Button */}
            {!currentUser ? (
              <button
                id="btn-navbar-login"
                onClick={onOpenAuth}
                className="flex items-center space-x-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-md font-semibold transition shadow-md shadow-emerald-950/40"
              >
                <span>Log Masuk</span>
              </button>
            ) : (
              <div className="flex items-center space-x-1.5 text-xs bg-slate-800 text-emerald-300 px-2.5 py-1.5 rounded-md border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[11px] truncate max-w-[100px]">{currentUser.email?.split('@')[0]}</span>
              </div>
            )}

            {/* Frame Viewport Switcher */}
            <button
              id="btn-toggle-viewport"
              onClick={() => setIsMobileFrame(!isMobileFrame)}
              className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-md border border-slate-700 transition"
              title="Toggle mobile device frame preview"
            >
              {isMobileFrame ? (
                <>
                  <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Workbench View</span>
                </>
              ) : (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Phone Frame View</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/80">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              id={`tab-nav-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
