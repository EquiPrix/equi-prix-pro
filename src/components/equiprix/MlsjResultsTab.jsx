import React, { useState } from 'react';
import { useMlsj } from '../../lib/MlsjContext';
import { mlsjGpPosPts, scoreMlsjTeam } from '../../lib/mlsj-data';
import { ordinal } from '../../lib/equiprix-data';

export function MlsjResultsTab() {
  const { currentEvent } = useMlsj();
  const [subTab, setSubTab] = useState('gp'); // 'gp' | 'team'

  if (!currentEvent) {
    return <div className="flex-1 flex items-center justify-center opacity-60">Select an event first.</div>;
  }

  const gpResults = currentEvent.gpResults || [];     // [{ riderId, name, pos, faults, time }]
  const teamResults = currentEvent.teamResults || {};  // { [teamId]: scoreMlsjTeam-shaped result }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      <div className="flex px-4 pt-3 gap-2">
        <button
          onClick={() => setSubTab('gp')}
          className="px-3 py-1.5 rounded text-sm"
          style={{ background: subTab === 'gp' ? 'var(--gold)' : 'var(--ep-card)', color: subTab === 'gp' ? '#0f0e0a' : 'inherit' }}
        >
          Grand Prix
        </button>
        <button
          onClick={() => setSubTab('team')}
          className="px-3 py-1.5 rounded text-sm"
          style={{ background: subTab === 'team' ? 'var(--gold)' : 'var(--ep-card)', color: subTab === 'team' ? '#0f0e0a' : 'inherit' }}
        >
          Team Competition
        </button>
      </div>

      {subTab === 'gp' && (
        <div className="p-4 space-y-1">
          {gpResults.length === 0 && <div className="opacity-60 text-sm py-6 text-center">No GP results entered yet.</div>}
          {gpResults.map(r => (
            <div key={r.riderId} className="px-3 py-2 rounded flex items-center justify-between" style={{ background: 'var(--ep-card)', border: '1px solid rgba(180,149,48,0.15)' }}>
              <div className="text-sm">{ordinal(r.pos)} — {r.name}</div>
              <div className="text-xs opacity-60">{mlsjGpPosPts(r.pos)} pts</div>
            </div>
          ))}
        </div>
      )}

      {subTab === 'team' && (
        <div className="p-4 space-y-2">
          {Object.keys(teamResults).length === 0 && (
            <div className="opacity-60 text-sm py-6 text-center">No Team Competition results entered yet.</div>
          )}
          {Object.entries(teamResults).map(([teamId, result]) => (
            <div key={teamId} className="px-3 py-2 rounded" style={{ background: 'var(--ep-card)', border: '1px solid rgba(180,149,48,0.15)' }}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{teamId}</div>
                <div className="text-xs" style={{ color: 'var(--gold-lt)' }}>{scoreMlsjTeam(result)} pts</div>
              </div>
              <div className="text-xs opacity-60 mt-0.5">
                {result.advancedR1
                  ? `Advanced R1 → ${result.r2Side === 'gold' ? 'Gold/Silver match' : result.r2Side === 'bronze' ? 'Bronze match' : 'R2'}${result.finalResult ? ` → ${result.finalResult}` : ''}`
                  : `Eliminated R1 (${ordinal(result.r1Place)})`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}