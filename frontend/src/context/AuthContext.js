import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, supabase, loadProfile, setCurrentUser } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const profile = await loadProfile();
    setCurrentUser(profile);
    setUser(profile);
    return profile;
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) await refresh().catch(() => null);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setCurrentUser(null); setUser(null); }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [refresh]);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      const e = new Error('Email atau password salah');
      e.response = { status: 401, data: { detail: 'Email atau password salah' } };
      throw e;
    }
    const profile = await refresh();
    if (!profile) {
      await supabase.auth.signOut();
      const e = new Error('Akun belum punya profil');
      e.response = { status: 403, data: { detail: 'Akun ini belum terdaftar sebagai pengguna toko. Hubungi admin.' } };
      throw e;
    }
    return profile;
  };

  const logout = () => {
    setCurrentUser(null);
    setUser(null);
    supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, token: user ? 'supabase' : null, login, logout, loading, refreshUser: refresh }}>
      {children}
    </AuthContext.Provider>
  );
};

export { api };
