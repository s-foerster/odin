import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import LanguageSelector from "@/components/ui/language-selector";
import { readSavedName, saveName } from "@/components/form-bits";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // Import AlertDialog components

const JoinGameScreen: React.FC = () => {
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [playerName, setPlayerName] = useState(readSavedName);
  // Lien partagé : /join?code=1234
  const [roomCode, setRoomCode] = useState(() => {
    const code = new URLSearchParams(window.location.search).get("code") || "";
    return code.replace(/\D/g, "").slice(0, 4);
  });
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSpectateConfirm, setShowSpectateConfirm] = useState(false);
  
  const handleJoinGame = async () => {
    if (!playerName.trim()) {
      setError(t('join.nameRequired'));
      return;
    }
    
    if (!/^\d{4}$/.test(roomCode.trim())) {
      setError(t('ui.join.codeFormat'));
      return;
    }
    saveName(playerName.trim());
    
    try {
      setIsJoining(true);
      setError(null);
      
      const response = await apiRequest("POST", "/api/games/join", {
        playerName: playerName.trim(),
        roomCode: roomCode.trim()
      });
      
      const data = await response.json();
      
      // Store game info in session storage
      sessionStorage.setItem("gameId", data.gameId);
      sessionStorage.setItem("playerId", data.playerId);
      sessionStorage.setItem("playerName", playerName);
      sessionStorage.setItem("roomCode", data.roomCode);
      
      // Navigate to lobby
      navigate(`/lobby/${data.gameId}`);
      
    } catch (err: any) {
      console.error("Failed to join game:", err);
      const errorMessage = err.message || (err.response && typeof err.response.data?.message === 'string' ? err.response.data.message : t('join.invalidCode'));
      // Check for specific error code or message indicating game is in progress
      // Assuming the server sends a specific message or code for GAME_IN_PROGRESS_SPECTATE_OFFER
      // For now, we'll check the message content. In a real app, a specific error code is better.
      if (errorMessage.includes("Game in progress, join as spectator?") || (err.response && err.response.data?.code === "GAME_IN_PROGRESS_SPECTATE_OFFER")) {
        setShowSpectateConfirm(true);
        setError(null); // Clear previous errors as we are showing a dialog
      } else if (errorMessage.includes("Game is full")) {
        setError(t('join.gameFull'));
      } else if (errorMessage.includes("This game has already finished")) {
        setError(t('join.gameFinishedError'));
      } else if (/^(400|404): /.test(errorMessage) && !/serveur|server/i.test(errorMessage)) {
        // Message déjà traduit par le serveur (nom déjà pris, partie introuvable…)
        setError(errorMessage.replace(/^\d+:\s*/, ""));
      } else {
        setError(navigator.onLine ? t('join.invalidCode') : t('ui.onlineOnly'));
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleConfirmSpectate = async () => {
    setShowSpectateConfirm(false);
    try {
      setIsJoining(true);
      setError(null);
      
      const response = await apiRequest("POST", "/api/games/join", {
        playerName: playerName.trim(),
        roomCode: roomCode.trim(),
        joinAsSpectator: true, // Join as spectator
      });
      
      const data = await response.json();
      
      sessionStorage.setItem("gameId", data.gameId);
      sessionStorage.setItem("playerId", data.playerId);
      sessionStorage.setItem("playerName", playerName);
      sessionStorage.setItem("roomCode", data.roomCode);
      
      navigate(`/lobby/${data.gameId}`);
      
    } catch (err: any) {
      console.error("Failed to join as spectator:", err);
      const errorMessage = err.message || (err.response && typeof err.response.data?.message === 'string' ? err.response.data.message : t('join.invalidCode'));
      setError(errorMessage);
    } finally {
      setIsJoining(false);
    }
  };
  
  const handleBackToHome = () => {
    navigate("/");
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 bg-background">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">{t('join.title')}</h2>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBackToHome}
              aria-label={t('join.back')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="mb-6">
            <Label htmlFor="joinPlayerName" className="block text-sm mb-1">
              {t('create.nameLabel')}
            </Label>
            <Input
              id="joinPlayerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={t('create.namePlaceholder')}
              className="w-full"
              maxLength={20}
              autoComplete="nickname"
            />
          </div>
          
          <div className="mb-6">
            <Label htmlFor="joinRoomCode" className="block text-sm mb-1">
              {t('join.roomCode')}
            </Label>
            <Input
              id="joinRoomCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoinGame();
              }}
              placeholder="1234"
              className="h-14 w-full text-center font-mono text-3xl tracking-[0.4em]"
              maxLength={4}
            />
          </div>
          
          {error && (
            <div className="mb-4 text-destructive flex items-start">
              <AlertCircle className="h-4 w-4 mr-1 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          <Button
            className="h-12 w-full text-base"
            onClick={handleJoinGame}
            disabled={isJoining}
          >
            {isJoining ? t('join.joining') : t('join.joinGame')}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showSpectateConfirm} onOpenChange={setShowSpectateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('join.spectateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('join.spectateDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowSpectateConfirm(false)}>{t('common.no')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSpectate} disabled={isJoining}>
              {isJoining ? t('join.joining') : t('common.yes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default JoinGameScreen;
