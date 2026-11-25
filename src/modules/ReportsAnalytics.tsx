import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatusText } from '../components/StatusText';
import { useWorkspace } from '../context/WorkspaceContext';
import { downloadCsvReportViaApi } from '../services/apiService';

export function ReportsAnalytics() {
  const { assets, locations, records, recommendations, pushToast } = useWorkspace();

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [assetFilter, setAssetFilter] = useState('All');
  const [exporting, setExporting] = useState(false);

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (categoryFilter !== 'All' && a.category !== categoryFilter) return false;
      if (locationFilter !== 'All' && a.locationId !== locationFilter) return false;
      if (assetFilter !== 'All' && a.id !== assetFilter) return false;
      return true;
    });
  }, [assets, categoryFilter, locationFilter, assetFilter]);

  const filteredRecords = useMemo(() => {
    const assetIds = new Set(filteredAssets.map((a) => a.id));
    return records
      .filter((r) => assetIds.has(r.assetId))
      .sort((a, b) => b.incidentDate.localeCompare(a.incidentDate));
  }, [records, filteredAssets]);

  const frequencyByAsset = useMemo(() => {
    return filteredAssets.map((a) => ({
      assetCode: a.assetCode,
      incidents: filteredRecords.filter((r) => r.assetId === a.id && r.recordType === 'Incident').length,
      repairs: filteredRecords.filter((r) => r.assetId === a.id && r.recordType !== 'Incident').length,
    }));
  }, [filteredAssets, filteredRecords]);

  const componentInterventions = useMemo(() => {
    const map = new Map<string, { component: string; assetCode: string; count: number; latest: string }>();
    for (const r of filteredRecords) {
      const comp = (r.componentInvolved || '').trim();
      if (!comp) continue;
      const key = `${r.assetCode}::${comp}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { component: comp, assetCode: r.assetCode, count: 1, latest: r.incidentDate });
      } else {
        existing.count += 1;
        if (r.incidentDate > existing.latest) existing.latest = r.incidentDate;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  const handleExportMaintenanceCsv = async () => {
    setExporting(true);
    try {
      await downloadCsvReportViaApi({
        filename: `nexora-maintenance-report-${new Date().toISOString().slice(0, 10)}.csv`,
        headers: [
          'Record ID',
          'Date',
          'Asset Code',
          'Asset Name',
          'Category',
          'Type',
          'Title',
          'Component',
          'Repair Action',
          'Technician',
          'Status',
          'Source Document',
        ],
        rows: filteredRecords.map((r) => [
          r.recordCode,
          r.incidentDate,
          r.assetCode,
          r.assetName,
          r.category,
          r.recordType,
          r.title,
          r.componentInvolved || '',
          r.repairAction || '',
          r.technicianName || '',
          r.status,
          r.sourceDocumentName || '',
        ]),
      });
      pushToast({ title: 'CSV Exported', detail: 'Maintenance history CSV downloaded.', tone: 'success' });
    } catch (err) {
      pushToast({
        title: 'Export Failed',
        detail: err instanceof Error ? err.message : 'Unable to export CSV.',
        tone: 'error',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    let y = 48;

    doc.setFontSize(16);
    doc.text('NEXORA — Infrastructure Intelligence Report', 40, y);
    y += 18;
    doc.setFontSize(10);
    doc.text(
      `Generated: ${new Date().toISOString().slice(0, 10)} | Assets: ${filteredAssets.length} | Records: ${filteredRecords.length} | Patterns: ${recommendations.length}`,
      40,
      y
    );
    y += 26;

    doc.setFontSize(12);
    doc.text('1. Evidence-Backed Pattern Findings', 40, y);
    y += 16;
    doc.setFontSize(9);

    for (const rec of recommendations) {
      if (y > 740) {
        doc.addPage();
        y = 48;
      }
      doc.text(`[${rec.assetCode}] ${rec.title} (${rec.severity} | ${rec.evidenceCompleteness}% evidence)`, 40, y);
      y += 13;
      const lines = doc.splitTextToSize(`Interpretation: ${rec.interpretation}`, 510);
      doc.text(lines, 48, y);
      y += lines.length * 11 + 8;
    }

    y += 10;
    if (y > 720) {
      doc.addPage();
      y = 48;
    }
    doc.setFontSize(12);
    doc.text('2. Maintenance History Log', 40, y);
    y += 16;
    doc.setFontSize(8.5);

    for (const r of filteredRecords.slice(0, 30)) {
      if (y > 760) {
        doc.addPage();
        y = 48;
      }
      const line = `${r.incidentDate} | ${r.recordCode} | ${r.assetCode} | ${r.title} | ${r.status}`;
      doc.text(doc.splitTextToSize(line, 515), 40, y);
      y += 14;
    }

    doc.save(`nexora-intelligence-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    pushToast({ title: 'PDF Generated', detail: 'Infrastructure intelligence PDF downloaded.', tone: 'success' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F5F6] tracking-tight">
            Reports &amp; Analytics
          </h1>
          <p className="text-sm text-[#9AA5B1] mt-1">
            Database-backed maintenance frequency analysis, component intervention history, and downloadable CSV/PDF exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportMaintenanceCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-[#1B2229] border border-white/10 hover:border-[#55C6D9] text-[#F4F5F6] rounded-md transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#55C6D9]" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#F5B942] text-[#101418] rounded-md hover:bg-[#f6c45f] transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PDF Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#1B2229] border border-white/10 rounded-lg p-3">
        <select
          aria-label="Filter reports by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
        >
          <option value="All">All Categories</option>
          <option value="Water Supply">Water Supply</option>
          <option value="Electrical">Electrical</option>
          <option value="Cooling Systems">Cooling Systems</option>
          <option value="Mechanical">Mechanical</option>
        </select>

        <select
          aria-label="Filter reports by location"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
        >
          <option value="All">All Campus Locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>

        <select
          aria-label="Filter reports by asset"
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
          className="bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
        >
          <option value="All">All Assets</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>{a.assetCode} — {a.name}</option>
          ))}
        </select>
      </div>

      {/* Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#1B2229] border border-white/10 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[#F4F5F6]">Maintenance Frequency by Asset</h2>
            <p className="text-xs text-[#9AA5B1]">Incidents vs. repair/preventive actions</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={frequencyByAsset}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="assetCode" stroke="#9AA5B1" fontSize={12} tickLine={false} />
                <YAxis stroke="#9AA5B1" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#242C34',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '6px',
                    color: '#F4F5F6',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="incidents" name="Incidents" fill="#F5B942" radius={[3, 3, 0, 0]} />
                <Bar dataKey="repairs" name="Repairs & Checks" fill="#55C6D9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#1B2229] border border-white/10 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-[#F4F5F6]">Component Intervention History</h2>
            <p className="text-xs text-[#9AA5B1]">Components with repeated adjustments or replacements</p>
          </div>
          <div className="divide-y divide-white/10 max-h-64 overflow-y-auto">
            {componentInterventions.map((c) => (
              <div key={`${c.assetCode}_${c.component}`} className="py-2.5 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-3">
                  <div className="text-[#F4F5F6] font-medium truncate">{c.component}</div>
                  <div className="text-[#9AA5B1] font-mono tabular-nums">
                    {c.assetCode} · Last: {c.latest}
                  </div>
                </div>
                <span className="font-mono text-[#F5B942] tabular-nums shrink-0">
                  {c.count} event(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evidence-Backed AI Investigation Report Table */}
      <div className="bg-[#1B2229] border border-white/10 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#F5B942]" />
            <h2 className="text-sm font-semibold text-[#F4F5F6]">
              Evidence-Backed Investigation Summary
            </h2>
          </div>
          <span className="font-mono text-xs text-[#9AA5B1] tabular-nums">
            {recommendations.length} findings
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs text-[#9AA5B1] bg-[#242C34]/40">
                <th className="py-3 px-4 font-medium">Asset</th>
                <th className="py-3 px-4 font-medium">Finding</th>
                <th className="py-3 px-4 font-medium">Rule Triggered</th>
                <th className="py-3 px-4 font-medium text-right">Records</th>
                <th className="py-3 px-4 font-medium text-right">Completeness</th>
                <th className="py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-xs">
              {recommendations.map((rec) => (
                <tr key={rec.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-mono text-[#F5B942] tabular-nums">{rec.assetCode}</td>
                  <td className="py-3 px-4 text-[#F4F5F6] font-medium">{rec.title}</td>
                  <td className="py-3 px-4 text-[#9AA5B1]">{rec.ruleTriggered}</td>
                  <td className="py-3 px-4 font-mono text-right text-[#55C6D9] tabular-nums">
                    {rec.supportingRecordIds.length}
                  </td>
                  <td className="py-3 px-4 font-mono text-right text-[#F4F5F6] tabular-nums">
                    {rec.evidenceCompleteness}%
                  </td>
                  <td className="py-3 px-4">
                    <StatusText status={rec.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
