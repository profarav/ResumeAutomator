"use client";

import { FilteredCandidate } from "@/lib/claude";
import CandidateCard, { FeedbackState } from "./CandidateCard";

function SkeletonCard() {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-800 shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3" />
          <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-4/5" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-20" />
        <div className="h-7 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-16 ml-auto" />
      </div>
    </div>
  );
}

interface ReviewPanelProps {
  candidates: FilteredCandidate[];
  emails: Record<number, string>;
  selected: Set<number>;
  feedback: Record<number, FeedbackState>;
  loading: boolean;
  sendingEmail: boolean;
  emailStatus: string | null;
  linkedinLimitReached: boolean;
  onToggle: (index: number) => void;
  onEmailChange: (index: number, email: string) => void;
  onFeedbackChange: (index: number, next: FeedbackState) => void;
  onFeedbackSubmit: (index: number) => void;
  onSendOutreach: () => void;
  onLinkedInConnect: (index: number) => void;
}

export default function ReviewPanel({
  candidates,
  emails,
  selected,
  feedback,
  loading,
  sendingEmail,
  emailStatus,
  linkedinLimitReached,
  onToggle,
  onEmailChange,
  onFeedbackChange,
  onFeedbackSubmit,
  onSendOutreach,
  onLinkedInConnect,
}: ReviewPanelProps) {
  if (!loading && candidates.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
          {loading ? "Sourcing candidates..." : "Top Candidates"}
        </h2>
        {!loading && (
          <span className="text-xs text-zinc-500">
            {selected.size} of {candidates.length} selected
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : candidates.map((c, i) => (
              <CandidateCard
                key={i}
                candidate={c}
                email={emails[i] ?? ""}
                selected={selected.has(i)}
                feedback={feedback[i] ?? { vote: null, text: "", submitted: false, submitting: false }}
                linkedinLimitReached={linkedinLimitReached}
                onToggle={() => onToggle(i)}
                onEmailChange={(val) => onEmailChange(i, val)}
                onFeedbackChange={(next) => onFeedbackChange(i, next)}
                onFeedbackSubmit={() => onFeedbackSubmit(i)}
                onLinkedInConnect={() => onLinkedInConnect(i)}
              />
            ))}
      </div>

      {!loading && candidates.length > 0 && (
        <div className="sticky bottom-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur border-t border-zinc-200 dark:border-zinc-800 -mx-6 px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {selected.size === 0
              ? "Select candidates to send outreach"
              : `${selected.size} candidate${selected.size !== 1 ? "s" : ""} selected`}
          </p>

          <div className="flex items-center gap-3">
            {emailStatus && (
              <span
                className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                  emailStatus.startsWith("✓")
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:border-emerald-800"
                    : emailStatus.startsWith("✗")
                    ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/50 dark:text-red-400 dark:border-red-800"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {emailStatus}
              </span>
            )}
            <button
              onClick={onSendOutreach}
              disabled={selected.size === 0 || sendingEmail}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sendingEmail ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-zinc-600 border-t-white dark:border-zinc-400 dark:border-t-zinc-900 rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Outreach"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
