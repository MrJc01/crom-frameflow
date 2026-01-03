import React, { useState } from 'react';
import { Layers, Image as ImageIcon, FolderOpen } from 'lucide-react';
import { AssetLibrary } from './AssetLibrary';
import { CardList } from './CardList';

type Tab = 'assets' | 'scenes' | 'projects';

export const Sidebar: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('assets');
    const [isOpen, setIsOpen] = useState(true);

    const toggleTab = (tab: Tab) => {
        if (activeTab === tab) {
            setIsOpen(!isOpen);
        } else {
            setActiveTab(tab);
            setIsOpen(true);
        }
    };

    return (
        <div className="flex h-full">
            {/* Icon Rail */}
            <div className="w-16 bg-[#0d0d0d] border-r border-white/5 flex flex-col items-center py-4 gap-4 z-20">
                <button 
                    onClick={() => toggleTab('assets')}
                    className={`p-3 rounded-xl transition-all ${activeTab === 'assets' && isOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                    title="Assets"
                >
                    <ImageIcon className="w-6 h-6" />
                </button>
                <button 
                    onClick={() => toggleTab('scenes')}
                    className={`p-3 rounded-xl transition-all ${activeTab === 'scenes' && isOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                    title="Scenes"
                >
                    <Layers className="w-6 h-6" />
                </button>
                 <button 
                    onClick={() => toggleTab('projects')}
                    className={`p-3 rounded-xl transition-all ${activeTab === 'projects' && isOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                    title="Projects"
                >
                    <FolderOpen className="w-6 h-6" />
                </button>
            </div>

            {/* Drawer Content */}
            {isOpen && (
                <div className="w-64 bg-[#0d0d0d]/95 backdrop-blur-xl border-r border-white/5 flex flex-col transition-all duration-300 ease-in-out">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {activeTab === 'assets' && 'Asset Library'}
                            {activeTab === 'scenes' && 'Scenes & Cards'}
                            {activeTab === 'projects' && 'Projects'}
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {activeTab === 'assets' && <AssetLibrary />}
                        {activeTab === 'scenes' && <CardList />}
                        {activeTab === 'projects' && <ProjectManager />}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Sub-components (move to separate files later) ---

import { db } from '../db/FrameFlowDB';
import { useAppStore } from '../stores/useAppStore';
import { Save, Trash2 } from 'lucide-react'; // Removed duplicate FolderOpen, Plus

const ProjectManager: React.FC = () => {
    const [projects, setProjects] = useState<any[]>([]);
    const cards = useAppStore(state => state.cards);
    const loadProject = useAppStore(state => state.loadProject);
    
    // Refresh list
    const loadList = async () => {
        const list = await db.getProjects();
        setProjects(list);
    };

    React.useEffect(() => { loadList(); }, []);

    const handleSave = async () => {
        const title = prompt("Project Name:", `Project ${new Date().toLocaleTimeString()}`);
        if (!title) return;

        // Clean data for saving (remove cyclic refs if any, though cards should be clean JSON tree)
        // We technically save the entire 'cards' array.
        // We do NOT save Blob URLs, but we DO save assetIds. 
        // Blob URLs in 'content' will be overwritten on load anyway.
        
        await db.saveProject({
            id: crypto.randomUUID(),
            title,
            cards
        });
        loadList();
    };

    const handleLoad = async (projectId: string) => {
        if (!confirm("Load project? Unsaved changes will be lost.")) return;
        
        const proj = await db.getProject(projectId);
        if (proj && proj.data) {
           await loadProject(proj.data);
        }
    };
    
    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Delete project?")) return;
        await db.deleteProject(id);
        loadList();
    };

    return (
        <div className="flex flex-col gap-4 p-2">
            <button 
                onClick={handleSave}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center justify-center gap-2 text-xs font-semibold"
            >
                <Save className="w-3 h-3" /> Save Current Project
            </button>
            
            <div className="space-y-2 mt-2">
                <h4 className="text-[10px] text-gray-500 uppercase font-semibold">Saved Projects</h4>
                {projects.length === 0 && <p className="text-gray-600 text-xs italic">No projects saved.</p>}
                
                {projects.map(p => (
                    <div key={p.id} className="bg-white/5 p-3 rounded group hover:ring-1 ring-indigo-500 transition-all cursor-pointer" onClick={() => handleLoad(p.id)}>
                        <div className="flex justify-between items-start">
                             <div>
                                 <h5 className="text-sm text-gray-200 font-medium">{p.title}</h5>
                                 <p className="text-[10px] text-gray-500">{new Date(p.lastModified).toLocaleString()}</p>
                             </div>
                             <button onClick={(e) => handleDelete(e, p.id)} className="text-gray-500 hover:text-red-400 p-1">
                                 <Trash2 className="w-3 h-3" />
                             </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
