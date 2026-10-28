import { getModel } from '../config/llmModels.js';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

/**
 * Resilient multi-strategy artifact extractor:
 * 1. XML <cortexArtifact> <cortexFile> tags
 * 2. Markdown fenced code blocks with filename metadata
 * 3. Structured JSON
 * 4. Raw HTML document fallback
 */
export const extractArtifactFiles = (rawText) => {
    let files = [];
    let summary = "";

    // Strategy 1: XML tag protocol (<cortexArtifact title="..."> <cortexFile name="...">)
    const artifactMatch = rawText.match(/<cortexArtifact[^>]*title=["']([^"']*)["'][^>]*summary=["']([^"']*)["'][\s\S]*?>([\s\S]*?)<\/cortexArtifact>/i) ||
                          rawText.match(/<cortexArtifact[\s\S]*?>([\s\S]*?)<\/cortexArtifact>/i);

    if (artifactMatch) {
        summary = artifactMatch[2] || "Generated interactive application";
        const innerContent = artifactMatch[3] || artifactMatch[1];
        const fileRegex = /<cortexFile[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/cortexFile>/gi;
        let match;
        while ((match = fileRegex.exec(innerContent)) !== null) {
            files.push({
                name: match[1].trim(),
                content: match[2].trim()
            });
        }
        if (files.length > 0) return { files, summary };
    }

    // Strategy 2: Code blocks with filename attributes: ```html filename="index.html"
    const attrRegex = /```(\w+)?\s*(?:filename|file)=["']?([^"'\s\n]+)["']?\n([\s\S]*?)```/gi;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(rawText)) !== null) {
        files.push({
            name: attrMatch[2].trim(),
            content: attrMatch[3].trim()
        });
    }
    if (files.length > 0) {
        return { files, summary: "Generated multi-file project" };
    }

    // Strategy 3: Markdown headers before codeblocks: ### index.html \n ```html
    const headerRegex = /(?:###|####|##|\*\*)\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)\s*\n\s*```(\w+)?\n([\s\S]*?)```/gi;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(rawText)) !== null) {
        files.push({
            name: headerMatch[1].trim(),
            content: headerMatch[3].trim()
        });
    }
    if (files.length > 0) {
        return { files, summary: "Generated project files" };
    }

    // Strategy 4: Clean JSON object
    try {
        let jsonCandidate = rawText.trim();
        if (jsonCandidate.includes("```json")) {
            jsonCandidate = jsonCandidate.replace(/^[\s\S]*?```json\s*/, "").replace(/\s*```[\s\S]*$/, "");
        }
        const parsed = JSON.parse(jsonCandidate);
        if (parsed.files && Array.isArray(parsed.files) && parsed.files.length > 0) {
            return {
                files: parsed.files.map(f => ({ name: f.name || 'file.txt', content: f.content || '' })),
                summary: parsed.summary || "Generated application"
            };
        }
    } catch (e) {
        // Continue to fallback
    }

    // Strategy 5: Detect raw HTML document
    if (rawText.includes("<!DOCTYPE html>") || rawText.includes("<html")) {
        const htmlStart = rawText.indexOf("<!DOCTYPE html>") !== -1 ? rawText.indexOf("<!DOCTYPE html>") : rawText.indexOf("<html");
        const htmlEnd = rawText.lastIndexOf("</html>") !== -1 ? rawText.lastIndexOf("</html>") + 7 : rawText.length;
        const htmlContent = rawText.substring(htmlStart, htmlEnd).trim();
        return {
            files: [{ name: "index.html", content: htmlContent }],
            summary: "Single-page responsive web application"
        };
    }

    // Strategy 6: Generic fenced code blocks (index.html, style.css, script.js by extension)
    const genericBlocks = [...rawText.matchAll(/```(\w+)?\n([\s\S]*?)```/g)];
    if (genericBlocks.length > 0) {
        const mapped = genericBlocks.map((b, i) => {
            const lang = (b[1] || '').toLowerCase();
            let name = `file${i + 1}.txt`;
            if (lang === 'html') name = 'index.html';
            else if (lang === 'css') name = 'style.css';
            else if (lang === 'javascript' || lang === 'js') name = 'app.js';
            return { name, content: b[2].trim() };
        });
        return { files: mapped, summary: "Extracted code snippets" };
    }

    return null;
};

export const runCodingAgent = async (prompt) => {
    const model = getModel('coding');

    // Detect if this is an exploratory/debugging question vs. building software
    const isQuestionOnly = /^(how|why|explain|what is|tell me about|review)/i.test(prompt.trim()) && 
                           !/build|create|generate|make|write code|develop|implement|design/i.test(prompt);

    if (isQuestionOnly) {
        const response = await model.invoke([
            new SystemMessage("You are Cortex AI's senior software engineering expert. Provide clear, accurate code explanations, debugging advice, and architectural best practices using standard Markdown code blocks."),
            new HumanMessage(prompt)
        ]);
        return {
            result: response.content,
            type: 'code',
            artifacts: null
        };
    }

    const systemPrompt = new SystemMessage(
`You are Cortex AI's Elite Full-Stack Product Engineer and Lead UI/UX Designer.
Your task is to build modern, production-grade, state-of-the-art web applications that rival v0 by Vercel and Claude Artifacts.

### DESIGN & ARCHITECTURE STANDARDS:
1. **Modern Styling & Tailwind CSS**:
   - Use Tailwind CSS utility classes extensively for styling.
   - Curated color palettes: Dark mode slate/zinc surfaces (e.g. \`bg-slate-900\`, \`bg-slate-950\`, \`border-slate-800\`, \`text-slate-100\`) or crisp modern light mode with vibrant accent colors (indigo, violet, emerald, cyan).
   - Glassmorphism, smooth micro-interactions, subtle borders, card hover lift effects (\`transition-all duration-200 hover:-translate-y-0.5\`).
2. **Icons & Typography**:
   - Use Google Fonts (\`Inter\`).
   - Use Lucide Icons: Embed SVG icons or use \`<i data-lucide="icon-name"></i>\` tags.
3. **Full Interactivity (Zero Placeholders)**:
   - Provide COMPLETE, working JavaScript logic. Never write "// TODO: implement later" or placeholder logic.
   - Include realistic, diverse mock data (dates, names, metrics, charts, avatars).
   - Implement functional search filters, tab switching, interactive modal dialogs, status badges, and working event handlers.
4. **Project Structure**:
   - Provide complete files: \`index.html\`, \`style.css\` (optional custom animations/fonts), and \`app.js\` (interactive logic).

### STRICT OUTPUT FORMAT:
You MUST enclose all files within the <cortexArtifact> XML tag protocol. Do NOT output markdown backticks around the XML:

<cortexArtifact title="Application Title" summary="A concise description of the features built.">
<cortexFile name="index.html">
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Application Title</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>body { font-family: 'Inter', sans-serif; }</style>
  <link rel="stylesheet" href="style.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <!-- Complete, beautifully styled, interactive layout -->
  <script src="app.js"></script>
  <script>lucide.createIcons();</script>
</body>
</html>
</cortexFile>
<cortexFile name="style.css">
/* Custom CSS, animations, glassmorphism */
</cortexFile>
<cortexFile name="app.js">
// Complete interactive logic, state management, event listeners
</cortexFile>
</cortexArtifact>

Begin your response directly with the <cortexArtifact> block.`
    );

    const response = await model.invoke([
        systemPrompt,
        new HumanMessage(prompt)
    ]);

    const rawContent = response.content.trim();
    const parsedArtifact = extractArtifactFiles(rawContent);

    if (parsedArtifact && parsedArtifact.files.length > 0) {
        const fileNamesList = parsedArtifact.files.map(f => `• \`${f.name}\``).join("\n");
        const summaryText = parsedArtifact.summary || "Generated modern web application";

        return {
            result: `### ⚡ ${summaryText}\n\nHere are the generated project files:\n${fileNamesList}\n\n👉 **Click 'Open Artifact Workspace' to test the live interactive preview, switch devices, or inspect code.**`,
            type: 'code',
            artifacts: {
                type: 'project',
                title: parsedArtifact.summary,
                files: parsedArtifact.files
            }
        };
    }

    return {
        result: rawContent,
        type: 'code',
        artifacts: null
    };
};
