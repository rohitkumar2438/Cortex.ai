import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

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
 * S3-Ready Storage Abstraction:
 * Saves files locally (now) or uploads to AWS S3 when configured.
 * Returns a permanent or signed download URL.
 */
export const storeFileAndGetUrl = async (buffer, originalFileName, mimeType) => {
    const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
    const client = getS3Client();
    const sanitizedName = originalFileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const uniqueFileName = `${Date.now()}-${sanitizedName}`;

    // 1. AWS S3 Upload (Cloud mode)
    if (client && bucket) {
        try {
            const putCommand = new PutObjectCommand({
                Bucket: bucket,
                Key: uniqueFileName,
                Body: buffer,
                ContentType: mimeType
            });
            await client.send(putCommand);

            const getCommand = new GetObjectCommand({
                Bucket: bucket,
                Key: uniqueFileName
            });

            const signedUrl = await getSignedUrl(client, getCommand, { expiresIn: 7 * 24 * 3600 });
            return {
                url: signedUrl,
                fileName: uniqueFileName,
                storage: 's3'
            };
        } catch (err) {
            console.warn('⚠️ S3 Upload failed, falling back to local file storage:', err.message);
        }
    }

    // 2. Local Storage (Default local mode)
    const localFilePath = path.join(UPLOADS_DIR, uniqueFileName);
    fs.writeFileSync(localFilePath, buffer);

    const baseUrl = process.env.GATEWAY_URL || 'http://localhost:8000';
    const downloadUrl = `${baseUrl}/agent/downloads/${uniqueFileName}`;

    return {
        url: downloadUrl,
        fileName: uniqueFileName,
        storage: 'local'
    };
};

export default storeFileAndGetUrl;

