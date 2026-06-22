import React from 'react';
import { useEquiPrix } from '@/lib/EquiPrixContext';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const STATUS_CONFIG = {
  past: { label: 'Complete', color: '#4caf7d' },
  teams: { label: 'Team Draft Open', color: '#7ab4d4' },
  riders: { label: 'GP Draft Open', color: 'var(--gold-lt)' },
  live: { label: 'Live', color: 'var(--gold)' },
  preview: { label: 'Start Lists Pending', color: 'var(--mid)' },
  future: { label: 'Coming Soon', color: '#4a4030' },
  cancelled: { label: 'Cancelled', color: '#666' },
};

export default function EventsTab({ onSelectEvent }) {
  const { events, currentEvent, selectEvent } = useEquiPrix();

  const handleSelect = (ev) => {
    if (ev.status === 'future' || ev.status === 'cancelled') return;
    selectEvent(ev.id);
    onSelectEvent(ev);
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24" style={{ background: 'var(--ink)' }}>
      <div className="divide-y" style={{ borderColor: 'var(--ep-border)' }}>
        {events.map((ev, i) => {
          const cfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.future;
          const isActive = currentEvent?.id === ev.id;
          const isClickable = ev.status !== 'future' && ev.status !== 'cancelled';

          return (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => handleSelect(ev)}
              className="flex items-center gap-3 px-4 py-3 transition-all"
              style={{
                background: isActive ? 'rgba(180,149,48,0.07)' : 'transparent',
                borderLeft: `2px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
                opacity: !isClickable ? 0.4 : 1,
                cursor: isClickable ? 'pointer' : 'default',
              }}
            >
              <div className="text-2xl">{ev.flag}</div>
              <div className="flex-1 min-w-0">
                <div className="font-cormorant text-base font-semibold" style={{ color: 'var(--cream)' }}>
                  {ev.city}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--mid)' }}>
                  {ev.dates}
                </div>
                <div className="font-cinzel text-xs mt-1" style={{ color: cfg.color, letterSpacing: '0.06em' }}>
                  {cfg.label}
                </div>
              </div>
              {isClickable && (
                <ChevronRight size={16} style={{ color: isActive ? 'var(--gold)' : 'var(--ep-border)', flexShrink: 0 }} />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}