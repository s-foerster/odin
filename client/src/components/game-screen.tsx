import { useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import type { Card as CardType } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { disconnectFromGameServer, forceReconnect } from "@/lib/websocket";
import { gameQueryKey, useOnlineGame } from "@/hooks/useOnlineGame";
import { ChatButton } from "@/components/ui/chat-button";
import GameBoard from "@/components/game-board";
import { AlertCircle } from "lucide-react";

interface GameScreenProps {
  gameId: string;
}

export function clearOnlineSession() {
  sessionStorage.removeItem("gameId");
  sessionStorage.removeItem("playerId");
  sessionStorage.removeItem("playerName");
  sessionStorage.removeItem("roomCode");
}

const GameScreen: React.FC<GameScreenProps> = ({ gameId }) => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const playerId = sessionStorage.getItem("playerId") || "";

  const { data: state, isLoading, error, connectionStatus } = useOnlineGame(gameId, playerId);

  const refresh = () => queryClient.invalidateQueries({ queryKey: gameQueryKey(gameId, playerId) });
  const showError = (title: string) => (err: unknown) => {
    toast({ title, description: err instanceof Error ? err.message.replace(/^\d+:\s*/, "") : "", variant: "destructive" });
    refresh();
  };

  const play = useMutation({
    mutationFn: (cards: CardType[]) => apiRequest("POST", `/api/games/${gameId}/play`, { playerId, cards }),
    onError: showError(t("ui.error.play")),
  });
  const pick = useMutation({
    mutationFn: (cardId: string) => apiRequest("POST", `/api/games/${gameId}/pick`, { playerId, cardId }),
    onError: showError(t("game.error.failedPickCard")),
  });
  const pass = useMutation({
    mutationFn: () => apiRequest("POST", `/api/games/${gameId}/pass`, { playerId }),
    onError: showError(t("game.error.failedPass")),
  });
  const nextRound = useMutation({
    mutationFn: () => apiRequest("POST", `/api/games/${gameId}/round`, { playerId }),
    onError: showError(t("game.error.failedStartRound")),
  });

  useEffect(() => {
    if (!gameId || !playerId) navigate("/");
  }, [gameId, playerId, navigate]);

  // Partie ou joueur introuvable (serveur redémarré, partie expirée…)
  useEffect(() => {
    if (error && /403|404/.test(error.message)) {
      toast({ title: t("game.sessionEnded"), description: t("game.sessionExpired"), variant: "destructive" });
      clearOnlineSession();
      navigate("/");
    }
  }, [error, navigate, toast, t]);

  useEffect(() => {
    if (state?.status === "waiting") navigate(`/lobby/${gameId}`);
  }, [state?.status, gameId, navigate]);

  const leave = (ask = true) => {
    if (ask && !confirm(t("game.leaveConfirm"))) return;
    disconnectFromGameServer();
    clearOnlineSession();
    navigate("/");
  };

  if (isLoading || !state) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent motion-safe:animate-spin" />
      </div>
    );
  }

  const me = state.players.find((p) => p.id === playerId);
  const disconnected = connectionStatus === "disconnected" || connectionStatus === "reconnecting";

  return (
    <GameBoard
      state={state}
      viewerId={playerId}
      isPending={play.isPending || pick.isPending || pass.isPending}
      onPlay={(cards) => play.mutate(cards)}
      onPick={(cardId) => pick.mutate(cardId)}
      onPass={() => pass.mutate()}
      onLeave={() => leave(true)}
      headerLeft={
        <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm tracking-widest" aria-label={t("ui.lobby.code")}>
          #{state.roomCode}
        </span>
      }
      headerRight={me ? <ChatButton gameId={gameId} playerId={playerId} playerName={me.name} position="inline" /> : null}
      banner={
        disconnected ? (
          <div className="flex items-center justify-center gap-2 bg-destructive/15 px-2 py-1 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{t("game.connectionLost")}</span>
            <Button variant="outline" size="sm" className="h-7" onClick={() => forceReconnect()}>
              {t("game.reconnect")}
            </Button>
          </div>
        ) : null
      }
      canStartNextRound={!!me?.isHost}
      onStartNextRound={() => nextRound.mutate()}
      isStartingRound={nextRound.isPending}
      endPrimaryLabel={t("ui.end.newGame")}
      onEndPrimary={() => {
        leave(false);
        navigate("/create");
      }}
      endSecondaryLabel={t("ui.end.home")}
      onEndSecondary={() => leave(false)}
    />
  );
};

export default GameScreen;
