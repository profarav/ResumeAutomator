// Finds a candidate's portfolio URL using two strategies:
//   A) Pattern match — parallel HEAD requests to slug-based URLs (fast, free)
//   B) Serper fallback — Google search filtered to known portfolio platforms
//
// Runs after the Apollo reveal step so we have real names + LinkedIn URLs.

const PATTERN_FETCH_TIMEOUT_MS = 3500;
const SERPER_TIMEOUT_MS = 6000;
const MAX_BODY_BYTES = 30_000;

// Phrases that indicate the page is a parked domain, sale page, or platform-level
// "user not found" stub rather than an actual portfolio
const REJECT_SIGNALS = [
  "buy this domain",
  "domain for sale",
  "make an offer on this domain",
  "this domain is for sale",
  "godaddy.com",
  "sedo.com",
  "afternic.com",
  "user not found",
  "page not found",
  "doesn't exist",
  "does not exist",
  "create your bento",
  "claim your bento",
  "claim this username",
  "sign up for free",
];

// Domains we consider "real portfolios" when filtering Serper results
const RELEVANT_PORTFOLIO_DOMAINS = [
  "behance.net",
  "dribbble.com",
  "readymag.com",
  "adobe.com",
  "cargo.site",
  "notion.site",
  "are.na",
  "webflow.io",
  "bento.me",
  "layers.to",
];

export function extractLinkedInSlug(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_\-%.]+)/i);
  if (!m) return null;
  // Normalise: lowercase, strip trailing slashes
  return m[1].replace(/[/]+$/, "").toLowerCase();
}

// --- Step A: pattern match -----------------------------------------------

// GET the URL, read up to ~30KB of body, then verify it actually belongs to
// the candidate (their name appears) and isn't a parked-domain / platform-stub page.
async function fetchAndVerify(url: string, candidateName: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PATTERN_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; KlimtRecruiterBot/1.0; +https://klimt.design)",
        Accept: "text/html",
      },
    });
    if (!res.ok || !res.body) return false;

    // Stream up to MAX_BODY_BYTES and decode incrementally — most portfolio
    // pages have all their identity signals in the <head> + first viewport.
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let html = "";
    while (html.length < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }

    const lower = html.toLowerCase();
    const nameTokens = candidateName
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    const hasName = nameTokens.some((t) => lower.includes(t));
    const isJunk = REJECT_SIGNALS.some((s) => lower.includes(s));

    return hasName && !isJunk;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function findByPattern(slug: string, candidateName: string): Promise<string | null> {
  if (!slug || !candidateName) return null;

  const urls = [
    `https://${slug}.design`,
    `https://${slug}.com`,
    `https://bento.me/${slug}`,
    `https://layers.to/${slug}`,
  ];

  // Fire all four in parallel and verify content. Return the first match in priority order.
  const results = await Promise.all(
    urls.map(async (url) => ({ url, ok: await fetchAndVerify(url, candidateName) }))
  );
  return results.find((r) => r.ok)?.url ?? null;
}

// --- Step B: Serper fallback ---------------------------------------------

interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
}

export async function findBySerper(
  name: string,
  employer: string | null | undefined
): Promise<string | null> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.warn("[portfolio] SERPER_API_KEY not set — skipping Serper fallback");
    return null;
  }

  const employerPart = employer ? `${employer} ` : "";
  const query = `"${name}" ${employerPart}(portfolio OR site:behance.net OR site:dribbble.com)`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERPER_TIMEOUT_MS);

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 3 }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[portfolio] Serper returned ${res.status}`);
      return null;
    }

    const data: SerperResponse = await res.json();
    const top3 = (data.organic ?? []).slice(0, 3);
    if (top3.length === 0) return null;

    // Filter for results that are on relevant portfolio platforms or contain the candidate's name
    const nameTokens = name
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    for (const result of top3) {
      const link = (result.link ?? "").toLowerCase();
      if (!link) continue;

      const hasRelevantDomain = RELEVANT_PORTFOLIO_DOMAINS.some((d) => link.includes(d));
      const hasNameInUrl = nameTokens.some((t) => link.includes(t));

      if (hasRelevantDomain || hasNameInUrl) {
        return result.link!;
      }
    }
    return null;
  } catch (err) {
    console.warn("[portfolio] Serper request failed:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// --- Orchestrator --------------------------------------------------------

export async function findPortfolio(input: {
  name: string;
  linkedin_url?: string | null;
  current_employer?: string | null;
}): Promise<string | null> {
  // Skip placeholder names — no useful query possible
  if (!input.name || /^Candidate\s+\d+$/i.test(input.name)) return null;

  // Step A: try pattern matching against the LinkedIn slug
  const slug = extractLinkedInSlug(input.linkedin_url);
  if (slug) {
    const patternMatch = await findByPattern(slug, input.name);
    if (patternMatch) return patternMatch;
  }

  // Step B: fall back to Serper
  return await findBySerper(input.name, input.current_employer);
}
