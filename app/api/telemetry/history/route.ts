import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const ranges: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const range = request.nextUrl.searchParams.get("range") ?? "1h";
  const duration = ranges[range];
  if (!duration)
    return NextResponse.json({ error: "Range tidak valid" }, { status: 400 });

  const from = new Date(Date.now() - duration).toISOString();
  const { data, error } = await supabase
    .from("telemetry_logs")
    .select("created_at,avg_temp,avg_rh,pump_status,phase,sensors")
    .gte("created_at", from)
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { data: data ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
