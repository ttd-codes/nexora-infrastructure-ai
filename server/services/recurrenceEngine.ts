export interface EngineAssetInput {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  locationName: string;
}

export interface EngineRecordInput {
  id: string;
  recordCode: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  locationName?: string;
  incidentDate: string;
  category: string;
  recordType: string;
  title: string;
  description: string;
  symptoms: string[];
  repairAction?: string;
  componentInvolved?: string;
  technicianName?: string;
  status: string;
  sourceDocumentName?: string;
}

export interface EngineRuleConfig {
  code: string;
  name: string;
  description?: string;
  thresholdCount: number;
  windowDays: number;
  enabled: boolean;
}

export interface DetectedFinding {
  id: string;
  title: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  ruleTriggered: string;
  ruleDescription: string;
  severity: 'High' | 'Medium' | 'Low';
  observedFacts: string[];
  interpretation: string;
  missingInformation: string[];
  suggestedActions: string[];
  supportingRecordIds: string[];
  contradictoryRecordIds: string[];
  evidenceCompleteness: number;
  datesInvolved: string[];
  intervalsDays: number[];
}

const SYMPTOM_KEYWORDS = [
  'vibration',
  'noise',
  'grinding',
  'bearing',
  'overheat',
  'temperature',
  'leak',
  'pressure',
  'voltage',
  'trip',
  'misalignment',
  'alignment',
  'seal',
  'coolant',
  'compressor',
  'door',
  'sensor',
  'harmonic',
  'breaker',
];

function parseIsoDate(dateStr: string): number | null {
  const ts = Date.parse(dateStr);
  return Number.isNaN(ts) ? null : ts;
}

function daysBetween(aMs: number, bMs: number): number {
  return Math.round(Math.abs(bMs - aMs) / (1000 * 60 * 60 * 24));
}

function extractTokens(rec: EngineRecordInput): string[] {
  const combined = `${rec.title} ${rec.description} ${rec.symptoms.join(' ')} ${rec.componentInvolved || ''}`.toLowerCase();
  return SYMPTOM_KEYWORDS.filter((kw) => combined.includes(kw));
}

function computeEvidenceCompleteness(records: EngineRecordInput[]): {
  score: number;
  missing: string[];
} {
  if (records.length === 0) return { score: 0, missing: ['No supporting records available'] };

  let totalChecks = 0;
  let passedChecks = 0;
  let missingTech = 0;
  let missingComponent = 0;
  let missingRepair = 0;
  let missingSource = 0;
  let missingSymptoms = 0;

  for (const r of records) {
    totalChecks += 6;
    if (r.incidentDate) passedChecks += 1;
    if (r.symptoms && r.symptoms.length > 0) passedChecks += 1;
    else missingSymptoms += 1;

    if (r.componentInvolved && r.componentInvolved.trim().length > 0) passedChecks += 1;
    else missingComponent += 1;

    if (r.repairAction && r.repairAction.trim().length > 0) passedChecks += 1;
    else missingRepair += 1;

    if (r.technicianName && r.technicianName.trim().length > 0) passedChecks += 1;
    else missingTech += 1;

    if (r.sourceDocumentName && r.sourceDocumentName.trim().length > 0) passedChecks += 1;
    else missingSource += 1;
  }

  const missing: string[] = [];
  if (missingSymptoms > 0) missing.push(`${missingSymptoms} record(s) lack structured symptom tags.`);
  if (missingComponent > 0) missing.push(`${missingComponent} record(s) do not specify the exact sub-component.`);
  if (missingRepair > 0) missing.push(`${missingRepair} record(s) have no documented repair outcome.`);
  if (missingTech > 0) missing.push(`${missingTech} record(s) omit technician attribution.`);
  if (missingSource > 0) missing.push(`${missingSource} record(s) are not linked to an original source document.`);
  missing.push('Quantitative diagnostic measurements (e.g., RMS vibration velocity, shaft runout, or load current logs) are not attached in historical registers.');

  return {
    score: Math.round((passedChecks / totalChecks) * 100),
    missing: missing.slice(0, 5),
  };
}

function detectContradictions(sortedRecords: EngineRecordInput[]): string[] {
  const contradictions: string[] = [];
  for (let i = 0; i < sortedRecords.length - 1; i++) {
    const earlier = sortedRecords[i];
    const later = sortedRecords[i + 1];
    const earlierText = `${earlier.description} ${earlier.repairAction || ''}`.toLowerCase();
    const resolvedClaim =
      earlierText.includes('eliminated') ||
      earlierText.includes('normal limits') ||
      earlierText.includes('test run successful') ||
      earlier.status === 'Resolved';
    if (resolvedClaim && earlier.assetId === later.assetId) {
      const overlap = extractTokens(earlier).filter((t) => extractTokens(later).includes(t));
      if (overlap.length > 0) {
        contradictions.push(earlier.id);
      }
    }
  }
  return Array.from(new Set(contradictions));
}

export function runRecurrenceAnalysis(
  assets: EngineAssetInput[],
  records: EngineRecordInput[],
  rules: EngineRuleConfig[]
): DetectedFinding[] {
  const ruleMap = new Map(rules.map((r) => [r.code, r]));
  const r1 = ruleMap.get('R-01') ?? {
    code: 'R-01',
    name: 'High-Frequency Asset Incidents',
    thresholdCount: 3,
    windowDays: 120,
    enabled: true,
  };
  const r2 = ruleMap.get('R-02') ?? {
    code: 'R-02',
    name: 'Repeated Similar Symptom Cluster',
    thresholdCount: 2,
    windowDays: 180,
    enabled: true,
  };
  const r3 = ruleMap.get('R-03') ?? {
    code: 'R-03',
    name: 'Repeated Component Intervention',
    thresholdCount: 2,
    windowDays: 180,
    enabled: true,
  };
  const r4 = ruleMap.get('R-04') ?? {
    code: 'R-04',
    name: 'Shortening Incident Intervals',
    thresholdCount: 3,
    windowDays: 240,
    enabled: true,
  };
  const r5 = ruleMap.get('R-05') ?? {
    code: 'R-05',
    name: 'Location & Category Hotspot',
    thresholdCount: 3,
    windowDays: 180,
    enabled: true,
  };

  const findings: DetectedFinding[] = [];

  for (const asset of assets) {
    const assetRecords = records
      .filter((rec) => rec.assetId === asset.id || rec.assetCode === asset.assetCode)
      .slice()
      .sort((a, b) => (parseIsoDate(a.incidentDate) ?? 0) - (parseIsoDate(b.incidentDate) ?? 0));

    if (assetRecords.length < 2) continue;

    const datedRecords = assetRecords
      .map((r) => ({ rec: r, ms: parseIsoDate(r.incidentDate) }))
      .filter((x): x is { rec: EngineRecordInput; ms: number } => x.ms !== null);

    const intervals: number[] = [];
    for (let i = 1; i < datedRecords.length; i++) {
      intervals.push(daysBetween(datedRecords[i - 1].ms, datedRecords[i].ms));
    }

    const triggeredRuleNames: string[] = [];
    let primaryRuleCode = '';
    let primaryRuleDescription = '';

    // R-01: N+ incidents within windowDays
    if (r1.enabled && datedRecords.length >= r1.thresholdCount) {
      const span = daysBetween(
        datedRecords[datedRecords.length - r1.thresholdCount].ms,
        datedRecords[datedRecords.length - 1].ms
      );
      if (span <= r1.windowDays) {
        triggeredRuleNames.push(`${r1.code}: ${r1.name} (${r1.thresholdCount}+ events in ${span} days <= ${r1.windowDays}d threshold)`);
        primaryRuleCode = `${r1.code} · ${r1.name}`;
        primaryRuleDescription = `${datedRecords.length} maintenance records logged within ${span} days (configured window: ${r1.windowDays} days, threshold: ${r1.thresholdCount}).`;
      }
    }

    // R-02: Repeated symptom keywords
    const tokenCounts = new Map<string, EngineRecordInput[]>();
    for (const rec of assetRecords) {
      for (const tok of extractTokens(rec)) {
        const list = tokenCounts.get(tok) || [];
        list.push(rec);
        tokenCounts.set(tok, list);
      }
    }
    const repeatedTokens = Array.from(tokenCounts.entries()).filter(
      ([, recs]) => recs.length >= r2.thresholdCount
    );
    if (r2.enabled && repeatedTokens.length > 0) {
      const topToken = repeatedTokens.sort((a, b) => b[1].length - a[1].length)[0];
      triggeredRuleNames.push(`${r2.code}: ${r2.name} ("${topToken[0]}" across ${topToken[1].length} records)`);
      if (!primaryRuleCode) {
        primaryRuleCode = `${r2.code} · ${r2.name}`;
        primaryRuleDescription = `Repeated "${topToken[0]}" indicators detected across ${topToken[1].length} historical maintenance records.`;
      }
    }

    // R-03: Repeated component involvement
    const compMap = new Map<string, EngineRecordInput[]>();
    for (const rec of assetRecords) {
      const comp = (rec.componentInvolved || '').trim();
      if (comp) {
        const key = comp.toLowerCase();
        const arr = compMap.get(key) || [];
        arr.push(rec);
        compMap.set(key, arr);
      }
    }
    const repeatedComps = Array.from(compMap.entries()).filter(
      ([, recs]) => recs.length >= r3.thresholdCount
    );
    if (r3.enabled && repeatedComps.length > 0) {
      const [compKey, compRecs] = repeatedComps[0];
      triggeredRuleNames.push(`${r3.code}: ${r3.name} ("${compKey}" in ${compRecs.length} records)`);
      if (!primaryRuleCode) {
        primaryRuleCode = `${r3.code} · ${r3.name}`;
        primaryRuleDescription = `Component "${compKey}" appears in ${compRecs.length} separate maintenance interventions.`;
      }
    }

    // R-04: Shortening intervals
    let hasShortening = false;
    if (r4.enabled && intervals.length >= 2) {
      for (let i = 1; i < intervals.length; i++) {
        if (intervals[i] < intervals[i - 1]) {
          hasShortening = true;
          triggeredRuleNames.push(
            `${r4.code}: ${r4.name} (${intervals[i - 1]}d -> ${intervals[i]}d)`
          );
          if (!primaryRuleCode) {
            primaryRuleCode = `${r4.code} · ${r4.name}`;
            primaryRuleDescription = `Time between consecutive events compressed from ${intervals[i - 1]} days to ${intervals[i]} days.`;
          }
          break;
        }
      }
    }

    if (triggeredRuleNames.length === 0) continue;

    const { score, missing } = computeEvidenceCompleteness(assetRecords);
    const contradictoryIds = detectContradictions(assetRecords);
    const topSymptom = repeatedTokens[0]?.[0] || 'recurring operational';
    const topComp = repeatedComps[0]?.[0];

    const observedFacts = assetRecords.map(
      (r) =>
        `${r.incidentDate} (${r.recordCode}): ${r.title}${r.repairAction ? ` — Action logged: ${r.repairAction}` : ''}`
    );

    const interpretation = `Multiple maintenance records (${assetRecords.length} events across ${assetRecords.map((r) => r.incidentDate).join(', ')}) indicate recurring ${topSymptom}-related symptoms on ${asset.assetCode} (${asset.name}).${
      hasShortening ? ` Intervals between reports shortened (${intervals.join('d -> ')}d).` : ''
    }${
      topComp ? ` Prior actions repeatedly involved the ${topComp} subsystem.` : ''
    } Evidence suggests a recurring operational pattern warranting physical verification rather than confirming a single root cause.`;

    const suggestedActions = [
      `Schedule a structured assembly inspection for ${asset.assetCode} (${asset.name}) at ${asset.locationName}.`,
      topComp
        ? `Review prior ${topComp} intervention records and verify installation tolerances and coupling alignment.`
        : `Review all ${assetRecords.length} historical work orders and verify mechanical/electrical clearances.`,
      `Capture quantitative baseline readings (e.g., vibration RMS, thermal profile, or load metrics) during the next inspection.`,
    ];

    const severity: 'High' | 'Medium' | 'Low' =
      triggeredRuleNames.length >= 2 || hasShortening ? 'High' : 'Medium';

    findings.push({
      id: `finding_${asset.assetCode.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      title: `Repeated ${topSymptom} pattern detected on ${asset.assetCode} — ${asset.name}`,
      assetId: asset.id,
      assetCode: asset.assetCode,
      assetName: asset.name,
      ruleTriggered: primaryRuleCode,
      ruleDescription: `${primaryRuleDescription} Rules matched: ${triggeredRuleNames.join('; ')}.`,
      severity,
      observedFacts,
      interpretation,
      missingInformation: missing,
      suggestedActions,
      supportingRecordIds: assetRecords.map((r) => r.id),
      contradictoryRecordIds: contradictoryIds,
      evidenceCompleteness: score,
      datesInvolved: assetRecords.map((r) => r.incidentDate),
      intervalsDays: intervals,
    });
  }

  // R-05: Location hotspot check across assets if enabled
  if (r5.enabled) {
    const locGroups = new Map<string, EngineRecordInput[]>();
    for (const rec of records) {
      if (!rec.locationName) continue;
      const list = locGroups.get(rec.locationName) || [];
      list.push(rec);
      locGroups.set(rec.locationName, list);
    }
    for (const [locName, locRecs] of locGroups.entries()) {
      const uniqueAssets = new Set(locRecs.map((r) => r.assetId));
      if (locRecs.length >= r5.thresholdCount && uniqueAssets.size >= 2) {
        const anchorRec = locRecs[0];
        const { score, missing } = computeEvidenceCompleteness(locRecs);
        findings.push({
          id: `finding_loc_${locName.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          title: `Location cluster: ${locRecs.length} maintenance events in ${locName}`,
          assetId: anchorRec.assetId,
          assetCode: anchorRec.assetCode,
          assetName: `${locName} Shared Facility Zone`,
          ruleTriggered: `${r5.code} · ${r5.name}`,
          ruleDescription: `${locRecs.length} records logged across ${uniqueAssets.size} distinct assets in ${locName}.`,
          severity: 'Low',
          observedFacts: locRecs.map((r) => `${r.incidentDate} (${r.assetCode}): ${r.title}`),
          interpretation: `Multiple assets located in ${locName} have logged maintenance events. Shared environmental or utility feed conditions may merit a zone-level walkthrough.`,
          missingInformation: missing,
          suggestedActions: [
            `Conduct a shared utility & environmental inspection in ${locName}.`,
            `Cross-check power quality, ambient ventilation, and supply pressure logs across ${locName}.`,
          ],
          supportingRecordIds: locRecs.map((r) => r.id),
          contradictoryRecordIds: [],
          evidenceCompleteness: score,
          datesInvolved: locRecs.map((r) => r.incidentDate),
          intervalsDays: [],
        });
      }
    }
  }

  return findings;
}
