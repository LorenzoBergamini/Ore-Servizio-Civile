export const START = '2026-09-18';
export const END = '2027-09-17';
export const GOALS = { total: 1145, general: 30, specific: 50 };
export const VACATION_DAYS = 28;
export const SPECIFIC_DEADLINES = [
  { key: 'first', goal: 35, date: '2026-12-16', label: '70% entro il 90º giorno' },
  { key: 'final', goal: 50, date: '2027-07-17', label: '100% entro il terzultimo mese' }
];
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

export function vacationDates(ranges = []) {
  if (!Array.isArray(ranges) || ranges.length > 4) throw new Error('Indica al massimo quattro periodi di ferie.');
  const dates = new Set();
  for (const range of ranges) {
    if (!range.start && !range.end) continue;
    if (!range.start || !range.end) throw new Error('Completa entrambe le date del periodo di ferie.');
    const start = dateDay(range.start), end = dateDay(range.end);
    if (range.start < START || range.end > END || end < start) throw new Error('Le ferie devono ricadere nel servizio, con la fine successiva o uguale all’inizio.');
    if (end - start + 1 > VACATION_DAYS) throw new Error(`Le ferie obbligatorie possono coprire al massimo ${VACATION_DAYS} giorni di calendario.`);
    for (let day = start; day <= end; day++) {
      if (dates.has(day)) throw new Error('I periodi di ferie non possono sovrapporsi.');
      dates.add(day);
      if (dates.size > VACATION_DAYS) throw new Error(`I periodi superano i ${VACATION_DAYS} giorni di ferie obbligatorie.`);
    }
  }
  return dates;
}

export function calendar(asOf, vacations = []) {
  const start = dateDay(START), end = dateDay(END), day = dateDay(asOf);
  const duration = end - start + 1;
  const elapsed = Math.max(0, Math.min(duration, day - start + 1));
  const dates = vacationDates(vacations);
  const vacationElapsed = [...dates].filter(d => d <= day).length;
  const activeDuration = duration - VACATION_DAYS;
  const activeElapsed = Math.max(0, Math.min(activeDuration, elapsed - vacationElapsed));
  return { duration, elapsed, remaining: duration - elapsed, fraction: elapsed / duration, day,
    activeDuration, activeElapsed, activeFraction: activeElapsed / activeDuration,
    vacationElapsed, scheduledVacation: dates.size, unscheduledVacation: VACATION_DAYS - dates.size, vacationDates: dates };
}

export function specificExpected(asOf) {
  const day = dateDay(asOf), start = dateDay(START);
  const first = dateDay(SPECIFIC_DEADLINES[0].date), final = dateDay(SPECIFIC_DEADLINES[1].date);
  if (day < start) return 0;
  if (day <= first) return 35 * (day - start + 1) / (first - start + 1);
  return 35 + 15 * Math.min(1, (day - first) / (final - first));
}

export function specificMilestones(records, asOf) {
  const day = dateDay(asOf);
  return SPECIFIC_DEADLINES.map(deadline => {
    const cutoff = asOf < deadline.date ? asOf : deadline.date;
    const actual = records.filter(row => row.date >= START && row.date <= cutoff).reduce((sum, row) => sum + row.specific, 0);
    return { ...deadline, actual, remaining: Math.max(0, deadline.goal - actual),
      daysLeft: Math.max(0, dateDay(deadline.date) - day),
      status: actual >= deadline.goal ? 'met' : day > dateDay(deadline.date) ? 'missed' : 'pending' };
  });
}

export function metric(actual, goal, fraction) {
  const expected = goal * fraction;
  const delta = actual - expected;
  // Confronto al centesimo di ora, coerente con i valori mostrati.
  const rounded = Math.round((delta + Number.EPSILON) * 100) / 100;
  return { actual, goal, expected, delta, remaining: Math.max(0, goal - actual), progress: actual / goal,
    status: rounded > 0 ? 'above' : rounded < 0 ? 'below' : 'equal', completed: actual >= goal };
}

export function specificComparisons(records, asOf) {
  const elapsed = Math.max(0, dateDay(asOf) - dateDay(START) + 1);
  return specificMilestones(records, asOf).map(milestone => {
    const duration = dateDay(milestone.date) - dateDay(START) + 1;
    return { ...metric(milestone.actual, milestone.goal, Math.min(1, elapsed / duration)),
      key: milestone.key, date: milestone.date, daysLeft: milestone.daysLeft,
      deadlineStatus: milestone.status };
  });
}

export function summarize(records, asOf, vacations = []) {
  const time = calendar(asOf, vacations);
  const sums = { total: 0, general: 0, specific: 0, service: 0 };
  const all = { ...sums };
  const months = new Map();
  let lastEntry = null, futureCount = 0, vacationConflicts = 0;
  for (const row of records) {
    const day = dateDay(row.date);
    const key = row.date.slice(0, 7);
    if (!months.has(key)) months.set(key, { key, total: 0, general: 0, specific: 0, service: 0, all: 0 });
    const m = months.get(key);
    m.all += row.total;
    for (const k of Object.keys(sums)) all[k] += row[k];
    const hasHours = row.total !== 0 || row.general !== 0 || row.specific !== 0 || row.service !== 0;
    if (hasHours && time.vacationDates.has(day)) vacationConflicts++;
    if (day > time.day) { if (hasHours) futureCount++; continue; }
    for (const k of Object.keys(sums)) { sums[k] += row[k]; m[k] += row[k]; }
    if (hasHours && (!lastEntry || row.date > lastEntry)) lastEntry = row.date;
  }
  const metrics = Object.fromEntries(Object.entries(GOALS).map(([k, goal]) => [k, metric(sums[k], goal,
    k === 'specific' ? specificExpected(asOf) / goal : time.activeFraction)]));
  return { time, sums, all, metrics, milestones: specificMilestones(records, asOf), specificComparisons: specificComparisons(records, asOf),
    months: [...months.values()].sort((a, b) => a.key.localeCompare(b.key)), lastEntry, futureCount, vacationConflicts };
}
