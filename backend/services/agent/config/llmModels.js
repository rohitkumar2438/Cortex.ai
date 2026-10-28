import 'dotenv/config';
import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

/**
 * Returns the best suited LLM model for each specialized agent.
 * Gracefully falls back to Groq or available API keys if a specific provider key is missing.
 */
export const getModel = (agentType = 'chat', options = {}) => {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const openAIKey = process.env.OPENAI_API_KEY;

    // 1. Coding Agent: DeepSeek via OpenRouter (or Groq LLaMA-3.3 fallback)
    if (agentType === 'coding') {
        if (openRouterKey) {
            return new ChatOpenAI({
                modelName: "deepseek/deepseek-chat",
                openAIApiKey: openRouterKey,
                configuration: {
                    baseURL: "https://openrouter.ai/api/v1"
                },
                temperature: 0.2,
                ...options
            });
        }
        if (groqKey) {
            return new ChatGroq({
                apiKey: groqKey,
                model: "qwen/qwen3.8-27b",
                temperature: 0.2,
                ...options
            });
        }
    }

    // 2. Vision / Image Analysis Agent: Gemini 2.5 / 1.5 Flash
    if (agentType === 'imageAnalyzer' || agentType === 'vision') {
        if (geminiKey) {
            return new ChatGoogleGenerativeAI({
                apiKey: geminiKey,
                model: "gemini-1.5-flash",
                temperature: 0.4,
                ...options
            });
        }
    }

    // 3. Fallback to OpenAI if configured
    if (openAIKey && !groqKey) {
        return new ChatOpenAI({
            openAIApiKey: openAIKey,
            modelName: "gpt-4o-mini",
            temperature: 0.7,
            ...options
        });
    }

    // 4. Default / General Chat / Search / RAG: Groq with automatic fallback
    const primaryGroq = new ChatGroq({
        apiKey: groqKey || 'dummy_key',
        model: "qwen/qwen3.8-27b",
        temperature: 0.7,
        maxRetries: 2,
        ...options
    });

    const fallbackGroq = new ChatGroq({
        apiKey: groqKey || 'dummy_key',
        model: "openai/gpt-oss-120b",
        temperature: 0.7,
        maxRetries: 2,
        ...options
    });

    return primaryGroq.withFallbacks([fallbackGroq]);
};
