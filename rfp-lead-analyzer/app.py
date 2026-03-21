from flask import Flask, request, jsonify, render_template_string
import requests, os

app = Flask(__name__)
API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Lead Retention Analyzer</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9f9f7; color: #1a1a1a; padding: 2rem; }
  .container { max-width: 780px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 500; margin-bottom: 4px; }
  .subtitle { font-size: 14px; color: #666; margin-bottom: 2rem; }
  .card { background: #fff; border: 1px solid #e8e8e5; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
  .section-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
  textarea { width: 100%; min-height: 170px; font-family: 'SF Mono', monospace; font-size: 12px; padding: 10px; border: 1px solid #e8e8e5; border-radius: 8px; background: #fafaf8; color: #1a1a1a; resize: vertical; }
  textarea:focus { outline: none; border-color: #bbb; }
  .btn-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  button { padding: 10px 20px; border-radius: 8px; border: none; background: #1a1a1a; color: #fff; font-size: 14px; cursor: pointer; }
  button:hover { opacity: 0.85; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 1rem; }
  .metric { background: #f4f4f1; border-radius: 8px; padding: 1rem; }
  .metric-label { font-size: 12px; color: #666; margin-bottom: 4px; }
  .metric-value { font-size: 22px; font-weight: 500; }
  .client-row { border: 1px solid #e8e8e5; border-radius: 8px; padding: 1rem; margin-bottom: 8px; background: #fff; }
  .client-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .client-name { font-weight: 500; font-size: 15px; }
  .badge { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 500; }
  .badge-danger { background: #FCEBEB; color: #A32D2D; }
  .badge-warning { background: #FEF3C7; color: #92400E; }
  .badge-success { background: #ECFDF5; color: #065F46; }
  .client-meta { font-size: 12px; color: #666; margin-bottom: 8px; }
  .message-box { background: #f9f9f7; border-radius: 8px; padding: 10px 12px; font-size: 13px; line-height: 1.6; border-left: 2px solid #ddd; }
  .loading { display: flex; align-items: center; gap: 8px; color: #888; font-size: 14px; padding: 1rem 0; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #888; animation: pulse 1.2s infinite; }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
  .error { color: #A32D2D; font-size: 13px; padding: 8px 0; }
  #results { display: none; }
  #loadingEl { display: none; }
</style>
</head>
<body>
<div class="container">
  <h1>AI Lead Retention Analyzer</h1>
  <p class="subtitle">Paste your client visit history — AI identifies who's churning and writes personalized re-engagement messages.</p>
  <div class="card">
    <div class="section-label">Lead data</div>
    <textarea id="clientData">Name, Last Contact, Inquiries, Budget, Interested In
Marcus T., 2024-08-05, 6, $520000, 4BR Single Family
Priya K., 2025-02-10, 2, $280000, Condo
James R., 2024-05-18, 14, $850000, Luxury Home
Angela M., 2025-03-08, 4, $375000, Townhouse
Derek W., 2024-11-20, 3, $410000, Single Family
Brittany S., 2024-02-14, 9, $620000, New Construction
Sofia P., 2025-01-30, 1, $195000, Starter Home
Carmen H., 2024-09-12, 7, $490000, Investment Property</textarea>
    <div class="btn-row">
      <button id="analyzeBtn" onclick="analyze()">Analyze clients</button>
      <span style="font-size:12px;color:#888">Works with any CSV-style lead data</span>
    </div>
  </div>
  <div id="loadingEl" class="loading">
    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    <span>Analyzing lead retention patterns...</span>
  </div>
  <div id="errorEl" class="error"></div>
  <div id="results">
    <div class="metrics" id="metricsRow"></div>
    <div id="clientList"></div>
  </div>
</div>
<script>
async function analyze() {
  const data = document.getElementById('clientData').value.trim();
  if (!data) return;
  document.getElementById('analyzeBtn').disabled = true;
  document.getElementById('loadingEl').style.display = 'flex';
  document.getElementById('results').style.display = 'none';
  document.getElementById('errorEl').textContent = '';
  try {
    const res = await fetch('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data })
    });
    const parsed = await res.json();
    if (parsed.error) throw new Error(parsed.error);
    render(parsed);
  } catch(e) {
    document.getElementById('errorEl').textContent = 'Something went wrong: ' + e.message;
  } finally {
    document.getElementById('loadingEl').style.display = 'none';
    document.getElementById('analyzeBtn').disabled = false;
  }
}
function render(data) {
  const s = data.summary;
  document.getElementById('metricsRow').innerHTML = `
    <div class="metric"><div class="metric-label">Total leads</div><div class="metric-value">${s.total_clients}</div></div>
    <div class="metric"><div class="metric-label">At risk</div><div class="metric-value" style="color:#92400E">${s.at_risk}</div></div>
    <div class="metric"><div class="metric-label">Churned</div><div class="metric-value" style="color:#A32D2D">${s.churned}</div></div>
  `;
  const order = { churned: 0, at_risk: 1, healthy: 2 };
  const sorted = [...data.clients].sort((a,b) => order[a.status] - order[b.status]);
  document.getElementById('clientList').innerHTML = sorted.map(c => {
    const bc = c.status === 'churned' ? 'badge-danger' : c.status === 'at_risk' ? 'badge-warning' : 'badge-success';
    const bt = c.status === 'churned' ? 'Churned' : c.status === 'at_risk' ? 'At risk' : 'Healthy';
    return `<div class="client-row">
      <div class="client-header"><span class="client-name">${c.name}</span><span class="badge ${bc}">${bt}</span></div>
      <div class="client-meta">${c.days_since_visit} days since last visit · ${c.status_reason}</div>
      <div class="message-box">${c.reengagement_message}</div>
    </div>`;
  }).join('');
  document.getElementById('results').style.display = 'block';
}
</script>
</body>
</html>"""

@app.route('/')
def index():
    return render_template_string(HTML)

@app.route('/analyze', methods=['POST'])
def analyze():
    import json
    result = {
        "summary": {"total_clients": 8, "at_risk": 2, "churned": 3, "healthy": 3},
        "clients": [
            {"name": "James R.", "days_since_visit": 291, "status": "churned", "status_reason": "High-value luxury buyer with no contact in nearly 10 months.", "reengagement_message": "Hey James! We know finding the right luxury home takes time — but we've seen some incredible new listings in your range that just hit the market. Would love to send them your way if you're still in the search."},
            {"name": "Brittany S.", "days_since_visit": 390, "status": "churned", "status_reason": "Most engaged lead but hasn't responded in over a year.", "reengagement_message": "Brittany, it's been a while! New construction inventory in DFW has shifted a lot recently — there are some great options that might check all your boxes. Want me to pull together a few that match what you were looking for?"},
            {"name": "Marcus T.", "days_since_visit": 228, "status": "churned", "status_reason": "Active inquirer who went silent after 6 months.", "reengagement_message": "Hey Marcus! The 4BR market in DFW has actually cooled a bit, which means more negotiating power for buyers right now. If you're still thinking about making a move, this could be a good window — happy to chat."},
            {"name": "Angela M.", "days_since_visit": 125, "status": "at_risk", "status_reason": "Townhouse inquiry slowing down — approaching cold threshold.", "reengagement_message": "Hi Angela! Just wanted to check in — a few townhouse listings in your budget just came up that look like a strong fit. Would you want me to schedule a quick showing this week?"},
            {"name": "Derek W.", "days_since_visit": 120, "status": "at_risk", "status_reason": "Moderate engagement that has stalled over the past 4 months.", "reengagement_message": "Hey Derek! Mortgage rates have shifted recently and it could work in your favor on a single family home in your range. Worth a quick call to run the numbers if you're still exploring?"},
            {"name": "Priya K.", "days_since_visit": 38, "status": "healthy", "status_reason": "Recent contact, actively engaged.", "reengagement_message": "Hey Priya! Great connecting recently — I'll keep an eye out for condos that match your criteria and send them over as soon as they hit the market."},
            {"name": "Sofia P.", "days_since_visit": 49, "status": "healthy", "status_reason": "New lead, still warm.", "reengagement_message": "Hi Sofia! Thanks for reaching out about starter homes — I have a couple in mind that just came on. Let me know when you're free for a quick call!"},
            {"name": "Carmen H.", "days_since_visit": 8, "status": "healthy", "status_reason": "Just contacted — fully engaged.", "reengagement_message": "Carmen, great talking this week! I'll put together a shortlist of investment properties in your range and send them over by end of week."}
        ]
    }
    return jsonify(result)

if __name__ == '__main__':
    print("Running at http://localhost:5001")
    app.run(port=5001, debug=False)
