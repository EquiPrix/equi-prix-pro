import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { motion } from 'framer-motion';

export default function Splash() {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleMagicLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Calls our new passwordless helper from AuthContext
      await signInWithMagicLink(email);
      setMessage({
        type: 'success',
        text: '✨ Access link dispatched! Open your email inbox to sign in.',
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to request login link.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center px-4" 
      style={{ background: '#0f0e0a' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 rounded border flex flex-col items-center text-center"
        style={{ 
          backgroundColor: '#14130e', 
          borderColor: 'rgba(180, 149, 48, 0.2)' 
        }}
      >
        {/* App Logo Identity */}
        <h1 
          className="font-cinzel text-3xl tracking-widest mb-1" 
          style={{ color: 'var(--gold)', letterSpacing: '0.25em' }}
        >
          EQUIPRIX
        </h1>
        <p 
          className="font-cormorant text-xs uppercase tracking-widest mb-8" 
          style={{ color: 'var(--gold-lt)' }}
        >
          Elite Show Jumping Fantasy
        </p>

        {/* Passwordless Entry Form */}
        <form onSubmit={handleMagicLogin} className="w-full flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <label 
              className="text-2xs uppercase tracking-wider font-cinzel font-semibold" 
              style={{ color: 'var(--gold-lt)' }}
            >
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rider@domain.com"
              className="w-full px-4 py-3 rounded text-sm transition-all focus:outline-none bg-[#1c1a12] border"
              style={{ 
                borderColor: 'rgba(180, 149, 48, 0.15)', 
                color: 'var(--cream)' 
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded text-xs uppercase font-cinzel font-bold tracking-widest transition-all mt-2 cursor-pointer border border-transparent"
            style={{ 
              backgroundColor: loading ? 'rgba(180, 149, 48, 0.1)' : 'var(--gold)', 
              color: loading ? 'var(--mid)' : '#0f0e0a'
            }}
          >
            {loading ? 'Requesting Entry...' : 'Send Magic Link'}
          </button>
        </form>

        {/* Dynamic Status Notifications */}
        {message.text && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mt-6 text-sm font-cormorant font-semibold ${
              message.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {message.text}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
