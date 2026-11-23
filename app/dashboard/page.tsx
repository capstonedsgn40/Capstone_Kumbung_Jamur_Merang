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
  Cloud,
  Droplets,
  Gauge,
  LogOut,
  Power,
  ShieldCheck,
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
    <main className="min-h-screen bg-[#fff9fb] text-[#3b2a33]">
      <header className="sticky top-0 z-20 border-b border-[#f6d5e1]/80 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ec5f96] text-white shadow-[0_10px_24px_rgba(236,95,150,.20)]">
              <Sprout size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#ec5f96] sm:text-xs">
                Sistem Monitoring
              </p>
              <h1 className="truncate text-lg font-bold sm:text-xl">
                Kumbung Jamur
              </h1>
              <p className="hidden text-xs text-[#8a7580] md:block">
                Monitoring suhu, kelembapan, dan pengkabutan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`hidden items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold sm:flex ${critical ? "border-red-200 bg-red-50 text-[#e5484d]" : online ? "border-emerald-100 bg-emerald-50 text-[#22a06b]" : "border-slate-200 bg-slate-100 text-[#9ca3af]"}`}
            >
              {critical ? <WifiOff size={15} /> : <Wifi size={15} />}
              <span
                className={
                  online && !critical
                    ? "live-dot h-2 w-2 rounded-full bg-[#22a06b]"
                    : "h-2 w-2 rounded-full bg-current"
                }
              />
              {critical ? "SENSOR ERROR" : online ? "LIVE" : "OFFLINE"}
            </div>
            <button
              onClick={logout}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#f6d5e1] text-[#8a7580] transition hover:border-[#ec5f96] hover:bg-[#ffe4ee] hover:text-[#ec5f96]"
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
        {critical && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-[#e5484d]">
            <WifiOff size={18} />
            CRITICAL_SENSOR_ERROR — Semua sensor gagal dibaca dan pompa dipaksa
            mati.
          </div>
        )}
        {!critical && !online && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-[#9ca3af]">
            <WifiOff size={18} />
            Perangkat OFFLINE — tidak ada pembaruan dalam 15 detik terakhir.
          </div>
        )}
        {toast && (
          <div className="mb-4 rounded-2xl border border-[#f6d5e1] bg-white px-4 py-3 text-sm text-[#3b2a33] shadow-[0_8px_24px_rgba(236,95,150,.08)]">
            {toast}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12">
          <article className="card-enter relative overflow-hidden rounded-[28px] border border-[#f6d5e1] bg-white p-5 shadow-[0_12px_38px_rgba(236,95,150,.10)] md:col-span-2 xl:col-span-5">
            <div
              className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#ffe4ee]/60 blur-2xl"
              aria-hidden="true"
            />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8a7580]">
                  Kondisi Kumbung
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {status?.phase === "GENERATIF"
                    ? "Fase Generatif"
                    : "Fase Vegetatif"}
                </h2>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${status?.pump_status ? "bg-emerald-50 text-[#22a06b]" : "bg-slate-100 text-[#9ca3af]"}`}
              >
                Pompa {status?.pump_status ? "ON" : "OFF"}
              </span>
            </div>

            <div className="relative mt-5 grid grid-cols-[150px_1fr] items-center gap-4 max-[420px]:grid-cols-1">
              <div
                className="relative mx-auto aspect-square w-[150px] max-w-full rounded-full p-3"
                style={{
                  background: `conic-gradient(#ec5f96 ${Math.min(Math.max(status?.avg_rh ?? 0, 0), 100) * 3.6}deg, #ffe4ee 0deg)`,
                }}
              >
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white shadow-inner">
                  <Droplets className="mb-1 text-[#ec5f96]" size={20} />
                  <b className="text-3xl tabular-nums">
                    {status?.avg_rh == null
                      ? "—"
                      : `${status.avg_rh.toFixed(1)}%`}
                  </b>
                  <span className="text-xs text-[#8a7580]">RH Rata-rata</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 max-[420px]:grid-cols-2">
                <div className="rounded-2xl bg-[#fff9fb] p-3">
                  <Thermometer className="text-[#ec5f96]" size={18} />
                  <p className="mt-2 text-[11px] text-[#8a7580]">
                    Suhu rata-rata
                  </p>
                  <p className="mt-1 text-xl font-bold tabular-nums">
                    {status?.avg_temp == null
                      ? "—"
                      : `${status.avg_temp.toFixed(1)}°C`}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#fff9fb] p-3">
                  <Gauge className="text-[#ec5f96]" size={18} />
                  <p className="mt-2 text-[11px] text-[#8a7580]">Rentang RH</p>
                  <p className="mt-1 text-sm font-bold tabular-nums">
                    {status?.active_lower_rh ?? "—"}%–
                    {status?.active_upper_rh ?? "—"}%
                  </p>
                </div>
              </div>
            </div>
            {status?.pump_status && (
              <div
                className="mist-drops absolute bottom-3 right-4 flex gap-1 text-[#ec5f96]"
                aria-hidden="true"
              >
                <span className="h-2 w-2 rounded-full bg-[#ec5f96]/30" />
                <span className="h-2 w-2 rounded-full bg-[#ec5f96]/50" />
                <span className="h-2 w-2 rounded-full bg-[#ec5f96]/70" />
              </div>
            )}
          </article>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-2 xl:col-span-7">
            <Kpi
              icon={<Thermometer size={20} />}
              label="Rata-rata Suhu"
              value={
                status?.avg_temp == null
                  ? "—"
                  : `${status.avg_temp.toFixed(1)}°C`
              }
              tone="pink"
            />
            <Kpi
              icon={<Droplets size={20} />}
              label="Rata-rata Kelembapan"
              value={
                status?.avg_rh == null ? "—" : `${status.avg_rh.toFixed(1)}%`
              }
              tone="pink"
            />
            <Kpi
              icon={<Power size={20} />}
              label="Status Pompa"
              value={status?.pump_status ? "ON" : "OFF"}
              tone={status?.pump_status ? "green" : "gray"}
            />
            <Kpi
              icon={<Cloud size={20} />}
              label="Sensor Aktif"
              value={`${status?.active_count ?? 0} / 6`}
              tone="pink"
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <article className="card-enter rounded-[24px] border border-[#f6d5e1] bg-white p-5 shadow-[0_10px_35px_rgba(236,95,150,.07)]">
            <div className="flex items-center gap-2">
              <Sprout size={19} className="text-[#ec5f96]" />
              <h2 className="font-bold">Fase & Mode</h2>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-sm text-[#8a7580]">Fase Aktif</p>
              <div className="grid grid-cols-2 rounded-2xl bg-[#fff9fb] p-1.5">
                <button
                  disabled={!online || busy}
                  onClick={() => command({ type: "CONFIG", fase: "VEGETATIF" })}
                  className={`min-h-11 rounded-xl text-sm font-bold transition ${status?.phase === "VEGETATIF" ? "bg-[#ec5f96] text-white shadow-[0_6px_16px_rgba(236,95,150,.16)]" : "text-[#8a7580]"}`}
                >
                  Vegetatif
                </button>
                <button
                  disabled={!online || busy}
                  onClick={() => command({ type: "CONFIG", fase: "GENERATIF" })}
                  className={`min-h-11 rounded-xl text-sm font-bold transition ${status?.phase === "GENERATIF" ? "bg-[#ec5f96] text-white shadow-[0_6px_16px_rgba(236,95,150,.16)]" : "text-[#8a7580]"}`}
                >
                  Generatif
                </button>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-[#8a7580]">Mode Operasi</p>
                <p className="mt-1 font-bold">
                  {status?.mode_auto ? "AUTO" : "MANUAL"}
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
                aria-label="Ubah mode operasi"
                className={`relative h-9 w-16 rounded-full transition ${status?.mode_auto ? "bg-[#ec5f96]" : "bg-[#d7cdd1]"} disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition ${status?.mode_auto ? "left-8" : "left-1"}`}
                />
              </button>
            </div>
          </article>

          <article className="card-enter rounded-[24px] border border-[#f6d5e1] bg-white p-5 shadow-[0_10px_35px_rgba(236,95,150,.07)]">
            <div className="flex items-center gap-2">
              <ShieldCheck size={19} className="text-[#ec5f96]" />
              <h2 className="font-bold">Kontrol Pompa Manual</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="mt-5 flex justify-center">
                <button
                  disabled={!manualEnabled || busy}
                  onClick={() => pumpAction(!status?.pump_status)}
                  className={`flex h-28 w-28 items-center justify-center rounded-full text-sm font-extrabold tracking-wide text-white transition-all duration-150 active:translate-y-1 active:scale-[.97] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-[0_7px_0_#cbd5e1] ${status?.pump_status ? "bg-[#e5484d] shadow-[0_9px_0_#b92f35,0_14px_22px_rgba(229,72,77,.24)] hover:bg-[#ef5a60]" : "bg-[#22a06b] shadow-[0_9px_0_#16784e,0_14px_22px_rgba(34,160,107,.24)] hover:bg-[#2caf76]"}`}
                  aria-label={
                    status?.pump_status ? "Matikan pompa" : "Nyalakan pompa"
                  }
                >
                  {status?.pump_status ? "MATIKAN" : "NYALAKAN"}
                </button>
              </div>
            </div>
            {confirmPump !== null && (
              <p className="mt-3 text-sm font-semibold text-[#ec5f96]">
                Menunggu konfirmasi perangkat...
              </p>
            )}
            {!status?.mode_auto && !online && (
              <p className="mt-3 text-xs text-[#8a7580]">
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
          className="mt-4 min-h-12 w-full rounded-2xl bg-[#ec5f96] px-8 py-3 font-bold text-white shadow-[0_10px_24px_rgba(236,95,150,.16)] transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          Simpan Pengaturan RH
        </button>

        <article className="mt-5 rounded-[24px] border border-[#f6d5e1] bg-white p-5 shadow-[0_10px_35px_rgba(236,95,150,.07)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Sensor DHT22 — 6 Titik Rak</h2>
            <span className="text-xs font-bold text-[#8a7580]">
              {status?.active_count ?? 0}/6 aktif
            </span>
          </div>
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

        <article className="mt-5 rounded-[24px] border border-[#f6d5e1] bg-white p-5 shadow-[0_10px_35px_rgba(236,95,150,.07)]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a7580]">
                Monitoring Historis
              </p>
              <h2 className="mt-1 font-bold">Grafik Riwayat</h2>
            </div>
            <div className="grid grid-cols-4 rounded-2xl bg-[#fff9fb] p-1.5">
              {["1h", "6h", "24h", "7d"].map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setRange(item);
                    void loadHistory(item);
                  }}
                  className={`min-h-9 rounded-xl px-3 text-xs font-bold transition ${range === item ? "bg-[#ffe4ee] text-[#ec5f96]" : "text-[#8a7580]"}`}
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
          <div className="mb-3 flex flex-wrap gap-4 text-xs font-bold">
            <span className="flex items-center gap-2 text-[#ec5f96]">
              <i className="h-2.5 w-2.5 rounded-full bg-[#ec5f96]" />
              Suhu °C
            </span>
            <span className="flex items-center gap-2 text-[#d67ba1]">
              <i className="h-2.5 w-2.5 rounded-full bg-[#d67ba1]" />
              RH %
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="temp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec5f96" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#ec5f96" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d67ba1" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#d67ba1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f6d5e1" />
                <XAxis
                  dataKey="created_at"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                  tick={{ fontSize: 11, fill: "#8a7580" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#8a7580" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 16,
                    border: "1px solid #f6d5e1",
                    boxShadow: "0 10px 30px rgba(236,95,150,.12)",
                  }}
                  labelFormatter={(value) =>
                    new Date(String(value)).toLocaleString("id-ID")
                  }
                />
                <Area
                  type="monotone"
                  dataKey="avg_temp"
                  name="Suhu °C"
                  stroke="#ec5f96"
                  strokeWidth={2.5}
                  fill="url(#temp)"
                />
                <Area
                  type="monotone"
                  dataKey="avg_rh"
                  name="RH %"
                  stroke="#d67ba1"
                  strokeWidth={2.5}
                  fill="url(#rh)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <p className="mt-5 text-center text-xs text-[#8a7580]">
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
    pink: "bg-[#ffe4ee] text-[#ec5f96]",
    green: "bg-emerald-50 text-[#22a06b]",
    gray: "bg-slate-100 text-[#9ca3af]",
  };
  return (
    <article className="card-enter rounded-3xl border border-[#f6d5e1] bg-white p-5 shadow-[0_10px_35px_rgba(236,95,150,.07)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#8a7580]">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-[#3b2a33]">
            {value}
          </p>
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
    <article className="rounded-3xl border border-[#f6d5e1] bg-white p-5 shadow-[0_10px_35px_rgba(236,95,150,.06)]">
      <h3 className="font-bold">Fase {title}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold text-[#8a7580]">
          Batas Bawah
          <input
            type="number"
            min="0"
            max="100"
            value={value.bawah}
            onChange={(event) =>
              onChange({ ...value, bawah: Number(event.target.value) })
            }
            className="mt-2 w-full rounded-xl border border-[#f6d5e1] bg-[#fffafb] px-3 py-3 tabular-nums text-[#3b2a33] outline-none transition focus:border-[#ec5f96] focus:ring-4 focus:ring-[#ffe4ee]"
          />
        </label>
        <label className="text-sm font-semibold text-[#8a7580]">
          Batas Atas
          <input
            type="number"
            min="0"
            max="100"
            value={value.atas}
            onChange={(event) =>
              onChange({ ...value, atas: Number(event.target.value) })
            }
            className="mt-2 w-full rounded-xl border border-[#f6d5e1] bg-[#fffafb] px-3 py-3 tabular-nums text-[#3b2a33] outline-none transition focus:border-[#ec5f96] focus:ring-4 focus:ring-[#ffe4ee]"
          />
        </label>
      </div>
    </article>
  );
}

function SensorCard({ sensor }: { sensor: Sensor }) {
  return (
    <article
      className={`rounded-2xl border p-4 ${sensor.ok ? "border-emerald-100 bg-emerald-50/30" : "border-slate-200 bg-slate-50/70"}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a7580]">
            {sensor.id <= 3 ? "Rak Kiri" : "Rak Kanan"}
          </p>
          <h3 className="mt-0.5 font-bold">
            Titik {sensor.id} —{" "}
            {["Atas", "Tengah", "Bawah"][(sensor.id - 1) % 3]}
          </h3>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${sensor.ok ? "bg-emerald-50 text-[#22a06b]" : "bg-slate-100 text-[#9ca3af]"}`}
        >
          <i
            className={`h-2 w-2 rounded-full ${sensor.ok ? "bg-[#22a06b]" : "bg-[#9ca3af]"}`}
          />
          {sensor.ok ? "NORMAL" : "OFFLINE"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <p className="rounded-xl bg-white/80 p-2.5">
          <span className="text-xs text-[#8a7580]">Suhu</span>
          <br />
          <b className="tabular-nums">
            {sensor.ok && sensor.t != null ? `${sensor.t.toFixed(1)} °C` : "—"}
          </b>
        </p>
        <p className="rounded-xl bg-white/80 p-2.5">
          <span className="text-xs text-[#8a7580]">RH</span>
          <br />
          <b className="tabular-nums">
            {sensor.ok && sensor.h != null ? `${sensor.h.toFixed(1)} %` : "—"}
          </b>
        </p>
      </div>
      <p className="mt-3 text-xs text-[#8a7580]">
        GPIO {sensor.pin} · {sensor.ok ? "Sensor OK" : "Sensor offline"}
      </p>
    </article>
  );
}
