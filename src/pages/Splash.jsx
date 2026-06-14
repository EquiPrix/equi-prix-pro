import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Splash() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Direct login verification bypassing all email queues
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      if (data?.session) {
        // Successfully logged in! Go straight to the game dashboard
        navigate('/play');
      }
    } catch (err) {
      console.error("Login Error:", err);
      setMessage({
        type: 'error',
        text: err?.message || 'Invalid credentials or connection error.',
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

        <form onSubmit={handlePasswordLogin} className="w-full flex flex-col gap-4 text-left">
          <div className="flex flex-col gap-1.5">
            <label className="text-2xs uppercase tracking-wider font-cinzel font-semibold" style={{ color: 'var(--gold-lt)' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rider@domain.com"
              className="w-full px-4 py-3 rounded text-sm transition-all focus:outline-none bg-[#1c1a12] border"
              style={{ borderColor: 'rgba(180, 149, 48, 0.15)', color: 'var(--cream)' }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-2xs uppercase tracking-wider font-cinzel font-semibold" style={{ color: 'var(--gold-lt)' }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded text-sm transition-all focus:outline-none bg-[#1c1a12] border"
              style={{ borderColor: 'rgba(180, 149, 48, 0.15)', color: 'var(--cream)' }}
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
            {loading ? 'Verifying Account...' : 'Sign In'}
          </button>
        </form>

        {message.text && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-sm font-cormorant font-semibold text-rose-400"
          >
            {message.text}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
