import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { publishMqtt } from "@/lib/mqtt-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const thresholdSchema = z
  .object({
    bawah: z.number().min(0).max(100),
    atas: z.number().min(0).max(100),
  })
  .refine((value) => value.bawah < value.atas, {
    message: "Batas bawah harus lebih kecil dari batas atas",
  });

const controlSchema = z
  .object({
    type: z.literal("CONTROL"),
    modeAuto: z.boolean(),
    pompa: z.boolean().optional(),
  })
  .strict();

const configSchema = z
  .object({
    type: z.literal("CONFIG"),
    fase: z.enum(["VEGETATIF", "GENERATIF"]).optional(),
    vegetatif: thresholdSchema.optional(),
    generatif: thresholdSchema.optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Belum login" }, { status: 401 });

  try {
    const body = await request.json();
    if (body.type === "CONTROL") {
      const payload = controlSchema.parse(body);
      await publishMqtt(
        "control",
        payload.type === "CONTROL"
          ? {
              modeAuto: payload.modeAuto,
              ...(payload.pompa !== undefined ? { pompa: payload.pompa } : {}),
            }
          : {},
      );
      return NextResponse.json({ success: true });
    }
    if (body.type === "CONFIG") {
      const payload = configSchema.parse(body);
      const mqttPayload: Record<string, unknown> = {};
      if (payload.fase) mqttPayload.fase = payload.fase;
      if (payload.vegetatif) mqttPayload.vegetatif = payload.vegetatif;
      if (payload.generatif) mqttPayload.generatif = payload.generatif;
      await publishMqtt("config", mqttPayload);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      { error: "Tipe perintah tidak valid" },
      { status: 400 },
    );
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Gagal mengirim perintah",
      },
      { status },
    );
  }
}
