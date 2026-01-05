import React, { useState, useRef } from 'react';
import { Subtitles, Plus, Trash2, Upload, Download, X, Sparkles, Loader2 } from 'lucide-react';
import { parseSRT, generateSRT, formatTimestamp, type SubtitleCue } from '../utils/srtParser';
import { CaptionService } from '../services/CaptionService';
import { toast } from 'sonner';

interface SubtitleEditorProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SubtitleEditor: React.FC<SubtitleEditorProps> = ({ isOpen, onClose }) => {
    const [cues, setCues] = useState<SubtitleCue[]>([]);
    const [selectedCueId, setSelectedCueId] = useState<number | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAutoGenerate = async () => {
        setIsGenerating(true);
        toast.info('Loading AI model... (First time may take 30s)');
        
        try {
            // Mock getting audio from timeline - in real app would get mixed buffer
            // For now, let's create a dummy buffer or fail gracefully if no audio
            toast.warning('Using silent buffer for demo (Timeline audio extraction not yet wired)');
            
            const sampleRate = 44100;
            const dummyBuffer = new Float32Array(sampleRate * 5); // 5 seconds of silence
            
            const results = await CaptionService.transcribe(dummyBuffer, sampleRate);
            
            if (results.length === 0) {
                 toast.info('No speech detected (or dummy buffer used)');
            }

            const newCues: SubtitleCue[] = results.map((r, i) => ({
                id: cues.length + i + 1,
                startTime: r.start,
                endTime: r.end,
                text: r.text
            }));
            
            setCues([...cues, ...newCues]);
            toast.success('Captions generated!');
        } catch (e: any) {
            console.error(e);
            toast.error(`Caption generation failed: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const text = await file.text();
        const parsed = parseSRT(text);
        setCues(parsed);
    };

    const handleExport = () => {
        const content = generateSRT(cues);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'subtitles.srt';
        a.click();
        URL.revokeObjectURL(url);
    };

    const addCue = () => {
        const lastCue = cues[cues.length - 1];
        const newCue: SubtitleCue = {
            id: cues.length + 1,
            startTime: lastCue ? lastCue.endTime + 0.5 : 0,
            endTime: lastCue ? lastCue.endTime + 3 : 3,
            text: 'New subtitle'
        };
        setCues([...cues, newCue]);
        setSelectedCueId(newCue.id);
    };

    const deleteCue = (id: number) => {
        setCues(cues.filter(c => c.id !== id));
        if (selectedCueId === id) setSelectedCueId(null);
    };

    const updateCue = (id: number, updates: Partial<SubtitleCue>) => {
        setCues(cues.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl w-[600px] max-h-[600px] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Subtitles className="w-5 h-5 text-yellow-400" />
                        Subtitle Editor
                    </h2>
                        <button
                          onClick={handleAutoGenerate}
                          disabled={isGenerating}
                          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-purple-400 disabled:opacity-50"
                          title="Auto-Generate Captions (AI)"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        </button>
                        <div className="w-px h-4 bg-white/10 mx-1" />
                        <div className="flex items-center gap-2">
                        <input 
                            type="file" 
                            accept=".srt" 
                            ref={fileInputRef} 
                            onChange={handleImport}
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                            title="Import SRT"
                        >
                            <Upload className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={cues.length === 0}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-30"
                            title="Export SRT"
                        >
                            <Download className="w-4 h-4 text-gray-400" />
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Subtitle List */}
                <div className="max-h-[400px] overflow-y-auto">
                    {cues.length === 0 && (
                        <div className="px-4 py-8 text-center text-gray-500 text-sm">
                            No subtitles yet. Import an SRT file or add new cues.
                        </div>
                    )}

                    {cues.map((cue) => (
                        <div 
                            key={cue.id}
                            onClick={() => setSelectedCueId(cue.id)}
                            className={`px-4 py-3 border-b border-white/5 cursor-pointer transition-colors ${
                                selectedCueId === cue.id ? 'bg-white/10' : 'hover:bg-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-500">#{cue.id}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteCue(cue.id); }}
                                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                >
                                    <Trash2 className="w-3 h-3 text-red-400" />
                                </button>
                            </div>
                            
                            <div className="flex gap-4 mb-2">
                                <div className="flex-1">
                                    <label className="text-[10px] text-gray-500">Start</label>
                                    <input
                                        type="text"
                                        value={formatTimestamp(cue.startTime)}
                                        onChange={(e) => {
                                            // Simple validation - just update if it parses
                                            const parts = e.target.value.split(':');
                                            if (parts.length === 3) {
                                                const [h, m, s] = parts;
                                                const [sec, ms] = (s || '0,0').split(',');
                                                const time = parseInt(h)*3600 + parseInt(m)*60 + parseInt(sec) + parseInt(ms || '0')/1000;
                                                if (!isNaN(time)) updateCue(cue.id, { startTime: time });
                                            }
                                        }}
                                        className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] text-gray-500">End</label>
                                    <input
                                        type="text"
                                        value={formatTimestamp(cue.endTime)}
                                        onChange={(e) => {
                                            const parts = e.target.value.split(':');
                                            if (parts.length === 3) {
                                                const [h, m, s] = parts;
                                                const [sec, ms] = (s || '0,0').split(',');
                                                const time = parseInt(h)*3600 + parseInt(m)*60 + parseInt(sec) + parseInt(ms || '0')/1000;
                                                if (!isNaN(time)) updateCue(cue.id, { endTime: time });
                                            }
                                        }}
                                        className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white"
                                    />
                                </div>
                            </div>
                            
                            <textarea
                                value={cue.text}
                                onChange={(e) => updateCue(cue.id, { text: e.target.value })}
                                className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-sm text-white resize-none h-16"
                                placeholder="Subtitle text..."
                            />
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-white/10 flex justify-between">
                    <span className="text-xs text-gray-500">
                        {cues.length} subtitle{cues.length !== 1 ? 's' : ''}
                    </span>
                    <button
                        onClick={addCue}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Subtitle
                    </button>
                </div>
            </div>
        </div>
    );
};
