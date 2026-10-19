import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { hash, money, projectCode, timestamp, wibDate } from './normalize.js';
import { fetchVendorC } from './vendor.js';

async function csv(path) { return parse(await readFile(path, 'utf8'), { columns: true, skip_empty_lines: true, bom: true, trim: true }); }
function cell(value) { return value?.richText ? value.richText.map(x => x.text).join('') : value?.result ?? value; }

export function reconcile(db) {
  const rows = db.prepare('SELECT * FROM usage').all();
  const assignments = new Map(db.prepare('SELECT * FROM assignments').all().map(r => [`${r.source}:${r.source_id}`, r.project]));
  const update = db.prepare('UPDATE usage SET project=?, status=?, duplicate_of=? WHERE source=? AND source_id=?');
  const seen = new Map();
  for (const row of rows) {
    row.project = assignments.get(`${row.source}:${row.source_id}`) || projectCode(row.raw_project);
    row.status = row.project ? 'included' : 'unresolved';
    row.duplicate_of = null;
  }
  const vendorA = rows.filter(r => r.source === 'vendor_a');
  for (const row of rows.filter(r => r.source === 'manual')) {
    let match;
    if (row.vendor === 'Vendor A') {
      if (row.reference) {
        const candidate = vendorA.find(r => r.source_id === row.reference);
        if (candidate && candidate.amount === row.amount && candidate.project === row.project) match = candidate;
      } else if (row.project) {
        const candidates = vendorA.filter(r => r.project === row.project && r.amount === row.amount && wibDate(r.occurred_at) === wibDate(row.occurred_at) && r.tool.startsWith(row.tool.toLowerCase().split(' ')[0] + ' /'));
        if (candidates.length === 1) match = candidates[0];
      }
    }
    const fingerprint = hash([wibDate(row.occurred_at), row.project || row.raw_project.toLowerCase(), row.vendor.toLowerCase(), row.tool.toLowerCase(), row.amount, row.reference || '']);
    const previous = seen.get(fingerprint);
    if (match || previous) {
      row.status = 'duplicate'; row.duplicate_of = match ? `vendor_a:${match.source_id}` : `manual:${previous}`;
    }
    seen.set(fingerprint, row.source_id);
  }
  for (const row of rows) update.run(row.project, row.status, row.duplicate_of, row.source, row.source_id);
}

export async function importAll(db, { dataDir = resolve('data'), vendorOptions } = {}) {
  const started = new Date().toISOString();
  const [projects, a, b, ratesText, c] = await Promise.all([
    csv(resolve(dataDir, 'projects.csv')), csv(resolve(dataDir, 'vendor_a.csv')), csv(resolve(dataDir, 'vendor_b.csv')),
    readFile(resolve(dataDir, 'rates.json'), 'utf8'), fetchVendorC(vendorOptions),
  ]);
  const rates = JSON.parse(ratesText);
  if (![rates.credit_to_idr, rates.usd_to_idr].every(x => Number.isInteger(x) && x > 0)) throw new Error('Invalid conversion rates');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(resolve(dataDir, 'manual_ops.xlsx'));
  const sheet = workbook.getWorksheet('Rekap Sep-Okt');
  if (!sheet || cell(sheet.getCell('A3').value) !== 'Tanggal' || cell(sheet.getCell('E3').value) !== 'Nominal') throw new Error('Unexpected manual spreadsheet layout');
  const records = [], rejected = [], occurrences = new Map();
  function add(source, sourceId, raw, normalize) {
    try {
      const record = normalize();
      if (!sourceId || !Number.isSafeInteger(record.amount)) throw new Error('Invalid ID or amount');
      records.push({ source, source_id: String(sourceId), reference: null, ...record, raw: JSON.stringify(raw) });
    } catch (error) { rejected.push({ source, sourceId, reason: error.message }); }
  }
  for (const r of a) add('vendor_a', r.transaction_id, r, () => {
    if (!/^-?\d+$/.test(r.credits)) throw new Error('Invalid credits');
    return { raw_project: r.project_tag, vendor: 'Vendor A', tool: `${r.job_type} / ${r.model}`, occurred_at: timestamp(r.timestamp_utc, 'vendor_a'), amount: Number(r.credits) * rates.credit_to_idr * 100, reference: r.ref_transaction_id || null };
  });
  for (const r of b) add('vendor_b', r.line_id, r, () => ({ raw_project: r.workspace, vendor: 'Vendor B', tool: r.product, occurred_at: timestamp(r.time_utc, 'vendor_b'), amount: money(r.usd_amount, 'USD') * rates.usd_to_idr }));
  for (const r of c) add('vendor_c', r.id, r, () => {
    if (!Number.isSafeInteger(r.amount_usd_cents)) throw new Error('Invalid USD cents');
    return { raw_project: String(r.project ?? ''), vendor: 'Vendor C', tool: r.service, occurred_at: timestamp(r.created_at, 'vendor_c'), amount: r.amount_usd_cents * rates.usd_to_idr };
  });
  sheet.eachRow((row, number) => {
    if (number <= 3 || !row.getCell(1).value || cell(row.getCell(4).value) === 'TOTAL') return;
    const raw = Object.fromEntries(['date', 'project', 'vendor', 'description', 'amount', 'ref'].map((k, i) => [k, cell(row.getCell(i + 1).value)]));
    try {
      const normalized = { raw_project: String(raw.project ?? '').trim(), vendor: String(raw.vendor ?? '').trim(), tool: String(raw.description ?? '').trim(), occurred_at: timestamp(raw.date, 'manual'), amount: money(raw.amount, 'IDR'), reference: raw.ref ? String(raw.ref).trim() : null };
      const fingerprint = hash([normalized.occurred_at, projectCode(normalized.raw_project) || normalized.raw_project.toLowerCase(), normalized.vendor.toLowerCase(), normalized.tool.toLowerCase(), normalized.amount, normalized.reference]);
      const occurrence = (occurrences.get(fingerprint) || 0) + 1; occurrences.set(fingerprint, occurrence);
      add('manual', `${fingerprint}:${occurrence}`, { ...raw, sheet: sheet.name, row: number }, () => normalized);
    } catch (error) { rejected.push({ source: 'manual', sourceId: `row ${number}`, reason: error.message }); }
  });
  // Abort before committing a partial dataset; the dashboard keeps its last successful import.
  if (rejected.length) throw new Error(`Import dibatalkan: ${JSON.stringify(rejected)}`);
  let inserted = 0, updated = 0, repeated = 0;
  const unique = new Map();
  for (const r of records) {
    const key = `${r.source}:${r.source_id}`;
    if (unique.has(key)) {
      if (unique.get(key).raw !== r.raw) throw new Error(`Conflicting source ID: ${key}`);
      repeated++;
    } else unique.set(key, r);
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const projectInsert = db.prepare('INSERT INTO projects VALUES(?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,client=excluded.client,budget=excluded.budget');
    for (const p of projects) projectInsert.run(p.project_code, p.project_name, p.client, money(p.budget_idr, 'IDR'));
    const existing = db.prepare('SELECT raw,amount,occurred_at FROM usage WHERE source=? AND source_id=?');
    const upsert = db.prepare(`INSERT INTO usage(source,source_id,project,raw_project,vendor,tool,occurred_at,amount,reference,raw,status) VALUES(?,?,NULL,?,?,?,?,?,?,?,'unresolved')
      ON CONFLICT(source,source_id) DO UPDATE SET raw_project=excluded.raw_project,vendor=excluded.vendor,tool=excluded.tool,occurred_at=excluded.occurred_at,amount=excluded.amount,reference=excluded.reference,raw=excluded.raw`);
    for (const r of unique.values()) {
      const before = existing.get(r.source, r.source_id);
      if (!before) inserted++; else if (before.raw !== r.raw || before.amount !== r.amount || before.occurred_at !== r.occurred_at) updated++;
      upsert.run(r.source, r.source_id, r.raw_project, r.vendor, r.tool, r.occurred_at, r.amount, r.reference, r.raw);
    }
    reconcile(db);
    const counts = Object.fromEntries(db.prepare('SELECT status,COUNT(*) count FROM usage GROUP BY status').all().map(r => [r.status, r.count]));
    const summary = { read: records.length, inserted, updated, unchanged: unique.size - inserted - updated, repeated, counts, sources: { vendor_a: a.length, vendor_b: b.length, vendor_c: c.length, manual: records.filter(r => r.source === 'manual').length }, rates };
    db.prepare('INSERT INTO imports(started_at,completed_at,summary) VALUES(?,?,?)').run(started, new Date().toISOString(), JSON.stringify(summary));
    db.exec('COMMIT');
    return summary;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
