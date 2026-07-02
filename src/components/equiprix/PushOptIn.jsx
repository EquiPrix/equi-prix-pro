import React, { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import {
  isPushSupported, getPushPermissionState, subscribeToPush,
  unsubscribeFromPush, isSubscribedOnThisDevice,
} from '@/lib/pushNotifications';

// Drop this into AccountModal.jsx (or anywhere reachable by a logged-in
// user) — e.g.:
//   import PushOptIn from './PushOptIn';
//   <PushOptIn userEmail={user?.email} />
export default function PushOptIn({ userEmail }) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState('default');
  const [busy, setBusy] = useState(false);

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
          Push notifications aren't supported in this browser. On iPhone, add EquiPrix to your Home Screen first.
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
          Notifications are blocked. Enable them in your browser/device settings for EquiPrix.
        </span>
      </div>
    );
  }

  return (
    <button onClick={handleToggle} disabled={busy}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
      style={{
        background: subscribed ? 'rgba(76,175,125,0.08)' : 'rgba(180,149,48,0.06)',
        border: `1px solid ${subscribed ? 'rgba(76,175,125,0.25)' : 'rgba(180,149,48,0.2)'}`,
        opacity: busy ? 0.6 : 1,
      }}>
      {subscribed ? <BellRing size={16} style={{ color: '#4caf7d' }} /> : <Bell size={16} style={{ color: 'var(--gold)' }} />}
      <div className="flex-1 text-left">
        <div className="font-cinzel text-xs" style={{ color: subscribed ? '#4caf7d' : 'var(--gold)', fontSize: 10, letterSpacing: '0.08em' }}>
          {subscribed ? 'NOTIFICATIONS ON' : 'ENABLE NOTIFICATIONS'}
        </div>
        <div className="font-cormorant italic text-xs mt-0.5" style={{ color: 'var(--mid)' }}>
          {busy ? 'Working…' : subscribed
            ? 'Tap to turn off on this device'
            : 'Get alerts for draft openings, results, and lock times'}
        </div>
      </div>
    </button>
  );
}