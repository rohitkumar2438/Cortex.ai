import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setSelectedAgent } from '../store/slices/chatSlice.js';
import {
    Sparkles,
    MessageSquare,
    Search,
    Code,
    FileText,
    Presentation,
    Image as ImageIcon,
    ChevronDown,
    Check
} from 'lucide-react';

export const AGENT_OPTIONS = [
    {
        id: 'auto',
        label: 'Auto Router',
        shortLabel: 'Auto',
        icon: Sparkles,
        color: 'text-violet-400',
        bg: 'bg-violet-500/10',
        desc: 'Classifies intent and routes automatically'
    },
    {
        id: 'chat',
        label: 'Chat & Logic',
        shortLabel: 'Chat',
        icon: MessageSquare,
        color: 'text-indigo-400',
        bg: 'bg-indigo-500/10',
        desc: 'Conversational reasoning and advice'
    },
    {
        id: 'search',
        label: 'Web Search',
        shortLabel: 'Search',
        icon: Search,
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        desc: 'Live web grounding with Tavily'
    },
    {
        id: 'coding',
        label: 'Coding & Artifacts',
        shortLabel: 'Coding',
        icon: Code,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        desc: 'Full-stack development with live sandboxed preview'
    },
    {
        id: 'pdf',
        label: 'PDF Report',
        shortLabel: 'PDF',
        icon: FileText,
        color: 'text-rose-400',
        bg: 'bg-rose-500/10',
        desc: 'Executive documents and PDF synthesis'
    },
    {
        id: 'ppt',
        label: 'Slide Deck',
        shortLabel: 'PPT',
        icon: Presentation,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        desc: 'PowerPoint presentation generator'
    },
    {
        id: 'image',
        label: 'Image Generator',
        shortLabel: 'Image',
        icon: ImageIcon,
        color: 'text-fuchsia-400',
        bg: 'bg-fuchsia-500/10',
        desc: 'Generative AI visual artwork'
    }
];

export const AgentSelector = () => {
    const dispatch = useDispatch();
    const selectedAgentId = useSelector((state) => state.chat.selectedAgent) || 'auto';
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const activeAgent = AGENT_OPTIONS.find(a => a.id === selectedAgentId) || AGENT_OPTIONS[0];
    const ActiveIcon = activeAgent.icon;

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (agentId) => {
        dispatch(setSelectedAgent(agentId));
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Sleek Model Selector Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] text-white text-xs font-medium transition-all cursor-pointer shadow-sm shadow-black/20"
                title="Select specialized agent model"
            >
                <div className={`p-1 rounded-md ${activeAgent.bg}`}>
                    <ActiveIcon className={`w-3.5 h-3.5 ${activeAgent.color}`} />
                </div>
                <span className="font-semibold tracking-tight">{activeAgent.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Luxury Glass Dropdown Popover */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#0c1019]/95 backdrop-blur-xl border border-white/[0.1] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase border-b border-white/[0.06]">
                        Specialized Intelligence Agents
                    </div>

                    <div className="py-1 space-y-0.5">
                        {AGENT_OPTIONS.map((agent) => {
                            const isSelected = selectedAgentId === agent.id;
                            const Icon = agent.icon;

                            return (
                                <button
                                    key={agent.id}
                                    type="button"
                                    onClick={() => handleSelect(agent.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer group ${
                                        isSelected
                                            ? 'bg-indigo-600/15 border border-indigo-500/30 text-white'
                                            : 'hover:bg-white/[0.05] text-slate-300 hover:text-white border border-transparent'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`p-1.5 rounded-lg ${agent.bg} shrink-0`}>
                                            <Icon className={`w-4 h-4 ${agent.color}`} />
                                        </div>
                                        <div className="truncate">
                                            <div className="text-xs font-semibold leading-tight">
                                                {agent.label}
                                            </div>
                                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                                {agent.desc}
                                            </div>
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <Check className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentSelector;
