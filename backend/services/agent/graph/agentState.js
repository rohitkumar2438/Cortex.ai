/**
 * LangGraph Agent State definition for Cortex AI.
 * Contains: messages, prompt, agent, response, images, artifact.
 */
export const agentStateChannels = {
    // History of messages in the current thread
    messages: {
        value: (prev, next) => (next !== undefined ? next : prev),
        default: () => []
    },
    // Raw user prompt
    prompt: {
        value: (prev, next) => (next !== undefined ? next : prev),
        default: () => ""
    },
    // Chosen agent type: chat, search, coding, pdf, ppt, image
    agent: {
        value: (prev, next) => (next !== undefined ? next : prev),
        default: () => "chat"
    },
    // AI generated textual response
    response: {
        value: (prev, next) => (next !== undefined ? next : prev),
        default: () => ""
    },
    // Array of persistent image URLs
    images: {
        value: (prev, next) => (next !== undefined ? next : prev),
        default: () => []
    },
    // Structured artifact optional { files, language, preview }
    artifact: {
        value: (prev, next) => (next !== undefined ? next : prev),
        default: () => null
    },
    // Thread metadata
    conversationId: {
        value: (prev, next) => (next !== undefined ? next : prev),
        default: () => "default"
    },
    userId: {
        value: (prev, next) => (next !== undefined ? next : prev),
        default: () => ""
    }
};

export default agentStateChannels;
