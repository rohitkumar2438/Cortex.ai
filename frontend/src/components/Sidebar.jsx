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
    Sparkles
} from 'lucide-react';

export const Sidebar = ({ onOpenBilling }) => {
    const dispatch = useDispatch();
    const { conversations, activeConversationId, loadingConversations } = useSelector((state) => state.chat);
    const { user } = useSelector((state) => state.auth);
    const sidebarOpen = useSelector((state) => state.ui.sidebarOpen);

    const handleNewChat = () => {
        dispatch(clearActiveChat());
        dispatch(createNewConversation('New Chat'));
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        if (window.confirm('Delete this conversation?')) {
            dispatch(deleteConversationById(id));
        }
    };

    if (!sidebarOpen) return null;

    return (
        <aside className="w-72 h-screen flex flex-col bg-slate-950 border-r border-indigo-950/60 z-30 shrink-0 select-none">
            {/* Header / Logo */}
            <div className="flex items-center justify-between p-4 border-b border-indigo-950/40">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-md shadow-indigo-600/30">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-white text-base tracking-tight leading-none">
                            Cortex AI
                        </h1>
                        <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-semibold">
                            Multi-Agent
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => dispatch(toggleSidebar())}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
                    title="Collapse sidebar"
                >
                    <PanelLeftClose className="w-5 h-5" />
                </button>
            </div>

            {/* New Chat Button */}
            <div className="p-3">
                <button
                    onClick={handleNewChat}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                    <Plus className="w-4 h-4" />
                    <span>New Chat</span>
                </button>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1 scrollbar-thin scrollbar-thumb-indigo-950 scrollbar-track-transparent">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Recent Conversations
                </div>

                {loadingConversations ? (
                    <div className="p-4 text-center text-xs text-slate-500 animate-pulse">
                        Loading chats...
                    </div>
                ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 italic">
                        No conversations yet. Start a new one!
                    </div>
                ) : (
                    conversations.map((conv) => {
                        const id = conv._id || conv.id;
                        const isActive = activeConversationId === id;

                        return (
                            <div
                                key={id}
                                onClick={() => dispatch(selectConversation(id))}
                                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                                    isActive
                                        ? 'bg-indigo-600/20 border border-indigo-500/40 text-white shadow-sm'
                                        : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 truncate">
                                    <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                                    <span className="truncate">{conv.title || 'Untitled Chat'}</span>
                                </div>

                                <button
                                    onClick={(e) => handleDelete(e, id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                                    title="Delete conversation"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer / User Profile & Credits */}
            <div className="p-3 border-t border-indigo-950/60 bg-slate-950/80">
                {user && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-indigo-900/30">
                        <div className="flex items-center gap-2.5 truncate">
                            {user.avatar || user.picture ? (
                                <img
                                    src={user.avatar || user.picture}
                                    alt={user.name}
                                    className="w-8 h-8 rounded-full border border-indigo-500/40 object-cover"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white text-xs">
                                    {(user.name || user.email || 'U')[0].toUpperCase()}
                                </div>
                            )}
                            <div className="truncate">
                                <p className="text-xs font-semibold text-white truncate leading-tight">
                                    {user.name || 'User'}
                                </p>
                                <button
                                    onClick={onOpenBilling}
                                    className="flex items-center gap-1 text-[11px] text-amber-400 font-medium hover:text-amber-300 transition-colors cursor-pointer group"
                                    title="Click to buy more credits"
                                >
                                    <Coins className="w-3 h-3 group-hover:scale-110 transition-transform" />
                                    <span>{user.credits ?? 100} credits</span>
                                    <span className="text-[10px] text-indigo-400 font-bold ml-1 bg-indigo-950/80 px-1 rounded border border-indigo-800/50">+</span>
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => dispatch(logoutUser())}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Sign out"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;

