import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '@/lib/supabaseDb';
import { auth, onAuthStateChanged } from '@/lib/firebase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'firebase', public_settings: {} });

  useEffect(() => {
    checkUserAuth();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const u = {
          id: fbUser.uid,
          email: fbUser.email,
          full_name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
        };
        setUser(u);
        setIsAuthenticated(true);
        localStorage.setItem('fb_user_session', JSON.stringify(u));
      } else {
        const stored = localStorage.getItem('fb_user_session');
        if (stored) {
          try {
            setUser(JSON.parse(stored));
            setIsAuthenticated(true);
          } catch (e) {
            setUser(null);
            setIsAuthenticated(false);
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const checkAppState = async () => {
    setAppPublicSettings({ id: 'firebase', public_settings: {} });
    setIsLoadingPublicSettings(false);
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await db.auth.me();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      console.error('User auth check error:', error);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    await db.auth.logout(shouldRedirect ? window.location.origin + '/login' : null);
  };

  const navigateToLogin = () => {
    db.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
