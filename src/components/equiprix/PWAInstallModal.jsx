import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share, Plus, Home } from 'lucide-react';

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

export default function PWAInstallModal({ onClose }) {
  const ios = isIOS();
  const android = isAndroid();
  const mobile = ios || android;

  if (!mobile) return null; // Desktop doesn't need this

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ background: 'rgba(0,0,0,0.75)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ background: '#14130e', border: '1px solid rgba(180,149,48,0.3)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <div className="font-cinzel text-sm tracking-widest" style={{ color: 'var(--gold)' }}>
                WELCOME TO EQUIPRIX
              </div>
              <div className="font-cormorant italic text-xs mt-0.5" style={{ color: 'var(--mid)' }}>
                Get the best experience on your phone
              </div>
            </div>
            <button onClick={onClose} style={{ color: 'var(--mid)' }}>
              <X size={16} />
            </button>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid rgba(180,149,48,0.1)', margin: '0 20px' }} />

          {/* Instructions */}
          <div className="px-5 py-4">
            <p className="font-cormorant text-base mb-4" style={{ color: 'var(--cream)' }}>
              Add EquiPrix to your home screen for the full app experience — faster loading, fullscreen display, and instant access.
            </p>

            {ios && (
              <div className="space-y-3">
                <Step number={1} icon={<Share size={15} style={{ color: 'var(--gold)' }} />}>
                  Tap the <strong style={{ color: 'var(--gold-lt)' }}>Share</strong> button at the bottom of Safari
                </Step>
                <Step number={2} icon={<Plus size={15} style={{ color: 'var(--gold)' }} />}>
                  Scroll down and tap <strong style={{ color: 'var(--gold-lt)' }}>Add to Home Screen</strong>
                </Step>
                <Step number={3} icon={<Home size={15} style={{ color: 'var(--gold)' }} />}>
                  Tap <strong style={{ color: 'var(--gold-lt)' }}>Add</strong> — EquiPrix will appear on your home screen
                </Step>
              </div>
            )}

            {android && (
              <div className="space-y-3">
                <Step number={1} icon={<Share size={15} style={{ color: 'var(--gold)' }} />}>
                  Tap the <strong style={{ color: 'var(--gold-lt)' }}>⋮ menu</strong> in the top right of Chrome
                </Step>
                <Step number={2} icon={<Plus size={15} style={{ color: 'var(--gold)' }} />}>
                  Tap <strong style={{ color: 'var(--gold-lt)' }}>Add to Home Screen</strong>
                </Step>
                <Step number={3} icon={<Home size={15} style={{ color: 'var(--gold)' }} />}>
                  Tap <strong style={{ color: 'var(--gold-lt)' }}>Add</strong> to confirm
                </Step>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-2 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded font-cinzel text-xs tracking-widest"
              style={{ background: 'var(--gold)', color: 'var(--ink)', letterSpacing: '0.1em' }}
            >
              GOT IT
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 rounded font-cinzel text-xs tracking-widest"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,149,48,0.15)', color: 'var(--mid)', letterSpacing: '0.08em' }}
            >
              LATER
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Step({ number, icon, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: 'rgba(180,149,48,0.12)', border: '1px solid rgba(180,149,48,0.25)' }}>
        <span className="font-cinzel text-xs font-bold" style={{ color: 'var(--gold)', fontSize: 9 }}>{number}</span>
      </div>
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-cormorant text-sm" style={{ color: 'var(--mid)' }}>{children}</span>
      </div>
    </div>
  );
}

// Hook to manage PWA install modal state
export function usePWAInstallModal() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (isInStandaloneMode()) return;
    // Don't show on desktop
    if (!isIOS() && !isAndroid()) return;
    // Don't show if already dismissed
    if (localStorage.getItem('ep_pwa_prompted')) return;

    // Show after a short delay on first login
    const timer = setTimeout(() => {
      setShowModal(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setShowModal(false);
    localStorage.setItem('ep_pwa_prompted', '1');
  };

  return { showModal, dismiss };
}