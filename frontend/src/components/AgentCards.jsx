import React from 'react';
import { useDispatch } from 'react-redux';
import { setSelectedAgent } from '../store/slices/chatSlice.js';
import {
    Sparkles,
    Search,
    Code,
    FileText,
    Presentation,
    Image as ImageIcon,
    ArrowUpRight,
    Compass,
    Cpu,
    Zap
} from 'lucide-react';

export const AgentCards = ({ onSelectPrompt }) => {
    const dispatch = useDispatch();

    const capabilities = [
        {
            agent: 'coding',
            title: 'Full-Stack Web Artifact',
            desc: 'Generate, debug, and preview sandboxed React, HTML, CSS, and JS apps with live preview.',
            prompt: 'Build an interactive Pomodoro timer with sound effects, task list, and dark mode in HTML, CSS, and JS',
            icon: Code,
            tag: 'Coding Agent',
            badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        },
        {
            agent: 'search',
            title: 'Real-Time Web Intelligence',
            desc: 'Search the live web via Tavily with authoritative sources, latest news, and grounded citations.',
            prompt: 'What are the most significant advancements in AI, robotics, and quantum computing announced this week?',
            icon: Search,
            tag: 'Tavily Search',
            badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
        },
        {
            agent: 'pdf',
            title: 'Executive PDF Synthesis',
            desc: 'Draft executive memos, structured technical reports, and download clean vector PDFs instantly.',
            prompt: 'Draft an executive feasibility report on deploying autonomous AI multi-agent workflows in enterprise systems',
            icon: FileText,
            tag: 'PDFKit Engine',
            badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
        },
        {
            agent: 'ppt',
            title: 'PowerPoint Pitch Deck',
            desc: 'Structure clean 5-slide keynote presentations and download ready-to-present .pptx decks.',
            prompt: 'Create a 5-slide pitch deck for a next-generation AI security platform with market size and roadmap',
            icon: Presentation,
            tag: 'PptxGenJS',
            badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        }
    ];

    const quickChips = [
        { label: 'Analyze uploaded resume or PDF', prompt: 'What are the core technical skills and qualifications highlighted in my uploaded document?', agent: 'auto' },
        { label: 'Generate modern Kanban board', prompt: 'Build a responsive drag-and-drop Kanban board in HTML, CSS, and vanilla JS', agent: 'coding' },
        { label: 'DeepSeek vs Qwen benchmarks 2026', prompt: 'Provide a rigorous benchmark comparison of DeepSeek-V3 and Qwen 2.5 on coding and math tasks', agent: 'search' },
        { label: 'Cinematic cyberpunk illustration', prompt: 'A cinematic cyberpunk cityscape with neon rain reflections and hovering vehicles', agent: 'image' }
    ];

    const handleAction = (agentId, promptText) => {
        dispatch(setSelectedAgent(agentId));
        if (onSelectPrompt) {
            onSelectPrompt(promptText);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto px-4 py-8 flex flex-col items-center select-none animate-fade-in">
            {/* Minimalist Architectural Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-300 text-[11px] font-medium mb-5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                <span className="text-slate-400">Cortex Runtime</span>
                <span className="text-white/[0.2]">•</span>
                <span className="text-indigo-300 font-medium">Multi-Agent Intelligence</span>
            </div>

            {/* Inspiring Typographic Headline */}
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight text-center mb-2">
                What would you like to build or discover?
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 text-center max-w-md mb-8 leading-relaxed font-normal">
                Prompt naturally in Auto mode, or route directly to specialized agents for live search, coding, PDF synthesis, and presentation decks.
            </p>

            {/* Refined 2x2 Feature Grid (Linear / Claude Dark Style) */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {capabilities.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleAction(item.agent, item.prompt)}
                            className="group text-left p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-150 cursor-pointer shadow-sm relative overflow-hidden"
                        >
                            <div className="flex items-start justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-300 group-hover:text-white group-hover:border-white/[0.15] transition-colors">
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                                        {item.tag}
                                    </span>
                                </div>
                                <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors shrink-0" />
                            </div>

                            <h3 className="text-xs font-semibold text-white group-hover:text-indigo-200 transition-colors mb-1">
                                {item.title}
                            </h3>
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                {item.desc}
                            </p>
                        </button>
                    );
                })}
            </div>

            {/* Quick Action Chips */}
            <div className="w-full">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5 px-1 text-center sm:text-left">
                    Suggested Workflows
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                    {quickChips.map((chip, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => handleAction(chip.agent, chip.prompt)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] text-slate-300 hover:text-white text-[11px] font-normal transition-all cursor-pointer"
                        >
                            <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span>{chip.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AgentCards;
