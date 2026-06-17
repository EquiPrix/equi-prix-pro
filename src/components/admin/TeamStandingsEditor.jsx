import React, { useState, useEffect } from 'react';
import { GCL_TEAMS_2026, sbFetch } from '@/lib/equiprix-data';
import { computeLiveGclStandings } from '@/lib/EquiPrixContext';
import { Save } from 'lucide-react';

export default function TeamStandingsEditor() {
  const [teams, setTeams] = useState(() =>
    [...GCL_TEAMS_2026]
      .sort((a, b) => a.rank - b.rank)
      .map(t => ({ ...t }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Pull live rank/pts (computed from actual entered results, same as the
  // Leaderboard's GCL Standings tab) and merge with whatever salary is
  // currently saved in the team_salaries row. Rank/pts are NEVER
  // hand-edited here anymore — they're a read-only reflection of results.
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [liveStandings, salRows] = await Promise.all([
          computeLiveGclStandings(),
          sbFetch('results?event=eq.team_salaries&limit=1'),
        ]);

        const savedSalaries = (salRows && salRows.length && salRows[0].gp_riders) || [];

        setTeams(prev => {
          const merged = prev.map(t => {
            const live = liveStandings.find(l => l.id === t.id);
            const sal = savedSalaries.find(s => s.id === t.id);
            return {
              ...t,
              ...(live ? { rank: live.rank, pts: live.pts, wins: live.wins, events: live.events } : {}),
              ...(sal?.salary ? { salary: sal.salary } : {}),
            };
          });
          return merged.sort((a, b) => a.rank - b.rank);
        });
      } catch (e) {
        console.error('Failed to load live standings:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateSalary = (id, value) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, salary: value === '' ? '' : Number(value) } : t));
  };

  const sorted = [...teams].sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));

  const save = async () => {
    setSaving(true);
    try {
      // Only salary is ever written back — rank/pts are always derived live
      // from results and never persisted as a separate override anymore.
      await sbFetch('results', {
        method: 'POST',
        body: JSON.stringify({
          event: 'team_salaries',
          gp_riders: teams.map(t => ({ id: t.id, salary: t.salary })),
          updated_at: new Date().toISOString()
        })
      });
      teams.forEach(t => {
        const orig = GCL_TEAMS_2026.find(x => x.id === t.id);
        if (orig && t.salary !== '') orig.salary = Number(t.salary);
      });
    } catch (e) {
      console.error('Save error:', e);
      alert('Save failed: ' + e.message);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>GCL STANDINGS</h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Rank and points are computed live from entered results — same numbers shown on the public Leaderboard. Adjust draft salaries here if needed.
      </p>

      {loading ? (
        <div className="text-center py-8 font-cormorant italic" style={{ color: 'var(--mid)' }}>Loading live standings…</div>
      ) : (
        <>
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs font-cinzel"
            style={{ color: 'var(--mid)', fontSize: 9, borderBottom: '1px solid var(--ep-border)' }}>
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-5">TEAM</div>
            <div className="col-span-3 text-center">GCL PTS</div>
            <div className="col-span-3 text-center">SALARY ($)</div>
          </div>

          {/* Rows */}
          <div className="space-y-0.5 mb-4">
            {sorted.map((team, i) => (
              <div key={team.id}
                className="grid grid-cols-12 items-center gap-2 px-3 py-2"
                style={{
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  border: '1px solid rgba(42,40,32,0.4)',
                  borderRadius: 4
                }}>

                {/* Rank — read only, live-computed */}
                <div className="col-span-1 font-cinzel text-sm text-center font-bold"
                  style={{ color: 'var(--gold)' }}>
                  {team.rank}
                </div>

                {/* Name */}
                <div className="col-span-5 font-cormorant text-sm truncate" style={{ color: 'var(--cream)' }}>
                  {team.name}
                </div>

                {/* GCL pts — read only, live-computed */}
                <div className="col-span-3 text-center font-cormorant text-sm"
                  style={{ color: 'var(--mid)' }}>
                  {team.pts}
                </div>

                {/* Salary — editable */}
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
            {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE SALARIES'}
          </button>
        </>
      )}
    </div>
  );
}