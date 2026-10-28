import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";

/**
 * Search Agent: Powered by Tavily search API and Groq synthesis.
 * Returns: synthesized Markdown answer + source links + array of image URLs.
 */
export const runSearchAgent = async (prompt) => {
    const tavilyKey = process.env.TAVILY_API_KEY;
    let searchResults = [];
    let searchImages = [];

    if (tavilyKey && !tavilyKey.includes('your_')) {
        try {
            const res = await fetch("https://api.tavily.com/search", {
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

            if (res.ok) {
                const data = await res.json();
                searchResults = data.results || [];
                searchImages = (data.images || []).filter(img => typeof img === 'string' && img.startsWith('http'));
            } else {
                console.warn(`⚠️ Tavily search responded with status ${res.status}`);
            }
        } catch (err) {
            console.warn('⚠️ Tavily search network error:', err.message);
        }
    }

    // Prepare search context and references
    let searchContext = "";
    let sourceCitations = "";

    if (searchResults.length > 0) {
        searchContext = searchResults
            .map((r, i) => `[Source ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`)
            .join("\n\n---\n\n");

        sourceCitations = "\n\n### Sources\n" + searchResults
            .map((r, i) => `${i + 1}. [${r.title}](${r.url})`)
            .join("\n");
    } else {
        searchContext = `No external live search engine configured or reachable. Synthesize the best verified answer based on current information for: "${prompt}".`;
    }

    const model = getModel('search');
    const systemPrompt = new SystemMessage(
        `You are Cortex AI, an advanced real-time Search and Discovery Agent.
Analyze the live web search results below and write a comprehensive, factual, and well-structured answer in GitHub-style Markdown.
Always reference the relevant sources accurately and maintain an objective, informative tone.

Web Search Results:
${searchContext}`
    );

    try {
        const response = await model.invoke([
            systemPrompt,
            new HumanMessage(prompt)
        ]);

        let finalAnswer = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

        // Append source links if not already integrated
        if (sourceCitations && !finalAnswer.includes('### Sources')) {
            finalAnswer += sourceCitations;
        }

        return {
            response: finalAnswer,
            agent: 'search',
            images: searchImages, // Persistent image URLs
            artifact: null
        };
    } catch (err) {
        console.error('❌ Search Agent Execution Error:', err.message);
        throw err;
    }
};

export default runSearchAgent;
