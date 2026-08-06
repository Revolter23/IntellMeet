import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

// Helper to check if S3 configuration is present
export const isS3Configured = () => {
    return !!(
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_REGION &&
        process.env.AWS_S3_BUCKET_NAME
    );
};

// Create S3 Client instance
const getS3Client = () => {
    if (!isS3Configured()) {
        throw new Error(
            "Amazon S3 credentials are missing. Please configure AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_S3_BUCKET_NAME in your server/.env file."
        );
    }

    return new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    });
};

/**
 * Generates a presigned S3 upload URL for direct browser uploads.
 * @param {string} meetingCode - The code of the meeting being recorded.
 * @param {string} mimeType - Content type (e.g. video/webm).
 * @returns {Promise<{ uploadUrl: string, s3Url: string, key: string }>} Presigned upload data.
 */
export async function getS3PresignedUploadUrl(meetingCode, mimeType = "video/webm") {
    const s3Client = getS3Client();
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION;

    const date = new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    const shortId = crypto.randomBytes(4).toString('hex');

    const key = `IntellMeet_Recordings/${year}/${month}/${meetingCode}/rec_${timestamp}_${shortId}.webm`;

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: mimeType
    });

    // Generate presigned URL valid for 15 minutes (900 seconds)
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    return {
        uploadUrl,
        s3Url,
        key
    };
}

/**
 * Uploads a video/audio recording buffer to Amazon S3 and returns the public URL.
 * @param {Buffer} fileBuffer - The binary buffer of the recording file.
 * @param {string} fileName - Destination file key in the S3 bucket.
 * @param {string} mimeType - Content type (e.g. video/webm, video/mp4).
 * @returns {Promise<string>} S3 public URL
 */
export async function uploadRecordingToS3(fileBuffer, fileName, mimeType = "video/webm") {
    const s3Client = getS3Client();
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION;

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimeType
    });

    console.log(`Uploading recording ${fileName} to Amazon S3 bucket ${bucketName}...`);
    await s3Client.send(command);

    const s3Url = `https://${bucketName}.s3.${region}.amazonaws.com/${fileName}`;
    console.log(`Successfully uploaded to S3: ${s3Url}`);
    return s3Url;
}

