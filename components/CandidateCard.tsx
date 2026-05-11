"use client";

import { useState } from "react";
import { FilteredCandidate } from "@/lib/claude";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  const mins = Math.max(1, Math.floor(diffMs / 60_000));
  return `${mins}m ago`;
}

export type FeedbackVote = "up" | "down" | null;

export interface FeedbackState {
  vote: FeedbackVote;
  text: string;
  submitted: boolean;
  submitting: boolean;
}

interface CandidateCardProps {
  candidate: FilteredCandidate;
  email: string;
  selected: boolean;
  feedback: FeedbackState;
  onToggle: () => void;
  onEmailChange: (email: string) => void;
  onFeedbackChange: (next: FeedbackState) => void;
  onFeedbackSubmit: () => void;
}

export default function CandidateCard({
  candidate,
  email,
  selected,
  feedback,
  onToggle,
  onEmailChange,
  onFeedbackChange,
  onFeedbackSubmit,
}: CandidateCardProps) {
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  const initials = candidate.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleVote(vote: FeedbackVote) {
    if (feedback.submitted) return;
    onFeedbackChange({ ...feedback, vote });
    setShowFeedbackInput(true);
  }

  const inputCls =
    "w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500";

  return (
    <div
      className={`relative flex flex-col bg-zinc-50 dark:bg-zinc-900 rounded-2xl border transition-all duration-200 overflow-hidden ${
        selected
          ? "border-zinc-900 dark:border-white shadow-[0_0_0_1px_rgba(0,0,0,0.1)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
      }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center z-10">
          <svg className="w-3 h-3 text-white dark:text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      {candidate.contacted_at && (
        <div className="absolute top-3 left-3 z-10 bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-300 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full">
          Contacted {timeAgo(candidate.contacted_at)}
        </div>
      )}

      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-center gap-3">
          {candidate.photo_url ? (
            <img
              src={candidate.photo_url}
              alt={candidate.name}
              className="w-12 h-12 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div
            className={`w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 text-sm font-semibold shrink-0 ${
              candidate.photo_url ? "hidden" : ""
            }`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-zinc-900 dark:text-zinc-100 font-semibold text-sm truncate">{candidate.name}</p>
            <p className="text-zinc-600 dark:text-zinc-400 text-xs truncate mt-0.5">{candidate.title}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="truncate">{candidate.employer || "Unknown"}</span>
          </div>
          {candidate.city && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{candidate.city}</span>
            </div>
          )}
        </div>

        {(candidate.years_experience !== undefined || candidate.years_in_role !== undefined) && (
          <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5">
            {candidate.years_experience !== undefined && (
              <span>
                <span className="font-semibold">{candidate.years_experience}y</span>
                <span className="text-zinc-500"> experience</span>
              </span>
            )}
            {candidate.years_experience !== undefined && candidate.years_in_role !== undefined && (
              <span className="text-zinc-400 dark:text-zinc-600">·</span>
            )}
            {candidate.years_in_role !== undefined && (
              <span>
                <span className="font-semibold">{candidate.years_in_role}y</span>
                <span className="text-zinc-500"> in role</span>
              </span>
            )}
          </div>
        )}

        <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed flex-1">{candidate.summary}</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="Enter email to send outreach"
            className={inputCls}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          {candidate.linkedin_url && (
            <a
              href={candidate.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-400 hover:text-zinc-900 dark:hover:border-zinc-500 dark:hover:text-zinc-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </a>
          )}
          {candidate.website_url && (
            <a
              href={candidate.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-zinc-400 hover:text-zinc-900 dark:hover:border-zinc-500 dark:hover:text-zinc-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
              </svg>
              Portfolio
            </a>
          )}
          <button
            onClick={onToggle}
            className={`ml-auto flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
              selected
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            {selected ? "Selected" : "Select"}
          </button>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500 font-medium">
              {feedback.submitted ? "Feedback saved" : "Was this a good match?"}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleVote("up")}
                disabled={feedback.submitted}
                aria-label="Thumbs up"
                className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${
                  feedback.vote === "up"
                    ? "bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500 dark:text-emerald-400"
                    : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </button>
              <button
                onClick={() => handleVote("down")}
                disabled={feedback.submitted}
                aria-label="Thumbs down"
                className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-all ${
                  feedback.vote === "down"
                    ? "bg-red-100 border-red-400 text-red-700 dark:bg-red-500/20 dark:border-red-500 dark:text-red-400"
                    : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.095c.5 0 .905-.405.905-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                </svg>
              </button>
            </div>
          </div>

          {showFeedbackInput && feedback.vote && !feedback.submitted && (
            <div className="flex flex-col gap-2">
              <textarea
                value={feedback.text}
                onChange={(e) => onFeedbackChange({ ...feedback, text: e.target.value })}
                placeholder="Tell us why (optional)"
                rows={2}
                className={`${inputCls} resize-none`}
              />
              <button
                onClick={onFeedbackSubmit}
                disabled={feedback.submitting}
                className="self-end px-3 py-1.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-semibold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {feedback.submitting ? "Saving..." : "Submit feedback"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
