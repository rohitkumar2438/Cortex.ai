import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from 'fs';
import path from 'path';

let s3Client = null;

const getS3Client = () => {
    const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKey || !secretKey || !bucket || accessKey.includes('your_')) {
        return null;
    }

    if (!s3Client) {
        s3Client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey,
            }
        });
    }
    return s3Client;
};

/**
 * Uploads a buffer to AWS S3 or provides local data URL fallback for development.
 */
export const uploadToS3 = async (buffer, fileName, mimeType) => {
    const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
    const client = getS3Client();

    if (client && bucket) {
        try {
            const uniqueFileName = `${Date.now()}-${fileName}`;
            const putCommand = new PutObjectCommand({
                Bucket: bucket,
                Key: uniqueFileName,
                Body: buffer,
                ContentType: mimeType,
            });

            await client.send(putCommand);

            const getCommand = new GetObjectCommand({
                Bucket: bucket,
                Key: uniqueFileName,
            });

            const signedUrl = await getSignedUrl(client, getCommand, { expiresIn: 3600 });
            return signedUrl;
        } catch (err) {
            console.warn('⚠️ S3 Upload failed, switching to local buffer fallback:', err.message);
        }
    }

    // Local / development fallback: save to uploads directory or return Base64 data URL
    const uploadsDir = path.resolve('uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const localFilePath = path.join(uploadsDir, `${Date.now()}-${fileName}`);
    fs.writeFileSync(localFilePath, buffer);

    // If image, return data URL directly so browser displays it immediately
    if (mimeType.startsWith('image/')) {
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }

    // For PDF / PPT, return data URL for immediate browser downloading/rendering
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
};
