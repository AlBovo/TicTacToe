const SERVER_PORT = 8080;

const express = require('express');
const app = express();

app.use(express.static('./assets'));  // serve la soot-directory 'assets' come web-server di fails statici

app.get('/', (req, resp) => {
    resp.redirect('/tris.html')
});

app.get('/chiedi-partita', (req, resp) => {
    console.log(`Ricevuta richiesta GET per /chiedi-partita da ${resp.socket.remoteAddress} con id_partita = ${req.params.id_partita} e query_string = ${JSON.stringify(req.query)}`);
    // Se c'è un altro richiedente in attesa  -> accoppia i due giocatori
    //                             altrimenti -> la richiesta corrente resta in attesa

    // la risposta conterrà <id_partita_player0, 0> per il giocatore che ha la mossa iniziale e <id_partita_player1, 1> per quello che attenderà la prima mossa
    //      si avrà che (id_partita_player0 != id_partita_player1)
});

app.get('/muovi/:id_partita', (req, resp) => {
    console.log(`Ricevuta richiesta GET per /muovi da ${resp.socket.remoteAddress} con id_partita = ${req.params.id_partita} e query_string = ${JSON.stringify(req.query)}`);
    // qui req.query.row == riga 1..3 della mossa
    //     req.query.col == colonna 1..3 della mossa

    // la risposta conterrà <ok, codice_ok> oppure <err, codice_errore>
    //      codice_ok può essere:
    //              0 == la partita prosegue
    //              1 == partita finita con vittoria tua
    //              2 == partita finita con vittoria dell'avversario  (questo è in realtà escluso quando muove il giocatore corrente)
    //              3 == partita finita con patta
    //      codice_errore può essere:
    //              0 == id_partita sconosciuto
    //              1 == riga/colonna già utilizzati (la partita va a monte)
    //              2 == non era il tuo turno (la partita va a monte)

    resp.end('<ok, 0>');
});

app.get('/chiedi-mossa/:id_partita', (req, resp) => {
    console.log(`Ricevuta richiesta GET per /chiedi-mossa da ${resp.socket.remoteAddress} con id_partita = ${req.params.id_partita} e query_string = ${JSON.stringify(req.query)}`);

    // la risposta conterrà <row, col, codice_ok> oppure <err, codice_errore>
    //      row, col = valori 1..3 della casella mossa dall'avversario
    //      codice_ok può essere:
    //              0 == la partita prosegue
    //              1 == partita finita con vittoria tua (questo è in realtà escluso quando muove l'avversario)
    //              2 == partita finita con vittoria dell'avversario
    //              3 == partita finita con patta
});

app.post('/login', (req, resp) => {
    console.log(`Ricevuta richiesta POST per /login da ${resp.socket.remoteAddress}`);

    // TODO : wishful thinking
});

/* .... */

app.listen(SERVER_PORT, () => {
    console.log(`Server in ascolto su porta ${SERVER_PORT}`);
});