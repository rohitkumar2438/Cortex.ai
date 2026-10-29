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
    X,
    Zap,
    Cpu,
    Mic,
    MicOff,
    Volume2,
    VolumeX
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
    const [isListening, setIsListening] = useState(false);
    const [speakingIndex, setSpeakingIndex] = useState(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const basePromptRef = useRef('');

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

    // Cleanup speech synthesis on unmount
    useEffect(() => {
        return () => {
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    // Speech-to-Text (STT) Toggle Handler
    const toggleVoiceInput = async () => {
        if (isListening) {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (e) {}
            }
            setIsListening(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            dispatch(addToast({
                message: 'Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.',
                type: 'error'
            }));
            return;
        }

        // 1. Explicitly request microphone access to trigger browser permission prompt
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // Stop the test stream immediately so SpeechRecognition can take over the mic hardware
                stream.getTracks().forEach(track => track.stop());
            }
        } catch (micErr) {
            console.warn('Microphone permission error:', micErr);
            dispatch(addToast({
                message: 'Microphone permission denied. Click the lock/tune icon in your URL address bar and choose "Allow" for microphone.',
                type: 'error'
            }));
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            basePromptRef.current = inputPrompt;

            recognition.onstart = () => {
                setIsListening(true);
                dispatch(addToast({
                    message: '🎙️ Listening... Speak your prompt now.',
                    type: 'info'
                }));
            };

            recognition.onresult = (event) => {
                let interim = '';
                let final = '';

                for (let i = 0; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final += event.results[i][0].transcript + ' ';
                    } else {
                        interim += event.results[i][0].transcript;
                    }
                }

                const spoken = (final + interim).trim();
                if (spoken) {
                    const base = basePromptRef.current.trim();
                    setInputPrompt(base ? `${base} ${spoken}` : spoken);
                }
            };

            recognition.onerror = (event) => {
                console.warn('Speech recognition event error:', event.error);
                if (event.error === 'not-allowed') {
                    dispatch(addToast({
                        message: 'Microphone access blocked. Click the lock icon in the URL bar and allow Microphone.',
                        type: 'error'
                    }));
                } else if (event.error === 'network') {
                    dispatch(addToast({
                        message: 'Speech recognition network error. Please check your internet connection.',
                        type: 'error'
                    }));
                } else if (event.error === 'audio-capture') {
                    dispatch(addToast({
                        message: 'No microphone found on this device. Please connect a microphone.',
                        type: 'error'
                    }));
                }
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
            recognition.start();
        } catch (err) {
            console.error('Failed to initiate SpeechRecognition:', err);
            dispatch(addToast({
                message: 'Could not start voice recognition: ' + (err.message || 'Unknown error'),
                type: 'error'
            }));
            setIsListening(false);
        }
    };

    // Text-to-Speech (TTS) Reader for Assistant Messages
    const handleSpeakMessage = (index, content) => {
        if (!('speechSynthesis' in window)) {
            dispatch(addToast({ message: 'Text-to-speech is not supported in this browser.', type: 'error' }));
            return;
        }

        if (speakingIndex === index) {
            window.speechSynthesis.cancel();
            setSpeakingIndex(null);
            return;
        }

        window.speechSynthesis.cancel();

        // Strip Markdown for clean, human-like voice synthesis
        const cleanText = content
            .replace(/```[\s\S]*?```/g, 'Code block omitted.')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/[*#_~>]/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/https?:\/\/\S+/g, 'link');

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';

        utterance.onend = () => {
            setSpeakingIndex(null);
        };

        utterance.onerror = () => {
            setSpeakingIndex(null);
        };

        setSpeakingIndex(index);
        window.speechSynthesis.speak(utterance);
    };

    // Handle sending message with SSE streaming
    const handleSend = async (customPrompt = null) => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        }

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
                                    cached: data.cached || false,
                                    latencyMs: data.latencyMs || null,
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

    // Export Chat History to Markdown File
    const handleExportChat = () => {
        if (!messages || messages.length === 0) {
            dispatch(addToast({ message: 'No messages to export.', type: 'info' }));
            return;
        }

        const activeTitle = conversations.find(c => (c._id || c.id) === activeConversationId)?.title || 'Cortex_Chat_Session';
        const formattedDate = new Date().toLocaleDateString();

        let mdContent = `# ${activeTitle}\n*Exported from Cortex AI on ${formattedDate}*\n\n---\n\n`;

        messages.forEach((msg) => {
            const roleName = msg.role === 'user' ? '👤 User' : `🤖 Assistant (${msg.agent ? msg.agent.toUpperCase() : 'CORTEX'})`;
            mdContent += `### ${roleName}\n\n${msg.content || ''}\n\n`;

            if (msg.ragSources && msg.ragSources.length > 0) {
                const uniqueDocs = [...new Set(msg.ragSources.map(s => s.docName))];
                mdContent += `*Cited Sources:* ${uniqueDocs.join(', ')}\n\n`;
            }
            mdContent += `---\n\n`;
        });

        const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${activeTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_export.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        dispatch(addToast({ message: 'Conversation exported as Markdown file.', type: 'success' }));
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
        <div className="flex h-screen w-full bg-[#080b11] text-slate-100 overflow-hidden font-sans">
            <ToastContainer />

            {/* Collapsible Sidebar */}
            <Sidebar onOpenBilling={() => setIsBillingOpen(true)} />

            {/* Main Chat Workspace */}
            <main className="flex-1 flex flex-col h-full min-w-0 relative bg-[#080b11]">
                {/* Top Navigation Bar */}
                <header className="h-14 border-b border-white/[0.06] flex items-center justify-between px-4 sm:px-6 bg-[#080b11]/80 backdrop-blur-xl shrink-0 z-20">
                    <div className="flex items-center gap-3">
                        {!sidebarOpen && (
                            <button
                                onClick={() => dispatch(toggleSidebar())}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.08] transition-colors"
                                title="Open sidebar"
                            >
                                <PanelLeft className="w-4 h-4" />
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Cortex AI</span>
                            <span className="text-slate-600 hidden sm:inline">/</span>
                            <span className="font-semibold text-sm text-slate-200 truncate max-w-[200px] sm:max-w-md">
                                {conversations.find(c => (c._id || c.id) === activeConversationId)?.title || 'New Session'}
                            </span>
                        </div>
                    </div>

                    {/* Top Action Controls (Export Chat, Credits Badge & Model Selector) */}
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={handleExportChat}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                                messages.length > 0
                                    ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-slate-200 hover:text-white shadow-sm'
                                    : 'bg-white/[0.02] border-white/[0.04] text-slate-600 hover:text-slate-400'
                            }`}
                            title={messages.length > 0 ? "Export conversation history to Markdown file (.md)" : "Start chatting to export conversation"}
                        >
                            <Download className={`w-3.5 h-3.5 ${messages.length > 0 ? 'text-indigo-400' : 'text-slate-600'}`} />
                            <span className="font-medium">Export</span>
                        </button>

                        <button
                            onClick={() => setIsBillingOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-semibold transition-all cursor-pointer shadow-sm shadow-amber-500/5"
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
                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20">
                                                <Bot className="w-4 h-4 text-white" />
                                            </div>
                                        )}

                                        <div
                                            className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 transition-all ${
                                                isUser
                                                    ? 'bg-[#181e2b] border border-white/[0.08] text-slate-100 rounded-tr-xs shadow-sm'
                                                    : 'bg-white/[0.02] border border-white/[0.06] rounded-tl-xs shadow-sm text-slate-200'
                                            }`}
                                        >
                                            {isUser ? (
                                                <p className="whitespace-pre-wrap text-sm leading-relaxed font-normal">{msg.content}</p>
                                            ) : (
                                                <>
                                                    <MarkdownRenderer
                                                        content={msg.content}
                                                        images={msg.images || []}
                                                    />

                                                    {/* Interactive Download Buttons (PDF, PPT, Image) */}
                                                    {downloadInfo && (
                                                        <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] -mx-2 -mb-1 p-2.5 rounded-xl border border-white/[0.04]">
                                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                                                                {downloadInfo.isPdf && <FileText className="w-4 h-4 text-rose-400 shrink-0" />}
                                                                {downloadInfo.isPpt && <Presentation className="w-4 h-4 text-amber-400 shrink-0" />}
                                                                {downloadInfo.isImg && <ImageIcon className="w-4 h-4 text-fuchsia-400 shrink-0" />}
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
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-white font-medium text-xs shadow-sm transition-all cursor-pointer no-underline"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                                <span>Download</span>
                                                            </a>
                                                        </div>
                                                    )}

                                                    {/* Interactive Artifact Button Card (Restores on Reload) */}
                                                    {hasArtifact && (
                                                        <div className="mt-4 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 bg-white/[0.02] -mx-2 -mb-1 p-2.5 rounded-xl border border-white/[0.04]">
                                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                                                                <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                                                                <span>
                                                                    {msg.artifact.files.length} project file{msg.artifact.files.length === 1 ? '' : 's'} • {msg.artifact.language || 'Web App'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => setActiveArtifact(msg.artifact)}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-medium text-xs shadow-sm transition-all cursor-pointer"
                                                            >
                                                                <Play className="w-3.5 h-3.5 text-emerald-400" />
                                                                <span>Open Artifact Workspace</span>
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* RAG Knowledge Document Citation Pill */}
                                                    {msg.ragSources && msg.ragSources.length > 0 && (
                                                        <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">
                                                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                                Cited Knowledge:
                                                            </span>
                                                            {[...new Set(msg.ragSources.map(s => s.docName))].map((doc, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-slate-300 text-[11px] font-normal"
                                                                >
                                                                    <FileText className="w-3 h-3 text-emerald-400" />
                                                                    <span>{doc}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Redis Cache & Latency Telemetry Badge */}
                                                    <div className="mt-2.5 pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-slate-500">
                                                        <div className="flex items-center gap-1.5">
                                                            {msg.cached ? (
                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium">
                                                                    <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                                                                    <span>Cached from Redis ({msg.latencyMs || 15}ms)</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-slate-500">
                                                                    <Cpu className="w-3 h-3 text-slate-500" />
                                                                    <span>Live Inference ({msg.latencyMs ? `${(msg.latencyMs / 1000).toFixed(1)}s` : '1.1s'})</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSpeakMessage(index, msg.content)}
                                                                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                                                    speakingIndex === index
                                                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                                                                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                                                                }`}
                                                                title={speakingIndex === index ? "Stop voice playback" : "Listen to response (TTS)"}
                                                            >
                                                                {speakingIndex === index ? (
                                                                    <>
                                                                        <VolumeX className="w-3 h-3 text-rose-400" />
                                                                        <span>Stop Voice</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Volume2 className="w-3 h-3 text-slate-400" />
                                                                        <span>Read Aloud</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                            <span className="text-[10px] text-slate-500 font-mono">
                                                                {msg.cached ? '0 tokens charged • 100% saved' : 'Token Telemetry Active'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {isUser && (
                                            <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                                                <User className="w-3.5 h-3.5 text-slate-300" />
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
                <div className="p-4 bg-gradient-to-t from-[#080b11] via-[#080b11]/90 to-transparent shrink-0">
                    <div className="max-w-3xl mx-auto rounded-2xl bg-[#0d111a]/95 border border-white/[0.1] shadow-2xl backdrop-blur-xl transition-all focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 overflow-hidden">
                        {/* Active Knowledge Documents Bar */}
                        {uploadedDocs.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 px-3.5 py-2 bg-white/[0.02] border-b border-white/[0.06]">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-indigo-400" />
                                    Attached Context:
                                </span>
                                {uploadedDocs.map((doc, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-slate-200 text-xs shadow-sm"
                                    >
                                        <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
                                        <span className="max-w-[140px] truncate font-normal">{doc.docName}</span>
                                        <span className="text-[10px] text-slate-400 bg-white/[0.04] px-1 rounded border border-white/[0.04]">
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
                            className="w-full bg-transparent px-4 py-3 text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none disabled:opacity-50"
                        />

                        {/* Input Action Controls (Document Upload & Send) */}
                        <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploadingDoc || isStreaming}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06] text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                                    title="Upload PDF or TXT to add to RAG Knowledge Base"
                                >
                                    {isUploadingDoc ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                            <span>Indexing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Attach PDF/TXT</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={toggleVoiceInput}
                                    disabled={isStreaming}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                                        isListening
                                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 animate-pulse shadow-sm shadow-rose-500/20'
                                            : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border-white/[0.06]'
                                    }`}
                                    title={isListening ? "Listening... Click to stop speaking" : "Speak your prompt (Speech-to-Text)"}
                                >
                                    {isListening ? (
                                        <>
                                            <MicOff className="w-3.5 h-3.5 text-rose-400" />
                                            <span className="font-semibold text-rose-300">Listening...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Mic className="w-3.5 h-3.5 text-slate-400" />
                                            <span>Voice Input</span>
                                        </>
                                    )}
                                </button>
                                {uploadedDocs.length > 0 && (
                                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                                        RAG Attached ({uploadedDocs.length})
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={() => handleSend()}
                                disabled={!inputPrompt.trim() || isStreaming}
                                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all disabled:opacity-30 disabled:hover:bg-indigo-600 cursor-pointer"
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

                    <p className="text-center text-[10px] text-slate-500 mt-2">
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
