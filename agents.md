# Scotland Yard Game Architecture Analysis

## Core Data Structures

### 1. `ssy_var` (Global State Container)
The entire game state is managed within this object:
- `config`: Static game data (node positions, possible moves, start positions).
- `ui`: User interface settings (scaling, brightness, etc.).
- `state`: The dynamic, living state of the current game.

### 2. `ssy_var.state` (The Source of Truth)
This is the critical object for multiplayer synchronization. It contains:
- `cur`: Current game status.
    - `what`: Current phase (`'play'` or `'end'`).
    - `round`: Current round number.
    - `player`: Index of the player whose turn it is.
- `last2`: Tracking for the "double move" special rule.
- `moves`: Remaining move types for each player.
- `pos`: Array of current node indices for all players.
- `history`: A deep history of all moves made, structured by round.

## Key Functional Modules

### 1. Game Engine (Logic)
- `ssy_init()`: Bootstraps the game, loads configurations, and restores state from `localStorage`.
- `ssy_start()`: Resets the state for a new game, randomizing initial positions.
- `ssy_step()`: The state machine transitioner. It handles turn rotation, round incrementing, and win/loss condition checking.
- `ssy_move()`: The primary action function. It processes user input (selected move, special move toggles), updates the `state`, and triggers the next step.
- `ssy_int_possible_moves()`: Logic for calculating valid next steps based on the current player and position.

### 2. Rendering Engine (UI/Visuals)
- `ssy_ui_redraw()`: The main synchronization function between `state` and the DOM. It updates player SVG positions on the map and highlights the current player.
- `ssy_ui_fillmove()`: Updates the dropdown menu with valid next moves.
- `ssy_ui_tomoves()`: Manages the history log list in the sidebar.
- `ssy_ui_qr()`: Generates QR codes for the "Mr. X" player (to facilitate manual move entry/obscurity).

### 3. Persistence Layer
- `ssy_local_store()` / `ssy_local_get()`: Uses `localStorage` to ensure the game persists through page refreshes.

## Multiplayer Integration Points

To transform this into a P2P game, we must intercept and synchronize the following:
1. **State Injection**: When a connection is established, the host's `ssy_var.state` must be sent to the client.
2. **Action Broadcast**: Inside `ssy_move()`, the updated `ssy_var.state` must be serialized and sent over the WebRTC data channel.
3. **State Reception**: A listener on the data channel must catch incoming state objects, overwrite the local `ssy_var.state`, and trigger `ssy_ui_redraw()` and `ssy_ui_tomoves()` to synchronize the visual experience.
