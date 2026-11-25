import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Box,
  Calendar,
  MapPin,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import {
  Area,
  AreaChart,
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

export function CommandCenter() {
  const {
    assets,
    locations,
    records,
    recommendations,
    setActiveModule,
    openAssetDetail,
    openInvestigation,
    dataLoading,
  } = useWorkspace();

  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState<'all' | '90' | '180'>('all');

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (categoryFilter !== 'All' && a.category !== categoryFilter) return false;
      if (locationFilter !== 'All' && a.locationId !== locationFilter) return false;
      return true;
    });
  }, [assets, categoryFilter, locationFilter]);

  const filteredRecords = useMemo(() => {
    const assetIds = new Set(filteredAssets.map((a) => a.id));
    const cutoff =
      dateRange === 'all'
        ? 0
        : Date.now() - Number(dateRange) * 24 * 60 * 60 * 1000;

    return records.filter((r) => {
      if (!assetIds.has(r.assetId)) return false;
      if (cutoff > 0) {
        const ts = Date.parse(r.incidentDate);
        if (!Number.isNaN(ts) && ts < cutoff) return false;
      }
      return true;
    });
  }, [records, filteredAssets, dateRange]);

  const activeIncidentsCount = useMemo(
    () =>
      filteredRecords.filter(
        (r) => r.status === 'Open' || r.status === 'In Progress' || r.status === 'Monitoring'
      ).length,
    [filteredRecords]
  );

  const activeRecommendations = useMemo(
    () => recommendations.filter((r) => r.status !== 'Dismissed'),
    [recommendations]
  );

  const trendData = useMemo(() => {
    const monthBuckets = new Map<string, { month: string; incidents: number; repairs: number }>();
    const sorted = [...filteredRecords].sort((a, b) => a.incidentDate.localeCompare(b.incidentDate));
    for (const r of sorted) {
      const monthKey = r.incidentDate.slice(0, 7) || 'Unknown';
      const current = monthBuckets.get(monthKey) || { month: monthKey, incidents: 0, repairs: 0 };
      if (r.recordType === 'Incident') current.incidents += 1;
      else current.repairs += 1;
      monthBuckets.set(monthKey, current);
    }
    return Array.from(monthBuckets.values());
  }, [filteredRecords]);

  const locationChartData = useMemo(() => {
    const counts = new Map<string, { location: string; total: number; active: number }>();
    for (const loc of locations) {
      if (locationFilter !== 'All' && loc.id !== locationFilter) continue;
      counts.set(loc.buildingCode, { location: loc.buildingCode, total: 0, active: 0 });
    }
    for (const r of filteredRecords) {
      const asset = assets.find((a) => a.id === r.assetId);
      const loc = locations.find((l) => l.id === asset?.locationId);
      const code = loc?.buildingCode || 'OTHER';
      const entry = counts.get(code) || { location: code, total: 0, active: 0 };
      entry.total += 1;
      if (r.status !== 'Resolved') entry.active += 1;
      counts.set(code, entry);
    }
    return Array.from(counts.values());
  }, [filteredRecords, locations, assets, locationFilter]);

  const statusDistribution = useMemo(() => {
    const statuses = ['Operational', 'Attention Required', 'Under Maintenance', 'Offline'] as const;
    return statuses.map((st) => ({
      status: st,
      count: filteredAssets.filter((a) => a.status === st).length,
      pct: filteredAssets.length
        ? Math.round((filteredAssets.filter((a) => a.status === st).length / filteredAssets.length) * 100)
        : 0,
    }));
  }, [filteredAssets]);

  const recentActivity = useMemo(() => {
    return [...filteredRecords]
      .sort((a, b) => b.incidentDate.localeCompare(a.incidentDate))
      .slice(0, 6);
  }, [filteredRecords]);

  const hasDemoRecords = assets.some((a) => a.isDemoData);

  if (dataLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-24 bg-[#1B2229] border border-white/10 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-80 bg-[#1B2229] border border-white/10 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter Strip */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F5F6] tracking-tight">
            Infrastructure Command Center
          </h1>
          <p className="text-sm text-[#9AA5B1] mt-1">
            Connected maintenance memory, active incidents, and recurring pattern intelligence.
            {hasDemoRecords && ' Includes fictional campus demonstration data.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-[#1B2229] border border-white/10 rounded-md px-3 py-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-[#9AA5B1]" />
            <select
              aria-label="Filter by date range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as 'all' | '90' | '180')}
              className="bg-transparent text-[#F4F5F6] focus:outline-none"
            >
              <option value="all" className="bg-[#1B2229]">All Recorded Dates</option>
              <option value="90" className="bg-[#1B2229]">Last 90 Days</option>
              <option value="180" className="bg-[#1B2229]">Last 180 Days</option>
            </select>
          </div>

          <select
            aria-label="Filter by asset category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#1B2229] border border-white/10 rounded-md px-3 py-1.5 text-xs text-[#F4F5F6] focus:outline-none focus:border-[#F5B942]"
          >
            <option value="All" className="bg-[#1B2229]">All Categories</option>
            <option value="Water Supply" className="bg-[#1B2229]">Water Supply</option>
            <option value="Electrical" className="bg-[#1B2229]">Electrical</option>
            <option value="Cooling Systems" className="bg-[#1B2229]">Cooling Systems</option>
            <option value="Mechanical" className="bg-[#1B2229]">Mechanical</option>
            <option value="Structural" className="bg-[#1B2229]">Structural</option>
          </select>

          <select
            aria-label="Filter by location"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="bg-[#1B2229] border border-white/10 rounded-md px-3 py-1.5 text-xs text-[#F4F5F6] focus:outline-none focus:border-[#F5B942]"
          >
            <option value="All" className="bg-[#1B2229]">All Campus Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id} className="bg-[#1B2229]">
                {loc.buildingCode} · {loc.name.split('—')[0].trim()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clickable KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <button
          type="button"
          onClick={() => setActiveModule('assets')}
          className="text-left bg-[#1B2229] border border-white/10 hover:border-[#55C6D9]/60 rounded-lg p-4 transition-colors group"
        >
          <div className="flex items-center justify-between text-xs text-[#9AA5B1]">
            <span>Registered Assets</span>
            <Box className="w-4 h-4 text-[#55C6D9]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[#F4F5F6] tabular-nums">
            {filteredAssets.length}
          </div>
          <div className="mt-1 text-xs text-[#9AA5B1] group-hover:text-[#55C6D9] transition-colors">
            View asset registry →
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('maintenance')}
          className="text-left bg-[#1B2229] border border-white/10 hover:border-[#55C6D9]/60 rounded-lg p-4 transition-colors group"
        >
          <div className="flex items-center justify-between text-xs text-[#9AA5B1]">
            <span>Maintenance Records</span>
            <Wrench className="w-4 h-4 text-[#9AA5B1]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[#F4F5F6] tabular-nums">
            {filteredRecords.length}
          </div>
          <div className="mt-1 text-xs text-[#9AA5B1] group-hover:text-[#55C6D9] transition-colors">
            Inspect work log →
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('maintenance')}
          className="text-left bg-[#1B2229] border border-white/10 hover:border-[#F5B942]/60 rounded-lg p-4 transition-colors group"
        >
          <div className="flex items-center justify-between text-xs text-[#9AA5B1]">
            <span>Active Incidents</span>
            <Activity className="w-4 h-4 text-[#F5B942]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[#F5B942] tabular-nums">
            {activeIncidentsCount}
          </div>
          <div className="mt-1 text-xs text-[#9AA5B1] group-hover:text-[#F5B942] transition-colors">
            Open or monitoring →
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('investigation-center')}
          className="text-left bg-[#1B2229] border border-white/10 hover:border-[#F5B942]/60 rounded-lg p-4 transition-colors group"
        >
          <div className="flex items-center justify-between text-xs text-[#9AA5B1]">
            <span>Recurring Patterns</span>
            <ShieldAlert className="w-4 h-4 text-[#F5B942]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[#F4F5F6] tabular-nums">
            {activeRecommendations.length}
          </div>
          <div className="mt-1 text-xs text-[#9AA5B1] group-hover:text-[#F5B942] transition-colors">
            Open AI Investigation →
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveModule('investigation-center')}
          className="text-left bg-[#1B2229] border border-white/10 hover:border-[#55C6D9]/60 rounded-lg p-4 transition-colors group col-span-2 md:col-span-1"
        >
          <div className="flex items-center justify-between text-xs text-[#9AA5B1]">
            <span>Recommended Inspections</span>
            <MapPin className="w-4 h-4 text-[#55C6D9]" />
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold text-[#55C6D9] tabular-nums">
            {activeRecommendations.filter((r) => r.status === 'Active' || r.status === 'Inspection Scheduled').length}
          </div>
          <div className="mt-1 text-xs text-[#9AA5B1] group-hover:text-[#55C6D9] transition-colors">
            Evidence-backed queue →
          </div>
        </button>
      </div>

      {/* Main Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-[#1B2229] border border-white/10 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#F4F5F6]">Maintenance Activity Trends</h2>
              <p className="text-xs text-[#9AA5B1]">Monthly incidents vs. repair &amp; preventive interventions</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#9AA5B1]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#F5B942] rounded-sm" />
                Incidents
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#55C6D9] rounded-sm" />
                Repairs &amp; Checks
              </span>
            </div>
          </div>
          <div className="h-64">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#9AA5B1]">
                No maintenance records match the current filters.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" stroke="#9AA5B1" fontSize={12} tickLine={false} />
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
                  <Area
                    type="monotone"
                    dataKey="incidents"
                    name="Incidents"
                    stroke="#F5B942"
                    fill="#F5B942"
                    fillOpacity={0.22}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="repairs"
                    name="Repairs & Checks"
                    stroke="#55C6D9"
                    fill="#55C6D9"
                    fillOpacity={0.16}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#1B2229] border border-white/10 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#F4F5F6]">Location-Wise Incident Statistics</h2>
            <p className="text-xs text-[#9AA5B1] mb-4">Records grouped by campus building code</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="location" stroke="#9AA5B1" fontSize={12} tickLine={false} />
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
                  <Bar dataKey="total" name="Total Events" fill="#55C6D9" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="active" name="Active / Monitoring" fill="#F5B942" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-white/10 space-y-2.5">
            <div className="text-xs font-medium text-[#9AA5B1]">Asset Status Distribution</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {statusDistribution.map((s) => (
                <div key={s.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#F4F5F6] truncate">{s.status}</span>
                    <span className="font-mono text-[#9AA5B1] tabular-nums">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-[#101418] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        s.status === 'Operational'
                          ? 'bg-[#3DD68C]'
                          : s.status === 'Attention Required'
                          ? 'bg-[#F5B942]'
                          : s.status === 'Under Maintenance'
                          ? 'bg-[#55C6D9]'
                          : 'bg-[#E05252]'
                      }`}
                      style={{ width: `${s.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Critical Attention & AI Insights + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-[#1B2229] border border-white/10 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#F4F5F6]">
                Critical Attention &amp; Evidence-Backed Insights
              </h2>
              <p className="text-xs text-[#9AA5B1]">
                Patterns identified from connected historical records
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('investigation-center')}
              className="text-xs font-medium text-[#F5B942] hover:underline whitespace-nowrap shrink-0"
            >
              Investigation Center →
            </button>
          </div>

          {activeRecommendations.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#9AA5B1] border border-dashed border-white/10 rounded">
              No active recurring pattern alerts. Run the Recurrence Engine in the Investigation Center after logging records.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {activeRecommendations.slice(0, 4).map((rec) => (
                <div key={rec.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-[#9AA5B1]">
                        <span className="font-mono text-[#F5B942] tabular-nums">{rec.assetCode}</span>
                        <span aria-hidden="true">·</span>
                        <span>{rec.ruleTriggered}</span>
                      </div>
                      <h3 className="text-sm font-medium text-[#F4F5F6]">{rec.title}</h3>
                    </div>
                    <StatusText status={rec.severity} />
                  </div>
                  <p className="text-xs text-[#9AA5B1] leading-relaxed line-clamp-2">
                    {rec.interpretation}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-mono text-xs text-[#55C6D9] tabular-nums">
                      {rec.supportingRecordIds.length} supporting records · {rec.evidenceCompleteness}% completeness
                    </span>
                    <button
                      type="button"
                      onClick={() => openInvestigation(rec.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#F4F5F6] hover:text-[#F5B942] transition-colors"
                    >
                      Inspect Evidence <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-[#1B2229] border border-white/10 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#F4F5F6]">Recent Maintenance Activity</h2>
              <p className="text-xs text-[#9AA5B1]">Chronological log across registered campus assets</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModule('maintenance')}
              className="text-xs font-medium text-[#55C6D9] hover:underline whitespace-nowrap shrink-0"
            >
              All Records →
            </button>
          </div>

          <div className="divide-y divide-white/10">
            {recentActivity.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openAssetDetail(item.assetId)}
                className="w-full text-left py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4 hover:bg-white/[0.02] transition-colors rounded px-1 -mx-1"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[#9AA5B1]">
                    <span className="font-mono text-[#55C6D9] tabular-nums">{item.incidentDate}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[#F4F5F6] tabular-nums">{item.assetCode}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{item.recordType}</span>
                  </div>
                  <div className="text-sm text-[#F4F5F6] truncate">{item.title}</div>
                  {item.repairAction && (
                    <div className="text-xs text-[#9AA5B1] truncate">{item.repairAction}</div>
                  )}
                </div>
                <div className="shrink-0 pt-0.5">
                  <StatusText status={item.status} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recently Updated Assets Strip */}
      <div className="bg-[#1B2229] border border-white/10 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#F4F5F6]">Registered Infrastructure Assets</h2>
          <button
            type="button"
            onClick={() => setActiveModule('memory-graph')}
            className="text-xs font-medium text-[#55C6D9] hover:underline whitespace-nowrap shrink-0"
          >
            Explore Memory Graph →
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {filteredAssets.slice(0, 5).map((asset) => {
            const count = records.filter((r) => r.assetId === asset.id).length;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => openAssetDetail(asset.id)}
                className="text-left bg-[#242C34] border border-white/10 hover:border-[#F5B942]/60 rounded-lg p-4 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-[#F5B942] tabular-nums">
                    {asset.assetCode}
                  </span>
                  <span className="font-mono text-xs text-[#9AA5B1] tabular-nums">
                    {count} logs
                  </span>
                </div>
                <div className="text-sm font-semibold text-[#F4F5F6] truncate">{asset.name}</div>
                <div className="text-xs text-[#9AA5B1] truncate">{asset.locationName}</div>
                <div className="pt-1">
                  <StatusText status={asset.status} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
