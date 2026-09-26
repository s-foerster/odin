import { GameState, WebSocketMessage } from "@shared/schema";
import { BASE } from "./base";

// WebSocket connection singleton
let socket: WebSocket | null = null;
let reconnectInterval: NodeJS.Timeout | null = null;
let messageHandlers: ((message: WebSocketMessage) => void)[] = [];
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
let currentGameId: string | null = null;
let currentPlayerId: string | null = null;
let isReconnecting = false;

export function connectToGameServer(gameId: string, playerId: string): WebSocket {
  // Check for valid inputs - This helps prevent the React error and WebSocket issues
  if (!gameId || !playerId) {
    console.error("Cannot connect to WebSocket: Missing gameId or playerId");
    
    // Attempt to recover from session storage if available
    const storedGameId = sessionStorage.getItem("gameId");
    const storedPlayerId = sessionStorage.getItem("playerId");
    
    if (storedGameId && storedPlayerId) {
      console.log("Recovered credentials from session storage");
      gameId = storedGameId;
      playerId = storedPlayerId;
    } else {
      // If we can't recover, throw an error that will be caught by the caller
      throw new Error("Missing gameId or playerId for WebSocket connection");
    }
  }
  
  // Store credentials for reconnection attempts
  currentGameId = gameId;
  currentPlayerId = playerId;
  reconnectAttempts = 0;
  
  if (socket && socket.readyState === WebSocket.OPEN) {
    // Already connected, send identity
    try {
      const message: WebSocketMessage = {
        type: "connect",
        gameId,
        playerId
      };
      socket.send(JSON.stringify(message));
      return socket;
    } catch (e) {
      console.error("Error sending identity message to existing socket:", e);
      // Fall through to create a new socket
    }
  }

  // Close existing socket if it exists
  if (socket) {
    try {
      socket.close();
    } catch (e) {
      console.error("Error closing existing socket:", e);
    }
    socket = null;
  }

  // Try to determine the correct WebSocket URL by checking the page URL
  const getCurrentHost = () => {
    // For production deployments like koyeb where the port might be different
    const host = window.location.hostname;
    // For local development, use the port 5000
    // For production, don't specify port as it's handled by the proxy
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    return isLocalhost ? `${host}:5000` : host;
  };

  // Fix protocol to match the current page protocol
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = getCurrentHost();
  const wsUrl = `${protocol}//${host}${BASE}/ws`;
  
  console.log("Connecting to WebSocket at:", wsUrl);
  
  try {
    socket = new WebSocket(wsUrl);
  } catch (error) {
    console.error("Error creating WebSocket:", error);
    throw error;
  }
  
  socket.onopen = () => {
    console.log("WebSocket connected");
    // Reset reconnection state on successful connection
    reconnectAttempts = 0;
    isReconnecting = false;
    
    // Send identity message
    const message: WebSocketMessage = {
      type: "connect",
      gameId,
      playerId
    };
    
    try {
      socket?.send(JSON.stringify(message));
    } catch (e) {
      console.error("Error sending identity message:", e);
      // If we can't send the identity message, consider the connection failed
      socket?.close();
    }
    
    // Clear reconnect interval if it exists
    if (reconnectInterval) {
      clearInterval(reconnectInterval);
      reconnectInterval = null;
    }
  };
  
  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;
      // Notify all message handlers
      messageHandlers.forEach(handler => handler(message));
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };
  
  socket.onclose = (event) => {
    console.log(`WebSocket disconnected. Code: ${event.code}, Reason: ${event.reason}`);
    
    // Don't attempt to reconnect if this is a normal closure or if we're already in the reconnect process
    if (event.code === 1000 || isReconnecting) {
      return;
    }

    // Attempt to reconnect with exponential backoff
    attemptReconnect();
  };
  
  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    // Provide more detailed error information for debugging
    console.log("WebSocket state:", socket?.readyState);
    console.log("Connection URL:", wsUrl);
    
    // Close the socket on error to trigger the reconnect process
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close();
    }
  };
  
  return socket;
}

function attemptReconnect() {
  // Try to recover stored game ID and player ID if they're missing
  if (!currentGameId || !currentPlayerId) {
    const storedGameId = sessionStorage.getItem("gameId");
    const storedPlayerId = sessionStorage.getItem("playerId");
    
    if (storedGameId && storedPlayerId) {
      currentGameId = storedGameId;
      currentPlayerId = storedPlayerId;
      console.log("Recovered credentials from session storage for reconnection");
    } else {
      console.error("Cannot reconnect - missing game ID or player ID and nothing in session storage");
      // Notify UI about the connection issue
      messageHandlers.forEach(handler => handler({
        type: "error",
        error: "Connection lost. Missing game or player information. Please refresh the page."
      }));
      return;
    }
  }
  
  if (isReconnecting) {
    return;
  }
  
  isReconnecting = true;
  
  // Clear any existing reconnect interval
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
  
  // Calculate backoff delay with jitter (to prevent all clients from reconnecting at the same time)
  const backoffDelay = Math.min(
    INITIAL_RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts) * (0.9 + Math.random() * 0.2),
    30000 // Max 30 seconds
  );
  
  console.log(`Attempting to reconnect in ${Math.round(backoffDelay / 1000)} seconds (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
  
  reconnectInterval = setTimeout(() => {
    reconnectAttempts++;
    isReconnecting = false;
    
    if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
      // Try to reconnect
      try {
        connectToGameServer(currentGameId!, currentPlayerId!);
      } catch (error) {
        console.error("Error during reconnection attempt:", error);
        // Schedule another attempt
        isReconnecting = false;
        attemptReconnect();
      }
    } else {
      console.error("Maximum reconnection attempts reached. Giving up.");
      // Notify UI that connection is lost permanently
      const errorMessage: WebSocketMessage = {
        type: "error",
        error: "Connection lost permanently. Please refresh the page."
      };
      messageHandlers.forEach(handler => handler(errorMessage));
    }
  }, backoffDelay);
}

export function disconnectFromGameServer() {
  // Cancel any pending reconnection attempts
  if (reconnectInterval) {
    clearInterval(reconnectInterval);
    reconnectInterval = null;
  }
  
  // Reset state
  currentGameId = null;
  currentPlayerId = null;
  reconnectAttempts = 0;
  isReconnecting = false;
  
  if (socket) {
    // Use code 1000 for normal closure
    try {
      socket.close(1000, "User disconnected");
    } catch (e) {
      console.error("Error closing socket during disconnect:", e);
    }
    socket = null;
  }
  
  // Clear message handlers
  messageHandlers = [];
}

// Manually trigger a reconnection attempt
export function forceReconnect() {
  // Try to recover stored game ID and player ID if they're missing
  if (!currentGameId || !currentPlayerId) {
    const storedGameId = sessionStorage.getItem("gameId");
    const storedPlayerId = sessionStorage.getItem("playerId");
    
    if (storedGameId && storedPlayerId) {
      currentGameId = storedGameId;
      currentPlayerId = storedPlayerId;
    } else {
      console.error("Cannot force reconnect - missing game ID or player ID");
      return;
    }
  }
  
  // Reset reconnection attempts
  reconnectAttempts = 0;
  isReconnecting = false;
  
  // Attempt to reconnect
  try {
    connectToGameServer(currentGameId, currentPlayerId);
  } catch (error) {
    console.error("Error during forced reconnection:", error);
    // Try the reconnection logic as a fallback
    attemptReconnect();
  }
}

export function addMessageHandler(handler: (message: WebSocketMessage) => void) {
  // Check if this handler is already registered to avoid duplicates
  const existingIndex = messageHandlers.findIndex(h => h === handler);
  if (existingIndex !== -1) {
    // Remove the existing one first to prevent duplicates
    messageHandlers.splice(existingIndex, 1);
  }
  
  // Add the handler
  messageHandlers.push(handler);
  
  // Return a cleanup function
  return () => {
    const index = messageHandlers.indexOf(handler);
    if (index !== -1) {
      messageHandlers.splice(index, 1);
    }
  };
}

export function sendMessage(message: WebSocketMessage) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.error("Cannot send message: WebSocket is not connected");
    
    // Attempt to reconnect if we have credentials
    if (currentGameId && currentPlayerId && socket?.readyState !== WebSocket.CONNECTING) {
      console.log("Attempting to reconnect before sending message...");
      try {
        connectToGameServer(currentGameId, currentPlayerId);
        
        // Queue the message to be sent after connection
        const reconnectTimeout = setTimeout(() => {
          // Check if we're connected now
          if (socket?.readyState === WebSocket.OPEN) {
            try {
              socket.send(JSON.stringify(message));
              console.log("Message sent after reconnection");
            } catch (e) {
              console.error("Failed to send message after reconnection:", e);
            }
          } else {
            console.error("Still not connected after reconnection attempt");
          }
          clearTimeout(reconnectTimeout);
        }, 1000);
      } catch (e) {
        console.error("Failed to reconnect for sending message:", e);
      }
    }
    
    return false;
  }
  
  try {
    // Special handling for chat messages to ensure proper format
    if (message.type === "chat_message" && message.chatMessage) {
      // Make sure the message has all the required fields
      if (!message.gameId || !message.playerId) {
        message.gameId = currentGameId || "";
        message.playerId = currentPlayerId || "";
      }
    }
    
    socket.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error("Error sending message:", error);
    return false;
  }
}

export function getConnectionStatus(): "connected" | "connecting" | "disconnected" | "reconnecting" {
  if (isReconnecting) return "reconnecting";
  if (!socket) return "disconnected";
  
  switch (socket.readyState) {
    case WebSocket.CONNECTING:
      return "connecting";
    case WebSocket.OPEN:
      return "connected";
    default:
      return "disconnected";
  }
}

// Add a function to register a message handler specifically for a message type
export function addTypedMessageHandler(type: string, handler: (message: WebSocketMessage) => void) {
  const wrappedHandler = (message: WebSocketMessage) => {
    if (message.type === type) {
      handler(message);
    }
  };
  
  messageHandlers.push(wrappedHandler);
  return () => {
    // Return a function to remove this handler if needed
    const index = messageHandlers.indexOf(wrappedHandler);
    if (index !== -1) {
      messageHandlers.splice(index, 1);
    }
  };
}
