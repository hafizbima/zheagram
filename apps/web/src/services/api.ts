import { storage, StoredBoard } from './storage';

const API_BASE = 'http://localhost:3001/api';

export interface BoardSummary {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  folderId?: string | null;
  isFavorite: boolean;
  objectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export const api = {
  // Auth
  async demoLogin(): Promise<{ user: UserProfile; token: string }> {
    try {
      const res = await fetch(`${API_BASE}/auth/demo`, { method: 'POST' });
      if (!res.ok) throw new Error('Demo login failed');
      const data = await res.json();
      localStorage.setItem('diagrammer_token', data.token);
      return data;
    } catch {
      // Offline fallback
      return {
        user: { id: 'usr-demo', email: 'demo@diagrammer.io', name: 'Alex Developer' },
        token: 'mock-token',
      };
    }
  },

  async getMe(): Promise<UserProfile | null> {
    const token = localStorage.getItem('diagrammer_token');
    if (!token) {
      return { id: 'usr-demo', email: 'demo@diagrammer.io', name: 'Alex Developer' };
    }
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Unauthorized');
      return await res.json();
    } catch {
      return { id: 'usr-demo', email: 'demo@diagrammer.io', name: 'Alex Developer' };
    }
  },

  // Boards
  async listBoards(params?: { favorite?: boolean; search?: string }): Promise<BoardSummary[]> {
    try {
      const query = new URLSearchParams();
      if (params?.favorite) query.set('favorite', 'true');
      if (params?.search) query.set('search', params.search);

      const res = await fetch(`${API_BASE}/boards?${query.toString()}`, {
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) throw new Error('Failed to fetch from server');
      const remoteBoards = await res.json();
      return remoteBoards;
    } catch {
      // Offline-first storage
      return await storage.listBoards(params);
    }
  },

  async createBoard(title: string, template: string = 'blank'): Promise<StoredBoard> {
    const local = await storage.createBoard(title, template);

    try {
      const res = await fetch(`${API_BASE}/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: local.id, title, template }),
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const remote = await res.json();
        return remote;
      }
    } catch {
      // offline fallback is ready
    }

    return local;
  },

  async getBoard(id: string): Promise<StoredBoard | null> {
    try {
      const res = await fetch(`${API_BASE}/boards/${id}`, {
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) {
        const remote = await res.json();
        // sync to local storage
        await storage.saveBoard(id, remote);
        return remote;
      }
    } catch {
      // offline fallback
    }

    return await storage.getBoard(id);
  },

  async saveBoard(
    id: string,
    patch: { title?: string; isFavorite?: boolean; data?: any }
  ): Promise<void> {
    // 1. Immediately persist to offline storage
    await storage.saveBoard(id, patch);

    // 2. Optimistically attempt server sync if connected
    try {
      await fetch(`${API_BASE}/boards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Stored safely locally
    }
  },

  async duplicateBoard(id: string): Promise<StoredBoard | null> {
    const local = await storage.duplicateBoard(id);

    try {
      const res = await fetch(`${API_BASE}/boards/${id}/duplicate`, {
        method: 'POST',
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) return await res.json();
    } catch {
      // offline fallback
    }

    return local;
  },

  async renameBoard(id: string, title: string): Promise<StoredBoard | null> {
    await this.saveBoard(id, { title });
    return await storage.getBoard(id);
  },

  async deleteBoard(id: string): Promise<boolean> {
    const localRes = await storage.deleteBoard(id);

    try {
      const res = await fetch(`${API_BASE}/boards/${id}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) return true;
    } catch {
      // offline fallback
    }

    return localRes;
  },
};
export { storage };
