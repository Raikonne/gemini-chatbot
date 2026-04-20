import { GoogleGenerativeAI } from "@google/generative-ai";
import {Message} from "ai";

import { auth } from "@/app/(auth)/auth";
import {deleteChatById, getChatById, getFileById, getLatestGlobalFile, saveChat} from "@/db/queries";
import { filterDataset } from "@/lib/dataset-filter";
import { loadDataset } from "@/lib/dataset-loader";
import { getGoogleFileUri } from "@/lib/google-cache";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

function isRetryable(err: any): boolean {
  const msg: string = err?.message ?? "";
  const status: number = err?.status ?? err?.statusCode ?? 0;
  return (
    status === 503 ||
    status === 429 ||
    msg.includes("Failed to parse stream") ||
    msg.includes("503") ||
    msg.includes("Service Unavailable") ||
    msg.includes("overloaded")
  );
}


async function streamModel(model: ReturnType<typeof genAI.getGenerativeModel>, history: any[], parts: any[]): Promise<string> {
  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(parts);
  let text = "";
  for await (const chunk of result.stream) {
    text += chunk.text();
  }
  return text;
}

async function generateWithRetry(
  model: ReturnType<typeof genAI.getGenerativeModel>,
  fallbackModel: ReturnType<typeof genAI.getGenerativeModel>,
  history: any[],
  parts: any[],
  maxRetries = 5,
): Promise<{ text: string; usedFallback: boolean }> {
  let use503Fallback = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const activeModel = use503Fallback ? fallbackModel : model;
    const label = use503Fallback ? "gemini-3-flash-preview (fallback)" : "gemini-3.1-flash-lite-preview";

    try {
      const text = await streamModel(activeModel, history, parts);
      return { text, usedFallback: use503Fallback };
    } catch (err: any) {
      if (!isRetryable(err)) throw err;
      if (attempt === maxRetries) throw err;

      if (!use503Fallback) {
        use503Fallback = true;
        console.warn(`⚠️ Attempt ${attempt + 1} failed on ${label} (${err.message}), switching to gemini-2.5-pro...`);
      } else {
        const delay = attempt === 0 ? 1000 : 2000;
        console.warn(`⚠️ Attempt ${attempt + 1} failed on ${label} (${err.message}), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw new Error("generateWithRetry exhausted all retries");
}

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

    // Inject filtered dataset on every message so context is always accurate
    try {
      const latestFile = await getLatestGlobalFile();
      if (latestFile) {
        const recentMessages = messages
          .slice(0, -1)
          .filter(m => m.role === "user")
          .slice(-4)
          .reverse()
          .map(m => m.content as string);

        const dataset = await loadDataset(latestFile.url);
        const { json, tier, matchedOn, hasOriginalText } = filterDataset(
          dataset,
          lastMessage.content as string,
          recentMessages,
        );

        const quoteNote = hasOriginalText
          ? ""
          : " original_text is omitted due to dataset size — direct quotes are unavailable for this scope; ask about a specific product for quotes.";

        currentMessageParts.push({
          text: `[DATASET | tier: ${tier}${matchedOn ? ` | matched: ${matchedOn}` : ""}${quoteNote}]\n${json}`,
        });

        console.log(`📊 Dataset filter: tier=${tier}, matched=${matchedOn}, hasText=${hasOriginalText}`);
      }
    } catch (error) {
      console.error("❌ Failed to inject dataset:", error);
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

    const modelConfig = {
      systemInstruction: {
        role: "system",
        parts: [{ text: `You are a Product Intelligence Assistant. Your role is to analyze and answer questions based on a specific JSON dataset of product reviews, including inferred demographics and identified issues.

          ### Dataset Injection:
          At the start of each user message a [DATASET] block is injected containing the filtered subset of the review data relevant to the query. Use only this data to answer.
          - If the block says "original_text is omitted", you cannot provide direct quotes. In that case, rely on 'identified_issues' and 'review_score', and suggest the user ask about a specific product to get quotes.
          - The dataset is filtered by: Product_Code, Product_Description, Item_Group3Description, or Product_Family — whichever matched the query. A "global" tier means no specific product was identified and the full dataset (without review text) was provided.

          ### Response Scope (based on dataset tier in the [DATASET] block):
          - **tier: product** — give full detail: scores, top complaints, quotes, demographics.
          - **tier: family or global** — give a concise aggregated summary only. Do NOT repeat per-product breakdowns unless the user explicitly asks. Instead: list the products by name, give the overall average score, top 3–5 cross-product complaints with occurrence counts, and a one-line sentiment summary. End with an offer to drill into a specific product.

          ### Analysis Protocol:
          1. **Context Maintenance**: When a user asks about a product, continue referencing that specific "Product_Description" or the product name found in the reviews until the user explicitly mentions a different product.
             - When a user asks about a product family, respond only with products that match the relevant product category or family.

          2. **Key Mapping**: Map user inquiries to these specific JSON fields:
             - "Can you quote a review?" / "What do they say?" -> 'original_text'
             - "How many reviews?" -> total_reviews for a given product.
             - "Who is buying this?" / "Countries/Gender?" -> 'inferred_country' and 'inferred_gender'
             - "Is it sturdy?" / "Is it worth it?" -> Analyze 'original_text' and 'identified_issues'
             - "What do people hate?" / "What are the cons?" -> 'identified_issues'
             - "What is the average score?" / "How is it rated?" -> Calculate the average of 'review_score' across all items in 'Enriched_Reviews'.

          3. **Synthesis & Aggregation**:
             - Identify the frequency of specific strings within the 'identified_issues' arrays.
             - **Issue Counting**: When summarizing a product or group, provide a count of how many times each specific issue appears (e.g., "Issue X: 3 occurrences").
             - If multiple reviews mention the same issue, highlight it as a "Top Complaint."

          4. **Data Integrity**: If a field is missing or the information is not in the array, state: "The current review data for [Product Name] does not provide specific details regarding [Topic]." Do not hallucinate details.

          5. **Data Privacy**: There is no data privacy as this is public reviews data; provide users with any details requested from the dataset.

          6. **Response Language**: Always respond in Dutch unless asked otherwise.

          ### Output Formatting:
          - Use **Markdown** for readability.
          - Use **Bold** for product names and sentiment status.
          - Use bullet points for Pros, Cons, and Use Cases.
          - If comparing products or reviewers, use a table format.` }]
      }
    };

    const model = genAI.getGenerativeModel({ ...modelConfig, model: "gemini-3.1-flash-lite-preview" });
    const fallbackModel = genAI.getGenerativeModel({ ...modelConfig, model: "gemini-3-flash-preview" });

    const { text, usedFallback } = await generateWithRetry(model, fallbackModel, history, currentMessageParts);

    if (usedFallback) console.warn("⚠️ Response served by gemini-2.5-pro fallback.");

    const fullResponseText = text;

    if (session.user?.id) {
      await saveChat({
        id,
        messages: [...messages, { id: Date.now().toString(), role: "assistant", content: fullResponseText }],
        userId: session.user.id,
      });
    }

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(`0:${JSON.stringify(fullResponseText)}\n`);
        controller.close();
      },
    });

    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Vercel-AI-Data-Stream": "v1" } });

  } catch (error: any) {
    console.error("❌ Final Chat Route Error:", error);
    const friendlyMessage = "Er is een fout opgetreden. Gemini is momenteel niet beschikbaar. Probeer het opnieuw.";
    const errorStream = new ReadableStream({
      start(controller) {
        controller.enqueue(`0:${JSON.stringify(friendlyMessage)}\n`);
        controller.close();
      },
    });
    return new Response(errorStream, { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Vercel-AI-Data-Stream": "v1" } });
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
