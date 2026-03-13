/**
 * Cloudflare R2 Storage for video uploads
 */
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "bot-telegram";
const R2_ENDPOINT = process.env.R2_ENDPOINT_URL || process.env.R2_ENDPOINT || "";

const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export interface R2UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

export interface R2DownloadResult {
  success: boolean;
  data?: Buffer;
  contentType?: string;
  error?: string;
}

/**
 * Upload a file to Cloudflare R2
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<R2UploadResult> {
  try {
    const key = `videos/${Date.now()}-${fileName}`;

    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      },
    });

    await upload.done();

    // Store URL as endpoint/bucket/key (path-style — Cloudflare R2 uses path-style)
    const publicUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`;

    return {
      success: true,
      url: publicUrl,
      key: key,
    };
  } catch (error: any) {
    console.error("[R2] Upload error:", error);
    return {
      success: false,
      error: error.message || "Upload failed",
    };
  }
}

/**
 * Download a file from Cloudflare R2
 */
export async function downloadFromR2(key: string): Promise<R2DownloadResult> {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);

    if (!response.Body) {
      return {
        success: false,
        error: "Empty response body",
      };
    }

    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const data = Buffer.concat(chunks);

    return {
      success: true,
      data: data,
      contentType: response.ContentType || "application/octet-stream",
    };
  } catch (error: any) {
    console.error("[R2] Download error:", error);
    return {
      success: false,
      error: error.message || "Download failed",
    };
  }
}

/**
 * Delete a file from Cloudflare R2
 */
export async function deleteFromR2(key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await r2Client.send(command);
    return true;
  } catch (error: any) {
    console.error("[R2] Delete error:", error);
    return false;
  }
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  return !!(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT && R2_BUCKET_NAME);
}

/**
 * Get R2 public URL for a file key
 */
export function getR2PublicUrl(key: string): string {
  return `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`;
}

/**
 * Extract R2 key from a stored R2 URL
 */
export function extractR2Key(url: string): string | null {
  try {
    // Handle path-style: https://ACCOUNT.r2.cloudflarestorage.com/BUCKET/videos/...
    const r2Match = url.match(/\.r2\.cloudflarestorage\.com\/[^/]+\/(videos\/.+)$/);
    if (r2Match) return r2Match[1];

    // Handle legacy subdomain-style: https://BUCKET.ACCOUNT.r2.cloudflarestorage.com/videos/...
    const legacyMatch = url.match(/\.r2\.cloudflarestorage\.com\/(videos\/.+)$/);
    if (legacyMatch) return legacyMatch[1];

    return null;
  } catch {
    return null;
  }
}
