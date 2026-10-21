import express from 'express';
import multer from 'multer';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { importAll, reconcile } from './importer.js';
import { sendAlerts } from './alerts.js';
import { dashboard } from './dashboard.js';

export function createApp(db = openDb(), options = {}) {
  const app = express();
  let busy = false;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    if (req.method === 'POST' && (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`))) return res.status(403).json({ error: 'Cross-origin writes are not allowed' });
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  const fileNames = { vendor_a: 'vendor_a.csv', vendor_b: 'vendor_b.csv', manual: 'manual_ops.xlsx' };
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 3, fields: 0, parts: 4 },
    fileFilter(req, file, done) {
      const expected = fileNames[file.fieldname];
      if (!expected || !file.originalname.toLowerCase().endsWith(expected.endsWith('.xlsx') ? '.xlsx' : '.csv')) return done(new Error('Pilih CSV untuk vendor dan XLSX untuk operasional.'));
      done(null, true);
    },
  }).fields(Object.keys(fileNames).map(name => ({ name, maxCount: 1 })));
  app.get('/api/dashboard', (req, res) => { res.set('Cache-Control', 'no-store'); res.json(dashboard(db)); });
  app.get('/api/health', (req, res) => res.json({ status: 'ok', busy }));
  async function exclusive(res, action) {
    if (busy) return res.status(409).json({ error: 'Proses lain sedang berjalan. Tunggu sebentar.' });
    busy = true;
    try { return res.json(await action()); }
    catch (error) { return res.status(502).json({ error: error.message }); }
    finally { busy = false; }
  }
  app.post('/api/import', (req, res) => exclusive(res, async () => {
    const summary = await importAll(db, options.importOptions);
    const alerts = await sendAlerts(db, options.alertOptions);
    return { summary, alerts };
  }));
  app.post('/api/import/upload', (req, res) => exclusive(res, async () => {
    await new Promise((resolveUpload, reject) => upload(req, res, error => error ? reject(error) : resolveUpload()));
    if (!Object.keys(req.files || {}).length) throw new Error('Pilih minimal satu file untuk diunggah.');
    const directory = await mkdtemp(resolve(tmpdir(), 'cost-tracker-upload-'));
    try {
      await cp(options.importOptions?.dataDir || resolve('data'), directory, { recursive: true });
      for (const [key, files] of Object.entries(req.files)) {
        if (!files[0].size) throw new Error('File kosong tidak dapat diimpor.');
        await writeFile(resolve(directory, fileNames[key]), files[0].buffer);
      }
      const summary = await importAll(db, { ...options.importOptions, dataDir: directory });
      const alerts = await sendAlerts(db, options.alertOptions);
      return { summary, alerts };
    } finally { await rm(directory, { recursive: true, force: true }); }
  }));
  app.post('/api/alerts/retry', (req, res) => exclusive(res, async () => ({ alerts: await sendAlerts(db, options.alertOptions) })));
  app.post('/api/resolve', (req, res) => exclusive(res, async () => {
    const { source, sourceId, project } = req.body || {};
    if (!db.prepare('SELECT 1 FROM projects WHERE code=?').get(project || '') || !db.prepare("SELECT 1 FROM usage WHERE source=? AND source_id=? AND status='unresolved'").get(source || '', sourceId || '')) throw new Error('Pilih transaksi unresolved dan proyek yang valid.');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO assignments VALUES(?,?,?) ON CONFLICT(source,source_id) DO UPDATE SET project=excluded.project').run(source, sourceId, project);
      reconcile(db); db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return { ok: true, alerts: await sendAlerts(db, options.alertOptions) };
  }));
  app.post('/api/mock-webhook', (req, res) => {
    if (!req.body?.project || !req.body?.content) return res.status(400).json({ error: 'Invalid notification' });
    const exists = db.prepare('SELECT 1 FROM notifications WHERE json_extract(payload,\'$.project\')=?').get(req.body.project);
    if (!exists) db.prepare('INSERT INTO notifications(received_at,payload) VALUES(?,?)').run(new Date().toISOString(), JSON.stringify(req.body));
    res.json({ ok: true, duplicate: Boolean(exists) });
  });
  app.use(express.static(resolve('public')));
  app.use((error, req, res, next) => res.status(400).json({ error: 'Request tidak valid.' }));
  return app;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, '127.0.0.1', () => console.log(`Production Cost Tracker: http://127.0.0.1:${port}`));
}
