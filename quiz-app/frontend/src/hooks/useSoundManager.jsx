import { useContext } from 'react';
import { SoundContext } from '../context/SoundContext';

export const useSoundManager = () => {
    const context = useContext(SoundContext);
    if (!context) {
        throw new Error("useSoundManager must be used within a SoundProvider");
    }
    return context;
};
