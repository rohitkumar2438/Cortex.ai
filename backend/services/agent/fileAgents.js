import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';
import { uploadFileAndGetUrl } from './s3Utils.js';
import OpenAI from 'openai';

/**
 * Generates a PDF and returns the S3 URL
 */
export const generatePDF = async (content, title = 'Document') => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];
            
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', async () => {
                try {
                    const pdfBuffer = Buffer.concat(buffers);
                    const url = await uploadFileAndGetUrl(pdfBuffer, 'document.pdf', 'application/pdf');
                    resolve(url);
                } catch (err) {
                    reject(err);
                }
            });

            // Add Header
            doc.fontSize(24).fillColor('#333333').text(title, { align: 'center' });
            doc.moveDown();
            
            // Add Content
            doc.fontSize(12).fillColor('#555555').text(content, { align: 'left', lineGap: 4 });
            
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Generates a PPT and returns the S3 URL
 */
export const generatePPT = async (content, title = 'Presentation') => {
    try {
        const pres = new PptxGenJS();
        pres.layout = 'LAYOUT_16x9';

        const titleSlide = pres.addSlide();
        titleSlide.addText(title, { x: '10%', y: '40%', w: '80%', fontSize: 44, align: 'center', color: '363636', bold: true });

        const paragraphs = content.split('\n\n').filter(p => p.trim());
        
        paragraphs.forEach(para => {
            const slide = pres.addSlide();
            slide.addText(para.substring(0, 50) + "...", { x: '5%', y: '5%', w: '90%', fontSize: 24, bold: true, color: '363636' });
            slide.addText(para, { x: '5%', y: '20%', w: '90%', h: '70%', fontSize: 16, color: '555555', align: 'left', valign: 'top' });
        });

        const pptBuffer = await pres.write({ outputType: 'nodebuffer' });
        const url = await uploadFileAndGetUrl(pptBuffer, 'presentation.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        return url;
    } catch (error) {
        throw error;
    }
};

/**
 * Generates an Image using OpenAI DALL-E 3 and returns the URL.
 * Strictly enforces OpenAI API key usage.
 */
export const generateImage = async (prompt) => {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("CRITICAL: Missing OPENAI_API_KEY for image generation.");
    }

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
    });

    return response.data[0].url;
};
