import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { updateUserCredits } from '../store/slices/authSlice.js';
import { addToast } from '../store/slices/uiSlice.js';
import { Check, Zap, Sparkles, X, ShieldCheck, Coins } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://cortex-backend-s1mw.onrender.com';

const CREDIT_PACKS = [
    {
        id: 'pack_100',
        name: 'Starter Pack',
        credits: 100,
        priceINR: 99,
        popular: false,
        features: [
            '100 AI credits',
            'Access to Chat & Web Search',
            'Standard generation speed',
            'Community support'
        ]
    },
    {
        id: 'pack_500',
        name: 'Pro Pack',
        credits: 500,
        priceINR: 399,
        popular: true,
        features: [
            '500 AI credits',
            'DeepSeek Coding Agent & Live Previews',
            'Full PDF & PowerPoint generation',
            'Priority queue execution'
        ]
    },
    {
        id: 'pack_1000',
        name: 'Enterprise Pack',
        credits: 1000,
        priceINR: 699,
        popular: false,
        features: [
            '1,000 AI credits (Best Value)',
            'Unlimited high-res image generation',
            'Full Artifact Workspace sync',
            'Highest speed & throughput'
        ]
    }
];

export const BillingModal = ({ isOpen, onClose, user }) => {
    const dispatch = useDispatch();
    const [selectedPack, setSelectedPack] = useState(CREDIT_PACKS[1]); // Default to 500
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) return resolve(true);
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleCheckout = async () => {
        setLoading(true);
        const scriptLoaded = await loadRazorpayScript();

        if (!scriptLoaded) {
            dispatch(addToast({ message: "Razorpay payment checkout failed to load. Check connection.", type: 'error' }));
            setLoading(false);
            return;
        }

        try {
            // 1. Create Order on Backend
            const res = await fetch(`${API_BASE}/billing/order`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': user?.userId || user?.firebaseUid || user?.uid || ''
                },
                body: JSON.stringify({
                    packId: selectedPack.id,
                    userId: user?.userId || user?.firebaseUid || user?.uid || ''
                })
            });

            const data = await res.json();
            if (!res.ok || !data.order) {
                throw new Error(data.error || "Failed to initialize checkout order.");
            }

            const { order, key_id, isMock } = data;

            // 2. Mock mode verification for dev environments
            if (isMock) {
                const verifyRes = await fetch(`${API_BASE}/billing/verify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-id': user?.userId || user?.firebaseUid || user?.uid || ''
                    },
                    body: JSON.stringify({
                        razorpay_order_id: order.id,
                        razorpay_payment_id: `pay_mock_${Date.now()}`,
                        razorpay_signature: 'mock_signature',
                        userId: user?.userId || user?.firebaseUid || user?.uid || '',
                        isMock: true
                    })
                });

                const verifyData = await verifyRes.json();
                if (verifyData.success) {
                    dispatch(updateUserCredits(verifyData.credits));
                    dispatch(addToast({ message: `🎉 ${selectedPack.credits} credits added to your account!`, type: 'success' }));
                    onClose();
                }
                setLoading(false);
                return;
            }

            // 3. Live Razorpay Popup Checkout
            const options = {
                key: key_id,
                amount: order.amount.toString(),
                currency: order.currency || "INR",
                name: "Cortex AI Platform",
                description: `${selectedPack.name} (${selectedPack.credits} Credits)`,
                order_id: order.id,
                prefill: {
                    name: user?.name || "Cortex User",
                    email: user?.email || "user@cortex.ai"
                },
                theme: {
                    color: "#6366f1" // Indigo 500
                },
                handler: async (response) => {
                    try {
                        const verifyRes = await fetch(`${API_BASE}/billing/verify`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': user?.userId || user?.firebaseUid || user?.uid || ''
                            },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                userId: user?.userId || user?.firebaseUid || user?.uid || ''
                            })
                        });

                        const verifyData = await verifyRes.json();
                        if (verifyData.success) {
                            dispatch(updateUserCredits(verifyData.credits));
                            dispatch(addToast({ message: `🎉 Payment successful! ${selectedPack.credits} credits added!`, type: 'success' }));
                            onClose();
                        } else {
                            throw new Error(verifyData.error || "Payment verification failed.");
                        }
                    } catch (verifyErr) {
                        dispatch(addToast({ message: verifyErr.message, type: 'error' }));
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', (failRes) => {
                dispatch(addToast({ message: failRes.error?.description || "Payment failed.", type: 'error' }));
            });
            rzp.open();

        } catch (err) {
            console.error('Checkout error:', err);
            dispatch(addToast({ message: err.message || "Failed to initialize payment.", type: 'error' }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-indigo-900/50 shadow-2xl overflow-hidden p-6 sm:p-8">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Modal Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        <span>Instant Top-Up</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                        Power Up Your AI Workflow
                    </h2>
                    <p className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
                        Choose a credit pack to unlock DeepSeek Coding, Live Search, PDF reports, and PPT generation.
                    </p>
                </div>

                {/* 3 Credit Packs Grid (100 / 500 / 1000) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {CREDIT_PACKS.map((pack) => {
                        const isSelected = selectedPack.id === pack.id;

                        return (
                            <div
                                key={pack.id}
                                onClick={() => setSelectedPack(pack)}
                                className={`relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                                    isSelected
                                        ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xl'
                                        : 'bg-slate-950/60 border-indigo-950/60 hover:border-indigo-800/80 hover:bg-slate-950'
                                }`}
                            >
                                {pack.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-md">
                                        Popular
                                    </div>
                                )}

                                <div>
                                    <h3 className="font-bold text-white text-base mb-1">{pack.name}</h3>
                                    <div className="flex items-baseline gap-1 my-2">
                                        <span className="text-2xl font-extrabold text-white">₹{pack.priceINR}</span>
                                        <span className="text-xs text-slate-400 font-medium">/ pack</span>
                                    </div>

                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-900/40 border border-indigo-700/40 text-amber-300 font-semibold text-xs mb-4">
                                        <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <span>{pack.credits} Credits</span>
                                    </div>

                                    <ul className="space-y-2 text-[11px] text-slate-400 mb-4">
                                        {pack.features.map((feat, idx) => (
                                            <li key={idx} className="flex items-center gap-1.5">
                                                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                <span>{feat}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className={`w-full py-2 rounded-xl text-center text-xs font-semibold transition-all ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-800 text-slate-300'
                                }`}>
                                    {isSelected ? 'Selected' : 'Select'}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Checkout Action Button */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-indigo-950/60">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Secured by Razorpay • UPI, Cards & NetBanking</span>
                    </div>

                    <button
                        onClick={handleCheckout}
                        disabled={loading}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <Zap className="w-4 h-4 fill-white" />
                                <span>Get {selectedPack.credits} Credits for ₹{selectedPack.priceINR}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BillingModal;
