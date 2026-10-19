const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function fetchVendorC({ baseUrl = process.env.VENDOR_C_URL || 'http://127.0.0.1:4010', apiKey = process.env.VENDOR_C_API_KEY, fetchImpl = fetch, sleep = delay, retries = 5 } = {}) {
  if (!apiKey) throw new Error('VENDOR_C_API_KEY belum diisi. Salin test key dari docs/vendor_c_api.md ke .env.');
  const records = [];
  for (let page = 1; page <= 10000; page++) {
    let response;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/v1/usage?page=${page}&per_page=100`, {
          headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(10000),
        });
      } catch {
        if (attempt === retries) throw new Error('Vendor C tidak dapat dihubungi. Pastikan mock API berjalan.');
        await sleep(Math.min(1000 * 2 ** attempt, 10000)); continue;
      }
      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) throw new Error(`Vendor C HTTP ${response.status}. Periksa API key dan konfigurasi.`);
      if (attempt === retries) throw new Error(`Vendor C gagal setelah ${retries + 1} percobaan (HTTP ${response.status}). Coba import lagi.`);
      const retryAfter = response.headers.get('Retry-After');
      const wait = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now())) : Math.min(1000 * 2 ** attempt, 10000);
      await sleep(Number.isFinite(wait) ? Math.min(wait, 60000) : 2000);
    }
    const body = await response.json();
    if (!Array.isArray(body.data) || typeof body.has_more !== 'boolean' || (body.has_more && !body.data.length)) throw new Error('Invalid Vendor C pagination response');
    records.push(...body.data);
    if (!body.has_more) return records;
  }
  throw new Error('Vendor C pagination limit exceeded');
}
