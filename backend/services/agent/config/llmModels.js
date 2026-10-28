import 'dotenv/config';
import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

/**
 * Returns the appropriate LLM instance for each specialized agent.
 * Respects environment variables and never hardcodes keys.
 * Switch on agent name as per specification.
 */
export const getModel = (agent = 'chat', options = {}) => {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY || process.env.OPENROUTER_API_KEY;
    const openAIKey = process.env.OPENAI_API_KEY;

    switch (agent) {
        case 'coding':
            // Coding Agent: DeepSeek (Phase 5) with Groq fallback
            if (deepseekKey) {
                return new ChatOpenAI({
                    modelName: "deepseek/deepseek-chat",
                    openAIApiKey: deepseekKey,
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
            break;

        case 'image':
            // Image / Vision Agent: Gemini 2.5 / 1.5 Flash
            if (geminiKey) {
                return new ChatGoogleGenerativeAI({
                    apiKey: geminiKey,
                    model: "gemini-1.5-flash",
                    temperature: 0.4,
                    ...options
                });
            }
            break;

        case 'pdf':
        case 'ppt':
            // Document / Presentation agents: Groq with fast generation
            if (groqKey) {
                return new ChatGroq({
                    apiKey: groqKey,
                    model: "qwen/qwen3.8-27b",
                    temperature: 0.3,
                    ...options
                });
            }
            break;

        case 'search':
            // Search Agent: Groq with high precision for grounding live context
            if (groqKey) {
                return new ChatGroq({
                    apiKey: groqKey,
                    model: "qwen/qwen3.8-27b",
                    temperature: 0.3,
                    maxRetries: 2,
                    ...options
                });
            }
            break;

        case 'chat':
        default:
            // Chat Agent: Groq model with history awareness and fallback
            if (groqKey) {
                const primary = new ChatGroq({
                    apiKey: groqKey,
                    model: "qwen/qwen3.8-27b",
                    temperature: 0.7,
                    maxRetries: 2,
                    ...options
                });
                const fallback = new ChatGroq({
                    apiKey: groqKey,
                    model: "openai/gpt-oss-120b",
                    temperature: 0.7,
                    maxRetries: 2,
                    ...options
                });
                return primary.withFallbacks([fallback]);
            }
            break;
    }

    // Default fallback to OpenAI if configured, otherwise a safe mockable instance
    if (openAIKey) {
        return new ChatOpenAI({
            openAIApiKey: openAIKey,
            modelName: "gpt-4o-mini",
            temperature: 0.7,
            ...options
        });
    }

    // Safe dev fallback when no external API key is active
    return new ChatGroq({
        apiKey: groqKey || 'gsk_dummy_dev_key',
        model: "qwen/qwen3.8-27b",
        temperature: 0.7,
        maxRetries: 1,
        ...options
    });
};

export default getModel;
