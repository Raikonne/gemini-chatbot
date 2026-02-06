import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FileSchema = z.object({
    file: z
        .instanceof(File)
        .refine((file) => file.size <= 5 * 1024 * 1024, {
            message: "File size should be less than 5MB",
        })
        .refine(
            (file) =>
                [
                    "image/jpeg",
                    "image/png",
                    "application/pdf",
                    "application/json",
                ].includes(file.type),
            {
                message: "File type should be JPEG, PNG, PDF, or JSON",
            },
        ),
});

export async function POST(request: Request) {
    const session = await auth();

    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const files = formData.getAll("file") as File[];

        if (!files || files.length === 0) {
            return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
        }

        for (const file of files) {
            const validatedFile = FileSchema.safeParse({ file });
            if (!validatedFile.success) {
                return NextResponse.json(
                    { error: `File "${file.name}" is invalid.` },
                    { status: 400 }
                );
            }
        }

        const uploadPromises = files.map(async (file) => {
            const uniqueName = `${file.name}`;
            const { data, error } = await supabase.storage
                .from("chat-attachments")
                .upload(uniqueName, file, {
                    cacheControl: "3600",
                    upsert: true,
                });

            if (error) {
                console.error(`[Upload] Error uploading ${uniqueName}:`, error);
                throw new Error(error.message);
            }

            const { data: publicUrlData } = supabase.storage
                .from("chat-attachments")
                .getPublicUrl(data.path);

            return {
                url: publicUrlData.publicUrl,
                pathname: data.path,
                contentType: file.type,
            };
        });

        const results = await Promise.all(uploadPromises);

        return NextResponse.json(results);
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json(
            { error: "Failed to process request" },
            { status: 500 }
        );
    }
}