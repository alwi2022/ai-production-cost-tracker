import { createHash } from 'node:crypto';

export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clean = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const groups = {
  'GBX-01': ['gbx01', 'greenbox', 'greenbox benchmark', 'Greenbox Garden Benchmark'],
  'KMD-02': ['kmd02', 'Kopi Malam', 'kopi malam drama', 'Kopi Malam Mini Drama S1'],
  'GLW-03': ['glw03', 'Glowlab', 'glowlab serum', 'Glowlab Serum Launch'],
  'SNJ-04': ['snj04', 'Senja', 'senja resort', 'Senja Resort Teaser'],
  'BRK-05': ['brk05', 'Barakuda', 'barakuda lookbook', 'Barakuda Sneakers Lookbook'],
  'INT-00': ['int00', 'rnd', 'R&D', 'Internal', 'Internal R&D'],
};
const aliases = new Map(Object.entries(groups).flatMap(([code, names]) => names.map(name => [clean(name), code])));
export const projectCode = value => aliases.get(clean(value)) ?? null;

export function money(value, currency) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid amount');
    if (currency === 'IDR') return Math.round(value * 100);
    value = String(value);
  }
  let text = String(value ?? '').trim();
  if (currency === 'IDR') {
    text = text.replace(/^Rp\s*/i, '').replace(/\./g, '').replace(',', '.');
  } else text = text.replace(/^\$/, '').replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error(`Invalid ${currency} amount: ${value}`);
  const sign = text.startsWith('-') ? -1 : 1;
  const [whole, fraction = ''] = text.replace('-', '').split('.');
  const result = sign * (Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
  if (!Number.isSafeInteger(result)) throw new Error('Amount out of range');
  return result;
}

export function timestamp(value, source) {
  if (source === 'vendor_c') {
    if (!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Invalid API timestamp');
    return new Date(value).toISOString();
  }
  let year, month, day, hour = 0, minute = 0;
  if (value instanceof Date) {
    year = value.getUTCFullYear(); month = value.getUTCMonth() + 1; day = value.getUTCDate();
  } else {
    const text = String(value).trim();
    let m;
    if (source === 'vendor_a' && (m = text.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/))) {
      [, month, day, year, hour, minute] = m;
    } else if (source === 'vendor_b' && (m = text.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/))) {
      [, day, month, year, hour, minute] = m;
    } else if (source === 'manual' && (m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
      [, year, month, day] = m;
    } else if (source === 'manual' && (m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
      [, day, month, year] = m;
    } else if (source === 'manual' && (m = text.match(/^(\d{1,2}) (Sep|Okt|Oct) (\d{4})$/i))) {
      day = m[1]; month = m[2].toLowerCase() === 'sep' ? 9 : 10; year = m[3];
    } else throw new Error(`Unrecognized ${source} date: ${text}`);
  }
  const parts = [year, month, day, hour, minute].map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4]));
  if (date.getUTCFullYear() !== parts[0] || date.getUTCMonth() + 1 !== parts[1] || date.getUTCDate() !== parts[2] || parts[3] > 23 || parts[4] > 59) throw new Error('Invalid calendar date');
  if (source === 'manual') date.setUTCHours(date.getUTCHours() - 7);
  return date.toISOString();
}
export const wibDate = iso => new Date(Date.parse(iso) + 7 * 3600000).toISOString().slice(0, 10);
export function weekOf(iso) {
  const date = new Date(`${wibDate(iso)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
