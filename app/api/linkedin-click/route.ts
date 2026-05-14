import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 15;

export const WEEKLY_WARNING_THRESHOLD = 80;
export const WEEKLY_HARD_LIMIT = 100;

async function weeklyCount(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("linkedin_clicks")
    .select("*", { count: "exact", head: true })
    .gt("clicked_at", sevenDaysAgo);
  if (error) {
    console.error("[linkedin-click] count failed:", error);
    return 0;
  }
  return count ?? 0;
}

// Record a click + return current weekly count.
export async function POST(req: NextRequest) {
  try {
    const { candidate_id, candidate_name, candidate_linkedin_url } = await req.json();

    if (!candidate_linkedin_url) {
      return NextResponse.json({ error: "Missing candidate_linkedin_url" }, { status: 400 });
    }

    // Soft-block at the hard limit. Caller should already be disabling the button,
    // this is the server-side guard.
    const currentCount = await weeklyCount();
    if (currentCount >= WEEKLY_HARD_LIMIT) {
      return NextResponse.json(
        {
          error: `Weekly LinkedIn limit reached (${currentCount}/${WEEKLY_HARD_LIMIT}). Wait until oldest clicks roll off.`,
          weeklyCount: currentCount,
          warningThreshold: WEEKLY_WARNING_THRESHOLD,
          hardLimit: WEEKLY_HARD_LIMIT,
        },
        { status: 429 }
      );
    }

    const { error: insertError } = await supabase.from("linkedin_clicks").insert({
      candidate_id: candidate_id ?? null,
      candidate_name: candidate_name ?? null,
      candidate_linkedin_url,
    });

    if (insertError) {
      console.error("[linkedin-click] insert failed:", insertError);
      return NextResponse.json({ error: "Failed to record click" }, { status: 500 });
    }

    const newCount = currentCount + 1;
    return NextResponse.json({
      ok: true,
      weeklyCount: newCount,
      warningThreshold: WEEKLY_WARNING_THRESHOLD,
      hardLimit: WEEKLY_HARD_LIMIT,
    });
  } catch (err) {
    console.error("[linkedin-click] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Click record failed" },
      { status: 500 }
    );
  }
}

// Read just the current weekly count (used by page mount).
export async function GET() {
  const count = await weeklyCount();
  return NextResponse.json({
    weeklyCount: count,
    warningThreshold: WEEKLY_WARNING_THRESHOLD,
    hardLimit: WEEKLY_HARD_LIMIT,
  });
}
