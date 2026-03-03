import { GoogleGenerativeAI } from "@google/generative-ai";
import {Message} from "ai";

import { auth } from "@/app/(auth)/auth";
import {deleteChatById, getChatById, getFileById, getLatestGlobalFile, saveChat} from "@/db/queries";
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

    if (messages.length === 1) {
      try {
        const latestFile = await getLatestGlobalFile();
        if (latestFile) {
          const globalFileUri = await getGoogleFileUri(latestFile.id);
          const globalMimeType = latestFile.mimeType === "application/json"
              ? "text/plain"
              : latestFile.mimeType;

          currentMessageParts.push({
            fileData: { mimeType: globalMimeType, fileUri: globalFileUri }
          });
        }
      } catch (error) {
        console.error("❌ Failed to attach global master file:", error);
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
        parts: [{ text: `You are a Product Intelligence Assistant. Your role is to analyze and answer questions based on a specific JSON dataset of product reviews and sentiments.
              ### Analysis Protocol:
              1. **Context Maintenance**: When a user asks about a product, continue referencing that specific "Product_Description" until the user explicitly mentions a different product or "Product_Code".
              2. **Key Mapping**: Map user inquiries to the relevant JSON fields:
                 - "Is it worth it?" -> 'Price_Value'
                 - "Is it sturdy?" -> 'Construction'
                 - "How do I install it?" -> 'Mounting_System'
                 - "What do people hate?" -> 'Main_Complaint' or 'Top_3_Cons'
              3. **Synthesis**: Combine 'Top_3_Pros' and 'Sentiment_Score' to give a balanced overview.
              4. **Data Integrity**: If a field is "N/A" or the information is missing from the array, state: "The current review data for [Product Name] does not provide specific details regarding [Topic]." Do not hallucinate features.
              
              ### Output Formatting:
              - Use **Markdown** for readability.
              - Use **Bold** for product names and sentiment status.
              - Use bullet points for Pros, Cons, and Use Cases.
              - If comparing products, use a table format.` }]
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
