import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NextAuth v5 session cookie (plain HTTP or secure HTTPS)
  const sessionCookie =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  const isLoggedIn = !!sessionCookie;

  const isOnLogin = pathname.startsWith("/login");
  const isOnRegister = pathname.startsWith("/register");
  const isOnForgotPassword = pathname.startsWith("/forgot-password");
  const isOnResetPassword = pathname.startsWith("/reset-password");

  // Bounce logged-in users away from auth pages
  if (isLoggedIn && (isOnLogin || isOnRegister)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Auth pages are always accessible
  if (isOnLogin || isOnRegister || isOnForgotPassword || isOnResetPassword) {
    return NextResponse.next();
  }

  // API routes handle their own auth
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Everything else requires a session
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/:id", "/api/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};
