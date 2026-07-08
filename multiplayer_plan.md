# P2P Multiplayer Implementation Plan: Scotland Yard

## Objective
Transform the existing single-player Scotland Yard game into a seamless Peer-to-Peer (P2P) multiplayer experience using **PeerJS** (WebRTC), allowing two players to connect directly via a shared ID without a central server.

## 1. UI/UX Overhaul (The "Elite" Interface)
We will not just add a button. We will implement a premium, floating "Connection Command Center" using glassmorphism design principles.

- **Visual Style**:
    - Semi-transparent blurred background (`backdrop-filter: blur(10px)`).
    - Subtle white borders and soft shadows.
    - Smooth CSS transitions for appearing/disappearing.
    - High-contrast typography (Inter or system sans-serif).
- **Features**:
    - **Connection Status Indicator**: A glowing dot (Green = Connected, Red = Disconnected/Connecting).
    - **Your ID Display**: A "Copy to Clipboard" button next to the unique Peer ID.
    - **Connect Panel**: A sleek input field and "Connect" button for entering a friend's ID.
    - **Game Info**: Display current player and round in the overlay for quick reference.

## 2. Technical Architecture

### A. PeerJS Integration
- Add PeerJS via CDN in `index.html`.
- Initialize `new Peer()` in `game.js`.
- Implement a global `connection` variable to hold the active `DataConnection`.

### B. Networking Logic
1. **Initialization**: 
   - On `peer.on('open')`, update the UI with the generated ID.
2. **Connection Flow**:
   - **Host**: Starts the game, then shares their ID.
   - **Guest**: Pastes the ID into the UI and clicks "Connect".
   - **Handshake**: Upon connection, the Host immediately sends the current `ssy_var.state` to the Guest to ensure perfect synchronization.
3. **Data Transmission**:
   - We will use the `connection.send()` method to blast the entire `ssy_var.state` object whenever a move is completed.

### C. Synchronization Hooks (The "Magic" Sauce)
The synchronization will be achieved by hooking into the existing game loop:

1. **Outbound (The Trigger)**:
   - Inside `ssy_move()`, after the `ssy_local_store('state')` call, we will add:
     ```javascript
     if (active_connection) {
         active_connection.send(ssy_var.state);
     }
     ```
2. **Inbound (The Update)**:
   - Listen to `connection.on('data')`:
     ```javascript
     connection.on('data', (incomingState) => {
         ssy_var.state = incomingState;
         ssy_ui_redraw();
         ssy_ui_tomoves('history'); // or updated logic
         // Also update move dropdown if necessary
         ssy_ui_fillmove(ssy_var.state.cur.player, ssy_var.state.pos[ssy_var.state.cur.player]);
     });
     ```

## 3. Implementation Phases

### Phase 1: Foundation
- Integrate PeerJS CDN.
- Create the CSS for the glassmorphism overlay.
- Implement the UI elements in `index.html`.

### Phase 2: Networking Core
- Implement `Peer` initialization in `game.js`.
- Create the logic for `peer.on('connection')` and `peer.connect()`.
- Add the UI logic to update the ID and handle the connection button.

### Phase 3: State Sync
- Modify `ssy_move` to send state.
- Add the `on('data')` listener to update local state and trigger visual redraws.
- Ensure `ssy_ui_fillmove` is called correctly upon receiving state so the dropdown reflects the new turn.

### Phase 4: Polishing
- Add "Connection Established" and "Move Sent" micro-animations.
- Ensure responsive design for the new overlay.
- Test edge cases: disconnecting, starting a new game mid-connection, etc.

## 4. Constraints & Assumptions
- **Single Room**: The Peer ID acts as the room ID.
- **Two Players**: Optimized for 1v1 (X vs Detectives).
- **Direct Connection**: Assumes WebRTC can establish a connection (standard for most modern browsers/networks).
