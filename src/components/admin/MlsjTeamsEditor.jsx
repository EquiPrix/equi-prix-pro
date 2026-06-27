import React, { useState, useEffect } from 'react';
import { MLSJ_TEAMS_2026, sbFetch } from '@/lib/mlsj-data';
import { PREVIEW_RIDERS_2026 } from '@/lib/equiprix-data';
import { ChevronDown, ChevronUp, Save, X } from 'lucide-react';

// ── MlsjTeamsEditor ───────────────────────────────────────────────────────────
// Lets admin edit which 6 riders are on each MLSJ team roster.
// Rosters are normally hardcoded in mlsj-data.js; this page persists
// overrides to a results row (event='mlsj_rosters') so they survive deploys.
// On load, saved overrides are merged on top of the static defaults.

const SUPABASE_KEY = 'mlsj_rosters';

// All riders eligible for MLSJ — PREVIEW_RIDERS_2026 covers the shared
// GCL+MLSJ pool. Sort by rank for easy browsing.
const ALL_RIDERS = [...PREVIEW_RIDERS_2026].sort((a, b) => {
  const ra = a.rank >= 999 ? 9999 : a.rank;
  const rb = b.rank >= 999 ? 9999 : b.rank;
  return ra - rb;
});

export default function MlsjTeamsEditor() {
  // rosters: { [teamId]: [riderId, riderId, ...] } — 6 per team
  const [rosters, setRosters]   = useState(() => {
    const init = {};
    MLSJ_TEAMS_2026.forEach(t => { init[t.id] = [...t.rosterIds]; });
    return init;
  });
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  // Load saved overrides from Supabase
  useEffect(() => {
    sbFetch('results?event=eq.' + SUPABASE_KEY + '&limit=1').then(rows => {
      if (rows && rows.length && rows[0].team_results) {
        const saved = rows[0].team_results; // { [teamId]: [id, id, ...] }
        setRosters(prev => {
          const merged = { ...prev };
          Object.entries(saved).forEach(([teamId, ids]) => {
            if (ids && ids.length) merged[teamId] = ids;
          });
          return merged;
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleRider = (teamId, riderId) => {
    setRosters(prev => {
      const current = prev[teamId] || [];
      const has = current.includes(riderId);
      if (has) return { ...prev, [teamId]: current.filter(id => id !== riderId) };
      if (current.length >= 6) return prev; // max 6
      return { ...prev, [teamId]: [...current, riderId] };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      // Save roster overrides into results table (event='mlsj_rosters')
      // Also sync back into in-memory MLSJ_TEAMS_2026 so rest of app reflects it
      Object.entries(rosters).forEach(([teamId, ids]) => {
        const team = MLSJ_TEAMS_2026.find(t => t.id === teamId);
        if (team) team.rosterIds = ids;
      });

      const existing = await sbFetch('results?event=eq.' + SUPABASE_KEY + '&limit=1');
      if (existing && existing.length > 0) {
        await sbFetch('results?event=eq.' + SUPABASE_KEY, {
          method: 'PATCH',
          body: JSON.stringify({
            team_results: rosters,
            updated_at: new Date().toISOString(),
          }),
        });
      } else {
        await sbFetch('results', {
          method: 'POST',
          body: JSON.stringify({
            event: SUPABASE_KEY,
            team_results: rosters,
            updated_at: new Date().toISOString(),
          }),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('MLSJ rosters save error:', e);
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="text-center py-8 font-cormorant italic" style={{ color: 'var(--mid)' }}>
      Loading rosters…
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>
        MLSJ TEAMS 2026–27
      </h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Edit each team's 6-rider roster. Changes persist here and override the static defaults — no redeploy needed.
      </p>

      <div className="space-y-2 mb-4">
        {MLSJ_TEAMS_2026.map(team => {
          const open        = expanded[team.id];
          const rosterIds   = rosters[team.id] || [];
          const rosterCount = rosterIds.length;

          return (
            <div key={team.id} className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--ep-border)' }}>

              {/* Header */}
              <button
                onClick={() => setExpanded(p => ({ ...p, [team.id]: !p[team.id] }))}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                style={{ background: open ? 'rgba(180,149,48,0.06)' : 'rgba(255,255,255,0.01)' }}>
                <span className="font-cinzel text-xs w-5 text-center flex-shrink-0"
                  style={{ color: 'var(--gold)' }}>{team.rank}</span>
                <span className="flex-1 font-cormorant text-sm font-semibold"
                  style={{ color: 'var(--cream)' }}>{team.name}</span>
                <span className="font-cinzel text-xs px-2 py-0.5 rounded"
                  style={{
                    background: rosterCount === 6 ? 'rgba(76,175,125,0.12)' : 'rgba(180,149,48,0.1)',
                    color: rosterCount === 6 ? '#4caf7d' : 'var(--gold)',
                    fontSize: 9,
                  }}>
                  {rosterCount}/6
                </span>
                {open
                  ? <ChevronUp size={13} style={{ color: 'var(--mid)', flexShrink: 0 }} />
                  : <ChevronDown size={13} style={{ color: 'var(--mid)', flexShrink: 0 }} />}
              </button>

              {open && (
                <div className="px-3 pb-3 pt-2"
                  style={{ borderTop: '1px solid var(--ep-border)', background: '#0d0c09' }}>

                  {/* Current roster */}
                  {rosterIds.length > 0 && (
                    <div className="mb-3">
                      <div className="font-cinzel text-xs mb-1.5"
                        style={{ color: 'var(--gold)', fontSize: 9, letterSpacing: '0.1em' }}>
                        CURRENT ROSTER
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {rosterIds.map(id => {
                          const rider = ALL_RIDERS.find(r => r.id === id);
                          if (!rider) return null;
                          return (
                            <div key={id}
                              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-cormorant"
                              style={{ background: 'rgba(180,149,48,0.1)', border: '1px solid rgba(180,149,48,0.3)', color: 'var(--gold-lt)' }}>
                              {rider.name}
                              <span className="font-cinzel ml-0.5"
                                style={{ color: 'var(--mid)', fontSize: 8 }}>
                                #{rider.rank >= 999 ? '—' : rider.rank}
                              </span>
                              <button onClick={() => toggleRider(team.id, id)}
                                style={{ color: 'var(--mid)', marginLeft: 2 }}>
                                <X size={9} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rider picker */}
                  {rosterCount < 6 && (
                    <div>
                      <div className="font-cinzel text-xs mb-1.5"
                        style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.1em' }}>
                        ADD RIDER ({6 - rosterCount} slot{6 - rosterCount !== 1 ? 's' : ''} remaining)
                      </div>
                      <div className="rounded-lg overflow-hidden"
                        style={{ border: '1px solid var(--ep-border)', maxHeight: 200, overflowY: 'auto' }}>
                        {ALL_RIDERS
                          .filter(r => !rosterIds.includes(r.id))
                          // Don't show riders already on another team
                          .filter(r => !Object.entries(rosters).some(([tid, ids]) => tid !== team.id && ids.includes(r.id)))
                          .map((r, i, arr) => (
                            <button key={r.id} onClick={() => toggleRider(team.id, r.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all"
                              style={{
                                borderBottom: i < arr.length - 1 ? '1px solid rgba(42,40,32,0.3)' : 'none',
                                background: 'transparent',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(180,149,48,0.06)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <span className="font-cormorant text-sm flex-1"
                                style={{ color: 'var(--cream)' }}>{r.name}</span>
                              <span className="font-cinzel text-xs"
                                style={{ color: 'var(--mid)', fontSize: 9 }}>
                                #{r.rank >= 999 ? '—' : r.rank}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {rosterCount === 6 && (
                    <p className="font-cormorant italic text-xs"
                      style={{ color: '#4caf7d' }}>
                      ✓ Roster full — remove a rider to swap.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2 sticky bottom-4"
        style={{
          background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)',
          color:      saved ? '#4caf7d' : 'var(--ink)',
          border:     saved ? '1px solid #4caf7d' : 'none',
        }}>
        <Save size={13} />
        {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE ROSTERS'}
      </button>
    </div>
  );
}