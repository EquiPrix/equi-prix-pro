import React, { useState, useEffect } from 'react';
import { useEquiPrix } from '@/lib/EquiPrixContext';
import { MlsjProvider, useMlsj } from '@/lib/MlsjContext';
import GateScreen from '@/components/equiprix/GateScreen';
import BottomNav from '@/components/equiprix/BottomNav';
import EventsTab from '@/components/equiprix/EventsTab';
import DraftTab from '@/components/equiprix/DraftTab';
import ResultsTab from '@/components/equiprix/ResultsTab';
import LeaderboardTab from '@/components/equiprix/LeaderboardTab';
import { MlsjEventsTab } from '@/components/equiprix/MlsjEventsTab';
import { MlsjDraftTab } from '@/components/equiprix/MlsjDraftTab';
import { MlsjResultsTab } from '@/components/equiprix/MlsjResultsTab';
import { MlsjLeaderboardTab } from '@/components/equiprix/MlsjLeaderboardTab';
import AccountModal from '@/components/equiprix/AccountModal';
import PWAInstallModal, { usePWAInstallModal } from '@/components/equiprix/PWAInstallModal';
import PWABanner from '@/components/equiprix/PWABanner';
import { motion, AnimatePresence } from 'framer-motion';
import EquiPrixLogo from '@/components/equiprix/EquiPrixLogo';
import { useAuth } from '../lib/AuthContext';

function useCountdown(targetISO) {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!targetISO) return;
    const tick = () => {
      const diff = new Date(targetISO) - new Date();
      if (diff <= 0) { setTimeLeft('LOCKED'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 48) { const days = Math.floor(h / 24); setTimeLeft(`${days}d ${h % 24}h`); }
      else if (h > 0) { setTimeLeft(`${h}h ${String(m).padStart(2, '0')}m`); }
      else { setTimeLeft(`${m}m ${String(s).padStart(2, '0')}s`); }
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
      <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 8, letterSpacing: '0.08em' }}>{label}</div>
      <div className="font-cinzel text-xs font-bold" style={{ color, fontSize: 11, letterSpacing: '0.05em' }}>{timeLeft}</div>
    </div>
  );
}

// Small pill toggle between GCL and MLSJ — sits in the header next to the logo.
function SeriesToggle({ series, onChange }) {
  return (
    <div className="flex items-center rounded overflow-hidden" style={{ border: '1px solid rgba(180,149,48,0.3)' }}>
      {[{ id: 'gcl', label: 'GCL' }, { id: 'mlsj', label: 'MLSJ' }].map(s => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className="font-cinzel text-xs px-2.5 py-1"
          style={{
            letterSpacing: '0.08em',
            background: series === s.id ? 'var(--gold)' : 'transparent',
            color: series === s.id ? '#0f0e0a' : 'var(--mid)',
            border: 'none',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function EquiPrixInner() {
  const { user } = useAuth();
  const { userCode, currentEvent, toast, logout, isLoading, loadSavedPicks } = useEquiPrix();
  const {
    currentEvent: mlsjCurrentEvent,
    toast: mlsjToast,
    isLoading: mlsjLoading,
    loadSavedPicks: loadMlsjSavedPicks,
  } = useMlsj();

  const [series, setSeries] = useState('gcl'); // 'gcl' | 'mlsj'
  const [activeTab, setActiveTab] = useState('events');
  const [showAccount, setShowAccount] = useState(false);
  const { showModal: showPWAModal, dismiss: dismissPWAModal } = usePWAInstallModal();

  const activeUserIdentity = user?.email || userCode;
  const displayName = user?.user_metadata?.username || user?.email?.split('@')[0] || '';

  // GCL saved-picks load (unchanged)
  useEffect(() => {
    if (activeUserIdentity && currentEvent && ['teams', 'riders', 'open'].includes(currentEvent.status)) {
      loadSavedPicks(activeUserIdentity, currentEvent);
    }
  }, [activeUserIdentity, currentEvent?.id]);

  // MLSJ saved-picks load
  useEffect(() => {
    if (activeUserIdentity && mlsjCurrentEvent && ['teams', 'riders', 'open'].includes(mlsjCurrentEvent.status)) {
      loadMlsjSavedPicks(activeUserIdentity, mlsjCurrentEvent);
    }
  }, [activeUserIdentity, mlsjCurrentEvent?.id]);

  if (!user) return <GateScreen />;

  if (isLoading || mlsjLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--ink)' }}>
        <div className="text-center">
          <div className="font-cinzel text-2xl tracking-widest mb-3 animate-gold-pulse" style={{ color: 'var(--gold)', letterSpacing: '0.3em' }}>EQUIPRIX</div>
          <div className="text-xs" style={{ color: 'var(--mid)' }}>Loading 2026 Season…</div>
        </div>
      </div>
    );
  }

  const handleSelectEvent = (ev) => {
    if (ev.status === 'past') setActiveTab('results');
    else if (['teams', 'riders', 'open'].includes(ev.status)) setActiveTab('draft');
  };

  const displayEvent = series === 'gcl' ? currentEvent : mlsjCurrentEvent;
  const displayToast = series === 'gcl' ? toast : mlsjToast;

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
          <SeriesToggle series={series} onChange={setSeries} />
          {displayEvent && (
            <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', letterSpacing: '0.1em' }}>
              <span style={{ color: 'var(--gold-lt)' }}>{displayEvent.flag} {displayEvent.city}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {displayEvent && <CountdownBadge event={displayEvent} />}
          {displayName && (
            <button onClick={() => setShowAccount(true)}
              className="font-cinzel text-xs px-2 py-1 rounded transition-all"
              style={{
                color: 'var(--gold-lt)',
                letterSpacing: '0.08em',
                opacity: 0.9,
                background: 'rgba(180,149,48,0.06)',
                border: '1px solid rgba(180,149,48,0.15)',
              }}>
              {displayName}
            </button>
          )}
        </div>
      </header>

      {/* PWA Banner */}
      <PWABanner eventId={displayEvent?.id} />

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {series === 'gcl' && activeTab === 'events' && <EventsTab onSelectEvent={handleSelectEvent} />}
        {series === 'gcl' && activeTab === 'draft' && <DraftTab />}
        {series === 'gcl' && activeTab === 'results' && <ResultsTab />}
        {series === 'gcl' && activeTab === 'leaderboard' && <LeaderboardTab />}

        {series === 'mlsj' && activeTab === 'events' && <MlsjEventsTab onSelectEvent={handleSelectEvent} />}
        {series === 'mlsj' && activeTab === 'draft' && <MlsjDraftTab />}
        {series === 'mlsj' && activeTab === 'results' && <MlsjResultsTab />}
        {series === 'mlsj' && activeTab === 'leaderboard' && <MlsjLeaderboardTab />}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
      {showPWAModal && <PWAInstallModal onClose={dismissPWAModal} />}

      <AnimatePresence>
        {displayToast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded z-50 text-sm pointer-events-none"
            style={{ background: 'var(--ep-card)', border: '1px solid var(--gold)', color: 'var(--gold-lt)', whiteSpace: 'nowrap' }}>
            {displayToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EquiPrix() {
  return (
    <MlsjProvider>
      <EquiPrixInner />
    </MlsjProvider>
  );
}