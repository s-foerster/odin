import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Game types
export type CardColor = "red" | "blue" | "green" | "yellow" | "purple" | "orange";
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Card {
  id: string;
  color: CardColor;
  value: CardValue;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  hand: Card[];
  score: number;
  connected: boolean;
  isSpectator?: boolean; // Added for spectator mode
  isBot?: boolean; // Joueur contrôlé par l'ordinateur
}

export interface GameState {
  id: string;
  roomCode: string;
  status: "waiting" | "playing" | "finished";
  players: Player[];
  deck: Card[];
  currentTurn: number; // Index of current player in players array
  currentPlay: Card[];
  previousPlay: Card[];
  roundWinner: string | null;
  gameWinner: string | null;
  pointLimit: number;
  // Joueur qui a posé les cartes actuellement au centre (currentPlay)
  currentPlayBy?: string | null;
  lastAction: {
    // "clear" : tout le monde a passé, la table est vidée
    type: "play" | "pass" | "pick" | "clear" | "round_end" | "game_end" | null;
    playerId: string | null;
    cards?: Card[];
  };
  passCount: number;
}

// API Types
export interface CreateGameRequest {
  playerName: string;
  pointLimit: number;
}

export interface JoinGameRequest {
  playerName: string;
  roomCode: string; // 4 chiffres
  joinAsSpectator?: boolean; // Optional: true if joining an ongoing game as spectator
}

export interface PlayCardsRequest {
  gameId: string;
  playerId: string;
  cards: Card[];
}

export interface PickCardRequest {
  gameId: string;
  playerId: string;
  cardId: string;
}

export interface PassTurnRequest {
  gameId: string;
  playerId: string;
}

// WebSocket message types
export type WebSocketMessageType = 
  | "connect"
  | "game_created" 
  | "player_joined" 
  | "game_started" 
  | "turn_update" 
  | "cards_played" 
  | "card_picked" 
  | "turn_passed" 
  | "round_ended" 
  | "game_ended" 
  | "player_disconnected" 
  | "ping"
  | "pong"
  | "error"
  | "chat_message"
  | "chat_history"
  | "voice_message"
  | "voice_message_received"
  | "spectator_joined"; // Added for spectator joining

// Message type enum
export type MessageType = "text" | "voice";

// Add a ChatMessage interface
export interface ChatMessage {
  id: string;
  gameId: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
  messageType: MessageType;
  audioUrl?: string;
  duration?: number;
}

export interface WebSocketMessage {
  type: WebSocketMessageType;
  gameId?: string;
  playerId?: string;
  gameState?: GameState;
  error?: string;
  chatMessage?: ChatMessage;
  chatHistory?: ChatMessage[];
  audioData?: ArrayBuffer;
}
