import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, X, Mic, StopCircle, Loader2 } from "lucide-react";
import { sendMessage, addMessageHandler } from "@/lib/websocket";
import { ChatMessage, WebSocketMessage } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { VoiceMessage } from "@/components/ui/voice-message";
import axios from "axios";
import { withBase } from "@/lib/base";
import "@/styles/voice-recorder.css";

// VITE_VOICE_MESSAGES_DISABLED=true au build masque le bouton micro
const VOICE_ENABLED = import.meta.env.VITE_VOICE_MESSAGES_DISABLED !== "true";

interface ChatPanelProps {
  gameId: string;
  playerId: string;
  playerName: string;
  open?: boolean;
  onClose?: () => void;
  onUnreadCount?: (count: number) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  gameId, 
  playerId, 
  playerName,
  open = false,
  onClose,
  onUnreadCount
}) => {
  const [isOpen, setIsOpen] = useState(open);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lastViewedRef = useRef<number>(Date.now());
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const messageHandlerRef = useRef<(() => void) | null>(null);
  const unreadCountRef = useRef<number>(0);
  
  // Audio recorder hook
  const { 
    isRecording, 
    duration, 
    audioBlob, 
    error: recorderError,
    startRecording, 
    stopRecording,
    clearRecording
  } = useAudioRecorder();

  // Function declarations
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;

    // Send the message via WebSocket
    sendMessage({
      type: "chat_message",
      gameId,
      playerId,
      chatMessage: {
        id: "temp-" + Date.now(), // Server will replace this
        gameId,
        playerId,
        playerName,
        message: message.trim(),
        timestamp: Date.now(),
        messageType: "text"
      }
    });

    setMessage("");
  };

  // Render a chat message
  const renderMessage = (msg: ChatMessage) => {
    const isOwnMessage = msg.playerId === playerId;
    const messageTime = new Date(msg.timestamp);
    const formattedTime = format(messageTime, "h:mm a");
    
    return (
      <div 
        key={msg.id} 
        className={cn(
          "flex flex-col max-w-[80%] rounded-lg p-3 mb-1",
          isOwnMessage 
            ? "bg-primary text-primary-foreground self-end" 
            : "bg-muted self-start"
        )}
      >
        {!isOwnMessage && (
          <div className="text-xs font-medium mb-1">
            {msg.playerName}
          </div>
        )}
        
        {msg.messageType === "voice" ? (
          <VoiceMessage 
            id={msg.id}
            audioUrl={msg.audioUrl!}
            duration={msg.duration || 0}
            isCurrentUser={isOwnMessage}
            timestamp={msg.timestamp}
          />
        ) : (
          <div className="break-words">{msg.message}</div>
        )}
        
        <div className={cn(
          "text-xs mt-1",
          isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {formattedTime}
        </div>
      </div>
    );
  };

  // Update the parent component with unread count changes
  useEffect(() => {
    if (onUnreadCount) {
      onUnreadCount(unreadCount);
    }
  }, [unreadCount, onUnreadCount]);

  // Handle messages from WebSocket
  useEffect(() => {
    // Clear any previous message handler
    if (messageHandlerRef.current) {
      messageHandlerRef.current();
      messageHandlerRef.current = null;
    }

    // Message handler for chat messages
    const handleChatMessage = (message: WebSocketMessage) => {
      if (message.type === "chat_message" && message.chatMessage) {
        // Check if this message ID has already been processed
        if (!processedMessagesRef.current.has(message.chatMessage.id)) {
          processedMessagesRef.current.add(message.chatMessage.id);
          setChatMessages(prev => [...prev, message.chatMessage!]);
          
          // If the chat is closed and message is from someone else, increment unread count
          if (!isOpen && message.chatMessage.playerId !== playerId) {
            // Use ref to track unread count to avoid dependency issue
            unreadCountRef.current += 1;
            setUnreadCount(unreadCountRef.current);
          }
        }
      } else if (message.type === "chat_history" && message.chatHistory) {
        // For chat history, we reset our processed set and replace all messages
        processedMessagesRef.current = new Set(message.chatHistory.map(msg => msg.id));
        setChatMessages(message.chatHistory);
        
        // Calculate unread messages based on last viewed timestamp
        if (!isOpen) {
          const unreadMessages = message.chatHistory.filter(
            msg => msg.timestamp > lastViewedRef.current && msg.playerId !== playerId
          );
          unreadCountRef.current = unreadMessages.length;
          setUnreadCount(unreadCountRef.current);
        }
      }
    };

    // Add the chat message handler
    messageHandlerRef.current = addMessageHandler(handleChatMessage);

    // Request chat history on mount
    sendMessage({
      type: "chat_history",
      gameId,
      playerId
    });

    // Clean up handler on unmount or when dependencies change
    return () => {
      if (messageHandlerRef.current) {
        messageHandlerRef.current();
        messageHandlerRef.current = null;
      }
    };
  }, [gameId, playerId, isOpen]); // Remove onUnreadCount from dependencies

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current && isOpen) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isOpen]);

  // Sync open prop with internal state
  useEffect(() => {
    if (open !== isOpen) {
      setIsOpen(open);
      
      // When opening chat, clear unread count and update last viewed time
      if (open) {
        unreadCountRef.current = 0;
        setUnreadCount(0);
        lastViewedRef.current = Date.now();
      }
    }
  }, [open, isOpen]);

  // Handle voice recording errors
  useEffect(() => {
    if (recorderError) {
      // Display error to user
      console.error('Recording error:', recorderError);
    }
  }, [recorderError]);

  const handleClose = () => {
    setIsOpen(false);
    // Set last viewed time when closing
    lastViewedRef.current = Date.now();
    // Reset unread count
    unreadCountRef.current = 0;
    setUnreadCount(0);
    if (onClose) onClose();
  };

  const handleRecordToggle = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleSendVoiceMessage = async () => {
    if (!audioBlob) return;
    
    try {
      setIsUploading(true);
      
      // Create form data for upload
      const formData = new FormData();
      // Determine file extension based on MIME type
      const mimeType = audioBlob.type;
      const ext = mimeType.includes('mp4') ? 'mp4'
                : mimeType.includes('mpeg') ? 'mp3' : 'webm';
      formData.append('audio', audioBlob, `voice-message.${ext}`);
      formData.append('mimeType', mimeType);
      formData.append('playerId', playerId);
      formData.append('playerName', playerName);
      formData.append('duration', duration.toString());
      
      // Upload the voice message
      await axios.post(withBase(`/api/games/${gameId}/voice-message`), formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Clear the recording
      clearRecording();
    } catch (error) {
      console.error("Error uploading voice message:", error);
      clearRecording(); // Clean up client state on failure
    } finally {
      setIsUploading(false);
    }
  };

  // Don't render anything if not open and component should be completely hidden
  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none opacity-0'}`}>
      <div 
        className={`fixed inset-0 bg-black/40 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`} 
        onClick={handleClose}
      />
      
      <Card 
        className={`fixed right-4 bottom-16 w-80 md:w-96 h-[70vh] max-h-[600px] z-50 shadow-lg overflow-hidden transition-transform duration-200 ${
          isOpen 
            ? 'translate-y-0 opacity-100' 
            : 'translate-y-8 opacity-0'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-3 border-b flex justify-between items-center">
            <div className="flex items-center">
              <MessageCircle className="h-5 w-5 mr-2" />
              <h3 className="font-semibold">Chat</h3>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0" 
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div 
            ref={chatContainerRef}
            className="flex-grow overflow-y-auto p-3 flex flex-col gap-2"
          >
            {chatMessages.length === 0 ? (
              <div className="text-muted-foreground text-center mt-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No messages yet</p>
                <p className="text-sm">Start a conversation!</p>
              </div>
            ) : (
              chatMessages.map(renderMessage)
            )}
          </div>
          
          <div className="p-3 border-t">
            {audioBlob && !isUploading ? (
              <div className="mb-3 rounded-md border p-2">
                <div className="text-xs text-muted-foreground mb-1">
                  Voice message ({Math.round(duration)}s)
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-8" 
                    onClick={clearRecording}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-8 flex-grow" 
                    onClick={handleSendVoiceMessage}
                  >
                    Send Voice Message
                  </Button>
                </div>
              </div>
            ) : isRecording ? (
              <div className="recording-indicator mb-3 flex items-center gap-2 rounded-md border p-2">
                <div className="recording-pulse"></div>
                <span className="text-sm">Recording... {Math.round(duration)}s</span>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-7 ml-auto" 
                  onClick={handleRecordToggle}
                >
                  <StopCircle className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              </div>
            ) : null}
            
            {isUploading ? (
              <div className="flex justify-center items-center h-10 mb-3">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span>Sending voice message...</span>
              </div>
            ) : null}
          
            <div className="flex gap-2">
              {VOICE_ENABLED && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 shrink-0"
                onClick={handleRecordToggle}
                disabled={isUploading || !!audioBlob}
              >
                <Mic className="h-5 w-5" />
              </Button>
              )}
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="h-10"
                disabled={isRecording || isUploading || !!audioBlob}
              />
              <Button 
                variant="default" 
                size="icon" 
                className="h-10 w-10 shrink-0"
                onClick={handleSendMessage}
                disabled={isRecording || isUploading || !!audioBlob || !message.trim()}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ChatPanel; 