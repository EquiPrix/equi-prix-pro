import React, { useState, useEffect } from 'react';
import { loadHorseDBRemote, saveHorseDBRemote } from '@/lib/startListStore';
import { Plus, X, Save, Search } from 'lucide-react';

// ── HorseDBEditor ─────────────────────────────────────────────────────────────
// Shared admin view of the horse_db table. Shows every rider who has at
// least one horse registered, lets you add or remove horses per rider,
// and saves back to the shared horse_db table (used by both GCL and MLSJ).
export default function HorseDBEditor() {
  const [db, setDb]           = useState({});  // { [riderName]: [horseName, ...] }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [search, setSearch]   = useState('');
  const [newRider, setNewRider]   = useState('');
  const [newHorse, setNewHorse]   = useState('');
  const [addingTo, setAddingTo]   = useState(null); // rider name being added to
  const [addHorseVal, setAddHorseVal] = useState('');

  useEffect(() => {
    loadHorseDBRemote().then(data => {
      setDb(data || {});
      setLoading(false);
    });
  }, []);

  const riders = Object.keys(db)
    .filter(r => !search || r.toLowerCase().includes(search.toLowerCase()))
    .sort();

  const removeHorse = (rider, horse) => {
    setDb(prev => {
      const horses = (prev[rider] || []).filter(h => h !== horse);
      if (!horses.length) {
        const { [rider]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [rider]: horses };
    });
  };

  const addHorseToRider = (rider, horse) => {
    if (!horse.trim()) return;
    setDb(prev => {
      const existing = prev[rider] || [];
      if (existing.includes(horse.trim())) return prev;
      return { ...prev, [rider]: [...existing, horse.trim()] };
    });
    setAddHorseVal('');
    setAddingTo(null);
  };

  const addNewRiderWithHorse = () => {
    if (!newRider.trim() || !newHorse.trim()) return;
    setDb(prev => {
      const existing = prev[newRider.trim()] || [];
      if (!existing.includes(newHorse.trim())) {
        return { ...prev, [newRider.trim()]: [...existing, newHorse.trim()] };
      }
      return prev;
    });
    setNewRider('');
    setNewHorse('');
  };

  const save = async () => {
    setSaving(true);
    await saveHorseDBRemote(db);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const totalHorses = Object.values(db).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="max-w-2xl">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>
        HORSE REGISTRY
      </h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Shared across GCL and MLSJ. {Object.keys(db).length} riders · {totalHorses} horses registered.
      </p>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--mid)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search rider…"
          className="w-full rounded px-3 py-2 pl-8 text-sm outline-none"
          style={{ background: 'var(--ep-card)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }} />
      </div>

      {/* Add new rider + horse */}
      <div className="rounded-lg p-3 mb-4"
        style={{ background: 'rgba(180,149,48,0.04)', border: '1px solid rgba(180,149,48,0.15)' }}>
        <div className="font-cinzel text-xs tracking-widest mb-2" style={{ color: 'var(--gold)', fontSize: 9 }}>
          ADD NEW ENTRY
        </div>
        <div className="flex gap-2">
          <input value={newRider} onChange={e => setNewRider(e.target.value)}
            placeholder="Rider name"
            className="flex-1 rounded px-2 py-1.5 text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }} />
          <input value={newHorse} onChange={e => setNewHorse(e.target.value)}
            placeholder="Horse name"
            onKeyDown={e => { if (e.key === 'Enter') addNewRiderWithHorse(); }}
            className="flex-1 rounded px-2 py-1.5 text-xs outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }} />
          <button onClick={addNewRiderWithHorse}
            className="px-3 py-1.5 rounded flex items-center gap-1 text-xs font-cinzel"
            style={{ background: 'rgba(180,149,48,0.15)', color: 'var(--gold)', border: '1px solid rgba(180,149,48,0.3)' }}>
            <Plus size={11} /> ADD
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 font-cormorant italic" style={{ color: 'var(--mid)' }}>Loading…</div>
      ) : riders.length === 0 ? (
        <div className="text-center py-8 font-cormorant italic" style={{ color: 'var(--mid)' }}>
          {search ? 'No riders match that search.' : 'No horses registered yet.'}
        </div>
      ) : (
        <div className="space-y-1.5 mb-4">
          {riders.map(rider => (
            <div key={rider} className="rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--ep-border)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-cormorant text-sm font-semibold" style={{ color: 'var(--cream)' }}>
                  {rider}
                </span>
                <button onClick={() => { setAddingTo(rider); setAddHorseVal(''); }}
                  className="p-1 rounded"
                  style={{ color: 'var(--mid)', border: '1px solid var(--ep-border)' }}>
                  <Plus size={10} />
                </button>
              </div>

              {/* Horse tags */}
              <div className="flex flex-wrap gap-1.5">
                {(db[rider] || []).map(horse => (
                  <div key={horse}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-cormorant italic"
                    style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold-lt)' }}>
                    {horse}
                    <button onClick={() => removeHorse(rider, horse)}
                      className="ml-0.5" style={{ color: 'var(--mid)' }}>
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Inline add horse to this rider */}
              {addingTo === rider && (
                <div className="flex gap-1 mt-2">
                  <input autoFocus value={addHorseVal} onChange={e => setAddHorseVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addHorseToRider(rider, addHorseVal); if (e.key === 'Escape') setAddingTo(null); }}
                    placeholder="Horse name"
                    className="flex-1 rounded px-2 py-1 text-xs outline-none"
                    style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.3)', color: 'var(--ep-text)' }} />
                  <button onClick={() => addHorseToRider(rider, addHorseVal)}
                    className="text-xs px-2 py-1 rounded"
                    style={{ background: 'rgba(180,149,48,0.15)', color: 'var(--gold)' }}>OK</button>
                  <button onClick={() => setAddingTo(null)} style={{ color: 'var(--mid)' }}>
                    <X size={11} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button onClick={save} disabled={saving || loading}
        className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2 sticky bottom-4"
        style={{
          background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)',
          color:      saved ? '#4caf7d' : 'var(--ink)',
          border:     saved ? '1px solid #4caf7d' : 'none',
        }}>
        <Save size={13} />
        {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE HORSE REGISTRY'}
      </button>
    </div>
  );
}