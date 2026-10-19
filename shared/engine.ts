// Règles du jeu Odin, partagées entre le serveur (parties en ligne)
// et le navigateur (parties hors ligne). Aucune dépendance : fonctions pures
// qui modifient l'état passé en paramètre (le cloner avant si besoin).
import type { Card, CardColor, CardValue, GameState, Player } from "./schema";

export const COLORS: CardColor[] = ["red", "blue", "green", "yellow", "purple", "orange"];
export const VALUES: CardValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const MAX_HAND_SIZE = 9;

// Codes d'erreur = clés de traduction côté client
export const RuleCode = {
  GAME_NOT_IN_PROGRESS: "error.game.notInProgress",
  PLAYER_NOT_FOUND: "error.player.notFound",
  NOT_YOUR_TURN: "error.player.notYourTurn",
  MUST_PLAY_CARDS: "error.card.mustPlayCards",
  CARD_NOT_IN_HAND: "error.card.notInHand",
  CARD_NOT_FOUND: "error.card.notFound",
  MUST_PLAY_SAME_TYPE: "error.card.mustPlaySameType",
  MUST_PLAY_FIRST_CARD: "error.card.mustPlayFirstCard",
  MUST_PLAY_EXACT_COUNT: "error.card.mustPlayExactCount",
  MUST_PLAY_HIGHER_VALUE: "error.card.mustPlayHigherValue",
  CANNOT_PASS: "error.game.cannotPass",
  MUST_PLAY_TWO_PLAYERS: "error.game.mustPlayTwoPlayers",
  PICK_PENDING: "error.game.pickPending",
  INVALID_ACTION: "error.game.invalidAction",
} as const;
export type RuleCodeValue = (typeof RuleCode)[keyof typeof RuleCode];

export class RuleError extends Error {
  code: RuleCodeValue;
  constructor(code: RuleCodeValue) {
    super(code);
    this.code = code;
    this.name = "RuleError";
  }
}

export function makeId(length = 12): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const color of COLORS) for (const value of VALUES) deck.push({ id: makeId(), color, value });
  return shuffle(deck);
}

// Valeur d'un jeu : les chiffres triés du plus grand au plus petit (ex. 5 et 3 → 53)
export function playValue(cards: Card[]): number {
  if (!cards.length) return 0;
  return parseInt([...cards].map((c) => c.value).sort((a, b) => b - a).join(""), 10);
}

// Même valeur ou même couleur
export function isCoherentSet(cards: Card[]): boolean {
  if (!cards.length) return false;
  const f = cards[0];
  return cards.every((c) => c.value === f.value) || cards.every((c) => c.color === f.color);
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.isSpectator);
}

export function nextActiveIndex(state: GameState, fromIndex: number): number {
  const n = state.players.length;
  if (!n) return 0;
  for (let step = 1; step <= n; step++) {
    const i = (fromIndex + step) % n;
    if (!state.players[i].isSpectator) return i;
  }
  return fromIndex;
}

// Le joueur vient de battre un jeu de 2 cartes ou plus et doit en récupérer une
export function isPickPending(state: GameState, playerId?: string): boolean {
  return (
    state.lastAction.type === "play" &&
    state.previousPlay.length > 0 &&
    (playerId === undefined || state.lastAction.playerId === playerId)
  );
}

// Vérifie un jeu sans tenir compte du tour (utile pour l'interface et les bots)
export function checkCardsAgainstTable(cards: Card[], currentPlay: Card[]): RuleCodeValue | null {
  if (!cards.length) return RuleCode.MUST_PLAY_CARDS;
  if (!isCoherentSet(cards)) return RuleCode.MUST_PLAY_SAME_TYPE;
  if (currentPlay.length === 0) {
    return cards.length === 1 ? null : RuleCode.MUST_PLAY_FIRST_CARD;
  }
  if (cards.length !== currentPlay.length && cards.length !== currentPlay.length + 1) {
    return RuleCode.MUST_PLAY_EXACT_COUNT;
  }
  if (playValue(cards) <= playValue(currentPlay)) return RuleCode.MUST_PLAY_HIGHER_VALUE;
  return null;
}

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

// Tous les jeux autorisés avec cette main face à la table
export function listValidPlays(hand: Card[], currentPlay: Card[]): Card[][] {
  const sizes = currentPlay.length === 0 ? [1] : [currentPlay.length, currentPlay.length + 1];
  const groups: Card[][] = [];
  for (const color of COLORS) groups.push(hand.filter((c) => c.color === color));
  for (const value of VALUES) groups.push(hand.filter((c) => c.value === value));

  const seen = new Set<string>();
  const result: Card[][] = [];
  for (const group of groups) {
    for (const size of sizes) {
      if (group.length < size) continue;
      for (const combo of combinations(group, size)) {
        const key = combo.map((c) => c.id).sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        if (checkCardsAgainstTable(combo, currentPlay) === null) result.push(combo);
      }
    }
  }
  return result;
}

export function canPlayAnything(hand: Card[], currentPlay: Card[]): boolean {
  return listValidPlays(hand, currentPlay).length > 0;
}

// Règle à 2 joueurs : interdit de passer quand on peut jouer
// et que l'adversaire n'a plus que 2 cartes exactement.
export function isTwoPlayerForcedPlay(state: GameState, playerId: string): boolean {
  const actives = activePlayers(state);
  if (actives.length !== 2) return false;
  const me = actives.find((p) => p.id === playerId);
  const opponent = actives.find((p) => p.id !== playerId);
  if (!me || !opponent) return false;
  return opponent.hand.length === 2 && canPlayAnything(me.hand, state.currentPlay);
}

export function checkPass(state: GameState, playerId: string): RuleCodeValue | null {
  if (state.status !== "playing" || state.roundWinner) return RuleCode.GAME_NOT_IN_PROGRESS;
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1) return RuleCode.PLAYER_NOT_FOUND;
  if (index !== state.currentTurn) return RuleCode.NOT_YOUR_TURN;
  if (isPickPending(state)) return RuleCode.PICK_PENDING;
  if (state.currentPlay.length === 0) return RuleCode.CANNOT_PASS;
  if (isTwoPlayerForcedPlay(state, playerId)) return RuleCode.MUST_PLAY_TWO_PLAYERS;
  return null;
}

export function checkPlay(state: GameState, playerId: string, cards: Card[]): RuleCodeValue | null {
  if (state.status !== "playing" || state.roundWinner) return RuleCode.GAME_NOT_IN_PROGRESS;
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1) return RuleCode.PLAYER_NOT_FOUND;
  if (index !== state.currentTurn) return RuleCode.NOT_YOUR_TURN;
  if (isPickPending(state)) return RuleCode.PICK_PENDING;
  const hand = state.players[index].hand;
  const ids = new Set<string>();
  for (const card of cards) {
    if (ids.has(card.id) || !hand.some((c) => c.id === card.id)) return RuleCode.CARD_NOT_IN_HAND;
    ids.add(card.id);
  }
  return checkCardsAgainstTable(cards, state.currentPlay);
}

export function newPlayer(name: string, options: Partial<Player> = {}): Player {
  return {
    id: makeId(),
    name,
    isHost: false,
    hand: [],
    score: 0,
    connected: true,
    isSpectator: false,
    ...options,
  };
}

export function createGameState(id: string, roomCode: string, host: Player, pointLimit: number): GameState {
  return {
    id,
    roomCode,
    status: "waiting",
    players: [{ ...host, isHost: true }],
    deck: [],
    currentTurn: 0,
    currentPlay: [],
    currentPlayBy: null,
    previousPlay: [],
    roundWinner: null,
    gameWinner: null,
    pointLimit,
    lastAction: { type: null, playerId: null },
    passCount: 0,
  };
}

// Distribue une nouvelle manche (paquet neuf). Le joueur au plus petit score commence.
export function startRound(state: GameState): GameState {
  state.players = state.players.map((p) => (p.isSpectator ? { ...p, isSpectator: false } : p));
  const deck = createDeck();
  const count = state.players.length;
  const perPlayer = count ? Math.min(MAX_HAND_SIZE, Math.floor(deck.length / count)) : 0;
  for (const p of state.players) p.hand = deck.splice(0, perPlayer);
  state.deck = deck;
  state.currentPlay = [];
  state.currentPlayBy = null;
  state.previousPlay = [];
  state.roundWinner = null;
  state.passCount = 0;
  state.lastAction = { type: null, playerId: null };
  const lowest = Math.min(...state.players.map((p) => p.score));
  state.currentTurn = Math.max(0, state.players.findIndex((p) => p.score === lowest));
  return state;
}

export function startGame(state: GameState): GameState {
  startRound(state);
  state.status = "playing";
  state.gameWinner = null;
  return state;
}

function endRound(state: GameState, winner: Player) {
  state.roundWinner = winner.id;
  for (const p of state.players) p.score += p.hand.length;
  const highest = Math.max(...state.players.map((p) => p.score));
  if (highest >= state.pointLimit) {
    state.status = "finished";
    const lowest = Math.min(...state.players.map((p) => p.score));
    state.gameWinner = state.players.find((p) => p.score === lowest)?.id || null;
    state.lastAction = { type: "game_end", playerId: winner.id };
  } else {
    state.lastAction = { type: "round_end", playerId: winner.id };
  }
}

function giveCardAndAdvance(state: GameState, player: Player, card: Card) {
  player.hand.push(card);
  state.deck = shuffle([...state.deck, ...state.previousPlay.filter((c) => c.id !== card.id)]);
  state.previousPlay = [];
  state.currentTurn = nextActiveIndex(state, state.currentTurn);
  state.lastAction = { type: "pick", playerId: player.id };
}

export function applyPlay(state: GameState, playerId: string, cards: Card[]): GameState {
  const error = checkPlay(state, playerId, cards);
  if (error) throw new RuleError(error);

  const player = state.players[state.currentTurn];
  // On reprend les cartes de la main (le client ne peut pas modifier leur couleur ou valeur)
  const played = cards
    .map((c) => player.hand.find((h) => h.id === c.id)!)
    .sort((a, b) => b.value - a.value);

  state.previousPlay = [...state.currentPlay];
  state.currentPlay = played;
  state.currentPlayBy = player.id;
  state.passCount = 0;
  player.hand = player.hand.filter((c) => !played.some((p) => p.id === c.id));

  if (player.hand.length === 0) {
    endRound(state, player);
    return state;
  }

  state.lastAction = { type: "play", playerId: player.id, cards: played };

  if (state.previousPlay.length === 0) {
    state.currentTurn = nextActiveIndex(state, state.currentTurn);
  } else if (state.previousPlay.length === 1) {
    // Une seule carte à récupérer : prise automatique
    giveCardAndAdvance(state, player, state.previousPlay[0]);
  }
  // Sinon : le joueur doit choisir une carte (applyPick)
  return state;
}

export function applyPick(state: GameState, playerId: string, cardId: string): GameState {
  if (!isPickPending(state, playerId)) throw new RuleError(RuleCode.INVALID_ACTION);
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new RuleError(RuleCode.PLAYER_NOT_FOUND);
  const card = state.previousPlay.find((c) => c.id === cardId);
  if (!card) throw new RuleError(RuleCode.CARD_NOT_FOUND);
  giveCardAndAdvance(state, player, card);
  return state;
}

export function applyPass(state: GameState, playerId: string): GameState {
  const error = checkPass(state, playerId);
  if (error) throw new RuleError(error);

  state.passCount++;
  const next = nextActiveIndex(state, state.currentTurn);
  const activeCount = activePlayers(state).length;
  const backToLastPlayer = !!state.currentPlayBy && state.players[next]?.id === state.currentPlayBy;

  if (backToLastPlayer || (activeCount > 1 && state.passCount >= activeCount - 1)) {
    // Tout le monde a passé : la table est vidée, le dernier à avoir posé reprend la main
    state.deck = [...state.deck, ...state.currentPlay, ...state.previousPlay];
    state.currentPlay = [];
    state.previousPlay = [];
    state.passCount = 0;
    state.currentTurn = next;
    state.lastAction = { type: "clear", playerId: state.players[next]?.id ?? null };
    state.currentPlayBy = null;
  } else {
    state.currentTurn = next;
    state.lastAction = { type: "pass", playerId };
  }
  return state;
}
