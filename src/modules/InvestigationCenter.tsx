import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileText,
  HelpCircle,
  Play,
  Sliders,
} from 'lucide-react';
import { StatusText } from '../components/StatusText';
import { useWorkspace } from '../context/WorkspaceContext';
import { runRecurrenceEngineViaApi } from '../services/apiService';
import {
  createNotification,
  saveRecommendation,
  updateRecommendationStatus,
  updateRuleConfig,
} from '../services/firestoreService';
import { Recommendation } from '../types/nexora';

export function InvestigationCenter() {
  const {
    user,
    profile,
    assets,
    records,
    documents,
    recommendations,
    ruleConfigs,
    selectedRecommendationId,
    setSelectedRecommendationId,
    openAssetDetail,
    setActiveModule,
    pushToast,
  } = useWorkspace();

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'history'>('all');
  const [enrichWithAi, setEnrichWithAi] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [evidenceExpanded, setEvidenceExpanded] = useState(true);

  const visibleFindings = useMemo(() => {
    return recommendations.filter((r) => {
      if (statusFilter === 'active') return r.status === 'Active' || r.status === 'Inspection Scheduled';
      if (statusFilter === 'history') return r.status === 'Reviewed' || r.status === 'Dismissed';
      return true;
    });
  }, [recommendations, statusFilter]);

  const activeFinding: Recommendation | null = useMemo(() => {
    if (selectedRecommendationId) {
      const match = recommendations.find((r) => r.id === selectedRecommendationId);
      if (match) return match;
    }
    return visibleFindings[0] || recommendations[0] || null;
  }, [recommendations, visibleFindings, selectedRecommendationId]);

  const supportingRecords = useMemo(() => {
    if (!activeFinding) return [];
    return records
      .filter((r) => activeFinding.supportingRecordIds.includes(r.id))
      .sort((a, b) => a.incidentDate.localeCompare(b.incidentDate));
  }, [activeFinding, records]);

  const contradictoryRecords = useMemo(() => {
    if (!activeFinding) return [];
    return records.filter((r) => activeFinding.contradictoryRecordIds.includes(r.id));
  }, [activeFinding, records]);

  const handleRunEngine = async () => {
    if (!user) return;
    setAnalyzing(true);
    try {
      const res = await runRecurrenceEngineViaApi({
        assets,
        records,
        rules: ruleConfigs,
        enrichWithAi,
      });

      for (const f of res.findings) {
        const existing = recommendations.find(
          (r) => r.assetId === f.assetId && r.ruleTriggered === f.ruleTriggered
        );
        await saveRecommendation(user.uid, f.id, {
          title: f.title,
          assetId: f.assetId,
          assetCode: f.assetCode,
          assetName: f.assetName,
          ruleTriggered: f.ruleTriggered,
          ruleDescription: f.ruleDescription,
          severity: f.severity,
          observedFacts: f.observedFacts,
          interpretation: f.interpretation,
          missingInformation: f.missingInformation,
          suggestedActions: f.suggestedActions,
          supportingRecordIds: f.supportingRecordIds,
          contradictoryRecordIds: f.contradictoryRecordIds,
          evidenceCompleteness: f.evidenceCompleteness,
          status: existing?.status || 'Active',
          isDemoData: false,
        });
      }

      if (res.findings.length > 0) {
        await createNotification(user.uid, {
          title: `Recurrence Engine Completed (${res.findings.length} Pattern(s))`,
          message: `Evaluated ${records.length} historical maintenance records across ${assets.length} assets.`,
          severity: res.findings.some((f) => f.severity === 'High') ? 'High' : 'Medium',
          assetId: res.findings[0].assetId,
          recommendationId: '',
          read: false,
          isDemoData: false,
        });
      }

      if (res.aiWarning) {
        pushToast({
          title: 'Rule Analysis Complete (Deterministic Mode)',
          detail: res.aiWarning,
          tone: 'warning',
        });
      } else {
        pushToast({
          title: 'Investigation Engine Updated',
          detail: `Identified ${res.findings.length} evidence-backed pattern(s).`,
          tone: 'success',
        });
      }
    } catch (err) {
      pushToast({
        title: 'Recurrence Analysis Failed',
        detail: err instanceof Error ? err.message : 'Unable to execute rule engine.',
        tone: 'error',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStatusChange = async (status: Recommendation['status']) => {
    if (!activeFinding) return;
    try {
      await updateRecommendationStatus(activeFinding.id, status);
      pushToast({
        title: 'Recommendation Updated',
        detail: `Status set to ${status}.`,
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Update Failed',
        detail: err instanceof Error ? err.message : 'Could not update status.',
        tone: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F5F6] tracking-tight">
            AI Investigation Center
          </h1>
          <p className="text-sm text-[#9AA5B1] mt-1">
            Explainable historical pattern detection separating observed facts, interpretations, missing evidence, and suggested inspections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-[#9AA5B1] bg-[#1B2229] border border-white/10 rounded-md px-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enrichWithAi}
              onChange={(e) => setEnrichWithAi(e.target.checked)}
              className="accent-[#F5B942]"
            />
            <span>Gemini Synthesis</span>
          </label>

          <button
            type="button"
            onClick={() => setShowRulesPanel((v) => !v)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-[#1B2229] border border-white/10 hover:border-white/25 text-[#F4F5F6] rounded-md transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-[#55C6D9]" />
            Rule Thresholds ({ruleConfigs.filter((r) => r.enabled).length})
          </button>

          <button
            type="button"
            onClick={handleRunEngine}
            disabled={analyzing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#F5B942] text-[#101418] rounded-md hover:bg-[#f6c45f] disabled:opacity-50 transition-colors"
          >
            <Play className="w-3.5 h-3.5" />
            {analyzing ? 'Evaluating Records...' : 'Run Recurrence Engine'}
          </button>
        </div>
      </div>

      {/* Configurable Rule Engine Thresholds */}
      {showRulesPanel && (
        <div className="bg-[#1B2229] border border-white/10 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#F4F5F6]">
                Transparent Recurrence Detection Rules
              </h2>
              <p className="text-xs text-[#9AA5B1]">
                Configure deterministic thresholds persisted per workspace. Every pattern must link to real historical records.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ruleConfigs.map((rule) => (
              <div
                key={rule.id}
                className="bg-[#242C34] border border-white/10 rounded-md p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs text-[#55C6D9]">{rule.code}</div>
                    <div className="text-sm font-medium text-[#F4F5F6]">{rule.name}</div>
                  </div>
                  <input
                    type="checkbox"
                    aria-label={`Toggle rule ${rule.code}`}
                    checked={rule.enabled}
                    onChange={(e) =>
                      updateRuleConfig(rule.id, {
                        enabled: e.target.checked,
                        thresholdCount: rule.thresholdCount,
                        windowDays: rule.windowDays,
                      })
                    }
                    className="accent-[#F5B942] mt-1"
                  />
                </div>
                <p className="text-xs text-[#9AA5B1] leading-relaxed">{rule.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <label className="block text-[#9AA5B1] mb-1">Min Events</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={rule.thresholdCount}
                      onChange={(e) =>
                        updateRuleConfig(rule.id, {
                          enabled: rule.enabled,
                          thresholdCount: Math.max(1, Math.min(20, Number(e.target.value) || 2)),
                          windowDays: rule.windowDays,
                        })
                      }
                      className="w-full bg-[#101418] border border-white/10 rounded px-2 py-1 font-mono text-[#F4F5F6]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#9AA5B1] mb-1">Window (Days)</label>
                    <input
                      type="number"
                      min={7}
                      max={730}
                      value={rule.windowDays}
                      onChange={(e) =>
                        updateRuleConfig(rule.id, {
                          enabled: rule.enabled,
                          thresholdCount: rule.thresholdCount,
                          windowDays: Math.max(7, Math.min(730, Number(e.target.value) || 90)),
                        })
                      }
                      className="w-full bg-[#101418] border border-white/10 rounded px-2 py-1 font-mono text-[#F4F5F6]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Split Investigation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Queue */}
        <div className="lg:col-span-4 bg-[#1B2229] border border-white/10 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-white/10 flex items-center gap-1 bg-[#242C34]/40">
            {(['all', 'active', 'history'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded transition-colors ${
                  statusFilter === tab
                    ? 'bg-[#242C34] text-[#F4F5F6]'
                    : 'text-[#9AA5B1] hover:text-[#F4F5F6]'
                }`}
              >
                {tab === 'all' ? 'All Findings' : tab === 'active' ? 'Active Queue' : 'History'}
              </button>
            ))}
          </div>

          <div className="divide-y divide-white/10 max-h-[680px] overflow-y-auto">
            {visibleFindings.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#9AA5B1]">
                No findings in this queue. Run the Recurrence Engine to analyze records.
              </div>
            ) : (
              visibleFindings.map((item) => {
                const isSelected = activeFinding?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedRecommendationId(item.id)}
                    className={`w-full text-left p-4 space-y-2 transition-colors ${
                      isSelected ? 'bg-[#242C34]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-[#F5B942] tabular-nums">
                        {item.assetCode}
                      </span>
                      <StatusText status={item.severity} />
                    </div>
                    <div className="text-sm font-medium text-[#F4F5F6] leading-snug">
                      {item.title}
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#9AA5B1]">
                      <span>{item.supportingRecordIds.length} linked records</span>
                      <span className="font-mono tabular-nums">{item.evidenceCompleteness}% evidence</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Investigation Detail */}
        <div className="lg:col-span-8 space-y-5">
          {!activeFinding ? (
            <div className="bg-[#1B2229] border border-white/10 rounded-lg p-12 text-center space-y-3">
              <Cpu className="w-8 h-8 text-[#55C6D9] mx-auto" />
              <h2 className="text-base font-semibold text-[#F4F5F6]">No Investigation Selected</h2>
              <p className="text-xs text-[#9AA5B1] max-w-md mx-auto">
                Click Run Recurrence Engine above to scan all historical maintenance records for recurring symptoms, component interventions, and shortening intervals.
              </p>
            </div>
          ) : (
            <div className="bg-[#1B2229] border border-white/10 rounded-lg p-6 space-y-6">
              {/* Finding Header */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-white/10">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#9AA5B1]">
                    <button
                      type="button"
                      onClick={() => openAssetDetail(activeFinding.assetId)}
                      className="font-mono text-[#F5B942] hover:underline tabular-nums"
                    >
                      {activeFinding.assetCode} — {activeFinding.assetName}
                    </button>
                    <span aria-hidden="true">·</span>
                    <span>{activeFinding.status}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-[#F4F5F6]">{activeFinding.title}</h2>
                  <p className="text-xs text-[#55C6D9] font-mono">
                    Rule Triggered: {activeFinding.ruleTriggered}
                  </p>
                  {activeFinding.ruleDescription && (
                    <p className="text-xs text-[#9AA5B1]">{activeFinding.ruleDescription}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {activeFinding.status === 'Dismissed' && profile?.role !== 'admin' ? (
                    <span className="text-xs font-mono text-[#9AA5B1]">
                      Dismissed (locked)
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange('Inspection Scheduled')}
                        className="px-3 py-1.5 text-xs font-medium bg-[#F5B942] text-[#101418] rounded hover:bg-[#f6c45f] transition-colors"
                      >
                        Schedule Inspection
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange('Reviewed')}
                        className="px-3 py-1.5 text-xs font-medium bg-[#242C34] text-[#F4F5F6] border border-white/10 rounded hover:border-[#3DD68C]"
                      >
                        Mark Reviewed
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange('Dismissed')}
                        className="px-3 py-1.5 text-xs font-medium text-[#9AA5B1] hover:text-[#F4F5F6]"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Evidence Completeness Meter */}
              <div className="bg-[#101418] border border-white/10 rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-[#F4F5F6]">
                    Evidence Completeness &amp; Traceability
                  </div>
                  <p className="text-xs text-[#9AA5B1]">
                    Calculated deterministically from linked dates, symptoms, components, repairs, technician attribution, and source documents.
                  </p>
                </div>
                <div className="w-full sm:w-48 shrink-0 space-y-1.5">
                  <div className="flex justify-between text-xs font-mono tabular-nums">
                    <span className="text-[#9AA5B1]">Completeness</span>
                    <span className="text-[#55C6D9]">{activeFinding.evidenceCompleteness}%</span>
                  </div>
                  <div className="h-2 bg-[#242C34] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#55C6D9]"
                      style={{ width: `${activeFinding.evidenceCompleteness}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Epistemic 4-Part Separation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Observed Facts */}
                <div className="bg-[#242C34]/60 border border-white/10 rounded-md p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F5F6]">
                    <CheckCircle2 className="w-4 h-4 text-[#3DD68C]" />
                    <span>1. Observed Facts (Historical Records)</span>
                  </div>
                  <ul className="space-y-2 text-xs text-[#F4F5F6] leading-relaxed">
                    {activeFinding.observedFacts.map((fact, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono text-[#55C6D9] tabular-nums shrink-0">
                          {idx + 1}.
                        </span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 2. AI Interpretations */}
                <div className="bg-[#242C34]/60 border border-white/10 rounded-md p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F5F6]">
                    <Cpu className="w-4 h-4 text-[#55C6D9]" />
                    <span>2. AI Interpretation (Non-Diagnostic)</span>
                  </div>
                  <p className="text-xs text-[#F4F5F6] leading-relaxed">
                    {activeFinding.interpretation}
                  </p>
                  <p className="text-[11px] text-[#9AA5B1] pt-1 border-t border-white/10">
                    NEXORA flags recurring patterns from historical records without assuming confirmed component failure or predicting exact failure dates.
                  </p>
                </div>

                {/* 3. Missing Information */}
                <div className="bg-[#242C34]/60 border border-white/10 rounded-md p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F5F6]">
                    <HelpCircle className="w-4 h-4 text-[#F5B942]" />
                    <span>3. Missing Information</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-[#9AA5B1] leading-relaxed">
                    {activeFinding.missingInformation.map((m, idx) => (
                      <li key={idx}>• {m}</li>
                    ))}
                  </ul>
                </div>

                {/* 4. Suggested Actions */}
                <div className="bg-[#242C34]/60 border border-white/10 rounded-md p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F5F6]">
                    <AlertTriangle className="w-4 h-4 text-[#F5B942]" />
                    <span>4. Suggested Inspection Actions</span>
                  </div>
                  <ul className="space-y-2 text-xs text-[#F4F5F6] leading-relaxed">
                    {activeFinding.suggestedActions.map((act, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono text-[#F5B942] tabular-nums shrink-0">→</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Contradictory Evidence */}
              {contradictoryRecords.length > 0 && (
                <div className="bg-[#101418] border border-[#F5B942]/30 rounded-md p-4 space-y-2">
                  <div className="text-xs font-semibold text-[#F5B942]">
                    Contradictory / Prior Resolution Signals
                  </div>
                  <p className="text-xs text-[#9AA5B1]">
                    The following historical records indicated normal post-repair operation before symptoms reappeared:
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {contradictoryRecords.map((cr) => (
                      <div key={cr.id} className="text-xs text-[#F4F5F6]">
                        <span className="font-mono text-[#55C6D9] tabular-nums">
                          {cr.incidentDate} ({cr.recordCode})
                        </span>
                        : {cr.repairAction || cr.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expandable Supporting Evidence Drawer */}
              <div className="border border-white/10 rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => setEvidenceExpanded((v) => !v)}
                  className="w-full px-4 py-3 bg-[#242C34] flex items-center justify-between text-xs font-semibold text-[#F4F5F6]"
                >
                  <span>
                    Supporting Maintenance Records &amp; Source Artifacts ({supportingRecords.length})
                  </span>
                  {evidenceExpanded ? (
                    <ChevronUp className="w-4 h-4 text-[#9AA5B1]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#9AA5B1]" />
                  )}
                </button>

                {evidenceExpanded && (
                  <div className="divide-y divide-white/10 bg-[#101418]">
                    {supportingRecords.map((rec) => {
                      const linkedDoc = documents.find((d) => d.id === rec.sourceDocumentId);
                      return (
                        <div key={rec.id} className="p-4 space-y-2 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[#F5B942] tabular-nums">
                                {rec.incidentDate}
                              </span>
                              <span className="font-mono text-[#55C6D9] tabular-nums">
                                {rec.recordCode}
                              </span>
                              <span className="font-medium text-[#F4F5F6]">{rec.title}</span>
                            </div>
                            <StatusText status={rec.status} />
                          </div>
                          <p className="text-[#9AA5B1] leading-relaxed">{rec.description}</p>
                          {rec.repairAction && (
                            <p className="text-[#F4F5F6]">
                              <span className="text-[#9AA5B1]">Action: </span>
                              {rec.repairAction}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[#9AA5B1]">
                            <span>
                              Component: {rec.componentInvolved || 'Unspecified'} · Technician:{' '}
                              {rec.technicianName || 'Unattributed'}
                            </span>
                            {linkedDoc && (
                              <button
                                type="button"
                                onClick={() => setActiveModule('data-intake')}
                                className="inline-flex items-center gap-1 text-[#55C6D9] hover:underline font-mono"
                              >
                                <FileText className="w-3 h-3" />
                                {linkedDoc.fileName}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
