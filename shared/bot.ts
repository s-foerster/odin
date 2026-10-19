// Intelligence des bots, partagée entre le serveur et le mode hors ligne.
import type { Card, GameState } from "./schema";
import { checkPass, isPickPending, listValidPlays, playValue } from "./engine";

export const BOT_NAMES = ["Thor", "Freyja", "Loki", "Sif", "Baldr", "Frigg", "Tyr", "Idunn", "Heimdall", "Skadi"];

export function pickBotName(takenNames: string[]): string {
  const taken = new Set(takenNames.map((n) => n.toLowerCase()));
  for (const name of BOT_NAMES) {
    if (!taken.has(name.toLowerCase())) return name;
  }
  let i = 2;
  while (taken.has(`bot ${i}`)) i++;
  return `Bot ${i}`;
}

export type BotAction =
  | { type: "play"; cards: Card[] }
  | { type: "pick"; cardId: string }
  | { type: "pass" };

// Nombre de cartes de la main qui partagent la couleur ou la valeur
function synergy(card: Card, hand: Card[]): number {
  return hand.filter((c) => c.id !== card.id && (c.color === card.color || c.value === card.value)).length;
}

export function chooseBotAction(state: GameState, botId: string): BotAction | null {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot || state.status !== "playing" || state.roundWinner) return null;
  if (state.players[state.currentTurn]?.id !== botId) return null;

  if (isPickPending(state, botId)) {
    // Garde la carte qui se combine le mieux avec la main, à égalité la plus forte
    const best = [...state.previousPlay].sort(
      (a, b) => synergy(b, bot.hand) - synergy(a, bot.hand) || b.value - a.value,
    )[0];
    return { type: "pick", cardId: best.id };
  }

  const plays = listValidPlays(bot.hand, state.currentPlay);
  if (plays.length === 0) {
    return checkPass(state, botId) === null ? { type: "pass" } : null;
  }

  // Vider sa main gagne la manche
  const finishing = plays.find((p) => p.length === bot.hand.length);
  if (finishing) return { type: "play", cards: finishing };

  if (state.currentPlay.length === 0) {
    // Ouverture : la carte la plus isolée, à égalité la plus forte
    const lead = [...plays].sort(
      (a, b) => synergy(a[0], bot.hand) - synergy(b[0], bot.hand) || b[0].value - a[0].value,
    )[0];
    return { type: "play", cards: lead };
  }

  // Suite : poser le plus de cartes possible, avec le jeu le plus faible qui suffit
  const best = [...plays].sort((a, b) => b.length - a.length || playValue(a) - playValue(b))[0];
  return { type: "play", cards: best };
}
