import React, { useState, useEffect, useMemo } from 'react';
import { MLSJ_TEAMS_2026, sbFetch, scoreMlsjTeam } from '@/lib/mlsj-data';
import { Save } from 'lucide-react';

// ── Compute live season standings from all saved results rows ─────────────────
// Sums scoreMlsjTeam() for each team across every MLSJ event that has
// team_results data. Returns { [teamId]: { pts, eventsScored } }
async function computeLiveMlsjStandings() {
  const { MLSJ_EVENTS_2026_27 } = await import('@/lib/mlsj-data');
  const keys = MLSJ_EVENTS_2026_27.map(e => e.supabaseKey);
  if (!keys.length) return {};

  // Fetch all MLSJ result rows in one call
  const rows = await sbFetch(
    'results?event=in.(' + keys.join(',') + ')&select=event,team_results'
  );

  const totals = {};
  MLSJ_TEAMS_2026.forEach(t => { totals[t.id] = { pts: 0, eventsScored: 0 }; });

  (rows || []).forEach(row => {
    if (!row.team_results) return;
    let rowHasData = false;
    MLSJ_TEAMS_2026.forEach(t => {
      const res = row.team_results[t.id];
      if (!res) return;
      const hasData = res.r1Place != null || res.retired || res.eliminatedForCause;
      if (!hasData) return;
      rowHasData = true;
      totals[t.id].pts += scoreMlsjTeam(res);
    });
    if (rowHasData) {
      MLSJ_TEAMS_2026.forEach(t => { totals[t.id].eventsScored++; });
    }
  });

  return totals;
}

export default function MlsjTeamStandingsEditor() {
  const [teams, setTeams] = useState(() =>
    [...MLSJ_TEAMS_2026].sort((a, b) => a.rank - b.rank).map(t => ({ ...t }))
  );
  const [computed, setComputed]   = useState({}); // { [teamId]: { pts, eventsScored } }
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [loading, setLoading]     = useState(true);
  const [computing, setComputing] = useState(true);

  // Load saved manual standings
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const rows = await sbFetch('mlsj_team_standings?id=eq.1&limit=1');
        const savedTeams = (rows && rows.length && rows[0].data) || [];

        setTeams(prev => {
          const merged = prev.map(t => {
            const s = savedTeams.find(x => x.id === t.id);
            return {
              ...t,
              ...(s?.rank   !== undefined ? { rank:   s.rank   } : {}),
              ...(s?.pts    !== undefined ? { pts:    s.pts    } : {}),
              ...(s?.salary !== undefined ? { salary: s.salary } : {}),
            };
          });
          return merged.sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));
        });
      } catch (e) {
        console.error('Failed to load MLSJ standings:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Compute live standings from results
  useEffect(() => {
    setComputing(true);
    computeLiveMlsjStandings()
      .then(setComputed)
      .catch(e => console.error('Failed to compute MLSJ standings:', e))
      .finally(() => setComputing(false));
  }, []);

  const updateField = (id, field, value) => {
    setTeams(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (value === '') return { ...t, [field]: '' };
      const num = field === 'rank' ? parseInt(value, 10) : Number(value);
      return { ...t, [field]: Number.isNaN(num) ? '' : num };
    }));
  };

  const sorted = [...teams].sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));

  // Compute-derived rank order for comparison column
  const computedRanked = useMemo(() => {
    return [...MLSJ_TEAMS_2026]
      .map(t => ({ id: t.id, pts: computed[t.id]?.pts ?? 0 }))
      .sort((a, b) => b.pts - a.pts)
      .reduce((acc, t, i) => { acc[t.id] = i + 1; return acc; }, {});
  }, [computed]);

  const save = async () => {
    setSaving(true);
    try {
      await sbFetch('mlsj_team_standings?id=eq.1', {
        method: 'PATCH',
        body: JSON.stringify({
          data: teams.map(t => ({ id: t.id, rank: t.rank, pts: t.pts, salary: t.salary })),
          updated_at: new Date().toISOString(),
        }),
      });
      // Keep MLSJ_TEAMS_2026 in sync so draft pricing reflects new salaries
      teams.forEach(t => {
        const orig = MLSJ_TEAMS_2026.find(x => x.id === t.id);
        if (orig) {
          if (t.rank   !== '') orig.rank   = Number(t.rank);
          if (t.pts    !== '') orig.pts    = Number(t.pts);
          if (t.salary !== '') orig.salary = Number(t.salary);
        }
      });
      MLSJ_TEAMS_2026.sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));
    } catch (e) {
      console.error('Save error:', e);
      alert('Save failed: ' + e.message);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  // Count mismatches between computed and manual rank
  const mismatches = sorted.filter(t => {
    const compRank = computedRanked[t.id];
    const manRank  = Number(t.rank) || 99;
    return compRank && compRank !== manRank;
  }).length;

  return (
    <div className="max-w-2xl">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>
        MLSJ STANDINGS
      </h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Manual overrides for official MLSJ team standings. Computed column shows what EquiPrix calculates from entered results — edit manually if the official standings differ.
      </p>

      {/* Mismatch warning */}
      {!computing && mismatches > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs font-cormorant italic"
          style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.3)', color: 'var(--gold-lt)' }}>
          ⚠ {mismatches} team{mismatches > 1 ? 's differ' : ' differs'} between computed and manual standings — review below.
        </div>
      )}
      {!computing && mismatches === 0 && sorted.some(t => computed[t.id]?.eventsScored > 0) && (
        <div className="mb-4 px-3 py-2 rounded-lg text-xs font-cormorant italic"
          style={{ background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.2)', color: '#4caf7d' }}>
          ✓ Manual standings match computed standings
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 font-cormorant italic" style={{ color: 'var(--mid)' }}>
          Loading standings…
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs font-cinzel"
            style={{ color: 'var(--mid)', fontSize: 9, borderBottom: '1px solid var(--ep-border)' }}>
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-3">TEAM</div>
            <div className="col-span-2 text-center">MANUAL PTS</div>
            <div className="col-span-2 text-center">COMPUTED</div>
            <div className="col-span-1 text-center">DIFF</div>
            <div className="col-span-3 text-center">SALARY ($)</div>
          </div>

          <div className="space-y-0.5 mb-4">
            {sorted.map((team, i) => {
              const comp        = computed[team.id];
              const compPts     = comp?.pts ?? null;
              const compRank    = computedRanked[team.id] ?? null;
              const manPts      = team.pts !== '' && team.pts !== undefined ? Number(team.pts) : null;
              const diff        = manPts !== null && compPts !== null ? manPts - compPts : null;
              const rankMismatch = compRank && compRank !== (Number(team.rank) || 99);

              return (
                <div key={team.id}
                  className="grid grid-cols-12 items-center gap-2 px-3 py-2"
                  style={{
                    background: rankMismatch
                      ? 'rgba(180,149,48,0.04)'
                      : i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    border: `1px solid ${rankMismatch ? 'rgba(180,149,48,0.25)' : 'rgba(42,40,32,0.4)'}`,
                    borderRadius: 4,
                  }}>

                  {/* Rank — editable */}
                  <div className="col-span-1">
                    <input type="number" value={team.rank}
                      onChange={e => updateField(team.id, 'rank', e.target.value)}
                      placeholder="#"
                      className="w-full rounded px-1 py-1 text-sm text-center font-cinzel font-bold outline-none"
                      style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold)' }} />
                  </div>

                  {/* Name */}
                  <div className="col-span-3 font-cormorant text-sm truncate" style={{ color: 'var(--cream)' }}>
                    {team.name}
                    {compRank && (
                      <span className="ml-1 font-cinzel" style={{ color: 'var(--mid)', fontSize: 8 }}>
                        (calc #{compRank})
                      </span>
                    )}
                  </div>

                  {/* Manual pts — editable */}
                  <div className="col-span-2">
                    <input type="number" step="0.5" value={team.pts}
                      onChange={e => updateField(team.id, 'pts', e.target.value)}
                      placeholder="pts"
                      className="w-full rounded px-1 py-1 text-xs text-center outline-none"
                      style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--cream)' }} />
                  </div>

                  {/* Computed pts — read only */}
                  <div className="col-span-2 text-center font-cormorant text-sm"
                    style={{ color: computing ? 'var(--mid)' : compPts !== null ? 'var(--ep-text)' : 'var(--mid)' }}>
                    {computing ? '…' : compPts !== null ? compPts : '—'}
                    {!computing && comp?.eventsScored > 0 && (
                      <span className="ml-1 font-cinzel" style={{ color: 'var(--mid)', fontSize: 8 }}>
                        ({comp.eventsScored}leg{comp.eventsScored !== 1 ? 's' : ''})
                      </span>
                    )}
                  </div>

                  {/* Diff */}
                  <div className="col-span-1 text-center font-cinzel text-xs font-bold"
                    style={{
                      color: diff === null ? 'var(--mid)'
                        : diff === 0 ? '#4caf7d'
                        : diff > 0 ? 'var(--gold)'
                        : '#e07070',
                      fontSize: 10,
                    }}>
                    {diff === null ? '—'
                      : diff === 0 ? '✓'
                      : diff > 0 ? `+${diff}` : diff}
                  </div>

                  {/* Salary — editable */}
                  <div className="col-span-3">
                    <input type="number" value={team.salary}
                      onChange={e => updateField(team.id, 'salary', e.target.value)}
                      placeholder="salary"
                      className="w-full rounded px-1 py-1 text-xs text-center outline-none"
                      style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold)' }} />
                  </div>
                </div>
              );
            })}
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2"
            style={{
              background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)',
              color:      saved ? '#4caf7d' : 'var(--ink)',
              border:     saved ? '1px solid #4caf7d' : 'none',
            }}>
            <Save size={13} />
            {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE STANDINGS'}
          </button>
        </>
      )}
    </div>
  );
}