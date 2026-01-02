import React, { useState } from 'react';
import { Layers, Image as ImageIcon, LayoutTemplate } from 'lucide-react';
import { AssetLibrary } from './AssetLibrary';
import { CardList } from './CardList';

type Tab = 'assets' | 'scenes' | 'templates';

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
                    onClick={() => toggleTab('templates')}
                    className={`p-3 rounded-xl transition-all ${activeTab === 'templates' && isOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                    title="Templates"
                >
                    <LayoutTemplate className="w-6 h-6" />
                </button>
            </div>

            {/* Drawer Content */}
            {isOpen && (
                <div className="w-64 bg-[#0d0d0d]/95 backdrop-blur-xl border-r border-white/5 flex flex-col transition-all duration-300 ease-in-out">
                    <div className="p-4 border-b border-white/5 flex justify-between items-center">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {activeTab === 'assets' && 'Asset Library'}
                            {activeTab === 'scenes' && 'Scenes & Cards'}
                            {activeTab === 'templates' && 'Templates'}
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {activeTab === 'assets' && <AssetLibrary />}
                        {activeTab === 'scenes' && <CardList />}
                        {activeTab === 'templates' && (
                            <div className="text-gray-500 text-xs text-center mt-10">
                                No templates available.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
