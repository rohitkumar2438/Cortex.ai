import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Sidebar from '../components/Sidebar.jsx';
import AgentSelector from '../components/AgentSelector.jsx';
import AgentCards from '../components/AgentCards.jsx';
import MarkdownRenderer from '../components/MarkdownRenderer.jsx';
import SSEStatusIndicator from '../components/SSEStatusIndicator.jsx';
import ArtifactPanel from '../components/ArtifactPanel.jsx';
import ToastContainer from '../components/ToastContainer.jsx';
import {
    fetchConversations,
    createNewConversation,
    addMessage,
    setStreamingStatus,
    setIsStreaming
} from '../store/slices/chatSlice.js';
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
    Code2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const ChatDashboard = () => {
    const dispatch = useDispatch();
    const { conversations, activeConversationId, messages, selectedAgent, streamingStatus, isStreaming } = useSelector((state) => state.chat);
    const { user } = useSelector((state) => state.auth);
    const sidebarOpen = useSelector((state) => state.ui.sidebarOpen);

    const [inputPrompt, setInputPrompt] = useState('');
    const [activeArtifact, setActiveArtifact] = useState(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Initial load: fetch conversations
    useEffect(() => {
        dispatch(fetchConversations());
    }, [dispatch]);

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
                                // Add Assistant message with markdown, images, and artifact
                                dispatch(addMessage({
                                    role: 'assistant',
                                    content: data.response,
                                    agent: data.agent,
                                    images: data.images || [],
                                    artifact: data.artifact || null,
                                    createdAt: new Date().toISOString()
                                }));

                                // Automatically open Artifact panel if an artifact was generated
                                if (data.artifact && data.artifact.files?.length > 0) {
                                    setActiveArtifact(data.artifact);
                                }
                            } else if (currentEventType === 'error') {
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

    return (
        <div className="flex h-screen w-full bg-[#0b0f19] text-slate-100 overflow-hidden font-sans">
            <ToastContainer />

            {/* Collapsible Sidebar */}
            <Sidebar />

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

                    {/* Agent Selector (Auto / Chat / Search / Coding / PDF / PPT / Image) */}
                    <div className="flex items-center gap-2">
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
                    <div className="max-w-4xl mx-auto relative rounded-2xl bg-slate-900/90 border border-indigo-900/50 shadow-2xl backdrop-blur-xl transition-all focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20">
                        <textarea
                            ref={inputRef}
                            value={inputPrompt}
                            onChange={(e) => setInputPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={`Ask anything with ${selectedAgent.toUpperCase()} agent... (Enter to send, Shift+Enter for new line)`}
                            rows={2}
                            disabled={isStreaming}
                            className="w-full bg-transparent px-4 py-3.5 pr-14 text-sm text-white placeholder-slate-500 resize-none focus:outline-none disabled:opacity-50"
                        />

                        {/* Send Action Button */}
                        <button
                            onClick={() => handleSend()}
                            disabled={!inputPrompt.trim() || isStreaming}
                            className="absolute right-3 bottom-3 p-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/30 transition-all disabled:opacity-40 disabled:hover:from-indigo-600 disabled:hover:to-violet-600 cursor-pointer"
                            title="Send prompt"
                        >
                            {isStreaming ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>
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
        </div>
    );
};

export default ChatDashboard;
