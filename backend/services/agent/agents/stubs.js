/**
 * Agent Stubs for Phase 3 (coding, pdf, ppt, image).
 * Will be fully implemented in Phase 5 and Phase 6.
 */

export const runCodingAgentStub = async (prompt) => {
    return {
        response: `### 💻 Coding Agent (Preview)\n\nThe Coding Agent will be fully enabled in **Phase 5** with DeepSeek model integration, live sandboxed code previews, and artifact generation.\n\n*Prompt received:* "${prompt}"`,
        agent: 'coding',
        images: [],
        artifact: null
    };
};

export const runPdfAgentStub = async (prompt) => {
    return {
        response: `### 📄 PDF Document Agent (Preview)\n\nThe PDF Agent will be fully enabled in **Phase 6** with PDFKit generation and S3 storage.\n\n*Drafting for prompt:* "${prompt}"`,
        agent: 'pdf',
        images: [],
        artifact: null
    };
};

export const runPptAgentStub = async (prompt) => {
    return {
        response: `### 📊 Presentation Agent (Preview)\n\nThe PPT Agent will be fully enabled in **Phase 6** with PptxGenJS presentation compilation.\n\n*Deck topic:* "${prompt}"`,
        agent: 'ppt',
        images: [],
        artifact: null
    };
};

export const runImageAgentStub = async (prompt) => {
    return {
        response: `### 🎨 Image Generation Agent (Preview)\n\nThe Image Generation Agent will be fully enabled in **Phase 6** with image generation models.\n\n*Image description:* "${prompt}"`,
        agent: 'image',
        images: [],
        artifact: null
    };
};

