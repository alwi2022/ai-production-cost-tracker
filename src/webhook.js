import { createHash } from 'node:crypto';

export function webhookConfig(value = process.env.ALERT_WEBHOOK_URL || `http://127.0.0.1:${process.env.PORT || 3000}/api/mock-webhook`) {
  let url;
  try { url = new URL(value); } catch { throw new Error('ALERT_WEBHOOK_URL tidak valid. Periksa .env.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL webhook harus HTTP/HTTPS tanpa username/password.');
  const discord = ['discord.com', 'ptb.discord.com', 'canary.discord.com'].includes(url.hostname);
  if (discord && (url.protocol !== 'https:' || !/^\/api(?:\/v\d+)?\/webhooks\/\d+\/[^/]+\/?$/.test(url.pathname))) throw new Error('Gunakan URL incoming webhook Discord dari Channel Settings > Integrations.');
  const mock = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname === '/api/mock-webhook';
  if (discord) url.searchParams.set('wait', 'true');
  return { url: url.toString(), discord, destination: mock ? 'mock' : createHash('sha256').update(url.toString()).digest('hex') };
}

export function discordPayload(payload) {
  const mentions = { parse: [] };
  const spend = payload.current_spend_idr, budget = payload.budget_idr;
  if (!Number.isFinite(spend) || !Number.isFinite(budget) || budget <= 0) {
    return { content: String(payload.content || '').slice(0, 2000), allowed_mentions: mentions };
  }
  const amount = value => `Rp ${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
  const percentage = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(spend / budget * 100);
  const over = spend > budget;
  const status = over ? 'Melebihi anggaran' : spend === budget ? 'Anggaran habis' : 'Mendekati batas anggaran';
  const plain = value => String(value ?? '').replace(/[\\`*_~|<>\[\]\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    ...(payload.is_test ? { content: '**Pesan uji** · Contoh tampilan, bukan pengeluaran proyek nyata.' } : {}),
    allowed_mentions: mentions,
    embeds: [{
      title: plain(payload.project_name || payload.project).slice(0, 256),
      description: `\`${plain(payload.project).slice(0, 100)}\` · **${status}**`,
      color: spend >= budget ? 0xc74343 : 0xd79a36,
      fields: [
        { name: 'Pengeluaran', value: amount(spend), inline: true },
        { name: 'Anggaran', value: amount(budget), inline: true },
        { name: 'Terpakai', value: `${percentage}%`, inline: true },
        { name: over ? 'Kelebihan anggaran' : 'Sisa anggaran', value: amount(Math.abs(budget - spend)), inline: false },
      ],
      footer: { text: 'KU Creatives · Ambang notifikasi 80%' },
    }],
  };
}

export async function postWebhook(payload, config, { fetchImpl = fetch, idempotencyKey } = {}) {
  const body = config.discord ? discordPayload(payload) : payload;
  let response;
  try {
    response = await fetchImpl(config.url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000), redirect: 'error',
    });
  } catch { throw new Error('Webhook tidak dapat dihubungi atau timeout. Periksa koneksi dan URL di .env.'); }
  if (!response.ok) {
    let suffix = '';
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter && /^\d+(\.\d+)?$/.test(retryAfter)) suffix = `; coba lagi setelah ${retryAfter} detik`;
    }
    throw new Error(`HTTP ${response.status}${suffix}`);
  }
  if (config.discord) {
    const message = await response.json().catch(() => null);
    if (!message?.id) throw new Error('Discord belum mengonfirmasi pesan. Pengiriman tetap tertunda.');
    return { messageId: message.id };
  }
  return {};
}
