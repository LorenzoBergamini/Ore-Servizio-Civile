import { today, summarize } from './src/metrics.js';
import { readWorkbook } from './src/workbook.js';

const $ = id => document.getElementById(id);
const fmt = (n, digits = 2) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits }).format(n);
const dateLabel = date => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let workbook = null, isDemo = false, current = null, generation = 0;
$('as-of').value = today();

const categories = [{ key: 'total', title: 'Totale ore rendicontabili', icon: '◷' }, { key: 'general', title: 'Formazione generale', icon: '↗' }, { key: 'specific', title: 'Formazione specifica', icon: '↗' }];
const statusText = { above: 'Sopra il ritmo', below: 'Sotto il ritmo', equal: 'In pari' };

function message(text, error = false) {
  $('message').hidden = !text;
  $('message').textContent = text;
  $('message').className = error ? 'error' : '';
  $('message').setAttribute('role', error ? 'alert' : 'status');
}

function card(category, result) {
  const m = result.metrics[category.key], active = !!workbook;
  return `<article class="metric ${category.key}" aria-label="${category.title}">
    <div class="category">${category.title}<span class="category-symbol" aria-hidden="true">${category.icon}</span></div>
    <p class="amount">${active ? fmt(m.actual) : '—'}<span>ore</span></p>
    <p class="goal">su ${fmt(m.goal, 0)} ore ${category.key === 'total' ? 'annuali' : 'minime annuali'}</p>
    <div class="metric-bar" role="img" aria-label="${active ? fmt(m.progress * 100, 1) + '% dell’obiettivo annuale; atteso ' + fmt(result.time.fraction * 100, 1) + '%' : 'Carica il file per visualizzare il progresso'}"><span class="actual" style="width:${active ? Math.min(100, m.progress * 100) : 0}%"></span><span class="expected" style="left:calc(${Math.min(100, result.time.fraction * 100)}% - 1px)" title="Obiettivo alla data"></span></div>
    <div class="bar-label"><span>${active ? fmt(m.progress * 100, 1) + '% completato' : 'Nessun dato caricato'}</span><span>Attese ${fmt(m.expected)} h</span></div>
    <div class="status-line"><span class="status ${active ? m.status : 'equal'}">${active ? statusText[m.status] : 'In attesa del file'}</span><span class="delta">${active ? (m.delta >= 0 ? '+' : '−') + fmt(Math.abs(m.delta)) + ' h' : '—'}</span></div>
    <p class="remaining">${active ? (m.completed ? 'Obiettivo annuale raggiunto' : 'Mancano ' + fmt(m.remaining) + ' ore all’obiettivo annuale') : 'Il confronto apparirà dopo il caricamento'}</p>
  </article>`;
}

function render() {
  const asOf = $('as-of').value;
  if (!asOf || !$('as-of').checkValidity()) return;
  let result;
  try { result = summarize(workbook?.records ?? [], asOf); }
  catch (err) { message(err.message, true); return; }
  current = result;
  $('elapsed').textContent = result.time.elapsed;
  $('days-left').textContent = result.time.remaining ? fmt(result.time.remaining, 0) + ' giorni alla fine' : 'Periodo concluso';
  $('time-percentage').textContent = fmt(result.time.fraction * 100, 1) + '% del percorso';
  $('time-progress').style.width = result.time.fraction * 100 + '%';
  $('metrics').innerHTML = categories.map(c => card(c, result)).join('');
  $('export').disabled = !workbook;
  $('clear').disabled = !workbook;
  $('data-state').textContent = !workbook ? 'In attesa del file' : isDemo ? 'Dati di esempio' : 'Al ' + dateLabel(asOf);
  $('data-state').classList.toggle('demo', isDemo);
  if (!workbook) {
    $('months').innerHTML = '<tr><td colspan="6" class="empty-table">Carica il prospetto per vedere il riepilogo dei mesi.</td></tr>';
    $('month-totals').hidden = true;
    $('alerts').innerHTML = '';
    $('all-file').textContent = '';
    $('last-entry').textContent = 'Le ore di formazione sono già comprese nelle ore rendicontabili.';
    return;
  }
  const warnings = [...workbook.warnings];
  if (isDemo) warnings.unshift('Stai visualizzando dati fittizi di esempio. Carica il tuo Excel per ottenere il risultato personale.');
  if (result.futureCount) warnings.push(`${result.futureCount} giornate con ore successive alla data scelta: escluse dalle schede e incluse solo in “tutto il file”.`);
  if (result.lastEntry && result.lastEntry < asOf) warnings.push('Ultima giornata con ore: ' + dateLabel(result.lastEntry) + '. Le giornate successive non hanno ore registrate entro la data scelta; il confronto usa comunque la data selezionata.');
  $('alerts').innerHTML = warnings.length ? '<div class="alert"><strong>Da tenere presente</strong><ul>' + warnings.map(w => '<li>' + escape(w) + '</li>').join('') + '</ul></div>' : '';
  $('months').innerHTML = result.months.map(m => {
    const name = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m.key + '-01T00:00:00Z'));
    const future = m.key > asOf.slice(0, 7);
    return `<tr class="${future ? 'future-row' : ''}"><td><span class="month-dot" aria-hidden="true"></span>${escape(name.charAt(0).toUpperCase() + name.slice(1))}</td><td>${fmt(m.service)}</td><td>${fmt(m.general)}</td><td>${fmt(m.specific)}</td><td>${fmt(m.total)}</td><td>${fmt(m.all)}</td></tr>`;
  }).join('');
  $('month-totals').hidden = false;
  $('month-totals').innerHTML = `<tr><td>Totale ore</td><td>${fmt(result.sums.service)}</td><td>${fmt(result.sums.general)}</td><td>${fmt(result.sums.specific)}</td><td>${fmt(result.sums.total)}</td><td>${fmt(result.all.total)}</td></tr>`;
  $('last-entry').textContent = result.lastEntry ? 'Ultima giornata con ore entro il confronto: ' + dateLabel(result.lastEntry) : 'Nessuna ora registrata entro la data scelta.';
  $('all-file').textContent = 'Tutto il file: ' + fmt(result.all.total) + ' h totali · ' + fmt(result.all.general) + ' h generale · ' + fmt(result.all.specific) + ' h specifica';
}

async function load(file) {
  if (!file) return;
  const token = ++generation;
  if (!/\.xlsx$/i.test(file.name)) { $('pick-file').disabled = false; message('Scegli un file .xlsx. I formati .xls e .csv non sono supportati.', true); return; }
  if (file.size > 10 * 1024 * 1024) { $('pick-file').disabled = false; message('Il file supera 10 MB. Carica il prospetto presenze originale.', true); return; }
  message('Lettura dei fogli e verifica delle formule…');
  $('pick-file').disabled = true;
  try {
    const data = await readWorkbook(await file.arrayBuffer());
    if (token !== generation) return;
    workbook = data; isDemo = false;
    $('file-label').textContent = file.name;
    $('file-detail').textContent = data.recognized.length + ' fogli mensili riconosciuti · ' + fmt(file.size / 1024, 0) + ' KB · elaborazione locale';
    $('upload-title').textContent = 'Prospetto caricato';
    $('pick-file').firstChild.textContent = 'Cambia file ';
    message('File letto correttamente. Le ore sono aggiornate alla data del confronto.');
    render();
  } catch (err) {
    if (token !== generation) return;
    const detail = /zip|central directory|end of data|encrypted/i.test(err.message) ? 'Il file non è un .xlsx valido oppure è protetto da password. Salvalo nuovamente come .xlsx senza password.' : err.message;
    message('Impossibile leggere il file. ' + detail + (workbook ? ' Restano visibili i dati precedenti.' : ''), true);
  } finally { if (token === generation) $('pick-file').disabled = false; $('file').value = ''; }
}

$('pick-file').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', e => load(e.target.files[0]));
$('as-of').addEventListener('change', render);
$('today').addEventListener('click', () => { $('as-of').value = today(); render(); });
for (const name of ['dragenter', 'dragover']) $('dropzone').addEventListener(name, e => { e.preventDefault(); $('dropzone').classList.add('dragging'); });
$('dropzone').addEventListener('dragleave', e => { if (!$('dropzone').contains(e.relatedTarget)) $('dropzone').classList.remove('dragging'); });
$('dropzone').addEventListener('drop', e => { e.preventDefault(); $('dropzone').classList.remove('dragging'); if (e.dataTransfer.files.length !== 1) { message('Carica un solo prospetto Excel alla volta.', true); return; } load(e.dataTransfer.files[0]); });
// Evita che un file trascinato fuori dall’area sostituisca la pagina nel browser.
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());

$('demo').addEventListener('click', () => {
  generation++;
  const records = [];
  for (let i = 0; i < 55; i++) {
    const d = new Date(Date.UTC(2026, 8, 18 + i)), day = d.getUTCDay();
    const row = { date: d.toISOString().slice(0, 10), service: day === 0 || day === 6 ? 0 : 4, general: i === 10 || i === 31 ? 4 : 0, specific: i === 20 || i === 42 ? 3 : 0 };
    row.total = row.service + row.general + row.specific;
    records.push(row);
  }
  workbook = { records, warnings: [] }; isDemo = true;
  $('file-label').textContent = 'Esempio dimostrativo · dati fittizi';
  $('file-detail').textContent = 'Carica il tuo prospetto per sostituire l’esempio';
  $('upload-title').textContent = 'Un’anteprima del tuo percorso';
  $('pick-file').disabled = false;
  message('Esempio caricato. Questi dati non provengono dal tuo Excel.');
  render();
});

$('clear').addEventListener('click', () => {
  generation++; workbook = null; isDemo = false;
  $('file-label').textContent = 'Trascina il file .xlsx o scegli dal dispositivo.';
  $('file-detail').textContent = 'Fogli mensili del modello presenze · massimo 10 MB';
  $('upload-title').textContent = 'Il tuo prospetto, tutto qui.';
  $('pick-file').firstChild.textContent = 'Carica Excel ';
  $('pick-file').disabled = false;
  message('Dati rimossi dalla pagina.'); render();
});

$('export').addEventListener('click', () => {
  if (!workbook || !current) return;
  const number = n => String(Math.round(n * 100) / 100).replace('.', ',');
  const rows = [['Riepilogo servizio civile', isDemo ? 'DATI DI ESEMPIO' : 'Dati del file caricato'], ['Data confronto', $('as-of').value], ['Periodo', '18/09/2026 - 17/09/2027'], [], ['Categoria', 'Ore alla data', 'Obiettivo annuale', 'Attese alla data', 'Scostamento', 'Stato']];
  for (const c of categories) { const m = current.metrics[c.key]; rows.push([c.title, number(m.actual), number(m.goal), number(m.expected), number(m.delta), statusText[m.status]]); }
  rows.push([], ['Mese', 'Servizio alla data', 'Generale alla data', 'Specifica alla data', 'Rendicontabili alla data', 'Rendicontabili tutto il file']);
  for (const m of current.months) rows.push([m.key, number(m.service), number(m.general), number(m.specific), number(m.total), number(m.all)]);
  rows.push(['TOTALE', number(current.sums.service), number(current.sums.general), number(current.sums.specific), number(current.sums.total), number(current.all.total)]);
  rows.push([], ['Metodo', 'Obiettivi ripartiti uniformemente sui 365 giorni. Formazione già inclusa nelle ore rendicontabili.']);
  for (const w of workbook.warnings) rows.push(['Avviso', w]);
  if (current.futureCount) rows.push(['Avviso', current.futureCount + ' giornate con ore future rispetto al confronto escluse dai totali alla data.']);
  if (current.lastEntry) rows.push(['Ultima giornata con ore entro il confronto', current.lastEntry]);
  const csvCell = value => {
    let text = String(value);
    // Mantiene numerici gli scostamenti, ma neutralizza formule nei nomi dei fogli/avvisi.
    if (/^[=+@\-\t\r]/.test(text) && !/^-?\d+(?:,\d+)?$/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'riepilogo-servizio-civile-' + $('as-of').value + (isDemo ? '-esempio' : '') + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

render();
