import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CodingStatus, RawDataRow, ProcessedRow, ColumnMapping, ModuleType, ProcessingMode, AISettings, SearchResult, CodedResult } from './types';
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

// --- Component: Dashboard / Analytics View ---
const DashboardView: React.FC<{ data: ProcessedRow[], mapping: ColumnMapping }> = ({ data, mapping }) => {
  
  // Metrics Calculation
  const total = data.length;
  const coded = data.filter(r => r.codingStatus === 'coded').length;
  const errors = data.filter(r => r.codingStatus === 'error').length;
  const manual = data.filter(r => r.manuallyEdited).length;
  
  const highConf = data.filter(r => r.result?.confidence === 'High').length;
  const medConf = data.filter(r => r.result?.confidence === 'Medium').length;
  const lowConf = data.filter(r => r.result?.confidence === 'Low').length;

  const avgConfidence = coded > 0 
    ? Math.round(((highConf * 100) + (medConf * 75) + (lowConf * 50)) / coded) 
    : 0;

  // Top Codes
  const codeFrequency: Record<string, { count: number, label: string }> = {};
  data.forEach(row => {
    if (row.codingStatus === 'coded' && row.result) {
      const code = row.result.code;
      if (!codeFrequency[code]) codeFrequency[code] = { count: 0, label: row.result.label };
      codeFrequency[code].count++;
    }
  });
  const topCodes = Object.entries(codeFrequency)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  // Low Confidence Watchlist
  const lowConfItems = data
    .filter(r => r.result?.confidence === 'Low' || r.codingStatus === 'error')
    .slice(0, 10);

  if (total === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-12 text-center">
            <div className="p-6 bg-slate-100 rounded-full mb-4 text-slate-400">
                <BarChartIcon className="w-12 h-12" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">No Data Available</h2>
            <p className="text-slate-500 mt-2">Start a session and process data to view analytics.</p>
        </div>
      )
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 p-8 overflow-y-auto custom-scrollbar">
        <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <PieChartIcon className="w-6 h-6 text-blue-600" />
                Analytics Dashboard
            </h2>
            <p className="text-slate-500">Real-time insights on coding accuracy and distribution.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Processed</p>
                        <h3 className="text-3xl font-bold text-slate-800 mt-1">{coded} <span className="text-sm text-slate-400 font-normal">/ {total}</span></h3>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><DatabaseIcon className="w-5 h-5" /></div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full" style={{ width: `${(coded/total)*100}%` }}></div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg. Confidence</p>
                        <h3 className="text-3xl font-bold text-slate-800 mt-1">{avgConfidence}%</h3>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><TrendingUpIcon className="w-5 h-5" /></div>
                </div>
                <p className="text-xs text-slate-500">Weighted score based on model certainty.</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Manual Edits</p>
                        <h3 className="text-3xl font-bold text-slate-800 mt-1">{manual}</h3>
                    </div>
                    <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><EditIcon className="w-5 h-5" /></div>
                </div>
                <p className="text-xs text-slate-500">{((manual/total)*100).toFixed(1)}% of total records edited.</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Errors / Low Conf</p>
                        <h3 className="text-3xl font-bold text-slate-800 mt-1">{errors + lowConf}</h3>
                    </div>
                    <div className="p-2 bg-red-50 rounded-lg text-red-600"><AlertTriangleIcon className="w-5 h-5" /></div>
                </div>
                <p className="text-xs text-slate-500">Items requiring attention.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Confidence Distribution */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <BarChartIcon className="w-4 h-4 text-slate-400" />
                    Confidence Distribution
                </h3>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-green-700">High Confidence</span>
                            <span className="text-slate-600">{highConf}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                            <div className="bg-green-500 h-full rounded-full" style={{ width: `${total ? (highConf/total)*100 : 0}%` }}></div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-yellow-700">Medium Confidence</span>
                            <span className="text-slate-600">{medConf}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                            <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${total ? (medConf/total)*100 : 0}%` }}></div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-orange-700">Low Confidence</span>
                            <span className="text-slate-600">{lowConf}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                            <div className="bg-orange-500 h-full rounded-full" style={{ width: `${total ? (lowConf/total)*100 : 0}%` }}></div>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-slate-700">Manual / Errors</span>
                            <span className="text-slate-600">{manual + errors}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                            <div className="bg-slate-500 h-full rounded-full" style={{ width: `${total ? ((manual+errors)/total)*100 : 0}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Codes */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <TagIcon className="w-4 h-4 text-slate-400" />
                    Most Frequent Codes
                </h3>
                <div className="overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 font-semibold">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Code</th>
                                <th className="px-4 py-3">Label</th>
                                <th className="px-4 py-3 text-right rounded-r-lg">Count</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {topCodes.map(([code, data]) => (
                                <tr key={code} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">{code}</td>
                                    <td className="px-4 py-3 text-slate-700 truncate max-w-[200px]">{data.label}</td>
                                    <td className="px-4 py-3 text-right font-medium">{data.count}</td>
                                </tr>
                            ))}
                            {topCodes.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic">No codes assigned yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* Watchlist */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-red-600">
                <AlertTriangleIcon className="w-4 h-4" />
                Low Confidence Watchlist
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lowConfItems.length > 0 ? lowConfItems.map((row) => (
                    <div key={row.id} className="p-3 bg-red-50 rounded-lg border border-red-100 flex justify-between items-start">
                        <div>
                            <div className="font-medium text-slate-900 text-sm">{row[mapping.jobTitleColumn]}</div>
                            <div className="text-xs text-red-500 mt-1">
                                {row.codingStatus === 'error' ? 'Error: ' + row.errorMessage : `Low Confidence (${row.result?.code})`}
                            </div>
                        </div>
                        {row.result && <span className="text-xs font-mono bg-white px-2 py-1 rounded border border-red-200 text-slate-600">{row.result.code}</span>}
                    </div>
                )) : (
                    <div className="col-span-2 text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        Great job! No low confidence items detected.
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

// --- Component: Interactive Mode (Auto-Suggest & API Playground) ---
const InteractiveMode: React.FC<{ settings: AISettings }> = ({ settings }) => {
  const [activeTab, setActiveTab] = useState<'suggest' | 'api'>('suggest');
  
  // Suggest State
  const [suggestInput, setSuggestInput] = useState('');
  const [suggestions, setSuggestions] = useState<{code: string, label: string, confidence: string}[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // API State
  const [apiJsonInput, setApiJsonInput] = useState('{\n  "title": "Software Engineer",\n  "description": "Developing react applications"\n}');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  // Debounce logic for suggestions
  useEffect(() => {
    const timer = setTimeout(async () => {
        if (suggestInput.length > 2) {
            setIsSuggesting(true);
            const results = await suggestCodes(suggestInput, ModuleType.ISCO08, settings);
            setSuggestions(results);
            setIsSuggesting(false);
        } else {
            setSuggestions([]);
        }
    }, 500);
    return () => clearTimeout(timer);
  }, [suggestInput, settings]);

  const handleApiSimulate = async () => {
    setApiLoading(true);
    setApiResponse(null);
    try {
        const parsed = JSON.parse(apiJsonInput);
        const title = parsed.title || "";
        const desc = parsed.description || "";
        
        // Call the service directly to simulate an API hit
        const result = await codeSingleOccupation(title, desc, ModuleType.ISCO08, settings);
        
        // Simulate network delay for realism
        setTimeout(() => {
             setApiResponse(JSON.stringify(result, null, 2));
             setApiLoading(false);
        }, 800);
    } catch (e) {
        setApiResponse(JSON.stringify({ error: "Invalid JSON input or API failure" }, null, 2));
        setApiLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 p-8">
        <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <ZapIcon className="w-6 h-6 text-amber-500" />
                Interactive & API Playground
            </h2>
            <p className="text-slate-500">Test real-time coding capabilities and API integrations.</p>
        </div>

        <div className="flex gap-4 mb-6">
            <button 
                onClick={() => setActiveTab('suggest')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'suggest' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}
            >
                <SparklesIcon className="w-4 h-4" />
                Auto-Suggest Demo
            </button>
            <button 
                onClick={() => setActiveTab('api')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'api' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}
            >
                <TerminalIcon className="w-4 h-4" />
                API Tester
            </button>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-hidden">
            {activeTab === 'suggest' && (
                <div className="max-w-xl mx-auto mt-10">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">Real-time Auto-Complete</h3>
                    <p className="text-sm text-slate-500 text-center mb-8">
                        Simulates the coder experience. Start typing a job title to see real-time AI predictions from ISCO-08.
                    </p>
                    
                    <div className="relative">
                        <input 
                            type="text"
                            value={suggestInput}
                            onChange={(e) => setSuggestInput(e.target.value)}
                            placeholder="Type a job title (e.g., 'Nurse')..."
                            className="w-full px-4 py-3 text-lg border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                        />
                        {isSuggesting && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            </div>
                        )}
                        
                        {suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95">
                                {suggestions.map((s, idx) => (
                                    <div key={idx} className="p-3 hover:bg-blue-50 border-b border-slate-50 last:border-0 cursor-pointer">
                                        <div className="flex justify-between items-center">
                                            <span className="font-mono font-bold text-blue-600">{s.code}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${s.confidence === 'High' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.confidence}</span>
                                        </div>
                                        <div className="text-slate-700 text-sm font-medium">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'api' && (
                <div className="h-full flex flex-col md:flex-row gap-6">
                    <div className="flex-1 flex flex-col">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2">Request Payload (JSON)</label>
                        <textarea 
                            value={apiJsonInput}
                            onChange={(e) => setApiJsonInput(e.target.value)}
                            className="flex-1 p-4 font-mono text-sm bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        />
                        <button 
                            onClick={handleApiSimulate}
                            disabled={apiLoading}
                            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50"
                        >
                            {apiLoading ? 'Sending Request...' : 'Send POST Request'}
                        </button>
                    </div>
                    
                    <div className="flex-1 flex flex-col">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-2">Response Output</label>
                        <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-auto custom-scrollbar">
                            {apiResponse ? (
                                <pre className="text-emerald-400 font-mono text-sm whitespace-pre-wrap">{apiResponse}</pre>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-600 font-mono text-sm">
                                    Waiting for request...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

// --- Component: Manual Coding & Search Modal ---
const ManualCodingModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  row: ProcessedRow | null;
  mapping: ColumnMapping;
  activeModule: ModuleType;
  settings: AISettings;
  onSave: (result: CodedResult) => void;
}> = ({ isOpen, onClose, row, mapping, activeModule, settings, onSave }) => {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Autocomplete State
  const [suggestions, setSuggestions] = useState<{code: string, label: string}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (isOpen && row) {
      setCode(row.result?.code || '');
      setLabel(row.result?.label || '');
      setSearchQuery(row[mapping.jobTitleColumn] || '');
      setSearchResults([]);
      setSuggestions([]);
    }
  }, [isOpen, row, mapping]);

  // Autocomplete logic for Label input
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (label.length > 2 && showSuggestions) {
        const results = await suggestCodes(label, activeModule, settings);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [label, showSuggestions, activeModule, settings]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchClassification(searchQuery, activeModule, settings);
      setSearchResults(results);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplyResult = (res: SearchResult | {code: string, label: string}) => {
    setCode(res.code);
    setLabel(res.label);
    setShowSuggestions(false);
  };

  const handleConfirm = () => {
    onSave({
      code,
      label,
      confidence: 'Manual',
      reasoning: 'Manually edited by user.'
    });
    onClose();
  };

  if (!isOpen || !row) return null;

  const primaryText = row[mapping.jobTitleColumn];
  const secondaryText = mapping.jobDescriptionColumn ? row[mapping.jobDescriptionColumn] : '';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <EditIcon className="w-5 h-5 text-blue-600" />
            Manual Review & Coding
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Panel: Input Data & Current Code */}
          <div className="w-full md:w-1/3 border-r border-slate-200 p-6 overflow-y-auto bg-slate-50/50">
            <div className="mb-6">
              <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">Input Data</h4>
              <div className="bg-white p-3 rounded border border-slate-200 shadow-sm mb-2">
                <p className="font-bold text-slate-900 mb-1">{primaryText}</p>
                {secondaryText && <p className="text-xs text-slate-500">{secondaryText}</p>}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">Assigned Code</h4>
              <div className="space-y-3 relative">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Code</label>
                  <input 
                    type="text" 
                    value={code} 
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="relative">
                  <label className="block text-xs text-slate-600 mb-1">Label (Type to Auto-Complete)</label>
                  <input 
                    type="text" 
                    value={label} 
                    onChange={(e) => { setLabel(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    autoComplete="off"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                      {suggestions.map((s, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => handleApplyResult(s)}
                          className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
                        >
                          <div className="flex justify-between">
                            <span className="font-bold text-xs text-blue-600 font-mono">{s.code}</span>
                          </div>
                          <div className="text-xs text-slate-700 truncate">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Search & Explorer */}
          <div className="flex-1 flex flex-col p-6 bg-white">
            <div className="mb-4">
              <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 flex items-center gap-1">
                <SearchIcon className="w-3 h-3" />
                Search {activeModule}
              </h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder={`Search for codes, keywords...`}
                />
                <button 
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSearching ? 'Searching...' : 'Find'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-100 rounded-lg relative">
              {isSearching ? (
                 <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                 </div>
              ) : searchResults.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {searchResults.map((res, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleApplyResult(res)}
                      className="w-full text-left p-3 hover:bg-blue-50 transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-1">
                         <span className="font-mono font-bold text-blue-700 text-sm">{res.code}</span>
                         <span className="text-xs text-slate-400 hidden group-hover:inline-block">Click to Apply</span>
                      </div>
                      <div className="font-medium text-slate-800 text-sm mb-1">{res.label}</div>
                      <div className="text-xs text-slate-500 line-clamp-2">{res.description}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <ListIcon className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm">Enter a term to search the classification.</p>
                  <p className="text-xs mt-2 text-slate-300">Powered by AI Explorer</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Cancel</button>
          <button 
            onClick={handleConfirm}
            disabled={!code}
            className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            <CheckIcon className="w-4 h-4" />
            Confirm Changes
          </button>
        </div>
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

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
        // Attempt a minimal request to check connectivity
        const response = await fetch(localSettings.localUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: localSettings.localModel,
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
        setTestMessage('Connection failed. Check URL/CORS.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-slate-500" />
            AI Engine Settings
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Mode Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">Processing Mode</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setLocalSettings({ ...localSettings, mode: ProcessingMode.Cloud })}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  localSettings.mode === ProcessingMode.Cloud
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <WifiIcon className="w-4 h-4" />
                Cloud (Gemini)
              </button>
              <button
                onClick={() => setLocalSettings({ ...localSettings, mode: ProcessingMode.Local })}
                className={`py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  localSettings.mode === ProcessingMode.Local
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <WifiOffIcon className="w-4 h-4" />
                Local (Offline)
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {localSettings.mode === ProcessingMode.Cloud 
                ? "Uses Google Gemini API. Requires internet connection."
                : "Uses a local LLM server (e.g., GPT-oss, Ollama). Works offline."}
            </p>
          </div>

          {/* Local Settings Fields */}
          {localSettings.mode === ProcessingMode.Local && (
            <div className="space-y-4 border-t border-slate-100 pt-4 animate-in slide-in-from-top-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Local API URL</label>
                <input 
                  type="text" 
                  value={localSettings.localUrl}
                  onChange={(e) => setLocalSettings({...localSettings, localUrl: e.target.value})}
                  placeholder="http://localhost:11434/v1/chat/completions"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Model Name</label>
                <input 
                  type="text" 
                  value={localSettings.localModel}
                  onChange={(e) => setLocalSettings({...localSettings, localModel: e.target.value})}
                  placeholder="llama3"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                />
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
                       <ServerIcon className="w-3 h-3"/> Ensure server allows CORS
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
          )}
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
  currentMode: ProcessingMode;
  onSaveSession: () => void;
  onClearSession: () => void;
  canInstall: boolean;
  onInstall: () => void;
}> = ({ activeModule, onModuleSelect, onOpenSettings, currentMode, onSaveSession, onClearSession, canInstall, onInstall }) => {
  const [hoveredModule, setHoveredModule] = useState<ModuleType | 'interactive' | 'roadmap' | 'dashboard' | null>(null);

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
            className="w-full flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-bold mb-2 shadow-md"
            >
            <DownloadIcon className="w-4 h-4" />
            Install App
            </button>
        )}

        <button 
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm"
        >
          <div className="flex items-center gap-2 text-slate-300">
            <SettingsIcon className="w-4 h-4" />
            <span>Settings</span>
          </div>
          <div className={`w-2 h-2 rounded-full ${currentMode === ProcessingMode.Cloud ? 'bg-blue-500' : 'bg-emerald-500'}`} />
        </button>
        <div className="mt-1 text-xs text-slate-600 text-center">
          v1.7.1 &bull; {currentMode === ProcessingMode.Cloud ? 'Cloud Mode' : 'Offline Mode'}
        </div>
      </div>
    </div>
  );
};

// --- Component: Status Bar ---
const StatusBar: React.FC<{ status: CodingStatus; progress: number; activeModule: ModuleType | 'interactive' | 'roadmap' | 'dashboard'; onShowHelp: () => void }> = ({ status, progress, activeModule, onShowHelp }) => {
  if (activeModule === 'interactive') {
      return (
        <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
             <div className="flex items-center gap-4">
                <div className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-amber-100 text-amber-700">
                    Interactive Mode
                </div>
             </div>
        </div>
      )
  }

  if (activeModule === 'dashboard') {
    return (
      <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
           <div className="flex items-center gap-4">
              <div className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-emerald-100 text-emerald-700">
                  Analytics Dashboard
              </div>
           </div>
      </div>
    )
  }
  
  if (activeModule === 'roadmap') {
    return (
      <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
           <div className="flex items-center gap-4">
              <div className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-purple-100 text-purple-700">
                  Project Management
              </div>
           </div>
      </div>
    )
  }

  return (
    <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 flex items-center justify-between shadow-sm">
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
            onClick={onShowHelp}
            className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <HelpCircleIcon className="w-4 h-4" />
            Module Info
          </button>
        )}
      </div>
    </div>
  );
};

// --- Component: File Upload ---
const FileUpload: React.FC<{ onFileUpload: (data: RawDataRow[]) => void }> = ({ onFileUpload }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setError(null);

    // Valid extensions: .csv, .xlsx, .xls
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(ext)) {
      setError("Please upload a valid file (.csv or .xlsx).");
      return;
    }

    if (file.size === 0) {
      setError("The file is empty.");
      return;
    }

    parseDataFile(file)
      .then((data) => {
        if (!data || data.length === 0) {
          setError("Could not parse any data rows from the file.");
          return;
        }

        // Basic validation: Check if we found columns
        const firstRow = data[0];
        const keys = Object.keys(firstRow).filter(k => k !== 'id');
        if (keys.length === 0) {
          setError("No valid columns found. Please ensure your file has headers.");
          return;
        }

        onFileUpload(data);
      })
      .catch((err) => {
        console.error(err);
        setError("Error parsing file. Check format.");
      });
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 text-center">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Upload Raw Data</h2>
      <p className="text-slate-500 mb-8">Upload your data file to begin coding.</p>
      
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'
        }`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadIcon className={`w-10 h-10 mb-4 ${dragActive ? 'text-blue-500' : 'text-slate-400'}`} />
          <p className="mb-2 text-sm text-slate-700">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-slate-500">CSV or Excel (.xlsx) (MAX. 5MB)</p>
        </div>
        <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleChange} />
      </label>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg text-red-700 flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
          <AlertCircleIcon className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}
    </div>
  );
};

// --- Component: Column Mapping ---
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

  // Validation Logic
  const hasDuplicate = mapping.jobTitleColumn && mapping.jobDescriptionColumn && mapping.jobTitleColumn === mapping.jobDescriptionColumn;
  const isDual = activeModule === ModuleType.DUAL;
  
  // Ready Logic
  let isReady = !!mapping.jobTitleColumn && !hasDuplicate;
  if (isDual) {
      // For dual coding, we generally want the industry column too
      isReady = isReady && !!mapping.industryColumn;
  }

  // Dynamic labels based on module
  let primaryLabel = "";
  let primaryDesc = "";
  let secondaryLabel = "";

  switch (activeModule) {
    case ModuleType.ISCO08:
      primaryLabel = "Job Title Column *";
      primaryDesc = "The main job title (e.g., 'Senior Data Analyst')";
      secondaryLabel = "Description Column (Optional)";
      break;
    case ModuleType.ISIC4:
      primaryLabel = "Main Activity / Description *";
      primaryDesc = "Description of main economic activity";
      secondaryLabel = "Business Name / Details (Optional)";
      break;
    case ModuleType.COICOP:
      primaryLabel = "Item Name / Description *";
      primaryDesc = "The product or service purchased (e.g., 'White Rice')";
      secondaryLabel = "Merchant / Details (Optional)";
      break;
    case ModuleType.DUAL:
      primaryLabel = "Job Title Column *";
      primaryDesc = "The occupation text for ISCO coding";
      secondaryLabel = "Additional Job Details (Optional)";
      break;
    default:
      primaryLabel = "Primary Column *";
      primaryDesc = "Main classification text";
      secondaryLabel = "Secondary Column (Optional)";
  }

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <FileSpreadsheetIcon className="text-blue-600" />
          Map Your Data Columns
        </h2>
        
        <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mb-6 text-sm text-blue-800">
          Configuring for: <strong>{activeModule}</strong>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{primaryLabel}</label>
            <select 
              value={mapping.jobTitleColumn}
              onChange={(e) => handleChange('jobTitleColumn', e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select column...</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">{primaryDesc}</p>
          </div>

          {isDual && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Industry / Activity Column *</label>
                <select 
                  value={mapping.industryColumn || ''}
                  onChange={(e) => handleChange('industryColumn', e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select column...</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500">Required for ISIC Rev. 4 coding context</p>
              </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{secondaryLabel}</label>
            <select 
              value={mapping.jobDescriptionColumn}
              onChange={(e) => handleChange('jobDescriptionColumn', e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select column... (None)</option>
              {headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        {hasDuplicate && (
          <div className="mt-6 p-3 bg-red-50 text-red-700 text-sm rounded-md flex items-center gap-2">
            <AlertCircleIcon className="w-4 h-4" />
            Columns must be different.
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={onConfirm}
            disabled={!isReady}
            className={`px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all ${
              isReady 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Continue to Preview
            <ArrowRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Component: Results Table ---
const ResultsTable: React.FC<{
  data: ProcessedRow[];
  mapping: ColumnMapping;
  onAutoCode: () => void;
  onRetryErrors: () => void;
  onRetryRow: (index: number) => void;
  onBatchCode: (ids: string[]) => void;
  onManualEdit: (index: number) => void;
  isProcessing: boolean;
  onExport: () => void;
  activeModule: ModuleType;
  settings: AISettings;
}> = ({ data, mapping, onAutoCode, onRetryErrors, onRetryRow, onBatchCode, onManualEdit, isProcessing, onExport, activeModule, settings }) => {
  
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confidenceFilter, setConfidenceFilter] = useState<string>('All');
  const [textFilter, setTextFilter] = useState('');
  const ROWS_PER_PAGE = 50;
  
  // Filtering Logic
  const filteredData = data.filter(row => {
    // Text Filter
    const primary = row[mapping.jobTitleColumn]?.toString().toLowerCase() || '';
    const secondary = mapping.jobDescriptionColumn ? (row[mapping.jobDescriptionColumn]?.toString().toLowerCase() || '') : '';
    const matchesText = !textFilter || primary.includes(textFilter.toLowerCase()) || secondary.includes(textFilter.toLowerCase());

    if (!matchesText) return false;

    if (confidenceFilter === 'All') return true;
    if (confidenceFilter === 'Error') return row.codingStatus === 'error';
    if (confidenceFilter === 'Pending') return row.codingStatus === 'pending';
    
    // For coded results
    if (row.codingStatus === 'coded' && row.result) {
      return row.result.confidence === confidenceFilter;
    }
    
    return false;
  });

  const displayedData = filteredData.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);

  // Reset page when filter changes
  useEffect(() => {
    setPage(0);
  }, [confidenceFilter, textFilter]);

  const codedCount = data.filter(r => r.codingStatus === 'coded').length;
  const errorCount = data.filter(r => r.codingStatus === 'error').length;
  const manualCount = data.filter(r => r.manuallyEdited).length;
  const progressPercent = Math.round((codedCount / data.length) * 100);

  // --- Selection Logic ---
  const toggleSelectRow = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAllOnPage = () => {
    const newSelected = new Set(selectedIds);
    const allOnPageSelected = displayedData.every(row => newSelected.has(row.id));

    if (allOnPageSelected) {
      displayedData.forEach(row => newSelected.delete(row.id));
    } else {
      displayedData.forEach(row => newSelected.add(row.id));
    }
    setSelectedIds(newSelected);
  };

  const handleBatchCodeClick = () => {
    if (selectedIds.size > 0) {
      onBatchCode(Array.from(selectedIds));
      setSelectedIds(new Set()); // Clear selection after triggering
    }
  };

  const isAllOnPageSelected = displayedData.length > 0 && displayedData.every(row => selectedIds.has(row.id));

  let codeHeader = "Code";
  let labelHeader = "Label";

  switch (activeModule) {
    case ModuleType.ISCO08:
      codeHeader = "ISCO Code";
      labelHeader = "ISCO Label";
      break;
    case ModuleType.ISIC4:
      codeHeader = "ISIC Code";
      labelHeader = "ISIC Label";
      break;
    case ModuleType.COICOP:
      codeHeader = "COICOP Code";
      labelHeader = "COICOP Label";
      break;
    case ModuleType.DUAL:
      codeHeader = "ISCO / ISIC";
      labelHeader = "Description";
      break;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-8 py-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Data Preview & Coding</h2>
          <p className="text-slate-500 text-sm mt-1">
            {codedCount} coded, {errorCount} errors, {manualCount} manual / {data.length} total ({progressPercent}%) using 
            <span className={`ml-1 font-medium ${settings.mode === ProcessingMode.Cloud ? 'text-blue-600' : 'text-emerald-600'}`}>
              {settings.mode === ProcessingMode.Cloud ? 'Cloud AI' : 'Local AI'}
            </span>
          </p>
        </div>
        
        <div className="flex gap-3 items-center">
           {/* Search */}
           <div className="relative">
             <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <input 
                type="text" 
                placeholder="Search rows..." 
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
             />
           </div>

          {/* Confidence Filter */}
          <div className="relative">
            <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm appearance-none outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer h-full"
            >
              <option value="All">All Results</option>
              <option value="High">High Confidence</option>
              <option value="Medium">Medium Confidence</option>
              <option value="Low">Low Confidence</option>
              <option value="Manual">Manually Edited</option>
              <option value="Error">Errors</option>
              <option value="Pending">Pending</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          <button
            onClick={onExport}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium flex items-center gap-2"
          >
            <DownloadIcon className="w-4 h-4" />
            Export
          </button>
          
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchCodeClick}
              disabled={isProcessing}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition-all animate-in fade-in slide-in-from-right-2 ${
                isProcessing
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
              }`}
            >
              <SparklesIcon className="w-4 h-4" />
              Code {selectedIds.size} Selected
            </button>
          )}

          {errorCount > 0 && (
            <button
              onClick={onRetryErrors}
              disabled={isProcessing}
              className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition-all ${
                isProcessing
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200'
              }`}
            >
              <SparklesIcon className="w-4 h-4" />
              Retry {errorCount} Failed
            </button>
          )}

          <button
            onClick={onAutoCode}
            disabled={isProcessing || codedCount === data.length}
            className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 shadow-md transition-all ${
              isProcessing 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-200'
            }`}
          >
            {isProcessing ? (
              <>Processing...</>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                {codedCount > 0 && codedCount < data.length ? 'Resume Auto-Code' : 'Auto-Code with AI'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto custom-scrollbar px-8 pb-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 w-10">
                  <input 
                    type="checkbox" 
                    checked={isAllOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-4 w-16">#</th>
                <th className="px-6 py-4 max-w-xs">Input Data</th>
                <th className="px-6 py-4 w-32">{codeHeader}</th>
                <th className="px-6 py-4">{labelHeader}</th>
                <th className="px-6 py-4 w-32">Confidence</th>
                <th className="px-6 py-4 w-64">Reasoning</th>
                <th className="px-6 py-4 w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedData.length === 0 ? (
                 <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                       No rows match the filter.
                    </td>
                 </tr>
              ) : displayedData.map((row, idx) => {
                const realIndex = data.indexOf(row);
                const isSelected = selectedIds.has(row.id);
                const isLowConfidence = row.result?.confidence === 'Low' && row.codingStatus === 'coded';
                const isError = row.codingStatus === 'error';
                
                return (
                <tr 
                  key={row.id} 
                  className={`transition-colors 
                    ${isSelected ? 'bg-blue-50/60' : ''} 
                    ${isLowConfidence && !isSelected ? 'bg-orange-50/60' : ''}
                    ${!isSelected && !isLowConfidence ? 'hover:bg-slate-50' : ''}
                  `}
                >
                  <td className="px-4 py-4">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSelectRow(row.id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-slate-400">
                    {realIndex + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{row[mapping.jobTitleColumn]}</div>
                    {mapping.industryColumn && (
                        <div className="text-xs text-emerald-600 font-medium truncate max-w-[200px] mt-0.5" title="Industry Context">
                            Ind: {row[mapping.industryColumn]}
                        </div>
                    )}
                    {mapping.jobDescriptionColumn && (
                      <div className="text-xs text-slate-400 truncate max-w-[200px]" title={row[mapping.jobDescriptionColumn]}>
                        {row[mapping.jobDescriptionColumn]}
                      </div>
                    )}
                  </td>
                  <td className={`px-6 py-4 font-mono font-bold ${isError ? 'text-red-500' : 'text-indigo-600'}`}>
                    {isError ? (
                      <div className="group relative flex items-center gap-1 cursor-help">
                        <span>ERR</span>
                        <AlertCircleIcon className="w-4 h-4" />
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-lg z-20">
                           <p className="font-bold mb-1 text-red-300">Coding Error:</p>
                           {row.errorMessage}
                        </div>
                      </div>
                    ) : (
                      row.result?.code || '-'
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-800">
                    {isError ? '-' : (row.result?.label || '-')}
                  </td>
                  <td className="px-6 py-4">
                    {isError ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Failed
                      </span>
                    ) : row.result ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        row.result.confidence === 'Manual' ? 'bg-slate-200 text-slate-800 border-slate-300' :
                        row.result.confidence === 'High' ? 'bg-green-100 text-green-800 border-green-200' :
                        row.result.confidence === 'Medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                        'bg-orange-100 text-orange-800 border-orange-200 shadow-sm'
                      }`}>
                        {row.result.confidence}
                        {row.result.confidence === 'Low' && <AlertCircleIcon className="w-3 h-3 ml-1"/>}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">Pending</span>
                    )}
                  </td>
                  <td className={`px-6 py-4 text-xs italic ${isError ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                    {isError ? row.errorMessage : (row.result?.reasoning || '-')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      {isError && (
                        <button 
                          onClick={() => onRetryRow(realIndex)}
                          disabled={isProcessing}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Retry Auto-Code"
                        >
                          <SparklesIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => onManualEdit(realIndex)}
                        disabled={isProcessing}
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-colors"
                        title="Manual Edit & Search"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4 text-sm text-slate-500">
             <button 
               disabled={page === 0}
               onClick={() => setPage(p => p - 1)}
               className="disabled:opacity-50 hover:text-blue-600"
             >
               Previous
             </button>
             <span>Page {page + 1} of {totalPages}</span>
             <button 
               disabled={page === totalPages - 1}
               onClick={() => setPage(p => p + 1)}
               className="disabled:opacity-50 hover:text-blue-600"
             >
               Next
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper to load settings from storage
const loadSettings = (): AISettings => {
  const saved = localStorage.getItem('statcode_ai_settings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse settings", e);
    }
  }
  return {
    mode: ProcessingMode.Cloud,
    localUrl: "http://localhost:11434/v1/chat/completions",
    localModel: "llama3"
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
        currentMode={aiSettings.mode}
        onSaveSession={handleSaveSession}
        onClearSession={handleClearSession}
        canInstall={!!deferredPrompt}
        onInstall={handleInstallClick}
      />
      
      <div className="flex-1 ml-64 flex flex-col">
        <StatusBar 
          status={status} 
          progress={progress} 
          activeModule={activeModule} 
          onShowHelp={() => setShowHelp(!showHelp)}
        />

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
              <div className={`mb-6 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
                aiSettings.mode === ProcessingMode.Cloud ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
              }`}>
                {aiSettings.mode === ProcessingMode.Cloud ? <WifiIcon className="w-4 h-4" /> : <WifiOffIcon className="w-4 h-4" />}
                Using {aiSettings.mode === ProcessingMode.Cloud ? 'Cloud' : 'Local'} Engine
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