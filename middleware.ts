import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  const isLoggedIn = !!token;
  const { pathname } = request.nextUrl;

  const isOnLogin = pathname.startsWith("/login");
  const isOnRegister = pathname.startsWith("/register");
  const isOnForgotPassword = pathname.startsWith("/forgot-password");
  const isOnResetPassword = pathname.startsWith("/reset-password");

  if (isLoggedIn && (isOnLogin || isOnRegister)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isOnLogin || isOnRegister || isOnForgotPassword || isOnResetPassword) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/:id", "/api/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};
