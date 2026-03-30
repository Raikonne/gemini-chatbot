# CLAUDE.md

## Project Overview

Product Intelligence AI Chatbot powered by Google Gemini. Users upload JSON product review datasets, then chat with an AI assistant that analyzes the data and provides insights (sentiment, pros/cons, pricing value, complaints, etc.).

## Tech Stack

- **Framework**: Next.js 15 (App Router, Turbo mode)
- **Language**: TypeScript 5
- **AI**: Google Gemini 2.0-flash via `@ai-sdk/google` + Vercel AI SDK
- **Database**: PostgreSQL via Vercel Postgres + Drizzle ORM
- **Storage**: Vercel Blob / Supabase (`chat-attachments` bucket) + Google File Manager
- **Auth**: NextAuth.js v5 (Credentials provider, JWT sessions)
- **UI**: React 19, Tailwind CSS, shadcn/ui, Radix UI, Framer Motion

## Commands

```bash
pnpm install       # install dependencies
pnpm dev           # dev server with Turbo on localhost:3000
pnpm build         # production build
pnpm start         # production server
pnpm lint          # ESLint
```

## Project Structure

```
app/
  (auth)/          # login, register, NextAuth handlers, server actions
  (chat)/          # main chat UI, individual chat pages
    api/
      chat/        # POST send message, GET/DELETE manage chats
      history/     # GET chat history
      files/       # upload, active dataset, delete
components/
  custom/          # business components (chat, input, message, history, navbar)
  ui/              # shadcn/ui primitives
db/
  schema.ts        # Drizzle schema: User, Chat, File, AllowedUser
  queries.ts       # all database CRUD operations
lib/
  google-cache.ts  # Google File Manager integration + URI caching
  utils.ts         # UI utilities, UUID, message conversion
middleware.ts      # route protection via NextAuth
```

## Environment Variables

See `.env.example`. Required:
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `AUTH_SECRET`
- `POSTGRES_URL`
- `BLOB_READ_WRITE_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`

## Key Architecture Decisions

- **Route groups**: `(auth)` and `(chat)` for layout isolation
- **Server Components by default**; mark interactive components `"use client"`
- **Server Actions** for auth; **API routes** for async AI streaming and file ops
- **Global dataset**: the latest uploaded file is automatically attached to the first message of every new conversation
- **Dual storage**: files stored in Supabase blob + uploaded to Google File Manager with URI caching and expiration tracking
- **Database access is server-only** — never import `db/` from client components
- **AllowedUser table** controls who can register

## Code Conventions

- Path alias `@/*` maps to the project root
- UI components live in `components/ui/` (shadcn-generated, mostly untouched)
- Business logic components live in `components/custom/`
- ESLint enforces import ordering (alphabetical, groups: builtin → external → internal)
- Tailwind with HSL CSS variables; dark mode via `.dark` class
