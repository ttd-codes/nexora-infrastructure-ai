import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import {
  extractMaintenanceDocument,
  synthesizeInvestigationNarrative,
} from '../services/geminiService.ts';
import { runRecurrenceAnalysis } from '../services/recurrenceEngine.ts';

export const apiRouter = Router();

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/pdf',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
  'text/plain',
  'text/csv',
]);

const extractSchema = z.object({
  fileBase64: z.string().max(18_000_000).optional(),
  mimeType: z.string().max(120).optional(),
  rawText: z.string().max(40_000).optional(),
  fileName: z.string().min(1).max(200),
  sampleAssetPath: z.string().max(300).optional(),
  knownAssets: z
    .array(
      z.object({
        assetCode: z.string().max(40),
        name: z.string().max(140),
        locationName: z.string().max(120),
        category: z.string().max(60),
        components: z.array(z.string().max(120)).max(25),
      })
    )
    .max(100)
    .default([]),
});

const analyzeSchema = z.object({
  assets: z
    .array(
      z.object({
        id: z.string().max(128),
        assetCode: z.string().max(40),
        name: z.string().max(140),
        category: z.string().max(60),
        locationName: z.string().max(120),
      })
    )
    .max(200),
  records: z
    .array(
      z.object({
        id: z.string().max(128),
        recordCode: z.string().max(40),
        assetId: z.string().max(128),
        assetCode: z.string().max(40),
        assetName: z.string().max(140),
        locationName: z.string().max(120).optional(),
        incidentDate: z.string().max(32),
        category: z.string().max(60),
        recordType: z.string().max(40),
        title: z.string().max(200),
        description: z.string().max(3000),
        symptoms: z.array(z.string().max(200)).max(15),
        repairAction: z.string().max(2000).optional(),
        componentInvolved: z.string().max(120).optional(),
        technicianName: z.string().max(120).optional(),
        status: z.string().max(40),
        sourceDocumentName: z.string().max(200).optional(),
      })
    )
    .max(500),
  rules: z
    .array(
      z.object({
        code: z.string().max(32),
        name: z.string().max(160),
        description: z.string().max(600).optional(),
        thresholdCount: z.number().min(1).max(20),
        windowDays: z.number().min(7).max(730),
        enabled: z.boolean(),
      })
    )
    .max(20),
  enrichWithAi: z.boolean().optional().default(false),
});

const csvExportSchema = z.object({
  headers: z.array(z.string().max(100)).min(1).max(30),
  rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))).max(5000),
  filename: z.string().max(120).optional(),
});

function sanitizeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }
  return formulaSafe;
}

apiRouter.get('/health', (_req, res: Response) => {
  res.json({
    status: 'ok',
    service: 'NEXORA Infrastructure Memory API',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get('/docs', (_req, res: Response) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'NEXORA Infrastructure Memory & Intelligence API',
      version: '1.0.0',
      description:
        'REST API for multimodal maintenance intake, transparent recurrence detection, AI investigation synthesis, and evidence-backed reporting.',
    },
    paths: {
      '/api/health': { get: { summary: 'Service liveness check' } },
      '/api/docs': { get: { summary: 'OpenAPI 3.0 specification' } },
      '/api/ai/extract': {
        post: {
          summary: 'Extract structured maintenance JSON from PDF, image, audio, or text using Gemini',
          security: [{ BearerAuth: [] }],
        },
      },
      '/api/recurrence/analyze': {
        post: {
          summary: 'Execute deterministic recurrence rules and optional Gemini investigation synthesis',
          security: [{ BearerAuth: [] }],
        },
      },
      '/api/export/csv': {
        post: {
          summary: 'Generate formula-safe RFC-4180 CSV maintenance report',
          security: [{ BearerAuth: [] }],
        },
      },
    },
  });
});

apiRouter.post('/ai/extract', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = extractSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid extraction payload.', details: parsed.error.flatten() });
    return;
  }

  const { fileBase64, mimeType, rawText, fileName, sampleAssetPath, knownAssets } = parsed.data;

  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    res.status(415).json({ error: `Unsupported file MIME type: ${mimeType}` });
    return;
  }

  if (!fileBase64 && !rawText?.trim() && !sampleAssetPath) {
    res.status(400).json({ error: 'Provide a file, raw text note, or sample document reference.' });
    return;
  }

  try {
    const extracted = await extractMaintenanceDocument({
      fileBase64,
      mimeType,
      rawText,
      fileName,
      sampleAssetPath,
      knownAssets,
    });
    res.json({ extracted });
  } catch (error) {
    const err = error as Error & {
      statusCode?: number;
      code?: string;
      upstreamStatus?: number;
      retryable?: boolean;
    };
    const rawStatus = err.statusCode || 500;
    // Avoid 502/503/504/403 so reverse-proxy error_page rules never swap JSON for HTML.
    const status = [403, 502, 503, 504].includes(rawStatus) ? 500 : rawStatus;
    console.error('AI extraction error:', err);
    res.status(status).json({
      error: err.message || 'AI extraction failed.',
      code: err.code || 'AI_EXTRACTION_FAILED',
      upstreamStatus: err.upstreamStatus,
      retryable: Boolean(err.retryable),
    });
  }
});

apiRouter.post('/recurrence/analyze', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid recurrence analysis payload.', details: parsed.error.flatten() });
    return;
  }

  const { assets, records, rules, enrichWithAi } = parsed.data;
  const findings = runRecurrenceAnalysis(assets, records, rules);

  let aiEnrichedCount = 0;
  let aiWarning: string | undefined;

  if (enrichWithAi && findings.length > 0) {
    try {
      const topFindings = findings.slice(0, 3);
      await Promise.all(
        topFindings.map(async (finding) => {
          const supporting = records.filter((r) => finding.supportingRecordIds.includes(r.id));
          if (supporting.length === 0) return;
          const narrative = await synthesizeInvestigationNarrative({
            assetCode: finding.assetCode,
            assetName: finding.assetName,
            ruleName: finding.ruleTriggered,
            records: supporting,
          });
          if (narrative?.interpretation) finding.interpretation = narrative.interpretation;
          if (Array.isArray(narrative?.missingInformation) && narrative.missingInformation.length > 0) {
            finding.missingInformation = narrative.missingInformation;
          }
          if (Array.isArray(narrative?.suggestedActions) && narrative.suggestedActions.length > 0) {
            finding.suggestedActions = narrative.suggestedActions;
          }
          aiEnrichedCount += 1;
        })
      );
    } catch (error) {
      const err = error as Error;
      aiWarning = err.message || 'Gemini synthesis unavailable; deterministic rule findings returned.';
    }
  }

  res.json({
    findings,
    evaluatedAt: new Date().toISOString(),
    aiEnrichedCount,
    aiWarning,
  });
});

apiRouter.post('/export/csv', requireAuth, (req: AuthRequest, res: Response) => {
  const parsed = csvExportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid CSV export payload.' });
    return;
  }

  const { headers, rows, filename } = parsed.data;
  const lines = [
    headers.map(sanitizeCsvCell).join(','),
    ...rows.map((row) => row.map(sanitizeCsvCell).join(',')),
  ];
  const csvContent = lines.join('\r\n');
  const safeName = (filename || 'nexora-report.csv').replace(/[^a-zA-Z0-9_.\-]/g, '_');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.send(csvContent);
});

apiRouter.use((req: Request, res: Response) => {
  res.status(404).json({
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    code: 'API_ROUTE_NOT_FOUND',
  });
});

apiRouter.use(
  (
    err: Error & { status?: number; statusCode?: number; code?: string },
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    const rawStatus = err.statusCode || err.status || 500;
    const status = [403, 502, 503, 504].includes(rawStatus) ? 500 : rawStatus;
    console.error('API router error:', err);
    res.status(status).json({
      error: err.message || 'Unexpected backend API error.',
      code: err.code || 'API_INTERNAL_ERROR',
    });
  }
);
