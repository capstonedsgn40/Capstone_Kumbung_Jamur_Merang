import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const authSchema = z.object({ pin: z.string().trim().min(4).max(12) });

export async function POST(request: NextRequest) {
  try {
    const body = authSchema.parse(await request.json());
    const expectedPin = process.env.APP_ACCESS_PIN;
    if (!expectedPin)
      return NextResponse.json(
        { error: "APP_ACCESS_PIN belum dikonfigurasi" },
        { status: 500 },
      );

    if (body.pin !== expectedPin) {
      return NextResponse.json({ error: "PIN salah" }, { status: 401 });
    }

    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(SESSION_COOKIE, await signSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 12 * 60 * 60,
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Permintaan autentikasi tidak valid" },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
