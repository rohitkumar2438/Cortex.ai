import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Strictly initialize S3 client
const getS3Client = () => {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
        throw new Error("CRITICAL: Missing AWS credentials or S3 bucket configuration.");
    }
    
    return new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
    });
};

/**
 * Uploads a buffer to AWS S3 and returns a signed download URL.
 * Strictly enforces cloud storage with no local fallbacks.
 */
export const uploadFileAndGetUrl = async (buffer, fileName, mimeType) => {
    const s3Client = getS3Client();
    const uniqueFileName = `${Date.now()}-${fileName}`;
    
    // Upload to AWS S3
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: uniqueFileName,
        Body: buffer,
        ContentType: mimeType,
    });

    await s3Client.send(command);

    // Generate Signed URL valid for 1 hour
    const getCommand = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: uniqueFileName,
    });
    
    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
    return signedUrl;
};
