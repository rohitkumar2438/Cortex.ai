import PDFDocument from 'pdfkit';
import { uploadToS3 } from '../utils/s3.js';

export const runPdfGenerateAgent = async (prompt, title = 'Cortex AI Document') => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const buffers = [];

            doc.on('data', b => buffers.push(b));
            doc.on('end', async () => {
                try {
                    const pdfBuffer = Buffer.concat(buffers);
                    const url = await uploadToS3(pdfBuffer, 'generated-document.pdf', 'application/pdf');
                    resolve({
                        result: `I have generated your PDF document. You can download or view it here:\n\n[Download PDF](${url})`,
                        type: 'pdf',
                        url
                    });
                } catch (err) {
                    reject(err);
                }
            });

            // Modern Document Styling
            doc.rect(0, 0, doc.page.width, 80).fill('#1E293B');
            doc.fontSize(22).fillColor('#FFFFFF').text(title, 50, 28, { align: 'left' });
            doc.moveDown(3);

            doc.fontSize(12).fillColor('#334155').text(prompt, 50, 110, {
                align: 'left',
                lineGap: 6,
                paragraphGap: 12
            });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};
