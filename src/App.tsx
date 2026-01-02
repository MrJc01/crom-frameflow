import { Layers, Upload, Video } from 'lucide-react';
import { Viewport } from './components/Viewport';
import { useAppStore, type Card } from './stores/useAppStore';
import { CardList } from './components/CardList';
import { EditorOverlay } from './components/EditorOverlay';
import { PropertyInspector } from './components/PropertyInspector';
import { AssetLibrary } from './components/AssetLibrary';
import { PresentationParser } from './engine/PresentationParser';
import { useRef } from 'react';

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const addCards = useAppStore(state => state.addCards);
  const addCard = useAppStore(state => state.addCard);
  const activeCardId = useAppStore(state => state.activeCardId);
  const updateCardElements = useAppStore(state => state.updateCardElements);
  const cards = useAppStore(state => state.cards);

  const activeCard = cards.find(c => c.id === activeCardId);

  const handleAddCamera = () => {
      if (!activeCard) return;
      const newElement = {
          id: `cam-${Date.now()}`,
          type: 'camera' as const,
          content: 'camera',
          x: 50, y: 50, width: 480, height: 270,
          rotation: 0,
          zIndex: 10
      };
      updateCardElements(activeCard.id, [...activeCard.elements, newElement]);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const parser = new PresentationParser();
      try {
        const slides = await parser.parsePPTX(file);
        const newCards: Card[] = slides.map(slide => ({
            id: slide.id,
            type: 'scene',
            title: slide.title,
            thumbnailUrl: slide.previewUrl,
            elements: slide.previewUrl ? [{
                id: `bg-${slide.id}`,
                type: 'image',
                content: slide.previewUrl,
                x: 0, y: 0, width: 1920, height: 1080, // Default FHD
                rotation: 0,
                zIndex: 0
            }] : []
        }));
        addCards(newCards);
      } catch (err) {
        console.error("Failed to parse PPTX:", err);
        alert("Failed to parse PPTX. Ensure it's a valid file.");
      }
    }
  };

  const handleImageImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          addCard({
              id: `img-${Date.now()}`,
              type: 'scene',
              title: file.name,
              thumbnailUrl: url,
              elements: [{
                  id: `el-${Date.now()}`,
                  type: 'image',
                  content: url,
                  x: 0, y: 0, width: 1920, height: 1080, // Assume full screen for now or generic size
                  rotation: 0,
                  zIndex: 0
              }]
          });
      }
  };

  const handleNewCard = () => {
      addCard({
          id: `card-${Date.now()}`,
          type: 'scene',
          title: 'Empty Scene',
          elements: []
      });
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImport} 
        accept=".pptx" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={imageInputRef} 
        onChange={handleImageImport} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Background/Canvas Area */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
         <div className="text-gray-800 text-9xl font-bold opacity-10">
           FRAMEFLOW
         </div>
      </div>

      {/* UI Overlay */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="h-14 border-b border-white/10 flex items-center px-4 bg-[#0d0d0d]/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">FrameFlow</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
              
              <button 
                onClick={handleAddCamera}
                disabled={!activeCard}
                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                <Video className="w-4 h-4" />
                + Camera
             </button>

             <button 
                onClick={() => {
                    const state = useAppStore.getState();
                    if(!state.activeCardId) return;
                    const newEl = {
                        id: `txt-${Date.now()}`,
                        type: 'text' as const,
                        content: 'New Text',
                        x: 100, y: 100, width: 300, height: 100,
                        rotation: 0, zIndex: 20,
                        fontSize: 40, color: '#ffffff'
                    };
                    state.updateCardElements(state.activeCardId, [...(state.cards.find(c => c.id === state.activeCardId)?.elements || []), newEl]);
                }}
                disabled={!activeCard}
                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                <span className="font-serif italic font-bold">T</span>
                + Text
             </button>

             <button 
               onClick={handleNewCard}
               className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-colors">
               + Empty Card
             </button>
             <button 
               onClick={() => imageInputRef.current?.click()}
               className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-medium transition-colors">
               + Image
             </button>
             <button 
               onClick={() => fileInputRef.current?.click()}
               className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2">
               <Upload className="w-4 h-4" />
               Import PPTX
             </button>
          </div>
        </header>

        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-72 border-r border-white/10 bg-[#0d0d0d]/50 flex flex-col">
             <div className="p-4 border-b border-white/10">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Scene & Assets</h3>
             </div>
             
             {/* Scene Sources */}
             <div className="p-2 space-y-1 border-b border-white/10">
                 <AssetLibrary />
             </div>

             {/* Cards List */}
             <div className="flex-1 overflow-hidden flex flex-col">
                 <div className="p-2 bg-black/20 text-xs font-semibold text-gray-500 uppercase">
                    Cards
                 </div>
                 <CardList />
             </div>
          </aside>


          {/* Canvas Viewport */}
          <main className="flex-1 relative bg-black/50 m-4 rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
             <Viewport />
             <EditorOverlay />
          </main>

          {/* Properties Panel */}
          <aside className="w-72 border-l border-white/10 bg-[#0d0d0d]/50">
             <PropertyInspector />
          </aside>
        </div>
      </div>
    </div>
  );
}

export default App;
