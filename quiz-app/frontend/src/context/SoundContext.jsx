import { createContext, useState, useEffect, useRef } from 'react';
import bgmUrl from '../assets/sounds/bgm.mp3';
import clickUrl from '../assets/sounds/click.mp3';
import tickingUrl from '../assets/sounds/ticking.mp3';
import fanfareUrl from '../assets/sounds/fanfare.mp3';

export const SoundContext = createContext(null);

export const SoundProvider = ({ children }) => {
    const [isMuted, setIsMuted] = useState(() => {
        return localStorage.getItem('isMuted') === 'true';
    });

    const bgmRef = useRef(new Audio(bgmUrl));
    const clickRef = useRef(new Audio(clickUrl));
    const tickingRef = useRef(new Audio(tickingUrl));
    const fanfareRef = useRef(new Audio(fanfareUrl));

    const isMutedRef = useRef(isMuted); // Ref to access current mute state inside callbacks if needed
    const shouldPlayBgm = useRef(false); // Track if BGM *should* be playing

    // Update ref when state changes
    useEffect(() => {
        isMutedRef.current = isMuted;
    }, [isMuted]);

    // Initialize BGM loop
    useEffect(() => {
        bgmRef.current.loop = true;
        bgmRef.current.volume = 0.4; // Low volume for background
        fanfareRef.current.volume = 0.3; // Low volume for background
        clickRef.current.volume = 0.2; // Reduced click volume per user request

        tickingRef.current.loop = true;

        // Cleanup on unmount
        return () => {
            bgmRef.current.pause();
            tickingRef.current.pause();
        };
    }, []);

    // Handle Mute State
    useEffect(() => {
        localStorage.setItem('isMuted', isMuted);
        if (isMuted) {
            bgmRef.current.pause();
            tickingRef.current.pause();
            fanfareRef.current.pause();
        } else {
            // Resume BGM if it was supposed to be playing
            if (shouldPlayBgm.current) {
                bgmRef.current.play().catch(e => console.log("Resume BGM failed:", e));
            }
        }
    }, [isMuted]);

    const toggleMute = () => {
        setIsMuted(prev => !prev);
    };

    const playSound = (soundName) => {
        if (isMuted) return;

        try {
            switch (soundName) {
                case 'click':
                    clickRef.current.currentTime = 0;
                    clickRef.current.play().catch(e => console.log("Audio play failed:", e));
                    break;
                case 'fanfare':
                    bgmRef.current.pause(); // Stop BGM on win
                    tickingRef.current.pause();
                    fanfareRef.current.currentTime = 0;
                    fanfareRef.current.play().catch(e => console.log("Audio play failed:", e));
                    break;
                case 'ticking':
                    tickingRef.current.play().catch(e => console.log("Audio play failed:", e));
                    break;
                case 'bgm':
                    // Prevent multiple BGM instances or restarts if already playing
                    shouldPlayBgm.current = true;
                    if (!isMuted && bgmRef.current.paused) {
                        bgmRef.current.play().catch(e => console.log("Audio play failed:", e));
                    }
                    break;
                default:
                    console.warn(`Sound ${soundName} not found`);
            }
        } catch (error) {
            console.error("Audio Error:", error);
        }
    };

    const stopSound = (soundName) => {
        switch (soundName) {
            case 'ticking':
                tickingRef.current.pause();
                tickingRef.current.currentTime = 0;
                break;
            case 'bgm':
                shouldPlayBgm.current = false;
                bgmRef.current.pause();
                break;
        }
    };

    return (
        <SoundContext.Provider value={{ isMuted, toggleMute, playSound, stopSound }}>
            {children}
        </SoundContext.Provider>
    );
};
