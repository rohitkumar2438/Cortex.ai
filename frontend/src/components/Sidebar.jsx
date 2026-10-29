import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    createNewConversation,
    selectConversation,
    deleteConversationById,
    clearActiveChat
} from '../store/slices/chatSlice.js';
import { logoutUser } from '../store/slices/authSlice.js';
import { toggleSidebar } from '../store/slices/uiSlice.js';
import {
    Plus,
    MessageSquare,
    Trash2,
    LogOut,
    PanelLeftClose,
    Coins,
    Sparkles,
    Cpu
} from 'lucide-react';

export const Sidebar = ({ onOpenBilling }) => {
    const dispatch = useDispatch();
    const { conversations, activeConversationId, loadingConversations } = useSelector((state) => state.chat);
    const { user } = useSelector((state) => state.auth);
    const sidebarOpen = useSelector((state) => state.ui.sidebarOpen);

    const handleNewChat = () => {
        dispatch(clearActiveChat());
        dispatch(createNewConversation('New Session'));
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        if (window.confirm('Delete this conversation?')) {
            dispatch(deleteConversationById(id));
        }
    };

    if (!sidebarOpen) return null;

    return (
        <aside className="w-68 h-screen flex flex-col bg-[#080b12] border-r border-white/[0.06] z-30 shrink-0 select-none transition-all">
            {/* Header / Brand Mark */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm shadow-indigo-500/20">
                        <Cpu className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-white tracking-tight">Cortex</span>
                        <span className="text-[10px] font-medium tracking-wide uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-indigo-300 border border-white/[0.08]">
                            AI
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => dispatch(toggleSidebar())}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title="Collapse sidebar"
                >
                    <PanelLeftClose className="w-4 h-4" />
                </button>
            </div>

            {/* New Chat Button */}
            <div className="p-3">
                <button
                    onClick={handleNewChat}
                    className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.14] text-slate-200 hover:text-white text-xs font-medium transition-all duration-150 cursor-pointer shadow-sm group"
                >
                    <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
                        <span>New chat</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.04]">
                        ⌘K
                    </span>
                </button>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 scrollbar-thin scrollbar-thumb-white/[0.06] scrollbar-track-transparent">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Recent Sessions
                </div>

                {loadingConversations ? (
                    <div className="p-4 text-center text-xs text-slate-500 animate-pulse">
                        Loading sessions...
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 italic">
                        No conversations yet.
                    </div>
                ) : (
                    conversations.map((conv) => {
                        const id = conv._id || conv.id;
                        const isActive = activeConversationId === id;

                        return (
                            <div
                                key={id}
                                onClick={() => dispatch(selectConversation(id))}
                                className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-normal cursor-pointer transition-all ${
                                    isActive
                                        ? 'bg-white/[0.08] text-white font-medium border border-white/[0.08] shadow-sm'
                                        : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-600'}`} />
                                    <span className="truncate">{conv.title || 'Untitled Session'}</span>
                                </div>

                                <button
                                    onClick={(e) => handleDelete(e, id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                                    title="Delete session"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer / User Profile & Credits */}
            <div className="p-2.5 border-t border-white/[0.06] bg-[#07090f]">
                {user && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="flex items-center gap-2.5 truncate">
                            {user.avatar || user.picture ? (
                                <img
                                    src={user.avatar || user.picture}
                                    alt={user.name}
                                    className="w-7 h-7 rounded-full border border-white/[0.1] object-cover"
                                />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-semibold text-white text-[11px] shadow-sm">
                                    {(user.name || user.email || 'U')[0].toUpperCase()}
                                </div>
                            )}
                            <div className="truncate">
                                <p className="text-xs font-medium text-slate-200 truncate leading-tight">
                                    {user.name || 'Developer'}
                                </p>
                                <button
                                    onClick={onOpenBilling}
                                    className="flex items-center gap-1 text-[11px] text-amber-400/90 hover:text-amber-300 transition-colors cursor-pointer"
                                    title="View plans and buy credits"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                    <span>{user.credits ?? 100} credits</span>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => dispatch(logoutUser())}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
                            title="Sign out"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
