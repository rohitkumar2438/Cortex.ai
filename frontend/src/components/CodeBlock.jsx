import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

export const CodeBlock = ({ language, value }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    return (
        <div className="relative group rounded-xl overflow-hidden my-4 border border-indigo-900/40 bg-[#1e1e2e] shadow-2xl">
            {/* Header bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#181825] border-b border-indigo-900/30 text-xs text-indigo-300 font-mono">
                <span className="uppercase tracking-wider font-semibold">
                    {language || 'code'}
                </span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/40 text-indigo-200 transition-all text-xs cursor-pointer"
                    title="Copy code to clipboard"
                >
                    {copied ? (
                        <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400 font-sans">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-3.5 h-3.5" />
                            <span className="font-sans">Copy code</span>
                        </>
                    )}
                </button>
            </div>

            {/* Syntax Highlighted Code */}
            <div className="overflow-x-auto text-sm">
                <SyntaxHighlighter
                    language={language || 'javascript'}
                    style={oneDark}
                    customStyle={{
                        margin: 0,
                        padding: '1.25rem',
                        background: 'transparent',
                        fontSize: '0.875rem',
                        lineHeight: '1.6'
                    }}
                    wrapLongLines={false}
                >
                    {value}
                </SyntaxHighlighter>
            </div>
        </div>
    );
};

export default CodeBlock;

