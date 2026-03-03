import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getLatestGlobalFile } from "@/db/queries";

export async function GET() {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const latestFile = await getLatestGlobalFile();
        return NextResponse.json(latestFile || null);
    } catch (error) {
        console.error("Failed to fetch active file:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}