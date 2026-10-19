import { openDb } from './db.js';
import { importAll } from './importer.js';
import { sendAlerts } from './alerts.js';
const db = openDb();
try {
  console.log(JSON.stringify({ summary: await importAll(db), alerts: await sendAlerts(db) }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { db.close(); }
