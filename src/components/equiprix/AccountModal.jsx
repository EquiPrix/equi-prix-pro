import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { X, Save, LogOut, Key } from 'lucide-react';

export default function AccountModal({ onClose }) {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load current username from user metadata
    const meta = user?.user_metadata;
    setUsername(meta?.username || meta?.access_code || user?.email?.split('@')[0] || '');
  }, [user]);

  const saveUsername = async () => {
    if (!username.trim()) return;
    setSaving(true);
    setError('');
    try {
      const { error } = await supabase.auth.updateUser({
        data: { username: username.trim() }
      });
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordReset = async () => {
    try {
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      setResetSent(true);
    } catch (e) {
      setError(e.message);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm rounded-xl p-6"
          style={{ background: 'var(--ep-card)', border: '1px solid rgba(180,149,48,0.25)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-cinzel text-sm tracking-widest" style={{ color: 'var(--gold)' }}>MY ACCOUNT</div>
              <div className="font-cormorant italic text-xs mt-0.5" style={{ color: 'var(--mid)' }}>{user?.email}</div>
            </div>
            <button onClick={onClose} style={{ color: 'var(--mid)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Username */}
          <div className="mb-5">
            <label className="font-cinzel text-xs tracking-widest mb-2 block" style={{ color: 'var(--gold-lt)', fontSize: 9 }}>
              DISPLAY NAME
            </label>
            <div className="flex gap-2">
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveUsername()}
                placeholder="Your name on the leaderboard"
                className="flex-1 rounded px-3 py-2 text-sm outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(180,149,48,0.2)',
                  color: 'var(--cream)',
                  fontSize: '16px'
                }}
              />
              <button
                onClick={saveUsername}
                disabled={saving}
                className="px-3 py-2 rounded font-cinzel text-xs flex items-center gap-1.5 transition-all"
                style={{
                  background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)',
                  color: saved ? '#4caf7d' : 'var(--ink)',
                  border: saved ? '1px solid #4caf7d' : 'none',
                  minWidth: 64
                }}
              >
                <Save size={12} />
                {saved ? '✓' : saving ? '…' : 'Save'}
              </button>
            </div>
            <p className="font-cormorant italic text-xs mt-1.5" style={{ color: 'var(--mid)' }}>
              This is how you appear on the leaderboard
            </p>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(42,40,32,0.6)', margin: '20px 0' }} />

          {/* Password reset */}
          <div className="mb-5">
            <label className="font-cinzel text-xs tracking-widest mb-2 block" style={{ color: 'var(--gold-lt)', fontSize: 9 }}>
              PASSWORD
            </label>
            {resetSent ? (
              <p className="font-cormorant italic text-sm" style={{ color: '#4caf7d' }}>
                ✓ Reset link sent to {user?.email}
              </p>
            ) : (
              <button
                onClick={sendPasswordReset}
                className="flex items-center gap-2 font-cinzel text-xs px-3 py-2 rounded transition-all"
                style={{
                  border: '1px solid rgba(180,149,48,0.25)',
                  color: 'var(--gold-lt)',
                  background: 'rgba(180,149,48,0.06)',
                  letterSpacing: '0.06em'
                }}
              >
                <Key size={12} />
                Send Password Reset Email
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="font-cormorant italic text-sm mb-4" style={{ color: '#e07070' }}>{error}</p>
          )}

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(42,40,32,0.6)', margin: '20px 0' }} />

          {/* Sign out */}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded font-cinzel text-xs tracking-widest transition-all"
            style={{
              border: '1px solid rgba(180,149,48,0.15)',
              color: 'var(--mid)',
              background: 'none',
              letterSpacing: '0.08em'
            }}
          >
            <LogOut size={12} />
            SIGN OUT
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}