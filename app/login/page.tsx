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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fff9fb] px-5 py-10">
      <div
        aria-hidden="true"
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#ffe4ee] opacity-70 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-[#ffeaf2] opacity-80 blur-3xl"
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-[32px] border border-[#f6d5e1] bg-white/95 p-7 shadow-[0_24px_70px_rgba(236,95,150,.14)] sm:p-9"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#ec5f96] text-white shadow-[0_14px_32px_rgba(236,95,150,.22)]">
            <Leaf size={29} />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ec5f96]">
            Capstone Project
          </p>
          <h1 className="mt-2 text-2xl font-bold text-[#3b2a33] sm:text-[28px]">
            Monitoring Kumbung
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#8a7580]">
            Gunakan akun yang telah terdaftar untuk masuk ke dashboard monitoring Kumbung Jamur Merang.
          </p>
        </div>
        <label
          className="text-sm font-bold text-[#3b2a33]"
          htmlFor="email"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-[#f6d5e1] bg-[#fffafb] px-4 py-3.5 text-[#3b2a33] outline-none transition focus:border-[#ec5f96] focus:bg-white focus:ring-4 focus:ring-[#ffe4ee]"
          required
        />
        <label
          className="mt-5 block text-sm font-bold text-[#3b2a33]"
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
          className="mt-2 w-full rounded-2xl border border-[#f6d5e1] bg-[#fffafb] px-4 py-3.5 text-[#3b2a33] outline-none transition focus:border-[#ec5f96] focus:bg-white focus:ring-4 focus:ring-[#ffe4ee]"
          required
        />
        {error && (
          <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-[#e5484d]">
            {error}
          </p>
        )}
        <button
          disabled={loading}
          className="mt-6 min-h-12 w-full rounded-2xl bg-[#ec5f96] px-5 py-3.5 font-bold text-white shadow-[0_12px_28px_rgba(236,95,150,.20)] transition hover:bg-[#df4f89] active:scale-[.99] disabled:opacity-60"
        >
          {loading ? "Memverifikasi..." : "Masuk ke Dashboard"}
        </button>
      </form>
    </main>
  );
}
