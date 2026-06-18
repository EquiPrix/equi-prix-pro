import React, { useState, useMemo } from 'react';
import { useEquiPrix, GENERAL_ROOM_ID } from '@/lib/EquiPrixContext';
import { useAuth } from '@/lib/AuthContext';
import { sbFetch, fmt, getBand, CAP, CPT_PREMIUM } from '@/lib/equiprix-data';
import { Search, X, ChevronDown } from 'lucide-react';
import RiderRow from './RiderRow';
import TeamSlot from './TeamSlot';
import ScoringPanel from './ScoringPanel';

const SLOT_IDS = ['cpt', 'r1', 'r2', 'r3', 'r4'];

export default function DraftTab() {
  const {
    currentEvent, userCode, userName, team, setTeam, teamPicks, setTeamPicks, riders, teams, showToast,
    currentDestination, setCurrentDestination, destinations, generalOptedOut, setGeneralOptOut,
  } = useEquiPrix();
  const { user } = useAuth();
  const identity = user?.email || userCode;
  const [view, setView] = useState('riders');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDestPicker, setShowDestPicker] = useState(false);

  const ev = currentEvent;

  // In 'preview' mode everything is practice — nothing actually locks
  // In 'teams' mode: team picks open AND rider picks open against the
  // preview rider pool (official GP start list isn't announced yet, but
  // people can budget/draft against expected riders — picks carry over
  // by rider id once the real list lands)
  // In 'riders' mode: rider picks open against the real GP list, teams
  // already locked
  const isTeamLocked = () => {
    if (!ev) return true;
    if (ev.status === 'preview') return false; // practice mode, allow editing
    return new Date() >= new Date(ev.teamLockISO);
  };
  const isRiderLocked = () => {
    if (!ev) return true;
    if (ev.status === 'preview') return false; // practice mode, allow editing
    if (ev.status === 'teams') return false;   // preview riders open for drafting
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
    const newTeam = [...team, { rider, slotId: nextSlot, isCpt }];
    setTeam(newTeam);
    showToast(rider.name + (isCpt ? ' — set as captain!' : ' added'));
    savePicks(newTeam, teamPicks);
  };

  const removeRider = (id) => {
    if (isRiderLocked()) { showToast('Rider picks are locked'); return; }
    const newTeam = team.filter(r => r.rider.id !== id).map((r, i) => ({ ...r, slotId: SLOT_IDS[i], isCpt: i === 0 }));
    setTeam(newTeam);
    savePicks(newTeam, teamPicks);
  };

  const makeCpt = (id) => {
    const idx = team.findIndex(r => r.rider.id === id);
    const newTeam = [...team];
    const [cpt] = newTeam.splice(idx, 1);
    newTeam.unshift(cpt);
    const reindexed = newTeam.map((r, i) => ({ ...r, slotId: SLOT_IDS[i], isCpt: i === 0 }));
    setTeam(reindexed);
    showToast(cpt.rider.name + ' is your captain — 1.5×');
    savePicks(reindexed, teamPicks);
  };

  const addTeam = (t) => {
    if (isTeamLocked()) { showToast('Team picks are locked'); return; }
    if (teamPicks.find(p => p.id === t.id)) return;
    if (teamPicks.length >= 2) { showToast('Already have 2 teams'); return; }
    if (totalSpent() + t.salary > CAP) { showToast('Not enough cap space'); return; }
    const newPicks = [...teamPicks, { ...t, slotId: 't' + (teamPicks.length + 1) }];
    setTeamPicks(newPicks);
    showToast(t.name + ' added');
    savePicks(team, newPicks);
  };

  const removeTeam = (id) => {
    if (isTeamLocked()) { showToast('Team picks are locked'); return; }
    const newPicks = teamPicks.filter(t => t.id !== id).map((t, i) => ({ ...t, slotId: 't' + (i + 1) }));
    setTeamPicks(newPicks);
    savePicks(team, newPicks);
  };

  const savePicks = async (t = team, tp = teamPicks) => {
    if (!identity || !ev) return;
    setSaving(true);
    const spent = t.reduce((s, r) => s + (r.isCpt ? r.rider.salary + CPT_PREMIUM : r.rider.salary), 0) +
      tp.reduce((s, pk) => s + pk.salary, 0);
    try {
      await sbFetch('picks?on_conflict=user_email,event,room_id', {
        method: 'POST',
        body: JSON.stringify({
          user_email: identity,
          event: ev.id,
          room_id: currentDestination || GENERAL_ROOM_ID,
          username: userName || identity,
          picks_json: {
            riders: t.map(r => ({ id: r.rider.id, isCpt: r.isCpt })),
            teams: tp.map(pk => ({ id: pk.id })),
            totalSpent: spent,
            isPractice: ev.status === 'preview',
            // Preserve the General opt-out flag if this destination is
            // General — it lives on the same row as picks_json.
            ...((currentDestination || GENERAL_ROOM_ID) === GENERAL_ROOM_ID ? { optedOutOfGeneral: generalOptedOut } : {}),
            savedAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error('savePicks failed:', e);
      showToast('Could not save picks — try again');
    }
    setSaving(false);
  };

  const clearAll = () => {
    setTeam([]);
    if (!isTeamLocked()) setTeamPicks([]);
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
              placeholder={view === 'riders' ? 'Search…' : 'Search…'}
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
                      <div className="text-xs" style={{ color: 'var(--mid)' }}>{fmt(t.salary)}</div>
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
      <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: '45%', background: '#0d0c09' }}>

        {/* Cap bar */}
        <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--ep-border)', position: 'relative' }}>
          <div className="flex items-center justify-between mb-1">
            <button
              onClick={() => destinations.length > 1 && setShowDestPicker(p => !p)}
              className="flex items-center gap-1 font-cinzel text-xs"
              style={{ color: 'var(--gold)', letterSpacing: '0.12em', cursor: destinations.length > 1 ? 'pointer' : 'default' }}
            >
              {(destinations.find(d => d.id === currentDestination)?.name || 'MY TEAM').toUpperCase()}
              {destinations.length > 1 && <ChevronDown size={12} style={{ color: 'var(--gold)' }} />}
            </button>
            <button onClick={clearAll} className="text-xs underline" style={{ color: 'var(--mid)' }}>Clear</button>
          </div>

          {/* Destination dropdown — only meaningful if the user has at
              least one room for this event; otherwise General is the
              only option and this never renders. */}
          {showDestPicker && destinations.length > 1 && (
            <div className="absolute left-3 top-9 z-20 rounded shadow-lg overflow-hidden"
              style={{ background: '#15130f', border: '1px solid rgba(180,149,48,0.3)', minWidth: 220 }}>
              {destinations.map(d => (
                <button
                  key={d.id ?? 'general'}
                  onClick={() => { setCurrentDestination(d.id); setShowDestPicker(false); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left font-cormorant text-sm transition-all"
                  style={{
                    background: d.id === currentDestination ? 'rgba(180,149,48,0.12)' : 'transparent',
                    color: d.id === currentDestination ? 'var(--gold-lt)' : 'var(--cream)',
                    borderBottom: '1px solid rgba(42,40,32,0.5)',
                  }}
                >
                  <span>{d.name}</span>
                  {d.id === currentDestination && <span style={{ color: '#4caf7d', fontSize: 11 }}>✓</span>}
                </button>
              ))}
              <label className="flex items-center gap-2 px-3 py-2 font-cormorant text-xs italic cursor-pointer"
                style={{ color: 'var(--mid)' }}>
                <input
                  type="checkbox"
                  checked={!generalOptedOut}
                  onChange={e => setGeneralOptOut(identity, ev, !e.target.checked)}
                  style={{ accentColor: 'var(--gold)' }}
                />
                Include me in General Leaderboard
              </label>
            </div>
          )}

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
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs" style={{ color: 'var(--mid)' }}>
              {saving
                ? '↑ Saving…'
                : team.length + teamPicks.length > 0
                  ? `${team.length} rider${team.length !== 1 ? 's' : ''} · ${teamPicks.length} team${teamPicks.length !== 1 ? 's' : ''} · auto-saved`
                  : 'Empty'
              }
            </span>
          </div>
        </div>

        {/* Roster slots */}
        <div className="flex-1 overflow-y-auto px-2 py-2 pb-20">

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