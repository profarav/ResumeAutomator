import Anthropic from "@anthropic-ai/sdk";
import { ApolloCandidate } from "./apollo";
import { getCriteriaFor } from "./criteria";

export interface FilteredCandidate {
  index?: number;
  name: string;
  title: string;
  employer: string;
  linkedin_url: string;
  city: string;
  photo_url: string;
  summary: string;
  email?: string;
  website_url?: string;
  years_experience?: number;
  years_in_role?: number;
  company_industry?: string;
  company_description?: string;
  db_id?: string | null;
  dedup_key?: string;
  contacted_at?: string | null;
}

export interface FeedbackContext {
  likes?: string;
  dislikes?: string;
}

function getClient() {
  const apiKey = process.env.KLIMT_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("KLIMT_ANTHROPIC_API_KEY is not set in .env.local");
  return new Anthropic({ apiKey });
}

function buildPrompt(
  candidates: ApolloCandidate[],
  role: string,
  company: string,
  pickCount: number,
  feedback?: FeedbackContext
): string {
  const list = candidates.map((c, i) => ({
    index: i + 1,
    name: c.name,
    title: c.title,
    employer: c.current_employer ?? "Unknown",
    location: [c.city, c.state].filter(Boolean).join(", "),
    linkedin_url: c.linkedin_url ?? "",
    photo_url: c.photo_url ?? "",
    years_experience: c.years_experience ?? null,
    years_in_role: c.years_in_role ?? null,
    company_summary: c.company_summary ?? null,
  }));

  const criteria = getCriteriaFor(role);

  const criteriaBlock = criteria
    ? `\nRole-specific criteria for ${role}:\n${criteria}\n`
    : "";

  const likes = feedback?.likes?.trim();
  const dislikes = feedback?.dislikes?.trim();
  const feedbackBlock =
    likes || dislikes
      ? `\nBased on past searches, factor this team feedback heavily into your selection:\n${
          likes ? `- The team has preferred candidates with these qualities:\n${likes}\n` : ""
        }${dislikes ? `- The team has previously rejected candidates for these reasons:\n${dislikes}\n` : ""}`
      : "";

  return `You are a recruiting assistant for ${company}, a brand design agency.
Given the following list of candidates for a ${role} position at ${company}, return the top ${pickCount} based on:
- Title relevance and seniority match
- Employer prestige and what the employer's company does (see company_summary if provided — e.g. a designer at a respected creative agency outranks a designer at a generic SaaS company)
- Years of experience (years_experience) and tenure in current role (years_in_role) — prefer candidates with meaningful experience but flag job-hoppers (multiple short roles)

For each candidate, write a SINGLE short sentence (max ~20 words) describing what this person actually does in their current role at their current company. NOT why they're a fit — that's obvious from being on this list. Just what they do day-to-day.

GOOD examples:
- "Does UI/UX design for mobile apps at ThunderClap."
- "Runs paid Meta and Google campaigns for B2B SaaS clients at OneTrust."
- "Leads brand strategy for consumer goods accounts at Pentagram."

BAD (do not write like this):
- "Brings specialized performance marketing expertise from a dedicated digital advertising agency with direct experience in video ads..."
- "Their background at a marketing-focused company aligns perfectly with Primer's need for creative campaign execution..."

Be specific. Use the title, employer, and company_summary to ground the description. Don't pad with adjectives. If you genuinely don't know what they do, say "[Title] at [Company]." and stop.

CRITICAL: Each candidate in your response MUST include the original "index" field from the input list. This is how we link your selection back to the source data. Copy the index exactly from the input.
${criteriaBlock}${feedbackBlock}
Important: some candidates may have placeholder names like "Candidate 1" — keep the name exactly as given, do not invent real names.

Return JSON only, no markdown, no code fences. The JSON must be a valid array of exactly ${pickCount} candidates:
[{ "index": 1, "name": "...", "title": "...", "employer": "...", "linkedin_url": "...", "city": "...", "photo_url": "...", "summary": "..." }]

Candidates:
${JSON.stringify(list, null, 2)}`;
}

async function callClaude(prompt: string): Promise<FilteredCandidate[]> {
  const message = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3072,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned) as FilteredCandidate[];
}

export async function filterCandidates(
  candidates: ApolloCandidate[],
  role: string,
  company: string,
  pickCount: number = 8,
  feedback?: FeedbackContext
): Promise<FilteredCandidate[]> {
  const prompt = buildPrompt(candidates, role, company, pickCount, feedback);

  try {
    return await callClaude(prompt);
  } catch {
    const strictPrompt =
      prompt +
      `\n\nCRITICAL: Your entire response must be ONLY a valid JSON array of exactly ${pickCount} items. No text before or after. No markdown. No explanation. Start with [ and end with ].`;
    return await callClaude(strictPrompt);
  }
}
