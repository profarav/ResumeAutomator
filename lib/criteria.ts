export const roleCriteria: Record<string, string> = {
  "Visual Designer": `
    - Strongly prefer agency background over in-house/corporate
    - Look for Figma, Adobe Creative Suite experience
    - Prioritize candidates who have worked with consumer or lifestyle brands
  `,
  "UI/UX Designer": `
    - Prefer product design background
    - Look for Figma, Framer, prototyping experience
    - SaaS or app design experience preferred
  `,
  "Creative Strategist": `
    - Agency background strongly preferred
    - Consumer-facing campaign work required
    - Avoid purely corporate or B2B backgrounds
  `,
  "Paid Media Specialist": `
    - Meta, Google, TikTok platform experience required
    - Performance marketing and DTC/e-commerce background preferred
  `,
  "Media Buyer": `
    - Programmatic and paid social experience
    - Experience managing significant ad budgets
    - Agency or media company background preferred
  `,
};

export function getCriteriaFor(role: string): string {
  return roleCriteria[role]?.trim() ?? "";
}
