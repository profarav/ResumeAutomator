"use client";

const COMPANY_ROLES: Record<string, string[]> = {
  "Klimt & Design": ["Visual Designer", "UI/UX Designer", "Creative Strategist"],
  Primer: ["Paid Media Specialist", "Media Buyer", "Creative Strategist"],
};

const SENIORITIES = ["Senior", "Mid", "Entry"];

interface SearchPanelProps {
  company: string;
  role: string;
  seniority: string;
  loading: boolean;
  onCompanyChange: (v: string) => void;
  onRoleChange: (v: string) => void;
  onSeniorityChange: (v: string) => void;
  onSearch: () => void;
}

export default function SearchPanel({
  company,
  role,
  seniority,
  loading,
  onCompanyChange,
  onRoleChange,
  onSeniorityChange,
  onSearch,
}: SearchPanelProps) {
  const roles = COMPANY_ROLES[company] ?? [];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-4">
          Search Parameters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Company */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 font-medium">Company</label>
            <select
              value={company}
              onChange={(e) => onCompanyChange(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500 appearance-none cursor-pointer"
            >
              {Object.keys(COMPANY_ROLES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Role */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 font-medium">Role</label>
            <select
              value={role}
              onChange={(e) => onRoleChange(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500 appearance-none cursor-pointer"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Seniority */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400 font-medium">Seniority</label>
            <select
              value={seniority}
              onChange={(e) => onSeniorityChange(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-500 appearance-none cursor-pointer"
            >
              {SENIORITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={onSearch}
        disabled={loading}
        className="w-full sm:w-auto self-end flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" />
            Searching...
          </>
        ) : (
          "Find Candidates"
        )}
      </button>
    </div>
  );
}
