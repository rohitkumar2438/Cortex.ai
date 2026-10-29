import React from 'react';
import { Brain, Cpu, Sparkles, Loader2 } from 'lucide-react';

export const SSEStatusIndicator = ({ status }) => {
    if (!status) return null;

    const stages = [
        { key: 'Thinking', label: 'Thinking', icon: Brain, color: 'text-indigo-400' },
        { key: 'Reasoning', label: 'Reasoning', icon: Cpu, color: 'text-violet-400' },
        { key: 'Generating', label: 'Generating', icon: Sparkles, color: 'text-fuchsia-400' }
    ];

    const currentStage = stages.find(s => s.key === status) || stages[0];

    return (
        <div className="flex items-center gap-2.5 my-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-sm max-w-fit animate-fade-in text-xs text-slate-300">
            <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
            <span className="font-medium text-slate-200">{currentStage.label}...</span>
            <div className="flex items-center gap-1 ml-1.5">
                {stages.map((stage) => {
                    const isCurrent = stage.key === status;
                    return (
                        <div
                            key={stage.key}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                isCurrent ? 'bg-indigo-400 w-3.5' : 'bg-white/[0.15] w-1.5'
                            }`}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default SSEStatusIndicator;
