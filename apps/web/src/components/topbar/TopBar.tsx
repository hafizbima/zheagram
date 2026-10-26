import React, { useState, useEffect } from 'react';
import {
  Share2,
  CheckCircle2,
  Sparkles,
  LayoutGrid,
  Cloud,
  Download,
  Users,
  Image as ImageIcon,
  FileCode,
  Database,
  ChevronDown,
  Check,
  ArrowLeft,
  Plus,
  Home,
} from 'lucide-react';
import { api } from '../../services/api';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { exportToPng, exportToSvg, exportToJson } from '../../utils/exportCanvas';
import { ExportAreaOverlay } from '../export/ExportAreaOverlay';
import type { ExportArea } from '../../utils/exportCanvas';

interface TopBarProps {
  onOpenDashboard: () => void;
  onOpenTemplates?: () => void;
  currentBoardId?: string;
  onNavigateHome?: () => void;
  onCreateBlank?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenDashboard,
  onOpenTemplates,
  currentBoardId = 'default-board',
  onNavigateHome,
  onCreateBlank,
}) => {
  const {
    documentStore,
    boardVersion,
    collaborators,
    isMultiplayerEnabled,
    toggleMultiplayer,
  } = useCanvasStore();

  const [title, setTitle] = useState('Untitled Diagram');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'svg' | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync title with document store whenever board loads
  useEffect(() => {
    const currentTitle = documentStore.getState().title;
    if (currentTitle) {
      setTitle(currentTitle);
    }
  }, [currentBoardId, boardVersion]);

  // Autosave whenever document updates
  useEffect(() => {
    if (boardVersion > 0) {
      setSaveStatus('saving');
      const timer = setTimeout(async () => {
        const state = documentStore.getState();
        await api.saveBoard(currentBoardId, {
          title: state.title || title,
          data: {
            objects: state.objects,
            order: state.order,
          },
        });
        setSaveStatus('saved');
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [boardVersion, currentBoardId, title]);

  const handleTitleBlur = async () => {
    setIsEditingTitle(false);
    const trimmed = title.trim() || 'Untitled Board';
    setTitle(trimmed);
    documentStore.getState().title = trimmed;
    await api.saveBoard(currentBoardId, { title: trimmed });
  };

  const getCanvasSvg = (): SVGSVGElement | null => {
    return document.querySelector('svg.touch-none') as SVGSVGElement | null;
  };

  const handleExportPng = async () => {
    setShowExportMenu(false);
    setExportFormat('png');
  };

  const handleExportSvg = () => {
    setShowExportMenu(false);
    setExportFormat('svg');
  };

  const handleExportArea = async (area: ExportArea) => {
    const format = exportFormat;
    setExportFormat(null);
    if (format === 'png') {
      await exportToPng(getCanvasSvg(), title, 4, area);
    } else if (format === 'svg') {
      exportToSvg(getCanvasSvg(), title, area);
    }
  };

  const handleExportJson = () => {
    setShowExportMenu(false);
    exportToJson(documentStore, title);
  };

  const handleCopyShareLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <header className="absolute top-4 left-4 right-4 h-12 flex items-center justify-between pointer-events-none z-30 select-none">
      {/* Left: Brand, Dashboard Switcher & Board Title */}
      <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/80 px-3 py-1.5 rounded-2xl shadow-sm pointer-events-auto">
        {/* Back to Home / All Documents */}
        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            title="Back to All Documents (Home)"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </button>
        )}

        {/* Quick New Blank Document */}
        {onCreateBlank && (
          <button
            onClick={onCreateBlank}
            title="Create New Blank Document"
            className="flex items-center justify-center w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        )}

        {/* Boards Dashboard Modal Button */}
        <button
          onClick={onOpenDashboard}
          title="Open Boards Switcher"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
        >
          <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden md:inline">Boards</span>
        </button>

        <div className="w-px h-4 bg-slate-200 mx-0.5" />

        {/* Board Title */}
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleBlur();
              }}
              className="text-sm font-semibold text-slate-800 bg-transparent border-b border-blue-500 outline-none px-0.5 py-0.5 min-w-[140px]"
            />
          ) : (
            <span
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-semibold text-slate-800 hover:bg-slate-100 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors max-w-[220px] truncate"
              title="Click to rename diagram"
            >
              {title}
            </span>
          )}

          {/* Autosave Status */}
          <div
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
              saveStatus === 'saved'
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-amber-600 bg-amber-50 animate-pulse'
            }`}
          >
            {saveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Cloud className="w-3 h-3" />
                <span>Saving...</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Templates, Export, Live Collaborators & Share */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Template Library Button */}
        {onOpenTemplates && (
          <button
            onClick={onOpenTemplates}
            title="Browse Miro Templates"
            className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200/80 hover:border-purple-300 text-purple-700 hover:bg-purple-50/50 px-3 py-1.5 rounded-xl shadow-xs text-xs font-semibold transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Templates</span>
          </button>
        )}

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            title="Export Board (PNG / SVG / JSON)"
            className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200/80 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-xl shadow-xs text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showExportMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1 text-xs">
              <button
                onClick={handleExportPng}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 text-slate-700 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-blue-500" />
                <div>
                  <div className="font-semibold">Select area → PNG</div>
                  <div className="text-[10px] text-slate-400">Screenshot-style, 4× resolution</div>
                </div>
              </button>

              <button
                onClick={handleExportSvg}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 text-slate-700 transition-colors"
              >
                <FileCode className="w-4 h-4 text-emerald-500" />
                <div>
                  <div className="font-semibold">Select area → SVG</div>
                  <div className="text-[10px] text-slate-400">Cropped vector graphic</div>
                </div>
              </button>

              <button
                onClick={handleExportJson}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 text-slate-700 transition-colors"
              >
                <Database className="w-4 h-4 text-amber-500" />
                <div>
                  <div className="font-semibold">Export as JSON</div>
                  <div className="text-[10px] text-slate-400">Full board data backup</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Live Collaborators Presence */}
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200/80 px-2.5 py-1 rounded-xl shadow-xs">
          <div className="flex -space-x-1.5 items-center mr-1">
            {collaborators.map((c) => (
              <div
                key={c.id}
                title={`${c.name} (${c.role})`}
                style={{ backgroundColor: c.color }}
                className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
              >
                {c.name.charAt(0)}
              </div>
            ))}
          </div>

          <button
            onClick={toggleMultiplayer}
            title={isMultiplayerEnabled ? 'Hide live teammate cursors' : 'Show live teammate cursors'}
            className={`p-1 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-medium ${
              isMultiplayerEnabled
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isMultiplayerEnabled ? 'Live' : 'Paused'}</span>
          </button>
        </div>

        {/* Share Button */}
        <button
          onClick={() => setShowShareModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-sm hover:shadow transition-all"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 w-full max-w-md animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-semibold text-slate-800 mb-1">Share this Whiteboard</h3>
            <p className="text-xs text-slate-500 mb-4">
              Anyone with this link can view and collaborate in real-time.
            </p>

            <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-2xl mb-4">
              <input
                type="text"
                readOnly
                value={window.location.href}
                className="bg-transparent text-xs text-slate-700 flex-1 outline-none px-1 truncate font-mono"
              />
              <button
                onClick={handleCopyShareLink}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : null}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {exportFormat && (
        <ExportAreaOverlay
          format={exportFormat}
          onCancel={() => setExportFormat(null)}
          onConfirm={handleExportArea}
        />
      )}
    </header>
  );
};
