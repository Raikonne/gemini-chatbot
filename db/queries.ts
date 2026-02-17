import "server-only";

import { genSaltSync, hashSync } from "bcrypt-ts";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {user, chat, User, files} from "./schema";

let client = postgres(`${process.env.POSTGRES_URL!}?sslmode=disable`);
let db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    console.error("Detailed DB Error:", error);
    throw new Error("Failed to get user from database");
  }
}

export async function createUser(email: string, password: string) {
  let salt = genSaltSync(10);
  let hash = hashSync(password, salt);

  try {
    return await db.insert(user).values({ email, password: hash });
  } catch (error) {
    console.error("Detailed DB Error:", error);
    throw error;
  }
}

export async function saveChat({
  id,
  messages,
  userId,
}: {
  id: string;
  messages: any;
  userId: string;
}) {
  try {
    const selectedChats = await db.select().from(chat).where(eq(chat.id, id));

    if (selectedChats.length > 0) {
      return await db
        .update(chat)
        .set({
          messages: JSON.stringify(messages),
        })
        .where(eq(chat.id, id));
    }

    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      messages: JSON.stringify(messages),
      userId,
    });
  } catch (error) {
    console.error("Failed to save chat in database ", error);
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    return await db.delete(chat).where(eq(chat.id, id));
  } catch (error) {
    console.error("Failed to delete chat by id from database");
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(chat)
      .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    console.error("Failed to get chats by user from database");
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    console.error("Failed to get chat by id from database");
    throw error;
  }
}

export async function createFile(file: {
  id: string;
  url: string;
  name: string;
  mimeType: string
}) {
  try {

    const [existingFile] = await db
        .select()
        .from(files)
        .where(eq(files.name, file.name))
        .limit(1);

    if (existingFile) {
      console.log(`♻️ Deduplicating file by name: ${file.name}`);
      return [existingFile];
    }

    return db.insert(files).values(file).returning();
  } catch (error) {
    console.error("Failed to check or create file in database", error);
    throw error;
  }
}

export async function getFileById({ fileId }: { fileId: string }) {
  try {
    const [file] = await db.select().from(files).where(eq(files.id, fileId));
    if (!file) throw new Error("File not found");
    return file;
  } catch (error) {
    console.error(`Failed to get FILE by id: ${fileId} from database`);
    throw error;
  }
}

export async function deleteFileById({ id }: { id: string }) {
  return await db.delete(files).where(eq(files.id, id));
}

export async function getFileByUrl({ url }: { url: string }) {
  const [file] = await db.select().from(files).where(eq(files.url, url));
  return file;
}

export async function saveFile(fileId: string, googleUri: string, expiresAt: Date) {
  try {
    const [updated] = await db
        .update(files)
        .set({
          googleFileUri: googleUri,
          googleExpiresAt: expiresAt,
        })
        .where(eq(files.id, fileId))
        .returning();
    return updated;
  } catch (error) {
    console.error("Failed to update file cache:", error);
    throw error;
  }
}
