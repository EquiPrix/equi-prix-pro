import React, { useState, useMemo, useEffect } from 'react';
import { useEquiPrix, GENERAL_ROOM_ID } from '@/lib/EquiPrixContext';
import { useAuth } from '@/lib/AuthContext';
import { sbFetch, fmt, getBand, CAP, CPT_PREMIUM } from '@/lib/equiprix-data';
import { loadStartListRemote } from '@/lib/startListStore';
import { Search, X, Save } from 'lucide-react';
import RiderRow from './RiderRow';
import TeamSlot from './TeamSlot';
import ScoringPanel from './ScoringPanel';

const SLOT_IDS = ['cpt', 'r1', 'r2', 'r3', 'r4'];

// Modal shown when user hits Save — lets them choose which destinations
// to save to (General + any rooms they're in for this event).
function SaveConfirmModal({ destinations, onConfirm, onCancel, saving }) {
  const [checked, setChecked] = useState(() => {
    const init = {};
    destinations.forEach(d => { init[d.id] = true; });
    return init;
  });

  const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const anyChecked = Object.values(checked).some(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl p-5"
        style={{ background: 'var(--ep-card)', border: '1px solid rgba(180,149,48,0.3)' }}
        onClick={e => e.stopPropagation()}>

        <div className="font-cinzel text-xs tracking-widest mb-1" style={{ color: 'var(--gold)', fontSize: 10 }}>
          SAVE PICKS TO
        </div>
        <p className="font-cormorant italic text-sm mb-4" style={{ color: 'var(--mid)' }}>
          Choose which leaderboards to enter. All are selected by default.
        </p>

        <div className="space-y-2 mb-5">
          {destinations.map(d => (
            <label key={d.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
              style={{
                background: checked[d.id] ? 'rgba(180,149,48,0.08)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${checked[d.id] ? 'rgba(180,149,48,0.35)' : 'var(--ep-border)'}`,
              }}>
              <input type="checkbox" checked={!!checked[d.id]} onChange={() => toggle(d.id)}
                style={{ accentColor: 'var(--gold)', width: 15, height: 15, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <div className="font-cormorant text-sm font-semibold truncate"
                  style={{ color: checked[d.id] ? 'var(--gold-lt)' : 'var(--cream)' }}>
                  {d.name}
                </div>
                {d.id === GENERAL_ROOM_ID && (
                  <div className="font-cormorant italic text-xs" style={{ color: 'var(--mid)' }}>
                    Open leaderboard — all players
                  </div>
                )}
                {d.id !== GENERAL_ROOM_ID && d.prize_description && (
                  <div className="font-cormorant italic text-xs truncate" style={{ color: 'var(--gold-lt)' }}>
                    🏆 {d.prize_description}
                  </div>
                )}
              </div>
              {checked[d.id] && (
                <span style={{ color: '#4caf7d', fontSize: 16, flexShrink: 0 }}>✓</span>
              )}
            </label>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} disabled={saving}
            className="flex-1 py-2.5 rounded font-cinzel text-xs tracking-widest"
            style={{ border: '1px solid var(--ep-border)', color: 'var(--mid)', background: 'none' }}>
            CANCEL
          </button>
          <button
            onClick={() => onConfirm(Object.entries(checked).filter(([, v]) => v).map(([id]) => id))}
            disabled={saving || !anyChecked}
            className="flex-1 py-2.5 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2"
            style={{
              background: anyChecked ? 'var(--gold)' : 'rgba(180,149,48,0.2)',
              color: anyChecked ? 'var(--ink)' : 'var(--mid)',
              opacity: saving ? 0.7 : 1,
            }}>
            <Save size={12} />
            {saving ? 'SAVING…' : 'CONFIRM & SAVE'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DraftTab() {
  const {
    currentEvent, userCode, userName, team, setTeam, teamPicks, setTeamPicks, riders, teams, showToast,
    destinations,
  } = useEquiPrix();
  const { user } = useAuth();
  const identity = user?.email || userCode;
  const [view, setView] = useState('riders');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [teamPairsR1, setTeamPairsR1] = useState({});

  const ev = currentEvent;

  useEffect(() => {
    if (!ev?.id) return;
    loadStartListRemote(ev.id).then(data => {
      setTeamPairsR1(data?.teamPairs || {});
    });
  }, [ev?.id]);

  // Reset dirty flag when event changes
  useEffect(() => { setDirty(false); }, [ev?.id]);

  const isTeamLocked = () => {
    if (!ev) return true;
    if (ev.status === 'preview') return false;
    return new Date() >= new Date(ev.teamLockISO);
  };
  const isRiderLocked = () => {
    if (!ev) return true;
    if (ev.status === 'preview') return false;
    if (ev.status === 'teams') return false;
    return new Date() >= new Date(ev.gpLockISO);
  };

  const getSalary = (entry) => entry.isCpt ? entry.rider.salary + CPT_PREMIUM : entry.rider.salary;
  const totalSpent = () => team.reduce((s, r) => s + getSalary(r), 0) + teamPicks.reduce((s, t) => s + t.salary, 0);
  const capRemaining = CAP - totalSpent();

  const filteredRiders = useMemo(() => {
    const sorted = [...riders].sort((a, b) => a.rank - b.rank);
    return sorted.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.nat.toLowerCase().includes(search.toLowerCase()));
  }, [riders, search]);

  const filteredTeams = useMemo(() => {
    const sorted = [...teams].sort((a, b) => a.rank - b.rank);
    return sorted.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));
  }, [teams, search]);

  const addRider = (rider) => {
    if (isRiderLocked()) { showToast('Rider picks are locked'); return; }
    if (team.find(r => r.rider.id === rider.id)) return;
    if (team.length >= 5) { showToast('Team full — remove a rider first'); return; }
    if (totalSpent() + rider.salary > CAP) { showToast('Not enough cap space'); return; }
    const usedSlots = team.map(r => r.slotId);
    const nextSlot = SLOT_IDS.find(s => !usedSlots.includes(s));
    const isCpt = nextSlot === 'cpt';
    setTeam([...team, { rider, slotId: nextSlot, isCpt }]);
    showToast(rider.name + (isCpt ? ' — set as captain!' : ' added'));
    setDirty(true);
  };

  const removeRider = (id) => {
    if (isRiderLocked()) { showToast('Rider picks are locked'); return; }
    setTeam(team.filter(r => r.rider.id !== id).map((r, i) => ({ ...r, slotId: SLOT_IDS[i], isCpt: i === 0 })));
    setDirty(true);
  };

  const makeCpt = (id) => {
    const idx = team.findIndex(r => r.rider.id === id);
    const newTeam = [...team];
    const [cpt] = newTeam.splice(idx, 1);
    newTeam.unshift(cpt);
    const reindexed = newTeam.map((r, i) => ({ ...r, slotId: SLOT_IDS[i], isCpt: i === 0 }));
    setTeam(reindexed);
    showToast(cpt.rider.name + ' is your captain — 1.5×');
    setDirty(true);
  };

  const addTeam = (t) => {
    if (isTeamLocked()) { showToast('Team picks are locked'); return; }
    if (teamPicks.find(p => p.id === t.id)) return;
    if (teamPicks.length >= 2) { showToast('Already have 2 teams'); return; }
    if (totalSpent() + t.salary > CAP) { showToast('Not enough cap space'); return; }
    setTeamPicks([...teamPicks, { ...t, slotId: 't' + (teamPicks.length + 1) }]);
    showToast(t.name + ' added');
    setDirty(true);
  };

  const removeTeam = (id) => {
    if (isTeamLocked()) { showToast('Team picks are locked'); return; }
    setTeamPicks(teamPicks.filter(t => t.id !== id).map((t, i) => ({ ...t, slotId: 't' + (i + 1) })));
    setDirty(true);
  };

  // Save to one specific destination (room_id)
  const saveToDestination = async (destId, t, tp) => {
    const spent = t.reduce((s, r) => s + (r.isCpt ? r.rider.salary + CPT_PREMIUM : r.rider.salary), 0) +
      tp.reduce((s, pk) => s + pk.salary, 0);
    await sbFetch('picks?on_conflict=user_email,event,room_id', {
      method: 'POST',
      body: JSON.stringify({
        user_email: identity,
        event: ev.id,
        room_id: destId,
        username: userName || identity,
        picks_json: {
          riders: t.map(r => ({ id: r.rider.id, isCpt: r.isCpt })),
          teams: tp.map(pk => ({ id: pk.id })),
          totalSpent: spent,
          isPractice: ev.status === 'preview',
          savedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
    });
  };

  // Called when user confirms the modal — saves to each checked destination
  const handleConfirmSave = async (selectedIds) => {
    if (!identity || !ev || !selectedIds.length) return;
    setSaving(true);
    try {
      await Promise.all(selectedIds.map(id => saveToDestination(id, team, teamPicks)));
      setDirty(false);
      setShowSaveModal(false);
      const names = selectedIds.map(id => destinations.find(d => d.id === id)?.name || 'General').join(', ');
      showToast('Picks saved to ' + names);
    } catch (e) {
      console.error('savePicks failed:', e);
      showToast('Could not save picks — try again');
    }
    setSaving(false);
  };

  const clearAll = () => {
    setTeam([]);
    if (!isTeamLocked()) setTeamPicks([]);
    setDirty(false);
  };

  if (!ev) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--mid)' }}>
        <p className="font-cormorant text-lg italic">Select an event to begin</p>
      </div>
    );
  }

  const isDraftable = ['preview', 'teams', 'riders', 'open'].includes(ev.status);
  const isPractice = ev.status === 'preview';
  const isPreviewRiderPool = ev.status === 'teams' && !ev.gpRiders?.length;

  if (!isDraftable) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="text-5xl">{ev.status === 'past' ? '🏆' : '⏳'}</div>
        <div className="font-cormorant text-2xl font-bold" style={{ color: 'var(--cream)' }}>
          {ev.flag} {ev.city}
        </div>
        <div className="font-cormorant text-lg italic" style={{ color: 'rgba(242,237,226,0.5)' }}>
          {ev.status === 'past' ? 'Event complete — view results in the Results tab' :
            'Draft opens closer to the event'}
        </div>
        <div className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)' }}>
          {ev.dateLabel}
        </div>
      </div>
    );
  }

  const capColor = capRemaining < 0 ? 'var(--crimson)' : capRemaining < 8000 ? '#e88a3a' : '#4caf7d';

  const practiceBanner = isPractice ? (
    <div className="flex items-start gap-2 px-3 py-2 text-xs font-cormorant italic flex-shrink-0"
      style={{ background: 'rgba(61,90,76,0.15)', borderBottom: '1px solid rgba(61,90,76,0.3)', color: '#6aad8a' }}>
      <span>⚡ <strong>Practice mode</strong> — start lists not yet confirmed. Draft freely to plan your budget. Picks are saved but won't count until the official draft opens.</span>
    </div>
  ) : isPreviewRiderPool && view === 'teams' ? (
    <div className="flex items-start gap-2 px-3 py-2 text-xs font-cormorant italic flex-shrink-0"
      style={{ background: 'rgba(61,90,76,0.15)', borderBottom: '1px solid rgba(61,90,76,0.3)', color: '#6aad8a' }}>
      <span>✓ <strong>Team Draft picks are live</strong> — First Round Rider/Horse combos will be announced the night before.</span>
    </div>
  ) : isPreviewRiderPool ? (
    <div className="flex items-start gap-2 px-3 py-2 text-xs font-cormorant italic flex-shrink-0"
      style={{ background: 'rgba(180,149,48,0.1)', borderBottom: '1px solid rgba(180,149,48,0.25)', color: 'var(--gold-lt)' }}>
      <span>📋 <strong>Expected riders</strong> — the official GP start list is announced the night before. Draft now against the expected field; your picks carry over automatically once the real list is confirmed.</span>
    </div>
  ) : null;

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden" style={{ background: 'var(--ink)' }}>

      {showSaveModal && (
        <SaveConfirmModal
          destinations={destinations}
          onConfirm={handleConfirmSave}
          onCancel={() => setShowSaveModal(false)}
          saving={saving}
        />
      )}

      {/* LEFT PANEL — Pool */}
      <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: '55%', borderRight: '1px solid var(--ep-border)' }}>

        {practiceBanner}

        {/* View toggle */}
        <div className="flex gap-1.5 px-2 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--ep-border)', background: '#0d0c09' }}>
          {['riders', 'teams'].map(v => (
            <button
              key={v}
              onClick={() => { setView(v); setSearch(''); }}
              className="flex-1 py-1.5 rounded font-cinzel text-xs transition-all"
              style={{
                background: view === v ? 'rgba(180,149,48,0.12)' : 'none',
                border: `1px solid ${view === v ? 'rgba(180,149,48,0.4)' : 'transparent'}`,
                color: view === v ? 'var(--gold)' : 'var(--mid)',
                letterSpacing: '0.08em',
              }}
            >
              {v === 'riders' ? 'RIDERS' : 'TEAMS'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-2 py-1.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--ep-border)' }}>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: 'var(--ep-card)', border: '1px solid var(--ep-border)' }}>
            <Search size={12} style={{ color: 'var(--mid)', flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 text-xs outline-none bg-transparent"
              style={{ color: 'var(--ep-text)' }}
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X size={11} style={{ color: 'var(--mid)' }} />
              </button>
            )}
          </div>
        </div>

        {/* Pool list */}
        <div className="flex-1 overflow-y-auto pb-20">
          {view === 'riders' ? (
            <>
              {filteredRiders.length === 0 && (
                <div className="text-center py-8 font-cormorant text-base italic" style={{ color: 'var(--mid)' }}>
                  {riders.length === 0 ? 'Start list not yet announced' : 'No riders found'}
                </div>
              )}
              {filteredRiders.map(rider => {
                const inTeam = team.find(t => t.rider.id === rider.id);
                const maxed = team.length >= 5 && !inTeam;
                const canAfford = !inTeam && (totalSpent() + rider.salary <= CAP);
                const band = getBand(rider.rank);
                return (
                  <RiderRow
                    key={rider.id}
                    rider={rider}
                    band={band}
                    inTeam={!!inTeam}
                    unaffordable={(!canAfford || maxed) && !inTeam}
                    locked={isRiderLocked()}
                    onAdd={() => addRider(rider)}
                  />
                );
              })}
            </>
          ) : (
            <>
              {filteredTeams.map(t => {
                const picked = teamPicks.find(p => p.id === t.id);
                const maxed = teamPicks.length >= 2 && !picked;
                const canAfford = !picked && (totalSpent() + t.salary <= CAP);
                const locked = isTeamLocked();
                return (
                  <div
                    key={t.id}
                    onClick={() => !locked && !maxed && canAfford && !picked ? addTeam(t) : picked && !locked ? removeTeam(t.id) : null}
                    className="flex items-center gap-2 px-2 py-2 border-b transition-all"
                    style={{
                      borderColor: 'rgba(42,40,32,0.5)',
                      background: picked ? 'rgba(61,90,76,0.08)' : 'transparent',
                      opacity: ((maxed || !canAfford) && !picked) || locked ? 0.3 : 1,
                      cursor: locked ? 'default' : 'pointer',
                    }}
                  >
                    <div className="font-cormorant text-sm font-semibold w-5 text-center flex-shrink-0" style={{ color: t.rank <= 4 ? 'var(--gold)' : 'var(--mid)' }}>
                      {t.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-cormorant text-sm font-semibold truncate" style={{ color: 'var(--cream)' }}>{t.name}</div>
                      {(() => {
                        const r1 = teamPairsR1[t.id]?.r1;
                        if (!r1 || (!r1[0]?.name && !r1[1]?.name)) {
                          return <div className="text-xs" style={{ color: 'var(--mid)' }}>{fmt(t.salary)}</div>;
                        }
                        return (
                          <>
                            <div className="text-xs" style={{ color: 'var(--mid)' }}>{fmt(t.salary)}</div>
                            {r1.filter(p => p?.name).map((p, i) => (
                              <div key={i} className="font-cormorant text-xs truncate mt-0.5" style={{ color: 'var(--gold-lt)', fontStyle: 'italic' }}>
                                {p.name}{p.horse ? <span style={{ color: 'var(--mid)' }}> / {p.horse}</span> : ''}
                              </div>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                    {picked && <div className="text-xs flex-shrink-0" style={{ color: '#4caf7d' }}>✓</div>}
                    {locked && <div className="text-xs flex-shrink-0" style={{ color: 'var(--mid)' }}>🔒</div>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — My Roster */}
         <div className="flex flex-col overflow-hidden" style={{ width: '45%', background: '#0d0c09', height: '100%' }}>

        {/* Cap bar */}
        <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--ep-border)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-cinzel text-xs" style={{ color: 'var(--gold)', letterSpacing: '0.12em' }}>MY TEAM</span>
            <button onClick={clearAll} className="text-xs underline" style={{ color: 'var(--mid)' }}>Clear</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--ep-border)' }}>
              <div className="h-1 rounded-full transition-all" style={{
                width: Math.min(100, (totalSpent() / CAP) * 100) + '%',
                background: capRemaining < 0 ? 'var(--crimson)' : capRemaining < 8000 ? '#e88a3a' : 'var(--gold)'
              }} />
            </div>
            <span className="font-cormorant text-sm font-bold flex-shrink-0" style={{ color: capColor }}>
              {fmt(capRemaining)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
  <span className="text-xs" style={{ color: dirty ? '#e88a3a' : 'var(--mid)' }}>
    {team.length + teamPicks.length === 0
      ? 'Empty'
      : dirty
        ? '● Unsaved changes'
        : `${team.length} rider${team.length !== 1 ? 's' : ''} · ${teamPicks.length} team${teamPicks.length !== 1 ? 's' : ''} · saved`
    }
  </span>
       <button
    onClick={() => setShowSaveModal(true)}
    disabled={saving || team.length + teamPicks.length === 0}
    className="flex items-center gap-1.5 px-3 py-1 rounded font-cinzel text-xs tracking-widest transition-all"
    style={{
      background: dirty ? 'var(--gold)' : 'rgba(180,149,48,0.1)',
      color: dirty ? 'var(--ink)' : 'var(--mid)',
      border: dirty ? 'none' : '1px solid rgba(180,149,48,0.2)',
      opacity: saving || team.length + teamPicks.length === 0 ? 0.4 : 1,
      fontSize: 9,
    }}>
    <Save size={10} />
    {saving ? 'SAVING…' : dirty ? 'SAVE' : 'SAVED'}
                </button>
             </div>
        </div>

        {/* Roster slots */}
        <div className="flex-1 overflow-y-auto px-2 py-2 pb-4">

          {/* Captain */}
          <div className="mb-2">
            <div className="font-cinzel text-xs mb-1" style={{ color: 'var(--mid)', letterSpacing: '0.1em', fontSize: 9 }}>
              CAPTAIN · 1.5× · +$1k
            </div>
            <TeamSlot
              entry={team.find(r => r.slotId === 'cpt')}
              isCpt={true}
              onRemove={removeRider}
              isLocked={isRiderLocked()}
            />
          </div>

          {/* Riders */}
          <div className="mb-2">
            <div className="font-cinzel text-xs mb-1" style={{ color: 'var(--mid)', letterSpacing: '0.1em', fontSize: 9 }}>
              RIDERS
            </div>
            {['r1', 'r2', 'r3', 'r4'].map(sid => (
              <div key={sid} className="mb-1">
                <TeamSlot
                  entry={team.find(r => r.slotId === sid)}
                  isCpt={false}
                  onRemove={removeRider}
                  onMakeCpt={makeCpt}
                  isLocked={isRiderLocked()}
                />
              </div>
            ))}
          </div>

          {/* GCL Teams */}
          <div className="mb-3">
            <div className="font-cinzel text-xs mb-1" style={{ color: '#6aad8a', letterSpacing: '0.1em', fontSize: 9 }}>
              GCL TEAMS
            </div>
            {['t1', 't2'].map((sid, i) => {
              const pick = teamPicks.find(t => t.slotId === sid);
              return (
                <div key={sid} className="flex items-center gap-1.5 p-1.5 mb-1 rounded" style={{
                  background: pick ? 'rgba(61,90,76,0.1)' : 'transparent',
                  border: `1px ${pick ? 'solid' : 'dashed'} rgba(61,90,76,0.4)`,
                  minHeight: 36
                }}>
                  <span className="text-xs px-1 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(61,90,76,0.3)', color: '#6aad8a', fontSize: 9 }}>T</span>
                  {pick ? (
                    <>
                      <span className="flex-1 text-xs font-semibold truncate" style={{ color: 'var(--cream)', fontSize: 11 }}>{pick.name}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--mid)', fontSize: 10 }}>{fmt(pick.salary)}</span>
                      {!isTeamLocked() && (
                        <button onClick={() => removeTeam(pick.id)} className="flex-shrink-0" style={{ color: 'var(--mid)' }}>
                          <X size={11} />
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs italic" style={{ color: 'var(--mid)', fontSize: 10 }}>
                      {isTeamLocked() ? 'Locked' : `Team ${i + 1}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <ScoringPanel />
        </div>
      </div>
    </div>
  );
}