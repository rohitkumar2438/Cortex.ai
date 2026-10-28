import { StateGraph, START, END } from "@langchain/langgraph";
import { agentStateChannels } from "./agentState.js";
import { routerNode } from "./routerNode.js";
import { runChatAgent } from "../agents/chatAgent.js";
import { runSearchAgent } from "../agents/searchAgent.js";
import {
    runCodingAgentStub,
    runPdfAgentStub,
    runPptAgentStub,
    runImageAgentStub
} from "../agents/stubs.js";

// 1. Agent Execution Nodes
const chatNode = async (state) => {
    const result = await runChatAgent(state.prompt, state.messages);
    return {
        response: result.response,
        agent: 'chat',
        images: result.images || [],
        artifact: result.artifact || null
    };
};

const searchNode = async (state) => {
    const result = await runSearchAgent(state.prompt);
    return {
        response: result.response,
        agent: 'search',
        images: result.images || [],
        artifact: result.artifact || null
    };
};

const codingNode = async (state) => {
    const result = await runCodingAgentStub(state.prompt);
    return {
        response: result.response,
        agent: 'coding',
        images: result.images || [],
        artifact: result.artifact || null
    };
};

const pdfNode = async (state) => {
    const result = await runPdfAgentStub(state.prompt);
    return {
        response: result.response,
        agent: 'pdf',
        images: result.images || [],
        artifact: result.artifact || null
    };
};

const pptNode = async (state) => {
    const result = await runPptAgentStub(state.prompt);
    return {
        response: result.response,
        agent: 'ppt',
        images: result.images || [],
        artifact: result.artifact || null
    };
};

const imageNode = async (state) => {
    const result = await runImageAgentStub(state.prompt);
    return {
        response: result.response,
        agent: 'image',
        images: result.images || [],
        artifact: result.artifact || null
    };
};

// 2. Conditional Edge Selector
const selectAgentNode = (state) => {
    switch (state.agent) {
        case 'search':
            return 'searchNode';
        case 'coding':
            return 'codingNode';
        case 'pdf':
            return 'pdfNode';
        case 'ppt':
            return 'pptNode';
        case 'image':
            return 'imageNode';
        case 'chat':
        default:
            return 'chatNode';
    }
};

// 3. Compile the LangGraph
export const createMultiAgentGraph = () => {
    const workflow = new StateGraph({ channels: agentStateChannels })
        .addNode("router", routerNode)
        .addNode("chatNode", chatNode)
        .addNode("searchNode", searchNode)
        .addNode("codingNode", codingNode)
        .addNode("pdfNode", pdfNode)
        .addNode("pptNode", pptNode)
        .addNode("imageNode", imageNode)
        .addEdge(START, "router")
        .addConditionalEdges("router", selectAgentNode, {
            chatNode: "chatNode",
            searchNode: "searchNode",
            codingNode: "codingNode",
            pdfNode: "pdfNode",
            pptNode: "pptNode",
            imageNode: "imageNode"
        })
        .addEdge("chatNode", END)
        .addEdge("searchNode", END)
        .addEdge("codingNode", END)
        .addEdge("pdfNode", END)
        .addEdge("pptNode", END)
        .addEdge("imageNode", END);

    return workflow.compile();
};

export const multiAgentGraph = createMultiAgentGraph();
export default multiAgentGraph;
