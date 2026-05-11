export interface EmploymentEntry {
  organization_name?: string | null;
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  current?: boolean | null;
}

export interface ApolloCandidate {
  id?: string;
  name: string;
  title: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  current_employer?: string;
  photo_url?: string;
  email?: string;
  website_url?: string;
  employment_history?: EmploymentEntry[];
  years_experience?: number;
  years_in_role?: number;
  company_summary?: string;
  company_industry?: string;
  organization?: {
    name?: string;
    primary_domain?: string;
    website_url?: string;
  };
}

export interface OrgEnrichment {
  summary: string;
  industry: string | null;
}

// ----- Years-of-experience helpers -----

function parseApolloDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  // Apollo dates are usually "YYYY-MM-DD" or "YYYY-MM"
  const d = new Date(s.length === 7 ? `${s}-01` : s);
  return isNaN(d.getTime()) ? null : d;
}

function yearsBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

export function calculateYears(
  history: EmploymentEntry[] | undefined
): { years_experience?: number; years_in_role?: number } {
  if (!history || history.length === 0) return {};

  const now = new Date();

  // Earliest start date across all entries → total years experience
  const starts = history
    .map((h) => parseApolloDate(h.start_date))
    .filter((d): d is Date => d !== null);

  let years_experience: number | undefined;
  if (starts.length > 0) {
    const earliest = new Date(Math.min(...starts.map((d) => d.getTime())));
    years_experience = Math.round(yearsBetween(earliest, now) * 10) / 10;
  }

  // Current role: entry flagged current === true, or end_date null/empty
  const current = history.find(
    (h) => h.current === true || !h.end_date || h.end_date.trim() === ""
  );
  let years_in_role: number | undefined;
  if (current) {
    const start = parseApolloDate(current.start_date);
    if (start) {
      years_in_role = Math.round(yearsBetween(start, now) * 10) / 10;
    }
  }

  return { years_experience, years_in_role };
}

// ----- Industry label simplification -----

// Maps Apollo's long industry strings to short single-word labels for card display.
// Anything not in this map falls back to a sensible default in shortIndustry().
const INDUSTRY_LABELS: Record<string, string> = {
  // Tech
  "computer software": "Tech",
  "information technology and services": "Tech",
  "internet": "Tech",
  "computer & network security": "Tech",
  "computer hardware": "Tech",
  "computer networking": "Tech",
  "consumer electronics": "Tech",
  "semiconductors": "Tech",
  "telecommunications": "Tech",
  "wireless": "Tech",
  // Design & creative
  "design": "Design",
  "graphic design": "Design",
  "architecture & planning": "Architecture",
  // Marketing / advertising
  "marketing & advertising": "Advertising",
  "public relations & communications": "PR",
  // Media & entertainment
  "media production": "Media",
  "online media": "Media",
  "broadcast media": "Media",
  "publishing": "Publishing",
  "newspapers": "Media",
  "entertainment": "Entertainment",
  "music": "Music",
  "motion pictures and film": "Film",
  "performing arts": "Arts",
  "fine art": "Arts",
  // Consumer / retail
  "consumer goods": "Consumer",
  "retail": "Retail",
  "luxury goods & jewelry": "Luxury",
  "apparel & fashion": "Fashion",
  "cosmetics": "Beauty",
  "food & beverages": "Food & Bev",
  "restaurants": "Food & Bev",
  "wine and spirits": "Food & Bev",
  // Non-profit & education
  "non-profit organization management": "Non-Profit",
  "philanthropy": "Non-Profit",
  "civic & social organization": "Non-Profit",
  "education management": "Education",
  "higher education": "Education",
  "e-learning": "Education",
  "research": "Research",
  // Finance / legal / consulting
  "financial services": "Finance",
  "banking": "Finance",
  "venture capital & private equity": "Finance",
  "investment management": "Finance",
  "investment banking": "Finance",
  "insurance": "Insurance",
  "real estate": "Real Estate",
  "law practice": "Legal",
  "legal services": "Legal",
  "management consulting": "Consulting",
  // Health & science
  "health, wellness & fitness": "Wellness",
  "hospital & health care": "Healthcare",
  "medical practice": "Healthcare",
  "medical devices": "Healthcare",
  "pharmaceuticals": "Pharma",
  "biotechnology": "Biotech",
  // Industrial
  "manufacturing": "Manufacturing",
  "construction": "Construction",
  "automotive": "Automotive",
  "machinery": "Manufacturing",
  "aviation & aerospace": "Aerospace",
  "airlines/aviation": "Aviation",
  "logistics & supply chain": "Logistics",
  // Hospitality / travel
  "hospitality": "Hospitality",
  "leisure, travel & tourism": "Travel",
  "events services": "Events",
  // HR / recruiting
  "human resources": "HR",
  "staffing & recruiting": "Recruiting",
  // Government
  "government administration": "Government",
  "public policy": "Government",
  "international affairs": "Government",
};

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

export function shortIndustry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (INDUSTRY_LABELS[key]) return INDUSTRY_LABELS[key];
  // Fallback: first segment before " & " or " and ", title-cased
  const first = key.split(/\s&\s|\sand\s|,\s/)[0];
  return titleCase(first);
}

// ----- Organization enrichment (deduped by domain) -----

interface OrgEnrichResponse {
  organization?: {
    description?: string | null;
    industry?: string | null;
    keywords?: string[] | null;
  };
}

async function enrichOneDomain(domain: string): Promise<OrgEnrichment | null> {
  try {
    const url = new URL("https://api.apollo.io/api/v1/organizations/enrich");
    url.searchParams.set("domain", domain);

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": process.env.APOLLO_API_KEY ?? "",
      },
    });

    if (!res.ok) return null;
    const data: OrgEnrichResponse = await res.json();
    const org = data.organization;
    if (!org) return null;

    const parts: string[] = [];
    if (org.industry) parts.push(`Industry: ${org.industry}`);
    if (org.keywords && org.keywords.length > 0) {
      parts.push(`Keywords: ${org.keywords.slice(0, 8).join(", ")}`);
    }
    if (org.description) {
      const desc = org.description.length > 400 ? org.description.slice(0, 400) + "…" : org.description;
      parts.push(`About: ${desc}`);
    }

    if (parts.length === 0 && !org.industry) return null;

    return {
      summary: parts.join(" | "),
      industry: shortIndustry(org.industry),
    };
  } catch (err) {
    console.warn(`[apollo] enrich failed for ${domain}:`, err);
    return null;
  }
}

export async function enrichOrganizations(
  candidates: ApolloCandidate[]
): Promise<Map<string, OrgEnrichment>> {
  const domains = Array.from(
    new Set(
      candidates
        .map((c) => c.organization?.primary_domain)
        .filter((d): d is string => Boolean(d?.trim()))
    )
  );

  if (domains.length === 0) return new Map();

  const results = await Promise.all(
    domains.map(async (domain) => [domain, await enrichOneDomain(domain)] as const)
  );

  const map = new Map<string, OrgEnrichment>();
  for (const [domain, enriched] of results) {
    if (enriched) map.set(domain, enriched);
  }
  return map;
}

// ----- Search + Reveal -----

export async function searchCandidates(
  role: string,
  seniority: string,
  location?: string
): Promise<ApolloCandidate[]> {
  const locations = location
    ?.split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  const body: Record<string, unknown> = {
    person_titles: [role],
    person_seniorities: [seniority.toLowerCase()],
    per_page: 50,
    page: 1,
  };

  if (locations && locations.length > 0) {
    body.person_locations = locations;
  }

  const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": process.env.APOLLO_API_KEY ?? "",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Apollo API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const people: ApolloCandidate[] = data?.people ?? [];

  return people.map((p: ApolloCandidate, i: number) => ({
    ...p,
    name: p.name ?? `Candidate ${i + 1}`,
    current_employer: p.current_employer ?? p.organization?.name ?? "Unknown",
    city: p.city ?? undefined,
    linkedin_url: p.linkedin_url ?? undefined,
    photo_url: p.photo_url ?? undefined,
    website_url: p.website_url ?? p.organization?.website_url ?? undefined,
  }));
}

export async function revealCandidates(
  candidates: ApolloCandidate[]
): Promise<ApolloCandidate[]> {
  const ids = candidates.map((c) => c.id).filter(Boolean) as string[];

  if (ids.length === 0) return candidates;

  const response = await fetch("https://api.apollo.io/api/v1/people/bulk_match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": process.env.APOLLO_API_KEY ?? "",
    },
    body: JSON.stringify({
      details: ids.map((id) => ({ id })),
      reveal_personal_emails: true,
      reveal_phone_number: false,
    }),
  });

  if (!response.ok) {
    console.warn(`[apollo] Reveal failed: ${response.status} — returning unreveled candidates`);
    return candidates;
  }

  const data = await response.json();
  const matches: ApolloCandidate[] = data?.matches ?? [];

  const revealedById = new Map(matches.map((m) => [m.id, m]));

  return candidates.map((c, i) => {
    const revealed = c.id ? revealedById.get(c.id) : undefined;
    if (!revealed) return c;
    return {
      ...c,
      name: revealed.name ?? c.name,
      email: revealed.email ?? c.email,
      linkedin_url: revealed.linkedin_url ?? c.linkedin_url,
      city: revealed.city ?? c.city,
      state: revealed.state ?? c.state,
      photo_url: revealed.photo_url ?? c.photo_url,
      website_url: revealed.website_url ?? c.website_url,
      employment_history: revealed.employment_history ?? c.employment_history,
      current_employer:
        revealed.current_employer ??
        revealed.organization?.name ??
        c.current_employer,
      ...(c.name.startsWith("Candidate ") && revealed.name
        ? { name: revealed.name }
        : {}),
    };
  }).map((p, i) => ({
    ...p,
    name: p.name ?? `Candidate ${i + 1}`,
  }));
}
