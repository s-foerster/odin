# Project Architecture Overview

This document outlines the architecture of the OdinCardClash project. 
If you find any missing or incorrect information in this document, please update it to ensure accuracy and completeness.

## Structure

The project follows a monorepo structure with three main directories:

1.  **`client/`**: Contains the frontend React application.
2.  **`server/`**: Contains the backend Node.js/Express application.
3.  **`shared/`**: Contains code shared between the client and server, primarily TypeScript types and schemas.

## Server (`server/`)

The server is built using Node.js and Express. It handles game logic, manages game state, and communicates with clients via HTTP API endpoints and WebSockets.

*   **`index.ts`**: The main entry point for the server. Sets up the Express app, WebSocket server, and integrates routes.
*   **`routes.ts`**: Defines the HTTP API routes for actions like creating games, joining games, playing cards, passing turns, etc. It uses Zod for request validation. Also handles WebSocket message routing and broadcasts events to game participants.
*   **`game.ts`**: Generates the 4-digit room codes and filters the game state for each player (other hands and the deck are hidden). The rules themselves live in `shared/engine.ts`.
*   **`storage.ts`**: Manages the persistence of game state. Game actions (`playCards`, `pickCard`, `passTurn`, `startGame`, `startNewRound`) call the shared engine and turn its `RuleError` into `GameError`. Also `addBot`, `removePlayer`, `deleteGame` (frees the room code). The current implementation (`MemStorage`) stores game data in memory. It provides methods for creating, retrieving, and updating game and player data, as well as chat message and voice message storage.
*   **`vite.ts`**: Handles integration with Vite, likely for serving the client application in development or managing server-side rendering aspects if applicable.

### Server Storage Implementation

The `MemStorage` class in `storage.ts` handles various aspects of game data:

* **Game State**: Stores complete game state including players, cards, and round information
* **Room Codes**: Maps 4-digit room codes (e.g. `0427`) to internal game IDs. Finished games are deleted after 30 min, games with no human connected after 2 h (`cleanupGames` in `routes.ts`), which frees their code.
* **Chat History**: Maintains chat message history per game with a 100-message limit
* **Voice Messages**: Stores voice message binary data with TTL (time-to-live) cleanup

### WebSocket Communication

The server uses the `ws` library for WebSocket communication with a custom implementation:

* **Connection Management**: Tracks active connections in a map of game ID → player ID → WebSocket
* **Message Routing**: Routes different message types (game state updates, chat messages, etc.)
* **Connection Health**: Implements ping/pong for connection health monitoring
* **Reconnection Logic**: Handles player reconnection and game state synchronization

### Bots (online)

* The host adds or removes bots in the lobby (`POST /api/games/:id/bots`, `POST /api/games/:id/bots/remove`).
* Bots are regular players with `isBot: true`. After every state change, `scheduleBots()` in `routes.ts` plays the bot's turn after 0.9 s with `chooseBotAction()` from `shared/bot.ts`.
* Bots never become host and do not count as "connected humans" for cleanup.

### Battery-friendly real time

* The server sends the full (filtered) game state over WebSocket after each action; the client writes it straight into React Query (`useOnlineGame`), with no polling.
* The client only polls the API (every 10 s) when the WebSocket is down and the page is visible.
* Server ping every 25 s, a player is marked disconnected after 70 s without answer.

## Client (`client/`)

The client is a single-page application built with React and Vite. It interacts with the server API to send player actions and receives real-time game state updates via WebSockets.

*   **`index.html`**: The main HTML entry point.
*   **`src/main.tsx`**: The entry point for the React application, rendering the root `App` component.
*   **`src/App.tsx`**: The root React component, responsible for setting up routing (using `wouter`) and global providers.
*   **`src/components/`**: Contains reusable UI components organized in several categories:
    * **`ui/`**: Core UI components (buttons, cards, inputs, etc.)
    * **`modals/`**: Modal components (round end, game end, card picking, etc.)
    * Game-specific components (lobby screen, game screen, etc.)
*   **`src/pages/`**: Contains top-level components for different application views (e.g., `Home`, `Game`).
*   **`src/hooks/`**: Custom React hooks for component logic, including:
    * **`useAudioRecorder`**: Manages microphone access and voice recording
    * **`useToast`**: Notification system
    * Query and mutation hooks for API interactions
*   **`src/lib/`**: Utility functions, API client setup, and WebSocket connection management:
    * **`websocket.ts`**: Handles WebSocket connection, reconnection, and message dispatching
    * **`queryClient.ts`**: React Query setup and API request utilities
    * **`card-utils.ts`**: Card validation and sorting utilities
*   **`src/styles/`**: CSS files including animations and UI component styles.

### Mobile UI

* **`components/game-board.tsx`**: the game screen shared by online and offline modes. Mobile-first layout on one screen (`100dvh`): compact header, opponents as chips (cards left, score, turn highlight), the cards to beat in the middle with their value, Pass / Play buttons with a hint line, the hand at the bottom (sortable by color or value).
* One tap selects a card; tapping an incompatible card replaces the selection. The Play button shows the value ("Play 53") and is only enabled when the play is valid.
* Picking a card after beating a play: the cards appear in the middle and one tap keeps the card (no confirmation).
* No looping animation (battery); `prefers-reduced-motion` is respected; the audio context is suspended between sounds.

### Offline mode

* Route `/offline` (`offline-setup-screen.tsx`): 1 to 6 players on the same phone + bots. Route `/offline/play` (`local-game-screen.tsx`): the game runs in the browser with `shared/engine.ts` and `shared/bot.ts`, saved in `localStorage` (`odin.local.v1`) so it can be resumed.
* Several humans on one phone: a full-screen "pass the phone" cover hides the hand between turns.
* `vite.config.ts` generates `sw.js` (service worker) at build time: it precaches every built file so the site opens with no network (airplane mode) after a first visit. `/api` and `/ws` are never cached. `client/public/manifest.webmanifest` makes it installable on the home screen.
* Two phones without internet are not possible from a web page (no server between them); that would need the native app (Capacitor) with local network or Bluetooth.

### Component Organization

The client follows a component-based architecture with:

1. **Screen Components**: Top-level views (CreateGameScreen, LobbyScreen, GameScreen)
2. **Feature Components**: Domain-specific components (ChatPanel, PlayerHand)
3. **UI Components**: Reusable UI elements (Button, Card, Input)
4. **Modal Components**: Dialog screens for game events (RoundEndModal, GameEndModal)
5. **Shared Components**: Used across multiple screens (ChatButton, RoomCodeDisplay)

### Game Flow and State Management

Game flow follows several distinct states:

1. **Home**: Entry point with options to create or join a game online, or play offline
2. **Game Creation**: Name + point limit, then straight to the lobby
3. **Lobby**: Shows the 4-digit code in large type (tap to share), the players, and for the host: add/remove bots, start
4. **Gameplay**: The main game interface with player turns and card interactions
5. **Round End**: Displayed when a player empties their hand, showing scores
6. **Game End**: Shown when a player reaches the point limit

State management uses:
* **React Query**: For API data fetching and caching
* **Local Component State**: For UI state
* **WebSocket Events**: For real-time updates
* **Session Storage**: For persisting game credentials between page refreshes

## Chat and Voice Messaging System

The project includes a complete chat system with text and voice messaging:

### Text Chat
* Available across all game states (lobby, gameplay, round end)
* Real-time message broadcasting via WebSockets
* Unread message tracking with badge indicators

### Voice Messaging
* Uses the MediaRecorder API to capture audio from the user's microphone
* Uploads audio as WebM format to the server via form data
* Server stores voice messages with TTL for automatic cleanup
* Client-side playback with progress tracking and waveform visualization

### Chat UI Components
* **`ChatPanel`**: Main chat interface with message list and input
* **`ChatButton`**: Floating button with unread count indicator
* **`VoiceMessage`**: Audio message player with playback controls

## Shared (`shared/`)

This directory contains code intended to be used by both the client and server.

*   **`engine.ts`**: The Odin rules, as pure functions with no dependency (used by the server for online games and by the browser for offline games): deck, deal, `checkPlay` / `applyPlay`, `applyPick`, `checkPass` / `applyPass`, `listValidPlays`, scoring. Error codes are translation keys (`error.card.mustPlayHigherValue`…).
    * Play value = digits sorted in descending order (5 and 3 → 53). A play must have the same number of cards or one more, and a strictly higher value. The first play on an empty table is a single card.
    * When a player beats a play of 2+ cards, they keep one of those cards (`applyPick`); with a single card the pick is automatic.
    * **Two-player rule**: with exactly 2 active players, you cannot pass when you can play and your opponent has exactly 2 cards left (`isTwoPlayerForcedPlay`).
*   **`bot.ts`**: Bot AI (`chooseBotAction`): finishes the hand when possible, otherwise plays as many cards as possible with the lowest sufficient value; opens with its most isolated card; keeps the card that combines best with its hand.
*   `scripts/simulate.ts` (`npm run simulate`) plays 1,000 bot games to check the engine (card count, two-player rule, no infinite loop).

*   **`schema.ts`**: Defines shared TypeScript interfaces and Zod schemas for:
    * Game state structures (`GameState`, `Player` (now includes `isSpectator?: boolean`), `Card`)
    * API request/response types (e.g., `JoinGameRequest` now includes `joinAsSpectator?: boolean`)
    * WebSocket message types (including `spectator_joined`)
    * Chat message interfaces with support for both text and voice messages

## Technology Stack

*   **Frontend**: React, Vite, TypeScript, Tailwind CSS, `tanstack/react-query`, `wouter` (routing)
*   **Backend**: Node.js, Express, TypeScript, `ws` (WebSockets), Zod, Multer (file uploads)
*   **Shared**: TypeScript, Zod
*   **Audio**: Web Audio API, MediaRecorder API
*   **Build/Tooling**: Vite, npm

## Communication Flow

1.  Client connects to the server via HTTP and WebSocket.
2.  Player actions (join game, play card, chat, etc.) are sent either via:
    * HTTP POST requests to the API endpoints for game actions
    * WebSocket messages for real-time events like chat messages
    * FormData uploads for voice messages
3.  The server validates the request, updates the appropriate state, and stores data in `MemStorage`.
4.  The server broadcasts updates to all connected clients in the relevant game room via WebSockets.
5.  The client receives WebSocket messages and updates the UI accordingly.
6.  Connection health is maintained through ping/pong messages, with automatic reconnection attempts.

## Modifying the System

When making changes to the OdinCardClash system, consider the following guidelines:

1. **Add New Game Features**:
   * Update `schema.ts` to add new types or extend existing ones
   * Add game logic in `server/game.ts`
   * Extend storage methods in `server/storage.ts`
   * Add API endpoints in `server/routes.ts`
   * Implement UI components in `client/src/components/`

2. **Extend Chat Features**:
   * For new message types, update the `MessageType` enum in `schema.ts`
   * Add storage methods in `storage.ts` for new data types
   * Extend `ChatPanel.tsx` and related components for UI changes

3. **UI Modifications**:
   * Most UI components are in `client/src/components/ui/`
   * Game screens are in the top-level `components/` directory
   * Styles use Tailwind CSS with the `cn()` utility for conditional classes

4. **Server Communication**:
   * WebSocket message handlers are in `server/routes.ts`
   * Client-side WebSocket handling is in `client/src/lib/websocket.ts`
   * Add new message types to `WebSocketMessageType` in `schema.ts`