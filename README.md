# SPACE SURVIVAL

A colorful, real-time space-shooter arcade game with two ways to play: a full-screen browser game rendered on HTML Canvas, and the original turn-based Python terminal game. Pilot a stranded ship through a purple nebula, dodge cartoon asteroids and hostile drones, collect energy, and chase a new high score.

## Browser game

The browser version uses only HTML, CSS, and JavaScript. It needs no package installation, build step, or backend; Python's standard-library static server is used to serve the files in Codespaces.

### Launch in GitHub Codespaces

From the repository root, serve the `frontend/` directory:

```bash
python3 -m http.server 8000 --bind 0.0.0.0 --directory frontend
```

In Codespaces, open the **Ports** tab, find port `8000`, and choose **Open in Browser**. If the port is not listed, use **Add Port** and enter `8000`. The server serves `frontend/index.html` at the forwarded port. The server runs in that terminal; stop it with `Ctrl+C` when you are done.

### Features and controls

- Centered arcade start screen with animated nebula, stars, drifting asteroids, and distant ships.
- Steer horizontally with **A/D** or **Left/Right**, and adjust altitude with **R/F**. Hold **W/Up** to accelerate the ship and scroll the world faster; release to coast smoothly back to cruise.
- Hold **S/Down** to brake toward minimum forward speed without reversing the world. Hold **Space** to fire; use **Escape** or **P** to pause/resume.
- Dodge incoming asteroids and enemy projectiles; destroy threats for bonus points.
- Collect glowing energy cells to replenish the weapons supply.
- Track score, survival time, level, hull integrity, and energy in compact arcade HUD elements.
- Use the pause and restart controls to manage a flight. Instructions and high score appear in centered overlays.
- The game-over screen records the final score and time and offers replay or a return to the title.
- The title-screen **QUIT** button opens an in-game exit confirmation; **RETURN TO TITLE** keeps the browser game ready to play.
- On small touch screens, use the on-screen directional and fire controls.
- A best score is stored in the browser's local storage on that device/browser.

Movement and hazards use elapsed-time updates, so the flight speed stays consistent across different frame rates. If browser storage is disabled, the game remains playable but cannot remember a record.

## Original terminal game

The Python game in `python_game/game.py` remains available as a separate turn-based version. It keeps its event choices, resource management, replay flow, and local JSON high score in `python_game/high_score.json`. The browser game does not invoke the Python game; it is a self-contained frontend that adapts the same survival, hull, energy, threat, and scoring ideas to real-time play. `hello.py` remains the original factorial example.

From the repository root, run the terminal game with:

```bash
python3 python_game/game.py
```

For a repeatable random sequence, use `python3 python_game/game.py --seed 42`. Its score is stored in `python_game/high_score.json`, independently of the browser score.

## Tests

Run the standard-library terminal game tests from the repository root with:

```bash
python3 -m unittest discover -s python_game -p 'test_*.py'
```

## Project structure

```text
.
|-- frontend/
|   |-- index.html  # Browser game structure and overlays
|   |-- arcade.js   # Canvas rendering and real-time game logic
|   `-- space.css   # Full-screen arcade interface and responsive controls
|-- python_game/
|   |-- game.py         # Turn-based terminal game
|   |-- test_game.py    # Terminal game tests
|   `-- high_score.json # Terminal game's local record
|-- hello.py            # Original factorial example
|-- README.md
`-- .gitignore
```
