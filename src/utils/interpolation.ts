export interface Keyframe {
    time: number;
    property: string;
    value: number;
}

export function interpolateProperty(animations: Keyframe[] | undefined, property: string, time: number, defaultValue: number): number {
    if (!animations || animations.length === 0) return defaultValue;
    
    // Filter keyframes for this property and sort
    const kfs = animations.filter(k => k.property === property).sort((a,b) => a.time - b.time);
    if (kfs.length === 0) return defaultValue;
    
    // 1. Before first keyframe
    if (time <= kfs[0].time) return kfs[0].value;
    
    // 2. After last keyframe
    if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;
    
    // 3. Interpolate between keyframes
    for (let i = 0; i < kfs.length - 1; i++) {
        const k1 = kfs[i];
        const k2 = kfs[i+1];
        if (time >= k1.time && time < k2.time) {
            const t = (time - k1.time) / (k2.time - k1.time);
            // Linear Easing
            return k1.value + (k2.value - k1.value) * t;
        }
    }
    
    return defaultValue;
}
