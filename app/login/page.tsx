"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Leaf } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) setError(authError.message);
    else router.push("/dashboard");
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fdfafb] px-5">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-[28px] border border-pink-100 bg-white p-8 shadow-[0_20px_60px_rgba(220,154,174,.14)]"
      >
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d99aad] text-white">
            <Leaf size={26} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Monitoring Kumbung
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Masuk untuk mengelola mist nozzle
          </p>
        </div>
        <label className="text-sm font-semibold text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-pink-100 px-4 py-3 outline-none focus:border-[#d99aad] focus:ring-4 focus:ring-pink-100"
          required
        />
        <label
          className="mt-4 block text-sm font-semibold text-slate-700"
          htmlFor="password"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-pink-100 px-4 py-3 outline-none focus:border-[#d99aad] focus:ring-4 focus:ring-pink-100"
          required
        />
        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={loading}
          className="mt-5 w-full rounded-xl bg-[#d99aad] py-3 font-semibold text-white shadow-lg shadow-pink-200 disabled:opacity-60"
        >
          {loading ? "Memverifikasi..." : "Masuk"}
        </button>
      </form>
    </main>
  );
}
