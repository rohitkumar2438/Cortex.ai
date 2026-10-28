import React, { useState, useEffect, useRef } from 'react';
import { 
  Code2, Play, Download, X, Copy, Check, FileCode, Layers, 
  Monitor, Tablet, Smartphone, RotateCw, Terminal, Maximize2, 
  Minimize2, ExternalLink, Sparkles, AlertCircle 
} from 'lucide-react';

export default function ArtifactWorkspace({ content, type, url, artifacts, onClose }) {
  const [activeView, setActiveView] = useState('preview'); // 'preview' | 'code'
  const [deviceViewport, setDeviceViewport] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [files, setFiles] = useState([]);
  const [combinedHtml, setCombinedHtml] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const iframeRef = useRef(null);

  // Parse files and assemble interactive HTML sandbox
  useEffect(() => {
    let parsedFiles = [];

    // 1. Structured files artifact from Coding Agent
    if (artifacts?.files && Array.isArray(artifacts.files) && artifacts.files.length > 0) {
      parsedFiles = artifacts.files;
    } 
    // 2. Parse XML / Tag protocol if present in raw content
    else if (content && (content.includes('<cortexArtifact') || content.includes('<cortexFile'))) {
      const fileRegex = /<cortexFile[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/cortexFile>/gi;
      let match;
      while ((match = fileRegex.exec(content)) !== null) {
        parsedFiles.push({
          name: match[1].trim(),
          content: match[2].trim()
        });
      }
    }
    // 3. Fallback: Parse markdown codeblocks
    else if (type === 'code' && content) {
      const codeBlocks = [...content.matchAll(/```(\w+)?\n([\s\S]*?)```/g)];
      if (codeBlocks.length > 0) {
        parsedFiles = codeBlocks.map((b, i) => {
          const lang = (b[1] || '').toLowerCase();
          const ext = lang === 'html' ? 'html' : lang === 'css' ? 'css' : lang === 'javascript' || lang === 'js' ? 'js' : 'txt';
          const defaultName = ext === 'html' ? 'index.html' : ext === 'css' ? 'style.css' : ext === 'js' ? 'app.js' : `file${i + 1}.${ext}`;
          return {
            name: defaultName,
            content: b[2].trim()
          };
        });
      } else {
        parsedFiles = [{ name: 'index.html', content: content.includes('<html') ? content : `<!DOCTYPE html><html><body>${content}</body></html>` }];
      }
    }

    if (parsedFiles.length > 0) {
      setFiles(parsedFiles);
      setSelectedFileIndex(0);

      // Assemble bundled HTML with modern CDNs (Tailwind, Lucide, Fonts, Error Interceptor)
      const htmlFile = parsedFiles.find(f => f.name.endsWith('.html'))?.content || '';
      const cssFile = parsedFiles.find(f => f.name.endsWith('.css'))?.content || '';
      const jsFile = parsedFiles.find(f => f.name.endsWith('.js'))?.content || '';

      // If htmlFile is a complete document, inject style/script into head/body
      let finalHtml = htmlFile;
      if (!finalHtml.includes('<!DOCTYPE html>') && !finalHtml.includes('<html')) {
        finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cortex Preview</title>
</head>
<body class="bg-slate-950 text-slate-100 p-4">
  ${htmlFile}
</body>
</html>`;
      }

      // Inject CDNs and error capture
      const cdnInjections = `
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <script>
    // Console log forwarding to parent workspace
    const _origLog = console.log;
    const _origError = console.error;
    const _origWarn = console.warn;
    console.log = function(...args) {
      window.parent.postMessage({ type: 'CORTEX_CONSOLE', level: 'info', text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
      _origLog.apply(console, args);
    };
    console.warn = function(...args) {
      window.parent.postMessage({ type: 'CORTEX_CONSOLE', level: 'warn', text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
      _origWarn.apply(console, args);
    };
    console.error = function(...args) {
      window.parent.postMessage({ type: 'CORTEX_CONSOLE', level: 'error', text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
      _origError.apply(console, args);
    };
    window.onerror = function(msg, url, line) {
      window.parent.postMessage({ type: 'CORTEX_CONSOLE', level: 'error', text: msg + ' (Line ' + line + ')' }, '*');
    };
  </script>
  <style>
    body { font-family: 'Inter', sans-serif; }
    /* Custom scrollbars */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 9999px; }
  </style>`;

      // Place CDN before </head> or at start
      if (finalHtml.includes('</head>')) {
        finalHtml = finalHtml.replace('</head>', `${cdnInjections}</head>`);
      } else {
        finalHtml = cdnInjections + finalHtml;
      }

      // Inject custom CSS
      if (cssFile) {
        const styleTag = `<style>\n${cssFile}\n</style>`;
        if (finalHtml.includes('</head>')) {
          finalHtml = finalHtml.replace('</head>', `${styleTag}</head>`);
        } else {
          finalHtml += styleTag;
        }
      }

      // Inject custom JS and initialize Lucide icons
      const scriptTag = `<script>
try {
${jsFile}
} catch(e) {
  console.error("Runtime error:", e.message);
}
// Init Lucide
if (window.lucide) { lucide.createIcons(); }
</script>`;

      if (finalHtml.includes('</body>')) {
        finalHtml = finalHtml.replace('</body>', `${scriptTag}</body>`);
      } else {
        finalHtml += scriptTag;
      }

      setCombinedHtml(finalHtml);
    }
  }, [content, type, artifacts]);

  // Listen for console logs from iframe
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'CORTEX_CONSOLE') {
        setConsoleLogs(prev => [...prev.slice(-49), { level: e.data.level, text: e.data.text, time: new Date().toLocaleTimeString() }]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const activeFile = files[selectedFileIndex] || { name: 'code', content: content || '' };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHardRefresh = () => {
    setIframeKey(k => k + 1);
    setConsoleLogs([]);
  };

  // 1-Click ZIP Download for the complete project
  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    try {
      // Dynamically load JSZip from CDN if not present
      let JSZipLib = window.JSZip;
      if (!JSZipLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        document.head.appendChild(script);
        await new Promise((res, rej) => {
          script.onload = res;
          script.onerror = rej;
        });
        JSZipLib = window.JSZip;
      }

      const zip = new JSZipLib();
      files.forEach(f => {
        zip.file(f.name, f.content);
      });

      // Include a friendly README.md
      zip.file("README.md", `# Generated with Cortex AI\n\nTo view this project, open \`index.html\` in your browser or run a local server:\n\`\`\`bash\nnpx serve .\n\`\`\`\n`);

      const contentBlob = await zip.generateAsync({ type: "blob" });
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(contentBlob);
      downloadLink.download = `${artifacts?.title?.toLowerCase().replace(/\s+/g, '-') || 'cortex-project'}.zip`;
      downloadLink.click();
      URL.revokeObjectURL(downloadLink.href);
    } catch (e) {
      console.error("ZIP download failed, falling back to active file download:", e);
      // Fallback: download active file
      const blob = new Blob([activeFile.content], { type: 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = activeFile.name;
      link.click();
    } finally {
      setDownloadingZip(false);
    }
  };

  // Viewport widths
  const viewportStyles = {
    desktop: 'w-full h-full rounded-none border-0',
    tablet: 'w-[768px] h-[92%] rounded-2xl border-4 border-slate-700 shadow-2xl my-auto transition-all duration-300',
    mobile: 'w-[375px] h-[90%] rounded-[36px] border-[6px] border-slate-700 shadow-2xl my-auto transition-all duration-300'
  };

  return (
    <div className={`h-full border-l border-slate-200 bg-slate-900 flex flex-col font-sans transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 w-screen' : 'w-full'}`}>
      {/* Header bar */}
      <div className="h-14 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 bg-slate-950 text-white">
        {/* Left: View Tabs */}
        <div className="flex items-center gap-2">
          {type === 'code' ? (
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button 
                onClick={() => setActiveView('preview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${activeView === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                <Play className="h-3.5 w-3.5" /> Live Preview
              </button>
              <button 
                onClick={() => setActiveView('code')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${activeView === 'code' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
              >
                <Code2 className="h-3.5 w-3.5" /> Source Code ({files.length || 1})
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold capitalize text-slate-200">{type} Workspace</span>
            </div>
          )}
        </div>

        {/* Center: Device Viewport Switcher (Preview Mode Only) */}
        {type === 'code' && activeView === 'preview' && (
          <div className="hidden sm:flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-0.5">
            <button
              onClick={() => setDeviceViewport('desktop')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${deviceViewport === 'desktop' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
              title="Desktop View (100%)"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeviceViewport('tablet')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${deviceViewport === 'tablet' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
              title="Tablet View (768px)"
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDeviceViewport('mobile')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${deviceViewport === 'mobile' ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-white'}`}
              title="Mobile View (375px)"
            >
              <Smartphone className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {type === 'code' && activeView === 'preview' && (
            <button 
              onClick={handleHardRefresh}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Rerun / Refresh Sandbox"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          )}

          {type === 'code' && (
            <button 
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1.5 border border-slate-700"
              title="Download Full Project ZIP"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden md:inline">{downloadingZip ? "Zipping..." : "Download ZIP"}</span>
            </button>
          )}

          <button 
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:block"
            title={isFullScreen ? "Exit Full Screen" : "Expand Full Screen"}
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors ml-1"
            title="Close Workspace"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-950">
        {type === 'code' ? (
          activeView === 'preview' ? (
            /* Live Interactive Sandboxed Preview */
            <div className="flex-1 w-full h-full flex flex-col items-center justify-center overflow-hidden bg-slate-900/60 p-2 sm:p-4">
              <iframe 
                key={iframeKey}
                ref={iframeRef}
                srcDoc={combinedHtml}
                title="Cortex Live Artifact"
                sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
                className={`bg-white shadow-2xl overflow-auto ${viewportStyles[deviceViewport]}`}
              />

              {/* Bottom Console Drawer Toggle */}
              <div className="w-full flex items-center justify-between pt-2 px-2 shrink-0">
                <button 
                  onClick={() => setShowConsole(!showConsole)}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 hover:text-white transition-colors"
                >
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Console ({consoleLogs.length})</span>
                </button>
                <div className="text-[11px] text-slate-400 font-mono">
                  Tailwind CSS • Lucide Icons • Sandboxed
                </div>
              </div>

              {/* Collapsible Console Drawer */}
              {showConsole && (
                <div className="w-full h-32 bg-slate-950 border-t border-slate-800 p-2 overflow-y-auto font-mono text-xs space-y-1">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] text-slate-400">
                    <span>RUNTIME CONSOLE LOGS</span>
                    <button onClick={() => setConsoleLogs([])} className="hover:text-white">Clear</button>
                  </div>
                  {consoleLogs.length === 0 ? (
                    <p className="text-slate-400 italic text-[11px] py-1">No console output recorded.</p>
                  ) : (
                    consoleLogs.map((log, idx) => (
                      <div key={idx} className={`flex items-start gap-2 ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-slate-300'}`}>
                        <span className="text-slate-400 text-[10px] shrink-0">{log.time}</span>
                        <span className="break-all">{log.text}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Multi-File Code Inspector */
            <div className="flex-1 flex flex-col h-full bg-[#0B0F19] overflow-hidden text-white">
              {/* File Tabs Bar */}
              <div className="flex items-center justify-between border-b border-slate-800 bg-[#070A11] px-2 overflow-x-auto shrink-0">
                <div className="flex items-center gap-1">
                  {files.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedFileIndex(idx)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                        selectedFileIndex === idx
                          ? 'border-indigo-500 text-white bg-slate-900/60'
                          : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                      }`}
                    >
                      <FileCode className={`h-3.5 w-3.5 ${file.name.endsWith('.html') ? 'text-orange-400' : file.name.endsWith('.css') ? 'text-blue-400' : 'text-amber-400'}`} />
                      {file.name}
                    </button>
                  ))}
                </div>

                {/* File info & copy button */}
                <div className="flex items-center gap-2 pr-2 py-1">
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                    {activeFile.content.split('\n').length} lines
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-medium transition-colors border border-slate-700"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Code Viewer with Line Numbers */}
              <div className="flex-1 overflow-auto flex text-xs font-mono leading-relaxed bg-[#0B0F19]">
                {/* Gutter */}
                <div className="py-4 px-3 select-none text-slate-400 text-right bg-[#070A11] border-r border-slate-800/80">
                  {activeFile.content.split('\n').map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                {/* Source text */}
                <pre className="p-4 text-slate-200 flex-1 overflow-x-auto whitespace-pre font-mono">
                  <code>{activeFile.content}</code>
                </pre>
              </div>
            </div>
          )
        ) : (
          /* Image, PDF, PPT viewer */
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-950 text-white">
            {type === 'image' && url ? (
              <div className="flex flex-col items-center gap-4 max-h-full overflow-auto">
                <img 
                  src={url} 
                  alt="Generated Artifact" 
                  className="max-h-[65vh] max-w-full rounded-2xl shadow-2xl border border-slate-800 object-contain"
                />
                <a
                  href={url}
                  download="cortex-ai-image.jpg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 shadow-lg flex items-center gap-2 transition-all"
                >
                  <Download className="h-4 w-4" /> Download Full Resolution
                </a>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 max-w-md">
                <div className="h-20 w-20 bg-indigo-500/20 text-indigo-400 rounded-3xl flex items-center justify-center shadow-inner border border-indigo-500/30">
                  <Download className="h-9 w-9" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Your {type?.toUpperCase()} is Ready!</h3>
                  <p className="text-xs text-slate-400 mt-1">Generated and packaged cleanly.</p>
                </div>
                {url && (
                  <a
                    href={url}
                    download={`cortex-document.${type === 'ppt' ? 'pptx' : 'pdf'}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-xs font-bold hover:from-indigo-500 hover:to-violet-500 shadow-lg flex items-center gap-2 transition-all"
                  >
                    <Download className="h-4 w-4" /> Download {type?.toUpperCase()} Document
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
