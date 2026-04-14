import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { createClient } from "@/supabase/supabase-client";

export async function GET(request: Request) {
    const session = await auth();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");

    if (!filename || !filename.endsWith(".json")) {
        return NextResponse.json({ error: "Only JSON files are allowed" }, { status: 400 });
    }

    const supabase = createClient();
    const { data, error } = await supabase.storage
        .from("chat-attachments")
        .createSignedUploadUrl(filename);

    if (error || !data) {
        console.error("Signed URL error:", error);
        return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
    }

    return NextResponse.json(data);
}
