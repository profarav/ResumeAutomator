import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 30;

const DEFAULTS = {
  from_name: "Klimt & Design",
  from_email: "",
  gmail_app_password: "",
  calendly_url: "",
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("from_name, from_email, gmail_app_password, calendly_url")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("[settings] GET failed:", error);
      return NextResponse.json({ settings: DEFAULTS });
    }

    return NextResponse.json({ settings: data ?? DEFAULTS });
  } catch (error) {
    console.error("[settings] GET error:", error);
    return NextResponse.json({ settings: DEFAULTS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const update = {
      id: 1,
      from_name: (body.from_name ?? "").trim(),
      from_email: (body.from_email ?? "").trim(),
      gmail_app_password: (body.gmail_app_password ?? "").trim(),
      calendly_url: (body.calendly_url ?? "").trim(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("settings").upsert(update);

    if (error) {
      console.error("[settings] POST failed:", error);
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[settings] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 }
    );
  }
}
