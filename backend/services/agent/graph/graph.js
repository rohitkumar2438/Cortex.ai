import { StateGraph, START, END } from "@langchain/langgraph";
import { runChatAgent } from "../agents/chat.agent.js";
import { runSearchAgent } from "../agents/search.agent.js";
import { runCodingAgent } from "../agents/coding.agent.js";
import { runImageAnalyzerAgent } from "../agents/imageAnalyzer.agent.js";
import { runVisionGenerateAgent } from "../agents/visionGenerate.agent.js";
import { runPdfRagAgent } from "../agents/pdfRag.agent.js";
import { runPdfGenerateAgent } from "../agents/pdfGenerate.agent.js";
import { runPptGenerateAgent } from "../agents/pptGenerate.agent.js";

// Define the State Channels
const AgentState = {
    prompt: { value: (x, y) => y ?? x, default: () => "" },
    agentType: { value: (x, y) => y ?? x, default: () => "chat" },
    conversationId: { value: (x, y) => y ?? x, default: () => "default" },
    userId: { value: (x, y) => y ?? x, default: () => "" },
    file: { value: (x, y) => y ?? x, default: () => null },
    aiResponse: { value: (x, y) => y ?? x, default: () => "" },
    artifacts: { value: (x, y) => y ?? x, default: () => null },
    url: { value: (x, y) => y ?? x, default: () => null },
    sources: { value: (x, y) => y ?? x, default: () => null }
};

// 1. Router / Intent Node
const routerNode = async (state) => {
    let target = state.agentType || "chat";

    // Auto-detect if a file is attached
    if (state.file) {
        if (state.file.mimetype?.startsWith("image/")) {
            target = "imageAnalyzer";
        } else if (
            state.file.mimetype === "application/pdf" || 
            state.file.originalname?.endsWith(".pdf") || 
            state.file.originalname?.endsWith(".txt") || 
            state.file.originalname?.endsWith(".md")
        ) {
            target = "pdfRag";
        }
    }

    // Auto-detect intent if user requested file generation explicitly in prompt
    const p = state.prompt.toLowerCase();
    if (target === 'chat') {
        if (/generate (a )?pdf|make (a )?pdf|export (to )?pdf/i.test(p)) target = "pdfGenerate";
        else if (/generate (a )?ppt|make (a )?presentation|powerpoint|slides/i.test(p)) target = "pptGenerate";
        else if (/generate (an )?image|draw|paint|picture of/i.test(p)) target = "visionGenerate";
        else if (/write code|build an? (app|website|page|component)|html.*css/i.test(p)) target = "coding";
    }

    return { agentType: target };
};

// Routing condition
const routeCondition = (state) => {
    switch (state.agentType) {
        case 'search': return 'searchNode';
        case 'coding':
        case 'code': return 'codingNode';
        case 'imageAnalyzer':
        case 'vision': return 'imageAnalyzerNode';
        case 'image':
        case 'visionGenerate': return 'visionGenerateNode';
        case 'pdf':
        case 'pdfRag': return 'pdfRagNode';
        case 'pdfGenerate': return 'pdfGenerateNode';
        case 'ppt':
        case 'pptGenerate': return 'pptGenerateNode';
        default: return 'chatNode';
    }
};

// 2. Individual Agent Nodes
const chatNode = async (state) => {
    const res = await runChatAgent(state.prompt);
    return { aiResponse: res.result, agentType: 'chat' };
};

const searchNode = async (state) => {
    const res = await runSearchAgent(state.prompt);
    return { aiResponse: res.result, agentType: 'search' };
};

const codingNode = async (state) => {
    const res = await runCodingAgent(state.prompt);
    return { 
        aiResponse: res.result, 
        artifacts: res.artifacts,
        agentType: 'code' 
    };
};

const imageAnalyzerNode = async (state) => {
    const imageInput = state.file?.path || state.prompt;
    const res = await runImageAnalyzerAgent(state.prompt, imageInput);
    return { aiResponse: res.result, agentType: 'imageAnalyzer' };
};

const visionGenerateNode = async (state) => {
    const res = await runVisionGenerateAgent(state.prompt);
    return { aiResponse: res.result, url: res.url, agentType: 'image' };
};

const pdfRagNode = async (state) => {
    const res = await runPdfRagAgent(state.prompt, {
        userId: state.userId || 'default',
        file: state.file
    });
    return { 
        aiResponse: res.result, 
        sources: res.sources || null,
        agentType: 'pdf' 
    };
};

const pdfGenerateNode = async (state) => {
    const res = await runPdfGenerateAgent(state.prompt);
    return { aiResponse: res.result, url: res.url, agentType: 'pdf' };
};

const pptGenerateNode = async (state) => {
    const res = await runPptGenerateAgent(state.prompt);
    return { aiResponse: res.result, url: res.url, agentType: 'ppt' };
};

// 3. Construct Graph
export const createMultiAgentGraph = () => {
    const graph = new StateGraph({ channels: AgentState })
        .addNode("router", routerNode)
        .addNode("chatNode", chatNode)
        .addNode("searchNode", searchNode)
        .addNode("codingNode", codingNode)
        .addNode("imageAnalyzerNode", imageAnalyzerNode)
        .addNode("visionGenerateNode", visionGenerateNode)
        .addNode("pdfRagNode", pdfRagNode)
        .addNode("pdfGenerateNode", pdfGenerateNode)
        .addNode("pptGenerateNode", pptGenerateNode)
        .addEdge(START, "router")
        .addConditionalEdges("router", routeCondition, {
            chatNode: "chatNode",
            searchNode: "searchNode",
            codingNode: "codingNode",
            imageAnalyzerNode: "imageAnalyzerNode",
            visionGenerateNode: "visionGenerateNode",
            pdfRagNode: "pdfRagNode",
            pdfGenerateNode: "pdfGenerateNode",
            pptGenerateNode: "pptGenerateNode",
        })
        .addEdge("chatNode", END)
        .addEdge("searchNode", END)
        .addEdge("codingNode", END)
        .addEdge("imageAnalyzerNode", END)
        .addEdge("visionGenerateNode", END)
        .addEdge("pdfRagNode", END)
        .addEdge("pdfGenerateNode", END)
        .addEdge("pptGenerateNode", END);

    return graph.compile();
};

export const agentApp = createMultiAgentGraph();
