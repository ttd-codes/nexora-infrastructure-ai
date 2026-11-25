import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Box,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { StatusText } from '../components/StatusText';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  createAsset,
  deleteAssetAndLinkedData,
  updateAsset,
} from '../services/firestoreService';
import { Asset, AssetCategory, AssetStatus } from '../types/nexora';

const CATEGORIES: AssetCategory[] = [
  'Water Supply',
  'Electrical',
  'Cooling Systems',
  'Mechanical',
  'Structural',
  'General Equipment',
];

const STATUSES: AssetStatus[] = [
  'Operational',
  'Attention Required',
  'Under Maintenance',
  'Offline',
];

export function AssetIntelligence() {
  const {
    user,
    assets,
    locations,
    records,
    documents,
    recommendations,
    selectedAssetId,
    setSelectedAssetId,
    openInvestigation,
    setActiveModule,
    pushToast,
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [expandedTimelineId, setExpandedTimelineId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [assetCode, setAssetCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('Mechanical');
  const [locationId, setLocationId] = useState('');
  const [installDate, setInstallDate] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [status, setStatus] = useState<AssetStatus>('Operational');
  const [description, setDescription] = useState('');
  const [componentsText, setComponentsText] = useState('');

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) || null,
    [assets, selectedAssetId]
  );

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter((a) => {
      if (categoryFilter !== 'All' && a.category !== categoryFilter) return false;
      if (locationFilter !== 'All' && a.locationId !== locationFilter) return false;
      if (statusFilter !== 'All' && a.status !== statusFilter) return false;
      if (
        q &&
        !a.assetCode.toLowerCase().includes(q) &&
        !a.name.toLowerCase().includes(q) &&
        !a.locationName.toLowerCase().includes(q) &&
        !(a.manufacturer || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [assets, searchQuery, categoryFilter, locationFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingAsset(null);
    setAssetCode('');
    setName('');
    setCategory('Mechanical');
    setLocationId(locations[0]?.id || '');
    setInstallDate('2024-01-15');
    setManufacturer('');
    setModelNumber('');
    setStatus('Operational');
    setDescription('');
    setComponentsText('');
    setFormOpen(true);
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setAssetCode(asset.assetCode);
    setName(asset.name);
    setCategory(asset.category);
    setLocationId(asset.locationId);
    setInstallDate(asset.installDate || '');
    setManufacturer(asset.manufacturer || '');
    setModelNumber(asset.modelNumber || '');
    setStatus(asset.status);
    setDescription(asset.description || '');
    setComponentsText(asset.components.join(', '));
    setFormOpen(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const loc = locations.find((l) => l.id === locationId);
    if (!loc) {
      pushToast({ title: 'Location Required', detail: 'Select a campus location.', tone: 'warning' });
      return;
    }
    const components = componentsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      if (editingAsset) {
        await updateAsset(editingAsset.id, {
          assetCode: assetCode.trim(),
          name: name.trim(),
          category,
          locationId: loc.id,
          locationName: loc.name,
          installDate,
          manufacturer: manufacturer.trim(),
          modelNumber: modelNumber.trim(),
          status,
          description: description.trim(),
          components,
        });
        pushToast({ title: 'Asset Updated', detail: `${assetCode} saved to Firestore.`, tone: 'success' });
      } else {
        await createAsset(user.uid, {
          assetCode: assetCode.trim(),
          name: name.trim(),
          category,
          locationId: loc.id,
          locationName: loc.name,
          installDate,
          manufacturer: manufacturer.trim(),
          modelNumber: modelNumber.trim(),
          status,
          description: description.trim(),
          components,
          imageUrl: '',
          isDemoData: false,
        });
        pushToast({ title: 'Asset Registered', detail: `${assetCode} — ${name} added.`, tone: 'success' });
      }
      setFormOpen(false);
    } catch (err) {
      pushToast({
        title: 'Save Failed',
        detail: err instanceof Error ? err.message : 'Unable to save asset.',
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deleteTarget) return;
    try {
      await deleteAssetAndLinkedData(user.uid, deleteTarget.id);
      if (selectedAssetId === deleteTarget.id) setSelectedAssetId(null);
      pushToast({
        title: 'Asset Deleted',
        detail: `${deleteTarget.assetCode} and its linked records were removed.`,
        tone: 'info',
      });
    } catch (err) {
      pushToast({
        title: 'Delete Failed',
        detail: err instanceof Error ? err.message : 'Unable to delete asset.',
        tone: 'error',
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  // Dedicated Asset Detail View
  if (selectedAsset) {
    const assetRecords = records
      .filter((r) => r.assetId === selectedAsset.id)
      .sort((a, b) => b.incidentDate.localeCompare(a.incidentDate));
    const assetDocs = documents.filter((d) => d.assetId === selectedAsset.id);
    const assetRecs = recommendations.filter((rec) => rec.assetId === selectedAsset.id);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedAssetId(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#9AA5B1] hover:text-[#F4F5F6] bg-[#1B2229] border border-white/10 rounded-md transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All Assets
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm font-semibold text-[#F5B942] tabular-nums">
                  {selectedAsset.assetCode}
                </span>
                <span className="text-[#9AA5B1]" aria-hidden="true">·</span>
                <h1 className="text-xl font-semibold text-[#F4F5F6]">{selectedAsset.name}</h1>
              </div>
              <p className="text-xs text-[#9AA5B1] mt-0.5">
                {selectedAsset.category} · {selectedAsset.locationName}
                {selectedAsset.isDemoData ? ' · Fictional Sample Asset' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveModule('memory-graph')}
              className="px-3.5 py-2 text-xs font-medium bg-[#1B2229] border border-white/10 hover:border-[#55C6D9] text-[#55C6D9] rounded-md transition-colors"
            >
              View in Memory Graph
            </button>
            <button
              type="button"
              onClick={() => openEditModal(selectedAsset)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#242C34] hover:bg-[#2d3741] text-[#F4F5F6] rounded-md transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Asset
            </button>
          </div>
        </div>

        {/* Overview Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-4 bg-[#1B2229] border border-white/10 rounded-lg overflow-hidden flex flex-col">
            {selectedAsset.imageUrl ? (
              <img
                src={selectedAsset.imageUrl}
                alt={`${selectedAsset.assetCode} ${selectedAsset.name}`}
                referrerPolicy="no-referrer"
                className="w-full h-56 object-cover bg-[#101418]"
              />
            ) : (
              <div className="w-full h-56 bg-gradient-to-br from-[#1B2229] to-[#101418] flex flex-col items-center justify-center gap-2 border-b border-white/10">
                <Box className="w-8 h-8 text-[#55C6D9]" />
                <span className="font-mono text-xs text-[#9AA5B1]">
                  {selectedAsset.assetCode} · {selectedAsset.category}
                </span>
              </div>
            )}
            <div className="p-5 space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#9AA5B1]">Current Status</span>
                <StatusText status={selectedAsset.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-white/10">
                <div>
                  <div className="text-[#9AA5B1]">Manufacturer</div>
                  <div className="text-[#F4F5F6] mt-0.5">{selectedAsset.manufacturer || '—'}</div>
                </div>
                <div>
                  <div className="text-[#9AA5B1]">Model Number</div>
                  <div className="font-mono text-[#F4F5F6] mt-0.5 tabular-nums">
                    {selectedAsset.modelNumber || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[#9AA5B1]">Installed Date</div>
                  <div className="font-mono text-[#F4F5F6] mt-0.5 tabular-nums">
                    {selectedAsset.installDate || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[#9AA5B1]">Logged Events</div>
                  <div className="font-mono text-[#55C6D9] mt-0.5 tabular-nums">
                    {assetRecords.length}
                  </div>
                </div>
              </div>
              {selectedAsset.description && (
                <p className="text-xs text-[#9AA5B1] leading-relaxed pt-2 border-t border-white/10">
                  {selectedAsset.description}
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            {/* Components & Active Findings */}
            <div className="bg-[#1B2229] border border-white/10 rounded-lg p-5 space-y-4">
              <h2 className="text-sm font-semibold text-[#F4F5F6]">Associated Components</h2>
              {selectedAsset.components.length === 0 ? (
                <p className="text-xs text-[#9AA5B1]">No sub-components registered.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {selectedAsset.components.map((comp) => {
                    const compMatches = assetRecords.filter(
                      (r) => (r.componentInvolved || '').toLowerCase() === comp.toLowerCase()
                    ).length;
                    return (
                      <div
                        key={comp}
                        className="px-3 py-2.5 bg-[#242C34] border border-white/10 rounded flex items-center justify-between gap-2"
                      >
                        <span className="text-xs text-[#F4F5F6] truncate">{comp}</span>
                        <span className="font-mono text-xs text-[#9AA5B1] tabular-nums shrink-0">
                          {compMatches} events
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Interactive Maintenance Timeline */}
            <div className="bg-[#1B2229] border border-white/10 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[#F4F5F6]">
                    Interactive Asset Maintenance Timeline
                  </h2>
                  <p className="text-xs text-[#9AA5B1]">
                    Click any milestone to expand repair actions, symptoms, and source traceability
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModule('maintenance')}
                  className="text-xs text-[#55C6D9] hover:underline"
                >
                  Log New Record →
                </button>
              </div>

              {assetRecords.length === 0 ? (
                <p className="text-xs text-[#9AA5B1] py-6 text-center border border-dashed border-white/10 rounded">
                  No maintenance history recorded for {selectedAsset.assetCode} yet.
                </p>
              ) : (
                <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-white/15">
                  {assetRecords.map((rec) => {
                    const isOpen = expandedTimelineId === rec.id;
                    return (
                      <div key={rec.id} className="relative">
                        <span
                          className={`absolute -left-[20px] top-2 w-2.5 h-2.5 rounded-full border border-[#1B2229] ${
                            rec.status === 'Resolved'
                              ? 'bg-[#3DD68C]'
                              : rec.status === 'Monitoring' || rec.status === 'In Progress'
                              ? 'bg-[#F5B942]'
                              : 'bg-[#55C6D9]'
                          }`}
                        />
                        <div className="bg-[#242C34] border border-white/10 rounded-md overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedTimelineId(isOpen ? null : rec.id)}
                            className="w-full px-4 py-3 text-left flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-[#9AA5B1]">
                                <span className="font-mono text-[#F5B942] tabular-nums">
                                  {rec.incidentDate}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono text-[#55C6D9] tabular-nums">
                                  {rec.recordCode}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{rec.recordType}</span>
                              </div>
                              <div className="text-sm font-medium text-[#F4F5F6] truncate">
                                {rec.title}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <StatusText status={rec.status} />
                              {isOpen ? (
                                <ChevronUp className="w-4 h-4 text-[#9AA5B1]" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-[#9AA5B1]" />
                              )}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-4 pt-2 border-t border-white/10 text-xs space-y-2.5 bg-[#1B2229]/60">
                              <p className="text-[#F4F5F6] leading-relaxed">{rec.description}</p>
                              {rec.repairAction && (
                                <div>
                                  <span className="text-[#9AA5B1]">Repair / Action: </span>
                                  <span className="text-[#F4F5F6]">{rec.repairAction}</span>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[#9AA5B1]">
                                <span>
                                  Component:{' '}
                                  <strong className="font-medium text-[#F4F5F6]">
                                    {rec.componentInvolved || 'Unspecified'}
                                  </strong>
                                </span>
                                <span>
                                  Technician:{' '}
                                  <strong className="font-medium text-[#F4F5F6]">
                                    {rec.technicianName || 'Unattributed'}
                                  </strong>
                                </span>
                                {rec.sourceDocumentName && (
                                  <span>
                                    Source:{' '}
                                    <strong className="font-mono text-[#55C6D9]">
                                      {rec.sourceDocumentName}
                                    </strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Linked Recommendations & Source Documents */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#1B2229] border border-white/10 rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#F4F5F6]">Pattern Findings for {selectedAsset.assetCode}</h2>
            {assetRecs.length === 0 ? (
              <p className="text-xs text-[#9AA5B1]">No recurring patterns flagged for this asset.</p>
            ) : (
              <div className="space-y-3">
                {assetRecs.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 bg-[#242C34] border border-white/10 rounded space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[#F4F5F6]">{rec.title}</span>
                      <StatusText status={rec.severity} />
                    </div>
                    <p className="text-xs text-[#9AA5B1]">{rec.interpretation}</p>
                    <button
                      type="button"
                      onClick={() => openInvestigation(rec.id)}
                      className="text-xs font-medium text-[#F5B942] hover:underline"
                    >
                      Open in Investigation Center →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#1B2229] border border-white/10 rounded-lg p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[#F4F5F6]">Linked Source Documents</h2>
            {assetDocs.length === 0 ? (
              <p className="text-xs text-[#9AA5B1]">No source documents attached yet.</p>
            ) : (
              <div className="space-y-3">
                {assetDocs.map((docItem) => (
                  <div
                    key={docItem.id}
                    className="p-3.5 bg-[#242C34] border border-white/10 rounded flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-[#F4F5F6]">
                        <FileText className="w-3.5 h-3.5 text-[#55C6D9] shrink-0" />
                        <span className="font-mono truncate">{docItem.fileName}</span>
                      </div>
                      <p className="text-xs text-[#9AA5B1] line-clamp-2">
                        {docItem.extractedSummary}
                      </p>
                    </div>
                    <StatusText status={docItem.extractionStatus} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F5F6] tracking-tight">
            Asset Intelligence
          </h1>
          <p className="text-sm text-[#9AA5B1] mt-1">
            Manage infrastructure assets, sub-components, and historical maintenance profiles.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#F5B942] text-[#101418] rounded-md hover:bg-[#f6c45f] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Register Asset
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-[#1B2229] border border-white/10 rounded-lg p-3">
        <div className="md:col-span-5 flex items-center gap-2 bg-[#101418] border border-white/10 rounded px-3 py-2">
          <Search className="w-4 h-4 text-[#9AA5B1] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Asset ID (P-104), name, or manufacturer..."
            className="w-full bg-transparent text-xs text-[#F4F5F6] placeholder-[#9AA5B1]/60 focus:outline-none"
          />
        </div>
        <select
          aria-label="Filter assets by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="md:col-span-2 bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6] focus:outline-none"
        >
          <option value="All">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Filter assets by location"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="md:col-span-3 bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6] focus:outline-none"
        >
          <option value="All">All Locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select
          aria-label="Filter assets by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="md:col-span-2 bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6] focus:outline-none"
        >
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Asset Table */}
      <div className="bg-[#1B2229] border border-white/10 rounded-lg overflow-hidden">
        {filteredAssets.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm text-[#9AA5B1]">No assets match your current filters.</p>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 text-xs font-medium bg-[#F5B942] text-[#101418] rounded-md"
            >
              Register First Asset
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs text-[#9AA5B1] bg-[#242C34]/50">
                  <th className="py-3 px-4 font-medium">Asset ID</th>
                  <th className="py-3 px-4 font-medium">Name &amp; Model</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium">Location</th>
                  <th className="py-3 px-4 font-medium text-right">Records</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-sm">
                {filteredAssets.map((asset) => {
                  const recCount = records.filter((r) => r.assetId === asset.id).length;
                  return (
                    <tr
                      key={asset.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#F5B942] tabular-nums whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedAssetId(asset.id)}
                          className="hover:underline"
                        >
                          {asset.assetCode}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedAssetId(asset.id)}
                          className="text-left group"
                        >
                          <div className="font-medium text-[#F4F5F6] group-hover:text-[#55C6D9] transition-colors">
                            {asset.name}
                          </div>
                          <div className="text-xs text-[#9AA5B1]">
                            {asset.manufacturer || 'Standard'} {asset.modelNumber ? `· ${asset.modelNumber}` : ''}
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#9AA5B1] whitespace-nowrap">
                        {asset.category}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#F4F5F6] max-w-[220px] truncate">
                        {asset.locationName}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#55C6D9] text-right tabular-nums">
                        {recCount}
                      </td>
                      <td className="py-3 px-4">
                        <StatusText status={asset.status} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedAssetId(asset.id)}
                            className="px-2.5 py-1 text-xs text-[#55C6D9] hover:bg-[#55C6D9]/10 rounded transition-colors"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(asset)}
                            className="p-1.5 text-[#9AA5B1] hover:text-[#F4F5F6] rounded"
                            aria-label={`Edit ${asset.assetCode}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(asset)}
                            className="p-1.5 text-[#9AA5B1] hover:text-[#E05252] rounded"
                            aria-label={`Delete ${asset.assetCode}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl bg-[#1B2229] border border-white/10 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-base font-semibold text-[#F4F5F6]">
                {editingAsset ? `Edit Asset ${editingAsset.assetCode}` : 'Register Infrastructure Asset'}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-[#9AA5B1] hover:text-[#F4F5F6] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAsset} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Asset ID / Code *</label>
                  <input
                    required
                    value={assetCode}
                    onChange={(e) => setAssetCode(e.target.value)}
                    placeholder="e.g. P-108"
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-sm font-mono text-[#F4F5F6] focus:outline-none focus:border-[#F5B942]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Asset Name *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Booster Water Pump"
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-sm text-[#F4F5F6] focus:outline-none focus:border-[#F5B942]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AssetCategory)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-sm text-[#F4F5F6] focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Location *</label>
                  <select
                    required
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-sm text-[#F4F5F6] focus:outline-none"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Manufacturer</label>
                  <input
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-sm text-[#F4F5F6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Model Number</label>
                  <input
                    value={modelNumber}
                    onChange={(e) => setModelNumber(e.target.value)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-sm font-mono text-[#F4F5F6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Installation Date</label>
                  <input
                    type="date"
                    value={installDate}
                    onChange={(e) => setInstallDate(e.target.value)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-sm font-mono text-[#F4F5F6] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#9AA5B1] mb-1">Operational Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AssetStatus)}
                    className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-sm text-[#F4F5F6] focus:outline-none"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#9AA5B1] mb-1">
                  Sub-Components (comma separated)
                </label>
                <input
                  value={componentsText}
                  onChange={(e) => setComponentsText(e.target.value)}
                  placeholder="Drive Bearing, Mechanical Seal, Shaft Coupling"
                  className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-sm text-[#F4F5F6] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-[#9AA5B1] mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-sm text-[#F4F5F6] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 text-sm text-[#9AA5B1] bg-[#242C34] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium bg-[#F5B942] text-[#101418] rounded-md hover:bg-[#f6c45f] disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingAsset ? 'Save Changes' : 'Create Asset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Delete Asset ${deleteTarget?.assetCode}?`}
        description={`This will permanently remove ${deleteTarget?.assetCode} — ${deleteTarget?.name} along with its linked maintenance records and pattern findings from Firestore.`}
        confirmLabel="Delete Asset"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
