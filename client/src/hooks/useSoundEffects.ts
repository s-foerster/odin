import { useEffect, useRef, useCallback, useState, useMemo } from 'react';

/**
 * Hook to manage game sound effects
 */
export function useSoundEffects() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const suspendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    // Load preference from localStorage with default true
    const savedPreference = localStorage.getItem('soundEnabled');
    return savedPreference === null ? true : savedPreference === 'true';
  });

  // Save preference when it changes
  useEffect(() => {
    localStorage.setItem('soundEnabled', soundEnabled.toString());
  }, [soundEnabled]);

  // Initialize the audio context (has to be done on user interaction or in response to an event)
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          audioContextRef.current = new AudioContext();
        }
      } catch (e) {
        console.error("Web Audio API not supported:", e);
      }
    }
    const ctx = audioContextRef.current;
    if (ctx) {
      // Le contexte audio n'est actif que le temps du son (économie de batterie)
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      if (suspendTimerRef.current) clearTimeout(suspendTimerRef.current);
      suspendTimerRef.current = setTimeout(() => {
        ctx.suspend().catch(() => {});
      }, 1500);
    }
    return ctx;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (suspendTimerRef.current) clearTimeout(suspendTimerRef.current);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(e => console.error("Error closing AudioContext:", e));
      }
    };
  }, []);

  /**
   * Play a "your turn" notification sound
   */
  const playYourTurnSound = useCallback(() => {
    // Skip if sound is disabled
    if (!soundEnabled) return;
    
    const audioCtx = initAudioContext();
    if (!audioCtx) return;

    try {
      // Create oscillator for the notification sound
      const playNote = (
        frequency: number, 
        startTime: number, 
        duration: number, 
        type: OscillatorType = 'sine', 
        volume: number = 0.2
      ) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        
        // Create a subtle fade in/out to avoid clicks
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration - 0.05);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      // Play a pleasant "ding" sound
      const now = audioCtx.currentTime;
      // First note - higher pitch
      playNote(880, now, 0.15, 'sine'); // A5
      // Second note - lower pitch with slight delay
      playNote(659.25, now + 0.2, 0.25, 'sine'); // E5
    } catch (e) {
      console.error("Error playing turn notification sound:", e);
    }
  }, [initAudioContext, soundEnabled]);

  /**
   * Play a card play sound effect
   */
  const playCardSound = useCallback(() => {
    // Skip if sound is disabled
    if (!soundEnabled) return;
    
    const audioCtx = initAudioContext();
    if (!audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      
      // Card "flick" sound
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.exponentialRampToValueAtTime(
        150, 
        now + 0.1
      );
      
      gainNode.gain.setValueAtTime(0.01, now);
      gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start(now);
      oscillator.stop(now + 0.2);
    } catch (e) {
      console.error("Error playing card sound:", e);
    }
  }, [initAudioContext, soundEnabled]);

  /**
   * Toggle sound on/off
   */
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => !prev);
  }, []);

  // Memoize the return value to ensure consistent hooks between renders
  return useMemo(() => ({
    playYourTurnSound,
    playCardSound,
    initAudioContext,
    soundEnabled,
    toggleSound
  }), [playYourTurnSound, playCardSound, initAudioContext, soundEnabled, toggleSound]);
} 