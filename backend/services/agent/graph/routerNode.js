import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";

const VALID_AGENTS = ['chat', 'search', 'coding', 'pdf', 'ppt', 'image'];

/**
 * Router Node: Classifies the incoming prompt and returns exactly one word:
 * chat, search, coding, pdf, ppt, or image.
 */
export const routerNode = async (state) => {
    // If the caller explicitly designated an agent other than 'auto', honor it
    if (state.agent && VALID_AGENTS.includes(state.agent.toLowerCase()) && state.agent.toLowerCase() !== 'auto') {
        return { agent: state.agent.toLowerCase() };
    }

    const prompt = (state.prompt || "").trim();
    if (!prompt) {
        return { agent: 'chat' };
    }

    try {
        const groqModel = getModel('chat', { temperature: 0 });

        const routerSystemPrompt = new SystemMessage(
            `You are the Intent Classification Router for Cortex AI.
Analyze the user's prompt and categorize it into EXACTLY ONE of the following 6 categories:
1. chat: General conversation, reasoning, philosophical questions, explanations, roleplay, creative writing, advice, or greeting.
2. search: Current info, live news, internet lookup, real-time facts, recent events, weather, stock prices, or specific web research.
3. coding: Writing, debugging, reviewing, or explaining programming code, software architecture, full-stack components, HTML/CSS/JS, algorithms, or scripts.
4. pdf: Requests specifically asking to create, compile, draft, export, or generate a PDF document or formal text report.
5. ppt: Requests specifically asking to generate presentation slides, PowerPoint decks, or pitch decks.
6. image: Requests specifically asking to draw, paint, generate, or create an image, illustration, or visual artwork.

CRITICAL INSTRUCTION: Respond with ONLY the single lowercase category name (chat, search, coding, pdf, ppt, or image). Do not include any punctuation, quotes, or additional text.`
        );

        const response = await groqModel.invoke([
            routerSystemPrompt,
            new HumanMessage(`Prompt: "${prompt}"\nCategory:`)
        ]);

        const rawContent = (response.content || "").toLowerCase().trim();
        // Match the single category name
        const match = rawContent.match(/\b(chat|search|coding|pdf|ppt|image)\b/);
        const classified = match ? match[1] : 'chat';

        return { agent: classified };
    } catch (err) {
        console.warn('⚠️ Router classification warning (falling back to chat):', err.message);

        // Fallback rule-based matching if Groq is unreachable
        const p = prompt.toLowerCase();
        if (/search|news|weather|latest|today|current price|who won|score/i.test(p)) return { agent: 'search' };
        if (/code|function|class|bug|component|javascript|python|react|html|css|sql/i.test(p)) return { agent: 'coding' };
        if (/generate (a )?pdf|make (a )?pdf|export (to )?pdf/i.test(p)) return { agent: 'pdf' };
        if (/generate (a )?ppt|presentation|slides|pitch deck/i.test(p)) return { agent: 'ppt' };
        if (/generate (an )?image|draw|paint|picture of|illustration/i.test(p)) return { agent: 'image' };

        return { agent: 'chat' };
    }
};

export default routerNode;

