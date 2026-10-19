import React, { useState, useEffect, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

// Lazy load the ChatPanel component with explicit chunk name
const ChatPanelLazy = lazy(() => 
  import(/* webpackChunkName: "chat-panel" */ "@/components/ui/chat-panel")
);

interface ChatButtonProps {
  gameId: string;
  playerId: string;
  playerName: string;
  position?: "bottom-right" | "top-right" | "inline";
}

export const ChatButton: React.FC<ChatButtonProps> = ({
  gameId,
  playerId,
  playerName,
  position = "bottom-right"
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPanelMounted, setIsPanelMounted] = useState(false);
  const [lastViewedTime, setLastViewedTime] = useState(Date.now());

  // Initialize panel with slight delay to prevent immediate mount during initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPanelMounted(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Reset state when props change (e.g., navigating between games)
  useEffect(() => {
    // Reset unread count when gameId changes
    setUnreadCount(0);
    setIsChatOpen(false);
    
    // This effect cleans up automatically when component unmounts
  }, [gameId, playerId]);

  const handleUnreadCountChange = (count: number) => {
    // Only update if the count is different to avoid unnecessary rerenders
    if (count !== unreadCount) {
      setUnreadCount(count);
    }
  };

  const handleToggle = () => {
    // Use functional updates to avoid stale state
    setIsChatOpen((prev) => !prev);
    
    // Reset unread count when opening chat
    if (!isChatOpen) {
      setUnreadCount(0);
      setLastViewedTime(Date.now());
    }
  };

  const positionClasses =
    position === "inline"
      ? "relative h-10 w-10"
      : position === "bottom-right"
        ? "fixed bottom-4 right-4 z-40 shadow-lg hover:shadow-xl"
        : "fixed top-4 right-4 z-40 shadow-lg hover:shadow-xl";

  return (
    <>
      <Button
        onClick={handleToggle}
        size="icon"
        variant={position === "inline" ? "ghost" : "default"}
        className={`${positionClasses} transition-all`}
        aria-label="Open chat"
      >
        <MessageCircle size={22} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Always render the ChatPanel but control visibility with CSS */}
      {isPanelMounted && (
        <Suspense fallback={
          <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 ${!isChatOpen ? 'hidden' : ''}`}>
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        }>
          <ChatPanelLazy
            gameId={gameId}
            playerId={playerId}
            playerName={playerName}
            open={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            onUnreadCount={handleUnreadCountChange}
          />
        </Suspense>
      )}
    </>
  );
}; 