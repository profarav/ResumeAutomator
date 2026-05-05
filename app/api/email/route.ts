import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { supabase } from "@/lib/supabase";

export const maxDuration = 60;

interface EmailTarget {
  name: string;
  email: string;
  role: string;
  company: string;
  db_id?: string | null;
}

interface EmailSettings {
  from_name: string;
  from_email: string;
  gmail_app_password: string;
  calendly_url: string;
}

function buildEmail(target: EmailTarget, settings: EmailSettings): { subject: string; html: string } {
  const firstName = target.name.split(" ")[0];
  const calendlyUrl = settings.calendly_url || "https://calendly.com/mock";
  const fromName = settings.from_name || "Klimt & Design";

  const subject = `Exciting opportunity — ${target.role} at ${target.company}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; color: #111;">
      <p style="margin-bottom: 16px;">Hi ${firstName},</p>
      <p style="margin-bottom: 16px; line-height: 1.6; color: #333;">
        I came across your profile and was really impressed by your background.
        We're currently looking for a <strong>${target.role}</strong> at <strong>${target.company}</strong>
        and think you could be a great fit.
      </p>
      <p style="margin-bottom: 24px; line-height: 1.6; color: #333;">
        I'd love to set up a quick intro call — feel free to book a time here:
      </p>
      <a href="${calendlyUrl}" style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
        Schedule a Call
      </a>
      <p style="margin-top: 32px; color: #555; font-size: 14px;">Looking forward to connecting.</p>
      <p style="margin-top: 4px; color: #555; font-size: 14px; font-weight: 500;">${fromName}</p>
    </div>
  `;

  return { subject, html };
}

export async function POST(req: NextRequest) {
  try {
    const { targets }: { targets: EmailTarget[] } = await req.json();

    if (!targets || targets.length === 0) {
      return NextResponse.json({ error: "No targets provided" }, { status: 400 });
    }

    // Pull outreach settings from Supabase (single-row settings table)
    const { data: settings, error: settingsError } = await supabase
      .from("settings")
      .select("from_name, from_email, gmail_app_password, calendly_url")
      .eq("id", 1)
      .maybeSingle();

    if (settingsError || !settings?.from_email || !settings?.gmail_app_password) {
      return NextResponse.json(
        {
          error:
            "Outreach is not configured yet. Visit /settings to add your sending email and Gmail app password.",
        },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: settings.from_email,
        pass: settings.gmail_app_password,
      },
    });

    const results = await Promise.all(
      targets.map(async (target) => {
        const { subject, html } = buildEmail(target, settings);
        try {
          await transporter.sendMail({
            from: `"${settings.from_name || "Klimt & Design"}" <${settings.from_email}>`,
            to: target.email,
            subject,
            html,
          });
          return { name: target.name, status: "sent" };
        } catch (err) {
          console.error(`[email] Failed for ${target.name}:`, err);
          return { name: target.name, status: "failed", error: String(err) };
        }
      })
    );

    // Mark successfully-emailed candidates as contacted in the DB
    const sentDbIds = results
      .map((r, i) => (r.status === "sent" ? targets[i]?.db_id : null))
      .filter((id): id is string => Boolean(id));

    if (sentDbIds.length > 0) {
      const { error: updateError } = await supabase
        .from("candidates")
        .update({ contacted: true, contacted_at: new Date().toISOString() })
        .in("id", sentDbIds);

      if (updateError) {
        console.error("[email] Failed to mark candidates as contacted:", updateError);
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[email] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email send failed" },
      { status: 500 }
    );
  }
}
