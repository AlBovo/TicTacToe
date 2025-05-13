import express from 'express';
import session from 'express-session';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const app = express();

const SERVER_PORT = process.env.PORT || 8080;
const MONGO_USER = process.env.MONGO_INITDB_ROOT_USERNAME || "administrator";
const MONGO_PASS = process.env.MONGO_INITDB_ROOT_PASSWORD || "password";
const MONGO_HOST = process.env.MONGO_HOST || "mongodb";
const MONGO_DB = process.env.MONGO_INITDB_DATABASE || "tictactoe";
const MONGO_URI = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}:27017/`;

const client = new MongoClient(MONGO_URI);

app.use(express.static('./assets/'));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        sameSite: true,
        httpOnly: true,
        maxAge: 1000*60*60
    }
}));

async function getDB(collection) {
    await client.connect();
    return client.db(MONGO_DB).collection(collection);
}

async function giocando(uid) {
    const partite = await getDB('partite');
    const r = await partite.find({ status: "giocando", giocatori: { $in: [uid]} }).toArray();
    return r.length > 0;
}

function statoPartita(mosse, player) {
    let mossePlayer = mosse.filter((_, i) => (i % 2 === player));
    mossePlayer.push(nuova);

    const winningCombinations = [
        // Rows
        [{rowX: 0, rowY: 0}, {rowX: 1, rowY: 0}, {rowX: 2, rowY: 0}],
        [{rowX: 0, rowY: 1}, {rowX: 1, rowY: 1}, {rowX: 2, rowY: 1}],
        [{rowX: 0, rowY: 2}, {rowX: 1, rowY: 2}, {rowX: 2, rowY: 2}],
        // Columns
        [{rowX: 0, rowY: 0}, {rowX: 0, rowY: 1}, {rowX: 0, rowY: 2}],
        [{rowX: 1, rowY: 0}, {rowX: 1, rowY: 1}, {rowX: 1, rowY: 2}],
        [{rowX: 2, rowY: 0}, {rowX: 2, rowY: 1}, {rowX: 2, rowY: 2}],
        // Diagonals
        [{rowX: 0, rowY: 0}, {rowX: 1, rowY: 1}, {rowX: 2, rowY: 2}],
        [{rowX: 2, rowY: 0}, {rowX: 1, rowY: 1}, {rowX: 0, rowY: 2}]
    ];

    return winningCombinations.some(combination =>
        combination.every(pos =>
          cells.some(cell => cell.rowX === pos.rowX && cell.rowY === pos.rowY)
        )
    );
}

function trovaGiocatore(giocatori, player) {
    return giocatori.findIndex(p => p === player);
}

app.get('/', (req, res) => {
    if (req.session.userid) {
        return res.render('tris');
    }
    res.redirect('/login');
});

app.get('/chiedi-partita', async (req, res) => {
    const partite = await getDB('partite');
    const userid = req.session.userid;

    if (!userid || typeof userid !== "string") {
        return res.redirect('/login');
    }
    if (await giocando(userid)) {
        return res.redirect('/');
    }

    const partita = await partite.find({ status: "aspettando" }).toArray();
    if (partita.length === 0) { // crea una nuova partita
        const partitaid = uuidv4();
        await partite.insertOne({ giocatori: [userid], partita: partitaid, mosse: [], status: "aspettando" });
        req.session.partita = partitaid;
        return res.end(`<${partitaid}, 0>`);
    }

    const p = partita[0];
    await partite.updateOne({ partita: p.partita }, { $set: { giocatori: [...p.giocatori, userid], status: "giocando" } });
    req.session.partita = p.partita;
    res.end(`<${p.partita}, 1>`);
});

app.get('/muovi/:id_partita', async (req, res) => {
    const partite = await getDB('partite');
    const userId = req.session.userId;
    const partitaId = req.params.id_partita;

    if (!userId || typeof userId !== "string") {
        return res.redirect('/login');
    }
    if (!partitaId || typeof partitaId !== "string") {
        return res.redirect('/chiedi-partita');
    }
    
    const partita = partite.findOne({ partita: partitaId});
    if (partita) return res.end('<err, 0>'); // id partita sconosciuto
    
    const giocatori = partita.giocatori;
    const giocatoreCorrente = giocatori[mosseCorrenti.length % 2];
    if (giocatoreCorrente !== userId) {
        return res.end('<err, 2>'); // non era il tuo turno
    }

    const giocatorePar = trovaGiocatore(partita.giocatori, userId);
    if (statoPartita(partita.mosse, giocatorePar)) {
        return res.end('<ok, 1>'); // partita già finita, vinta
    }
    if (statoPartita(partita.mosse, !giocatorePar)) {
        return res.end('<ok, 2>'); // partita già finita, persa
    }
    if (partita.mosse.length === 9) {
        return res.end('<ok, 3>'); // partita già finita, patta
    }

    const posX = parseInt(req.query.row);
    const posY = parseInt(req.query.col);
    
    if (isNaN(posX) || isNaN(posY)) return res.end('Riga o Colonna non inserita');
    if (posX < 1 || posY < 1 || posX > 3 || posY > 3) return res.end('Riga o colonna non validi');

    let mosseCorrenti = partita.mosse;
    if (mosseCorrenti.find(m => m.row == posX && m.col == posY)) {
        return res.end('<err, 1>'); // riga/colonna già utilizzati
    }
    
    mosseCorrenti.push({ row: posX, col: posY });
    partite.updateOne({ partita: partita.partita }, { $set: { mosse: mosseCorrenti }});
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

    res.end('<ok, 0>');
});

app.get('/chiedi-mossa/:id_partita', async (req, res) => {
    const partite = await getDB('partite');
    const userId = req.session.userId;
    const partitaId = req.params.id_partita;

    if (!userId || typeof userId !== "string") {
        return res.redirect('/login');
    }
    if (!partitaId || typeof partitaId !== "string") {
        return res.redirect('/chiedi-partita');
    }

    const partita = partite.findOne({ partita: partitaId });
    if (partita) return res.end('<err, 0>'); // id partita sconosciuto

    const giocatoreID = partita.mosse.length % 2;
    const giocatoreCorrente = partita.giocatori[giocatoreID];

    const giocatorePar = trovaGiocatore(partita.giocatori, userId);
    if (statoPartita(partita.mosse, giocatorePar)) {
        return res.end('<ok, 1>'); // partita già finita, vinta
    }
    if (statoPartita(partita.mosse, !giocatorePar)) {
        return res.end('<ok, 2>'); // partita già finita, persa
    }
    if (partita.mosse.length === 9) {
        return res.end('<ok, 3>'); // partita già finita, patta
    }

    if(partita.mosse.length === 0 || (partita.mosse.length === 1 && giocatoreCorrente !== userId)) {
        return res.end('<err, 0>'); // no mosse da mostrare
    }

    const mossa = partita.mosse[(giocatoreCorrente === userId) ? partita.mosse.length-1 : partita.mosse.length];
    return res.end(`<${mossa.rowX}, ${mossa.rowY}, 0>`);
    // la risposta conterrà <row, col, codice_ok> oppure <err, codice_errore>
    //      row, col = valori 1..3 della casella mossa dall'avversario
    //      codice_ok può essere:
    //              0 == la partita prosegue
    //              1 == partita finita con vittoria tua (questo è in realtà escluso quando muove l'avversario)
    //              2 == partita finita con vittoria dell'avversario
    //              3 == partita finita con patta
});

app.get('/login', (req, res) => {
    if (req.session.userid) {
        return res.redirect('/');
    }
    res.render('login');
});

app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    if (!username || !password) {
        return res.end('dati mancanti');
    }

    const utenti = await getDB('utenti');
    // TODO: hash password
    const u = await utenti.findOne({ username, password });
    if (!u) {
        return res.end('utente non trovato');
    }

    req.session.userid = u.userid;
    res.redirect('/');
});

app.get('/register', (req, res) => {
    if (req.session.userid) {
        return res.redirect('/');
    }
    res.render('register');
});

app.post('/register', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    if (!username || !password) {
        return res.end('dati mancanti');
    }

    const utenti = await getDB('utenti');
    if (await utenti.findOne({ username })) {
        return res.end('utente esistente');
    }

    await utenti.insertOne({ username, password, userid: uuidv4() });
    res.redirect('/login');
});

app.listen(SERVER_PORT, () => {
    console.log(`Server in ascolto su porta ${SERVER_PORT}`);
});