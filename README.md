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
- Interfaccia compatta per telefono e computer: scostamento in grande, ore reali e attese subito sotto.
- Guida per scaricare l’Excel dalla cartella condivisa, con immagine del menu Download; scompare dopo un caricamento valido.
- Tabella mensile e CSV apribili dal pulsante Dettagli ore.
- Riquadri verdi, rossi o ambra per sopra, sotto o in pari con le ore.
- Tema scuro predefinito, con selettore chiaro/scuro e preferenza ricordata.
- Quattro settimane di ferie obbligatorie escluse dal ritmo annuale: 337 giorni disponibili.
- Inserimento di fino a quattro periodi di ferie, per sospendere il ritmo nei giorni indicati.
- Riquadri ordinati come totale, formazione specifica, formazione generale.
- Formazione specifica con due confronti e scadenze visibili direttamente nel riquadro, compresa la verifica storica dei termini.

Il file è elaborato nel browser e non viene inviato a server. Non viene conservato tra un caricamento della pagina e l'altro. Tema e periodi di ferie sono ricordati tramite localStorage su questo dispositivo. Se il salvataggio locale è disabilitato, il sito continua a funzionare durante la sessione. La libreria ZIP è inclusa nel progetto: non sono richieste CDN, chiavi API, account dei visitatori o servizi esterni per leggere il file.

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

Il servizio dura **365 giorni**, inclusi entrambi gli estremi. Le quattro settimane di ferie sono interpretate come **28 giorni di calendario**, per un totale di **337 giorni disponibili**. Gli obiettivi annuali non diminuiscono. Per totale rendicontabile e formazione generale:

`giorni disponibili trascorsi = giorni di calendario trascorsi − giorni di ferie già trascorsi`

`obiettivo alla data = obiettivo annuale × giorni disponibili trascorsi / 337`

Il rapporto è limitato tra 0 e 1. I periodi sono inclusivi, possono essere fino a quattro, non devono sovrapporsi e non possono superare 28 giorni complessivi. I giorni di ferie non assegnati sono considerati ancora da fruire: questa assunzione viene mostrata come stima. Le ferie non attribuiscono ore. Le ore effettive rimangono quelle lette dall'Excel; se compaiono ore in giornate indicate come ferie, viene mostrato un avviso per verificare i periodi.

La **formazione specifica** segue un ritmo diverso:

| Traguardo cumulativo | Termine incluso | Convenzione |
| --- | --- | --- |
| 35 ore (70% di 50) | 16 dicembre 2026 | 90º giorno, contando il 18 settembre come giorno 1 |
| 50 ore (35 + 15) | 17 luglio 2027 | Ultimo giorno del 10º mese, terzultimo mese del progetto |

Il riquadro della specifica mostra due ritmi indipendenti, entrambi a partire dal 18 settembre: 35 ore ripartite sui primi 90 giorni e 50 ore ripartite sui 303 giorni fino al 17 luglio. Ciascun riquadro mostra scostamento, ore reali e attese alla data, obiettivo, data limite e ore mancanti. Dopo un termine, il relativo confronto usa solo le ore datate entro quella scadenza e l’atteso resta fissato al suo obiettivo. I due obiettivi sono cumulativi: non si sommano 35 e 50. Le ferie non spostano i termini. Il decimo mese va dal 18 giugno al 17 luglio 2027: si usano mesi di progetto, non mesi del calendario.

La verifica di ciascuna scadenza somma le ore di specifica datate entro il relativo termine e non successive alla data del confronto. Gli esiti sono "termine ancora aperto", "raggiunta entro il termine" e "scadenza non rispettata". Nel giorno della scadenza il termine è ancora aperto. Le ore svolte in anticipo sono valide; eventuali recuperi tardivi non cancellano il mancato rispetto del termine precedente. Una scadenza può quindi risultare non rispettata anche con 50 ore complessive raggiunte successivamente.

`scostamento = ore registrate entro la data − obiettivo alla data`

Lo stato sopra / sotto / in pari segue lo scostamento arrotondato al centesimo di ora. La curva di ritmo è uno strumento indicativo per monitorare l'andamento; i vincoli temporali della specifica sono verificati separatamente. Le regole applicate sono quelle richieste per questo progetto, con le convenzioni sulle date esplicitate sopra.

I dati fuori dal periodo di servizio sono esclusi. Eventuali giornate future rispetto alla data del confronto restano visibili soltanto nei totali dell'intero file. I giorni non presenti o non compilati non contribuiscono ai conteggi. La data di oggi segue il fuso `Europe/Rome`.

## Verifica del modello

Sul prospetto di riferimento sono stati riconosciuti 13 fogli mensili e 365 date del periodo, senza differenze tra somme giornaliere e totali mensili. Il file personale originale non è incluso nel repository. Il sito parte senza dati e legge ogni nuovo file caricato.

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

Sono verificati calendario inclusivo e limiti, ferie trascorse, denominatore 337, periodi sovrapposti o non validi, andamento della specifica, inclusione dei giorni limite, recuperi tardivi, ore in anticipo, date future, tre stati di confronto, soglie annuali, formule condivise, ricalcolo di cache obsolete, somme, duplicati, assenze, dati non numerici e importazione `.xlsx`. Sul file di riferimento sono passati tutti i 15 gruppi di controlli. Controllo della sintassi JavaScript completato.

Sul sito pubblicato sono stati verificati anche caricamento del prospetto originale nel browser, correttezza dei risultati, selettore dei temi, rifiuto di un periodo di ferie di 29 giorni, applicazione di 28 giorni di ferie e segnalazione di una scadenza passata non rispettata.

Per controllare manualmente il layout mobile, apri `tests/responsive.html` sul sito servito. La pagina di verifica usa un iframe con viewport a scelta di 320, 375, 390, 430 o 768 pixel; permette di provare guida, caricamento e tabella senza modificare lo zoom del browser.

## Dipendenze e licenze

`vendor/jszip.min.js` include JSZip 3.10.1, distribuito secondo le licenze MIT o GPLv3. Il progetto usa l'opzione MIT; il testo completo è in `vendor/JSZip-LICENSE.md`. Le dipendenze npm sono richieste soltanto per i test; il sito usa i file locali inclusi.
