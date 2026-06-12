import React, { useState, useEffect } from 'react';
import { EVENTS_2026, sbFetch } from '@/lib/equiprix-data';
import { Save, Info } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'future',  label: 'Future',         color: 'var(--mid)',    desc: 'Not open — hidden from draft' },
  { value: 'preview', label: 'Preview',         color: '#6aad8a',       desc: 'Monday mode: rankings + expected riders visible, practice draft enabled' },
  { value: 'teams',   label: 'Team Draft Open', color: '#c9a84c',       desc: 'Team start list announced — team picks open, hidden from others until lock' },
  { value: 'riders',  label: 'GP Draft Open',   color: 'var(--gold)',   desc: 'GP start list announced — rider picks open, hidden until lock' },
  { value: 'past',    label: 'Complete',         color: 'var(--crimson)', desc: 'Event finished — results visible' },
];

export default function EventStatusEditor() {
  const [statuses, setStatuses] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});

  // Pre-populate from current EVENTS_2026 defaults
  useEffect(() => {
    const init = {};
    EVENTS_2026.forEach(ev => { init[ev.id] = ev.status || 'future'; });
    // Load from Supabase
    sbFetch('results?select=event,event_status').then(rows => {
      if (!rows) return;
      rows.forEach(row => {
        if (row.event_status) {
          const ev = EVENTS_2026.find(e => e.supabaseKey === row.event);
          if (ev) init[ev.id] = row.event_status;
        }
      });
      setStatuses({ ...init });
    });
    setStatuses(init);
  }, []);

  const saveStatus = async (ev) => {
    setSaving(p => ({ ...p, [ev.id]: true }));
    await sbFetch('results', {
      method: 'POST',
      body: JSON.stringify({
        event: ev.supabaseKey,
        event_status: statuses[ev.id],
        updated_at: new Date().toISOString()
      })
    });
    setSaving(p => ({ ...p, [ev.id]: false }));
    setSaved(p => ({ ...p, [ev.id]: true }));
    setTimeout(() => setSaved(p => ({ ...p, [ev.id]: false })), 2000);
  };

  return (
    <div>
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>EVENT STATUS</h2>
      <p className="font-cormorant text-base italic mb-3" style={{ color: 'var(--mid)' }}>
        Control what users see and when drafting is open for each event.
      </p>

      {/* Status legend */}
      <div className="rounded-lg p-3 mb-4 space-y-1" style={{ background: '#0a0907', border: '1px solid var(--ep-border)' }}>
        {STATUS_OPTIONS.map(s => (
          <div key={s.value} className="flex items-start gap-2 text-xs">
            <span className="font-cinzel flex-shrink-0 w-28" style={{ color: s.color, fontSize: 9 }}>{s.label.toUpperCase()}</span>
            <span style={{ color: 'var(--mid)' }}>{s.desc}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {EVENTS_2026.map(ev => {
          const current = statuses[ev.id] || ev.status;
          const opt = STATUS_OPTIONS.find(s => s.value === current);
          return (
            <div key={ev.id} className="rounded-lg px-3 py-2.5 flex items-center gap-3"
              style={{ background: 'var(--ep-card)', border: '1px solid var(--ep-border)' }}>
              <div className="flex-1 min-w-0">
                <div className="font-cormorant text-sm font-semibold" style={{ color: 'var(--cream)' }}>
                  {ev.flag} {ev.city}
                </div>
                <div className="text-xs" style={{ color: 'var(--mid)' }}>{ev.dateLabel}</div>
              </div>
              <select
                value={current}
                onChange={e => setStatuses(p => ({ ...p, [ev.id]: e.target.value }))}
                className="rounded px-2 py-1.5 text-xs outline-none flex-shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${opt?.color || 'var(--ep-border)'}`,
                  color: opt?.color || 'var(--ep-text)',
                  minWidth: 140
                }}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={() => saveStatus(ev)}
                disabled={saving[ev.id]}
                className="flex items-center gap-1 px-3 py-1.5 rounded font-cinzel text-xs tracking-widest flex-shrink-0 transition-all"
                style={{
                  background: saved[ev.id] ? 'rgba(76,175,125,0.15)' : 'var(--gold)',
                  color: saved[ev.id] ? '#4caf7d' : 'var(--ink)',
                  border: saved[ev.id] ? '1px solid #4caf7d' : 'none',
                  minWidth: 64
                }}
              >
                <Save size={11} />
                {saved[ev.id] ? '✓' : 'SAVE'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}