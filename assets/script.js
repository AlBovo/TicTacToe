const cells = document.querySelectorAll('.cell');
const resetButton = document.querySelector('#reset');
const board = document.querySelector('.board');
const msg = document.querySelector('#msg');

let currentPlayer = 'x';
let gameOver = false;
let partitaId = null;

// Fetch the game state from the server
async function fetchGameState() {
  try {
    const response = await fetch(`/chiedi-mossa/${partitaId}`);
    const data = await response.text();

    if (data.startsWith('<err')) {
      const errorCode = data.split(',')[1].trim();
      handleError(errorCode);
      return;
    }

    const [row, col, status] = data.replace(/[<>]/g, '').split(',').map(Number);
    if (row && col) {
      const cellIndex = (row - 1) * 3 + (col - 1);
      cells[cellIndex].classList.add(currentPlayer);
      cells[cellIndex].textContent = currentPlayer;
      currentPlayer = currentPlayer === 'x' ? 'o' : 'x';
    }

    handleGameStatus(status);
  } catch (error) {
    console.error('Error fetching game state:', error);
  }
}

// Handle cell click
async function handleCellClick(event) {
  const cell = event.target;
  if (cell.classList.contains('x') || cell.classList.contains('o') || gameOver) {
    return;
  }

  const cellIndex = Array.from(cells).indexOf(cell);
  const row = Math.floor(cellIndex / 3) + 1;
  const col = (cellIndex % 3) + 1;

  try {
    const response = await fetch(`/muovi/${partitaId}?row=${row}&col=${col}`);
    const data = await response.text();

    if (data.startsWith('<err')) {
      const errorCode = data.split(',')[1].trim();
      handleError(errorCode);
      return;
    }

    const [status] = data.replace(/[<>]/g, '').split(',').map(Number);
    cell.classList.add(currentPlayer);
    cell.textContent = currentPlayer;
    currentPlayer = currentPlayer === 'x' ? 'o' : 'x';

    handleGameStatus(status);
  } catch (error) {
    console.error('Error making move:', error);
  }
}

// Handle game status
function handleGameStatus(status) {
  if (status === 1) {
    gameOver = true;
    msg.textContent = `Vince ${currentPlayer === 'x' ? 'o' : 'x'}`;
  } else if (status === 3) {
    gameOver = true;
    msg.textContent = 'Patta';
  }
}

// Handle errors
function handleError(errorCode) {
  if (errorCode === '0') {
    msg.textContent = 'Partita sconosciuta';
  } else if (errorCode === '1') {
    msg.textContent = 'Mossa non valida: casella già occupata';
  } else if (errorCode === '2') {
    msg.textContent = 'Non è il tuo turno';
  }
}

// Reset the game
async function handleResetButtonClick() {
  try {
    const response = await fetch('/chiedi-partita');
    const data = await response.text();
    console.log(data);

    if (data.startsWith('<')) {
      const [id, status] = data.replace(/[<>]/g, '').split(',').map(Number);
      partitaId = id;
      gameOver = false;
      msg.textContent = '';
      currentPlayer = 'x';

      for (let i = 0; i < cells.length; i++) {
        cells[i].classList.remove('x', 'o', 'win');
        cells[i].textContent = '';
      }

      if (status === 1) {
        fetchGameState();
      }
    }
  } catch (error) {
    console.error('Error resetting game:', error);
  }
}

// Initialize the game
async function initializeGame() {
  await handleResetButtonClick();
}

resetButton.addEventListener('click', handleResetButtonClick);

for (let i = 0; i < cells.length; i++) {
  cells[i].addEventListener('click', handleCellClick);
}

initializeGame();