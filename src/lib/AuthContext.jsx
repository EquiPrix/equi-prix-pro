import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch current active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentSession(session);
      setCurrentUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    // 2. Listen for authentication state updates
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentSession(session);
      setCurrentUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    // 3. Clean up auth subscription observer safely
    return () => {
      if (data?.subscription) {
        data.subscription.unsubscribe();
      }
    };
  }, []);

  // 4. Passwordless Magic Link Login Function
  const signInWithMagicLink = async (userEmail) => {
    const { data: authData, error: authError } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (authError) throw authError;
    return authData;
  };

  const signUp = async ({ email, password, fullName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user: currentUser,
        session: currentSession,
        loading: isAuthLoading,
        signUp,
        signIn,
        signInWithMagicLink,
        signInWithGoogle,
        signOut,
        resetPassword,
        updatePassword,
        isAuthenticated: !!currentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;
