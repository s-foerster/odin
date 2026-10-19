import { GameState, CardValue } from "@shared/schema";
import { nanoid } from "nanoid";

// Les règles du jeu sont dans shared/engine.ts (utilisées aussi hors ligne par le client).
export {
  createDeck,
  shuffle as shuffleDeck,
  startRound as startNewRound,
  checkCardsAgainstTable,
  nextActiveIndex,
} from "@shared/engine";

// Code de partie à 4 chiffres (ex. "0427")
export function generateRoomCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

// Masque les cartes des autres joueurs et la pioche
export function filterGameStateForPlayer(game: GameState, playerId: string): GameState {
  const hidden = () => ({ id: nanoid(8), color: "blue" as const, value: 0 as unknown as CardValue });
  return {
    ...game,
    players: game.players.map((player) =>
      player.id === playerId ? player : { ...player, hand: player.hand.map(hidden) },
    ),
    deck: [],
  };
}
