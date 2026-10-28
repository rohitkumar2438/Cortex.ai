/**
 * Document Chunker and Parser for Cortex AI RAG.
 * Extracts text from PDF and TXT/MD files and splits into overlapping semantic chunks.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Parses raw file buffer into plain text based on MIME type or filename.
 */
export const extractTextFromFile = async (fileBuffer, fileName = '', mimeType = '') => {
    const isPdf = fileName.toLowerCase().endsWith('.pdf') || mimeType.includes('pdf');

    if (isPdf) {
        try {
            const data = await pdfParse(fileBuffer);
            return {
                text: data.text || '',
                pages: data.numpages || 1,
                info: data.info || {}
            };
        } catch (err) {
            console.error('❌ Failed to parse PDF with pdf-parse:', err.message);
            // Fallback plain string decode if corrupted header
            return {
                text: fileBuffer.toString('utf-8', 0, 50000),
                pages: 1,
                info: {}
            };
        }
    }

    // Default to plain text / Markdown UTF-8
    return {
        text: fileBuffer.toString('utf-8'),
        pages: 1,
        info: {}
    };
};

/**
 * Splits text into chunks with sliding window overlap.
 * Default: chunkSize = 800 characters, chunkOverlap = 150 characters.
 */
export const chunkText = (text, options = {}) => {
    const {
        chunkSize = 800,
        chunkOverlap = 150,
        docName = 'document',
        userId = '',
        conversationId = ''
    } = options;

    if (!text || typeof text !== 'string') return [];

    const cleanedText = text.replace(/\r\n/g, '\n').trim();
    if (!cleanedText) return [];

    const chunks = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < cleanedText.length) {
        let end = start + chunkSize;

        // Try to break at paragraph, line boundary, or sentence ending
        if (end < cleanedText.length) {
            const newlinePos = cleanedText.lastIndexOf('\n\n', end);
            const periodPos = cleanedText.lastIndexOf('. ', end);

            if (newlinePos > start + chunkSize * 0.5) {
                end = newlinePos + 2;
            } else if (periodPos > start + chunkSize * 0.5) {
                end = periodPos + 2;
            }
        } else {
            end = cleanedText.length;
        }

        const chunkTextContent = cleanedText.substring(start, end).trim();
        if (chunkTextContent.length > 20) { // filter out trivial whitespace fragments
            chunks.push({
                id: `${docName}_chunk_${chunkIndex}`,
                chunkIndex,
                text: chunkTextContent,
                docName,
                userId,
                conversationId,
                charLength: chunkTextContent.length
            });
            chunkIndex++;
        }

        if (end >= cleanedText.length) break;
        start = Math.max(start + 1, end - chunkOverlap);
    }

    return chunks;
};

export default {
    extractTextFromFile,
    chunkText
};
