import Anthropic from "@anthropic-ai/sdk";
import { ApolloCandidate } from "./apollo";
import { getCriteriaFor } from "./criteria";

export interface FilteredCandidate {
  name: string;
  title: string;
  employer: string;
  linkedin_url: string;
  city: string;
  photo_url: string;
  summary: string;
  email?: string;
  db_id?: string | null;
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
Given the following list of candidates for a ${role} position at ${company}, return the top ${pickCount} based on title relevance, seniority match, and employer prestige. For each candidate, write a 2-sentence summary of why they're a strong fit for a design agency environment.
${criteriaBlock}${feedbackBlock}
Important: some candidates may have placeholder names like "Candidate 1" — keep the name exactly as given, do not invent real names.

Return JSON only, no markdown, no code fences. The JSON must be a valid array of exactly ${pickCount} candidates:
[{ "name": "...", "title": "...", "employer": "...", "linkedin_url": "...", "city": "...", "photo_url": "...", "summary": "..." }]

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
