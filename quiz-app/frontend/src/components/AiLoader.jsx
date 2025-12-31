import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const STATUS_MESSAGES = [
    "Initializing...",
    "Thinking...",
    "Analyzing Topics...",
    "Gathering Knowledge...",
    "Crafting Questions...",
    "Validating Answers...",
    "Finalizing..."
];

const SCRAMBLE_CHARS = "!@#$%^&*()_+-=[]{}|;':\",./<>?0123456789";

// Particle component for the sparkle steam effect
const SparkleParticle = ({ id, onComplete }) => {
    const startX = Math.random() * 100; // Random position along the bar (0-100%)

    return (
        <motion.div
            className="absolute pointer-events-none"
            style={{ left: `${startX}%`, bottom: '50%' }}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{
                opacity: [0, 1, 1, 0],
                y: [-5, -20, -35, -50],
                scale: [0.5, 1, 0.8, 0.3],
            }}
            transition={{
                duration: 2.5,
                ease: "easeOut",
            }}
            onAnimationComplete={() => onComplete(id)}
        >
            <Sparkles
                size={12}
                className="text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]"
            />
        </motion.div>
    );
};

// Text scramble hook
const useTextScramble = (text, duration = 500) => {
    const [displayText, setDisplayText] = useState(text);
    const [isScrambling, setIsScrambling] = useState(false);

    useEffect(() => {
        if (text === displayText && !isScrambling) return;

        setIsScrambling(true);
        const targetText = text;
        const maxLength = Math.max(displayText.length, targetText.length);
        const steps = 10;
        const stepDuration = duration / steps;
        let currentStep = 0;

        const interval = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;

            let newText = '';
            for (let i = 0; i < maxLength; i++) {
                const targetChar = targetText[i] || '';

                if (progress > 0.7 || Math.random() < progress) {
                    // Reveal real character
                    newText += targetChar;
                } else if (targetChar === ' ') {
                    newText += ' ';
                } else {
                    // Show scramble character
                    newText += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                }
            }
            setDisplayText(newText);

            if (currentStep >= steps) {
                clearInterval(interval);
                setDisplayText(targetText);
                setIsScrambling(false);
            }
        }, stepDuration);

        return () => clearInterval(interval);
    }, [text]);

    return displayText;
};

function AiLoader() {
    const [statusIndex, setStatusIndex] = useState(0);
    const [particles, setParticles] = useState([]);

    const currentStatus = STATUS_MESSAGES[statusIndex];
    const isLastMessage = statusIndex === STATUS_MESSAGES.length - 1;
    const scrambledText = useTextScramble(currentStatus, 800);

    // Cycle through status messages, but STOP at the last one ("Finalizing...")
    useEffect(() => {
        if (isLastMessage) return; // Don't cycle anymore once we reach Finalizing

        const interval = setInterval(() => {
            setStatusIndex((prev) => Math.min(prev + 1, STATUS_MESSAGES.length - 1));
        }, 3500);
        return () => clearInterval(interval);
    }, [isLastMessage]);

    // Spawn particles periodically
    useEffect(() => {
        const interval = setInterval(() => {
            const newParticle = { id: Date.now() + Math.random() };
            setParticles((prev) => [...prev, newParticle]);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const removeParticle = useCallback((id) => {
        setParticles((prev) => prev.filter((p) => p.id !== id));
    }, []);

    return (
        <div className="flex flex-col items-center justify-center gap-4 sm:gap-6 p-4 sm:p-8 w-full">
            {/* Neural Stream Bar */}
            <div className="relative w-full max-w-[200px] sm:max-w-[256px] h-2">
                {/* Glow backdrop */}
                <div className="absolute inset-0 rounded-full blur-md bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 opacity-60" />

                {/* Main bar with animated gradient */}
                <div
                    className="absolute inset-0 rounded-full overflow-hidden"
                    style={{
                        background: 'linear-gradient(90deg, #06b6d4, #8b5cf6, #d946ef, #06b6d4)',
                        backgroundSize: '200% 100%',
                        animation: 'gradient-shift 4s linear infinite',
                    }}
                />

                {/* Sparkle particles */}
                <AnimatePresence>
                    {particles.map((particle) => (
                        <SparkleParticle
                            key={particle.id}
                            id={particle.id}
                            onComplete={removeParticle}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Status Text with Scramble Effect */}
            <div className="text-center w-full">
                <motion.p
                    className="font-mono text-xs sm:text-sm text-cyan-300 tracking-wider"
                    style={{ minWidth: '120px' }}
                    layout
                >
                    {scrambledText}
                </motion.p>
            </div>

            {/* CSS for gradient animation */}
            <style>{`
                @keyframes gradient-shift {
                    0% { background-position: 0% 50%; }
                    100% { background-position: 200% 50%; }
                }
            `}</style>
        </div>
    );
}

export default AiLoader;
