import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { removeToast } from '../store/slices/uiSlice.js';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export const ToastContainer = () => {
    const dispatch = useDispatch();
    const toasts = useSelector((state) => state.ui.toasts);

    if (!toasts || toasts.length === 0) return null;

    return (
        <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
            {toasts.map((toast) => {
                const isError = toast.type === 'error';
                const isSuccess = toast.type === 'success';

                return (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-xl shadow-xl backdrop-blur-md border text-sm font-medium transition-all duration-300 animate-slide-in ${
                            isError
                                ? 'bg-red-950/90 border-red-500/40 text-red-200'
                                : isSuccess
                                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                                : 'bg-slate-900/90 border-indigo-500/40 text-indigo-200'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            {isError && <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
                            {isSuccess && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
                            {!isError && !isSuccess && <Info className="w-5 h-5 text-indigo-400 shrink-0" />}
                            <span>{toast.message}</span>
                        </div>
                        <button
                            onClick={() => dispatch(removeToast(toast.id))}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default ToastContainer;
