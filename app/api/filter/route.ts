import { NextRequest, NextResponse } from "next/server";
import { filterCandidates, FilteredCandidate } from "@/lib/claude";
import {
  ApolloCandidate,
  revealCandidates,
  calculateYears,
  enrichOrganizations,
} from "@/lib/apollo";
import { supabase, CandidateRow } from "@/lib/supabase";

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
    // Org enrichment is deduped by primary_domain so 50 candidates ≠ 50 API calls.
    const orgSummaries = await enrichOrganizations(fresh);

    const enrichedRaw: ApolloCandidate[] = fresh.map((c) => {
      const years = calculateYears(c.employment_history);
      const domain = c.organization?.primary_domain;
      const enrichment = domain ? orgSummaries.get(domain) : undefined;
      return {
        ...c,
        ...years,
        company_summary: enrichment?.summary,
        company_industry: enrichment?.industry ?? undefined,
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

      return {
        ...c,
        name: r?.name ?? c.name,
        email: r?.email ?? "",
        linkedin_url: r?.linkedin_url ?? c.linkedin_url ?? "",
        city: r?.city ?? c.city,
        photo_url: r?.photo_url ?? c.photo_url,
        website_url: r?.website_url ?? baseYears.website_url ?? undefined,
        years_experience:
          refreshedYears.years_experience ?? baseYears.years_experience ?? undefined,
        years_in_role: refreshedYears.years_in_role ?? baseYears.years_in_role ?? undefined,
        company_industry: baseYears.company_industry ?? undefined,
      };
    });

    const withLinkedIn = merged.filter((c) => c.linkedin_url && c.linkedin_url.trim() !== "");
    const withoutLinkedIn = merged.filter((c) => !c.linkedin_url || c.linkedin_url.trim() === "");
    const enriched = [...withLinkedIn, ...withoutLinkedIn].slice(0, 5);

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

    const { data: inserted, error: insertError } = await supabase
      .from("candidates")
      .insert(rows)
      .select("id");

    if (insertError) {
      console.error("[filter] Supabase insert failed:", insertError);
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
