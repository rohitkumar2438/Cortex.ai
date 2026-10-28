import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { checkAuthSession } from './store/slices/authSlice.js';
import Login from './pages/Login.jsx';
import ChatDashboard from './pages/ChatDashboard.jsx';
import { Sparkles, Loader2 } from 'lucide-react';

function App() {
    const dispatch = useDispatch();
    const { isAuthenticated, loading } = useSelector((state) => state.auth);

    useEffect(() => {
        dispatch(checkAuthSession());
    }, [dispatch]);

    // Initial session checking animation
    if (loading) {
        return (
            <div className="min-h-screen w-full bg-[#090d16] flex flex-col items-center justify-center gap-4 text-white">
                <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-xl shadow-indigo-600/30 animate-pulse">
                    <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div className="flex items-center gap-2 text-indigo-300 text-sm font-medium">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Connecting to Cortex AI...</span>
                </div>
            </div>
        );
    }

    return (
        <Routes>
            <Route
                path="/login"
                element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />}
            />
            <Route
                path="/"
                element={isAuthenticated ? <ChatDashboard /> : <Navigate to="/login" replace />}
            />
            <Route
                path="/chat/:id"
                element={isAuthenticated ? <ChatDashboard /> : <Navigate to="/login" replace />}
            />
            <Route
                path="*"
                element={<Navigate to="/" replace />}
            />
        </Routes>
    );
}

export default App;
