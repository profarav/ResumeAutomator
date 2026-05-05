import { NextRequest, NextResponse } from "next/server";
import { filterCandidates, FilteredCandidate } from "@/lib/claude";
import { ApolloCandidate, revealCandidates } from "@/lib/apollo";
import { supabase, CandidateRow } from "@/lib/supabase";

export const maxDuration = 60;

// Build a stable key for de-dup: title + company normalized lowercase
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

    // Step 0a: Pull existing candidates for this role/seniority/company so we can exclude them
    const { data: existing } = await supabase
      .from("candidates")
      .select("title, company")
      .eq("role", role)
      .eq("seniority", seniority)
      .eq("company_searched", company);

    const seenKeys = new Set<string>(
      (existing ?? []).map((r) => dedupKey(r.title, r.company))
    );
    // Also exclude anything the client already shown this session ("Get next 5" use case)
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

    // Step 0b: Load any existing feedback summary for this role/seniority
    const { data: feedbackData } = await supabase
      .from("feedback_summary")
      .select("likes, dislikes")
      .eq("role", role)
      .eq("seniority", seniority)
      .maybeSingle();

    const feedback = feedbackData
      ? { likes: feedbackData.likes ?? "", dislikes: feedbackData.dislikes ?? "" }
      : undefined;

    // Step 1: Ask Claude for top 8 (oversampling so we can enforce LinkedIn)
    const top8 = await filterCandidates(fresh, role, company, 8, feedback);

    // Step 2: Match each Claude pick back to the raw Apollo record (with id)
    const top8WithIds: ApolloCandidate[] = top8.map((filtered) => {
      const match = fresh.find(
        (c) =>
          (c.current_employer ?? c.organization?.name ?? "") === filtered.employer &&
          c.title === filtered.title
      );
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

    // Step 3: Reveal all 8 (costs 8 credits) to surface LinkedIn URLs and emails
    const revealed = await revealCandidates(top8WithIds);

    // Step 4: Merge revealed data, prefer LinkedIn-having candidates, fall back if needed
    const merged: FilteredCandidate[] = top8.map((c, i) => ({
      ...c,
      name: revealed[i]?.name ?? c.name,
      email: revealed[i]?.email ?? "",
      linkedin_url: revealed[i]?.linkedin_url ?? c.linkedin_url ?? "",
      city: revealed[i]?.city ?? c.city,
      photo_url: revealed[i]?.photo_url ?? c.photo_url,
    }));

    const withLinkedIn = merged.filter((c) => c.linkedin_url && c.linkedin_url.trim() !== "");
    const withoutLinkedIn = merged.filter((c) => !c.linkedin_url || c.linkedin_url.trim() === "");
    const enriched = [...withLinkedIn, ...withoutLinkedIn].slice(0, 5);

    // Step 5: Save the final 5 to Supabase (approved=null until feedback comes in)
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

    // Attach the DB id + the dedup key (so the client can ask for "next 5" later)
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
