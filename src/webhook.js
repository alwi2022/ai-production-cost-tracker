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

export async function postWebhook(payload, config, { fetchImpl = fetch, idempotencyKey } = {}) {
  const body = config.discord ? { content: payload.content.slice(0, 2000), allowed_mentions: { parse: [] } } : payload;
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
