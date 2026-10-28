import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Menu, LogOut, Send, Bot, User as UserIcon, Loader2, Coins, CreditCard, FileText, Code2, Search, Image as ImageIcon, Mic, Paperclip, Sparkles, Trash2, BookOpen, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BillingModal from '../components/BillingModal';
import ArtifactWorkspace from '../components/ArtifactWorkspace';

// Configure axios default
axios.defaults.withCredentials = true;

const AGENTS = [
  { id: 'chat', name: 'Chat Agent', icon: Bot, cost: 1 },
  { id: 'search', name: 'Search Agent', icon: Search, cost: 2 },
  { id: 'code', name: 'Coding Agent', icon: Code2, cost: 3 },
  { id: 'image', name: 'Image Agent', icon: ImageIcon, cost: 5 },
  { id: 'pdf', name: 'PDF RAG Agent', icon: FileText, cost: 3 },
  { id: 'ppt', name: 'PPT Agent', icon: FileText, cost: 5 }
];

export default function ChatDashboard({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBillingOpen, setIsBillingOpen] = useState(false);
  const [userCredits, setUserCredits] = useState(user.credits || 100);
  const [userPlan, setUserPlan] = useState(user.plan || 'Free');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [activeAgent, setActiveAgent] = useState('chat');
  
  // Knowledge Base RAG state
  const [documents, setDocuments] = useState([]);
  const [showDocManager, setShowDocManager] = useState(false);
  const [expandedSources, setExpandedSources] = useState({});
  
  // Artifact Workspace state: { type, content, url, artifacts }
  const [activeArtifact, setActiveArtifact] = useState(null);
  const [isListening, setIsListening] = useState(false);

  const fileInputRef = useRef(null);
  const { chatId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  // Speech Recognition Setup
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;
  
  if (recognition) {
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? prev + ' ' + transcript : transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
  }

  const toggleMic = () => {
    if (!recognition) return alert("Speech recognition is not supported in this browser.");
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await axios.get(`http://localhost:8000/chat?userId=${user.uid}`);
        setChats(res.data);
      } catch (error) {
        console.error("Failed to load chats", error);
      }
    };

    const fetchDocuments = async () => {
      try {
        const res = await axios.get(`http://localhost:8000/agent/documents?userId=${user.uid}`);
        setDocuments(res.data.documents || []);
      } catch (error) {
        console.error("Failed to load knowledge base documents", error);
      }
    };

    if (user.uid) {
      fetchChats();
      fetchDocuments();
    }
  }, [user.uid]);

  useEffect(() => {
    if (chatId) {
      const fetchMessages = async () => {
        try {
          const res = await axios.get(`http://localhost:8000/chat/${chatId}`);
          setMessages(res.data.messages || []);
          
          // Check if latest message contains an artifact
          const msgs = res.data.messages || [];
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && (lastMsg.artifacts || ['code', 'pdf', 'ppt', 'image'].includes(lastMsg.type))) {
            setActiveArtifact({
              type: lastMsg.type,
              content: lastMsg.content,
              url: lastMsg.url,
              artifacts: lastMsg.artifacts
            });
          }
        } catch (error) {
          console.error("Failed to load messages", error);
        }
      };
      fetchMessages();
    } else {
      setMessages([]);
      setActiveArtifact(null);
    }
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogout = async () => {
    try {
      await axios.post('http://localhost:8000/auth/logout');
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('cortex_user');
    window.location.href = '/login';
  };

  const handleDeleteChat = async (e, idToDelete) => {
    e.stopPropagation();
    try {
      await axios.delete(`http://localhost:8000/chat/${idToDelete}`);
      setChats(prev => prev.filter(c => c._id !== idToDelete));
      if (chatId === idToDelete) {
        navigate('/');
      }
    } catch (err) {
      console.error('Delete chat error:', err);
    }
  };

  const handleDeleteDocument = async (e, docId) => {
    e.stopPropagation();
    try {
      await axios.delete(`http://localhost:8000/agent/documents/${docId}?userId=${user.uid}`);
      setDocuments(prev => prev.filter(d => d.docId !== docId));
    } catch (err) {
      console.error("Failed to delete document", err);
      alert("Failed to delete document from knowledge base.");
    }
  };

  const toggleSourceExpand = (idx) => {
    setExpandedSources(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    try {
      if (!chatId) {
        const res = await axios.post('http://localhost:8000/chat', {
          userId: user.uid,
          initialMessage: userMessage,
          agentType: activeAgent
        });
        setChats([res.data, ...chats]);
        navigate(`/chat/${res.data._id}`);
      } else {
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        const res = await axios.post(`http://localhost:8000/chat/${chatId}/message`, {
          message: userMessage,
          agentType: activeAgent
        });
        const newMessages = res.data.messages;
        setMessages(newMessages);
        
        // Auto-open artifact workspace if assistant message has an artifact
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg && (lastMsg.artifacts || ['code', 'pdf', 'ppt', 'image'].includes(lastMsg.type))) {
          setActiveArtifact({
            type: lastMsg.type,
            content: lastMsg.content,
            url: lastMsg.url,
            artifacts: lastMsg.artifacts
          });
        }
      }
    } catch (error) {
      console.error("Failed to send message", error);
      alert("Error sending message to Cortex AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('document', file);
    formData.append('userId', user.uid);

    try {
      const res = await axios.post('http://localhost:8000/agent/upload', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'x-user-id': user.uid
        }
      });
      const docsRes = await axios.get(`http://localhost:8000/agent/documents?userId=${user.uid}`);
      setDocuments(docsRes.data.documents || []);
      setActiveAgent('pdf');
      alert(`✅ ${res.data.message || "File uploaded and processed for RAG successfully!"}`);
    } catch (error) {
      console.error("Upload failed", error);
      alert(error.response?.data?.error || "Failed to process uploaded file.");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreditsUpdated = (newCredits, newPlan) => {
    setUserCredits(newCredits);
    if (newPlan) setUserPlan(newPlan);
  };

  const SelectedAgentIcon = AGENTS.find(a => a.id === activeAgent)?.icon || Bot;

  return (
    <div className="flex h-screen w-full bg-white text-gray-800 antialiased overflow-hidden font-sans">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-slate-900 text-slate-200 border-r border-slate-800 transition-all duration-300 flex flex-col`}>
        {/* New Chat Button */}
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center justify-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-2.5 rounded-xl shadow-md w-full transition-all"
          >
            <Plus className="h-4 w-4" /> New Conversation
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Recent Chats
          </div>
          {chats.map(chat => (
            <div
              key={chat._id}
              onClick={() => navigate(`/chat/${chat._id}`)}
              className={`group w-full text-left px-3 py-2 rounded-xl text-xs truncate transition-all flex items-center justify-between cursor-pointer ${chatId === chat._id ? 'bg-slate-800 text-white font-medium shadow-sm' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
            >
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                <span className="truncate">{chat.title}</span>
              </div>
              <button
                onClick={(e) => handleDeleteChat(e, chat._id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                title="Delete Chat"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* User Card & Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3 mb-3">
            <img 
              src={user.picture || 'https://via.placeholder.com/40'} 
              alt="User" 
              className="w-10 h-10 rounded-xl border border-slate-700 object-cover"
            />
            <div className="overflow-hidden flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-white truncate">{user.name}</p>
                <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-md">
                  {userPlan}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
                <Coins className="h-3 w-3 text-amber-400" /> {userCredits} credits
              </p>
            </div>
          </div>
          
          {/* Knowledge Base Documents Drawer */}
          <div className="mb-2">
            <button 
              type="button"
              onClick={() => setShowDocManager(!showDocManager)}
              className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 px-3 py-2 rounded-xl transition-colors border border-slate-700/80"
            >
              <span className="flex items-center gap-1.5 truncate">
                <FolderOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                Knowledge Base ({documents.length})
              </span>
              <ChevronDown className={`h-3 w-3 text-slate-400 transform transition-transform ${showDocManager ? 'rotate-180' : ''}`} />
            </button>

            {showDocManager && (
              <div className="mt-1.5 bg-slate-900 border border-slate-800 rounded-xl p-2 max-h-40 overflow-y-auto space-y-1.5">
                {documents.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-2">No documents indexed yet.</p>
                ) : (
                  documents.map(doc => (
                    <div key={doc.docId} className="flex items-center justify-between bg-slate-950/70 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs">
                      <div className="truncate flex-1 mr-2">
                        <p className="text-white font-medium truncate text-xs">{doc.fileName}</p>
                        <p className="text-[10px] text-indigo-300">{doc.chunkCount} chunks ready</p>
                      </div>
                      <button 
                        onClick={(e) => handleDeleteDocument(e, doc.docId)}
                        className="text-slate-400 hover:text-red-400 p-1 transition-colors"
                        title="Delete from Knowledge Base"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <input 
            type="file" 
            accept="application/pdf,text/plain,text/markdown,.md,.txt,.pdf" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={uploadingDoc} 
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors py-2 mb-2 rounded-xl border border-slate-700 disabled:opacity-50"
          >
            {uploadingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 text-indigo-400" />}
            {uploadingDoc ? "Processing..." : "Upload Document (RAG)"}
          </button>
          
          <button 
            onClick={() => setIsBillingOpen(true)} 
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all py-2 mb-2 rounded-xl shadow-sm"
          >
            <CreditCard className="h-3.5 w-3.5" /> Buy Credits / Upgrade
          </button>

          <button 
            onClick={handleLogout} 
            className="w-full flex items-center justify-center gap-2 text-xs font-medium text-slate-400 hover:text-red-400 transition-colors py-1.5"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area (Chat + Workspace) */}
      <div className="flex-1 flex flex-row h-full overflow-hidden bg-white">
        {/* Chat Pane */}
        <div className="flex-1 flex flex-col h-full bg-white relative min-w-[320px]">
          {/* Header */}
          <header className="h-14 border-b border-gray-100 flex items-center justify-between px-4 shrink-0 bg-white/80 backdrop-blur-sm">
            <div className="flex items-center">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)} 
                className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors mr-3"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
                  <SelectedAgentIcon className="h-4 w-4" />
                </div>
                <div>
                  <h1 className="font-bold text-gray-900 text-sm leading-none">Cortex AI</h1>
                  <span className="text-[10px] text-gray-400 font-medium">Multi-Agent LangGraph Platform</span>
                </div>
              </div>
            </div>
            
            {/* Agent Selector Bar */}
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
              {AGENTS.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setActiveAgent(agent.id)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all ${activeAgent === agent.id ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-800'}`}
                  title={`${agent.name} (${agent.cost} credits)`}
                >
                  <agent.icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{agent.name}</span>
                </button>
              ))}
            </div>
          </header>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
            {!chatId && messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 text-indigo-600 shadow-inner">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome to Cortex AI</h2>
                <p className="text-xs text-gray-500 mb-6">
                  Select any specialized agent above to start coding, searching the live web, analyzing documents, or generating presentations and images.
                </p>
                <div className="grid grid-cols-2 gap-2 w-full text-left">
                  <button onClick={() => { setActiveAgent('code'); setInput('Build a modern landing page for a SaaS platform'); }} className="p-3 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-xs transition-all">
                    <span className="font-bold text-gray-800 block">⚡ Coding Agent</span>
                    <span className="text-gray-500 text-[11px]">Generate interactive web project</span>
                  </button>
                  <button onClick={() => { setActiveAgent('search'); setInput('Latest tech advancements in artificial intelligence this week'); }} className="p-3 rounded-xl border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-xs transition-all">
                    <span className="font-bold text-gray-800 block">🌐 Search Agent</span>
                    <span className="text-gray-500 text-[11px]">Live web search with citations</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role !== 'user' && (
                      <div className="h-7 w-7 shrink-0 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 mt-1">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div className={`px-4 py-3 rounded-2xl max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none shadow-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'}`}>
                      <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                        {msg.role === 'user' ? (
                          <p className="whitespace-pre-wrap leading-relaxed m-0 text-xs">{msg.content}</p>
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        )}
                      </div>
                      
                      {/* Grounded RAG Sources & Citations */}
                      {msg.role !== 'user' && msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100">
                          <button 
                            type="button"
                            onClick={() => toggleSourceExpand(idx)}
                            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50/80 hover:bg-indigo-100/80 px-2.5 py-1 rounded-lg"
                          >
                            <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                            <span>{msg.sources.length} Grounded Source{msg.sources.length > 1 ? 's' : ''} Cited</span>
                            <ChevronDown className={`h-3 w-3 transform transition-transform ${expandedSources[idx] ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {expandedSources[idx] && (
                            <div className="mt-2 space-y-1.5 animate-fadeIn">
                              {msg.sources.map((src, sIdx) => (
                                <div key={sIdx} className="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 text-xs text-slate-700">
                                  <div className="flex items-center justify-between font-bold text-slate-800 mb-1">
                                    <span className="flex items-center gap-1.5 truncate text-slate-900">
                                      <FileText className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                                      {src.fileName}
                                    </span>
                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-md font-mono shrink-0">
                                      Page {src.page}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-600 italic leading-relaxed m-0 bg-white/70 p-1.5 rounded-lg border border-slate-100">
                                    "{src.excerpt}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {msg.role !== 'user' && (msg.artifacts || (msg.type && ['code', 'pdf', 'ppt', 'image'].includes(msg.type))) && (
                        <button 
                          onClick={() => setActiveArtifact({ 
                            type: msg.type, 
                            content: msg.content, 
                            url: msg.url,
                            artifacts: msg.artifacts 
                          })}
                          className="mt-3 text-xs flex items-center gap-1.5 font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200/50"
                        >
                          <Code2 className="h-3.5 w-3.5" /> Open Artifact Workspace
                        </button>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="h-7 w-7 shrink-0 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 mt-1">
                        <UserIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-3 justify-start items-center">
                    <div className="h-7 w-7 shrink-0 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-medium">Cortex AI is reasoning...</span>
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 shrink-0 bg-white border-t border-gray-100">
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSendMessage} className="relative rounded-2xl border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all flex items-center shadow-sm">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="ml-2 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Upload Document for RAG or Vision Analysis"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                <button 
                  type="button"
                  onClick={toggleMic}
                  className={`p-2 rounded-xl transition-colors ${isListening ? 'text-red-500 bg-red-50 animate-pulse' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                  title="Speech-to-Text Voice Input"
                >
                  <Mic className="h-4 w-4" />
                </button>

                <input 
                  type="text" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={`Ask ${AGENTS.find(a => a.id === activeAgent)?.name}...`}
                  className="flex-1 bg-transparent py-3.5 px-3 outline-none text-xs text-gray-800 placeholder-gray-400"
                  disabled={loading}
                />

                <button 
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="mr-2 h-9 w-9 shrink-0 flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-all shadow-sm"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Artifact Workspace Pane (Split Screen) */}
        {activeArtifact && (
          <div className="w-[52%] hidden lg:block shrink-0 h-full border-l border-slate-800">
            <ArtifactWorkspace 
              content={activeArtifact.content} 
              type={activeArtifact.type} 
              url={activeArtifact.url} 
              artifacts={activeArtifact.artifacts}
              onClose={() => setActiveArtifact(null)} 
            />
          </div>
        )}
      </div>
      
      {/* Mobile Modal for Artifacts */}
      {activeArtifact && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white flex flex-col">
          <ArtifactWorkspace 
            content={activeArtifact.content} 
            type={activeArtifact.type} 
            url={activeArtifact.url} 
            artifacts={activeArtifact.artifacts}
            onClose={() => setActiveArtifact(null)} 
          />
        </div>
      )}
      
      <BillingModal 
        isOpen={isBillingOpen} 
        onClose={() => setIsBillingOpen(false)} 
        user={user} 
        onCreditsUpdated={handleCreditsUpdated} 
      />
    </div>
  );
}
