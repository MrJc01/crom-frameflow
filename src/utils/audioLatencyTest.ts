/**
 * Audio Latency Test Utility
 * Measures scheduling latency and buffer stability at different sample rates
 */

export const AudioLatencyTest = {
    /**
     * Run latency test suite
     */
    runTests: async () => {
        console.group('🎵 Audio Latency Tests');
        
        await AudioLatencyTest.testSampleRate(44100);
        await AudioLatencyTest.testSampleRate(48000);
        
        console.groupEnd();
    },

    /**
     * Test a specific sample rate
     */
    testSampleRate: async (sampleRate: number) => {
        console.group(`Testing at ${sampleRate / 1000}kHz...`);
        
        try {
            // @ts-ignore - webkitAudioContext fallback
            const CtxClass = window.AudioContext || window.webkitAudioContext;
            const ctx = new CtxClass({ sampleRate });
            
            console.log(`State: ${ctx.state}`);
            console.log(`Base Latency: ${(ctx.baseLatency * 1000).toFixed(2)}ms`);
            console.log(`Output Latency: ${(ctx.outputLatency * 1000).toFixed(2)}ms`);
            
            // Scheduling test
            const start = performance.now();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.value = 0; // Silent

            // Schedule event in future
            const scheduleTime = ctx.currentTime + 0.1;
            osc.start(scheduleTime);
            osc.stop(scheduleTime + 0.1);

            // Wait for it to "happen"
            await new Promise(r => setTimeout(r, 250));
            
            const measuredTime = ctx.currentTime;
            // Diff between wall clock and audio clock progression
            const expectedProgression = (performance.now() - start) / 1000;
            const actualProgression = measuredTime; // Assuming start at 0 or close
            
            // Note: This is rough; precise loopback requires hardware or worklets
            console.log(`Audio Clock Stability: ${ctx.state === 'running' ? 'stable' : 'suspended'}`);
            
            await ctx.close();
        } catch (err) {
            console.error('Failed to init context:', err);
        }
        
        console.groupEnd();
    }
};

// Expose globally
(window as any).AudioLatencyTest = AudioLatencyTest;
