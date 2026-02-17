import { NextResponse } from "next/server";

import {auth} from "@/app/(auth)/auth";
import { deleteFileById, getFileByUrl } from "@/db/queries";
import {createClient} from "@/supabase/supabase-client";

export async function DELETE(request: Request) {
    const session = await auth();
    if (!session) {
        return new Response("Unauthorized", { status: 401 });
    }
    
    const { url } = await request.json();
    if (!url) {
        return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const fileRecord = await getFileByUrl({ url });
        if (!fileRecord) {
            return NextResponse.json({ success: true });
        }
        
        const storagePath = `${user.id}/${fileRecord.name}`;

        const { error: storageError } = await supabase.storage
            .from("chat-attachments")
            .remove([storagePath]);

        if (storageError) {
            console.error("Supabase storage delete error:", storageError);
        }
        
        await deleteFileById({ id: fileRecord.id });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Delete error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}