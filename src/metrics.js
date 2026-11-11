export const START = '2026-09-18';
export const END = '2027-09-17';
export const GOALS = { total: 1145, general: 30, specific: 50 };
const DAY = 86400000;

export function dateDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data non valida.');
  const result = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(result) || new Date(result).toISOString().slice(0, 10) !== value) throw new Error('Data non valida.');
  return Math.floor(result / DAY);
}

export function today() {
  // La data del servizio segue il calendario italiano, anche da altri fusi orari.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function calendar(asOf) {
  const start = dateDay(START), end = dateDay(END), day = dateDay(asOf);
  const duration = end - start + 1;
  const elapsed = Math.max(0, Math.min(duration, day - start + 1));
  return { duration, elapsed, remaining: duration - elapsed, fraction: elapsed / duration, day };
}

export function metric(actual, goal, fraction) {
  const expected = goal * fraction;
  const delta = actual - expected;
  // Confronto al centesimo di ora, coerente con i valori mostrati.
  const rounded = Math.round((delta + Number.EPSILON) * 100) / 100;
  return { actual, goal, expected, delta, remaining: Math.max(0, goal - actual), progress: actual / goal,
    status: rounded > 0 ? 'above' : rounded < 0 ? 'below' : 'equal', completed: actual >= goal };
}

export function summarize(records, asOf) {
  const time = calendar(asOf);
  const sums = { total: 0, general: 0, specific: 0, service: 0 };
  const all = { ...sums };
  const months = new Map();
  let lastEntry = null, futureCount = 0;
  for (const row of records) {
    const day = dateDay(row.date);
    const key = row.date.slice(0, 7);
    if (!months.has(key)) months.set(key, { key, total: 0, general: 0, specific: 0, service: 0, all: 0 });
    const m = months.get(key);
    m.all += row.total;
    for (const k of Object.keys(sums)) all[k] += row[k];
    const hasHours = row.total !== 0 || row.general !== 0 || row.specific !== 0 || row.service !== 0;
    if (day > time.day) { if (hasHours) futureCount++; continue; }
    for (const k of Object.keys(sums)) { sums[k] += row[k]; m[k] += row[k]; }
    if (hasHours && (!lastEntry || row.date > lastEntry)) lastEntry = row.date;
  }
  const metrics = Object.fromEntries(Object.entries(GOALS).map(([k, goal]) => [k, metric(sums[k], goal, time.fraction)]));
  return { time, sums, all, metrics, months: [...months.values()].sort((a, b) => a.key.localeCompare(b.key)), lastEntry, futureCount };
}
