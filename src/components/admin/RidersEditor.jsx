import React, { useState, useEffect } from 'react';
import { EVENTS_2026, sbFetch } from '@/lib/equiprix-data';
import { loadStartListRemote, saveStartListRemote } from '@/lib/startListStore';
import { Search, UserPlus, X } from 'lucide-react';

function AddRiderForm({ onAdded, nextId }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [nat, setNat] = useState('');
  const [rank, setRank] = useState('');
  const [salary, setSalary] = useState('1000');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName(''); setNat(''); setRank(''); setSalary('1000'); setError('');
  };

  const submit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    const newRider = {
      id: String(nextId),
      name: name.trim(),
      rank: rank ? Number(rank) : 999,
      nat: nat.trim(),
      salary: salary ? Number(salary) : 1000,
    };
    try {
      await sbFetch('riders', {
        method: 'POST',
        body: JSON.stringify(newRider)
      });
      await onAdded();
      reset();
      setOpen(false);
    } catch (e) {
      setError('Could not save rider — ' + e.message);
    }
    setSaving(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded font-cinzel text-xs tracking-widest mb-3 w-full justify-center transition-all"
        style={{ background: 'rgba(180,149,48,0.08)', border: '1px dashed rgba(180,149,48,0.35)', color: 'var(--gold)' }}>
        <UserPlus size={13} />
        ADD NEW RIDER
      </button>
    );
  }

  return (
    <div className="rounded-lg p-3 mb-3" style={{ background: 'var(--ep-card)', border: '1px solid rgba(180,149,48,0.3)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)', fontSize: 10 }}>NEW RIDER · id {nextId}</span>
        <button onClick={() => { setOpen(false); reset(); }} style={{ color: 'var(--mid)' }}><X size={13} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
          className="col-span-2 rounded px-2 py-1.5 text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }} />
        <input value={nat} onChange={e => setNat(e.target.value)} placeholder="Nationality e.g. 🇫🇷 France"
          className="rounded px-2 py-1.5 text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }} />
        <input type="number" value={rank} onChange={e => setRank(e.target.value)} placeholder="FEI rank (blank = 999)"
          className="rounded px-2 py-1.5 text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }} />
        <input type="number" value={salary} onChange={e => setSalary(e.target.value)} placeholder="Salary"
          className="col-span-2 rounded px-2 py-1.5 text-xs outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }} />
      </div>
      {error && <p className="text-xs mb-2" style={{ color: '#e07070' }}>{error}</p>}
      <button onClick={submit} disabled={saving}
        className="w-full py-1.5 rounded font-cinzel text-xs tracking-widest"
        style={{ background: 'var(--gold)', color: 'var(--ink)' }}>
        {saving ? 'SAVING…' : 'SAVE RIDER TO ROSTER'}
      </button>
    </div>
  );
}

export default function RidersEditor() {
  const [allRiders, setAllRiders] = useState([]);
  const [ridersLoaded, setRidersLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [gpChecked, setGpChecked] = useState({});
  const [existingGP, setExistingGP] = useState([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load the full roster from Supabase (replaces the old static
  // PREVIEW_RIDERS_2026 import). This is the single live source now —
  // both this list and the "add rider" form read/write here, so a
  // newly-added rider shows up immediately without a code deploy.
  const loadRiders = async () => {
    const data = await sbFetch('riders?order=rank.asc');
    setAllRiders(data || []);
    setRidersLoaded(true);
  };

  useEffect(() => {
    loadRiders();
  }, []);

  // Load existing GP start list checkboxes from Supabase (start_lists)
  // when event changes.
  useEffect(() => {
    if (!selectedEventId) { setGpChecked({}); setExistingGP([]); return; }
    setLoading(true);
    loadStartListRemote(selectedEventId).then(data => {
      const gp = data?.gp || [];
      setExistingGP(gp);
      const map = {};
      gp.forEach(r => { map[r.id] = true; });
      setGpChecked(map);
      setLoading(false);
    });
  }, [selectedEventId]);

  const filtered = allRiders.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  // Next free id: max of all current numeric ids + 1. Falls back to 269
  // (the documented next slot) if the table is somehow empty.
  const nextId = allRiders.length
    ? Math.max(...allRiders.map(r => Number(r.id) || 0)) + 1
    : 269;

  const toggle = (rider) => {
    setGpChecked(prev => ({ ...prev, [rider.id]: !prev[rider.id] }));
  };

  const saveGP = async () => {
    if (!selectedEventId) return;
    const event = EVENTS_2026.find(e => e.id === selectedEventId);
    if (!event) return;
    setSaving(true);

    // Preserve existing horse assignments when rebuilding the GP list —
    // previously horses were preserved from localStorage only, which meant
    // they were invisible after a cache clear or on a different machine.
    // Now we preserve them from the Supabase-loaded existingGP instead.
    const existingMap = {};
    existingGP.forEach(r => { existingMap[r.id] = r; });

    const gp = allRiders.filter(r => gpChecked[r.id]).map(r => ({
      ...r,
      horse: existingMap[r.id]?.horse || ''
    }));

    // Load existing teamPairs so we don't wipe them when re-saving
    // (saveStartListRemote overwrites the whole start_lists row)
    const existing = await loadStartListRemote(selectedEventId);
    const teamPairs = existing?.teamPairs || {};

    // Single save writes to three places:
    // 1. start_lists.gp — shared source for StartListEditor's GP horse tab
    // 2. results.gp_riders — read by EquiPrixContext for Draft tab Riders list
    // 3. results.preview_riders — read by EquiPrixContext for preview mode
    // (2 and 3 happen inside saveStartListRemote via the supabaseKey param)
    await saveStartListRemote(selectedEventId, { gp, teamPairs }, event.supabaseKey);

    // Also write preview_riders separately since saveStartListRemote only
    // mirrors to gp_riders, not preview_riders — and preview mode still
    // needs its own field so it can show expected riders before the
    // official GP list is confirmed.
    try {
      await sbFetch('results', {
        method: 'POST',
        body: JSON.stringify({
          event: event.supabaseKey,
          preview_riders: gp,
          updated_at: new Date().toISOString()
        })
      });
    } catch (e) {
      console.warn('Could not save preview_riders:', e);
    }

    setExistingGP(gp);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const checkedCount = Object.values(gpChecked).filter(Boolean).length;

  return (
    <div>
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>RIDERS</h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Check riders to build the <strong style={{ color: 'var(--gold-lt)' }}>GP start list</strong> — saved to Supabase so the Start Lists tab can assign horses and users see them in the Draft tab.
      </p>

      <AddRiderForm onAdded={loadRiders} nextId={nextId} />

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
          <button onClick={saveGP} disabled={saving || loading}
            className="px-4 py-2 rounded font-cinzel text-xs tracking-widest flex-shrink-0 transition-all"
            style={{ background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)', color: saved ? '#4caf7d' : 'var(--ink)', border: saved ? '1px solid #4caf7d' : 'none', minWidth: 100 }}>
            {saved ? '✓ SAVED' : saving ? 'SAVING…' : `SAVE GP (${checkedCount})`}
          </button>
        )}
      </div>

      {(loading || !ridersLoaded) && (
        <div className="text-center py-4 font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>Loading…</div>
      )}

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
                onClick={() => selectedEventId && !loading && toggle(rider)}
              >
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
                <div className="col-span-1 text-right font-cinzel text-xs" style={{ color: 'var(--gold)', fontSize: 10 }}>
                  {rider.rank}
                </div>
                <div className="col-span-7 pl-2">
                  <div className="font-cormorant text-sm truncate" style={{ color: checked ? 'var(--gold-lt)' : 'var(--cream)' }}>{rider.name}</div>
                  <div style={{ color: 'var(--mid)', fontSize: 9 }}>{rider.nat}</div>
                </div>
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