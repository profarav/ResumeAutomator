import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn("[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url ?? "", anonKey ?? "");

export interface CandidateRow {
  id?: string;
  name: string | null;
  title: string | null;
  company: string | null;
  location: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  role: string;
  seniority: string;
  company_searched: string;
  approved: boolean | null;
  feedback_text: string | null;
}

export interface FeedbackSummaryRow {
  role: string;
  seniority: string;
  likes: string;
  dislikes: string;
}
