/****************************************************************************************************
* 13/05/2025 4H Alan Davide Bovo, Mattia Cincotta, Giulia Cocka, Matteo Angiolillo, Antonio De Rosa *
*               Progetto TicTacToe basato su sito scritto con node.js e bootstrap                   *
****************************************************************************************************/
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

// Creo un'applicazione Express
const app = express();

// Configurazione delle variabili di ambiente e costanti di default
const SERVER_PORT = process.env.PORT || 8080;
const MONGO_USER = process.env.MONGO_INITDB_ROOT_USERNAME || "administrator";
const MONGO_PASS = process.env.MONGO_INITDB_ROOT_PASSWORD || "password";
const MONGO_HOST = process.env.MONGO_HOST || "mongodb";
const MONGO_DB = process.env.MONGO_INITDB_DATABASE || "tictactoe";
const SECRET = process.env.SECRET || "secret";
// URI di connessione a MongoDB con autenticazione
const MONGO_URI = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}:27017/`;

// Client MongoDB
const client = new MongoClient(MONGO_URI);

// Middlewares per Express
app.use(express.static('./assets/')); // servire file statici dalla cartella assets
app.set('view engine', 'ejs');       // motore di template EJS
app.use(express.urlencoded({ extended: true })); // parsing form URL-encoded

// Configurazione della sessione utente
app.use(session({
    secret: SECRET, // chiave segreta per firmare il cookie
    resave: false,                          // non salvare la sessione se non modificata
    saveUninitialized: false,               // non salvare sessioni non inizializzate
    store: MongoStore.create({
        mongoUrl: MONGO_URI,
        autoRemove: 'native',
        collectionName: 'sessions',
        ttl: 2 * 60 * 60, // 2 hours
        crypto: {
            secret: SECRET,
        },
    }),
    cookie: {
        sameSite: true,
        httpOnly: true,                     // cookie non accessibile via JavaScript lato client
        maxAge: 1000 * 60 * 60              // durata di 1 ora
    }
}));

// Funzione per ottenere la collection dal DB
async function getDB(collection) {
    await client.connect();                  // connettersi al server MongoDB (singleton)
    return client.db(MONGO_DB).collection(collection);
}

// Verifica se l'utente ha già una partita in corso
async function giocando(uid) {
    const partite = await getDB('partite');
    const r = await partite.find({ status: "giocando", giocatori: { $in: [uid] } }).toArray();
    return r.length > 0;                   // true se almeno una partita attiva
}

// Controlla lo stato di vittoria di un giocatore
function statoPartita(mosse, player) {
    // filtra mosse del dato player (0 o 1) in base all'indice
    let mossePlayer = mosse.filter((_, i) => (i % 2 === player));

    const winningCombinations = [
        // righe
        [{row: 1, col: 1}, {row: 2, col: 1}, {row: 3, col: 1}],
        [{row: 1, col: 2}, {row: 2, col: 2}, {row: 3, col: 2}],
        [{row: 1, col: 3}, {row: 2, col: 3}, {row: 3, col: 3}],
        // colonne
        [{row: 1, col: 1}, {row: 1, col: 2}, {row: 1, col: 3}],
        [{row: 2, col: 1}, {row: 2, col: 2}, {row: 2, col: 3}],
        [{row: 3, col: 1}, {row: 3, col: 2}, {row: 3, col: 3}],
        // diagonali
        [{row: 1, col: 1}, {row: 2, col: 2}, {row: 3, col: 3}],
        [{row: 3, col: 1}, {row: 2, col: 2}, {row: 1, col: 3}]
    ];

    // controlla se esiste una combinazione vincente
    return winningCombinations.some(combination =>
        combination.every(pos =>
          mossePlayer.some(cell => cell.row === pos.row && cell.col === pos.col)
        )
    );
}

// Trova l'indice del giocatore nella lista
function trovaGiocatore(giocatori, player) {
    return giocatori.findIndex(p => p === player);
}

// Route principale: se loggato mostra il gioco, altrimenti redirect a login
app.get('/', (req, res) => {
    if (req.session.userid) {
        return res.render('tris');
    }
    res.redirect('/login');
});

// Richiesta per unire o creare una partita
app.get('/chiedi-partita', async (req, res) => {
    const partite = await getDB('partite');
    const userid = req.session.userid;

    // se non loggato reindirizza
    if (!userid || typeof userid !== "string") {
        return res.redirect('/login');
    }
    // se già in partita
    if (await giocando(userid)) {
        return res.redirect('/');
    }

    const partita = await partite.find({ status: "aspettando" }).toArray();
    if (partita.length === 0) { // nessuna in attesa: crea nuova
        const partitaid = uuidv4();
        await partite.insertOne({ giocatori: [userid], partita: partitaid, mosse: [], status: "aspettando" });
        req.session.partita = partitaid;
        return res.end(`<${partitaid}, 0>`); // 0 = in attesa
    }

    // unisci alla prima partita in attesa
    const p = partita[0];
    await partite.updateOne({ partita: p.partita }, { $set: { giocatori: [...p.giocatori, userid], status: "giocando" } });
    req.session.partita = p.partita;
    res.end(`<${p.partita}, 1>`); // 1 = partita iniziata
});

// Route per effettuare una mossa
app.get('/muovi/:id_partita', async (req, res) => {
    const partite = await getDB('partite');
    const userId = req.session.userid;
    const partitaId = req.params.id_partita;

    // validazioni base
    if (!userId || typeof userId !== "string") return res.redirect('/login');
    if (!partitaId || typeof partitaId !== "string") return res.redirect('/chiedi-partita');

    const partita = await partite.findOne({ partita: partitaId });
    if (!partita) return res.end('<err, 0>'); // partita non trovata

    let mosseCorrenti = partita.mosse;
    const giocatori = partita.giocatori;
    const currentTurn = mosseCorrenti.length % 2;
    // verifica turno giocatore
    if (giocatori[currentTurn] !== userId) {
        return res.end('<err, 2>'); // non tuo turno
    }
    // calcola indice del giocatore
    const idxPlayer = trovaGiocatore(giocatori, userId);

    // controlla stato vittoria o patta
    if (statoPartita(mosseCorrenti, idxPlayer)) {
        await partite.updateOne({ partita: partitaId }, { $set: { status: "finita" } });
        return res.end('<ok, 1>');
    }
    if (statoPartita(mosseCorrenti, 1 - idxPlayer)) {
        await partite.updateOne({ partita: partitaId }, { $set: { status: "finita" } });
        return res.end('<ok, 2>');
    }
    if (mosseCorrenti.length === 9) {
        await partite.updateOne({ partita: partitaId }, { $set: { status: "finita" } });
        return res.end('<ok, 3>');
    }

    // parse parametri mossa
    const posX = parseInt(req.query.row);
    const posY = parseInt(req.query.col);
    if (isNaN(posX) || isNaN(posY)) return res.end('Riga o Colonna non inserita');
    if (posX < 1 || posY < 1 || posX > 3 || posY > 3) return res.end('Riga o colonna non validi');

    // verifica casella libera
    if (mosseCorrenti.find(m => m.row === posX && m.col === posY)) {
        return res.end('<err, 1>'); // già occupata
    }

    // aggiungi mossa e aggiorna DB
    mosseCorrenti.push({ row: posX, col: posY });
    await partite.updateOne({ partita: partitaId }, { $set: { mosse: mosseCorrenti } });

    // controlla stato vittoria o patta
    if (statoPartita(mosseCorrenti, idxPlayer)) {
        await partite.updateOne({ partita: partitaId }, { $set: { status: "finita" } });
        return res.end('<ok, 1>');
    }
    if (statoPartita(mosseCorrenti, 1 - idxPlayer)) {
        await partite.updateOne({ partita: partitaId }, { $set: { status: "finita" } });
        return res.end('<ok, 2>');
    }
    if (mosseCorrenti.length === 9) {
        await partite.updateOne({ partita: partitaId }, { $set: { status: "finita" } });
        return res.end('<ok, 3>');
    }

    res.end('<ok, 0>'); // mossa accettata
});

// Route per controllare mossa avversario
app.get('/chiedi-mossa/:id_partita', async (req, res) => {
    const partite = await getDB('partite');
    const userId = req.session.userid;
    const partitaId = req.params.id_partita;

    if (!userId || typeof userId !== "string") return res.redirect('/login');
    if (!partitaId || typeof partitaId !== "string") return res.redirect('/chiedi-partita');

    const partita = await partite.findOne({ partita: partitaId });
    if (!partita) return res.end('<err, 0>');

    const mosse = partita.mosse;
    // calcola chi deve muovere
    const idxNext = mosse.length % 2;
    const playerNext = partita.giocatori[idxNext];
    const idxUser = trovaGiocatore(partita.giocatori, userId);

    let code = 0
    // verifica stato partita
    if (statoPartita(mosse, idxUser))       { code = 1; }
    if (statoPartita(mosse, 1 - idxUser))   { code = 2; }
    if (mosse.length === 9)                 { code = 3; }

    if (playerNext !== userId) {
        return res.end('<err, 0>'); // non è il turno dell'utente
    }

    // nessuna mossa nuova da mostrare
    if (mosse.length === 0 || (mosse.length === 1 && playerNext !== userId)) {
        return res.end('<err, 0>');
    }

    // restituisci ultima mossa avversario
    const mossa = mosse[mosse.length - 1];
    res.end(`<${mossa.row}, ${mossa.col}, ${code}>`);
});

// Login e registrazione
app.get('/login', (req, res) => {
    if (req.session.userid) return res.redirect('/');
    res.render('login');
});
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.end('dati mancanti');
    const utenti = await getDB('utenti');
    // TODO: aggiungere hashing delle password
    const u = await utenti.findOne({ username, password });
    if (!u) return res.end('utente non trovato');
    req.session.userid = u.userid;
    res.redirect('/');
});

app.get('/register', (req, res) => {
    if (req.session.userid) return res.redirect('/');
    res.render('register');
});
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.end('dati mancanti');
    const utenti = await getDB('utenti');
    if (await utenti.findOne({ username })) return res.end('utente esistente');
    await utenti.insertOne({ username, password, userid: uuidv4() });
    res.redirect('/login');
});

// Avvio del server
app.listen(SERVER_PORT, () => {
    console.log(`Server in ascolto su porta ${SERVER_PORT}`);
});
