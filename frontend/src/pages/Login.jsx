import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase.js';
import { loginWithFirebase } from '../store/slices/authSlice.js';
import { addToast } from '../store/slices/uiSlice.js';
import { Sparkles, Brain, Search, Code, ShieldCheck, ArrowRight } from 'lucide-react';

export const Login = () => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();

            const actionResult = await dispatch(loginWithFirebase(idToken));
            if (loginWithFirebase.rejected.match(actionResult)) {
                throw new Error(actionResult.payload || 'Login rejected by gateway');
            }

            dispatch(addToast({ message: `Welcome back, ${result.user.displayName || 'friend'}!`, type: 'success' }));
        } catch (err) {
            console.error('Google Sign-In Error:', err);
            dispatch(addToast({ message: err.message || 'Failed to sign in with Google.', type: 'error' }));
        } finally {
            setLoading(false);
        }
    };

    const handleDemoSignIn = async () => {
        try {
            setLoading(true);
            const actionResult = await dispatch(loginWithFirebase('demo_token'));
            if (loginWithFirebase.rejected.match(actionResult)) {
                throw new Error(actionResult.payload || 'Demo login rejected');
            }
            dispatch(addToast({ message: 'Logged in as Cortex Developer (100 credits)!', type: 'success' }));
        } catch (err) {
            console.error('Demo Login Error:', err);
            dispatch(addToast({ message: err.message || 'Demo login failed.', type: 'error' }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#090d16] text-slate-100 flex flex-col justify-center items-center relative overflow-hidden px-4">
            {/* Ambient Background Glows */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

            {/* Main Login Card */}
            <div className="relative w-full max-w-md p-8 rounded-3xl bg-slate-900/80 border border-indigo-900/40 backdrop-blur-xl shadow-2xl shadow-indigo-950/50 text-center">
                {/* Logo & Header */}
                <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/30 mb-5">
                    <Sparkles className="w-8 h-8 text-white" />
                </div>

                <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
                    Welcome to Cortex AI
                </h1>
                <p className="text-sm text-slate-400 mb-8 leading-relaxed">
                    A next-generation Multi-Agent AI platform powered by LangGraph, Groq, and live web intelligence.
                </p>

                {/* Feature Highlights */}
                <div className="grid grid-cols-3 gap-2.5 mb-8 text-left">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-indigo-950/40">
                        <Brain className="w-4 h-4 text-indigo-400 mb-1.5" />
                        <h4 className="text-[11px] font-bold text-white">Smart Routing</h4>
                        <p className="text-[10px] text-slate-400">Auto-routes to agents</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-cyan-950/40">
                        <Search className="w-4 h-4 text-cyan-400 mb-1.5" />
                        <h4 className="text-[11px] font-bold text-white">Live Search</h4>
                        <p className="text-[10px] text-slate-400">Tavily web discovery</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-emerald-950/40">
                        <Code className="w-4 h-4 text-emerald-400 mb-1.5" />
                        <h4 className="text-[11px] font-bold text-white">Artifacts</h4>
                        <p className="text-[10px] text-slate-400">Live code preview</p>
                    </div>
                </div>

                {/* Google Sign-In Button */}
                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all duration-200 shadow-xl shadow-white/5 disabled:opacity-50 cursor-pointer"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                                />
                            </svg>
                            <span>Continue with Google</span>
                            <ArrowRight className="w-4 h-4 text-slate-500" />
                        </>
                    )}
                </button>

                {/* Developer Demo One-Click Sign-In */}
                <div className="relative my-4 flex items-center justify-center">
                    <div className="border-t border-indigo-900/40 w-full" />
                    <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-widest">or</span>
                    <div className="border-t border-indigo-900/40 w-full" />
                </div>

                <button
                    onClick={handleDemoSignIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-indigo-300 hover:text-white border border-indigo-800/40 text-xs font-semibold transition-all cursor-pointer shadow-md"
                >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Quick Demo Login (100 Free Credits)</span>
                </button>

                <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Protected by Firebase Authentication & Gateway Sessions</span>
                </div>
            </div>
        </div>
    );
};

export default Login;
