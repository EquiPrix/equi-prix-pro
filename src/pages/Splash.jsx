import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { sbFetch } from '@/lib/equiprix-data';

export default function Splash() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSaving(true);
    await sbFetch('interest_emails', {
      method: 'POST',
      body: JSON.stringify({ email, created_at: new Date().toISOString() })
    });
    setSaving(false);
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-4"
      style={{ background: '#0a0907' }}
    >
      {/* Coming soon line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="flex items-center gap-3 mb-8"
      >
        <div style={{ width: 60, height: 1, background: 'linear-gradient(to right, transparent, var(--gold))' }} />
        <span className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)', letterSpacing: '0.25em', fontSize: 10 }}>
          ◆ COMING SOON ◆
        </span>
        <div style={{ width: 60, height: 1, background: 'linear-gradient(to left, transparent, var(--gold))' }} />
      </motion.div>

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mb-3 text-center"
      >
        <img
          src="https://media.base44.com/images/public/6a2b0536fbfbf4f70f04b020/6724260c5_FinalLogo.png"
          alt="EquiPrix"
          style={{ width: 320, maxWidth: '85vw', height: 'auto' }}
        />
      </motion.div>

      {/* Tagline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="font-cinzel text-xs tracking-widest mb-12 text-center"
        style={{ color: 'rgba(245,237,214,0.5)', letterSpacing: '0.22em', fontSize: 11 }}
      >
        ELITE SHOW JUMPING FANTASY
      </motion.div>

      {/* Email form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        className="w-full max-w-sm text-center"
      >
        <div className="font-cinzel text-xs tracking-widest mb-4" style={{ color: 'var(--mid)', letterSpacing: '0.2em', fontSize: 10 }}>
          REGISTER YOUR INTEREST
        </div>

        {submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="font-cormorant text-lg italic"
            style={{ color: 'var(--gold-lt)' }}
          >
            Thank you — we'll be in touch ✦
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="flex rounded overflow-hidden" style={{ border: '1px solid rgba(180,149,48,0.35)' }}>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 text-sm outline-none bg-transparent"
              style={{ color: 'var(--ep-text)', fontFamily: "'Cormorant Garamond', serif" }}
            />
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-3 font-cinzel text-xs tracking-widest transition-all"
              style={{
                background: 'rgba(180,149,48,0.15)',
                color: 'var(--gold)',
                borderLeft: '1px solid rgba(180,149,48,0.35)',
                letterSpacing: '0.14em',
                fontSize: 10,
              }}
            >
              {saving ? '…' : 'NOTIFY ME'}
            </button>
          </form>
        )}
      </motion.div>

      {/* Already have access link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-12"
      >
        <button
          onClick={() => navigate('/play')}
          className="font-cinzel text-xs tracking-widest underline transition-all"
          style={{ color: 'rgba(180,149,48,0.4)', letterSpacing: '0.12em', fontSize: 9 }}
        >
          Have an access code? Enter here →
        </button>
      </motion.div>
    </div>
  );
}