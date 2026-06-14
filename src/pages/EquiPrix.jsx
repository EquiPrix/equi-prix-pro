import React, { useState, useEffect } from 'react';
import { useEquiPrix } from '@/lib/EquiPrixContext';
import GateScreen from '@/components/equiprix/GateScreen';
import BottomNav from '@/components/equiprix/BottomNav';
import EventsTab from '@/components/equiprix/EventsTab';
import DraftTab from '@/components/equiprix/DraftTab';
import ResultsTab from '@/components/equiprix/ResultsTab';
import LeaderboardTab from '@/components/equiprix/LeaderboardTab';
import AccountModal from '@/components/equiprix/AccountModal';
import { motion, AnimatePresence } from 'framer-motion';
import EquiPrixLogo from '@/components/equiprix/EquiPrixLogo';
import { useAuth } from '../lib/AuthContext';


function useCountdown(targetISO) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!targetISO) return;

    const tick = () => {
      const diff = new Date(targetISO) - new Date();
      if (diff <= 0) {
        setTimeLeft('LOCKED');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 48) {
        const days = Math.floor(h / 24);
        setTimeLeft(`${days}d ${h % 24}h`);
      } else if (h > 0) {
        setTimeLeft(`${h}h ${String(m).padStart(2, '0')}m`);
      } else {
        setTimeLeft(`${m}m ${String(s).padStart(2, '0')}s`);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetISO]);

  return timeLeft;
}

function CountdownBadge({ event }) {
  const now = new Date();
  const teamLocked = event?.teamLockISO && now >= new Date(event.teamLockISO);
  const gpLocked = event?.gpLockISO && now >= new Date(event.gpLockISO);

  const showTeamCountdown = event?.status === 'teams' && !teamLocked;
  const showGPCountdown = (event?.status === 'riders' || (event?.status === 'teams' && teamLocked)) && !gpLocked;

  const targetISO = showTeamCountdown ? event.teamLockISO : showGPCountdown ? event.gpLockISO : null;
  const label = showTeamCountdown ? 'TEAM LOCK' : showGPCountdown ? 'GP LOCK' : null;
  const color = showTeamCountdown ? '#c9a84c' : '#b49530';

  const timeLeft = useCountdown(targetISO);

  if (!label || !timeLeft) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded"
      style={{ background: 'rgba(180,149,48,0.08)', border: `1px solid rgba(180,149,48,0.25)` }}>
      <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 8, letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div className="font-cinzel text-xs font-bold" style={{ color, fontSize: 11, letterSpacing: '0.05em' }}>
        {timeLeft}
      </div>
    </div>
  );
}

export default function EquiPrix() {
  const { user } = useAuth();
  const { userCode, userName, currentEvent, selectEvent, toast, logout, isLoading, loadSavedPicks } = useEquiPrix();
  const [activeTab, setActiveTab] = useState('events');
  const [showAccount, setShowAccount] = useState(false);

  const activeUserIdentity = user?.email || userCode;

  // Resolve display name: prefer Supabase metadata username, fall back to equiprix userName
  const displayName = user?.user_metadata?.username || userName || user?.email?.split('@')[0] || '';

  useEffect(() => {
    if (activeUserIdentity && currentEvent && ['teams', 'riders', 'open'].includes(currentEvent.status)) {
      loadSavedPicks(activeUserIdentity, currentEvent);
    }
  }, [activeUserIdentity, currentEvent?.id]);

  if (!user) return <GateScreen />;

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--ink)' }}>
        <div className="text-center">
          <div className="font-cinzel text-2xl tracking-widest mb-3 animate-gold-pulse" style={{ color: 'var(--gold)', letterSpacing: '0.3em' }}>
            EQUIPRIX
          </div>
          <div className="text-xs" style={{ color: 'var(--mid)' }}>Loading 2026 Season…</div>
        </div>
      </div>
    );
  }

  const handleSelectEvent = (ev) => {
    if (ev.status === 'past') {
      setActiveTab('results');
    } else if (['teams', 'riders', 'open'].includes(ev.status)) {
      setActiveTab('draft');
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--ink)', color: 'var(--ep-text)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: 'calc(52px + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          background: '#0a0907',
          borderBottom: '1px solid rgba(180,149,48,0.2)',
        }}
      >
        <div className="flex items-center gap-3">
          <EquiPrixLogo width={110} compact={true} />
          {currentEvent && (
            <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', letterSpacing: '0.1em' }}>
              <span style={{ color: 'var(--gold-lt)' }}>{currentEvent.flag} {currentEvent.city}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentEvent && <CountdownBadge event={currentEvent} />}

          {/* Username button → opens account modal */}
          {displayName && (
            <button
              onClick={() => setShowAccount(true)}
              className="font-cinzel text-xs px-2 py-1 rounded transition-all"
              style={{
                color: 'var(--gold-lt)',
                letterSpacing: '0.08em',
                opacity: 0.9,
                background: 'rgba(180,149,48,0.06)',
                border: '1px solid rgba(180,149,48,0.15)',
              }}
            >
              {displayName}
            </button>
          )}

          <button
            onClick={logout}
            className="font-cinzel text-xs px-2 py-1 rounded transition-all"
            style={{
              border: '1px solid var(--ep-border)',
              color: 'var(--mid)',
              background: 'none',
              letterSpacing: '0.08em',
              fontSize: 9,
            }}
          >
            EXIT
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'events' && <EventsTab onSelectEvent={handleSelectEvent} />}
        {activeTab === 'draft' && <DraftTab />}
        {activeTab === 'results' && <ResultsTab />}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
      </main>

      {/* Bottom nav */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Account modal */}
      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded z-50 text-sm pointer-events-none"
            style={{
              background: 'var(--ep-card)',
              border: '1px solid var(--gold)',
              color: 'var(--gold-lt)',
              whiteSpace: 'nowrap',
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}