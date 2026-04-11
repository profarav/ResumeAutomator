import { NextRequest, NextResponse } from "next/server";
import { searchCandidates } from "@/lib/apollo";

export async function POST(req: NextRequest) {
  try {
    const { role, seniority } = await req.json();

    if (!role || !seniority) {
      return NextResponse.json({ error: "Missing role or seniority" }, { status: 400 });
    }

    const candidates = await searchCandidates(role, seniority);
    return NextResponse.json({ candidates });
  } catch (error) {
    console.error("[search] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
