import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const authenticated = await verifySession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (request.nextUrl.pathname.startsWith("/api/iot") && !authenticated) {
    return NextResponse.json(
      { error: "Sesi belum terautentikasi" },
      { status: 401 },
    );
  }

  if (request.nextUrl.pathname === "/" && !authenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ["/", "/api/iot/:path*"] };
