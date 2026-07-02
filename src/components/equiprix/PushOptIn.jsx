import React, { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import {
  isPushSupported, getPushPermissionState, subscribeToPush,
  unsubscribeFromPush, isSubscribedOnThisDevice,
} from '@/lib/pushNotifications';

// Drop this into AccountModal.jsx (or anywhere reachable by a logged-in
// user) — e.g.:
//   import PushOptIn from './PushOptIn';
//   <PushOptIn userEmail={user?.email} />
//
// Mirrors the EMAIL NOTIFICATIONS row/toggle pattern used elsewhere in
// AccountModal.jsx, so the two sections read as one consistent settings
// list rather than two different UI styles.
export default function PushOptIn({ userEmail }) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState('default');
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) { setSupported(false); return; }
    setPermission(getPushPermissionState());
    isSubscribedOnThisDevice().then(setSubscribed);
  }, []);

  const handleToggle = async () => {
    if (busy || !userEmail) return;
    setBusy(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush(userEmail);
        setSubscribed(false);
      } else {
        const ok = await subscribeToPush(userEmail);
        setSubscribed(ok);
        setPermission(getPushPermissionState());
      }
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(180,149,48,0.1)' }}>
        <BellOff size={14} style={{ color: 'var(--mid)' }} />
        <span className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>
          Push notifications aren't supported here. On iPhone, add EquiPrix to your Home Screen via Safari's Share menu first.
        </span>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
        style={{ background: 'rgba(224,112,112,0.06)', border: '1px solid rgba(224,112,112,0.2)' }}>
        <BellOff size={14} style={{ color: '#e07070' }} />
        <span className="font-cormorant italic text-sm" style={{ color: '#e07070' }}>
          Notifications are blocked. Enable them in your device/browser settings for EquiPrix.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(180,149,48,0.15)' }}>
      <div className="flex items-center gap-2">
        {subscribed
          ? <Bell size={14} style={{ color: 'var(--gold)' }} />
          : <BellOff size={14} style={{ color: 'var(--mid)' }} />}
        <div>
          <div className="font-cormorant text-sm" style={{ color: 'var(--cream)' }}>
            {subscribed ? 'Notifications on' : 'Notifications off'}
            {justSaved && <span className="ml-2" style={{ color: '#4caf7d' }}>✓ Saved</span>}
          </div>
          <div className="font-cormorant italic text-xs" style={{ color: 'var(--mid)' }}>
            {subscribed ? 'You\'ll get alerts on this device' : 'Get alerts for draft openings, results, and lock times'}
          </div>
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={busy}
        className="font-cinzel text-xs px-3 py-1.5 rounded transition-all"
        style={{
          background: subscribed ? 'rgba(224,112,112,0.1)' : 'rgba(76,175,125,0.1)',
          border: `1px solid ${subscribed ? 'rgba(224,112,112,0.3)' : 'rgba(76,175,125,0.3)'}`,
          color: subscribed ? '#e07070' : '#4caf7d',
          fontSize: 9, letterSpacing: '0.08em',
          opacity: busy ? 0.6 : 1,
        }}>
        {busy ? '…' : subscribed ? 'UNSUBSCRIBE' : 'SUBSCRIBE'}
      </button>
    </div>
  );
}