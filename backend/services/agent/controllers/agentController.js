import { executeAgentWorkflow } from "../services/agentExecutionService.js";

/**
 * Standard Synchronous HTTP Endpoint (/run)
 */
export const handleRun = async (req, res, next) => {
    try {
        const { message, prompt, agent = 'auto', agentType, threadId, conversationId, userId: bodyUserId } = req.body;
        const userPrompt = prompt || message;

        if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
            return res.status(400).json({ error: "Prompt or message is required and must be a non-empty string." });
        }

        const resolvedUserId = req.headers['x-user-id'] || bodyUserId || req.user?.userId || '';
        const resolvedConvId = conversationId || threadId || 'default';
        const resolvedAgent = agentType || agent || 'auto';

        const result = await executeAgentWorkflow({
            prompt: userPrompt.trim(),
            agent: resolvedAgent,
            conversationId: resolvedConvId,
            userId: resolvedUserId
        });

        res.status(200).json({
            success: true,
            result: result.response,
            response: result.response,
            agent: result.agent,
            type: result.agent,
            images: result.images || [],
            url: result.url || null,
            artifact: result.artifact || null,
            conversationId: result.conversationId,
            remainingCredits: result.remainingCredits,
            ragSources: result.ragSources || [],
            cached: result.cached || false,
            latencyMs: result.latencyMs || null
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Server-Sent Events (SSE) Streaming Endpoint (/stream)
 * Streams: "Thinking -> Reasoning -> Generating" status transitions, then final chunk.
 */
export const handleStream = async (req, res, next) => {
    try {
        const prompt = req.body?.prompt || req.body?.message || req.query?.prompt || req.query?.message;
        const agent = req.body?.agent || req.body?.agentType || req.query?.agent || req.query?.agentType || 'auto';
        const conversationId = req.body?.conversationId || req.body?.threadId || req.query?.conversationId || req.query?.threadId || 'default';
        const userId = req.headers['x-user-id'] || req.body?.userId || req.query?.userId || '';

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({ error: "Prompt is required for streaming." });
        }

        // Set SSE Headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();

        const sendEvent = (event, data) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        const result = await executeAgentWorkflow({
            prompt: prompt.trim(),
            agent,
            conversationId,
            userId,
            onStatusUpdate: (status, details = {}) => {
                // Emits: Thinking -> Reasoning -> Generating
                sendEvent('status', {
                    status,
                    ...details,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Emit final result event
        sendEvent('result', {
            response: result.response,
            agent: result.agent,
            images: result.images || [],
            url: result.url || null,
            artifact: result.artifact || null,
            remainingCredits: result.remainingCredits,
            ragSources: result.ragSources || [],
            cached: result.cached || false,
            latencyMs: result.latencyMs || null
        });

        // Emit done event
        sendEvent('done', { success: true });
        res.end();
    } catch (err) {
        console.error('❌ SSE Stream Error:', err.message);
        if (!res.headersSent) {
            next(err);
        } else {
            res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }
    }
};

