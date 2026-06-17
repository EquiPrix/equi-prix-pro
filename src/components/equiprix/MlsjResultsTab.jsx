import React, { useState } from 'react';
import { useMlsj } from '@/lib/MlsjContext';
import { mlsjGpPosPts, scoreMlsjTeam } from '@/lib/mlsj-data';
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

  const gpResults = currentEvent.gpResults || [];     // [{ riderId, name, pos, faults, time }]
  const teamResults = currentEvent.teamResults || {};  // { [teamId]: scoreMlsjTeam-shaped result }

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
                  <div className="font-cinzel text-xs w-6 text-center flex-shrink-0" style={{ color: r.pos <= 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
                    {r.pos}
                  </div>
                  <div className="flex-1 font-cormorant text-sm font-semibold" style={{ color: 'var(--ep-text)' }}>
                    {r.name}
                  </div>
                  <div className="font-cormorant text-sm font-semibold" style={{ color: 'var(--gold-lt)' }}>
                    {mlsjGpPosPts(r.pos)} pts
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
                    <div className="flex-1 font-cormorant text-base font-semibold" style={{ color: 'var(--cream)' }}>{teamId}</div>
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