export interface ApolloCandidate {
  id?: string;
  name: string;
  title: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  current_employer?: string;
  photo_url?: string;
  email?: string;
  organization?: {
    name?: string;
  };
}

export async function searchCandidates(
  role: string,
  seniority: string
): Promise<ApolloCandidate[]> {
  const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": process.env.APOLLO_API_KEY ?? "",
    },
    body: JSON.stringify({
      person_titles: [role],
      person_seniorities: [seniority.toLowerCase()],
      per_page: 50,
      page: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Apollo API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const people: ApolloCandidate[] = data?.people ?? [];

  return people.map((p: ApolloCandidate, i: number) => ({
    ...p,
    name: p.name ?? `Candidate ${i + 1}`,
    current_employer: p.current_employer ?? p.organization?.name ?? "Unknown",
    city: p.city ?? undefined,
    linkedin_url: p.linkedin_url ?? undefined,
    photo_url: p.photo_url ?? undefined,
  }));
}

// Reveal enriched contact details for a list of Apollo person IDs.
// Each reveal costs 1 credit — only call this on the final shortlist.
export async function revealCandidates(
  candidates: ApolloCandidate[]
): Promise<ApolloCandidate[]> {
  const ids = candidates.map((c) => c.id).filter(Boolean) as string[];

  if (ids.length === 0) return candidates;

  const response = await fetch("https://api.apollo.io/api/v1/people/bulk_match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": process.env.APOLLO_API_KEY ?? "",
    },
    body: JSON.stringify({
      details: ids.map((id) => ({ id })),
      reveal_personal_emails: true,
      reveal_phone_number: false,
    }),
  });

  if (!response.ok) {
    // If reveal fails (e.g. out of credits), return the originals unchanged
    console.warn(`[apollo] Reveal failed: ${response.status} — returning unreveled candidates`);
    return candidates;
  }

  const data = await response.json();
  const matches: ApolloCandidate[] = data?.matches ?? [];

  // Merge revealed data back onto originals by id
  const revealedById = new Map(matches.map((m) => [m.id, m]));

  return candidates.map((c, i) => {
    const revealed = c.id ? revealedById.get(c.id) : undefined;
    if (!revealed) return c;
    return {
      ...c,
      name: revealed.name ?? c.name,
      email: revealed.email ?? c.email,
      linkedin_url: revealed.linkedin_url ?? c.linkedin_url,
      city: revealed.city ?? c.city,
      state: revealed.state ?? c.state,
      photo_url: revealed.photo_url ?? c.photo_url,
      current_employer:
        revealed.current_employer ??
        revealed.organization?.name ??
        c.current_employer,
      ...(c.name.startsWith("Candidate ") && revealed.name
        ? { name: revealed.name }
        : {}),
    };
  }).map((p, i) => ({
    ...p,
    name: p.name ?? `Candidate ${i + 1}`,
  }));
}
