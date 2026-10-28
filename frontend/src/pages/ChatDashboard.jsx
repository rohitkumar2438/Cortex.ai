import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Sidebar from '../components/Sidebar.jsx';
import AgentSelector from '../components/AgentSelector.jsx';
import AgentCards from '../components/AgentCards.jsx';
import MarkdownRenderer from '../components/MarkdownRenderer.jsx';
import SSEStatusIndicator from '../components/SSEStatusIndicator.jsx';
import ArtifactPanel from '../components/ArtifactPanel.jsx';
import ToastContainer from '../components/ToastContainer.jsx';
import { BillingModal } from '../components/BillingModal.jsx';
import {
    fetchConversations,
    createNewConversation,
    addMessage,
    setStreamingStatus,
    setIsStreaming
} from '../store/slices/chatSlice.js';
import { updateUserCredits } from '../store/slices/authSlice.js';
import { toggleSidebar, addToast } from '../store/slices/uiSlice.js';
import {
    Send,
    PanelLeft,
    Sparkles,
    User,
    Bot,
    Loader2,
    FileCode,
    Play,
    Download,
    FileText,
    Presentation,
    Image as ImageIcon,
    Coins,
    Paperclip,
    CheckCircle2,
    X
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const ChatDashboard = () => {
    const dispatch = useDispatch();
    const { conversations, activeConversationId, messages, selectedAgent, streamingStatus, isStreaming } = useSelector((state) => state.chat);
    const { user } = useSelector((state) => state.auth);
    const sidebarOpen = useSelector((state) => state.ui.sidebarOpen);

    const [inputPrompt, setInputPrompt] = useState('');
    const [activeArtifact, setActiveArtifact] = useState(null);
    const [isBillingOpen, setIsBillingOpen] = useState(false);
    const [uploadedDocs, setUploadedDocs] = useState([]);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);

    // Initial load: fetch conversations
    useEffect(() => {
        dispatch(fetchConversations());
    }, [dispatch]);

    // Fetch uploaded knowledge documents for the active conversation
    useEffect(() => {
        const currentConvId = activeConversationId || 'default';
        const userId = user?.userId || user?.firebaseUid || user?.uid || '';

        fetch(`${API_BASE}/agent/rag/documents?conversationId=${currentConvId}`, {
            headers: { 'x-user-id': userId }
        })
            .then(res => res.json())
            .then(data => {
                if (data.documents && Array.isArray(data.documents)) {
                    setUploadedDocs(data.documents);
                }
            })
            .catch(() => {});
    }, [activeConversationId, user?.userId]);

    // When active conversation changes, check if the latest message has an artifact to restore
    useEffect(() => {
        const lastMsgWithArtifact = [...messages].reverse().find(m => m.artifact && m.artifact.files?.length > 0);
        if (lastMsgWithArtifact) {
            setActiveArtifact(lastMsgWithArtifact.artifact);
        } else {
            setActiveArtifact(null);
        }
    }, [activeConversationId, messages.length]);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingStatus]);

    // Handle sending message with SSE streaming
    const handleSend = async (customPrompt = null) => {
        const text = (customPrompt || inputPrompt).trim();
        if (!text || isStreaming) return;

        setInputPrompt('');

        // 1. Resolve or create active conversation
        let currentConvId = activeConversationId;
        if (!currentConvId) {
            const newConvAction = await dispatch(createNewConversation(text.substring(0, 30) + '...'));
            if (createNewConversation.fulfilled.match(newConvAction)) {
                currentConvId = newConvAction.payload._id || newConvAction.payload.id;
            }
        }

        // 2. Add User message immediately to UI
        dispatch(addMessage({
            role: 'user',
            content: text,
            agent: selectedAgent,
            createdAt: new Date().toISOString()
        }));

        // 3. Initiate SSE Streaming
        dispatch(setIsStreaming(true));
        dispatch(setStreamingStatus('Thinking'));

        try {
            const response = await fetch(`${API_BASE}/agent/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user?.userId || user?.firebaseUid || user?.uid || ''
                },
                body: JSON.stringify({
                    prompt: text,
                    agent: selectedAgent,
                    conversationId: currentConvId,
                    userId: user?.userId || user?.firebaseUid || user?.uid || ''
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                if (response.status === 402) {
                    setIsBillingOpen(true);
                }
                throw new Error(errData.error || `HTTP ${response.status} Error`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep partial line in buffer

                let currentEventType = null;

                for (const line of lines) {
                    if (line.startsWith('event:')) {
                        currentEventType = line.replace('event:', '').trim();
                    } else if (line.startsWith('data:') && currentEventType) {
                        try {
                            const data = JSON.parse(line.replace('data:', '').trim());

                            if (currentEventType === 'status') {
                                // "Thinking" -> "Reasoning" -> "Generating"
                                dispatch(setStreamingStatus(data.status));
                            } else if (currentEventType === 'result') {
                                // Add Assistant message with markdown, images, url, artifact, and RAG sources
                                dispatch(addMessage({
                                    role: 'assistant',
                                    content: data.response,
                                    agent: data.agent,
                                    images: data.images || [],
                                    artifact: data.artifact || null,
                                    url: data.url || null,
                                    ragSources: data.ragSources || [],
                                    createdAt: new Date().toISOString()
                                }));

                                // Automatically open Artifact panel if an artifact was generated
                                if (data.artifact && data.artifact.files?.length > 0) {
                                    setActiveArtifact(data.artifact);
                                }

                                // Update credits in real-time if returned
                                if (data.remainingCredits !== undefined) {
                                    dispatch(updateUserCredits(data.remainingCredits));
                                }
                            } else if (currentEventType === 'error') {
                                if (data.error && data.error.toLowerCase().includes('credit')) {
                                    setIsBillingOpen(true);
                                }
                                dispatch(addToast({ message: data.error || 'Agent execution error', type: 'error' }));
                            }
                        } catch (parseErr) {
                            console.warn('Could not parse SSE event data:', parseErr);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Streaming request failed:', err);
            dispatch(addToast({ message: err.message || 'Failed to communicate with agent service.', type: 'error' }));
        } finally {
            dispatch(setIsStreaming(false));
            dispatch(setStreamingStatus(null));
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // RAG Document Upload Handler
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const currentConvId = activeConversationId || 'default';
        const userId = user?.userId || user?.firebaseUid || user?.uid || '';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('conversationId', currentConvId);
        formData.append('userId', userId);

        setIsUploadingDoc(true);
        try {
            const res = await fetch(`${API_BASE}/agent/rag/upload`, {
                method: 'POST',
                headers: {
                    'x-user-id': userId
                },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to upload document');

            setUploadedDocs(prev => {
                const exists = prev.some(d => d.docName === data.document.docName);
                if (exists) return prev.map(d => d.docName === data.document.docName ? data.document : d);
                return [...prev, data.document];
            });

            dispatch(addToast({
                message: `📄 Knowledge Indexed: "${data.document.docName}" (${data.document.totalChunks} chunks)`,
                type: 'success'
            }));
        } catch (err) {
            console.error('RAG upload error:', err);
            dispatch(addToast({ message: err.message || 'Document upload failed', type: 'error' }));
        } finally {
            setIsUploadingDoc(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // RAG Document Removal Handler
    const handleRemoveDoc = async (docName) => {
        const currentConvId = activeConversationId || 'default';
        const userId = user?.userId || user?.firebaseUid || user?.uid || '';

        try {
            await fetch(`${API_BASE}/agent/rag/documents/${encodeURIComponent(docName)}?conversationId=${currentConvId}`, {
                method: 'DELETE',
                headers: {
                    'x-user-id': userId
                }
            });
            setUploadedDocs(prev => prev.filter(d => d.docName !== docName));
            dispatch(addToast({ message: `Removed "${docName}" from knowledge base.`, type: 'info' }));
        } catch (err) {
            console.warn('Could not remove document:', err);
        }
    };

    // Helper to detect download link from content if not explicitly in msg.url
    const getDownloadInfo = (msg) => {
        let url = msg.url;
        if (!url && msg.content) {
            const match = msg.content.match(/\[(?:Download|View)[^\]]*\]\((https?:\/\/[^\s)]+|\/agent\/downloads\/[^\s)]+)\)/i);
            if (match) url = match[1];
        }

        if (!url) return null;

        const isPdf = url.includes('.pdf') || msg.agent === 'pdf';
        const isPpt = url.includes('.pptx') || msg.agent === 'ppt';
        const isImg = url.includes('.jpg') || url.includes('.png') || url.includes('.jpeg') || msg.agent === 'image';

        return {
            url,
            isPdf,
            isPpt,
            isImg,
            label: isPdf ? 'Download PDF Document' : isPpt ? 'Download PowerPoint (.pptx)' : isImg ? 'Download High-Res Image' : 'Download Generated File'
        };
    };

    return (
        <div className="flex h-screen w-full bg-[#0b0f19] text-slate-100 overflow-hidden font-sans">
            <ToastContainer />

            {/* Collapsible Sidebar */}
            <Sidebar onOpenBilling={() => setIsBillingOpen(true)} />

            {/* Main Chat Workspace */}
            <main className="flex-1 flex flex-col h-full min-w-0 relative">
                {/* Top Navigation Bar */}
                <header className="h-14 border-b border-indigo-950/40 flex items-center justify-between px-4 bg-slate-950/60 backdrop-blur-md shrink-0 z-20">
                    <div className="flex items-center gap-3">
                        {!sidebarOpen && (
                            <button
                                onClick={() => dispatch(toggleSidebar())}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-indigo-950/60 transition-colors"
                                title="Open sidebar"
                            >
                                <PanelLeft className="w-4 h-4" />
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white truncate max-w-[200px] sm:max-w-md">
                                {conversations.find(c => (c._id || c.id) === activeConversationId)?.title || 'New Session'}
                            </span>
                        </div>
                    </div>

                    {/* Agent Selector & Credits Top-Up Badge */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsBillingOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all cursor-pointer shadow-sm shadow-amber-500/10"
                            title="Click to view plans and buy credits"
                        >
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            <span>{user?.credits ?? 100} credits</span>
                        </button>
                        <AgentSelector />
                    </div>
                </header>

                {/* Message Scroll Area / Home Cards */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-indigo-950 scrollbar-track-transparent">
                    {messages.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <AgentCards onSelectPrompt={(prompt) => {
                                setInputPrompt(prompt);
                                inputRef.current?.focus();
                            }} />
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto space-y-6">
                            {messages.map((msg, index) => {
                                const isUser = msg.role === 'user';
                                const hasArtifact = !isUser && msg.artifact && msg.artifact.files?.length > 0;
                                const downloadInfo = !isUser ? getDownloadInfo(msg) : null;

                                return (
                                    <div
                                        key={index}
                                        className={`flex gap-3 sm:gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {!isUser && (
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/30">
                                                <Bot className="w-4 h-4 text-white" />
                                            </div>
                                        )}

                                        <div
                                            className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 shadow-lg ${
                                                isUser
                                                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium rounded-tr-sm'
                                                    : 'bg-slate-900/90 border border-indigo-950/60 rounded-tl-sm'
                                            }`}
                                        >
                                            {isUser ? (
                                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                                            ) : (
                                                <>
                                                    <MarkdownRenderer
                                                        content={msg.content}
                                                        images={msg.images || []}
                                                    />

                                                    {/* Interactive Download Buttons (PDF, PPT, Image) */}
                                                    {downloadInfo && (
                                                        <div className="mt-4 pt-3.5 border-t border-indigo-900/40 flex flex-wrap items-center justify-between gap-3 bg-indigo-950/40 -mx-2 -mb-1 p-3 rounded-xl">
                                                            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                                                                {downloadInfo.isPdf && <FileText className="w-4 h-4 text-rose-400 shrink-0" />}
                                                                {downloadInfo.isPpt && <Presentation className="w-4 h-4 text-orange-400 shrink-0" />}
                                                                {downloadInfo.isImg && <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />}
                                                                {!downloadInfo.isPdf && !downloadInfo.isPpt && !downloadInfo.isImg && (
                                                                    <Download className="w-4 h-4 text-indigo-400 shrink-0" />
                                                                )}
                                                                <span>{downloadInfo.label}</span>
                                                            </div>

                                                            <a
                                                                href={downloadInfo.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                download
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-md shadow-indigo-900/30 transition-all cursor-pointer no-underline"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                                <span>Download</span>
                                                            </a>
                                                        </div>
                                                    )}

                                                    {/* Interactive Artifact Button Card (Restores on Reload) */}
                                                    {hasArtifact && (
                                                        <div className="mt-4 pt-3.5 border-t border-indigo-900/40 flex flex-wrap items-center justify-between gap-3 bg-indigo-950/30 -mx-2 -mb-1 p-3 rounded-xl">
                                                            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                                                                <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                                                                <span>
                                                                    {msg.artifact.files.length} project file{msg.artifact.files.length === 1 ? '' : 's'} • {msg.artifact.language || 'Web App'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => setActiveArtifact(msg.artifact)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
                                                            >
                                                                <Play className="w-3.5 h-3.5" />
                                                                <span>Open Artifact Workspace</span>
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* RAG Knowledge Document Citation Pill */}
                                                    {msg.ragSources && msg.ragSources.length > 0 && (
                                                        <div className="mt-3.5 pt-2.5 border-t border-indigo-900/40 flex items-center gap-2 flex-wrap">
                                                            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                Cited Knowledge Base:
                                                            </span>
                                                            {[...new Set(msg.ragSources.map(s => s.docName))].map((doc, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-800/50 text-emerald-300 text-xs font-medium shadow-sm"
                                                                >
                                                                    <FileText className="w-3 h-3 text-emerald-400" />
                                                                    <span>{doc}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {isUser && (
                                            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-indigo-900/50 flex items-center justify-center shrink-0">
                                                <User className="w-4 h-4 text-indigo-300" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Real-time SSE Status Indicator: Thinking -> Reasoning -> Generating */}
                            {isStreaming && (
                                <div className="flex gap-4 items-start pl-12">
                                    <SSEStatusIndicator status={streamingStatus} />
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Bottom Prompt Input Area */}
                <div className="p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent shrink-0">
                    <div className="max-w-4xl mx-auto rounded-2xl bg-slate-900/90 border border-indigo-900/50 shadow-2xl backdrop-blur-xl transition-all focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 overflow-hidden">
                        {/* Active Knowledge Documents Bar */}
                        {uploadedDocs.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 px-3.5 py-2 bg-indigo-950/40 border-b border-indigo-900/40">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-indigo-400" />
                                    Active Knowledge:
                                </span>
                                {uploadedDocs.map((doc, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-900/40 border border-indigo-700/50 text-indigo-200 text-xs shadow-sm"
                                    >
                                        <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                        <span className="max-w-[140px] truncate font-medium">{doc.docName}</span>
                                        <span className="text-[10px] text-indigo-400 bg-indigo-950 px-1 rounded border border-indigo-800/40">
                                            {doc.totalChunks || 1} chunks
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveDoc(doc.docName)}
                                            className="p-0.5 hover:text-rose-400 rounded transition-colors cursor-pointer ml-0.5"
                                            title="Remove from knowledge base"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Hidden File Input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept=".pdf,.txt,.md,.csv"
                            className="hidden"
                            onChange={handleFileUpload}
                        />

                        {/* Prompt Input Textarea */}
                        <textarea
                            ref={inputRef}
                            value={inputPrompt}
                            onChange={(e) => setInputPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                uploadedDocs.length > 0
                                    ? `Ask about your ${uploadedDocs.length} knowledge document${uploadedDocs.length === 1 ? '' : 's'} or prompt ${selectedAgent.toUpperCase()} agent...`
                                    : `Ask anything with ${selectedAgent.toUpperCase()} agent... (Enter to send, Shift+Enter for new line)`
                            }
                            rows={2}
                            disabled={isStreaming}
                            className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none disabled:opacity-50"
                        />

                        {/* Input Action Controls (Document Upload & Send) */}
                        <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingDoc || isStreaming}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-indigo-300 border border-indigo-950 hover:border-indigo-800/60 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                                    title="Upload PDF or TXT to add to RAG Knowledge Base"
                                >
                                    {isUploadingDoc ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                            <span>Indexing Knowledge...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                                            <span>Upload PDF/TXT</span>
                                        </>
                                    )}
                                </button>
                                {uploadedDocs.length > 0 && (
                                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                                        RAG Context Attached ({uploadedDocs.length})
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={() => handleSend()}
                                disabled={!inputPrompt.trim() || isStreaming}
                                className="p-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/30 transition-all disabled:opacity-40 disabled:hover:from-indigo-600 disabled:hover:to-violet-600 cursor-pointer"
                                title="Send prompt"
                            >
                                {isStreaming ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    <p className="text-center text-[11px] text-slate-500 mt-2">
                        Cortex AI can make mistakes. Verify important information and live facts.
                    </p>
                </div>
            </main>

            {/* Side-by-Side Live Artifact Workspace Panel */}
            {activeArtifact && (
                <ArtifactPanel
                    artifact={activeArtifact}
                    onClose={() => setActiveArtifact(null)}
                />
            )}

            {/* Buy Credits / Billing Modal */}
            <BillingModal
                isOpen={isBillingOpen}
                onClose={() => setIsBillingOpen(false)}
                user={user}
            />
        </div>
    );
};

export default ChatDashboard;
