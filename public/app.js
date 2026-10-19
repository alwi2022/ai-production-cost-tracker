import { icons } from './assets/icons.js';
const $ = selector => document.querySelector(selector);
function icon(name, extraClass = '') {
  const nodes = icons[name];
  if (!nodes) throw new Error(`Unknown icon: ${name}`);
  return `<svg class="icon ${extraClass}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([key]) => key !== 'key').map(([key, value]) => `${key}="${value}"`).join(' ')}></${tag}>`).join('')}</svg>`;
}
function hydrateIcons() { document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute('data-icon'); }); }
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
const badge = (text, kind = '') => `<span class="badge ${kind}">${icon(kind === 'danger' ? 'circle-alert' : kind === 'warn' ? 'triangle-alert' : kind === 'neutral' ? 'layers-2' : 'circle-check')}${esc(text)}</span>`;
const budgetStatus = p => p.percentage >= 100 ? ['Melebihi anggaran', 'danger'] : p.percentage > 80 ? ['Perlu perhatian', 'warn'] : ['Dalam anggaran', ''];
let toastTimer;
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 6500); }
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Request gagal'); return result;
}
async function refresh() { state.data = await api('/api/dashboard'); render(); }
function heading(title, subtitle) {
  return `<div class="page-heading"><div><p class="eyebrow">KU CREATIVES / PRODUCTION FINANCE</p><h1 tabindex="-1">${title}</h1><p>${subtitle}</p></div><div class="heading-actions"><button class="button" id="export">${icon('download')}Export CSV</button><button class="button primary" id="import" ${state.busy ? 'disabled' : ''}>${icon(state.busy ? 'refresh-cw' : 'upload')}${state.busy ? 'Mengimpor...' : 'Import data'}</button></div></div>`;
}
function toolbar() {
  const last = state.data.latestImport;
  return `<div class="toolbar"><div class="filter-group"><label for="project-filter">Proyek</label><select id="project-filter" class="select"><option value="">Semua proyek</option>${projectOptions(state.project)}</select><button class="button" id="theme-main" aria-label="Ganti tema">${icon(document.body.classList.contains('dark') ? 'sun' : 'moon')}<span>Tema</span></button></div><div class="sync-label">${icon('refresh-cw')}${last ? `Terakhir disinkronkan ${datetime(last.completed_at)} WIB` : 'Belum ada data yang diimpor'}</div></div>`;
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
  return `<div class="metrics"><div class="metric"><div class="metric-label">Total pengeluaran ${icon('wallet')}</div><div class="metric-value" title="${rupiah(spend)}"><span class="currency">Rp</span>${compact(spend)}</div><div class="metric-note">${usage.length} transaksi terhitung</div></div><div class="metric"><div class="metric-label">Total anggaran ${icon('layers-2')}</div><div class="metric-value" title="${rupiah(budget)}"><span class="currency">Rp</span>${compact(budget)}</div><div class="metric-note">${projects.length} proyek aktif</div></div><div class="metric"><div class="metric-label">Anggaran terpakai ${icon('chart-no-axes-combined')}</div><div class="metric-value">${pct(budget ? spend / budget * 100 : 0)}</div><div class="metric-note">${rupiah(budget - spend)} tersisa</div></div><div class="metric"><div class="metric-label">Perlu perhatian ${icon('circle-alert')}</div><div class="metric-value">${atRisk}<span class="currency"> proyek</span></div><div class="metric-note ${atRisk ? 'attention' : ''}">${atRisk ? icon('triangle-alert') : ''}${atRisk ? 'Pengeluaran melewati 80%' : 'Semua di bawah ambang 80%'}</div></div></div>`;
}
function weekly() {
  const usage = getScope().usage;
  const weeks = state.data.weekly.map(w => ({ ...w, spend: state.project ? 0 : w.spend }));
  if (state.project) for (const u of usage) {
    const d = new Date(new Date(u.occurred_at).getTime() + 7 * 3600000);
    d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const w = weeks.find(w => w.week === d.toISOString().slice(0, 10)); if (w) w.spend += u.amount;
  }
  const min = Math.min(0, ...weeks.map(w => w.spend));
  const max = Math.max(1, ...weeks.map(w => w.spend)) * 1.15;
  const y = value => 180 - (value - min) / (max - min) * 150;
  const x = index => weeks.length === 1 ? 365 : 65 + index * 605 / Math.max(1, weeks.length - 1);
  let svg = '';
  for (let i = 0; i <= 3; i++) {
    const value = min + (max - min) * i / 3, position = y(value);
    svg += `<line class="chart-grid" x1="65" y1="${position}" x2="675" y2="${position}"/><text class="chart-text" x="51" y="${position + 4}" text-anchor="end">${compact(value)}</text>`;
  }
  const points = weeks.map((w, i) => `${x(i)},${y(w.spend)}`).join(' ');
  if (weeks.length) svg += `<polygon class="chart-fill" points="${x(0)},${y(0)} ${points} ${x(weeks.length - 1)},${y(0)}"/><polyline class="chart-line" points="${points}"/>`;
  weeks.forEach((w, i) => {
    const label = date(w.week).replace(/\s\d{4}$/, '');
    svg += `<circle class="chart-point" cx="${x(i)}" cy="${y(w.spend)}" r="3.5"><title>${esc(date(w.week))}: ${rupiah(w.spend)}</title></circle><text class="chart-text" x="${x(i)}" y="211" text-anchor="middle">${esc(label)}</text>`;
  });
  const total = weeks.reduce((sum, w) => sum + w.spend, 0);
  return `<section class="panel"><div class="panel-heading"><div><h2>Pengeluaran mingguan</h2><p>Senin-Minggu, waktu WIB</p></div><span class="chart-key"><i></i>Pengeluaran neto</span></div><div class="chart-summary"><strong>${rupiah(total)}</strong><span>dalam ${weeks.length} minggu</span></div><svg class="trend-chart" role="img" aria-label="${esc(weeks.map(w => `${date(w.week)}: ${rupiah(w.spend)}`).join('; '))}" viewBox="0 0 710 230">${svg}</svg><details class="chart-details"><summary>${icon('chevron-down')}Lihat rincian mingguan</summary><table><thead><tr><th>Minggu mulai</th><th class="numeric">Pengeluaran</th></tr></thead><tbody>${weeks.map(w => `<tr><td>${date(w.week)}</td><td class="numeric">${rupiah(w.spend)}</td></tr>`).join('')}</tbody></table></details></section>`;
}
function vendors() {
  const map = new Map(); for (const u of getScope().usage) map.set(u.vendor, (map.get(u.vendor) || 0) + u.amount);
  const vendors = [...map].sort((a, b) => b[1] - a[1]), total = vendors.reduce((s, [, v]) => s + v, 0);
  return `<section class="panel"><div class="panel-heading"><div><h2>Distribusi biaya</h2><p>Per vendor, setelah rekonsiliasi</p></div>${icon('chart-no-axes-combined')}</div><div class="vendors">${vendors.map(([name, spend], i) => {
    const percentage = total ? spend / total * 100 : 0;
    const token = name.startsWith('Vendor ') ? name.slice(-1) : name.split(' ').map(s => s[0]).join('').slice(0, 2);
    return `<div><div class="vendor-info"><span class="vendor-name"><span class="vendor-token">${esc(token)}</span>${esc(name)}</span><span class="vendor-amount">${rupiah(spend)}<span class="vendor-percent">${pct(percentage)}</span></span></div><div class="vendor-track"><span style="width:${Math.max(0, Math.min(100, percentage))}%;opacity:${Math.max(.65, 1 - i * .06)}"></span></div></div>`;
  }).join('') || '<p class="muted">Belum ada transaksi.</p>'}</div></section>`;
}
function projectTable() {
  return `<div class="section-heading"><h2>Anggaran proyek <small>${getScope().projects.length} proyek</small></h2><span class="muted">Ambang notifikasi: 80%</span></div><div class="panel"><div class="table-wrap"><table><thead><tr><th>Nama proyek</th><th class="numeric">Pengeluaran</th><th class="numeric">Anggaran</th><th>Terpakai</th><th>Status</th></tr></thead><tbody>${getScope().projects.map(p => {
    const [label, kind] = budgetStatus(p);
    return `<tr><td><button class="project-link" data-project="${esc(p.code)}"><span class="project-title-wrap"><span class="project-token">${esc(p.code.slice(0, 2))}</span><span><span class="project-name">${esc(p.name)}</span><span class="project-code">${esc(p.code)} · ${esc(p.client)}</span></span></span></button></td><td class="numeric">${rupiah(p.spend)}</td><td class="numeric muted">${rupiah(p.budget)}</td><td class="budget-cell"><div class="budget-top"><div class="progress ${kind}"><span style="width:${Math.min(100, Math.max(0, p.percentage))}%"></span></div><span>${pct(p.percentage)}</span></div></td><td>${badge(label, kind)}</td></tr>`;
  }).join('')}</tbody></table></div><div class="table-bottom"><span>Pengeluaran neto, setelah refund dan rekonsiliasi.</span><button class="text-button" data-go="transactions">Lihat transaksi ${icon('arrow-up-right')}</button></div></div>`;
}
function notice() {
  const d = state.data;
  if (!d.unresolved.length) return '';
  return `<div class="notice">${icon('info')}<p><strong>${d.unresolved.length} transaksi belum terhubung.</strong> ${rupiah(d.unresolvedSpend)} belum dialokasikan ke anggaran proyek.</p><button class="text-button" id="review">Periksa transaksi ${icon('arrow-up-right')}</button></div>`;
}
function transactionRows() {
  return state.data.usage.filter(u => (!state.project || u.project === state.project) && (state.status === 'all' || u.status === state.status) && (!state.search || [u.source_id, u.raw_project, u.project, u.vendor, u.tool].join(' ').toLowerCase().includes(state.search.toLowerCase())));
}
function recordDetails(u) {
  return `<details class="record-details"><summary>${icon('chevron-down')}Detail transaksi</summary><div class="record-full"><b>ID sumber</b><br>${esc(u.source_id)}<br><b>Tool</b><br>${esc(u.tool)}${u.duplicate_of ? `<br><b>Duplikat dari</b><br>${esc(u.duplicate_of)}` : ''}</div></details>`;
}
function transactions() {
  const rows = transactionRows(), pages = Math.max(1, Math.ceil(rows.length / 20)); state.page = Math.min(state.page, pages);
  const controls = `<div class="toolbar"><div class="tabs" role="group" aria-label="Status transaksi">${[['all', 'Semua'], ['included', 'Terhitung'], ['unresolved', 'Belum ditautkan'], ['duplicate', 'Duplikat']].map(([key, label]) => `<button data-status="${key}" class="${state.status === key ? 'active' : ''}" aria-pressed="${state.status === key}">${label}</button>`).join('')}</div><input class="search" id="search" placeholder="Cari proyek, vendor, atau ID..." aria-label="Cari transaksi" value="${esc(state.search)}"></div>`;
  const tableRows = rows.slice((state.page - 1) * 20, state.page * 20).map(u => {
    const action = u.status === 'unresolved'
      ? `<form class="resolve-form" data-source="${esc(u.source)}" data-id="${esc(u.source_id)}"><select class="select" name="project" required aria-label="Proyek untuk ${esc(u.source_id)}"><option value="">Pilih proyek...</option>${projectOptions('')}</select><button class="button" type="submit" ${state.busy ? 'disabled' : ''}>Tautkan</button></form>`
      : u.status === 'duplicate' ? badge('Duplikat', 'neutral') : badge(u.amount < 0 ? 'Refund' : 'Terhitung');
    return `<tr><td>${esc(datetime(u.occurred_at))}${recordDetails(u)}</td><td>${esc(u.project || u.raw_project || 'Tanpa label')}<span class="project-code">${esc(u.source === 'manual' ? 'Excel manual' : u.source.replace('_', ' '))}</span></td><td><span class="project-name">${esc(u.vendor)}</span><span class="source-ref transaction-tool">${esc(u.tool)}</span></td><td class="numeric">${rupiah(u.amount)}</td><td>${action}</td></tr>`;
  }).join('') || '<tr><td colspan="5" class="empty">Tidak ada transaksi yang cocok.</td></tr>';
  return `${notice()}${controls}<div class="panel"><div class="table-wrap"><table><thead><tr><th>Tanggal · WIB</th><th>Proyek</th><th>Vendor / tool</th><th class="numeric">Nominal IDR</th><th>Status / tindakan</th></tr></thead><tbody>${tableRows}</tbody></table></div><div class="table-bottom"><span>${rows.length} transaksi · halaman ${state.page} dari ${pages}</span><div><button class="button" id="prev" ${state.page === 1 ? 'disabled' : ''}>Sebelumnya</button> <button class="button" id="next" ${state.page === pages ? 'disabled' : ''}>Berikutnya</button></div></div></div>`;
}
function imports() {
  const latest = state.data.latestImport, summary = latest?.summary;
  const sources = [['vendor_a', 'Vendor A', 'CSV', 'data/vendor_a.csv', 'Credits → IDR · timestamp UTC → WIB'], ['vendor_b', 'Vendor B', 'CSV', 'data/vendor_b.csv', 'USD → IDR · deduplikasi berdasarkan line ID'], ['vendor_c', 'Vendor C', 'REST API', '/v1/usage', 'USD cents → IDR · pagination & retry'], ['manual', 'Catatan operasional', 'Excel', 'data/manual_ops.xlsx', 'IDR · rekonsiliasi dengan transaksi vendor']];
  return `<div class="notice">${icon('info')}<p>Import membaca file dari folder <strong>data/</strong> dan API Vendor C. Perbarui file sumber, jalankan mock API, lalu klik Import data.</p></div><div class="source-grid">${sources.map(([key, name, kind, path, note]) => `<section class="panel source-card"><div class="source-top"><h2>${name}</h2>${badge(kind, 'neutral')}</div><div class="source-count">${summary ? summary.sources[key] : 'Belum diimpor'} <span class="muted" style="font-size:12px;letter-spacing:0">baris sumber</span></div><p>${note}</p><div class="source-path">${path}</div></section>`).join('')}</div><section class="panel import-summary"><h2>Hasil import terakhir</h2>${summary ? `<p>${date(latest.completed_at)} · ${datetime(latest.completed_at)} WIB</p><div class="summary-list">${[[summary.inserted, 'Transaksi baru'], [summary.updated, 'Diperbarui'], [summary.unchanged, 'Tidak berubah'], [summary.repeated, 'Baris ID berulang'], [state.data.duplicateCount, 'Overlap / duplikat tersimpan']].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><p>Kurs tetap: 1 credit = ${rupiah(summary.rates.credit_to_idr * 100)} · USD1 = ${rupiah(summary.rates.usd_to_idr * 100)}. Import ulang tidak menaikkan total untuk data yang sama.</p>` : '<p>Belum ada import. Empat sumber diproses bersama; jika ada sumber yang gagal, hasil sebelumnya tetap tersimpan.</p>'}</section>`;
}
function alerts() {
  return `<div class="section-heading"><h2>Notifikasi anggaran</h2><button class="button" id="retry" ${state.busy ? 'disabled' : ''}>Coba ulang notifikasi tertunda</button></div><div class="alert-list">${state.data.alerts.map(a => `<article class="panel alert-card"><div><p class="eyebrow">AMBANG ANGGARAN · 80%</p><h2>${esc(a.payload.project_name)}</h2><p>${esc(a.payload.content)}</p><p>${a.sent_at ? `Terkirim ${datetime(a.sent_at)} WIB` : `Menunggu pengiriman · ${esc(a.error || '')}`} · ${a.attempts} percobaan</p></div>${badge(a.status === 'sent' ? 'Terkirim' : 'Tertunda', a.status === 'sent' ? '' : 'warn')}</article>`).join('') || '<div class="panel empty">Belum ada proyek yang melewati ambang notifikasi.</div>'}</div><div class="section-heading" style="margin-top:30px"><h2>Inbox webhook mock <small>Penerima lokal untuk pengujian</small></h2></div><div class="alert-list">${state.data.notifications.map(n => `<article class="panel alert-card"><div><h2>${esc(n.payload.project_name || n.payload.project)}</h2><p>${esc(n.payload.content)}</p><p>${datetime(n.received_at)} WIB</p></div>${badge('Diterima')}</article>`).join('') || '<div class="panel empty">Belum ada pesan di webhook mock. Webhook eksternal tidak dicatat di inbox lokal.</div>'}</div>`;
}
function render() {
  if (!state.data) return;
  const active = document.activeElement;
  const focusId = active?.id;
  const focusStatus = active?.dataset?.status;
  $('#breadcrumb').textContent = titles[state.view];
  $('#alert-count').textContent = state.data.alerts.length;
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === state.view); if (b.dataset.view === state.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const descriptions = { overview: 'Pengeluaran produksi, anggaran, dan aktivitas terbaru dalam satu tampilan.', projects: 'Pantau pengeluaran dan ruang anggaran setiap produksi.', transactions: 'Telusuri biaya, refund, dan hasil rekonsiliasi sumber.', imports: 'Kelola sumber data dan hasil rekonsiliasi pengeluaran.', alerts: 'Pantau pengiriman notifikasi anggaran proyek.' };
  let body;
  if (state.view === 'imports') body = imports();
  else if (!state.data.latestImport) body = empty();
  else if (state.view === 'overview') body = `${metrics()}${notice()}<div class="charts">${weekly()}${vendors()}</div>${projectTable()}`;
  else if (state.view === 'projects') body = `${metrics()}${projectTable()}`;
  else if (state.view === 'transactions') body = transactions();
  else body = alerts();
  $('#app').innerHTML = heading(titles[state.view], descriptions[state.view]) + toolbar() + (state.error ? `<div class="error-box" role="alert">${esc(state.error)}</div>` : '') + body;
  if (focusId && focusId !== 'search') document.getElementById(focusId)?.focus({ preventScroll: true });
  if (focusStatus) document.querySelector(`[data-status="${CSS.escape(focusStatus)}"]`)?.focus({ preventScroll: true });
}
function setView(view) { state.view = view; state.page = 1; state.error = ''; render(); $('#app h1')?.focus({ preventScroll: true }); $('#announcement').textContent = `Halaman ${titles[view]}`; }
async function mutate(path, body, success) {
  if (state.busy) return;
  state.busy = true; state.error = ''; render();
  try { const result = await api(path, body); await refresh(); toast(typeof success === 'function' ? success(result) : success); }
  catch (error) { state.error = error.message; }
  finally { state.busy = false; render(); }
}
function updateThemeLabel() {
  const dark = document.body.classList.contains('dark');
  $('#theme').innerHTML = `${icon(dark ? 'sun' : 'moon')}Tema ${dark ? 'terang' : 'gelap'}`;
  const main = $('#theme-main');
  if (main) main.innerHTML = `${icon(dark ? 'sun' : 'moon')}<span>Tema</span>`;
}
function theme() { document.body.classList.toggle('dark'); localStorage.setItem('ledger-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); updateThemeLabel(); }
if ((localStorage.getItem('ledger-theme') || 'dark') === 'dark') document.body.classList.add('dark');
hydrateIcons();
updateThemeLabel();
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
