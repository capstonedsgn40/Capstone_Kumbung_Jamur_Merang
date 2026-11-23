"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Gauge,
  LogOut,
  Power,
  Sprout,
  Thermometer,
  Wifi,
  WifiOff,
} from "lucide-react";

type Sensor = {
  id: number;
  pin: number;
  ok: boolean;
  t: number | null;
  h: number | null;
};
type Config = {
  vegetatif: { bawah: number; atas: number };
  generatif: { bawah: number; atas: number };
};
type Status = {
  device_status: "ONLINE" | "CRITICAL_SENSOR_ERROR" | "OFFLINE";
  avg_temp: number | null;
  avg_rh: number | null;
  active_count: number;
  pump_status: boolean;
  mode_auto: boolean;
  phase: "VEGETATIF" | "GENERATIF";
  active_lower_rh: number;
  active_upper_rh: number;
  config: Config;
  sensors: Sensor[];
  updated_at: string;
};
type HistoryItem = {
  created_at: string;
  avg_temp: number | null;
  avg_rh: number | null;
};

const defaults: Config = {
  vegetatif: { bawah: 70, atas: 80 },
  generatif: { bawah: 85, atas: 92 },
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      typeof window === "undefined" ? null : createSupabaseBrowserClient(),
    [],
  );
  const [status, setStatus] = useState<Status | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [range, setRange] = useState("1h");
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [veg, setVeg] = useState(defaults.vegetatif);
  const [gen, setGen] = useState(defaults.generatif);
  const [confirmPump, setConfirmPump] = useState<boolean | null>(null);

  const loadStatus = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("device_status")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      const next = data as Status;
      setStatus(next);
    }
  }, [supabase]);

  const loadHistory = useCallback(
    async (selectedRange: string) => {
      const response = await fetch(
        `/api/telemetry/history?range=${selectedRange}`,
        { cache: "no-store" },
      );
      if (response.status === 401) router.push("/login");
      if (response.ok) {
        const result = await response.json();
        setHistory(result.data ?? []);
      }
    },
    [router],
  );

  useEffect(() => {
    let timer: number;
    const setup = async () => {
      await loadStatus();
      await loadHistory(range);
      setNow(Date.now());
      timer = window.setInterval(() => setNow(Date.now()), 1000);
    };
    void setup();

    const channel = supabase
      ?.channel("device-status-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_status",
          filter: "id=eq.1",
        },
        (payload) => {
          const next = payload.new as Status;
          setStatus(next);
          setNow(Date.now());
          setConfirmPump(null);
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(timer);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [loadHistory, loadStatus, range, supabase]);

  async function command(payload: object) {
    setBusy(true);
    setToast("");
    const response = await fetch("/api/mqtt/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) setToast(result.error || "Perintah gagal dikirim");
    else setToast("Perintah dikirim. Menunggu konfirmasi ESP32...");
    setBusy(false);
  }

  const updatedAt = status?.updated_at
    ? new Date(status.updated_at).getTime()
    : 0;
  const online =
    !!updatedAt &&
    now - updatedAt <= 15_000 &&
    status?.device_status !== "CRITICAL_SENSOR_ERROR";
  const critical = status?.device_status === "CRITICAL_SENSOR_ERROR";
  const manualEnabled = online && status?.mode_auto === false;

  function pumpAction(value: boolean) {
    if (!manualEnabled) return;
    setConfirmPump(value);
    void command({ type: "CONTROL", modeAuto: false, pompa: value });
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function saveConfig() {
    await command({ type: "CONFIG", vegetatif: veg, generatif: gen });
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-slate-800">
      <header className="border-b border-pink-100/70 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#d99aad] text-white">
              <Sprout size={23} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#c7899b]">
                Sistem Monitoring
              </p>
              <h1 className="text-lg font-bold sm:text-xl">Kumbung Jamur</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-bold sm:flex ${critical ? "bg-red-50 text-red-700" : online ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
            >
              {critical ? <WifiOff size={15} /> : <Wifi size={15} />}
              {critical ? "SENSOR ERROR" : online ? "ONLINE" : "OFFLINE"}
            </div>
            <button
              onClick={logout}
              className="rounded-xl border border-pink-100 p-2.5 text-slate-500 hover:bg-pink-50"
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {critical && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            CRITICAL_SENSOR_ERROR — Semua sensor gagal dibaca dan pompa dipaksa
            mati.
          </div>
        )}
        {!critical && !online && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
            Perangkat OFFLINE — tidak ada pembaruan dalam 15 detik terakhir.
          </div>
        )}
        {toast && (
          <div className="mb-4 rounded-2xl border border-pink-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
            {toast}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            icon={<Thermometer />}
            label="Rata-rata Suhu"
            value={
              status?.avg_temp == null ? "—" : `${status.avg_temp.toFixed(1)}°C`
            }
            tone="pink"
          />
          <Kpi
            icon={<Activity />}
            label="Rata-rata Kelembapan"
            value={
              status?.avg_rh == null ? "—" : `${status.avg_rh.toFixed(1)}%`
            }
            tone="blue"
          />
          <Kpi
            icon={<Power />}
            label="Status Pompa"
            value={status?.pump_status ? "ON" : "OFF"}
            tone={status?.pump_status ? "green" : "gray"}
          />
          <Kpi
            icon={<Gauge />}
            label="Sensor Aktif"
            value={`${status?.active_count ?? 0} / 6`}
            tone="pink"
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-[24px] border border-pink-100/70 bg-white p-5 shadow-[0_10px_35px_rgba(200,137,155,.06)]">
            <h2 className="font-bold">Fase & Mode</h2>
            <div className="mt-4">
              <p className="mb-2 text-sm text-slate-500">Fase Aktif</p>
              <div className="grid grid-cols-2 rounded-xl bg-slate-50 p-1">
                <button
                  disabled={!online || busy}
                  onClick={() => command({ type: "CONFIG", fase: "VEGETATIF" })}
                  className={`rounded-lg py-2.5 text-sm font-bold ${status?.phase === "VEGETATIF" ? "bg-[#d99aad] text-white" : "text-slate-500"}`}
                >
                  Vegetatif
                </button>
                <button
                  disabled={!online || busy}
                  onClick={() => command({ type: "CONFIG", fase: "GENERATIF" })}
                  className={`rounded-lg py-2.5 text-sm font-bold ${status?.phase === "GENERATIF" ? "bg-[#d99aad] text-white" : "text-slate-500"}`}
                >
                  Generatif
                </button>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Mode Operasi</p>
                <p className="mt-1 font-bold">
                  {status?.mode_auto ? "AUTOMATIS" : "MANUAL"}
                </p>
              </div>
              <button
                disabled={!online || busy}
                onClick={() =>
                  command({
                    type: "CONTROL",
                    modeAuto: !status?.mode_auto,
                    pompa: status?.mode_auto ? false : status?.pump_status,
                  })
                }
                className={`relative h-8 w-14 rounded-full ${status?.mode_auto ? "bg-[#d99aad]" : "bg-slate-300"} disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${status?.mode_auto ? "left-7" : "left-1"}`}
                />
              </button>
            </div>
          </article>

          <article className="rounded-[24px] border border-pink-100/70 bg-white p-5 shadow-[0_10px_35px_rgba(200,137,155,.06)]">
            <h2 className="font-bold">Kontrol Pompa Manual</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                disabled={!manualEnabled || busy}
                onClick={() => pumpAction(true)}
                className="rounded-xl bg-emerald-600 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                NYALAKAN
              </button>
              <button
                disabled={!manualEnabled || busy}
                onClick={() => pumpAction(false)}
                className="rounded-xl bg-slate-700 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                MATIKAN
              </button>
            </div>
            {confirmPump !== null && (
              <p className="mt-3 text-sm font-semibold text-[#b86f85]">
                Menunggu konfirmasi perangkat...
              </p>
            )}
            {!status?.mode_auto && !online && (
              <p className="mt-3 text-xs text-slate-500">
                Kontrol dinonaktifkan karena perangkat offline.
              </p>
            )}
          </article>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <ThresholdForm title="Vegetatif" value={veg} onChange={setVeg} />
          <ThresholdForm title="Generatif" value={gen} onChange={setGen} />
        </div>
        <button
          disabled={!online || busy}
          onClick={saveConfig}
          className="mt-4 w-full rounded-xl bg-[#d99aad] py-3 font-bold text-white shadow-lg shadow-pink-100 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-8"
        >
          Simpan Pengaturan RH
        </button>

        <article className="mt-5 rounded-[24px] border border-pink-100/70 bg-white p-5 shadow-[0_10px_35px_rgba(200,137,155,.06)]">
          <h2 className="mb-4 font-bold">Sensor DHT22 — 6 Titik Rak</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from(
              { length: 6 },
              (_, index) =>
                status?.sensors?.find((sensor) => sensor.id === index + 1) ?? {
                  id: index + 1,
                  pin: [4, 16, 17, 18, 19, 23][index],
                  ok: false,
                  t: null,
                  h: null,
                },
            ).map((sensor) => (
              <SensorCard key={sensor.id} sensor={sensor} />
            ))}
          </div>
        </article>

        <article className="mt-5 rounded-[24px] border border-pink-100/70 bg-white p-5 shadow-[0_10px_35px_rgba(200,137,155,.06)]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">Grafik Riwayat</h2>
            <div className="flex rounded-xl bg-slate-50 p-1">
              {["1h", "6h", "24h", "7d"].map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setRange(item);
                    void loadHistory(item);
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-bold ${range === item ? "bg-white text-[#c7899b] shadow-sm" : "text-slate-500"}`}
                >
                  {item === "1h"
                    ? "1 Jam"
                    : item === "6h"
                      ? "6 Jam"
                      : item === "24h"
                        ? "24 Jam"
                        : "7 Hari"}
                </button>
              ))}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="temp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e09aae" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#e09aae" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7aaac5" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7aaac5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1e4e8" />
                <XAxis
                  dataKey="created_at"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(value) =>
                    new Date(String(value)).toLocaleString("id-ID")
                  }
                />
                <Area
                  type="monotone"
                  dataKey="avg_temp"
                  name="Suhu °C"
                  stroke="#d99aad"
                  fill="url(#temp)"
                />
                <Area
                  type="monotone"
                  dataKey="avg_rh"
                  name="RH %"
                  stroke="#7aaac5"
                  fill="url(#rh)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <p className="mt-5 text-center text-xs text-slate-400">
          Pembaruan terakhir:{" "}
          {status?.updated_at
            ? new Date(status.updated_at).toLocaleString("id-ID")
            : "Belum ada data"}
        </p>
      </section>
    </main>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: string;
}) {
  const tones: Record<string, string> = {
    pink: "bg-pink-50 text-[#c7899b]",
    blue: "bg-sky-50 text-sky-600",
    green: "bg-emerald-50 text-emerald-600",
    gray: "bg-slate-100 text-slate-500",
  };
  return (
    <article className="rounded-[24px] border border-pink-100/70 bg-white p-5 shadow-[0_10px_35px_rgba(200,137,155,.05)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${tones[tone]}`}>{icon}</div>
      </div>
    </article>
  );
}

function ThresholdForm({
  title,
  value,
  onChange,
}: {
  title: string;
  value: { bawah: number; atas: number };
  onChange: (value: { bawah: number; atas: number }) => void;
}) {
  return (
    <article className="rounded-[24px] border border-pink-100/70 bg-white p-5">
      <h3 className="font-bold">Fase {title}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm text-slate-500">
          Batas Bawah
          <input
            type="number"
            min="0"
            max="100"
            value={value.bawah}
            onChange={(event) =>
              onChange({ ...value, bawah: Number(event.target.value) })
            }
            className="mt-2 w-full rounded-xl border border-pink-100 px-3 py-2.5 text-slate-800"
          />
        </label>
        <label className="text-sm text-slate-500">
          Batas Atas
          <input
            type="number"
            min="0"
            max="100"
            value={value.atas}
            onChange={(event) =>
              onChange({ ...value, atas: Number(event.target.value) })
            }
            className="mt-2 w-full rounded-xl border border-pink-100 px-3 py-2.5 text-slate-800"
          />
        </label>
      </div>
    </article>
  );
}

function SensorCard({ sensor }: { sensor: Sensor }) {
  return (
    <article
      className={`rounded-2xl border p-4 ${sensor.ok ? "border-emerald-100 bg-emerald-50/30" : "border-red-100 bg-red-50/40"}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold">Titik {sensor.id}</h3>
        <span
          className={`h-2.5 w-2.5 rounded-full ${sensor.ok ? "bg-emerald-500" : "bg-red-500"}`}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <p>
          <span className="text-slate-400">Suhu</span>
          <br />
          <b>
            {sensor.ok && sensor.t != null ? `${sensor.t.toFixed(1)} °C` : "—"}
          </b>
        </p>
        <p>
          <span className="text-slate-400">RH</span>
          <br />
          <b>
            {sensor.ok && sensor.h != null ? `${sensor.h.toFixed(1)} %` : "—"}
          </b>
        </p>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        GPIO {sensor.pin} · {sensor.ok ? "OK" : "ERROR"}
      </p>
    </article>
  );
}
