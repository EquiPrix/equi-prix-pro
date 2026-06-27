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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // CHANGED: read from dedicated gcl_team_standings table (id=1, data jsonb)
        // instead of results sentinel row 'team_salaries'.
        const rows = await sbFetch('gcl_team_standings?id=eq.1&limit=1');
        const savedTeams = (rows && rows.length && rows[0].data) || [];

        setTeams(prev => {
          const merged = prev.map(t => {
            const savedT = savedTeams.find(s => s.id === t.id);
            return {
              ...t,
              ...(savedT?.rank     !== undefined ? { rank:   savedT.rank   } : {}),
              ...(savedT?.pts      !== undefined ? { pts:    savedT.pts    } : {}),
              ...(savedT?.salary   !== undefined ? { salary: savedT.salary } : {}),
            };
          });
          return merged.sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));
        });
      } catch (e) {
        console.error('Failed to load saved standings:', e);
      } finally {
        setLoading(false);
      }
    })();
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

  const save = async () => {
    setSaving(true);
    try {
      // CHANGED: upsert into gcl_team_standings (id=1) instead of posting
      // a new sentinel row into results each time. PATCH on id=1 is safe
      // since the table always has exactly one row.
      await sbFetch('gcl_team_standings?id=eq.1', {
        method: 'PATCH',
        body: JSON.stringify({
          data: teams.map(t => ({ id: t.id, rank: t.rank, pts: t.pts, salary: t.salary })),
          updated_at: new Date().toISOString(),
        }),
      });

      // Keep in-memory GCL_TEAMS_2026 in sync so the rest of the app
      // reflects the new standings without requiring a full page reload.
      teams.forEach(t => {
        const orig = GCL_TEAMS_2026.find(x => x.id === t.id);
        if (orig) {
          if (t.rank   !== '') orig.rank   = Number(t.rank);
          if (t.pts    !== '') orig.pts    = Number(t.pts);
          if (t.salary !== '') orig.salary = Number(t.salary);
        }
      });
      GCL_TEAMS_2026.sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));

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
        Position, GCL points, and salary are all editable here — enter them to match the official GCL standings, then save.
      </p>

      {loading ? (
        <div className="text-center py-8 font-cormorant italic" style={{ color: 'var(--mid)' }}>Loading standings…</div>
      ) : (
        <>
          <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-xs font-cinzel"
            style={{ color: 'var(--mid)', fontSize: 9, borderBottom: '1px solid var(--ep-border)' }}>
            <div className="col-span-2 text-center">#</div>
            <div className="col-span-4">TEAM</div>
            <div className="col-span-3 text-center">GCL PTS</div>
            <div className="col-span-3 text-center">SALARY ($)</div>
          </div>

          <div className="space-y-0.5 mb-4">
            {sorted.map((team, i) => (
              <div key={team.id}
                className="grid grid-cols-12 items-center gap-2 px-3 py-2"
                style={{
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                  border: '1px solid rgba(42,40,32,0.4)',
                  borderRadius: 4,
                }}>
                <div className="col-span-2">
                  <input type="number" value={team.rank}
                    onChange={e => updateField(team.id, 'rank', e.target.value)}
                    placeholder="#"
                    className="w-full rounded px-1 py-1 text-sm text-center font-cinzel font-bold outline-none"
                    style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold)' }} />
                </div>
                <div className="col-span-4 font-cormorant text-sm truncate" style={{ color: 'var(--cream)' }}>
                  {team.name}
                </div>
                <div className="col-span-3">
                  <input type="number" step="0.5" value={team.pts}
                    onChange={e => updateField(team.id, 'pts', e.target.value)}
                    placeholder="pts"
                    className="w-full rounded px-1 py-1 text-xs text-center outline-none"
                    style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--cream)' }} />
                </div>
                <div className="col-span-3">
                  <input type="number" value={team.salary}
                    onChange={e => updateField(team.id, 'salary', e.target.value)}
                    placeholder="salary"
                    className="w-full rounded px-1 py-1 text-xs text-center outline-none"
                    style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold)' }} />
                </div>
              </div>
            ))}
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2"
            style={{
              background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)',
              color: saved ? '#4caf7d' : 'var(--ink)',
              border: saved ? '1px solid #4caf7d' : 'none',
            }}>
            <Save size={13} />
            {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE STANDINGS'}
          </button>
        </>
      )}
    </div>
  );
}