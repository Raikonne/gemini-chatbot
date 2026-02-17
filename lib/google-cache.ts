// lib/google-cache.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GoogleAIFileManager } from "@google/generative-ai/server";

import { getFileById, saveFile } from "@/db/queries";

const fileManager = new GoogleAIFileManager(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

export async function getGoogleFileUri(fileId: string): Promise<string> {

    const fileRecord = await getFileById({ fileId });
    if (!fileRecord) throw new Error(`File not found in database: ${fileId}`);

    if (fileRecord.googleFileUri && fileRecord.googleExpiresAt && new Date(fileRecord.googleExpiresAt) > new Date()) {
        console.log(`Cache Hit. Returning ${fileRecord.googleFileUri}...`);
        return fileRecord.googleFileUri;
    }

    console.log(`⚠️ Cache miss. Uploading ${fileRecord.name}...`);

    try {
        const response = await fetch(fileRecord.url);
        if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `temp_${fileRecord.id}_${fileRecord.name}`);
        fs.writeFileSync(tempFilePath, buffer);

        const mimeType = fileRecord.mimeType === "application/json"
            ? "text/plain"
            : fileRecord.mimeType;

        const uploadResult = await fileManager.uploadFile(tempFilePath, {
            mimeType: mimeType,
            displayName: fileRecord.name,
        });

        fs.unlinkSync(tempFilePath);

        await saveFile(fileId, uploadResult.file.uri, new Date(uploadResult.file.expirationTime));
        return uploadResult.file.uri;

    } catch (error) {
        console.error("❌ CRITICAL ERROR in getGoogleFileUri:", error);
        throw error;
    }
}