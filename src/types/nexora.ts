export type AssetCategory =
  | 'Mechanical'
  | 'Electrical'
  | 'Water Supply'
  | 'Cooling Systems'
  | 'Structural'
  | 'General Equipment';

export type AssetStatus =
  | 'Operational'
  | 'Attention Required'
  | 'Under Maintenance'
  | 'Offline';

export type RecordType = 'Incident' | 'Repair' | 'Inspection' | 'Preventive';
export type RecordStatus = 'Open' | 'In Progress' | 'Resolved' | 'Monitoring';
export type InspectionStatus = 'Pending' | 'Scheduled' | 'Completed';
export type DocumentFileType = 'pdf' | 'image' | 'audio' | 'text' | 'manual';
export type ExtractionStatus = 'Processed' | 'Needs Review' | 'Confirmed' | 'Failed';
export type RecommendationSeverity = 'High' | 'Medium' | 'Low';
export type RecommendationStatus = 'Active' | 'Inspection Scheduled' | 'Reviewed' | 'Dismissed';
export type UserRole = 'admin' | 'engineer' | 'technician' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  organizationName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CampusLocation {
  id: string;
  name: string;
  buildingCode: string;
  facilityType?: string;
  zoneDescription?: string;
  isDemoData: boolean;
  ownerUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: AssetCategory;
  locationId: string;
  locationName: string;
  installDate?: string;
  manufacturer?: string;
  modelNumber?: string;
  status: AssetStatus;
  description?: string;
  components: string[];
  imageUrl?: string;
  isDemoData: boolean;
  ownerUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MaintenanceRecord {
  id: string;
  recordCode: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  locationName?: string;
  incidentDate: string; // YYYY-MM-DD
  category: AssetCategory;
  recordType: RecordType;
  title: string;
  description: string;
  symptoms: string[];
  repairAction?: string;
  componentInvolved?: string;
  technicianName?: string;
  status: RecordStatus;
  inspectionStatus: InspectionStatus;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  confidence?: number;
  isDemoData: boolean;
  ownerUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DocumentRecord {
  id: string;
  fileName: string;
  fileType: DocumentFileType;
  mimeType?: string;
  fileSize?: number;
  assetId?: string;
  assetCode?: string;
  extractionStatus: ExtractionStatus;
  extractedSummary?: string;
  rawTextSnippet?: string;
  previewUrl?: string;
  uncertainFields: string[];
  confirmedByUser: boolean;
  isDemoData: boolean;
  ownerUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Recommendation {
  id: string;
  title: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  ruleTriggered: string;
  ruleDescription?: string;
  severity: RecommendationSeverity;
  observedFacts: string[];
  interpretation: string;
  missingInformation: string[];
  suggestedActions: string[];
  supportingRecordIds: string[];
  contradictoryRecordIds: string[];
  evidenceCompleteness: number;
  status: RecommendationStatus;
  isDemoData: boolean;
  ownerUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: 'High' | 'Medium' | 'Info';
  assetId?: string;
  recommendationId?: string;
  read: boolean;
  isDemoData: boolean;
  ownerUid: string;
  createdAt?: unknown;
}

export interface RuleConfig {
  id: string;
  code: string;
  name: string;
  description?: string;
  thresholdCount: number;
  windowDays: number;
  enabled: boolean;
  ownerUid: string;
  updatedAt?: unknown;
}

export interface ExtractedMaintenancePayload {
  assetCode: string;
  assetName: string;
  maintenanceDate: string;
  issueCategory: AssetCategory;
  recordType: RecordType;
  title: string;
  issueDescription: string;
  symptoms: string[];
  repairAction: string;
  componentsInvolved: string[];
  technicianName: string;
  documentSource: string;
  confidence: number;
  uncertainFields: string[];
  rawTranscriptOrOcr: string;
}

export type ActiveModule =
  | 'command-center'
  | 'assets'
  | 'memory-graph'
  | 'investigation-center'
  | 'data-intake'
  | 'maintenance'
  | 'reports';
