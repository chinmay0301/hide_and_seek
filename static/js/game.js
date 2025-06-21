// Game state
let socket;
let canvas;
let ctx;
let playerRole;
let playerName;
let gameStarted = false;
let gameOver = false;
let hiderPosition = null;
let seekerPosition = null;
let playerPosition = null;
let startTime = null;
let maxTime = 300; // 5 minutes
let timerInterval;
let proximityHint = '';

// Initialize game
document.addEventListener('DOMContentLoaded', function() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    // Connect to WebSocket
    socket = io();
    
    // Set up event listeners
    setupSocketEvents();
    setupGameControls();
    setupCanvasEvents();
    
    // Start rendering
    requestAnimationFrame(gameLoop);
});

function setupSocketEvents() {
    socket.on('connect', function() {
        console.log('Connected to server');
    });

    socket.on('player_joined', function(data) {
        addChatMessage(`System: ${data.player_name} joined as ${data.role}`);
        updateGameStatus(`${data.player_name} joined as ${data.role}`);
        
        // Show start button if both players are here
        if (data.role !== playerRole) {
            document.getElementById('startGameBtn').style.display = 'inline-block';
        }
    });

    socket.on('player_left', function(data) {
        addChatMessage(`System: ${data.player_name} left the game`);
        updateGameStatus(`${data.player_name} left the game`);
        document.getElementById('startGameBtn').style.display = 'none';
    });

    socket.on('game_started', function(data) {
        gameStarted = true;
        startTime = new Date(data.start_time);
        maxTime = data.max_time;
        
        if (playerRole === 'hider') {
            hiderPosition = data.hider_position;
            playerPosition = hiderPosition;
            document.getElementById('hiderControls').style.display = 'block';
            document.getElementById('waitingControls').style.display = 'none';
            updateGameStatus('Click on the map to hide, then click "I\'m Hidden!"');
        } else {
            seekerPosition = data.seeker_position;
            playerPosition = seekerPosition;
            document.getElementById('seekerControls').style.display = 'block';
            document.getElementById('waitingControls').style.display = 'none';
            updateGameStatus('Click on the map to move and search for the hider');
        }
        
        startTimer();
        addChatMessage('System: Game started!');
    });

    socket.on('hider_is_hidden', function() {
        if (playerRole === 'seeker') {
            updateGameStatus('The hider is hidden! Start searching!');
            addChatMessage('System: The hider is hidden!');
        }
    });

    socket.on('proximity_hint', function(data) {
        if (playerRole === 'seeker') {
            proximityHint = data.distance;
            document.getElementById('proximityHint').textContent = data.distance;
            setTimeout(() => {
                proximityHint = '';
                document.getElementById('proximityHint').textContent = '';
            }, 3000);
        }
    });

    socket.on('game_over', function(data) {
        gameOver = true;
        clearInterval(timerInterval);
        
        const overlay = document.getElementById('gameOverlay');
        const result = document.getElementById('gameResult');
        const message = document.getElementById('gameMessage');
        
        if (data.winner === playerRole) {
            result.textContent = '🎉 You Won! 🎉';
            result.style.color = '#28a745';
        } else {
            result.textContent = '😔 You Lost! 😔';
            result.style.color = '#dc3545';
        }
        
        message.textContent = data.message;
        overlay.style.display = 'flex';
        
        addChatMessage(`System: ${data.message}`);
    });

    socket.on('game_restarted', function() {
        // Reset game state
        gameStarted = false;
        gameOver = false;
        hiderPosition = null;
        seekerPosition = null;
        playerPosition = null;
        startTime = null;
        proximityHint = '';
        
        // Reset UI
        document.getElementById('gameOverlay').style.display = 'none';
        document.getElementById('hiderControls').style.display = 'none';
        document.getElementById('seekerControls').style.display = 'none';
        document.getElementById('waitingControls').style.display = 'block';
        document.getElementById('startGameBtn').style.display = 'none';
        document.getElementById('proximityHint').textContent = '';
        
        clearInterval(timerInterval);
        updateGameStatus('Game restarted. Waiting for players...');
        addChatMessage('System: Game restarted!');
    });

    socket.on('error', function(data) {
        alert('Error: ' + data.message);
    });
}

function setupGameControls() {
    const startGameBtn = document.getElementById('startGameBtn');
    const hiddenBtn = document.getElementById('hiddenBtn');
    const restartBtn = document.getElementById('restartBtn');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatInput = document.getElementById('chatInput');

    startGameBtn.addEventListener('click', function() {
        socket.emit('start_game');
    });

    hiddenBtn.addEventListener('click', function() {
        if (hiderPosition) {
            socket.emit('hider_hidden');
            updateGameStatus('You are hidden! Waiting for seeker...');
            addChatMessage('System: You are now hidden!');
        }
    });

    restartBtn.addEventListener('click', function() {
        socket.emit('restart_game');
    });

    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
}

function setupCanvasEvents() {
    canvas.addEventListener('click', function(e) {
        if (!gameStarted || gameOver) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (playerRole === 'hider' && !hiderPosition) {
            // Hider is choosing position
            hiderPosition = { x, y };
            playerPosition = hiderPosition;
        } else if (playerRole === 'seeker') {
            // Seeker is moving
            seekerPosition = { x, y };
            playerPosition = seekerPosition;
            socket.emit('seeker_move', { position: seekerPosition });
        }
    });
}

function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (message) {
        addChatMessage(`${playerName}: ${message}`);
        chatInput.value = '';
    }
}

function addChatMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updateGameStatus(status) {
    document.getElementById('gameStatus').textContent = status;
}

function startTimer() {
    timerInterval = setInterval(function() {
        if (startTime) {
            const elapsed = Math.floor((new Date() - startTime) / 1000);
            const remaining = maxTime - elapsed;
            
            if (remaining <= 0) {
                clearInterval(timerInterval);
                socket.emit('time_up');
                return;
            }
            
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            document.getElementById('timer').textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function gameLoop() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid
    drawGrid();
    
    // Draw game elements
    if (gameStarted) {
        drawGameElements();
    } else {
        drawWaitingScreen();
    }
    
    requestAnimationFrame(gameLoop);
}

function drawGrid() {
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let x = 0; x <= canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

function drawGameElements() {
    // Draw hider position (only visible to hider)
    if (hiderPosition && playerRole === 'hider') {
        ctx.fillStyle = '#28a745';
        ctx.beginPath();
        ctx.arc(hiderPosition.x, hiderPosition.y, 20, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#1e7e34';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw "YOU" label
        ctx.fillStyle = '#333';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('YOU', hiderPosition.x, hiderPosition.y + 35);
    }
    
    // Draw seeker position
    if (seekerPosition) {
        if (playerRole === 'seeker') {
            ctx.fillStyle = '#007bff';
        } else {
            ctx.fillStyle = '#6c757d';
        }
        
        ctx.beginPath();
        ctx.arc(seekerPosition.x, seekerPosition.y, 15, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#0056b3';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw label
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        if (playerRole === 'seeker') {
            ctx.fillText('YOU', seekerPosition.x, seekerPosition.y + 25);
        } else {
            ctx.fillText('SEEKER', seekerPosition.x, seekerPosition.y + 25);
        }
    }
    
    // Draw proximity hint for seeker
    if (proximityHint && playerRole === 'seeker') {
        ctx.fillStyle = 'rgba(255, 193, 7, 0.3)';
        ctx.beginPath();
        ctx.arc(seekerPosition.x, seekerPosition.y, 100, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function drawWaitingScreen() {
    ctx.fillStyle = '#6c757d';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for game to start...', canvas.width / 2, canvas.height / 2);
    
    ctx.font = '16px Arial';
    ctx.fillText('Click "Start Game" when both players are ready', canvas.width / 2, canvas.height / 2 + 40);
} 