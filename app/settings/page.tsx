"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Settings {
  from_name: string;
  from_email: string;
  gmail_app_password: string;
  calendly_url: string;
  companies_config: Record<string, string[]>;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    from_name: "",
    from_email: "",
    gmail_app_password: "",
    calendly_url: "",
    companies_config: {},
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

  // Companies editor helpers
  function addCompany() {
    const name = prompt("New company name:");
    if (!name?.trim()) return;
    if (settings.companies_config[name]) {
      alert("That company already exists.");
      return;
    }
    update("companies_config", { ...settings.companies_config, [name.trim()]: [] });
  }

  function deleteCompany(company: string) {
    if (!confirm(`Delete "${company}" and all its roles?`)) return;
    const next = { ...settings.companies_config };
    delete next[company];
    update("companies_config", next);
  }

  function addRole(company: string) {
    const role = prompt(`New role for ${company}:`);
    if (!role?.trim()) return;
    const existing = settings.companies_config[company] ?? [];
    if (existing.includes(role.trim())) {
      alert("That role already exists.");
      return;
    }
    update("companies_config", {
      ...settings.companies_config,
      [company]: [...existing, role.trim()],
    });
  }

  function deleteRole(company: string, role: string) {
    update("companies_config", {
      ...settings.companies_config,
      [company]: (settings.companies_config[company] ?? []).filter((r) => r !== role),
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
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
          <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
            ← Back to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-8 pb-20">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Configure outreach credentials and the companies / roles you recruit for.
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
          <>
            {/* Outreach */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6">
              <div>
                <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Outreach</h2>
                <p className="text-xs text-zinc-500 mt-1">How outreach emails are sent.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-medium">From name</label>
                <input
                  type="text"
                  value={settings.from_name}
                  onChange={(e) => update("from_name", e.target.value)}
                  placeholder="Klimt & Design"
                  className="bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-medium">From email</label>
                <input
                  type="email"
                  value={settings.from_email}
                  onChange={(e) => update("from_email", e.target.value)}
                  placeholder="you@gmail.com"
                  className="bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>

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
                  Generate at{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-300 underline hover:text-zinc-100"
                  >
                    myaccount.google.com/apppasswords
                  </a>
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-zinc-400 font-medium">Calendly URL</label>
                <input
                  type="url"
                  value={settings.calendly_url}
                  onChange={(e) => update("calendly_url", e.target.value)}
                  placeholder="https://calendly.com/your-link/30min"
                  className="bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
            </div>

            {/* Companies + roles */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">Companies & Roles</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    The companies and roles shown in the search dropdown. Add as many as you need.
                  </p>
                </div>
                <button
                  onClick={addCompany}
                  className="shrink-0 text-xs text-zinc-300 border border-zinc-700 px-3 py-1.5 rounded-lg hover:border-zinc-500 hover:text-zinc-100 transition-colors"
                >
                  + Add company
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {Object.keys(settings.companies_config).length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No companies yet. Click "Add company" above.</p>
                ) : (
                  Object.entries(settings.companies_config).map(([company, roles]) => (
                    <div
                      key={company}
                      className="bg-zinc-800/50 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{company}</h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => addRole(company)}
                            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            + Add role
                          </button>
                          <button
                            onClick={() => deleteCompany(company)}
                            className="text-xs text-red-400 hover:text-red-300 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {roles.length === 0 ? (
                        <p className="text-xs text-zinc-500 italic">No roles yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {roles.map((role) => (
                            <span
                              key={role}
                              className="inline-flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs px-2.5 py-1 rounded-lg"
                            >
                              {role}
                              <button
                                onClick={() => deleteRole(company, role)}
                                aria-label={`Remove ${role}`}
                                className="text-zinc-500 hover:text-red-400 transition-colors"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Save bar */}
            <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 sticky bottom-4">
              <span
                className={`text-xs font-medium ${
                  status?.startsWith("✓")
                    ? "text-emerald-400"
                    : status?.startsWith("✗")
                    ? "text-red-400"
                    : "text-zinc-500"
                }`}
              >
                {status ?? "Click below to save your changes."}
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
          </>
        )}
      </main>
    </div>
  );
}
