import React, { useState, useEffect } from 'react';
import { InfiniteCanvas } from './components/canvas/InfiniteCanvas';
import { Toolbar } from './components/toolbar/Toolbar';
import { TopBar } from './components/topbar/TopBar';
import { ZoomControls } from './components/controls/ZoomControls';
import { Minimap } from './components/controls/Minimap';
import { PropertiesPanel } from './components/properties/PropertiesPanel';
import { DashboardModal } from './components/dashboard/DashboardModal';
import { TemplatePickerModal } from './components/modals/TemplatePickerModal';
import { HomePage } from './components/home/HomePage';
import { Keyboard, X } from 'lucide-react';
import { useCanvasStore } from './stores/useCanvasStore';
import { api, storage } from './services/api';

type AppView = 'home' | 'canvas';

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [currentBoardId, setCurrentBoardId] = useState('board-demo-flowchart');

  const { loadBoardState } = useCanvasStore();

  const handleSelectBoard = async (boardId: string) => {
    setCurrentBoardId(boardId);
    await storage.setLastActiveBoardId(boardId);
    const board = await api.getBoard(boardId);
    if (board && board.data) {
      loadBoardState({
        id: board.id,
        title: board.title,
        objects: board.data.objects || {},
        order: board.data.order || [],
      });
    }
    setView('canvas');
    window.location.hash = `#/board/${boardId}`;
  };

  const handleCreateBoard = async (title: string, template: string = 'blank') => {
    const newBoard = await api.createBoard(title, template);
    await handleSelectBoard(newBoard.id);
  };

  const handleNavigateHome = () => {
    setView('home');
    window.location.hash = '#home';
  };

  // Sync state with URL hash & browser back/forward buttons
  useEffect(() => {
    let isMounted = true;

    const syncFromHash = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/board/')) {
        const boardId = hash.replace('#/board/', '');
        if (boardId) {
          if (!isMounted) return;
          await handleSelectBoard(boardId);
          return;
        }
      } else if (hash === '#home') {
        if (!isMounted) return;
        setView('home');
        return;
      }

      // Default start on Homepage
      if (isMounted) {
        setView('home');
      }
    };

    syncFromHash();

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/board/')) {
        const boardId = hash.replace('#/board/', '');
        if (boardId && boardId !== currentBoardId) {
          handleSelectBoard(boardId);
        }
        setView('canvas');
      } else if (hash === '#home' || !hash) {
        setView('home');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      isMounted = false;
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  if (view === 'home') {
    return (
      <HomePage
        onOpenBoard={handleSelectBoard}
        onCreateBoard={handleCreateBoard}
        currentBoardId={currentBoardId}
      />
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 select-none">
      {/* Top Header with Templates, Export & Collaborators */}
      <TopBar
        onNavigateHome={handleNavigateHome}
        onCreateBlank={() => handleCreateBoard('Untitled Document', 'blank')}
        onOpenDashboard={() => setShowDashboard(true)}
        onOpenTemplates={() => setShowTemplatesModal(true)}
        currentBoardId={currentBoardId}
      />

      {/* Floating Left Toolbar with Pen & Templates */}
      <Toolbar onOpenTemplates={() => setShowTemplatesModal(true)} />

      {/* Main Interactive Infinite Canvas */}
      <InfiniteCanvas />

      {/* Contextual Properties Panel (Right side) */}
      <PropertiesPanel />

      {/* Bottom Left Zoom Controls */}
      <ZoomControls />

      {/* Interactive Minimap Radar */}
      <Minimap />

      {/* Boards Dashboard Modal */}
      <DashboardModal
        isOpen={showDashboard}
        onClose={() => setShowDashboard(false)}
        onSelectBoard={handleSelectBoard}
      />

      {/* Miro Template Library Picker Modal */}
      <TemplatePickerModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
      />

      {/* Bottom Right Shortcuts Pill / Modal */}
      <div className="absolute bottom-5 right-5 z-30">
        {showShortcuts ? (
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-4 shadow-2xl w-80 text-xs text-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Keyboard className="w-4 h-4 text-blue-600" /> Keyboard Shortcuts
              </span>
              <button
                onClick={() => setShowShortcuts(false)}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              <div className="flex justify-between">
                <span>Select / Pan tool</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">V</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">H</kbd>
                </div>
              </div>
              <div className="flex justify-between">
                <span>Pen / Highlighter</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">P</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Shift+P</kbd>
                </div>
              </div>
              <div className="flex justify-between">
                <span>Shape / Sticky / Text / Frame</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">R</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">N</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">T</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">F</kbd>
                </div>
              </div>
              <div className="flex justify-between">
                <span>Connector tool</span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">C</kbd>
              </div>
              <div className="flex justify-between text-blue-600 font-medium">
                <span>Quick node next (child / sibling)</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded font-mono text-[10px]">Tab</kbd>
                  <kbd className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded font-mono text-[10px]">Enter</kbd>
                </div>
              </div>
              <div className="flex justify-between">
                <span>Edit text inline</span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Double click</kbd>
              </div>
              <div className="flex justify-between">
                <span>Multi-select</span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Shift + Click / Drag</kbd>
              </div>
              <div className="flex justify-between">
                <span>Duplicate</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Ctrl+D</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Alt + Drag</kbd>
                </div>
              </div>
              <div className="flex justify-between">
                <span>Copy / Paste</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Ctrl+C</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Ctrl+V</kbd>
                </div>
              </div>
              <div className="flex justify-between">
                <span>Bring Forward / Backward</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Ctrl+]</kbd>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Ctrl+[</kbd>
                </div>
              </div>
              <div className="flex justify-between">
                <span>Select all</span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Ctrl+A</kbd>
              </div>
              <div className="flex justify-between">
                <span>Delete selected</span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Del / Backspace</kbd>
              </div>
              <div className="flex justify-between">
                <span>Undo / Redo (200 steps)</span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Ctrl+Z / Ctrl+Shift+Z</kbd>
              </div>
              <div className="flex justify-between">
                <span>Pan Canvas</span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Alt + Drag / Space / Scrollbars</kbd>
              </div>
              <div className="flex justify-between text-blue-600 font-medium">
                <span>Trackpad: Scroll / Pan</span>
                <kbd className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded font-mono text-[10px]">2-Finger Scroll</kbd>
              </div>
              <div className="flex justify-between text-blue-600 font-medium">
                <span>Trackpad: Zoom</span>
                <kbd className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded font-mono text-[10px]">Pinch in / out</kbd>
              </div>
              <div className="flex justify-between">
                <span>Mouse: Zoom in / out</span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Scroll Up / Down</kbd>
              </div>
              <div className="flex justify-between">
                <span>Mouse: Scroll Left / Right</span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Shift + Scroll</kbd>
              </div>
              <div className="flex justify-between">
                <span>Mouse: Scroll Up / Down</span>
                <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px]">Ctrl + Scroll</kbd>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowShortcuts(true)}
            title="Keyboard shortcuts"
            className="flex items-center gap-1.5 bg-white/90 hover:bg-white backdrop-blur-sm border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-md text-xs text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Keyboard className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-medium">Shortcuts</span>
          </button>
        )}
      </div>
    </div>
  );
};
