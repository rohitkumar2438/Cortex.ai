import React from 'react';
import { useDispatch } from 'react-redux';
import { setSelectedAgent } from '../store/slices/chatSlice.js';
import {
    MessageSquare,
    Search,
    Code,
    FileText,
    Presentation,
    Image as ImageIcon,
    ArrowUpRight
} from 'lucide-react';

export const AgentCards = ({ onSelectPrompt }) => {
    const dispatch = useDispatch();

    const cards = [
        {
            id: 'chat',
            title: 'Chat & Reasoning',
            desc: 'Engage in deep dialogue, philosophical inquiry, or complex logical reasoning.',
            sample: 'Explain quantum computing in simple terms with an analogy',
            icon: MessageSquare,
            gradient: 'from-indigo-600/20 to-blue-600/20',
            border: 'border-indigo-500/30 hover:border-indigo-500',
            textColor: 'text-indigo-400'
        },
        {
            id: 'search',
            title: 'Real-Time Web Search',
            desc: 'Find latest news, live fact-checking, and grounded web sources with images.',
            sample: 'What are the top AI and tech breakthroughs announced this week?',
            icon: Search,
            gradient: 'from-cyan-600/20 to-teal-600/20',
            border: 'border-cyan-500/30 hover:border-cyan-500',
            textColor: 'text-cyan-400'
        },
        {
            id: 'coding',
            title: 'Full-Stack Developer',
            desc: 'Generate, debug, refactor, and preview clean modern React, Node.js, and CSS code.',
            sample: 'Create a responsive kanban board component in React with Tailwind',
            icon: Code,
            gradient: 'from-emerald-600/20 to-green-600/20',
            border: 'border-emerald-500/30 hover:border-emerald-500',
            textColor: 'text-emerald-400'
        },
        {
            id: 'pdf',
            title: 'PDF Document Agent',
            desc: 'Draft comprehensive research reports, executive memos, and downloadable PDFs.',
            sample: 'Draft a comprehensive project proposal on renewable energy adoption',
            icon: FileText,
            gradient: 'from-rose-600/20 to-pink-600/20',
            border: 'border-rose-500/30 hover:border-rose-500',
            textColor: 'text-rose-400'
        },
        {
            id: 'ppt',
            title: 'Slide Presentations',
            desc: 'Structure pitch decks, keynote presentations, and exportable slide templates.',
            sample: 'Create a 5-slide pitch deck for an autonomous drone delivery startup',
            icon: Presentation,
            gradient: 'from-orange-600/20 to-amber-600/20',
            border: 'border-orange-500/30 hover:border-orange-500',
            textColor: 'text-orange-400'
        },
        {
            id: 'image',
            title: 'Visual Art Generation',
            desc: 'Transform descriptive textual prompts into creative illustrations and artwork.',
            sample: 'A cinematic cyberpunk cityscape with neon reflections in rainy puddles',
            icon: ImageIcon,
            gradient: 'from-purple-600/20 to-violet-600/20',
            border: 'border-purple-500/30 hover:border-purple-500',
            textColor: 'text-purple-400'
        }
    ];

    const handleClick = (agentId, samplePrompt) => {
        dispatch(setSelectedAgent(agentId));
        if (onSelectPrompt) {
            onSelectPrompt(samplePrompt);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto px-4 py-8">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-violet-200 to-fuchsia-300 tracking-tight sm:text-4xl">
                    What would you like to build today?
                </h2>
                <p className="mt-2.5 text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
                    Select a specialized agent below, or simply ask a question and let Cortex Router classify your intent.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card) => {
                    const Icon = card.icon;

                    return (
                        <div
                            key={card.id}
                            onClick={() => handleClick(card.id, card.sample)}
                            className={`group relative p-5 rounded-2xl bg-gradient-to-br ${card.gradient} bg-slate-900/60 border ${card.border} backdrop-blur-sm cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1`}
                        >
                            <div className="flex items-start justify-between">
                                <div className={`p-2.5 rounded-xl bg-slate-950/80 border border-white/5 ${card.textColor}`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                            </div>

                            <h3 className="mt-4 font-bold text-white text-base group-hover:text-indigo-300 transition-colors">
                                {card.title}
                            </h3>
                            <p className="mt-1 text-xs text-slate-400 leading-relaxed line-clamp-2">
                                {card.desc}
                            </p>

                            <div className="mt-3.5 pt-3 border-t border-white/5 text-[11px] text-slate-500 italic truncate group-hover:text-slate-300 transition-colors">
                                "{card.sample}"
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AgentCards;
