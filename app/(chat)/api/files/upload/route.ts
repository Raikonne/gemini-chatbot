import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";

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

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
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
        const errorMessage = validatedFile.error.errors
            .map((error) => error.message)
            .join(", ");
        return NextResponse.json(
            { error: `File "${file.name}": ${errorMessage}` },
            { status: 400 }
        );
      }
    }

    const uploadPromises = files.map(async (file) => {
      const filename = file.name;
      const fileBuffer = await file.arrayBuffer();

      return put(filename, fileBuffer, {
        access: "public",
      });
    });

    const results = await Promise.all(uploadPromises);
    return NextResponse.json(results);

  } catch (error) {
    console.error(error);
    return NextResponse.json(
        { error: "Failed to process request" },
        { status: 500 },
    );
  }
}