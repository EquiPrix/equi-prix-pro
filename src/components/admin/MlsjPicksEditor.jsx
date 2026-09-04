import React, { useState, useEffect, useMemo } from 'react';
import { fmt, sbFetch } from '@/lib/equiprix-data';
import { MLSJ_CAP, MLSJ_CPT_PREMIUM } from '@/lib/mlsj-data';
import { useMlsj } from '@/lib/MlsjContext';
import { GENERAL_ROOM_ID } from '@/lib/EquiPrixContext';
import { ChevronDown, ChevronUp, Save, X, Search, AlertTriangle } from 'lucide-react';

// MLSJ counterpart to PicksEditor.jsx — same "view and correct any user's
// picks" tool, wired to the MLSJ league instead of GCL. This tab never
// existed for MLSJ (MLSJ_TABS in Admin.jsx had no 'picks' entry), so there
// was previously no way to see or fix a player's MLSJ picks from admin.
const SLOT_IDS = ['cpt', 'r1', 'r2', 'r3', 'r4'];
const MLSJ_LEAGUE = 'mlsj';

export default function MlsjPicksEditor() {
  const { events, mlsjRiderRankings, getPricedTeams, getRiderList } = useMlsj();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [rooms, setRooms] = useState([]);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const [editTeam, setEditTeam] = useState([]);           // [{ rider, slotId, isCpt }]
  const [editTeamPicks, setEditTeamPicks] = useState([]); // [{ ...mlsjTeam, slotId }]
  const [search, setSearch] = useState('');
  const [view, setView] = useState('riders');
  // Same guard as GCL's PicksEditor: block save if some saved picks
  // couldn't be resolved against current event data, so a save never
  // silently erases picks that just haven't loaded yet.
  const [unresolvedCount, setUnresolvedCount] = useState(0);

  const selectedEvent = events.find(e => e.id === selectedEventId);

  useEffect(() => {
    if (selectedEventId) loadPicks();
  }, [selectedEventId]);

  const loadPicks = async () => {
    setLoading(true);
    setExpandedId(null);
    try {
      const [picksRows, roomList] = await Promise.all([
        sbFetch('picks?select=id,user_email,username,room_id,picks_json,updated_at&event=eq.' + selectedEventId + '&league=eq.' + MLSJ_LEAGUE) || [],
        sbFetch('rooms?select=id,name,event_id') || [],
      ]);
      setPicks(picksRows || []);
      setRooms((roomList || []).filter(r => r.event_id === selectedEventId || r.event_id === selectedEvent?.supabaseKey));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const roomName = (roomId) => {
    if (roomId === GENERAL_ROOM_ID) return 'General';
    return rooms.find(r => r.id === roomId)?.name || roomId?.slice(0, 8) || 'Unknown room';
  };

  // Field riders for this event (raw, from the event's own gpRiders/
  // previewRiders/riders — same source MlsjContext's getRiderList uses for
  // the live Draft tab), plus the full live rider table as a fallback for
  // resolving picks of riders no longer in the current field.
  const evRiders = useMemo(() => {
    if (!selectedEvent) return [];
    const fieldRiders = getRiderList(selectedEvent);
    const seen = new Set(fieldRiders.map(r => String(r.id)));
    return [...fieldRiders, ...mlsjRiderRankings.filter(r => !seen.has(String(r.id)))];
  }, [selectedEvent, mlsjRiderRankings]);

  const evTeams = useMemo(() => {
    if (!selectedEvent) return [];
    return getPricedTeams(selectedEvent, mlsjRiderRankings);
  }, [selectedEvent, mlsjRiderRankings]);

  const filteredRiders = useMemo(() => {
    const sorted = [...evRiders].sort((a, b) => a.rank - b.rank);
    return sorted.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  }, [evRiders, search]);

  const filteredTeams = useMemo(() => {
    const sorted = [...evTeams].sort((a, b) => (a.fieldRank || 99) - (b.fieldRank || 99));
    return sorted.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));
  }, [evTeams, search]);

  const getSalary = (entry) => entry.isCpt ? entry.rider.salary + MLSJ_CPT_PREMIUM : entry.rider.salary;
  const totalSpent = () => editTeam.reduce((s, r) => s + getSalary(r), 0) + editTeamPicks.reduce((s, t) => s + t.salary, 0);

  const startEdit = (row) => {
    const pj = row.picks_json || {};
    const newTeam = [];
    (pj.riders || []).forEach(s => {
      const rider = evRiders.find(r => String(r.id) === String(s.id));
      if (rider) newTeam.push({ rider, slotId: SLOT_IDS[newTeam.length], isCpt: !!s.isCpt });
    });
    const newTeamPicks = [];
    (pj.teams || []).forEach((s, i) => {
      const t = evTeams.find(t => String(t.id) === String(s.id));
      if (t) newTeamPicks.push({ ...t, slotId: 'mt' + (i + 1) });
    });
    const expectedRiders = (pj.riders || []).length;
    const expectedTeams = (pj.teams || []).length;
    setUnresolvedCount((expectedRiders - newTeam.length) + (expectedTeams - newTeamPicks.length));
    setEditTeam(newTeam);
    setEditTeamPicks(newTeamPicks);
    setExpandedId(row.id);
    setSearch('');
    setView('riders');
    setSaveMsg(null);
  };

  const addRider = (rider) => {
    if (editTeam.find(r => r.rider.id === rider.id)) return;
    if (editTeam.length >= 5) return;
    const usedSlots = editTeam.map(r => r.slotId);
    const nextSlot = SLOT_IDS.find(s => !usedSlots.includes(s));
    setEditTeam([...editTeam, { rider, slotId: nextSlot, isCpt: nextSlot === 'cpt' }]);
  };

  const removeRider = (id) => {
    setEditTeam(editTeam.filter(r => r.rider.id !== id).map((r, i) => ({ ...r, slotId: SLOT_IDS[i], isCpt: i === 0 })));
  };

  const makeCpt = (id) => {
    const idx = editTeam.findIndex(r => r.rider.id === id);
    const arr = [...editTeam];
    const [cpt] = arr.splice(idx, 1);
    arr.unshift(cpt);
    setEditTeam(arr.map((r, i) => ({ ...r, slotId: SLOT_IDS[i], isCpt: i === 0 })));
  };

  const addTeam = (t) => {
    if (editTeamPicks.find(p => p.id === t.id)) return;
    if (editTeamPicks.length >= 2) return;
    setEditTeamPicks([...editTeamPicks, { ...t, slotId: 'mt' + (editTeamPicks.length + 1) }]);
  };

  const removeTeam = (id) => {
    setEditTeamPicks(editTeamPicks.filter(t => t.id !== id).map((t, i) => ({ ...t, slotId: 'mt' + (i + 1) })));
  };

  const saveEdit = async (row) => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const spent = editTeam.reduce((s, r) => s + getSalary(r), 0) + editTeamPicks.reduce((s, t) => s + t.salary, 0);
      const existing = row.picks_json || {};
      await sbFetch('picks?on_conflict=user_email,event,league,room_id', {
        method: 'POST',
        body: JSON.stringify({
          user_email: row.user_email,
          event: selectedEventId,
          league: MLSJ_LEAGUE,
          room_id: row.room_id,
          username: row.username,
          picks_json: {
            ...existing,
            riders: editTeam.map(r => ({ id: r.rider.id, isCpt: r.isCpt })),
            teams: editTeamPicks.map(t => ({ id: t.id })),
            totalSpent: spent,
            correctedByAdmin: true,
            savedAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        }),
      });
      setSaveMsg({ success: true });
      loadPicks();
    } catch (e) {
      setSaveMsg({ success: false, msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const sortedPicks = [...picks].sort((a, b) => {
    if (a.room_id !== b.room_id) return (a.room_id === GENERAL_ROOM_ID ? -1 : 1);
    return (a.username || a.user_email).localeCompare(b.username || b.user_email);
  });

  return (
    <div className="max-w-3xl">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>MLSJ PICKS</h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        View and correct any user's MLSJ picks — works even after the draft has locked, since the lock is a player-facing convenience, not a hard permission.
      </p>

      <div className="mb-4">
        <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,149,48,0.2)', color: selectedEventId ? 'var(--cream)' : 'var(--mid)', borderRadius: 4, padding: '8px 12px', fontSize: 13, outline: 'none' }}>
          <option value="">— Select Event —</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.flag} {ev.city} · {ev.dates}</option>)}
        </select>
      </div>

      {!selectedEventId ? (
        <p className="font-cormorant italic text-sm text-center py-8" style={{ color: 'var(--mid)' }}>Select an event to view picks.</p>
      ) : loading ? (
        <p className="font-cormorant italic text-sm text-center py-8" style={{ color: 'var(--mid)' }}>Loading…</p>
      ) : !sortedPicks.length ? (
        <p className="font-cormorant italic text-sm text-center py-8" style={{ color: 'var(--mid)' }}>No picks submitted for this event yet.</p>
      ) : (
        <div className="space-y-1.5">
          {sortedPicks.map(row => {
            const open = expandedId === row.id;
            const pj = row.picks_json || {};
            const riderCount = (pj.riders || []).length;
            const teamCount = (pj.teams || []).length;
            return (
              <div key={row.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(180,149,48,0.15)' }}>
                <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                  style={{ background: open ? 'rgba(180,149,48,0.08)' : 'rgba(255,255,255,0.02)' }}
                  onClick={() => open ? setExpandedId(null) : startEdit(row)}>
                  <div className="flex-1 min-w-0">
                    <div className="font-cormorant text-sm" style={{ color: 'var(--cream)' }}>
                      {row.username || row.user_email}
                    </div>
                    <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9 }}>
                      {roomName(row.room_id)} · {riderCount} rider{riderCount !== 1 ? 's' : ''} · {teamCount} team{teamCount !== 1 ? 's' : ''}
                      {pj.correctedByAdmin && <span style={{ color: 'var(--gold-lt)' }}> · admin-edited</span>}
                    </div>
                  </div>
                  {open ? <ChevronUp size={14} style={{ color: 'var(--mid)' }} /> : <ChevronDown size={14} style={{ color: 'var(--mid)' }} />}
                </div>

                {open && (
                  <div className="p-3" style={{ background: '#0d0c09', borderTop: '1px solid rgba(42,40,32,0.4)' }}>
                    {unresolvedCount > 0 && (
                      <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded"
                        style={{ background: 'rgba(139,26,26,0.15)', border: '1px solid rgba(224,112,112,0.4)' }}>
                        <AlertTriangle size={14} style={{ color: '#e07070', flexShrink: 0 }} />
                        <span className="font-cormorant text-xs" style={{ color: '#e07070' }}>
                          {unresolvedCount} saved pick{unresolvedCount !== 1 ? 's' : ''} couldn't be matched to current event data
                          (possibly still loading). <strong>Do not save</strong> — it would permanently erase {unresolvedCount === 1 ? 'that pick' : 'those picks'}. Close this row and reopen it in a moment.
                        </span>
                      </div>
                    )}
                    <div className="mb-3">
                      <div className="font-cinzel text-xs mb-1.5" style={{ color: 'var(--gold)', fontSize: 9, letterSpacing: '0.1em' }}>GP RIDERS</div>
                      {editTeam.length === 0 && <p className="font-cormorant italic text-xs" style={{ color: 'var(--mid)' }}>None selected</p>}
                      {editTeam.map(({ rider, isCpt }) => (
                        <div key={rider.id} className="flex items-center gap-2 py-1">
                          {isCpt && <span className="font-cinzel text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(180,149,48,0.15)', color: 'var(--gold)', fontSize: 8 }}>CPT</span>}
                          <div className="flex-1 font-cormorant text-sm" style={{ color: isCpt ? 'var(--gold-lt)' : 'var(--cream)' }}>{rider.name}</div>
                          <div className="text-xs" style={{ color: 'var(--mid)' }}>{fmt(getSalary({ rider, isCpt }))}</div>
                          {!isCpt && <button onClick={() => makeCpt(rider.id)} className="font-cinzel text-xs px-1.5 py-0.5 rounded" style={{ border: '1px solid rgba(180,149,48,0.3)', color: 'var(--gold-lt)', fontSize: 8 }}>MAKE CPT</button>}
                          <button onClick={() => removeRider(rider.id)}><X size={12} style={{ color: 'var(--mid)' }} /></button>
                        </div>
                      ))}
                    </div>

                    <div className="mb-3">
                      <div className="font-cinzel text-xs mb-1.5" style={{ color: '#6aad8a', fontSize: 9, letterSpacing: '0.1em' }}>MLSJ TEAMS</div>
                      {editTeamPicks.length === 0 && <p className="font-cormorant italic text-xs" style={{ color: 'var(--mid)' }}>None selected</p>}
                      {editTeamPicks.map(t => (
                        <div key={t.id} className="flex items-center gap-2 py-1">
                          <div className="flex-1 font-cormorant text-sm" style={{ color: 'var(--cream)' }}>{t.name}</div>
                          <div className="text-xs" style={{ color: 'var(--mid)' }}>{fmt(t.salary)}</div>
                          <button onClick={() => removeTeam(t.id)}><X size={12} style={{ color: 'var(--mid)' }} /></button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mb-3 px-2 py-1.5 rounded" style={{ background: 'rgba(180,149,48,0.05)' }}>
                      <span className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9 }}>TOTAL SPENT</span>
                      <span className="font-cormorant text-sm font-bold" style={{ color: totalSpent() > MLSJ_CAP ? '#e07070' : 'var(--gold-lt)' }}>{fmt(totalSpent())}</span>
                      {totalSpent() > MLSJ_CAP && <AlertTriangle size={13} style={{ color: '#e07070' }} />}
                    </div>

                    <div className="flex gap-1.5 mb-2">
                      {['riders', 'teams'].map(v => (
                        <button key={v} onClick={() => { setView(v); setSearch(''); }}
                          className="flex-1 py-1.5 rounded font-cinzel text-xs"
                          style={{ background: view === v ? 'rgba(180,149,48,0.12)' : 'none', border: `1px solid ${view === v ? 'rgba(180,149,48,0.4)' : 'var(--ep-border)'}`, color: view === v ? 'var(--gold)' : 'var(--mid)', fontSize: 9, letterSpacing: '0.08em' }}>
                          ADD {v.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded mb-2" style={{ background: 'var(--ep-card)', border: '1px solid var(--ep-border)' }}>
                      <Search size={12} style={{ color: 'var(--mid)' }} />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                        className="flex-1 text-xs outline-none bg-transparent" style={{ color: 'var(--ep-text)' }} />
                    </div>
                    <div className="max-h-48 overflow-y-auto mb-3 rounded" style={{ border: '1px solid rgba(42,40,32,0.4)' }}>
                      {view === 'riders' ? filteredRiders.map(rider => {
                        const already = editTeam.find(r => r.rider.id === rider.id);
                        return (
                          <div key={rider.id} onClick={() => !already && addRider(rider)}
                            className="flex items-center gap-2 px-2 py-1.5"
                            style={{ borderBottom: '1px solid rgba(42,40,32,0.3)', opacity: already ? 0.35 : 1, cursor: already ? 'default' : 'pointer' }}>
                            <div className="flex-1 font-cormorant text-sm" style={{ color: 'var(--cream)' }}>{rider.name}</div>
                            <div className="text-xs" style={{ color: 'var(--mid)' }}>{fmt(rider.salary)}</div>
                          </div>
                        );
                      }) : filteredTeams.map(t => {
                        const already = editTeamPicks.find(p => p.id === t.id);
                        return (
                          <div key={t.id} onClick={() => !already && addTeam(t)}
                            className="flex items-center gap-2 px-2 py-1.5"
                            style={{ borderBottom: '1px solid rgba(42,40,32,0.3)', opacity: already ? 0.35 : 1, cursor: already ? 'default' : 'pointer' }}>
                            <div className="flex-1 font-cormorant text-sm" style={{ color: 'var(--cream)' }}>{t.name}</div>
                            <div className="text-xs" style={{ color: 'var(--mid)' }}>{fmt(t.salary)}</div>
                          </div>
                        );
                      })}
                    </div>

                    {saveMsg && (
                      <p className="font-cormorant italic text-sm mb-2" style={{ color: saveMsg.success ? '#4caf7d' : '#e07070' }}>
                        {saveMsg.success ? '✓ Saved' : saveMsg.msg || 'Save failed'}
                      </p>
                    )}
                    <button onClick={() => saveEdit(row)} disabled={saving || unresolvedCount > 0}
                      className="w-full py-2.5 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2"
                      style={{
                        background: unresolvedCount > 0 ? 'rgba(224,112,112,0.15)' : saving ? 'rgba(180,149,48,0.1)' : 'var(--gold)',
                        color: unresolvedCount > 0 ? '#e07070' : saving ? 'var(--mid)' : 'var(--ink)',
                        cursor: unresolvedCount > 0 ? 'not-allowed' : 'pointer',
                      }}>
                      <Save size={12} />
                      {unresolvedCount > 0 ? 'BLOCKED — UNRESOLVED PICKS' : saving ? 'SAVING…' : 'SAVE CORRECTED PICKS'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
