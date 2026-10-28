import { getModel } from '../config/llmModels.js';
import { uploadToS3 } from '../utils/s3.js';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export const runVisionGenerateAgent = async (prompt) => {
    // 1. Enhance the prompt with LLM for richer visual quality
    let enhancedPrompt = prompt;
    try {
        const model = getModel('chat');
        const enhanceMsg = await model.invoke([
            new SystemMessage("You are an expert prompt engineer for AI image generators. Expand the user's brief prompt into a vivid, descriptive prompt (1-2 sentences) detailing style, lighting, composition, and high quality. Return ONLY the enhanced prompt."),
            new HumanMessage(prompt)
        ]);
        if (enhanceMsg.content) {
            enhancedPrompt = enhanceMsg.content.trim().replace(/^["']|["']$/g, '');
        }
    } catch (e) {
        // use raw prompt if enhancement fails
    }

    // 2. Generate Image using Pollinations free endpoint (reliable, high quality, no API key required)
    const encoded = encodeURIComponent(enhancedPrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true`;

    try {
        const fetchRes = await fetch(imageUrl);
        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 3. Upload to S3 (or base64 fallback)
        const s3Url = await uploadToS3(buffer, 'generated-image.jpg', 'image/jpeg');

        return {
            result: `Here is the image generated from your prompt:\n\n*"${enhancedPrompt}"*\n\n![Generated Image](${s3Url})`,
            type: 'image',
            url: s3Url
        };
    } catch (err) {
        console.error('Image generation error:', err.message);
        // Fallback to direct URL
        return {
            result: `Here is your generated image:\n\n![Generated Image](${imageUrl})`,
            type: 'image',
            url: imageUrl
        };
    }
};
