import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { motion } from 'framer-motion';

export default function MagicLogin() {
  const { signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const handleMagicSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      await signInWithMagicLink(email);
      setStatusMsg({
        type: 'success',
        text: '✨ EquiPrix access link dispatched! Check your email inbox.',
      });
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Authentication link generation failed.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <motion.div 
        initial={{ opacity: 0, y: 12 }} 
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-8 rounded-lg border bg-[#14130e]"
        style={{ borderColor: 'rgba(180, 149, 48, 0.2)' }}
      >
        <h2 className="font-cinzel text-xl text-center mb-2 tracking-wide" style={{ color: 'var(--gold)' }}>
          EQUIPRIX ACCESS
        </h2>
        <p className="font-cormorant text-sm text-center mb-6" style={{ color: 'var(--mid)' }}>
          Enter your email to receive an instantaneous, secure passwordless login shortcut.
        </p>

        <form onSubmit={handleMagicSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-wider font-cinzel" style={{ color: 'var(--gold-lt)' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              required
              className="w-full px-4 py-2.5 rounded text-sm bg-[#1c1a12] border focus:outline-none transition-all"
              style={{ 
                borderColor: 'rgba(180, 149, 48, 0.15)', 
                color: 'var(--cream)' 
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded text-xs uppercase font-cinzel font-bold tracking-widest transition-all mt-2 cursor-pointer"
            style={{ 
              backgroundColor: loading ? 'var(--dark)' : 'var(--gold)', 
              color: '#0f0e0a' 
            }}
          >
            {loading ? 'Generating Link...' : 'Request Magic Entry'}
          </button>
        </form>

        {statusMsg.text && (
          <motion.p 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className={`mt-5 text-sm text-center font-cormorant font-semibold ${
              statusMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {statusMsg.text}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
