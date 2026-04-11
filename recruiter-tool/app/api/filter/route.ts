import { NextRequest, NextResponse } from "next/server";
import { filterCandidates } from "@/lib/claude";
import { ApolloCandidate, revealCandidates } from "@/lib/apollo";

export async function POST(req: NextRequest) {
  try {
    const { candidates, role, company }: { candidates: ApolloCandidate[]; role: string; company: string } =
      await req.json();

    if (!candidates || !role || !company) {
      return NextResponse.json({ error: "Missing candidates, role, or company" }, { status: 400 });
    }

    // Step 1: Claude picks top 5 from anonymized data (no credits spent)
    const top5 = await filterCandidates(candidates, role, company);

    // Step 2: Find the matching raw Apollo candidates (with IDs) for those top 5
    const top5WithIds: ApolloCandidate[] = top5.map((filtered) => {
      const match = candidates.find(
        (c) =>
          (c.current_employer ?? c.organization?.name ?? "") === filtered.employer &&
          c.title === filtered.title
      );
      return match ?? {
        name: filtered.name,
        title: filtered.title,
        current_employer: filtered.employer,
        city: filtered.city,
        linkedin_url: filtered.linkedin_url,
        photo_url: filtered.photo_url,
      };
    });

    // Step 3: Reveal those 5 to get real names/LinkedIn (costs 1 credit each)
    const revealed = await revealCandidates(top5WithIds);

    // Step 4: Merge revealed data back into the Claude-filtered results
    const enriched = top5.map((c, i) => ({
      ...c,
      name: revealed[i]?.name ?? c.name,
      email: revealed[i]?.email ?? "",
      linkedin_url: revealed[i]?.linkedin_url ?? c.linkedin_url,
      city: revealed[i]?.city ?? c.city,
      photo_url: revealed[i]?.photo_url ?? c.photo_url,
    }));

    return NextResponse.json({ candidates: enriched });
  } catch (error) {
    console.error("[filter] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Filter failed" },
      { status: 500 }
    );
  }
}
