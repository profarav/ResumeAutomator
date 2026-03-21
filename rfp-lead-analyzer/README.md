# AI Lead Retention Analyzer

An AI tool for real estate agents to identify leads going cold and automatically generate personalized re-engagement messages.

Built as a demo for RFP Homes — exploring how AI can help real estate teams reduce lead churn and automate outreach without any manual effort.

---

## What It Does

Paste in your lead list (CSV-style) and the tool:

1. **Classifies each lead** as Healthy, At Risk, or Churned based on days since last contact
2. **Shows a retention dashboard** with summary metrics
3. **Writes a personalized re-engagement message** for each cold or at-risk lead, referencing their budget range and property interest

| Status | Threshold |
|--------|-----------|
| Healthy | < 60 days since last contact |
| At risk | 60–119 days |
| Churned | 120+ days |

---

## Setup

```bash
git clone https://github.com/profarav/rfp-lead-analyzer
cd rfp-lead-analyzer
pip install flask requests
python3 app.py
```

Open **http://localhost:5001**

---

## Example Input

```
Name, Last Contact, Inquiries, Budget, Interested In
Marcus T., 2024-08-05, 6, $520000, 4BR Single Family
Priya K., 2025-02-10, 2, $280000, Condo
James R., 2024-05-18, 14, $850000, Luxury Home
```

## Example Output

```
James R. — Churned (291 days since last contact)
"Hey James! We know finding the right luxury home takes time — but we've seen
some incredible new listings in your range that just hit the market."
```

---

## Why This Matters for Real Estate

Most agents lose deals not because the lead wasn't interested — but because follow-up fell through the cracks. This tool gives you instant visibility into which leads are going cold and puts a personalized outreach message in your hands immediately, so you never miss a re-engagement window.

---

## Tech

- Python + Flask
- Anthropic Claude API (or hardcoded demo mode)
- Vanilla HTML/CSS/JS

---

*Built by [Arav Lohe](https://github.com/profarav)*
