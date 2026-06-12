import React, { useState, useEffect } from 'react';
import { GCL_TEAMS_2026, sbFetch } from '@/lib/equiprix-data';
import { Save } from 'lucide-react';

export default function TeamStandingsEditor() {
  const [teams, setTeams] = useState(() =>
    [...GCL_TEAMS_2026]
      .sort((a, b) => a.rank - b.rank)
      .map(t => ({ ...t }))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing saved values from Supabase on mount
  useEffect(() => {
    sbFetch('results?event=eq.team_salaries&limit=1').then(rows => {
      if (!rows || !rows.length || !rows[0].gp_riders) return;
      const saved = rows[0].gp_riders;
      setTeams(prev => prev.map(t => {
        const s = saved.find(x => x.id === t.id);
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

  const update = (id, field, value) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, [field]: value === '' ? '' : Number(value) } : t));
  };

  const sorted = [...teams].sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));

  const save = async () => {
    setSaving(true);
    await sbFetch('results', {
      method: 'POST',
      body: JSON.stringify({
        event: 'team_salaries',
        gp_riders: teams.map(t => ({ id: t.id, name: t.name, rank: t.rank, pts: t.pts, salary: t.salary })),
        updated_at: new Date().toISOString()
      })
    });
    // Sync back into the in-memory GCL_TEAMS_2026 array
    teams.forEach(t => {
      const orig = GCL_TEAMS_2026.find(x => x.id === t.id);
      if (orig) {
        if (t.rank !== '') orig.rank = Number(t.rank);
        if (t.pts !== '') orig.pts = Number(t.pts);
        if (t.salary !== '') orig.salary = Number(t.salary);
      }
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>GCL STANDINGS</h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Update team rankings, GCL points and draft salaries. Saved to Supabase and reflected in the draft pool immediately.
      </p>

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
            {/* Editable rank */}
            <div className="col-span-1">
              <input
                type="number"
                value={team.rank}
                onChange={e => update(team.id, 'rank', e.target.value)}
                className="w-full rounded px-1 py-1 text-xs text-center outline-none"
                style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold)' }}
              />
            </div>

            {/* Name */}
            <div className="col-span-5 font-cormorant text-sm truncate" style={{ color: 'var(--cream)' }}>
              {team.name}
            </div>

            {/* GCL pts */}
            <div className="col-span-3">
              <input
                type="number"
                value={team.pts}
                onChange={e => update(team.id, 'pts', e.target.value)}
                placeholder="pts"
                className="w-full rounded px-1 py-1 text-xs text-center outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }}
              />
            </div>

            {/* Salary */}
            <div className="col-span-3">
              <input
                type="number"
                value={team.salary}
                onChange={e => update(team.id, 'salary', e.target.value)}
                placeholder="salary"
                className="w-full rounded px-1 py-1 text-xs text-center outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }}
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