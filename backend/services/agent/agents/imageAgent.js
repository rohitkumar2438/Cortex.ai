import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";
import { storeFileAndGetUrl } from "../utils/storageService.js";

/**
 * Image Generation Agent:
 * 1. Enhances textual brief using LLM into descriptive visual prompt.
 * 2. Generates image using free Pollinations model.
 * 3. Saves image via S3-ready storage abstraction and returns persistent image URLs.
 */
export const runImageAgent = async (prompt) => {
    // 1. LLM enhances user prompt for photorealistic / artistic composition
    let enhancedPrompt = prompt;
    try {
        const model = getModel('chat');
        const enhanceMsg = await model.invoke([
            new SystemMessage(
                "You are an expert prompt engineer for AI image generators. Expand the user's brief prompt into a vivid, descriptive prompt (1-2 sentences) detailing art style, lighting, color palette, atmosphere, and composition. Return ONLY the enhanced prompt without quotes."
            ),
            new HumanMessage(prompt)
        ]);

        const content = typeof enhanceMsg.content === 'string' ? enhanceMsg.content : '';
        if (content && content.trim().length > 0) {
            enhancedPrompt = content.trim().replace(/^["']|["']$/g, '');
        }
    } catch (err) {
        console.warn('⚠️ Prompt enhancement warning (using raw prompt):', err.message);
    }

    // 2. Fetch image from free Pollinations generator
    const encodedPrompt = encodeURIComponent(enhancedPrompt);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true`;

    let finalImageUrl = pollinationsUrl;
    let localDownloadUrl = pollinationsUrl;

    try {
        const fetchRes = await fetch(pollinationsUrl);
        if (fetchRes.ok) {
            const arrayBuffer = await fetchRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // 3. Store via S3-ready storage abstraction
            const storageResult = await storeFileAndGetUrl(buffer, 'generated-art.jpg', 'image/jpeg');
            finalImageUrl = storageResult.url;
            localDownloadUrl = storageResult.url;
        }
    } catch (fetchErr) {
        console.warn('⚠️ Could not store image locally, utilizing direct provider URL:', fetchErr.message);
    }

    return {
        response: `### 🎨 Image Generated Successfully\n\n**Visual Prompt:**\n*"${enhancedPrompt}"*\n\n![Generated Art](${finalImageUrl})\n\n👉 **[Download Full Resolution Image](${localDownloadUrl})**`,
        agent: 'image',
        images: [finalImageUrl], // Persistent image URL in Message model
        url: localDownloadUrl,
        artifact: null
    };
};

export default runImageAgent;

