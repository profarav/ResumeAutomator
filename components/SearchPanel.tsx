"use client";

const SENIORITIES = ["Senior", "Mid", "Entry"];

// Display label → Apollo technology UID
export const TECHNOLOGY_OPTIONS: { label: string; uid: string }[] = [
  { label: "Shopify", uid: "shopify" },
  { label: "Webflow", uid: "webflow" },
  { label: "Figma", uid: "figma" },
  { label: "WordPress", uid: "wordpress_org" },
  { label: "Squarespace", uid: "squarespace" },
  { label: "Adobe Creative Cloud", uid: "adobe_creative_cloud" },
  { label: "Sketch", uid: "sketch" },
  { label: "Framer", uid: "framer" },
  { label: "WooCommerce", uid: "woocommerce" },
  { label: "Magento", uid: "magento" },
];

interface SearchPanelProps {
  companyRoles: Record<string, string[]>;
  company: string;
  role: string;
  seniority: string;
  location: string;
  keywords: string;
  technologies: string[];
  loading: boolean;
  hasShortlist: boolean;
  loadingMore: boolean;
  onCompanyChange: (v: string) => void;
  onRoleChange: (v: string) => void;
  onSeniorityChange: (v: string) => void;
  onLocationChange: (v: string) => void;
  onKeywordsChange: (v: string) => void;
  onTechnologiesChange: (uids: string[]) => void;
  onSearch: () => void;
  onGetMore: () => void;
}

export default function SearchPanel({
  companyRoles,
  company,
  role,
  seniority,
  location,
  keywords,
  technologies,
  loading,
  hasShortlist,
  loadingMore,
  onCompanyChange,
  onRoleChange,
  onSeniorityChange,
  onLocationChange,
  onKeywordsChange,
  onTechnologiesChange,
  onSearch,
  onGetMore,
}: SearchPanelProps) {
  const roles = companyRoles[company] ?? [];
  const companies = Object.keys(companyRoles);

  const inputCls =
    "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500";

  const selectCls = `${inputCls} appearance-none cursor-pointer`;

  function toggleTech(uid: string) {
    if (technologies.includes(uid)) {
      onTechnologiesChange(technologies.filter((t) => t !== uid));
    } else {
      onTechnologiesChange([...technologies, uid]);
    }
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">
      <div>
        <h2 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-4">
          Search Parameters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Company</label>
            <select value={company} onChange={(e) => onCompanyChange(e.target.value)} className={selectCls}>
              {companies.length === 0 ? (
                <option value="">No companies — add in Settings</option>
              ) : (
                companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Role</label>
            <select value={role} onChange={(e) => onRoleChange(e.target.value)} className={selectCls}>
              {roles.length === 0 ? (
                <option value="">No roles — add in Settings</option>
              ) : (
                roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Seniority</label>
            <select value={seniority} onChange={(e) => onSeniorityChange(e.target.value)} className={selectCls}>
              {SENIORITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
              Location <span className="text-zinc-400 dark:text-zinc-600 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="e.g. New York, San Francisco"
              className={inputCls}
            />
          </div>
        </div>

        {/* Keywords + Technologies */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
              Keywords <span className="text-zinc-400 dark:text-zinc-600 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => onKeywordsChange(e.target.value)}
              placeholder="e.g. luxury brands, DTC, e-commerce"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
              Technologies <span className="text-zinc-400 dark:text-zinc-600 font-normal">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-2 min-h-[42px]">
              {TECHNOLOGY_OPTIONS.map(({ label, uid }) => {
                const active = technologies.includes(uid);
                return (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => toggleTech(uid)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                      active
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white"
                        : "bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {hasShortlist && (
          <button
            onClick={onGetMore}
            disabled={loading || loadingMore}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 text-sm font-semibold rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-zinc-400 border-t-zinc-700 dark:border-t-zinc-200 rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              "Get next 5"
            )}
          </button>
        )}
        <button
          onClick={onSearch}
          disabled={loading || !role || !company}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-semibold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-zinc-600 border-t-white dark:border-zinc-400 dark:border-t-zinc-900 rounded-full animate-spin" />
              Searching...
            </>
          ) : (
            "Find Candidates"
          )}
        </button>
      </div>
    </div>
  );
}
