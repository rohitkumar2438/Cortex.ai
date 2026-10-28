import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedAgent } from '../store/slices/chatSlice.js';
import {
    Sparkles,
    MessageSquare,
    Search,
    Code,
    FileText,
    Presentation,
    Image as ImageIcon
} from 'lucide-react';

export const AGENT_OPTIONS = [
    { id: 'auto', label: 'Auto (Router)', icon: Sparkles, color: 'text-amber-400', desc: 'Auto-classifies intent' },
    { id: 'chat', label: 'Chat', icon: MessageSquare, color: 'text-indigo-400', desc: 'Conversational reasoning' },
    { id: 'search', label: 'Search', icon: Search, color: 'text-cyan-400', desc: 'Live web search & news' },
    { id: 'coding', label: 'Coding', icon: Code, color: 'text-emerald-400', desc: 'Full-stack development' },
    { id: 'pdf', label: 'PDF', icon: FileText, color: 'text-rose-400', desc: 'Document generation' },
    { id: 'ppt', label: 'PPT', icon: Presentation, color: 'text-orange-400', desc: 'Slide presentations' },
    { id: 'image', label: 'Image', icon: ImageIcon, color: 'text-purple-400', desc: 'Visual generation' }
];

export const AgentSelector = () => {
    const dispatch = useDispatch();
    const selectedAgent = useSelector((state) => state.chat.selectedAgent) || 'auto';

    return (
        <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-2xl bg-slate-900/90 border border-indigo-900/40 backdrop-blur-md shadow-inner scrollbar-none">
            {AGENT_OPTIONS.map((agent) => {
                const isSelected = selectedAgent === agent.id;
                const Icon = agent.icon;

                return (
                    <button
                        key={agent.id}
                        onClick={() => dispatch(setSelectedAgent(agent.id))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                            isSelected
                                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                        title={agent.desc}
                    >
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : agent.color}`} />
                        <span>{agent.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default AgentSelector;
