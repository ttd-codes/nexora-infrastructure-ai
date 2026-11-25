import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Box,
  FileText,
  GitBranch,
  LayoutDashboard,
  Search,
  ShieldAlert,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ActiveModule } from '../types/nexora';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const MODULE_ITEMS: Array<{ id: ActiveModule; label: string; hint: string; icon: typeof LayoutDashboard }> = [
  { id: 'command-center', label: 'Command Center', hint: 'Infrastructure overview & KPIs', icon: LayoutDashboard },
  { id: 'assets', label: 'Asset Intelligence', hint: 'Equipment registry & asset profiles', icon: Box },
  { id: 'memory-graph', label: 'Infrastructure Memory Graph', hint: 'Interactive React Flow relationship graph', icon: GitBranch },
  { id: 'investigation-center', label: 'AI Investigation Center', hint: 'Explainable pattern findings & rules', icon: ShieldAlert },
  { id: 'data-intake', label: 'Smart Data Intake', hint: 'Multimodal OCR, PDF, audio & note extraction', icon: Upload },
  { id: 'maintenance', label: 'Maintenance Management', hint: 'Incidents, repairs & interactive timeline', icon: Wrench },
  { id: 'reports', label: 'Reports & Analytics', hint: 'Trends, CSV & PDF exports', icon: FileText },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { assets, records, recommendations, setActiveModule, openAssetDetail, openInvestigation } = useWorkspace();
  const [queryText, setQueryText] = useState('');

  useEffect(() => {
    if (!open) {
      setQueryText('');
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const matchedModules = MODULE_ITEMS.filter(
      (m) => !q || m.label.toLowerCase().includes(q) || m.hint.toLowerCase().includes(q)
    );
    const matchedAssets = assets
      .filter(
        (a) =>
          !q ||
          a.assetCode.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.locationName.toLowerCase().includes(q)
      )
      .slice(0, 5);
    const matchedFindings = recommendations
      .filter(
        (r) =>
          !q ||
          r.title.toLowerCase().includes(q) ||
          r.assetCode.toLowerCase().includes(q)
      )
      .slice(0, 4);
    const matchedRecords = records
      .filter(
        (rec) =>
          q.length > 0 &&
          (rec.recordCode.toLowerCase().includes(q) ||
            rec.title.toLowerCase().includes(q) ||
            rec.assetCode.toLowerCase().includes(q))
      )
      .slice(0, 4);

    return { matchedModules, matchedAssets, matchedFindings, matchedRecords };
  }, [queryText, assets, recommendations, records]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Global workspace search"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#1B2229] border border-white/10 rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search className="w-4 h-4 text-[#9AA5B1] shrink-0" />
          <input
            type="text"
            autoFocus
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Jump to module, asset code (P-104), record, or finding..."
            className="w-full bg-transparent text-sm text-[#F4F5F6] placeholder-[#9AA5B1]/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-[#9AA5B1] hover:text-[#F4F5F6] p-1"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-white/5">
          {filtered.matchedAssets.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1.5 text-xs font-medium text-[#9AA5B1]">Assets</div>
              {filtered.matchedAssets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => {
                    openAssetDetail(asset.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left rounded hover:bg-[#242C34] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-[#F5B942] tabular-nums shrink-0">
                      {asset.assetCode}
                    </span>
                    <span className="text-sm text-[#F4F5F6] truncate">{asset.name}</span>
                  </div>
                  <span className="text-xs text-[#9AA5B1] truncate ml-4">{asset.locationName}</span>
                </button>
              ))}
            </div>
          )}

          {filtered.matchedFindings.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1.5 text-xs font-medium text-[#9AA5B1]">AI Investigation Findings</div>
              {filtered.matchedFindings.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => {
                    openInvestigation(rec.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left rounded hover:bg-[#242C34] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ShieldAlert className="w-4 h-4 text-[#55C6D9] shrink-0" />
                    <span className="text-sm text-[#F4F5F6] truncate">{rec.title}</span>
                  </div>
                  <span className="text-xs text-[#9AA5B1] shrink-0 ml-3">{rec.severity}</span>
                </button>
              ))}
            </div>
          )}

          {filtered.matchedRecords.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1.5 text-xs font-medium text-[#9AA5B1]">Maintenance Records</div>
              {filtered.matchedRecords.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => {
                    openAssetDetail(rec.assetId);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left rounded hover:bg-[#242C34] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Activity className="w-4 h-4 text-[#9AA5B1] shrink-0" />
                    <span className="font-mono text-xs text-[#55C6D9] tabular-nums shrink-0">
                      {rec.recordCode}
                    </span>
                    <span className="text-sm text-[#F4F5F6] truncate">{rec.title}</span>
                  </div>
                  <span className="font-mono text-xs text-[#9AA5B1] tabular-nums ml-3">
                    {rec.incidentDate}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="p-2">
            <div className="px-3 py-1.5 text-xs font-medium text-[#9AA5B1]">Modules</div>
            {filtered.matchedModules.map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                    setActiveModule(mod.id);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left rounded hover:bg-[#242C34] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-[#9AA5B1]" />
                    <span className="text-sm text-[#F4F5F6]">{mod.label}</span>
                  </div>
                  <span className="text-xs text-[#9AA5B1]">{mod.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
