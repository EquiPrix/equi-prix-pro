import React, { useState, useEffect, useMemo } from 'react';
import {
  EVENTS_2026, GCL_TEAMS_2026, PREVIEW_RIDERS_2026,
  sbFetch, calcEventRiderSalaries, CAP, CPT_PREMIUM, fmt,
} from '@/lib/equiprix-data';
import { ChevronDown, ChevronUp, Save, X, Search, AlertTriangle } from 'lucide-react';

const GENERAL_ROOM_ID = '00000000-0000-0000-0000-000000000000';
const SLOT_IDS = ['cpt', 'r1', 'r2', 'r3', 'r4'];

export default function PicksEditor() {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [rooms, setRooms] = useState([]);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  // Draft state for whichever row is currently expanded
  const [editTeam, setEditTeam] = useState([]);       // [{ rider, slotId, isCpt }]
  const [editTeamPicks, setEditTeamPicks] = useState([]); // [{ ...gclTeam, slotId }]
  const [search, setSearch] = useState('');
  const [view, setView] = useState('riders');

  const selectedEvent = EVENTS_2026.find(e => e.id === selectedEventId);

  useEffect(() => {
    if (selectedEventId) loadPicks();
  }, [selectedEventId]);

  const loadPicks = async () => {
    setLoading(true);
    setExpandedId(null);
    try {
      const [picksRows, roomList] = await Promise.all([
        sbFetch('picks?select=id,user_email,username,room_id,picks_json,updated_at&event=eq.' + selectedEventId) || [],
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

  // Same rider pool logic used by DraftTab / EquiPrixContext, so admin
  // edits use the identical salary/rank data players see.
  const evRiders = useMemo(() => {
    if (!selectedEvent) return [];
    const all = [
      ...(selectedEvent.gpRiders || []),
      ...(selectedEvent.previewRiders || []),
      ...(selectedEvent.riders || []),
      ...PREVIEW_RIDERS_2026,
    ];
    const seen = new Set();
    const deduped = all.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
    return calcEventRiderSalaries(deduped);
  }, [selectedEvent]);

  const evTeams = selectedEvent?.teams?.length ? selectedEvent.teams : GCL_TEAMS_2026;

  const filteredRiders = useMemo(() => {
    const sorted = [...evRiders].sort((a, b) => a.rank - b.rank);
    return sorted.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  }, [evRiders, search]);

  const filteredTeams = useMemo(() => {
    const sorted = [...evTeams].sort((a, b) => a.rank - b.rank);
    return sorted.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));
  }, [evTeams, search]);

  const getSalary = (entry) => entry.isCpt ? entry.rider.salary + CPT_PREMIUM : entry.rider.salary;
  const totalSpent = () => editTeam.reduce((s, r) => s + getSalary(r), 0) + editTeamPicks.reduce((s, t) => s + t.salary, 0);

  const startEdit = (row) => {
    const pj = row.picks_json || {};
    const newTeam = [];
    (pj.riders || []).forEach(s => {
      const rider = evRiders.find(r => r.id === s.id);
      if (rider) newTeam.push({ rider, slotId: SLOT_IDS[newTeam.length], isCpt: !!s.isCpt });
    });
    const newTeamPicks = [];
    (pj.teams || []).forEach((s, i) => {
      const t = evTeams.find(t => t.id === s.id);
      if (t) newTeamPicks.push({ ...t, slotId: 't' + (i + 1) });
    });
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
    setEditTeamPicks([...editTeamPicks, { ...t, slotId: 't' + (editTeamPicks.length + 1) }]);
  };

  const removeTeam = (id) => {
    setEditTeamPicks(editTeamPicks.filter(t => t.id !== id).map((t, i) => ({ ...t, slotId: 't' + (i + 1) })));
  };

  const saveEdit = async (row) => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const spent = editTeam.reduce((s, r) => s + getSalary(r), 0) + editTeamPicks.reduce((s, t) => s + t.salary, 0);
      const existing = row.picks_json || {};
      await sbFetch('picks?on_conflict=user_email,event,room_id', {
        method: 'POST',
        body: JSON.stringify({
          user_email: row.user_email,
          event: selectedEventId,
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
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>PICKS</h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        View and correct any user's picks — works even after the draft has locked, since the lock is a player-facing convenience, not a hard permission.
      </p>

      <div className="mb-4">
        <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,149,48,0.2)', color: selectedEventId ? 'var(--cream)' : 'var(--mid)', borderRadius: 4, padding: '8px 12px', fontSize: 13, outline: 'none' }}>
          <option value="">— Select Event —</option>
          {EVENTS_2026.map(ev => <option key={ev.id} value={ev.id}>{ev.flag} {ev.city} · {ev.dates}</option>)}
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
                      <div className="font-cinzel text-xs mb-1.5" style={{ color: '#6aad8a', fontSize: 9, letterSpacing: '0.1em' }}>GCL TEAMS</div>
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
                      <span className="font-cormorant text-sm font-bold" style={{ color: totalSpent() > CAP ? '#e07070' : 'var(--gold-lt)' }}>{fmt(totalSpent())}</span>
                      {totalSpent() > CAP && <AlertTriangle size={13} style={{ color: '#e07070' }} />}
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
                    <button onClick={() => saveEdit(row)} disabled={saving}
                      className="w-full py-2.5 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2"
                      style={{ background: saving ? 'rgba(180,149,48,0.1)' : 'var(--gold)', color: saving ? 'var(--mid)' : 'var(--ink)' }}>
                      <Save size={12} />
                      {saving ? 'SAVING…' : 'SAVE CORRECTED PICKS'}
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