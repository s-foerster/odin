import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { GameError } from "./utils/gameError";
import { ErrorCode } from "./constants/errorCodes";
import { NextFunction } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import {
  CreateGameRequest,
  JoinGameRequest,
  PlayCardsRequest,
  PickCardRequest,
  PassTurnRequest,
  WebSocketMessage,
  GameState,
  Card,
  CardColor,
  CardValue,
  ChatMessage,
} from "@shared/schema";
import { nanoid } from "nanoid";
import { z } from "zod";
import { filterGameStateForPlayer } from "./game";
import multer from "multer";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import { Readable, Writable } from "stream";

// Set the path for ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath!);

// Set the path for ffprobe
ffmpeg.setFfprobePath(ffprobePath.path);

// Constants
const CONNECTION_TIMEOUT = 45000; // 45 seconds
const HOST_REASSIGN_DELAY = 5 * 60 * 1000; // 5 minutes
const GAME_CLEANUP_DELAY = 24 * 60 * 60 * 1000; // 24 hours

// Map of connected clients by game ID and player ID
const connections = new Map<string, Map<string, WebSocket>>();
// Track last message sent time to detect stale connections
const lastMessageTime = new Map<WebSocket, number>();
// Track player activity times to detect inactive players
const lastPlayerActivity = new Map<string, Map<string, number>>();
// Set up a ping interval to keep connections alive
let pingInterval: NodeJS.Timeout | null = null;
// Set up a player activity check interval
let playerActivityInterval: NodeJS.Timeout | null = null;

// Configure multer for voice message uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for voice messages
  },
});

// Send game state update to all players in a game
function broadcastGameState(gameId: string, gameState: GameState) {
  const gameConnections = connections.get(gameId);
  if (!gameConnections) return;

  console.log(
    `Broadcasting game state to ${gameConnections.size} players in game ${gameId}`
  );

  // Track which players received the update successfully
  const failedConnections: Array<[string, WebSocket]> = [];

  // Use Array.from to convert the map entries iterator to an array
  for (const [playerId, socket] of Array.from(gameConnections.entries())) {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        // Filter the game state to hide other players' cards
        const filteredState = filterGameStateForPlayer(gameState, playerId);

        const message: WebSocketMessage = {
          type: "turn_update",
          gameId,
          gameState: filteredState,
        };

        socket.send(JSON.stringify(message));
        // Update last message time
        lastMessageTime.set(socket, Date.now());
        // Update player activity time
        updatePlayerActivity(gameId, playerId);
      } catch (error) {
        console.error(`Error sending update to player ${playerId}:`, error);
        failedConnections.push([playerId, socket]);
      }
    } else {
      // Connection is not open, queue for cleanup
      failedConnections.push([playerId, socket]);
    }
  }

  // Clean up any failed connections
  for (const [playerId, socket] of failedConnections) {
    console.log(
      `Removing stale connection for player ${playerId} in game ${gameId}`
    );
    gameConnections.delete(playerId);
    lastMessageTime.delete(socket);

    // Mark player as disconnected in game state
    markPlayerDisconnected(gameId, playerId);
  }

  // If all connections for a game have failed, clean up the game entry
  if (gameConnections.size === 0) {
    connections.delete(gameId);
  }
}

// Track player activity for disconnection detection
function updatePlayerActivity(gameId: string, playerId: string) {
  if (!lastPlayerActivity.has(gameId)) {
    lastPlayerActivity.set(gameId, new Map());
  }

  lastPlayerActivity.get(gameId)!.set(playerId, Date.now());
}

// Handle player disconnection
async function markPlayerDisconnected(gameId: string, playerId: string) {
  try {
    // Get player activity map for this game
    const gameActivity = lastPlayerActivity.get(gameId);
    if (gameActivity) {
      // Keep the activity record for reconnection window
      const lastActive = gameActivity.get(playerId);
      if (lastActive) {
        // Only remove activity if it's been longer than the host reassignment delay
        if (Date.now() - lastActive > HOST_REASSIGN_DELAY) {
          gameActivity.delete(playerId);
          if (gameActivity.size === 0) {
            lastPlayerActivity.delete(gameId);
          }
        }
      }
    }

    // Check if the game exists before trying to update the player connection
    const game = await storage.getGame(gameId);
    if (!game) {
      console.log(
        `Game ${gameId} not found when disconnecting player ${playerId}`
      );
      return; // Exit early if game doesn't exist
    }

    // Mark player as disconnected in the game state
    await storage.updatePlayerConnection(gameId, playerId, false);

    // Fetch updated game state and broadcast to remaining players
    const updatedGame = await storage.getGame(gameId);
    if (updatedGame) {
      broadcastGameState(gameId, updatedGame);
    }
  } catch (error) {
    console.error(`Error marking player ${playerId} as disconnected:`, error);
  }
}

// Setup ping function to keep WebSocket connections alive
function setupPingInterval(wss: WebSocketServer) {
  if (pingInterval) {
    clearInterval(pingInterval);
  }

  pingInterval = setInterval(() => {
    const now = Date.now();

    wss.clients.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          // Send ping to verify connection
          socket.ping();

          // Check if we haven't sent any messages in a while
          const lastTime = lastMessageTime.get(socket) || 0;
          if (now - lastTime > 30000) {
            // 30 seconds
            // Send an empty ping message to keep connection alive
            const pingMessage: WebSocketMessage = { type: "ping" };
            socket.send(JSON.stringify(pingMessage));
            lastMessageTime.set(socket, now);
          }
        } catch (err) {
          console.error("Error pinging client:", err);
          // Close the socket if we can't ping it
          try {
            socket.terminate();
          } catch (e) {
            console.error("Error terminating socket:", e);
          }
        }
      }
    });
  }, 15000); // Check every 15 seconds
}

// Check for inactive players and mark them as disconnected
function setupPlayerActivityCheck() {
  if (playerActivityInterval) {
    clearInterval(playerActivityInterval);
  }

  playerActivityInterval = setInterval(async () => {
    const now = Date.now();

    // Check each game for inactive players and cleanup
    for (const [gameId, playerMap] of Array.from(
      lastPlayerActivity.entries()
    )) {
      // Get game state to check its status
      const game = await storage.getGame(gameId);
      if (!game) {
        // Clean up activity tracking for non-existent games
        lastPlayerActivity.delete(gameId);
        continue;
      }

      // Check for completely abandoned games
      const allDisconnected = game.players.every((p) => !p.connected);
      if (allDisconnected) {
        const lastActivity = Math.max(...Array.from(playerMap.values()));
        if (now - lastActivity > GAME_CLEANUP_DELAY) {
          console.log(
            `Game ${gameId} has been abandoned for over 24 hours, cleaning up`
          );
          // Clean up all game data
          await storage.clearChatMessages(gameId);
          connections.delete(gameId);
          lastPlayerActivity.delete(gameId);
          continue;
        }
      }

      // Check individual player activity
      for (const [playerId, lastActive] of Array.from(playerMap.entries())) {
        // Don't disconnect players too quickly
        if (now - lastActive > CONNECTION_TIMEOUT) {
          console.log(
            `Player ${playerId} in game ${gameId} inactive for too long, marking as disconnected`
          );

          const gameConnections = connections.get(gameId);
          if (gameConnections) {
            const socket = gameConnections.get(playerId);
            if (socket) {
              try {
                socket.terminate();
              } catch (e) {
                console.error("Error terminating inactive socket:", e);
              }
              gameConnections.delete(playerId);
              lastMessageTime.delete(socket);
            }
          }

          // Mark the player as disconnected
          await markPlayerDisconnected(gameId, playerId);
        }
      }
    }
  }, 20000); // Check every 20 seconds
}

// Send chat message to all players in a game
async function broadcastChatMessage(chatMessage: ChatMessage) {
  const gameId = chatMessage.gameId;
  const gameConnections = connections.get(gameId);
  if (!gameConnections) return;

  console.log(
    `Broadcasting chat message from ${chatMessage.playerName} to ${gameConnections.size} players in game ${gameId}`
  );

  const message: WebSocketMessage = {
    type: "chat_message",
    gameId,
    chatMessage,
  };

  // Track which players received the message successfully
  const failedConnections: Array<[string, WebSocket]> = [];

  // Send to all players
  for (const [playerId, socket] of Array.from(gameConnections.entries())) {
    if (socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
        // Update last message time
        lastMessageTime.set(socket, Date.now());
        // Update player activity time
        updatePlayerActivity(gameId, playerId);
      } catch (error) {
        console.error(
          `Error sending chat message to player ${playerId}:`,
          error
        );
        failedConnections.push([playerId, socket]);
      }
    } else {
      // Connection is not open, queue for cleanup
      failedConnections.push([playerId, socket]);
    }
  }

  // Clean up any failed connections
  for (const [playerId, socket] of failedConnections) {
    console.log(
      `Removing stale connection for player ${playerId} in game ${gameId}`
    );
    gameConnections.delete(playerId);
    lastMessageTime.delete(socket);

    // Mark player as disconnected in game state
    markPlayerDisconnected(gameId, playerId);
  }
}

// Utility function to determine MIME type based on file extension
function getMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "webm":
      return "audio/webm";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    default:
      return "application/octet-stream";
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // Setup ping interval to keep connections alive
  setupPingInterval(wss);

  // Setup player activity check
  setupPlayerActivityCheck();

  wss.on("connection", (socket: WebSocket) => {
    console.log("WebSocket client connected");
    lastMessageTime.set(socket, Date.now());

    let clientGameId: string | null = null;
    let clientPlayerId: string | null = null;

    socket.on("message", async (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        // Update the last message time
        lastMessageTime.set(socket, Date.now());

        if (message.type === "connect" && message.gameId && message.playerId) {
          // Check if this player is already connected with a different socket
          const existingGameConnections = connections.get(message.gameId);
          if (existingGameConnections) {
            const existingSocket = existingGameConnections.get(
              message.playerId
            );
            if (
              existingSocket &&
              existingSocket !== socket &&
              existingSocket.readyState === WebSocket.OPEN
            ) {
              // Player already has an active connection - close the old one
              console.log(
                `Player ${message.playerId} already connected, closing previous connection`
              );

              // Close the existing socket - send a disconnect notification first
              try {
                existingSocket.send(
                  JSON.stringify({
                    type: "error",
                    error: "You connected from another device or browser tab.",
                  })
                );
                existingSocket.close(1000, "Replaced by new connection");
              } catch (e) {
                console.error("Error closing existing socket:", e);
              }

              // Remove the old connection
              existingGameConnections.delete(message.playerId);
              lastMessageTime.delete(existingSocket);
            }
          }

          // If client was already connected to a different game, disconnect from that first
          if (clientGameId && clientGameId !== message.gameId) {
            const oldGameConnections = connections.get(clientGameId);
            if (oldGameConnections) {
              oldGameConnections.delete(clientPlayerId!);
              if (oldGameConnections.size === 0) {
                connections.delete(clientGameId);
              }

              // Mark player as disconnected from previous game
              await markPlayerDisconnected(clientGameId, clientPlayerId!);
            }
          }

          clientGameId = message.gameId;
          clientPlayerId = message.playerId;

          // Store connection
          if (!connections.has(clientGameId)) {
            connections.set(clientGameId, new Map());
          }
          connections.get(clientGameId)!.set(clientPlayerId, socket);

          // Update player activity time
          updatePlayerActivity(clientGameId, clientPlayerId);

          // Mark player as connected
          const game = await storage.getGame(clientGameId);
          if (game) {
            await storage.updatePlayerConnection(
              clientGameId,
              clientPlayerId,
              true
            );
            // Immediately send the current game state to the newly connected player
            const updatedGame = await storage.getGame(clientGameId);
            if (updatedGame) {
              // Send only to this player
              const filteredState = filterGameStateForPlayer(
                updatedGame,
                clientPlayerId
              );
              socket.send(
                JSON.stringify({
                  type: "turn_update",
                  gameId: clientGameId,
                  gameState: filteredState,
                })
              );
              // Then broadcast to everyone
              broadcastGameState(clientGameId, updatedGame);
            }
          }
        } else if (message.type === "ping") {
          // Respond to ping with pong
          socket.send(JSON.stringify({ type: "pong" }));

          // Update activity time for the player when they ping
          if (clientGameId && clientPlayerId) {
            updatePlayerActivity(clientGameId, clientPlayerId);
          }
        } else if (message.type === "chat_message") {
          if (
            message.gameId &&
            message.playerId &&
            message.chatMessage?.message
          ) {
            try {
              // Get player info to attach the right name
              const game = await storage.getGame(message.gameId);
              if (!game) {
                console.error(
                  `Game ${message.gameId} not found for chat message`
                );
                return;
              }

              const player = game.players.find(
                (p) => p.id === message.playerId
              );
              if (!player) {
                console.error(
                  `Player ${message.playerId} not found in game ${message.gameId} for chat message`
                );
                return;
              }

              // Save and broadcast the chat message
              const messageType = message.chatMessage.messageType || "text";
              const chatMessage = await storage.saveChatMessage(
                message.gameId,
                message.playerId,
                player.name,
                message.chatMessage.message,
                messageType,
                message.chatMessage.audioUrl,
                message.chatMessage.duration
              );

              await broadcastChatMessage(chatMessage);
            } catch (error) {
              console.error("Error handling chat message:", error);
            }
          }
        } else if (message.type === "chat_history") {
          if (message.gameId && message.playerId) {
            try {
              const chatHistory = await storage.getChatMessages(message.gameId);

              const historyMessage: WebSocketMessage = {
                type: "chat_history",
                gameId: message.gameId,
                playerId: message.playerId,
                chatHistory,
              };

              socket.send(JSON.stringify(historyMessage));
            } catch (error) {
              console.error("Error sending chat history:", error);
            }
          }
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    socket.on("close", async () => {
      console.log("WebSocket client disconnected");
      lastMessageTime.delete(socket);

      if (clientGameId && clientPlayerId) {
        // Remove connection
        const gameConnections = connections.get(clientGameId);
        if (gameConnections) {
          // Only remove this specific socket if it's still the current one for the player
          const currentSocket = gameConnections.get(clientPlayerId);
          if (currentSocket === socket) {
            gameConnections.delete(clientPlayerId);

            // If no connections left for this game, clean up
            if (gameConnections.size === 0) {
              connections.delete(clientGameId);
            }

            // Mark player as disconnected
            await markPlayerDisconnected(clientGameId, clientPlayerId);
          }
        }
      }
    });

    socket.on("error", (error) => {
      console.error("WebSocket error:", error);
      lastMessageTime.delete(socket);

      // Forcefully terminate the socket on error
      try {
        socket.terminate();
      } catch (e) {
        console.error("Error terminating socket after error:", e);
      }

      // Mark player as disconnected if we have their info
      if (clientGameId && clientPlayerId) {
        markPlayerDisconnected(clientGameId, clientPlayerId).catch((e) => {
          console.error(
            "Error marking player disconnected after socket error:",
            e
          );
        });
      }
    });

    socket.on("pong", () => {
      // Update last activity time when we receive a pong response
      lastMessageTime.set(socket, Date.now());

      // Update player activity
      if (clientGameId && clientPlayerId) {
        updatePlayerActivity(clientGameId, clientPlayerId);
      }
    });
  });

  // API Routes
  // Create a new game
  app.post("/api/games", async (req: Request, res: Response) => {
    try {
      const createGameSchema = z.object({
        playerName: z.string().min(1).max(20),
        pointLimit: z.number().int().min(5).max(50),
      });

      const validatedData = createGameSchema.parse(
        req.body as CreateGameRequest
      );
      const game = await storage.createGame(
        validatedData.playerName,
        validatedData.pointLimit
      );

      res.status(201).json({
        gameId: game.id,
        roomCode: game.roomCode,
        playerId: game.players[0].id,
      });
    } catch (error) {
      console.error("Create game error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to create game" });
    }
  });

const JoinGameRequestSchema = z.object({
  playerName: z.string().min(1).max(20),
  roomCode: z.string().length(6),
  joinAsSpectator: z.boolean().optional(), // Added for spectator mode
});

app.post("/api/games/join", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { playerName, roomCode, joinAsSpectator } = JoinGameRequestSchema.parse(req.body);

      const game = await storage.getGameByRoomCode(roomCode.toUpperCase());
      if (!game) {
        return next(new GameError(ErrorCode.GAME_NOT_FOUND));
      }

      if (game.status === "playing" && !joinAsSpectator) {
        // Game is in progress, and the player hasn't explicitly asked to join as a spectator.
        // Return an error indicating they can join as a spectator.
        return next(new GameError(ErrorCode.GAME_IN_PROGRESS_SPECTATE_OFFER));
      }
      
      if (game.status === "finished") {
        return next(new GameError(ErrorCode.GAME_FINISHED));
      }

      const updatedGame = await storage.addPlayerToGame(game.id, playerName, joinAsSpectator);
      const newPlayer = updatedGame.players.find((p) => p.name === playerName);

      if (!newPlayer) {
        // Should not happen if addPlayerToGame was successful
        return next(new GameError(ErrorCode.PLAYER_NOT_FOUND));
      }

      // Broadcast player joined event or spectator joined event
      broadcastGameState(updatedGame.id, updatedGame);

      const messageType = newPlayer.isSpectator ? "spectator_joined" : "player_joined";
      const joinedMessage: WebSocketMessage = {
        type: messageType,
        gameId: updatedGame.id,
        playerId: newPlayer.id,
        // Send full game state with player_joined/spectator_joined for initial sync for everyone
        // The broadcastGameState above already sends filtered state to each player.
        // This specific message can carry the new player's info if needed, or just be a signal.
        // Let's send the new player's minimal info for now.
        chatMessage: { // Re-using chatMessage structure for simplicity to pass player name
          id: nanoid(),
          gameId: updatedGame.id,
          playerId: newPlayer.id,
          playerName: newPlayer.name,
          message: newPlayer.isSpectator ? `${newPlayer.name} joined as a spectator.` : `${newPlayer.name} joined the game.`,
          timestamp: Date.now(),
          messageType: "text", // Or a new system message type
        }
      };

      const gameConnections = connections.get(updatedGame.id);
      if (gameConnections) {
        gameConnections.forEach(socket => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(joinedMessage));
          }
        });
      }

      res.json({
        gameId: updatedGame.id,
        playerId: newPlayer.id,
        gameState: filterGameStateForPlayer(updatedGame, newPlayer.id)
      });
    } catch (error) {
      // Handle specific error from storage if player tries to join waiting game as spectator
      if (error instanceof GameError && error.code === ErrorCode.CANNOT_JOIN_WAITING_AS_SPECTATOR) {
        return next(error);
      }
      next(error);
    }
  });

  // Get game state
  app.get("/api/games/:gameId", async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const { playerId } = req.query;

      if (!playerId || typeof playerId !== "string") {
        return res.status(400).json({ message: "Player ID is required" });
      }

      const game = await storage.getGame(gameId);

      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const player = game.players.find((p) => p.id === playerId);
      if (!player) {
        return res.status(403).json({ message: "Player not in game" });
      }

      // Filter game state to hide other players' cards
      const filteredState = filterGameStateForPlayer(game, playerId);

      res.status(200).json(filteredState);
    } catch (error) {
      console.error("Get game error:", error);
      res.status(500).json({ message: "Failed to get game" });
    }
  });

  // Start the game
  app.post("/api/games/:gameId/start", async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const { playerId } = req.body;

      if (!playerId) {
        return res.status(400).json({ message: "Player ID is required" });
      }

      const game = await storage.getGame(gameId);

      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const player = game.players.find((p) => p.id === playerId);
      if (!player) {
        return res.status(403).json({ message: "Player not in game" });
      }

      if (!player.isHost) {
        return res
          .status(403)
          .json({ message: "Only the host can start the game" });
      }

      const updatedGame = await storage.startGame(gameId);

      // Broadcast game started to all clients
      broadcastGameState(gameId, updatedGame);

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Start game error:", error);
      res.status(500).json({ message: "Failed to start game" });
    }
  });

  // Play cards
  app.post("/api/games/:gameId/play", async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const playCardsSchema = z.object({
        playerId: z.string(),
        cards: z
          .array(
            z.object({
              id: z.string(),
              color: z.enum([
                "red",
                "blue",
                "green",
                "yellow",
                "purple",
                "orange",
              ]),
              value: z.union([
                // Accept strings (for backward compatibility)
                z
                  .enum(["1", "2", "3", "4", "5", "6", "7", "8", "9"])
                  .transform((val) => parseInt(val, 10) as CardValue),
                // Accept numbers directly (matching the schema definition)
                z.number().int().min(1).max(9) as z.ZodType<CardValue>,
              ]),
            })
          )
          .min(1),
      });

      const validatedData = playCardsSchema.parse(req.body as PlayCardsRequest);

      const game = await storage.getGame(gameId);

      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      try {
        const updatedGame = await storage.playCards(
          gameId,
          validatedData.playerId,
          validatedData.cards
        );

        // Broadcast updated state to all clients
        broadcastGameState(gameId, updatedGame);

        res.status(200).json({ success: true });
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Invalid play",
        });
      }
    } catch (error) {
      console.error("Play cards error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to play cards" });
    }
  });

  // Pick a card after playing
  app.post("/api/games/:gameId/pick", async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const pickCardSchema = z.object({
        playerId: z.string(),
        cardId: z.string(),
      });

      const validatedData = pickCardSchema.parse(req.body as PickCardRequest);

      const game = await storage.getGame(gameId);

      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      try {
        const updatedGame = await storage.pickCard(
          gameId,
          validatedData.playerId,
          validatedData.cardId
        );

        // Broadcast updated state to all clients
        broadcastGameState(gameId, updatedGame);

        res.status(200).json({ success: true });
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Invalid pick",
        });
      }
    } catch (error) {
      console.error("Pick card error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to pick card" });
    }
  });

  // Pass turn
  app.post("/api/games/:gameId/pass", async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const passTurnSchema = z.object({
        playerId: z.string(),
      });

      const validatedData = passTurnSchema.parse(req.body as PassTurnRequest);

      const game = await storage.getGame(gameId);

      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      try {
        const updatedGame = await storage.passTurn(
          gameId,
          validatedData.playerId
        );

        // Broadcast updated state to all clients
        broadcastGameState(gameId, updatedGame);

        res.status(200).json({ success: true });
      } catch (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Invalid pass",
        });
      }
    } catch (error) {
      console.error("Pass turn error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to pass turn" });
    }
  });

  // Start a new round
  app.post("/api/games/:gameId/round", async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const { playerId } = req.body;

      if (!playerId) {
        return res.status(400).json({ message: "Player ID is required" });
      }

      const game = await storage.getGame(gameId);

      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const player = game.players.find((p) => p.id === playerId);
      if (!player) {
        return res.status(403).json({ message: "Player not in game" });
      }

      if (!player.isHost) {
        return res
          .status(403)
          .json({ message: "Only the host can start a new round" });
      }

      // Use the centralized storage method to start the new round
      const updatedGame = await storage.startNewRound(gameId);

      // Broadcast updated state to all clients
      broadcastGameState(gameId, updatedGame);

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Start new round error:", error);
      res.status(500).json({ message: "Failed to start new round" });
    }
  });

  // Voice message upload endpoint
  app.post(
    "/api/games/:gameId/voice-message",
    (req, res, next) => {
      // VOICE_MESSAGES_DISABLED=true coupe les vocaux (ffmpeg) pour économiser la mémoire
      if (process.env.VOICE_MESSAGES_DISABLED === "true") {
        return res.status(503).json({ error: "Voice messages are disabled on this server" });
      }
      next();
    },
    upload.single("audio"),
    async (req, res) => {
      try {
        const gameId = req.params.gameId;
        const playerId = req.body.playerId;
        const playerName = req.body.playerName;
        const duration = parseFloat(req.body.duration || "0");

        if (!gameId || !playerId || !req.file) {
          return res.status(400).json({ error: "Missing required parameters" });
        }

        // Get the game to verify it exists
        const game = await storage.getGame(gameId);
        if (!game) {
          return res.status(404).json({ error: "Game not found" });
        }

        console.log("Received voice message upload:", {
          gameId,
          playerId,
          playerName,
          duration,
          fileExists: !!req.file,
        });

        // Fix the ffmpeg input buffer issue by converting the buffer to a readable stream
        const bufferToStream = (buffer: Buffer): Readable => {
          const stream = new Readable();
          stream.push(buffer);
          stream.push(null);
          return stream;
        };

        // Update the ffmpeg usage to use a readable stream and handle output properly
        const inputBuffer = req.file.buffer;
        const inputStream = bufferToStream(inputBuffer);
        const outputBuffer: Buffer = await new Promise((resolve, reject) => {
          const chunks: Buffer[] = [];

          // Ensure file exists and log incoming file info for debugging
          if (!req.file) {
            return reject(new Error("No file uploaded"));
          }

          console.log("Incoming audio file:", {
            mimetype: req.file.mimetype,
            originalname: req.file.originalname,
            size: req.file.size,
          });

          ffmpeg(inputStream)
            // Let FFmpeg auto-detect input format
            .toFormat("mp3")
            .on("error", (err) => {
              console.error("FFmpeg error:", err);
              reject(err);
            })
            .on("end", () => resolve(Buffer.concat(chunks)))
            .pipe(
              new Writable({
                write(chunk, encoding, callback) {
                  chunks.push(chunk);
                  callback(); // Signal that the chunk has been processed
                },
              })
            );
        });

        // Validate the converted audio file
        if (!outputBuffer || outputBuffer.length === 0) {
          return res.status(400).json({ error: "Invalid audio file" });
        }

        // Recalculate the duration using ffmpeg
        const recalculatedDuration = await new Promise<number>(
          (resolve, reject) => {
            ffmpeg()
              .input(Readable.from(outputBuffer))
              .ffprobe((err, data) => {
                if (err) return reject(err);
                const duration = data.format.duration;
                resolve(duration || 0);
              });
          }
        );

        if (recalculatedDuration === 0) {
          return res.status(400).json({ error: "Audio duration is zero" });
        }

        // Store the converted audio file
        const audioId = await storage.storeVoiceMessage(
          gameId,
          playerId,
          outputBuffer
        );

        // Create a chat message for this voice message
        const chatMessage = await storage.saveChatMessage(
          gameId,
          playerId,
          playerName,
          "Voice message", // Placeholder text for non-supporting clients
          "voice",
          `/api/voice-messages/${audioId}`,
          duration
        );

        // Broadcast the message to all players
        await broadcastChatMessage(chatMessage);

        return res
          .status(200)
          .json({ success: true, messageId: chatMessage.id });
      } catch (error) {
        if (error instanceof Error) {
          console.error(
            "Error uploading voice message:",
            error.stack || error.message
          );
        } else {
          console.error("Error uploading voice message:", error);
        }
        return res.status(500).json({ error: "Server error" });
      }
    }
  );

  // Add support for range requests in the audio download endpoint
  app.get("/api/voice-messages/:audioId", async (req, res) => {
    try {
      const audioId = req.params.audioId;

      // Get the audio data from storage
      const audioData = (storage as any).audioMessages.get(audioId);

      if (!audioData) {
        return res.status(404).json({ error: "Voice message not found" });
      }

      const range = req.headers.range;
      if (!range) {
        // If no range header, send the entire file
        res.set("Content-Type", "audio/mpeg");
        res.set("Content-Length", audioData.length.toString());
        return res.send(audioData);
      }

      // Validate the range header and log details
      console.log("Range header:", range);
      console.log("Audio file size:", audioData.length);

      // Parse the range header
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : audioData.length - 1;

      // Validate the range
      if (
        isNaN(start) ||
        isNaN(end) ||
        start < 0 ||
        end >= audioData.length ||
        start > end
      ) {
        console.error("Invalid range:", { start, end });
        return res
          .status(416)
          .set("Content-Range", `bytes */${audioData.length}`)
          .end();
      }

      // Calculate the chunk size and log details
      const chunkSize = end - start + 1;
      console.log("Serving range:", { start, end, chunkSize });

      // Extract the requested chunk
      const chunk = audioData.slice(start, end + 1);

      // Send the partial content response
      res
        .status(206)
        .set("Content-Range", `bytes ${start}-${end}/${audioData.length}`)
        .set("Accept-Ranges", "bytes")
        .set("Content-Length", chunkSize.toString())
        .set("Content-Type", "audio/mpeg")
        .send(chunk);
    } catch (error) {
      console.error("Error retrieving voice message:", error);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Serve uploaded files with support for range requests
  app.get("/uploads/:file", (req, res) => {
    const filePath = path.join(__dirname, "uploads", req.params.file);
    fs.stat(filePath, (err, stat) => {
      if (err) return res.sendStatus(404);
      const total = stat.size;
      const range = req.headers.range;
      if (range) {
        const [startStr] = range.replace(/bytes=/, "").split("-");
        const start = parseInt(startStr, 10);
        if (start >= total) {
          res.status(416).set("Content-Range", `bytes */${total}`).end();
          return;
        }
        const end = total - 1;
        const chunkSize = end - start + 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": getMimeType(req.params.file),
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": total,
          "Content-Type": getMimeType(req.params.file),
        });
        fs.createReadStream(filePath).pipe(res);
      }
    });
  });

  // Global error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Error in request:", err);

    if (err instanceof GameError) {
      return res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      });
    }

    // Handle other errors
    return res.status(500).json({
      success: false,
      error: {
        code: ErrorCode.SERVER_ERROR,
        message: "Internal server error",
      },
    });
  });

  return httpServer;
}
