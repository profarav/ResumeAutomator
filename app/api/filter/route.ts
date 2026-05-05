import { NextRequest, NextResponse } from "next/server";
import { filterCandidates, FilteredCandidate } from "@/lib/claude";
import { ApolloCandidate, revealCandidates } from "@/lib/apollo";
import { supabase, CandidateRow } from "@/lib/supabase";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const {
      candidates,
      role,
      company,
      seniority,
    }: {
      candidates: ApolloCandidate[];
      role: string;
      company: string;
      seniority: string;
    } = await req.json();

    if (!candidates || !role || !company || !seniority) {
      return NextResponse.json(
        { error: "Missing candidates, role, company, or seniority" },
        { status: 400 }
      );
    }

    // Load any existing feedback summary for this role/seniority
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
    const top8 = await filterCandidates(candidates, role, company, 8, feedback);

    // Step 2: Match each Claude pick back to the raw Apollo record (with id)
    const top8WithIds: ApolloCandidate[] = top8.map((filtered) => {
      const match = candidates.find(
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

    // Step 4: Merge revealed data, then keep only those with a LinkedIn URL.
    // Take the first 5 that survive the LinkedIn filter, in Claude's original order.
    const merged: FilteredCandidate[] = top8.map((c, i) => ({
      ...c,
      name: revealed[i]?.name ?? c.name,
      email: revealed[i]?.email ?? "",
      linkedin_url: revealed[i]?.linkedin_url ?? c.linkedin_url ?? "",
      city: revealed[i]?.city ?? c.city,
      photo_url: revealed[i]?.photo_url ?? c.photo_url,
    }));

    // Prefer candidates with LinkedIn, but if reveal failed (e.g. out of Apollo
    // credits) and fewer than 5 survive, fall back to the rest so we still
    // show 5 cards rather than an empty screen.
    const withLinkedIn = merged.filter((c) => c.linkedin_url && c.linkedin_url.trim() !== "");
    const withoutLinkedIn = merged.filter((c) => !c.linkedin_url || c.linkedin_url.trim() === "");
    const enriched = [...withLinkedIn, ...withoutLinkedIn].slice(0, 5);

    if (withLinkedIn.length < 5) {
      console.warn(
        `[filter] Only ${withLinkedIn.length}/8 candidates had LinkedIn after reveal — likely Apollo credits exhausted or reveal partial. Falling back.`
      );
    }

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

    // Attach the DB id to each returned candidate so the frontend can submit feedback
    const withIds = enriched.map((c, i) => ({
      ...c,
      db_id: inserted?.[i]?.id ?? null,
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
