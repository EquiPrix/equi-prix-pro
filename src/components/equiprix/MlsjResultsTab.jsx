import React, { useState } from 'react';
import { useMlsj } from '@/lib/MlsjContext';
import { MLSJ_TEAMS_2026, mlsjGpPosPts, MLSJ_GP_CLEAR_BONUS, scoreMlsjTeam } from '@/lib/mlsj-data';
import { ordinal } from '@/lib/equiprix-data';

const SUB_TABS = [
  { id: 'gp', label: 'Grand Prix' },
  { id: 'team', label: 'Team Competition' },
];

export function MlsjResultsTab() {
  const { currentEvent } = useMlsj();
  const [subTab, setSubTab] = useState('gp'); // 'gp' | 'team'

  if (!currentEvent) {
    return <div className="flex-1 flex items-center justify-center opacity-60">Select an event first.</div>;
  }

  // FIXED: this used to read currentEvent.gpResults, a field that was
  // never populated anywhere — MlsjContext only ever loaded the raw
  // gp_rider_results object (keyed by riderId) and never mapped it into
  // this shape, so GP results always showed "not yet entered" no matter
  // what admin saved. Now build the display list here, the same way GCL's
  // ResultsTab.jsx does: resolve each rider via the event's GP start list
  // (gpRiders), and — same fix GCL already has — when a jump-off happened,
  // joPos (the real tie-broken standing) overrides gpPos (which is the
  // same tied value for every rider in that JO group) for sort/display.
  const gpRiderResults = currentEvent.gpRiderResults || {}; // { [riderId]: {gpPos,gpClear,gpJO,joPos,gpRet,gpEl,...} }
  const gpStartRiders = currentEvent.gpRiders || [];
  const gpResults = Object.entries(gpRiderResults)
    .map(([riderId, res]) => {
      const rider = gpStartRiders.find(r => String(r.id) === String(riderId)) || { id: riderId, name: 'Rider #' + riderId };
      const gpPos = res.gpPos ?? 999;
      const hasJO = !!res.gpJO;
      const pos = hasJO && res.joPos != null ? res.joPos : gpPos;
      const ret = !!res.gpRet;
      const el = !!res.gpEl;
      let pts = ret || el ? 0 : mlsjGpPosPts(gpPos);
      if (!ret && !el && res.gpClear) pts += MLSJ_GP_CLEAR_BONUS;
      if (!ret && !el && hasJO && res.joPos != null) pts += mlsjGpPosPts(res.joPos);
      return { riderId, name: rider.name, pos, ret, el, clr: !!res.gpClear, hasJO, pts };
    })
    .filter(e => e.pos < 999 || e.ret || e.el)
    .sort((a, b) => (a.ret || a.el ? 9999 : a.pos) - (b.ret || b.el ? 9999 : b.pos));

  const teamResults = currentEvent.teamResults || {};  // { [teamId]: scoreMlsjTeam-shaped result }
  const teamName = (teamId) => MLSJ_TEAMS_2026.find(t => t.id === teamId)?.name || teamId;

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: 'var(--ink)' }}>
      <div className="px-4 pt-4 pb-0" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        <div className="font-cinzel text-xs tracking-widest mb-0.5" style={{ color: 'var(--gold)' }}>RESULTS</div>
        <div className="font-cormorant text-xl mb-1" style={{ color: 'var(--cream)' }}>
          {currentEvent.flag} {currentEvent.city} · {currentEvent.dates}
        </div>

        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0">
          {SUB_TABS.map(tab => (
            <button key={tab.id} onClick={() => setSubTab(tab.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-t font-cinzel text-xs transition-all"
              style={{
                background: subTab === tab.id ? 'rgba(180,149,48,0.08)' : 'none',
                borderBottom: `2px solid ${subTab === tab.id ? 'var(--gold)' : 'transparent'}`,
                color: subTab === tab.id ? 'var(--gold)' : 'var(--mid)',
                letterSpacing: '0.1em',
              }}>
              {tab.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {subTab === 'gp' && (
          gpResults.length === 0 ? (
            <Empty msg="GP results not yet entered" />
          ) : (
            <div>
              {gpResults.map(r => (
                <div key={r.riderId} className="flex items-center gap-2.5 px-3 py-2.5 border-b" style={{ borderColor: 'rgba(42,40,32,0.4)' }}>
                  <div className="font-cinzel text-xs w-8 text-center flex-shrink-0" style={{ color: r.pos <= 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
                    {r.ret ? 'RET' : r.el ? 'EL' : r.pos}
                  </div>
                  <div className="flex-1 font-cormorant text-sm font-semibold" style={{ color: r.clr ? '#6aad8a' : 'var(--ep-text)' }}>
                    {r.name}
                    {r.clr && <span className="ml-1 text-xs px-1" style={{ background: 'rgba(76,175,61,0.15)', color: '#4caf7d', borderRadius: 2 }}>CLR</span>}
                    {r.hasJO && <span className="ml-1 text-xs px-1" style={{ background: 'rgba(180,149,48,0.15)', color: 'var(--gold)', borderRadius: 2 }}>JO</span>}
                  </div>
                  <div className="font-cormorant text-sm font-semibold" style={{ color: 'var(--gold-lt)' }}>
                    {r.pts} pts
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {subTab === 'team' && (
          Object.keys(teamResults).length === 0 ? (
            <Empty msg="Team Competition results not yet entered" />
          ) : (
            <div>
              {Object.entries(teamResults).map(([teamId, result]) => (
                <div key={teamId} className="border-b" style={{ borderColor: 'rgba(180,149,48,0.1)' }}>
                  <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'rgba(180,149,48,0.04)' }}>
                    <div className="flex-1 font-cormorant text-base font-semibold" style={{ color: 'var(--cream)' }}>{teamName(teamId)}</div>
                    <div className="font-cormorant text-sm font-semibold" style={{ color: 'var(--gold-lt)' }}>{scoreMlsjTeam(result)} pts</div>
                  </div>
                  <div className="px-3 py-1.5 text-xs font-cormorant italic" style={{ color: 'var(--mid)' }}>
                    {result.advancedR1
                      ? `Advanced R1 → ${result.r2Side === 'gold' ? 'Gold/Silver match' : result.r2Side === 'bronze' ? 'Bronze match' : 'R2'}${result.finalResult ? ` → ${result.finalResult}` : ''}`
                      : `Eliminated R1 (${ordinal(result.r1Place)})`}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function Empty({ msg }) {
  return <div className="text-center py-12 font-cormorant text-lg italic" style={{ color: 'var(--mid)' }}>{msg}</div>;
}