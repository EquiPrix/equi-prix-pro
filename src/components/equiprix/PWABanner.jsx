import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Smartphone } from 'lucide-react';

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

function isMobile() {
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
}

export default function PWABanner({ eventId }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return; // Already installed
    if (!isMobile()) return; // Desktop skip
    if (!eventId) return;

    // Check if banner was dismissed for this event
    const key = 'ep_pwa_banner_' + eventId;
    if (localStorage.getItem(key)) return;

    // Show after short delay
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, [eventId]);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('ep_pwa_banner_' + eventId, '1');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="flex items-center gap-3 px-4 py-2.5"
          style={{
            background: 'rgba(180,149,48,0.1)',
            borderBottom: '1px solid rgba(180,149,48,0.2)',
            position: 'relative',
            zIndex: 40,
          }}
        >
          <Smartphone size={14} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <p className="flex-1 font-cormorant text-sm" style={{ color: 'var(--gold-lt)' }}>
            Add EquiPrix to your home screen for the best experience
          </p>
          <button
            onClick={dismiss}
            className="font-cinzel text-xs px-2 py-1 rounded flex-shrink-0"
            style={{ background: 'var(--gold)', color: 'var(--ink)', fontSize: 8, letterSpacing: '0.1em' }}
          >
            HOW?
          </button>
          <button onClick={dismiss} style={{ color: 'var(--mid)', flexShrink: 0 }}>
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}