import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";

/**
 * Chat Agent: Powered by Groq, history-aware, and outputs structured Markdown.
 */
export const runChatAgent = async (prompt, history = []) => {
    const model = getModel('chat');

    const systemPrompt = new SystemMessage(
        `You are Cortex AI, a state-of-the-art multi-agent AI assistant.
Your answers are thoughtful, clear, highly accurate, and structured in GitHub-style Markdown.
Always format code blocks with language identifiers, use bullet points for lists, and emphasize key concepts when appropriate.`
    );

    // Build context-aware conversation history
    const formattedHistory = [];
    if (Array.isArray(history)) {
        for (const msg of history.slice(-10)) { // Include last 10 messages for relevant context
            const role = msg.role || msg.type;
            const content = msg.content || (typeof msg === 'string' ? msg : '');
            if (!content) continue;

            if (role === 'assistant' || role === 'ai') {
                formattedHistory.push(new AIMessage(content));
            } else {
                formattedHistory.push(new HumanMessage(content));
            }
        }
    }

    const messages = [
        systemPrompt,
        ...formattedHistory,
        new HumanMessage(prompt)
    ];

    try {
        const response = await model.invoke(messages);
        return {
            response: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
            agent: 'chat',
            images: [],
            artifact: null
        };
    } catch (err) {
        console.error('❌ Chat Agent Execution Error:', err.message);
        throw err;
    }
};

export default runChatAgent;

