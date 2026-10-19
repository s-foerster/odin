import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GameState, WebSocketMessage } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import {
  addMessageHandler,
  connectToGameServer,
  onConnectionStatusChange,
  type ConnectionStatus,
} from "@/lib/websocket";

export function gameQueryKey(gameId: string, playerId: string) {
  return [`/api/games/${gameId}?playerId=${encodeURIComponent(playerId)}`];
}

function usePageVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

/**
 * État d'une partie en ligne.
 * Économe en batterie : l'état arrive par WebSocket (aucune requête répétée).
 * On ne relit l'API toutes les 10 s que si la connexion temps réel est coupée
 * ET que la page est visible.
 */
export function useOnlineGame(gameId: string, playerId: string) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const visible = usePageVisible();
  const key = gameQueryKey(gameId, playerId);

  const query = useQuery<GameState, Error>({
    queryKey: key,
    enabled: !!gameId && !!playerId,
    staleTime: Infinity,
    refetchInterval: status !== "connected" && visible ? 10000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error.message.includes("403") || error.message.includes("404")) return false;
      return failureCount < 3;
    },
  });

  useEffect(() => {
    if (!gameId || !playerId) return;
    try {
      connectToGameServer(gameId, playerId);
    } catch (e) {
      console.error("WebSocket connection failed", e);
    }
    const removeHandler = addMessageHandler((message: WebSocketMessage) => {
      if (message.type === "turn_update" && message.gameId === gameId && message.gameState) {
        queryClient.setQueryData(key, message.gameState);
      }
    });
    const removeStatus = onConnectionStatusChange(setStatus);
    return () => {
      removeHandler();
      removeStatus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, playerId]);

  // Au retour sur la page, on resynchronise une fois
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (visible && !wasVisible.current && gameId && playerId) {
      queryClient.invalidateQueries({ queryKey: key });
    }
    wasVisible.current = visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return { ...query, connectionStatus: status };
}
