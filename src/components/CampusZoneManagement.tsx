import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Plus,
  Edit2,
  Power,
  DoorClosed,
  History,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  MapPin,
  RefreshCw,
  Building,
  ChevronRight,
  ExternalLink,
  Trash2,
  Info,
} from 'lucide-react';
import { CampusZone, Door, ZoneStatus } from '../types';
import { serverFunctions } from '../services/functionsService';

interface CampusZoneManagementProps {
  doors: Door[];
  onRefreshDoors?: () => void;
}

export const CampusZoneManagement: React.FC<CampusZoneManagementProps> = ({
  doors,
  onRefreshDoors,
}) => {
  const [zones, setZones] = useState<CampusZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Create / Edit Modal
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<CampusZone | null>(null);
  const [formZoneId, setFormZoneId] = useState('');
  const [formZoneName, setFormZoneName] = useState('');
  const [formZoneCode, setFormZoneCode] = useState('');
  const [formBuilding, setFormBuilding] = useState('Bangunan Akademik A');
  const [formFloor, setFormFloor] = useState('Aras Bawah');
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSecurityLevel, setFormSecurityLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'RESTRICTED'>('MEDIUM');
  const [formStatus, setFormStatus] = useState<ZoneStatus>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);

  // Status Toggle Modal
  const [toggleModalOpen, setToggleModalOpen] = useState(false);
  const [selectedZoneForToggle, setSelectedZoneForToggle] = useState<CampusZone | null>(null);
  const [targetStatus, setTargetStatus] = useState<ZoneStatus>('INACTIVE');
  const [toggleReason, setToggleReason] = useState('Penyelenggaraan berkala atau kawalan zon kampus.');
  const [forceToggle, setForceToggle] = useState(false);
  const [activeDoorsWarning, setActiveDoorsWarning] = useState<string[]>([]);

  // Door Assignment Modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedZoneForAssign, setSelectedZoneForAssign] = useState<CampusZone | null>(null);
  const [selectedDoorToAssign, setSelectedDoorToAssign] = useState('');
  const [assignReason, setAssignReason] = useState('Penetapan pintu rasmi ke dalam zon kampus KPMBP.');
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Zone Audit History Modal
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedZoneForAudit, setSelectedZoneForAudit] = useState<CampusZone | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Detail / Door list modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedZoneDetail, setSelectedZoneDetail] = useState<CampusZone | null>(null);

  const fetchZones = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await serverFunctions.getZones();
      setZones(res.zones || []);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat turun data zon kampus.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const openCreateModal = () => {
    setEditingZone(null);
    setFormZoneId(`ZONE-${Date.now().toString().slice(-4)}`);
    setFormZoneName('');
    setFormZoneCode('');
    setFormBuilding('Bangunan Akademik A');
    setFormFloor('Aras Bawah');
    setFormLocation('Kampus KPMBP');
    setFormDescription('');
    setFormSecurityLevel('LOW');
    setFormStatus('ACTIVE');
    setZoneModalOpen(true);
  };

  const openEditModal = (z: CampusZone) => {
    setEditingZone(z);
    setFormZoneId(z.zoneId);
    setFormZoneName(z.zoneName);
    setFormZoneCode(z.zoneCode || '');
    setFormBuilding(z.building || 'Bangunan Akademik A');
    setFormFloor(z.floor || 'Aras Bawah');
    setFormLocation(z.location || '');
    setFormDescription(z.description || '');
    setFormSecurityLevel(z.securityLevel || 'MEDIUM');
    setFormStatus(z.status || (z.isActive ? 'ACTIVE' : 'INACTIVE'));
    setZoneModalOpen(true);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formZoneName.trim()) {
      alert('Nama zon wajib diisi.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingZone) {
        await serverFunctions.updateZone({
          zoneId: editingZone.zoneId,
          zoneName: formZoneName.trim(),
          zoneCode: formZoneCode.trim().toUpperCase(),
          building: formBuilding.trim(),
          floor: formFloor.trim(),
          location: formLocation.trim(),
          description: formDescription.trim(),
          securityLevel: formSecurityLevel,
        });
        setActionFeedback(`Zon ${editingZone.zoneId} berjaya dikemaskini.`);
      } else {
        await serverFunctions.createZone({
          zoneId: formZoneId.trim().toUpperCase(),
          zoneName: formZoneName.trim(),
          zoneCode: formZoneCode.trim().toUpperCase(),
          building: formBuilding.trim(),
          floor: formFloor.trim(),
          location: formLocation.trim(),
          description: formDescription.trim(),
          securityLevel: formSecurityLevel,
          status: formStatus,
        });
        setActionFeedback(`Zon ${formZoneId.trim().toUpperCase()} berjaya didaftarkan.`);
      }
      setZoneModalOpen(false);
      await fetchZones();
      if (onRefreshDoors) onRefreshDoors();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan zon.');
    } finally {
      setSubmitting(false);
    }
  };

  const openToggleModal = (z: CampusZone) => {
    setSelectedZoneForToggle(z);
    const nextStatus: ZoneStatus = z.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setTargetStatus(nextStatus);
    setForceToggle(false);
    setToggleReason(
      nextStatus === 'ACTIVE'
        ? 'Pengaktifan semula zon kampus selepas penyelenggaraan atau pemeriksaan keselamatan.'
        : 'Nyahaktif sementara bagi kerja naik taraf atau sekatan zon kampus.'
    );

    // Check if zone has active doors
    if (nextStatus === 'INACTIVE') {
      const activeDoors = (z.assignedDoors || []).filter((dId) => {
        const found = doors.find((d) => d.doorId === dId);
        return found && found.operationalStatus === 'ACTIVE';
      });
      setActiveDoorsWarning(activeDoors);
    } else {
      setActiveDoorsWarning([]);
    }

    setToggleModalOpen(true);
  };

  const handleConfirmToggle = async () => {
    if (!selectedZoneForToggle) return;
    try {
      setSubmitting(true);
      await serverFunctions.toggleZoneStatus({
        zoneId: selectedZoneForToggle.zoneId,
        newStatus: targetStatus,
        reason: toggleReason,
        force: forceToggle,
      });
      setActionFeedback(`Status zon ${selectedZoneForToggle.zoneId} ditukar kepada ${targetStatus}.`);
      setToggleModalOpen(false);
      await fetchZones();
      if (onRefreshDoors) onRefreshDoors();
    } catch (err: any) {
      alert(err.message || 'Gagal menukar status zon.');
    } finally {
      setSubmitting(false);
    }
  };

  const openAssignModal = (z: CampusZone) => {
    setSelectedZoneForAssign(z);
    // Suggest first unassigned door or door in other zone
    const available = doors.filter((d) => !(z.assignedDoors || []).includes(d.doorId));
    setSelectedDoorToAssign(available[0]?.doorId || '');
    setAssignReason(`Penetapan pintu ke zon ${z.zoneName} (${z.zoneId})`);
    setAssignModalOpen(true);
  };

  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZoneForAssign || !selectedDoorToAssign) return;

    try {
      setAssignSubmitting(true);
      await serverFunctions.assignDoorToZone({
        zoneId: selectedZoneForAssign.zoneId,
        doorId: selectedDoorToAssign,
        reason: assignReason,
      });
      setActionFeedback(`Pintu ${selectedDoorToAssign} berjaya dipautkan ke zon ${selectedZoneForAssign.zoneName}.`);
      setAssignModalOpen(false);
      await fetchZones();
      if (onRefreshDoors) onRefreshDoors();
    } catch (err: any) {
      alert(err.message || 'Gagal menetapkan pintu ke zon.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleRemoveDoor = async (zoneId: string, doorId: string) => {
    if (!confirm(`Adakah anda pasti ingin mengeluarkan pintu "${doorId}" daripada zon ini?`)) {
      return;
    }
    try {
      setLoading(true);
      await serverFunctions.removeDoorFromZone({
        zoneId,
        doorId,
        reason: `Pintu ${doorId} dikeluarkan daripada zon oleh Master Admin.`,
      });
      setActionFeedback(`Pintu ${doorId} dikeluarkan daripada zon ${zoneId}.`);
      await fetchZones();
      if (onRefreshDoors) onRefreshDoors();
    } catch (err: any) {
      alert(err.message || 'Gagal mengeluarkan pintu daripada zon.');
    } finally {
      setLoading(false);
    }
  };

  const openAuditHistory = async (z: CampusZone) => {
    setSelectedZoneForAudit(z);
    setAuditModalOpen(true);
    setLoadingAudit(true);
    try {
      const res = await serverFunctions.getZoneAuditHistory(z.zoneId);
      setAuditLogs(res.auditEntries || []);
    } catch (err: any) {
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Filtered zones
  const filteredZones = zones.filter((z) => {
    const matchSearch =
      z.zoneName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      z.zoneId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (z.zoneCode && z.zoneCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (z.building && z.building.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchBuilding = buildingFilter === 'ALL' || z.building === buildingFilter;
    const matchStatus = statusFilter === 'ALL' || z.status === statusFilter;

    return matchSearch && matchBuilding && matchStatus;
  });

  const uniqueBuildings = Array.from(new Set(zones.map((z) => z.building).filter(Boolean)));

  return (
    <div className="space-y-6" id="campus-zone-management-root">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-white">Pengurusan Zon Kampus (Campus Zones)</h2>
              <p className="text-xs text-slate-400">
                Piawaian SES-SEC-4.5.5: Kawalan perimeter keselamatan, pemetaan pintu fizikal & jejak audit zon KPMBP
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="btn-refresh-zones"
            onClick={fetchZones}
            disabled={loading}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Muat Semula</span>
          </button>

          <button
            id="btn-create-zone"
            onClick={openCreateModal}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Daftar Zon Baharu</span>
          </button>
        </div>
      </div>

      {/* Action feedback message */}
      {actionFeedback && (
        <div className="p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-emerald-400 hover:text-white font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-900/30 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            id="input-zone-search"
            type="text"
            placeholder="Cari nama zon, kod zon, ID, atau bangunan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <select
            id="select-filter-building"
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Bangunan ({uniqueBuildings.length})</option>
            {uniqueBuildings.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            id="select-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">ACTIVE Sahaja</option>
            <option value="INACTIVE">INACTIVE Sahaja</option>
          </select>
        </div>
      </div>

      {/* Zone Cards Grid */}
      {loading && zones.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-slate-800">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">Memuatkan direktori zon kampus KPMBP...</p>
        </div>
      ) : filteredZones.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-slate-800">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-300">Tiada Zon Ditemui</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Tiada rekod zon kampus yang sepadan dengan kriteria carian atau penapis anda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredZones.map((zone) => {
            const assignedDoorList = (zone.assignedDoors || []).map((dId) => {
              const d = doors.find((door) => door.doorId === dId);
              return {
                doorId: dId,
                name: d ? d.doorName || d.name : dId,
                status: d?.operationalStatus || 'UNKNOWN',
              };
            });

            return (
              <div
                key={zone.zoneId}
                id={`zone-card-${zone.zoneId}`}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start space-x-3">
                      <div className="p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-indigo-400 mt-0.5">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-bold text-white">{zone.zoneName}</h3>
                          <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded font-mono text-[10px] font-semibold">
                            {zone.zoneCode}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-400 text-xs mt-1">
                          <Building className="w-3.5 h-3.5 text-slate-500" />
                          <span>{zone.building}</span>
                          <span>•</span>
                          <span>{zone.floor}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-1">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                          zone.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}
                      >
                        {zone.status}
                      </span>
                      {zone.securityLevel && (
                        <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                          <Shield className="w-3 h-3 text-slate-500" />
                          <span>{zone.securityLevel} SEC</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {zone.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
                      {zone.description}
                    </p>
                  )}

                  {/* Assigned Doors section */}
                  <div className="mt-3 pt-3 border-t border-slate-800/70">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                        <DoorClosed className="w-3.5 h-3.5 text-slate-400" />
                        <span>Pintu Fizikal Berpaut ({assignedDoorList.length})</span>
                      </span>
                      <button
                        onClick={() => openAssignModal(zone)}
                        disabled={zone.status !== 'ACTIVE'}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1 disabled:opacity-40 disabled:hover:text-indigo-400"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Pautkan Pintu</span>
                      </button>
                    </div>

                    {assignedDoorList.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">Tiada pintu dipautkan kepada zon ini.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {assignedDoorList.map((d) => (
                          <div
                            key={d.doorId}
                            className="flex items-center space-x-1 px-2 py-1 bg-slate-800/80 border border-slate-700/70 rounded-lg text-[11px] text-slate-300"
                          >
                            <span className="font-mono text-slate-400">{d.doorId}</span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                d.status === 'ACTIVE'
                                  ? 'bg-emerald-400'
                                  : d.status === 'MAINTENANCE'
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                              }`}
                            />
                            <button
                              onClick={() => handleRemoveDoor(zone.zoneId, d.doorId)}
                              title="Keluarkan pintu daripada zon"
                              className="text-slate-500 hover:text-rose-400 transition ml-1"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] text-slate-500">{zone.zoneId}</span>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openAuditHistory(zone)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                      title="Lihat Jejak Audit Zon"
                    >
                      <History className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => openEditModal(zone)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                      title="Kemaskini Maklumat Zon"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => openToggleModal(zone)}
                      className={`p-1.5 rounded-lg transition ${
                        zone.status === 'ACTIVE'
                          ? 'text-rose-400 hover:bg-rose-950/30'
                          : 'text-emerald-400 hover:bg-emerald-950/30'
                      }`}
                      title={zone.status === 'ACTIVE' ? 'Nyahaktifkan Zon' : 'Aktifkan Zon'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT ZONE MODAL */}
      {zoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>{editingZone ? 'Kemaskini Zon Kampus' : 'Daftar Zon Kampus Baharu'}</span>
              </h3>
              <button
                onClick={() => setZoneModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Zone ID <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingZone}
                    value={formZoneId}
                    onChange={(e) => setFormZoneId(e.target.value.toUpperCase())}
                    placeholder="ZONE-LIBRARY"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white uppercase font-mono disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Kod Zon (zoneCode) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formZoneCode}
                    onChange={(e) => setFormZoneCode(e.target.value.toUpperCase())}
                    placeholder="Z-LIB"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Rasmi Zon <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formZoneName}
                  onChange={(e) => setFormZoneName(e.target.value)}
                  placeholder="Zon Perpustakaan & Pusat Sumber Digital"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Bangunan</label>
                  <input
                    type="text"
                    value={formBuilding}
                    onChange={(e) => setFormBuilding(e.target.value)}
                    placeholder="Bangunan Akademik A"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Aras / Floor</label>
                  <input
                    type="text"
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    placeholder="Aras 1"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Lokasi Terperinci</label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Sayap Barat KPMBP"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tahap Keselamatan</label>
                  <select
                    value={formSecurityLevel}
                    onChange={(e: any) => setFormSecurityLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="LOW">LOW (Umum/Pelajar)</option>
                    <option value="MEDIUM">MEDIUM (Staf/Makmal)</option>
                    <option value="HIGH">HIGH (Pentadbiran/Kewangan)</option>
                    <option value="RESTRICTED">RESTRICTED (Bilik Server/Arkib)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Penerangan Skop Zon</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Kawasan zon pembelajaran terbuka, bilik perbincangan, dan pangkalan data rujukan."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setZoneModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : editingZone ? 'Kemaskini Zon' : 'Daftar Zon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOGGLE STATUS MODAL */}
      {toggleModalOpen && selectedZoneForToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <h3 className="text-sm font-bold text-white">
                Tukar Status Zon: {selectedZoneForToggle.zoneName}
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Anda sedang menukar status operasi zon daripada{' '}
              <span className="font-bold text-indigo-400">{selectedZoneForToggle.status}</span> kepada{' '}
              <span className="font-bold text-amber-400">{targetStatus}</span>.
            </p>

            {/* Warning if zone has active doors */}
            {activeDoorsWarning.length > 0 && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>SES-SEC-4.5.5 Amaran Pintu Aktif!</span>
                </div>
                <p className="text-[11px] leading-normal">
                  Zon ini masih mengandungi {activeDoorsWarning.length} pintu aktif: (
                  {activeDoorsWarning.join(', ')}). Sila pastikan kawalan fizikal diuruskan terlebih dahulu.
                </p>
                <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceToggle}
                    onChange={(e) => setForceToggle(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-[11px] text-white font-medium">
                    Sahkan penutupan paksa (Force override perakuan Master Admin)
                  </span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Justifikasi Rasmi Penukaran Status <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={toggleReason}
                onChange={(e) => setToggleReason(e.target.value)}
                placeholder="Nyatakan alasan rasmi SES-SEC-4.5.5..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Mandatori mengikut klausul forensik SES-SEC-4.5.5. Disimpan kekal dalam jejak audit.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setToggleModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmToggle}
                disabled={submitting || (activeDoorsWarning.length > 0 && !forceToggle)}
                className={`px-4 py-2 text-white rounded-xl text-xs font-semibold disabled:opacity-50 ${
                  targetStatus === 'ACTIVE' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {submitting ? 'Memproses...' : `Sahkan Penukaran (${targetStatus})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN DOOR MODAL */}
      {assignModalOpen && selectedZoneForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <DoorClosed className="w-4 h-4 text-indigo-400" />
                <span>Pautkan Pintu ke Zon: {selectedZoneForAssign.zoneName}</span>
              </h3>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleConfirmAssign} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pilih Pintu Fizikal Kampus <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={selectedDoorToAssign}
                  onChange={(e) => setSelectedDoorToAssign(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="">-- Pilih Pintu --</option>
                  {doors.map((d) => {
                    const isAlreadyHere = (selectedZoneForAssign.assignedDoors || []).includes(d.doorId);
                    return (
                      <option key={d.doorId} value={d.doorId} disabled={isAlreadyHere}>
                        {d.doorId} - {d.doorName || d.name} ({d.zoneId || 'Tiada Zon'}) {isAlreadyHere ? '(Sudah Ada)' : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Status integrasi perkakasan (SIMULATED/VERIFIED) akan dikekalkan secara autoritatif.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Alasan Penugasan</label>
                <input
                  type="text"
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="Penetapan pintu ke perimeter zon keselamatan..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting || !selectedDoorToAssign}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {assignSubmitting ? 'Memautkan...' : 'Pautkan Pintu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ZONE AUDIT HISTORY MODAL */}
      {auditModalOpen && selectedZoneForAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  Jejak Audit Forensik Zon: {selectedZoneForAudit.zoneName} ({selectedZoneForAudit.zoneId})
                </h3>
              </div>
              <button
                onClick={() => setAuditModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-2">
              {loadingAudit ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Mengambil rekod jejak audit zon...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Tiada sejarah audit direkodkan untuk zon ini lagi.</p>
                </div>
              ) : (
                auditLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="p-3 bg-slate-950 border border-slate-800/80 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-indigo-300 font-mono text-[11px]">{log.action}</span>
                      <span className="text-[10px] text-slate-500">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('ms-MY') : '-'}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{log.details || log.reason}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>Pelaku: {log.actorEmail || log.actorId}</span>
                      {log.previousStatus && log.newStatus && (
                        <span>
                          Transisi: {log.previousStatus} → {log.newStatus}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
