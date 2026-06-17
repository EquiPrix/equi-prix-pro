import React, { useState, useEffect } from 'react';
import { MLSJ_EVENTS_2026_27, sbFetch } from '@/lib/mlsj-data';
import { Save } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'future',  label: 'Future',          color: 'var(--mid)',     desc: 'Not open — hidden from draft' },
  { value: 'preview', label: 'Preview',          color: '#6aad8a',        desc: 'Practice draft enabled, rankings visible' },
  { value: 'teams',   label: 'Team Draft Open',  color: '#c9a84c',        desc: 'Round 1 trios declared — team picks open' },
  { value: 'riders',  label: 'GP Draft Open',    color: 'var(--gold)',    desc: 'GP start list announced — rider picks open' },
  { value: 'past',    label: 'Complete',          color: 'var(--crimson)', desc: 'Event finished — results visible, all picks locked' },
];

function isoToLocal(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}

function localToISO(local) {
  if (!local) return '';
  try {
    return new Date(local).toISOString();
  } catch { return ''; }
}

export default function MlsjEventStatusEditor() {
  const [statuses, setStatuses] = useState({});
  const [teamLocks, setTeamLocks] = useState({});
  const [gpLocks, setGpLocks] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});

  useEffect(() => {
    const initStatuses = {};
    const initTeamLocks = {};
    const initGpLocks = {};
    MLSJ_EVENTS_2026_27.forEach(ev => {
      initStatuses[ev.id] = ev.status || 'future';
      initTeamLocks[ev.id] = isoToLocal(ev.teamLockISO);
      initGpLocks[ev.id] = isoToLocal(ev.gpLockISO);
    });

    sbFetch('results?select=event,event_status,team_lock_iso,gp_lock_iso').then(rows => {
      if (!rows) return;
      rows.forEach(row => {
        const ev = MLSJ_EVENTS_2026_27.find(e => e.supabaseKey === row.event);
        if (!ev) return;
        if (row.event_status) initStatuses[ev.id] = row.event_status;
        if (row.team_lock_iso) initTeamLocks[ev.id] = isoToLocal(row.team_lock_iso);
        if (row.gp_lock_iso) initGpLocks[ev.id] = isoToLocal(row.gp_lock_iso);
      });
      setStatuses({ ...initStatuses });
      setTeamLocks({ ...initTeamLocks });
      setGpLocks({ ...initGpLocks });
    });

    setStatuses(initStatuses);
    setTeamLocks(initTeamLocks);
    setGpLocks(initGpLocks);
  }, []);

  const saveStatus = async (ev) => {
    setSaving(p => ({ ...p, [ev.id]: true }));
    const payload = {
      event: ev.supabaseKey,
      event_status: statuses[ev.id],
      team_lock_iso: localToISO(teamLocks[ev.id]),
      gp_lock_iso: localToISO(gpLocks[ev.id]),
      updated_at: new Date().toISOString(),
    };
    try {
      const existing = await sbFetch('results?event=eq.' + ev.supabaseKey + '&limit=1');
      if (existing && existing.length > 0) {
        await sbFetch('results?event=eq.' + ev.supabaseKey, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await sbFetch('results', { method: 'POST', body: JSON.stringify(payload) });
      }
    } catch (e) {
      console.error('MLSJ status save error:', e);
      alert('Save failed: ' + e.message);
    }
    setSaving(p => ({ ...p, [ev.id]: false }));
    setSaved(p => ({ ...p, [ev.id]: true }));
    setTimeout(() => setSaved(p => ({ ...p, [ev.id]: false })), 2000);
  };

  return (
    <div>
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>MLSJ EVENT STATUS</h2>
      <p className="font-cormorant text-base italic mb-3" style={{ color: 'var(--mid)' }}>
        Control event status and lock times. Lock times determine when team and GP picks close.
      </p>

      <div className="rounded-lg p-3 mb-4 space-y-1" style={{ background: '#0a0907', border: '1px solid var(--ep-border)' }}>
        {STATUS_OPTIONS.map(s => (
          <div key={s.value} className="flex items-start gap-2 text-xs">
            <span className="font-cinzel flex-shrink-0 w-28" style={{ color: s.color, fontSize: 9 }}>{s.label.toUpperCase()}</span>
            <span style={{ color: 'var(--mid)' }}>{s.desc}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {MLSJ_EVENTS_2026_27.map(ev => {
          const current = statuses[ev.id] || ev.status;
          const opt = STATUS_OPTIONS.find(s => s.value === current);
          return (
            <div key={ev.id} className="rounded-lg px-3 py-3"
              style={{ background: 'var(--ep-card)', border: '1px solid var(--ep-border)' }}>

              <div className="flex items-center gap-3 mb-3">
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="font-cinzel text-xs mb-1" style={{ color: '#c9a84c', fontSize: 9, letterSpacing: '0.08em' }}>
                    TEAM LOCK
                  </div>
                  <input
                    type="datetime-local"
                    value={teamLocks[ev.id] || ''}
                    onChange={e => setTeamLocks(p => ({ ...p, [ev.id]: e.target.value }))}
                    className="w-full rounded px-2 py-1.5 text-xs outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(201,168,76,0.3)',
                      color: 'var(--ep-text)',
                      colorScheme: 'dark'
                    }}
                  />
                </div>
                <div>
                  <div className="font-cinzel text-xs mb-1" style={{ color: 'var(--gold)', fontSize: 9, letterSpacing: '0.08em' }}>
                    GP LOCK
                  </div>
                  <input
                    type="datetime-local"
                    value={gpLocks[ev.id] || ''}
                    onChange={e => setGpLocks(p => ({ ...p, [ev.id]: e.target.value }))}
                    className="w-full rounded px-2 py-1.5 text-xs outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(180,149,48,0.3)',
                      color: 'var(--ep-text)',
                      colorScheme: 'dark'
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <div className="text-xs" style={{
                  color: teamLocks[ev.id] && new Date() >= new Date(localToISO(teamLocks[ev.id]))
                    ? 'var(--crimson)' : '#6aad8a'
                }}>
                  Teams: {teamLocks[ev.id]
                    ? (new Date() >= new Date(localToISO(teamLocks[ev.id])) ? '🔒 Locked' : '🟢 Open')
                    : '— not set'}
                </div>
                <div className="text-xs" style={{
                  color: gpLocks[ev.id] && new Date() >= new Date(localToISO(gpLocks[ev.id]))
                    ? 'var(--crimson)' : '#6aad8a'
                }}>
                  GP: {gpLocks[ev.id]
                    ? (new Date() >= new Date(localToISO(gpLocks[ev.id])) ? '🔒 Locked' : '🟢 Open')
                    : '— not set'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}