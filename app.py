from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit, join_room, leave_room
import random
import uuid
from datetime import datetime
import json

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
        self.max_time = 600  # 10 minutes
        self.hider_hidden = False
        self.seeker_found = False
        self.max_rounds = 5
        self.current_round = 0
        self.prompt = ""


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
    game.start_time = datetime.now()
    
    # Generate random positions
    game.hider_position = {
        'x': random.randint(50, 750),
        'y': random.randint(50, 550)
    }
    game.seeker_position = {
        'x': random.randint(50, 750),
        'y': random.randint(50, 550)
    }
    
    # Send positions to respective players
    hider_data = {
        'hider_position': game.hider_position,
        'start_time': game.start_time.isoformat(),
        'max_time': game.max_time,
        'current_round': game.current_round
    }
    seeker_data = {
        'seeker_position': game.seeker_position,
        'start_time': game.start_time.isoformat(),
        'max_time': game.max_time,
        'current_round': game.current_round
    }
    
    emit('game_started', hider_data, room=game_id)

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
    game.current_round = 0
    game.prompt = ""
    
    emit('game_restarted', room=game_id)

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
        game.prompt = data.get('prompt', '')

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=8080)