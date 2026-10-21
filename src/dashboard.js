import { weekOf } from './normalize.js';
export function dashboard(db) {
  const projects = db.prepare(`SELECT p.*, COALESCE(SUM(u.amount),0) spend, COUNT(u.source_id) transactions FROM projects p LEFT JOIN usage u ON u.project=p.code AND u.status='included' GROUP BY p.code ORDER BY 1`).all().map(p => ({ ...p, percentage: p.spend / p.budget * 100 }));
  const usage = db.prepare('SELECT source,source_id,project,raw_project,vendor,tool,occurred_at,amount,reference,status,duplicate_of FROM usage ORDER BY occurred_at DESC,source_id').all();
  const weeks = new Map();
  for (const u of usage.filter(u => u.status === 'included')) {
    const key = weekOf(u.occurred_at); weeks.set(key, (weeks.get(key) || 0) + u.amount);
  }
  const keys = [...weeks.keys()].sort();
  if (keys.length) for (let time = Date.parse(keys[0]); time <= Date.parse(keys.at(-1)); time += 7 * 86400000) {
    const key = new Date(time).toISOString().slice(0, 10); if (!weeks.has(key)) weeks.set(key, 0);
  }
  const vendors = db.prepare("SELECT vendor, SUM(amount) spend, COUNT(*) transactions FROM usage WHERE status='included' GROUP BY vendor ORDER BY spend DESC").all();
  const latest = db.prepare('SELECT * FROM imports ORDER BY id DESC LIMIT 1').get();
  const unresolved = usage.filter(u => u.status === 'unresolved');
  return { projects, usage, vendors, weekly: [...weeks].sort(([a], [b]) => a.localeCompare(b)).map(([week, spend]) => ({ week, spend })),
    unresolved, unresolvedSpend: unresolved.reduce((s, u) => s + u.amount, 0),
    duplicateCount: usage.filter(u => u.status === 'duplicate').length,
    latestImport: latest ? { ...latest, summary: JSON.parse(latest.summary) } : null,
    alerts: db.prepare("SELECT * FROM alerts WHERE status!='cancelled' ORDER BY project").all().map(a => ({ ...a, payload: JSON.parse(a.payload) })),
    notifications: db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 50').all().map(n => ({ ...n, payload: JSON.parse(n.payload) })),
  };
}
