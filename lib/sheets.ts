import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { FilteredCandidate } from "./claude";

const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? "1hnuOXlV7aGcFH85Zy2ci4Wh8tY2R02HWMVdnX_2B3K8";
const TAB_NAME = process.env.GOOGLE_SHEET_TAB_NAME ?? "Sheet1";
// Sheet tab names containing spaces or special chars must be wrapped in single quotes
const RANGE = `'${TAB_NAME}'!A:I`; // Name | Title | Company | Location | LinkedIn | Email | Role | Seniority | Date

let cachedClient: ReturnType<typeof google.sheets> | null = null;

function normalizePrivateKey(creds: Record<string, unknown>): Record<string, unknown> {
  // Vercel env-var inputs often mangle newlines: actual \n become literal \\n.
  // Google's auth lib needs real newlines in the PEM key.
  if (typeof creds.private_key === "string" && !creds.private_key.includes("\n")) {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }
  return creds;
}

function loadCredentials(): Record<string, unknown> | null {
  // Prefer env-var (set in Vercel as the full JSON blob)
  const raw = process.env.GOOGLE_SHEETS_CREDENTIALS_JSON;
  if (raw && raw.trim() !== "") {
    try {
      // Tolerant slice: extract from first `{` to last `}` so a trailing
      // newline / stray character in Vercel's env-var input doesn't break us.
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      const sliced = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
      const parsed = JSON.parse(sliced);
      return normalizePrivateKey(parsed);
    } catch (err) {
      console.error("[sheets] Failed to parse GOOGLE_SHEETS_CREDENTIALS_JSON:", err);
      return null;
    }
  }
  // Fall back to credentials.json sitting at the project root (local dev)
  try {
    const filePath = path.join(process.cwd(), "credentials.json");
    if (!fs.existsSync(filePath)) return null;
    return normalizePrivateKey(JSON.parse(fs.readFileSync(filePath, "utf8")));
  } catch (err) {
    console.error("[sheets] Failed to read credentials.json:", err);
    return null;
  }
}

async function getSheetsClient() {
  if (cachedClient) return cachedClient;

  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error(
      "Google Sheets credentials missing. Set GOOGLE_SHEETS_CREDENTIALS_JSON or place credentials.json at project root."
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: credentials as { client_email?: string; private_key?: string },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

export async function appendCandidates(
  candidates: FilteredCandidate[],
  role: string,
  seniority: string
): Promise<void> {
  if (!candidates || candidates.length === 0) return;

  const sheets = await getSheetsClient();
  const today = new Date().toISOString().split("T")[0];

  const rows = candidates.map((c) => [
    c.name ?? "",
    c.title ?? "",
    c.employer ?? "",
    c.city ?? "",
    c.linkedin_url ?? "",
    c.email ?? "",
    role,
    seniority,
    today,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: RANGE,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: rows,
    },
  });
}
