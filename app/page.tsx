"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SearchPanel from "@/components/SearchPanel";
import ReviewPanel from "@/components/ReviewPanel";
import ThemeToggle from "@/components/ThemeToggle";
import { FeedbackState } from "@/components/CandidateCard";
import { FilteredCandidate } from "@/lib/claude";
import { ApolloCandidate } from "@/lib/apollo";

const FALLBACK_COMPANIES: Record<string, string[]> = {
  "Klimt & Design": ["Visual Designer", "UI/UX Designer", "Creative Strategist"],
  Primer: ["Paid Media Specialist", "Media Buyer", "Creative Strategist"],
};

export default function Home() {
  const [companyRoles, setCompanyRoles] = useState<Record<string, string[]>>(FALLBACK_COMPANIES);
  const [company, setCompany] = useState("Klimt & Design");
  const [role, setRole] = useState("Visual Designer");
  const [seniority, setSeniority] = useState("Senior");
  const [location, setLocation] = useState("");
  const [keywords, setKeywords] = useState("");
  const [technologies, setTechnologies] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [candidates, setCandidates] = useState<FilteredCandidate[]>([]);
  const [rawApollo, setRawApollo] = useState<ApolloCandidate[]>([]);
  const [shownDedupKeys, setShownDedupKeys] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [emails, setEmails] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, FeedbackState>>({});
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        const cfg = data.settings?.companies_config as Record<string, string[]> | undefined;
        if (cfg && Object.keys(cfg).length > 0) {
          setCompanyRoles(cfg);
          const firstCompany = Object.keys(cfg)[0];
          setCompany(firstCompany);
          setRole(cfg[firstCompany][0] ?? "");
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    })();
  }, []);

  function resetShortlist() {
    setCandidates([]);
    setRawApollo([]);
    setShownDedupKeys([]);
    setSelected(new Set());
    setEmails({});
    setFeedback({});
    setEmailStatus(null);
    setBannerMessage(null);
  }

  function handleCompanyChange(c: string) {
    setCompany(c);
    setRole(companyRoles[c]?.[0] ?? "");
    resetShortlist();
  }

  function handleToggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function runFilter(pool: ApolloCandidate[], excludeKeys: string[], appendMode: boolean) {
    const filterRes = await fetch("/api/filter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates: pool, role, company, seniority, excludeKeys }),
    });

    if (!filterRes.ok) {
      const err = await filterRes.json();
      throw new Error(err.error ?? "Filter failed");
    }

    const data = await filterRes.json();
    const fresh: FilteredCandidate[] = data.candidates ?? [];

    if (data.message) setBannerMessage(data.message);

    if (fresh.length === 0) return;

    if (appendMode) {
      setCandidates((prev) => [...prev, ...fresh]);
      setEmails((prev) => {
        const next = { ...prev };
        const offset = Object.keys(prev).length;
        fresh.forEach((c, i) => {
          if (c.email) next[offset + i] = c.email;
        });
        return next;
      });
    } else {
      setCandidates(fresh);
      const initialEmails: Record<number, string> = {};
      fresh.forEach((c, i) => {
        if (c.email) initialEmails[i] = c.email;
      });
      setEmails(initialEmails);
    }

    setShownDedupKeys((prev) => [
      ...prev,
      ...fresh.map((c) => c.dedup_key ?? "").filter(Boolean),
    ]);
  }

  async function handleSearch() {
    if (!role || !company) return;
    setLoading(true);
    resetShortlist();

    try {
      const searchRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, seniority, location, keywords, technologies }),
      });

      if (!searchRes.ok) {
        const err = await searchRes.json();
        throw new Error(err.error ?? "Search failed");
      }

      const { candidates: raw }: { candidates: ApolloCandidate[] } = await searchRes.json();
      setRawApollo(raw);

      await runFilter(raw, [], false);
    } catch (error) {
      console.error(error);
      setEmailStatus(`✗ ${error instanceof Error ? error.message : "Something went wrong"}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleGetMore() {
    if (rawApollo.length === 0) return;
    setLoadingMore(true);
    setBannerMessage(null);

    try {
      await runFilter(rawApollo, shownDedupKeys, true);
    } catch (error) {
      console.error(error);
      setEmailStatus(`✗ ${error instanceof Error ? error.message : "Failed to get more"}`);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleFeedbackSubmit(index: number) {
    const candidate = candidates[index];
    const fb = feedback[index];
    if (!candidate?.db_id || !fb || fb.vote === null) return;

    setFeedback((prev) => ({
      ...prev,
      [index]: { ...fb, submitting: true },
    }));

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidate.db_id,
          approved: fb.vote === "up",
          feedback_text: fb.text,
          role,
          seniority,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Feedback save failed");
      }

      setFeedback((prev) => ({
        ...prev,
        [index]: { ...fb, submitting: false, submitted: true },
      }));
    } catch (error) {
      console.error(error);
      setFeedback((prev) => ({
        ...prev,
        [index]: { ...fb, submitting: false },
      }));
    }
  }

  async function handleSendOutreach() {
    if (selected.size === 0) return;
    setSendingEmail(true);
    setEmailStatus(null);

    const targets = Array.from(selected)
      .map((i) => ({
        name: candidates[i].name,
        email: emails[i] ?? "",
        role,
        company,
        db_id: candidates[i].db_id,
      }))
      .filter((t) => t.email.trim() !== "");

    if (targets.length === 0) {
      setEmailStatus("✗ No valid emails — fill in email fields first");
      setSendingEmail(false);
      return;
    }

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Email send failed");

      const sent = data.results.filter((r: { status: string }) => r.status === "sent").length;
      const failed = data.results.filter((r: { status: string }) => r.status === "failed").length;

      const sentTargets = data.results
        .map((r: { status: string }, i: number) => (r.status === "sent" ? targets[i].db_id : null))
        .filter(Boolean);

      setCandidates((prev) =>
        prev.map((c) =>
          sentTargets.includes(c.db_id)
            ? { ...c, contacted_at: new Date().toISOString() }
            : c
        )
      );

      if (failed === 0) {
        setEmailStatus(`✓ ${sent} email${sent !== 1 ? "s" : ""} sent successfully`);
      } else {
        setEmailStatus(`✓ ${sent} sent · ✗ ${failed} failed`);
      }
    } catch (error) {
      setEmailStatus(`✗ ${error instanceof Error ? error.message : "Email send failed"}`);
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
              <svg className="w-4 h-4 text-white dark:text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">Recruiter</p>
              <p className="text-xs text-zinc-500 leading-tight">Internal sourcing tool</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/settings"
              className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
            <span className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 px-3 py-1 rounded-full">
              Powered by Claude
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8 pb-32">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">Find Candidates</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-500 mt-1">
            Search Apollo, let Claude shortlist the top 5, then send outreach — all in one flow.
          </p>
        </div>

        <SearchPanel
          companyRoles={companyRoles}
          company={company}
          role={role}
          seniority={seniority}
          location={location}
          keywords={keywords}
          technologies={technologies}
          loading={loading}
          hasShortlist={candidates.length > 0 && rawApollo.length > 0}
          loadingMore={loadingMore}
          onCompanyChange={handleCompanyChange}
          onRoleChange={setRole}
          onSeniorityChange={setSeniority}
          onLocationChange={setLocation}
          onKeywordsChange={setKeywords}
          onTechnologiesChange={setTechnologies}
          onSearch={handleSearch}
          onGetMore={handleGetMore}
        />

        {bannerMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/40 dark:text-amber-300 text-sm px-4 py-3 rounded-xl">
            {bannerMessage}
          </div>
        )}

        <ReviewPanel
          candidates={candidates}
          emails={emails}
          selected={selected}
          feedback={feedback}
          loading={loading}
          sendingEmail={sendingEmail}
          emailStatus={emailStatus}
          onToggle={handleToggle}
          onEmailChange={(i, val) => setEmails((prev) => ({ ...prev, [i]: val }))}
          onFeedbackChange={(i, next) => setFeedback((prev) => ({ ...prev, [i]: next }))}
          onFeedbackSubmit={handleFeedbackSubmit}
          onSendOutreach={handleSendOutreach}
        />
      </main>
    </div>
  );
}
