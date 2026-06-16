import React, { useMemo } from 'react';

// Reuses the same scoring building blocks as MlsjResultsTab; expects an array
// of entries fetched from mlsj_picks joined with the current event's results —
// wire the data fetch in the parent the same way LeaderboardTab.jsx does for GCL.
//
// entries shape: [{ userCode, userName, totalPts }]

export function MlsjLeaderboardTab({ entries = [] }) {
  const ranked = useMemo(() => {
    return [...entries].sort((a, b) => b.totalPts - a.totalPts);
  }, [entries]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {ranked.length === 0 && <div className="opacity-60 text-sm py-6 text-center">No entries yet for this leg.</div>}
      {ranked.map((row, i) => (
        <div key={row.userCode} className="px-3 py-2 rounded flex items-center justify-between" style={{ background: 'var(--ep-card)', border: '1px solid rgba(180,149,48,0.15)' }}>
          <div className="text-sm">{i + 1}. {row.userName}</div>
          <div className="text-sm" style={{ color: 'var(--gold-lt)' }}>{row.totalPts} pts</div>
        </div>
      ))}
    </div>
  );
}