import { GoogleGenerativeAI } from "@google/generative-ai";
import {Message} from "ai";

import { auth } from "@/app/(auth)/auth";
import {deleteChatById, getChatById, getFileById, saveChat} from "@/db/queries";
import { getGoogleFileUri } from "@/lib/google-cache";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { id, messages, data }: { id: string; messages: Array<Message>; data?: { files?: string[] } } =
        await request.json();

    const session = await auth();
    if (!session) return new Response("Unauthorized", { status: 401 });

    const lastMessage = messages[messages.length - 1];
    const currentMessageParts: any[] = [];

    if (data?.files && data.files.length > 0) {
      for (const fileId of data.files) {
        try {
          const fileUri = await getGoogleFileUri(fileId);
          const fileRecord = await getFileById({ fileId });

          const mimeType = fileRecord.mimeType === "application/json"
              ? "text/plain"
              : fileRecord.mimeType;

          currentMessageParts.push({
            fileData: { mimeType: mimeType, fileUri: fileUri },
          });
        } catch (error) {
          console.error(`❌ Error attaching file ${fileId}:`, error);
        }
      }
    }

    if (lastMessage.content) {
      currentMessageParts.push({ text: lastMessage.content });
    }

    const history = await Promise.all(
        messages.slice(0, -1)
            .filter(m => m.role === "user" || m.role === "assistant")
            .map(async (m) => {
              const parts: any[] = [];

              if (m.experimental_attachments) {
                for (const attachment of m.experimental_attachments) {
                  // @ts-ignore
                  const fileId = attachment.extras?.id;
                  if (fileId) {
                    try {
                      const uri = await getGoogleFileUri(fileId);

                      const mimeType = attachment.contentType === "application/json"
                          ? "text/plain"
                          : attachment.contentType;

                      parts.push({
                        fileData: { mimeType: mimeType, fileUri: uri }
                      });
                    } catch (e) {
                      console.log("History errors ", e);
                    }
                  }
                }
              }

              // Handle text second
              if (m.content) {
                parts.push({ text: m.content });
              }

              return { role: m.role === "user" ? "user" : "model", parts };
            })
    );

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: {
        role: "system",
        parts: [{ text: `You are a Product Intelligence Assistant. Your role is to answer user questions using the provided product analysis JSON data. 
                          ### Guidelines:
                          1. **Goal Mapping**: Map user questions to the "Goals" provided in the data (e.g., "Is it light?" -> Weight; "Is it sturdy?" -> Construction).
                          2. **Contextual Accuracy**: Only use information found in the 'detailed_analysis', 'technical_flaws', and 'customer_intelligence' sections.
                          3. **Formatting**: Use Markdown for clarity. Bold key findings and use bullet points for pros/cons.
                          4. **Groundedness**: If the data does not contain the answer, state: "The current reviews do not provide information regarding [topic]".` }]
      }
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessageStream(currentMessageParts);

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponseText = "";
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              fullResponseText += text;
              controller.enqueue(`0:${JSON.stringify(text)}\n`);
            }
          }

          if (session.user?.id) {
            await saveChat({
              id,
              messages: [...messages, { id: Date.now().toString(), role: "assistant", content: fullResponseText }],
              userId: session.user.id,
            });
          }
        } catch (err) {
          console.error("Stream Error:", err);
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Vercel-AI-Data-Stream": "v1" } });

  } catch (error: any) {
    console.error("❌ Final Chat Route Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (error) {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
