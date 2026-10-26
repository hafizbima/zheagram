import React, { useState, useEffect } from 'react';
import { api, BoardSummary, UserProfile } from '../../services/api';
import {
  Search,
  Star,
  Plus,
  MoreVertical,
  Copy,
  Trash2,
  X,
  LayoutGrid,
  Shapes,
  Sparkles,
  LogIn,
  Check,
} from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';

interface DashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBoard: (boardId: string) => void;
}

export const DashboardModal: React.FC<DashboardModalProps> = ({
  isOpen,
  onClose,
  onSelectBoard,
}) => {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [search, setSearch] = useState('');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const loadData = async () => {
    const list = await api.listBoards({
      favorite: filter === 'favorites' ? true : undefined,
      search: search || undefined,
    });
    setBoards(list);

    const currentUser = await api.getMe();
    setUser(currentUser);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, filter, search]);

  const handleCreate = async (template: string) => {
    const title =
        template === 'flowchart'
          ? 'Flowchart Process'
        : template === 'brainstorm'
        ? 'Brainstorming Session'
        : 'Untitled Diagram';

    const newBoard = await api.createBoard(title, template);
    setShowTemplateMenu(false);
    onSelectBoard(newBoard.id);
    onClose();
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
    if (confirm('Are you sure you want to delete this board?')) {
      await api.deleteBoard(id);
      setActiveMenuId(null);
      loadData();
    }
  };

  const handleDemoLogin = async () => {
    const res = await api.demoLogin();
    setUser(res.user);
    loadData();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-4xl h-[640px] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-sm">
              <Shapes className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Diagrammer Boards</h2>
              <p className="text-xs text-slate-500">Collaborative infinite canvas workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-xl">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {user.name.charAt(0)}
                  </div>
                )}
                <span className="text-xs font-medium text-slate-700">{user.name}</span>
              </div>
            ) : (
              <button
                onClick={handleDemoLogin}
                className="flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" /> Demo Login
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filter */}
        <div className="px-6 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'all' ? 'bg-white shadow-xs text-slate-800' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Boards ({boards.length})
            </button>
            <button
              onClick={() => setFilter('favorites')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === 'favorites' ? 'bg-white shadow-xs text-amber-600' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> Favorites
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search diagrams..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200/80 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500"
            />
          </div>

          {/* New Board Button */}
          <div className="relative">
            <button
              onClick={() => setShowTemplateMenu(!showTemplateMenu)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3.5 py-1.5 rounded-xl shadow-sm hover:shadow transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Board</span>
            </button>

            {showTemplateMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
                <button
                  onClick={() => handleCreate('blank')}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-slate-400" /> Blank Canvas
                </button>
                <button
                  onClick={() => handleCreate('flowchart')}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <Shapes className="w-3.5 h-3.5 text-blue-500" /> Flowchart Template
                </button>
                <button
                  onClick={() => handleCreate('brainstorm')}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Brainstorming Sticky
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Board Cards Grid */}
        <div className="flex-1 p-6 overflow-y-auto">
          {boards.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
              <Shapes className="w-12 h-12 stroke-[1.25] text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">No boards found</p>
              <p className="text-xs text-slate-400 mt-1">Create your first diagram using the button above</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {boards.map((board) => (
                <div
                  key={board.id}
                  onClick={() => {
                    onSelectBoard(board.id);
                    onClose();
                  }}
                  className="group relative bg-white border border-slate-200/80 hover:border-blue-400 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col gap-3"
                >
                  {/* Thumbnail Mockup */}
                  <div className="w-full h-28 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center relative overflow-hidden group-hover:bg-blue-50/30 transition-colors">
                    <Shapes className="w-8 h-8 text-slate-300 group-hover:text-blue-400 transition-colors" />

                    {/* Favorite Star */}
                    <button
                      onClick={(e) => handleToggleFavorite(board.id, board.isFavorite, e)}
                      className="absolute top-2 right-2 p-1 rounded-lg bg-white/80 hover:bg-white shadow-xs text-slate-400 hover:text-amber-500 transition-colors"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          board.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                        }`}
                      />
                    </button>
                  </div>

                  {/* Title & Metadata */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                        {board.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {board.objectCount} {board.objectCount === 1 ? 'object' : 'objects'}
                      </p>
                    </div>

                    {/* Menu button */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === board.id ? null : board.id);
                        }}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {activeMenuId === board.id && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl shadow-xl p-1 z-50 text-[11px]">
                          <button
                            onClick={(e) => handleDuplicate(board.id, e)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 text-slate-700"
                          >
                            <Copy className="w-3 h-3" /> Duplicate
                          </button>
                          <button
                            onClick={(e) => handleDelete(board.id, e)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1.5 text-red-600"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
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
