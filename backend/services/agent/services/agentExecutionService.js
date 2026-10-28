import { multiAgentGraph } from "../graph/multiAgentGraph.js";

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:8002';

/**
 * Saves a message into chat-service scoped to user.
 */
export const persistMessage = async (conversationId, userId, messageData) => {
    if (!conversationId || conversationId === 'default' || !userId) {
        return null;
    }

    try {
        const res = await fetch(`${CHAT_SERVICE_URL}/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId
            },
            body: JSON.stringify(messageData)
        });

        if (res.ok) {
            return await res.json();
        } else {
            console.warn(`⚠️ Failed to persist message to chat-service (status ${res.status})`);
            return null;
        }
    } catch (err) {
        console.warn('⚠️ chat-service unreachable for message persistence:', err.message);
        return null;
    }
};

/**
 * Fetches prior conversation messages as context for history awareness.
 */
export const fetchConversationHistory = async (conversationId, userId) => {
    if (!conversationId || conversationId === 'default' || !userId) {
        return [];
    }

    try {
        const res = await fetch(`${CHAT_SERVICE_URL}/conversations/${conversationId}/messages`, {
            method: 'GET',
            headers: {
                'x-user-id': userId
            }
        });

        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        }
    } catch (err) {
        console.warn('⚠️ chat-service unreachable for history fetch:', err.message);
    }
    return [];
};

/**
 * Executes the full agent workflow:
 * 1. Status: Thinking -> Persists user prompt and resolves context
 * 2. Status: Reasoning -> Invokes LangGraph multi-agent graph with prior messages
 * 3. Status: Generating -> Persists assistant response (with images & artifacts)
 */
export const executeAgentWorkflow = async ({
    prompt,
    agent = 'auto',
    conversationId = 'default',
    userId = '',
    onStatusUpdate = () => {}
}) => {
    // Stage 1: Thinking
    onStatusUpdate('Thinking', { step: 'routing', prompt });

    // 1. Persist user message if conversationId provided
    if (conversationId && conversationId !== 'default' && userId) {
        await persistMessage(conversationId, userId, {
            role: 'user',
            content: prompt,
            agent: agent === 'auto' ? 'chat' : agent
        });
    }

    // 2. Fetch history context
    const history = await fetchConversationHistory(conversationId, userId);

    // Stage 2: Reasoning
    onStatusUpdate('Reasoning', { step: 'execution', agent });

    // 3. Invoke LangGraph Orchestration
    const graphResult = await multiAgentGraph.invoke({
        prompt,
        agent: agent === 'auto' ? '' : agent,
        messages: history,
        conversationId,
        userId
    });

    // Stage 3: Generating
    onStatusUpdate('Generating', {
        step: 'finalizing',
        agent: graphResult.agent,
        images: graphResult.images || []
    });

    const responseText = graphResult.response || "";
    const chosenAgent = graphResult.agent || "chat";
    const images = graphResult.images || [];
    const artifact = graphResult.artifact || null;

    // 4. Persist assistant message
    if (conversationId && conversationId !== 'default' && userId) {
        await persistMessage(conversationId, userId, {
            role: 'assistant',
            content: responseText,
            agent: chosenAgent,
            images,
            artifact
        });
    }

    return {
        response: responseText,
        agent: chosenAgent,
        images,
        artifact,
        conversationId
    };
};

export default executeAgentWorkflow;
