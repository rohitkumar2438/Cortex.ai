import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";

/**
 * Chat Agent: Powered by Groq, history-aware, RAG-enabled, and outputs structured Markdown with citations.
 */
export const runChatAgent = async (prompt, history = [], ragContext = '', ragSources = []) => {
    const model = getModel('chat');

    let systemText = `You are Cortex AI, a state-of-the-art multi-agent AI assistant.
Your answers are thoughtful, clear, highly accurate, and structured in GitHub-style Markdown.
Always format code blocks with language identifiers, use bullet points for lists, and emphasize key concepts when appropriate.`;

    if (ragContext) {
        systemText += `\n\n=== ATTACHED KNOWLEDGE DOCUMENTS (RAG ACTIVE) ===
The user has attached knowledge documents (such as a Resume, CV, Transcript, Report, or Notes).
Document Excerpts:
${ragContext}

CRITICAL EXTRACTION DIRECTIVES:
1. When the user asks for specific personal, academic, or factual details present in the attached documents (such as CGPA, GPA, college, university, branch, skills, experience, project details, email, phone, or dates), you MUST extract and state the EXACT value directly from the document excerpts above.
2. DO NOT give generic textbook explanations or formulas (e.g., NEVER explain "how to calculate CGPA" or "how to compute a GPA") when the value or details are already stated in the uploaded documents. State the exact figure or detail directly!
3. Format the extracted values clearly with bullet points and bold headers.`;
    }

    const systemPrompt = new SystemMessage(systemText);

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
        let finalResponse = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

        // Append Citation block if RAG sources were used
        if (ragSources && ragSources.length > 0) {
            const uniqueDocs = [...new Set(ragSources.map(s => s.docName))];
            finalResponse += `\n\n> 📄 **Cited Document Sources:**\n` + uniqueDocs.map(d => `> - *${d}*`).join('\n');
        }

        return {
            response: finalResponse,
            agent: 'chat',
            images: [],
            artifact: null,
            ragSources: ragSources || []
        };
    } catch (err) {
        console.error('❌ Chat Agent Execution Error:', err.message);
        throw err;
    }
};

export default runChatAgent;

