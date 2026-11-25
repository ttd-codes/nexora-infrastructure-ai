import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileAudio,
  FileText,
  Image as ImageIcon,
  Loader2,
  Upload,
} from 'lucide-react';
import { StatusText } from '../components/StatusText';
import { useWorkspace } from '../context/WorkspaceContext';
import { extractDocumentViaAi } from '../services/apiService';
import {
  createDocumentRecord,
  createMaintenanceRecord,
  createNotification,
} from '../services/firestoreService';
import {
  AssetCategory,
  DocumentFileType,
  ExtractedMaintenancePayload,
  RecordType,
} from '../types/nexora';

const SAMPLE_LOGBOOK_PATH = '/src/assets/images/sample_maintenance_log_1795607874096.jpg';

const CATEGORIES: AssetCategory[] = [
  'Water Supply',
  'Electrical',
  'Cooling Systems',
  'Mechanical',
  'Structural',
  'General Equipment',
];

const RECORD_TYPES: RecordType[] = ['Incident', 'Repair', 'Inspection', 'Preventive'];

type WorkflowStep = 'upload' | 'extracting' | 'review' | 'saved';

export function DataIntake() {
  const { user, assets, documents, openAssetDetail, pushToast } = useWorkspace();

  const [step, setStep] = useState<WorkflowStep>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<DocumentFileType>('text');
  const [mimeType, setMimeType] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [fileBase64, setFileBase64] = useState<string | undefined>(undefined);
  const [sampleAssetPath, setSampleAssetPath] = useState<string | undefined>(undefined);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [manualText, setManualText] = useState('');
  const [extractError, setExtractError] = useState<string | null>(null);

  // Editable extracted state
  const [extracted, setExtracted] = useState<ExtractedMaintenancePayload | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [issueCategory, setIssueCategory] = useState<AssetCategory>('Mechanical');
  const [recordType, setRecordType] = useState<RecordType>('Incident');
  const [title, setTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [symptomsText, setSymptomsText] = useState('');
  const [repairAction, setRepairAction] = useState('');
  const [componentInvolved, setComponentInvolved] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [uncertainConfirmed, setUncertainConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const populateReviewForm = (res: ExtractedMaintenancePayload) => {
    setExtracted(res);
    const matchedAsset =
      assets.find((a) => a.assetCode.toLowerCase() === (res.assetCode || '').toLowerCase()) ||
      assets.find((a) => (res.assetName || '').toLowerCase().includes(a.name.toLowerCase())) ||
      assets[0];
    setSelectedAssetId(matchedAsset?.id || '');
    setMaintenanceDate(res.maintenanceDate || new Date().toISOString().slice(0, 10));
    setIssueCategory(
      CATEGORIES.includes(res.issueCategory) ? res.issueCategory : matchedAsset?.category || 'General Equipment'
    );
    setRecordType(RECORD_TYPES.includes(res.recordType) ? res.recordType : 'Incident');
    setTitle(res.title || '');
    setIssueDescription(res.issueDescription || '');
    setSymptomsText((res.symptoms || []).join(', '));
    setRepairAction(res.repairAction || '');
    setComponentInvolved((res.componentsInvolved || [])[0] || '');
    setTechnicianName(res.technicianName || '');
    setUncertainConfirmed(false);
    setStep('review');
  };

  const runExtraction = async (params: {
    fName: string;
    fType: DocumentFileType;
    mType?: string;
    fSize?: number;
    base64?: string;
    rawTxt?: string;
    samplePath?: string;
    preview?: string;
  }) => {
    setExtractError(null);
    setFileName(params.fName);
    setFileType(params.fType);
    setMimeType(params.mType || '');
    setFileSize(params.fSize || 0);
    setFileBase64(params.base64);
    setSampleAssetPath(params.samplePath);
    setPreviewUrl(params.preview || '');
    setStep('extracting');

    try {
      const result = await extractDocumentViaAi({
        fileBase64: params.base64,
        mimeType: params.mType,
        rawText: params.rawTxt,
        fileName: params.fName,
        sampleAssetPath: params.samplePath,
        knownAssets: assets,
      });
      populateReviewForm(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI extraction failed.';
      setExtractError(msg);
      setStep('upload');
      pushToast({
        title: 'AI Extraction Error',
        detail: msg,
        tone: 'error',
      });
    }
  };

  const handleFileSelected = async (file: File) => {
    if (file.size > 12 * 1024 * 1024) {
      pushToast({
        title: 'File Too Large',
        detail: 'Maximum upload size is 12 MB.',
        tone: 'warning',
      });
      return;
    }

    const mime = file.type || 'text/plain';
    let detectedType: DocumentFileType = 'text';
    if (mime === 'application/pdf') detectedType = 'pdf';
    else if (mime.startsWith('image/')) detectedType = 'image';
    else if (mime.startsWith('audio/')) detectedType = 'audio';

    if (detectedType === 'text') {
      const txt = await file.text();
      await runExtraction({
        fName: file.name,
        fType: 'text',
        mType: 'text/plain',
        fSize: file.size,
        rawTxt: txt,
      });
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      const msg = 'Unable to read the selected file from disk.';
      setExtractError(msg);
      setStep('upload');
      pushToast({
        title: 'File Read Error',
        detail: msg,
        tone: 'error',
      });
    };
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1] || '';
      await runExtraction({
        fName: file.name,
        fType: detectedType,
        mType: mime,
        fSize: file.size,
        base64,
        preview: detectedType === 'image' ? dataUrl : '',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleManualExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;
    await runExtraction({
      fName: `Technician_Note_${new Date().toISOString().slice(0, 10)}.txt`,
      fType: 'manual',
      mType: 'text/plain',
      fSize: manualText.length,
      rawTxt: manualText.trim(),
    });
  };

  const handleSampleScan = async () => {
    await runExtraction({
      fName: 'BlockA_Handwritten_Register_Scan.jpg',
      fType: 'image',
      mType: 'image/jpeg',
      fSize: 482400,
      samplePath: SAMPLE_LOGBOOK_PATH,
      preview: SAMPLE_LOGBOOK_PATH,
    });
  };

  const handleSampleVoiceText = () => {
    setManualText(
      'Voice memo transcript from S. Nair on May 14, 2026: Checked AC-302 rooftop chiller in Computer Lab after afternoon thermal alarm. Condenser Fan Motor drawing 14.2 amps, bearing sounded dry. Replaced fan capacitor and scheduled coil wash.'
    );
  };

  const hasUncertainty = Boolean(
    extracted && (extracted.uncertainFields.length > 0 || extracted.confidence < 0.8)
  );

  const isFieldUncertain = (field: string) =>
    Boolean(extracted?.uncertainFields.some((u) => u.toLowerCase() === field.toLowerCase()));

  const handleConfirmAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !extracted) return;

    const targetAsset = assets.find((a) => a.id === selectedAssetId);
    if (!targetAsset) {
      pushToast({ title: 'Asset Required', detail: 'Select a target asset to connect this record.', tone: 'warning' });
      return;
    }

    if (hasUncertainty && !uncertainConfirmed) {
      pushToast({
        title: 'Verification Required',
        detail: 'Confirm uncertain fields before saving to Infrastructure Memory.',
        tone: 'warning',
      });
      return;
    }

    setSaving(true);
    try {
      const docId = await createDocumentRecord(user.uid, {
        fileName,
        fileType,
        mimeType,
        fileSize,
        assetId: targetAsset.id,
        assetCode: targetAsset.assetCode,
        extractionStatus: 'Confirmed',
        extractedSummary: title.trim() || issueDescription.slice(0, 180),
        rawTextSnippet: (extracted.rawTranscriptOrOcr || manualText || issueDescription).slice(0, 3800),
        previewUrl: sampleAssetPath || '',
        uncertainFields: extracted.uncertainFields,
        confirmedByUser: true,
        isDemoData: false,
      });

      const recCode = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
      await createMaintenanceRecord(user.uid, {
        recordCode: recCode,
        assetId: targetAsset.id,
        assetCode: targetAsset.assetCode,
        assetName: targetAsset.name,
        locationName: targetAsset.locationName,
        incidentDate: maintenanceDate,
        category: issueCategory,
        recordType,
        title: title.trim(),
        description: issueDescription.trim(),
        symptoms: symptomsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        repairAction: repairAction.trim(),
        componentInvolved: componentInvolved.trim(),
        technicianName: technicianName.trim(),
        status: repairAction.trim() ? 'Monitoring' : 'Open',
        inspectionStatus: 'Pending',
        sourceDocumentId: docId,
        sourceDocumentName: fileName,
        confidence: extracted.confidence,
        isDemoData: false,
      });

      await createNotification(user.uid, {
        title: `New Record Connected to ${targetAsset.assetCode}`,
        message: `${recCode} (${title.trim()}) extracted from ${fileName} and linked to Infrastructure Memory.`,
        severity: 'Info',
        assetId: targetAsset.id,
        recommendationId: '',
        read: false,
        isDemoData: false,
      });

      setStep('saved');
      pushToast({
        title: 'Infrastructure Memory Updated',
        detail: `Connected ${recCode} and source ${fileName} to ${targetAsset.assetCode}.`,
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Save Failed',
        detail: err instanceof Error ? err.message : 'Unable to save extracted record.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const sortedDocuments = useMemo(
    () => [...documents].reverse().slice(0, 8),
    [documents]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#F4F5F6] tracking-tight">
            Smart Data Intake
          </h1>
          <p className="text-sm text-[#9AA5B1] mt-1">
            Ingest PDFs, handwritten registers, equipment photos, audio voice notes, or text logs using Gemini multimodal extraction.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSampleScan}
            className="px-3.5 py-2 text-xs font-medium bg-[#1B2229] border border-[#F5B942]/40 hover:border-[#F5B942] text-[#F5B942] rounded-md transition-colors"
          >
            Extract Sample Handwritten Logbook
          </button>
          <button
            type="button"
            onClick={handleSampleVoiceText}
            className="px-3.5 py-2 text-xs font-medium bg-[#1B2229] border border-white/10 hover:border-[#55C6D9] text-[#55C6D9] rounded-md transition-colors"
          >
            Fill Sample Field Note
          </button>
        </div>
      </div>

      {/* Pipeline Progress */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'upload', label: '01. Source Upload' },
          { key: 'extracting', label: '02. Gemini Extraction' },
          { key: 'review', label: '03. Review & Validate' },
          { key: 'saved', label: '04. Connect to Memory' },
        ].map((item, idx) => {
          const order = ['upload', 'extracting', 'review', 'saved'];
          const activeIdx = order.indexOf(step);
          const reached = idx <= activeIdx;
          return (
            <div
              key={item.key}
              className={`px-4 py-2.5 rounded-md border text-xs font-medium transition-colors ${
                reached
                  ? 'bg-[#242C34] border-[#55C6D9]/60 text-[#F4F5F6]'
                  : 'bg-[#1B2229] border-white/10 text-[#9AA5B1]'
              }`}
            >
              {item.label}
            </div>
          );
        })}
      </div>

      {extractError && (
        <div className="bg-[#E05252]/10 border border-[#E05252]/40 rounded-lg p-4 flex items-start gap-3 text-xs text-[#F4F5F6]">
          <AlertTriangle className="w-4 h-4 text-[#E05252] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-[#E05252]">Extraction Failed</div>
            <p className="text-[#9AA5B1] mt-0.5">{extractError}</p>
          </div>
        </div>
      )}

      {/* Main Step Views */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-[#1B2229] border border-white/10 rounded-lg p-6 space-y-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFileSelected(f);
              }}
              className={`border-2 border-dashed rounded-lg p-10 text-center space-y-4 transition-colors ${
                dragOver
                  ? 'border-[#F5B942] bg-[#F5B942]/5'
                  : 'border-white/15 bg-[#101418]/60 hover:border-white/30'
              }`}
            >
              <Upload className="w-8 h-8 text-[#55C6D9] mx-auto" />
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-[#F4F5F6]">
                  Drop Maintenance Artifact Here
                </h2>
                <p className="text-xs text-[#9AA5B1]">
                  Supports PDF reports, scanned handwritten registers, equipment photos (JPG/PNG), technician voice notes (MP3/WAV/WEBM), or TXT logs (max 12 MB).
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium bg-[#F5B942] text-[#101418] rounded-md cursor-pointer hover:bg-[#f6c45f] transition-colors">
                <span>Browse Files</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.mp3,.wav,.webm,.m4a,.txt,.csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) handleFileSelected(f);
                  }}
                />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs text-[#9AA5B1]">
              <div className="bg-[#242C34]/60 border border-white/10 rounded p-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#F5B942] shrink-0" />
                <span>Handwritten OCR &amp; Photos</span>
              </div>
              <div className="bg-[#242C34]/60 border border-white/10 rounded p-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#55C6D9] shrink-0" />
                <span>PDF Service Reports</span>
              </div>
              <div className="bg-[#242C34]/60 border border-white/10 rounded p-3 flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-[#3DD68C] shrink-0" />
                <span>Audio Voice Notes</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#1B2229] border border-white/10 rounded-lg p-6">
            <form onSubmit={handleManualExtract} className="space-y-4 h-full flex flex-col justify-between">
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-[#F4F5F6]">
                  Manual Maintenance Note / SMS / Log Entry
                </h2>
                <p className="text-xs text-[#9AA5B1]">
                  Paste unstructured technician notes or message logs for structured AI extraction.
                </p>
                <textarea
                  rows={8}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Example: May 14 — Inspected P-104 Water Pump in Block A. Bearing housing still vibrating at 1500 RPM after April realignment. Technician: D. Adams."
                  className="w-full bg-[#101418] border border-white/10 rounded-md p-3 text-xs text-[#F4F5F6] placeholder-[#9AA5B1]/50 focus:outline-none focus:border-[#F5B942]"
                />
              </div>
              <button
                type="submit"
                disabled={!manualText.trim()}
                className="w-full py-2.5 px-4 text-xs font-semibold bg-[#55C6D9] text-[#101418] rounded-md hover:bg-[#6fd0e0] disabled:opacity-40 transition-colors"
              >
                Extract Structured Data via Gemini
              </button>
            </form>
          </div>
        </div>
      )}

      {step === 'extracting' && (
        <div className="bg-[#1B2229] border border-white/10 rounded-lg p-12 text-center space-y-4">
          <Loader2 className="w-8 h-8 text-[#F5B942] animate-spin mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[#F4F5F6]">
              Analyzing Artifact with Gemini Multimodal AI
            </h2>
            <p className="text-xs text-[#9AA5B1] font-mono">
              {fileName} · Parsing equipment identifiers, symptoms, repair actions, and confidence scores...
            </p>
          </div>
        </div>
      )}

      {step === 'review' && extracted && (
        <form onSubmit={handleConfirmAndSave} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Source Preview & Raw OCR */}
          <div className="lg:col-span-5 bg-[#1B2229] border border-white/10 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F4F5F6]">Source Traceability</h2>
              <span className="font-mono text-xs text-[#55C6D9] tabular-nums">
                Confidence: {Math.round(extracted.confidence * 100)}%
              </span>
            </div>
            <div className="text-xs text-[#9AA5B1] font-mono break-all">{fileName}</div>
            {(sampleAssetPath || previewUrl) && (
              <img
                src={sampleAssetPath || previewUrl}
                alt="Uploaded maintenance artifact preview"
                referrerPolicy="no-referrer"
                className="w-full max-h-72 object-contain bg-[#101418] border border-white/10 rounded"
              />
            )}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-[#9AA5B1]">
                Extracted OCR / Verbatim Transcript
              </div>
              <div className="bg-[#101418] border border-white/10 rounded p-3 text-xs font-mono text-[#F4F5F6] max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {extracted.rawTranscriptOrOcr || 'No verbatim transcript returned.'}
              </div>
            </div>
          </div>

          {/* Right Editable Validation Form */}
          <div className="lg:col-span-7 bg-[#1B2229] border border-white/10 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#F4F5F6]">
                Review &amp; Validate Extracted Fields
              </h2>
              {extracted.uncertainFields.length > 0 && (
                <span className="text-xs font-medium text-[#F5B942]">
                  {extracted.uncertainFields.length} uncertain field(s) highlighted
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#9AA5B1] mb-1">
                  Target Registered Asset * {isFieldUncertain('assetCode') && '· Uncertain'}
                </label>
                <select
                  required
                  value={selectedAssetId}
                  onChange={(e) => setSelectedAssetId(e.target.value)}
                  className={`w-full bg-[#101418] border rounded px-3 py-2 text-xs text-[#F4F5F6] ${
                    isFieldUncertain('assetCode') ? 'border-[#F5B942]' : 'border-white/10'
                  }`}
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetCode} — {a.name} ({a.locationName.split('—')[0].trim()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#9AA5B1] mb-1">
                  Maintenance Date * {isFieldUncertain('maintenanceDate') && '· Uncertain'}
                </label>
                <input
                  required
                  type="date"
                  value={maintenanceDate}
                  onChange={(e) => setMaintenanceDate(e.target.value)}
                  className={`w-full bg-[#101418] border rounded px-3 py-2 text-xs font-mono text-[#F4F5F6] ${
                    isFieldUncertain('maintenanceDate') ? 'border-[#F5B942]' : 'border-white/10'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs text-[#9AA5B1] mb-1">Issue Category</label>
                <select
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value as AssetCategory)}
                  className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
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

              <div className="sm:col-span-2">
                <label className="block text-xs text-[#9AA5B1] mb-1">Issue Title *</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full bg-[#101418] border rounded px-3 py-2 text-xs text-[#F4F5F6] ${
                    isFieldUncertain('title') ? 'border-[#F5B942]' : 'border-white/10'
                  }`}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-[#9AA5B1] mb-1">Issue Description *</label>
                <textarea
                  required
                  rows={3}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className={`w-full bg-[#101418] border rounded px-3 py-2 text-xs text-[#F4F5F6] ${
                    isFieldUncertain('issueDescription') ? 'border-[#F5B942]' : 'border-white/10'
                  }`}
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
                <label className="block text-xs text-[#9AA5B1] mb-1">Component Involved</label>
                <input
                  value={componentInvolved}
                  onChange={(e) => setComponentInvolved(e.target.value)}
                  className="w-full bg-[#101418] border border-white/10 rounded px-3 py-2 text-xs text-[#F4F5F6]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#9AA5B1] mb-1">
                  Repair Action {isFieldUncertain('repairAction') && '· Uncertain'}
                </label>
                <input
                  value={repairAction}
                  onChange={(e) => setRepairAction(e.target.value)}
                  className={`w-full bg-[#101418] border rounded px-3 py-2 text-xs text-[#F4F5F6] ${
                    isFieldUncertain('repairAction') ? 'border-[#F5B942]' : 'border-white/10'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs text-[#9AA5B1] mb-1">
                  Technician {isFieldUncertain('technicianName') && '· Uncertain'}
                </label>
                <input
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className={`w-full bg-[#101418] border rounded px-3 py-2 text-xs text-[#F4F5F6] ${
                    isFieldUncertain('technicianName') ? 'border-[#F5B942]' : 'border-white/10'
                  }`}
                />
              </div>
            </div>

            {hasUncertainty && (
              <label className="flex items-start gap-2.5 p-3 bg-[#F5B942]/10 border border-[#F5B942]/40 rounded text-xs text-[#F4F5F6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={uncertainConfirmed}
                  onChange={(e) => setUncertainConfirmed(e.target.checked)}
                  className="accent-[#F5B942] mt-0.5"
                />
                <span>
                  I have reviewed the highlighted uncertain fields and confirm this record is accurate before committing to Infrastructure Memory.
                </span>
              </label>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-xs text-[#9AA5B1] bg-[#242C34] rounded-md"
              >
                Discard &amp; Re-upload
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-[#F5B942] text-[#101418] rounded-md hover:bg-[#f6c45f] disabled:opacity-50"
              >
                {saving ? 'Saving to Memory...' : 'Save & Connect to Asset'}
              </button>
            </div>
          </div>
        </form>
      )}

      {step === 'saved' && (
        <div className="bg-[#1B2229] border border-[#3DD68C]/40 rounded-lg p-8 text-center space-y-4">
          <CheckCircle2 className="w-8 h-8 text-[#3DD68C] mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-[#F4F5F6]">
              Record Validated &amp; Connected to Infrastructure Memory
            </h2>
            <p className="text-xs text-[#9AA5B1]">
              Source artifact <span className="font-mono text-[#F4F5F6]">{fileName}</span> and its structured maintenance entry are now persisted in Firestore and linked in the Memory Graph.
            </p>
          </div>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setManualText('');
                setStep('upload');
              }}
              className="px-4 py-2 text-xs font-medium bg-[#242C34] text-[#F4F5F6] rounded-md"
            >
              Ingest Another Document
            </button>
            {selectedAssetId && (
              <button
                type="button"
                onClick={() => openAssetDetail(selectedAssetId)}
                className="px-4 py-2 text-xs font-semibold bg-[#F5B942] text-[#101418] rounded-md"
              >
                View Connected Asset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Source Document Archive */}
      <div className="bg-[#1B2229] border border-white/10 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#F4F5F6]">Ingested Source Document Archive</h2>
          <span className="font-mono text-xs text-[#9AA5B1] tabular-nums">
            {documents.length} artifact(s)
          </span>
        </div>
        <div className="divide-y divide-white/10">
          {sortedDocuments.map((d) => (
            <div key={d.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-[#55C6D9] uppercase">{d.fileType}</span>
                  <span className="text-[#9AA5B1]" aria-hidden="true">·</span>
                  <span className="font-mono text-[#F4F5F6] truncate">{d.fileName}</span>
                  {d.assetCode && (
                    <>
                      <span className="text-[#9AA5B1]" aria-hidden="true">·</span>
                      <span className="font-mono text-[#F5B942]">{d.assetCode}</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-[#9AA5B1] truncate">{d.extractedSummary}</p>
              </div>
              <StatusText status={d.extractionStatus} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
