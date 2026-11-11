import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { evaluateFormula, shiftFormula, sheetFromXml, extractRecords, readWorkbook } from '../src/workbook.js';
import { calendar, metric, summarize } from '../src/metrics.js';

const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/test.cjs' : import.meta.url);
const { xml2js } = require('xml-js');
const JSZip = require('jszip');

// DOM minimo per usare in Node lo stesso lettore XML impiegato dal browser.
function parseXML(text) {
  const build = raw => {
    const children = (raw.elements || []).map(build);
    return {
      get textContent() { return raw.text ?? raw.cdata ?? children.map(n => n.textContent).join(''); },
      getAttribute: key => raw.attributes?.[key] ?? null,
      getAttributeNS: (ns, key) => raw.attributes?.['r:' + key] ?? raw.attributes?.[key] ?? null,
      getElementsByTagNameNS: (ns, key) => children.flatMap(n => [...(n.name?.split(':').at(-1) === key ? [n] : []), ...n.getElementsByTagNameNS(ns, key)]),
      name: raw.name
    };
  };
  return build(xml2js(text));
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('✓ ' + name); }
const xml = content => parseXML('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + content + '</sheetData></worksheet>');
const str = (ref, text) => `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`;
const val = (ref, value) => `<c r="${ref}"><v>${value}</v></c>`;
const sheet = (extra = '', date = 46283) => sheetFromXml(xml(
  str('F6', 'N° ORE FORMAZIONE GENERALE') + str('G6', 'N° ORE FORMAZIONE SPECIFICA') + str('E6', 'N° ORE SERVIZIO') + str('N6', 'TOT ORE RENDICONTABILI') +
  val('A9', date) + val('E9', 4) + val('F9', 2) + val('G9', 1) + '<c r="N9"><f>E9+F9+G9+H9*5</f><v>999</v></c>' +
  str('A40', 'TOTALI DA RIPORTARE SU FORM ON LINE') + val('E40', 4) + val('F40', 2) + val('G40', 1) + val('N40', 7) + extra
), []);

await test('Calendario inclusivo: inizio, fine e limiti esterni', () => {
  assert.equal(calendar('2026-09-17').elapsed, 0);
  assert.equal(calendar('2026-09-18').elapsed, 1);
  assert.equal(calendar('2026-11-11').elapsed, 55);
  assert.equal(calendar('2027-09-17').elapsed, 365);
  assert.equal(calendar('2028-01-01').elapsed, 365);
  assert.throws(() => calendar('2026-02-30'), /Data non valida/);
});
await test('Stati sopra, sotto, in pari e obiettivo raggiunto', () => {
  assert.equal(metric(185.5, 1145, 55/365).status, 'above');
  assert.equal(metric(0, 50, 55/365).status, 'below');
  assert.equal(metric(25, 50, .5).status, 'equal');
  assert.equal(metric(25.004, 50, .5).status, 'equal');
  assert.equal(metric(25.006, 50, .5).status, 'above');
  assert.equal(metric(60, 50, 1).remaining, 0);
  assert.equal(metric(60, 50, 1).completed, true);
});
await test('Formule: precedenza, parentesi, somme, riferimenti assoluti', () => {
  const get = ref => ({ E9:4, F9:2, G9:1, H9:1, E10:5 })[ref] || 0;
  assert.equal(evaluateFormula('E9+F9+G9+H9*5', get), 12);
  assert.equal(evaluateFormula('(E9+F9)*G9/2', get), 3);
  assert.equal(evaluateFormula('SUM(E9:E10)', get), 9);
  assert.equal(evaluateFormula('SUM(E9:G9)', get), 7);
  assert.equal(evaluateFormula('$E$9+F9', get), 6);
  assert.throws(() => evaluateFormula('WEBSERVICE("https://example.com")', get), /non supportata/);
  assert.throws(() => evaluateFormula('1/0', get), /non valida/);
  assert.equal(shiftFormula('E9+$F9+G$9+$H$9', 'N9', 'N10'), 'E10+$F10+G$9+$H$9');
});
await test('Formule condivise e cache obsolete ricalcolate', () => {
  const parsed = sheetFromXml(xml(val('E9', 4) + val('F9', 2) + val('E10', 5) + val('F10', 3) + '<c r="N9"><f t="shared" si="0" ref="N9:N10">E9+F9</f><v>999</v></c><c r="N10"><f t="shared" si="0"/><v>999</v></c>'), []);
  assert.equal(parsed.number('N9'), 6);
  assert.equal(parsed.number('N10'), 8);
});
await test('Estrazione giornaliera: formazione già nel totale e sommari esclusi', () => {
  const data = extractRecords([{ name:'SETTEMBRE 2026', sheet:sheet() }]);
  assert.equal(data.records.length, 1);
  assert.equal(data.records[0].date, '2026-09-18');
  assert.equal(data.records[0].total, 7);
  assert.equal(data.records[0].general, 2);
  assert.equal(data.records[0].specific, 1);
  assert.equal(summarize(data.records, '2026-11-11').sums.total, 7);
});
await test('Controlli: duplicati, assenze riconosciute, dati non numerici', () => {
  assert.throws(() => extractRecords([{name:'A',sheet:sheet()}, {name:'Copia',sheet:sheet()}]), /duplicata/);
  const absence = extractRecords([{name:'A',sheet:sheet(val('H9',1))}]);
  assert.equal(absence.records[0].total, 12);
  assert(absence.warnings.some(w => w.includes('non coincide')));
  assert.throws(() => extractRecords([{name:'A',sheet:sheet(str('F9','errore'))}]), /non numerico/);
});
await test('Cutoff giornaliero: ore future solo nel totale del file', () => {
  const rows = [{date:'2026-09-18',total:7,general:2,specific:1,service:4}, {date:'2026-11-12',total:8,general:3,specific:1,service:4}];
  const s = summarize(rows, '2026-11-11');
  assert.equal(s.sums.total, 7);
  assert.equal(s.all.total, 15);
  assert.equal(s.futureCount, 1);
  assert.equal(s.lastEntry, '2026-09-18');
  assert.equal(summarize(rows, '2026-09-17').sums.total, 0);
});
await test('Import .xlsx completo con relazioni, stringhe condivise e formule', async () => {
  const zip = new JSZip();
  zip.file('xl/workbook.xml', '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="SETTEMBRE 2026" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/sharedStrings.xml', '<sst><si><t>N° ORE FORMAZIONE GENERALE</t></si></sst>');
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData>' + '<c r="F6" t="s"><v>0</v></c>' + str('G6','N° ORE FORMAZIONE SPECIFICA') + str('E6','N° ORE SERVIZIO') + str('N6','TOT ORE RENDICONTABILI') + val('A9',46283) + val('E9',4) + val('F9',2) + val('G9',1) + '<c r="N9"><f>E9+F9+G9</f></c>' + str('A40','TOTALI DA RIPORTARE') + val('E40',4) + val('F40',2) + val('G40',1) + val('N40',7) + '</sheetData></worksheet>');
  const imported = await readWorkbook(await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}), { JSZip, parseXML });
  assert.equal(imported.records[0].total, 7);
  assert.equal(imported.records[0].date, '2026-09-18');
});

if (process.argv[2]) await test('File originale: 13 mesi, 365 date, totali e confronto all’11/11/2026', async () => {
  const data = await readWorkbook(await fs.readFile(process.argv[2]), { JSZip, parseXML });
  assert.equal(data.recognized.length, 13);
  assert.equal(data.records.length, 365);
  const result = summarize(data.records, '2026-11-11');
  assert.equal(result.sums.total, 185.5);
  assert.equal(result.sums.general, 15);
  assert.equal(result.sums.specific, 9);
  assert.equal(result.sums.service, 161.5);
  assert.equal(data.warnings.length, 0);
  assert.equal(result.metrics.total.status, 'above');
  assert.equal(result.metrics.general.status, 'above');
  assert.equal(result.metrics.specific.status, 'above');
  assert.equal(result.lastEntry, '2026-11-11');
  console.log(JSON.stringify({ actual:result.sums, expected:Object.fromEntries(Object.entries(result.metrics).map(([k,m])=>[k,m.expected])), delta:Object.fromEntries(Object.entries(result.metrics).map(([k,m])=>[k,m.delta])) },null,2));
});
console.log('\n' + passed + ' verifiche superate.');
