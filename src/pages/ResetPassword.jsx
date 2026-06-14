import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import EquiPrixLogo from '@/components/equiprix/EquiPrixLogo';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase injects the session from the reset link automatically
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage({ type: 'success', text: '✓ Password updated! Redirecting…' });
      setTimeout(() => navigate('/play'), 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#0f0e0a' }}>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded border flex flex-col items-center text-center"
        style={{ backgroundColor: '#14130e', borderColor: 'rgba(180, 149, 48, 0.2)' }}
      >
        <div className="mb-3">
          <EquiPrixLogo width={160} />
        </div>
        <p className="font-cinzel text-xs tracking-widest mb-8" style={{ color: 'var(--gold-lt)' }}>
          SET NEW PASSWORD
        </p>

        {!ready ? (
          <p className="font-cormorant italic text-base" style={{ color: 'var(--mid)' }}>
            Verifying reset link…
          </p>
        ) : (
          <form onSubmit={handleReset} className="w-full flex flex-col gap-4 text-left">
            <div className="flex flex-col gap-1.5">
              <label className="text-2xs uppercase tracking-wider font-cinzel font-semibold" style={{ color: 'var(--gold-lt)' }}>
                New Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded text-sm focus:outline-none bg-[#1c1a12] border"
                style={{ borderColor: 'rgba(180,149,48,0.15)', color: 'var(--cream)', fontSize: '16px' }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-2xs uppercase tracking-wider font-cinzel font-semibold" style={{ color: 'var(--gold-lt)' }}>
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded text-sm focus:outline-none bg-[#1c1a12] border"
                style={{ borderColor: 'rgba(180,149,48,0.15)', color: 'var(--cream)', fontSize: '16px' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded text-xs uppercase font-cinzel font-bold tracking-widest mt-2"
              style={{
                backgroundColor: loading ? 'rgba(180,149,48,0.1)' : 'var(--gold)',
                color: loading ? 'var(--mid)' : '#0f0e0a'
              }}
            >
              {loading ? 'Updating…' : 'Set Password'}
            </button>
          </form>
        )}

        {message.text && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mt-6 text-sm font-cormorant font-semibold ${message.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}
          >
            {message.text}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}