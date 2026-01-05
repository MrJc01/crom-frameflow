import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileVideo, FileAudio, Image } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { nanoid } from 'nanoid';

interface DropZoneProps {
    children: React.ReactNode;
}

const SUPPORTED_VIDEO = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const SUPPORTED_AUDIO = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];
const SUPPORTED_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const getFileType = (mimeType: string): 'video' | 'audio' | 'image' | null => {
    if (SUPPORTED_VIDEO.includes(mimeType)) return 'video';
    if (SUPPORTED_AUDIO.includes(mimeType)) return 'audio';
    if (SUPPORTED_IMAGE.includes(mimeType)) return 'image';
    return null;
};

export const DropZone: React.FC<DropZoneProps> = ({ children }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragCounter, setDragCounter] = useState(0);
    const addAsset = useAppStore(state => state.addAsset);

    const handleDragEnter = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragCounter(prev => prev + 1);
        if (e.dataTransfer?.types.includes('Files')) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragCounter(prev => {
            const next = prev - 1;
            if (next === 0) setIsDragging(false);
            return next;
        });
    }, []);

    const handleDragOver = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        setDragCounter(0);

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            const fileType = getFileType(file.type);
            if (!fileType) {
                console.warn(`Unsupported file type: ${file.type}`);
                return;
            }

            const url = URL.createObjectURL(file);
            const asset = {
                id: nanoid(),
                type: fileType,
                source: url,
                name: file.name
            };

            addAsset(asset);
            console.log(`Imported asset: ${file.name} (${fileType})`);
        });
    }, [addAsset]);

    useEffect(() => {
        const container = document;
        container.addEventListener('dragenter', handleDragEnter);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);

        return () => {
            container.removeEventListener('dragenter', handleDragEnter);
            container.removeEventListener('dragleave', handleDragLeave);
            container.removeEventListener('dragover', handleDragOver);
            container.removeEventListener('drop', handleDrop);
        };
    }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

    return (
        <div className="relative w-full h-full">
            {children}
            
            {/* Drop Overlay */}
            {isDragging && (
                <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-6 text-white">
                        <div className="w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
                            <Upload className="w-16 h-16 text-indigo-400" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl font-bold mb-2">Drop Files to Import</h2>
                            <p className="text-white/60">Video, Audio, or Image files</p>
                        </div>
                        <div className="flex gap-6 mt-4">
                            <div className="flex flex-col items-center gap-2 text-white/50">
                                <FileVideo className="w-8 h-8" />
                                <span className="text-xs">Video</span>
                            </div>
                            <div className="flex flex-col items-center gap-2 text-white/50">
                                <FileAudio className="w-8 h-8" />
                                <span className="text-xs">Audio</span>
                            </div>
                            <div className="flex flex-col items-center gap-2 text-white/50">
                                <Image className="w-8 h-8" />
                                <span className="text-xs">Image</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
