import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.js';
import { sendAlerts } from '../src/alerts.js';
import { webhookConfig, postWebhook } from '../src/webhook.js';

const discordUrl = 'https://discord.com/api/webhooks/123/fixture-only-token';
function seed(db) {
  db.prepare('INSERT INTO projects VALUES(?,?,?,?)').run('GBX-01', 'Greenbox', 'Client', 10000);
  db.prepare("INSERT INTO usage VALUES('vendor_a','1','GBX-01','GBX-01','Vendor A','video','2026-09-01T00:00:00Z',8100,NULL,'{}','included',NULL)").run();
}

test('Discord confirms message creation and disables mentions without exposing the URL in delivery identity', async () => {
  const config = webhookConfig(discordUrl);
  assert.equal(new URL(config.url).searchParams.get('wait'), 'true');
  assert.match(config.destination, /^[a-f0-9]{64}$/);
  const result = await postWebhook({ content: 'Project @everyone', project: 'GBX-01' }, config, { fetchImpl: async (url, request) => {
    assert.equal(url, config.url);
    assert.equal(request.redirect, 'error');
    assert.deepEqual(JSON.parse(request.body), { content: 'Project @everyone', allowed_mentions: { parse: [] } });
    return Response.json({ id: 'discord-message-1' });
  } });
  assert.equal(result.messageId, 'discord-message-1');
  assert.throws(() => webhookConfig('https://discord.com/not-a-webhook'), /incoming webhook/);
  assert.throws(() => webhookConfig('file:///private/path'), /HTTP/);
});

test('switching from mock to Discord delivers once to each destination', async () => {
  const db = openDb(':memory:'); seed(db);
  let calls = 0;
  try {
    await sendAlerts(db, { webhookUrl: 'http://127.0.0.1:3000/api/mock-webhook', fetchImpl: async () => { calls++; return new Response(null, { status: 204 }); } });
    const first = await sendAlerts(db, { webhookUrl: discordUrl, fetchImpl: async () => { calls++; return Response.json({ id: 'message-2' }); } });
    assert.deepEqual(first, [{ project: 'GBX-01', status: 'sent' }]);
    await sendAlerts(db, { webhookUrl: discordUrl, fetchImpl: async () => { throw new Error('Must not resend'); } });
    assert.equal(calls, 2);
    assert.equal(db.prepare('SELECT COUNT(*) count FROM alert_deliveries').get().count, 2);
    assert.equal(db.prepare('SELECT status FROM alerts').get().status, 'sent');
  } finally { db.close(); }
});

test('Discord errors stay pending and error output never includes the webhook credential', async () => {
  const db = openDb(':memory:'); seed(db);
  try {
    const failed = await sendAlerts(db, { webhookUrl: discordUrl, fetchImpl: async () => new Response(null, { status: 429, headers: { 'Retry-After': '2' } }) });
    assert.equal(failed[0].status, 'pending'); assert.match(failed[0].error, /429.*2 detik/);
    await sendAlerts(db, { webhookUrl: discordUrl, fetchImpl: async () => { throw new Error(`Failed fetching ${discordUrl}`); } });
    assert.doesNotMatch(db.prepare('SELECT error FROM alerts').get().error, /fixture-only-token/);
    await sendAlerts(db, { webhookUrl: discordUrl, fetchImpl: async () => Response.json({ id: 'confirmed' }) });
    assert.equal(db.prepare('SELECT status,attempts FROM alerts').get().status, 'sent');
    assert.equal(db.prepare('SELECT attempts FROM alerts').get().attempts, 3);
  } finally { db.close(); }
});

test('Discord HTTP success without a confirmed message does not mark delivery sent', async () => {
  const db = openDb(':memory:'); seed(db);
  try {
    await sendAlerts(db, { webhookUrl: discordUrl, fetchImpl: async () => Response.json({}) });
    assert.equal(db.prepare('SELECT status FROM alerts').get().status, 'pending');
  } finally { db.close(); }
});

test('legacy mock delivery history migrates once and survives reopening after Discord activation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tracker-webhook-test-'));
  const filename = join(dir, 'test.sqlite');
  let db;
  try {
    db = openDb(filename); seed(db);
    db.exec('DROP TABLE alert_deliveries');
    db.prepare("INSERT INTO alerts VALUES(?,'sent',?,1,NULL,?)").run('GBX-01', JSON.stringify({ content: 'Legacy notification' }), '2026-09-01T00:00:00Z');
    db.close(); db = openDb(filename);
    assert.equal(db.prepare("SELECT status FROM alert_deliveries WHERE destination='mock'").get().status, 'sent');
    await sendAlerts(db, { webhookUrl: discordUrl, fetchImpl: async () => Response.json({ id: 'new-destination-message' }) });
    db.close(); db = openDb(filename);
    assert.equal(db.prepare('SELECT COUNT(*) count FROM alert_deliveries').get().count, 2);
    assert.equal(db.prepare("SELECT attempts FROM alert_deliveries WHERE destination='mock'").get().attempts, 1);
  } finally { db?.close(); await rm(dir, { recursive: true, force: true }); }
});
