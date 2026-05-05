"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Settings {
  from_name: string;
  from_email: string;
  gmail_app_password: string;
  calendly_url: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    from_name: "",
    from_email: "",
    gmail_app_password: "",
    calendly_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        setSettings(data.settings);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    setStatus(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Save failed");
      }

      setStatus("✓ Settings saved");
    } catch (error) {
      setStatus(`✗ ${error instanceof Error ? error.message : "Save failed"}`);
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
                <svg className="w-4 h-4 text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-100 leading-tight">Recruiter</p>
                <p className="text-xs text-zinc-500 leading-tight">Settings</p>
              </div>
            </Link>
          </div>
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ← Back to dashboard
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Outreach settings</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Configure how outreach emails are sent. These values are used every time you click <span className="text-zinc-300">Send Outreach</span>.
          </p>
        </div>

        {loading ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 animate-pulse">
            <div className="h-4 bg-zinc-800 rounded w-1/3 mb-4" />
            <div className="h-10 bg-zinc-800 rounded mb-4" />
            <div className="h-10 bg-zinc-800 rounded mb-4" />
            <div className="h-10 bg-zinc-800 rounded" />
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6">
            {/* From name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">From name</label>
              <input
                type="text"
                value={settings.from_name}
                onChange={(e) => update("from_name", e.target.value)}
                placeholder="Klimt & Design"
                className="bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <p className="text-xs text-zinc-500">
                What recipients see as the sender (e.g. <span className="text-zinc-400">Klimt &amp; Design</span> or your full name).
              </p>
            </div>

            {/* From email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">From email</label>
              <input
                type="email"
                value={settings.from_email}
                onChange={(e) => update("from_email", e.target.value)}
                placeholder="you@gmail.com"
                className="bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <p className="text-xs text-zinc-500">
                The Gmail address outreach is sent from. Must be a real Gmail account.
              </p>
            </div>

            {/* Gmail app password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Gmail app password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={settings.gmail_app_password}
                  onChange={(e) => update("gmail_app_password", e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2.5 pr-20 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Generate one at{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-300 underline hover:text-zinc-100"
                >
                  myaccount.google.com/apppasswords
                </a>
                . Requires 2-Step Verification on your Google account.
              </p>
            </div>

            {/* Calendly URL */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-400 font-medium">Calendly URL</label>
              <input
                type="url"
                value={settings.calendly_url}
                onChange={(e) => update("calendly_url", e.target.value)}
                placeholder="https://calendly.com/your-link/30min"
                className="bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
              <p className="text-xs text-zinc-500">
                Booking link sent to candidates. They click it to schedule an intro call.
              </p>
            </div>

            {/* Save bar */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <span
                className={`text-xs font-medium ${
                  status?.startsWith("✓")
                    ? "text-emerald-400"
                    : status?.startsWith("✗")
                    ? "text-red-400"
                    : "text-zinc-500"
                }`}
              >
                {status ?? "Changes are saved instantly when you click below."}
              </span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save settings"
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
