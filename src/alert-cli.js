import { openDb } from './db.js';
import { sendAlerts } from './alerts.js';
import { webhookConfig, postWebhook } from './webhook.js';

let db;
try {
  const config = webhookConfig();
  if (process.argv.includes('--check')) {
    console.log(`Tujuan: ${config.discord ? 'Discord' : config.destination === 'mock' ? 'mock lokal' : 'webhook custom'}. URL disembunyikan. Tidak ada pesan dikirim.`);
  } else if (process.argv.includes('--test')) {
    if (!config.discord) throw new Error('Isi ALERT_WEBHOOK_URL di .env dengan incoming webhook Discord terlebih dahulu.');
    await postWebhook({ content: 'KU Creatives | Tes koneksi notifikasi anggaran berhasil. Ini pesan uji, bukan alert pengeluaran proyek.' }, config);
    console.log('Satu pesan uji berhasil dikonfirmasi Discord. Status alert proyek tidak diubah.');
  } else {
    db = openDb();
    const results = await sendAlerts(db);
    console.log(JSON.stringify({ sent: results.filter(r => r.status === 'sent').length, pending: results.filter(r => r.status === 'pending').length, results }, null, 2));
    if (results.some(r => r.status === 'pending')) process.exitCode = 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { db?.close(); }
