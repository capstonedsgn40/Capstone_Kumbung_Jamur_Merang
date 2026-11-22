"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Telemetry = {
  suhu: number;
  kelembapan: number;
  pompaStatus: boolean;
  modeAuto: boolean;
  batasBawahRH: number;
  value_updated_at?: string | null;
};

export default function Home() {
  const router = useRouter();
  const [now, setNow] = useState(() => 0);
  const [data, setData] = useState<Telemetry | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/iot", { cache: "no-store" });
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Gagal memuat telemetry");
      setData(result);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Gagal terhubung ke server",
      );
    }
  }, [router]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      setNow(Date.now());
      void refresh();
    }, 0);
    const timer = window.setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    const updateVisibility = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, [refresh]);

  async function update(
    payload: Partial<
      Pick<Telemetry, "pompaStatus" | "modeAuto" | "batasBawahRH">
    >,
  ) {
    setLoading(true);
    setToast("");
    try {
      const response = await fetch("/api/iot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Perintah gagal dikirim");
      setData((current) => (current ? { ...current, ...payload } : current));
      setToast("Perintah berhasil dikirim");
      await refresh();
    } catch (reason) {
      setToast(
        reason instanceof Error ? reason.message : "Perintah gagal dikirim",
      );
    } finally {
      setLoading(false);
    }
  }

  const latest = data?.value_updated_at
    ? new Date(data.value_updated_at).getTime()
    : 0;
  const offline = !latest || now - latest > 3 * 60 * 1000;
  const humidityStatus =
    !data || !Number.isFinite(data.kelembapan)
      ? "Data tidak valid"
      : data.kelembapan < 60
        ? "Terlalu Kering"
        : data.kelembapan > 95
          ? "Terlalu Lembap"
          : "Normal";

  return (
    <main className="min-h-screen bg-[#eef4ef] text-slate-900">
      <header className="border-b border-emerald-900/5 bg-white/90 px-4 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-xl shadow-lg shadow-emerald-600/20">
              🍄
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Kumbung Jamur
              </p>
              <h1 className="text-lg font-bold sm:text-xl">Mist Control</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full ${offline ? "bg-red-500" : "bg-emerald-500"}`}
            />
            {offline ? "Offline" : "Terhubung"}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl p-4 sm:p-8">
        {offline && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Perangkat Offline / Sinyal Kumbung Terputus
          </div>
        )}
        {error && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            ⚠️ {error}
          </div>
        )}
        {toast && (
          <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl">
            {toast}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Suhu Udara</p>
                <p className="mt-2 text-4xl font-bold">
                  {Number.isFinite(data?.suhu) ? data?.suhu.toFixed(1) : "—"}
                  <span className="ml-1 text-xl text-slate-400">°C</span>
                </p>
              </div>
              <div className="rounded-2xl bg-orange-50 px-3 py-2 text-2xl">
                🌡️
              </div>
            </div>
          </article>
          <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Kelembapan</p>
                <p className="mt-2 text-4xl font-bold">
                  {Number.isFinite(data?.kelembapan)
                    ? data?.kelembapan.toFixed(1)
                    : "—"}
                  <span className="ml-1 text-xl text-slate-400">%</span>
                </p>
                <p className="mt-2 text-sm font-semibold text-emerald-700">
                  {humidityStatus}
                </p>
              </div>
              <div className="rounded-2xl bg-sky-50 px-3 py-2 text-2xl">💧</div>
            </div>
          </article>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Mode Operasi</p>
                <h2 className="mt-1 text-xl font-bold">
                  {data?.modeAuto ? "Otomatis" : "Manual"}
                </h2>
              </div>
              <button
                disabled={offline || loading}
                onClick={() => update({ modeAuto: !data?.modeAuto })}
                className={`relative h-8 w-14 rounded-full transition ${data?.modeAuto ? "bg-emerald-600" : "bg-slate-300"} disabled:cursor-not-allowed disabled:opacity-50`}
                aria-label="Ganti mode"
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${data?.modeAuto ? "left-7" : "left-1"}`}
                />
              </button>
            </div>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-sm font-medium text-slate-500">
                Status Mist Nozzle
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {data?.pompaStatus ? "NYALA" : "MATI"}
                </span>
                <span
                  className={`h-4 w-4 rounded-full ${data?.pompaStatus ? "bg-sky-500 shadow-[0_0_18px_rgba(14,165,233,.7)]" : "bg-slate-300"}`}
                />
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Kontrol Manual</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                disabled={offline || loading || data?.modeAuto}
                onClick={() => update({ pompaStatus: true, modeAuto: false })}
                className="rounded-xl bg-sky-600 py-4 font-bold text-white shadow-lg shadow-sky-600/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Nyalakan
              </button>
              <button
                disabled={offline || loading || data?.modeAuto}
                onClick={() => update({ pompaStatus: false, modeAuto: false })}
                className="rounded-xl bg-slate-800 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Matikan
              </button>
            </div>
            {data?.modeAuto && (
              <p className="mt-3 text-xs text-slate-500">
                Matikan mode otomatis untuk menggunakan kontrol manual.
              </p>
            )}
          </article>

          <article className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Target Kelembapan Minimal
                </p>
                <p className="mt-1 text-3xl font-bold text-emerald-700">
                  {data?.batasBawahRH ?? 80}%
                </p>
              </div>
              <p className="text-xs text-slate-400">60–90%</p>
            </div>
            <input
              type="range"
              min="60"
              max="90"
              step="1"
              value={data?.batasBawahRH ?? 80}
              disabled={offline || loading}
              onChange={(event) =>
                setData((current) =>
                  current
                    ? { ...current, batasBawahRH: Number(event.target.value) }
                    : current,
                )
              }
              onMouseUp={(event) =>
                update({ batasBawahRH: Number(event.currentTarget.value) })
              }
              onTouchEnd={(event) =>
                update({ batasBawahRH: Number(event.currentTarget.value) })
              }
              className="mt-5 h-2 w-full cursor-pointer accent-emerald-600 disabled:opacity-40"
            />
          </article>
        </div>
      </section>
    </main>
  );
}
