export enum CodingStatus {
  Idle = 'IDLE',
  Mapping = 'MAPPING',
  Processing = 'PROCESSING',
  Review = 'REVIEW'
}

export interface RawDataRow {
  id: string;
  [key: string]: any;
}

export interface CodedResult {
  code: string;
  label: string;
  confidence: string; // 'High' | 'Medium' | 'Low' | 'Manual'
  reasoning?: string;
}

export interface SearchResult {
  code: string;
  label: string;
  description: string;
}

export interface ProcessedRow extends RawDataRow {
  codingStatus: 'pending' | 'coded' | 'error';
  result?: CodedResult;
  errorMessage?: string;
  manuallyEdited?: boolean;
}

export interface ColumnMapping {
  idColumn: string;
  jobTitleColumn: string; // Used as Primary Text
  jobDescriptionColumn: string; // Used as Secondary Text (Context)
  industryColumn?: string; // Specific for Dual Coding (Industry Context)
}

export enum ModuleType {
  ISCO08 = 'ISCO-08',
  ISIC4 = 'ISIC Rev. 4',
  COICOP = 'COICOP 2018',
  DUAL = 'Dual Coding (ISCO + ISIC)'
}

export enum ProcessingMode {
  Cloud = 'CLOUD',
  Local = 'LOCAL'
}

export interface AISettings {
  mode: ProcessingMode;
  localUrl: string;
  localModel: string;
  apiKey?: string; // In case user wants to override env var in UI (optional)
}