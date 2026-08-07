import {
  firestore,
  auth,
  googleProvider,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword
} from './firebase';
import { compressImage } from './imageCompressor';

// Fallback local store in case offline or initial setup
const getLocalStore = (table) => {
  try {
    const raw = localStorage.getItem(`fb_store_${table}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

const setLocalStore = (table, items) => {
  try {
    localStorage.setItem(`fb_store_${table}`, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(`fb_local_${table}`, { detail: items }));
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
        const colRef = collection(firestore, tableName);
        const entries = Object.entries(criteria);
        let q;
        if (entries.length > 0) {
          const constraints = entries.map(([k, v]) => where(k, '==', v));
          q = query(colRef, ...constraints);
        } else {
          q = query(colRef);
        }
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (items.length > 0) {
          return items;
        }
      } catch (e) {
        console.warn(`Firestore filter error for ${tableName}:`, e);
      }

      // Fallback local store filtering
      const items = getLocalStore(tableName);
      return items.filter((item) =>
        Object.entries(criteria).every(([k, v]) => item[k] === v)
      );
    },

    get: async (id) => {
      if (!id) return null;
      try {
        const docRef = doc(firestore, tableName, id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
      } catch (e) {
        console.warn(`Firestore get error for ${tableName}/${id}:`, e);
      }

      const items = getLocalStore(tableName);
      return items.find((item) => item.id === id) || null;
    },

    create: async (data) => {
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'id_' + Math.random().toString(36).substring(2, 11);
      const newItem = {
        id,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        ...data,
      };

      try {
        const docRef = doc(firestore, tableName, id);
        await setDoc(docRef, newItem);
        
        // Sync local
        const local = getLocalStore(tableName);
        setLocalStore(tableName, [newItem, ...local.filter(i => i.id !== id)]);
        return newItem;
      } catch (e) {
        console.warn(`Firestore create error for ${tableName}:`, e);
      }

      const local = getLocalStore(tableName);
      const updated = [newItem, ...local.filter(i => i.id !== id)];
      setLocalStore(tableName, updated);
      return newItem;
    },

    update: async (id, patch) => {
      if (!id) return null;
      const updateData = {
        ...patch,
        updated_date: new Date().toISOString()
      };

      try {
        const docRef = doc(firestore, tableName, id);
        await setDoc(docRef, updateData, { merge: true });
        
        const local = getLocalStore(tableName);
        const idx = local.findIndex(i => i.id === id);
        if (idx !== -1) {
          local[idx] = { ...local[idx], ...updateData };
          setLocalStore(tableName, local);
          return local[idx];
        }
        return { id, ...updateData };
      } catch (e) {
        console.warn(`Firestore update error for ${tableName}/${id}:`, e);
      }

      const local = getLocalStore(tableName);
      const idx = local.findIndex((i) => i.id === id);
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...updateData };
        setLocalStore(tableName, local);
        return local[idx];
      }
      return { id, ...updateData };
    },

    delete: async (id) => {
      if (!id) return true;
      try {
        const docRef = doc(firestore, tableName, id);
        await deleteDoc(docRef);
      } catch (e) {
        console.warn(`Firestore delete error for ${tableName}/${id}:`, e);
      }

      const local = getLocalStore(tableName);
      const updated = local.filter((i) => i.id !== id);
      setLocalStore(tableName, updated);
      return true;
    },

    subscribe: (callback) => {
      let unsub = null;
      try {
        const colRef = collection(firestore, tableName);
        unsub = onSnapshot(colRef, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            const data = { id: change.doc.id, ...change.doc.data() };
            callback({ type: change.type, data });
          });
        }, (err) => {
          if (err?.code !== 'unavailable') {
            console.warn(`Firestore subscribe error for ${tableName}:`, err);
          }
        });
      } catch (e) {
        console.warn(`Firestore subscribe setup failed for ${tableName}:`, e);
      }

      const handleLocal = (e) => {
        callback({ type: 'local_update', data: e.detail });
      };
      window.addEventListener(`fb_local_${tableName}`, handleLocal);

      return () => {
        if (unsub) unsub();
        window.removeEventListener(`fb_local_${tableName}`, handleLocal);
      };
    }
  };
};

export const db = {
  auth: {
    me: async () => {
      const user = auth.currentUser;
      if (user) {
        return {
          id: user.uid,
          email: user.email,
          full_name: user.displayName || user.email?.split('@')[0] || 'User',
        };
      }
      // Check stored session
      const stored = localStorage.getItem('fb_user_session');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {}
      }
      return null;
    },

    loginViaEmailPassword: async (email, password) => {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      const userInfo = {
        id: user.uid,
        email: user.email,
        full_name: user.displayName || user.email?.split('@')[0],
      };
      localStorage.setItem('fb_user_session', JSON.stringify(userInfo));
      return userInfo;
    },

    loginWithProvider: async (provider = 'google', returnTo = '/') => {
      try {
        const res = await signInWithPopup(auth, googleProvider);
        if (res?.user) {
          const user = res.user;
          const userInfo = {
            id: user.uid,
            email: user.email,
            full_name: user.displayName || user.email?.split('@')[0],
          };
          localStorage.setItem('fb_user_session', JSON.stringify(userInfo));
          const path = returnTo && returnTo.startsWith('/') ? returnTo : `/${returnTo || ''}`;
          window.location.href = path;
        }
      } catch (err) {
        console.error('Google Sign In error:', err);
        throw err;
      }
    },

    register: async ({ email, password }) => {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const user = cred.user;
      const userInfo = {
        id: user.uid,
        email: user.email,
        full_name: user.displayName || user.email?.split('@')[0],
      };
      localStorage.setItem('fb_user_session', JSON.stringify(userInfo));
      return { user: userInfo, session: true };
    },

    verifyOtp: async () => {
      return { access_token: 'firebase_token' };
    },

    resendOtp: async () => {},

    resetPasswordRequest: async (email) => {
      await sendPasswordResetEmail(auth, email);
    },

    resetPassword: async ({ newPassword }) => {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
      }
    },

    logout: async (redirectUrl) => {
      await signOut(auth);
      localStorage.removeItem('fb_user_session');
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
      return Boolean(auth.currentUser || localStorage.getItem('fb_user_session'));
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
          // Fast client-side image compression to ~100-200KB JPEG
          const compressedDataUrl = await compressImage(file, 1200, 1200, 0.82);
          return { file_url: compressedDataUrl };
        } catch (e) {
          console.warn('Image compression fallback:', e);
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({ file_url: e.target.result });
            reader.readAsDataURL(file);
          });
        }
      }
    }
  }
};

// Expose globally so all components pick up Firebase db
globalThis.__B44_DB__ = db;
