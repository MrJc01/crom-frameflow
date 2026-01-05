import React, { useEffect, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import type { ProjectTemplate } from '../types';
import { FilePlus, Save, Clock } from 'lucide-react';

interface TemplateGalleryProps {
    onClose: () => void;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({ onClose }) => {
    const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const listTemplates = useAppStore(state => state.listTemplates);
    const loadTemplate = useAppStore(state => state.loadTemplate);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const list = await listTemplates();
            setTemplates(list);
        } catch (error) {
            console.error("Failed to list templates", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (templateId: string) => {
        if (confirm("This will overwrite your current timeline. Continue?")) {
            await loadTemplate(templateId);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-lg w-[800px] h-[600px] flex flex-col shadow-2xl">
                <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#111]">
                    <h2 className="text-lg font-bold text-white flex gap-2 items-center">
                        <FilePlus className="w-5 h-5 text-blue-400" />
                        Project Templates
                    </h2>
                    <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
                        Close
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-white/50 text-center mt-20">Loading templates...</div>
                    ) : templates.length === 0 ? (
                        <div className="text-center mt-20 flex flex-col items-center">
                            <Save className="w-12 h-12 text-white/10 mb-4" />
                            <p className="text-white/50">No templates saved yet.</p>
                            <p className="text-xs text-white/30 mt-2">Save your current project as a template to see it here.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-4">
                            {templates.map(t => (
                                <div 
                                    key={t.id}
                                    onClick={() => handleSelect(t.id)}
                                    className="bg-[#0a0a0a] border border-white/10 rounded-lg p-4 cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
                                >
                                    <div className="aspect-video bg-[#111] rounded mb-3 flex items-center justify-center border border-white/5">
                                        {/* Placeholder for thumbnail */}
                                        <div className="text-2xl font-bold text-white/10">{t.name[0].toUpperCase()}</div>
                                    </div>
                                    <h3 className="text-sm font-bold text-white mb-1 truncate">{t.name}</h3>
                                    <div className="flex justify-between items-center text-xs text-white/40">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(t.createdAt).toLocaleDateString()}
                                        </span>
                                        <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                                            {t.timeline.tracks.length} Tracks
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
