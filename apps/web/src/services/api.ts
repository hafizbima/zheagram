import { storage, StoredBoard } from './storage';
import { isSupabaseConfigured, supabase } from './supabase';

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

interface BoardRow {
  id: string;
  owner_id: string;
  title: string;
  thumbnail_url?: string | null;
  folder_id?: string | null;
  is_favorite: boolean;
  data: StoredBoard['data'];
  created_at: string;
  updated_at: string;
}

function toStoredBoard(row: BoardRow): StoredBoard {
  return {
    id: row.id,
    title: row.title,
    thumbnailUrl: row.thumbnail_url ?? null,
    folderId: row.folder_id ?? null,
    isFavorite: row.is_favorite,
    data: row.data || { objects: {}, order: [] },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toBoardSummary(board: StoredBoard): BoardSummary {
  return {
    id: board.id,
    title: board.title,
    thumbnailUrl: board.thumbnailUrl || null,
    folderId: board.folderId || null,
    isFavorite: board.isFavorite,
    objectCount: board.data?.order?.length || 0,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
  };
}

function toBoardRow(board: StoredBoard, ownerId: string): BoardRow {
  return {
    id: board.id,
    owner_id: ownerId,
    title: board.title,
    thumbnail_url: board.thumbnailUrl || null,
    folder_id: board.folderId || null,
    is_favorite: board.isFavorite,
    data: board.data,
    created_at: board.createdAt,
    updated_at: board.updatedAt,
  };
}

async function ensureSupabaseUser() {
  if (!supabase) throw new Error('Supabase is not configured');

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (sessionData.session?.user) return sessionData.session.user;

  throw new Error('Authentication required');
}

async function getSupabaseUserProfile(): Promise<UserProfile> {
  const user = await ensureSupabaseUser();
  if (user.is_anonymous) throw new Error('Authentication required');
  const name = user.user_metadata?.name || 'Anonymous User';

  return {
    id: user.id,
    email: user.email || `${user.id.slice(0, 8)}@anonymous.local`,
    name,
    avatarUrl: user.user_metadata?.avatar_url || null,
  };
}

export const api = {
  async signIn(email: string, password: string): Promise<UserProfile> {
    if (!supabase) throw new Error('Supabase is not configured');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw error || new Error('Unable to sign in');
    return getSupabaseUserProfile();
  },

  async signUp(email: string, password: string, name: string): Promise<{ user: UserProfile | null; needsEmailConfirmation: boolean }> {
    if (!supabase) throw new Error('Supabase is not configured');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;

    return {
      user: data.session?.user ? await getSupabaseUserProfile() : null,
      needsEmailConfirmation: !data.session,
    };
  },

  async signOut(): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async demoLogin(): Promise<{ user: UserProfile; token: string }> {
    if (isSupabaseConfigured) {
      const user = await getSupabaseUserProfile();
      const { data } = await supabase!.auth.getSession();
      return { user, token: data.session?.access_token || '' };
    }

    return {
      user: { id: 'usr-demo', email: 'demo@diagrammer.io', name: 'Alex Developer' },
      token: 'mock-token',
    };
  },

  async getMe(): Promise<UserProfile | null> {
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase!.auth.getSession();
        return data.session?.user ? await getSupabaseUserProfile() : null;
      } catch {
        return null;
      }
    }

    return { id: 'usr-demo', email: 'demo@diagrammer.io', name: 'Alex Developer' };
  },

  async listBoards(params?: { favorite?: boolean; search?: string }): Promise<BoardSummary[]> {
    if (isSupabaseConfigured) {
      try {
        await ensureSupabaseUser();
        let query = supabase!
          .from('boards')
          .select('*')
          .order('updated_at', { ascending: false });

        if (params?.favorite) query = query.eq('is_favorite', true);
        if (params?.search) query = query.ilike('title', `%${params.search}%`);

        const { data, error } = await query;
        if (error) throw error;
        return (data as BoardRow[]).map(toStoredBoard).map(toBoardSummary);
      } catch {
        return await storage.listBoards(params);
      }
    }

    return await storage.listBoards(params);
  },

  async createBoard(title: string, template: string = 'blank'): Promise<StoredBoard> {
    const local = await storage.createBoard(title, template);

    if (isSupabaseConfigured) {
      try {
        const user = await ensureSupabaseUser();
        const { data, error } = await supabase!
          .from('boards')
          .insert(toBoardRow(local, user.id))
          .select()
          .single();
        if (error) throw error;

        const remote = toStoredBoard(data as BoardRow);
        await storage.saveBoard(remote.id, remote);
        return remote;
      } catch {
        // Offline/local fallback is already ready.
      }
    }

    return local;
  },

  async getBoard(id: string): Promise<StoredBoard | null> {
    if (isSupabaseConfigured) {
      try {
        await ensureSupabaseUser();
        const { data, error } = await supabase!
          .from('boards')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const remote = toStoredBoard(data as BoardRow);
          await storage.saveBoard(id, remote);
          return remote;
        }
      } catch {
        // Offline/local fallback below.
      }
    }

    return await storage.getBoard(id);
  },

  async saveBoard(
    id: string,
    patch: { title?: string; isFavorite?: boolean; data?: any }
  ): Promise<void> {
    await storage.saveBoard(id, patch);

    if (isSupabaseConfigured) {
      try {
        await ensureSupabaseUser();
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (patch.title !== undefined) update.title = patch.title;
        if (patch.isFavorite !== undefined) update.is_favorite = patch.isFavorite;
        if (patch.data !== undefined) update.data = patch.data;

        const { error } = await supabase!.from('boards').update(update).eq('id', id);
        if (error) throw error;
      } catch {
        // Stored safely locally; it can sync on a later save.
      }
    }
  },

  async duplicateBoard(id: string): Promise<StoredBoard | null> {
    const local = await storage.duplicateBoard(id);
    if (!local) return null;

    if (isSupabaseConfigured) {
      try {
        const user = await ensureSupabaseUser();
        const { data, error } = await supabase!
          .from('boards')
          .insert(toBoardRow(local, user.id))
          .select()
          .single();
        if (error) throw error;

        const remote = toStoredBoard(data as BoardRow);
        await storage.saveBoard(remote.id, remote);
        return remote;
      } catch {
        // Offline/local fallback is already ready.
      }
    }

    return local;
  },

  async renameBoard(id: string, title: string): Promise<StoredBoard | null> {
    await this.saveBoard(id, { title });
    return await storage.getBoard(id);
  },

  async deleteBoard(id: string): Promise<boolean> {
    const localResult = await storage.deleteBoard(id);

    if (isSupabaseConfigured) {
      try {
        await ensureSupabaseUser();
        const { error } = await supabase!.from('boards').delete().eq('id', id);
        if (error) throw error;
      } catch {
        // Offline/local fallback is already complete.
      }
    }

    return localResult;
  },
};

export { storage };
