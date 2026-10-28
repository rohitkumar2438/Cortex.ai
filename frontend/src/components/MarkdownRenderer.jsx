import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock.jsx';
import { ExternalLink } from 'lucide-react';

export const MarkdownRenderer = ({ content, images = [] }) => {
    return (
        <div className="prose prose-invert prose-indigo max-w-none text-slate-200 leading-relaxed break-words">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');

                        return !inline && match ? (
                            <CodeBlock
                                language={match[1]}
                                value={codeString}
                                {...props}
                            />
                        ) : (
                            <code className="px-1.5 py-0.5 rounded-md bg-indigo-950/70 border border-indigo-800/40 text-violet-300 font-mono text-sm" {...props}>
                                {children}
                            </code>
                        );
                    },
                    a({ node, href, children, ...props }) {
                        return (
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline font-medium transition-colors"
                                {...props}
                            >
                                <span>{children}</span>
                                <ExternalLink className="w-3.5 h-3.5 inline-block" />
                            </a>
                        );
                    },
                    ul({ children }) {
                        return <ul className="my-2.5 list-disc list-inside space-y-1.5 text-slate-300">{children}</ul>;
                    },
                    ol({ children }) {
                        return <ol className="my-2.5 list-decimal list-inside space-y-1.5 text-slate-300">{children}</ol>;
                    },
                    p({ children }) {
                        return <p className="my-2.5">{children}</p>;
                    },
                    h1({ children }) {
                        return <h1 className="text-2xl font-bold text-white mt-6 mb-3 border-b border-indigo-900/40 pb-2">{children}</h1>;
                    },
                    h2({ children }) {
                        return <h2 className="text-xl font-semibold text-white mt-5 mb-2">{children}</h2>;
                    },
                    h3({ children }) {
                        return <h3 className="text-lg font-medium text-indigo-200 mt-4 mb-2">{children}</h3>;
                    }
                }}
            >
                {content}
            </ReactMarkdown>

            {/* Persistent Image Grid (Survives Reloads) */}
            {images && images.length > 0 && (
                <div className="mt-4 pt-4 border-t border-indigo-900/40">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
                        Attached Visuals & References
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {images.map((imgUrl, idx) => (
                            <a
                                key={idx}
                                href={imgUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group relative rounded-xl overflow-hidden border border-indigo-800/30 bg-slate-900 shadow-md hover:border-indigo-500 transition-all aspect-video block"
                            >
                                <img
                                    src={imgUrl}
                                    alt={`Generated image ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ExternalLink className="w-5 h-5 text-white" />
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarkdownRenderer;

