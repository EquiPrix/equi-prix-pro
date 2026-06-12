import React, { useState, useEffect } from 'react';
import { PREVIEW_RIDERS_2026, EVENTS_2026, sbFetch } from '@/lib/equiprix-data';
import { loadStartLists, saveStartList } from '@/lib/startListStore';
import { Search } from 'lucide-react';

const RIDERS_BY_RANK = [...PREVIEW_RIDERS_2026].sort((a, b) => a.rank - b.rank);

export default function RidersEditor() {
  const [search, setSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [gpChecked, setGpChecked] = useState({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing GP start list checkboxes when event changes
  useEffect(() => {
    if (!selectedEventId) return;
    const sl = loadStartLists()[selectedEventId];
    if (sl?.gp?.length) {
      const map = {};
      sl.gp.forEach(r => { map[r.id] = true; });
      setGpChecked(map);
    } else {
      setGpChecked({});
    }
  }, [selectedEventId]);

  const filtered = RIDERS_BY_RANK.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (rider) => {
    setGpChecked(prev => ({ ...prev, [rider.id]: !prev[rider.id] }));
  };

  const saveGP = async () => {
    if (!selectedEventId) return;
    const event = EVENTS_2026.find(e => e.id === selectedEventId);
    if (!event) return;
    setSaving(true);

    const existing = loadStartLists()[selectedEventId] || {};
    const existingGP = existing.gp || [];
    const existingMap = {};
    existingGP.forEach(r => { existingMap[r.id] = r; });

    const gp = RIDERS_BY_RANK.filter(r => gpChecked[r.id]).map(r => ({
      ...r,
      horse: existingMap[r.id]?.horse || ''
    }));

    // Save to localStorage for start list editor
    saveStartList(selectedEventId, { ...existing, gp });

    // Save to Supabase as preview_riders so users see them in preview mode
    await sbFetch('results', {
      method: 'POST',
      body: JSON.stringify({
        event: event.supabaseKey,
        preview_riders: gp,
        updated_at: new Date().toISOString()
      })
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const checkedCount = Object.values(gpChecked).filter(Boolean).length;

  return (
    <div>
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>RIDERS</h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Check riders to build the <strong style={{ color: 'var(--gold-lt)' }}>preview start list</strong> — saved to Supabase so users can budget during preview mode. Add horses via the Start Lists tab when the official GP list drops.
      </p>

      {/* Event selector for GP linking */}
      <div className="flex gap-2 mb-4 items-center">
        <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
          className="flex-1 rounded px-3 py-2 text-xs outline-none"
          style={{ background: 'var(--ep-card)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }}>
          <option value="">— Select event for GP start list —</option>
          {EVENTS_2026.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.flag} {ev.city} · {ev.dates}</option>
          ))}
        </select>
        {selectedEventId && (
          <button onClick={saveGP} disabled={saving}
            className="px-4 py-2 rounded font-cinzel text-xs tracking-widest flex-shrink-0 transition-all"
            style={{ background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)', color: saved ? '#4caf7d' : 'var(--ink)', border: saved ? '1px solid #4caf7d' : 'none', minWidth: 100 }}>
            {saved ? '✓ SAVED' : saving ? 'SAVING…' : `SAVE PREVIEW (${checkedCount})`}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 rounded mb-3" style={{ background: 'var(--ep-card)', border: '1px solid var(--ep-border)' }}>
        <Search size={13} style={{ color: 'var(--mid)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search rider…"
          className="flex-1 text-sm outline-none bg-transparent"
          style={{ color: 'var(--ep-text)' }}
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs" style={{ color: 'var(--mid)' }}>✕</button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ep-border)' }}>
        <div className="grid grid-cols-12 px-3 py-2 text-xs font-cinzel tracking-widest" style={{ background: '#0a0907', color: 'var(--mid)', borderBottom: '1px solid var(--ep-border)', fontSize: 9 }}>
          <div className="col-span-1 text-center">GP</div>
          <div className="col-span-1 text-right">#</div>
          <div className="col-span-7 pl-2">RIDER</div>
          <div className="col-span-3 text-right">SALARY</div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 480 }}>
          {filtered.map((rider, i) => {
            const checked = !!gpChecked[rider.id];
            return (
              <div key={rider.id}
                className="grid grid-cols-12 items-center px-3 py-2 text-xs cursor-pointer"
                style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid rgba(42,40,32,0.4)' : 'none',
                  background: checked ? 'rgba(180,149,48,0.05)' : i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'
                }}
                onClick={() => selectedEventId && toggle(rider)}
              >
                {/* GP checkbox */}
                <div className="col-span-1 flex justify-center">
                  <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: checked ? 'var(--gold)' : 'transparent',
                      border: `1px solid ${checked ? 'var(--gold)' : 'var(--ep-border)'}`,
                      opacity: selectedEventId ? 1 : 0.3
                    }}>
                    {checked && <span style={{ color: 'var(--ink)', fontSize: 9, lineHeight: 1 }}>✓</span>}
                  </div>
                </div>

                {/* Rank */}
                <div className="col-span-1 text-right font-cinzel text-xs" style={{ color: 'var(--gold)', fontSize: 10 }}>
                  {rider.rank}
                </div>

                {/* Name + nat */}
                <div className="col-span-7 pl-2">
                  <div className="font-cormorant text-sm truncate" style={{ color: checked ? 'var(--gold-lt)' : 'var(--cream)' }}>{rider.name}</div>
                  <div style={{ color: 'var(--mid)', fontSize: 9 }}>{rider.nat}</div>
                </div>

                {/* Salary */}
                <div className="col-span-3 text-right font-cormorant text-sm" style={{ color: 'var(--mid)' }}>
                  ${rider.salary.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!selectedEventId && (
        <p className="text-xs mt-2 text-center font-cormorant italic" style={{ color: 'var(--mid)' }}>
          Select an event above to enable GP checkboxes
        </p>
      )}
    </div>
  );
}