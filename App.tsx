
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CodingStatus, RawDataRow, ProcessedRow, ColumnMapping, ModuleType, AIProvider, AISettings, SearchResult, CodedResult, ReferenceEntry } from './types';
import { parseDataFile, exportToCSV } from './utils/csvHelper';
import { codeSingleOccupation, searchClassification, suggestCodes } from './services/geminiService';
import { addReferenceEntries, findReferenceMatch, findSimilarReferences, getReferenceStats, clearReferenceData } from './services/dbService';
import { 
  UploadIcon, 
  FileSpreadsheetIcon, 
  ArrowRightIcon, 
  CheckCircleIcon,
  AlertCircleIcon,
  SparklesIcon,
  DownloadIcon,
  DatabaseIcon,
  BrainIcon,
  HelpCircleIcon,
  ExternalLinkIcon,
  SettingsIcon,
  WifiIcon,
  WifiOffIcon,
  ServerIcon,
  SaveIcon,
  TrashIcon,
  EditIcon,
  SearchIcon,
  ListIcon,
  CheckIcon,
  FilterIcon,
  ZapIcon,
  TerminalIcon,
  CodeIcon,
  LayoutKanbanIcon,
  ClockIcon,
  TagIcon,
  BarChartIcon,
  PieChartIcon,
  TrendingUpIcon,
  AlertTriangleIcon
} from './components/Icons';

// --- Constants & Metadata ---
const MODULE_DETAILS = {
  [ModuleType.ISCO08]: {
    name: "ISCO-08",
    fullTitle: "International Standard Classification of Occupations",
    description: "A system for classifying and aggregating occupational information obtained by means of population censuses and other statistical surveys, as well as from administrative records.",
    url: "https://www.ilo.org/public/english/bureau/stat/isco/isco08/"
  },
  [ModuleType.ISIC4]: {
    name: "ISIC Rev. 4",
    fullTitle: "International Standard Industrial Classification of All Economic Activities",
    description: "The international reference classification of productive economic activities. Its main purpose is to provide a set of activity categories that can be utilized for the collection and reporting of statistics.",
    url: "https://unstats.un.org/unsd/classifications/Econ/ISIC"
  },
  [ModuleType.COICOP]: {
    name: "COICOP 2018",
    fullTitle: "Classification of Individual Consumption According to Purpose",
    description: "A reference classification published by the United Nations Statistics Division that divides the purpose of individual consumption expenditures incurred by three institutional sectors.",
    url: "https://unstats.un.org/unsd/classifications/Econ/COICOP"
  },
  [ModuleType.DUAL]: {
    name: "Dual Coding (ISCO + ISIC)",
    fullTitle: "Simultaneous ISCO-08 and ISIC Rev. 4 Coding",
    description: "A specialized module that codes both the occupation (ISCO) and the industry activity (ISIC) from the same input record, considering the relationship between job title and economic activity.",
    url: "#"
  }
};

// --- Models List ---
const ONLINE_MODELS = {
  [AIProvider.Gemini]: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Recommended)' },
    { id: 'gemini-2.0-flash-lite-preview-02-05', name: 'Gemini 2.0 Flash Lite' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
  ],
  [AIProvider.OpenAI]: [
    { id: 'gpt-4o', name: 'GPT-4o (Recommended)' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'o1-mini', name: 'o1 Mini (Reasoning)' }
  ],
  [AIProvider.DeepSeek]: [
    { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)' }
  ]
};

// --- Roadmap Data & Component ---
interface RoadmapItem {
  id: string;
  title: string;
  epic: string;
  story: string;
  ac: string[];
}

interface RoadmapColumn {
  id: string;
  title: string;
  items: RoadmapItem[];
}

const ROADMAP_DATA: RoadmapColumn[] = [
  {
    id: 'sprint1',
    title: 'Sprint 1: Core Foundation',
    items: [
      {
        id: 'A1',
        title: 'File Upload & Preview',
        epic: 'Epic A: Upload',
        story: 'As a coder, I want to upload CSV/XLSX/ODS and see a preview so I can verify the dataset.',
        ac: ['Accepts CSV/XLSX', 'Previews first 20 rows', 'Validates columns present']
      },
      {
        id: 'A2',
        title: 'Batch Auto-Coding Engine',
        epic: 'Epic A: Upload',
        story: 'As a coder, I want to run batch jobs to map titles to codes deterministically and via AI.',
        ac: ['Processes full dataset', 'Deterministic fallback', 'Updates progress bar']
      },
      {
        id: 'DB1',
        title: 'Database Schema Setup',
        epic: 'Infrastructure',
        story: 'Define PostgreSQL schema for Users, Uploads, Records, and Predictions.',
        ac: ['Schema created', 'Indexes optimized', 'JSONB fields for metadata']
      }
    ]
  },
  {
    id: 'sprint2',
    title: 'Sprint 2: ML & Workers',
    items: [
      {
        id: 'C1',
        title: 'Export Results',
        epic: 'Epic C: Exports',
        story: 'As a user, I want to export coded datasets to CSV/XLSX keeping original columns.',
        ac: ['Downloadable file', 'Includes confidence scores', 'Includes manual edit flags']
      },
      {
        id: 'ML1',
        title: 'Dockerized ML Inference',
        epic: 'Infrastructure',
        story: 'Containerize the ML model service for independent scaling.',
        ac: ['Docker container runs', 'API accepts batch requests', 'Connects to worker queue']
      },
      {
        id: 'Q1',
        title: 'Worker Queue Integration',
        epic: 'Infrastructure',
        story: 'Implement Redis/Celery for background job processing.',
        ac: ['Jobs enqueued asynchronously', 'Retries on failure', 'Status updates via WebSocket']
      }
    ]
  },
  {
    id: 'sprint3',
    title: 'Sprint 3: UI & QA',
    items: [
      {
        id: 'B1',
        title: 'Review Queue Interface',
        epic: 'Epic B: QA',
        story: 'As a reviewer, I want to see rows with low confidence to manually verify them.',
        ac: ['Filter by confidence', 'Displays original text', 'Search classification']
      },
      {
        id: 'B2',
        title: 'Manual Edit & Save',
        epic: 'Epic B: QA',
        story: 'As a reviewer, I want to correct codes and save changes to the audit log.',
        ac: ['Edit code/label', 'Save updates DB', 'Logs "Manual Edit" action']
      },
      {
        id: 'C2',
        title: 'Job Summary Dashboard',
        epic: 'Epic C: Exports',
        story: 'As an admin, I want a dashboard showing recent job metrics.',
        ac: ['Total rows processed', 'Average confidence', 'Coverage %']
      },
       {
        id: 'D1',
        title: 'Audit Logs',
        epic: 'Epic D: Admin',
        story: 'As an admin, I want to see who ran jobs and made edits.',
        ac: ['List of actions', 'User attribution', 'Timestamps']
      }
    ]
  },
  {
    id: 'backlog',
    title: 'Backlog / Post-MVP',
    items: [
       {
        id: 'F1',
        title: 'Local Model Fine-tuning',
        epic: 'Epic: Advanced',
        story: 'Allow NSOs to fine-tune models with their own labeled data.',
        ac: ['Upload training set', 'Trigger fine-tuning job', 'Version new model']
      },
      {
        id: 'Auth1',
        title: 'SSO Integration',
        epic: 'Epic: Security',
        story: 'Integrate with government IDP via OIDC/SAML.',
        ac: ['Login via SSO', 'Role mapping']
      },
       {
        id: 'API1',
        title: 'External API Endpoint',
        epic: 'Epic: Integration',
        story: 'Provide REST API for other systems to submit coding jobs.',
        ac: ['API Key auth', 'Rate limiting', 'Swagger docs']
      }
    ]
  }
];

const RoadmapView: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null);

  return (
    <div className="h-full flex flex-col bg-slate-100 p-6 overflow-hidden">
       <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <LayoutKanbanIcon className="w-6 h-6 text-indigo-600" />
                Project Development Roadmap
            </h2>
            <p className="text-slate-500 mt-1">Status of features for the MVP rollout.</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm text-xs font-mono text-slate-500 border border-slate-200">
             v1.7.0-mvp-plan
          </div>
       </div>

       <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex h-full gap-6 min-w-[1000px]">
             {ROADMAP_DATA.map((col) => (
               <div key={col.id} className="flex-1 flex flex-col min-w-[300px] max-w-[350px]">
                  <div className="flex items-center justify-between mb-3 px-1">
                     <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">{col.title}</h3>
                     <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full font-medium">{col.items.length}</span>
                  </div>
                  <div className="flex-1 bg-slate-200/50 rounded-xl p-3 overflow-y-auto custom-scrollbar space-y-3 border border-slate-200/60">
                     {col.items.map((item) => (
                       <div 
                         key={item.id}
                         onClick={() => setSelectedItem(item)}
                         className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
                       >
                          <div className="flex items-center justify-between mb-2">
                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                               item.epic.includes('A:') ? 'bg-blue-100 text-blue-700' :
                               item.epic.includes('B:') ? 'bg-orange-100 text-orange-700' :
                               item.epic.includes('C:') ? 'bg-emerald-100 text-emerald-700' :
                               item.epic.includes('D:') ? 'bg-purple-100 text-purple-700' :
                               'bg-slate-100 text-slate-600'
                             }`}>
                               {item.id}
                             </span>
                             <ClockIcon className="w-3 h-3 text-slate-400" />
                          </div>
                          <h4 className="font-semibold text-slate-800 text-sm leading-tight mb-2 group-hover:text-indigo-700">
                             {item.title}
                          </h4>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                             <TagIcon className="w-3 h-3" />
                             <span className="truncate">{item.epic}</span>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
};

// --- Component: Knowledge Base View (Reference Manager) ---
const KnowledgeBaseView: React.FC = () => {
    const [stats, setStats] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [uploadStep, setUploadStep] = useState<'idle' | 'mapping' | 'processing'>('idle');
    const [uploadData, setUploadData] = useState<RawDataRow[]>([]);
    const [targetModule, setTargetModule] = useState<ModuleType>(ModuleType.ISCO08);
    const [colMapping, setColMapping] = useState({ term: '', code: '', label: '', desc: '' });

    const fetchStats = async () => {
        const s = await getReferenceStats();
        setStats(s);
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const handleFile = async (file: File) => {
        try {
            setLoading(true);
            const data = await parseDataFile(file);
            setUploadData(data);
            setUploadStep('mapping');
        } catch (e) {
            alert("Error parsing file");
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        setUploadStep('processing');
        const entries: ReferenceEntry[] = uploadData.map(row => ({
            id: crypto.randomUUID(),
            module: targetModule,
            term: row[colMapping.term] ? String(row[colMapping.term]) : '',
            code: row[colMapping.code] ? String(row[colMapping.code]) : '',
            label: row[colMapping.label] ? String(row[colMapping.label]) : '',
            description: colMapping.desc ? String(row[colMapping.desc]) : undefined,
            source: 'upload',
            addedAt: Date.now()
        })).filter(e => e.term && e.code);

        await addReferenceEntries(entries);
        await fetchStats();
        setUploadStep('idle');
        setUploadData([]);
        setColMapping({ term: '', code: '', label: '', desc: '' });
    };

    const handleClear = async (module: ModuleType) => {
        if (confirm(`Are you sure you want to delete all reference data for ${module}?`)) {
            await clearReferenceData(module);
            await fetchStats();
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex items-center gap-4 mb-6">
                 <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
                    <DatabaseIcon className="w-6 h-6" />
                 </div>
                 <div>
                    <h2 className="text-2xl font-bold text-slate-800">Knowledge Base & Reference Files</h2>
                    <p className="text-slate-500">Manage local dictionaries. The app checks these first before calling online AI.</p>
                 </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
                {Object.values(ModuleType).map(mod => (
                    <div key={mod} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group">
                        <div className="text-slate-500 text-xs font-bold uppercase mb-2">{mod}</div>
                        <div className="text-3xl font-bold text-slate-800">{stats[mod] || 0}</div>
                        <div className="text-xs text-slate-400 mt-1">Reference Entries</div>
                        
                        {stats[mod] > 0 && (
                            <button 
                              onClick={() => handleClear(mod)}
                              className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              title="Clear Dictionary"
                            >
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Upload Section */}
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <UploadIcon className="w-5 h-5 text-blue-500" />
                    Upload Reference Dictionary
                </h3>

                {uploadStep === 'idle' && (
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:bg-slate-50 transition-colors">
                        <p className="text-slate-500 mb-4">Upload a CSV, Excel or OpenDocument file containing official codes and descriptions.</p>
                         <label className="inline-block">
                            <input 
                            type="file" 
                            accept=".csv, .xlsx, .xls, .ods" 
                            className="hidden" 
                            onChange={(e) => {
                                if (e.target.files?.[0]) handleFile(e.target.files[0]);
                            }}
                            />
                            <span className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg cursor-pointer hover:bg-slate-700">
                                Select Reference File
                            </span>
                        </label>
                    </div>
                )}

                {uploadStep === 'mapping' && (
                    <div className="space-y-6 max-w-xl mx-auto">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Target Module</label>
                            <select 
                                className="w-full p-2 border rounded"
                                value={targetModule}
                                onChange={e => setTargetModule(e.target.value as ModuleType)}
                            >
                                {Object.values(ModuleType).map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Search Term Column (Title)</label>
                                <select className="w-full p-2 border rounded" onChange={e => setColMapping({...colMapping, term: e.target.value})}>
                                    <option value="">Select...</option>
                                    {Object.keys(uploadData[0] || {}).map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Code Column</label>
                                <select className="w-full p-2 border rounded" onChange={e => setColMapping({...colMapping, code: e.target.value})}>
                                    <option value="">Select...</option>
                                    {Object.keys(uploadData[0] || {}).map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Label Column</label>
                                <select className="w-full p-2 border rounded" onChange={e => setColMapping({...colMapping, label: e.target.value})}>
                                    <option value="">Select...</option>
                                    {Object.keys(uploadData[0] || {}).map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Description (Optional)</label>
                                <select className="w-full p-2 border rounded" onChange={e => setColMapping({...colMapping, desc: e.target.value})}>
                                    <option value="">Select...</option>
                                    {Object.keys(uploadData[0] || {}).map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button onClick={() => setUploadStep('idle')} className="px-4 py-2 text-slate-600">Cancel</button>
                            <button 
                                onClick={handleImport}
                                disabled={!colMapping.term || !colMapping.code || !colMapping.label}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded disabled:opacity-50"
                            >
                                Import Data
                            </button>
                        </div>
                    </div>
                )}
                
                {uploadStep === 'processing' && (
                    <div className="text-center py-12">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-slate-500">Processing and saving to local database...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Component: Settings Modal ---
const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (s: AISettings) => void;
}> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    if(isOpen) {
      setLocalSettings(settings);
      setTestStatus('idle');
      setTestMessage('');
    }
  }, [isOpen, settings]);

  const handleProviderChange = (provider: AIProvider) => {
    let defaultModel = '';
    let defaultBaseUrl = '';

    switch(provider) {
      case AIProvider.Gemini:
        defaultModel = 'gemini-2.0-flash';
        break;
      case AIProvider.OpenAI:
        defaultModel = 'gpt-4o';
        defaultBaseUrl = '';
        break;
      case AIProvider.DeepSeek:
        defaultModel = 'deepseek-chat';
        defaultBaseUrl = 'https://api.deepseek.com/chat/completions';
        break;
      case AIProvider.Local:
        defaultModel = 'qwen2.5:7b';
        // We default to 1234 (LM Studio) if user prefers, or 11434 (Ollama)
        defaultBaseUrl = 'http://localhost:11434/v1/chat/completions';
        break;
    }

    setLocalSettings(prev => ({
      ...prev,
      provider,
      model: defaultModel,
      baseUrl: defaultBaseUrl,
      apiKey: provider === AIProvider.Gemini ? '' : (provider === AIProvider.Local ? '' : prev.apiKey)
    }));
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
        if (localSettings.provider === AIProvider.Gemini) {
           if (!process.env.API_KEY && !localSettings.apiKey) throw new Error("Missing API Key");
           setTimeout(() => {
             setTestStatus('success');
             setTestMessage('Gemini Configured!');
           }, 500);
           return;
        }

        const url = localSettings.baseUrl || (
           localSettings.provider === AIProvider.OpenAI ? "https://api.openai.com/v1/chat/completions" :
           localSettings.provider === AIProvider.DeepSeek ? "https://api.deepseek.com/chat/completions" : 
           "http://localhost:11434/v1/chat/completions"
        );
        
        const headers: any = { "Content-Type": "application/json" };
        if (localSettings.apiKey) headers["Authorization"] = `Bearer ${localSettings.apiKey}`;

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                model: localSettings.model,
                messages: [{ role: "user", content: "Ping" }],
                max_tokens: 1
            })
        });
        
        if (response.ok) {
            setTestStatus('success');
            setTestMessage('Connected successfully!');
        } else {
            setTestStatus('error');
            setTestMessage(`Error ${response.status}: ${response.statusText}`);
        }
    } catch (e) {
        setTestStatus('error');
        setTestMessage('Connection failed. Check URL/Key.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-slate-500" />
            AI Engine Settings
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">AI Provider</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleProviderChange(AIProvider.Gemini)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                  localSettings.provider === AIProvider.Gemini ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" className="w-4 h-4" alt="Gemini" />
                Google Gemini
              </button>
              <button
                onClick={() => handleProviderChange(AIProvider.OpenAI)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                  localSettings.provider === AIProvider.OpenAI ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="w-4 h-4 bg-emerald-600 rounded-sm"></div>
                OpenAI (ChatGPT)
              </button>
              <button
                onClick={() => handleProviderChange(AIProvider.DeepSeek)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                  localSettings.provider === AIProvider.DeepSeek ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="w-4 h-4 bg-indigo-600 rounded-full"></div>
                DeepSeek
              </button>
              <button
                onClick={() => handleProviderChange(AIProvider.Local)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-2 ${
                  localSettings.provider === AIProvider.Local ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ServerIcon className="w-4 h-4" />
                Local / Ollama
              </button>
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-4">
             {/* Dynamic Fields */}
             <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Model Name</label>
                {localSettings.provider === AIProvider.Local ? (
                  <>
                    <input 
                      type="text" 
                      list="local-models"
                      value={localSettings.model}
                      onChange={(e) => setLocalSettings({...localSettings, model: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <datalist id="local-models">
                       <option value="llama3" />
                       <option value="mistral" />
                       <option value="qwen2.5:7b" />
                       <option value="phi3" />
                    </datalist>
                    <p className="text-xs text-slate-400 mt-1">Type the exact model name used in Ollama/LM Studio.</p>
                  </>
                ) : (
                  <select
                     value={localSettings.model}
                     onChange={(e) => setLocalSettings({...localSettings, model: e.target.value})}
                     className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                     {(ONLINE_MODELS as any)[localSettings.provider]?.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                     ))}
                  </select>
                )}
             </div>

             {localSettings.provider !== AIProvider.Gemini && (
               <div>
                 <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                   {localSettings.provider === AIProvider.Local ? "API Base URL" : "API Endpoint (Optional Override)"}
                 </label>
                 <input 
                   type="text" 
                   value={localSettings.baseUrl || ''}
                   onChange={(e) => setLocalSettings({...localSettings, baseUrl: e.target.value})}
                   placeholder={localSettings.provider === AIProvider.OpenAI ? "https://api.openai.com/v1/chat/completions" : "http://localhost:11434/v1/chat/completions (Ollama) or :1234 (LM Studio)"}
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                 />
                 {localSettings.provider === AIProvider.Local && (
                     <p className="text-[10px] text-slate-400 mt-1">Use port 11434 for Ollama, or 1234 for LM Studio.</p>
                 )}
               </div>
             )}

             <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                   {localSettings.provider === AIProvider.Gemini ? "API Key (Optional Override)" : "API Key"}
                   {localSettings.provider === AIProvider.Local && <span className="text-slate-400 font-normal ml-1 normal-case">(Not usually required)</span>}
                </label>
                <input 
                  type="password" 
                  value={localSettings.apiKey || ''}
                  onChange={(e) => setLocalSettings({...localSettings, apiKey: e.target.value})}
                  placeholder={localSettings.provider === AIProvider.Gemini ? "Leave empty to use default env key" : (localSettings.provider === AIProvider.Local ? "Optional for local models" : "sk-...")}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
             </div>
          </div>
          
          <div className="flex items-center justify-between pt-2">
              <div className="text-xs flex-1 mr-4">
                {testStatus === 'success' && (
                  <span className="text-emerald-600 flex items-center gap-1 font-medium animate-in fade-in">
                    <CheckCircleIcon className="w-3 h-3"/> {testMessage}
                  </span>
                )}
                {testStatus === 'error' && (
                  <span className="text-red-600 flex items-center gap-1 font-medium animate-in fade-in">
                    <AlertCircleIcon className="w-3 h-3"/> {testMessage}
                  </span>
                )}
                {testStatus === 'idle' && (
                  <span className="text-slate-400 flex items-center gap-1">
                    <ServerIcon className="w-3 h-3"/> Test connectivity
                  </span>
                )}
              </div>
              <button 
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded border border-slate-200 transition-colors font-medium disabled:opacity-50"
              >
                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
          <button 
            onClick={() => { onSave(localSettings); onClose(); }}
            className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 shadow-sm"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Component: Sidebar ---
const Sidebar: React.FC<{ 
  activeModule: ModuleType | 'interactive' | 'roadmap' | 'dashboard' | 'knowledge'; 
  onModuleSelect: (m: ModuleType | 'interactive' | 'roadmap' | 'dashboard' | 'knowledge') => void;
  onOpenSettings: () => void;
  currentProvider: AIProvider;
  onSaveSession: () => void;
  onClearSession: () => void;
  canInstall: boolean;
  onInstall: () => void;
}> = ({ activeModule, onModuleSelect, onOpenSettings, currentProvider, onSaveSession, onClearSession, canInstall, onInstall }) => {
  const [hoveredModule, setHoveredModule] = useState<ModuleType | 'interactive' | 'roadmap' | 'dashboard' | 'knowledge' | null>(null);

  const getProviderIcon = (p: AIProvider) => {
    switch(p) {
      case AIProvider.Gemini: return <div className="w-2 h-2 rounded-full bg-blue-500"></div>;
      case AIProvider.OpenAI: return <div className="w-2 h-2 rounded-full bg-emerald-500"></div>;
      case AIProvider.DeepSeek: return <div className="w-2 h-2 rounded-full bg-indigo-500"></div>;
      case AIProvider.Local: return <div className="w-2 h-2 rounded-full bg-amber-500"></div>;
    }
  }

  const getProviderName = (p: AIProvider) => {
    switch(p) {
      case AIProvider.Gemini: return "Gemini AI";
      case AIProvider.OpenAI: return "OpenAI";
      case AIProvider.DeepSeek: return "DeepSeek";
      case AIProvider.Local: return "Local AI";
    }
  }

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800 z-10 shadow-xl">
      <div className="p-6 border-b border-slate-800 flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
          <BrainIcon className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight">StatCode AI</h1>
      </div>
      
      <div className="flex-1 py-6 space-y-1 overflow-visible">
        <div className="px-4 text-xs font-semibold uppercase text-slate-500 mb-2">Coding Modules</div>
        {(Object.values(ModuleType) as ModuleType[]).map((module) => (
          <div 
            key={module}
            className="relative group"
            onMouseEnter={() => setHoveredModule(module)}
            onMouseLeave={() => setHoveredModule(null)}
          >
            <button
              onClick={() => onModuleSelect(module)}
              className={`w-full text-left px-6 py-3 flex items-center gap-3 transition-colors ${
                activeModule === module 
                ? 'bg-blue-900/30 text-blue-400 border-r-4 border-blue-500' 
                : 'hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              {module === ModuleType.DUAL ? <CodeIcon className="w-4 h-4 flex-shrink-0" /> : <DatabaseIcon className="w-4 h-4 flex-shrink-0" />}
              <span className="font-medium truncate">{module === ModuleType.DUAL ? "Dual (ISCO+ISIC)" : module}</span>
              <HelpCircleIcon className={`w-3 h-3 ml-auto transition-opacity ${hoveredModule === module ? 'opacity-100' : 'opacity-0'}`} />
            </button>

            {/* Hover Tooltip */}
            {hoveredModule === module && (
              <div className="absolute left-full top-0 ml-1 w-72 bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-left-2">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-bold text-white">{MODULE_DETAILS[module].name}</h4>
                  <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600">INFO</span>
                </div>
                <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                  {MODULE_DETAILS[module].description}
                </p>
                <a 
                  href={MODULE_DETAILS[module].url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Official Documentation <ExternalLinkIcon className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        ))}

        <div className="mt-4 px-4 text-xs font-semibold uppercase text-slate-500 mb-2">Tools</div>
        <button
            onClick={() => onModuleSelect('knowledge')}
            className={`w-full text-left px-6 py-3 flex items-center gap-3 transition-colors ${
            activeModule === 'knowledge'
            ? 'bg-blue-900/30 text-amber-400 border-r-4 border-amber-500' 
            : 'hover:bg-slate-800 hover:text-slate-100'
            }`}
        >
            <DatabaseIcon className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium truncate">Knowledge Base</span>
        </button>
        <button
            onClick={() => onModuleSelect('dashboard')}
            className={`w-full text-left px-6 py-3 flex items-center gap-3 transition-colors ${
            activeModule === 'dashboard'
            ? 'bg-blue-900/30 text-emerald-400 border-r-4 border-emerald-500' 
            : 'hover:bg-slate-800 hover:text-slate-100'
            }`}
        >
            <PieChartIcon className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium truncate">Analytics Dashboard</span>
        </button>
        <button
            onClick={() => onModuleSelect('interactive')}
            className={`w-full text-left px-6 py-3 flex items-center gap-3 transition-colors ${
            activeModule === 'interactive'
            ? 'bg-blue-900/30 text-amber-400 border-r-4 border-amber-500' 
            : 'hover:bg-slate-800 hover:text-slate-100'
            }`}
        >
            <ZapIcon className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium truncate">Interactive / API</span>
        </button>
        <button
            onClick={() => onModuleSelect('roadmap')}
            className={`w-full text-left px-6 py-3 flex items-center gap-3 transition-colors ${
            activeModule === 'roadmap'
            ? 'bg-blue-900/30 text-purple-400 border-r-4 border-purple-500' 
            : 'hover:bg-slate-800 hover:text-slate-100'
            }`}
        >
            <LayoutKanbanIcon className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium truncate">Project Roadmap</span>
        </button>

      </div>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <div className="px-2 text-xs font-semibold uppercase text-slate-500 mb-2">Session</div>
        
        <button 
          onClick={onSaveSession}
          className="w-full flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-500 rounded-lg transition-colors text-sm font-medium"
        >
          <SaveIcon className="w-4 h-4" />
          Save Progress
        </button>
        
        <button 
          onClick={onClearSession}
          className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-900/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors text-sm"
        >
          <TrashIcon className="w-4 h-4" />
          New Session
        </button>

        <div className="h-px bg-slate-800 my-3" />
        
        {/* Install Button */}
        {canInstall && (
            <button 
            onClick={onInstall}
            className="w-full flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-bold mb-2 shadow-md animate-pulse"
            >
            <DownloadIcon className="w-4 h-4" />
            Install Desktop App
            </button>
        )}

        <button 
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm group"
        >
          <div className="flex items-center gap-2 text-slate-300 group-hover:text-white">
            <SettingsIcon className="w-4 h-4" />
            <span>Settings</span>
          </div>
          {getProviderIcon(currentProvider)}
        </button>
        <div className="mt-1 text-xs text-slate-600 text-center">
          v1.9.0 &bull; {getProviderName(currentProvider)}
        </div>
      </div>
    </div>
  );
};

// --- Component: InteractiveMode ---
const InteractiveMode: React.FC<{ settings: AISettings }> = ({ settings }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'search' | 'suggest'>('search');

  const handleRun = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    try {
       if (mode === 'search') {
          const res = await searchClassification(query, ModuleType.ISCO08, settings);
          setResults(res);
       } else {
          const res = await suggestCodes(query, ModuleType.ISCO08, settings);
          setResults(res);
       }
    } catch (e) {
       console.error(e);
    } finally {
       setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
       <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <ZapIcon className="w-6 h-6 text-amber-500" />
          Interactive API Sandbox
       </h2>
       
       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
          <div className="flex gap-4 mb-4">
             <button onClick={() => setMode('search')} className={`px-4 py-2 rounded-lg text-sm font-bold border ${mode === 'search' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>Semantic Search</button>
             <button onClick={() => setMode('suggest')} className={`px-4 py-2 rounded-lg text-sm font-bold border ${mode === 'suggest' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>Autocomplete Suggestion</button>
          </div>
          
          <div className="flex gap-2">
             <input 
               value={query}
               onChange={(e) => setQuery(e.target.value)}
               placeholder={mode === 'search' ? "Search for 'software engineer'..." : "Type job title..."}
               className="flex-1 p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
               onKeyDown={e => e.key === 'Enter' && handleRun()}
             />
             <button 
               onClick={handleRun}
               disabled={loading}
               className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg disabled:opacity-50"
             >
               {loading ? 'Running...' : 'Execute'}
             </button>
          </div>
       </div>

       <div className="space-y-4">
          {results.map((item, idx) => (
             <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:border-blue-300 transition-colors">
                <div className="flex justify-between items-start">
                   <h4 className="font-bold text-slate-800">{item.label}</h4>
                   <span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">{item.code}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{item.description || item.reasoning}</p>
                {item.confidence && <div className="mt-2 text-xs font-bold text-slate-400">Confidence: {item.confidence}</div>}
             </div>
          ))}
          {results.length === 0 && !loading && <div className="text-center text-slate-400 py-8">No results to display</div>}
       </div>
    </div>
  );
};

// --- Component: Treemap (Simple implementation for Dashboard) ---
const Treemap: React.FC<{ data: { label: string, count: number }[] }> = ({ data }) => {
    const total = data.reduce((sum, item) => sum + item.count, 0);
    // Sort by count descending
    const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 10); // Top 10
    
    // Assign colors based on index
    const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500', 'bg-orange-500', 'bg-teal-500', 'bg-cyan-500', 'bg-rose-500'];

    return (
        <div className="w-full h-64 flex flex-wrap content-start gap-1">
            {sorted.map((item, idx) => {
                const percentage = (item.count / total) * 100;
                // Min width to be visible, max to fit logic roughly
                const flexBasis = `${Math.max(percentage, 10)}%`; 
                const color = colors[idx % colors.length];

                return (
                    <div 
                        key={idx} 
                        className={`${color} text-white p-2 rounded-md flex flex-col justify-center items-center text-center overflow-hidden hover:opacity-90 transition-opacity cursor-default relative group grow`}
                        style={{ flexBasis: flexBasis, minWidth: '80px', height: percentage > 30 ? '100%' : '48%' }}
                        title={`${item.label}: ${item.count} (${percentage.toFixed(1)}%)`}
                    >
                         <div className="font-bold text-xs md:text-sm truncate w-full px-1">{item.label}</div>
                         <div className="text-xs opacity-80">{item.count}</div>
                    </div>
                )
            })}
        </div>
    )
}

// --- Component: DashboardView ---
const DashboardView: React.FC<{ data: ProcessedRow[]; mapping: ColumnMapping }> = ({ data, mapping }) => {
  const total = data.length;
  const coded = data.filter(r => r.codingStatus === 'coded').length;
  const pending = data.filter(r => r.codingStatus === 'pending').length;
  const error = data.filter(r => r.codingStatus === 'error').length;
  const highConf = data.filter(r => r.result?.confidence === 'High').length;
  
  const completionRate = total > 0 ? Math.round((coded / total) * 100) : 0;
  const qualityScore = coded > 0 ? Math.round((highConf / coded) * 100) : 0;

  // Prepare Treemap Data
  const labelCounts: Record<string, number> = {};
  data.forEach(row => {
      if (row.result?.label) {
          labelCounts[row.result.label] = (labelCounts[row.result.label] || 0) + 1;
      }
  });
  const treemapData = Object.entries(labelCounts).map(([label, count]) => ({ label, count }));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
       <h2 className="text-2xl font-bold text-slate-800">Job Analytics</h2>
       
       <div className="grid grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-slate-500 text-xs font-bold uppercase mb-2">Completion Rate</div>
             <div className="text-3xl font-bold text-blue-600">{completionRate}%</div>
             <div className="text-xs text-slate-400 mt-1">{coded} of {total} rows</div>
          </div>
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-slate-500 text-xs font-bold uppercase mb-2">Quality Score</div>
             <div className="text-3xl font-bold text-emerald-600">{qualityScore}%</div>
             <div className="text-xs text-slate-400 mt-1">High confidence rate</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-slate-500 text-xs font-bold uppercase mb-2">Pending</div>
             <div className="text-3xl font-bold text-amber-500">{pending}</div>
             <div className="text-xs text-slate-400 mt-1">Rows waiting</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <div className="text-slate-500 text-xs font-bold uppercase mb-2">Errors</div>
             <div className="text-3xl font-bold text-red-500">{error}</div>
             <div className="text-xs text-slate-400 mt-1">Failed rows</div>
          </div>
       </div>

       {/* Treemap Visualization */}
       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-700">Top Occupations Distribution</h3>
                <span className="text-xs text-slate-400">Hierarchical View</span>
           </div>
           {treemapData.length > 0 ? (
               <Treemap data={treemapData} />
           ) : (
               <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                   Not enough data to visualize
               </div>
           )}
       </div>

       {/* Simple distribution bar */}
       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-6">Confidence Distribution</h3>
          <div className="flex items-end h-40 gap-4">
             {['High', 'Medium', 'Low', 'Reference'].map(lvl => {
                const count = data.filter(r => r.result?.confidence === lvl).length;
                const pct = coded > 0 ? (count / coded) * 100 : 0;
                let color = 'bg-slate-300';
                if(lvl === 'High') color = 'bg-emerald-500';
                if(lvl === 'Medium') color = 'bg-blue-500';
                if(lvl === 'Low') color = 'bg-amber-500';
                if(lvl === 'Reference') color = 'bg-indigo-500';

                return (
                   <div key={lvl} className="flex-1 flex flex-col justify-end items-center group">
                      <div className="text-xs font-bold text-slate-600 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">{count}</div>
                      <div 
                        className={`w-full rounded-t-md transition-all duration-500 ${color}`} 
                        style={{ height: `${pct}%` }} 
                      />
                      <div className="text-xs font-bold text-slate-500 mt-2 uppercase">{lvl}</div>
                   </div>
                )
             })}
          </div>
       </div>
    </div>
  );
};

// --- Component: FileUpload ---
const FileUpload: React.FC<{ onFileUpload: (data: RawDataRow[]) => void }> = ({ onFileUpload }) => {
  const handleFile = async (file: File) => {
    try {
      const data = await parseDataFile(file);
      onFileUpload(data);
    } catch (e) {
      console.error("File parse error", e);
      alert("Error parsing file. Ensure it is a valid CSV, Excel or OpenDocument file.");
    }
  };

  return (
    <div 
      className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center bg-white hover:bg-slate-50 hover:border-blue-400 transition-all cursor-pointer group"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      }}
    >
      <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
        <UploadIcon className="w-8 h-8" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">Upload Dataset</h3>
      <p className="text-slate-500 mb-6">Drag and drop your CSV, Excel or OpenDocument file here, or click to browse.</p>
      
      <label className="inline-block">
        <input 
          type="file" 
          accept=".csv, .xlsx, .xls, .ods" 
          className="hidden" 
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
        />
        <span className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-sm">
          Select File
        </span>
      </label>
    </div>
  );
};

// --- Component: DataMapping ---
const DataMapping: React.FC<{
  headers: string[];
  mapping: ColumnMapping;
  setMapping: (m: ColumnMapping) => void;
  onConfirm: () => void;
  activeModule: ModuleType;
}> = ({ headers, mapping, setMapping, onConfirm, activeModule }) => {
  const handleChange = (key: keyof ColumnMapping, value: string) => {
    setMapping({ ...mapping, [key]: value });
  };

  // Smart Detection Hook
  useEffect(() => {
    if (headers.length > 0 && !mapping.jobTitleColumn) {
        const newMapping = { ...mapping };
        
        // Simple Heuristic Detection
        headers.forEach(h => {
            const lower = h.toLowerCase();
            if (/(title|occupation|prof|job)/.test(lower)) newMapping.jobTitleColumn = h;
            if (/(desc|detail|task|note|text)/.test(lower)) newMapping.jobDescriptionColumn = h;
            if (/(id|key|ref)/.test(lower)) newMapping.idColumn = h;
            if (activeModule === ModuleType.DUAL && /(ind|activ|sect)/.test(lower)) newMapping.industryColumn = h;
        });

        if (newMapping.jobTitleColumn !== mapping.jobTitleColumn || newMapping.jobDescriptionColumn !== mapping.jobDescriptionColumn) {
            setMapping(newMapping);
        }
    }
  }, [headers, activeModule]);

  const isComplete = mapping.jobTitleColumn && mapping.jobDescriptionColumn && (activeModule !== ModuleType.DUAL || mapping.industryColumn);

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">2</div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Map Columns</h2>
            <p className="text-slate-500">Select which columns from your file correspond to the required fields.</p>
          </div>
        </div>

        <div className="space-y-6 max-w-xl">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Unique ID (Optional)</label>
            <select 
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              value={mapping.idColumn}
              onChange={(e) => handleChange('idColumn', e.target.value)}
            >
              <option value="id">Generate Automatically</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
               Primary Text <span className="text-red-500">*</span>
               <span className="text-xs font-normal text-slate-400 ml-2">(e.g., Job Title, Product Name)</span>
            </label>
            <select 
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              value={mapping.jobTitleColumn}
              onChange={(e) => handleChange('jobTitleColumn', e.target.value)}
            >
              <option value="">Select Column...</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
               Secondary Text (Context) <span className="text-red-500">*</span>
               <span className="text-xs font-normal text-slate-400 ml-2">(e.g., Job Description, Details)</span>
            </label>
            <select 
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              value={mapping.jobDescriptionColumn}
              onChange={(e) => handleChange('jobDescriptionColumn', e.target.value)}
            >
              <option value="">Select Column...</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          {activeModule === ModuleType.DUAL && (
             <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                   Industry / Activity <span className="text-red-500">*</span>
                   <span className="text-xs font-normal text-slate-400 ml-2">(Required for Dual Coding)</span>
                </label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  value={mapping.industryColumn}
                  onChange={(e) => handleChange('industryColumn', e.target.value)}
                >
                  <option value="">Select Column...</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
             </div>
          )}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
          <button 
            disabled={!isComplete}
            onClick={onConfirm}
            className="px-8 py-3 bg-blue-600 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            Start Processing <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Component: ResultsTable ---
const ResultsTable: React.FC<{
  data: ProcessedRow[];
  mapping: ColumnMapping;
  onAutoCode: () => void;
  onPauseCode: () => void;
  onRetryErrors: () => void;
  onRetryRow: (idx: number) => void;
  onBatchCode: (ids: string[]) => void;
  onManualEdit: (idx: number) => void;
  isProcessing: boolean;
  isPaused: boolean;
  onExport: () => void;
  activeModule: ModuleType;
  settings: AISettings;
  onAddToRef: (idx: number) => void;
  onBulkUpdate: (ids: string[], action: 'delete' | 'accept') => void;
}> = ({ data, mapping, onAutoCode, onPauseCode, onRetryErrors, onRetryRow, onManualEdit, isProcessing, isPaused, onExport, activeModule, onAddToRef, onBulkUpdate }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'coded' | 'error' | 'low_conf'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const rowsPerPage = 10;

  const filteredData = data.filter(row => {
    // Apply Status Filter
    let matchesFilter = true;
    if (filter === 'pending') matchesFilter = row.codingStatus === 'pending';
    if (filter === 'error') matchesFilter = row.codingStatus === 'error';
    if (filter === 'coded') matchesFilter = row.codingStatus === 'coded';
    if (filter === 'low_conf') matchesFilter = row.result?.confidence === 'Low';

    // Apply Search
    let matchesSearch = true;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = row[mapping.jobTitleColumn]?.toLowerCase().includes(q) || false;
      const matchesDesc = row[mapping.jobDescriptionColumn]?.toLowerCase().includes(q) || false;
      const matchesCode = row.result?.code?.toLowerCase().includes(q) || false;
      const matchesLabel = row.result?.label?.toLowerCase().includes(q) || false;
      matchesSearch = matchesTitle || matchesDesc || matchesCode || matchesLabel;
    }

    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const currentRows = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const getStatusColor = (status: string, conf?: string) => {
    if (status === 'error') return 'bg-red-100 text-red-700';
    if (status === 'pending') return 'bg-slate-100 text-slate-600';
    if (conf === 'High') return 'bg-emerald-100 text-emerald-700';
    if (conf === 'Medium') return 'bg-blue-100 text-blue-700';
    if (conf === 'Low') return 'bg-amber-100 text-amber-700';
    if (conf === 'Reference') return 'bg-indigo-100 text-indigo-700';
    return 'bg-slate-100 text-slate-600';
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
        setSelectedIds(new Set(currentRows.map(r => r.id)));
    } else {
        setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text"
                    placeholder="Search rows..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-64 transition-all shadow-sm"
                />
            </div>

            <div className="h-6 w-px bg-slate-300 mx-2" />

            <div className="flex items-center gap-1">
                {['all', 'pending', 'coded', 'error', 'low_conf'].map((f) => (
                    <button
                    key={f}
                    onClick={() => { setFilter(f as any); setCurrentPage(1); }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-colors ${
                        filter === f ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    >
                        {f.replace('_', ' ')}
                    </button>
                ))}
            </div>
        </div>
        <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-right-4">
                    <span className="text-xs text-slate-500 font-bold">{selectedIds.size} Selected</span>
                    <button onClick={() => { onBulkUpdate(Array.from(selectedIds), 'delete'); setSelectedIds(new Set()); }} className="text-red-600 hover:bg-red-50 p-2 rounded">
                        <TrashIcon className="w-4 h-4"/>
                    </button>
                </div>
            )}

            <button onClick={onExport} className="btn-secondary flex items-center gap-2 text-sm px-4 py-2 rounded-lg border hover:bg-slate-50 bg-white text-slate-700 font-medium shadow-sm">
               <DownloadIcon className="w-4 h-4" /> Export
            </button>
            <button 
              onClick={onRetryErrors}
              disabled={isProcessing}
              className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
               Retry Errors
            </button>
            
            {isProcessing ? (
               <button 
                 onClick={onPauseCode}
                 className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-all"
               >
                 <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                 Pause
               </button>
            ) : (
               <button 
                 onClick={onAutoCode}
                 className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
               >
                 <SparklesIcon className="w-4 h-4" />
                 {isPaused ? 'Resume Auto-Code' : 'Run Auto-Code'}
               </button>
            )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 shadow-sm">
                <tr>
                    <th className="px-4 py-3 w-8">
                        <input type="checkbox" onChange={handleSelectAll} className="rounded" />
                    </th>
                    <th className="px-6 py-3 w-16">#</th>
                    <th className="px-6 py-3">Source Data</th>
                    <th className="px-6 py-3 w-32">Code</th>
                    <th className="px-6 py-3 w-48">Label</th>
                    <th className="px-6 py-3 w-24">Conf.</th>
                    <th className="px-6 py-3 w-64">Reasoning</th>
                    <th className="px-6 py-3 w-32 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {currentRows.map((row, idx) => {
                    const globalIdx = (currentPage - 1) * rowsPerPage + idx;
                    return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-4 py-4">
                            <input 
                                type="checkbox" 
                                checked={selectedIds.has(row.id)}
                                onChange={() => handleSelectRow(row.id)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 font-mono">{globalIdx + 1}</td>
                        <td className="px-6 py-4">
                            <div className="font-bold text-slate-800 text-sm">{row[mapping.jobTitleColumn]}</div>
                            <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{row[mapping.jobDescriptionColumn]}</div>
                            {activeModule === ModuleType.DUAL && mapping.industryColumn && (
                                <div className="text-xs text-indigo-500 mt-0.5 font-medium">Ind: {row[mapping.industryColumn]}</div>
                            )}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm font-bold text-slate-700">
                            {row.result?.code || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                             {row.result?.label || '-'}
                        </td>
                        <td className="px-6 py-4">
                            {row.codingStatus === 'coded' && (
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getStatusColor(row.codingStatus, row.result?.confidence)}`}>
                                    {row.result?.confidence}
                                </span>
                            )}
                            {row.codingStatus === 'error' && <span className="text-red-500 text-xs font-bold">ERROR</span>}
                            {row.codingStatus === 'pending' && <span className="text-slate-400 text-xs">PENDING</span>}
                        </td>
                         <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate" title={row.result?.reasoning || row.errorMessage}>
                            {row.errorMessage ? <span className="text-red-500">{row.errorMessage}</span> : row.result?.reasoning}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {row.result?.confidence === 'High' && (
                                <button onClick={() => onAddToRef(globalIdx)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded" title="Learn / Add to Dictionary">
                                    <BrainIcon className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => onManualEdit(globalIdx)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                                  <EditIcon className="w-4 h-4" />
                              </button>
                              {row.codingStatus === 'error' && (
                                  <button onClick={() => onRetryRow(globalIdx)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Retry">
                                      <ZapIcon className="w-4 h-4" />
                                  </button>
                              )}
                           </div>
                        </td>
                    </tr>
                )})}
                {filteredData.length === 0 && (
                    <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400">
                           No records found matching your filter.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
         <span className="text-xs text-slate-500">
            Page {currentPage} of {totalPages || 1} ({filteredData.length} items)
         </span>
         <div className="flex gap-1">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 border rounded text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
            >
                Prev
            </button>
            <button 
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 border rounded text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
            >
                Next
            </button>
         </div>
      </div>
    </div>
  );
};

// --- Component: ManualCodingModal ---
const ManualCodingModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  row: ProcessedRow | null;
  mapping: ColumnMapping;
  activeModule: ModuleType;
  settings: AISettings;
  onSave: (result: CodedResult) => void;
}> = ({ isOpen, onClose, row, mapping, onSave, activeModule, settings }) => {
  const [formState, setFormState] = useState<CodedResult>({ code: '', label: '', confidence: 'Manual', reasoning: '' });
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const debounceRef = useRef<any>(null); // Fixed: Changed NodeJS.Timeout to any

  useEffect(() => {
    if (row && row.result) {
       setFormState(row.result);
    } else {
       setFormState({ code: '', label: '', confidence: 'Manual', reasoning: '' });
    }
    setSuggestions([]);
    setShowSuggestions(false);
  }, [row]);

  const handleLabelChange = (text: string) => {
    setFormState({...formState, label: text});
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (text.length > 2) {
        setLoadingSuggestions(true);
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await suggestCodes(text, activeModule, settings);
                setSuggestions(res);
                setShowSuggestions(true);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingSuggestions(false);
            }
        }, 500); // 500ms debounce
    } else {
        setSuggestions([]);
        setShowSuggestions(false);
        setLoadingSuggestions(false);
    }
  };

  const applySuggestion = (s: any) => {
    setFormState({ ...formState, code: s.code, label: s.label });
    setShowSuggestions(false);
  };

  if (!isOpen || !row) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
       <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
             <h3 className="font-bold text-slate-800">Manual Classification</h3>
             <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
          </div>
          
          <div className="p-6 max-h-[70vh] overflow-y-auto">
             <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                <div className="mb-2"><span className="font-bold text-slate-500 uppercase text-xs">Primary:</span> <span className="text-slate-800 font-medium">{row[mapping.jobTitleColumn]}</span></div>
                <div><span className="font-bold text-slate-500 uppercase text-xs">Secondary:</span> <span className="text-slate-600">{row[mapping.jobDescriptionColumn]}</span></div>
             </div>

             <div className="space-y-4 relative">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code</label>
                   <input 
                     value={formState.code}
                     onChange={e => setFormState({...formState, code: e.target.value})}
                     className="w-full p-2 border border-slate-300 rounded font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                   />
                </div>
                <div className="relative">
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">
                      <span>Label</span>
                      {loadingSuggestions && <span className="text-blue-500 animate-pulse">Searching...</span>}
                   </label>
                   <input 
                     value={formState.label}
                     onChange={e => handleLabelChange(e.target.value)}
                     className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                     onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                     placeholder="Type to search codes..."
                   />
                   {/* Autocomplete Dropdown */}
                   {showSuggestions && suggestions.length > 0 && (
                     <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                        {suggestions.map((s, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => applySuggestion(s)}
                                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-slate-50 last:border-none"
                            >
                                <div className="font-bold text-slate-800">{s.label}</div>
                                <div className="text-xs text-slate-500 flex justify-between">
                                    <span className="font-mono text-slate-600">{s.code}</span>
                                    {s.confidence && <span className="text-emerald-600 font-medium">{s.confidence} Match</span>}
                                </div>
                            </button>
                        ))}
                     </div>
                   )}
                </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reasoning / Note</label>
                   <textarea 
                     value={formState.reasoning}
                     onChange={e => setFormState({...formState, reasoning: e.target.value})}
                     className="w-full p-2 border border-slate-300 rounded h-20 focus:ring-2 focus:ring-blue-500 outline-none"
                   />
                </div>
             </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
             <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
             <button 
               onClick={() => { onSave({...formState, confidence: 'Manual'}); onClose(); }}
               className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm"
             >
               Save Changes
             </button>
          </div>
       </div>
    </div>
  );
};

// Helper to load settings from storage
const loadSettings = (): AISettings => {
  const saved = localStorage.getItem('statcode_ai_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Migration logic for old settings format
      if (!parsed.provider) {
         return {
            provider: parsed.mode === 'CLOUD' ? AIProvider.Gemini : AIProvider.Local,
            model: parsed.localModel || 'gemini-2.5-flash',
            baseUrl: parsed.localUrl,
            apiKey: parsed.apiKey
         };
      }
      return parsed;
    } catch (e) {
      console.error("Failed to parse settings", e);
    }
  }
  return {
    provider: AIProvider.Gemini,
    model: "gemini-2.0-flash"
  };
};

// --- Main App Component ---
export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleType | 'interactive' | 'roadmap' | 'dashboard' | 'knowledge'>(ModuleType.ISCO08);
  const [status, setStatus] = useState<CodingStatus>(CodingStatus.Idle);
  const [rawData, setRawData] = useState<RawDataRow[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ idColumn: 'id', jobTitleColumn: '', jobDescriptionColumn: '' });
  const [progress, setProgress] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  // Pause/Resume Logic
  const stopProcessingRef = useRef(false);

  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };
  
  // Manual Edit State
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

  // AI Settings State with persistence
  const [aiSettings, setAiSettings] = useState<AISettings>(loadSettings);

  // Load session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('statcode_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        // Basic validation check
        if (session.activeModule && session.rawData) {
          setActiveModule(session.activeModule);
          setStatus(session.status);
          setRawData(session.rawData);
          setProcessedData(session.processedData);
          setMapping(session.mapping);
          setSaveMessage("Session restored");
          setTimeout(() => setSaveMessage(null), 3000);
        }
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    }
  }, []);

  const saveSettings = (newSettings: AISettings) => {
    setAiSettings(newSettings);
    localStorage.setItem('statcode_ai_settings', JSON.stringify(newSettings));
  };

  // Handles module switching and resets state if user explicitly changes module
  const handleModuleSelect = (module: ModuleType | 'interactive' | 'roadmap' | 'dashboard' | 'knowledge') => {
    if (module === activeModule) return;
    
    setActiveModule(module);
    
    if (module === 'interactive' || module === 'roadmap' || module === 'dashboard' || module === 'knowledge') return;

    // Reset State for new coding task
    setStatus(CodingStatus.Idle);
    setRawData([]);
    setProcessedData([]);
    setProgress(0);
    setMapping({ idColumn: 'id', jobTitleColumn: '', jobDescriptionColumn: '' });
  };

  const handleSaveSession = () => {
    if (activeModule === 'interactive' || activeModule === 'roadmap' || activeModule === 'dashboard' || activeModule === 'knowledge') return;
    const sessionData = {
      activeModule,
      status,
      rawData,
      processedData,
      mapping,
      timestamp: Date.now()
    };
    localStorage.setItem('statcode_session', JSON.stringify(sessionData));
    setSaveMessage("Session saved successfully");
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleClearSession = () => {
    if (window.confirm("Are you sure you want to clear the current session? All unsaved progress will be lost.")) {
      localStorage.removeItem('statcode_session');
      // Reset State
      if (activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard' && activeModule !== 'knowledge') {
        setStatus(CodingStatus.Idle);
        setRawData([]);
        setProcessedData([]);
        setProgress(0);
        setMapping({ idColumn: 'id', jobTitleColumn: '', jobDescriptionColumn: '' });
      }
      setSaveMessage("Session cleared");
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

  const handleFileUpload = (data: RawDataRow[]) => {
    setRawData(data);
    setStatus(CodingStatus.Mapping);
  };

  const handleMappingConfirm = () => {
    const initData: ProcessedRow[] = rawData.map(row => ({
      ...row,
      codingStatus: 'pending'
    }));
    setProcessedData(initData);
    setStatus(CodingStatus.Review);
  };

  // Improved Bulk Update for "Workflow"
  const handleBulkUpdate = (ids: string[], action: 'delete' | 'accept') => {
      const idSet = new Set(ids);
      const newData = processedData.filter(row => {
          if (action === 'delete') return !idSet.has(row.id);
          return true;
      });

      if (action === 'accept') {
          // Logic for 'accept' would typically move them to a 'Verified' state, currently just ensuring they are kept.
          // For now, let's say 'accept' means marking confidence as 'Manual' (Verified)
          newData.forEach(row => {
              if (idSet.has(row.id) && row.result) {
                  row.result.confidence = 'Manual'; 
                  row.codingStatus = 'coded';
              }
          });
      }

      setProcessedData(newData);
  };

  // Non-blocking processing loop (Simulates Worker Performance)
  const processRows = async (indicesToProcess: number[]) => {
    if (indicesToProcess.length === 0 || activeModule === 'interactive' || activeModule === 'roadmap' || activeModule === 'dashboard' || activeModule === 'knowledge') return;
    
    stopProcessingRef.current = false;
    setStatus(CodingStatus.Processing);
    setProgress(0);

    const batchSize = 3; 
    let completed = 0;
    const total = indicesToProcess.length;

    // We process directly on state updates to allow partial UI refreshes
    // But we avoid setting state too often to prevent lag
    let currentData = [...processedData];

    for (let i = 0; i < total; i += batchSize) {
      if (stopProcessingRef.current) {
        setStatus(CodingStatus.Paused);
        return;
      }

      // Yield to main thread to keep UI responsive (Simulate Worker)
      await new Promise(resolve => setTimeout(resolve, 0));

      const batchIndices = indicesToProcess.slice(i, i + batchSize);
      
      const promises = batchIndices.map(async (idx) => {
        const row = currentData[idx];
        const primary = row[mapping.jobTitleColumn];
        const secondary = mapping.jobDescriptionColumn ? row[mapping.jobDescriptionColumn] : '';
        const tertiary = mapping.industryColumn ? row[mapping.industryColumn] : undefined;
        
        // Mark as pending
        currentData[idx] = { ...row, codingStatus: 'pending', errorMessage: undefined };

        try {
          // 1. Check Local Dictionary (IndexedDB)
          const refMatch = await findReferenceMatch(primary, activeModule as ModuleType);
          
          if (refMatch) {
             currentData[idx] = { 
               ...row, 
               codingStatus: 'coded', 
               result: {
                 code: refMatch.code,
                 label: refMatch.label,
                 confidence: 'Reference',
                 reasoning: 'Matched exactly with local dictionary entry.'
               }, 
               errorMessage: undefined 
             };
          } else {
             // 2. RAG: Find similar examples
             const similarExamples = await findSimilarReferences(primary, activeModule as ModuleType);

             // 3. Call AI with Few-Shot Context
             const result = await codeSingleOccupation(
                 primary, 
                 secondary, 
                 activeModule as ModuleType, 
                 aiSettings, 
                 tertiary, 
                 similarExamples // Pass RAG examples
             );
             currentData[idx] = { ...row, codingStatus: 'coded', result, errorMessage: undefined };
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          currentData[idx] = { ...row, codingStatus: 'error', errorMessage: msg };
        }
      });

      await Promise.all(promises);
      
      completed += batchIndices.length;
      setProgress((completed / total) * 100);
      
      // Update state every 2 batches or at end to reduce re-renders
      if (i % (batchSize * 2) === 0 || i + batchSize >= total) {
          setProcessedData([...currentData]);
      }
    }

    setStatus(CodingStatus.Review);
  };

  const handleAutoCode = async () => {
    if (status === CodingStatus.Processing) return;
    // Identify all pending rows
    const uncodedIndices = processedData
      .map((row, index) => row.codingStatus === 'pending' ? index : -1)
      .filter(idx => idx !== -1);
    
    await processRows(uncodedIndices);
  };

  const handlePauseCode = () => {
    stopProcessingRef.current = true;
  };

  const handleRetryErrors = async () => {
    if (status === CodingStatus.Processing) return;
    // Identify all error rows
    const errorIndices = processedData
      .map((row, index) => row.codingStatus === 'error' ? index : -1)
      .filter(idx => idx !== -1);
    
    await processRows(errorIndices);
  };

  const handleRetrySingleRow = async (index: number) => {
     if (status === CodingStatus.Processing) return;
     await processRows([index]);
  };

  const handleBatchCode = async (ids: string[]) => {
    if (status === CodingStatus.Processing) return;
    // Map IDs to indices
    const indicesToProcess: number[] = [];
    const entries = processedData.map((row, idx) => [row.id, idx] as [string, number]);
    const idMap = new Map<string, number>(entries);
    
    ids.forEach(id => {
      const idx = idMap.get(id);
      if (idx !== undefined) indicesToProcess.push(idx);
    });

    await processRows(indicesToProcess);
  }

  const handleManualSave = (result: CodedResult) => {
    if (editingRowIndex === null) return;
    
    const newData = [...processedData];
    newData[editingRowIndex] = {
      ...newData[editingRowIndex],
      codingStatus: 'coded',
      result,
      errorMessage: undefined,
      manuallyEdited: true
    };
    setProcessedData(newData);
  };

  // Add a specific result to the local DB (Learning)
  const handleAddToRef = async (idx: number) => {
    const row = processedData[idx];
    if (!row.result) return;
    
    const entry: ReferenceEntry = {
        id: crypto.randomUUID(),
        module: activeModule as ModuleType,
        term: row[mapping.jobTitleColumn],
        code: row.result.code,
        label: row.result.label,
        description: row.result.reasoning,
        source: 'learned',
        addedAt: Date.now()
    };

    await addReferenceEntries([entry]);
    setSaveMessage(`Added "${entry.term}" to Dictionary`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleExport = () => {
    const exportData = processedData.map(row => ({
        ...row,
        Code: row.result?.code || '',
        Label: row.result?.label || '',
        Confidence: row.result?.confidence || '',
        Reasoning: row.result?.reasoning || '',
        Edited: row.manuallyEdited ? 'Yes' : 'No',
        Error: row.errorMessage || ''
    }));
    const filename = typeof activeModule === 'string' ? `coded_results_${activeModule.replace(/ /g, '_')}.csv` : 'coded_results.csv';
    exportToCSV(exportData, filename);
  };

  // Data Safety Indicator Logic
  const getPrivacyShield = () => {
      if (aiSettings.provider === AIProvider.Local) {
          return { color: 'text-emerald-400', label: 'Strict Privacy (Local AI)' };
      }
      return { color: 'text-amber-400', label: 'Standard Privacy (Cloud AI)' };
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar 
        activeModule={activeModule} 
        onModuleSelect={handleModuleSelect}
        onOpenSettings={() => setShowSettings(true)}
        currentProvider={aiSettings.provider}
        onSaveSession={handleSaveSession}
        onClearSession={handleClearSession}
        canInstall={!!deferredPrompt}
        onInstall={handleInstallClick}
      />
      
      <div className="flex-1 ml-64 flex flex-col">
        {/* Pass props to status bar if needed, or keeping it static for now as per previous design */}
        <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
          {activeModule === 'interactive' || activeModule === 'roadmap' || activeModule === 'dashboard' || activeModule === 'knowledge' ? (
             <div className="flex items-center gap-4">
                <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                    activeModule === 'interactive' ? 'bg-amber-100 text-amber-700' :
                    activeModule === 'dashboard' ? 'bg-emerald-100 text-emerald-700' :
                    activeModule === 'knowledge' ? 'bg-blue-100 text-blue-700' :
                    'bg-purple-100 text-purple-700'
                }`}>
                    {activeModule === 'interactive' ? 'Interactive Mode' : activeModule === 'dashboard' ? 'Analytics Dashboard' : activeModule === 'knowledge' ? 'Knowledge Base' : 'Project Management'}
                </div>
             </div>
          ) : (
             <div className="flex items-center gap-4">
                <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                  status === CodingStatus.Idle ? 'bg-slate-100 text-slate-600' :
                  status === CodingStatus.Processing ? 'bg-amber-100 text-amber-700 animate-pulse' :
                  status === CodingStatus.Paused ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {status}
                </div>
                <span className="text-sm font-medium text-slate-800 border-l border-slate-200 pl-4">
                  Module: {activeModule}
                </span>
                {status === CodingStatus.Processing && (
                  <span className="text-sm text-slate-500">Processing batch job...</span>
                )}
                {status === CodingStatus.Paused && (
                  <span className="text-sm text-orange-600 font-bold">Job Paused</span>
                )}
             </div>
          )}
          
          <div className="flex items-center gap-4">
            {/* Privacy Shield Indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 rounded-full shadow-inner" title={getPrivacyShield().label}>
                <div className={`w-2 h-2 rounded-full ${getPrivacyShield().color === 'text-emerald-400' ? 'bg-emerald-400' : 'bg-amber-400'}`}></div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${getPrivacyShield().color}`}>
                    {aiSettings.provider === AIProvider.Local ? 'Local Mode' : 'Cloud Mode'}
                </span>
            </div>

            {status === CodingStatus.Processing || status === CodingStatus.Paused ? (
              <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ease-out ${status === CodingStatus.Paused ? 'bg-orange-400' : 'bg-blue-600'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : (
              <button 
                onClick={() => setShowHelp(!showHelp)}
                className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 text-sm font-medium"
              >
                <HelpCircleIcon className="w-4 h-4" />
                Module Info
              </button>
            )}
          </div>
        </div>

        <main className="flex-1 relative">
          
          {/* Toast Notification */}
          {saveMessage && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-800 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-4">
              {saveMessage}
            </div>
          )}

          {/* Help / Info Popover */}
          {showHelp && activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard' && activeModule !== 'knowledge' && (
             <div className="absolute top-4 right-8 z-30 w-80 bg-white rounded-xl shadow-xl border border-slate-100 p-6 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                    <HelpCircleIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{MODULE_DETAILS[activeModule as ModuleType].name}</h3>
                    <p className="text-xs text-slate-500">Module Information</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                  {MODULE_DETAILS[activeModule as ModuleType].description}
                </p>
                <a 
                  href={MODULE_DETAILS[activeModule as ModuleType].url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  View Official Documentation
                  <ExternalLinkIcon className="w-3 h-3" />
                </a>
                <button 
                  onClick={() => setShowHelp(false)}
                  className="absolute top-2 right-2 text-slate-300 hover:text-slate-500"
                >
                  &times;
                </button>
             </div>
          )}

          {activeModule === 'interactive' && (
              <InteractiveMode settings={aiSettings} />
          )}

          {activeModule === 'roadmap' && (
              <RoadmapView />
          )}

          {activeModule === 'knowledge' && (
              <KnowledgeBaseView />
          )}

          {activeModule === 'dashboard' && (
              <DashboardView data={processedData} mapping={mapping} />
          )}

          {/* Content Switching for Coding Modules */}
          {activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard' && activeModule !== 'knowledge' && status === CodingStatus.Idle && (
            <div className="h-full flex flex-col items-center justify-center pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8 p-4 bg-blue-50 rounded-full text-blue-600">
                <DatabaseIcon className="w-12 h-12" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Start New {activeModule} Session</h1>
              <p className="text-slate-500 mb-8 max-w-md text-center">
                Begin by uploading your raw dataset. We support CSV, Excel (.xlsx) and OpenDocument (.ods).
              </p>
              
              {/* Mode Indicator in Idle Screen */}
              <div className="mb-6 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 bg-slate-100 text-slate-600 border border-slate-200">
                <BrainIcon className="w-4 h-4" />
                Current Engine: <span className="text-slate-900 font-bold">{aiSettings.model}</span> 
                <span className="text-xs ml-1 text-slate-400">({aiSettings.provider})</span>
              </div>

              <div className="w-full max-w-2xl">
                <FileUpload onFileUpload={handleFileUpload} />
              </div>
            </div>
          )}

          {activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard' && activeModule !== 'knowledge' && status === CodingStatus.Mapping && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <DataMapping 
                headers={rawData.length > 0 ? Object.keys(rawData[0]).filter(k => k !== 'id') : []} 
                mapping={mapping}
                setMapping={setMapping}
                onConfirm={handleMappingConfirm}
                activeModule={activeModule as ModuleType}
              />
            </div>
          )}

          {activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard' && activeModule !== 'knowledge' && (status === CodingStatus.Review || status === CodingStatus.Processing || status === CodingStatus.Paused) && (
            <ResultsTable 
              data={processedData}
              mapping={mapping}
              onAutoCode={handleAutoCode}
              onPauseCode={handlePauseCode}
              onRetryErrors={handleRetryErrors}
              onRetryRow={handleRetrySingleRow}
              onBatchCode={handleBatchCode}
              onManualEdit={(idx) => setEditingRowIndex(idx)}
              isProcessing={status === CodingStatus.Processing}
              isPaused={status === CodingStatus.Paused}
              onExport={handleExport}
              activeModule={activeModule as ModuleType}
              settings={aiSettings}
              onAddToRef={handleAddToRef}
              onBulkUpdate={handleBulkUpdate}
            />
          )}
        </main>

        {/* Modals */}
        <SettingsModal 
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)}
          settings={aiSettings}
          onSave={saveSettings}
        />

        {activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard' && activeModule !== 'knowledge' && (
            <ManualCodingModal 
            isOpen={editingRowIndex !== null}
            onClose={() => setEditingRowIndex(null)}
            row={editingRowIndex !== null ? processedData[editingRowIndex] : null}
            mapping={mapping}
            activeModule={activeModule as ModuleType}
            settings={aiSettings}
            onSave={handleManualSave}
            />
        )}

      </div>
    </div>
  );
}
