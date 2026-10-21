import { icons } from './assets/icons.js';

const $ = selector => document.querySelector(selector);
const selectedFiles = {};
const state = { data: null, view: 'overview', project: '', status: 'all', search: '', page: 1, busy: false, error: '', record: null };
const titles = { overview: 'Overview', projects: 'Proyek', transactions: 'Transaksi', imports: 'Sumber & import', alerts: 'Notifikasi' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const number = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(value);
const rupiah = value => `Rp${number(value / 100)}`;
const compact = value => new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 2 }).format(value / 100);
const pct = value => `${number(Math.round(value * 10) / 10)}%`;
const date = value => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
const datetime = value => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const recordKey = u => `${u.source}:${u.source_id}`;
const projectOptions = selected => state.data.projects.map(p => `<option value="${esc(p.code)}" ${p.code === selected ? 'selected' : ''}>${esc(p.code)} · ${esc(p.client)}</option>`).join('');

function icon(name) {
  const nodes = icons[name];
  if (!nodes) throw new Error(`Unknown icon: ${name}`);
  return `<svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([key]) => key !== 'key').map(([key, value]) => `${key}="${value}"`).join(' ')}></${tag}>`).join('')}</svg>`;
}
const badge = (text, kind = '') => `<span class="badge ${kind}">${esc(text)}</span>`;
const budgetStatus = p => p.percentage > 100 ? ['Melebihi anggaran', 'danger'] : p.percentage > 80 ? ['Perlu perhatian', 'warn'] : ['Dalam anggaran', ''];
let toastTimer;
function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 6500);
}
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : body instanceof FormData ? { method: 'POST', body } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request gagal');
  return result;
}
async function refresh() { state.data = await api('/api/dashboard'); render(); }

function heading() {
  const action = state.view === 'imports'
    ? `<button class="button primary" id="import" ${state.busy ? 'disabled' : ''}>${icon(state.busy ? 'refresh-cw' : 'upload')}${state.busy ? 'Mengimpor...' : 'Import data'}</button>`
    : state.view === 'alerts' && state.data.alerts.some(a => a.status === 'pending')
      ? `<button class="button" id="retry" ${state.busy ? 'disabled' : ''}>${icon('refresh-cw')}Coba ulang pengiriman</button>` : '';
  return `<div class="page-heading"><h1 tabindex="-1">${titles[state.view]}</h1>${action}</div>`;
}
function projectFilter() {
  return `<label class="sr-only" for="project-filter">Filter proyek</label><select id="project-filter" class="select"><option value="">Semua proyek</option>${projectOptions(state.project)}</select>`;
}
function toolbar() {
  const last = state.data.latestImport;
  return `<div class="toolbar"><div>${projectFilter()}</div>${last ? `<span class="sync-label">Diperbarui ${datetime(last.completed_at)} WIB</span>` : ''}</div>`;
}
function getScope() {
  const projects = state.data.projects.filter(p => !state.project || p.code === state.project);
  const usage = state.data.usage.filter(u => u.status === 'included' && (!state.project || u.project === state.project));
  return { projects, usage, spend: projects.reduce((s, p) => s + p.spend, 0), budget: projects.reduce((s, p) => s + p.budget, 0) };
}
function empty() {
  return `<div class="panel empty"><h2>Belum ada transaksi</h2><p>Import sumber data untuk mulai memantau anggaran.</p><button class="button primary" data-go="imports">Buka sumber data</button></div>`;
}
function metrics() {
  const { projects, usage, spend, budget } = getScope();
  const atRisk = projects.filter(p => p.percentage > 80).length;
  return `<div class="metrics">
    <div class="metric"><div class="metric-label">Pengeluaran</div><div class="metric-value" title="${rupiah(spend)}"><span class="currency">Rp</span>${compact(spend)}</div><div class="metric-note">${usage.length} transaksi</div></div>
    <div class="metric"><div class="metric-label">Anggaran</div><div class="metric-value" title="${rupiah(budget)}"><span class="currency">Rp</span>${compact(budget)}</div><div class="metric-note">${projects.length} proyek</div></div>
    <div class="metric"><div class="metric-label">Terpakai</div><div class="metric-value">${pct(budget ? spend / budget * 100 : 0)}</div><div class="metric-note">${rupiah(budget - spend)} tersisa</div></div>
    <div class="metric"><div class="metric-label">Perlu perhatian</div><div class="metric-value">${atRisk}<span class="currency"> proyek</span></div><div class="metric-note ${atRisk ? 'attention' : ''}">Melewati 80% anggaran</div></div>
  </div>`;
}
function weekly() {
  const usage = getScope().usage;
  const weeks = state.data.weekly.map(w => ({ ...w, spend: state.project ? 0 : w.spend }));
  if (state.project) for (const u of usage) {
    const d = new Date(Date.parse(u.occurred_at) + 7 * 3600000);
    d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const w = weeks.find(w => w.week === d.toISOString().slice(0, 10)); if (w) w.spend += u.amount;
  }
  const min = Math.min(0, ...weeks.map(w => w.spend));
  const max = Math.max(1, ...weeks.map(w => w.spend)) * 1.15;
  const y = value => 180 - (value - min) / (max - min) * 150;
  const x = index => weeks.length === 1 ? 365 : 65 + index * 605 / Math.max(1, weeks.length - 1);
  const axis = value => new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 0 }).format(value / 100);
  let svg = '';
  for (let i = 0; i <= 3; i++) {
    const value = min + (max - min) * i / 3, position = y(value);
    svg += `<line class="chart-grid" x1="65" y1="${position}" x2="675" y2="${position}"/><text class="chart-text" x="51" y="${position + 4}" text-anchor="end">${axis(value)}</text>`;
  }
  const points = weeks.map((w, i) => `${x(i)},${y(w.spend)}`).join(' ');
  if (weeks.length) svg += `<polygon class="chart-fill" points="${x(0)},${y(0)} ${points} ${x(weeks.length - 1)},${y(0)}"/><polyline class="chart-line" points="${points}"/>`;
  weeks.forEach((w, i) => {
    svg += `<circle class="chart-point" cx="${x(i)}" cy="${y(w.spend)}" r="3.5"><title>${esc(date(w.week))}: ${rupiah(w.spend)}</title></circle><text class="chart-text ${i % 2 ? 'chart-secondary-label' : ''}" x="${x(i)}" y="211" text-anchor="middle">${esc(date(w.week).replace(/\s\d{4}$/, ''))}</text>`;
  });
  return `<section class="panel"><div class="panel-heading"><h2>Pengeluaran mingguan</h2></div><svg class="trend-chart" role="img" aria-label="${esc(weeks.map(w => `${date(w.week)}: ${rupiah(w.spend)}`).join('; '))}" viewBox="0 0 710 230">${svg}</svg><details class="chart-details"><summary>${icon('chevron-down')}Rincian mingguan</summary><table><caption class="sr-only">Pengeluaran neto per minggu, Senin-Minggu WIB</caption><thead><tr><th>Minggu mulai</th><th class="numeric">Pengeluaran</th></tr></thead><tbody>${weeks.map(w => `<tr><td>${date(w.week)}</td><td class="numeric">${rupiah(w.spend)}</td></tr>`).join('')}</tbody></table></details></section>`;
}
function vendors() {
  const map = new Map(); for (const u of getScope().usage) map.set(u.vendor, (map.get(u.vendor) || 0) + u.amount);
  const vendors = [...map].sort((a, b) => b[1] - a[1]), total = vendors.reduce((s, [, v]) => s + v, 0);
  return `<section class="panel"><div class="panel-heading"><h2>Biaya per vendor</h2></div><div class="vendors">${vendors.map(([name, spend], i) => {
    const percentage = total ? spend / total * 100 : 0;
    const token = name.startsWith('Vendor ') ? name.slice(-1) : name.split(' ').map(s => s[0]).join('').slice(0, 2);
    return `<div><div class="vendor-info"><span class="vendor-name"><span class="vendor-token">${esc(token)}</span>${esc(name)}</span><span class="vendor-amount">${rupiah(spend)}<span class="vendor-percent">${pct(percentage)}</span></span></div><div class="vendor-track"><span style="width:${Math.max(0, Math.min(100, percentage))}%;opacity:${Math.max(.65, 1 - i * .06)}"></span></div></div>`;
  }).join('') || '<p class="muted">Belum ada transaksi.</p>'}</div></section>`;
}
function projectTable() {
  return `${state.view === 'overview' ? '<div class="section-heading"><h2>Anggaran proyek</h2></div>' : ''}<div class="panel"><div class="table-wrap"><table><thead><tr><th>Proyek</th><th class="numeric">Pengeluaran</th><th class="numeric">Anggaran</th><th>Terpakai</th><th>Status</th></tr></thead><tbody>${getScope().projects.map(p => {
    const [label, kind] = budgetStatus(p);
    return `<tr><td><button class="project-link" data-project="${esc(p.code)}"><span class="project-title-wrap"><span class="project-token">${esc(p.code.slice(0, 2))}</span><span><span class="project-name">${esc(p.name)}</span><span class="project-code">${esc(p.code)}</span></span></span></button></td><td class="numeric">${rupiah(p.spend)}</td><td class="numeric muted">${rupiah(p.budget)}</td><td class="budget-cell"><div class="budget-top"><div class="progress ${kind}"><span style="width:${Math.min(100, Math.max(0, p.percentage))}%"></span></div><span>${pct(p.percentage)}</span></div></td><td>${badge(label, kind)}</td></tr>`;
  }).join('')}</tbody></table></div></div>`;
}
function notice() {
  if (!state.data.unresolved.length) return '';
  return `<div class="notice">${icon('info')}<p><strong>${state.data.unresolved.length} transaksi perlu ditautkan</strong><span class="notice-amount">${rupiah(state.data.unresolvedSpend)}</span></p><button class="text-button" id="review">Tinjau ${icon('arrow-up-right')}</button></div>`;
}
function transactionRows() {
  return state.data.usage.filter(u => (!state.project || u.project === state.project) && (state.status === 'all' || u.status === state.status) && (!state.search || [u.source_id, u.raw_project, u.project, u.vendor, u.tool].join(' ').toLowerCase().includes(state.search.toLowerCase())));
}
function transactions() {
  const rows = transactionRows(), pages = Math.max(1, Math.ceil(rows.length / 20)); state.page = Math.min(state.page, pages);
  const statuses = [['all', 'Semua status'], ['included', 'Terhitung'], ['unresolved', `Belum ditautkan (${state.data.unresolved.length})`], ['duplicate', 'Duplikat']];
  const controls = `<div class="transaction-toolbar"><input class="search" id="search" placeholder="Cari transaksi..." aria-label="Cari transaksi" value="${esc(state.search)}">${state.status === 'unresolved' ? '' : projectFilter()}<label class="sr-only" for="status-filter">Filter status</label><select id="status-filter" class="select">${statuses.map(([key, label]) => `<option value="${key}" ${state.status === key ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select><button class="button" id="export" ${rows.length ? '' : 'disabled'}>${icon('download')}Export CSV</button></div>`;
  const tableRows = rows.slice((state.page - 1) * 20, state.page * 20).map(u => {
    const label = u.status === 'unresolved' ? badge('Belum ditautkan', 'warn') : u.status === 'duplicate' ? badge('Duplikat', 'neutral') : badge(u.amount < 0 ? 'Refund' : 'Terhitung');
    const shortId = u.source === 'manual' ? 'Catatan manual' : u.source_id;
    return `<tr><td><button class="record-link" data-record="${esc(recordKey(u))}" aria-label="Detail transaksi ${esc(shortId)}">${esc(shortId)}</button><span class="project-code">${esc(datetime(u.occurred_at))} WIB</span></td><td>${esc(u.project || u.raw_project || 'Tanpa label')}</td><td><span class="project-name">${esc(u.vendor)}</span><span class="source-ref transaction-tool">${esc(u.tool)}</span></td><td class="numeric">${rupiah(u.amount)}</td><td>${label}</td></tr>`;
  }).join('') || '<tr><td colspan="5" class="empty">Tidak ada transaksi yang cocok.</td></tr>';
  return `<div class="panel">${controls}<div class="table-wrap"><table><thead><tr><th>Transaksi</th><th>Proyek / label asal</th><th>Vendor / tool</th><th class="numeric">Nominal IDR</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table></div><div class="table-bottom"><span>${rows.length} transaksi</span>${pages > 1 ? `<div><span class="page-count">${state.page} / ${pages}</span><button class="button" id="prev" ${state.page === 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya">Sebelumnya</button> <button class="button" id="next" ${state.page === pages ? 'disabled' : ''} aria-label="Halaman berikutnya">Berikutnya</button></div>` : ''}</div></div>`;
}
function imports() {
  const latest = state.data.latestImport, summary = latest?.summary;
  const sources = [['vendor_a', 'Vendor A', 'CSV'], ['vendor_b', 'Vendor B', 'CSV'], ['vendor_c', 'Vendor C', 'API'], ['manual', 'Operasional', 'Excel']];
  return `<p class="field-help">Pilih CSV atau Excel sesuai format contoh, maksimal 10 MB per file. Jika tidak dipilih, file bawaan digunakan.</p><div class="source-grid">${sources.map(([key, name, kind]) => `<section class="panel source-card"><div class="source-top"><h2>${name}</h2><span class="muted">${kind}</span></div><div class="source-count">${summary ? summary.sources[key] : '0'} <span class="muted">baris</span></div>${key !== 'vendor_c' ? `<label class="upload-label" for="file-${key}">Pilih ${kind}</label><input class="source-upload" id="file-${key}" data-source="${key}" type="file" accept="${key === 'manual' ? '.xlsx' : '.csv'}" ${state.busy ? 'disabled' : ''}><p class="field-help">${esc(selectedFiles[key]?.name || 'File bawaan')}${selectedFiles[key] ? ` <button class="text-button" data-clear-file="${key}" ${state.busy ? 'disabled' : ''}>Batal pilih</button>` : ''}</p>` : '<p class="field-help">Diambil otomatis saat import.</p>'}</section>`).join('')}</div>
    ${summary ? `<section class="panel import-summary"><div class="section-heading"><h2>Hasil import terakhir</h2><span class="muted">${datetime(latest.completed_at)} WIB</span></div><div class="summary-list">${[[summary.inserted, 'Baru'], [summary.updated, 'Diperbarui'], [summary.unchanged, 'Tidak berubah']].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('')}</div></section>` : '<p class="muted">Belum ada import. Pastikan empat sumber tersedia, lalu pilih Import data.</p>'}
    `;
}
function alerts() {
  const rows = state.data.alerts.map(a => `<tr><td><span class="project-name">${esc(a.payload.project_name)}</span><span class="project-code">${esc(a.project)}</span></td><td class="numeric">${rupiah(a.payload.current_spend_idr * 100)}</td><td class="numeric">${pct(a.payload.percentage_used)}</td><td>${badge(a.status === 'sent' ? 'Terkirim' : 'Tertunda', a.status === 'sent' ? '' : 'warn')}<span class="project-code">${a.sent_at ? `${datetime(a.sent_at)} WIB` : esc(a.error || 'Menunggu pengiriman')}</span></td></tr>`).join('');
  return rows ? `<div class="panel table-wrap"><table><thead><tr><th>Proyek</th><th class="numeric">Pengeluaran saat notifikasi</th><th class="numeric">Terpakai</th><th>Pengiriman</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="panel empty">Belum ada notifikasi anggaran.</div>';
}

function render() {
  if (!state.data) return;
  const active = document.activeElement;
  const focusId = active?.id;
  const cursor = focusId === 'search' ? active.selectionStart : null;
  $('#breadcrumb').textContent = titles[state.view];
  const pending = state.data.alerts.filter(a => a.status === 'pending').length;
  $('#alert-count').textContent = pending; $('#alert-count').hidden = pending === 0;
  document.querySelectorAll('[data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === state.view);
    if (b.dataset.view === state.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  let body;
  if (state.view === 'imports') body = imports();
  else if (!state.data.latestImport) body = empty();
  else if (state.view === 'overview') body = `${toolbar()}${metrics()}${notice()}<div class="charts">${weekly()}${vendors()}</div>${projectTable()}`;
  else if (state.view === 'projects') body = `${toolbar()}${projectTable()}`;
  else if (state.view === 'transactions') body = transactions();
  else body = alerts();
  $('#app').innerHTML = heading() + (state.error ? `<div class="error-box" role="alert">${esc(state.error)}</div>` : '') + body;
  const restore = focusId && document.getElementById(focusId);
  if (restore && !restore.disabled) { restore.focus({ preventScroll: true }); if (cursor !== null) restore.setSelectionRange(cursor, cursor); }
}
function setView(view) {
  if (view !== 'transactions') { state.status = 'all'; state.search = ''; }
  state.view = view; state.page = 1; state.error = ''; render();
  $('#app h1')?.focus({ preventScroll: true }); $('#announcement').textContent = `Halaman ${titles[view]}`;
}
async function mutate(path, body, success) {
  if (state.busy) return;
  state.busy = true; state.error = ''; render();
  try {
    const result = await api(path, body);
    state.data = await api('/api/dashboard');
    if ($('#record-dialog').open) $('#record-dialog').close();
    toast(typeof success === 'function' ? success(result) : success);
  } catch (error) {
    if ($('#record-dialog').open) { $('#record-error').textContent = error.message; $('#record-error').hidden = false; }
    else state.error = error.message;
  } finally {
    state.busy = false; render();
    const submit = $('#resolve-form button[type="submit"]'); if (submit) submit.disabled = false;
    if (!$('#record-dialog').open) $('#app h1')?.focus({ preventScroll: true });
  }
}
function updateThemeLabel() {
  const dark = document.body.classList.contains('dark');
  const label = `Gunakan tema ${dark ? 'terang' : 'gelap'}`;
  $('#theme').innerHTML = icon(dark ? 'sun' : 'moon');
  $('#theme').setAttribute('aria-label', label); $('#theme').title = label;
}
function openRecord(key) {
  const u = state.data.usage.find(u => recordKey(u) === key);
  if (!u) return;
  state.record = key;
  const unresolved = u.status === 'unresolved';
  $('#record-content').innerHTML = `<div class="dialog-heading"><h2 id="record-title">Detail transaksi</h2><button class="icon-button" id="close-record" aria-label="Tutup detail">${icon('x')}</button></div><dl class="record-facts"><div><dt>Nominal</dt><dd class="record-amount">${rupiah(u.amount)}</dd></div><div><dt>Vendor</dt><dd>${esc(u.vendor)}</dd></div><div><dt>Waktu WIB</dt><dd>${esc(datetime(u.occurred_at))}</dd></div><div><dt>Label asal</dt><dd>${esc(u.raw_project || 'Kosong')}</dd></div><div><dt>Tool</dt><dd>${esc(u.tool)}</dd></div><div><dt>ID sumber</dt><dd class="record-id">${esc(u.source_id)}</dd></div>${u.duplicate_of ? `<div><dt>Duplikat dari</dt><dd class="record-id">${esc(u.duplicate_of)}</dd></div>` : ''}</dl>${unresolved ? `<form id="resolve-form"><label for="resolve-project">Tautkan ke proyek</label><select class="select" name="project" id="resolve-project" required><option value="">Pilih proyek...</option>${projectOptions('')}</select><p class="field-help">Label sumber belum menunjukkan proyek. Pilih setelah kepemilikannya dikonfirmasi.</p><p id="record-error" class="error-box" role="alert" hidden></p><div class="dialog-actions"><button type="button" class="button" id="cancel-record">Batal</button><button class="button primary" type="submit">Simpan proyek</button></div></form>` : `<p class="record-project">${u.project ? `Proyek: ${esc(u.project)}` : 'Tidak dialokasikan'}</p>`}`;
  $('#record-dialog').showModal();
  document.body.classList.add('modal-open');
}
function exportCsv() {
  const columns = ['source', 'source_id', 'project', 'raw_project', 'vendor', 'tool', 'occurred_at_wib', 'amount_idr', 'status', 'duplicate_of'];
  const safe = v => { let text = String(v ?? ''); if (/^[=+@\t\r]/.test(text) || /^-[^\d]/.test(text)) text = "'" + text; return `"${text.replaceAll('"', '""')}"`; };
  const rows = transactionRows().map(u => ({ ...u, amount_idr: u.amount / 100, occurred_at_wib: new Date(Date.parse(u.occurred_at) + 7 * 3600000).toISOString().replace('Z', '+07:00') }));
  const blob = new Blob(['\uFEFF' + [columns.join(','), ...rows.map(r => columns.map(c => safe(r[c])).join(','))].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'ku-creatives-transactions.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${rows.length} transaksi diekspor.`);
}

if ((localStorage.getItem('ledger-theme') || 'dark') === 'dark') document.body.classList.add('dark');
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute('data-icon'); });
updateThemeLabel();
document.addEventListener('click', event => {
  const b = event.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.view || b.dataset.go) return setView(b.dataset.view || b.dataset.go);
  if (b.dataset.project) { state.project = b.dataset.project; state.status = 'included'; return setView('transactions'); }
  if (b.dataset.record) return openRecord(b.dataset.record);
  if (b.id === 'theme') { document.body.classList.toggle('dark'); localStorage.setItem('ledger-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); return updateThemeLabel(); }
  if (b.dataset.clearFile) { delete selectedFiles[b.dataset.clearFile]; return render(); }
  if (b.id === 'import') {
    const files = Object.entries(selectedFiles);
    const body = files.length ? new FormData() : {};
    for (const [key, file] of files) body.append(key, file);
    return mutate(files.length ? '/api/import/upload' : '/api/import', body, r => `Import selesai: ${r.summary.inserted} baru, ${r.summary.updated} diperbarui.`);
  }
  if (b.id === 'retry') return mutate('/api/alerts/retry', {}, 'Pengiriman notifikasi diperiksa.');
  if (b.id === 'review') { state.project = ''; state.status = 'unresolved'; state.search = ''; return setView('transactions'); }
  if (b.id === 'prev' || b.id === 'next') { state.page += b.id === 'next' ? 1 : -1; render(); $('#announcement').textContent = `Halaman transaksi ${state.page}`; return; }
  if (b.id === 'export') return exportCsv();
  if (b.id === 'close-record' || b.id === 'cancel-record') $('#record-dialog').close();
});
document.addEventListener('change', event => {
  if (event.target.dataset.source) {
    const key = event.target.dataset.source;
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024 || !file.size) { state.error = 'Pilih file berisi data, maksimal 10 MB.'; return render(); }
    selectedFiles[key] = file; state.error = ''; return render();
  }
  if (event.target.id === 'project-filter') { state.project = event.target.value; state.page = 1; render(); }
  if (event.target.id === 'status-filter') { state.status = event.target.value; if (state.status === 'unresolved') state.project = ''; state.page = 1; render(); }
});
document.addEventListener('input', event => {
  if (event.target.id === 'search') { state.search = event.target.value; state.page = 1; render(); }
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'resolve-form') return;
  event.preventDefault();
  const u = state.data.usage.find(u => recordKey(u) === state.record); if (!u) return;
  const project = new FormData(event.target).get('project');
  event.target.querySelector('button[type="submit"]').disabled = true;
  mutate('/api/resolve', { source: u.source, sourceId: u.source_id, project }, 'Proyek transaksi disimpan.');
});
$('#record-dialog').addEventListener('close', () => {
  document.body.classList.remove('modal-open');
  document.querySelector(`[data-record="${CSS.escape(state.record || '')}"]`)?.focus({ preventScroll: true });
});
refresh().catch(error => { $('#app').innerHTML = `<div class="error-box" role="alert">Data gagal dimuat: ${esc(error.message)}. Muat ulang untuk mencoba lagi.</div>`; });
