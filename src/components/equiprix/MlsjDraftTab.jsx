import React, { useState } from 'react';
import { useMlsj } from '@/lib/MlsjContext';
import { MLSJ_CAP, MLSJ_CPT_PREMIUM } from '@/lib/mlsj-data';
import { fmt } from '@/lib/equiprix-data';

export function MlsjDraftTab() {
  const { currentEvent, riders, mlsjTeams, gpTeam, setGpTeam, teamPicks, setTeamPicks, userCode, savePicks, showToast } = useMlsj();
  const [subTab, setSubTab] = useState('gp'); // 'gp' | 'teams'

  const spentRiders = gpTeam.reduce((sum, t) => sum + t.rider.salary + (t.isCpt ? MLSJ_CPT_PREMIUM : 0), 0);
  const spentTeams = teamPicks.reduce((sum, t) => sum + t.salary, 0);
  const spent = spentRiders + spentTeams;
  const remaining = MLSJ_CAP - spent;

  const gpLocked = currentEvent && new Date() >= new Date(currentEvent.gpLockISO);
  const teamLocked = currentEvent && new Date() >= new Date(currentEvent.teamLockISO);

  const SLOT_IDS = ['cpt', 'r1', 'r2', 'r3', 'r4'];

  function toggleRider(rider) {
    if (gpLocked) return;
    const exists = gpTeam.find(t => t.rider.id === rider.id);
    if (exists) {
      setGpTeam(gpTeam.filter(t => t.rider.id !== rider.id));
      return;
    }
    if (gpTeam.length >= 5) { showToast('Roster full — 5 riders max'); return; }
    const cost = rider.salary + (gpTeam.length === 0 ? MLSJ_CPT_PREMIUM : 0);
    if (cost > remaining) { showToast('Over budget'); return; }
    const slotId = SLOT_IDS[gpTeam.length];
    setGpTeam([...gpTeam, { rider, slotId, isCpt: gpTeam.length === 0 }]);
  }

  function setCaptain(riderId) {
    if (gpLocked) return;
    setGpTeam(gpTeam.map(t => ({ ...t, isCpt: t.rider.id === riderId })));
  }

  function toggleMlsjTeam(team) {
    if (teamLocked) return;
    const exists = teamPicks.find(t => t.id === team.id);
    if (exists) {
      setTeamPicks(teamPicks.filter(t => t.id !== team.id));
      return;
    }
    if (teamPicks.length >= 2) { showToast('Pick 2 teams max'); return; }
    if (team.salary > remaining) { showToast('Over budget'); return; }
    setTeamPicks([...teamPicks, { ...team, slotId: 'mt' + (teamPicks.length + 1) }]);
  }

  async function handleSave() {
    if (!userCode) { showToast('Log in first'); return; }
    await savePicks(userCode, currentEvent);
  }

  if (!currentEvent) {
    return <div className="flex-1 flex items-center justify-center opacity-60">Select an event first.</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Cap bar */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(180,149,48,0.2)' }}>
        <div className="text-sm">
          <span style={{ color: 'var(--gold-lt)' }}>{fmt(remaining)}</span>
          <span className="opacity-60"> remaining of {fmt(MLSJ_CAP)}</span>
        </div>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 rounded text-sm font-medium"
          style={{ background: 'var(--gold)', color: '#0f0e0a' }}
        >
          Save Picks
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex px-4 pt-3 gap-2">
        <button
          onClick={() => setSubTab('gp')}
          className="px-3 py-1.5 rounded text-sm"
          style={{ background: subTab === 'gp' ? 'var(--gold)' : 'var(--ep-card)', color: subTab === 'gp' ? '#0f0e0a' : 'inherit' }}
        >
          GP Riders ({gpTeam.length}/5) {gpLocked && '🔒'}
        </button>
        <button
          onClick={() => setSubTab('teams')}
          className="px-3 py-1.5 rounded text-sm"
          style={{ background: subTab === 'teams' ? 'var(--gold)' : 'var(--ep-card)', color: subTab === 'teams' ? '#0f0e0a' : 'inherit' }}
        >
          MLSJ Teams ({teamPicks.length}/2) {teamLocked && '🔒'}
        </button>
      </div>

      {subTab === 'gp' && (
        <div className="p-4 space-y-2">
          {gpLocked && (
            <div className="text-xs px-3 py-2 rounded mb-2" style={{ background: 'rgba(180,149,48,0.1)', color: 'var(--gold-lt)' }}>
              GP picks are locked for this leg.
            </div>
          )}
          {riders.length === 0 && (
            <div className="opacity-60 text-sm py-6 text-center">
              Start list not published yet — draft opens the night before the GP.
            </div>
          )}
          {riders.map(rider => {
            const picked = gpTeam.find(t => t.rider.id === rider.id);
            return (
              <div
                key={rider.id}
                className="px-3 py-2 rounded flex items-center justify-between"
                style={{
                  background: picked ? 'var(--ep-card-active)' : 'var(--ep-card)',
                  border: '1px solid rgba(180,149,48,0.2)',
                  opacity: gpLocked ? 0.6 : 1,
                }}
              >
                <div onClick={() => toggleRider(rider)} className="flex-1 cursor-pointer">
                  <div className="text-sm font-medium">{rider.name} <span className="opacity-60">{rider.nat}</span></div>
                  <div className="text-xs opacity-60">Rank #{rider.rank} · {fmt(rider.salary)}</div>
                </div>
                {picked && (
                  <button
                    disabled={gpLocked}
                    onClick={() => setCaptain(rider.id)}
                    className="text-xs px-2 py-1 rounded ml-2"
                    style={{
                      background: picked.isCpt ? 'var(--gold)' : 'transparent',
                      color: picked.isCpt ? '#0f0e0a' : 'var(--gold-lt)',
                      border: '1px solid var(--gold)',
                    }}
                  >
                    {picked.isCpt ? 'CPT' : 'Make CPT'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {subTab === 'teams' && (
        <div className="p-4 space-y-2">
          {teamLocked && (
            <div className="text-xs px-3 py-2 rounded mb-2" style={{ background: 'rgba(180,149,48,0.1)', color: 'var(--gold-lt)' }}>
              Team picks are locked for this leg.
            </div>
          )}
          {mlsjTeams.length === 0 && (
            <div className="opacity-60 text-sm py-6 text-center">
              Round 1 trios not declared yet — draft opens the night before the Team Competition.
            </div>
          )}
          {mlsjTeams.map(team => {
            const picked = teamPicks.find(t => t.id === team.id);
            return (
              <div
                key={team.id}
                onClick={() => toggleMlsjTeam(team)}
                className="px-3 py-2 rounded cursor-pointer"
                style={{
                  background: picked ? 'var(--ep-card-active)' : 'var(--ep-card)',
                  border: '1px solid rgba(180,149,48,0.2)',
                  opacity: teamLocked ? 0.6 : 1,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{team.name}</div>
                  <div className="text-xs opacity-70">{fmt(team.salary)}</div>
                </div>
                {team.declaredTrio?.length > 0 && (
                  <div className="text-xs opacity-60 mt-0.5">
                    {team.declaredTrio.map(r => r.name).join(' · ')}
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