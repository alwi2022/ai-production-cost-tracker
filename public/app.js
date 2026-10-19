const $ = selector => document.querySelector(selector);
const state = { data: null, view: 'overview', project: '', status: 'all', search: '', page: 1, busy: false, error: '' };
const titles = { overview: 'Overview', projects: 'Proyek', transactions: 'Transaksi', imports: 'Sumber & import', alerts: 'Notifikasi' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
const rupiah = value => `Rp${number(value / 100)}`;
const compact = value => new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(value / 100);
const pct = value => `${number(Math.round(value * 10) / 10)}%`;
const date = value => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const datetime = value => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const projectOptions = selected => state.data.projects.map(p => `<option value="${esc(p.code)}" ${p.code === selected ? 'selected' : ''}>${esc(p.code)} · ${esc(p.client)}</option>`).join('');
const badge = (text, kind = '') => `<span class="badge ${kind}">${esc(text)}</span>`;
const budgetStatus = p => p.percentage >= 100 ? ['Melebihi anggaran', 'danger'] : p.percentage > 80 ? ['Perlu perhatian', 'warn'] : ['Dalam anggaran', ''];
let toastTimer;
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 6500); }
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Request gagal'); return result;
}
async function refresh() { state.data = await api('/api/dashboard'); render(); }
function heading(title, subtitle) {
  return `<div class="page-heading"><div><p class="eyebrow">PRODUCTION FINANCE</p><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions"><button class="button" id="export">↓ Export CSV</button><button class="button primary" id="import" ${state.busy ? 'disabled' : ''}><span aria-hidden="true">↥</span>${state.busy ? 'Mengimpor…' : 'Import data'}</button></div></div>`;
}
function toolbar() {
  const last = state.data.latestImport;
  return `<div class="toolbar"><div class="filter-group"><label for="project-filter">Proyek</label><select id="project-filter" class="select"><option value="">Semua proyek</option>${projectOptions(state.project)}</select><button class="button" id="theme-main" aria-label="Ganti tema">◐ <span>Tema</span></button></div><div class="sync-label"><span class="status-dot"></span>${last ? `Import terakhir ${datetime(last.completed_at)} WIB` : 'Belum ada data yang diimpor'}</div></div>`;
}
function getScope() {
  const projects = state.data.projects.filter(p => !state.project || p.code === state.project);
  const usage = state.data.usage.filter(u => u.status === 'included' && (!state.project || u.project === state.project));
  return { projects, usage, spend: projects.reduce((s, p) => s + p.spend, 0), budget: projects.reduce((s, p) => s + p.budget, 0) };
}
function empty() {
  return `<div class="panel empty"><p class="eyebrow">WORKSPACE SIAP</p><h2>Mulai dari data produksi kamu.</h2><p>Impor CSV, Excel, dan API Vendor C untuk melihat biaya proyek yang sudah direkonsiliasi. Pastikan mock Vendor C berjalan dan API key sudah diisi.</p><button class="button primary" id="empty-import" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Mengimpor…' : 'Import empat sumber'}</button></div>`;
}
function metrics() {
  const { projects, usage, spend, budget } = getScope();
  const atRisk = projects.filter(p => p.percentage > 80).length;
  return `<div class="metrics"><div class="metric"><div class="metric-label">Total pengeluaran</div><div class="metric-value" title="${rupiah(spend)}"><span class="currency">Rp</span>${compact(spend)}</div><div class="metric-note">${usage.length} transaksi terhitung</div></div><div class="metric"><div class="metric-label">Total anggaran</div><div class="metric-value" title="${rupiah(budget)}"><span class="currency">Rp</span>${compact(budget)}</div><div class="metric-note">${projects.length} proyek aktif</div></div><div class="metric"><div class="metric-label">Anggaran terpakai</div><div class="metric-value">${pct(budget ? spend / budget * 100 : 0)}</div><div class="metric-note">${rupiah(budget - spend)} tersisa</div></div><div class="metric"><div class="metric-label">Perlu perhatian</div><div class="metric-value">${atRisk}<span class="currency"> proyek</span></div><div class="metric-note ${atRisk ? 'attention' : ''}">${atRisk ? 'Pengeluaran melewati 80%' : 'Semua di bawah ambang 80%'}</div></div></div>`;
}
function weekly() {
  const usage = getScope().usage;
  const weeks = state.data.weekly.map(w => ({ ...w, spend: state.project ? 0 : w.spend }));
  if (state.project) for (const u of usage) {
    const d = new Date(new Date(u.occurred_at).getTime() + 7 * 3600000);
    d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const w = weeks.find(w => w.week === d.toISOString().slice(0, 10)); if (w) w.spend += u.amount;
  }
  const max = Math.max(1, ...weeks.map(w => Math.abs(w.spend))) * 1.2;
  const negative = weeks.some(w => w.spend < 0), baseline = negative ? 155 : 190, height = negative ? 115 : 150;
  let svg = '';
  for (let i = 0; i <= 3; i++) {
    const y = baseline - height * i / 3;
    svg += `<line class="chart-grid" x1="61" y1="${y}" x2="555" y2="${y}"/><text class="chart-text" x="50" y="${y + 4}" text-anchor="end">${compact(max * i / 3)}</text>`;
  }
  const step = 485 / Math.max(weeks.length, 1), width = Math.min(40, step * .5);
  weeks.forEach((w, i) => {
    const x = 65 + i * step + (step - width) / 2, h = Math.abs(w.spend) / max * height;
    svg += `<rect class="chart-bar" x="${x}" y="${w.spend >= 0 ? baseline - h : baseline}" width="${width}" height="${Math.max(h, 1)}" rx="3"><title>Minggu ${date(w.week)}: ${rupiah(w.spend)}</title></rect><text class="chart-text" x="${x + width / 2}" y="218" text-anchor="middle">${esc(date(w.week).replace(' 2026', ''))}</text>`;
  });
  return `<section class="panel"><div class="panel-heading"><div><h2>Pengeluaran mingguan</h2><p>Senin–Minggu · berdasarkan waktu WIB</p></div><span class="chart-key"><i></i>Pengeluaran neto</span></div><svg class="trend-chart" role="img" aria-label="${esc(weeks.map(w => `${date(w.week)}: ${rupiah(w.spend)}`).join('; '))}" viewBox="0 0 580 235">${svg}</svg></section>`;
}
function vendors() {
  const map = new Map(); for (const u of getScope().usage) map.set(u.vendor, (map.get(u.vendor) || 0) + u.amount);
  const vendors = [...map].sort((a, b) => b[1] - a[1]), total = vendors.reduce((s, [, v]) => s + v, 0);
  return `<section class="panel"><div class="panel-heading"><div><h2>Biaya per vendor</h2><p>Seluruh tool, setelah rekonsiliasi</p></div></div><div class="vendors">${vendors.map(([name, spend], i) => `<div><div class="vendor-info"><span class="vendor-name"><span class="vendor-index">${String(i + 1).padStart(2, '0')}</span>${esc(name)}</span><span class="vendor-amount">${rupiah(spend)}</span></div><div class="vendor-track"><span style="width:${Math.max(0, Math.min(100, total ? spend / total * 100 : 0))}%"></span></div></div>`).join('') || '<p class="muted">Belum ada transaksi.</p>'}</div></section>`;
}
function projectTable() {
  return `<div class="section-heading"><h2>Anggaran proyek <small>${getScope().projects.length} proyek</small></h2><span class="muted">Ambang notifikasi: 80%</span></div><div class="panel"><div class="table-wrap"><table><thead><tr><th>Nama proyek</th><th class="numeric">Pengeluaran</th><th class="numeric">Anggaran</th><th>Terpakai</th><th>Status</th></tr></thead><tbody>${getScope().projects.map(p => {
    const [label, kind] = budgetStatus(p);
    return `<tr><td><button class="project-link" data-project="${esc(p.code)}"><span class="project-name">${esc(p.name)}</span><span class="project-code">${esc(p.code)} · ${esc(p.client)}</span></button></td><td class="numeric">${rupiah(p.spend)}</td><td class="numeric muted">${rupiah(p.budget)}</td><td class="budget-cell"><div class="budget-top"><span>${pct(p.percentage)}</span></div><div class="progress ${kind}"><span style="width:${Math.min(100, Math.max(0, p.percentage))}%"></span></div></td><td>${badge(label, kind)}</td></tr>`;
  }).join('')}</tbody></table></div><div class="table-bottom"><span>Refund sudah diperhitungkan. Catatan duplikat tidak dijumlahkan.</span><button class="text-button" data-go="transactions">Lihat transaksi ↗</button></div></div>`;
}
function notice() {
  const d = state.data;
  if (!d.unresolved.length) return '';
  return `<div class="notice"><span aria-hidden="true">ⓘ</span><p><strong>${d.unresolved.length} transaksi belum terhubung ke proyek.</strong> ${rupiah(d.unresolvedSpend)} ditampilkan terpisah dari anggaran proyek.</p><button class="text-button" id="review">Periksa transaksi ↗</button></div>`;
}
function transactionRows() {
  return state.data.usage.filter(u => (!state.project || u.project === state.project) && (state.status === 'all' || u.status === state.status) && (!state.search || [u.source_id, u.raw_project, u.project, u.vendor, u.tool].join(' ').toLowerCase().includes(state.search.toLowerCase())));
}
function transactions() {
  const rows = transactionRows(), pages = Math.max(1, Math.ceil(rows.length / 20)); state.page = Math.min(state.page, pages);
  return `${notice()}<div class="toolbar"><div class="tabs" role="group" aria-label="Status transaksi">${[['all', 'Semua'], ['included', 'Terhitung'], ['unresolved', 'Belum ditautkan'], ['duplicate', 'Duplikat']].map(([key, label]) => `<button data-status="${key}" class="${state.status === key ? 'active' : ''}" aria-pressed="${state.status === key}">${label}</button>`).join('')}</div><input class="search" id="search" placeholder="Cari proyek, vendor, atau ID…" aria-label="Cari transaksi" value="${esc(state.search)}"></div><div class="panel"><div class="table-wrap"><table><thead><tr><th>Tanggal · WIB</th><th>Proyek</th><th>Vendor / tool</th><th class="numeric">Nominal IDR</th><th>Status / tindakan</th></tr></thead><tbody>${rows.slice((state.page - 1) * 20, state.page * 20).map(u => `<tr><td>${esc(datetime(u.occurred_at))}<span class="source-ref" title="${esc(u.source_id)}">${esc(u.source_id)}</span></td><td>${esc(u.project || u.raw_project || 'Tanpa label')}<span class="project-code">${esc(u.source === 'manual' ? 'Excel manual' : u.source.replace('_', ' '))}</span></td><td><span class="project-name">${esc(u.vendor)}</span><span class="source-ref transaction-tool" title="${esc(u.tool)}">${esc(u.tool)}</span></td><td class="numeric">${rupiah(u.amount)}</td><td>${u.status === 'unresolved' ? `<form class="resolve-form" data-source="${esc(u.source)}" data-id="${esc(u.source_id)}"><select class="select" name="project" required aria-label="Proyek untuk ${esc(u.source_id)}"><option value="">Pilih proyek…</option>${projectOptions('')}</select><button class="button" type="submit" ${state.busy ? 'disabled' : ''}>Tautkan</button></form>` : u.status === 'duplicate' ? `<span title="${esc(u.duplicate_of)}">${badge('Duplikat', 'neutral')}</span>` : badge(u.amount < 0 ? 'Refund' : 'Terhitung')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Tidak ada transaksi yang cocok.</td></tr>'}</tbody></table></div><div class="table-bottom"><span>${rows.length} transaksi · halaman ${state.page} dari ${pages}</span><div><button class="button" id="prev" ${state.page === 1 ? 'disabled' : ''}>Sebelumnya</button> <button class="button" id="next" ${state.page === pages ? 'disabled' : ''}>Berikutnya</button></div></div></div>`;
}
function imports() {
  const latest = state.data.latestImport, summary = latest?.summary;
  const sources = [['vendor_a', 'Vendor A', 'CSV', 'data/vendor_a.csv', 'Credits → IDR · timestamp UTC → WIB'], ['vendor_b', 'Vendor B', 'CSV', 'data/vendor_b.csv', 'USD → IDR · deduplikasi berdasarkan line ID'], ['vendor_c', 'Vendor C', 'REST API', '/v1/usage', 'USD cents → IDR · pagination & retry'], ['manual', 'Catatan operasional', 'Excel', 'data/manual_ops.xlsx', 'IDR · rekonsiliasi dengan transaksi vendor']];
  return `<div class="notice"><span>ⓘ</span><p>Import membaca file dari folder <strong>data/</strong> dan API Vendor C. Perbarui file sumber, jalankan mock API, lalu klik Import data.</p></div><div class="source-grid">${sources.map(([key, name, kind, path, note]) => `<section class="panel source-card"><div class="source-top"><h2>${name}</h2>${badge(kind, 'neutral')}</div><div class="source-count">${summary ? summary.sources[key] : '—'} <span class="muted" style="font-size:12px;letter-spacing:0">baris sumber</span></div><p>${note}</p><div class="source-path">${path}</div></section>`).join('')}</div><section class="panel import-summary"><h2>Hasil import terakhir</h2>${summary ? `<p>${date(latest.completed_at)} · ${datetime(latest.completed_at)} WIB</p><div class="summary-list">${[[summary.inserted, 'Transaksi baru'], [summary.updated, 'Diperbarui'], [summary.unchanged, 'Tidak berubah'], [summary.repeated, 'Baris ID berulang'], [state.data.duplicateCount, 'Overlap / duplikat tersimpan']].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><p>Kurs tetap: 1 credit = ${rupiah(summary.rates.credit_to_idr * 100)} · USD1 = ${rupiah(summary.rates.usd_to_idr * 100)}. Import ulang tidak menaikkan total untuk data yang sama.</p>` : '<p>Belum ada import. Empat sumber diproses bersama; jika ada sumber yang gagal, hasil sebelumnya tetap tersimpan.</p>'}</section>`;
}
function alerts() {
  return `<div class="section-heading"><h2>Notifikasi anggaran</h2><button class="button" id="retry" ${state.busy ? 'disabled' : ''}>Coba ulang notifikasi tertunda</button></div><div class="alert-list">${state.data.alerts.map(a => `<article class="panel alert-card"><div><p class="eyebrow">AMBANG ANGGARAN · 80%</p><h2>${esc(a.payload.project_name)}</h2><p>${esc(a.payload.content)}</p><p>${a.sent_at ? `Terkirim ${datetime(a.sent_at)} WIB` : `Menunggu pengiriman · ${esc(a.error || '')}`} · ${a.attempts} percobaan</p></div>${badge(a.status === 'sent' ? 'Terkirim' : 'Tertunda', a.status === 'sent' ? '' : 'warn')}</article>`).join('') || '<div class="panel empty">Belum ada proyek yang melewati ambang notifikasi.</div>'}</div><div class="section-heading" style="margin-top:30px"><h2>Inbox webhook mock <small>Penerima lokal untuk pengujian</small></h2></div><div class="alert-list">${state.data.notifications.map(n => `<article class="panel alert-card"><div><h2>${esc(n.payload.project_name || n.payload.project)}</h2><p>${esc(n.payload.content)}</p><p>${datetime(n.received_at)} WIB</p></div>${badge('Diterima')}</article>`).join('') || '<div class="panel empty">Belum ada pesan di webhook mock. Webhook eksternal tidak dicatat di inbox lokal.</div>'}</div>`;
}
function render() {
  if (!state.data) return;
  $('#breadcrumb').textContent = titles[state.view];
  $('#alert-count').textContent = state.data.alerts.length;
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === state.view); if (b.dataset.view === state.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const descriptions = { overview: 'Setiap pengeluaran tercatat. Setiap anggaran terpantau.', projects: 'Pantau pengeluaran dan ruang anggaran setiap produksi.', transactions: 'Telusuri biaya, refund, dan hasil rekonsiliasi sumber.', imports: 'Empat sumber. Satu catatan biaya yang konsisten.', alerts: 'Ketahui saat pengeluaran mulai mendekati batas.' };
  let body;
  if (state.view === 'imports') body = imports();
  else if (!state.data.latestImport) body = empty();
  else if (state.view === 'overview') body = `${metrics()}${notice()}<div class="charts">${weekly()}${vendors()}</div>${projectTable()}`;
  else if (state.view === 'projects') body = `${metrics()}${projectTable()}`;
  else if (state.view === 'transactions') body = transactions();
  else body = alerts();
  $('#app').innerHTML = heading(titles[state.view] === 'Overview' ? 'Pengeluaran, dalam kendali.' : titles[state.view], descriptions[state.view]) + toolbar() + (state.error ? `<div class="error-box" role="alert">${esc(state.error)}</div>` : '') + body;
}
function setView(view) { state.view = view; state.page = 1; state.error = ''; render(); }
async function mutate(path, body, success) {
  if (state.busy) return;
  state.busy = true; state.error = ''; render();
  try { const result = await api(path, body); await refresh(); toast(typeof success === 'function' ? success(result) : success); }
  catch (error) { state.error = error.message; }
  finally { state.busy = false; render(); }
}
function theme() { document.body.classList.toggle('dark'); localStorage.setItem('ledger-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); $('#theme').innerHTML = `Ganti ke tema ${document.body.classList.contains('dark') ? 'terang' : 'gelap'} <span>◐</span>`; }
if (localStorage.getItem('ledger-theme') === 'dark') { document.body.classList.add('dark'); $('#theme').innerHTML = 'Ganti ke tema terang <span>◐</span>'; }
document.addEventListener('click', event => {
  const b = event.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.view || b.dataset.go) return setView(b.dataset.view || b.dataset.go);
  if (b.dataset.project) { state.project = b.dataset.project; state.status = 'included'; return setView('transactions'); }
  if (b.dataset.status) { state.status = b.dataset.status; state.page = 1; return render(); }
  if (b.id === 'theme' || b.id === 'theme-main') return theme();
  if (b.id === 'import' || b.id === 'empty-import') return mutate('/api/import', {}, r => `Import selesai: ${r.summary.inserted} baru, ${r.summary.updated} diperbarui, ${r.summary.unchanged} tidak berubah.`);
  if (b.id === 'retry') return mutate('/api/alerts/retry', {}, 'Evaluasi dan pengiriman notifikasi selesai.');
  if (b.id === 'review') { state.project = ''; state.status = 'unresolved'; return setView('transactions'); }
  if (b.id === 'prev' || b.id === 'next') { state.page += b.id === 'next' ? 1 : -1; return render(); }
  if (b.id === 'export') {
    const columns = ['source', 'source_id', 'project', 'raw_project', 'vendor', 'tool', 'occurred_at_wib', 'amount_idr', 'status', 'duplicate_of'];
    const safe = v => { let text = String(v ?? ''); if (/^[=+@\t\r]/.test(text) || /^-[^\d]/.test(text)) text = "'" + text; return `"${text.replaceAll('"', '""')}"`; };
    const exported = state.view === 'transactions' ? transactionRows() : state.data.usage.filter(u => !state.project || u.project === state.project);
    const rows = exported.map(u => ({ ...u, amount_idr: u.amount / 100, occurred_at_wib: new Date(Date.parse(u.occurred_at) + 7 * 3600000).toISOString().replace('Z', '+07:00') }));
    const blob = new Blob(['\uFEFF' + [columns.join(','), ...rows.map(r => columns.map(c => safe(r[c])).join(','))].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'production-ledger.csv'; a.click(); URL.revokeObjectURL(url); toast(`${rows.length} transaksi diekspor sesuai filter aktif.`);
  }
});
document.addEventListener('change', event => { if (event.target.id === 'project-filter') { state.project = event.target.value; state.page = 1; render(); } });
document.addEventListener('input', event => {
  if (event.target.id !== 'search') return;
  const cursor = event.target.selectionStart; state.search = event.target.value; state.page = 1; render(); $('#search').focus(); $('#search').setSelectionRange(cursor, cursor);
});
document.addEventListener('submit', event => {
  if (!event.target.matches('.resolve-form')) return;
  event.preventDefault(); const form = event.target;
  mutate('/api/resolve', { source: form.dataset.source, sourceId: form.dataset.id, project: new FormData(form).get('project') }, 'Transaksi ditautkan. Total dan notifikasi sudah diperbarui.');
});
refresh().catch(error => { $('#app').innerHTML = `<div class="error-box" role="alert">Tidak dapat memuat data: ${esc(error.message)}. Muat ulang halaman untuk mencoba lagi.</div>`; });
