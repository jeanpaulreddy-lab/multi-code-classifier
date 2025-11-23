import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CodingStatus, RawDataRow, ProcessedRow, ColumnMapping, ModuleType, AIProvider, AISettings, SearchResult, CodedResult } from './types';
import { parseDataFile, exportToCSV } from './utils/csvHelper';
import { codeSingleOccupation, searchClassification, suggestCodes } from './services/geminiService';
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
    name: "Dual Coding (ISCO+ISIC)",
    fullTitle: "Simultaneous ISCO-08 and ISIC Rev. 4 Coding",
    description: "A specialized module that codes both the occupation (ISCO) and the industry activity (ISIC) from the same input record, considering the relationship between job title and economic activity.",
    url: "#"
  }
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

       {/* Detail Modal */}
       {selectedItem && (
         <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4" onClick={() => setSelectedItem(null)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
               <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-2">
                     <span className="bg-slate-200 text-slate-700 font-mono font-bold text-xs px-2 py-1 rounded">{selectedItem.id}</span>
                     <h3 className="font-bold text-slate-800">{selectedItem.title}</h3>
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
               </div>
               <div className="p-6">
                  <div className="mb-6">
                     <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">User Story</h4>
                     <p className="text-slate-700 italic bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                        "{selectedItem.story}"
                     </p>
                  </div>
                  <div>
                     <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Acceptance Criteria</h4>
                     <ul className="space-y-2">
                        {selectedItem.ac.map((criteria, idx) => (
                           <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                              <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                              <span>{criteria}</span>
                           </li>
                        ))}
                     </ul>
                  </div>
               </div>
               <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                  <button 
                    onClick={() => setSelectedItem(null)}
                    className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
                  >
                    Close
                  </button>
               </div>
            </div>
         </div>
       )}
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
        defaultModel = 'gemini-2.5-flash';
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
        defaultBaseUrl = 'http://localhost:11434/v1/chat/completions';
        break;
    }

    setLocalSettings(prev => ({
      ...prev,
      provider,
      model: defaultModel,
      baseUrl: defaultBaseUrl,
      apiKey: provider === AIProvider.Gemini ? '' : prev.apiKey // Clear key if switching back to Gemini default
    }));
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
        // Construct a minimal test payload
        // Gemini uses a different library, so if Gemini is selected, we assume it works if we have a key (env or user)
        // For others, we ping the URL.
        if (localSettings.provider === AIProvider.Gemini) {
           // Simple simulation for Gemini, as the client library handles connection
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
                <input 
                  type="text" 
                  value={localSettings.model}
                  onChange={(e) => setLocalSettings({...localSettings, model: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {localSettings.provider === AIProvider.Local && <p className="text-xs text-slate-400 mt-1">e.g., qwen2.5:7b, llama3, mistral</p>}
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
                   placeholder={localSettings.provider === AIProvider.OpenAI ? "https://api.openai.com/v1/chat/completions" : "http://localhost:11434/v1/chat/completions"}
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                 />
               </div>
             )}

             <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                   {localSettings.provider === AIProvider.Gemini ? "API Key (Optional Override)" : "API Key"}
                </label>
                <input 
                  type="password" 
                  value={localSettings.apiKey || ''}
                  onChange={(e) => setLocalSettings({...localSettings, apiKey: e.target.value})}
                  placeholder={localSettings.provider === AIProvider.Gemini ? "Leave empty to use default env key" : "sk-..."}
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
  activeModule: ModuleType | 'interactive' | 'roadmap' | 'dashboard'; 
  onModuleSelect: (m: ModuleType | 'interactive' | 'roadmap' | 'dashboard') => void;
  onOpenSettings: () => void;
  currentProvider: AIProvider;
  onSaveSession: () => void;
  onClearSession: () => void;
  canInstall: boolean;
  onInstall: () => void;
}> = ({ activeModule, onModuleSelect, onOpenSettings, currentProvider, onSaveSession, onClearSession, canInstall, onInstall }) => {
  const [hoveredModule, setHoveredModule] = useState<ModuleType | 'interactive' | 'roadmap' | 'dashboard' | null>(null);

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
          v1.8.0 &bull; {getProviderName(currentProvider)}
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

// --- Component: DashboardView ---
const DashboardView: React.FC<{ data: ProcessedRow[]; mapping: ColumnMapping }> = ({ data, mapping }) => {
  const total = data.length;
  const coded = data.filter(r => r.codingStatus === 'coded').length;
  const pending = data.filter(r => r.codingStatus === 'pending').length;
  const error = data.filter(r => r.codingStatus === 'error').length;
  const highConf = data.filter(r => r.result?.confidence === 'High').length;
  
  const completionRate = total > 0 ? Math.round((coded / total) * 100) : 0;
  const qualityScore = coded > 0 ? Math.round((highConf / coded) * 100) : 0;

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

       {/* Simple distribution bar */}
       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-700 mb-6">Confidence Distribution</h3>
          <div className="flex items-end h-40 gap-4">
             {['High', 'Medium', 'Low'].map(lvl => {
                const count = data.filter(r => r.result?.confidence === lvl).length;
                const pct = coded > 0 ? (count / coded) * 100 : 0;
                return (
                   <div key={lvl} className="flex-1 flex flex-col justify-end items-center group">
                      <div className="text-xs font-bold text-slate-600 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">{count}</div>
                      <div 
                        className={`w-full rounded-t-md transition-all duration-500 ${lvl === 'High' ? 'bg-emerald-500' : lvl === 'Medium' ? 'bg-blue-500' : 'bg-amber-500'}`} 
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
      alert("Error parsing file. Ensure it is a valid CSV or Excel file.");
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
      <p className="text-slate-500 mb-6">Drag and drop your CSV or Excel file here, or click to browse.</p>
      
      <label className="inline-block">
        <input 
          type="file" 
          accept=".csv, .xlsx, .xls" 
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
  onRetryErrors: () => void;
  onRetryRow: (idx: number) => void;
  onBatchCode: (ids: string[]) => void;
  onManualEdit: (idx: number) => void;
  isProcessing: boolean;
  onExport: () => void;
  activeModule: ModuleType;
  settings: AISettings;
}> = ({ data, mapping, onAutoCode, onRetryErrors, onRetryRow, onManualEdit, isProcessing, onExport, activeModule }) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'coded' | 'error' | 'low_conf'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const filteredData = data.filter(row => {
    if (filter === 'all') return true;
    if (filter === 'pending') return row.codingStatus === 'pending';
    if (filter === 'error') return row.codingStatus === 'error';
    if (filter === 'coded') return row.codingStatus === 'coded';
    if (filter === 'low_conf') return row.result?.confidence === 'Low';
    return true;
  });

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const currentRows = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const getStatusColor = (status: string, conf?: string) => {
    if (status === 'error') return 'bg-red-100 text-red-700';
    if (status === 'pending') return 'bg-slate-100 text-slate-600';
    if (conf === 'High') return 'bg-emerald-100 text-emerald-700';
    if (conf === 'Medium') return 'bg-blue-100 text-blue-700';
    if (conf === 'Low') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600 mr-2">Filter:</span>
            {['all', 'pending', 'coded', 'error', 'low_conf'].map((f) => (
                <button
                   key={f}
                   onClick={() => setFilter(f as any)}
                   className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-colors ${
                      filter === f ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                   }`}
                >
                    {f.replace('_', ' ')}
                </button>
            ))}
        </div>
        <div className="flex items-center gap-3">
            <button onClick={onExport} className="btn-secondary flex items-center gap-2 text-sm px-4 py-2 rounded-lg border hover:bg-slate-50">
               <DownloadIcon className="w-4 h-4" /> Export
            </button>
            <button 
              onClick={onRetryErrors}
              disabled={isProcessing}
              className="text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
               Retry Errors
            </button>
            <button 
              onClick={onAutoCode}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
               <SparklesIcon className="w-4 h-4" />
               {isProcessing ? 'Processing...' : 'Run Auto-Code'}
            </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 shadow-sm">
                <tr>
                    <th className="px-6 py-3 w-16">#</th>
                    <th className="px-6 py-3">Source Data</th>
                    <th className="px-6 py-3 w-32">Code</th>
                    <th className="px-6 py-3 w-48">Label</th>
                    <th className="px-6 py-3 w-24">Conf.</th>
                    <th className="px-6 py-3 w-64">Reasoning</th>
                    <th className="px-6 py-3 w-24 text-right">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {currentRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4 text-xs text-slate-400 font-mono">{(currentPage - 1) * rowsPerPage + idx + 1}</td>
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
                              <button onClick={() => onManualEdit((currentPage - 1) * rowsPerPage + idx)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                  <EditIcon className="w-4 h-4" />
                              </button>
                              {row.codingStatus === 'error' && (
                                  <button onClick={() => onRetryRow((currentPage - 1) * rowsPerPage + idx)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                      <ZapIcon className="w-4 h-4" />
                                  </button>
                              )}
                           </div>
                        </td>
                    </tr>
                ))}
                {filteredData.length === 0 && (
                    <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                           No records found for this filter.
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
}> = ({ isOpen, onClose, row, mapping, onSave }) => {
  const [formState, setFormState] = useState<CodedResult>({ code: '', label: '', confidence: 'Manual', reasoning: '' });

  useEffect(() => {
    if (row && row.result) {
       setFormState(row.result);
    } else {
       setFormState({ code: '', label: '', confidence: 'Manual', reasoning: '' });
    }
  }, [row]);

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

             <div className="space-y-4">
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Code</label>
                   <input 
                     value={formState.code}
                     onChange={e => setFormState({...formState, code: e.target.value})}
                     className="w-full p-2 border border-slate-300 rounded font-mono"
                   />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Label</label>
                   <input 
                     value={formState.label}
                     onChange={e => setFormState({...formState, label: e.target.value})}
                     className="w-full p-2 border border-slate-300 rounded"
                   />
                </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reasoning / Note</label>
                   <textarea 
                     value={formState.reasoning}
                     onChange={e => setFormState({...formState, reasoning: e.target.value})}
                     className="w-full p-2 border border-slate-300 rounded h-20"
                   />
                </div>
             </div>
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
             <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
             <button 
               onClick={() => { onSave({...formState, confidence: 'Manual'}); onClose(); }}
               className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
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
    model: "gemini-2.5-flash"
  };
};

// --- Main App Component ---
export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleType | 'interactive' | 'roadmap' | 'dashboard'>(ModuleType.ISCO08);
  const [status, setStatus] = useState<CodingStatus>(CodingStatus.Idle);
  const [rawData, setRawData] = useState<RawDataRow[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ idColumn: 'id', jobTitleColumn: '', jobDescriptionColumn: '' });
  const [progress, setProgress] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
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
  const handleModuleSelect = (module: ModuleType | 'interactive' | 'roadmap' | 'dashboard') => {
    if (module === activeModule) return;
    
    setActiveModule(module);
    
    if (module === 'interactive' || module === 'roadmap' || module === 'dashboard') return;

    // Reset State for new coding task
    setStatus(CodingStatus.Idle);
    setRawData([]);
    setProcessedData([]);
    setProgress(0);
    setMapping({ idColumn: 'id', jobTitleColumn: '', jobDescriptionColumn: '' });
  };

  const handleSaveSession = () => {
    if (activeModule === 'interactive' || activeModule === 'roadmap' || activeModule === 'dashboard') return;
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
      if (activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard') {
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

  // Core batch processing logic used by both AutoCode and Retry
  const processRows = async (indicesToProcess: number[]) => {
    if (indicesToProcess.length === 0 || activeModule === 'interactive' || activeModule === 'roadmap' || activeModule === 'dashboard') return;
    
    setStatus(CodingStatus.Processing);
    setProgress(0);

    const batchSize = 3; 
    let completed = 0;
    const total = indicesToProcess.length;

    // Work on a copy of the data
    const newData = [...processedData];

    for (let i = 0; i < total; i += batchSize) {
      const batchIndices = indicesToProcess.slice(i, i + batchSize);
      
      const promises = batchIndices.map(async (idx) => {
        const row = newData[idx];
        const primary = row[mapping.jobTitleColumn];
        const secondary = mapping.jobDescriptionColumn ? row[mapping.jobDescriptionColumn] : '';
        const tertiary = mapping.industryColumn ? row[mapping.industryColumn] : undefined;
        
        // Set temporary state to pending for UI feedback
        newData[idx] = { ...row, codingStatus: 'pending', errorMessage: undefined };

        try {
          const result = await codeSingleOccupation(primary, secondary, activeModule as ModuleType, aiSettings, tertiary);
          newData[idx] = { ...row, codingStatus: 'coded', result, errorMessage: undefined };
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          newData[idx] = { ...row, codingStatus: 'error', errorMessage: msg };
        }
      });

      await Promise.all(promises);
      
      completed += batchIndices.length;
      setProgress((completed / total) * 100);
      
      // Update state after every batch to visualize progress
      setProcessedData([...newData]);
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
    const idMap = new Map(processedData.map((row, idx) => [row.id, idx]));
    
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
          {activeModule === 'interactive' || activeModule === 'roadmap' || activeModule === 'dashboard' ? (
             <div className="flex items-center gap-4">
                <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                    activeModule === 'interactive' ? 'bg-amber-100 text-amber-700' :
                    activeModule === 'dashboard' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-purple-100 text-purple-700'
                }`}>
                    {activeModule === 'interactive' ? 'Interactive Mode' : activeModule === 'dashboard' ? 'Analytics Dashboard' : 'Project Management'}
                </div>
             </div>
          ) : (
             <div className="flex items-center gap-4">
                <div className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                  status === CodingStatus.Idle ? 'bg-slate-100 text-slate-600' :
                  status === CodingStatus.Processing ? 'bg-amber-100 text-amber-700 animate-pulse' :
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
             </div>
          )}
          
          <div className="flex items-center gap-4">
            {status === CodingStatus.Processing ? (
              <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300 ease-out"
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
          {showHelp && activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard' && (
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

          {activeModule === 'dashboard' && (
              <DashboardView data={processedData} mapping={mapping} />
          )}

          {/* Content Switching for Coding Modules */}
          {activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard' && status === CodingStatus.Idle && (
            <div className="h-full flex flex-col items-center justify-center pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-8 p-4 bg-blue-50 rounded-full text-blue-600">
                <DatabaseIcon className="w-12 h-12" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Start New {activeModule} Session</h1>
              <p className="text-slate-500 mb-8 max-w-md text-center">
                Begin by uploading your raw dataset. We support CSV and Excel (.xlsx).
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

          {activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard' && status === CodingStatus.Mapping && (
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

          {activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard' && (status === CodingStatus.Review || status === CodingStatus.Processing) && (
            <ResultsTable 
              data={processedData}
              mapping={mapping}
              onAutoCode={handleAutoCode}
              onRetryErrors={handleRetryErrors}
              onRetryRow={handleRetrySingleRow}
              onBatchCode={handleBatchCode}
              onManualEdit={(idx) => setEditingRowIndex(idx)}
              isProcessing={status === CodingStatus.Processing}
              onExport={handleExport}
              activeModule={activeModule as ModuleType}
              settings={aiSettings}
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

        {activeModule !== 'interactive' && activeModule !== 'roadmap' && activeModule !== 'dashboard' && (
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