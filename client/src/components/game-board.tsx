import { lazy, ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Card as CardType, GameState, Player } from "@shared/schema";
import { checkCardsAgainstTable, checkPass, isCoherentSet, isPickPending, playValue } from "@shared/engine";
import { Button } from "@/components/ui/button";
import CardComponent from "@/components/ui/card-component";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sortCards, sortCardsByValue } from "@/lib/card-utils";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { cn } from "@/lib/utils";
import { ArrowDownUp, Bot, HelpCircle, LogOut, SkipForward, Volume2, VolumeX } from "lucide-react";

const RoundEndModal = lazy(() => import("@/components/modals/round-end-modal"));
const GameEndModal = lazy(() => import("@/components/modals/game-end-modal"));

const AVATAR_COLORS = ["#e53935", "#1e88e5", "#43a047", "#f9a825", "#8e24aa", "#fb8c00", "#00897b", "#6d4c41"];

export interface GameBoardProps {
  state: GameState;
  viewerId: string;
  isPending?: boolean;
  onPlay: (cards: CardType[]) => void;
  onPick: (cardId: string) => void;
  onPass: () => void;
  onLeave: () => void;
  headerLeft: ReactNode;
  headerRight?: ReactNode;
  banner?: ReactNode;
  // Fin de manche
  canStartNextRound: boolean;
  onStartNextRound: () => void;
  isStartingRound?: boolean;
  // Fin de partie
  endPrimaryLabel: string;
  onEndPrimary: () => void;
  endSecondaryLabel: string;
  onEndSecondary: () => void;
}

function readSortMode(): "color" | "value" {
  try {
    return localStorage.getItem("odin.sort") === "value" ? "value" : "color";
  } catch {
    return "color";
  }
}

export default function GameBoard(props: GameBoardProps) {
  const { state, viewerId, isPending = false } = props;
  const { t } = useTranslation();
  const { playYourTurnSound, playCardSound, soundEnabled, toggleSound } = useSoundEffects();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<"color" | "value">(readSortMode);
  const [rulesOpen, setRulesOpen] = useState(false);

  const viewer = state.players.find((p) => p.id === viewerId);
  const viewerIndex = state.players.findIndex((p) => p.id === viewerId);
  const currentTurnPlayer = state.players[state.currentTurn];
  const isMyTurn = currentTurnPlayer?.id === viewerId && state.status === "playing" && !state.roundWinner;
  const myPickPending = isPickPending(state, viewerId);
  const othersPickPending = !myPickPending && isPickPending(state);

  const hand = useMemo(() => {
    const cards = viewer?.hand ?? [];
    return sortMode === "value" ? sortCardsByValue(cards) : sortCards(cards);
  }, [viewer?.hand, sortMode]);
  const handKey = hand.map((c) => c.id).join(",");

  // Les cartes jouées disparaissent de la sélection
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => hand.some((c) => c.id === id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey]);

  // Changement de joueur sur le même téléphone : on repart de zéro
  useEffect(() => {
    setSelectedIds([]);
  }, [viewerId]);

  // Son quand mon tour commence
  const wasMyTurn = useRef(isMyTurn);
  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current) playYourTurnSound();
    wasMyTurn.current = isMyTurn;
  }, [isMyTurn, playYourTurnSound]);

  const selectedCards = hand.filter((c) => selectedIds.includes(c.id));
  const playError = selectedCards.length ? checkCardsAgainstTable(selectedCards, state.currentPlay) : null;
  const passError = isMyTurn ? checkPass(state, viewerId) : null;
  const canPlay = isMyTurn && !myPickPending && selectedCards.length > 0 && !playError && !isPending;
  const canPass = isMyTurn && !passError && !isPending;

  // Un toucher = sélectionner. Une carte incompatible remplace la sélection (pas de message d'erreur).
  const toggleCard = (card: CardType) => {
    setSelectedIds((prev) => {
      if (prev.includes(card.id)) return prev.filter((id) => id !== card.id);
      const next = [...hand.filter((c) => prev.includes(c.id)), card];
      return isCoherentSet(next) ? next.map((c) => c.id) : [card.id];
    });
  };

  const handlePlay = () => {
    if (!canPlay) return;
    playCardSound();
    props.onPlay(selectedCards);
    setSelectedIds([]);
  };

  const handlePass = () => {
    if (!canPass) return;
    setSelectedIds([]);
    props.onPass();
  };

  const toggleSort = () => {
    const next = sortMode === "color" ? "value" : "color";
    setSortMode(next);
    try {
      localStorage.setItem("odin.sort", next);
    } catch {}
  };

  const nameOf = (id: string | null | undefined) => {
    if (!id) return "";
    if (id === viewerId) return t("ui.you");
    return state.players.find((p) => p.id === id)?.name ?? "";
  };

  // Ligne d'information sur le dernier événement
  const lastEvent = (() => {
    const a = state.lastAction;
    if (a.type === "pass" && a.playerId) return t("ui.last.pass", { name: nameOf(a.playerId) });
    if (a.type === "clear") return t("ui.last.clear", { name: nameOf(a.playerId) });
    return "";
  })();

  // Consigne affichée sous les boutons
  const hint = (() => {
    if (state.status !== "playing" || state.roundWinner) return "";
    if (viewer?.isSpectator) return t("ui.spectatorHint");
    if (!isMyTurn) return selectedCards.length ? t("ui.hint.prepared") : "";
    if (myPickPending) return t("ui.pick.hint");
    if (passError === "error.game.mustPlayTwoPlayers") return t("ui.hint.mustPlayTwoPlayers");
    if (selectedCards.length === 0) {
      return state.currentPlay.length === 0
        ? t("ui.hint.lead")
        : t("ui.hint.follow", {
            n: state.currentPlay.length,
            m: state.currentPlay.length + 1,
            value: playValue(state.currentPlay),
          });
    }
    if (playError === "error.card.mustPlayFirstCard") return t("ui.hint.leadOne");
    if (playError === "error.card.mustPlayExactCount")
      return t("ui.hint.wrongCount", { n: state.currentPlay.length, m: state.currentPlay.length + 1 });
    if (playError === "error.card.mustPlayHigherValue")
      return t("ui.hint.tooLow", { value: playValue(state.currentPlay) });
    return "";
  })();

  // Joueurs autour de la table, dans l'ordre du tour à partir du joueur suivant
  const others: Player[] = useMemo(() => {
    const n = state.players.length;
    const start = viewerIndex >= 0 ? viewerIndex : 0;
    const list: Player[] = [];
    for (let i = 1; i <= n; i++) {
      const p = state.players[(start + i) % n];
      if (p && p.id !== viewerId) list.push(p);
    }
    return list;
  }, [state.players, viewerIndex, viewerId]);

  // Fin de manche / de partie
  const roundWinner = state.roundWinner ? state.players.find((p) => p.id === state.roundWinner) : undefined;
  const gameWinner = state.gameWinner ? state.players.find((p) => p.id === state.gameWinner) : undefined;
  const labelName = (p: Player) => (p.id === viewerId ? `${p.name} (${t("game.playerYou")})` : p.name);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* En-tête compact */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-card px-2">
        <div className="flex min-w-0 items-center gap-2">{props.headerLeft}</div>
        <div className="flex items-center">
          {props.headerRight}
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={toggleSound} aria-label={soundEnabled ? t("game.soundToggle.disable") : t("game.soundToggle.enable")}>
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setRulesOpen(true)} aria-label={t("ui.rules")}>
            <HelpCircle size={18} />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={props.onLeave} aria-label={t("ui.leave")}>
            <LogOut size={18} />
          </Button>
        </div>
      </header>

      {props.banner}

      {/* Adversaires : toujours visibles, sur une ou deux lignes */}
      <div className="flex shrink-0 flex-wrap justify-center gap-1.5 px-2 py-2">
        {others.map((p) => {
          const turn = p.id === currentTurnPlayer?.id && state.status === "playing" && !state.roundWinner;
          const color = AVATAR_COLORS[state.players.findIndex((x) => x.id === p.id) % AVATAR_COLORS.length];
          return (
            <div
              key={p.id}
              className={cn(
                "flex min-w-0 items-center gap-1.5 rounded-full border bg-card py-0.5 pl-0.5 pr-2.5",
                turn && "border-amber-500 bg-amber-50 ring-2 ring-amber-400 dark:bg-amber-950",
                !p.connected && !p.isBot && "opacity-50",
              )}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {p.isBot ? <Bot size={14} /> : p.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="max-w-[4.5rem] truncate text-xs font-semibold">{p.name}</span>
                <span
                  className="whitespace-nowrap text-[11px] text-muted-foreground"
                  aria-label={`${t("ui.cardsCount", { count: p.hand.length })}, ${p.score} ${t("ui.pts")}`}
                >
                  {p.isSpectator ? (
                    t("game.playerSpectator")
                  ) : (
                    <>
                      <span className="mr-0.5 inline-block h-2.5 w-[7px] rounded-[2px] bg-primary/70 align-[-1px]" />
                      <span className="font-semibold text-foreground">{p.hand.length}</span>
                    </>
                  )}{" "}
                  · {p.score} {t("ui.pts")}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-3">
        {myPickPending ? (
          <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 p-3">
            <p className="text-base font-semibold">{t("ui.pick.title")}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {state.previousPlay.map((card) => (
                <CardComponent key={card.id} card={card} size="pick" onClick={() => !isPending && props.onPick(card.id)} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("ui.pick.discard")}</p>
          </div>
        ) : state.currentPlay.length > 0 ? (
          <>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("ui.table.toBeat")}
              {state.currentPlayBy ? ` · ${nameOf(state.currentPlayBy)}` : ""}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {state.currentPlay.map((card) => (
                <CardComponent key={card.id} card={card} size="table" />
              ))}
            </div>
            <span className="rounded-full bg-muted px-3 py-0.5 text-sm font-semibold tabular-nums">
              {playValue(state.currentPlay)}
            </span>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("ui.table.empty")}</p>
        )}
        {othersPickPending && (
          <p className="text-xs text-muted-foreground">{t("ui.pick.waiting", { name: nameOf(state.lastAction.playerId) })}</p>
        )}
      </main>

      {/* Tour + actions */}
      <section className="shrink-0 space-y-2 px-3 pb-2">
        <div
          className={cn(
            "rounded-lg px-3 py-1.5 text-center text-sm",
            isMyTurn ? "bg-amber-100 font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-50" : "bg-muted text-muted-foreground",
          )}
        >
          {state.status === "playing" && !state.roundWinner
            ? isMyTurn
              ? t("ui.turn.you")
              : t("ui.turn.other", { name: currentTurnPlayer?.name ?? "" })
            : ""}
          {lastEvent && <span className="font-normal"> · {lastEvent}</span>}
        </div>

        {!viewer?.isSpectator && (
          <div className="flex gap-2">
            <Button variant="secondary" className="h-12 flex-1 text-base" disabled={!canPass} onClick={handlePass}>
              <SkipForward className="mr-1 h-4 w-4" />
              {t("ui.action.pass")}
            </Button>
            <Button className="h-12 flex-[1.4] text-base" disabled={!canPlay} onClick={handlePlay}>
              {selectedCards.length > 0 && !playError
                ? t("ui.action.playValue", { value: playValue(selectedCards) })
                : t("ui.action.play")}
            </Button>
          </div>
        )}
        <p className="min-h-[1.25rem] text-center text-xs text-muted-foreground">{hint}</p>
      </section>

      {/* Main du joueur */}
      <section className="shrink-0 border-t bg-card px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mb-1 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>
            {viewer?.name} · {viewer?.score ?? 0} {t("ui.pts")}
          </span>
          <button type="button" className="flex items-center gap-1 rounded px-2 py-1 active:bg-muted" onClick={toggleSort}>
            <ArrowDownUp size={12} />
            {sortMode === "color" ? t("ui.sort.color") : t("ui.sort.value")}
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5 pt-2">
          {hand.map((card) => (
            <CardComponent
              key={card.id}
              card={card}
              size="hand"
              selected={selectedIds.includes(card.id)}
              onClick={viewer?.isSpectator ? undefined : toggleCard}
            />
          ))}
          {hand.length === 0 && <p className="py-4 text-sm text-muted-foreground">{t("game.noCards")}</p>}
        </div>
      </section>

      {/* Règles */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("howToPlay.title")}</DialogTitle>
          </DialogHeader>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <li key={i}>{t(`howToPlay.rule${i}`)}</li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        {roundWinner && state.status === "playing" && (
          <RoundEndModal
            winnerName={labelName(roundWinner)}
            scores={state.players.map((p) => ({ name: labelName(p), score: p.score, cards: p.hand.length }))}
            onStartNextRound={props.onStartNextRound}
            onLeaveGame={props.onLeave}
            isLoading={props.isStartingRound}
            isHost={props.canStartNextRound}
          />
        )}
        {state.status === "finished" && gameWinner && (
          <GameEndModal
            winnerName={labelName(gameWinner)}
            scores={[...state.players].sort((a, b) => a.score - b.score).map((p) => ({ name: labelName(p), score: p.score }))}
            primaryLabel={props.endPrimaryLabel}
            onPrimary={props.onEndPrimary}
            secondaryLabel={props.endSecondaryLabel}
            onSecondary={props.onEndSecondary}
          />
        )}
      </Suspense>
    </div>
  );
}
