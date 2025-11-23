
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
  confidence: string; // 'High' | 'Medium' | 'Low' | 'Manual' | 'Reference'
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

export enum AIProvider {
  Gemini = 'GEMINI',
  OpenAI = 'OPENAI',
  DeepSeek = 'DEEPSEEK',
  Local = 'LOCAL'
}

export interface AISettings {
  provider: AIProvider;
  apiKey?: string;     // User-supplied key for OpenAI/DeepSeek
  baseUrl?: string;    // Override URL for Local/DeepSeek
  model: string;       // Model name (e.g., 'gpt-4o', 'deepseek-chat', 'qwen2.5')
}

export interface ReferenceEntry {
  id: string;
  module: ModuleType;
  term: string;       // The input text (e.g. "Software Engineer")
  code: string;       // The code (e.g. "2512")
  label: string;      // The official label
  description?: string;
  source: 'upload' | 'learned';
  addedAt: number;
}
