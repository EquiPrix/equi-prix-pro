import React, { useState, useMemo } from 'react';
import { useMlsj } from '@/lib/MlsjContext';
import { fmt, getBand } from '@/lib/equiprix-data';
import { MLSJ_CAP, MLSJ_CPT_PREMIUM } from '@/lib/mlsj-data';
import { Search, X } from 'lucide-react';
import MlsjRiderRow from './MlsjRiderRow';
import MlsjTeamSlot from './MlsjTeamSlot';
import MlsjScoringPanel from './MlsjScoringPanel';

const SLOT_IDS = ['cpt', 'r1', 'r2', 'r3', 'r4'];

export function MlsjDraftTab() {
  const {
    currentEvent, riders, mlsjTeams,
    gpTeam, setGpTeam, teamPicks, setTeamPicks,
    userCode, savePicks: contextSavePicks, showToast,
  } = useMlsj();

  const [view, setView] = useState('riders'); // 'riders' | 'teams'
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const ev = currentEvent;

  const isTeamLocked = () => {
    if (!ev) return true;
    if (ev.status === 'preview') return false;
    return new Date() >= new Date(ev.teamLockISO);
  };
  const isRiderLocked = () => {
    if (!ev) return true;
    if (ev.status === 'preview') return false;
    if (ev.status === 'teams') return true;
    return new Date() >= new Date(ev.gpLockISO);
  };

  const getSalary = (entry) => entry.isCpt ? entry.rider.salary + MLSJ_CPT_PREMIUM : entry.rider.salary;
  const totalSpent = () => gpTeam.reduce((s, r) => s + getSalary(r), 0) + teamPicks.reduce((s, t) => s + t.salary, 0);
  const capRemaining = MLSJ_CAP - totalSpent();

  const filteredRiders = useMemo(() => {
    const sorted = [...riders].sort((a, b) => a.rank - b.rank);
    return sorted.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.nat.toLowerCase().includes(search.toLowerCase()));
  }, [riders, search]);

  const filteredTeams = useMemo(() => {
    const sorted = [...mlsjTeams].sort((a, b) => (a.fieldRank || 99) - (b.fieldRank || 99));
    return sorted.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()));
  }, [mlsjTeams, search]);

  const doSavePicks = async (gt = gpTeam, tp = teamPicks) => {
    if (!userCode || !ev) return;
    setSaving(true);
    await contextSavePicks(userCode, ev, gt, tp);
    setSaving(false);
  };

  const addRider = (rider) => {
    if (isRiderLocked()) { showToast('Rider picks are locked'); return; }
    if (gpTeam.find(r => r.rider.id === rider.id)) return;
    if (gpTeam.length >= 5) { showToast('Team full — remove a rider first'); return; }
    if (totalSpent() + rider.salary > MLSJ_CAP) { showToast('Not enough cap space'); return; }
    const usedSlots = gpTeam.map(r => r.slotId);
    const nextSlot = SLOT_IDS.find(s => !usedSlots.includes(s));
    const isCpt = nextSlot === 'cpt';
    const newTeam = [...gpTeam, { rider, slotId: nextSlot, isCpt }];
    setGpTeam(newTeam);
    showToast(rider.name + (isCpt ? ' — set as captain!' : ' added'));
    doSavePicks(newTeam, teamPicks);
  };

  const removeRider = (id) => {
    if (isRiderLocked()) { showToast('Rider picks are locked'); return; }
    const newTeam = gpTeam.filter(r => r.rider.id !== id).map((r, i) => ({ ...r, slotId: SLOT_IDS[i], isCpt: i === 0 }));
    setGpTeam(newTeam);
    doSavePicks(newTeam, teamPicks);
  };

  const makeCpt = (id) => {
    const idx = gpTeam.findIndex(r => r.rider.id === id);
    const newTeam = [...gpTeam];
    const [cpt] = newTeam.splice(idx, 1);
    newTeam.unshift(cpt);
    const reindexed = newTeam.map((r, i) => ({ ...r, slotId: SLOT_IDS[i], isCpt: i === 0 }));
    setGpTeam(reindexed);
    showToast(cpt.rider.name + ' is your captain — 1.5×');
    doSavePicks(reindexed, teamPicks);
  };

  const addTeam = (t) => {
    if (isTeamLocked()) { showToast('Team picks are locked'); return; }
    if (teamPicks.find(p => p.id === t.id)) return;
    if (teamPicks.length >= 2) { showToast('Already have 2 teams'); return; }
    if (totalSpent() + t.salary > MLSJ_CAP) { showToast('Not enough cap space'); return; }
    const newPicks = [...teamPicks, { ...t, slotId: 'mt' + (teamPicks.length + 1) }];
    setTeamPicks(newPicks);
    showToast(t.name + ' added');
    doSavePicks(gpTeam, newPicks);
  };

  const removeTeam = (id) => {
    if (isTeamLocked()) { showToast('Team picks are locked'); return; }
    const newPicks = teamPicks.filter(t => t.id !== id).map((t, i) => ({ ...t, slotId: 'mt' + (i + 1) }));
    setTeamPicks(newPicks);
    doSavePicks(gpTeam, newPicks);
  };

  const clearAll = () => {
    setGpTeam([]);
    if (!isTeamLocked()) setTeamPicks([]);
  };

  const handleManualSave = () => {
    if (!userCode) { showToast('Log in first'); return; }
    doSavePicks();
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
              {v === 'riders' ? 'RIDERS' : 'MLSJ TEAMS'}
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
                  {riders.length === 0 ? 'Start list not yet announced — draft opens the night before the GP' : 'No riders found'}
                </div>
              )}
              {filteredRiders.map(rider => {
                const inTeam = gpTeam.find(t => t.rider.id === rider.id);
                const maxed = gpTeam.length >= 5 && !inTeam;
                const canAfford = !inTeam && (totalSpent() + rider.salary <= MLSJ_CAP);
                const band = getBand(rider.rank);
                return (
                  <MlsjRiderRow
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
              {filteredTeams.length === 0 && (
                <div className="text-center py-8 font-cormorant text-base italic" style={{ color: 'var(--mid)' }}>
                  Round 1 trios not declared yet — draft opens the night before the Team Competition
                </div>
              )}
              {filteredTeams.map(t => {
                const picked = teamPicks.find(p => p.id === t.id);
                const maxed = teamPicks.length >= 2 && !picked;
                const canAfford = !picked && (totalSpent() + t.salary <= MLSJ_CAP);
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
                    <div className="font-cormorant text-sm font-semibold w-5 text-center flex-shrink-0" style={{ color: (t.fieldRank || 99) <= 4 ? 'var(--gold)' : 'var(--mid)' }}>
                      {t.fieldRank || '—'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-cormorant text-sm font-semibold truncate" style={{ color: 'var(--cream)' }}>{t.name}</div>
                      <div className="text-xs" style={{ color: 'var(--mid)' }}>{fmt(t.salary)}</div>
                      {t.declaredTrio?.length > 0 && (
                        <div className="text-xs italic truncate" style={{ color: 'var(--gold-lt)' }}>
                          {t.declaredTrio.map(r => r.name).join(' · ')}
                        </div>
                      )}
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
        <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--ep-border)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-cinzel text-xs" style={{ color: 'var(--gold)', letterSpacing: '0.12em' }}>MY TEAM</span>
            <button onClick={clearAll} className="text-xs underline" style={{ color: 'var(--mid)' }}>Clear</button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full" style={{ background: 'var(--ep-border)' }}>
              <div className="h-1 rounded-full transition-all" style={{
                width: Math.min(100, (totalSpent() / MLSJ_CAP) * 100) + '%',
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
                : gpTeam.length + teamPicks.length > 0
                  ? `${gpTeam.length} rider${gpTeam.length !== 1 ? 's' : ''} · ${teamPicks.length} team${teamPicks.length !== 1 ? 's' : ''} · auto-saved`
                  : 'Empty'
              }
            </span>
            <button
              onClick={handleManualSave}
              className="text-xs px-2 py-1 rounded font-cinzel"
              style={{ background: 'var(--gold)', color: '#0f0e0a', letterSpacing: '0.06em' }}
            >
              SAVE
            </button>
          </div>
        </div>

        {/* Roster slots */}
        <div className="flex-1 overflow-y-auto px-2 py-2 pb-20">

          {/* Captain */}
          <div className="mb-2">
            <div className="font-cinzel text-xs mb-1" style={{ color: 'var(--mid)', letterSpacing: '0.1em', fontSize: 9 }}>
              CAPTAIN · 1.5× · +$1k
            </div>
            <MlsjTeamSlot
              entry={gpTeam.find(r => r.slotId === 'cpt')}
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
                <MlsjTeamSlot
                  entry={gpTeam.find(r => r.slotId === sid)}
                  isCpt={false}
                  onRemove={removeRider}
                  onMakeCpt={makeCpt}
                  isLocked={isRiderLocked()}
                />
              </div>
            ))}
          </div>

          {/* MLSJ Teams */}
          <div className="mb-3">
            <div className="font-cinzel text-xs mb-1" style={{ color: '#6aad8a', letterSpacing: '0.1em', fontSize: 9 }}>
              MLSJ TEAMS
            </div>
            {['mt1', 'mt2'].map((sid, i) => {
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

          <MlsjScoringPanel />
        </div>
      </div>
    </div>
  );
}