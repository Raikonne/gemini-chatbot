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
        const { path, name, mimeType } = await request.json();

        if (!path || !name) {
            return NextResponse.json({ error: "Missing file metadata" }, { status: 400 });
        }

        const { data: { publicUrl } } = supabase.storage
            .from("chat-attachments")
            .getPublicUrl(path);

        const fileRecord = await createFile({
            id: generateUUID(),
            url: publicUrl,
            name,
            mimeType: mimeType || "application/json",
        });

        return NextResponse.json(fileRecord);

    } catch (error) {
        console.error("Internal Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
