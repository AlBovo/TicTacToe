/****************************************************************************************************
* 13/05/2025 4H Alan Davide Bovo, Mattia Cincotta, Giulia Cocka, Matteo Angiolillo, Antonio De Rosa *
*               Progetto TicTacToe basato su sito scritto con node.js e bootstrap                   *
****************************************************************************************************/
// Seleziona tutte le celle del board, il pulsante reset e l'area messaggi
const cells = document.querySelectorAll('.cell');
const resetButton = document.querySelector('#reset');
const msg = document.querySelector('#msg');

// Variabili di stato della partita
let partitaId = null;      // ID partita restituito dal server
let myPlayerNum = 0;       // 0 = primo giocatore (X), 1 = secondo (O)
let mySymbol = 'x';        // Simbolo dell'utente
let oppSymbol = 'o';       // Simbolo dell'avversario
let gameOver = false;      // Flag di partita terminata

// Avvia o entra in una partita
async function startGame() {
    console.log('startGame called');
    try {
        // Richiesta al server per creare/entrare in partita
        const response = await fetch('/chiedi-partita');
        const data = await response.text();
        console.log('Response from /chiedi-partita:', data);

        // Se la risposta non è formattata correttamente, mostra messaggio
        if (!data.startsWith('<')) {
            msg.textContent = data;
            return;
        }

        // Parsing di <id, status>
        const [id, status] = data.replace(/[<>]/g, '').split(',').map(s => s.trim());
        partitaId = id;
        myPlayerNum = Number(status);
        mySymbol = myPlayerNum === 0 ? 'x' : 'o';
        oppSymbol = myPlayerNum === 0 ? 'o' : 'x';
        console.log('partitaId:', partitaId, 'myPlayerNum:', myPlayerNum);

        // Reset board e stato
        resetBoard();
        gameOver = false;
        msg.textContent = '';

        // Se sei il secondo giocatore, attendi la mossa avversaria
        if (myPlayerNum === 1) {
            await fetchOpponentMove();
        }
    } catch (err) {
        console.error('Errore di connessione:', err);
        msg.textContent = 'Errore di connessione.';
    }
}

// Pulisce l'interfaccia del board
function resetBoard() {
    console.log('resetBoard called');
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o');
    });
}

// Gestione del click su una cella
async function handleCellClick(e) {
    if (gameOver) {
        console.log('Game over, click ignored');
        return;
    }
    // Controlla se è il tuo turno
    const movesCount = Array.from(cells).filter(c => c.textContent).length;
    console.log('handleCellClick: movesCount', movesCount);
    if (movesCount % 2 !== myPlayerNum) {
        console.log('Not your turn');
        return;
    }

    const cell = e.target;
    if (cell.textContent) {
        console.log('Cell already filled');
        return;
    }

    // Calcola riga e colonna da indice cella
    const cellIndex = Array.from(cells).indexOf(cell);
    const row = Math.floor(cellIndex / 3) + 1;
    const col = (cellIndex % 3) + 1;
    console.log('Trying move at', row, col);

    try {
        // Invio mossa al server
        const response = await fetch(`/muovi/${partitaId}?row=${row}&col=${col}`);
        const data = await response.text();
        console.log('Response from /muovi:', data);

        // Errore di validazione lato server
        if (data.startsWith('<err')) {
            const code = data.replace(/[<>]/g, '').split(',')[1].trim();
            handleError(code);
            return;
        }

        // Parsing di <ok, code>
        const [ok, code] = data.replace(/[<>]/g, '').split(',').map(s => s.trim());
        // Aggiorna UI con il tuo simbolo
        cell.textContent = mySymbol;
        cell.classList.add(mySymbol);

        // Controlla esito mossa
        if (code === '1') {
            msg.textContent = `Hai vinto!`;
            gameOver = true;
        } else if (code === '3') {
            msg.textContent = 'Patta!';
            gameOver = true;
        } else {
            // Altrimenti attendi mossa avversaria
            await fetchOpponentMove();
        }
    } catch (err) {
        console.error('Errore di connessione:', err);
        msg.textContent = 'Errore di connessione.';
    }
}

// Polling per ottenere la mossa dell'avversario
async function fetchOpponentMove() {
    if (gameOver) {
        console.log('Game over, not fetching opponent move');
        return;
    }
    try {
        const response = await fetch(`/chiedi-mossa/${partitaId}`);
        const data = await response.text();
        console.log('Response from /chiedi-mossa:', data);

        // Se nessuna mossa disponibile, riprova dopo 1s
        if (data.startsWith('<err')) {
            setTimeout(fetchOpponentMove, 1000);
            return;
        }

        // Parsing di <row, col, code>
        const [row, col, code] = data.replace(/[<>]/g, '').split(',').map(s => s.trim());
        if (row && col) {
            const idx = (parseInt(row) - 1) * 3 + (parseInt(col) - 1);
            if (!cells[idx].textContent) {
                cells[idx].textContent = oppSymbol;
                cells[idx].classList.add(oppSymbol);
                console.log('Opponent moved at', row, col);
            }
        }

        // Verifica risultato partita
        if (code === '2') {
            msg.textContent = 'Hai perso!';
            gameOver = true;
        } else if (code === '3') {
            msg.textContent = 'Patta!';
            gameOver = true;
        } else if (code === '1') {
            msg.textContent = 'Hai vinto!';
            gameOver = true;
        }
        // Altrimenti è di nuovo il tuo turno
    } catch (err) {
        console.error('Errore di connessione:', err);
        msg.textContent = 'Errore di connessione.';
    }
}

// Gestione codici di errore restituiti dal server
function handleError(code) {
    console.log('handleError called with code', code);
    switch(code) {
        case '0': msg.textContent = 'Partita sconosciuta.'; break;
        case '1': msg.textContent = 'Mossa non valida: casella già occupata.'; break;
        case '2': msg.textContent = 'Non è il tuo turno.'; break;
        default:  msg.textContent = 'Errore sconosciuto.';
    }
}

// Assegna gli event listener a celle e pulsante reset
cells.forEach(cell => cell.addEventListener('click', handleCellClick));
resetButton.addEventListener('click', startGame);

// Inizializza il gioco al caricamento della pagina
console.log('Initializing game...');
startGame();
