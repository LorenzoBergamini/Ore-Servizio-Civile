import { START, END, dateDay } from './metrics.js';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const nodes = (node, name) => [...node.getElementsByTagNameNS('*', name)];
const first = (node, name) => nodes(node, name)[0];
const clean = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const refParts = ref => /^([A-Z]+)(\d+)$/.exec(ref.replace(/\$/g, ''));
const colNumber = col => [...col].reduce((v, c) => v * 26 + c.charCodeAt(0) - 64, 0);
function colName(n) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; }

export function shiftFormula(formula, from, to) {
  const a = refParts(from), b = refParts(to);
  const dc = colNumber(b[1]) - colNumber(a[1]), dr = Number(b[2]) - Number(a[2]);
  return formula.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (_, ac, col, ar, row) => {
    const c = colNumber(col) + (ac ? 0 : dc), r = Number(row) + (ar ? 0 : dr);
    if (c < 1 || r < 1) throw new Error('Riferimento di formula non valido.');
    return ac + colName(c) + ar + r;
  });
}

// Interprete limitato alle formule del prospetto: nessuna esecuzione di codice dal file.
export function evaluateFormula(formula, getCell) {
  let input = formula.replace(/^=/, '').replace(/\$/g, '').toUpperCase();
  input = input.replace(/(?:SUM|SOMMA)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g, (_, c1, r1, c2, r2) => {
    const lo = colNumber(c1), hi = colNumber(c2), start = Number(r1), end = Number(r2);
    if (hi < lo || end < start || (hi - lo + 1) * (end - start + 1) > 10000) throw new Error('Intervallo di formula non supportato.');
    let sum = 0;
    for (let c = lo; c <= hi; c++) for (let r = start; r <= end; r++) sum += getCell(colName(c) + r);
    return '(' + sum + ')';
  });
  const tokens = input.match(/[A-Z]+\d+|(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?|[()+\-*/]/g) ?? [];
  if (tokens.join('') !== input.replace(/\s+/g, '')) throw new Error('Formula non supportata: ' + formula);
  let at = 0;
  const atom = () => {
    const t = tokens[at++];
    if (t === '+') return atom();
    if (t === '-') return -atom();
    if (t === '(') { const v = sum(); if (tokens[at++] !== ')') throw new Error('Formula non valida.'); return v; }
    if (/^[A-Z]+\d+$/.test(t ?? '')) return getCell(t);
    if (t === undefined || !Number.isFinite(Number(t))) throw new Error('Formula non valida.');
    return Number(t);
  };
  const product = () => { let v = atom(); while (tokens[at] === '*' || tokens[at] === '/') { const op = tokens[at++], b = atom(); v = op === '*' ? v * b : v / b; } return v; };
  const sum = () => { let v = product(); while (tokens[at] === '+' || tokens[at] === '-') { const op = tokens[at++], b = product(); v = op === '+' ? v + b : v - b; } return v; };
  const result = sum();
  if (at !== tokens.length || !Number.isFinite(result)) throw new Error('Formula non valida.');
  return result;
}

export function sheetFromXml(doc, strings) {
  const cells = new Map(), shared = new Map();
  for (const el of nodes(doc, 'c')) {
    const ref = el.getAttribute('r');
    const raw = first(el, 'v')?.textContent;
    const type = el.getAttribute('t');
    const f = first(el, 'f');
    let value = raw === undefined ? null : raw;
    if (type === 's') value = strings[Number(raw)];
    else if (type === 'inlineStr') value = nodes(el, 't').map(t => t.textContent).join('');
    else if (raw !== undefined && type !== 'str' && type !== 'e' && type !== 'b') value = Number(raw);
    const cell = { ref, value, type, formula: f?.textContent || null, shared: f?.getAttribute('si') ?? null, hasFormula: !!f };
    if (f?.getAttribute('t') === 'shared' && cell.formula) shared.set(cell.shared, cell);
    cells.set(ref, cell);
  }
  for (const cell of cells.values()) if (cell.hasFormula && !cell.formula && cell.shared !== null) {
    const base = shared.get(cell.shared);
    if (!base) throw new Error('Formula condivisa incompleta in ' + cell.ref + '.');
    cell.formula = shiftFormula(base.formula, base.ref, cell.ref);
  }
  const makeNumber = (overrides = new Map()) => {
  const memo = new Map(), visiting = new Set();
  const number = ref => {
    if (overrides.has(ref)) return overrides.get(ref);
    if (memo.has(ref)) return memo.get(ref);
    const cell = cells.get(ref);
    if (!cell || (!cell.hasFormula && (cell.value === null || cell.value === ''))) return 0;
    if (visiting.has(ref)) throw new Error('Formula circolare in ' + ref + '.');
    visiting.add(ref);
    let result;
    try {
      if (cell.formula) result = evaluateFormula(cell.formula, number);
      else if (typeof cell.value === 'number' && Number.isFinite(cell.value)) result = cell.value;
      else if (typeof cell.value === 'string' && /^\d+(?:[.,]\d+)?$/.test(cell.value.trim()) && !['e', 'b'].includes(cell.type)) result = Number(cell.value.replace(',', '.'));
      else throw new Error('Valore delle ore non numerico in ' + ref + '.');
      if (!Number.isFinite(result) || result < 0) throw new Error('Ore non valide in ' + ref + '.');
      memo.set(ref, result);
      return result;
    } finally { visiting.delete(ref); }
  };
  return number;
  };
  return { cells, number: makeNumber(), numberWithOverrides: (ref, overrides) => makeNumber(overrides)(ref) };
}

function excelDate(value, date1904) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 100000) return null;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.floor(value) * 86400000).toISOString().slice(0, 10);
}

export function extractRecords(sheets, date1904 = false) {
  const records = [], warnings = [], recognized = [], seen = new Set();
  let excluded = 0;
  for (const { name, sheet } of sheets) {
    const labels = [...sheet.cells.values()];
    // Le intestazioni principali precedono le righe giornaliere; quelle a piè di pagina sono copie.
    const candidates = labels.filter(c => /FORMAZIONE GENERALE/.test(clean(c.value)));
    let layout;
    for (const candidate of candidates) {
      const row = refParts(candidate.ref)?.[2];
      if (!row) continue;
      const sameRow = labels.filter(c => refParts(c.ref)?.[2] === row);
      const findCol = test => { const c = sameRow.find(c => test(clean(c.value))); return c && refParts(c.ref)[1]; };
      const specific = findCol(v => v.includes('FORMAZIONE SPECIFICA'));
      const total = findCol(v => v.includes('ORE RENDICONTABILI'));
      const service = findCol(v => /ORE SERVIZIO/.test(v));
      const permitDays = findCol(v => v === 'GG PERMESSO');
      const sickDays = findCol(v => v === 'GG MALATTIA');
      const injuryDays = findCol(v => v === 'GG INFORTUNIO');
      if (specific && total && service) { layout = { row: Number(row), general: refParts(candidate.ref)[1], specific, total, service, permitDays, sickDays, injuryDays }; break; }
    }
    if (!layout) continue;
    recognized.push(name);
    const totalsLabel = labels.find(c => Number(refParts(c.ref)?.[2]) > layout.row && /TOTALI DA RIPORTARE/.test(clean(c.value)));
    if (!totalsLabel) throw new Error('Foglio «' + name + '»: riga dei totali non riconosciuta. Usa il modello originale.');
    const totalRow = Number(refParts(totalsLabel.ref)[2]);
    let count = 0;
    const local = { total: 0, general: 0, specific: 0, service: 0 };
    const absenceTotals = { permitDays: 0, sickDays: 0, injuryDays: 0 };
    const missingAbsences = Object.keys(absenceTotals).filter(key => !layout[key]);
    if (missingAbsences.length) warnings.push(name + ': alcune colonne delle assenze non sono presenti; i relativi contatori saranno indicati come non disponibili.');
    for (let row = layout.row + 1; row < totalRow; row++) {
      const dateCell = sheet.cells.get('A' + row);
      const date = excelDate(dateCell?.value, date1904);
      const values = {};
      for (const key of Object.keys(local)) {
        try { values[key] = sheet.number(layout[key] + row); }
        catch (err) { throw new Error('Foglio «' + name + '»: ' + err.message); }
      }
      const hasHours = Object.values(values).some(v => v !== 0);
      if (!date) {
        const hasAbsence = Object.keys(absenceTotals).some(key => layout[key] && typeof sheet.cells.get(layout[key] + row)?.value === 'number' && sheet.cells.get(layout[key] + row).value > 0);
        if (hasHours || hasAbsence) throw new Error('Foglio «' + name + '», riga ' + row + ': data mancante o non valida.');
        continue;
      }
      count++;
      for (const key of Object.keys(local)) local[key] += values[key];
      for (const key of Object.keys(absenceTotals)) {
        values[key] = layout[key] ? sheet.number(layout[key] + row) : null;
        if (values[key] !== null && ![0, 1].includes(values[key])) throw new Error('Foglio «' + name + '», cella ' + layout[key] + row + ': inserisci 0 o 1 per i giorni di assenza.');
        absenceTotals[key] += values[key] ?? 0;
      }
      values.sickCreditHours = values.sickDays ? null : 0;
      if (values.sickDays && (sheet.cells.get(layout.total + row)?.hasFormula || values.total === 0)) {
        const withoutSickness = sheet.numberWithOverrides(layout.total + row, new Map([[layout.sickDays + row, 0]]));
        const credit = values.total - withoutSickness;
        if (credit >= -0.005 && credit <= values.total + 0.005) values.sickCreditHours = Math.max(0, credit);
      }
      if (date < START || date > END) { if (hasHours) excluded++; continue; }
      if (seen.has(date)) throw new Error('Data duplicata (' + date + ') nel foglio «' + name + '». Rimuovi eventuali copie dei mesi.');
      seen.add(date);
      if (values.total + 0.005 < values.general + values.specific + values.service) warnings.push(name + ', ' + date + ': totale rendicontabile inferiore alle ore di presenza. Verifica la formula Excel.');
      records.push({ date, ...values, sheet: name, row });
    }
    if (!count) throw new Error('Foglio «' + name + '»: nessuna data giornaliera riconosciuta.');
    for (const key of Object.keys(local)) {
      const ref = layout[key] + totalRow;
      try { if (Math.abs(sheet.number(ref) - local[key]) > 0.005) warnings.push(name + ': il totale ' + ref + ' non coincide con la somma giornaliera. Il sito usa le righe giornaliere.'); }
      catch (err) { warnings.push(name + ': controllo del totale ' + ref + ' non disponibile (' + err.message + ').'); }
    }
    for (const key of Object.keys(absenceTotals)) if (layout[key]) {
      const ref = layout[key] + totalRow;
      try { if (Math.abs(sheet.number(ref) - absenceTotals[key]) > 0.005) warnings.push(name + ': il totale giorni ' + ref + ' non coincide con le giornate registrate. Il sito usa il dettaglio giornaliero.'); }
      catch { warnings.push(name + ': controllo del totale giorni ' + ref + ' non disponibile.'); }
    }
  }
  if (!recognized.length || !records.length) throw new Error('Modello non riconosciuto. Carica il prospetto .xlsx con i fogli mensili, le date in colonna A e le intestazioni originali.');
  if (excluded) warnings.push(excluded + ' giornate con ore fuori dal periodo di servizio: escluse dai conteggi.');
  if (seen.size < dateDay(END) - dateDay(START) + 1) warnings.push('Il file non contiene tutte le date dell’anno di servizio. I giorni mancanti non contribuiscono ai totali.');
  return { records: records.sort((a, b) => a.date.localeCompare(b.date)), warnings, recognized };
}

export async function readWorkbook(buffer, { JSZip = globalThis.JSZip, parseXML } = {}) {
  if (!JSZip) throw new Error('Lettore Excel non caricato. Ricarica la pagina.');
  parseXML ??= text => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (first(doc, 'parsererror')) throw new Error('Il file contiene XML non valido.');
    return doc;
  };
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);
  if (entries.length > 3000 || entries.reduce((sum, f) => sum + (f._data?.uncompressedSize || 0), 0) > 80 * 1024 * 1024) throw new Error('File Excel troppo complesso o troppo grande (massimo 80 MB decompressi).');
  const xml = async path => {
    const file = zip.file(path);
    if (!file) throw new Error('Struttura .xlsx incompleta: manca ' + path + '.');
    return parseXML(await file.async('string'));
  };
  const wb = await xml('xl/workbook.xml'), relDoc = await xml('xl/_rels/workbook.xml.rels');
  const paths = new Map(nodes(relDoc, 'Relationship').filter(r => r.getAttribute('TargetMode') !== 'External').map(r => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const stringFile = zip.file('xl/sharedStrings.xml');
  const strings = stringFile ? nodes(parseXML(await stringFile.async('string')), 'si').map(el => nodes(el, 't').map(t => t.textContent).join('')) : [];
  const date1904 = ['1', 'true'].includes(first(wb, 'workbookPr')?.getAttribute('date1904'));
  const sheets = [];
  for (const el of nodes(wb, 'sheet')) {
    const target = paths.get(el.getAttributeNS(REL, 'id') || el.getAttribute('r:id'));
    if (!target) throw new Error('Collegamento al foglio mancante.');
    const parts = (target.startsWith('/') ? target.slice(1) : 'xl/' + target).split('/');
    const normalized = [];
    for (const part of parts) { if (part === '..') normalized.pop(); else if (part && part !== '.') normalized.push(part); }
    sheets.push({ name: el.getAttribute('name'), sheet: sheetFromXml(await xml(normalized.join('/')), strings) });
  }
  return extractRecords(sheets, date1904);
}
