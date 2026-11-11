# Ore Servizio Civile — Presenze

Sito statico in italiano, pronto per GitHub Pages. Carica il prospetto `.xlsx` e confronta le ore registrate con un ritmo uniforme nel periodo **18 settembre 2026 – 17 settembre 2027**.

Quante ore mi mancano da fare? Il sito risponde leggendo il prospetto aggiornato, con elaborazione locale nel browser.

## Funzioni

- Lettura di tutti i fogli mensili del modello presenze.
- Totale rendicontabile, formazione generale e formazione specifica.
- Confronto alla data odierna, o a una data scelta, con stato sopra / sotto / in pari.
- Ore mancanti agli obiettivi annuali di **1.145 / 30 / 50** ore.
- Dettaglio mensile, servizio effettivo e riepilogo CSV.
- Esclusione delle ore future dal confronto e visualizzazione separata dei totali dell'intero file.
- Segnalazione di date duplicate, dati non validi, mesi mancanti e differenze nei totali.
- Interfaccia adattabile a telefono e computer.

Il file è elaborato nel browser e non viene inviato a server. Non viene conservato tra un caricamento della pagina e l'altro. La libreria ZIP è inclusa nel progetto: non sono richieste CDN, chiavi API, account dei visitatori o servizi esterni per leggere il file.

## Pubblicare su GitHub Pages

1. Crea un repository GitHub, per esempio `ore-servizio-civile`.
2. Estrai lo ZIP. Carica **il contenuto** della cartella `servizio-civile` nella radice del repository, mantenendo le sottocartelle. `index.html` deve trovarsi direttamente nella radice, insieme a `app.js`, `styles.css`, `src/` e `vendor/`. Carica anche `.nojekyll`.
3. Nel repository apri **Settings → Pages**.
4. In **Build and deployment → Source** scegli **Deploy from a branch**.
5. Seleziona il ramo **main** e la cartella **/(root)**, poi **Save**.
6. Quando GitHub completa la pubblicazione, apri l'indirizzo mostrato nella stessa pagina. Ogni modifica salvata sul ramo di pubblicazione aggiornerà il sito.

Non serve eseguire `npm install` né un comando di build per pubblicare. Non caricare il prospetto Excel nel repository: gli utenti lo selezionano direttamente dal sito. Il file `.gitignore` esclude gli Excel dai normali commit Git.

Fonte: [documentazione ufficiale GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Formato Excel supportato

Il modello fornito dall'utente, con:

- fogli mensili con date Excel numeriche in colonna A;
- intestazioni `N° ORE SERVIZIO`, `N° ORE FORMAZIONE GENERALE`, `N° ORE FORMAZIONE SPECIFICA`, `TOT ORE RENDICONTABILI`;
- riga `TOTALI DA RIPORTARE SU FORM ON LINE`;
- massimo 10 MB per file e 80 MB decompressi.

Il foglio `RIEPILOGO` è escluso dalla somma. Anche le righe dei totali mensili sono escluse dalla somma e usate soltanto per controllare che i valori coincidano con il dettaglio giornaliero. I fogli mensili vengono individuati dalle intestazioni, senza dipendere dal nome del foglio.

Vengono ricalcolate le formule delle colonne rilevanti, comprese quelle condivise di Excel: riferimenti locali con o senza `$`, `SUM`/`SOMMA` di intervalli, parentesi e operazioni `+ - * /`. Le formule diverse sono segnalate esplicitamente: non si utilizzano silenziosamente risultati salvati obsoleti. Il sito non è un motore di calcolo Excel universale.

**Le ore rendicontabili comprendono già la formazione.** Non viene aggiunta una seconda volta. Le assenze sono conteggiate secondo le formule del file: nel modello ricevuto la colonna dei permessi ordinari non entra nelle ore rendicontabili. Il sito non modifica questa regola. Il conteggio dei permessi residui non è incluso in questa versione.

## Metodo di confronto

Il servizio dura **365 giorni**, inclusi entrambi gli estremi. Il giorno selezionato è incluso:

`obiettivo alla data = obiettivo annuale × giorni trascorsi / 365`

`scostamento = ore registrate entro la data − obiettivo alla data`

Lo stato segue lo scostamento arrotondato al centesimo di ora. La ripartizione uniforme è una scelta per monitorare l'andamento, non una scadenza normativa per la formazione. Se i corsi seguono un calendario specifico, occorre adattare il criterio di confronto.

I dati fuori dal periodo di servizio sono esclusi. Eventuali giornate future rispetto alla data del confronto restano visibili soltanto nei totali dell'intero file. I giorni non presenti o non compilati non contribuiscono ai conteggi. La data di oggi segue il fuso `Europe/Rome`.

## Verifica del modello

Sul prospetto di riferimento sono stati riconosciuti 13 fogli mensili e 365 date del periodo, senza differenze tra somme giornaliere e totali mensili. Il file personale originale non è incluso nel repository. Il sito parte senza dati e legge ogni nuovo file caricato. Il pulsante di esempio usa dati fittizi.

## Sviluppo e controlli

Per un'anteprima locale, dalla cartella del progetto:

```sh
python3 -m http.server 8000
```

Apri `http://localhost:8000`. Per il caricamento dei moduli JavaScript il sito va servito via HTTP o HTTPS, anziché aprire `index.html` con un doppio clic.

Per eseguire i controlli automatici con Node.js e npm installati:

```sh
npm install
npm test
```

Per aggiungere il controllo sul prospetto originale, non incluso nel repository:

```sh
npm test -- "/percorso/del/prospetto.xlsx"
```

Il controllo opzionale sul file originale si aspetta gli importi del prospetto di riferimento iniziale ed è utile per la prima versione, non per un prospetto successivamente aggiornato.

Sono verificati calendario inclusivo e limiti, date future, tre stati di confronto, soglie annuali, formule condivise, ricalcolo di cache obsolete, somme, duplicati, assenze, dati non numerici e importazione `.xlsx`. Sul file ricevuto sono passati tutti i 9 gruppi di controlli. Controllo della sintassi JavaScript completato. L'anteprima browser dell'ambiente di sviluppo non era disponibile: resa visiva e interazioni nel browser restano da verificare sul sito servito.

## Dipendenze e licenze

`vendor/jszip.min.js` include JSZip 3.10.1, distribuito secondo le licenze MIT o GPLv3. Il progetto usa l'opzione MIT; il testo completo è in `vendor/JSZip-LICENSE.md`. Le dipendenze npm sono richieste soltanto per i test; il sito usa i file locali inclusi.
