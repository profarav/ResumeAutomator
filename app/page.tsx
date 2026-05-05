"use client";

import { useState } from "react";
import Link from "next/link";
import SearchPanel from "@/components/SearchPanel";
import ReviewPanel from "@/components/ReviewPanel";
import { FeedbackState } from "@/components/CandidateCard";
import { FilteredCandidate } from "@/lib/claude";

const COMPANY_ROLES: Record<string, string[]> = {
  "Klimt & Design": ["Visual Designer", "UI/UX Designer", "Creative Strategist"],
  Primer: ["Paid Media Specialist", "Media Buyer", "Creative Strategist"],
};

export default function Home() {
  const [company, setCompany] = useState("Klimt & Design");
  const [role, setRole] = useState("Visual Designer");
  const [seniority, setSeniority] = useState("Senior");

  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<FilteredCandidate[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [emails, setEmails] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<Record<number, FeedbackState>>({});
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  function handleCompanyChange(c: string) {
    setCompany(c);
    setRole(COMPANY_ROLES[c][0]);
    setCandidates([]);
    setSelected(new Set());
    setEmails({});
    setFeedback({});
    setEmailStatus(null);
  }

  function handleToggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function handleSearch() {
    setLoading(true);
    setCandidates([]);
    setSelected(new Set());
    setEmails({});
    setFeedback({});
    setEmailStatus(null);

    try {
      // Step 1: Search Apollo
      const searchRes = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, seniority }),
      });

      if (!searchRes.ok) {
        const err = await searchRes.json();
        throw new Error(err.error ?? "Search failed");
      }

      const { candidates: raw } = await searchRes.json();

      // Step 2: Filter with Claude (now includes seniority for feedback lookup)
      const filterRes = await fetch("/api/filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates: raw, role, company, seniority }),
      });

      if (!filterRes.ok) {
        const err = await filterRes.json();
        throw new Error(err.error ?? "Filter failed");
      }

      const { candidates: top5 } = await filterRes.json();
      setCandidates(top5);
      // Pre-populate email fields with whatever Apollo revealed
      const initialEmails: Record<number, string> = {};
      top5.forEach((c: FilteredCandidate, i: number) => {
        if (c.email) initialEmails[i] = c.email;
      });
      setEmails(initialEmails);
    } catch (error) {
      console.error(error);
      setEmailStatus(`✗ ${error instanceof Error ? error.message : "Something went wrong"}`);
    } finally {
      setLoading(false);
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

    const targets = Array.from(selected).map((i) => ({
      name: candidates[i].name,
      email: emails[i] ?? "",
      role,
      company,
    })).filter((t) => t.email.trim() !== "");

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
              <svg className="w-4 h-4 text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100 leading-tight">Recruiter</p>
              <p className="text-xs text-zinc-500 leading-tight">Klimt &amp; Design · Internal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Settings
            </Link>
            <span className="text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full">
              Powered by Claude
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8 pb-32">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Find Candidates</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Search Apollo, let Claude shortlist the top 5, then send outreach — all in one flow.
          </p>
        </div>

        <SearchPanel
          company={company}
          role={role}
          seniority={seniority}
          loading={loading}
          onCompanyChange={handleCompanyChange}
          onRoleChange={setRole}
          onSeniorityChange={setSeniority}
          onSearch={handleSearch}
        />

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
