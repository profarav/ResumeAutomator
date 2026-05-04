import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const {
      candidate_id,
      approved,
      feedback_text,
      role,
      seniority,
    }: {
      candidate_id: string;
      approved: boolean;
      feedback_text?: string;
      role: string;
      seniority: string;
    } = await req.json();

    if (!candidate_id || typeof approved !== "boolean" || !role || !seniority) {
      return NextResponse.json(
        { error: "Missing candidate_id, approved, role, or seniority" },
        { status: 400 }
      );
    }

    // Step 1: Update the candidate row with the feedback
    const { error: updateError } = await supabase
      .from("candidates")
      .update({
        approved,
        feedback_text: feedback_text?.trim() || null,
      })
      .eq("id", candidate_id);

    if (updateError) {
      console.error("[feedback] Update failed:", updateError);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }

    // Step 2: Recompute aggregate likes/dislikes for this role + seniority
    const { data: allFeedback, error: fetchError } = await supabase
      .from("candidates")
      .select("approved, feedback_text, title, company")
      .eq("role", role)
      .eq("seniority", seniority)
      .not("approved", "is", null);

    if (fetchError) {
      console.error("[feedback] Fetch failed:", fetchError);
      return NextResponse.json({ ok: true, summary: null });
    }

    const likesParts: string[] = [];
    const dislikesParts: string[] = [];

    for (const row of allFeedback ?? []) {
      const note = (row.feedback_text ?? "").trim();
      const context = `${row.title ?? "Unknown title"} @ ${row.company ?? "Unknown company"}`;
      if (row.approved === true) {
        likesParts.push(note ? `${context}: ${note}` : context);
      } else if (row.approved === false) {
        dislikesParts.push(note ? `${context}: ${note}` : context);
      }
    }

    const likes = likesParts.join("\n");
    const dislikes = dislikesParts.join("\n");

    // Step 3: Upsert the feedback_summary row for this role + seniority
    const { error: upsertError } = await supabase
      .from("feedback_summary")
      .upsert(
        {
          role,
          seniority,
          likes,
          dislikes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "role,seniority" }
      );

    if (upsertError) {
      console.error("[feedback] Upsert failed:", upsertError);
    }

    return NextResponse.json({ ok: true, summary: { likes, dislikes } });
  } catch (error) {
    console.error("[feedback] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Feedback save failed" },
      { status: 500 }
    );
  }
}
