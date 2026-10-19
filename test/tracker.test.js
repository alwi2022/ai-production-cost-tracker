import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openDb } from '../src/db.js';
import { money, timestamp, weekOf, projectCode } from '../src/normalize.js';
import { importAll, reconcile } from '../src/importer.js';
import { dashboard } from '../src/dashboard.js';
import { sendAlerts } from '../src/alerts.js';
import { fetchVendorC } from '../src/vendor.js';
import { createApp } from '../src/server.js';

const fixture = JSON.parse(await readFile(new URL('../vendor-c-mock/data.json', import.meta.url)));
const fixtureOptions = { apiKey: 'fixture-only', fetchImpl: async url => {
  const page = Number(new URL(url).searchParams.get('page'));
  return Response.json({ data: fixture.slice((page - 1) * 100, page * 100), has_more: page * 100 < fixture.length });
} };

test('money preserves precision, locale separators and refunds', () => {
  assert.equal(money('$1,036.15', 'USD'), 103615);
  assert.equal(money('Rp 1.850.000', 'IDR'), 185000000);
  assert.equal(money(312160, 'IDR'), 31216000);
  assert.equal(money('-12.50', 'USD'), -1250);
  assert.throws(() => money('12oops', 'USD'));
  assert.equal(3455 * 16250, 56143750);
});
test('source dates, WIB week boundary and aliases are explicit', () => {
  assert.equal(timestamp('09/06/2026 21:49', 'vendor_a'), '2026-09-06T21:49:00.000Z');
  assert.equal(timestamp('06-09-2026 21:49', 'vendor_b'), '2026-09-06T21:49:00.000Z');
  assert.equal(timestamp('7/9/2026', 'manual'), '2026-09-06T17:00:00.000Z');
  assert.equal(timestamp('01 Okt 2026', 'manual'), '2026-09-30T17:00:00.000Z');
  assert.equal(weekOf('2026-09-06T21:49:00Z'), '2026-09-07');
  assert.equal(projectCode('KMD 02'), 'KMD-02');
  assert.equal(projectCode('sandbox'), null);
  assert.throws(() => timestamp('02/30/2026 00:00', 'vendor_a'));
});
test('API follows pagination, honors 429 Retry-After and retries 500', async () => {
  const waits = [], urls = []; let call = 0;
  const records = await fetchVendorC({ apiKey: 'test', sleep: async ms => waits.push(ms), fetchImpl: async url => {
    urls.push(url); call++;
    if (call === 1) return new Response('', { status: 429, headers: { 'Retry-After': '2' } });
    if (call === 2) return new Response('', { status: 500 });
    return Response.json({ data: [{ id: call }], has_more: call === 3 });
  } });
  assert.equal(records.length, 2); assert.equal(waits[0], 2000); assert.match(urls.at(-1), /page=2/);
  await assert.rejects(fetchVendorC({ apiKey: 'bad', fetchImpl: async () => new Response('', { status: 401 }) }), /401/);
  await assert.rejects(fetchVendorC({ apiKey: 'test', fetchImpl: async () => Response.json({ data: [], has_more: true }) }), /pagination/);
});
test('all supplied sources reconcile, retain refunds, and reimport without inflated totals', async () => {
  const db = openDb(':memory:');
  try {
    const first = await importAll(db, { vendorOptions: fixtureOptions });
    assert.equal(first.read, 387); assert.equal(first.inserted, 383); assert.equal(first.repeated, 4);
    assert.deepEqual(first.counts, { duplicate: 19, included: 351, unresolved: 13 });
    assert.equal(db.prepare("SELECT SUM(amount) total FROM usage WHERE source='vendor_a'").get().total, 1308112000);
    assert.equal(db.prepare("SELECT SUM(amount) total FROM usage WHERE source='manual' AND status!='duplicate'").get().total, 2185000000);
    assert.equal(db.prepare("SELECT COUNT(*) count FROM usage WHERE source='vendor_a' AND amount<0").get().count, 6);
    const before = dashboard(db);
    const total = before.projects.reduce((s, p) => s + p.spend, 0) + before.unresolvedSpend;
    assert.equal(total, 16583072000);
    const second = await importAll(db, { vendorOptions: fixtureOptions });
    assert.equal(second.inserted, 0); assert.equal(second.updated, 0); assert.equal(second.unchanged, 383);
    assert.deepEqual(dashboard(db).projects, before.projects);
    const unresolved = before.unresolved[0];
    db.prepare('INSERT INTO assignments VALUES(?,?,?)').run(unresolved.source, unresolved.source_id, 'INT-00'); reconcile(db);
    await importAll(db, { vendorOptions: fixtureOptions });
    assert.equal(dashboard(db).unresolved.length, 12);
    assert.equal(db.prepare('SELECT project FROM usage WHERE source=? AND source_id=?').get(unresolved.source, unresolved.source_id).project, 'INT-00');
  } finally { db.close(); }
});
test('source failure leaves previous successful data unchanged', async () => {
  const db = openDb(':memory:');
  try {
    await importAll(db, { vendorOptions: fixtureOptions });
    const before = dashboard(db);
    await assert.rejects(importAll(db, { vendorOptions: { apiKey: 'bad', fetchImpl: async () => new Response('', { status: 401 }) } }));
    assert.deepEqual(dashboard(db), before);
  } finally { db.close(); }
});
test('alerts: strictly over 80%, failed delivery retry, once per project', async () => {
  const db = openDb(':memory:');
  try {
    db.prepare('INSERT INTO projects VALUES(?,?,?,?)').run('GBX-01', 'Test', 'Client', 10000);
    db.prepare("INSERT INTO usage VALUES('vendor_a','1','GBX-01','GBX-01','Vendor A','video','2026-09-01T00:00:00Z',8000,NULL,'{}','included',NULL)").run();
    let calls = 0;
    const success = async () => { calls++; return new Response(null, { status: 204 }); };
    await sendAlerts(db, { fetchImpl: success }); assert.equal(calls, 0);
    db.prepare('UPDATE usage SET amount=8100').run();
    await sendAlerts(db, { fetchImpl: async () => new Response('', { status: 500 }) });
    assert.equal(db.prepare('SELECT status FROM alerts').get().status, 'pending');
    await sendAlerts(db, { fetchImpl: async () => { calls++; return new Response(null, { status: 204 }); } });
    await sendAlerts(db, { fetchImpl: success }); assert.equal(calls, 1);
    assert.equal(db.prepare('SELECT attempts FROM alerts').get().attempts, 2);
  } finally { db.close(); }
});
test('HTTP import, persisted dashboard, mocked webhook and duplicate alert protection', async () => {
  const db = openDb(':memory:');
  const app = createApp(db, { importOptions: { vendorOptions: fixtureOptions }, alertOptions: {} });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const url = `http://127.0.0.1:${server.address().port}`;
  // Resolve the local test receiver dynamically while keeping the real HTTP boundary.
  const oldPort = process.env.PORT; process.env.PORT = String(server.address().port);
  try {
    const response = await fetch(`${url}/api/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 200);
    const first = await (await fetch(`${url}/api/dashboard`)).json();
    assert.equal(first.projects.length, 6); assert.ok(first.notifications.length > 0);
    assert.ok(first.alerts.every(a => a.status === 'sent'));
    await fetch(`${url}/api/import`, { method: 'POST' });
    const second = await (await fetch(`${url}/api/dashboard`)).json();
    assert.deepEqual(second.projects, first.projects); assert.equal(second.notifications.length, first.notifications.length);
    const blocked = await fetch(`${url}/api/import`, { method: 'POST', headers: { Origin: 'https://other.example' } });
    assert.equal(blocked.status, 403);
    const home = await fetch(url); assert.equal(home.status, 200); assert.match(await home.text(), /KU Creatives/);
  } finally {
    if (oldPort === undefined) delete process.env.PORT; else process.env.PORT = oldPort;
    await new Promise(resolve => server.close(resolve)); db.close();
  }
});
