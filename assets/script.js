const cells = document.querySelectorAll('.cell');
const resetButton = document.querySelector('#reset');
const msg = document.querySelector('#msg');

let partitaId = null;
let myPlayerNum = 0;
let mySymbol = 'x';
let oppSymbol = 'o';
let gameOver = false;

// Start or join a game
async function startGame() {
    console.log('startGame called');
    try {
        const response = await fetch('/chiedi-partita');
        const data = await response.text();
        console.log('Response from /chiedi-partita:', data);
        if (!data.startsWith('<')) {
            msg.textContent = data;
            return;
        }
        const [id, status] = data.replace(/[<>]/g, '').split(',').map(s => s.trim());
        partitaId = id;
        myPlayerNum = Number(status);
        mySymbol = myPlayerNum === 0 ? 'x' : 'o';
        oppSymbol = myPlayerNum === 0 ? 'o' : 'x';
        console.log('partitaId:', partitaId, 'myPlayerNum:', myPlayerNum, 'mySymbol:', mySymbol, 'oppSymbol:', oppSymbol);
        resetBoard();
        gameOver = false;
        msg.textContent = '';
        if (myPlayerNum === 1) {
            await fetchOpponentMove();
        }
    } catch (err) {
        console.error('Errore di connessione:', err);
        msg.textContent = 'Errore di connessione.';
    }
}

// Reset board UI
function resetBoard() {
    console.log('resetBoard called');
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o');
    });
}

// Handle cell click
async function handleCellClick(e) {
    if (gameOver) {
        console.log('Game over, click ignored');
        return;
    }
    // Only allow move if it's your turn
    const movesCount = Array.from(cells).filter(cell => cell.textContent).length;
    console.log('handleCellClick: movesCount', movesCount, 'myPlayerNum', myPlayerNum);
    if (movesCount % 2 !== myPlayerNum) {
        console.log('Not your turn');
        return; // Not your turn
    }

    const cell = e.target;
    if (cell.textContent) {
        console.log('Cell already filled');
        return;
    }

    const cellIndex = Array.from(cells).indexOf(cell);
    const row = Math.floor(cellIndex / 3) + 1;
    const col = (cellIndex % 3) + 1;
    console.log('Trying move at', row, col);

    try {
        const response = await fetch(`/muovi/${partitaId}?row=${row}&col=${col}`);
        const data = await response.text();
        console.log('Response from /muovi:', data);

        if (data.startsWith('<err')) {
            const code = data.replace(/[<>]/g, '').split(',')[1].trim();
            handleError(code);
            return;
        }

        const [ok, code] = data.replace(/[<>]/g, '').split(',').map(s => s.trim());
        cell.textContent = mySymbol;
        cell.classList.add(mySymbol);

        if (code === '1') {
            msg.textContent = `Hai vinto!`;
            gameOver = true;
        } else if (code === '3') {
            msg.textContent = 'Patta!';
            gameOver = true;
        } else {
            // Wait for opponent's move
            await fetchOpponentMove();
        }
    } catch (err) {
        console.error('Errore di connessione:', err);
        msg.textContent = 'Errore di connessione.';
    }
}

// Fetch opponent's move (polling)
async function fetchOpponentMove() {
    if (gameOver) {
        console.log('Game over, not fetching opponent move');
        return;
    }
    try {
        const response = await fetch(`/chiedi-mossa/${partitaId}`);
        const data = await response.text();
        console.log('Response from /chiedi-mossa:', data);

        if (data.startsWith('<err')) {
            // No move yet, poll again after a short delay
            setTimeout(fetchOpponentMove, 1000);
            return;
        }

        const [row, col, code] = data.replace(/[<>]/g, '').split(',').map(s => s.trim());
        if (row && col) {
            const cellIndex = (parseInt(row) - 1) * 3 + (parseInt(col) - 1);
            if (!cells[cellIndex].textContent) {
                cells[cellIndex].textContent = oppSymbol;
                cells[cellIndex].classList.add(oppSymbol);
                console.log('Opponent moved at', row, col);
            }
        }

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
        // else: it's your turn again, do nothing
    } catch (err) {
        console.error('Errore di connessione:', err);
        msg.textContent = 'Errore di connessione.';
    }
}

// Handle error codes from server
function handleError(code) {
    console.log('handleError called with code', code);
    if (code === '0') {
        msg.textContent = 'Partita sconosciuta.';
    } else if (code === '1') {
        msg.textContent = 'Mossa non valida: casella già occupata.';
    } else if (code === '2') {
        msg.textContent = 'Non è il tuo turno.';
    } else {
        msg.textContent = 'Errore sconosciuto.';
    }
}

// Event listeners
cells.forEach(cell => cell.addEventListener('click', handleCellClick));
resetButton.addEventListener('click', startGame);

// Initialize game on page load
console.log('Initializing game...');
startGame();