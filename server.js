import express from 'express';
import session from 'express-session';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

const app = express();

const SERVER_PORT = process.env.PORT || 8080;
const MONGO_USER = process.env.MONGO_INITDB_ROOT_USERNAME || "admin"
const MONGO_PASS = process.env.MONGO_INITDB_ROOT_PASSWORD || "password"
const MONGO_HOST = process.env.MONGO_HOST || "mongodb"
const MONGO_DB = process.env.MONGO_INITDB_DATABASE || "stackbank"
const MONGO_URI = `mongodb://${MONGO_USER}:${MONGO_PASS}@${MONGO_HOST}:27017/`

const client = new MongoClient(MONGO_URI);

app.use(express.static('./assets')); 
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        sameSite: true,
        secure: true,
        httpOnly: true,
        maxAge: 1000*60*60
    }
}));

async function getDB(collection) {
    await client.connect();
    return client.db(MONGO_DB).collection(collection);
}

async function giocando(uid) {
    const partite = getDB('partite');
    const r = await partite.find({ status: "giocando", giocatori: { $in: [uid]} }).toArray();
    return r.length > 0;
}

app.get('/', (req, resp) => {
    resp.redirect('/tris.html')
});

app.get('/chiedi-partita', async (req, resp) => {
    const partite = getDB('partite');
    const utenti = getDB('utenti');

    const userid = req.session.userid || 'none';

    if (await giocando()) {
        return resp.redirect('/');
    }
    if (userid === 'none') {
        return resp.redirect('/login');
    }

    const utente = await utenti.findOne({ userid: userid });
    const partita = await partite.find({ status: "aspettando" }).toArray();
    if (partita.length === 0) {
        const partitaid = uuidv4();
        await db.insertOne({ giocatori: [utente.username], parita: partitaid, mosse: [], status: "aspettando" })
        return resp.end(`<${partitaid}, 0>`);
    }

    const p = partita[0];
    await partite.updateOne({ partita: p.partita }, { $set: { giocatori: [...p.giocatori, utente.username], status: "giocando" } })
    return resp.end(`<${p.partita}, 1>`);
});

app.get('/muovi/:id_partita', (req, resp) => {
    
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
    // la risposta conterrà <row, col, codice_ok> oppure <err, codice_errore>
    //      row, col = valori 1..3 della casella mossa dall'avversario
    //      codice_ok può essere:
    //              0 == la partita prosegue
    //              1 == partita finita con vittoria tua (questo è in realtà escluso quando muove l'avversario)
    //              2 == partita finita con vittoria dell'avversario
    //              3 == partita finita con patta
});

app.post('/login', async (req, resp) => {
    const username = req.body.username;
    const password = req.body.password;

    if (!username || !password) {
        return resp.end('dati mancanti')
    }

    const utenti = getDB('utenti');
    // TODO: hash password
    const u = await utenti.findOne({ username, password });
    if (!u) {
        return resp.end('utente non trovato');
    }

    req.session.userid = u.userid;
    return redirect('/');
});


app.post('/register', async (req, resp) => {
    const username = req.body.username;
    const password = req.body.password;

    if (!username || !password) {
        return resp.end('dati mancanti')
    }

    const utenti = getDB('utenti');
    if (await utenti.findOne({ username })) {
        return resp.end('utente esistente');
    }

    await utenti.insertOne({ username, password, userid: uuidv4() });
    resp.redirect('/login')
});

app.listen(SERVER_PORT, () => {
    console.log(`Server in ascolto su porta ${SERVER_PORT}`);
});