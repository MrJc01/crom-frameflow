import React, { useEffect, useState, useMemo } from 'react';
import { audioAnalysis } from '../services/AudioAnalysisService';
import { db } from '../db/FrameFlowDB';

interface WaveformClipProps {
    assetId: string;
    width: number;
    height: number;
    color?: string;
    className?: string;
}

export const WaveformClip: React.FC<WaveformClipProps> = ({ assetId, width, height, color = "rgba(255,255,255,0.4)", className }) => {
    const [peaks, setPeaks] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let active = true;

        const load = async () => {
            if (!assetId) return;
            setLoading(true);
            try {
                // Check if we have active DB connection?
                const asset = await db.getAsset(assetId);
                if (asset && active) {
                   // Determine if it has audio? Video files usually do. Images don't.
                   if (asset.type === 'video' || asset.type === 'audio') {
                       // We used to have `asset.blob` or need to fetch?
                       // DB stores blob directly.
                       let blob = asset.blob;
                       
                       // If no blob but path (FrameFlow protocol), we need to fetch?
                       // Service handles Blob.
                       if (!blob && asset.path) {
                           // Fetch from custom protocol?
                           // Web Audio API needs ArrayBuffer.
                           // fetch(`frameflow://${asset.path}`) might work if supported by fetch
                           // But our custom protocol is mostly for img/video tags.
                           // We might need a bridge to read file in Rust?
                           // For now assume Blob is present (from Drag/Drop).
                           // If not, we skip waveform.
                           const response = await fetch(`frameflow://${encodeURIComponent(asset.path)}`);
                           blob = await response.blob();
                       }

                       if (blob) {
                           // Resolution: 1 bar per 3 pixels?
                           const samples = Math.floor(width / 3);
                           const data = await audioAnalysis.extractPeaks(blob, samples);
                           if (active) setPeaks(data);
                       }
                   }
                }
            } catch (e) {
                console.warn("Waveform load failed", e);
            } finally {
                if (active) setLoading(false);
            }
        };

        load();

        return () => { active = false; };
    }, [assetId, width]); // Re-run if width changes significantly? Maybe debounce?

    // Render SVG path
    const pathData = useMemo(() => {
        if (peaks.length === 0) return "";
        
        // Mirror waveform (top and bottom)
        // Center Y is height / 2
        const centerY = height / 2;
        const scaleY = height / 2; // Max amplitude

        let d = `M 0 ${centerY} `;
        
        const barWidth = width / peaks.length;

        peaks.forEach((peak, i) => {
            const x = i * barWidth;
            const h = peak * scaleY;
            // Line to top
            d += `L ${x} ${centerY - h} `;
            // Line to bottom (optional for filled look, or just stroke)
            // For simple line: just plotting tops?
            // Usually waveform is mirrored.
        });
        
        // Go backwards for bottom half
        for (let i = peaks.length - 1; i >= 0; i--) {
            const peak = peaks[i];
            const x = i * barWidth;
            const h = peak * scaleY;
             d += `L ${x} ${centerY + h} `;
        }
        
        d += "Z";
        return d;
    }, [peaks, width, height]);

    if (loading || peaks.length === 0) return null;

    return (
        <svg  width="100%" height="100%" className={className} preserveAspectRatio="none">
             <path d={pathData} fill={color} />
        </svg>
    );
};
