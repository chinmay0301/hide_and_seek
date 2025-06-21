document.addEventListener('DOMContentLoaded', function() {
    const playerNameInput = document.getElementById('playerName');
    const roleOptions = document.querySelectorAll('.role-option');
    const joinBtn = document.getElementById('joinBtn');
    
    let selectedRole = null;

    // Role selection
    roleOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remove previous selection
            roleOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Select current option
            this.classList.add('selected');
            selectedRole = this.dataset.role;
            
            // Enable join button if name is also filled
            updateJoinButton();
        });
    });

    // Name input validation
    playerNameInput.addEventListener('input', function() {
        updateJoinButton();
    });

    function updateJoinButton() {
        const playerName = playerNameInput.value.trim();
        joinBtn.disabled = !playerName || !selectedRole;
    }

    // Join game
    joinBtn.addEventListener('click', async function() {
        const playerName = playerNameInput.value.trim();
        
        if (!playerName || !selectedRole) {
            alert('Please enter your name and select a role');
            return;
        }

        try {
            const response = await fetch('/api/join_game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_id: gameId,
                    player_name: playerName,
                    role: selectedRole
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Redirect to game page
                window.location.href = data.redirect;
            } else {
                alert('Error joining game: ' + data.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error joining game. Please try again.');
        }
    });

    // Allow Enter key to join
    playerNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !joinBtn.disabled) {
            joinBtn.click();
        }
    });
}); 