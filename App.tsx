import React, { useState, useCallback } from 'react';
import JSZip from 'jszip';
import FileSaver from 'file-saver';
import { 
  FileText, Download, Image as ImageIcon, Zap, Loader2, Sparkles, CheckCircle, 
  Menu, X, FileOutput, Minimize2, FolderArchive, ScanText, ArrowRight, Trash2, Home,
  Search
} from 'lucide-react';
import { Dropzone } from './components/Dropzone';
import { getPdfPageCount, convertPdfToImages, extractTextFromPdf } from './utils/pdfUtils';
import { convertImage, compressImage, imagesToPdf } from './utils/imageUtils';
import { performOcr } from './utils/ocrUtils';
import { extractZip } from './utils/zipUtils';
import { analyzePdfContent } from './services/geminiService';
import { AppFile, ToolConfig, ToolId, AiInsight } from './types';

// --- Configuration ---

const TOOLS: ToolConfig[] = [
  { id: 'pdf-to-jpg', name: 'PDF to JPG', description: 'Convert unlimited PDFs to images', category: 'PDF', accept: '.pdf', multiple: true },
  { id: 'jpg-to-pdf', name: 'JPG to PDF', description: 'Merge images into a single PDF', category: 'PDF', accept: 'image/*', multiple: true },
  { id: 'png-to-jpg', name: 'PNG to JPG', description: 'Convert PNG images to JPG', category: 'Image', accept: 'image/png', multiple: true },
  { id: 'jpg-to-png', name: 'JPG to PNG', description: 'Convert JPG images to PNG', category: 'Image', accept: 'image/jpeg, image/jpg', multiple: true },
  { id: 'webp-to-jpg', name: 'WEBP to JPG', description: 'Convert WEBP to standard JPG', category: 'Image', accept: 'image/webp', multiple: true },
  { id: 'compress-image', name: 'Image Compressor', description: 'Reduce image size quality', category: 'Image', accept: 'image/*', multiple: true },
  { id: 'zip-extractor', name: 'ZIP Extractor', description: 'Extract files from ZIP archives', category: 'Utility', accept: '.zip', multiple: false },
  { id: 'ocr', name: 'Image to Text (OCR)', description: 'Extract text from images', category: 'Utility', accept: 'image/*', multiple: false },
];

const generateId = () => Math.random().toString(36).substring(2, 9);

const App: React.FC = () => {
  const [activeToolId, setActiveToolId] = useState<ToolId | 'dashboard'>('dashboard');
  const [files, setFiles] = useState<AppFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Gemini AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<AiInsight | null>(null);

  const activeTool = TOOLS.find(t => t.id === activeToolId);

  // --- Handlers ---

  const handleFilesAdded = async (newFiles: File[]) => {
    // Allow single file if tool restricts it
    const filesToProcess = activeTool?.multiple ? newFiles : [newFiles[0]];
    
    const appFiles: AppFile[] = filesToProcess.map(f => ({
      id: generateId(),
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
      status: 'pending'
    }));

    // If single file tool, replace existing
    if (!activeTool?.multiple) {
        setFiles(appFiles);
    } else {
        setFiles(prev => [...prev, ...appFiles]);
    }

    // Pre-processing (like page counts)
    if (activeToolId === 'pdf-to-jpg') {
        for (const pf of appFiles) {
            getPdfPageCount(pf.file).then(() => {
                // Just ensuring it loads
            }).catch(console.error);
        }
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
    setAiInsight(null);
  };

  const processFiles = async () => {
    if (files.length === 0 || !activeTool) return;
    setIsProcessing(true);

    // Special case: JPG to PDF merges ALL files into ONE output
    if (activeToolId === 'jpg-to-pdf') {
        try {
            const pdfBlob = await imagesToPdf(files.map(f => f.file));
            FileSaver.saveAs(pdfBlob, 'merged_images.pdf');
            
            setFiles(prev => prev.map(f => ({ ...f, status: 'completed' })));
        } catch (e: any) {
            console.error("PDF Generation Error:", e);
            const msg = e instanceof Error ? e.message : "An unexpected error occurred.";
            alert(`Failed to generate PDF: ${msg}`);
        } finally {
            setIsProcessing(false);
        }
        return;
    }

    // Process sequentially
    for (const file of files) {
        if (file.status === 'completed') continue;
        
        setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'processing' } : f));

        try {
            let result: Partial<AppFile> = { status: 'completed' };

            switch (activeToolId) {
                case 'pdf-to-jpg': {
                    // Returns base64 strings
                    const images = await convertPdfToImages({ ...file, images: [] } as any, 2.0, 0.9);
                    // Convert base64 to blobs for storage structure compatibility
                    const blobs = await Promise.all(images.map(async (b64, idx) => {
                        const res = await fetch(b64);
                        const blob = await res.blob();
                        return { name: `${file.name.replace('.pdf', '')}_page-${idx+1}.jpg`, blob };
                    }));
                    result = { outputFiles: blobs, status: 'completed' };
                    break;
                }
                case 'png-to-jpg':
                case 'webp-to-jpg': {
                    const blob = await convertImage(file.file, 'image/jpeg');
                    result = { outputFiles: [{ name: file.name.replace(/\.[^/.]+$/, "") + ".jpg", blob }], status: 'completed' };
                    break;
                }
                case 'jpg-to-png': {
                    const blob = await convertImage(file.file, 'image/png');
                    result = { outputFiles: [{ name: file.name.replace(/\.[^/.]+$/, "") + ".png", blob }], status: 'completed' };
                    break;
                }
                case 'compress-image': {
                    const blob = await compressImage(file.file, 0.6); // 60% quality
                    result = { outputFiles: [{ name: "min_" + file.name, blob }], status: 'completed' };
                    break;
                }
                case 'zip-extractor': {
                    const extracted = await extractZip(file.file);
                    result = { outputFiles: extracted, status: 'completed' };
                    break;
                }
                case 'ocr': {
                    const text = await performOcr(file.file);
                    result = { textResult: text, status: 'completed' };
                    break;
                }
            }

            setFiles(prev => prev.map(f => f.id === file.id ? { ...f, ...result } : f));

        } catch (e: any) {
            console.error("Processing Error for file " + file.name, e);
            const msg = e instanceof Error ? e.message : JSON.stringify(e);
            setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error' } : f));
            alert(`Error processing ${file.name}: ${msg}`);
        }
    }
    setIsProcessing(false);
  };

  const downloadResults = async () => {
    // If only one file and one output, download directly
    const completedFiles = files.filter(f => f.status === 'completed' && f.outputFiles?.length);
    if (completedFiles.length === 0) return;

    if (completedFiles.length === 1 && completedFiles[0].outputFiles?.length === 1) {
        const f = completedFiles[0].outputFiles[0];
        FileSaver.saveAs(f.blob, f.name);
        return;
    }

    // Otherwise zip
    const zip = new JSZip();
    // Create a folder inside zip to hold everything (as requested before)
    const folder = zip.folder("Converted_Files");

    completedFiles.forEach(f => {
        f.outputFiles?.forEach(out => {
            folder?.file(out.name, out.blob);
        });
    });

    const content = await zip.generateAsync({ type: 'blob' });
    FileSaver.saveAs(content, 'SmartConvert_Files.zip');
  };

  // --- Gemini Handler ---
  const handleAiAnalysis = async () => {
    if (activeToolId !== 'pdf-to-jpg' || files.length === 0) return;
    setIsAnalyzing(true);
    try {
        const text = await extractTextFromPdf(files[0].file);
        if (text) {
            const result = await analyzePdfContent(text);
            setAiInsight(result);
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsAnalyzing(false);
    }
  };

  // --- Render Helpers ---

  const renderToolIcon = (id: ToolId) => {
    const t = TOOLS.find(x => x.id === id);
    if (!t) return <Home />;
    switch (id) {
        case 'pdf-to-jpg': return <FileText className="text-red-400" />;
        case 'jpg-to-pdf': return <FileOutput className="text-orange-400" />;
        case 'png-to-jpg': 
        case 'jpg-to-png': 
        case 'webp-to-jpg': return <ImageIcon className="text-blue-400" />;
        case 'compress-image': return <Minimize2 className="text-green-400" />;
        case 'zip-extractor': return <FolderArchive className="text-yellow-400" />;
        case 'ocr': return <ScanText className="text-purple-400" />;
        default: return <Zap />;
    }
  };

  const getFilteredTools = (category: string) => {
    const q = searchQuery.toLowerCase();
    return TOOLS.filter(t => 
      t.category === category && 
      (t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    );
  };

  // --- Views ---

  const DashboardView = () => {
    const q = searchQuery.toLowerCase();
    const visibleTools = TOOLS.filter(t => 
      t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );

    return (
        <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">
                {searchQuery ? `Search Results (${visibleTools.length})` : 'All Tools'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleTools.map(tool => (
                    <button 
                        key={tool.id}
                        onClick={() => { setActiveToolId(tool.id); clearAll(); }}
                        className="group relative bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 p-6 rounded-2xl text-left transition-all hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-slate-900 rounded-xl group-hover:scale-110 transition-transform">
                                {renderToolIcon(tool.id)}
                            </div>
                            <span className="text-xs font-medium text-slate-500 bg-slate-900 px-2 py-1 rounded-full border border-slate-700">
                                {tool.category}
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-100 mb-1">{tool.name}</h3>
                        <p className="text-sm text-slate-400">{tool.description}</p>
                        
                        <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ArrowRight className="w-5 h-5 text-indigo-400" />
                        </div>
                    </button>
                ))}
                {visibleTools.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500">
                        No tools found matching "{searchQuery}"
                    </div>
                )}
            </div>
        </div>
    );
  };

  const ToolView = () => (
    <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="mb-8 flex items-center justify-between">
            <div>
                <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    {renderToolIcon(activeTool!.id)}
                    {activeTool?.name}
                </h2>
                <p className="text-slate-400">{activeTool?.description}</p>
            </div>
            {files.length > 0 && (
                <button onClick={clearAll} className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1">
                    <Trash2 className="w-4 h-4" /> Clear
                </button>
            )}
        </div>

        <Dropzone 
            onFilesAdded={handleFilesAdded} 
            accept={activeTool?.accept || '*'}
            multiple={activeTool?.multiple ?? true}
        />
        
        {files.length > 0 && (
            <div className="mt-8 bg-slate-800/40 rounded-2xl border border-slate-700 overflow-hidden">
                <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-semibold text-slate-200">Files ({files.length})</h3>
                    {activeToolId === 'pdf-to-jpg' && process.env.API_KEY && (
                         <button 
                            onClick={handleAiAnalysis}
                            disabled={isAnalyzing}
                            className="flex items-center gap-2 text-xs bg-indigo-500/10 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors"
                         >
                            <Sparkles className="w-3 h-3" /> 
                            {isAnalyzing ? 'Analyzing...' : 'AI Insights'}
                         </button>
                    )}
                </div>
                
                <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
                    {files.map(file => (
                        <div key={file.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700/50 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                                        {file.status === 'completed' ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <FileText className="w-5 h-5 text-slate-500" />}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-slate-200 truncate">{file.name}</p>
                                        <p className="text-xs text-slate-500">{(file.size/1024/1024).toFixed(2)} MB</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {file.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
                                    {file.status === 'error' && <span className="text-red-400 text-xs">Failed</span>}
                                    <button onClick={() => removeFile(file.id)} className="text-slate-600 hover:text-red-400">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Tool Specific Results */}
                            {file.status === 'completed' && (
                                <div className="bg-slate-950/50 rounded-lg p-3 text-sm">
                                    {activeToolId === 'ocr' && file.textResult && (
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <p className="whitespace-pre-wrap font-mono text-slate-300">{file.textResult}</p>
                                            <button 
                                              onClick={() => navigator.clipboard.writeText(file.textResult || '')}
                                              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
                                            >
                                                Copy Text
                                            </button>
                                        </div>
                                    )}
                                    {activeToolId === 'zip-extractor' && file.outputFiles && (
                                        <div className="space-y-1">
                                            <p className="text-slate-400 text-xs mb-2">Contents:</p>
                                            {file.outputFiles.map((f, i) => (
                                                <div key={i} className="flex justify-between items-center text-slate-300 bg-slate-800/50 p-2 rounded">
                                                    <span className="truncate max-w-[200px]">{f.name}</span>
                                                    <button 
                                                        onClick={() => FileSaver.saveAs(f.blob, f.name)}
                                                        className="text-indigo-400 hover:text-indigo-300"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {/* Default success message for converters */}
                                    {!['ocr', 'zip-extractor'].includes(activeToolId) && (
                                        <div className="text-emerald-400 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4" /> Successfully processed
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* AI Insights Panel */}
                {aiInsight && (
                    <div className="m-4 p-4 bg-indigo-900/20 border border-indigo-500/20 rounded-xl">
                        <h4 className="text-indigo-300 font-semibold mb-2 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> Document Insights
                        </h4>
                        <p className="text-slate-300 text-sm mb-3">{aiInsight.summary}</p>
                        <div className="flex gap-2 flex-wrap">
                            {aiInsight.keywords.map((k,i) => (
                                <span key={i} className="text-xs bg-indigo-500/20 text-indigo-200 px-2 py-1 rounded">#{k}</span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="p-4 bg-slate-800/80 border-t border-slate-700 flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={processFiles}
                        disabled={isProcessing}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                    >
                        {isProcessing ? <Loader2 className="animate-spin" /> : <Zap />}
                        {activeToolId === 'jpg-to-pdf' ? 'Merge & Download PDF' : 'Start Processing'}
                    </button>
                    
                    {/* Show Download All if we have completed files (except for jpg-to-pdf which auto downloads) */}
                    {activeToolId !== 'jpg-to-pdf' && files.some(f => f.status === 'completed') && (
                         <button
                         onClick={downloadResults}
                         className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                     >
                         <Download />
                         Download All (ZIP)
                     </button>
                    )}
                </div>
            </div>
        )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row font-sans">
        
        {/* Mobile Header */}
        <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <Zap className="text-white w-5 h-5" />
                </div>
                <span className="font-bold text-lg">SmartConvert</span>
            </div>
            <button onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <X /> : <Menu />}
            </button>
        </div>

        {/* Sidebar */}
        <aside className={`
            fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 ease-in-out flex flex-col
            md:relative md:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            <div className="p-6">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Zap className="text-white w-6 h-6" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">SmartConvert</span>
                </div>

                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="Search tools..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                    />
                </div>

                <nav className="space-y-1 overflow-y-auto flex-1">
                    <button
                        onClick={() => { setActiveToolId('dashboard'); setSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                            activeToolId === 'dashboard' 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                        }`}
                    >
                        <Home className="w-5 h-5" />
                        <span className="font-medium">Dashboard</span>
                    </button>

                    {['PDF', 'Image', 'Utility'].map(category => {
                        const catTools = getFilteredTools(category);
                        if (catTools.length === 0) return null;

                        return (
                            <React.Fragment key={category}>
                                <div className="pt-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">{category} Tools</div>
                                {catTools.map(tool => (
                                    <button
                                        key={tool.id}
                                        onClick={() => { setActiveToolId(tool.id); setSidebarOpen(false); clearAll(); }}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-sm ${
                                            activeToolId === tool.id 
                                            ? 'bg-slate-800 text-indigo-400 border border-slate-700' 
                                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                        }`}
                                    >
                                        {renderToolIcon(tool.id)}
                                        {tool.name}
                                    </button>
                                ))}
                            </React.Fragment>
                        );
                    })}
                </nav>
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 md:p-8 lg:p-12 overflow-y-auto">
            {activeToolId === 'dashboard' ? <DashboardView /> : <ToolView />}
        </main>

    </div>
  );
};

export default App;