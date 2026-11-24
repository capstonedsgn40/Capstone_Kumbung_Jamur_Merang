"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  SlidersHorizontal,
  Sprout,
  Thermometer,
  Wifi,
  WifiOff,
  X,
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
  vegetatif: { bawah: 80, atas: 88 },
  generatif: { bawah: 85, atas: 93 },
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const toastTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const toastRef = useRef("");
  const channelRef = useRef<ReturnType<
    NonNullable<typeof supabase>["channel"]
  > | null>(null);

  const clearFeedbackTimers = useCallback(() => {
    if (toastTimerRef.current !== null)
      window.clearTimeout(toastTimerRef.current);
    if (fallbackTimerRef.current !== null)
      window.clearTimeout(fallbackTimerRef.current);
  }, []);

  const showToast = useCallback(
    (message: string, confirmed = false) => {
      clearFeedbackTimers();
      toastRef.current = message;
      setToast(message);
      if (confirmed) {
        toastTimerRef.current = window.setTimeout(() => {
          toastRef.current = "";
          setToast("");
        }, 2_000);
      }
    },
    [clearFeedbackTimers],
  );

  const loadStatus = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("device_status")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      setStatus(data as Status);
      setNow(Date.now());
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

  const subscribeRealtime = useCallback(() => {
    if (!supabase) return;
    if (channelRef.current) void supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel("device-status-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "device_status",
          filter: "id=eq.1",
        },
        (payload) => {
          const next = payload.new as Status;
          setStatus(next);
          setNow(Date.now());
          setConfirmPump(null);
          if (
            toastRef.current.includes("Menunggu konfirmasi ESP32") ||
            toastRef.current.includes("Menunggu konfirmasi perangkat")
          ) {
            showToast("Konfirmasi diterima", true);
          }
        },
      )
      .subscribe((channelStatus) => {
        if (
          channelStatus === "TIMED_OUT" ||
          channelStatus === "CLOSED" ||
          channelStatus === "CHANNEL_ERROR"
        ) {
          void loadStatus();
        }
      });

    channelRef.current = channel;
  }, [loadStatus, supabase, showToast]);

  useEffect(() => {
    let timer: number;
    const setup = async () => {
      await loadStatus();
      await loadHistory(range);
      setNow(Date.now());
      subscribeRealtime();
      timer = window.setInterval(() => setNow(Date.now()), 1000);
    };
    void setup();

    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        void loadStatus();
        void loadHistory(range);
        const channelState = channelRef.current?.state;
        if (
          !channelState ||
          channelState === "closed" ||
          channelState === "errored"
        ) {
          subscribeRealtime();
        }
      }
    };

    document.addEventListener("visibilitychange", syncWhenVisible);
    window.addEventListener("focus", syncWhenVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.removeEventListener("focus", syncWhenVisible);
      clearFeedbackTimers();
      if (supabase && channelRef.current)
        void supabase.removeChannel(channelRef.current);
    };
  }, [
    loadHistory,
    loadStatus,
    range,
    supabase,
    subscribeRealtime,
    clearFeedbackTimers,
  ]);

  async function command(payload: object) {
    setBusy(true);
    setToast("");
    clearFeedbackTimers();
    const response = await fetch("/api/mqtt/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) showToast(result.error || "Perintah gagal dikirim");
    else {
      showToast("Perintah dikirim, menunggu konfirmasi ESP32...");
      fallbackTimerRef.current = window.setTimeout(() => setToast(""), 8_000);
    }
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
    setSettingsOpen(false);
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
                Kumbung Jamur Merang
              </h1>
              <p className="hidden text-xs text-[#8a7580] md:block">
                Capstone Project
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
              onClick={() => {
                if (status?.config) {
                  setVeg(status.config.vegetatif);
                  setGen(status.config.generatif);
                }
                setSettingsOpen(true);
              }}
              disabled={!online || busy}
              className="flex h-11 items-center gap-2 rounded-xl border border-[#f6d5e1] px-3 text-xs font-bold text-[#8a7580] transition hover:border-[#ec5f96] hover:bg-[#ffe4ee] hover:text-[#ec5f96] active:scale-95 disabled:opacity-50"
              aria-label="Atur Batas RH"
            >
              <SlidersHorizontal size={16} />
              <span className="hidden sm:inline">Atur Batas RH</span>
            </button>
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
            CRITICAL_SENSOR_ERROR: Semua sensor gagal dibaca dan pompa dipaksa
            mati.
          </div>
        )}
        {!critical && !online && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-[#9ca3af]">
            <WifiOff size={18} />
            Perangkat OFFLINE: tidak ada pembaruan dalam 15 detik terakhir.
          </div>
        )}


        <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-[#f6d5e1] bg-white p-2 shadow-[0_8px_24px_rgba(236,95,150,.06)] sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-[#fff9fb] px-3 py-2">
            <Power
              size={16}
              className={
                status?.pump_status ? "text-[#22a06b]" : "text-[#9ca3af]"
              }
            />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase text-[#8a7580]">
                Pompa
              </p>
              <p className="text-sm font-bold">
                {status?.pump_status ? "ON" : "OFF"}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-[#fff9fb] px-3 py-2">
            <Cloud size={16} className="text-[#0284c7]" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase text-[#8a7580]">
                Sensor Aktif
              </p>
              <p className="text-sm font-bold">
                {status?.active_count ?? 0} / 6
              </p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-[#fff9fb] px-3 py-2">
            <Sprout size={16} className="text-[#ec5f96]" />
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase text-[#8a7580]">
                Fase Aktif
              </p>
              <p className="truncate text-sm font-bold">
                {status?.phase === "GENERATIF" ? "GENERATIF" : "VEGETATIF"}
              </p>
            </div>
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
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#f6d5e1] px-3 text-xs font-bold transition hover:border-[#ec5f96] hover:bg-[#ffe4ee] active:scale-95 disabled:opacity-50"
            aria-label="Ubah mode operasi"
          >
            {status?.mode_auto ? "AUTO" : "MANUAL"}
            <span
              className={`relative h-6 w-11 rounded-full ${status?.mode_auto ? "bg-[#ec5f96]" : "bg-[#d7cdd1]"}`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${status?.mode_auto ? "left-6" : "left-1"}`}
              />
            </span>
          </button>
          <button
            disabled={!manualEnabled || busy}
            onClick={() => pumpAction(!status?.pump_status)}
            className="min-h-11 rounded-xl bg-[#ec5f96] px-3 text-xs font-bold text-white shadow-[0_6px_14px_rgba(236,95,150,.14)] transition hover:bg-[#db4f87] active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {confirmPump !== null
              ? "Menunggu..."
              : status?.pump_status
                ? "Matikan Pompa"
                : "Nyalakan Pompa"}
          </button>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          {status === null ? (
            <div className="skeleton h-28 rounded-3xl" />
          ) : (
            <Kpi
              icon={<Thermometer size={22} />}
              label="Rata-rata Suhu"
              value={
                status.avg_temp != null
                  ? `${status.avg_temp.toFixed(1)} \u00b0C`
                  : "Belum ada data"
              }
              tone="orange"
            />
          )}
          {status === null ? (
            <div className="skeleton h-28 rounded-3xl" />
          ) : (
            <Kpi
              icon={<Droplets size={22} />}
              label="Rata-rata Kelembapan (RH)"
              value={
                status.avg_rh != null
                  ? `${status.avg_rh.toFixed(1)} %`
                  : "Belum ada data"
              }
              tone="blue"
            />
          )}
        </div>

        <div className="mt-5">
          <article className="card-enter rounded-[24px] border border-[#f6d5e1] bg-white p-5 shadow-[0_10px_35px_rgba(236,95,150,.07)]">
            <div className="flex items-center gap-2">
              <Sprout size={19} className="text-[#ec5f96]" />
              <h2 className="font-bold">Fase Pertumbuhan</h2>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-sm text-[#8a7580]">Fase Aktif</p>
              <div className="grid grid-cols-2 rounded-2xl bg-[#fff9fb] p-1.5">
                <button
                  disabled={!online || busy}
                  onClick={() => command({ type: "CONFIG", fase: "VEGETATIF" })}
                  className={`min-h-11 rounded-xl text-sm font-bold transition active:scale-95 ${status?.phase === "VEGETATIF" ? "bg-[#ec5f96] text-white" : "text-[#8a7580]"}`}
                >
                  Vegetatif
                </button>
                <button
                  disabled={!online || busy}
                  onClick={() => command({ type: "CONFIG", fase: "GENERATIF" })}
                  className={`min-h-11 rounded-xl text-sm font-bold transition active:scale-95 ${status?.phase === "GENERATIF" ? "bg-[#ec5f96] text-white" : "text-[#8a7580]"}`}
                >
                  Generatif
                </button>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className={`rounded-2xl border p-3 ${status?.phase === "VEGETATIF" ? "border-[#f6d5e1] bg-[#fff9fb]" : "border-transparent bg-[#f8fafc]"}`}>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a7580]">Vegetatif</p>
                <p className="text-sm font-bold text-[#0284c7]">
                  {status?.config?.vegetatif
                    ? `${status.config.vegetatif.bawah}% – ${status.config.vegetatif.atas}%`
                    : "Belum ada data"}
                </p>
                <p className="mt-0.5 text-[10px] text-[#8a7580]">Batas RH</p>
              </div>
              <div className={`rounded-2xl border p-3 ${status?.phase === "GENERATIF" ? "border-[#f6d5e1] bg-[#fff9fb]" : "border-transparent bg-[#f8fafc]"}`}>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a7580]">Generatif</p>
                <p className="text-sm font-bold text-[#0284c7]">
                  {status?.config?.generatif
                    ? `${status.config.generatif.bawah}% – ${status.config.generatif.atas}%`
                    : "Belum ada data"}
                </p>
                <p className="mt-0.5 text-[10px] text-[#8a7580]">Batas RH</p>
              </div>
            </div>
          </article>
        </div>

        <div className="mt-5 rounded-[24px] border border-[#f6d5e1] bg-white p-5 shadow-[0_10px_35px_rgba(236,95,150,.07)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Sensor DHT22: 6 Titik Rak</h2>
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
        </div>

        <div className="mt-5 rounded-[24px] border border-[#f6d5e1] bg-white p-5 shadow-[0_10px_35px_rgba(236,95,150,.07)]">
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
            <span className="flex items-center gap-2 text-[#ea580c]">
              <i className="h-2.5 w-2.5 rounded-full bg-[#ea580c]" />
              Suhu °C
            </span>
            <span className="flex items-center gap-2 text-[#0284c7]">
              <i className="h-2.5 w-2.5 rounded-full bg-[#0284c7]" />
              RH %
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="temp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ea580c" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="rh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
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
                  stroke="#ea580c"
                  strokeWidth={2.5}
                  fill="url(#temp)"
                />
                <Area
                  type="monotone"
                  dataKey="avg_rh"
                  name="RH %"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  fill="url(#rh)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-[#8a7580]">
          Pembaruan terakhir:{" "}
          {status?.updated_at
            ? `${new Date(status.updated_at).toLocaleString("id-ID")}\u00a0\u00b7 ${relativeTime(status.updated_at, now)}`
            : "Belum ada data"}
        </p>
      </section>

      {settingsOpen && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}
        >
          <div className="drawer-enter sm:modal-enter w-full rounded-t-3xl border border-[#f6d5e1] bg-white p-6 shadow-[0_-6px_30px_rgba(236,95,150,.12)] sm:max-w-[600px] sm:rounded-2xl sm:shadow-[0_10px_35px_rgba(236,95,150,.07)]">
            <div className="mb-1 flex justify-center sm:hidden">
              <div className="h-1 w-10 rounded-full bg-[#f6d5e1]" />
            </div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Pengaturan Batas Kelembapan</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-full p-2 text-[#8a7580] transition hover:bg-[#f6d5e1]"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4">
              <ThresholdForm title="Vegetatif" value={veg} onChange={setVeg} />
              <ThresholdForm title="Generatif" value={gen} onChange={setGen} />
            </div>
            {(() => {
              const orig = status?.config;
              const diffs: { label: string; from: number; to: number }[] = [];
              if (orig) {
                if (veg.bawah !== orig.vegetatif.bawah)
                  diffs.push({ label: "Vegetatif batas bawah", from: orig.vegetatif.bawah, to: veg.bawah });
                if (veg.atas !== orig.vegetatif.atas)
                  diffs.push({ label: "Vegetatif batas atas", from: orig.vegetatif.atas, to: veg.atas });
                if (gen.bawah !== orig.generatif.bawah)
                  diffs.push({ label: "Generatif batas bawah", from: orig.generatif.bawah, to: gen.bawah });
                if (gen.atas !== orig.generatif.atas)
                  diffs.push({ label: "Generatif batas atas", from: orig.generatif.atas, to: gen.atas });
              }
              if (diffs.length === 0) return null;
              return (
                <div className="mt-3 rounded-2xl border border-[#f6d5e1] bg-[#fff9fb] px-4 py-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8a7580]">Perubahan yang akan disimpan</p>
                  <ul className="space-y-1">
                    {diffs.map((d) => (
                      <li key={d.label} className="flex items-center gap-2 text-sm">
                        <span className="text-[#8a7580]">{d.label}:</span>
                        <span className="font-bold tabular-nums text-[#9ca3af] line-through">{d.from}%</span>
                        <span className="text-[#8a7580]">&#8594;</span>
                        <span className="font-bold tabular-nums text-[#ec5f96]">{d.to}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
            <button
              disabled={!online || busy}
              onClick={saveConfig}
              className="mt-4 w-full rounded-2xl bg-[#ec5f96] px-8 py-3 font-bold text-white shadow-[0_10px_24px_rgba(236,95,150,.16)] transition active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Simpan Pengaturan RH
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast-float fixed bottom-6 right-4 z-50 flex max-w-[320px] items-center gap-3 rounded-2xl border border-[#f6d5e1] bg-white px-4 py-3 text-sm text-[#3b2a33] shadow-[0_16px_40px_rgba(236,95,150,.18)]">
          <Activity size={16} className="shrink-0 text-[#ec5f96]" />
          <span>{toast}</span>
        </div>
      )}
    </main>
  );
}

function relativeTime(isoString: string, now: number): string {
  const diff = Math.floor((now - new Date(isoString).getTime()) / 1000);
  if (diff < 5) return "baru saja";
  if (diff < 60) return `${diff} detik yang lalu`;
  if (diff < 3600) return `${Math.floor(diff / 60)} menit yang lalu`;
  return `${Math.floor(diff / 3600)} jam yang lalu`;
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
    orange: "bg-orange-50 text-[#ea580c]",
    blue: "bg-sky-50 text-[#0284c7]",
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
  const [bawahStr, setBawahStr] = useState(String(value.bawah));
  const [atasStr, setAtasStr] = useState(String(value.atas));

  // Sync string state when parent resets the value (e.g. modal reopen)
  useEffect(() => {
    setBawahStr(String(value.bawah));
  }, [value.bawah]);

  useEffect(() => {
    setAtasStr(String(value.atas));
  }, [value.atas]);

  const handleBawah = (raw: string) => {
    // Allow empty string and partial input like "" or "8" while typing
    if (raw === "" || /^\d{1,3}$/.test(raw)) {
      setBawahStr(raw);
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n >= 0 && n <= 100) onChange({ ...value, bawah: n });
    }
  };

  const handleAtas = (raw: string) => {
    if (raw === "" || /^\d{1,3}$/.test(raw)) {
      setAtasStr(raw);
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n >= 0 && n <= 100) onChange({ ...value, atas: n });
    }
  };

  const inputClass =
    "mt-2 w-full rounded-xl border border-[#f6d5e1] bg-[#fffafb] px-3 py-3 tabular-nums text-[#3b2a33] outline-none transition focus:border-[#ec5f96] focus:ring-4 focus:ring-[#ffe4ee]";

  return (
    <article className="rounded-3xl border border-[#f6d5e1] bg-white p-5 shadow-[0_10px_35px_rgba(236,95,150,.06)]">
      <h3 className="font-bold">Fase {title}</h3>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold text-[#8a7580]">
          Batas Bawah
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={bawahStr}
            onChange={(e) => handleBawah(e.target.value)}
            onBlur={() => {
              // Snap to last valid value on blur if field is empty
              if (bawahStr === "") setBawahStr(String(value.bawah));
            }}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-semibold text-[#8a7580]">
          Batas Atas
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={atasStr}
            onChange={(e) => handleAtas(e.target.value)}
            onBlur={() => {
              if (atasStr === "") setAtasStr(String(value.atas));
            }}
            className={inputClass}
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
            Titik {sensor.id}:{" "}
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
            {sensor.ok && sensor.t != null
              ? `${sensor.t.toFixed(1)} °C`
              : "Belum ada data"}
          </b>
        </p>
        <p className="rounded-xl bg-white/80 p-2.5">
          <span className="text-xs text-[#8a7580]">RH</span>
          <br />
          <b className="tabular-nums">
            {sensor.ok && sensor.h != null
              ? `${sensor.h.toFixed(1)} %`
              : "Belum ada data"}
          </b>
        </p>
      </div>
      <p className="mt-3 text-xs text-[#8a7580]">
        GPIO {sensor.pin} · {sensor.ok ? "Sensor OK" : "Sensor offline"}
      </p>
    </article>
  );
}
