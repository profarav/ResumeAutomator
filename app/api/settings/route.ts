import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 30;

const DEFAULT_COMPANIES: Record<string, string[]> = {
  "Klimt & Design": ["Visual Designer", "UI/UX Designer", "Creative Strategist"],
  Primer: ["Paid Media Specialist", "Media Buyer", "Creative Strategist"],
};

const DEFAULTS = {
  from_name: "Klimt & Design",
  from_email: "",
  gmail_app_password: "",
  calendly_url: "",
  companies_config: DEFAULT_COMPANIES,
};

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("from_name, from_email, gmail_app_password, calendly_url, companies_config")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("[settings] GET failed:", error);
      return NextResponse.json({ settings: DEFAULTS });
    }

    if (!data) {
      return NextResponse.json({ settings: DEFAULTS });
    }

    // Use stored companies_config if it has any entries, otherwise fall back to defaults
    const stored = data.companies_config as Record<string, string[]> | null;
    const companies_config =
      stored && Object.keys(stored).length > 0 ? stored : DEFAULT_COMPANIES;

    return NextResponse.json({
      settings: {
        from_name: data.from_name ?? "",
        from_email: data.from_email ?? "",
        gmail_app_password: data.gmail_app_password ?? "",
        calendly_url: data.calendly_url ?? "",
        companies_config,
      },
    });
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
      companies_config: body.companies_config ?? {},
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
