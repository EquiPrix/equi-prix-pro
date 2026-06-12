import React, { useState, useEffect } from 'react';
import { useEquiPrix } from '@/lib/EquiPrixContext';
import GateScreen from '@/components/equiprix/GateScreen';
import BottomNav from '@/components/equiprix/BottomNav';
import EventsTab from '@/components/equiprix/EventsTab';
import DraftTab from '@/components/equiprix/DraftTab';
import ResultsTab from '@/components/equiprix/ResultsTab';
import LeaderboardTab from '@/components/equiprix/LeaderboardTab';
import { motion, AnimatePresence } from 'framer-motion';
import EquiPrixLogo from '@/components/equiprix/EquiPrixLogo';

export default function EquiPrix() {
  const { userCode, userName, currentEvent, selectEvent, toast, logout, isLoading, loadSavedPicks } = useEquiPrix();
  const [activeTab, setActiveTab] = useState('events');

  // Load picks when event + user are both ready
  useEffect(() => {
    if (userCode && currentEvent && ['teams', 'riders', 'open'].includes(currentEvent.status)) {
      loadSavedPicks(userCode, currentEvent);
    }
  }, [userCode, currentEvent?.id]);

  if (!userCode) {
    return <GateScreen />;
  }

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
    // Switch to relevant tab based on event status
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
        className="flex items-center justify-between px-4 safe-top flex-shrink-0"
        style={{
          height: 52,
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
        <div className="flex items-center gap-3">
          {userName && (
            <span className="font-cinzel text-xs" style={{ color: 'var(--gold-lt)', letterSpacing: '0.08em', opacity: 0.8 }}>
              {userName}
            </span>
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