// Game state
let socket;
let canvas;
let ctx;
//let playerRole;
let playerName;
let gameStarted = false;
let gameOver = false;
let hiderPosition = null;
let seekerPosition = null;
let playerPosition = null;
let startTime = null;
let maxTime = 1500; // 25 minutes
let timerInterval;
let proximityHint = '';
const playerRole = localStorage.getItem('playerRole');
let displayingImage = false;
let currentSeekerImage = null;
let seekerImageCache = []; // Array to store loaded Image objects for seeker
let hiddenWordVisible = false;
let hiddenWord = null;

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
    
    // Sentence input elements
    const sentenceInputContainer = document.getElementById('sentenceInputContainer');
    const seekerSentence = document.getElementById('seekerSentence');
    const sendSentenceBtn = document.getElementById('sendSentenceBtn');
    const displaySentence = document.getElementById('displaySentence');
    const sentenceText = document.getElementById('sentenceText');

    // Hider prompt elements
    const hiderPromptContainer = document.getElementById('hiderPromptContainer');
    const hiderPrompt = document.getElementById('hiderPrompt');
    const sendPromptBtn = document.getElementById('sendPromptBtn');



    if (sendPromptBtn) {
        sendPromptBtn.addEventListener('click', function() {
            const prompt = hiderPrompt.value.trim();
            if (prompt) {
                socket.emit('hider_prompt', { prompt });
                hiderPrompt.value = '';
            }
        });
    }

    // Start rendering
    requestAnimationFrame(gameLoop);

    // Show input for seeker when game starts
    socket.on('game_started', function(data) {
        // ...existing code...
        if (playerRole === 'seeker') {
            sentenceInputContainer.style.display = 'block';
            hiderPromptContainer.style.display = 'none';
        } else {
            sentenceInputContainer.style.display = 'none';
            hiderPromptContainer.style.display = 'block';
        }
        displaySentence.style.display = 'none';
        // ...existing code...
        
        // Load any existing images in the cache when seeker starts
        loadSeekerImageCache();
    });

    // Send sentence to server
    if (sendSentenceBtn) {
        sendSentenceBtn.addEventListener('click', function() {
            const sentence = seekerSentence.value.trim();
            if (sentence) {
                socket.emit('seeker_sentence', { sentence });
                seekerSentence.value = '';
                // sentenceInputContainer.style.display = 'none'; // REMOVE or COMMENT THIS LINE
            }
        });
    }

    // Send prompt as hider
    if (sendPromptBtn) {
        sendPromptBtn.addEventListener('click', function() {
            const prompt = hiderPrompt.value.trim();
            if (prompt) {
                socket.emit('hider_prompt', { prompt });
                hiderPrompt.value = '';
                hiderPromptContainer.style.display = 'none';
            }
        });
    }

    // Receive sentence as hider
    socket.on('show_sentence', function(data) {
        console.log('=== SHOW SENTENCE EVENT ===');
        console.log('Received sentence:', data.sentence);
        console.log('Player role:', playerRole);
        
        if (playerRole === 'hider') {
            console.log('✓ Hider role confirmed');
            
            const sentenceTextElement = document.getElementById('sentenceText');
            const displaySentenceElement = document.getElementById('displaySentence');
            
            console.log('sentenceText element:', sentenceTextElement);
            console.log('displaySentence element:', displaySentenceElement);
            
            if (sentenceTextElement && displaySentenceElement) {
                console.log('✓ Elements found, updating display');
                sentenceTextElement.textContent = data.sentence;
                displaySentenceElement.style.display = 'block';
                console.log('✓ Sentence updated successfully');
            } else {
                console.error('❌ Elements not found!');
            }
        } else {
            console.log('Not hider role, ignoring sentence');
        }
    });

    // Image preview elements
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    const approveImageBtn = document.getElementById('approveImageBtn');
    const editImageBtn = document.getElementById('editImageBtn');
    const editPromptContainer = document.getElementById('editPromptContainer');

    if (approveImageBtn) {
        approveImageBtn.addEventListener('click', function() {
            console.log('=== APPROVE BUTTON CLICKED ===');
            console.log('Sending approve_image event to server');
            socket.emit('approve_image');
            
            // Hide the approval container and show the prompt container again
            const imageApprovalContainer = document.getElementById('imageApprovalContainer');
            const hiderPromptContainer = document.getElementById('hiderPromptContainer');
            
            if (imageApprovalContainer) {
                imageApprovalContainer.style.display = 'none';
            }
            if (hiderPromptContainer) {
                hiderPromptContainer.style.display = 'block';
            }
            
            console.log('✓ Approve event sent, UI updated, image kept visible');
        });
    }

    // REMOVE OR COMMENT OUT these event listeners:
    /*
    if (editImageBtn) {
        editImageBtn.addEventListener('click', function() {
            // ... remove this entire block
        });
    }

    if (sendEditBtn) {
        sendEditBtn.addEventListener('click', function() {
            // ... remove this entire block  
        });
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', function() {
            // ... remove this entire block
        });
    }
    */
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
        
        // Update round display for both players
        if (data.current_round !== undefined) {
            updateRoundDisplay(data.current_round);
        }
        
        if (playerRole === 'hider') {
            hiderPosition = data.hider_position;
            playerPosition = hiderPosition;
            document.getElementById('hiderControls').style.display = 'block';
            document.getElementById('waitingControls').style.display = 'none';
            updateGameStatus('Click on the map to hide, then click "Show Hidden Word" to see your target!');
            
            // Store the hidden word
            hiddenWord = data.hidden_word;
            console.log('Hidden word received:', hiddenWord);
            
        } else {
            seekerPosition = data.seeker_position;
            playerPosition = seekerPosition;
            document.getElementById('seekerControls').style.display = 'block';
            document.getElementById('guessPanel').style.display = 'block';
            document.getElementById('waitingControls').style.display = 'none';
            updateGameStatus('Click on the map to move and search for the hider');
            
            // Load any existing images in the cache when seeker starts
            loadSeekerImageCache();
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

    socket.on('game_restarted', function(data) {
        // Reset game state
        gameStarted = false;
        gameOver = false;
        hiderPosition = null;
        seekerPosition = null;
        playerPosition = null;
        startTime = null;
        proximityHint = '';
        hiddenWordVisible = false;
        hiddenWord = null;
        
        // Reset round display
        if (data.current_round !== undefined) {
            updateRoundDisplay(data.current_round);
        }
        
        // Reset UI
        document.getElementById('gameOverlay').style.display = 'none';
        document.getElementById('hiderControls').style.display = 'none';
        document.getElementById('seekerControls').style.display = 'none';
        document.getElementById('waitingControls').style.display = 'block';
        document.getElementById('startGameBtn').style.display = 'none';
        document.getElementById('proximityHint').textContent = '';
        
        // Reset hidden word display
        const hiddenWordContainer = document.getElementById('hiddenWordContainer');
        const hiddenBtn = document.getElementById('hiddenBtn');
        if (hiddenWordContainer) hiddenWordContainer.style.display = 'none';
        if (hiddenBtn) {
            hiddenBtn.textContent = 'Show Hidden Word';
            hiddenBtn.className = 'btn btn-secondary';
        }
        
        clearInterval(timerInterval);
        updateGameStatus('Game restarted. Waiting for players...');
        addChatMessage('System: Game restarted!');
    });

    socket.on('error', function(data) {
        alert('Error: ' + data.message);
    });

    socket.on('generation_blocked', function(data) {
        console.log('=== GENERATION BLOCKED ===');
        console.log('Block reason:', data.message);
        
        // Show error message to hider
        updateGameStatus(data.message);
        addChatMessage(`System: ${data.message}`);
        
        // Show helpful hint
        const hintMessage = "Tip: Add [edit] to your prompt to modify the current image, or send the current image to the seeker first.";
        addChatMessage(`System: ${hintMessage}`);
        
        // Re-enable the prompt input
        const hiderPromptContainer = document.getElementById('hiderPromptContainer');
        if (hiderPromptContainer) {
            hiderPromptContainer.style.display = 'block';
        }
    });

    socket.on('image_generated', function(data) {
        console.log('=== FRONTEND IMAGE DEBUG ===');
        console.log('Image generated event received:', data);
        
        if (playerRole === 'hider') {
            console.log('Hider role detected, displaying image in canvas');
            
            // Update round display
            if (data.current_round !== undefined) {
                updateRoundDisplay(data.current_round);
            }
            
            // Display the image in the main canvas area
            const imageUrl = `/images/${data.image_path.split('/').pop()}`;
            displayGeneratedImage(imageUrl);
            
            // Show the approval container
            const imageApprovalContainer = document.getElementById('imageApprovalContainer');
            if (imageApprovalContainer) {
                imageApprovalContainer.style.display = 'block';
            }
            
            if (data.is_edit) {
                updateGameStatus(`Round ${data.current_round}: Image edited! You can continue editing with [edit] or send to seeker.`);
            } else {
                updateGameStatus(`Round ${data.current_round}: New image generated! Send to seeker or edit with [edit].`);
            }
        }
    });

    socket.on('image_approved', function(data) {
        console.log('=== SEEKER IMAGE APPROVED EVENT ===');
        console.log('Event received by seeker:', data);
        
        if (playerRole === 'seeker') {
            console.log('✓ Seeker role confirmed, refreshing image cache');
            
            // Update round display for seeker
            if (data.current_round !== undefined) {
                updateRoundDisplay(data.current_round);
            }
            
            // Refresh the entire image cache from server
            loadSeekerImageCache();
            
            updateGameStatus(`Round ${data.current_round}: Hider has sent you a new image! Look for the hidden object.`);
        }
    });

    socket.on('image_sent', function(data) {
        if (playerRole === 'hider') {
            console.log('Image sent confirmation received:', data);
            
            // Update round display for hider
            if (data.current_round !== undefined) {
                updateRoundDisplay(data.current_round);
            }
            
            addChatMessage(`System: ${data.message}`);
            updateGameStatus(`${data.message} Ready to create Round ${data.current_round + 1} image!`);
        }
    });

    // Add new event listener for round updates
    socket.on('round_updated', function(data) {
        console.log('Round updated event received:', data);
        if (data.current_round !== undefined) {
            updateRoundDisplay(data.current_round);
        }
    });

    // Add new event listener for guess results
    socket.on('guess_result', function(data) {
        console.log('=== GUESS RESULT ===');
        console.log('Result received:', data);
        
        gameOver = true;
        clearInterval(timerInterval);
        
        const overlay = document.getElementById('gameOverlay');
        const result = document.getElementById('gameResult');
        const message = document.getElementById('gameMessage');
        
        if (data.correct) {
            result.textContent = '🎉 ' + data.message + ' 🎉';
            result.style.color = '#28a745';
        } else {
            result.textContent = '😔 ' + data.message + ' 😔';
            result.style.color = '#dc3545';
        }
        
        message.textContent = `The hidden word was: ${data.hidden_word}`;
        overlay.style.display = 'flex';
        
        addChatMessage(`System: Game Over! ${data.message}`);
        addChatMessage(`System: The hidden word was: ${data.hidden_word}`);
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

    // Update hidden button to be a toggle
    hiddenBtn.addEventListener('click', function() {
        const hiddenWordContainer = document.getElementById('hiddenWordContainer');
        const hiddenWordText = document.getElementById('hiddenWordText');
        
        if (!hiddenWordVisible) {
            // Show hidden word
            if (hiddenWord) {
                hiddenWordText.textContent = hiddenWord;
                hiddenWordContainer.style.display = 'block';
                hiddenBtn.textContent = 'Hide Word';
                hiddenBtn.className = 'btn btn-warning';
                hiddenWordVisible = true;
                console.log('Hidden word shown:', hiddenWord);
            }
        } else {
            // Hide hidden word
            hiddenWordContainer.style.display = 'none';
            hiddenBtn.textContent = 'Show Hidden Word';
            hiddenBtn.className = 'btn btn-secondary';
            hiddenWordVisible = false;
            console.log('Hidden word hidden');
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

    // Add guess submission functionality
    const submitGuessBtn = document.getElementById('submitGuessBtn');
    const guessInput = document.getElementById('guessInput');

    if (submitGuessBtn) {
        submitGuessBtn.addEventListener('click', function() {
            const guess = guessInput.value.trim();
            if (guess) {
                console.log('Submitting guess:', guess);
                socket.emit('submit_guess', { guess: guess });
                guessInput.value = '';
                submitGuessBtn.disabled = true;
                submitGuessBtn.textContent = 'Guess Submitted...';
            }
        });
    }

    if (guessInput) {
        guessInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                submitGuessBtn.click();
            }
        });
    }
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
    // For hider: only clear and redraw if not displaying a generated image
    // For seeker: always clear and redraw (image is drawn as background in drawGameElements)
    if (playerRole === 'hider' && displayingImage) {
        // Don't clear the canvas for hider when displaying generated image
    } else {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background grid
        drawGrid();
        
        // Draw game elements (includes seeker image as background)
        if (gameStarted) {
            drawGameElements();
        } else {
            drawWaitingScreen();
        }
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
    // FOR SEEKER: Always draw image grid first (as background layer)
    if (playerRole === 'seeker' && seekerImageCache.length > 0) {
        console.log('Drawing persistent seeker image grid, total images:', seekerImageCache.length);
        
        // Updated grid layout calculation to handle up to 8 images
        let cols, rows;
        if (seekerImageCache.length === 1) {
            cols = 1; rows = 1;
        } else if (seekerImageCache.length === 2) {
            cols = 2; rows = 1;
        } else if (seekerImageCache.length === 3) {
            cols = 3; rows = 1;
        } else if (seekerImageCache.length === 4) {
            cols = 2; rows = 2;
        } else if (seekerImageCache.length === 5) {
            cols = 3; rows = 2;
        } else if (seekerImageCache.length === 6) {
            cols = 3; rows = 2;
        } else if (seekerImageCache.length === 7) {
            cols = 4; rows = 2;
        } else if (seekerImageCache.length === 8) {
            cols = 4; rows = 2;
        } else {
            // For more than 8 images, use a 4-column layout
            cols = 4; 
            rows = Math.ceil(seekerImageCache.length / 4);
        }
        
        console.log(`Grid layout for ${seekerImageCache.length} images: ${cols} columns x ${rows} rows`);
        
        // Calculate cell dimensions with padding - adjust padding based on number of images
        const padding = seekerImageCache.length <= 4 ? 15 : 10; // Smaller padding for more images
        const cellWidth = (canvas.width - (cols + 1) * padding) / cols;
        const cellHeight = (canvas.height - (rows + 1) * padding) / rows;
        
        console.log(`Cell dimensions: ${cellWidth.toFixed(1)} x ${cellHeight.toFixed(1)}`);
        
        // Draw each image in the grid
        for (let i = 0; i < seekerImageCache.length; i++) {
            const img = seekerImageCache[i];
            if (!img) {
                console.log(`Skipping image ${i + 1} - not loaded yet`);
                continue; // Skip if image not loaded yet
            }
            
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            // Calculate position
            const x = padding + col * (cellWidth + padding);
            const y = padding + row * (cellHeight + padding);
            
            // Calculate image dimensions to fit in cell while maintaining aspect ratio
            const imageAspect = img.width / img.height;
            const cellAspect = cellWidth / cellHeight;
            
            let drawWidth, drawHeight, offsetX, offsetY;
            
            if (imageAspect > cellAspect) {
                // Image is wider than cell
                drawWidth = cellWidth;
                drawHeight = cellWidth / imageAspect;
                offsetX = x;
                offsetY = y + (cellHeight - drawHeight) / 2;
            } else {
                // Image is taller than cell
                drawHeight = cellHeight;
                drawWidth = cellHeight * imageAspect;
                offsetX = x + (cellWidth - drawWidth) / 2;
                offsetY = y;
            }
            
            // Draw the image
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            
            // Add a border around each image
            ctx.strokeStyle = '#667eea';
            ctx.lineWidth = seekerImageCache.length <= 4 ? 2 : 1; // Thinner borders for more images
            ctx.strokeRect(offsetX, offsetY, drawWidth, drawHeight);
            
            // Add image number in top-left corner with appropriate font size
            ctx.fillStyle = '#667eea';
            const fontSize = seekerImageCache.length <= 4 ? 14 : 12; // Smaller font for more images
            ctx.font = `${fontSize}px Arial`;
            ctx.textAlign = 'left';
            ctx.fillText(`${i + 1}`, offsetX + 3, offsetY + fontSize + 2);
            
            console.log(`Drew image ${i + 1} at position (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}) with size ${drawWidth.toFixed(1)}x${drawHeight.toFixed(1)}`);
        }
        
        console.log(`✓ Successfully drew ${seekerImageCache.length} images in ${cols}x${rows} grid`);
    }
    
    // Draw hider position (only visible to hider) - OVER the images
    if (hiderPosition && playerRole === 'hider') {
        ctx.fillStyle = '#28a745';
        ctx.beginPath();
        ctx.arc(hiderPosition.x, hiderPosition.y, 20, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#1e7e34';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw "YOU" label - REMOVED
    }
    
    // Draw seeker position ON TOP of images with high visibility
    if (seekerPosition) {
        // Make seeker position more visible on images
        if (playerRole === 'seeker') {
            // Draw a white outline for better visibility on images
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(seekerPosition.x, seekerPosition.y, 17, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw the main seeker dot
            ctx.fillStyle = '#007bff';
            ctx.beginPath();
            ctx.arc(seekerPosition.x, seekerPosition.y, 15, 0, 2 * Math.PI);
            ctx.fill();
        } else {
            ctx.fillStyle = '#6c757d';
            ctx.beginPath();
            ctx.arc(seekerPosition.x, seekerPosition.y, 15, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        ctx.strokeStyle = '#0056b3';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw label with better visibility
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        
        if (playerRole === 'seeker') {
            // "YOU" label removed
        } else {
            ctx.strokeText('SEEKER', seekerPosition.x, seekerPosition.y + 4);
            ctx.fillText('SEEKER', seekerPosition.x, seekerPosition.y + 4);
        }
    }
    
    // Draw proximity hint for seeker ON TOP of everything
    if (proximityHint && playerRole === 'seeker') {
        ctx.fillStyle = 'rgba(255, 193, 7, 0.4)';
        ctx.beginPath();
        ctx.arc(seekerPosition.x, seekerPosition.y, 100, 0, 2 * Math.PI);
        ctx.fill();
        
        // Add proximity hint border
        ctx.strokeStyle = '#ffc107';
        ctx.lineWidth = 3;
        ctx.stroke();
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

function displayGeneratedImage(imagePath) {
    console.log('Displaying NEW image in canvas:', imagePath);
    
    // Set flag to prevent game loop from clearing canvas
    displayingImage = true;
    
    // Create a new image object
    const img = new Image();
    img.onload = function() {
        // Clear the canvas ONLY when displaying a new image
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log('✓ Canvas cleared for new image');
        
        // Calculate dimensions to fit the image in the canvas while maintaining aspect ratio
        const canvasAspect = canvas.width / canvas.height;
        const imageAspect = img.width / img.height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imageAspect > canvasAspect) {
            // Image is wider than canvas
            drawWidth = canvas.width;
            drawHeight = canvas.width / imageAspect;
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
        } else {
            // Image is taller than canvas
            drawHeight = canvas.height;
            drawWidth = canvas.height * imageAspect;
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = 0;
        }
        
        // Draw the image
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        // Add a border around the image
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 3;
        ctx.strokeRect(offsetX, offsetY, drawWidth, drawHeight);
        
        console.log('✓ New image displayed successfully');
    };
    
    img.onerror = function() {
        console.error('Failed to load image:', imagePath);
        displayingImage = false; // Reset flag on error
        // Fallback: show error message on canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#dc3545';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Failed to load image', canvas.width / 2, canvas.height / 2);
    };
    
    // Set the image source
    img.src = imagePath;
}

function loadSeekerImageCache() {
    console.log('=== LOADING SEEKER IMAGE CACHE ===');
    
    fetch(`/api/get_image_cache/${gameId}`)
        .then(response => response.json())
        .then(data => {
            console.log('Image cache data received:', data);
            
            if (data.images && data.images.length > 0) {
                // Clear existing cache
                const previousCount = seekerImageCache.length;
                seekerImageCache = [];
                
                console.log(`Previous cache had ${previousCount} images, loading ${data.images.length} images`);
                
                // Load each image
                let loadedCount = 0;
                data.images.forEach((filename, index) => {
                    const img = new Image();
                    img.onload = function() {
                        seekerImageCache[index] = img;
                        loadedCount++;
                        console.log(`✓ Loaded image ${loadedCount}/${data.images.length}: ${filename}`);
                        
                        if (loadedCount === data.images.length) {
                            console.log('✓ All seeker images loaded - grid will be persistent');
                        }
                    };
                    img.onerror = function() {
                        console.error(`❌ Failed to load image: ${filename}`);
                    };
                    img.src = `/images/${filename}`;
                });
            } else {
                console.log('No images in cache yet');
            }
        })
        .catch(error => {
            console.error('❌ Error fetching image cache:', error);
        });
}

// Add this function to update round display
function updateRoundDisplay(round) {
    const roundInfo = document.getElementById('roundInfo');
    const roundNumber = document.getElementById('roundNumber');
    
    if (roundInfo && roundNumber) {
        roundInfo.style.display = 'block';
        roundNumber.textContent = round;
        console.log('Round display updated to:', round);
    }
}