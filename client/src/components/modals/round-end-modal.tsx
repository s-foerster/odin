import { Button } from "@/components/ui/button";
import { LogOut, Play, Trophy, Award, Crown, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface RoundScore {
  name: string;
  cards: number;
}

interface RoundEndModalProps {
  winnerName: string;
  scores: RoundScore[];
  onStartNextRound: () => void;
  onLeaveGame: () => void;
  isLoading?: boolean;
  isHost: boolean;
}

// Confetti component
const Confetti = () => {
  const [particles, setParticles] = useState<Array<{
    x: number;
    y: number;
    color: string;
    scale: number;
    rotation: number;
  }>>([]);

  // Use a ref to track if sound has been played
  const soundPlayedRef = useRef(false);

  useEffect(() => {
    const colors = ["#FFD700", "#FF6347", "#4169E1", "#32CD32", "#9370DB", "#FF69B4"];
    const newParticles = [];
    
    for (let i = 0; i < 30; i++) {
      newParticles.push({
        x: Math.random() * 100,
        y: -20 - Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        scale: 0.5 + Math.random() * 0.5,
        rotation: Math.random() * 360
      });
    }
    
    setParticles(newParticles);
    
    // Only play sound if it hasn't been played yet (et si le son est activé)
    let soundOn = true;
    try {
      soundOn = localStorage.getItem('soundEnabled') !== 'false';
    } catch {}
    if (!soundPlayedRef.current && soundOn) {
      soundPlayedRef.current = true;
      
      try {
        // Create an audio context outside of React's lifecycle
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const audioCtx = new AudioContext();
        
        // Create a simple victory fanfare
        const playNote = (frequency: number, startTime: number, duration: number, volume: number = 1) => {
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          
          oscillator.type = 'triangle';
          oscillator.frequency.value = frequency;
          
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.05);
          gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
          
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          
          oscillator.start(startTime);
          oscillator.stop(startTime + duration);
        };
        
        // Play a simple victory fanfare
        const now = audioCtx.currentTime;
        playNote(587.33, now, 0.2, 0.3);      // D5
        playNote(740, now + 0.2, 0.2, 0.3);   // F#5
        playNote(880, now + 0.4, 0.4, 0.3);   // A5
        playNote(1174.66, now + 0.8, 0.8, 0.3); // D6
        
        // Clean up audio context after sound completes
        setTimeout(() => {
          audioCtx.close().catch(e => console.error("Error closing AudioContext:", e));
        }, 2000);
      } catch (e) {
        console.log("Audio context not supported:", e);
      }
    }
    
    return () => {
      // Cleanup function
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {particles.map((particle, index) => (
        <motion.div
          key={index}
          className="absolute w-3 h-3 origin-center"
          style={{
            left: `${particle.x}%`,
            top: `-5%`,
            backgroundColor: particle.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "0%",
          }}
          initial={{ scale: 0, rotate: 0 }}
          animate={{
            y: `${100 + Math.random() * 20}vh`,
            scale: particle.scale,
            rotate: particle.rotation + Math.random() * 360,
            opacity: [1, 1, 0.8, 0]
          }}
          transition={{
            duration: 2.5 + Math.random() * 2.5,
            ease: "easeOut",
            delay: Math.random() * 0.2
          }}
        />
      ))}
    </div>
  );
};

// Winner Card component
const WinnerCard = ({ name }: { name: string }) => {
  const { t } = useTranslation();
  return (
    <motion.div
      className="bg-gradient-to-r from-yellow-500/20 via-yellow-300/20 to-yellow-500/20 rounded-lg p-4 mb-4 border border-yellow-400 relative overflow-hidden"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <div className="absolute -top-6 -right-6 w-12 h-12 bg-yellow-400/20 rounded-full z-0" />
      <div className="absolute -bottom-6 -left-6 w-12 h-12 bg-yellow-400/20 rounded-full z-0" />
      
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center">
          <motion.div
            initial={{ rotate: -10, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mr-3 bg-yellow-400 text-yellow-800 p-2 rounded-full"
          >
            <Crown className="h-6 w-6" />
          </motion.div>
          
          <div>
            <h4 className="text-lg font-bold text-yellow-500 flex items-center">
              {t('game.winner')}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                className="ml-2"
              >
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              </motion.div>
            </h4>
            <p className="text-2xl font-bold">{name}</p>
          </div>
        </div>
        
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, 5, -5, 5, -5, 0] }}
          transition={{ delay: 0.8, duration: 1.5, times: [0, 0.2, 0.4, 0.6, 0.8, 1] }}
        >
          <Trophy className="h-10 w-10 text-yellow-500" />
        </motion.div>
      </div>
      
      <motion.div 
        className="w-full h-1 bg-gradient-to-r from-yellow-500 via-yellow-300 to-yellow-500 mt-3 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ duration: 0.8, delay: 0.4 }}
      />
    </motion.div>
  );
};

const RoundEndModal: React.FC<RoundEndModalProps> = ({
  winnerName,
  scores,
  onStartNextRound,
  onLeaveGame,
  isLoading = false,
  isHost
}) => {
  const { t } = useTranslation();
  const [showConfetti, setShowConfetti] = useState(true);
  // Sort scores by lowest cards (winner at top) and ensure winner shows +0
  const sortedScores = [...scores].sort((a, b) => a.cards - b.cards)
    .map((score, index) => ({
      ...score,
      // First player (index 0) is the winner, so they get 0 points
      cards: index === 0 ? 0 : score.cards
    }));
  
  useEffect(() => {
    // Hide confetti after 5 seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4">
      {showConfetti && <Confetti />}
      <motion.div 
        className="bg-card rounded-lg shadow-lg p-5 max-w-md w-full mx-auto max-h-[92dvh] overflow-y-auto"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 260, damping: 20 }}
      >
        <motion.div 
          className="text-center mb-4"
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <motion.div 
            className="inline-block relative"
            animate={{ 
              rotate: [0, -5, 5, -5, 5, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 1.5, 
              times: [0, 0.2, 0.4, 0.6, 0.8, 1],
              repeat: 1,
              repeatDelay: 2
            }}
          >
            <span className="inline-flex items-center justify-center p-3 bg-success/20 text-success rounded-full mb-2 relative">
              <Trophy className="h-10 w-10" />
              <motion.span 
                className="absolute inset-0 rounded-full bg-success/10"
                animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0] }}
                transition={{ duration: 1.5 }}
              />
            </span>
          </motion.div>
          
          <h3 className="text-2xl font-bold mb-2 text-success">
            {t('game.roundComplete')}
          </h3>
        </motion.div>
        
        <WinnerCard name={winnerName} />
        
        <motion.div 
          className="bg-muted p-4 rounded-lg mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <h4 className="font-medium mb-4 flex items-center">
            <Award className="mr-2 h-5 w-5" />
            {t('game.roundScores')}:
          </h4>
          <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {sortedScores.map((score, index) => (
              <motion.li 
                key={index} 
                className={`flex justify-between items-center p-2 rounded-md ${
                  index === 0 
                    ? "bg-gradient-to-r from-success/10 to-success/5 border border-success/20" 
                    : "hover:bg-muted-foreground/5"
                }`}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
              >
                <div className="flex items-center">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                      index === 0 ? "bg-success/20 text-success" : "bg-muted-foreground/20"
                    }`}
                  >
                    {index === 0 ? (
                      <motion.div
                        animate={{ 
                          scale: [1, 1.2, 1], 
                          rotateZ: [0, 10, -10, 0] 
                        }}
                        transition={{ 
                          duration: 2,
                          times: [0, 0.3, 0.6, 1]
                        }}
                      >
                        <Trophy className="h-4 w-4" />
                      </motion.div>
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span className="font-medium">{score.name}</span>
                </div>
                
                <div className="flex items-center">
                  <motion.span 
                    className={`${score.cards === 0 ? "text-success font-bold" : ""} mr-2`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                  >
                    +{score.cards} {t('game.points')}
                  </motion.span>
                  
                  <div className="hidden items-center gap-1 sm:flex">
                    {[...Array(score.cards || 1)].map((_, i) => (
                      <motion.div 
                        key={i} 
                        className={`w-3 h-4 rounded-sm ${score.cards === 0 ? "bg-success" : "bg-primary/60"}`}
                        style={{ opacity: score.cards === 0 ? 1 : Math.max(0.3, 1 - i * 0.2) }}
                        initial={{ height: 0 }}
                        animate={{ height: 16 }}
                        transition={{ 
                          duration: 0.3, 
                          delay: 0.7 + index * 0.1 + i * 0.05,
                          type: "spring",
                          stiffness: 200,
                          damping: 10
                        }}
                      />
                    ))}
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>
        
        <motion.div 
          className="space-y-3"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {isHost ? (
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                className="w-full font-medium relative overflow-hidden group"
                onClick={onStartNextRound}
                disabled={isLoading}
                variant="default"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-success/80 to-success opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center justify-center">
                  <Play className="mr-2 h-4 w-4" />
                  {isLoading ? (
                    <span className="flex items-center">
                      {t('game.starting')}
                      <motion.span
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 1.5 }}
                        className="ml-1"
                      >
                        ...
                      </motion.span>
                    </span>
                  ) : (
                    t('game.startNextRound')
                  )}
                </span>
              </Button>
            </motion.div>
          ) : (
            <div className="bg-muted/50 rounded-md p-3 text-center">
              <p className="text-muted-foreground text-sm flex items-center justify-center">
                <motion.span 
                  animate={{ 
                    rotate: [0, 0, 10, -10, 0, 0],
                    scale: [1, 1, 1.1, 1.1, 1, 1]
                  }}
                  transition={{ 
                    duration: 2
                  }}
                  className="mr-2 text-primary"
                >
                  <Play className="h-4 w-4" />
                </motion.span>
                {t('game.waitingForHost')}
              </p>
            </div>
          )}
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button
              variant="outline"
              className="w-full"
              onClick={onLeaveGame}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('game.leaveGame')}
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default RoundEndModal;
