import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

interface EmailTarget {
  name: string;
  email: string;
  role: string;
  company: string;
}

function buildEmail(target: EmailTarget): { subject: string; html: string } {
  const firstName = target.name.split(" ")[0];
  const calendlyUrl = process.env.CALENDLY_URL ?? "https://calendly.com/mock";

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
      <p style="margin-top: 4px; color: #555; font-size: 14px; font-weight: 500;">Klimt &amp; Design</p>
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

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const results = await Promise.all(
      targets.map(async (target) => {
        const { subject, html } = buildEmail(target);
        try {
          await transporter.sendMail({
            from: `"Klimt & Design" <${process.env.GMAIL_USER}>`,
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

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[email] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Email send failed" },
      { status: 500 }
    );
  }
}
