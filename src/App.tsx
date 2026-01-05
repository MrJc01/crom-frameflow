import { Layers, Upload, Play, Settings, Sparkles, Download, History, Search, Subtitles, MessageSquare } from 'lucide-react';
import { Viewport } from './components/Viewport';
import { useAppStore, type Card } from './stores/useAppStore';
import { EditorOverlay } from './components/EditorOverlay';
import { PropertyInspector } from './components/PropertyInspector';
import { FloatingToolbar } from './components/FloatingToolbar';
import { Sidebar } from './components/Sidebar';
import { StudioPanel } from './components/StudioPanel';
import { PresentationParser } from './engine/PresentationParser';
import { useRef, useEffect, useState, lazy, Suspense } from 'react';
import { usePresentationSync } from './hooks/usePresentationSync';
import { useMemoryMonitor } from './hooks/useMemoryMonitor';
import { KeyboardShortcutsManager } from './components/KeyboardShortcutsManager';
import { DropZone } from './components/DropZone';
import { FileSystemService } from './services/FileSystemService';
import { Toaster } from 'sonner';
import { APP_CONFIG } from './config/constants';

// Lazy Loaded Components
const SettingsModal = lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const EffectPresets = lazy(() => import('./components/EffectPresets').then(m => ({ default: m.EffectPresets })));
const QuickExport = lazy(() => import('./components/QuickExport').then(m => ({ default: m.QuickExport })));
const HistoryPanel = lazy(() => import('./components/HistoryPanel').then(m => ({ default: m.HistoryPanel })));
const SearchModal = lazy(() => import('./components/SearchModal').then(m => ({ default: m.SearchModal })));
const SubtitleEditor = lazy(() => import('./components/SubtitleEditor').then(m => ({ default: m.SubtitleEditor })));
const RecoveryPrompt = lazy(() => import('./components/RecoveryPrompt').then(m => ({ default: m.RecoveryPrompt })));
const DiskWarning = lazy(() => import('./components/DiskWarning').then(m => ({ default: m.DiskWarning })));
const CollectFilesModal = lazy(() => import('./components/CollectFilesModal').then(m => ({ default: m.CollectFilesModal })));
const CollaborationModal = lazy(() => import('./components/CollaborationModal').then(m => ({ default: m.CollaborationModal })));
const FeedbackModal = lazy(() => import('./components/FeedbackModal').then(m => ({ default: m.FeedbackModal })));
const UpdateChecker = lazy(() => import('./components/UpdateChecker').then(m => ({ default: m.UpdateChecker })));

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEffectsOpen, setIsEffectsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSubtitlesOpen, setIsSubtitlesOpen] = useState(false);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isCollaborationOpen, setIsCollaborationOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const addCards = useAppStore(state => state.addCards);
  const addCard = useAppStore(state => state.addCard);
  const updateCardElements = useAppStore(state => state.updateCardElements);
  
  // Enable Sync
  usePresentationSync();
  useMemoryMonitor();

  // Event Listener for Floating Toolbar Actions
  useEffect(() => {
    const handleImageTrigger = () => imageInputRef.current?.click();
    window.addEventListener('trigger-image-upload', handleImageTrigger);
    return () => window.removeEventListener('trigger-image-upload', handleImageTrigger);
  }, []);

  // Sync Splash Screen
  useEffect(() => {
      const closeSplash = async () => {
          try {
             // Dynamic import to allow running in browser mode without Tauri errors
             const { invoke } = await import('@tauri-apps/api/core');
             const { getCurrentWindow } = await import('@tauri-apps/api/window');
             const mainWin = getCurrentWindow();
             await mainWin.show(); // Show main (it's hidden by default)
             await invoke('close_splash'); 
          } catch (e) {
              console.log("Not in Tauri or Splash error", e);
          }
      };
      
      // Simulate init time
      setTimeout(closeSplash, 1000);
  }, []);

  // Cmd+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleImport = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    let file: File | undefined = e?.target.files?.[0];

    // Try FS Access if event is undefined (called from button/shortcut) or if explicit logic needed
    if (!file && FileSystemService.isSupported()) {
         try {
             const result = await FileSystemService.openFile({
                 types: [{ description: 'PowerPoint', accept: { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] } }]
             });
             if (result) file = result.file;
         } catch (er) { console.error(er); }
    } else if (!file && fileInputRef.current) {
         fileInputRef.current.click();
         return; // Wait for change event
    }

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
                x: 0, y: 0, width: APP_CONFIG.PROJECT.DEFAULT_WIDTH, height: APP_CONFIG.PROJECT.DEFAULT_HEIGHT,
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
                      x: 0, y: 0, width: APP_CONFIG.PROJECT.DEFAULT_WIDTH, height: APP_CONFIG.PROJECT.DEFAULT_HEIGHT,
                      rotation: 0,
                      zIndex: 0
                  }]
              });
          }
      }
  };

  // Placeholder functions for RecoveryPrompt
  const handleRecover = () => {
    console.log("Recovering...");
  };

  const handleDiscardRecovery = () => {
    console.log("Discarding recovery...");
  };


  return (
    <DropZone>
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

      {/* Keyboard Processor */}
      <KeyboardShortcutsManager />

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
                 
                 <button 
                   onClick={() => setIsSettingsOpen(true)}
                   className="px-3 py-1.5 text-xs hover:bg-white/5 rounded transition-colors text-gray-400 hover:text-white flex items-center gap-1">
                   <Settings className="w-3 h-3" />
                   Settings
                 </button>
                 
                 <button 
                   onClick={() => setIsEffectsOpen(true)}
                   className="px-3 py-1.5 text-xs hover:bg-white/5 rounded transition-colors text-gray-400 hover:text-white flex items-center gap-1">
                   <Sparkles className="w-3 h-3" />
                   Effects
                 </button>
                 
                 <button 
                   onClick={() => setIsSearchOpen(true)}
                   className="px-3 py-1.5 text-xs hover:bg-white/5 rounded transition-colors text-gray-400 hover:text-white flex items-center gap-1"
                   title="Ctrl/Cmd+K">
                   <Search className="w-3 h-3" />
                   Search
                 </button>
                 
                 <button 
                   onClick={() => setIsHistoryOpen(true)}
                   className="px-3 py-1.5 text-xs hover:bg-white/5 rounded transition-colors text-gray-400 hover:text-white flex items-center gap-1">
                   <History className="w-3 h-3" />
                   History
                 </button>
                 
                 <button 
                   onClick={() => setIsSubtitlesOpen(true)}
                   className="px-3 py-1.5 text-xs hover:bg-white/5 rounded transition-colors text-gray-400 hover:text-white flex items-center gap-1">
                   <Subtitles className="w-3 h-3" />
                   Subtitles
                 </button>
                  <button 
                   onClick={() => setIsFeedbackOpen(true)}
                   className="px-3 py-1.5 text-xs hover:bg-white/5 rounded transition-colors text-gray-400 hover:text-white flex items-center gap-1">
                   <MessageSquare className="w-3 h-3" />
                   Feedback
                 </button>
             </div>

             {/* Export Button */}
             <button 
               onClick={() => setIsExportOpen(true)}
               className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-green-600/20 flex items-center gap-2">
               <Download className="w-4 h-4" />
               Export
             </button>

             {/* Present Button - Primary Action */}
             <button 
               onClick={async () => {
                   try {
                       const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
                       // Check if exists
                       const existing = await WebviewWindow.getByLabel('presentation');
                       if (existing) {
                           await existing.setFocus();
                       } else {
                           const webview = new WebviewWindow('presentation', {
                               url: '/present',
                               title: 'FrameFlow Presentation',
                               width: 1920,
                               height: 1080,
                               decorations: true // Allow moving
                           });
                           webview.once('tauri://created', function () {
                               // webview window successfully created
                           });
                           webview.once('tauri://error', function (e) {
                               console.error(e);
                           });
                       }
                   } catch (e) {
                       // Fallback for browser
                       console.warn("Tauri API not found, using window.open", e);
                       window.open('/present', 'FrameFlowPresentation', 'width=1920,height=1080');
                   }
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

        {/* Studio Panel (Relative Flex Item) */}
        <StudioPanel />
        
        <Suspense fallback={null}>
            {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}
            {isEffectsOpen && <EffectPresets isOpen={isEffectsOpen} onClose={() => setIsEffectsOpen(false)} />}
            {isExportOpen && <QuickExport isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />}
            {isHistoryOpen && <HistoryPanel isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />}
            {isSearchOpen && <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />}
            {isSubtitlesOpen && <SubtitleEditor isOpen={isSubtitlesOpen} onClose={() => setIsSubtitlesOpen(false)} />}
            <RecoveryPrompt 
                onRecover={handleRecover}
                onDiscard={handleDiscardRecovery}
            />
            <DiskWarning />
            {isCollectModalOpen && <CollectFilesModal 
                isOpen={isCollectModalOpen} 
                onClose={() => setIsCollectModalOpen(false)} 
            />}
            {isCollaborationOpen && <CollaborationModal 
                isOpen={isCollaborationOpen} 
                onClose={() => setIsCollaborationOpen(false)} 
            />}
            {isFeedbackOpen && <FeedbackModal 
                isOpen={isFeedbackOpen} 
                onClose={() => setIsFeedbackOpen(false)} 
            />}
            <UpdateChecker />
        </Suspense>
      </div>
      <Toaster richColors /> {/* Added Toaster */}
    </div>
    </DropZone>
  );
}

export default App;
