document.addEventListener('DOMContentLoaded', function() {
    const createGameBtn = document.getElementById('createGameBtn');
    const joinGameBtn = document.getElementById('joinGameBtn');
    const gameIdInput = document.getElementById('gameIdInput');
    const gameCreated = document.getElementById('gameCreated');
    const gameLink = document.getElementById('gameLink');
    const gameIdDisplay = document.getElementById('gameIdDisplay');
    const copyLinkBtn = document.getElementById('copyLinkBtn');

    // Create new game
    createGameBtn.addEventListener('click', async function() {
        try {
            const response = await fetch('/api/create_game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                const fullUrl = window.location.origin + data.join_url;
                gameLink.value = fullUrl;
                gameIdDisplay.textContent = data.game_id;
                gameCreated.style.display = 'block';
                
                // Scroll to the game info
                gameCreated.scrollIntoView({ behavior: 'smooth' });
            } else {
                alert('Error creating game: ' + data.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error creating game. Please try again.');
        }
    });

    // Join existing game
    joinGameBtn.addEventListener('click', function() {
        const gameId = gameIdInput.value.trim();
        if (!gameId) {
            alert('Please enter a game ID');
            return;
        }
        
        window.location.href = `/join/${gameId}`;
    });

    // Copy link to clipboard
    copyLinkBtn.addEventListener('click', function() {
        gameLink.select();
        gameLink.setSelectionRange(0, 99999); // For mobile devices
        
        try {
            document.execCommand('copy');
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyLinkBtn.textContent = 'Copy';
            }, 2000);
        } catch (err) {
            // Fallback for modern browsers
            navigator.clipboard.writeText(gameLink.value).then(() => {
                copyLinkBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyLinkBtn.textContent = 'Copy';
                }, 2000);
            });
        }
    });

    // Allow Enter key to join game
    gameIdInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinGameBtn.click();
        }
    });
}); 