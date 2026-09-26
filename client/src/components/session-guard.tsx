import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { getConnectionStatus, forceReconnect } from '../lib/websocket';
import { withBase } from '../lib/base';

const SessionGuard: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [location, navigate] = useLocation();
  
  useEffect(() => {
    // Only check on routes that shouldn't be accessed with active game
    if (location === '/' || location.startsWith('/create') || location.startsWith('/join')) {
      const gameId = sessionStorage.getItem('gameId');
      const playerId = sessionStorage.getItem('playerId');
      
      if (gameId && playerId) {
        // Check game status to determine where to redirect
        const checkGameStatus = async () => {
          try {
            const response = await fetch(withBase(`/api/games/${gameId}?playerId=${encodeURIComponent(playerId)}`));
            if (response.ok) {
              const game = await response.json();
              
              // Reconnect WebSocket if needed
              if (getConnectionStatus() !== 'connected') {
                forceReconnect();
              }
              
              // Redirect based on game status
              if (game.status === 'playing') {
                navigate(`/game/${gameId}`);
              } else if (game.status === 'waiting') {
                navigate(`/lobby/${gameId}`);
              }
            }
          } catch (error) {
            console.error('Error checking game status:', error);
          }
        };
        
        checkGameStatus();
      }
    }
  }, [location, navigate]);

  // Also handle visibility changes to reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const gameId = sessionStorage.getItem('gameId');
        const playerId = sessionStorage.getItem('playerId');
        
        if (gameId && playerId && 
            (location.includes('/game/') || location.includes('/lobby/'))) {
          if (getConnectionStatus() !== 'connected') {
            forceReconnect();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location]);
  
  return <>{children}</>;
};

export default SessionGuard;