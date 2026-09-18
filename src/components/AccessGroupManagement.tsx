import React, { useState, useEffect } from 'react';
import {
  Users,
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
  Layers,
  Calendar,
  UserPlus,
  UserMinus,
  RefreshCw,
  ExternalLink,
  Trash2,
  Info,
  Check,
} from 'lucide-react';
import { AccessGroup, AccessGroupStatus, AccessGroupType, Door, AppUser, CampusZone } from '../types';
import { serverFunctions } from '../services/functionsService';

interface AccessGroupManagementProps {
  doors: Door[];
  users: AppUser[];
  onRefreshDoors?: () => void;
}

export const AccessGroupManagement: React.FC<AccessGroupManagementProps> = ({
  doors,
  users,
  onRefreshDoors,
}) => {
  const [accessGroups, setAccessGroups] = useState<AccessGroup[]>([]);
  const [zones, setZones] = useState<CampusZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Create / Edit Modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AccessGroup | null>(null);
  const [formGroupId, setFormGroupId] = useState('');
  const [formGroupName, setFormGroupName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formGroupType, setFormGroupType] = useState<AccessGroupType>('STUDENT');
  const [formAssignedZones, setFormAssignedZones] = useState<string[]>([]);
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('18:00');
  const [formValidFrom, setFormValidFrom] = useState('2026-09-01');
  const [formValidUntil, setFormValidUntil] = useState('2027-12-31');
  const [formStatus, setFormStatus] = useState<AccessGroupStatus>('ACTIVE');
  const [submitting, setSubmitting] = useState(false);

  // Status Toggle Modal
  const [toggleModalOpen, setToggleModalOpen] = useState(false);
  const [selectedGroupForToggle, setSelectedGroupForToggle] = useState<AccessGroup | null>(null);
  const [targetStatus, setTargetStatus] = useState<AccessGroupStatus>('INACTIVE');
  const [toggleReason, setToggleReason] = useState('Penyelenggaraan dasar akses keselamatan kampus KPMBP.');

  // User Membership Modal
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [selectedGroupForUsers, setSelectedGroupForUsers] = useState<AccessGroup | null>(null);
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState('');
  const [userActionReason, setUserActionReason] = useState('Penetapan identiti staf/pelajar ke kumpulan akses SES v4.5.');
  const [userSubmitting, setUserSubmitting] = useState(false);

  // Door Assignment Modal
  const [doorModalOpen, setDoorModalOpen] = useState(false);
  const [selectedGroupForDoors, setSelectedGroupForDoors] = useState<AccessGroup | null>(null);
  const [selectedDoorIdToAdd, setSelectedDoorIdToAdd] = useState('');
  const [doorActionReason, setDoorActionReason] = useState('Pemberian hak akses fizikal pintu kepada kumpulan.');
  const [doorSubmitting, setDoorSubmitting] = useState(false);

  // Audit History Modal
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [selectedGroupForAudit, setSelectedGroupForAudit] = useState<AccessGroup | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Detail Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<AccessGroup | null>(null);

  const fetchAccessGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      const [resGroups, resZones] = await Promise.all([
        serverFunctions.getAccessGroups(),
        serverFunctions.getZones().catch(() => ({ zones: [] })),
      ]);
      setAccessGroups(resGroups.accessGroups || []);
      setZones(resZones.zones || []);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat turun data kumpulan akses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessGroups();
  }, []);

  const openCreateModal = () => {
    setEditingGroup(null);
    setFormGroupId(`AG-${Date.now().toString().slice(-5)}`);
    setFormGroupName('');
    setFormDescription('');
    setFormGroupType('STUDENT');
    setFormAssignedZones([]);
    setFormDays([1, 2, 3, 4, 5]);
    setFormStartTime('08:00');
    setFormEndTime('18:00');
    setFormValidFrom(new Date().toISOString().split('T')[0]);
    setFormValidUntil('2028-12-31');
    setFormStatus('ACTIVE');
    setGroupModalOpen(true);
  };

  const openEditModal = (ag: AccessGroup) => {
    setEditingGroup(ag);
    setFormGroupId(ag.groupId);
    setFormGroupName(ag.groupName || ag.name || '');
    setFormDescription(ag.description || '');
    setFormGroupType(ag.groupType || 'CUSTOM');
    setFormAssignedZones(ag.assignedZones || []);
    const sched = ag.allowedSchedule || ag.timeRestrictions;
    setFormDays(sched?.daysOfWeek || [1, 2, 3, 4, 5]);
    setFormStartTime(sched?.startTime || '08:00');
    setFormEndTime(sched?.endTime || '18:00');
    setFormValidFrom((ag.validFrom || '').split('T')[0] || '2026-01-01');
    setFormValidUntil((ag.validUntil || '').split('T')[0] || '2028-12-31');
    setFormStatus(ag.status || 'ACTIVE');
    setGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formGroupId.trim() || !formGroupName.trim()) {
      alert('Sila lengkapkan ID Kumpulan dan Nama Kumpulan Akses.');
      return;
    }

    setSubmitting(true);
    try {
      const allowedSchedule = {
        daysOfWeek: formDays,
        startTime: formStartTime,
        endTime: formEndTime,
        timezone: 'Asia/Kuala_Lumpur',
      };

      if (editingGroup) {
        await serverFunctions.updateAccessGroup({
          groupId: editingGroup.groupId,
          groupName: formGroupName.trim(),
          description: formDescription.trim(),
          groupType: formGroupType,
          assignedZones: formAssignedZones,
          allowedSchedule,
          validFrom: new Date(formValidFrom).toISOString(),
          validUntil: new Date(formValidUntil).toISOString(),
        });
        setActionFeedback(`Kumpulan akses ${formGroupName} berjaya dikemaskini.`);
      } else {
        await serverFunctions.createAccessGroup({
          groupId: formGroupId.trim(),
          groupName: formGroupName.trim(),
          description: formDescription.trim(),
          groupType: formGroupType,
          assignedZones: formAssignedZones,
          assignedDoors: [],
          assignedUsers: [],
          allowedSchedule,
          validFrom: new Date(formValidFrom).toISOString(),
          validUntil: new Date(formValidUntil).toISOString(),
          status: formStatus,
        });
        setActionFeedback(`Kumpulan akses baharu ${formGroupName} berjaya didaftarkan.`);
      }

      setGroupModalOpen(false);
      await fetchAccessGroups();
      if (onRefreshDoors) onRefreshDoors();
    } catch (err: any) {
      alert('Ralat menyimpan kumpulan akses: ' + (err?.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const openToggleModal = (ag: AccessGroup, next: AccessGroupStatus) => {
    setSelectedGroupForToggle(ag);
    setTargetStatus(next);
    setToggleReason(
      next === 'INACTIVE'
        ? 'Nyahaktifkan hak kumpulan akses bagi tujuan audit atau penggantungan polisi.'
        : 'Pengaktifan semula kumpulan akses rasmi kampus KPMBP.'
    );
    setToggleModalOpen(true);
  };

  const handleConfirmToggle = async () => {
    if (!selectedGroupForToggle) return;
    if (!toggleReason || toggleReason.trim().length < 10) {
      alert('SES-SEC-4.5.5: Alasan rasmi pertukaran status wajib diberikan (sekurang-kurangnya 10 aksara).');
      return;
    }

    try {
      await serverFunctions.toggleAccessGroupStatus({
        groupId: selectedGroupForToggle.groupId,
        newStatus: targetStatus,
        reason: toggleReason.trim(),
      });
      setActionFeedback(`Status kumpulan ${selectedGroupForToggle.groupName} berjaya ditukar ke ${targetStatus}.`);
      setToggleModalOpen(false);
      await fetchAccessGroups();
    } catch (err: any) {
      alert('Ralat menukar status kumpulan: ' + (err?.message || err));
    }
  };

  const openUserModal = (ag: AccessGroup) => {
    setSelectedGroupForUsers(ag);
    setSelectedUserIdToAdd('');
    setUserActionReason('Penetapan ahli kumpulan akses kampus KPMBP.');
    setUserModalOpen(true);
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupForUsers || !selectedUserIdToAdd) {
      alert('Sila pilih pengguna untuk ditetapkan.');
      return;
    }

    setUserSubmitting(true);
    try {
      await serverFunctions.assignUserToGroup({
        groupId: selectedGroupForUsers.groupId,
        userId: selectedUserIdToAdd,
        reason: userActionReason.trim(),
      });
      setActionFeedback(`Pengguna ${selectedUserIdToAdd} berjaya dimasukkan ke kumpulan akses.`);
      setSelectedUserIdToAdd('');
      await fetchAccessGroups();
      // Update modal state
      setSelectedGroupForUsers((prev) =>
        prev
          ? {
              ...prev,
              assignedUsers: [...new Set([...prev.assignedUsers, selectedUserIdToAdd])],
            }
          : null
      );
    } catch (err: any) {
      alert('Ralat menetapkan pengguna: ' + (err?.message || err));
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!selectedGroupForUsers) return;
    if (!confirm(`Adakah anda pasti mahu mengeluarkan ${userId} daripada kumpulan akses ini?`)) return;

    try {
      await serverFunctions.removeUserFromGroup({
        groupId: selectedGroupForUsers.groupId,
        userId,
        reason: 'Penyingkiran pengguna daripada kumpulan akses oleh Master Admin.',
      });
      setActionFeedback(`Pengguna ${userId} berjaya dikeluarkan daripada kumpulan akses.`);
      await fetchAccessGroups();
      setSelectedGroupForUsers((prev) =>
        prev
          ? {
              ...prev,
              assignedUsers: prev.assignedUsers.filter((u) => u !== userId),
            }
          : null
      );
    } catch (err: any) {
      alert('Ralat mengeluarkan pengguna: ' + (err?.message || err));
    }
  };

  const openDoorModal = (ag: AccessGroup) => {
    setSelectedGroupForDoors(ag);
    setSelectedDoorIdToAdd('');
    setDoorActionReason('Pemberian hak akses fizikal pintu kepada kumpulan.');
    setDoorModalOpen(true);
  };

  const handleAssignDoor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupForDoors || !selectedDoorIdToAdd) {
      alert('Sila pilih pintu untuk dipautkan.');
      return;
    }

    setDoorSubmitting(true);
    try {
      await serverFunctions.assignDoorToGroup({
        groupId: selectedGroupForDoors.groupId,
        doorId: selectedDoorIdToAdd,
        reason: doorActionReason.trim(),
      });
      setActionFeedback(`Pintu ${selectedDoorIdToAdd} berjaya dipautkan ke kumpulan akses.`);
      setSelectedDoorIdToAdd('');
      await fetchAccessGroups();
      if (onRefreshDoors) onRefreshDoors();
      setSelectedGroupForDoors((prev) =>
        prev
          ? {
              ...prev,
              assignedDoors: [...new Set([...prev.assignedDoors, selectedDoorIdToAdd])],
            }
          : null
      );
    } catch (err: any) {
      alert('Ralat memautkan pintu: ' + (err?.message || err));
    } finally {
      setDoorSubmitting(false);
    }
  };

  const handleRemoveDoor = async (doorId: string) => {
    if (!selectedGroupForDoors) return;
    if (!confirm(`Adakah anda pasti mahu mengeluarkan pintu ${doorId} daripada kumpulan akses ini?`)) return;

    try {
      await serverFunctions.removeDoorFromGroup({
        groupId: selectedGroupForDoors.groupId,
        doorId,
        reason: 'Pembuangan hak akses pintu oleh Master Admin.',
      });
      setActionFeedback(`Pintu ${doorId} berjaya dikeluarkan daripada kumpulan akses.`);
      await fetchAccessGroups();
      if (onRefreshDoors) onRefreshDoors();
      setSelectedGroupForDoors((prev) =>
        prev
          ? {
              ...prev,
              assignedDoors: prev.assignedDoors.filter((d) => d !== doorId),
            }
          : null
      );
    } catch (err: any) {
      alert('Ralat mengeluarkan pintu: ' + (err?.message || err));
    }
  };

  const openAuditModal = async (ag: AccessGroup) => {
    setSelectedGroupForAudit(ag);
    setAuditModalOpen(true);
    setLoadingAudit(true);
    try {
      const res = await serverFunctions.getAccessGroupAuditHistory(ag.groupId);
      setAuditLogs(res.auditEntries || []);
    } catch {
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  const openDetailModal = (ag: AccessGroup) => {
    setSelectedGroupDetail(ag);
    setDetailModalOpen(true);
  };

  // Filtered Groups
  const filteredGroups = accessGroups.filter((g) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      g.groupName.toLowerCase().includes(term) ||
      g.groupId.toLowerCase().includes(term) ||
      (g.description || '').toLowerCase().includes(term);
    const matchesType = typeFilter === 'ALL' || g.groupType === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || g.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Schedule Presets
  const applySchedulePreset = (preset: 'OFFICE' | '24_7' | 'EXTENDED') => {
    if (preset === 'OFFICE') {
      setFormDays([1, 2, 3, 4, 5]);
      setFormStartTime('08:00');
      setFormEndTime('18:00');
    } else if (preset === '24_7') {
      setFormDays([0, 1, 2, 3, 4, 5, 6]);
      setFormStartTime('00:00');
      setFormEndTime('23:59');
    } else if (preset === 'EXTENDED') {
      setFormDays([1, 2, 3, 4, 5, 6]);
      setFormStartTime('07:00');
      setFormEndTime('22:00');
    }
  };

  const dayLabels = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

  return (
    <div className="space-y-4">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Pengurusan Kumpulan Akses Kampus (Access Groups)</span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Tadbir urus peranan, jadual capaian, penetapan pintu, dan keahlian staf/pelajar KPMBP (SES v4.5)
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchAccessGroups}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Muat Semula Kumpulan Akses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            id="btn-create-access-group"
            onClick={openCreateModal}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Daftar Kumpulan Akses</span>
          </button>
        </div>
      </div>

      {/* ACTION FEEDBACK */}
      {actionFeedback && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 px-3 py-2 rounded-xl text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-emerald-400 hover:text-emerald-200">
            &times;
          </button>
        </div>
      )}

      {/* METRIC OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
          <div className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Jumlah Kumpulan</div>
          <div className="text-xl font-bold text-white font-mono">{accessGroups.length}</div>
          <div className="text-[10px] text-slate-500">Konfigurasi Aktif & Tidak Aktif</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
          <div className="text-emerald-400 text-[10px] font-medium uppercase tracking-wider">Kumpulan Aktif</div>
          <div className="text-xl font-bold text-emerald-400 font-mono">
            {accessGroups.filter((g) => g.status === 'ACTIVE').length}
          </div>
          <div className="text-[10px] text-slate-500">Beroperasi dalam sistem</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
          <div className="text-indigo-400 text-[10px] font-medium uppercase tracking-wider">Pautan Pintu</div>
          <div className="text-xl font-bold text-indigo-400 font-mono">
            {accessGroups.reduce((acc, g) => acc + (g.assignedDoors?.length || 0), 0)}
          </div>
          <div className="text-[10px] text-slate-500">Kebenaran fizikal diberikan</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs space-y-1">
          <div className="text-amber-400 text-[10px] font-medium uppercase tracking-wider">Jumlah Keahlian</div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {accessGroups.reduce((acc, g) => acc + (g.assignedUsers?.length || 0), 0)}
          </div>
          <div className="text-[10px] text-slate-500">Identiti staf / pelajar terpaut</div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari ID, nama kumpulan, atau penerangan..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">Semua Jenis Kumpulan</option>
          <option value="STUDENT">STUDENT (Pelajar)</option>
          <option value="STAFF">STAFF (Staf)</option>
          <option value="FACULTY">FACULTY (Pensyarah)</option>
          <option value="SECURITY">SECURITY (Keselamatan)</option>
          <option value="MAINTENANCE">MAINTENANCE (Penyelenggaraan)</option>
          <option value="CONTRACTOR">CONTRACTOR (Kontraktor)</option>
          <option value="CUSTOM">CUSTOM (Khas)</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="ALL">Semua Status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="bg-rose-950/80 border border-rose-800 text-rose-300 px-4 py-3 rounded-xl text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ACCESS GROUPS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGroups.map((group) => {
          const isAct = group.status === 'ACTIVE';
          const schedule = group.allowedSchedule || group.timeRestrictions;
          return (
            <div
              key={group.groupId}
              className={`bg-slate-900 border rounded-2xl p-4 flex flex-col justify-between transition space-y-3 ${
                isAct
                  ? 'border-slate-800 hover:border-slate-700 shadow-sm'
                  : 'border-rose-900/40 bg-slate-950/60 opacity-80'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-white text-sm">{group.groupName}</span>
                    </div>
                    <span className="font-mono text-slate-400 text-[11px] block">{group.groupId}</span>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                        isAct
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {group.status}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {group.groupType}
                    </span>
                  </div>
                </div>

                <p className="text-slate-400 text-xs line-clamp-2 min-h-[32px]">
                  {group.description || 'Tiada penerangan ditetapkan untuk kumpulan akses ini.'}
                </p>

                {/* Schedule info badge */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 text-[11px] text-slate-300 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      <span>Jadual Akses:</span>
                    </span>
                    <span className="font-mono text-indigo-300 font-semibold">
                      {schedule ? `${schedule.startTime} - ${schedule.endTime}` : '24/7'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-emerald-400" />
                      <span>Sah Hingga:</span>
                    </span>
                    <span className="font-mono text-slate-300">
                      {group.validUntil ? new Date(group.validUntil).toLocaleDateString('ms-MY') : 'Tiada Had'}
                    </span>
                  </div>
                </div>

                {/* Counters */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                  <div className="bg-slate-800/60 rounded-lg p-1.5 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400">Ahli</div>
                    <div className="font-mono text-xs font-bold text-white">
                      {group.assignedUsers?.length || 0}
                    </div>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg p-1.5 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400">Pintu</div>
                    <div className="font-mono text-xs font-bold text-indigo-300">
                      {group.assignedDoors?.length || 0}
                    </div>
                  </div>
                  <div className="bg-slate-800/60 rounded-lg p-1.5 border border-slate-700/50">
                    <div className="text-[10px] text-slate-400">Zon</div>
                    <div className="font-mono text-xs font-bold text-emerald-300">
                      {group.assignedZones?.length || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openDetailModal(group)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center space-x-1 transition"
                    title="Lihat Maklumat Penuh Kumpulan"
                  >
                    <Info className="w-3 h-3 text-slate-400" />
                    <span>Info</span>
                  </button>
                  <button
                    onClick={() => openAuditModal(group)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded border border-slate-700 flex items-center space-x-1 transition"
                    title="Lihat Sejarah Audit Kumpulan"
                  >
                    <History className="w-3 h-3 text-indigo-400" />
                    <span>Audit</span>
                  </button>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openUserModal(group)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-slate-700 flex items-center space-x-1 transition"
                    title="Urus Ahli / Pengguna Kumpulan"
                  >
                    <UserPlus className="w-3 h-3 text-amber-400" />
                    <span>Ahli</span>
                  </button>
                  <button
                    onClick={() => openDoorModal(group)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded border border-slate-700 flex items-center space-x-1 transition"
                    title="Urus Pintu Kumpulan"
                  >
                    <DoorClosed className="w-3 h-3 text-cyan-400" />
                    <span>Pintu</span>
                  </button>
                  <button
                    onClick={() => openEditModal(group)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center space-x-1 transition"
                    title="Sunting Konfigurasi Kumpulan"
                  >
                    <Edit2 className="w-3 h-3 text-slate-400" />
                    <span>Sunting</span>
                  </button>
                  {isAct ? (
                    <button
                      onClick={() => openToggleModal(group, 'INACTIVE')}
                      className="px-2 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded transition font-medium"
                      title="Nyahaktifkan Kumpulan Akses"
                    >
                      Nyahaktif
                    </button>
                  ) : (
                    <button
                      onClick={() => openToggleModal(group, 'ACTIVE')}
                      className="px-2 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded transition font-medium"
                      title="Aktifkan Kumpulan Akses"
                    >
                      Aktifkan
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredGroups.length === 0 && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">Tiada Kumpulan Akses Dijumpai</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Tiada rekod kumpulan akses sepadan dengan kriteria carian atau sistem belum mempunyai kumpulan akses.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Daftar Kumpulan Akses Baharu</span>
          </button>
        </div>
      )}

      {/* MODAL 1: CREATE / EDIT ACCESS GROUP */}
      {groupModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 space-y-4 my-8 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">
                  {editingGroup ? 'Sunting Kumpulan Akses' : 'Daftar Kumpulan Akses Baharu'}
                </h3>
              </div>
              <button onClick={() => setGroupModalOpen(false)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-300 font-medium block mb-1">ID Kumpulan Akses *</label>
                  <input
                    type="text"
                    value={formGroupId}
                    onChange={(e) => setFormGroupId(e.target.value.toUpperCase())}
                    disabled={!!editingGroup}
                    placeholder="Contoh: AG-STAFF-ICT"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white disabled:opacity-60 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-300 font-medium block mb-1">Jenis Kumpulan (Group Type) *</label>
                  <select
                    value={formGroupType}
                    onChange={(e) => setFormGroupType(e.target.value as AccessGroupType)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="STUDENT">STUDENT (Pelajar)</option>
                    <option value="STAFF">STAFF (Staf Akademik / Sokongan)</option>
                    <option value="FACULTY">FACULTY (Fakulti / Pensyarah)</option>
                    <option value="SECURITY">SECURITY (Keselamatan Kampus)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Fasiliti & Servis)</option>
                    <option value="CONTRACTOR">CONTRACTOR (Kontraktor / Vendor Luar)</option>
                    <option value="CUSTOM">CUSTOM (Khas / Sementara)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-medium block mb-1">Nama Kumpulan Akses *</label>
                <input
                  type="text"
                  value={formGroupName}
                  onChange={(e) => setFormGroupName(e.target.value)}
                  placeholder="Contoh: Kumpulan Akses Pentadbir Makmal Komputer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-medium block mb-1">Penerangan Peranan & Tujuan</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Terangkan tujuan kumpulan, kawalan zon, dan kebenaran staf..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* JADUAL CAPAIAN (SCHEDULE) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-indigo-300 font-semibold text-[11px]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Jadual Kebenaran Masuk (Allowed Schedule)</span>
                  </div>
                  <div className="flex items-center space-x-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => applySchedulePreset('OFFICE')}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    >
                      Waktu Pejabat
                    </button>
                    <button
                      type="button"
                      onClick={() => applySchedulePreset('EXTENDED')}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    >
                      Lanjutan
                    </button>
                    <button
                      type="button"
                      onClick={() => applySchedulePreset('24_7')}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700"
                    >
                      24/7
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {dayLabels.map((name, idx) => {
                    const isSelected = formDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (formDays.length > 1) {
                              setFormDays(formDays.filter((d) => d !== idx));
                            }
                          } else {
                            setFormDays([...formDays, idx].sort());
                          }
                        }}
                        className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Masa Mula (HH:mm)</label>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Masa Tamat (HH:mm)</label>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* TEMPOH SAH (VALIDITY PERIOD) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-300 font-medium block mb-1">Tarikh Mula Sah (Valid From)</label>
                  <input
                    type="date"
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-300 font-medium block mb-1">Tarikh Tamat Sah (Valid Until)</label>
                  <input
                    type="date"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              {/* ZON DIBENARKAN (ASSIGNED ZONES) */}
              <div>
                <label className="text-[11px] text-slate-300 font-medium block mb-1">Zon Kampus Yang Dipautkan</label>
                {zones.length === 0 ? (
                  <div className="text-[11px] text-slate-500 bg-slate-950 p-2.5 rounded border border-slate-800">
                    Tiada zon kampus ditemui. Pautkan zon kelak selepas zon didaftarkan.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-950 border border-slate-800 rounded-lg">
                    {zones.map((z) => {
                      const isAssigned = formAssignedZones.includes(z.zoneId);
                      return (
                        <button
                          key={z.zoneId}
                          type="button"
                          onClick={() => {
                            if (isAssigned) {
                              setFormAssignedZones(formAssignedZones.filter((zid) => zid !== z.zoneId));
                            } else {
                              setFormAssignedZones([...formAssignedZones, z.zoneId]);
                            }
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-mono flex items-center space-x-1 transition ${
                            isAssigned
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                          }`}
                        >
                          {isAssigned && <Check className="w-3 h-3" />}
                          <span>{z.zoneName}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {!editingGroup && (
                <div>
                  <label className="text-[11px] text-slate-300 font-medium block mb-1">Status Awal</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AccessGroupStatus)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="ACTIVE">ACTIVE (Kumpulan Aktif Serta-merta)</option>
                    <option value="INACTIVE">INACTIVE (Kumpulan Draf / Tidak Aktif)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : editingGroup ? 'Kemaskini Kumpulan' : 'Daftar Kumpulan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: STATUS TOGGLE WITH AUDIT REASON */}
      {toggleModalOpen && selectedGroupForToggle && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 text-xs">
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Power className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-white text-sm">
                Pertukaran Status: {selectedGroupForToggle.groupName}
              </h3>
            </div>

            <div className="space-y-2">
              <p className="text-slate-300">
                Anda sedang menukar status kumpulan akses{' '}
                <span className="font-bold text-white">{selectedGroupForToggle.groupId}</span> kepada{' '}
                <span
                  className={`font-mono font-bold ${
                    targetStatus === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {targetStatus}
                </span>
                .
              </p>

              {targetStatus === 'INACTIVE' && (
                <div className="bg-amber-950/40 border border-amber-900/60 rounded-xl p-3 text-[11px] text-amber-300 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">Kesan Nyahaktif:</span>
                    Semua ahli kumpulan ini ({selectedGroupForToggle.assignedUsers.length} staf/pelajar) tidak akan
                    lagi dibenarkan membuka {selectedGroupForToggle.assignedDoors.length} pintu yang terpaut melalui
                    kumpulan ini.
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] text-slate-300 font-medium block mb-1">
                  Alasan Rasmi Pertukaran Status (Audit Integriti SES v4.5) *
                </label>
                <textarea
                  value={toggleReason}
                  onChange={(e) => setToggleReason(e.target.value)}
                  placeholder="Sila nyatakan alasan terperinci pertukaran status kumpulan ini..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  required
                />
                <span className="text-[10px] text-slate-500">
                  Minimum 10 aksara. Rekod ini akan disimpan secara kekal dalam Log Audit SES.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setToggleModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmToggle}
                className={`px-4 py-1.5 rounded-xl text-white font-semibold transition ${
                  targetStatus === 'ACTIVE'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                Sahkan Pertukaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: URUS AHLI / PENGGUNA (MANAGE USERS) */}
      {userModalOpen && selectedGroupForUsers && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 text-xs my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-white text-sm">
                  Keahlian Pengguna: {selectedGroupForUsers.groupName}
                </h3>
              </div>
              <button onClick={() => setUserModalOpen(false)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>

            {/* Tambah Pengguna */}
            <form onSubmit={handleAssignUser} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="text-[11px] font-semibold text-slate-200">Tambah Ahli Baharu ke Kumpulan</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={selectedUserIdToAdd}
                  onChange={(e) => setSelectedUserIdToAdd(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Pilih Pengguna Berdaftar...</option>
                  {users
                    .filter((u) => !selectedGroupForUsers.assignedUsers.includes(u.id) && !selectedGroupForUsers.assignedUsers.includes(u.uid))
                    .map((u) => (
                      <option key={u.id || u.uid} value={u.id || u.uid}>
                        {u.fullName} ({u.email})
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  placeholder="Atau taip ID Pengguna..."
                  value={selectedUserIdToAdd}
                  onChange={(e) => setSelectedUserIdToAdd(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  disabled={userSubmitting || !selectedUserIdToAdd}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition disabled:opacity-50 flex items-center space-x-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{userSubmitting ? 'Memproses...' : 'Masukkan Ahli'}</span>
                </button>
              </div>
            </form>

            {/* Senarai Ahli Semasa */}
            <div className="flex-1 overflow-y-auto space-y-2">
              <div className="text-[11px] font-semibold text-slate-300">
                Senarai Ahli Semasa ({selectedGroupForUsers.assignedUsers.length})
              </div>

              {selectedGroupForUsers.assignedUsers.length === 0 ? (
                <div className="p-4 text-center text-slate-500 border border-slate-800 rounded-xl bg-slate-950">
                  Belum ada ahli ditetapkan ke kumpulan akses ini.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {selectedGroupForUsers.assignedUsers.map((uid) => {
                    const matched = users.find((u) => u.id === uid || u.uid === uid || u.email === uid);
                    return (
                      <div
                        key={uid}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between hover:border-slate-700 transition"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-white">
                            {matched ? matched.fullName : uid}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {matched ? `${matched.email} • ${matched.staffId || matched.role}` : uid}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveUser(uid)}
                          className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] flex items-center space-x-1 transition"
                          title="Keluarkan Ahli"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Keluarkan</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: URUS PINTU (MANAGE DOORS) */}
      {doorModalOpen && selectedGroupForDoors && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 text-xs my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <DoorClosed className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">
                  Pautan Pintu: {selectedGroupForDoors.groupName}
                </h3>
              </div>
              <button onClick={() => setDoorModalOpen(false)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>

            {/* Tambah Pintu */}
            <form onSubmit={handleAssignDoor} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
              <div className="text-[11px] font-semibold text-slate-200">Pautkan Pintu Baharu ke Kumpulan</div>
              <div className="flex gap-2">
                <select
                  value={selectedDoorIdToAdd}
                  onChange={(e) => setSelectedDoorIdToAdd(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Pilih Pintu Sistem...</option>
                  {doors
                    .filter((d) => !selectedGroupForDoors.assignedDoors.includes(d.doorId || d.id))
                    .map((d) => (
                      <option key={d.id} value={d.doorId || d.id}>
                        {d.doorName || d.name} ({d.doorId || d.id}) • {d.building}
                      </option>
                    ))}
                </select>

                <button
                  type="submit"
                  disabled={doorSubmitting || !selectedDoorIdToAdd}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition disabled:opacity-50 flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{doorSubmitting ? 'Pautkan...' : 'Paut Pintu'}</span>
                </button>
              </div>
            </form>

            {/* Senarai Pintu Semasa */}
            <div className="flex-1 overflow-y-auto space-y-2">
              <div className="text-[11px] font-semibold text-slate-300">
                Pintu Terpaut ({selectedGroupForDoors.assignedDoors.length})
              </div>

              {selectedGroupForDoors.assignedDoors.length === 0 ? (
                <div className="p-4 text-center text-slate-500 border border-slate-800 rounded-xl bg-slate-950">
                  Belum ada pintu dipautkan kepada kumpulan akses ini.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {selectedGroupForDoors.assignedDoors.map((doorId) => {
                    const matchedDoor = doors.find((d) => (d.doorId || d.id) === doorId);
                    return (
                      <div
                        key={doorId}
                        className="bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-between hover:border-slate-700 transition"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-white">
                            {matchedDoor ? matchedDoor.doorName || matchedDoor.name : doorId}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {doorId} • {matchedDoor?.building || 'Bangunan Kampus'} • {matchedDoor?.floor || 'Aras'}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDoor(doorId)}
                          className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] flex items-center space-x-1 transition"
                          title="Keluarkan Pintu"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Keluarkan</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setDoorModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: DETAIL MODAL */}
      {detailModalOpen && selectedGroupDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 text-xs my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">
                  Maklumat Kumpulan Akses: {selectedGroupDetail.groupName}
                </h3>
              </div>
              <button onClick={() => setDetailModalOpen(false)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
                <div>
                  <span className="text-slate-500 block">ID Kumpulan:</span>
                  <span className="text-white font-bold">{selectedGroupDetail.groupId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status:</span>
                  <span
                    className={`font-bold ${
                      selectedGroupDetail.status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {selectedGroupDetail.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Jenis Kumpulan:</span>
                  <span className="text-indigo-300">{selectedGroupDetail.groupType}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Dicipta Oleh:</span>
                  <span className="text-slate-300">{selectedGroupDetail.createdBy || 'Sistem'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tarikh Mula Sah:</span>
                  <span className="text-slate-300">
                    {selectedGroupDetail.validFrom ? new Date(selectedGroupDetail.validFrom).toLocaleDateString('ms-MY') : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Tarikh Tamat Sah:</span>
                  <span className="text-slate-300">
                    {selectedGroupDetail.validUntil ? new Date(selectedGroupDetail.validUntil).toLocaleDateString('ms-MY') : '-'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">Penerangan:</span>
                <p className="text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  {selectedGroupDetail.description || 'Tiada penerangan.'}
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">
                  Zon Terpaut ({selectedGroupDetail.assignedZones?.length || 0}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {(selectedGroupDetail.assignedZones || []).map((zid) => (
                    <span key={zid} className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono">
                      {zid}
                    </span>
                  ))}
                  {(!selectedGroupDetail.assignedZones || selectedGroupDetail.assignedZones.length === 0) && (
                    <span className="text-slate-500 text-[11px]">Tiada zon dipautkan secara langsung.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: AUDIT HISTORY MODAL */}
      {auditModalOpen && selectedGroupForAudit && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 space-y-4 text-xs my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">
                  Sejarah Audit: {selectedGroupForAudit.groupName}
                </h3>
              </div>
              <button onClick={() => setAuditModalOpen(false)} className="text-slate-400 hover:text-white">
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingAudit ? (
                <div className="py-8 text-center text-slate-400">Memuat turun rekod audit SES...</div>
              ) : auditLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 border border-slate-800 rounded-xl bg-slate-950">
                  Tiada rekod perubahan audit ditemui bagi kumpulan akses ini.
                </div>
              ) : (
                auditLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 space-y-1.5 hover:border-slate-700 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-mono text-[10px] text-indigo-400 px-1.5 py-0.2 bg-indigo-950/70 rounded border border-indigo-900/50 font-semibold">
                        {log.action}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('ms-MY') : '-'}
                      </span>
                    </div>

                    <div className="text-slate-300 font-medium">{log.details}</div>

                    {log.reason && (
                      <div className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-900/40 rounded px-2 py-1">
                        Alasan: {log.reason}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-3">
                      <span>Pelaku: {log.actorEmail || log.actorId}</span>
                      {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                      {log.result && <span className="text-emerald-400">Keputusan: {log.result}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
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
