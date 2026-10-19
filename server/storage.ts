import {
  User,
  InsertUser,
  GameState,
  Player,
  Card,
  CardColor,
  CardValue,
  ChatMessage,
  MessageType,
} from "@shared/schema";
import { nanoid } from "nanoid";
import {
  applyPass,
  applyPick,
  applyPlay,
  createGameState,
  newPlayer,
  RuleError,
  startGame as startGameLogic,
  startRound as startRoundLogic,
} from "@shared/engine";
import { pickBotName } from "@shared/bot";
import { generateRoomCode } from "./game";
import { GameError } from "./utils/gameError";
import { ErrorCode } from "./constants/errorCodes";

interface PlayerWithDisconnection extends Player {
  disconnectedSince?: number;
}

// Define storage interface with additional methods for game management
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Game methods
  createGame(hostName: string, pointLimit: number): Promise<GameState>;
  getGame(gameId: string): Promise<GameState | undefined>;
  getGameByRoomCode(roomCode: string): Promise<GameState | undefined>;
  updateGame(gameState: GameState): Promise<GameState>;
  addPlayerToGame(gameId: string, playerName: string, joinAsSpectator?: boolean): Promise<GameState>;
  addBot(gameId: string): Promise<GameState>;
  removePlayer(gameId: string, playerId: string): Promise<GameState>;
  deleteGame(gameId: string): Promise<void>;
  getLastActivity(gameId: string): number;
  startGame(gameId: string): Promise<GameState>;
  startNewRound(gameId: string): Promise<GameState>;
  playCards(
    gameId: string,
    playerId: string,
    cards: Card[]
  ): Promise<GameState>;
  pickCard(
    gameId: string,
    playerId: string,
    cardId: string
  ): Promise<GameState>;
  passTurn(gameId: string, playerId: string): Promise<GameState>;
  updatePlayerConnection(
    gameId: string,
    playerId: string,
    connected: boolean
  ): Promise<GameState>;
  getAllActiveGames(): Promise<GameState[]>;
  getAllGames(): GameState[];

  // Chat methods
  saveChatMessage(
    gameId: string,
    playerId: string,
    playerName: string,
    message: string,
    messageType?: MessageType,
    audioUrl?: string,
    duration?: number
  ): Promise<ChatMessage>;
  storeVoiceMessage(
    gameId: string,
    playerId: string,
    audioData: Buffer
  ): Promise<string>;
  getChatMessages(gameId: string): Promise<ChatMessage[]>;
  clearChatMessages(gameId: string): Promise<void>;
}

// Applique une règle du moteur et convertit ses erreurs en GameError
function withRules<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof RuleError) {
      throw new GameError(error.code as unknown as ErrorCode);
    }
    throw error;
  }
}

const MAX_PLAYERS = 27; // 54 cartes, au moins 2 cartes par joueur

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private games: Map<string, GameState>;
  private roomCodes: Map<string, string>; // Maps room codes to game IDs
  private lastActivity: Map<string, number>; // Dernière modification de chaque partie
  private currentId: number;
  private chatMessages: Map<string, ChatMessage[]>;
  private audioMessages: Map<string, Buffer>; // To store audio message data

  constructor() {
    this.users = new Map();
    this.games = new Map();
    this.roomCodes = new Map();
    this.lastActivity = new Map();
    this.currentId = 1;
    this.chatMessages = new Map();
    this.audioMessages = new Map();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Game methods
  private allocateRoomCode(): string {
    for (let attempt = 0; attempt < 500; attempt++) {
      const code = generateRoomCode();
      if (!this.roomCodes.has(code)) return code;
    }
    // Presque tous les codes sont pris : on libère la partie la plus ancienne
    const oldest = Array.from(this.lastActivity.entries()).sort((a, b) => a[1] - b[1])[0];
    if (oldest) {
      const game = this.games.get(oldest[0]);
      const code = game?.roomCode;
      this.deleteGame(oldest[0]);
      if (code) return code;
    }
    throw new GameError(ErrorCode.SERVER_ERROR);
  }

  async createGame(hostName: string, pointLimit: number): Promise<GameState> {
    const roomCode = this.allocateRoomCode();
    const gameState = createGameState(nanoid(), roomCode, newPlayer(hostName, { id: nanoid() }), pointLimit);
    this.games.set(gameState.id, gameState);
    this.roomCodes.set(roomCode, gameState.id);
    this.lastActivity.set(gameState.id, Date.now());
    return gameState;
  }

  async getGame(gameId: string): Promise<GameState | undefined> {
    return this.games.get(gameId);
  }

  async getGameByRoomCode(roomCode: string): Promise<GameState | undefined> {
    const gameId = this.roomCodes.get(roomCode);
    if (!gameId) return undefined;
    return this.games.get(gameId);
  }

  async updateGame(gameState: GameState): Promise<GameState> {
    this.games.set(gameState.id, gameState);
    this.lastActivity.set(gameState.id, Date.now());
    return gameState;
  }

  getLastActivity(gameId: string): number {
    return this.lastActivity.get(gameId) || 0;
  }

  getAllGames(): GameState[] {
    return Array.from(this.games.values());
  }

  async deleteGame(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (game && this.roomCodes.get(game.roomCode) === gameId) {
      this.roomCodes.delete(game.roomCode);
    }
    this.games.delete(gameId);
    this.lastActivity.delete(gameId);
    this.chatMessages.delete(gameId);
    for (const key of Array.from(this.audioMessages.keys())) {
      if (key.startsWith(`voice-${gameId}-`)) this.audioMessages.delete(key);
    }
  }

  async addPlayerToGame(
    gameId: string,
    playerName: string,
    joinAsSpectator: boolean = false
  ): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND);
    if (game.status === "finished") throw new GameError(ErrorCode.GAME_FINISHED);
    if (game.status === "playing" && !joinAsSpectator) throw new GameError(ErrorCode.GAME_ALREADY_STARTED);
    if (game.status === "waiting" && joinAsSpectator) throw new GameError(ErrorCode.CANNOT_JOIN_WAITING_AS_SPECTATOR);
    if (game.players.length >= MAX_PLAYERS) throw new GameError(ErrorCode.GAME_FULL);
    if (game.players.some((p) => p.name.toLowerCase() === playerName.toLowerCase()))
      throw new GameError(ErrorCode.NAME_ALREADY_TAKEN);

    game.players.push(
      newPlayer(playerName, { id: nanoid(), isSpectator: game.status === "playing" && joinAsSpectator })
    );
    return this.updateGame(game);
  }

  async addBot(gameId: string): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND);
    if (game.status !== "waiting") throw new GameError(ErrorCode.GAME_ALREADY_STARTED);
    if (game.players.length >= MAX_PLAYERS) throw new GameError(ErrorCode.GAME_FULL);
    const name = pickBotName(game.players.map((p) => p.name));
    game.players.push(newPlayer(name, { id: nanoid(), isBot: true }));
    return this.updateGame(game);
  }

  async removePlayer(gameId: string, playerId: string): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND);
    if (game.status !== "waiting") throw new GameError(ErrorCode.GAME_ALREADY_STARTED);
    game.players = game.players.filter((p) => p.id !== playerId || p.isHost);
    return this.updateGame(game);
  }

  async startGame(gameId: string): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND);
    if (game.players.length < 2) throw new GameError(ErrorCode.NOT_ENOUGH_PLAYERS);
    if (game.status !== "waiting") throw new GameError(ErrorCode.GAME_ALREADY_STARTED);
    return this.updateGame(startGameLogic(game));
  }

  async startNewRound(gameId: string): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND);
    if (game.status !== "playing") throw new GameError(ErrorCode.GAME_NOT_IN_PROGRESS);
    // Ignore les doubles clics : la manche n'est relancée que si elle est terminée
    if (!game.roundWinner) return game;
    return this.updateGame(startRoundLogic(game));
  }

  async playCards(gameId: string, playerId: string, cards: Card[]): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND);
    withRules(() => applyPlay(game, playerId, cards));
    return this.updateGame(game);
  }

  async pickCard(gameId: string, playerId: string, cardId: string): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND);
    withRules(() => applyPick(game, playerId, cardId));
    return this.updateGame(game);
  }

  async passTurn(gameId: string, playerId: string): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) throw new GameError(ErrorCode.GAME_NOT_FOUND);
    withRules(() => applyPass(game, playerId));
    return this.updateGame(game);
  }

  async updatePlayerConnection(
    gameId: string,
    playerId: string,
    connected: boolean
  ): Promise<GameState> {
    const game = await this.getGame(gameId);
    if (!game) {
      console.log(
        `Game ${gameId} not found when updating player ${playerId} connection status`
      );
      throw new Error("Game not found");
    }

    const playerIndex = game.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) throw new Error("Player not found");

    // Only update if status actually changes
    if (game.players[playerIndex].connected !== connected) {
      game.players[playerIndex].connected = connected;

      // Track disconnection time for host reassignment
      const player = game.players[playerIndex] as PlayerWithDisconnection;

      if (!connected) {
        player.disconnectedSince = Date.now();
      } else {
        // Clear disconnection timestamp on reconnect
        delete player.disconnectedSince;
      }

      // If the host disconnects, only reassign after 5 minutes
      if (!connected && game.players[playerIndex].isHost) {
        const connectedPlayers = game.players.filter(
          (p) => p.connected && !p.isBot && p.id !== playerId
        );
        if (connectedPlayers.length > 0) {
          // Check if there are any recently disconnected players
          const reconnectionWindow = 5 * 60 * 1000; // 5 minutes
          const now = Date.now();
          const hasRecentlyDisconnected = game.players.some(
            (p) =>
              (p as PlayerWithDisconnection).disconnectedSince &&
              now - (p as PlayerWithDisconnection).disconnectedSince! <
                reconnectionWindow
          );

          if (!hasRecentlyDisconnected) {
            // Only reassign host if no players are expected to reconnect soon
            game.players[playerIndex].isHost = false;
            const newHostIndex = game.players.findIndex(
              (p) => p.id === connectedPlayers[0].id
            );
            if (newHostIndex !== -1) {
              game.players[newHostIndex].isHost = true;
            }
          }
        }
      }

      return this.updateGame(game);
    }

    return game;
  }

  async getAllActiveGames(): Promise<GameState[]> {
    return Array.from(this.games.values()).filter((game) => {
      if (game.status === "finished") return false;

      // Consider a game active if any player is connected or recently disconnected
      const now = Date.now();
      const reconnectionWindow = 24 * 60 * 60 * 1000; // 24 hours

      return game.players.some(
        (p) =>
          p.connected ||
          ((p as PlayerWithDisconnection).disconnectedSince &&
            now - (p as PlayerWithDisconnection).disconnectedSince! <
              reconnectionWindow)
      );
    });
  }

  // Chat methods
  async saveChatMessage(
    gameId: string,
    playerId: string,
    playerName: string,
    message: string,
    messageType: MessageType = "text",
    audioUrl?: string,
    duration?: number
  ): Promise<ChatMessage> {
    if (!this.chatMessages.has(gameId)) {
      this.chatMessages.set(gameId, []);
    }

    const chatMessage: ChatMessage = {
      id: nanoid(),
      gameId,
      playerId,
      playerName,
      message,
      timestamp: Date.now(),
      messageType,
      audioUrl,
      duration,
    };

    this.chatMessages.get(gameId)!.push(chatMessage);

    // Limit chat history to last 100 messages
    const gameMessages = this.chatMessages.get(gameId)!;
    if (gameMessages.length > 100) {
      this.chatMessages.set(
        gameId,
        gameMessages.slice(gameMessages.length - 100)
      );
    }

    return chatMessage;
  }

  async storeVoiceMessage(
    gameId: string,
    playerId: string,
    audioData: Buffer
  ): Promise<string> {
    const audioId = `voice-${gameId}-${playerId}-${Date.now()}`;
    this.audioMessages.set(audioId, audioData);

    // Set a TTL for audio messages (7 days)
    setTimeout(() => {
      if (this.audioMessages.has(audioId)) {
        this.audioMessages.delete(audioId);
        console.log(`Deleted expired voice message: ${audioId}`);
      }
    }, 7 * 24 * 60 * 60 * 1000);

    return audioId;
  }

  async getChatMessages(gameId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(gameId) || [];
  }

  async clearChatMessages(gameId: string): Promise<void> {
    this.chatMessages.delete(gameId);
  }
}

export const storage = new MemStorage();
