import React from 'react';
import { Brain, Cpu, Sparkles, Loader2 } from 'lucide-react';

export const SSEStatusIndicator = ({ status }) => {
    if (!status) return null;

    const stages = [
        { key: 'Thinking', label: 'Thinking', icon: Brain, color: 'text-indigo-400', bg: 'bg-indigo-950/70 border-indigo-500/40' },
        { key: 'Reasoning', label: 'Reasoning', icon: Cpu, color: 'text-violet-400', bg: 'bg-violet-950/70 border-violet-500/40' },
        { key: 'Generating', label: 'Generating', icon: Sparkles, color: 'text-fuchsia-400', bg: 'bg-fuchsia-950/70 border-fuchsia-500/40' }
    ];

    const currentStage = stages.find(s => s.key === status) || stages[0];
    const Icon = currentStage.icon;

    return (
        <div className="flex items-center gap-3 my-3 p-3 rounded-2xl bg-slate-900/80 border border-indigo-900/40 backdrop-blur-md shadow-lg max-w-fit animate-fade-in">
            {/* Pulsing state icon */}
            <div className={`p-2 rounded-xl border ${currentStage.bg} flex items-center justify-center relative`}>
                <Icon className={`w-5 h-5 ${currentStage.color} animate-pulse`} />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
            </div>

            {/* Stages progression */}
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-wide text-white">
                    {currentStage.label}
                </span>

                <div className="flex items-center gap-1.5 ml-2">
                    {stages.map((stage, idx) => {
                        const isCurrent = stage.key === status;
                        const isPast = stages.findIndex(s => s.key === status) > idx;

                        return (
                            <div key={stage.key} className="flex items-center">
                                <div
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                        isCurrent
                                            ? 'w-6 bg-indigo-500 shadow-md shadow-indigo-500/50'
                                            : isPast
                                            ? 'bg-emerald-400'
                                            : 'bg-slate-700'
                                    }`}
                                />
                                {idx < stages.length - 1 && (
                                    <div className="w-2.5 h-[1px] bg-slate-800" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin ml-2 shrink-0" />
        </div>
    );
};

export default SSEStatusIndicator;
