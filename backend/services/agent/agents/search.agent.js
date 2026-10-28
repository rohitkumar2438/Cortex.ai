import { getModel } from '../config/llmModels.js';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export const runSearchAgent = async (prompt) => {
    const tavilyKey = process.env.TAVILY_API_KEY;
    let searchResults = [];
    let searchImages = [];

    if (tavilyKey && !tavilyKey.includes('your_')) {
        try {
            const response = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: tavilyKey,
                    query: prompt,
                    search_depth: "basic",
                    include_images: true,
                    max_results: 5
                })
            });
            const data = await response.json();
            searchResults = data.results || [];
            searchImages = data.images || [];
        } catch (err) {
            console.warn('⚠️ Tavily search error:', err.message);
        }
    }

    // Fallback if no search results returned
    let context = "";
    if (searchResults.length > 0) {
        context = searchResults.map(r => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join("\n\n---\n\n");
    } else {
        context = `No direct Tavily live results available. Answer based on current verified knowledge for: "${prompt}".`;
    }

    const model = getModel('search');
    const systemPrompt = new SystemMessage(
        `You are Cortex AI's Search Agent. Analyze the web search results provided and answer the user's question clearly. Cite source URLs when available.\n\nWeb Search Results:\n${context}`
    );

    const response = await model.invoke([
        systemPrompt,
        new HumanMessage(prompt)
    ]);

    let output = response.content;

    // Append images if available
    if (searchImages.length > 0) {
        output += "\n\n### Related Visuals\n" + searchImages.slice(0, 3).map(img => `![Result Image](${img})`).join(" ");
    }

    return {
        result: output,
        type: 'search'
    };
};
