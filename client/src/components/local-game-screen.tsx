import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import type { GameState } from "@shared/schema";
import { applyPass, applyPick, applyPlay, RuleError, startRound } from "@shared/engine";
import { chooseBotAction } from "@shared/bot";
import GameBoard from "@/components/game-board";
import { useToast } from "@/hooks/use-toast";
import {
  clearLocalGame,
  cloneState,
  createLocalGame,
  loadLocalGame,
  saveLocalGame,
  type LocalSave,
} from "@/lib/local-game";

const BOT_DELAY = 800;

export default function LocalGameScreen() {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [save, setSave] = useState<LocalSave | null>(loadLocalGame);
  const [pageVisible, setPageVisible] = useState(() => document.visibilityState === "visible");

  useEffect(() => {
    if (!save) navigate("/offline");
  }, [save, navigate]);

  useEffect(() => {
    const onChange = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  // Applique une action sur une copie de l'état puis sauvegarde
  const saveRef = useRef(save);
  saveRef.current = save;
  const update = useCallback(
    (fn: (state: GameState) => void) => {
      const prev = saveRef.current;
      if (!prev) return;
      const state = cloneState(prev.state);
      try {
        fn(state);
      } catch (error) {
        if (error instanceof RuleError) {
          toast({ title: t(error.code), variant: "destructive" });
          return;
        }
        throw error;
      }
      const next = { ...prev, state };
      saveRef.current = next;
      saveLocalGame(next);
      setSave(next);
    },
    [t, toast],
  );

  const state = save?.state;
  const current = state ? state.players[state.currentTurn] : undefined;
  const humanCount = state ? state.players.filter((p) => !p.isBot).length : 0;
  const roundOver = !!state?.roundWinner || state?.status !== "playing";

  // Tour des bots (en pause quand l'écran est masqué)
  useEffect(() => {
    if (!state || !current?.isBot || roundOver || !pageVisible) return;
    const timer = setTimeout(() => {
      update((s) => {
        const bot = s.players[s.currentTurn];
        const action = chooseBotAction(s, bot.id);
        if (!action) return;
        if (action.type === "play") applyPlay(s, bot.id, action.cards);
        else if (action.type === "pick") applyPick(s, bot.id, action.cardId);
        else applyPass(s, bot.id);
      });
    }, BOT_DELAY);
    return () => clearTimeout(timer);
  }, [state, current?.isBot, roundOver, pageVisible, update]);

  if (!save || !state) return null;

  // Plusieurs humains sur le même téléphone : écran de passage entre deux joueurs
  const needsHandoff = humanCount > 1 && !!current && !current.isBot && !roundOver && current.id !== save.viewerId;
  const viewerId = humanCount > 1 ? save.viewerId : state.players.find((p) => !p.isBot)!.id;
  const actingId = current && !current.isBot ? current.id : viewerId;

  const revealHand = () => {
    if (!current) return;
    const next = { ...save, viewerId: current.id };
    saveLocalGame(next);
    setSave(next);
  };

  const restart = () => {
    const fresh = createLocalGame(save.config);
    saveLocalGame(fresh);
    setSave(fresh);
  };

  return (
    <>
      <GameBoard
        state={state}
        viewerId={viewerId}
        onPlay={(cards) => update((s) => applyPlay(s, actingId, cards))}
        onPick={(cardId) => update((s) => applyPick(s, actingId, cardId))}
        onPass={() => update((s) => applyPass(s, actingId))}
        onLeave={() => navigate("/")}
        headerLeft={
          <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium">{t("ui.offline.badge")}</span>
        }
        canStartNextRound
        onStartNextRound={() => update((s) => startRound(s))}
        endPrimaryLabel={t("ui.end.playAgain")}
        onEndPrimary={restart}
        endSecondaryLabel={t("ui.end.home")}
        onEndSecondary={() => {
          clearLocalGame();
          navigate("/");
        }}
      />

      {needsHandoff && (
        <button
          type="button"
          onClick={revealHand}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-primary p-6 text-center text-primary-foreground"
        >
          <span className="text-3xl font-bold">{t("ui.handoff.title", { name: current!.name })}</span>
          <span className="max-w-xs text-base opacity-80">{t("ui.handoff.hint")}</span>
        </button>
      )}
    </>
  );
}
