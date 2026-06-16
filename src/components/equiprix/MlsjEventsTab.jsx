import React from 'react';
import { useMlsj } from '../../lib/MlsjContext';

export function MlsjEventsTab({ onSelectEvent }) {
  const { events, currentEvent, selectEvent } = useMlsj();

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      <h2 className="font-cormorant text-lg mb-2" style={{ color: 'var(--gold-lt)' }}>
        MLSJ 2026-27 Schedule
      </h2>
      {events.map(ev => (
        <button
          key={ev.id}
          onClick={() => { selectEvent(ev.id); onSelectEvent && onSelectEvent(ev); }}
          className="w-full text-left px-4 py-3 rounded flex items-center justify-between"
          style={{
            background: currentEvent?.id === ev.id ? 'var(--ep-card-active)' : 'var(--ep-card)',
            border: '1px solid rgba(180,149,48,0.25)',
          }}
        >
          <div>
            <div className="font-medium">{ev.flag} {ev.city}</div>
            <div className="text-xs opacity-70">{ev.dateLabel}</div>
          </div>
          <span className="text-xs uppercase opacity-60">{ev.status}</span>
        </button>
      ))}
    </div>
  );
}