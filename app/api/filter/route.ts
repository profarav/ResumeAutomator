import { NextRequest, NextResponse } from "next/server";
import { filterCandidates, FilteredCandidate } from "@/lib/claude";
import {
  ApolloCandidate,
  revealCandidates,
  calculateYears,
  enrichOrganizations,
} from "@/lib/apollo";

function extractDomainSafe(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const cleaned = url.trim();
    const withProto = cleaned.startsWith("http") ? cleaned : `https://${cleaned}`;
    const u = new URL(withProto);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
import { supabase, CandidateRow } from "@/lib/supabase";
import { appendCandidates } from "@/lib/sheets";
import { findPortfolio } from "@/lib/portfolio";

export const maxDuration = 60;

function dedupKey(title?: string | null, company?: string | null): string {
  return `${(title ?? "").trim().toLowerCase()}|${(company ?? "").trim().toLowerCase()}`;
}

export async function POST(req: NextRequest) {
  try {
    const {
      candidates,
      role,
      company,
      seniority,
      excludeKeys = [],
    }: {
      candidates: ApolloCandidate[];
      role: string;
      company: string;
      seniority: string;
      excludeKeys?: string[];
    } = await req.json();

    if (!candidates || !role || !company || !seniority) {
      return NextResponse.json(
        { error: "Missing candidates, role, company, or seniority" },
        { status: 400 }
      );
    }

    // 0a. De-dup against previously surfaced candidates for this role/seniority/company
    const { data: existing } = await supabase
      .from("candidates")
      .select("title, company")
      .eq("role", role)
      .eq("seniority", seniority)
      .eq("company_searched", company);

    const seenKeys = new Set<string>(
      (existing ?? []).map((r) => dedupKey(r.title, r.company))
    );
    excludeKeys.forEach((k) => seenKeys.add(k.toLowerCase()));

    const fresh = candidates.filter(
      (c) =>
        !seenKeys.has(
          dedupKey(c.title, c.current_employer ?? c.organization?.name ?? "")
        )
    );

    if (fresh.length === 0) {
      return NextResponse.json({
        candidates: [],
        message:
          "No new candidates — every match for this search has already been surfaced. Try a different role, seniority, or location.",
      });
    }

    // 0b. Enrich each candidate with years_experience, years_in_role, company_summary
    // Org enrichment is deduped (by domain or by org name) so 50 candidates ≠ 50 API calls.
    const { byDomain, byOrgName } = await enrichOrganizations(fresh);

    const enrichedRaw: ApolloCandidate[] = fresh.map((c) => {
      const years = calculateYears(c.employment_history);

      // Try domain first, then fall back to org-name lookup
      const domain =
        c.organization?.primary_domain?.trim() ||
        (c.organization?.website_url ? c.organization.website_url : "");

      let enrichment =
        domain && byDomain.has(extractDomainSafe(domain) ?? domain)
          ? byDomain.get(extractDomainSafe(domain) ?? domain)
          : undefined;

      if (!enrichment) {
        const orgName = (c.current_employer ?? c.organization?.name ?? "").trim().toLowerCase();
        enrichment = orgName ? byOrgName.get(orgName) : undefined;
      }

      return {
        ...c,
        ...years,
        company_summary: enrichment?.summary,
        company_industry: enrichment?.industry ?? undefined,
        company_description: enrichment?.description ?? undefined,
      };
    });

    // 0c. Feedback summary lookup
    const { data: feedbackData } = await supabase
      .from("feedback_summary")
      .select("likes, dislikes")
      .eq("role", role)
      .eq("seniority", seniority)
      .maybeSingle();

    const feedback = feedbackData
      ? { likes: feedbackData.likes ?? "", dislikes: feedbackData.dislikes ?? "" }
      : undefined;

    // 1. Ask Claude for top 8 (oversampled for LinkedIn enforcement)
    const top8 = await filterCandidates(enrichedRaw, role, company, 8, feedback);

    // 2. Match Claude's picks back to enriched Apollo records (with ids + years + website_url).
    //    Primary match is by Claude-returned "index" (1-based into enrichedRaw). Fall back to
    //    string-match if Claude omitted the index.
    const top8WithIds: ApolloCandidate[] = top8.map((filtered) => {
      let match: ApolloCandidate | undefined;
      if (typeof filtered.index === "number") {
        match = enrichedRaw[filtered.index - 1];
      }
      if (!match) {
        const target = (filtered.employer ?? "").trim().toLowerCase();
        match = enrichedRaw.find(
          (c) =>
            (c.current_employer ?? c.organization?.name ?? "").trim().toLowerCase() === target &&
            c.title === filtered.title
        );
      }
      if (!match) {
        // Last resort: title-only fuzzy match
        match = enrichedRaw.find((c) => c.title === filtered.title);
      }
      return (
        match ?? {
          name: filtered.name,
          title: filtered.title,
          current_employer: filtered.employer,
          city: filtered.city,
          linkedin_url: filtered.linkedin_url,
          photo_url: filtered.photo_url,
        }
      );
    });

    // 3. Reveal all 8 for real names/LinkedIn/website
    const revealed = await revealCandidates(top8WithIds);

    // 4. Merge revealed data + previously enriched fields. Re-compute years after reveal
    //    (revealed entries often include richer employment_history).
    const merged: FilteredCandidate[] = top8.map((c, i) => {
      const r = revealed[i];
      const refreshedYears = r ? calculateYears(r.employment_history) : {};
      const baseYears = top8WithIds[i] ?? {};

      // Hard-truncate the LinkedIn note in case Claude went over the 180 char target
      const noteTrimmed = c.linkedin_note
        ? c.linkedin_note.length > 200
          ? c.linkedin_note.slice(0, 197).trimEnd() + "…"
          : c.linkedin_note
        : undefined;

      return {
        ...c,
        name: r?.name ?? c.name,
        email: r?.email ?? "",
        linkedin_url: r?.linkedin_url ?? c.linkedin_url ?? "",
        city: r?.city ?? c.city,
        photo_url: r?.photo_url ?? c.photo_url,
        linkedin_note: noteTrimmed,
        website_url: r?.website_url ?? baseYears.website_url ?? undefined,
        years_experience:
          refreshedYears.years_experience ?? baseYears.years_experience ?? undefined,
        years_in_role: refreshedYears.years_in_role ?? baseYears.years_in_role ?? undefined,
        company_industry: baseYears.company_industry ?? undefined,
        company_description: baseYears.company_description ?? undefined,
      };
    });

    const withLinkedIn = merged.filter((c) => c.linkedin_url && c.linkedin_url.trim() !== "");
    const withoutLinkedIn = merged.filter((c) => !c.linkedin_url || c.linkedin_url.trim() === "");
    const enrichedPreBio = [...withLinkedIn, ...withoutLinkedIn].slice(0, 5);

    // 4b. Portfolio finder — pattern match on LinkedIn slug, fallback to Serper.
    //     Only runs for candidates Apollo didn't already give us a website_url for.
    //     All 5 lookups run in parallel; each is bounded by per-step timeouts.
    const portfolioResults = await Promise.all(
      enrichedPreBio.map(async (c) => {
        if (c.website_url && c.website_url.trim() !== "") return c.website_url;
        try {
          return await findPortfolio({
            name: c.name,
            linkedin_url: c.linkedin_url,
            current_employer: c.employer,
          });
        } catch (err) {
          console.warn(`[filter] portfolio finder failed for ${c.name}:`, err);
          return null;
        }
      })
    );

    const enriched = enrichedPreBio.map((c, i) => ({
      ...c,
      website_url: portfolioResults[i] ?? c.website_url ?? "",
    }));

    // 5. Save the final 5 to Supabase
    const rows: Omit<CandidateRow, "id">[] = enriched.map((c) => ({
      name: c.name ?? null,
      title: c.title ?? null,
      company: c.employer ?? null,
      location: c.city ?? null,
      linkedin_url: c.linkedin_url ?? null,
      photo_url: c.photo_url ?? null,
      role,
      seniority,
      company_searched: company,
      approved: null,
      feedback_text: null,
    }));

    // Save to Supabase + append to Google Sheet in parallel. Sheets failures
    // are caught so they never block the search flow.
    const [insertResult] = await Promise.all([
      supabase.from("candidates").insert(rows).select("id"),
      appendCandidates(enriched, role, seniority).catch((err) => {
        console.error("[filter] Google Sheets append failed:", err);
      }),
    ]);

    const inserted = insertResult.data;
    if (insertResult.error) {
      console.error("[filter] Supabase insert failed:", insertResult.error);
    }

    const withIds = enriched.map((c, i) => ({
      ...c,
      db_id: inserted?.[i]?.id ?? null,
      dedup_key: dedupKey(c.title, c.employer),
    }));

    return NextResponse.json({ candidates: withIds });
  } catch (error) {
    console.error("[filter] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Filter failed" },
      { status: 500 }
    );
  }
}
