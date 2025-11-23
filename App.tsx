import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ModuleType, AIProvider, AISettings, RawDataRow, ProcessedRow, 
  ColumnMapping, CodingStatus, CodedResult, ReferenceEntry 
} from './types';
import { 
  parseDataFile, exportToCSV 
} from './utils/csvHelper';
import { 
  codeSingleOccupation, suggestCodes 
} from './services/geminiService';
import { 
  addReferenceEntries, findReferenceMatch, findSimilarReferences, 
  getReferenceStats, clearReferenceData 
} from './services/dbService';
import { 
  BrainIcon, CodeIcon, DatabaseIcon, HelpCircleIcon, ExternalLinkIcon, 
  PieChartIcon, ZapIcon, LayoutKanbanIcon, SaveIcon, TrashIcon, 
  DownloadIcon, SettingsIcon, UploadIcon, FileSpreadsheetIcon, 
  ArrowRightIcon, CheckCircleIcon, AlertCircleIcon, SparklesIcon,
  SearchIcon, FilterIcon, ListIcon, EditIcon, WifiIcon, WifiOffIcon,
  RefreshCwIcon, BarChartIcon
} from './components/Icons';

// --- Constants ---
const MODULE_DETAILS = {
  [ModuleType.ISCO08]: {
    name: "ISCO-08",
    description: "International Standard Classification of Occupations (08). Used for classifying job titles.",
    url: "https://www.ilo.org/public/english/bureau/stat/isco/isco08/"
  },
  [ModuleType.ISIC4]: {
    name: "ISIC Rev. 4",
    description: "International Standard Industrial Classification of All Economic Activities.",
    url: "https://unstats.un.org/unsd/classifications/Econ/isic"
  },
  [ModuleType.COICOP]: {
    name: "COICOP 2018",
    description: "Classification of Individual Consumption According to Purpose.",
    url: "https://unstats.un.org/unsd/classifications/Econ/coicop"
  },
  [ModuleType.DUAL]: {
    name: "Dual Coding",
    description: "Simultaneous coding of Occupation (ISCO) and Industry (ISIC) for complex datasets.",
    url: "#"
  }
};

// --- Components ---

const SettingsModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  settings: AISettings; 
  onSave: (s: AISettings) => void 
}> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  const fetchLocalModels = async () => {
    setLoadingModels(true);
    try {
        // Try standard Ollama/LM Studio endpoints
        const baseUrl = localSettings.baseUrl || "http://localhost:11434/v1";
        const response = await fetch(`${baseUrl}/models`);
        if(response.ok) {
            const data = await response.json();
            // Handle different response formats (Ollama vs OpenAI-compatible)
            const models = data.data ? data.data.map((m: any) => m.id) : [];
            setAvailableModels(models);
        } else {
            alert("Could not connect to Local API. Ensure Ollama or LM Studio is running.");
        }
    } catch (e) {
        console.error(e);
        alert("Failed to fetch models. Check Console for details.");
    } finally {
        setLoadingModels(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-blue-400"/> AI Engine Settings
        </h2>
        
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">AI Provider</label>
                <select 
                    value={localSettings.provider}
                    onChange={(e) => setLocalSettings({...localSettings, provider: e.target.value as AIProvider})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value={AIProvider.Gemini}>Google Gemini</option>
                    <option value={AIProvider.OpenAI}>OpenAI (GPT-4/3.5)</option>
                    <option value={AIProvider.DeepSeek}>DeepSeek</option>
                    <option value={AIProvider.Local}>Local / Ollama / LM Studio</option>
                </select>
            </div>

            {localSettings.provider !== AIProvider.Local && localSettings.provider !== AIProvider.Gemini && (
                 <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">API Key</label>
                    <input 
                        type="password"
                        value={localSettings.apiKey || ''}
                        onChange={(e) => setLocalSettings({...localSettings, apiKey: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder={`Enter ${localSettings.provider} API Key`}
                    />
                 </div>
            )}

            {localSettings.provider === AIProvider.Local && (
                <div>
                     <label className="block text-sm font-medium text-slate-400 mb-1">Base URL</label>
                     <input 
                        type="text"
                        value={localSettings.baseUrl || 'http://localhost:11434/v1'}
                        onChange={(e) => setLocalSettings({...localSettings, baseUrl: e.target.value})}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">Use http://localhost:1234/v1 for LM Studio</p>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Model Name</label>
                <div className="flex gap-2">
                    {localSettings.provider === AIProvider.Local ? (
                        <>
                            <input 
                                list="local-models"
                                type="text"
                                value={localSettings.model}
                                onChange={(e) => setLocalSettings({...localSettings, model: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="e.g. llama3, mistral"
                            />
                            <datalist id="local-models">
                                {availableModels.map(m => <option key={m} value={m} />)}
                            </datalist>
                            <button 
                                onClick={fetchLocalModels}
                                disabled={loadingModels}
                                className="px-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"
                                title="Fetch available local models"
                            >
                                <RefreshCwIcon className={`w-4 h-4 ${loadingModels ? 'animate-spin' : ''}`} />
                            </button>
                        </>
                    ) : (
                        <select
                            value={localSettings.model}
                            onChange={(e) => setLocalSettings({...localSettings, model: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {localSettings.provider === AIProvider.Gemini && (
                                <>
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                    <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                                </>
                            )}
                            {localSettings.provider === AIProvider.OpenAI && (
                                <>
                                    <option value="gpt-4o">GPT-4o</option>
                                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                </>
                            )}
                            {localSettings.provider === AIProvider.DeepSeek && (
                                <option value="deepseek-chat">DeepSeek V3</option>
                            )}
                        </select>
                    )}
                </div>
            </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
            <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Cancel</button>
            <button 
                onClick={() => { onSave(localSettings); onClose(); }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all"
            >
                Save Settings
            </button>
        </div>
      </div>
    </div>
  );
};

const FileUpload: React.FC<{ onUpload: (data: RawDataRow[]) => void }> = ({ onUpload }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
  
    const handleFiles = async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      try {
        const data = await parseDataFile(file);
        onUpload(data);
      } catch (err) {
        alert("Error parsing file. Please check the format.");
        console.error(err);
      }
    };
  
    return (
      <div 
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ease-in-out cursor-pointer group
          ${isDragging ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".csv,.xlsx,.xls,.ods" 
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="w-16 h-16 bg-slate-700 group-hover:bg-slate-600 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors shadow-lg">
          <UploadIcon className="w-8 h-8 text-blue-400 group-hover:text-blue-300" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Upload your dataset</h3>
        <p className="text-slate-400 mb-6 max-w-sm mx-auto">
          Drag and drop your CSV, Excel, or ODS file here, or click to browse.
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500 uppercase tracking-wider font-medium">
          <span className="flex items-center gap-1"><FileSpreadsheetIcon className="w-4 h-4" /> CSV</span>
          <span className="flex items-center gap-1"><FileSpreadsheetIcon className="w-4 h-4" /> Excel</span>
          <span className="flex items-center gap-1"><FileSpreadsheetIcon className="w-4 h-4" /> ODS</span>
        </div>
      </div>
    );
};

const DataMapping: React.FC<{ 
    columns: string[]; 
    mapping: ColumnMapping; 
    onUpdate: (m: ColumnMapping) => void;
    onConfirm: () => void;
  }> = ({ columns, mapping, onUpdate, onConfirm }) => {
    
    // Smart mapping heuristic
    useEffect(() => {
        const newMapping = { ...mapping };
        let changed = false;

        const findMatch = (keywords: string[]) => 
            columns.find(c => keywords.some(k => c.toLowerCase().includes(k)));

        if (!mapping.idColumn) {
            const match = findMatch(['id', 'code', 'ref', 'index']);
            if (match) { newMapping.idColumn = match; changed = true; }
        }
        if (!mapping.jobTitleColumn) {
            const match = findMatch(['title', 'job', 'occup', 'prof', 'term']);
            if (match) { newMapping.jobTitleColumn = match; changed = true; }
        }
        if (!mapping.jobDescriptionColumn) {
            const match = findMatch(['desc', 'text', 'detail', 'task']);
            if (match) { newMapping.jobDescriptionColumn = match; changed = true; }
        }

        if (changed) onUpdate(newMapping);
    }, [columns]); // Run once when columns load

    return (
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <LayoutKanbanIcon className="w-6 h-6 text-blue-400"/> Map your columns
        </h2>
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Unique ID (Optional)</label>
                <select 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={mapping.idColumn}
                  onChange={(e) => onUpdate({...mapping, idColumn: e.target.value})}
                >
                  <option value="">-- Auto Generate --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-blue-400 mb-2">Primary Text (e.g. Job Title)</label>
                <select 
                  className="w-full bg-slate-900 border border-blue-500/50 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={mapping.jobTitleColumn}
                  onChange={(e) => onUpdate({...mapping, jobTitleColumn: e.target.value})}
                >
                  <option value="">-- Select Column --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
  
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Context (e.g. Description)</label>
                <select 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={mapping.jobDescriptionColumn}
                  onChange={(e) => onUpdate({...mapping, jobDescriptionColumn: e.target.value})}
                >
                  <option value="">-- None --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Industry (For Dual Coding)</label>
                <select 
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  value={mapping.industryColumn || ''}
                  onChange={(e) => onUpdate({...mapping, industryColumn: e.target.value})}
                >
                  <option value="">-- None --</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
          </div>
  
          <div className="pt-4 border-t border-slate-700 flex justify-end">
            <button 
              disabled={!mapping.jobTitleColumn}
              onClick={onConfirm}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-all hover:translate-y-[-1px]"
            >
              Start Auto-Coding <ArrowRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
};

const ManualCodingModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    row: ProcessedRow;
    onSave: (result: CodedResult) => void;
    module: ModuleType;
    settings: AISettings;
}> = ({ isOpen, onClose, row, onSave, module, settings }) => {
    const [code, setCode] = useState(row.result?.code || '');
    const [label, setLabel] = useState(row.result?.label || '');
    const [suggestions, setSuggestions] = useState<{code: string, label: string}[]>([]);

    useEffect(() => {
        if(isOpen) {
            setCode(row.result?.code || '');
            setLabel(row.result?.label || '');
            setSuggestions([]);
        }
    }, [isOpen, row]);

    const handleLabelChange = async (val: string) => {
        setLabel(val);
        if (val.length > 2) {
            // Debounced call could be better, but direct for now
            const sugs = await suggestCodes(val, module, settings);
            setSuggestions(sugs);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
             <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 w-full max-w-lg shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-4">Manual Coding</h3>
                <div className="mb-4 p-3 bg-slate-900/50 rounded border border-slate-700">
                    <div className="text-xs text-slate-500 uppercase font-bold">Input Text</div>
                    <div className="text-white">{row['primaryText']}</div>
                    <div className="text-slate-400 text-sm">{row['secondaryText']}</div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm text-slate-400">Label / Title (Type for suggestions)</label>
                        <input 
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white"
                            value={label}
                            onChange={(e) => handleLabelChange(e.target.value)}
                        />
                        {suggestions.length > 0 && (
                            <div className="mt-1 bg-slate-700 rounded border border-slate-600 max-h-32 overflow-y-auto absolute w-[calc(100%-3rem)] max-w-lg z-10 shadow-xl">
                                {suggestions.map((s, i) => (
                                    <div 
                                        key={i} 
                                        className="p-2 hover:bg-slate-600 cursor-pointer text-sm text-white border-b border-slate-600/50 last:border-0"
                                        onClick={() => { setCode(s.code); setLabel(s.label); setSuggestions([]); }}
                                    >
                                        <span className="font-mono font-bold text-blue-300 mr-2">{s.code}</span>
                                        {s.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="text-sm text-slate-400">Code</label>
                        <input 
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white font-mono"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
                    <button 
                        onClick={() => {
                            onSave({
                                code, 
                                label, 
                                confidence: 'Manual', 
                                reasoning: 'Manually edited by user'
                            });
                            onClose();
                        }} 
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium"
                    >
                        Save
                    </button>
                </div>
             </div>
        </div>
    );
};

const ResultsTable: React.FC<{
    rows: ProcessedRow[];
    onEdit: (row: ProcessedRow) => void;
    onDelete: (id: string) => void;
    onBulkAction: (action: 'accept' | 'delete', ids: string[]) => void;
}> = ({ rows, onEdit, onDelete, onBulkAction }) => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const pageSize = 50;

    const filteredRows = useMemo(() => {
        if (!search) return rows;
        const lowSearch = search.toLowerCase();
        return rows.filter(r => 
            (r['primaryText']?.toLowerCase() || '').includes(lowSearch) ||
            (r.result?.code?.toLowerCase() || '').includes(lowSearch) ||
            (r.result?.label?.toLowerCase() || '').includes(lowSearch)
        );
    }, [rows, search]);

    const paginatedRows = filteredRows.slice((page-1)*pageSize, page*pageSize);
    const totalPages = Math.ceil(filteredRows.length / pageSize);

    const toggleSelect = (id: string) => {
        const newSet = new Set(selected);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelected(newSet);
    };

    const toggleSelectAll = () => {
        if (selected.size === paginatedRows.length) setSelected(new Set());
        else setSelected(new Set(paginatedRows.map(r => r.id)));
    };

    const getStatusColor = (row: ProcessedRow) => {
        if (row.codingStatus === 'error') return 'bg-red-500/10 text-red-400 border-red-500/20';
        if (row.codingStatus === 'pending') return 'bg-slate-700/30 text-slate-500 border-slate-700';
        if (row.result?.confidence === 'Manual') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        if (row.result?.confidence === 'High' || row.result?.confidence === 'Reference') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        if (row.result?.confidence === 'Medium') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        return 'bg-slate-700 text-slate-400';
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div className="relative flex-1 max-w-md">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Search job titles, codes, labels..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
                {selected.size > 0 && (
                    <div className="flex items-center gap-2 animate-in fade-in">
                        <span className="text-sm text-slate-400">{selected.size} selected</span>
                        <button 
                            onClick={() => { onBulkAction('delete', Array.from(selected)); setSelected(new Set()); }}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded border border-red-500/20"
                        >
                            Delete
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-900 text-slate-400 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-4 w-10">
                                    <input type="checkbox" onChange={toggleSelectAll} checked={paginatedRows.length > 0 && selected.size === paginatedRows.length} className="rounded bg-slate-700 border-slate-600"/>
                                </th>
                                <th className="p-4">Input Data</th>
                                <th className="p-4">Code</th>
                                <th className="p-4">Label</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {paginatedRows.map(row => (
                                <tr key={row.id} className={`hover:bg-slate-700/30 transition-colors ${selected.has(row.id) ? 'bg-blue-900/10' : ''}`}>
                                    <td className="p-4">
                                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} className="rounded bg-slate-700 border-slate-600"/>
                                    </td>
                                    <td className="p-4 max-w-xs">
                                        <div className="font-medium text-white truncate" title={row['primaryText']}>{row['primaryText']}</div>
                                        <div className="text-xs text-slate-500 truncate" title={row['secondaryText']}>{row['secondaryText']}</div>
                                    </td>
                                    <td className="p-4 font-mono text-blue-300 font-bold">{row.result?.code || '-'}</td>
                                    <td className="p-4 text-slate-300 max-w-xs truncate" title={row.result?.label}>{row.result?.label || '-'}</td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${getStatusColor(row)}`}>
                                            {row.codingStatus === 'pending' ? '...' : row.result?.confidence || 'Error'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => onEdit(row)} className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-white"><EditIcon className="w-4 h-4"/></button>
                                            <button onClick={() => onDelete(row.id)} className="p-1.5 hover:bg-slate-600 rounded text-slate-400 hover:text-red-400"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {paginatedRows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-500">No matching records found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                <div className="p-4 border-t border-slate-700 flex justify-between items-center text-xs text-slate-400">
                    <div>Showing {((page-1)*pageSize)+1} - {Math.min(page*pageSize, filteredRows.length)} of {filteredRows.length}</div>
                    <div className="flex gap-2">
                        <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50">Prev</button>
                        <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)} className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Views ---

const KnowledgeBaseView = () => {
    const [stats, setStats] = useState<Record<string, number>>({});
    
    const refreshStats = async () => {
        const s = await getReferenceStats();
        setStats(s);
    };

    useEffect(() => { refreshStats(); }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, module: ModuleType) => {
        if (!e.target.files?.[0]) return;
        try {
            const data = await parseDataFile(e.target.files[0]);
            // Assume 1st column is Code, 2nd is Label, 3rd is Term (or heuristic)
            const entries: ReferenceEntry[] = data.map(r => ({
                id: crypto.randomUUID(),
                module,
                code: Object.values(r)[0],
                label: Object.values(r)[1],
                term: Object.values(r)[2] || Object.values(r)[1], // Fallback
                source: 'upload',
                addedAt: Date.now()
            }));
            await addReferenceEntries(entries);
            await refreshStats();
            alert(`Imported ${entries.length} entries into ${module}`);
        } catch (err) {
            console.error(err);
            alert("Failed to import dictionary");
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-white mb-2">Knowledge Base & Reference Files</h2>
                <p className="text-slate-400">Manage local dictionaries. The app checks these first before calling online AI.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {(Object.values(ModuleType) as ModuleType[]).map(mod => (
                    <div key={mod} className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg">
                        <div className="text-xs uppercase font-bold text-slate-500 mb-2">{mod}</div>
                        <div className="text-4xl font-bold text-white mb-1">{stats[mod] || 0}</div>
                        <div className="text-xs text-slate-400 mb-4">Reference Entries</div>
                        <div className="flex gap-2">
                             <label className="flex-1 text-center px-3 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-bold rounded cursor-pointer border border-blue-600/20 transition-colors">
                                Upload
                                <input type="file" className="hidden" accept=".csv,.xlsx,.ods" onChange={(e) => handleFileUpload(e, mod)} />
                             </label>
                             <button 
                                onClick={async () => { if(confirm('Clear all?')) { await clearReferenceData(mod); refreshStats(); }}}
                                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded border border-red-500/20"
                             >
                                Clear
                             </button>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="bg-slate-800/50 rounded-xl p-8 border border-dashed border-slate-700 text-center">
                 <UploadIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                 <h3 className="text-lg font-bold text-white mb-2">Upload Reference Dictionary</h3>
                 <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                    Upload a CSV or Excel file containing official codes and descriptions. 
                    Structure: Column A (Code), Column B (Label), Column C (Search Terms).
                 </p>
                 <label className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg cursor-pointer font-bold shadow-lg transition-all">
                    Select Reference File
                    <input type="file" className="hidden" accept=".csv,.xlsx,.ods" onChange={(e) => handleFileUpload(e, ModuleType.ISCO08)} />
                 </label>
            </div>
        </div>
    );
};

const DashboardView = () => (
    <div className="p-8 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-white mb-6">Analytics Dashboard</h2>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 flex items-center justify-center min-h-[400px]">
            <div className="text-center">
                <BarChartIcon className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-500">Data Visualization</h3>
                <p className="text-slate-600 mt-2">Charts will appear here after coding data.</p>
                {/* Treemap implementation would go here using a charting library */}
            </div>
        </div>
    </div>
);

const RoadmapView = () => (
    <div className="p-8 text-slate-300">
      <h2 className="text-2xl font-bold mb-4">Project Roadmap</h2>
      <ul className="list-disc ml-6 space-y-2">
          <li>Advanced RAG with Vector Database</li>
          <li>Team Collaboration & Cloud Sync</li>
          <li>API Endpoint for external integration</li>
          <li>Multi-language Support</li>
      </ul>
    </div>
);

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
        <div className="p-6 border-b border-slate-800 flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <BrainIcon className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">StatCode AI</h1>
        </div>
        
        <div className="flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar min-h-0">
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
                <div className="absolute left-full top-0 ml-1 w-72 bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-left-2 hidden group-hover:block">
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
  
        <div className="p-4 border-t border-slate-800 space-y-2 flex-shrink-0 bg-slate-900 z-10">
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
            v1.9.1 &bull; {getProviderName(currentProvider)}
          </div>
        </div>
      </div>
    );
};

// --- Main App Logic ---

function App() {
  const [activeModule, setActiveModule] = useState<ModuleType | 'interactive' | 'roadmap' | 'dashboard' | 'knowledge'>(ModuleType.ISCO08);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AISettings>({
    provider: AIProvider.Gemini,
    model: 'gemini-2.5-flash'
  });
  const [canInstall, setCanInstall] = useState(false);

  // Workflow State
  const [codingStatus, setCodingStatus] = useState<CodingStatus>(CodingStatus.Idle);
  const [columns, setColumns] = useState<string[]>([]);
  const [rawData, setRawData] = useState<RawDataRow[]>([]);
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ idColumn: '', jobTitleColumn: '', jobDescriptionColumn: '' });
  const [progress, setProgress] = useState({ total: 0, current: 0 });
  const [manualModalRow, setManualModalRow] = useState<ProcessedRow | null>(null);

  // Refs for processing loop control
  const stopProcessingRef = useRef(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleFileUpload = (data: RawDataRow[]) => {
      setRawData(data);
      if(data.length > 0) {
          setColumns(Object.keys(data[0]));
          setCodingStatus(CodingStatus.Mapping);
      }
  };

  const handleStartCoding = async () => {
    setCodingStatus(CodingStatus.Processing);
    // Initialize rows
    const initRows: ProcessedRow[] = rawData.map(r => ({
        ...r,
        id: mapping.idColumn ? r[mapping.idColumn] : r.id,
        primaryText: r[mapping.jobTitleColumn],
        secondaryText: mapping.jobDescriptionColumn ? r[mapping.jobDescriptionColumn] : '',
        codingStatus: 'pending'
    }));
    setProcessedRows(initRows);
    setProgress({ total: initRows.length, current: 0 });
    stopProcessingRef.current = false;

    // Start Async Processing Loop
    processRows(initRows);
  };

  const processRows = async (rows: ProcessedRow[]) => {
      for (let i = 0; i < rows.length; i++) {
          if (stopProcessingRef.current) break;
          
          // Skip if already coded or manually edited
          if (rows[i].codingStatus === 'coded' || rows[i].manuallyEdited) {
              setProgress(prev => ({...prev, current: i + 1}));
              continue;
          }

          try {
              const currentRow = rows[i];
              const module = activeModule as ModuleType;

              // 1. Check Local Dictionary (Priority)
              const refMatch = await findReferenceMatch(currentRow['primaryText'], module);
              if (refMatch) {
                  const result: CodedResult = {
                      code: refMatch.code,
                      label: refMatch.label,
                      confidence: 'Reference',
                      reasoning: 'Exact match from Knowledge Base'
                  };
                  updateRowResult(i, result);
                  continue;
              }

              // 2. RAG Lookup for Context
              const similarRefs = await findSimilarReferences(currentRow['primaryText'], module);

              // 3. Call AI
              const result = await codeSingleOccupation(
                  currentRow['primaryText'], 
                  currentRow['secondaryText'], 
                  module, 
                  settings,
                  undefined, 
                  similarRefs
              );
              updateRowResult(i, result);

          } catch (e) {
              console.error(e);
              setProcessedRows(prev => {
                  const next = [...prev];
                  next[i] = { ...next[i], codingStatus: 'error', errorMessage: 'AI Error' };
                  return next;
              });
          }
          setProgress(prev => ({...prev, current: i + 1}));
      }
      if (!stopProcessingRef.current) {
          setCodingStatus(CodingStatus.Review);
      }
  };

  const updateRowResult = (index: number, result: CodedResult) => {
      setProcessedRows(prev => {
          const next = [...prev];
          next[index] = { 
              ...next[index], 
              codingStatus: 'coded', 
              result 
          };
          return next;
      });
  };

  const handlePause = () => {
      stopProcessingRef.current = true;
      setCodingStatus(CodingStatus.Paused);
  };

  const handleResume = () => {
      stopProcessingRef.current = false;
      setCodingStatus(CodingStatus.Processing);
      processRows(processedRows);
  };

  // Render logic for coding views
  const renderCodingView = () => {
      if (codingStatus === CodingStatus.Idle) {
          return <FileUpload onUpload={handleFileUpload} />;
      }
      if (codingStatus === CodingStatus.Mapping) {
          return (
            <DataMapping 
                columns={columns} 
                mapping={mapping} 
                onUpdate={setMapping} 
                onConfirm={handleStartCoding} 
            />
          );
      }
      if (codingStatus === CodingStatus.Processing || codingStatus === CodingStatus.Paused || codingStatus === CodingStatus.Review) {
          return (
              <div className="p-6 max-w-[95%] mx-auto">
                  {/* Progress Header */}
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl mb-6 flex items-center justify-between">
                      <div>
                          <h2 className="text-2xl font-bold text-white mb-1">
                              {codingStatus === CodingStatus.Processing ? 'Auto-Coding in Progress...' : 
                               codingStatus === CodingStatus.Paused ? 'Coding Paused' : 'Review Results'}
                          </h2>
                          <p className="text-slate-400 text-sm">Processed {progress.current} of {progress.total} rows</p>
                      </div>
                      <div className="flex gap-4 items-center">
                          {codingStatus === CodingStatus.Processing ? (
                              <button onClick={handlePause} className="px-6 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/50 rounded-lg font-bold hover:bg-amber-500/20">Pause</button>
                          ) : codingStatus === CodingStatus.Paused ? (
                              <button onClick={handleResume} className="px-6 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/50 rounded-lg font-bold hover:bg-emerald-500/20">Resume</button>
                          ) : (
                              <button onClick={() => exportToCSV(processedRows, 'coded_results.csv')} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-500 shadow-lg flex items-center gap-2">
                                  <DownloadIcon className="w-4 h-4" /> Export CSV
                              </button>
                          )}
                      </div>
                  </div>
                  
                  {/* Progress Bar */}
                  {(codingStatus === CodingStatus.Processing || codingStatus === CodingStatus.Paused) && (
                      <div className="w-full bg-slate-700 h-2 rounded-full mb-8 overflow-hidden">
                          <div 
                            className="bg-blue-500 h-full transition-all duration-300 ease-out" 
                            style={{ width: `${(progress.current / progress.total) * 100}%` }} 
                          />
                      </div>
                  )}

                  <ResultsTable 
                    rows={processedRows} 
                    onEdit={setManualModalRow} 
                    onDelete={(id) => setProcessedRows(prev => prev.filter(r => r.id !== id))}
                    onBulkAction={(action, ids) => {
                        if(action === 'delete') {
                            setProcessedRows(prev => prev.filter(r => !ids.includes(r.id)));
                        }
                    }}
                  />
              </div>
          );
      }
  };

  const renderContent = () => {
    switch (activeModule) {
      case 'roadmap': return <RoadmapView />;
      case 'knowledge': return <KnowledgeBaseView />;
      case 'dashboard': return <DashboardView />;
      default: return renderCodingView();
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
        {/* Privacy Shield Indicator */}
        <div className="fixed top-4 right-6 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 backdrop-blur border border-slate-700 text-xs font-bold text-slate-400 pointer-events-none">
            {settings.provider === AIProvider.Local ? (
                <><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div> Local Privacy Mode</>
            ) : (
                <><div className="w-2 h-2 rounded-full bg-amber-500"></div> Cloud Mode ({settings.provider})</>
            )}
        </div>

      <Sidebar 
        activeModule={activeModule}
        onModuleSelect={(m) => { setActiveModule(m); setCodingStatus(CodingStatus.Idle); setProcessedRows([]); }}
        onOpenSettings={() => setSettingsOpen(true)}
        currentProvider={settings.provider}
        onSaveSession={() => alert('Session Saved')}
        onClearSession={() => { setRawData([]); setProcessedRows([]); setCodingStatus(CodingStatus.Idle); }}
        canInstall={canInstall}
        onInstall={() => alert("Install PWA")}
      />
      <div className="flex-1 ml-64 overflow-auto pt-8">
         {renderContent()}
      </div>
      
      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        settings={settings}
        onSave={setSettings}
      />

      {manualModalRow && (
          <ManualCodingModal 
            isOpen={true}
            onClose={() => setManualModalRow(null)}
            row={manualModalRow}
            module={activeModule as ModuleType}
            settings={settings}
            onSave={(result) => {
                setProcessedRows(prev => prev.map(r => r.id === manualModalRow.id ? { ...r, result, manuallyEdited: true } : r));
            }}
          />
      )}
    </div>
  );
}

export default App;