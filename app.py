from flask import Flask, render_template, request, jsonify, session, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
import random
import uuid
from datetime import datetime
import json
import replicate
import os
import random
import string
from pyngrok import ngrok


app = Flask(__name__)
app.config['SECRET_KEY'] = 'hide_and_seek_secret_key_2024'
socketio = SocketIO(app, cors_allowed_origins="*")

# Game state
games = {}
players = {}

class Game:
    def __init__(self, game_id):
        self.game_id = game_id
        self.hider = None
        self.seeker = None
        self.hider_position = None
        self.seeker_position = None
        self.game_started = False
        self.game_over = False
        self.winner = None
        self.start_time = None
        self.max_time = 1800  # 30 minutes
        self.hider_hidden = False
        self.seeker_found = False
        self.max_rounds = 5
        self.current_round = 0
        self.prompt = ""
        self.seeker_prompt = ""
        self.image_cache = []
        self.folder_name =  ''.join(random.choices(string.ascii_letters + string.digits, k=6))
        self.folder_name = f"gameplays/game_play_{self.folder_name}"
        os.makedirs(self.folder_name, exist_ok=True)
        print(f"Folder created: {self.folder_name}")
        self.current_image_path = None
        self.image_approved = False
        self.hidden_word = self.generate_hidden_word()
        self.current_image_sent = True  # Add this line - allows first image generation
    
    def generate_hidden_word(self):
        """Generate a random hidden word for the game"""
        words = ["hat", "flower", "bottle", "bunny", "diamond", "cat", "balloon", "pencil", "jacket" ]
        return random.choice(words)
    
    def get_image_from_prompt(self):
        """
        Get an image from a prompt using the Flux Kontext Pro model.
        """
        print("running get_image_from_prompt")
        print(self.prompt)
        
        if len(self.prompt) > 0:
            input_data = {
                "prompt": self.prompt,
                "output_format": "png"
            }
            
            is_edit = "[edit]" in self.prompt
            
            if is_edit and self.current_round > 0 and self.image_cache:
                print(f"EDITING existing image for round {self.current_round}")
                prev_img = open(self.image_cache[-1], "rb")
                input_data["input_image"] = prev_img
                user_prompt = self.prompt.replace("[edit]", "").strip()
                input_data["prompt"] = user_prompt
                # Don't increment round for edits
            else:
                print(f"CREATING new image, incrementing round from {self.current_round} to {self.current_round + 1}")
                self.current_round += 1
                
            print(input_data)

            output = replicate.run("black-forest-labs/flux-kontext-pro", input=input_data)
            print("ran this")
            
            # Save the generated image with timestamp
            output_filename = f"output_mod_{self.current_round}.png" 
            impath = os.path.join(self.folder_name, output_filename)
            with open(impath, "wb") as file:
                file.write(output.read())
            
            # Save the prompt to a text file
            prompt_file = os.path.join(self.folder_name, "prompts.txt")
            with open(prompt_file, "a") as f:
                f.write(f"Hider {self.current_round}: {self.prompt}\nSeeker {self.current_round}: {self.seeker_prompt}\n")
            
            if is_edit:
                # For edits: REPLACE the last image in cache instead of adding
                print(f"REPLACING last image in cache with edited version")
                if self.image_cache:
                    self.image_cache[-1] = impath  # Replace the last image
                else:
                    self.image_cache.append(impath)  # Fallback if cache is empty
            else:
                # For new images: ADD to cache
                print(f"ADDING new image to cache")
                self.image_cache.append(impath)
            
            self.current_image_path = impath
            self.image_approved = False
            
            print(f"Image cache now contains: {self.image_cache}")
            
            return impath
        return None



@app.route('/')
def index():
    return render_template('index.html')

@app.route('/join/<game_id>')
def join_game(game_id):
    if game_id not in games:
        return render_template('error.html', message="Game not found!")
    
    game = games[game_id]
    if game.hider and game.seeker:
        return render_template('error.html', message="Game is full!")
    
    return render_template('join.html', game_id=game_id)

@app.route('/game/<game_id>')
def game_page(game_id):
    if game_id not in games:
        return render_template('error.html', message="Game not found!")
    
    return render_template('game.html', game_id=game_id)

@app.route('/api/create_game', methods=['POST'])
def create_game():
    game_id = str(uuid.uuid4())[:8]
    games[game_id] = Game(game_id)
    return jsonify({'game_id': game_id, 'join_url': f'/join/{game_id}'})

@app.route('/api/join_game', methods=['POST'])
def join_game_api():
    data = request.get_json()
    game_id = data.get('game_id')
    player_name = data.get('player_name')
    role = data.get('role')  # 'hider' or 'seeker'
    
    if game_id not in games:
        return jsonify({'error': 'Game not found'}), 404
    
    game = games[game_id]
    
    if role == 'hider' and game.hider:
        return jsonify({'error': 'Hider already joined'}), 400
    elif role == 'seeker' and game.seeker:
        return jsonify({'error': 'Seeker already joined'}), 400
    
    player_id = str(uuid.uuid4())
    players[player_id] = {
        'name': player_name,
        'role': role,
        'game_id': game_id,
        'sid': None
    }
    
    if role == 'hider':
        game.hider = player_id
    else:
        game.seeker = player_id
    
    session['player_id'] = player_id
    session['game_id'] = game_id
    session['role'] = role
    session['player_name'] = player_name
    
    return jsonify({
        'player_id': player_id,
        'game_id': game_id,
        'role': role,
        'redirect': f'/game/{game_id}'
    })

@socketio.on('connect')
def handle_connect():
    player_id = session.get('player_id')
    if player_id and player_id in players:
        players[player_id]['sid'] = request.sid
        game_id = players[player_id]['game_id']
        join_room(game_id)
        
        # Notify other player
        emit('player_joined', {
            'player_name': players[player_id]['name'],
            'role': players[player_id]['role']
        }, room=game_id)

@socketio.on('disconnect')
def handle_disconnect():
    player_id = session.get('player_id')
    if player_id and player_id in players:
        game_id = players[player_id]['game_id']
        leave_room(game_id)
        
        # Remove player from game
        if game_id in games:
            game = games[game_id]
            if game.hider == player_id:
                game.hider = None
            elif game.seeker == player_id:
                game.seeker = None
            
            # Notify other player
            emit('player_left', {
                'player_name': players[player_id]['name'],
                'role': players[player_id]['role']
            }, room=game_id)
        
        del players[player_id]

@socketio.on('start_game')
def handle_start_game():
    player_id = session.get('player_id')
    if not player_id or player_id not in players:
        return
    
    game_id = players[player_id]['game_id']
    if game_id not in games:
        return
    
    game = games[game_id]
    
    if not game.hider or not game.seeker:
        emit('error', {'message': 'Need both hider and seeker to start'})
        return
    

    game.game_started = True
    game.start_time = datetime.utcnow()
    
    # Generate random positions
    game.hider_position = {
        'x': random.randint(50, 750),
        'y': random.randint(50, 550)
    }
    game.seeker_position = {
        'x': random.randint(50, 750),
        'y': random.randint(50, 550)
    }
    
    print(f"Game started - Current round: {game.current_round}")
    
    # Send to all players in the room with current round
    emit('game_started', {
        'hider_position': game.hider_position,
        'seeker_position': game.seeker_position,
        'start_time': game.start_time.isoformat() + 'Z',
        'max_time': game.max_time,
        'current_round': game.current_round,
        'hidden_word': game.hidden_word
    }, room=game_id)

@socketio.on('hider_hidden')
def handle_hider_hidden():
    player_id = session.get('player_id')
    if not player_id or player_id not in players:
        return
    
    game_id = players[player_id]['game_id']
    if game_id not in games:
        return
    
    game = games[game_id]
    game.hider_hidden = True
    
    # Notify seeker that hider is hidden
    emit('hider_is_hidden', room=game_id)

@socketio.on('seeker_move')
def handle_seeker_move(data):
    player_id = session.get('player_id')
    if not player_id or player_id not in players:
        return
    
    game_id = players[player_id]['game_id']
    if game_id not in games:
        return
    
    game = games[game_id]
    game.seeker_position = data['position']
    
    # Check if seeker found hider
    if game.hider_hidden and game.hider_position:
        distance = ((game.seeker_position['x'] - game.hider_position['x']) ** 2 + 
                   (game.seeker_position['y'] - game.hider_position['y']) ** 2) ** 0.5
        
        if distance < 50:  # Detection radius
            game.game_over = True
            game.winner = 'seeker'
            game.seeker_found = True
            
            emit('game_over', {
                'winner': 'seeker',
                'message': 'Seeker found the hider!'
            }, room=game_id)
        else:
            # Send proximity hint
            if distance < 100:
                emit('proximity_hint', {'distance': 'Very close!'}, room=game_id)
            elif distance < 200:
                emit('proximity_hint', {'distance': 'Getting warmer...'}, room=game_id)
            elif distance < 300:
                emit('proximity_hint', {'distance': 'Cold...'}, room=game_id)

@socketio.on('time_up')
def handle_time_up():
    player_id = session.get('player_id')
    if not player_id or player_id not in players:
        return
    
    game_id = players[player_id]['game_id']
    if game_id not in games:
        return
    
    game = games[game_id]
    if not game.game_over:
        game.game_over = True
        game.winner = 'hider'
        
        emit('game_over', {
            'winner': 'hider',
            'message': 'Time is up! Hider wins!'
        }, room=game_id)

@socketio.on('restart_game')
def handle_restart_game():
    player_id = session.get('player_id')
    if not player_id or player_id not in players:
        return
    
    game_id = players[player_id]['game_id']
    if game_id not in games:
        return
    
    # Reset game state
    game = games[game_id]
    game.hider_position = None
    game.seeker_position = None
    game.game_started = False
    game.game_over = False
    game.winner = None
    game.start_time = None
    game.hider_hidden = False
    game.seeker_found = False
    game.current_round = 0  # Reset round
    game.prompt = ""
    game.seeker_prompt = ""
    game.image_cache = []  # Clear image cache
    game.current_image_path = None
    game.image_approved = False
    game.hidden_word = game.generate_hidden_word()  # Generate new hidden word
    
    emit('game_restarted', {
        'current_round': game.current_round
    }, room=game_id)

@socketio.on('seeker_sentence')
def handle_seeker_sentence(data):
    player_id = session.get('player_id')
    if not player_id or player_id not in players:
        return

    game_id = players[player_id]['game_id']
    if game_id not in games:
        return

    game = games[game_id]
    # Find hider's session id
    hider_id = game.hider
    game.seeker_prompt = data.get('sentence', '')
    if hider_id and hider_id in players:
        hider_sid = players[hider_id]['sid']
        emit('show_sentence', {'sentence': data['sentence']}, room=hider_sid)

@socketio.on('hider_prompt')
def handle_hider_prompt(data):
    player_id = session.get('player_id')
    if not player_id or player_id not in players:
        return

    game_id = players[player_id]['game_id']
    if game_id not in games:
        return

    game = games[game_id]
    # Only allow hider to set the prompt
    if game.hider == player_id:
        # Safety check: add current_image_sent attribute if it doesn't exist
        if not hasattr(game, 'current_image_sent'):
            game.current_image_sent = True
            print("Added missing current_image_sent attribute to existing game")
        
        game.prompt = data.get('prompt', '')
        print(f"Hider prompt: '{game.prompt}'")
        print(f"Current image sent status: {game.current_image_sent}")
        print(f"Current round: {game.current_round}")
        
        is_edit = "[edit]" in game.prompt
        
        # Check if hider is trying to generate a new image without sending the previous one
        # Allow if: 1) No previous image exists, 2) Previous image was sent, 3) Using [edit]
        if not game.current_image_sent and not is_edit and game.current_round > 0:
            print("❌ ERROR: Hider must send current image to seeker or use [edit] to modify it")
            emit('generation_blocked', {
                'message': 'You must send your current image to the seeker first, or use [edit] to modify it!',
                'requires_edit': True
            }, room=request.sid)
            return
        
        print(f"✓ Generation allowed. Is edit: {is_edit}")
        image_path = game.get_image_from_prompt()
        
        if image_path:
            print(f"Current round after generation: {game.current_round}")
            
            # Mark that an image has been generated but not sent
            # For new images (not edits), mark as not sent
            # For edits, keep the current sent status (could be False if editing before sending)
            if not is_edit:
                game.current_image_sent = False
                print("New image generated - marked as not sent")
            else:
                print(f"Image edited - keeping current sent status: {game.current_image_sent}")
            
            # Send the generated image to the hider for preview
            emit('image_generated', {
                'image_path': image_path,
                'is_edit': is_edit,
                'current_round': game.current_round,
                'can_generate_new': game.current_image_sent or is_edit  # Can generate if sent OR if this is an edit
            }, room=request.sid)
            
            # Also update round for both players
            emit('round_updated', {
                'current_round': game.current_round
            }, room=game_id)

@socketio.on('approve_image')
def handle_approve_image():
    print("=== APPROVE IMAGE EVENT RECEIVED ===")
    
    player_id = session.get('player_id')
    if not player_id or player_id not in players:
        return

    game_id = players[player_id]['game_id']
    if game_id not in games:
        return

    game = games[game_id]
    
    # Safety check: add current_image_sent attribute if it doesn't exist
    if not hasattr(game, 'current_image_sent'):
        game.current_image_sent = False  # Assume not sent if missing
        print("Added missing current_image_sent attribute to existing game")
    
    print(f"Current round: {game.current_round}")
    print(f"Current image sent status before approval: {game.current_image_sent}")
    
    # Only allow hider to approve image
    if game.hider == player_id and game.current_image_path:
        print("✓ Hider authorized, approving image")
        game.image_approved = True
        game.current_image_sent = True  # Mark current round's image as sent
        print(f"✓ Round {game.current_round} image marked as sent to seeker")
        
        # Send the approved image to the seeker
        seeker_id = game.seeker
        if seeker_id and seeker_id in players:
            seeker_sid = players[seeker_id]['sid']
            
            image_data = {
                'image_path': game.current_image_path,
                'prompt': game.prompt,
                'current_round': game.current_round
            }
            print(f"Sending image data to seeker: {image_data}")
            
            emit('image_approved', image_data, room=seeker_sid)
            print("✓ Image approved event sent to seeker")
        else:
            print("❌ ERROR: Seeker not found or no session ID")
        
        # Notify hider that image was sent
        emit('image_sent', {
            'message': f'Round {game.current_round} image sent to seeker!',
            'current_round': game.current_round,
            'can_generate_new': True  # Now hider can generate new images for next round
        }, room=request.sid)
        
        # Update round display for both players
        emit('round_updated', {
            'current_round': game.current_round
        }, room=game_id)
        
        print("✓ Confirmation sent to hider - ready for next round")
    else:
        print("❌ ERROR: Not authorized or no current image path")
        print(f"Is hider? {game.hider == player_id}")
        print(f"Has current image? {bool(game.current_image_path)}")

# Add route to serve images
@app.route('/images/<path:filename>')
def serve_image(filename):
    print(f"=== IMAGE REQUEST DEBUG ===")
    print(f"Requesting image: {filename}")
    print(f"Number of games: {len(games)}")
    
    # Find the game that contains this image
    for game_id, game in games.items():
        print(f"\nChecking game {game_id}:")
        print(f"  Folder: {game.folder_name}")
        print(f"  Image cache: {game.image_cache}")
        
        # Check if any image in the cache contains this filename
        for image_path in game.image_cache:
            print(f"  Checking path: {image_path}")
            if filename in image_path:
                print(f"  ✓ MATCH FOUND! Serving from {game.folder_name}")
                return send_from_directory(game.folder_name, filename)
    
    print(f"❌ Image {filename} not found in any game")
    return "Image not found", 404

@app.route('/api/get_image_cache/<game_id>')
def get_image_cache(game_id):
    print(f"=== GET IMAGE CACHE REQUEST ===")
    print(f"Game ID: {game_id}")
    
    if game_id not in games:
        print("❌ Game not found")
        return jsonify({'error': 'Game not found'}), 404
    
    game = games[game_id]
    print(f"Image cache: {game.image_cache}")
    
    # Convert full paths to just filenames for the frontend
    image_filenames = [path.split('/')[-1] for path in game.image_cache]
    print(f"Image filenames: {image_filenames}")
    
    return jsonify({
        'images': image_filenames,
        'total': len(image_filenames)
    })

@socketio.on('submit_guess')
def handle_submit_guess(data):
    print("=== GUESS SUBMITTED ===")
    
    player_id = session.get('player_id')
    if not player_id or player_id not in players:
        print("❌ ERROR: Player ID not found")
        return

    game_id = players[player_id]['game_id']
    if game_id not in games:
        print("❌ ERROR: Game not found")
        return

    game = games[game_id]
    
    # Only allow seeker to submit guess
    if game.seeker != player_id:
        print("❌ ERROR: Only seeker can submit guess")
        return
    
    guess = data.get('guess', '').strip().lower()
    hidden_word = game.hidden_word.lower()
    
    print(f"Seeker's guess: '{guess}'")
    print(f"Hidden word: '{hidden_word}'")
    
    if guess == hidden_word:
        print("✓ CORRECT GUESS! Seeker wins!")
        # Seeker guessed correctly
        game.game_over = True
        game.winner = 'seeker'
        
        # Send win message to seeker
        seeker_id = game.seeker
        if seeker_id and seeker_id in players:
            seeker_sid = players[seeker_id]['sid']
            emit('guess_result', {
                'correct': True,
                'message': 'You Win!',
                'hidden_word': game.hidden_word
            }, room=seeker_sid)
        
        # Send lose message to hider
        hider_id = game.hider
        if hider_id and hider_id in players:
            hider_sid = players[hider_id]['sid']
            emit('guess_result', {
                'correct': False,
                'message': 'You Lose!',
                'hidden_word': game.hidden_word
            }, room=hider_sid)
            
    else:
        print("❌ WRONG GUESS! Hider wins!")
        # Seeker guessed wrong
        game.game_over = True
        game.winner = 'hider'
        
        # Send lose message to seeker with correct word
        seeker_id = game.seeker
        if seeker_id and seeker_id in players:
            seeker_sid = players[seeker_id]['sid']
            emit('guess_result', {
                'correct': False,
                'message': f'You Lose! The word was {game.hidden_word}',
                'hidden_word': game.hidden_word
            }, room=seeker_sid)
        
        # Send win message to hider
        hider_id = game.hider
        if hider_id and hider_id in players:
            hider_sid = players[hider_id]['sid']
            emit('guess_result', {
                'correct': True,
                'message': 'Great job hiding ;)',
                'hidden_word': game.hidden_word
            }, room=hider_sid)
    
    print(f"Game over. Winner: {game.winner}")


if __name__ == '__main__':
    # ngrok.set_auth_token('2ysO3aRPEly7aFCwXN5dukHjvou_6bggWr5rwF87LYjcYG9jt')
    # public_url = ngrok.connect(8080)
    # print(f" * ngrok tunnel: {public_url}")
    socketio.run(app, debug=True, host='0.0.0.0', port=8080)