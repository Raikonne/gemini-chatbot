import { NextResponse } from "next/server";

import {auth} from "@/app/(auth)/auth";
import { createFile } from "@/db/queries";
import {generateUUID} from "@/lib/utils";
import {createClient} from "@/supabase/supabase-client";

export async function POST(request: Request) {
    const session = await auth();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    const supabase = createClient();

    try {
        const formData = await request.formData();

        const file = formData.get("file") as File;
        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const isJson = file.name.endsWith(".json");
        if (!isJson) {
            return NextResponse.json({ error: "Only JSON files are allowed in global storage" }, { status: 400 });
        }

        const filePath = file.name;

        const { error: uploadError } = await supabase.storage
            .from("chat-attachments")
            .upload(filePath, file, {
                upsert: true,
            });

        if (uploadError) {
            console.error("Supabase upload error:", uploadError);
            return NextResponse.json({ error: "Upload failed" }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
            .from("chat-attachments")
            .getPublicUrl(filePath);

        const fileRecord = await createFile({
            id: generateUUID(),
            url: publicUrl,
            name: file.name,
            mimeType: file.type,
        });

        return NextResponse.json(fileRecord);

    } catch (error) {
        console.error("Internal Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}