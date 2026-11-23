import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sensorSchema = z.object({
  id: z.number().int().min(1).max(6),
  pin: z.number().int(),
  ok: z.boolean(),
  t: z.number().nullable(),
  h: z.number().nullable(),
});

const telemetrySchema = z
  .object({
    status: z.enum(["ONLINE", "CRITICAL_SENSOR_ERROR"]),
    avgTemp: z.number().nullable().optional(),
    avgRH: z.number().nullable().optional(),
    activeCount: z.number().int().min(0).max(6).optional(),
    pompa: z.boolean(),
    modeAuto: z.boolean().optional(),
    fase: z.enum(["VEGETATIF", "GENERATIF"]).optional(),
    activeBawahRH: z.number().min(0).max(100).optional(),
    activeAtasRH: z.number().min(0).max(100).optional(),
    config: z
      .object({
        vegetatif: z.object({ bawah: z.number(), atas: z.number() }),
        generatif: z.object({ bawah: z.number(), atas: z.number() }),
      })
      .optional(),
    sensors: z.array(sensorSchema).min(1).max(6),
  })
  .passthrough();

export async function POST(request: NextRequest) {
  if (request.headers.get("x-webhook-secret") !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook secret tidak valid" },
      { status: 401 },
    );
  }

  try {
    const payload = telemetrySchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    const update: Record<string, unknown> = {
      id: 1,
      device_status: payload.status,
      pump_status: payload.pompa,
      sensors: payload.sensors,
      active_count:
        payload.activeCount ??
        payload.sensors.filter((sensor) => sensor.ok).length,
      updated_at: new Date().toISOString(),
    };

    if (payload.status !== "CRITICAL_SENSOR_ERROR") {
      if (payload.avgTemp != null) update.avg_temp = payload.avgTemp;
      if (payload.avgRH != null) update.avg_rh = payload.avgRH;
      if (payload.modeAuto != null) update.mode_auto = payload.modeAuto;
      if (payload.fase != null) update.phase = payload.fase;
      if (payload.activeBawahRH != null)
        update.active_lower_rh = payload.activeBawahRH;
      if (payload.activeAtasRH != null)
        update.active_upper_rh = payload.activeAtasRH;
      if (payload.config != null) update.config = payload.config;
    }

    const { error: statusError } = await supabase
      .from("device_status")
      .upsert(update, { onConflict: "id" });
    if (statusError) throw statusError;

    if (payload.status !== "CRITICAL_SENSOR_ERROR") {
      const { data: latest } = await supabase
        .from("telemetry_logs")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const elapsed = latest
        ? Date.now() - new Date(latest.created_at).getTime()
        : Number.POSITIVE_INFINITY;
      if (!latest || elapsed >= 15_000) {
        const { error: logError } = await supabase
          .from("telemetry_logs")
          .insert({
            avg_temp: payload.avgTemp ?? null,
            avg_rh: payload.avgRH ?? null,
            pump_status: payload.pompa,
            phase: payload.fase ?? null,
            sensors: payload.sensors,
          });
        if (logError) throw logError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Payload tidak valid";

    console.error("[Webhook Error]", error);
    return NextResponse.json({ error: message }, { status });
  }
}
