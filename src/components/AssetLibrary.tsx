import React, { useEffect, useState } from 'react';
import { useAppStore, type SceneElement } from '../stores/useAppStore';
import { db } from '../db/FrameFlowDB';
import { FileSystemService } from '../services/FileSystemService';
import { BlobCacheService } from '../services/BlobCacheService';
import { Trash2, Upload, Folder, FolderPlus, Tag, Search, X, Plus, ChevronRight, ChevronDown } from 'lucide-react';

// Types for organization
interface AssetFolder {
    id: string;
    name: string;
    parentId: string | null;
    isExpanded: boolean;
}

interface AssetTag {
    id: string;
    name: string;
    color: string;
}

interface AssetWithMeta {
    id: string;
    name: string;
    type: string;
    url: string;
    folderId: string | null;
    tags: string[];
    // ... other existing properties
    [key: string]: any;
}

const TAG_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', 
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
];

export const AssetLibrary: React.FC = () => {
    const cards = useAppStore(state => state.cards);
    const activeCardId = useAppStore(state => state.activeCardId);
    const updateCardElements = useAppStore(state => state.updateCardElements);
    
    const activeCard = cards.find(c => c.id === activeCardId);

    const [assets, setAssets] = useState<AssetWithMeta[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Folder state
    const [folders, setFolders] = useState<AssetFolder[]>([
        { id: 'root', name: 'All Assets', parentId: null, isExpanded: true }
    ]);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    
    // Tag state
    const [tags, setTags] = useState<AssetTag[]>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [showNewTag, setShowNewTag] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleUploadClick = async () => {
        if (FileSystemService.isSupported()) {
            try {
                const result = await FileSystemService.openFile({
                    types: [{
                        description: 'Media Files',
                        accept: {
                            'video/*': ['.mp4', '.webm', '.mov'],
                            'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
                            'audio/*': ['.mp3', '.wav', '.aac']
                        }
                    }]
                });
                
                if (result) {
                    await db.addAsset(result.file, undefined, undefined, result.handle);
                    await loadAssets();
                }
            } catch (e) {
                console.error("FS Import failed:", e);
            }
        } else {
            fileInputRef.current?.click();
        }
    };

    const handleFallbackImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await db.addAsset(file);
            await loadAssets();
        }
    };

    const loadAssets = async () => {
        const dbAssets = await db.getAllAssets();
        const displayAssets = await Promise.all(dbAssets.map(async (a: any) => {
             let url = '';
             if (a.path) {
                 url = `frameflow://${encodeURIComponent(a.path)}`;
             } else if (a.blob) {
                 // Use LRU Cache
                 url = BlobCacheService.getURL(a.id, a.blob);
             } else if (a.fileHandle) {
                 try {
                      // Check permission silently
                      // @ts-ignore - queryPermission types might be finicky despite reference
                      const state = await a.fileHandle.queryPermission({ mode: 'read' });
                      if (state === 'granted') {
                          const file = await a.fileHandle.getFile();
                          // Use LRU Cache for handle-derived files too
                          url = BlobCacheService.getURL(a.id, file);
                      }
                 } catch (e) {
                     console.warn("Handle check failed", e);
                 }
             }
             
             return {
                ...a,
                url,
                folderId: a.folderId || null,
                tags: a.tags || []
             } as AssetWithMeta;
        }));
        setAssets(displayAssets);
    };

    const requestAssetAccess = async (asset: AssetWithMeta) => {
        if (asset.fileHandle) {
            const granted = await FileSystemService.verifyPermission(asset.fileHandle);
            if (granted) {
                // Reload specific asset or all
                await loadAssets();
            }
        }
    };

    useEffect(() => {
        loadAssets();
        // Load saved folders and tags from localStorage
        const savedFolders = localStorage.getItem('frameflow-asset-folders');
        const savedTags = localStorage.getItem('frameflow-asset-tags');
        if (savedFolders) setFolders(JSON.parse(savedFolders));
        if (savedTags) setTags(JSON.parse(savedTags));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Cleanup URLs on unmount
    useEffect(() => {
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            assets.forEach(a => URL.revokeObjectURL(a.url));
        };
    }, [assets]);

    // Save folders/tags on change
    useEffect(() => {
        localStorage.setItem('frameflow-asset-folders', JSON.stringify(folders));
    }, [folders]);

    useEffect(() => {
        localStorage.setItem('frameflow-asset-tags', JSON.stringify(tags));
    }, [tags]);

    // Filter assets
    const filteredAssets = assets.filter(asset => {
        // Search filter
        if (searchQuery && !asset.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }
        // Folder filter
        if (selectedFolderId && selectedFolderId !== 'root' && asset.folderId !== selectedFolderId) {
            return false;
        }
        // Tag filter
        if (selectedTagIds.length > 0 && !selectedTagIds.some(tagId => asset.tags.includes(tagId))) {
            return false;
        }
        return true;
    });

    const handleFileDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            
            const isTauri = '__TAURI_INTERNALS__' in window;
            let invoke: any;
            if (isTauri) {
                try {
                    const tauri = await import('@tauri-apps/api/core');
                    invoke = tauri.invoke;
                } catch (e) {
                    console.warn("Tauri API not found", e);
                }
            }

            for (const file of files) {
                const filePath = (file as any).path; 
                
                let metadata;
                if (filePath && isTauri && invoke && file.type.startsWith('video/')) {
                    try {
                        metadata = await invoke('get_video_metadata', { path: filePath });
                    } catch (err) {
                        console.error("Failed to get video metadata:", err);
                    }
                }

                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                    const assetId = await db.addAsset(file, filePath, metadata);

                    // Proxy Generation (Background)
                    if (isTauri && invoke && filePath && file.type.startsWith('video/')) {
                        // Infer proxy path: same dir, suffix _proxy.mp4
                        // Should technically use path API to join, but string manipulation is ok for common cases on Windows
                        const proxyPath = filePath.replace(/(\.[\w\d]+)$/i, '_proxy.mp4');
                        
                        invoke('generate_proxy', { inputPath: filePath, outputPath: proxyPath })
                            .then(async (path: any) => {
                                console.log("Proxy generated at:", path);
                                await db.updateAsset(assetId, { proxyPath: path });
                                await loadAssets(); // Refresh UI to show proxy availability if we add indicator later
                            })
                            .catch((err: any) => {
                                console.error("Proxy generation failed:", err);
                            });
                    }
                }
            }
            await loadAssets();
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await db.deleteAsset(id);
        await loadAssets();
    };

    const addToScene = (asset: AssetWithMeta) => {
        if (!activeCard) return;
        
        const newEl = {
            id: `asset-${Date.now()}`,
            type: asset.type === 'audio' ? 'video' : asset.type, // Map audio to video for timeline
            content: asset.url, 
            assetId: asset.id,
            x: 100, y: 100, 
            width: 400, height: 300, 
            rotation: 0, zIndex: 15,
        } as SceneElement;

        if (asset.type === 'image') {
             const img = new Image();
             img.src = asset.url;
             img.onload = () => {
                  newEl.width = 400;
                  newEl.height = (400 / img.width) * img.height;
                  updateCardElements(activeCard.id, [...activeCard.elements, newEl]);
             };
        } else {
             updateCardElements(activeCard.id, [...activeCard.elements, newEl]);
        }
    };

    const createFolder = () => {
        if (!newFolderName.trim()) return;
        const folder: AssetFolder = {
            id: `folder-${Date.now()}`,
            name: newFolderName,
            parentId: selectedFolderId || null,
            isExpanded: true
        };
        setFolders([...folders, folder]);
        setNewFolderName('');
        setShowNewFolder(false);
    };

    const createTag = () => {
        if (!newTagName.trim()) return;
        const tag: AssetTag = {
            id: `tag-${Date.now()}`,
            name: newTagName,
            color: TAG_COLORS[tags.length % TAG_COLORS.length]
        };
        setTags([...tags, tag]);
        setNewTagName('');
        setShowNewTag(false);
    };

    const toggleFolder = (folderId: string) => {
        setFolders(folders.map(f => 
            f.id === folderId ? { ...f, isExpanded: !f.isExpanded } : f
        ));
    };

    const toggleTagFilter = (tagId: string) => {
        setSelectedTagIds(prev => 
            prev.includes(tagId) 
                ? prev.filter(id => id !== tagId) 
                : [...prev, tagId]
        );
    };

    return (
        <div 
            className={`flex flex-col h-full bg-[#0d0d0d]/50 transition-colors ${isDragging ? 'bg-indigo-900/20 ring-2 ring-indigo-500' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
        >
            {/* Header with Search */}
            <div className="p-3 border-b border-white/10">
                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1">Assets</h3>
                    <button
                        onClick={() => setShowNewFolder(true)}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title="New Folder"
                    >
                        <FolderPlus className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button
                        onClick={() => setShowNewTag(true)}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title="New Tag"
                    >
                        <Plus className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button
                        onClick={handleUploadClick}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title="Import File"
                    >
                        <Upload className="w-3.5 h-3.5 text-gray-500 hover:text-white" />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFallbackImport}
                        className="hidden"
                        accept="video/*,image/*,audio/*"
                    />
                </div>
                
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search assets..."
                        className="w-full bg-white/5 border border-white/10 rounded pl-7 pr-2 py-1 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2"
                        >
                            <X className="w-3 h-3 text-gray-500" />
                        </button>
                    )}
                </div>
            </div>

            {/* New Folder Input */}
            {showNewFolder && (
                <div className="px-3 py-2 border-b border-white/10 flex gap-1">
                    <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                        placeholder="Folder name"
                        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                        autoFocus
                    />
                    <button onClick={createFolder} className="px-2 py-1 bg-indigo-600 text-xs text-white rounded">Add</button>
                    <button onClick={() => setShowNewFolder(false)} className="px-2 py-1 text-xs text-gray-400">Cancel</button>
                </div>
            )}

            {/* New Tag Input */}
            {showNewTag && (
                <div className="px-3 py-2 border-b border-white/10 flex gap-1">
                    <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && createTag()}
                        placeholder="Tag name"
                        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                        autoFocus
                    />
                    <button onClick={createTag} className="px-2 py-1 bg-indigo-600 text-xs text-white rounded">Add</button>
                    <button onClick={() => setShowNewTag(false)} className="px-2 py-1 text-xs text-gray-400">Cancel</button>
                </div>
            )}

            {/* Folders */}
            <div className="px-2 py-1 border-b border-white/5">
                {folders.map(folder => (
                    <button
                        key={folder.id}
                        onClick={() => {
                            setSelectedFolderId(folder.id === selectedFolderId ? null : folder.id);
                            toggleFolder(folder.id);
                        }}
                        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                            selectedFolderId === folder.id ? 'bg-indigo-600/20 text-white' : 'text-gray-400 hover:bg-white/5'
                        }`}
                    >
                        {folder.isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <Folder className="w-3 h-3" />
                        <span className="truncate">{folder.name}</span>
                        <span className="ml-auto text-[10px] text-gray-600">
                            {assets.filter(a => folder.id === 'root' || a.folderId === folder.id).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
                <div className="px-3 py-2 border-b border-white/5 flex flex-wrap gap-1">
                    {tags.map(tag => (
                        <button
                            key={tag.id}
                            onClick={() => toggleTagFilter(tag.id)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] transition-all ${
                                selectedTagIds.includes(tag.id) 
                                    ? 'ring-2 ring-white/50' 
                                    : 'opacity-70 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: tag.color + '40', color: tag.color }}
                        >
                            <Tag className="w-2.5 h-2.5" />
                            {tag.name}
                        </button>
                    ))}
                </div>
            )}
            
            {/* Asset Grid */}
            <div className="p-2 grid grid-cols-2 gap-2 overflow-y-auto flex-1 content-start">
                {filteredAssets.length === 0 && (
                     <div className="col-span-2 text-center py-8 text-gray-600 text-xs">
                         {searchQuery || selectedTagIds.length > 0 
                             ? 'No matching assets' 
                             : 'Drop files here'
                         }
                     </div>
                )}
                
                {filteredAssets.map((asset) => (
                    <div 
                        key={asset.id}
                        onClick={() => addToScene(asset)}
                        className="aspect-video bg-white/5 rounded overflow-hidden cursor-pointer hover:ring-2 ring-indigo-500 transition-all group relative"
                    >
                        {asset.url ? (
                            asset.type === 'image' ? (
                                <img src={asset.url} className="w-full h-full object-cover" alt={asset.name} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-black">
                                    <span className="text-xs text-gray-500">Video</span>
                                </div>
                            )
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 p-2 gap-2">
                                <span className="text-[10px] text-gray-500 text-center">Permission needed</span>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); requestAssetAccess(asset); }}
                                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-[10px] text-white rounded"
                                >
                                    Load
                                </button>
                            </div>
                        )}
                        
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 truncate text-[10px] text-gray-300 flex justify-between items-center group-hover:opacity-100 opacity-0 transition-opacity">
                            <span className="truncate flex-1">{asset.name}</span>
                            <button 
                                onClick={(e) => handleDelete(e, asset.id)}
                                className="text-gray-400 hover:text-red-400"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="p-2 border-t border-white/10 bg-black/20 text-[10px] text-gray-500 text-center">
                {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''} • Drag to import
            </div>
        </div>
    );
};
