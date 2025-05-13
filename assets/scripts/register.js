document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorDiv = document.getElementById('register-error');
    errorDiv.textContent = '';

    if (!username || !password) {
        errorDiv.textContent = 'Inserisci username e password.';
        return;
    }

    const response = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    });

    if (response.redirected) {
        window.location.href = response.url;
    } else {
        const text = await response.text();
        errorDiv.textContent = text;
    }
});