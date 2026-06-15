import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import EquiPrixLogo from '@/components/equiprix/EquiPrixLogo';

// Check if passkeys are supported on this device
function isPasskeySupported() {
  return window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
}

export default function Splash() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/play';

  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);

  useEffect(() => {
    // Check passkey support
    if (isPasskeySupported()) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => setPasskeySupported(available));
    }
    // Check if user has registered a passkey before
    setPasskeyRegistered(!!localStorage.getItem('ep_passkey'));
  }, []);

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
          // Offer to register passkey after successful password login
          if (passkeySupported && !passkeyRegistered) {
            registerPasskey(data.session);
          }
          navigate(redirectTo);
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Authentication request rejected.' });
    } finally {
      setLoading(false);
    }
  };

  const registerPasskey = async (session) => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'webauthn' });
      if (!error && data) {
        localStorage.setItem('ep_passkey', '1');
      }
    } catch (e) {
      // Silently fail — passkey registration is optional
    }
  };

  const signInWithPasskey = async () => {
    setPasskeyLoading(true);
    setMessage({ type: '', text: '' });
    try {
      // Use Supabase's signInWithPasskey
      const { data, error } = await supabase.auth.signInWithPasskey();
      if (error) throw error;
      if (data?.session) {
        localStorage.removeItem('ep_code');
        navigate(redirectTo);
      }
    } catch (err) {
      // Fall back to showing password form with helpful message
      setMessage({
        type: 'error',
        text: err?.message?.includes('not found')
          ? 'No passkey found. Please sign in with your password first.'
          : err?.message || 'Passkey sign in failed.',
      });
    } finally {
      setPasskeyLoading(false);
    }
  };

  const inputStyle = {
    borderColor: 'rgba(180,149,48,0.15)',
    color: 'var(--cream)',
    fontSize: '16px'
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

        {/* Passkey button — only on sign in, only if supported */}
        {!isSignUpMode && passkeySupported && (
          <div className="w-full mb-4">
            <button
              onClick={signInWithPasskey}
              disabled={passkeyLoading}
              className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2 transition-all"
              style={{
                background: 'rgba(180,149,48,0.08)',
                border: '1px solid rgba(180,149,48,0.3)',
                color: 'var(--gold-lt)',
                letterSpacing: '0.1em',
              }}
            >
              {passkeyLoading ? (
                'Verifying…'
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                    <path d="M16 11l1.5 1.5L20 10"/>
                  </svg>
                  SIGN IN WITH FACE ID / PASSKEY
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div style={{ flex: 1, height: 1, background: 'rgba(180,149,48,0.15)' }} />
              <span className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.1em' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(180,149,48,0.15)' }} />
            </div>
          </div>
        )}

        {/* Email/password form */}
        <form onSubmit={handleAuthAction} className="w-full flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <label className="text-2xs uppercase tracking-wider font-cinzel font-semibold" style={{ color: 'var(--gold-lt)' }}>
              Email Address
            </label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="rider@domain.com"
              className="w-full px-4 py-3 rounded text-sm transition-all focus:outline-none bg-[#1c1a12] border"
              style={inputStyle} />
          </div>

          {!isSignUpMode && (
            <div className="flex flex-col gap-1.5">
              <label className="text-2xs uppercase tracking-wider font-cinzel font-semibold" style={{ color: 'var(--gold-lt)' }}>
                Password
              </label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded text-sm transition-all focus:outline-none bg-[#1c1a12] border"
                style={inputStyle} />
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