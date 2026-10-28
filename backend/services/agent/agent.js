import 'dotenv/config';
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { getVectorStore } from "./store.js";

// 1. Define Tools (Mock web search for now)
const webSearchTool = tool(
  async ({ query }) => {
    return `Results for ${query}: This is a mock search result! LangGraph decided to use the web search tool to find this information.`;
  },
  {
    name: "web_search",
    description: "Use this to search the web for current information.",
    schema: z.object({
      query: z.string().describe("The search query"),
    }),
  }
);

const documentRetrieverTool = tool(
  async ({ query }) => {
    const vectorStore = getVectorStore();
    if (!vectorStore) {
        return "I'm sorry, but the document retrieval system is currently offline. Please configure GEMINI_API_KEY.";
    }
    
    // Perform similarity search
    const results = await vectorStore.similaritySearch(query, 3);
    
    if (results.length === 0) {
        return "No relevant information found in the uploaded documents.";
    }
    
    return results.map(doc => doc.pageContent).join("\n\n---\n\n");
  },
  {
    name: "document_retriever",
    description: "Use this to search through custom documents that the user has uploaded. Always use this if the user asks a question about their document.",
    schema: z.object({
      query: z.string().describe("The search query to look up in the documents"),
    }),
  }
);

const tools = [webSearchTool, documentRetrieverTool];
const toolNode = new ToolNode(tools);

// 2. Define State
const AgentState = {
  messages: {
    value: (x, y) => x.concat(y),
    default: () => [],
  },
};

// 3. Define LLM Model (Using Groq)
// The API Key will automatically be pulled from process.env.GROQ_API_KEY
const model = new ChatGroq({
  model: "qwen/qwen3.8-27b", // Model supported by this specific API key
  temperature: 0.7,
});

// Bind tools to the model so the LLM knows it can call them
const modelWithTools = model.bindTools(tools);

// 4. Define Graph Nodes
const callModel = async (state) => {
  const { messages } = state;
  const systemMessage = new SystemMessage("You are Cortex AI, a helpful multi-agent assistant. You can use tools to answer questions.");
  
  const response = await modelWithTools.invoke([systemMessage, ...messages]);
  return { messages: [response] };
};

const shouldContinue = (state) => {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }
  return END;
};

// 5. Build the Graph
const workflow = new StateGraph({ channels: AgentState })
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue, {
    tools: "tools",
    [END]: END,
  })
  .addEdge("tools", "agent");

// Compile graph with memory checkpointing (in-memory for this simple case)
const checkpointer = new MemorySaver();
export const app = workflow.compile({ checkpointer });
