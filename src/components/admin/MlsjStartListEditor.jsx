import React, { useState, useEffect } from 'react';
import {
  MLSJ_EVENTS_2026_27, MLSJ_TEAMS_2026,
  getMlsjTeamRoster, sbFetch,
} from '@/lib/mlsj-data';
import { PREVIEW_RIDERS_2026 } from '@/lib/equiprix-data';
// ── CHANGED: use the shared GCL horse DB so horses entered on the GCL
// side are immediately available here, and vice-versa. Previously this
// file loaded/saved from a separate mlsj_horse_db Supabase table, which
// meant every horse had to be entered twice.
import { loadHorseDBRemote, saveHorseDBRemote } from '@/lib/startListStore';
import { Plus, X, Save } from 'lucide-react';

function HorseInput({ riderName, value, onChange, horseDB, onAddHorse }) {
  const [adding, setAdding] = useState(false);
  const [newHorse, setNewHorse] = useState('');

  const dbHorses = horseDB[riderName] || [];
  const horses = [...new Set([...dbHorses, ...(value ? [value] : [])])];

  const saveHorse = async (h) => {
    if (!h) return;
    await onAddHorse(riderName, h);
    onChange(h);
    setAdding(false);
    setNewHorse('');
  };

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="flex-1 rounded px-2 py-1 text-xs outline-none min-w-0"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ep-border)', color: value ? 'var(--gold-lt)' : 'var(--mid)', fontStyle: value ? 'italic' : 'normal' }}>
        <option value="">— horse —</option>
        {horses.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      {adding ? (
        <div className="flex gap-1">
          <input autoFocus value={newHorse} onChange={e => setNewHorse(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveHorse(newHorse.trim()); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Horse" className="rounded px-2 py-1 text-xs outline-none"
            style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.3)', color: 'var(--ep-text)', width: 100 }} />
          <button onClick={() => saveHorse(newHorse.trim())} className="text-xs px-1.5 py-1 rounded" style={{ background: 'rgba(180,149,48,0.15)', color: 'var(--gold)' }}>OK</button>
          <button onClick={() => setAdding(false)} style={{ color: 'var(--mid)' }}><X size={11} /></button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="p-1 rounded flex-shrink-0"
          style={{ color: 'var(--mid)', border: '1px solid var(--ep-border)' }}>
          <Plus size={10} />
        </button>
      )}
    </div>
  );
}

function TeamTrioDeclarer({ teams, declaredTrioIds, setDeclaredTrioIds, riderList }) {
  const getTrio = (teamId) => declaredTrioIds[teamId] || [];

  const toggleRider = (teamId, riderId) => {
    setDeclaredTrioIds(prev => {
      const current = prev[teamId] || [];
      const exists = current.includes(riderId);
      let next;
      if (exists) {
        next = current.filter(id => id !== riderId);
      } else {
        if (current.length >= 3) return prev;
        next = [...current, riderId];
      }
      return { ...prev, [teamId]: next };
    });
  };

  return (
    <div>
      <div className="font-cinzel text-xs tracking-widest mb-2" style={{ color: 'var(--gold)', fontSize: 9 }}>
        ROUND 1 TRIOS — DECLARE 3 OF 6 PER TEAM
      </div>
      <div className="space-y-2">
        {teams.map(team => {
          const roster = getMlsjTeamRoster(team.id, riderList);
          const trio = getTrio(team.id);
          return (
            <div key={team.id} className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(180,149,48,0.03)', border: '1px solid rgba(180,149,48,0.15)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-cormorant text-sm font-semibold" style={{ color: 'var(--cream)' }}>{team.name}</span>
                <span className="text-xs font-cinzel" style={{ color: trio.length === 3 ? '#4caf7d' : 'var(--mid)', fontSize: 9 }}>
                  {trio.length}/3 DECLARED
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {roster.map(r => {
                  const selected = trio.includes(r.id);
                  return (
                    <button key={r.id} onClick={() => toggleRider(team.id, r.id)}
                      className="text-xs px-2 py-1 rounded-full font-cormorant transition-all"
                      style={{
                        background: selected ? 'rgba(180,149,48,0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${selected ? 'rgba(180,149,48,0.5)' : 'rgba(42,40,32,0.6)'}`,
                        color: selected ? 'var(--gold-lt)' : 'var(--ep-text)',
                      }}>
                      {r.name} <span style={{ color: 'var(--mid)', fontSize: 9 }}>#{r.rank >= 999 ? '—' : r.rank}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GPStartList({ riders, setRiders, horseDB, onAddHorse }) {
  const setHorse = (id, horse) => setRiders(prev => prev.map(r => r.id === id ? { ...r, horse } : r));
  const sorted = [...riders].sort((a, b) => a.rank - b.rank);

  return (
    <div>
      <div className="font-cinzel text-xs tracking-widest mb-1" style={{ color: 'var(--gold)', fontSize: 9 }}>
        GRAND PRIX START LIST · {riders.length} RIDERS
      </div>
      <p className="font-cormorant text-sm italic mb-3" style={{ color: 'var(--mid)' }}>
        Check riders below to add to the GP field, then assign horses.
      </p>
      {sorted.length === 0 ? (
        <div className="rounded-lg p-6 text-center" style={{ border: '1px dashed var(--ep-border)' }}>
          <p className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>No GP riders selected yet</p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ep-border)', maxHeight: 420, overflowY: 'auto' }}>
          <div className="grid grid-cols-12 gap-1 px-3 py-1.5 text-xs font-cinzel" style={{ background: '#0a0907', color: 'var(--mid)', fontSize: 9, borderBottom: '1px solid var(--ep-border)' }}>
            <div className="col-span-1 text-right">#</div>
            <div className="col-span-4">RIDER</div>
            <div className="col-span-7">HORSE</div>
          </div>
          {sorted.map((r, i) => (
            <div key={r.id} className="grid grid-cols-12 items-center gap-1 px-3 py-1.5" style={{
              borderBottom: i < sorted.length - 1 ? '1px solid rgba(42,40,32,0.4)' : 'none',
              background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'
            }}>
              <div className="col-span-1 text-xs text-right" style={{ color: 'var(--gold)' }}>{r.rank >= 999 ? '—' : r.rank}</div>
              <div className="col-span-4 font-cormorant text-sm truncate" style={{ color: 'var(--cream)' }}>{r.name}</div>
              <div className="col-span-7">
                <HorseInput riderName={r.name} value={r.horse} onChange={h => setHorse(r.id, h)} horseDB={horseDB} onAddHorse={onAddHorse} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GPRiderPicker({ riderList, gpRiders, setGpRiders }) {
  const [search, setSearch] = useState('');
  const checkedIds = new Set(gpRiders.map(r => r.id));

  const toggle = (rider) => {
    if (checkedIds.has(rider.id)) {
      setGpRiders(prev => prev.filter(r => r.id !== rider.id));
    } else {
      setGpRiders(prev => [...prev, { ...rider, horse: '' }]);
    }
  };

  const filtered = [...riderList]
    .sort((a, b) => a.rank - b.rank)
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mb-4">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rider to add to GP…"
        className="w-full rounded px-3 py-2 mb-2 text-xs outline-none"
        style={{ background: 'var(--ep-card)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }} />
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ep-border)', maxHeight: 200, overflowY: 'auto' }}>
        {filtered.map((r, i) => {
          const checked = checkedIds.has(r.id);
          return (
            <div key={r.id} onClick={() => toggle(r)}
              className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer"
              style={{
                borderBottom: i < filtered.length - 1 ? '1px solid rgba(42,40,32,0.4)' : 'none',
                background: checked ? 'rgba(180,149,48,0.08)' : i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
              }}>
              <div className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0"
                style={{ background: checked ? 'var(--gold)' : 'transparent', border: `1px solid ${checked ? 'var(--gold)' : 'var(--ep-border)'}` }}>
                {checked && <span style={{ color: 'var(--ink)', fontSize: 8 }}>✓</span>}
              </div>
              <span className="flex-1 font-cormorant" style={{ color: checked ? 'var(--gold-lt)' : 'var(--cream)' }}>{r.name}</span>
              <span style={{ color: 'var(--mid)' }}>#{r.rank >= 999 ? '—' : r.rank}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MlsjStartListEditor() {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeSection, setActiveSection] = useState('trios');
  const [gpRiders, setGpRiders] = useState([]);
  const [declaredTrioIds, setDeclaredTrioIds] = useState({});
  const [horseDB, setHorseDB] = useState({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const [riderList, setRiderList] = useState(PREVIEW_RIDERS_2026);

  const event = MLSJ_EVENTS_2026_27.find(e => e.id === selectedEventId);

  useEffect(() => {
    // ── CHANGED: load from the shared GCL horse DB (horse_db Supabase
    // table via loadHorseDBRemote) instead of the separate mlsj_horse_db
    // table. All horses entered on either the GCL or MLSJ start list
    // pages are now stored and read from the same place.
    loadHorseDBRemote().then(db => setHorseDB(db || {}));

    // CHANGED: read live ranks from the riders table directly instead of
    // the fei_rankings sentinel row in results. Every rider's rank and
    // salary are now updated there by RankingsImport on each monthly upload.
    sbFetch('riders?select=id,rank,salary&limit=1000').then(rows => {
      if (rows && rows.length) {
        const rankMap = {};
        rows.forEach(r => { rankMap[String(r.id)] = { rank: r.rank, salary: r.salary }; });
        const updated = PREVIEW_RIDERS_2026.map(r => {
          const live = rankMap[String(r.id)];
          return live ? { ...r, rank: live.rank, salary: live.salary } : { ...r };
        });
        setRiderList(updated);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedEventId || !event) return;
    setLoading(true);
    sbFetch('results?event=eq.' + encodeURIComponent(event.supabaseKey) + '&limit=1').then(rows => {
      if (rows && rows.length) {
        setGpRiders(rows[0].gp_riders || []);
        setDeclaredTrioIds(rows[0].declared_trio_ids || {});
      } else {
        setGpRiders([]);
        setDeclaredTrioIds({});
      }
      setLoading(false);
    });
  }, [selectedEventId]);

  // ── CHANGED: save horses to the shared GCL horse DB via saveHorseDBRemote
  const addHorse = async (riderName, horse) => {
    if (!riderName || !horse) return;
    const db = { ...horseDB };
    if (!db[riderName]) db[riderName] = [];
    if (!db[riderName].includes(horse)) {
      db[riderName] = [...db[riderName], horse];
      setHorseDB(db);
      await saveHorseDBRemote(db);
    }
  };

  const save = async () => {
    if (!event) return;
    try {
      const payload = {
        event: event.supabaseKey,
        gp_riders: gpRiders,
        declared_trio_ids: declaredTrioIds,
        updated_at: new Date().toISOString(),
      };
      const existing = await sbFetch('results?event=eq.' + event.supabaseKey + '&limit=1');
      if (existing && existing.length > 0) {
        await sbFetch('results?event=eq.' + event.supabaseKey, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await sbFetch('results', { method: 'POST', body: JSON.stringify(payload) });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('MLSJ start list save error:', e);
      alert('Save failed: ' + e.message);
    }
  };

  const SECTIONS = [
    { id: 'trios', label: 'Team Trios' },
    { id: 'gp', label: 'Grand Prix' },
  ];

  return (
    <div className="max-w-2xl">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>MLSJ START LISTS</h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Declare each team's Round 1 trio and set the GP field. Both feed directly into draft pricing and availability.
      </p>

      <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
        className="w-full rounded px-3 py-2 mb-4 text-sm outline-none"
        style={{ background: 'var(--ep-card)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }}>
        <option value="">— Select Event —</option>
        {MLSJ_EVENTS_2026_27.map(ev => (
          <option key={ev.id} value={ev.id}>{ev.flag} {ev.city} · {ev.dates}</option>
        ))}
      </select>

      {loading && (
        <div className="text-center py-4 font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>Loading…</div>
      )}

      {event && !loading && (
        <>
          <div className="flex gap-1 mb-4">
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className="px-3 py-1.5 rounded font-cinzel text-xs transition-all"
                style={{
                  background: activeSection === s.id ? 'rgba(180,149,48,0.12)' : 'none',
                  border: `1px solid ${activeSection === s.id ? 'rgba(180,149,48,0.4)' : 'var(--ep-border)'}`,
                  color: activeSection === s.id ? 'var(--gold)' : 'var(--mid)',
                  letterSpacing: '0.08em',
                }}>
                {s.label.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="mb-4">
            {activeSection === 'trios' && (
              <TeamTrioDeclarer teams={MLSJ_TEAMS_2026} declaredTrioIds={declaredTrioIds} setDeclaredTrioIds={setDeclaredTrioIds} riderList={riderList} />
            )}
            {activeSection === 'gp' && (
              <>
                <GPRiderPicker riderList={riderList} gpRiders={gpRiders} setGpRiders={setGpRiders} />
                <GPStartList riders={gpRiders} setRiders={setGpRiders} horseDB={horseDB} onAddHorse={addHorse} />
              </>
            )}
          </div>

          <button onClick={save}
            className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2 sticky bottom-4"
            style={{ background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)', color: saved ? '#4caf7d' : 'var(--ink)', border: saved ? '1px solid #4caf7d' : 'none' }}>
            <Save size={13} />
            {saved ? 'SAVED ✓' : 'SAVE START LIST'}
          </button>
        </>
      )}
    </div>
  );
}