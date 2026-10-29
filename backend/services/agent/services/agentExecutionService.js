import crypto from 'crypto';
import { multiAgentGraph } from "../graph/multiAgentGraph.js";
import { getCache, setCache } from "../../../shared/redisClient.js";

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || 'http://localhost:8002';
const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL || 'http://localhost:8004';

/**
 * Deducts credits per-agent call via billing-service.
 * Throws 402 if credits are insufficient.
 */
export const deductCreditsBeforeRun = async (userId, agent) => {
    if (!userId || userId === 'default') return null;

    try {
        const res = await fetch(`${BILLING_SERVICE_URL}/deduct`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, agent })
        });

        if (res.status === 402) {
            const data = await res.json().catch(() => ({}));
            const error = new Error(data.error || 'Insufficient credits to run this agent.');
            error.statusCode = 402;
            error.requiredCredits = data.requiredCredits;
            error.currentCredits = data.currentCredits;
            throw error;
        }

        if (res.ok) {
            return await res.json();
        }
    } catch (err) {
        if (err.statusCode === 402) throw err;
        console.warn('⚠️ Could not connect to billing-service for deduction (proceeding):', err.message);
    }
    return null;
};

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
    const startTime = Date.now();
    const cleanPrompt = (prompt || '').trim();

    // 0. Redis Semantic / Exact Cache Check
    const promptHash = crypto
        .createHash('sha256')
        .update(cleanPrompt.toLowerCase().replace(/\s+/g, ' '))
        .digest('hex')
        .substring(0, 16);
    const cacheKey = `cortex:llm_cache:${agent}:${promptHash}`;

    try {
        const cachedResult = await getCache(cacheKey);
        if (cachedResult && cachedResult.response) {
            const latencyMs = Math.max(12, Date.now() - startTime);
            console.log(`⚡ [Redis Cache HIT] Returning cached response for agent [${agent}] (hash: ${promptHash}, latency: ${latencyMs}ms)`);

            // Stream fast transition indicating cache hit
            onStatusUpdate('Thinking', { step: 'cache_hit', prompt: cleanPrompt });
            onStatusUpdate('Generating', { step: 'cached_delivery', latencyMs });

            // Persist conversation messages for history consistency
            if (conversationId && conversationId !== 'default' && userId) {
                await persistMessage(conversationId, userId, {
                    role: 'user',
                    content: cleanPrompt,
                    agent: agent === 'auto' ? 'chat' : agent
                });
                await persistMessage(conversationId, userId, {
                    role: 'assistant',
                    content: cachedResult.response,
                    agent: cachedResult.agent,
                    images: cachedResult.images || [],
                    artifact: cachedResult.artifact || null,
                    url: cachedResult.url || null,
                    cached: true,
                    latencyMs
                });
            }

            return {
                ...cachedResult,
                conversationId,
                cached: true,
                cachedAt: cachedResult.cachedAt,
                latencyMs,
                remainingCredits: null // Zero credits charged on cache hit!
            };
        }
    } catch (cacheErr) {
        console.warn('⚠️ Redis cache read warning (proceeding to live inference):', cacheErr.message);
    }

    // Stage 1: Thinking
    onStatusUpdate('Thinking', { step: 'routing', prompt: cleanPrompt });

    // 1. Verify and deduct credits (blocks with 402 if balance is insufficient)
    const deductionResult = await deductCreditsBeforeRun(userId, agent);

    // 2. Persist user message if conversationId provided
    if (conversationId && conversationId !== 'default' && userId) {
        await persistMessage(conversationId, userId, {
            role: 'user',
            content: cleanPrompt,
            agent: agent === 'auto' ? 'chat' : agent
        });
    }

    // 3. Fetch history context
    const history = await fetchConversationHistory(conversationId, userId);

    // Stage 2: Reasoning
    onStatusUpdate('Reasoning', { step: 'execution', agent });

    // 4. Invoke LangGraph Orchestration
    const graphResult = await multiAgentGraph.invoke({
        prompt: cleanPrompt,
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
    const downloadUrl = graphResult.url || null;
    const ragSources = graphResult.ragSources || [];
    const totalLatencyMs = Date.now() - startTime;

    // 5. Persist assistant message
    if (conversationId && conversationId !== 'default' && userId) {
        await persistMessage(conversationId, userId, {
            role: 'assistant',
            content: responseText,
            agent: chosenAgent,
            images,
            artifact,
            url: downloadUrl,
            cached: false,
            latencyMs: totalLatencyMs
        });
    }

    // 6. Asynchronously store in Redis Cache (24-hour TTL)
    if (responseText && responseText.length > 10) {
        const cachePayload = {
            response: responseText,
            agent: chosenAgent,
            images,
            artifact,
            url: downloadUrl,
            ragSources,
            cachedAt: new Date().toISOString()
        };
        setCache(cacheKey, cachePayload, 86400).catch(err => {
            console.warn('⚠️ Redis cache write warning:', err.message);
        });
    }

    return {
        response: responseText,
        agent: chosenAgent,
        images,
        artifact,
        url: downloadUrl,
        conversationId,
        remainingCredits: deductionResult?.remainingCredits,
        ragSources,
        cached: false,
        latencyMs: totalLatencyMs
    };
};

export default executeAgentWorkflow;

