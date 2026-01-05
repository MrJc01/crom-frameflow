import React, { createContext, useContext, useRef, useEffect, type ReactNode } from 'react';
import { AudioEngine } from '../engine/AudioEngine';

interface AudioContextType {
    engine: AudioEngine;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // We use a ref to hold the singleton instance, initialized lazily if possible, 
    // but here we just new it up once.
    const engineRef = useRef<AudioEngine | null>(null);

    if (!engineRef.current) {
        engineRef.current = new AudioEngine();
    }

    // Resume AudioContext on first user interaction is handled by components or global listener?
    // AudioEngine has a resume() method.
    useEffect(() => {
        const handleInteraction = () => {
            if (engineRef.current) {
                engineRef.current.resume().catch(e => console.warn("Audio resume failed", e));
            }
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
        
        window.addEventListener('click', handleInteraction);
        window.addEventListener('keydown', handleInteraction);
        
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, []);

    return (
        <AudioContext.Provider value={{ engine: engineRef.current! }}>
            {children}
        </AudioContext.Provider>
    );
};

export const useAudioEngine = (): AudioEngine => {
    const context = useContext(AudioContext);
    if (!context) {
        throw new Error("useAudioEngine must be used within an AudioProvider");
    }
    return context.engine;
};
