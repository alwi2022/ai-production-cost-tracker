import { webhookConfig, postWebhook } from './webhook.js';

export async function sendAlerts(db, { webhookUrl, fetchImpl = fetch } = {}) {
  const config = webhookConfig(webhookUrl);
  const projects = db.prepare(`SELECT p.*, COALESCE(SUM(u.amount),0) spend FROM projects p LEFT JOIN usage u ON u.project=p.code AND u.status='included' GROUP BY p.code`).all();
  for (const p of projects) {
    const payload = { project: p.code, project_name: p.name, current_spend_idr: p.spend / 100, budget_idr: p.budget / 100, percentage_used: Math.round(p.spend / p.budget * 10000) / 100,
      content: `${p.name} (${p.code}): pengeluaran Rp${(p.spend / 100).toLocaleString('id-ID')} dari anggaran Rp${(p.budget / 100).toLocaleString('id-ID')} (${(p.spend / p.budget * 100).toFixed(2)}%). Ambang 80% terlewati.` };
    if (p.spend * 100 <= p.budget * 80) {
      db.prepare("UPDATE alert_deliveries SET status='cancelled',payload=?,error=NULL WHERE project=? AND destination=? AND status='pending'").run(JSON.stringify(payload), p.code, config.destination);
      continue;
    }
    db.prepare("INSERT INTO alert_deliveries(project,destination,status,payload) VALUES(?,?,'pending',?) ON CONFLICT(project,destination) DO NOTHING").run(p.code, config.destination, JSON.stringify(payload));
    db.prepare("UPDATE alert_deliveries SET payload=?,status='pending',error=NULL WHERE project=? AND destination=? AND status IN ('pending','cancelled')").run(JSON.stringify(payload), p.code, config.destination);
  }
  const results = [];
  for (const alert of db.prepare("SELECT * FROM alert_deliveries WHERE destination=? AND status='pending'").all(config.destination)) {
    try {
      await postWebhook(JSON.parse(alert.payload), config, { fetchImpl, idempotencyKey: `budget-80-${alert.project}` });
      db.prepare("UPDATE alert_deliveries SET status='sent',sent_at=?,attempts=attempts+1,error=NULL WHERE project=? AND destination=?").run(new Date().toISOString(), alert.project, config.destination);
      results.push({ project: alert.project, status: 'sent' });
    } catch (error) {
      const message = error.message;
      db.prepare('UPDATE alert_deliveries SET attempts=attempts+1,error=? WHERE project=? AND destination=?').run(message, alert.project, config.destination);
      results.push({ project: alert.project, status: 'pending', error: message });
    }
  }
  db.prepare(`INSERT INTO alerts(project,status,payload,attempts,error,sent_at)
    SELECT project,status,payload,attempts,error,sent_at FROM alert_deliveries WHERE destination=?
    ON CONFLICT(project) DO UPDATE SET status=excluded.status,payload=excluded.payload,attempts=excluded.attempts,error=excluded.error,sent_at=excluded.sent_at`).run(config.destination);
  return results;
}
