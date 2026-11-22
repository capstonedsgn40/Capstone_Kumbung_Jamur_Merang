"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Autentikasi gagal");
    else router.push("/");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef4ef] px-5">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl border border-emerald-100 bg-white p-7 shadow-xl shadow-emerald-950/5"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl text-white">
            🍄
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Akses Kumbung</h1>
          <p className="mt-1 text-sm text-slate-500">
            Masukkan PIN untuk membuka dashboard
          </p>
        </div>
        <label className="text-sm font-semibold text-slate-700" htmlFor="pin">
          PIN Dashboard
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-xl tracking-[0.5em] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          required
        />
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white shadow-lg shadow-emerald-600/20 disabled:opacity-60"
        >
          {loading ? "Memverifikasi..." : "Masuk Dashboard"}
        </button>
      </form>
    </main>
  );
}
