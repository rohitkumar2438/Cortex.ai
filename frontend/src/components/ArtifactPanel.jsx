import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
    Code2,
    Play,
    Copy,
    Check,
    X,
    RotateCw,
    Monitor,
    Tablet,
    Smartphone,
    FileCode,
    Sparkles,
    Maximize2,
    Minimize2
} from 'lucide-react';

export const ArtifactPanel = ({ artifact, onClose }) => {
    const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'code'
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);
    const [deviceMode, setDeviceMode] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
    const [copied, setCopied] = useState(false);
    const [iframeKey, setIframeKey] = useState(0);
    const [isFullScreen, setIsFullScreen] = useState(false);

    const files = artifact?.files || [];
    const activeFile = files[selectedFileIndex] || files[0] || { name: 'index.html', content: '', language: 'html' };

    // Reset selected file if files change
    useEffect(() => {
        if (selectedFileIndex >= files.length) {
            setSelectedFileIndex(0);
        }
    }, [files]);

    // Build bundled HTML for sandboxed iframe
    const buildCombinedHtml = () => {
        if (artifact?.preview) {
            return artifact.preview;
        }

        const htmlFile = files.find(f => f.name.endsWith('.html') || f.language === 'html')?.content || '';
        const cssFile = files.find(f => f.name.endsWith('.css') || f.language === 'css')?.content || '';
        const jsFile = files.find(f => f.name.endsWith('.js') || f.language === 'javascript')?.content || '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cortex Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body { font-family: 'Inter', sans-serif; }
    ${cssFile}
  </style>
</head>
<body class="bg-slate-950 text-slate-100 p-4 min-h-screen">
  ${htmlFile}
  <script>
    try {
      ${jsFile}
      if (window.lucide) { lucide.createIcons(); }
    } catch(err) {
      console.error('Runtime script error:', err);
    }
  </script>
</body>
</html>`;
    };

    const handleCopyFile = async () => {
        if (!activeFile?.content) return;
        try {
            await navigator.clipboard.writeText(activeFile.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy file content:', err);
        }
    };

    const getViewportWidth = () => {
        switch (deviceMode) {
            case 'mobile':
                return 'max-w-[375px] h-[667px] my-auto';
            case 'tablet':
                return 'max-w-[768px] h-[90%] my-auto';
            case 'desktop':
            default:
                return 'w-full h-full';
        }
    };

    return (
        <div
            className={`flex flex-col bg-slate-950 border-l border-indigo-900/50 shadow-2xl transition-all duration-300 z-40 ${
                isFullScreen ? 'fixed inset-0 z-50' : 'w-full lg:w-[50%] xl:w-[55%] h-full shrink-0'
            }`}
        >
            {/* Top Toolbar */}
            <header className="h-14 border-b border-indigo-950/40 flex items-center justify-between px-4 bg-slate-900/90 backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-400">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-white tracking-wide">
                            Artifact Workspace
                        </h3>
                        <p className="text-[10px] text-slate-400">
                            {files.length} project file{files.length === 1 ? '' : 's'} • DeepSeek
                        </p>
                    </div>
                </div>

                {/* View Mode Toggle: Preview vs Code */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-indigo-950/60">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            activeTab === 'preview'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Play className="w-3.5 h-3.5" />
                        <span>Live Preview</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('code')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            activeTab === 'code'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Code View</span>
                    </button>
                </div>

                {/* Window Controls */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title={isFullScreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                        {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Close Artifact Panel"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Sub-Header: File Tabs & Viewport Switchers */}
            <div className="h-11 px-4 border-b border-indigo-950/40 bg-slate-900/50 flex items-center justify-between overflow-x-auto gap-2">
                {/* File Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                    {files.map((file, idx) => {
                        const isSelected = selectedFileIndex === idx;

                        return (
                            <button
                                key={idx}
                                onClick={() => setSelectedFileIndex(idx)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all whitespace-nowrap cursor-pointer ${
                                    isSelected
                                        ? 'bg-indigo-950/90 text-indigo-200 border border-indigo-500/50 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                }`}
                            >
                                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                                <span>{file.name}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 shrink-0">
                    {activeTab === 'preview' ? (
                        <>
                            {/* Device Viewport Selector */}
                            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-950 border border-indigo-950/60">
                                <button
                                    onClick={() => setDeviceMode('desktop')}
                                    className={`p-1 rounded ${deviceMode === 'desktop' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    title="Desktop view"
                                >
                                    <Monitor className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setDeviceMode('tablet')}
                                    className={`p-1 rounded ${deviceMode === 'tablet' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    title="Tablet view"
                                >
                                    <Tablet className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setDeviceMode('mobile')}
                                    className={`p-1 rounded ${deviceMode === 'mobile' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    title="Mobile view"
                                >
                                    <Smartphone className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <button
                                onClick={() => setIframeKey(k => k + 1)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                title="Refresh live preview"
                            >
                                <RotateCw className="w-3.5 h-3.5" />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleCopyFile}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950 border border-indigo-700/50 text-xs text-indigo-200 hover:bg-indigo-900 transition-all cursor-pointer"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Copied!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy file</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area: Live Preview or Code Editor */}
            <div className="flex-1 overflow-hidden relative bg-[#0f1422] flex items-center justify-center p-2">
                {activeTab === 'preview' ? (
                    <div className={`transition-all duration-300 rounded-xl overflow-hidden shadow-2xl border border-indigo-950/60 bg-white ${getViewportWidth()}`}>
                        <iframe
                            key={iframeKey}
                            srcDoc={buildCombinedHtml()}
                            title="Cortex Live Artifact Preview"
                            sandbox="allow-scripts allow-modals allow-forms allow-popups"
                            className="w-full h-full border-0 bg-slate-950"
                        />
                    </div>
                ) : (
                    <div className="w-full h-full overflow-auto rounded-xl border border-indigo-950/50 bg-[#1e1e2e]">
                        <SyntaxHighlighter
                            language={activeFile.language || 'javascript'}
                            style={oneDark}
                            showLineNumbers={true}
                            customStyle={{
                                margin: 0,
                                padding: '1rem',
                                background: 'transparent',
                                fontSize: '0.85rem',
                                lineHeight: '1.6'
                            }}
                        >
                            {activeFile.content || '// Empty file'}
                        </SyntaxHighlighter>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ArtifactPanel;
