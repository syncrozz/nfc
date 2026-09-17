import React, { useState } from 'react';
import {
  MapPin,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Cpu,
  Radio,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { AccessLocation, CompatibilityRating, SecurityTier } from '../types';

interface LocationsTabProps {
  locations: AccessLocation[];
  onAddLocation: (loc: AccessLocation) => void;
  onSimulateReader: (locationId: string) => void;
}

export const LocationsTab: React.FC<LocationsTabProps> = ({
  locations,
  onAddLocation,
  onSimulateReader,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRating, setFilterRating] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State for new Location
  const [newLocName, setNewLocName] = useState('');
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocBuilding, setNewLocBuilding] = useState('Building A (Academic)');
  const [newLocFloor, setNewLocFloor] = useState('Level 1');
  const [newLocZone, setNewLocZone] = useState('Zone A - Faculty Offices');
  const [newLocAuthMode, setNewLocAuthMode] = useState<'UID_ONLY' | 'CRYPTO1_SECTOR_KEYS' | 'ISO_7816_APDU' | 'UNKNOWN_PENDING_AUDIT'>('UNKNOWN_PENDING_AUDIT');
  const [newLocTier, setNewLocTier] = useState<SecurityTier>('TIER_2_RESTRICTED');
  const [formError, setFormError] = useState('');

  const filteredLocations = locations.filter((loc) => {
    const matchesSearch =
      loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.facilityCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.building.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRating = filterRating === 'ALL' || loc.compatibilityRating === filterRating;
    return matchesSearch && matchesRating;
  });

  const handleCreateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim() || !newLocCode.trim()) {
      setFormError('Facility name and code are required.');
      return;
    }

    // Determine compatibility rating according to SES v4.5 rules
    let rating: CompatibilityRating = 'UNSUPPORTED';
    let verdict = 'Native Android Emulation Incompatible';
    let limitation = 'Door reader operates on legacy ISO 14443-3A or fixed UID.';
    let recommendation = 'Maintain physical card badge until reader migration.';

    if (newLocAuthMode === 'ISO_7816_APDU') {
      rating = 'CONDITIONAL_SUPPORT';
      verdict = 'Compatible via Android HCE (AID routing)';
      limitation = 'Supported via standard Android HostApduService with enterprise AID.';
      recommendation = 'Conduct field APDU handshake verification prior to rollout.';
    } else if (newLocAuthMode === 'UNKNOWN_PENDING_AUDIT') {
      rating = 'INVESTIGATION_REQUIRED';
      verdict = 'Pending Technical Audit';
      limitation = 'Reader model and authentication scheme unconfirmed.';
      recommendation = 'Capture passive packet trace with certified sniffer.';
    }

    const created: AccessLocation = {
      id: `loc-kp-${Date.now()}`,
      name: newLocName.trim(),
      facilityCode: newLocCode.trim().toUpperCase(),
      building: newLocBuilding,
      floor: newLocFloor,
      zone: newLocZone,
      readerModel: 'Standard KPMBP Door Reader',
      readerFrequency: '13.56 MHz (HF)',
      physicalCardTech: 'NXP MIFARE Classic 1K (ISO 14443-A)',
      authenticationMode: newLocAuthMode,
      compatibilityRating: rating,
      compatibilityVerdict: verdict,
      technicalLimitationNote: limitation,
      recommendedAction: recommendation,
      securityTier: newLocTier,
      isVerified: newLocAuthMode === 'ISO_7816_APDU',
      lastAuditedDate: new Date().toISOString().slice(0, 10),
      requiresEscort: newLocTier === 'TIER_3_CRITICAL' || newLocTier === 'TIER_4_INFRASTRUCTURE',
    };

    onAddLocation(created);
    setShowAddModal(false);
    setNewLocName('');
    setNewLocCode('');
    setFormError('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <span>KPMBP Monitored Access Locations</span>
          </h2>
          <p className="text-xs text-slate-400">
            Physical reader inventory, authentication mode audit, and Android HCE compatibility ratings.
          </p>
        </div>

        <button
          id="btn-add-location"
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3.5 py-2 rounded-lg border border-slate-700 self-start sm:self-auto transition"
        >
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Register New Access Point</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-7 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            id="input-search-locations"
            type="text"
            placeholder="Search by facility name, code, or building..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="sm:col-span-5 flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            id="select-filter-rating"
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Compatibility Ratings</option>
            <option value="UNSUPPORTED">Unsupported (MIFARE Classic / Legacy)</option>
            <option value="CONDITIONAL_SUPPORT">Conditional Support (ISO 7816 APDU)</option>
            <option value="INVESTIGATION_REQUIRED">Investigation Required (Unconfirmed)</option>
          </select>
        </div>
      </div>

      {/* Location Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredLocations.map((loc) => {
          const isUnsupported = loc.compatibilityRating === 'UNSUPPORTED';
          const isConditional = loc.compatibilityRating === 'CONDITIONAL_SUPPORT';
          const isInvestigation = loc.compatibilityRating === 'INVESTIGATION_REQUIRED';

          return (
            <div
              key={loc.id}
              className={`border rounded-xl p-4.5 transition flex flex-col justify-between ${
                isUnsupported
                  ? 'bg-slate-900/80 border-slate-800 hover:border-rose-900/60'
                  : isConditional
                  ? 'bg-slate-900/80 border-slate-800 hover:border-emerald-900/60'
                  : 'bg-slate-900/80 border-slate-800 hover:border-amber-900/60'
              }`}
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 tracking-wider">
                      {loc.facilityCode}
                    </span>
                    <h3 className="text-sm font-bold text-white">{loc.name}</h3>
                    <p className="text-xs text-slate-400">
                      {loc.building} • {loc.floor}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-1 rounded shrink-0 border ${
                      isUnsupported
                        ? 'bg-rose-950/60 border-rose-800/80 text-rose-300'
                        : isConditional
                        ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                        : 'bg-amber-950/60 border-amber-800/80 text-amber-300'
                    }`}
                  >
                    {isUnsupported && <XCircle className="w-3 h-3 inline mr-1 text-rose-400" />}
                    {isConditional && <CheckCircle2 className="w-3 h-3 inline mr-1 text-emerald-400" />}
                    {isInvestigation && <HelpCircle className="w-3 h-3 inline mr-1 text-amber-400" />}
                    {loc.compatibilityRating.replace('_', ' ')}
                  </span>
                </div>

                {/* Technical Reader Specs */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Existing Card Tech:</span>
                    <span className="text-slate-300 font-medium">{loc.physicalCardTech}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Authentication Mode:</span>
                    <span className="text-slate-300 font-mono font-medium">
                      {loc.authenticationMode.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Carrier Frequency:</span>
                    <span className="text-slate-300">{loc.readerFrequency}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Security Tier:</span>
                    <span className="text-indigo-300 font-medium">{loc.securityTier.replace('_', ' ')}</span>
                  </div>
                </div>

                {/* Limitation & Verdict */}
                <div className="text-xs space-y-1">
                  <div className="text-slate-300 font-medium flex items-center space-x-1.5">
                    <span className="text-slate-400">Verdict:</span>
                    <span className={isConditional ? 'text-emerald-400' : 'text-amber-300'}>
                      {loc.compatibilityVerdict}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900 p-2 rounded border border-slate-800">
                    {loc.technicalLimitationNote}
                  </p>
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Last audit: {loc.lastAuditedDate}</span>
                <button
                  id={`btn-probe-${loc.id}`}
                  onClick={() => onSimulateReader(loc.id)}
                  className="flex items-center space-x-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
                >
                  <span>Simulate Tap</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredLocations.length === 0 && (
          <div className="col-span-full bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No matching access locations found</p>
            <p className="text-xs text-slate-500">Try modifying your filter parameters or search keyword.</p>
          </div>
        )}
      </div>

      {/* Register New Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Register KPMBP Access Point</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="text-xs text-rose-300 bg-rose-950/60 border border-rose-800 p-2.5 rounded-md">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateLocation} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Facility Name / Room</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics Laboratory 104"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Facility Code</label>
                  <input
                    type="text"
                    required
                    placeholder="KPMBP-PHY-1-104"
                    value={newLocCode}
                    onChange={(e) => setNewLocCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Security Tier</label>
                  <select
                    value={newLocTier}
                    onChange={(e) => setNewLocTier(e.target.value as SecurityTier)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="TIER_1_GENERAL">Tier 1 - General Access</option>
                    <option value="TIER_2_RESTRICTED">Tier 2 - Restricted Staff</option>
                    <option value="TIER_3_CRITICAL">Tier 3 - Critical Asset</option>
                    <option value="TIER_4_INFRASTRUCTURE">Tier 4 - Infrastructure</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Building</label>
                  <input
                    type="text"
                    value={newLocBuilding}
                    onChange={(e) => setNewLocBuilding(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Authentication Mode</label>
                  <select
                    value={newLocAuthMode}
                    onChange={(e) => setNewLocAuthMode(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="UNKNOWN_PENDING_AUDIT">Unknown (Pending Audit)</option>
                    <option value="UID_ONLY">UID Only (Legacy CSN)</option>
                    <option value="CRYPTO1_SECTOR_KEYS">CRYPTO1 Sector Keys (MIFARE)</option>
                    <option value="ISO_7816_APDU">ISO 7816-4 APDU (HCE Ready)</option>
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-amber-300/80 bg-amber-950/40 p-2 rounded border border-amber-900/50">
                Notice: MIFARE Classic 1K and UID-only readers will automatically be flagged as UNSUPPORTED in accordance
                with SES v4.5 anti-cloning and framing rules.
              </p>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Save Access Point
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
