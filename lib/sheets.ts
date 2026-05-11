import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { FilteredCandidate } from "./claude";

const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? "1hnuOXlV7aGcFH85Zy2ci4Wh8tY2R02HWMVdnX_2B3K8";
const RANGE = "Sheet1!A:I"; // Name | Title | Company | Location | LinkedIn URL | Email | Role | Seniority | Date

let cachedClient: ReturnType<typeof google.sheets> | null = null;

function loadCredentials(): Record<string, unknown> | null {
  // Prefer env-var (set in Vercel as the full JSON blob)
  if (process.env.GOOGLE_SHEETS_CREDENTIALS_JSON && process.env.GOOGLE_SHEETS_CREDENTIALS_JSON.trim() !== "") {
    try {
      return JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS_JSON);
    } catch (err) {
      console.error("[sheets] Failed to parse GOOGLE_SHEETS_CREDENTIALS_JSON:", err);
      return null;
    }
  }
  // Fall back to credentials.json sitting at the project root (local dev)
  try {
    const filePath = path.join(process.cwd(), "credentials.json");
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
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
