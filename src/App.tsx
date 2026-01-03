import { Layers, Upload, Play } from 'lucide-react';
import { Viewport } from './components/Viewport';
import { useAppStore, type Card } from './stores/useAppStore';
import { EditorOverlay } from './components/EditorOverlay';
import { PropertyInspector } from './components/PropertyInspector';
import { FloatingToolbar } from './components/FloatingToolbar';
import { Sidebar } from './components/Sidebar';
import { StudioPanel } from './components/StudioPanel';
import { PresentationParser } from './engine/PresentationParser';
import { useRef, useEffect } from 'react';
import { usePresentationSync } from './hooks/usePresentationSync';

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const addCards = useAppStore(state => state.addCards);
  const addCard = useAppStore(state => state.addCard);
  const updateCardElements = useAppStore(state => state.updateCardElements);
  
  // Enable Sync
  usePresentationSync();

  // Event Listener for Floating Toolbar Actions
  useEffect(() => {
    const handleImageTrigger = () => imageInputRef.current?.click();
    window.addEventListener('trigger-image-upload', handleImageTrigger);
    return () => window.removeEventListener('trigger-image-upload', handleImageTrigger);
  }, []);

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
          const state = useAppStore.getState();
          const activeCard = state.cards.find(c => c.id === state.activeCardId);

          if (activeCard) {
              // Add to current card
              const newElement = {
                  id: `img-${Date.now()}`,
                  type: 'image' as const,
                  content: url,
                  x: 100, y: 100, width: 600, height: 400, // Default sizing
                  rotation: 0,
                  zIndex: (activeCard.elements.length || 0) + 10
              };
              updateCardElements(activeCard.id, [...activeCard.elements, newElement]);
          } else {
              // Create new card (fallback)
              addCard({
                  id: `img-${Date.now()}`,
                  type: 'scene',
                  title: file.name,
                  thumbnailUrl: url,
                  elements: [{
                      id: `el-${Date.now()}`,
                      type: 'image',
                      content: url,
                      x: 0, y: 0, width: 1920, height: 1080,
                      rotation: 0,
                      zIndex: 0
                  }]
              });
          }
      }
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
        <header className="h-14 border-b border-white/5 flex items-center px-4 bg-[#0d0d0d]/80 backdrop-blur-md z-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">FrameFlow</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
              
             {/* Header Left Actions (File Management) */}
             <div className="flex items-center gap-2 mr-4 border-r border-white/10 pr-4">
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="px-3 py-1.5 text-xs hover:bg-white/5 rounded transition-colors text-gray-400 hover:text-white flex items-center gap-1">
                   <Upload className="w-3 h-3" />
                   Import
                 </button>
             </div>

             {/* Present Button - Primary Action */}
             <button 
               onClick={() => {
                   window.open('/present', 'FrameFlowPresentation', 'width=1920,height=1080');
               }}
               className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2 hover:translate-y-0.5">
               <Play className="w-4 h-4 fill-current" />
               Present
             </button>
          </div>
        </header>

        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden">
          {/* New Sidebar */}
          <Sidebar />

          {/* Canvas Viewport */}
          <main className="flex-1 relative bg-black/50 m-4 rounded-2xl border border-white/5 overflow-hidden shadow-2xl flex flex-col group">
             <Viewport />
             <EditorOverlay />
             
             {/* Floating Toolbar - Injected over the canvas */}
             <FloatingToolbar />
          </main>

          {/* Properties Panel */}
          <aside className="w-72 border-l border-white/5 bg-[#0d0d0d]/50 backdrop-blur-sm">
             <PropertyInspector />
          </aside>
        </div>

        {/* Studio Panel (Bottom) */}
        <StudioPanel />
      </div>
    </div>
  );
}

export default App;
