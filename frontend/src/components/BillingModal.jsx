import React, { useState } from 'react';
import axios from 'axios';
import { Check, Zap, Sparkles, X, ShieldCheck } from 'lucide-react';

const PLANS = [
  {
    id: 'Starter',
    name: 'Starter Plan',
    price: 199,
    credits: 500,
    features: [
      '500 AI Agent Credits',
      'All 8 Specialized Agents',
      'Full Artifact Workspace',
      'Standard Response Speed'
    ],
    popular: false
  },
  {
    id: 'Pro',
    name: 'Pro Plan',
    price: 499,
    credits: 1000,
    features: [
      '1000 AI Agent Credits',
      'Priority LangGraph Execution',
      'Unlimited Code & File Generation',
      'Advanced Qdrant Document RAG',
      'Full AWS S3 Cloud Sync'
    ],
    popular: true
  }
];

function BillingModal({ isOpen, onClose, user, onCreditsUpdated }) {
  const [selectedPlan, setSelectedPlan] = useState(PLANS[1]); // Default to Pro
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    setLoading(true);
    const scriptLoaded = await loadRazorpayScript();

    if (!scriptLoaded) {
      alert("Razorpay payment gateway failed to load. Please check your internet connection.");
      setLoading(false);
      return;
    }

    try {
      // 1. Create order on backend
      const result = await axios.post("http://localhost:8000/billing/create-order", {
        amount: selectedPlan.price,
        planName: selectedPlan.id
      }, { withCredentials: true });

      if (!result.data.order) {
        alert("Failed to initialize payment order.");
        setLoading(false);
        return;
      }

      const { amount, id: order_id, currency } = result.data.order;

      // 2. Mock mode handling for local development
      if (result.data.isMock) {
        const verifyResult = await axios.post("http://localhost:8000/billing/verify", {
          userId: user.uid,
          creditsToAdd: selectedPlan.credits,
          planName: selectedPlan.id,
          isMock: true
        }, { withCredentials: true });

        if (verifyResult.data.success) {
          alert(`🎉 Payment Successful! ${selectedPlan.credits} credits added to your account.`);
          if (onCreditsUpdated) onCreditsUpdated(verifyResult.data.credits, selectedPlan.id);
          onClose();
        }
        setLoading(false);
        return;
      }

      // 3. Live/Test Razorpay Modal
      const options = {
        key: result.data.key_id,
        amount: amount.toString(),
        currency: currency,
        name: "Cortex AI Platform",
        description: `Upgrade to ${selectedPlan.name} (${selectedPlan.credits} credits)`,
        order_id: order_id,
        handler: async function (response) {
          const data = {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            userId: user.uid,
            creditsToAdd: selectedPlan.credits,
            planName: selectedPlan.id
          };

          const verifyResult = await axios.post("http://localhost:8000/billing/verify", data, { withCredentials: true });

          if (verifyResult.data.success) {
            alert(`🎉 Payment Verified! ${selectedPlan.credits} credits added.`);
            if (onCreditsUpdated) onCreditsUpdated(verifyResult.data.credits, selectedPlan.id);
            onClose();
          } else {
            alert("Payment signature verification failed.");
          }
        },
        prefill: {
          name: user.name || user.displayName || "User",
          email: user.email || "user@example.com",
        },
        theme: {
          color: "#4F46E5",
        },
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (error) {
      console.error('Payment error:', error);
      alert("Payment processing error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-gray-100 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              Upgrade Your Cortex AI Plan
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Choose a credit bundle to unlock advanced multi-agent capabilities.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Plan Selection Cards */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLANS.map((plan) => {
            const isSelected = selectedPlan.id === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${isSelected ? 'border-indigo-600 bg-indigo-50/30 shadow-md' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 right-4 px-2.5 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wider shadow-sm">
                    Most Popular
                  </span>
                )}
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-base">{plan.name}</h3>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                      {isSelected && <div className="h-1.5 w-1.5 bg-white rounded-full" />}
                    </div>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-gray-900">₹{plan.price}</span>
                    <span className="text-xs text-gray-500 font-medium">one-time</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-indigo-600">
                    +{plan.credits} AI Credits
                  </div>

                  <ul className="mt-4 space-y-2">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-6 pt-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Secure 256-bit Razorpay Checkout</span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePayment}
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" />
              {loading ? "Processing..." : `Pay ₹${selectedPlan.price} via Razorpay`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BillingModal;
