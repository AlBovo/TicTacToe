/****************************************************************************************************
* 13/05/2025 4H Alan Davide Bovo, Mattia Cincotta, Giulia Cocka, Matteo Angiolillo, Antonio De Rosa *
*               Progetto TicTacToe basato su sito scritto con node.js e bootstrap                   *
****************************************************************************************************/
// Seleziona il form di registrazione e aggiungi un listener per l'evento submit
document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault(); // Previene il comportamento di default e ricaricamento della pagina

    // Ottieni e pulisci i valori di username e password dai campi di input
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('register-error');
    errorDiv.textContent = ''; // Resetta eventuali messaggi di errore precedenti

    // Validazione semplice: controlla che i campi non siano vuoti
    if (!username || !password) {
        errorDiv.textContent = 'Inserisci username e password.';
        return; // Esci se mancano i dati
    }

    // Invia la richiesta POST al server per la registrazione
    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        // Costruisci il corpo della richiesta in formato URL-encoded
        body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    });

    // Se il server risponde con un redirect, segui l'URL indicato
    if (response.redirected) {
        window.location.href = response.url;
    } else {
        // Altrimenti, mostra il messaggio di errore restituito dal server
        const text = await response.text();
        errorDiv.textContent = text;
    }
});