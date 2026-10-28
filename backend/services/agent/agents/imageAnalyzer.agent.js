import { getModel } from '../config/llmModels.js';
import { HumanMessage } from "@langchain/core/messages";
import fs from 'fs';

export const runImageAnalyzerAgent = async (prompt, imagePathOrBuffer) => {
    let base64Data = "";
    let mimeType = "image/jpeg";

    if (typeof imagePathOrBuffer === 'string') {
        if (imagePathOrBuffer.startsWith('data:')) {
            const parts = imagePathOrBuffer.split(',');
            mimeType = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
            base64Data = parts[1];
        } else if (fs.existsSync(imagePathOrBuffer)) {
            const buf = fs.readFileSync(imagePathOrBuffer);
            base64Data = buf.toString('base64');
            if (imagePathOrBuffer.endsWith('.png')) mimeType = 'image/png';
            if (imagePathOrBuffer.endsWith('.webp')) mimeType = 'image/webp';
        }
    } else if (Buffer.isBuffer(imagePathOrBuffer)) {
        base64Data = imagePathOrBuffer.toString('base64');
    }

    const model = getModel('imageAnalyzer');

    const message = new HumanMessage({
        content: [
            {
                type: "text",
                text: prompt || "Analyze this image in detail and describe its key elements, context, and any visible text."
            },
            ...(base64Data ? [{
                type: "image_url",
                image_url: `data:${mimeType};base64,${base64Data}`
            }] : [])
        ]
    });

    try {
        const response = await model.invoke([message]);
        return {
            result: response.content,
            type: 'imageAnalyzer'
        };
    } catch (err) {
        console.error('Vision analysis error:', err.message);
        return {
            result: `Unable to analyze image directly. Error: ${err.message}`,
            type: 'imageAnalyzer'
        };
    }
};
