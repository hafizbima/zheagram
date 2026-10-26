import React, { useState, useEffect, useRef } from 'react';
import { api, BoardSummary, UserProfile } from '../../services/api';
import {
  Search,
  Plus,
  Star,
  MoreVertical,
  Copy,
  Trash2,
  Edit3,
  LayoutGrid,
  FileText,
  Shapes,
  Sparkles,
  Clock,
  ArrowRight,
  ExternalLink,
  Check,
  X,
  GitBranch,
  Columns3,
} from 'lucide-react';

interface HomePageProps {
  onOpenBoard: (boardId: string) => void;
  onCreateBoard: (title: string, template?: string) => Promise<void>;
  currentBoardId?: string;
  onSignOut?: () => Promise<void>;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenBoard,
  onCreateBoard,
  currentBoardId,
  onSignOut,
}) => {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [search, setSearch] = useState('');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const menuRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const list = await api.listBoards({
        favorite: filter === 'favorites' ? true : undefined,
        search: search.trim() || undefined,
      });
      setBoards(list);

      const currentUser = await api.getMe();
      setUser(currentUser);
    } catch {
      // offline fallback handled by api service
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filter, search]);

  // Close 3-dot dropdown menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateBlank = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await onCreateBoard('Untitled Document', 'blank');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateTemplate = async (template: string, defaultTitle: string) => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await onCreateBoard(defaultTitle, template);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleFavorite = async (id: string, current: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.saveBoard(id, { isFavorite: !current });
    loadData();
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.duplicateBoard(id);
    setActiveMenuId(null);
    loadData();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this document?')) {
      await api.deleteBoard(id);
      setActiveMenuId(null);
      loadData();
    }
  };

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenamingTitle(currentTitle);
    setActiveMenuId(null);
  };

  const handleCommitRename = async (id: string) => {
    if (renamingTitle.trim()) {
      await api.renameBoard(id, renamingTitle.trim());
      loadData();
    }
    setRenamingId(null);
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const now = new Date().getTime();
      const time = new Date(isoString).getTime();
      const diffSec = Math.floor((now - time) / 1000);

      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays}d ago`;
      return new Date(isoString).toLocaleDateString();
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col select-none">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5 flex items-center justify-between shadow-xs">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Shapes className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-900 tracking-tight">Zheagram</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                Workspace
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Infinite visual diagrams & documents</p>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="flex-1 max-w-md mx-8 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search documents by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-sm text-slate-800 placeholder-slate-400 rounded-xl border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Actions: + Blank Button & User Profile */}
        <div className="flex items-center gap-3.5">
          <button
            onClick={handleCreateBlank}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Document</span>
          </button>

          <div className="h-6 w-px bg-slate-200" />

          {/* User Profile Pill */}
          <button
            onClick={onSignOut}
            title={onSignOut ? 'Sign out' : undefined}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'ME'}
            </div>
            <span className="hidden sm:inline font-semibold text-slate-800 max-w-[120px] truncate">
              {user?.name || 'Local User'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Quick Start / New Document Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Create a new document</h2>
              <p className="text-xs text-slate-500">Start with a clean blank canvas or choose a starter template</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* 1. BLANK DOCUMENT (PRIMARY CALL TO ACTION) */}
            <button
              onClick={handleCreateBlank}
              disabled={isCreating}
              className="group relative flex flex-col text-left p-4 rounded-2xl border-2 border-dashed border-blue-400/80 hover:border-blue-600 bg-gradient-to-b from-blue-50/60 to-white hover:from-blue-50 hover:to-blue-50/40 shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform mb-3">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors flex items-center gap-1.5">
                Blank Document
                <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-700 font-bold rounded">New</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Start completely fresh with a clean infinite canvas
              </p>
              <div className="mt-4 pt-2.5 border-t border-blue-100 flex items-center text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                <span>Create Blank</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </button>

            {/* 2. Flowchart Template */}
            <button
              onClick={() => handleCreateTemplate('flowchart', 'Flowchart Diagram')}
              disabled={isCreating}
              className="group flex flex-col text-left p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 bg-white hover:bg-slate-50/80 shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <GitBranch className="w-5 h-5 stroke-[2]" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                Flowchart
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Decision trees, process workflows & smart orthogonal routing
              </p>
              <div className="mt-auto pt-3 flex items-center text-xs font-medium text-slate-400 group-hover:text-emerald-600 transition-colors">
                <span>Use Template</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </button>

            {/* 3. Mindmap Template */}
            <button
              onClick={() => handleCreateTemplate('mindmap', 'Mindmap Brainstorm')}
              disabled={isCreating}
              className="group flex flex-col text-left p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 bg-white hover:bg-slate-50/80 shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 stroke-[2]" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-purple-700 transition-colors">
                Mindmap
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Brainstorming concepts with curved associative connectors
              </p>
              <div className="mt-auto pt-3 flex items-center text-xs font-medium text-slate-400 group-hover:text-purple-600 transition-colors">
                <span>Use Template</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </button>

            {/* 4. Kanban Board */}
            <button
              onClick={() => handleCreateTemplate('kanban', 'Kanban Board')}
              disabled={isCreating}
              className="group flex flex-col text-left p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 bg-white hover:bg-slate-50/80 shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Columns3 className="w-5 h-5 stroke-[2]" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-amber-700 transition-colors">
                Kanban Board
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                To-Do, In Progress & Done columns with sticky notes
              </p>
              <div className="mt-auto pt-3 flex items-center text-xs font-medium text-slate-400 group-hover:text-amber-600 transition-colors">
                <span>Use Template</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </button>

            {/* 5. Sprint Retrospective */}
            <button
              onClick={() => handleCreateTemplate('retrospective', 'Sprint Retrospective')}
              disabled={isCreating}
              className="group flex flex-col text-left p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 bg-white hover:bg-slate-50/80 shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <LayoutGrid className="w-5 h-5 stroke-[2]" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-pink-700 transition-colors">
                Retrospective
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Sprint retro frames for What Went Well & Action Items
              </p>
              <div className="mt-auto pt-3 flex items-center text-xs font-medium text-slate-400 group-hover:text-pink-600 transition-colors">
                <span>Use Template</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </button>
          </div>
        </section>

        {/* Recent Documents Section */}
        <section className="flex-1 flex flex-col">
          {/* Filter Bar & Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                All Documents ({boards.length})
              </button>
              <button
                onClick={() => setFilter('favorites')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filter === 'favorites'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>Favorites</span>
              </button>
            </div>

            <span className="text-xs text-slate-400 font-medium">
              Sorted by recently updated
            </span>
          </div>

          {/* Document Cards Grid */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-20 text-slate-400 text-sm">
              Loading documents...
            </div>
          ) : boards.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <FileText className="w-7 h-7 stroke-[1.5]" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm">
                {search ? 'No matching documents found' : 'No documents yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                {search
                  ? `No documents matched "${search}". Try searching another name or create a new blank page.`
                  : 'Start your creative journey by creating your first blank document.'}
              </p>
              <button
                onClick={handleCreateBlank}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2]" />
                <span>Create Blank Document</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 pt-5">
              {boards.map((b) => {
                const isSelected = b.id === currentBoardId;
                const isRenaming = renamingId === b.id;

                return (
                  <div
                    key={b.id}
                    onClick={() => onOpenBoard(b.id)}
                    className={`group relative bg-white rounded-2xl border transition-all cursor-pointer flex flex-col overflow-hidden hover:shadow-md hover:-translate-y-0.5 ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-100'
                        : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    {/* Visual Card Header / Canvas Thumbnail */}
                    <div className="h-32 bg-slate-100/80 border-b border-slate-100 relative p-3 flex flex-col justify-between overflow-hidden">
                      {/* Subtle canvas dot pattern */}
                      <div
                        className="absolute inset-0 opacity-40 pointer-events-none"
                        style={{
                          backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                          backgroundSize: '16px 16px',
                        }}
                      />

                      {/* Header Top: Favorite Star & Menu Button */}
                      <div className="relative z-10 flex items-center justify-between w-full">
                        <button
                          onClick={(e) => handleToggleFavorite(b.id, b.isFavorite, e)}
                          title={b.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            b.isFavorite
                              ? 'text-amber-500 bg-white/90 shadow-xs'
                              : 'text-slate-400 hover:text-slate-600 hover:bg-white/70'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${b.isFavorite ? 'fill-current' : ''}`} />
                        </button>

                        {/* 3-dots Menu Button */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === b.id ? null : b.id);
                            }}
                            title="Document actions"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/90 transition-colors"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {/* 3-dots Dropdown Menu */}
                          {activeMenuId === b.id && (
                            <div
                              ref={menuRef}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-full mt-1 w-36 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs"
                            >
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  onOpenBoard(b.id);
                                }}
                                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open</span>
                              </button>
                              <button
                                onClick={(e) => handleStartRename(b.id, b.title, e)}
                                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Rename</span>
                              </button>
                              <button
                                onClick={(e) => handleDuplicate(b.id, e)}
                                className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Duplicate</span>
                              </button>
                              <div className="h-px bg-slate-100 my-1" />
                              <button
                                onClick={(e) => handleDelete(b.id, e)}
                                className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Header Center Artwork / Shapes preview */}
                      <div className="relative z-1 flex items-center justify-center gap-2 text-slate-300">
                        <Shapes className="w-8 h-8 stroke-[1.25] text-slate-300/80 group-hover:scale-110 group-hover:text-blue-400/80 transition-all" />
                      </div>

                      {/* Header Bottom: Object count badge */}
                      <div className="relative z-10 flex items-center justify-between text-[11px]">
                        <span className="px-2 py-0.5 rounded-md bg-white/90 text-slate-600 font-medium shadow-2xs">
                          {b.objectCount === 0 ? 'Blank' : `${b.objectCount} items`}
                        </span>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                            Current
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body: Title & Meta */}
                    <div className="p-3.5 flex flex-col gap-1.5">
                      {isRenaming ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            type="text"
                            value={renamingTitle}
                            autoFocus
                            onChange={(e) => setRenamingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitRename(b.id);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            className="flex-1 text-xs font-semibold text-slate-800 bg-white border border-blue-500 rounded px-1.5 py-0.5 outline-none"
                          />
                          <button
                            onClick={() => handleCommitRename(b.id)}
                            className="p-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <h4
                          className="font-bold text-slate-800 text-xs truncate group-hover:text-blue-600 transition-colors"
                          title={b.title}
                        >
                          {b.title}
                        </h4>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelativeTime(b.updatedAt)}</span>
                        </span>
                        <span className="text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                          Open <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

