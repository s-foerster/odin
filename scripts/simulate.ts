// Vérifie le moteur de règles : des centaines de parties entre bots, de 2 à 6 joueurs.
// Lancer avec : npm run simulate
import { createGameState, newPlayer, startGame, startRound, applyPlay, applyPick, applyPass, checkPass, isTwoPlayerForcedPlay } from "../shared/engine";
import { chooseBotAction } from "../shared/bot";

let forced = 0;
let rounds = 0;
for (let n = 2; n <= 6; n++) {
  for (let g = 0; g < 200; g++) {
    const s = createGameState("g", "0000", newPlayer("P0"), 15);
    for (let i = 1; i < n; i++) s.players.push(newPlayer("P" + i, { isBot: true }));
    startGame(s);
    let guard = 0;
    while (s.status === "playing") {
      if (s.roundWinner) {
        rounds++;
        startRound(s);
        continue;
      }
      const p = s.players[s.currentTurn];
      if (s.currentPlay.length && isTwoPlayerForcedPlay(s, p.id)) {
        forced++;
        if (checkPass(s, p.id) === null) throw new Error("La règle à 2 joueurs n'est pas appliquée");
      }
      const a = chooseBotAction(s, p.id);
      if (!a) throw new Error("Aucun coup possible");
      if (a.type === "play") applyPlay(s, p.id, a.cards);
      else if (a.type === "pick") applyPick(s, p.id, a.cardId);
      else applyPass(s, p.id);
      const total = s.deck.length + s.currentPlay.length + s.previousPlay.length + s.players.reduce((t, q) => t + q.hand.length, 0);
      if (total !== 54) throw new Error(`Nombre de cartes incorrect : ${total}`);
      if (++guard > 20000) throw new Error("Boucle infinie");
    }
  }
}
console.log(`OK : 1000 parties, ${rounds} manches, règle à 2 joueurs déclenchée ${forced} fois`);
