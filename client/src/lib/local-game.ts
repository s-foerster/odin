// Partie hors ligne : tout tourne dans le navigateur avec le même moteur de règles
// que le serveur. La partie est sauvegardée sur le téléphone pour pouvoir la reprendre.
import type { GameState, Player } from "@shared/schema";
import { createGameState, makeId, newPlayer, startGame } from "@shared/engine";
import { pickBotName } from "@shared/bot";

export interface LocalConfig {
  humans: string[];
  bots: number;
  pointLimit: number;
}

export interface LocalSave {
  version: 1;
  config: LocalConfig;
  state: GameState;
  viewerId: string;
}

const STORAGE_KEY = "odin.local.v1";

export function loadLocalGame(): LocalSave | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as LocalSave;
    return save?.version === 1 && save.state?.players?.length ? save : null;
  } catch {
    return null;
  }
}

export function saveLocalGame(save: LocalSave) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // stockage indisponible (navigation privée) : la partie continue sans sauvegarde
  }
}

export function clearLocalGame() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

export function createLocalGame(config: LocalConfig): LocalSave {
  const humans: Player[] = config.humans.map((name, i) => newPlayer(name.trim() || `Joueur ${i + 1}`));
  const bots: Player[] = [];
  const names = humans.map((h) => h.name);
  for (let i = 0; i < config.bots; i++) {
    const name = pickBotName(names);
    names.push(name);
    bots.push(newPlayer(name, { isBot: true }));
  }

  // Alterne humains et bots autour de la table
  const seats: Player[] = [];
  const max = Math.max(humans.length, bots.length);
  for (let i = 0; i < max; i++) {
    if (humans[i]) seats.push(humans[i]);
    if (bots[i]) seats.push(bots[i]);
  }

  const state = createGameState(makeId(), "LOCAL", seats[0], config.pointLimit);
  state.players = seats.map((p, i) => ({ ...p, isHost: i === 0 }));
  startGame(state);

  const current = state.players[state.currentTurn];
  const viewerId = current && !current.isBot ? current.id : humans[0].id;
  return { version: 1, config, state, viewerId };
}
