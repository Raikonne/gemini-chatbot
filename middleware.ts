import NextAuth from "next-auth";

import { authConfig } from "./app/(auth)/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const runtime = "nodejs";

export const config = {
  matcher: ["/", "/:id", "/api/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};
