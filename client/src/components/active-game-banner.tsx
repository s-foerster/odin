import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { withBase } from "@/lib/base";

export const ActiveGameBanner = () => {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  
  const gameId = sessionStorage.getItem('gameId');
  const roomCode = sessionStorage.getItem('roomCode');
  
  if (!gameId || !roomCode) return null;
  
  const handleResume = async () => {
    try {
      const playerId = sessionStorage.getItem('playerId');
      const response = await fetch(withBase(`/api/games/${gameId}?playerId=${encodeURIComponent(playerId!)}`));
      if (response.ok) {
        const game = await response.json();
        navigate(game.status === 'playing' ? `/game/${gameId}` : `/lobby/${gameId}`);
      }
    } catch (error) {
      console.error('Error resuming game:', error);
    }
  };
  
  return (
    <Card className="mb-6 p-4 bg-primary/10 border-primary">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div>
          <h3 className="font-semibold">{t('home.activeGame')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('home.roomCode')}: <span className="font-mono">{roomCode}</span>
          </p>
        </div>
        <Button onClick={handleResume}>
          {t('home.resumeGame')}
        </Button>
      </div>
    </Card>
  );
};