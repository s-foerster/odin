import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, Copy, LogOut, Play, Share2, Users, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { disconnectFromGameServer } from "@/lib/websocket";
import { useOnlineGame } from "@/hooks/useOnlineGame";
import { ChatButton } from "@/components/ui/chat-button";
import LanguageSelector from "@/components/ui/language-selector";
import { clearOnlineSession } from "@/components/game-screen";

const LobbyScreen: React.FC = () => {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/lobby/:gameId");
  const { toast } = useToast();
  const { t } = useTranslation();

  const gameId = params?.gameId || sessionStorage.getItem("gameId") || "";
  const playerId = sessionStorage.getItem("playerId") || "";
  const playerName = sessionStorage.getItem("playerName") || "";

  const { data: gameState, isLoading, error } = useOnlineGame(gameId, playerId);
  const me = gameState?.players.find((p) => p.id === playerId);
  const isHost = !!me?.isHost;

  const onError = (err: unknown) =>
    toast({
      title: t("game.errorGeneric"),
      description: err instanceof Error ? err.message.replace(/^\d+:\s*/, "") : "",
      variant: "destructive",
    });

  const startGame = useMutation({
    mutationFn: () => apiRequest("POST", `/api/games/${gameId}/start`, { playerId }),
    onError,
  });
  const addBot = useMutation({
    mutationFn: () => apiRequest("POST", `/api/games/${gameId}/bots`, { playerId }),
    onError,
  });
  const removeBot = useMutation({
    mutationFn: (botId: string) => apiRequest("POST", `/api/games/${gameId}/bots/remove`, { playerId, botId }),
    onError,
  });

  useEffect(() => {
    if (!gameId || !playerId) navigate("/");
  }, [gameId, playerId, navigate]);

  useEffect(() => {
    if (gameState && gameState.status !== "waiting") navigate(`/game/${gameId}`);
  }, [gameState?.status, gameId, navigate]);

  const leave = () => {
    disconnectFromGameServer();
    clearOnlineSession();
    navigate("/");
  };

  const roomCode = gameState?.roomCode || sessionStorage.getItem("roomCode") || "";

  const share = async () => {
    const text = t("ui.lobby.shareText", { code: roomCode });
    try {
      if (navigator.share) {
        await navigator.share({ title: "Odin", text, url: window.location.origin + import.meta.env.BASE_URL + "join" });
        return;
      }
    } catch {
      return; // partage annulé
    }
    try {
      await navigator.clipboard.writeText(roomCode);
      toast({ title: t("create.copied"), description: t("create.codeCopied"), duration: 2000 });
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent motion-safe:animate-spin" />
      </div>
    );
  }

  if (error || !gameState) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="mb-4 text-xl font-semibold">{t("game.errorTitle")}</h2>
            <p className="mb-4 text-muted-foreground">{t("game.errorMessage")}</p>
            <Button onClick={leave}>{t("game.backToHome")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const players = gameState.players;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4">
        <LanguageSelector />
      </div>

      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 pt-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">{t("ui.lobby.shareHint")}</p>
            <button
              type="button"
              onClick={share}
              className="mt-1 inline-flex items-center gap-3 rounded-xl bg-muted px-5 py-2 font-mono text-5xl font-bold tracking-[0.3em] active:bg-muted/70"
              aria-label={t("create.copyCode")}
            >
              {roomCode}
              {typeof navigator.share === "function" ? <Share2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-5 w-5" />
              <h3 className="font-medium">
                {t("game.players")} ({players.length})
              </h3>
            </div>
            <ul className="divide-y divide-background rounded-lg bg-muted">
              {players.map((player) => (
                <li key={player.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {player.isBot && <Bot className="h-4 w-4 shrink-0" />}
                    <span className="truncate">
                      {player.name}
                      {player.id === playerId && ` (${t("game.playerYou")})`}
                    </span>
                  </span>
                  {player.isHost ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                      {t("game.playerHost")}
                    </span>
                  ) : player.isBot && isHost ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeBot.mutate(player.id)}
                      aria-label={t("ui.bots.remove")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {isHost && (
              <Button
                variant="outline"
                className="mt-2 h-11 w-full"
                onClick={() => addBot.mutate()}
                disabled={addBot.isPending}
              >
                <Bot className="mr-2 h-4 w-4" />
                {t("ui.bots.add")}
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {isHost ? (
              <Button
                className="h-12 w-full text-base"
                onClick={() => startGame.mutate()}
                disabled={startGame.isPending || players.length < 2}
              >
                <Play className="mr-2 h-4 w-4" />
                {players.length < 2 ? t("ui.lobby.needPlayers") : t("game.startGame")}
              </Button>
            ) : (
              <p className="py-2 text-center text-sm text-muted-foreground">{t("ui.lobby.waitingHost")}</p>
            )}
            <Button variant="ghost" className="h-11 w-full" onClick={leave}>
              <LogOut className="mr-2 h-4 w-4" />
              {t("ui.leave")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {gameId && playerId && (me?.name || playerName) && (
        <ChatButton gameId={gameId} playerId={playerId} playerName={me?.name || playerName} position="bottom-right" />
      )}
    </div>
  );
};

export default LobbyScreen;
