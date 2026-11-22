import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getThingProperties, publishProperty } from "@/lib/arduino-cloud";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const updateSchema = z
  .object({
    pompaStatus: z.boolean().optional(),
    modeAuto: z.boolean().optional(),
    batasBawahRH: z.number().min(60).max(90).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Tidak ada nilai yang diperbarui",
  });

export async function GET() {
  try {
    const properties = await getThingProperties();
    const valueUpdatedAt = [
      properties.suhu,
      properties.kelembapan,
      properties.pompaStatus,
      properties.modeAuto,
      properties.batasBawahRH,
    ]
      .map((property) => property?.value_updated_at)
      .filter(Boolean)
      .sort()
      .at(-1);

    return NextResponse.json(
      {
        suhu: Number(properties.suhu?.value ?? NaN),
        kelembapan: Number(properties.kelembapan?.value ?? NaN),
        pompaStatus: Boolean(properties.pompaStatus?.value),
        modeAuto: Boolean(properties.modeAuto?.value),
        batasBawahRH: Number(properties.batasBawahRH?.value ?? 80),
        value_updated_at: valueUpdatedAt ?? null,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal terhubung ke Arduino Cloud",
      },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = updateSchema.parse(await request.json());

    for (const [name, value] of Object.entries(payload)) {
      await publishProperty(
        name as "pompaStatus" | "modeAuto" | "batasBawahRH",
        value as boolean | number,
      );
    }

    return NextResponse.json(
      { success: true, updated: payload },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : 502;
    const message =
      error instanceof z.ZodError
        ? error.issues.map((issue) => issue.message).join("; ")
        : error instanceof Error
          ? error.message
          : "Gagal memperbarui perangkat";
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
