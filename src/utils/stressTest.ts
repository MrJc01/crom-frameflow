import { startTiming, endTiming, logMemory, getFPS } from './perfLogger';
import { useAppStore } from '../stores/useAppStore';

/**
 * Stress Test Utilities
 * Generates massive timelines to test performance limits
 */

export const StressTest = {
    /**
     * Generate N random clips on the timeline
     */
    runTimelineStress: async (clipCount: number = 500, trackCount: number = 5) => {
        console.group(`🔥 RUNNING STRESS TEST: ${clipCount} clips on ${trackCount} tracks`);
        
        startTiming('stress-gen');
        
        const store = useAppStore.getState();
        const duration = 5000; // 5s per clip
        const clipsBatch: any[] = [];
        const updateTimeline = store.setTimeline;

        // Clear existing timeline
        updateTimeline({
            tracks: [],
            duration: 10000,
            zoom: 1,
            currentTime: 0,
            isPlaying: false
        });

        // 1. Generate Tracks
        const tracks = Array.from({ length: trackCount }).map((_, i) => ({
            id: `track-${i}`,
            type: (i % 2 === 0 ? 'video' : 'audio') as 'video' | 'audio', 
            name: `Stress Track ${i + 1}`,
            isMuted: false,
            isLocked: false,
            height: 64,
            clips: []
        }));

        // 2. Generate Clips
        for (let i = 0; i < clipCount; i++) {
            const trackIndex = i % trackCount;
            const track = tracks[trackIndex];
            
            // Stagger clips so they don't all overlap perfectly
            const startTime = Math.floor(i / trackCount) * (duration / 2); // 50% overlap
            
            track.clips.push({
                id: `stress-clip-${i}`,
                assetId: 'placeholder',
                name: `Clip ${i}`,
                start: startTime,
                duration: duration,
                offset: 0,
                type: track.type === 'video' ? 'video' : 'audio',
                trackId: track.id,
                volume: 1,
                properties: { x: 0, y: 0, scale: 1, opacity: 1, rotation: 0 }
            });
        }

        const genTime = endTiming('stress-gen');
        console.log(`✅ Generation took ${genTime.toFixed(2)}ms`);

        // 3. Apply to Store
        startTiming('stress-apply');
        
        // We need to construct the full timeline object
        const newTimeline = {
            id: 'stress-timeline',
            tracks: tracks,
            duration: (clipCount / trackCount) * duration, // Roughly total duration
            zoom: 0.5,
            currentTime: 0,
            isPlaying: false
        };

        updateTimeline(newTimeline);
        
        const applyTime = endTiming('stress-apply');
        console.log(`✅ State update took ${applyTime.toFixed(2)}ms`);

        // 4. Report Metrics
        console.log('📊 Post-Stress Metrics:');
        logMemory();
        console.groupEnd();
        
        return {
            genTime,
            applyTime,
            totalClips: clipCount,
            fps: getFPS()
        };
    },

    /**
     * Rapidly seek through timeline to test rendering
     */
    stressSeek: async (iterations: number = 100) => {
        console.group('⏩ RUNNING SEEK STRESS TEST');
        const store = useAppStore.getState();
        const timelineDuration = store.timeline.duration || 10000;
        
        startTiming('stress-seek');

        for (let i = 0; i < iterations; i++) {
            const randomTime = Math.random() * timelineDuration;
            store.setTimelineTime(randomTime);
            // Allow a tiny delay for React to theoretically schedule updates (though this loop is synchronous)
            // Ideally we'd await next frame, but for pure stress on state manager:
        }

        const time = endTiming('stress-seek');
        const avgSeek = time / iterations;
        
        console.log(`✅ ${iterations} seeks took ${time.toFixed(2)}ms (Avg: ${avgSeek.toFixed(2)}ms)`);
        console.groupEnd();
    }
};

// Expose globally for console access
(window as any).StressTest = StressTest;
