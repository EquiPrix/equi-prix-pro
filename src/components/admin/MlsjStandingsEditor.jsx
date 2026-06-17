import React, { useState, useEffect } from 'react';
import { MLSJ_TEAMS_2026, sbFetch } from '@/lib/mlsj-data';
import { Save } from 'lucide-react';

export default function MlsjStandingsEditor() {
  const [teams, setTeams] = useState(() =>
    [...MLSJ_TEAMS_2026]
      .sort((a, b) => a.rank - b.rank)
      .map(t => ({ ...t }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    sbFetch('results?event=eq.mlsj_team_standings&limit=1').then(rows => {
      if (!rows || !rows.length || !rows[0].gp_riders) return;
      const savedRows = rows[0].gp_riders;
      setTeams(prev => prev.map(t => {
        const s = savedRows.find(x => x.id === t.id);
        if (!s) return t;
        return {
          ...t,
          ...(s.salary !== undefined ? { salary: s.salary } : {}),
          ...(s.rank !== undefined ? { rank: s.rank } : {}),
          ...(s.pts !== undefined ? { pts: s.pts } : {}),
        };
      }));
    });
  }, []);

  const updateSalary = (id, value) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, salary: value === '' ? '' : Number(value) } : t));
  };

  const updatePts = (id, value) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, pts: value === '' ? '' : Number(value) } : t));
  };

  const sorted = [...teams].sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));

  const save = async () => {
    setSaving(true);
    // Re-rank by points (highest first) before saving — same convention as
    // GCL where rank/pts are presented read-only, derived from results.
    const rankedByPts = [...teams].sort((a, b) => (Number(b.pts) || 0) - (Number(a.pts) || 0));
    const withRank = rankedByPts.map((t, i) => ({ ...t, rank: i + 1 }));

    try {
      await sbFetch('results', {
        method: 'POST',
        body: JSON.stringify({
          event: 'mlsj_team_standings',
          gp_riders: withRank.map(t => ({ id: t.id, name: t.name, rank: t.rank, pts: t.pts, salary: t.salary })),
          updated_at: new Date().toISOString(),
        }),
      });
      setTeams(withRank);
      // Sync back into in-memory MLSJ_TEAMS_2026 so other admin views reflect it
      withRank.forEach(t => {
        const orig = MLSJ_TEAMS_2026.find(x => x.id === t.id);
        if (orig) {
          if (t.salary !== '') orig.salary = Number(t.salary);
          orig.rank = t.rank;
          orig.pts = Number(t.pts) || 0;
        }
      });
    } catch (e) {
      console.error('MLSJ standings save error:', e);
      alert('Save failed: ' + e.message);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>MLSJ STANDINGS</h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Season points across all legs. Enter cumulative points per team — rank recalculates on save. Adjust draft salaries here if needed (note: per-leg draft pricing is normally driven by declared trio strength, not this value, unless no trio has been declared yet).
      </p>

      <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs font-cinzel"
        style={{ color: 'var(--mid)', fontSize: 9, borderBottom: '1px solid var(--ep-border)' }}>
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-5">TEAM</div>
        <div className="col-span-3 text-center">SEASON PTS</div>
        <div className="col-span-3 text-center">SALARY ($)</div>
      </div>

      <div className="space-y-0.5 mb-4">
        {sorted.map((team, i) => (
          <div key={team.id}
            className="grid grid-cols-12 items-center gap-2 px-3 py-2"
            style={{
              background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
              border: '1px solid rgba(42,40,32,0.4)',
              borderRadius: 4
            }}>

            <div className="col-span-1 font-cinzel text-sm text-center font-bold"
              style={{ color: 'var(--gold)' }}>
              {team.rank}
            </div>

            <div className="col-span-5 font-cormorant text-sm truncate" style={{ color: 'var(--cream)' }}>
              {team.name}
            </div>

            <div className="col-span-3">
              <input
                type="number"
                value={team.pts}
                onChange={e => updatePts(team.id, e.target.value)}
                placeholder="pts"
                className="w-full rounded px-1 py-1 text-xs text-center outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }}
              />
            </div>

            <div className="col-span-3">
              <input
                type="number"
                value={team.salary}
                onChange={e => updateSalary(team.id, e.target.value)}
                placeholder="salary"
                className="w-full rounded px-1 py-1 text-xs text-center outline-none"
                style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold)' }}
              />
            </div>
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2"
        style={{
          background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)',
          color: saved ? '#4caf7d' : 'var(--ink)',
          border: saved ? '1px solid #4caf7d' : 'none'
        }}>
        <Save size={13} />
        {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE STANDINGS'}
      </button>
    </div>
  );
}