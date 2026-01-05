/**
 * Performance Logger Utility
 * Detailed performance logging for dev mode
 */

const isDev = import.meta.env.DEV;

// Color codes for console
const COLORS = {
    fps: 'color: #22c55e; font-weight: bold',
    render: 'color: #3b82f6; font-weight: bold',
    memory: 'color: #f59e0b; font-weight: bold',
    warning: 'color: #ef4444; font-weight: bold',
    timing: 'color: #8b5cf6; font-weight: bold',
    label: 'color: #6b7280',
};

// Performance metrics storage
interface PerfMetrics {
    fps: number[];
    frameTimes: number[];
    renderTimes: number[];
    lastFrameTime: number;
}

const metrics: PerfMetrics = {
    fps: [],
    frameTimes: [],
    renderTimes: [],
    lastFrameTime: performance.now(),
};

// Timing measurements
const timings: Map<string, number> = new Map();

/**
 * Start a timing measurement
 */
export function startTiming(label: string): void {
    if (!isDev) return;
    timings.set(label, performance.now());
}

/**
 * End a timing measurement and log it
 */
export function endTiming(label: string, threshold?: number): number {
    if (!isDev) return 0;
    
    const start = timings.get(label);
    if (start === undefined) return 0;
    
    const duration = performance.now() - start;
    timings.delete(label);
    
    if (threshold && duration > threshold) {
        console.log(
            `%c⚠ SLOW %c${label}%c took %c${duration.toFixed(2)}ms`,
            COLORS.warning, COLORS.label, '', COLORS.timing
        );
    }
    
    return duration;
}

/**
 * Log a frame render
 */
export function logFrame(): void {
    if (!isDev) return;
    
    const now = performance.now();
    const frameTime = now - metrics.lastFrameTime;
    metrics.lastFrameTime = now;
    
    metrics.frameTimes.push(frameTime);
    if (metrics.frameTimes.length > 60) metrics.frameTimes.shift();
    
    const avgFrameTime = metrics.frameTimes.reduce((a, b) => a + b, 0) / metrics.frameTimes.length;
    const currentFps = 1000 / avgFrameTime;
    
    metrics.fps.push(currentFps);
    if (metrics.fps.length > 60) metrics.fps.shift();
}

/**
 * Get current FPS
 */
export function getFPS(): number {
    if (metrics.fps.length === 0) return 0;
    return metrics.fps[metrics.fps.length - 1];
}

/**
 * Get average FPS over last N frames
 */
export function getAvgFPS(frames: number = 60): number {
    const slice = metrics.fps.slice(-frames);
    if (slice.length === 0) return 0;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Log render time for a specific operation
 */
export function logRenderTime(operation: string, timeMs: number): void {
    if (!isDev) return;
    
    metrics.renderTimes.push(timeMs);
    if (metrics.renderTimes.length > 100) metrics.renderTimes.shift();
    
    if (timeMs > 16.67) { // More than 60fps frame budget
        console.log(
            `%c⚠ RENDER %c${operation}%c ${timeMs.toFixed(2)}ms (budget exceeded)`,
            COLORS.warning, COLORS.label, COLORS.render
        );
    }
}

/**
 * Log memory usage
 */
export function logMemory(): void {
    if (!isDev) return;
    
    const memory = (performance as any).memory;
    if (!memory) return;
    
    const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
    const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(1);
    const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1);
    
    console.log(
        `%c📊 MEMORY %c${usedMB}MB / ${totalMB}MB (limit: ${limitMB}MB)`,
        COLORS.memory, COLORS.label
    );
}

/**
 * Log a performance summary
 */
export function logSummary(): void {
    if (!isDev) return;
    
    const avgFps = getAvgFPS();
    const avgRenderTime = metrics.renderTimes.length > 0 
        ? metrics.renderTimes.reduce((a, b) => a + b, 0) / metrics.renderTimes.length 
        : 0;
    
    console.group('%c📈 Performance Summary', COLORS.fps);
    console.log(`%cAvg FPS: %c${avgFps.toFixed(1)}`, COLORS.label, COLORS.fps);
    console.log(`%cAvg Render: %c${avgRenderTime.toFixed(2)}ms`, COLORS.label, COLORS.render);
    logMemory();
    console.groupEnd();
}

/**
 * Create a performance monitor that logs periodically
 */
export function createPerfMonitor(intervalMs: number = 5000): () => void {
    if (!isDev) return () => {};
    
    const id = setInterval(() => {
        logSummary();
    }, intervalMs);
    
    return () => clearInterval(id);
}

/**
 * Wrap a function with timing
 */
export function withTiming<T extends (...args: any[]) => any>(
    fn: T,
    label: string,
    threshold?: number
): T {
    if (!isDev) return fn;
    
    return ((...args: Parameters<T>): ReturnType<T> => {
        startTiming(label);
        const result = fn(...args);
        
        if (result instanceof Promise) {
            return result.finally(() => endTiming(label, threshold)) as ReturnType<T>;
        }
        
        endTiming(label, threshold);
        return result;
    }) as T;
}

/**
 * Log component render (for React)
 */
export function logRender(componentName: string): void {
    if (!isDev) return;
    console.log(`%c🔄 RENDER %c${componentName}`, COLORS.timing, COLORS.label);
}

// Export metrics for external access
export const perfMetrics = metrics;
