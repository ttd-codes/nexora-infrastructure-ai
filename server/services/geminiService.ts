import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';

class ServiceHttpError extends Error {
  statusCode: number;
  code: string;
  upstreamStatus?: number;
  retryable?: boolean;

  constructor(
    message: string,
    options: { statusCode: number; code: string; upstreamStatus?: number; retryable?: boolean }
  ) {
    super(message);
    this.name = 'ServiceHttpError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.upstreamStatus = options.upstreamStatus;
    this.retryable = options.retryable;
  }
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ServiceHttpError(
      'Server Gemini API key is not configured. Configure GEMINI_API_KEY in environment secrets.',
      { statusCode: 500, code: 'GEMINI_KEY_MISSING', retryable: false }
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseGeminiErrorDetails(error: unknown): {
  upstreamStatus?: number;
  message: string;
  apiStatus?: string;
} {
  const rawErr = error as { status?: number; statusCode?: number; message?: string };
  let upstreamStatus = typeof rawErr?.status === 'number' ? rawErr.status : rawErr?.statusCode;
  let message = rawErr?.message || 'Gemini AI request failed.';
  let apiStatus: string | undefined;

  if (typeof message === 'string' && message.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(message) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (parsed?.error) {
        if (typeof parsed.error.code === 'number') upstreamStatus = parsed.error.code;
        if (typeof parsed.error.message === 'string') message = parsed.error.message;
        if (typeof parsed.error.status === 'string') apiStatus = parsed.error.status;
      }
    } catch {
      // Keep original message if not valid JSON
    }
  }

  return { upstreamStatus, message, apiStatus };
}

function isTransientGeminiError(error: unknown): boolean {
  const { upstreamStatus, message, apiStatus } = parseGeminiErrorDetails(error);
  if (upstreamStatus === 429 || upstreamStatus === 500 || upstreamStatus === 502 || upstreamStatus === 503 || upstreamStatus === 504) {
    return true;
  }
  if (apiStatus === 'UNAVAILABLE' || apiStatus === 'RESOURCE_EXHAUSTED') {
    return true;
  }
  return /high demand|temporarily unavailable|ECONNRESET|ETIMEDOUT|fetch failed/i.test(message);
}

function normalizeGeminiHttpError(error: unknown): ServiceHttpError {
  if (error instanceof ServiceHttpError) return error;
  const { upstreamStatus, message, apiStatus } = parseGeminiErrorDetails(error);

  if (upstreamStatus === 429 || apiStatus === 'RESOURCE_EXHAUSTED') {
    return new ServiceHttpError(
      `Gemini AI rate limit or quota reached: ${message}`,
      { statusCode: 429, code: 'GEMINI_RATE_LIMITED', upstreamStatus, retryable: true }
    );
  }

  if (upstreamStatus === 400 || apiStatus === 'INVALID_ARGUMENT') {
    return new ServiceHttpError(
      `Invalid extraction request for Gemini AI: ${message}`,
      { statusCode: 400, code: 'GEMINI_INVALID_REQUEST', upstreamStatus, retryable: false }
    );
  }

  if (upstreamStatus === 401 || upstreamStatus === 403 || apiStatus === 'PERMISSION_DENIED') {
    return new ServiceHttpError(
      `Gemini API authentication failed on server: ${message}`,
      { statusCode: 500, code: 'GEMINI_AUTH_ERROR', upstreamStatus, retryable: false }
    );
  }

  // Note: Map upstream 502/503/504 to HTTP 500 so reverse proxies with
  // proxy_intercept_errors on 502/503/504 do not replace our JSON error with HTML.
  return new ServiceHttpError(
    upstreamStatus === 503 || apiStatus === 'UNAVAILABLE'
      ? `Gemini AI service is temporarily experiencing high demand (${message}). Please try again in a few moments.`
      : `Gemini AI processing failed: ${message}`,
    {
      statusCode: 500,
      code: upstreamStatus === 503 ? 'GEMINI_TEMPORARILY_UNAVAILABLE' : 'GEMINI_UPSTREAM_ERROR',
      upstreamStatus,
      retryable: isTransientGeminiError(error),
    }
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(
  ai: GoogleGenAI,
  models: string[],
  buildParams: (model: string) => Parameters<GoogleGenAI['models']['generateContent']>[0]
) {
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await ai.models.generateContent(buildParams(model));
      } catch (err) {
        lastError = err;
        if (!isTransientGeminiError(err)) {
          throw normalizeGeminiHttpError(err);
        }
        if (attempt === 0) {
          await sleep(700 + Math.floor(Math.random() * 400));
        }
      }
    }
  }
  throw normalizeGeminiHttpError(lastError);
}

function parseModelJson<T>(rawText: string | undefined, contextLabel: string): T {
  const cleaned = (rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    throw new ServiceHttpError(`${contextLabel} returned an empty response.`, {
      statusCode: 500,
      code: 'GEMINI_EMPTY_RESPONSE',
      retryable: true,
    });
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new ServiceHttpError(`${contextLabel} returned malformed structured JSON.`, {
      statusCode: 500,
      code: 'GEMINI_MALFORMED_JSON',
      retryable: true,
    });
  }
}

export interface KnownAssetHint {
  assetCode: string;
  name: string;
  locationName: string;
  category: string;
  components: string[];
}

export interface ExtractInput {
  fileBase64?: string;
  mimeType?: string;
  rawText?: string;
  fileName: string;
  sampleAssetPath?: string;
  knownAssets: KnownAssetHint[];
}

const ALLOWLISTED_SAMPLE_IMAGE = '/src/assets/images/sample_maintenance_log_1795607874096.jpg';

const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    assetCode: {
      type: Type.STRING,
      description: 'Asset identifier code such as P-104, G-201, AC-302, E-401, EP-501, or UNKNOWN if not found.',
    },
    assetName: {
      type: Type.STRING,
      description: 'Human-readable name of the infrastructure asset.',
    },
    maintenanceDate: {
      type: Type.STRING,
      description: 'ISO date YYYY-MM-DD of the most relevant or latest maintenance incident in the source. If year is missing, infer from document header or use 2026.',
    },
    issueCategory: {
      type: Type.STRING,
      description: 'Must be one of: Mechanical, Electrical, Water Supply, Cooling Systems, Structural, General Equipment.',
    },
    recordType: {
      type: Type.STRING,
      description: 'Must be one of: Incident, Repair, Inspection, Preventive.',
    },
    title: {
      type: Type.STRING,
      description: 'Concise factual title summarizing the reported issue or maintenance event.',
    },
    issueDescription: {
      type: Type.STRING,
      description: 'Detailed factual description extracted from the source without inventing unstated causes.',
    },
    symptoms: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of observed physical symptoms (e.g., Excessive vibration, Unusual grinding noise).',
    },
    repairAction: {
      type: Type.STRING,
      description: 'Specific repair or inspection action performed, or empty string if none recorded.',
    },
    componentsInvolved: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Physical components mentioned (e.g., Drive Bearing, Shaft Coupling, AVR Module).',
    },
    technicianName: {
      type: Type.STRING,
      description: 'Technician name or initials if stated, or empty string if absent.',
    },
    documentSource: {
      type: Type.STRING,
      description: 'Type of source document (e.g., Handwritten Logbook, PDF Report, Voice Note, Field Photo).',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'Overall extraction confidence between 0.0 and 1.0.',
    },
    uncertainFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Field names where handwriting, audio clarity, or ambiguity caused uncertainty (e.g., maintenanceDate, technicianName, assetCode).',
    },
    rawTranscriptOrOcr: {
      type: Type.STRING,
      description: 'Verbatim OCR text or transcript extracted from the document.',
    },
  },
  required: [
    'assetCode',
    'assetName',
    'maintenanceDate',
    'issueCategory',
    'recordType',
    'title',
    'issueDescription',
    'symptoms',
    'repairAction',
    'componentsInvolved',
    'technicianName',
    'documentSource',
    'confidence',
    'uncertainFields',
    'rawTranscriptOrOcr',
  ],
};

export async function extractMaintenanceDocument(input: ExtractInput) {
  const ai = getAiClient();
  let fileBase64 = input.fileBase64;
  let mimeType = input.mimeType;
  let transcriptText = input.rawText?.trim() || '';

  // Safely load allowlisted sample logbook image if requested
  if (input.sampleAssetPath) {
    if (input.sampleAssetPath !== ALLOWLISTED_SAMPLE_IMAGE) {
      throw new ServiceHttpError('Invalid sample document path.', {
        statusCode: 400,
        code: 'INVALID_SAMPLE_PATH',
      });
    }
    const baseDir = path.resolve(process.cwd(), 'src', 'assets', 'images');
    const targetPath = path.resolve(process.cwd(), input.sampleAssetPath.replace(/^\//, ''));
    if (!targetPath.startsWith(baseDir + path.sep) || !fs.existsSync(targetPath)) {
      throw new ServiceHttpError('Sample document asset not found on server.', {
        statusCode: 404,
        code: 'SAMPLE_ASSET_NOT_FOUND',
      });
    }
    fileBase64 = fs.readFileSync(targetPath).toString('base64');
    mimeType = 'image/jpeg';
  }

  // Step 1: Audio files use gemini-3.5-transcribe first for accurate verbatim speech-to-text
  if (fileBase64 && mimeType && mimeType.startsWith('audio/')) {
    const audioResponse = await generateWithRetry(ai, ['gemini-3.5-transcribe'], (model) => ({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: fileBase64,
            },
          },
          {
            text: 'Transcribe this technician maintenance voice note verbatim, preserving asset IDs, dates, symptoms, component names, and technician names.',
          },
        ],
      },
    }));
    transcriptText = (audioResponse.text || '').trim();
    if (!transcriptText) {
      throw new ServiceHttpError('Audio transcription returned empty content.', {
        statusCode: 422,
        code: 'EMPTY_TRANSCRIPTION',
      });
    }
  }

  const assetContext = input.knownAssets
    .map(
      (a) =>
        `- ${a.assetCode}: ${a.name} (${a.category}, Location: ${a.locationName}, Components: ${a.components.join(', ')})`
    )
    .join('\n');

  const extractionPrompt = `You are NEXORA's structured infrastructure maintenance extraction engine.
Analyze the provided maintenance artifact (${input.fileName}) and extract structured maintenance data.

Known registered campus assets for matching assistance:
${assetContext || 'None registered yet.'}

Strict rules:
1. Extract ONLY facts observable in the artifact. Never fabricate technician names, dates, or repairs not present.
2. If multiple log entries appear on a single handwritten page, extract the primary/most recent entry in the structured fields and preserve ALL entries verbatim in rawTranscriptOrOcr.
3. Flag any field that is missing, illegible, or ambiguous in uncertainFields (use exact keys: assetCode, assetName, maintenanceDate, issueCategory, title, issueDescription, repairAction, technicianName).
4. issueCategory MUST be one of: Mechanical, Electrical, Water Supply, Cooling Systems, Structural, General Equipment.
5. recordType MUST be one of: Incident, Repair, Inspection, Preventive.`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  if (fileBase64 && mimeType && !mimeType.startsWith('audio/')) {
    parts.push({
      inlineData: {
        mimeType,
        data: fileBase64,
      },
    });
  }

  if (transcriptText) {
    parts.push({
      text: `${extractionPrompt}\n\nSource text / transcript:\n${transcriptText}`,
    });
  } else {
    parts.push({ text: extractionPrompt });
  }

  const response = await generateWithRetry(
    ai,
    ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
    (model) => ({
      model,
      contents: { parts },
      config: {
        systemInstruction:
          'Extract factual maintenance fields strictly from the provided source. Maintain conservative confidence scoring and flag uncertain fields.',
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
      },
    })
  );

  const parsed = parseModelJson<Record<string, unknown>>(response.text, 'Gemini extraction');
  const rawConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.7;

  return {
    assetCode: typeof parsed.assetCode === 'string' ? parsed.assetCode : 'UNKNOWN',
    assetName: typeof parsed.assetName === 'string' ? parsed.assetName : '',
    maintenanceDate: typeof parsed.maintenanceDate === 'string' ? parsed.maintenanceDate : '',
    issueCategory: typeof parsed.issueCategory === 'string' ? parsed.issueCategory : 'General Equipment',
    recordType: typeof parsed.recordType === 'string' ? parsed.recordType : 'Incident',
    title: typeof parsed.title === 'string' ? parsed.title : '',
    issueDescription: typeof parsed.issueDescription === 'string' ? parsed.issueDescription : '',
    symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms.map(String) : [],
    repairAction: typeof parsed.repairAction === 'string' ? parsed.repairAction : '',
    componentsInvolved: Array.isArray(parsed.componentsInvolved) ? parsed.componentsInvolved.map(String) : [],
    technicianName: typeof parsed.technicianName === 'string' ? parsed.technicianName : '',
    documentSource: typeof parsed.documentSource === 'string' ? parsed.documentSource : '',
    confidence: Math.min(1, Math.max(0, rawConfidence)),
    uncertainFields: Array.isArray(parsed.uncertainFields) ? parsed.uncertainFields.map(String) : [],
    rawTranscriptOrOcr:
      typeof parsed.rawTranscriptOrOcr === 'string' ? parsed.rawTranscriptOrOcr : transcriptText,
  };
}

export interface SynthesisInput {
  assetCode: string;
  assetName: string;
  ruleName: string;
  records: Array<{
    recordCode: string;
    incidentDate: string;
    title: string;
    description: string;
    symptoms: string[];
    repairAction?: string;
    componentInvolved?: string;
  }>;
}

const SYNTHESIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    interpretation: {
      type: Type.STRING,
      description: 'Transparent, evidence-bounded interpretation explaining why the pattern matters without claiming a confirmed unverified fault or predicting failure dates.',
    },
    missingInformation: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Specific engineering measurements or logs missing from the historical records.',
    },
    suggestedActions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Concrete inspection and verification actions grounded in the historical records.',
    },
  },
  required: ['interpretation', 'missingInformation', 'suggestedActions'],
};

export async function synthesizeInvestigationNarrative(input: SynthesisInput) {
  const ai = getAiClient();
  const prompt = `Asset: ${input.assetCode} — ${input.assetName}
Triggered Rule: ${input.ruleName}

Historical Records:
${input.records
  .map(
    (r) =>
      `[${r.recordCode} | ${r.incidentDate}] ${r.title}\nDescription: ${r.description}\nSymptoms: ${r.symptoms.join(', ') || 'None recorded'}\nRepair Action: ${r.repairAction || 'None recorded'}\nComponent: ${r.componentInvolved || 'Unspecified'}`
  )
  .join('\n\n')}

Provide:
1. A cautious, transparent interpretation (never claim a component is confirmed defective unless explicitly verified in records; never predict exact failure dates or invent probabilities).
2. Missing information needed for a thorough inspection.
3. Concrete suggested inspection actions referencing the historical records.`;

  const response = await generateWithRetry(
    ai,
    ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
    (model) => ({
      model,
      contents: prompt,
      config: {
        systemInstruction:
          'You are NEXORA engineering intelligence. Never fabricate evidence, never claim confirmed root causes beyond the records, and never generate predictive failure dates or probabilities.',
        responseMimeType: 'application/json',
        responseSchema: SYNTHESIS_SCHEMA,
      },
    })
  );

  return parseModelJson<{
    interpretation?: string;
    missingInformation?: string[];
    suggestedActions?: string[];
  }>(response.text, 'Gemini synthesis');
}
