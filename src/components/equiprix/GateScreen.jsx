import React, { useState } from 'react';
import { useEquiPrix } from '@/lib/EquiPrixContext';
import { motion } from 'framer-motion';
import EquiPrixLogo from './EquiPrixLogo';

export default function GateScreen() {
  const { login } = useEquiPrix();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const success = login(code);
    if (!success) {
      setError('Code not recognised — check your invite');
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-50 px-4"
      style={{ background: 'var(--ink)' }}>
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-10 flex justify-center"
      >
        <EquiPrixLogo width={200} />
      </motion.div>

      {/* Gate box */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="w-full max-w-sm rounded-xl p-6 text-center"
        style={{
          background: 'var(--ep-card)',
          border: '1px solid rgba(180,149,48,0.25)'
        }}
      >
        <div className="font-cormorant text-lg italic mb-6" style={{ color: 'rgba(242,237,226,0.5)', lineHeight: 1.5 }}>
          The world's first fantasy platform<br />for elite show jumping
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-left text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--mid)' }}>
            Enter your access code
          </label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="· · · · · · · ·"
            className={`w-full rounded mb-3 text-center text-xl tracking-widest outline-none transition-all ${shake ? 'animate-[shake_0.3s_ease]' : ''}`}
            style={{
              background: 'rgba(180,149,48,0.06)',
              border: `1px solid ${error ? 'var(--crimson)' : 'rgba(180,149,48,0.25)'}`,
              padding: '12px 16px',
              fontFamily: "'Cinzel', serif",
              color: 'var(--cream)',
              letterSpacing: '0.3em',
            }}
            onFocus={() => setError('')}
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
          />

          <button
            type="submit"
            className="w-full py-3 rounded font-cinzel text-xs tracking-widest transition-all active:opacity-80"
            style={{
              background: 'var(--gold)',
              color: 'var(--ink)',
              letterSpacing: '0.16em',
            }}
          >
            Enter Beta →
          </button>

          {error && (
            <p className="mt-3 text-xs font-cormorant italic" style={{ color: 'var(--crimson)' }}>
              {error}
            </p>
          )}
        </form>
      </motion.div>

      {/* Beta badge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-6 font-cinzel text-xs tracking-widest px-3 py-1 rounded-full"
        style={{
          background: 'rgba(180,149,48,0.1)',
          color: 'var(--gold)',
          border: '1px solid rgba(180,149,48,0.2)',
          letterSpacing: '0.18em',
        }}
      >
        BETA
      </motion.div>
    </div>
  );
}