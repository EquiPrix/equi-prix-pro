import React, { useState, useEffect, useMemo } from 'react';
import { useMlsj, GENERAL_ROOM_ID } from '@/lib/MlsjContext';
import { sbFetch, scoreMlsjTeam, mlsjGpPosPts, MLSJ_GP_CLEAR_BONUS, MLSJ_CAPTAIN_MULT } from '@/lib/mlsj-data';
import { PREVIEW_RIDERS_2026 } from '@/lib/equiprix-data';
import { useAuth } from '@/lib/AuthContext';

// ── Scoring ───────────────────────────────────────────────────────────────────
// Score one user's picks against the event's saved results.
//
// picks_json shape: { riders: [{ id, isCpt }], teams: [{ id }] }
// event results shape (from results row):
//   gp_rider_results: { [riderId]: { gpPos, gpClear, gpJO, joPos, gpRet, gpEl } }
//   team_results:     { [teamId]:  { r1Place, advancedR1, r2Side, finalResult, retired, eliminatedForCause } }

function scoreEntry(picksJson, gpRiderResults = {}, teamResults = {}) {
  if (!picksJson) return 0;
  let total = 0;

  // GP riders
  (picksJson.riders || []).forEach(pick => {
    const res = gpRiderResults[String(pick.id)];
    if (!res) return;

    let pts = 0;
    // Position points
    if (res.gpPos) pts += mlsjGpPosPts(res.gpPos);
    // Clear round bonus
    if (res.gpClear) pts += MLSJ_GP_CLEAR_BONUS;
    // Jump-off: use joPos for position points if they made it
    if (res.gpJO && res.joPos) pts += mlsjGpPosPts(res.joPos);

    // Captain multiplier
    if (pick.isCpt) pts = Math.round(pts * MLSJ_CAPTAIN_MULT);
    total += pts;
  });

  // MLSJ teams
  (picksJson.teams || []).forEach(pick => {
    const res = teamResults[String(pick.id)];
    if (!res) return;
    total += scoreMlsjTeam(res);
  });

  return total;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function MlsjLeaderboardTab() {
  const { currentEvent, mlsjRiderRankings } = useMlsj();
  const { user } = useAuth();

  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const activeUserEmail = user?.email || null;

  useEffect(() => {
    if (!currentEvent) return;
    let cancelled = false;

    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch all MLSJ picks for this event (General leaderboard only for now)
        const picks = await sbFetch(
          'picks?event=eq.' + currentEvent.id +
          '&league=eq.mlsj' +
          '&room_id=eq.' + GENERAL_ROOM_ID +
          '&select=user_email,username,picks_json' +
          '&limit=500'
        );

        if (!picks || !picks.length || cancelled) {
          setEntries([]);
          setLoading(false);
          return;
        }

        // 2. Fetch results for this event (gp_rider_results + team_results)
        const resultRows = await sbFetch(
          'results?event=eq.' + currentEvent.supabaseKey + '&limit=1'
        );
        const resultRow        = resultRows?.[0] || {};
        const gpRiderResults   = resultRow.gp_rider_results || {};
        const teamResults      = resultRow.team_results     || {};
        const hasResults       = Object.keys(gpRiderResults).length > 0 || Object.keys(teamResults).length > 0;

        // 3. Score each entry
        const scored = picks.map(row => {
          const pts = hasResults
            ? scoreEntry(row.picks_json, gpRiderResults, teamResults)
            : null; // null = event not yet scored

          // Resolve display name: username col > email prefix
          const displayName = row.username || row.user_email?.split('@')[0] || '—';

          // Summarise their picks for the detail line
          const riderNames = (row.picks_json?.riders || [])
            .map(r => {
              const found = mlsjRiderRankings.find(pr => pr.id === r.id)
                || PREVIEW_RIDERS_2026.find(pr => pr.id === r.id);
              if (!found) return null;
              return r.isCpt ? `★ ${found.name}` : found.name;
            })
            .filter(Boolean);

          return {
            email:       row.user_email,
            displayName,
            pts,
            riderNames,
            isMe:        row.user_email === activeUserEmail,
          };
        });

        if (cancelled) return;

        // 4. Sort: if scored, by pts desc; if not, alphabetically
        scored.sort((a, b) =>
          hasResults
            ? (b.pts ?? -1) - (a.pts ?? -1)
            : a.displayName.localeCompare(b.displayName)
        );

        setEntries(scored);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [currentEvent?.id, activeUserEmail]);

  // ── Render ────────────────────────────────────────────────────────────────
  const isScored = entries.length > 0 && entries[0].pts !== null;

  if (!currentEvent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>No event selected</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="font-cinzel text-sm tracking-widest mb-0.5" style={{ color: 'var(--gold)' }}>
          LEADERBOARD
        </h2>
        <p className="font-cormorant text-base italic" style={{ color: 'var(--mid)' }}>
          {currentEvent.flag} {currentEvent.city} · {currentEvent.dates}
        </p>
      </div>

      {/* States */}
      {loading && (
        <div className="px-4 py-8 text-center font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>
          Loading…
        </div>
      )}

      {!loading && error && (
        <div className="mx-4 my-2 px-3 py-2 rounded text-sm font-cormorant"
          style={{ background: 'rgba(224,112,112,0.08)', border: '1px solid rgba(224,112,112,0.3)', color: '#e07070' }}>
          Failed to load: {error}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>
            No entries yet for this leg.
          </p>
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="px-4 space-y-1.5 pb-6">
          {!isScored && (
            <div className="mb-3 px-3 py-2 rounded text-xs font-cormorant italic"
              style={{ background: 'rgba(180,149,48,0.06)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--mid)' }}>
              Results not yet entered — showing all {entries.length} entries alphabetically.
            </div>
          )}

          {entries.map((row, i) => {
            const isTop3  = isScored && i < 3;
            const rankColors = ['#c9a84c', '#9ca3af', '#cd7f32'];

            return (
              <div key={row.email}
                className="rounded-lg px-3 py-2.5"
                style={{
                  background: row.isMe
                    ? 'rgba(180,149,48,0.08)'
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${row.isMe
                    ? 'rgba(180,149,48,0.35)'
                    : isTop3 ? 'rgba(180,149,48,0.2)' : 'rgba(42,40,32,0.5)'}`,
                }}>
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="font-cinzel text-sm font-bold flex-shrink-0 w-6 text-center"
                    style={{ color: isTop3 ? rankColors[i] : 'var(--mid)' }}>
                    {isScored ? i + 1 : '—'}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="font-cormorant text-sm truncate"
                      style={{ color: row.isMe ? 'var(--gold-lt)' : 'var(--cream)' }}>
                      {row.displayName}
                      {row.isMe && (
                        <span className="ml-1.5 font-cinzel text-xs"
                          style={{ color: 'var(--gold)', fontSize: 8, letterSpacing: '0.08em' }}>YOU</span>
                      )}
                    </div>
                    {/* Rider summary line */}
                    {row.riderNames.length > 0 && (
                      <div className="font-cormorant text-xs italic truncate mt-0.5"
                        style={{ color: 'var(--mid)', fontSize: 11 }}>
                        {row.riderNames.join(' · ')}
                      </div>
                    )}
                  </div>

                  {/* Score */}
                  <div className="font-cinzel text-sm font-bold flex-shrink-0"
                    style={{ color: isTop3 ? rankColors[i] : isScored ? 'var(--cream)' : 'var(--mid)' }}>
                    {row.pts !== null ? `${row.pts} pts` : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}