import { BoardObject, ShapeObject, ConnectorObject } from '@diagrammer/shared';
import { TEMPLATES } from '../stores/templates';
import { BoardSummary } from './api';

export interface StoredBoard {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  folderId?: string | null;
  isFavorite: boolean;
  data: {
    objects: Record<string, BoardObject>;
    order: string[];
  };
  createdAt: string;
  updatedAt: string;
}

const DB_NAME = 'zheagram_db';
const DB_VERSION = 1;
const BOARDS_STORE = 'boards';
const SETTINGS_STORE = 'settings';
const LAST_BOARD_KEY = 'last_active_board_id';
const LOCAL_STORAGE_BACKUP_KEY = 'zheagram_boards_backup';

function createDefaultSeedBoard(): StoredBoard {
  const rect1: ShapeObject = {
    id: 'demo-rect-1',
    type: 'shape',
    kind: 'rounded-rectangle',
    x: 140,
    y: 180,
    width: 180,
    height: 90,
    rotation: 0,
    text: 'User Login',
    style: {
      fill: '#ffffff',
      stroke: '#3b82f6',
      strokeWidth: 2,
      cornerRadius: 10,
      opacity: 1,
      shadow: true,
    },
    textStyle: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      textColor: '#1e293b',
    },
  };

  const diamond1: ShapeObject = {
    id: 'demo-diamond-1',
    type: 'shape',
    kind: 'diamond',
    x: 440,
    y: 165,
    width: 140,
    height: 120,
    rotation: 0,
    text: 'Password Valid?',
    style: {
      fill: '#f0fdf4',
      stroke: '#22c55e',
      strokeWidth: 2,
      opacity: 1,
      shadow: true,
    },
    textStyle: {
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      textColor: '#14532d',
    },
  };

  const rect2: ShapeObject = {
    id: 'demo-rect-2',
    type: 'shape',
    kind: 'rounded-rectangle',
    x: 700,
    y: 180,
    width: 180,
    height: 90,
    rotation: 0,
    text: 'Access Dashboard',
    style: {
      fill: '#ffffff',
      stroke: '#3b82f6',
      strokeWidth: 2,
      cornerRadius: 10,
      opacity: 1,
      shadow: true,
    },
    textStyle: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      textColor: '#1e293b',
    },
  };

  const conn1: ConnectorObject = {
    id: 'demo-conn-1',
    type: 'connector',
    from: { objectId: 'demo-rect-1', anchor: 'right' },
    to: { objectId: 'demo-diamond-1', anchor: 'left' },
    routing: 'orthogonal',
    label: 'Submits',
    style: {
      stroke: '#3b82f6',
      strokeWidth: 2,
      strokeDash: 'solid',
      endArrowhead: 'arrow',
    },
  };

  const conn2: ConnectorObject = {
    id: 'demo-conn-2',
    type: 'connector',
    from: { objectId: 'demo-diamond-1', anchor: 'right' },
    to: { objectId: 'demo-rect-2', anchor: 'left' },
    routing: 'orthogonal',
    label: 'Yes',
    style: {
      stroke: '#22c55e',
      strokeWidth: 2,
      strokeDash: 'solid',
      endArrowhead: 'arrow',
    },
  };

  const now = new Date().toISOString();

  return {
    id: 'board-demo-flowchart',
    title: 'Authentication & Order Flowchart',
    isFavorite: true,
    data: {
      objects: {
        'demo-rect-1': rect1,
        'demo-diamond-1': diamond1,
        'demo-rect-2': rect2,
        'demo-conn-1': conn1,
        'demo-conn-2': conn2,
      },
      order: ['demo-rect-1', 'demo-diamond-1', 'demo-rect-2', 'demo-conn-1', 'demo-conn-2'],
    },
    createdAt: now,
    updatedAt: now,
  };
}

class StorageManager {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryCache: Map<string, StoredBoard> = new Map();
  private isInitialized = false;

  private async openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(BOARDS_STORE)) {
          db.createObjectStore(BOARDS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const db = await this.openDB();
      const boards = await this.getAllFromDB<StoredBoard>(db, BOARDS_STORE);

      if (boards.length === 0) {
        // Seed default initial board
        const seed = createDefaultSeedBoard();
        await this.putToDB(db, BOARDS_STORE, seed);
        this.memoryCache.set(seed.id, seed);
        await this.setLastActiveBoardId(seed.id);
      } else {
        for (const b of boards) {
          this.memoryCache.set(b.id, b);
        }
      }
    } catch {
      // Fallback to localStorage
      this.loadFromLocalStorage();
      if (this.memoryCache.size === 0) {
        const seed = createDefaultSeedBoard();
        this.memoryCache.set(seed.id, seed);
        this.saveToLocalStorage();
        try {
          localStorage.setItem(LAST_BOARD_KEY, seed.id);
        } catch {
          // ignore
        }
      }
    }

    this.isInitialized = true;
  }

  private loadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
      if (raw) {
        const list: StoredBoard[] = JSON.parse(raw);
        for (const b of list) {
          this.memoryCache.set(b.id, b);
        }
      }
    } catch {
      // ignore
    }
  }

  private saveToLocalStorage(): void {
    try {
      const list = Array.from(this.memoryCache.values());
      localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  private async getAllFromDB<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  private async getFromDB<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  private async putToDB<T>(db: IDBDatabase, storeName: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async deleteFromDB(db: IDBDatabase, storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getBoard(id: string): Promise<StoredBoard | null> {
    await this.init();
    if (this.memoryCache.has(id)) {
      return this.memoryCache.get(id)!;
    }

    try {
      const db = await this.openDB();
      const board = await this.getFromDB<StoredBoard>(db, BOARDS_STORE, id);
      if (board) {
        this.memoryCache.set(id, board);
        return board;
      }
    } catch {
      // fallback
    }

    return null;
  }

  public async saveBoard(
    id: string,
    patch: Partial<StoredBoard> & { title?: string; isFavorite?: boolean; data?: any }
  ): Promise<StoredBoard> {
    await this.init();
    const existing = await this.getBoard(id);

    const now = new Date().toISOString();
    const updated: StoredBoard = existing
      ? {
          ...existing,
          ...patch,
          data: patch.data ? patch.data : existing.data,
          title: patch.title !== undefined ? patch.title : existing.title,
          isFavorite: patch.isFavorite !== undefined ? patch.isFavorite : existing.isFavorite,
          updatedAt: now,
        }
      : {
          id,
          title: patch.title || 'Untitled Board',
          isFavorite: patch.isFavorite ?? false,
          data: patch.data || { objects: {}, order: [] },
          createdAt: now,
          updatedAt: now,
        };

    this.memoryCache.set(id, updated);
    this.saveToLocalStorage();

    try {
      const db = await this.openDB();
      await this.putToDB(db, BOARDS_STORE, updated);
    } catch {
      // ignore
    }

    return updated;
  }

  public async listBoards(filter?: { favorite?: boolean; search?: string }): Promise<BoardSummary[]> {
    await this.init();
    let boards = Array.from(this.memoryCache.values());

    if (filter?.favorite) {
      boards = boards.filter((b) => b.isFavorite);
    }
    if (filter?.search) {
      const query = filter.search.toLowerCase();
      boards = boards.filter((b) => b.title.toLowerCase().includes(query));
    }

    // Sort by updatedAt descending
    boards.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return boards.map((b) => ({
      id: b.id,
      title: b.title,
      thumbnailUrl: b.thumbnailUrl || null,
      folderId: b.folderId || null,
      isFavorite: b.isFavorite,
      objectCount: b.data?.order?.length || 0,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));
  }

  public async createBoard(title: string, template: string = 'blank'): Promise<StoredBoard> {
    await this.init();
    const id = `board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    let initialData = { objects: {} as Record<string, BoardObject>, order: [] as string[] };
    if (template === 'flowchart') {
      initialData = createDefaultSeedBoard().data;
    } else if (template && TEMPLATES[template]) {
      const arr = TEMPLATES[template].generate(100, 100);
      const objMap: Record<string, BoardObject> = {};
      const order: string[] = [];
      for (const obj of arr) {
        objMap[obj.id] = obj;
        order.push(obj.id);
      }
      initialData = { objects: objMap, order };
    }

    const newBoard: StoredBoard = {
      id,
      title: title || (template === 'blank' ? 'Untitled Document' : 'New Board'),
      isFavorite: false,
      data: initialData,
      createdAt: now,
      updatedAt: now,
    };

    this.memoryCache.set(id, newBoard);
    this.saveToLocalStorage();

    try {
      const db = await this.openDB();
      await this.putToDB(db, BOARDS_STORE, newBoard);
    } catch {
      // ignore
    }

    await this.setLastActiveBoardId(id);
    return newBoard;
  }

  public async renameBoard(id: string, newTitle: string): Promise<StoredBoard | null> {
    return this.saveBoard(id, { title: newTitle.trim() || 'Untitled Document' });
  }

  public async deleteBoard(id: string): Promise<boolean> {
    await this.init();
    this.memoryCache.delete(id);
    this.saveToLocalStorage();

    try {
      const db = await this.openDB();
      await this.deleteFromDB(db, BOARDS_STORE, id);
    } catch {
      // ignore
    }

    // If active board was deleted, select first available
    const lastId = await this.getLastActiveBoardId();
    if (lastId === id) {
      const remaining = Array.from(this.memoryCache.keys());
      if (remaining.length > 0) {
        await this.setLastActiveBoardId(remaining[0]);
      }
    }

    return true;
  }

  public async duplicateBoard(id: string): Promise<StoredBoard | null> {
    await this.init();
    const source = await this.getBoard(id);
    if (!source) return null;

    const newId = `board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    // Deep clone data
    const clonedData = JSON.parse(JSON.stringify(source.data));

    const duplicate: StoredBoard = {
      id: newId,
      title: `${source.title} (Copy)`,
      isFavorite: false,
      data: clonedData,
      createdAt: now,
      updatedAt: now,
    };

    this.memoryCache.set(newId, duplicate);
    this.saveToLocalStorage();

    try {
      const db = await this.openDB();
      await this.putToDB(db, BOARDS_STORE, duplicate);
    } catch {
      // ignore
    }

    return duplicate;
  }

  public async getLastActiveBoardId(): Promise<string> {
    await this.init();

    try {
      const db = await this.openDB();
      const res = await this.getFromDB<{ key: string; value: string }>(db, SETTINGS_STORE, LAST_BOARD_KEY);
      if (res?.value && this.memoryCache.has(res.value)) {
        return res.value;
      }
    } catch {
      // ignore
    }

    try {
      const local = localStorage.getItem(LAST_BOARD_KEY);
      if (local && this.memoryCache.has(local)) {
        return local;
      }
    } catch {
      // ignore
    }

    // Default to first board or default seed
    const firstKey = this.memoryCache.keys().next().value;
    return firstKey || 'board-demo-flowchart';
  }

  public async setLastActiveBoardId(id: string): Promise<void> {
    try {
      localStorage.setItem(LAST_BOARD_KEY, id);
    } catch {
      // ignore
    }

    try {
      const db = await this.openDB();
      await this.putToDB(db, SETTINGS_STORE, { key: LAST_BOARD_KEY, value: id });
    } catch {
      // ignore
    }
  }
}

export const storage = new StorageManager();
