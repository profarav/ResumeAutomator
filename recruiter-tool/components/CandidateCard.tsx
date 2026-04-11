"use client";

import { FilteredCandidate } from "@/lib/claude";

interface CandidateCardProps {
  candidate: FilteredCandidate;
  email: string;
  selected: boolean;
  onToggle: () => void;
  onEmailChange: (email: string) => void;
}

export default function CandidateCard({ candidate, email, selected, onToggle, onEmailChange }: CandidateCardProps) {
  const initials = candidate.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`relative flex flex-col bg-zinc-900 rounded-2xl border transition-all duration-200 overflow-hidden ${
        selected
          ? "border-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)] shadow-white/5"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* Selected badge */}
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 bg-white rounded-full flex items-center justify-center z-10">
          <svg className="w-3 h-3 text-zinc-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Avatar + Name */}
        <div className="flex items-center gap-3">
          {candidate.photo_url ? (
            <img
              src={candidate.photo_url}
              alt={candidate.name}
              className="w-12 h-12 rounded-full object-cover bg-zinc-800 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div
            className={`w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-300 text-sm font-semibold shrink-0 ${
              candidate.photo_url ? "hidden" : ""
            }`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-zinc-100 font-semibold text-sm truncate">{candidate.name}</p>
            <p className="text-zinc-400 text-xs truncate mt-0.5">{candidate.title}</p>
          </div>
        </div>

        {/* Meta */}
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

        {/* Summary */}
        <p className="text-zinc-400 text-xs leading-relaxed flex-1">{candidate.summary}</p>

        {/* Email field */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 font-medium">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="Enter email to send outreach"
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {candidate.linkedin_url && (
            <a
              href={candidate.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </a>
          )}
          <button
            onClick={onToggle}
            className={`ml-auto flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
              selected
                ? "bg-white text-zinc-900 hover:bg-zinc-200"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {selected ? "Selected" : "Select"}
          </button>
        </div>
      </div>
    </div>
  );
}
