# 🎮 Hide and Seek Game

A real-time 2-player hide and seek game built with Python Flask and WebSocket technology. Players can create games, join via links, and play together in real-time through their browsers.

## Features

- **Real-time gameplay** using WebSocket communication
- **Beautiful modern UI** with responsive design
- **Game state management** with automatic cleanup
- **Chat system** for player communication
- **Proximity hints** to help seekers find hiders
- **Timer system** with 5-minute game duration
- **Cross-platform** - works on desktop and mobile browsers

## How to Play

### Game Setup
1. **Player 1 (Game Creator)**: 
   - Visit the game homepage
   - Click "Create Game" to generate a unique game link
   - Share the link with Player 2
   - Choose your role (Hider or Seeker) and enter your name

2. **Player 2 (Joiner)**:
   - Click the shared link or enter the game ID manually
   - Choose the opposite role and enter your name
   - Both players will be redirected to the game page

### Gameplay
- **Hider**: Click on the map to choose your hiding spot, then click "I'm Hidden!"
- **Seeker**: Click on the map to move around and search for the hider
- **Proximity System**: The seeker gets hints ("Very close!", "Getting warmer...", "Cold...") based on distance to the hider
- **Time Limit**: 5 minutes - if the seeker doesn't find the hider in time, the hider wins!
- **Chat**: Use the chat panel to communicate with your opponent

## Installation & Setup

### Prerequisites
- Python 3.7 or higher
- pip (Python package installer)

### Installation Steps

1. **Clone or download the project files**

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the game server**:
   ```bash
   python app.py
   ```

4. **Access the game**:
   - Open your browser and go to `http://localhost:5000`
   - The server will be accessible on your local network at `http://[your-ip]:5000`

## How to Run as Two Players

### Method 1: Same Computer (Two Browser Tabs)
1. Start the server: `python app.py`
2. Open two browser tabs/windows
3. In the first tab: Create a game and copy the link
4. In the second tab: Paste the link to join
5. Choose different roles and start playing!

### Method 2: Different Computers (Local Network)
1. Start the server: `python app.py`
2. Find your computer's IP address:
   - **Mac/Linux**: `ifconfig` or `ip addr`
   - **Windows**: `ipconfig`
3. Player 1: Open `http://[your-ip]:5000` in their browser
4. Player 2: Open the same URL in their browser
5. Create and join the game as described above

### Method 3: Internet (Port Forwarding)
1. Configure your router to forward port 5000 to your computer
2. Use your public IP address instead of localhost
3. Both players can access the game from anywhere on the internet

## Game Rules

- **Objective**: The seeker must find the hider before time runs out
- **Time Limit**: 5 minutes per round
- **Detection**: Seeker wins if they get within 50 pixels of the hider
- **Hints**: Seeker receives proximity hints based on distance:
  - "Very close!" (within 100 pixels)
  - "Getting warmer..." (within 200 pixels)
  - "Cold..." (within 300 pixels)
- **Winning**: 
  - Seeker wins by finding the hider
  - Hider wins if time runs out
- **Restart**: Both players can restart the game after it ends

## Technical Details

### Architecture
- **Backend**: Flask with Flask-SocketIO for real-time communication
- **Frontend**: HTML5 Canvas for game rendering, vanilla JavaScript
- **Communication**: WebSocket for real-time updates
- **Styling**: Modern CSS with responsive design

### File Structure
```
hide_and_seek/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── templates/            # HTML templates
│   ├── index.html        # Homepage
│   ├── join.html         # Join game page
│   ├── game.html         # Main game page
│   └── error.html        # Error page
└── static/               # Static assets
    ├── css/
    │   └── style.css     # Main stylesheet
    └── js/
        ├── index.js      # Homepage JavaScript
        ├── join.js       # Join page JavaScript
        └── game.js       # Game logic JavaScript
```

### Key Features
- **Session Management**: Players are tracked with unique IDs
- **Room-based Communication**: Each game has its own WebSocket room
- **State Synchronization**: Game state is synchronized between players
- **Error Handling**: Graceful handling of disconnections and errors
- **Responsive Design**: Works on desktop and mobile devices

## Troubleshooting

### Common Issues

1. **"Module not found" errors**:
   - Make sure you've installed all dependencies: `pip install -r requirements.txt`

2. **Can't connect to the game**:
   - Check if the server is running on the correct port
   - Ensure firewall settings allow connections on port 5000
   - Try using `localhost` instead of IP address for local testing

3. **Players can't see each other**:
   - Make sure both players are using the same game ID
   - Check that WebSocket connections are established (check browser console)

4. **Game not starting**:
   - Ensure both players have joined and selected different roles
   - Check that the "Start Game" button appears for both players

### Debug Mode
To run with debug information:
```bash
export FLASK_ENV=development
python app.py
```

## Contributing

Feel free to fork this project and add new features like:
- Different game modes
- Multiple hiders/seekers
- Power-ups and special abilities
- Sound effects and music
- Leaderboards and statistics
- Custom maps and obstacles

## License

This project is open source and available under the MIT License. 