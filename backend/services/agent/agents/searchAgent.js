import https from 'https';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";

/**
 * Executes Tavily Search API with IPv4 forced (avoids Docker/WSL2 NAT64 IPv6 connection timeouts).
 */
const callTavilySearch = (apiKey, query) => new Promise((resolve) => {
    const postData = JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_images: true,
        max_results: 5
    });

    const req = https.request({
        hostname: 'api.tavily.com',
        port: 443,
        path: '/search',
        method: 'POST',
        family: 4, // Force IPv4 for reliable connectivity in Docker containers
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, (res) => {
        let buffer = '';
        res.on('data', chunk => { buffer += chunk; });
        res.on('end', () => {
            try {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const parsed = JSON.parse(buffer);
                    console.log(`🌐 Tavily Search API Success: retrieved ${parsed.results?.length || 0} web results.`);
                    resolve({
                        results: parsed.results || [],
                        images: (parsed.images || []).filter(img => typeof img === 'string' && img.startsWith('http'))
                    });
                } else {
                    console.warn(`⚠️ Tavily API returned HTTP ${res.statusCode}:`, buffer.substring(0, 150));
                    resolve({ results: [], images: [] });
                }
            } catch (err) {
                console.warn('⚠️ Tavily JSON parse error:', err.message);
                resolve({ results: [], images: [] });
            }
        });
    });

    req.on('error', (err) => {
        console.warn('⚠️ Tavily network error:', err.message);
        resolve({ results: [], images: [] });
    });

    req.setTimeout(12000, () => {
        console.warn('⚠️ Tavily request timed out after 12s');
        req.destroy();
        resolve({ results: [], images: [] });
    });

    req.write(postData);
    req.end();
});

/**
 * Search Agent: Powered by Tavily search API and Groq synthesis.
 * Returns: synthesized Markdown answer + source links + array of image URLs.
 */
export const runSearchAgent = async (prompt) => {
    const tavilyKey = process.env.TAVILY_API_KEY;
    let searchResults = [];
    let searchImages = [];

    if (tavilyKey && !tavilyKey.includes('your_')) {
        const tavilyData = await callTavilySearch(tavilyKey, prompt);
        searchResults = tavilyData.results || [];
        searchImages = tavilyData.images || [];
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

