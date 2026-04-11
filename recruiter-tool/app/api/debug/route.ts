import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    cwd: process.cwd(),
    KLIMT_ANTHROPIC_API_KEY: process.env.KLIMT_ANTHROPIC_API_KEY ? `set (${process.env.KLIMT_ANTHROPIC_API_KEY.slice(0, 10)}...)` : "NOT SET",
    APOLLO_API_KEY: process.env.APOLLO_API_KEY ? "set" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV,
  });
}
