import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import EquiPrixLogo from '@/components/equiprix/EquiPrixLogo';

export default function Splash() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/play';

  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Enter your email address first, then click Forgot Password.' });
      return;
    }
    setResetLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setResetSent(true);
      setMessage({ type: 'success', text: `✓ Reset link sent to ${email.trim()}` });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setResetLoading(false);
    }
  };

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (isSignUpMode) {
        const { error } = await supabase.auth.signUp({
          email,
          password: 'TmpPassword123!',
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
          },
        });
        if (error) throw error;
        setMessage({
          type: 'success',
          text: '✨ Verification dispatched! Check your email inbox to confirm your account.',
        });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data?.session) {
          localStorage.removeItem('ep_code');
          navigate(redirectTo);
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Authentication request rejected.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#0f0e0a' }}>
      <motion.div
        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded border flex flex-col items-center text-center"
        style={{ backgroundColor: '#14130e', borderColor: 'rgba(180, 149, 48, 0.2)' }}
      >
        <div className="mb-3"><EquiPrixLogo width={180} /></div>
        <p className="font-cormorant italic text-base mb-8" style={{ color: 'var(--cream)', opacity: 0.85 }}>
          The world's first fantasy platform for elite show jumping
        </p>

        <form onSubmit={handleAuthAction} className="w-full flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <label className="text-2xs uppercase tracking-wider font-cinzel font-semibold" style={{ color: 'var(--gold-lt)' }}>
              Email Address
            </label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="rider@domain.com"
              className="w-full px-4 py-3 rounded text-sm transition-all focus:outline-none bg-[#1c1a12] border"
              style={{ borderColor: 'rgba(180,149,48,0.15)', color: 'var(--cream)', fontSize: '16px' }} />
          </div>

          {!isSignUpMode && (
            <div className="flex flex-col gap-1.5">
              <label className="text-2xs uppercase tracking-wider font-cinzel font-semibold" style={{ color: 'var(--gold-lt)' }}>
                Password
              </label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded text-sm transition-all focus:outline-none bg-[#1c1a12] border"
                style={{ borderColor: 'rgba(180,149,48,0.15)', color: 'var(--cream)', fontSize: '16px' }} />
            </div>
          )}

          {!isSignUpMode && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="font-cormorant italic text-xs transition-all"
                style={{ color: 'var(--mid)', opacity: 0.7, textDecoration: 'underline' }}>
                {resetLoading ? 'Sending…' : 'Forgot password?'}
              </button>
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded text-xs uppercase font-cinzel font-bold tracking-widest transition-all mt-2 cursor-pointer border border-transparent"
            style={{
              backgroundColor: loading ? 'rgba(180,149,48,0.1)' : 'var(--gold)',
              color: loading ? 'var(--mid)' : '#0f0e0a'
            }}>
            {loading ? 'Processing...' : isSignUpMode ? 'Register Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-2xs uppercase tracking-wider font-cinzel text-gray-500 flex flex-col gap-1">
          <div>{isSignUpMode ? 'Already have an account?' : 'New to the platform?'}</div>
          <div>
            <span
              onClick={() => { setIsSignUpMode(!isSignUpMode); setMessage({ type: '', text: '' }); setEmail(''); setPassword(''); }}
              className="cursor-pointer font-bold hover:underline transition-all"
              style={{ color: 'var(--gold-lt)' }}>
              {isSignUpMode ? 'Sign In' : 'Register Account'}
            </span>
          </div>
        </div>

        <div className="mt-4 text-center">
          <a href="/terms" className="font-cormorant italic text-xs" style={{ color: 'var(--mid)', opacity: 0.6, textDecoration: 'underline' }}>
            Terms &amp; Conditions
          </a>
        </div>

        {message.text && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className={`mt-6 text-sm font-cormorant font-semibold ${message.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {message.text}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}