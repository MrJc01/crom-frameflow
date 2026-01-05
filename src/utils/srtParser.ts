// SRT Parser Utility

export interface SubtitleCue {
    id: number;
    startTime: number; // in seconds
    endTime: number; // in seconds
    text: string;
}

// Parse SRT timestamp (00:00:00,000) to seconds
function parseTimestamp(timestamp: string): number {
    const parts = timestamp.trim().split(':');
    if (parts.length !== 3) return 0;
    
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const [seconds, milliseconds] = parts[2].split(',').map(s => parseInt(s, 10));
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

// Format seconds to SRT timestamp
export function formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

// Parse SRT file content
export function parseSRT(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const blocks = content.trim().split(/\n\s*\n/);
    
    for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length < 3) continue;
        
        const id = parseInt(lines[0], 10);
        const timeParts = lines[1].split(' --> ');
        if (timeParts.length !== 2) continue;
        
        const startTime = parseTimestamp(timeParts[0]);
        const endTime = parseTimestamp(timeParts[1]);
        const text = lines.slice(2).join('\n');
        
        cues.push({ id, startTime, endTime, text });
    }
    
    return cues;
}

// Generate SRT file content
export function generateSRT(cues: SubtitleCue[]): string {
    return cues
        .map((cue, index) => 
            `${index + 1}\n${formatTimestamp(cue.startTime)} --> ${formatTimestamp(cue.endTime)}\n${cue.text}`
        )
        .join('\n\n');
}

// Get current subtitle at a given time
export function getCurrentSubtitle(cues: SubtitleCue[], time: number): SubtitleCue | null {
    return cues.find(cue => time >= cue.startTime && time <= cue.endTime) || null;
}
