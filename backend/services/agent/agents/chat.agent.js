import { getModel } from '../config/llmModels.js';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export const runChatAgent = async (prompt, history = []) => {
    const model = getModel('chat');
    const systemPrompt = new SystemMessage(
        "You are Cortex AI, an intelligent, multi-agent AI assistant. Provide helpful, accurate, and concise answers."
    );

    const messages = [
        systemPrompt,
        ...history.map(m => new HumanMessage(m.content || m)),
        new HumanMessage(prompt)
    ];

    const response = await model.invoke(messages);
    return {
        result: response.content,
        type: 'chat'
    };
};
