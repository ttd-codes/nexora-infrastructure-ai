import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Edit3,
  List,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusText } from '../components/StatusText';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  createMaintenanceRecord,
  deleteMaintenanceRecord,
  updateMaintenanceRecord,
} from '../services/firestoreService';
import {
  AssetCategory,
  InspectionStatus,
  MaintenanceRecord,
  RecordStatus,
  RecordType,
} from '../types/nexora';

const RECORD_TYPES: RecordType[] = ['Incident', 'Repair', 'Inspection', 'Preventive'];
const STATUSES: RecordStatus[] = ['Open', 'In Progress', 'Resolved', 'Monitoring'];
const INSPECTION_STATUSES: InspectionStatus[] = ['Pending', 'Scheduled', 'Completed'];

export function MaintenanceManagement() {
  const {
    user,
    assets,
    records,
    openAssetDetail,
    pushToast,
  } = useWorkspace();

  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [assetFilter, setAssetFilter] = useState('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [assetId, setAssetId] = useState('');
  const [incidentDate, setIncidentDate] = useState('2026-05-15');
  const [recordType, setRecordType] = useState<RecordType>('Incident');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [symptomsText, setSymptomsText] = useState('');
  const [repairAction, setRepairAction] = useState('');
  const [componentInvolved, setComponentInvolved] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [status, setStatus] = useState<RecordStatus>('Open');
  const [inspectionStatus, setInspectionStatus] = useState<InspectionStatus>('Pending');

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...records]
      .filter((r) => {
        if (statusFilter !== 'All' && r.status !== statusFilter) return false;
        if (assetFilter !== 'All' && r.assetId !== assetFilter) return false;
        if (
          q &&
          !r.recordCode.toLowerCase().includes(q) &&
          !r.title.toLowerCase().includes(q) &&
          !r.assetCode.toLowerCase().includes(q) &&
          !(r.componentInvolved || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.incidentDate.localeCompare(a.incidentDate));
  }, [records, searchQuery, statusFilter, assetFilter]);

  const openCreateModal = () => {
    setEditing(null);
    setAssetId(assets[0]?.id || '');
    setIncidentDate(new Date().toISOString().slice(0, 10));
    setRecordType('Incident');
    setTitle('');
    setDescription('');
    setSymptomsText('');
    setRepairAction('');
    setComponentInvolved('');
    setTechnicianName('');
    setStatus('Open');
    setInspectionStatus('Pending');
    setModalOpen(true);
  };

  const openEditModal = (rec: MaintenanceRecord) => {
    setEditing(rec);
    setAssetId(rec.assetId);
    setIncidentDate(rec.incidentDate);
    setRecordType(rec.recordType);
    setTitle(rec.title);
    setDescription(rec.description);
    setSymptomsText(rec.symptoms.join(', '));
    setRepairAction(rec.repairAction || '');
    setComponentInvolved(rec.componentInvolved || '');
    setTechnicianName(rec.technicianName || '');
    setStatus(rec.status);
    setInspectionStatus(rec.inspectionStatus);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const targetAsset = assets.find((a) => a.id === assetId);
    if (!targetAsset) {
      pushToast({ title: 'Asset Required', detail: 'Select an asset.', tone: 'warning' });
      return;
    }

    const symptoms = symptomsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      if (editing) {
        await updateMaintenanceRecord(editing.id, {
          assetId: targetAsset.id,
          assetCode: targetAsset.assetCode,
          assetName: targetAsset.name,
          locationName: targetAsset.locationName,
          incidentDate,
          category: targetAsset.category as AssetCategory,
          recordType,
          title: title.trim(),
          description: description.trim(),
          symptoms,
          repairAction: repairAction.trim(),
          componentInvolved: componentInvolved.trim(),
          technicianName: technicianName.trim(),
          status,
          inspectionStatus,
        });
        pushToast({ title: 'Record Updated', detail: `${editing.recordCode} saved.`, tone: 'success' });
      } else {
        const recordCode = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
        await createMaintenanceRecord(user.uid, {
          recordCode,
          assetId: targetAsset.id,
          assetCode: targetAsset.assetCode,
          assetName: targetAsset.name,
          locationName: targetAsset.locationName,
          incidentDate,
          category: targetAsset.category,
          recordType,
          title: title.trim(),
          description: description.trim(),
          symptoms,
          repairAction: repairAction.trim(),
          componentInvolved: componentInvolved.trim(),
          technicianName: technicianName.trim(),
          status,
          inspectionStatus,
          sourceDocumentId: '',
          sourceDocumentName: 'Manual Entry',
          confidence: 1,
          isDemoData: false,
        });
        pushToast({ title: 'Maintenance Record Logged', detail: `${recordCode} linked to ${targetAsset.assetCode}.`, tone: 'success' });
      }
      setModalOpen(false);
    } catch (err) {
      pushToast({
        title: 'Save Failed',
        detail: err instanceof Error ? err.message : 'Could not save record.',
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMaintenanceRecord(deleteTarget.id);
      pushToast({ title: 'Record Deleted', detail: `${deleteTarget.recordCode} removed.`, tone: 'info' });
    } catch (err) {
      pushToast({
        title: 'Delete Failed',
        detail: err instanceof Error ? err.message : 'Unable to delete record.',
        tone: 'error',
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const selectedAssetObj = assets.find((a) => a.id === assetId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F5F6] tracking-tight">
            Maintenance Management
          </h1>
          <p className="text-sm text-[#9AA5B1] mt-1">
            Create, edit, and track maintenance incidents, repair actions, and inspection schedules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-[#1B2229] border border-white/10 rounded-md p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-[#242C34] text-[#F4F5F6]' : 'text-[#9AA5B1]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                viewMode === 'timeline' ? 'bg-[#242C34] text-[#F4F5F6]' : 'text-[#9AA5B1]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Timeline
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#F5B942] text-[#101418] rounded-md hover:bg-[#f6c45f] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Log Incident / Repair
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#1B2229] border border-white/10 rounded-lg p-3">
        <div className="md:col-span-6 flex items-center gap-2 bg-[#101418] border border-white/10 rounded px-3 py-2">
          <Search className="w-4 h-4 text-[#9AA5B1] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search records by ID, title, asset code, or component..."
            className="w-full bg-transparent text-xs text-[#F4F5F6] placeholder-[#9AA5B1]/60 focus:outline-none"
          />
        </div>
        <select
          aria-label="Filter by asset"
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
          className="md:col-span-3 bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
        >
          <option value="All">All Assets</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>{a.assetCode} — {a.name}</option>
          ))}
        </select>
        <select
          aria-label="Filter by repair status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="md:col-span-3 bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
        >
          <option value="All">All Repair Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {viewMode === 'table' ? (
        <div className="bg-[#1B2229] border border-white/10 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs text-[#9AA5B1] bg-[#242C34]/50">
                  <th className="py-3 px-4 font-medium">Record ID</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Asset</th>
                  <th className="py-3 px-4 font-medium">Title &amp; Component</th>
                  <th className="py-3 px-4 font-medium">Repair Status</th>
                  <th className="py-3 px-4 font-medium">Inspection</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-sm">
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-[#55C6D9] tabular-nums whitespace-nowrap">
                      {rec.recordCode}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[#F4F5F6] tabular-nums whitespace-nowrap">
                      {rec.incidentDate}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openAssetDetail(rec.assetId)}
                        className="text-left hover:underline"
                      >
                        <span className="font-mono text-xs text-[#F5B942] tabular-nums">
                          {rec.assetCode}
                        </span>
                        <span className="text-xs text-[#9AA5B1] ml-1.5">{rec.assetName}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <div className="text-sm text-[#F4F5F6] truncate">{rec.title}</div>
                      <div className="text-xs text-[#9AA5B1] truncate">
                        {rec.recordType} · {rec.componentInvolved || 'General Assembly'}
                        {rec.technicianName ? ` · ${rec.technicianName}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={rec.status} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={rec.inspectionStatus} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(rec)}
                          className="p-1.5 text-[#9AA5B1] hover:text-[#F4F5F6]"
                          aria-label={`Edit ${rec.recordCode}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(rec)}
                          className="p-1.5 text-[#9AA5B1] hover:text-[#E05252]"
                          aria-label={`Delete ${rec.recordCode}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-[#1B2229] border border-white/10 rounded-lg p-6">
          <div className="relative pl-6 space-y-5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-white/15">
            {filteredRecords.map((rec) => (
              <div key={rec.id} className="relative bg-[#242C34] border border-white/10 rounded-md p-4 space-y-2">
                <span className="absolute -left-[22px] top-5 w-2.5 h-2.5 rounded-full bg-[#F5B942] border border-[#1B2229]" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-[#F5B942] tabular-nums">{rec.incidentDate}</span>
                    <span className="text-[#9AA5B1]" aria-hidden="true">·</span>
                    <span className="font-mono text-[#55C6D9] tabular-nums">{rec.recordCode}</span>
                    <span className="text-[#9AA5B1]" aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => openAssetDetail(rec.assetId)}
                      className="font-mono text-[#F4F5F6] hover:underline"
                    >
                      {rec.assetCode} — {rec.assetName}
                    </button>
                  </div>
                  <StatusText status={rec.status} />
                </div>
                <div className="text-sm font-medium text-[#F4F5F6]">{rec.title}</div>
                <p className="text-xs text-[#9AA5B1] leading-relaxed">{rec.description}</p>
                {rec.repairAction && (
                  <div className="text-xs text-[#F4F5F6]">
                    <span className="text-[#9AA5B1]">Repair Action: </span>
                    {rec.repairAction}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-[#1B2229] border border-white/10 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-base font-semibold text-[#F4F5F6]">
                {editing ? `Edit Record ${editing.recordCode}` : 'Log Maintenance Record'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[#9AA5B1] hover:text-[#F4F5F6] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Asset *</label>
                  <select
                    required
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>{a.assetCode} — {a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Incident Date *</label>
                  <input
                    required
                    type="date"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs font-mono text-[#F4F5F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Record Type</label>
                  <select
                    value={recordType}
                    onChange={(e) => setRecordType(e.target.value as RecordType)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                  >
                    {RECORD_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Component Involved</label>
                  <input
                    list="asset-components-datalist"
                    value={componentInvolved}
                    onChange={(e) => setComponentInvolved(e.target.value)}
                    placeholder="e.g. Drive Bearing (P-104-B)"
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                  />
                  <datalist id="asset-components-datalist">
                    {selectedAssetObj?.components.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-[#9AA5B1] mb-1">Title *</label>
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-[#9AA5B1] mb-1">Description *</label>
                  <textarea
                    required
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Symptoms (comma separated)</label>
                  <input
                    value={symptomsText}
                    onChange={(e) => setSymptomsText(e.target.value)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Technician</label>
                  <input
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-[#9AA5B1] mb-1">Repair Action</label>
                  <input
                    value={repairAction}
                    onChange={(e) => setRepairAction(e.target.value)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Repair Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RecordStatus)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Inspection Status</label>
                  <select
                    value={inspectionStatus}
                    onChange={(e) => setInspectionStatus(e.target.value as InspectionStatus)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                  >
                    {INSPECTION_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs text-[#9AA5B1] bg-[#242C34] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold bg-[#F5B942] text-[#101418] rounded-md"
                >
                  {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete Record ${deleteTarget?.recordCode}?`}
        description="This permanently removes the maintenance record from Firestore."
        confirmLabel="Delete Record"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
