export async function sendAlerts(db, { webhookUrl = process.env.ALERT_WEBHOOK_URL || `http://127.0.0.1:${process.env.PORT || 3000}/api/mock-webhook`, fetchImpl = fetch } = {}) {
  const projects = db.prepare(`SELECT p.*, COALESCE(SUM(u.amount),0) spend FROM projects p LEFT JOIN usage u ON u.project=p.code AND u.status='included' GROUP BY p.code`).all();
  for (const p of projects) {
    if (p.spend * 100 <= p.budget * 80) continue;
    const payload = { project: p.code, project_name: p.name, current_spend_idr: p.spend / 100, budget_idr: p.budget / 100, percentage_used: Math.round(p.spend / p.budget * 10000) / 100,
      content: `${p.name} (${p.code}): pengeluaran Rp${(p.spend / 100).toLocaleString('id-ID')} dari anggaran Rp${(p.budget / 100).toLocaleString('id-ID')} (${(p.spend / p.budget * 100).toFixed(2)}%). Ambang 80% terlewati.` };
    db.prepare("INSERT INTO alerts(project,status,payload) VALUES(?,'pending',?) ON CONFLICT(project) DO NOTHING").run(p.code, JSON.stringify(payload));
    db.prepare("UPDATE alerts SET payload=? WHERE project=? AND status='pending'").run(JSON.stringify(payload), p.code);
  }
  const results = [];
  for (const alert of db.prepare("SELECT * FROM alerts WHERE status='pending'").all()) {
    try {
      const response = await fetchImpl(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `budget-80-${alert.project}` }, body: alert.payload, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      db.prepare("UPDATE alerts SET status='sent',sent_at=?,attempts=attempts+1,error=NULL WHERE project=?").run(new Date().toISOString(), alert.project);
      results.push({ project: alert.project, status: 'sent' });
    } catch (error) {
      const message = error.message.startsWith('HTTP ') ? error.message : 'Webhook tidak dapat dihubungi atau timeout';
      db.prepare('UPDATE alerts SET attempts=attempts+1,error=? WHERE project=?').run(message, alert.project);
      results.push({ project: alert.project, status: 'pending', error: message });
    }
  }
  return results;
}
