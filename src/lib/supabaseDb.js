import { supabase } from '@/api/supabaseClient';

// Helper for local storage persistence when Supabase table isn't created yet
const getLocalStore = (table) => {
  try {
    const raw = localStorage.getItem(`supabase_store_${table}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const setLocalStore = (table, items) => {
  try {
    localStorage.setItem(`supabase_store_${table}`, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(`supabase_local_${table}`, { detail: items }));
  } catch (e) {
    console.warn('Local storage write failed:', e);
  }
};

const entityTableMap = {
  Room: 'rooms',
  RoomMember: 'room_members',
  Memory: 'memories',
  MusicState: 'music_states'
};

const createEntityStore = (entityName) => {
  const tableName = entityTableMap[entityName] || entityName.toLowerCase();

  return {
    filter: async (criteria = {}) => {
      try {
        let query = supabase.from(tableName).select('*');
        Object.entries(criteria).forEach(([key, val]) => {
          query = query.eq(key, val);
        });
        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          return data;
        }
      } catch (e) {
        // Table fallback
      }
      
      // Fallback local store filtering
      const items = getLocalStore(tableName);
      return items.filter((item) =>
        Object.entries(criteria).every(([k, v]) => item[k] === v)
      );
    },

    get: async (id) => {
      try {
        const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
        if (!error && data) return data;
      } catch (e) {}

      const items = getLocalStore(tableName);
      return items.find((item) => item.id === id) || null;
    },

    create: async (data) => {
      const newItem = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'id_' + Math.random().toString(36).substring(2, 11),
        created_date: new Date().toISOString(),
        ...data,
      };

      try {
        const { data: inserted, error } = await supabase.from(tableName).insert(newItem).select().single();
        if (!error && inserted) {
          // Sync local
          const local = getLocalStore(tableName);
          setLocalStore(tableName, [inserted, ...local]);
          return inserted;
        }
      } catch (e) {}

      const local = getLocalStore(tableName);
      const updated = [newItem, ...local];
      setLocalStore(tableName, updated);
      return newItem;
    },

    update: async (id, patch) => {
      try {
        const { data: updatedRow, error } = await supabase
          .from(tableName)
          .update(patch)
          .eq('id', id)
          .select()
          .single();
        if (!error && updatedRow) {
          const local = getLocalStore(tableName);
          const idx = local.findIndex(i => i.id === id);
          if (idx !== -1) {
            local[idx] = { ...local[idx], ...updatedRow };
            setLocalStore(tableName, local);
          }
          return updatedRow;
        }
      } catch (e) {}

      const local = getLocalStore(tableName);
      const idx = local.findIndex((i) => i.id === id);
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...patch };
        setLocalStore(tableName, local);
        return local[idx];
      }
      return { id, ...patch };
    },

    delete: async (id) => {
      try {
        await supabase.from(tableName).delete().eq('id', id);
      } catch (e) {}

      const local = getLocalStore(tableName);
      const updated = local.filter((i) => i.id !== id);
      setLocalStore(tableName, updated);
      return true;
    },

    subscribe: (callback) => {
      let channel = null;
      try {
        channel = supabase
          .channel(`public:${tableName}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
            callback({ type: payload.eventType, data: payload.new });
          })
          .subscribe();
      } catch (e) {}

      const handleLocal = (e) => {
        callback({ type: 'local_update', data: e.detail });
      };
      window.addEventListener(`supabase_local_${tableName}`, handleLocal);

      return () => {
        if (channel) supabase.removeChannel(channel);
        window.removeEventListener(`supabase_local_${tableName}`, handleLocal);
      };
    }
  };
};

export const db = {
  auth: {
    me: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        // Check session cached user
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return null;
        const u = session.user;
        return {
          id: u.id,
          email: u.email,
          full_name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0],
        };
      }
      return {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0],
      };
    },

    loginViaEmailPassword: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      return {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0],
      };
    },

    loginWithProvider: async (provider = 'google', returnTo = '/') => {
      const path = returnTo && returnTo.startsWith('/') ? returnTo : `/${returnTo || ''}`;
      const redirectTo = `${window.location.origin}${path === '/' ? '' : path}`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.url) {
        window.location.href = data.url;
      }
    },

    register: async ({ email, password }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw new Error(error.message);
      return data;
    },

    verifyOtp: async ({ email, otpCode }) => {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });
      if (error) throw new Error(error.message);
      return { access_token: data.session?.access_token };
    },

    resendOtp: async (email) => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw new Error(error.message);
    },

    resetPasswordRequest: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
    },

    resetPassword: async ({ newPassword }) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
    },

    logout: async (redirectUrl) => {
      await supabase.auth.signOut();
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    },

    redirectToLogin: (returnTo) => {
      const url = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';
      window.location.href = url;
    },

    setToken: () => {},

    isAuthenticated: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return Boolean(session);
    },
  },

  entities: new Proxy({}, {
    get: (target, entityName) => {
      if (!target[entityName]) {
        target[entityName] = createEntityStore(entityName);
      }
      return target[entityName];
    }
  }),

  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        if (!file) return { file_url: '' };
        try {
          const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '')}`;
          const { data, error } = await supabase.storage.from('memories').upload(fileName, file);
          if (!error && data?.path) {
            const { data: pubData } = supabase.storage.from('memories').getPublicUrl(data.path);
            if (pubData?.publicUrl) return { file_url: pubData.publicUrl };
          }
        } catch (e) {
          console.warn('Supabase storage upload fallback:', e);
        }
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ file_url: e.target.result });
          reader.readAsDataURL(file);
        });
      }
    }
  }
};

// Expose globally so all files with `const db = globalThis.__B44_DB__ || ...` pick up our Supabase client instance!
globalThis.__B44_DB__ = db;
