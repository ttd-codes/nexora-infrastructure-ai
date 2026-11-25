import { auth } from '../lib/firebase';
import {
  Asset,
  ExtractedMaintenancePayload,
  MaintenanceRecord,
  RuleConfig,
} from '../types/nexora';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required before invoking server intelligence.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseJsonResponse<T>(res: Response, actionLabel: string): Promise<T> {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const rawBody = await res.text();
  const trimmed = rawBody.trim();

  const looksLikeHtml =
    contentType.includes('text/html') ||
    /^<!doctype\s+html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed);

  if (looksLikeHtml) {
    if (/Starting Server|warmup/i.test(trimmed) || [502, 503, 504].includes(res.status)) {
      throw new Error(
        `${actionLabel} temporarily interrupted: backend gateway returned an unavailability page (HTTP ${res.status}). Please retry in a few seconds.`
      );
    }
    if (res.status === 403 || /forbidden/i.test(trimmed)) {
      throw new Error(
        `${actionLabel} blocked by access proxy (HTTP ${res.status}). Refresh the page and verify your session.`
      );
    }
    throw new Error(
      `${actionLabel} received an HTML page instead of JSON (HTTP ${res.status}). Ensure the NEXORA backend API route is reachable.`
    );
  }

  if (!contentType.includes('application/json')) {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      // Fallback parse only if body clearly looks like JSON
    } else {
      throw new Error(
        `${actionLabel} expected JSON but received "${contentType || 'unknown content type'}" (HTTP ${res.status}).`
      );
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = trimmed ? (JSON.parse(trimmed) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      `${actionLabel} returned invalid JSON (HTTP ${res.status}). Please retry or inspect server logs.`
    );
  }

  if (!res.ok) {
    const serverError = typeof parsed?.error === 'string' ? parsed.error : '';
    throw new Error(serverError || `${actionLabel} failed (HTTP ${res.status}).`);
  }

  return parsed as T;
}

export async function extractDocumentViaAi(params: {
  fileBase64?: string;
  mimeType?: string;
  rawText?: string;
  fileName: string;
  sampleAssetPath?: string;
  knownAssets: Asset[];
}): Promise<ExtractedMaintenancePayload> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch('/api/ai/extract', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileBase64: params.fileBase64,
        mimeType: params.mimeType,
        rawText: params.rawText,
        fileName: params.fileName,
        sampleAssetPath: params.sampleAssetPath,
        knownAssets: params.knownAssets.map((a) => ({
          assetCode: a.assetCode,
          name: a.name,
          locationName: a.locationName,
          category: a.category,
          components: a.components,
        })),
      }),
    });
  } catch {
    throw new Error(
      'Unable to reach the NEXORA extraction server. Check your network connection and retry.'
    );
  }

  const data = await parseJsonResponse<{ extracted?: ExtractedMaintenancePayload }>(
    res,
    'AI document extraction'
  );
  if (!data.extracted) {
    throw new Error('Extraction response succeeded but did not include structured fields.');
  }
  return data.extracted;
}

export async function runRecurrenceEngineViaApi(params: {
  assets: Asset[];
  records: MaintenanceRecord[];
  rules: RuleConfig[];
  enrichWithAi: boolean;
}) {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch('/api/recurrence/analyze', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        assets: params.assets.map((a) => ({
          id: a.id,
          assetCode: a.assetCode,
          name: a.name,
          category: a.category,
          locationName: a.locationName,
        })),
        records: params.records.map((r) => ({
          id: r.id,
          recordCode: r.recordCode,
          assetId: r.assetId,
          assetCode: r.assetCode,
          assetName: r.assetName,
          locationName: r.locationName || '',
          incidentDate: r.incidentDate,
          category: r.category,
          recordType: r.recordType,
          title: r.title,
          description: r.description,
          symptoms: r.symptoms,
          repairAction: r.repairAction || '',
          componentInvolved: r.componentInvolved || '',
          technicianName: r.technicianName || '',
          status: r.status,
          sourceDocumentName: r.sourceDocumentName || '',
        })),
        rules: params.rules.map((rule) => ({
          code: rule.code,
          name: rule.name,
          description: rule.description || '',
          thresholdCount: rule.thresholdCount,
          windowDays: rule.windowDays,
          enabled: rule.enabled,
        })),
        enrichWithAi: params.enrichWithAi,
      }),
    });
  } catch {
    throw new Error('Unable to reach the NEXORA recurrence engine server.');
  }

  return parseJsonResponse<{
    findings: Array<{
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
    }>;
    evaluatedAt: string;
    aiEnrichedCount: number;
    aiWarning?: string;
  }>(res, 'Recurrence engine analysis');
}

export async function downloadCsvReportViaApi(params: {
  headers: string[];
  rows: Array<Array<string | number | boolean | null>>;
  filename: string;
}): Promise<void> {
  const authHeaders = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch('/api/export/csv', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(params),
    });
  } catch {
    throw new Error('Unable to reach the NEXORA CSV export endpoint.');
  }
  if (!res.ok) {
    await parseJsonResponse(res, 'CSV report export');
    throw new Error(`CSV export failed (HTTP ${res.status}).`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = params.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
