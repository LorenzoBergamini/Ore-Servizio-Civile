import { today, summarize, vacationDates, VACATION_DAYS } from './src/metrics.js?v=5';
import { readWorkbook } from './src/workbook.js';

const $ = id => document.getElementById(id);
const fmt = (n, digits = 2) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits }).format(n);
const dateLabel = date => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let workbook = null, current = null, generation = 0;
let vacations = [];
try {
  const saved = JSON.parse(localStorage.getItem('presenze-vacations') || '[]');
  vacationDates(saved); vacations = saved;
} catch {}
$('vacation-periods').innerHTML = [1,2,3,4].map(i => '<fieldset><legend>Periodo ' + i + (i > 1 ? ' (facoltativo)' : '') + '</legend><label>Dal<input id="vacation-start-' + i + '" type="date" min="2026-09-18" max="2027-09-17"></label><label>Al (incluso)<input id="vacation-end-' + i + '" type="date" min="2026-09-18" max="2027-09-17"></label></fieldset>').join('');
for (let i = 0; i < 4; i++) {
  $('vacation-start-' + (i + 1)).value = vacations[i]?.start || '';
  $('vacation-end-' + (i + 1)).value = vacations[i]?.end || '';
}
$('as-of').value = today();

function updateThemeControl() {
  const light = document.documentElement.dataset.theme === 'light';
  $('theme-toggle').textContent = light ? 'Tema scuro' : 'Tema chiaro';
  $('theme-toggle').setAttribute('aria-label', light ? 'Attiva tema scuro' : 'Attiva tema chiaro');
  $('theme-toggle').setAttribute('aria-pressed', String(light));
  document.querySelector('meta[name="theme-color"]').content = light ? '#f4f6f2' : '#101917';
}
$('theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('presenze-theme', theme); } catch {}
  updateThemeControl();
});
updateThemeControl();

const categories = [{ key: 'total', title: 'Totale ore rendicontabili' }, { key: 'specific', title: 'Formazione specifica' }, { key: 'general', title: 'Formazione generale' }];
const statusText = { above: 'Sopra il ritmo', below: 'Sotto il ritmo', equal: 'In pari' };
const shortStatus = { above: 'Sopra', below: 'Sotto', equal: 'In pari' };
const milestoneText = { met: 'Raggiunta entro il termine', missed: 'Scadenza non rispettata', pending: 'Termine ancora aperto' };

function message(text, error = false) {
  $('message').hidden = !text;
  $('message').textContent = text;
  $('message').className = error ? 'error' : 'sr-only';
  $('message').setAttribute('role', error ? 'alert' : 'status');
}

function card(category, result) {
  if (category.key === 'specific') return specificCard(result);
  const m = result.metrics[category.key];
  const delta = m.status === 'equal' ? '0' : (m.delta > 0 ? '+' : '−') + fmt(Math.abs(m.delta));
  const late = category.key === 'specific' && result.milestones.some(item => item.status === 'missed');
  return '<article class="metric ' + m.status + '" aria-label="' + category.title + '">' +
    '<div class="metric-header"><h3>' + category.title + '</h3><span class="status">' + shortStatus[m.status] + '</span></div>' +
    '<p class="difference" aria-label="Scostamento: ' + delta + ' ore"><span>' + delta + '</span><span class="unit">h</span></p>' +
    '<div class="comparison"><span>Reali<strong>' + fmt(m.actual) + ' h</strong></span><span>Attese<strong>' + fmt(m.expected) + ' h</strong></span></div>' +
    '<p class="metric-target">Obiettivo ' + fmt(m.goal,0) + ' h · ' + (m.completed ? 'raggiunto' : 'mancano ' + fmt(m.remaining) + ' h') + '</p>' +
    (late ? '<p class="late-warning">Una scadenza della specifica non è stata rispettata.</p>' : '') +
    '</article>';
}

function specificCard(result) {
  const tracks = result.specificComparisons.map(m => {
    const delta = m.status === 'equal' ? '0' : (m.delta > 0 ? '+' : '−') + fmt(Math.abs(m.delta));
    const label = m.key === 'first' ? 'Entro 90 giorni · 70%' : 'Entro il terzultimo mese · 100%';
    const deadlinePassed = $('as-of').value > m.date;
    const note = m.deadlineStatus === 'met' ? 'Scadenza rispettata' : m.deadlineStatus === 'missed'
      ? 'Scadenza non rispettata: mancavano ' + fmt(m.remaining) + ' h.'
      : 'Mancano ' + fmt(m.remaining) + ' h al traguardo' + (m.daysLeft ? ' · ' + m.daysLeft + ' giorni' : ' · scadenza oggi');
    return '<section class="specific-track ' + m.status + '" aria-label="' + label + '">' +
      '<div class="track-header"><h4>' + label + '</h4><span class="status">' + shortStatus[m.status] + '</span></div>' +
      '<p class="track-deadline">' + dateLabel(m.date) + ' · obiettivo ' + fmt(m.goal,0) + ' h</p>' +
      '<div class="track-values"><p class="difference" aria-label="Scostamento: ' + delta + ' ore"><span>' + delta + '</span><span class="unit">h</span></p>' +
      '<div class="comparison"><span>' + (deadlinePassed ? 'Entro il termine' : 'Reali') + '<strong>' + fmt(m.actual) + ' h</strong></span><span>Attese alla data<strong>' + fmt(m.expected) + ' h</strong></span></div></div>' +
      '<p class="track-note ' + (m.deadlineStatus === 'missed' ? 'missed-badge' : '') + '">' + note + '</p></section>';
  }).join('');
  return '<article class="metric specific-card" aria-label="Formazione specifica"><div class="metric-header"><h3>Formazione specifica</h3><span class="specific-total">' + fmt(result.sums.specific) + ' h registrate</span></div>' + tracks +
    '<p class="specific-explainer">Due ritmi distinti dall’avvio: 35 h entro 90 giorni e 50 h complessive entro il termine finale. Dopo una scadenza contano solo le ore svolte entro quel termine.</p></article>';
}

function render() {
  const asOf = $('as-of').value;
  if (!asOf || !$('as-of').checkValidity()) return;
  let result;
  try { result = summarize(workbook?.records ?? [], asOf, vacations); }
  catch (err) { message(err.message, true); return; }
  current = result;
  const active = !!workbook;
  $('results').hidden = !active;
  $('empty-state').hidden = active;
  $('download-guide').hidden = active;
  if (active) $('download-guide').open = false;
  $('dropzone').classList.toggle('loaded', active);
  $('upload-button-label').textContent = active ? 'Carica un altro Excel' : 'Carica Excel';
  $('metrics').innerHTML = active ? categories.map(c => card(c,result)).join('') : '';
  $('export').disabled = !active;
  $('clear').disabled = !active;
  $('data-state').textContent = active ? 'Al ' + dateLabel(asOf) : '';
  const t = result.time;
  $('vacation-summary').textContent = t.activeElapsed + ' giorni disponibili trascorsi su ' + t.activeDuration + '; ' + t.vacationElapsed + ' giorni di ferie già trascorsi.' +
    (t.unscheduledVacation ? ' ' + t.unscheduledVacation + ' giorni senza date, considerati ancora da fruire.' : ' Tutti i ' + VACATION_DAYS + ' giorni sono pianificati.');
  $('pace-note').textContent = t.unscheduledVacation
    ? 'Ritmo su 337 giorni. Stima: ' + t.unscheduledVacation + ' giorni di ferie ancora senza date.'
    : 'Ritmo su 337 giorni. Periodi di ferie tutti impostati.';
  if (!active) {
    $('months').innerHTML = '';
    $('month-totals').hidden = true;
    $('alerts').innerHTML = '';
    $('all-file').textContent = '';
    $('last-entry').textContent = '';
    $('file-status').textContent = '';
    return;
  }
  const warnings = [...workbook.warnings];
  if (result.vacationConflicts) warnings.push(result.vacationConflicts + ' giornate indicate come ferie contengono ore nell’Excel. Verifica i periodi; le ore del prospetto sono mantenute.');
  if (result.futureCount) warnings.push(result.futureCount + ' giornate con ore future rispetto al confronto: escluse dai riquadri e incluse solo in “tutto il file”.');
  if (result.lastEntry && result.lastEntry < asOf) warnings.push('Ultime ore registrate: ' + dateLabel(result.lastEntry) + '. Il confronto usa la data selezionata.');
  $('alerts').innerHTML = warnings.length ? '<div class="alert"><strong>Da tenere presente</strong><ul>' + warnings.map(w => '<li>' + escape(w) + '</li>').join('') + '</ul></div>' : '';
  $('months').innerHTML = result.months.map(m => {
    const name = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m.key + '-01T00:00:00Z'));
    const future = m.key > asOf.slice(0,7);
    return '<tr class="' + (future ? 'future-row' : '') + '"><td>' + escape(name.charAt(0).toUpperCase() + name.slice(1)) + '</td><td>' + fmt(m.service) + '</td><td>' + fmt(m.general) + '</td><td>' + fmt(m.specific) + '</td><td>' + fmt(m.total) + '</td><td>' + fmt(m.all) + '</td></tr>';
  }).join('');
  $('month-totals').hidden = false;
  $('month-totals').innerHTML = '<tr><td>Totale ore</td><td>' + fmt(result.sums.service) + '</td><td>' + fmt(result.sums.general) + '</td><td>' + fmt(result.sums.specific) + '</td><td>' + fmt(result.sums.total) + '</td><td>' + fmt(result.all.total) + '</td></tr>';
  $('last-entry').textContent = result.lastEntry ? 'Ultime ore entro il confronto: ' + dateLabel(result.lastEntry) : 'Nessuna ora entro la data scelta.';
  $('all-file').textContent = 'Tutto il file: ' + fmt(result.all.total) + ' h totali · ' + fmt(result.all.general) + ' h generale · ' + fmt(result.all.specific) + ' h specifica';
  $('file-status').textContent = workbook.name + ' · ' + workbook.recognized.length + ' fogli mensili';
}

async function load(file) {
  if (!file) return;
  const token = ++generation;
  if (!/\.xlsx$/i.test(file.name)) { $('pick-file').disabled = false; message('Scegli un file .xlsx. I formati .xls e .csv non sono supportati.',true); return; }
  if (file.size > 10*1024*1024) { $('pick-file').disabled = false; message('Il file supera 10 MB. Carica il prospetto presenze originale.',true); return; }
  message('Lettura dei fogli e verifica delle formule…');
  $('pick-file').disabled = true;
  try {
    const data = await readWorkbook(await file.arrayBuffer());
    if (token !== generation) return;
    workbook = { ...data, name:file.name };
    $('hours-details').open = false;
    $('pick-file').title = file.name;
    message('File letto. I tre riquadri mostrano la differenza tra ore reali e attese.');
    render();
  } catch (err) {
    if (token !== generation) return;
    const detail = /zip|central directory|end of data|encrypted/i.test(err.message) ? 'Il file non è un .xlsx valido oppure è protetto da password. Salvalo nuovamente come .xlsx senza password.' : err.message;
    message('Impossibile leggere il file. ' + detail + (workbook ? ' Restano visibili i risultati precedenti.' : ''),true);
  } finally {
    if (token === generation) $('pick-file').disabled = false;
    $('file').value = '';
  }
}

$('pick-file').addEventListener('click',() => $('file').click());
$('file').addEventListener('change',event => load(event.target.files[0]));
$('as-of').addEventListener('change',render);
$('today').addEventListener('click',() => { $('as-of').value = today(); render(); });
$('vacation-form').addEventListener('submit',event => {
  event.preventDefault();
  const ranges = [1,2,3,4].map(i => ({start:$('vacation-start-' + i).value,end:$('vacation-end-' + i).value})).filter(r => r.start || r.end);
  try { vacationDates(ranges); }
  catch(err) { $('vacation-error').textContent = err.message; $('vacation-error').hidden = false; return; }
  vacations = ranges;
  try { localStorage.setItem('presenze-vacations',JSON.stringify(vacations)); } catch {}
  $('vacation-error').hidden = true; render();
});
$('reset-vacations').addEventListener('click',() => {
  vacations = [];
  for(const i of [1,2,3,4]) { $('vacation-start-' + i).value = ''; $('vacation-end-' + i).value = ''; }
  try { localStorage.removeItem('presenze-vacations'); } catch {}
  $('vacation-error').hidden = true; render();
});
for(const name of ['dragenter','dragover']) $('dropzone').addEventListener(name,event => { event.preventDefault(); $('dropzone').classList.add('dragging'); });
$('dropzone').addEventListener('dragleave',event => { if (!$('dropzone').contains(event.relatedTarget)) $('dropzone').classList.remove('dragging'); });
$('dropzone').addEventListener('drop',event => { event.preventDefault(); $('dropzone').classList.remove('dragging'); if (event.dataTransfer.files.length !== 1) { message('Carica un solo prospetto alla volta.',true); return; } load(event.dataTransfer.files[0]); });
window.addEventListener('dragover',event => event.preventDefault());
window.addEventListener('drop',event => event.preventDefault());
document.addEventListener('click',event => { if (!$('download-guide').contains(event.target)) $('download-guide').open = false; });
document.addEventListener('keydown',event => { if (event.key === 'Escape') $('download-guide').open = false; });

$('clear').addEventListener('click',() => {
  generation++; workbook = null;
  $('hours-details').open = false;
  $('pick-file').disabled = false;
  $('pick-file').removeAttribute('title');
  message('Dati rimossi dalla pagina.'); render();
});

$('export').addEventListener('click',() => {
  if (!workbook || !current) return;
  const number = n => String(Math.round(n*100)/100).replace('.',',');
  const rows = [['Riepilogo servizio civile','Dati del file caricato'],['Data confronto',$('as-of').value],['Periodo','18/09/2026 - 17/09/2027'],[],['Categoria','Ore alla data','Obiettivo','Attese alla data','Scostamento','Stato']];
  for(const c of categories) {
    if(c.key === 'specific') {
      for(const m of current.specificComparisons) rows.push(['Specifica · ' + (m.key === 'first' ? '90 giorni' : 'termine finale') + ' · ' + m.date,number(m.actual),number(m.goal),number(m.expected),number(m.delta),statusText[m.status]]);
    } else { const m=current.metrics[c.key]; rows.push([c.title,number(m.actual),number(m.goal),number(m.expected),number(m.delta),statusText[m.status]]); }
  }
  rows.push([],['Mese','Servizio alla data','Generale alla data','Specifica alla data','Rendicontabili alla data','Rendicontabili tutto il file']);
  for(const m of current.months) rows.push([m.key,number(m.service),number(m.general),number(m.specific),number(m.total),number(m.all)]);
  rows.push(['TOTALE',number(current.sums.service),number(current.sums.general),number(current.sums.specific),number(current.sums.total),number(current.all.total)]);
  rows.push([],['Metodo totale e generale','337 giorni disponibili: 365 meno 28 di ferie (4 settimane). Formazione già inclusa nel totale.'],['Giorni disponibili trascorsi',current.time.activeElapsed],['Giorni di ferie trascorsi',current.time.vacationElapsed],['Giorni di ferie non pianificati (assunti futuri)',current.time.unscheduledVacation]);
  for(const period of vacations) rows.push(['Periodo ferie',period.start,period.end]);
  rows.push([],['Specifica: traguardo','Scadenza inclusa','Ore entro termine e data confronto','Ore mancanti al termine','Esito']);
  for(const m of current.milestones) rows.push([m.goal + ' h cumulative',m.date,number(m.actual),number(m.remaining),milestoneText[m.status]]);
  if(current.vacationConflicts) rows.push(['Avviso',current.vacationConflicts + ' giornate di ferie con ore nel file: verificare.']);
  for(const warning of workbook.warnings) rows.push(['Avviso',warning]);
  if(current.futureCount) rows.push(['Avviso',current.futureCount + ' giornate con ore future escluse dai totali alla data.']);
  if(current.lastEntry) rows.push(['Ultime ore entro il confronto',current.lastEntry]);
  const csvCell = value => {
    let text=String(value);
    if(/^[=+@\-\t\r]/.test(text) && !/^-?\d+(?:,\d+)?$/.test(text)) text="'" + text;
    return '"' + text.replace(/"/g,'""') + '"';
  };
  const csv='\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url; a.download='riepilogo-servizio-civile-' + $('as-of').value + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
});
render();

