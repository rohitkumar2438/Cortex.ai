import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";

/**
 * Parses files and builds a sandboxed preview HTML from LLM output.
 * Supports XML <cortexArtifact>, markdown code fences, and raw HTML.
 */
export const parseCodeArtifact = (rawText) => {
    const files = [];
    let primaryLanguage = 'javascript';

    // 1. Tag protocol: <cortexArtifact> <cortexFile name="...">content</cortexFile> </cortexArtifact>
    const fileRegex = /<cortexFile[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/cortexFile>/gi;
    let match;
    while ((match = fileRegex.exec(rawText)) !== null) {
        const name = match[1].trim();
        const content = match[2].trim();
        const ext = name.split('.').pop().toLowerCase();
        const language = ext === 'js' ? 'javascript' : ext === 'css' ? 'css' : ext === 'html' ? 'html' : ext;
        files.push({ name, content, language });
    }

    // 2. Fenced codeblocks with filename attribute: ```html filename="index.html"
    if (files.length === 0) {
        const attrRegex = /```(\w+)?\s*(?:filename|file)=["']?([^"'\s\n]+)["']?\n([\s\S]*?)```/gi;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(rawText)) !== null) {
            const lang = (attrMatch[1] || 'javascript').toLowerCase();
            const name = attrMatch[2].trim();
            files.push({
                name,
                content: attrMatch[3].trim(),
                language: lang
            });
        }
    }

    // 3. Fenced codeblocks preceded by header: ### index.html \n ```html
    if (files.length === 0) {
        const headerRegex = /(?:###|####|##|\*\*)\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)\s*\n\s*```(\w+)?\n([\s\S]*?)```/gi;
        let headerMatch;
        while ((headerMatch = headerRegex.exec(rawText)) !== null) {
            const name = headerMatch[1].trim();
            const lang = (headerMatch[2] || name.split('.').pop()).toLowerCase();
            files.push({
                name,
                content: headerMatch[3].trim(),
                language: lang === 'js' ? 'javascript' : lang
            });
        }
    }

    // 4. Raw HTML fallback
    if (files.length === 0 && (rawText.includes("<!DOCTYPE html>") || rawText.includes("<html"))) {
        const htmlStart = rawText.indexOf("<!DOCTYPE html>") !== -1 ? rawText.indexOf("<!DOCTYPE html>") : rawText.indexOf("<html");
        const htmlEnd = rawText.lastIndexOf("</html>") !== -1 ? rawText.lastIndexOf("</html>") + 7 : rawText.length;
        const htmlContent = rawText.substring(htmlStart, htmlEnd).trim();
        files.push({
            name: "index.html",
            content: htmlContent,
            language: "html"
        });
    }

    // 5. Generic code blocks fallback
    if (files.length === 0) {
        const genericBlocks = [...rawText.matchAll(/```(\w+)?\n([\s\S]*?)```/g)];
        if (genericBlocks.length > 0) {
            genericBlocks.forEach((b, i) => {
                const lang = (b[1] || 'javascript').toLowerCase();
                let name = `file${i + 1}.${lang === 'html' ? 'html' : lang === 'css' ? 'css' : lang === 'javascript' || lang === 'js' ? 'js' : 'txt'}`;
                files.push({
                    name,
                    content: b[2].trim(),
                    language: lang
                });
            });
        }
    }

    // Assemble Live Preview HTML for sandboxed iframe
    let preview = '';
    const htmlFile = files.find(f => f.name.endsWith('.html') || f.language === 'html')?.content || '';
    const cssFile = files.find(f => f.name.endsWith('.css') || f.language === 'css')?.content || '';
    const jsFile = files.find(f => f.name.endsWith('.js') || f.language === 'javascript')?.content || '';

    if (htmlFile) {
        if (htmlFile.includes('<!DOCTYPE html>') || htmlFile.includes('<html')) {
            // Inject CSS and JS into HTML
            preview = htmlFile;
            if (cssFile && !preview.includes(cssFile)) {
                preview = preview.replace('</head>', `<style>\n${cssFile}\n</style></head>`);
            }
            if (jsFile && !preview.includes(jsFile)) {
                preview = preview.replace('</body>', `<script>\n${jsFile}\n</script></body>`);
            }
        } else {
            preview = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cortex Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, sans-serif; }
    ${cssFile}
  </style>
</head>
<body class="bg-slate-950 text-slate-100 p-4">
  ${htmlFile}
  <script>
    ${jsFile}
  </script>
</body>
</html>`;
        }
    }

    if (files.length > 0) {
        primaryLanguage = files[0].language || 'javascript';
    }

    return {
        files,
        language: primaryLanguage,
        preview
    };
};

/**
 * Coding Agent: Generates, debugs, reviews, and explains code using DeepSeek (via getModel).
 * Returns structured output { files[], language, preview }.
 */
export const runCodingAgent = async (prompt, history = []) => {
    const model = getModel('coding');

    const isExplanatory = /^(how|why|explain|what is|review|analyze)/i.test(prompt.trim()) &&
                         !/build|create|generate|make|write code|develop|implement|fix/i.test(prompt);

    const systemPrompt = new SystemMessage(
        `You are Cortex AI's expert Senior Software Engineer and UI/UX Architect powered by DeepSeek.
You excel at:
1. Generating modern, complete, and production-ready applications with React, Tailwind CSS, HTML5, and JavaScript.
2. Debugging and diagnosing complex bugs with precise solutions.
3. Conducting code reviews, explaining algorithms, and recommending architectural patterns.

CRITICAL INSTRUCTIONS FOR ARTIFACT GENERATION:
When asked to write, create, build, or implement code, output ALL project files enclosed in <cortexArtifact> tags:
<cortexArtifact title="Application Title" summary="Short description">
<cortexFile name="index.html">
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <!-- Interactive markup -->
  <script src="app.js"></script>
</body>
</html>
</cortexFile>
<cortexFile name="style.css">
/* Modern styling and animations */
</cortexFile>
<cortexFile name="app.js">
// Complete, working JavaScript logic
</cortexFile>
</cortexArtifact>

If asked to explain, review, or debug without writing a full application, provide a clear explanation with standard Markdown code blocks.`
    );

    const response = await model.invoke([
        systemPrompt,
        new HumanMessage(prompt)
    ]);

    const rawContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    const artifactData = parseCodeArtifact(rawContent);

    const hasArtifact = artifactData && artifactData.files && artifactData.files.length > 0;

    let explanationText = rawContent;
    if (hasArtifact) {
        // Strip the raw XML tag block from the displayed chat response for a clean summary
        explanationText = rawContent
            .replace(/<cortexArtifact[\s\S]*?<\/cortexArtifact>/gi, '')
            .trim();

        if (!explanationText) {
            explanationText = `### ⚡ Project Generated Successfully\n\nI have created **${artifactData.files.length} files** for this project:\n${artifactData.files.map(f => `- \`${f.name}\` (${f.language})`).join('\n')}\n\n👉 **Click "Open Artifact Panel" to test the live preview, edit code, or copy files.**`;
        }
    }

    return {
        response: explanationText,
        agent: 'coding',
        images: [],
        artifact: hasArtifact ? {
            files: artifactData.files,
            language: artifactData.language,
            preview: artifactData.preview
        } : null
    };
};

export default runCodingAgent;

