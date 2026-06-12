import React, { useState, useEffect } from 'react';
import { useEquiPrix } from '@/lib/EquiPrixContext';
import {
  sbFetch, ordinal, gclStagePts, gpPosPts, teamPosPts,
  GCL_TEAMS_2026, EVENTS_2026, PREVIEW_RIDERS_2026,
  CAP, CPT_PREMIUM, CAPTAIN_MULT, fmt
} from '@/lib/equiprix-data';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Lock } from 'lucide-react';

const TABS = [
  { id: 'event', label: 'This Event' },
  { id: 'season', label: '2026 Season' },
  { id: 'gcl', label: 'GCL Standings' },
];

export default function LeaderboardTab() {
  const { currentEvent, events } = useEquiPrix();
  const [tab, setTab] = useState('event');
  const [eventRows, setEventRows] = useState([]);
  const [seasonRows, setSeasonRows] = useState([]);
  const [gclRows, setGclRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'event' && currentEvent) loadEventLB();
    if (tab === 'season') loadSeasonLB();
    if (tab === 'gcl') loadGCLStandings();
  }, [tab, currentEvent]);

  const loadEventLB = async () => {
    if (!currentEvent) return;
    setLoading(true);
    try {
      // Load all picks for this event
      const picks = await sbFetch(
        'picks?select=access_code,username,score,picks_json&event=eq.' + currentEvent.id
      ) || [];

      // Load results for score calculation if event is past
      let riderResults = {};
      let teamResults = {};
      if (currentEvent.status === 'past') {
        const res = await sbFetch(
          'results?event=eq.' + currentEvent.supabaseKey + '&limit=1'
        ) || [];
        if (res.length) {
          riderResults = res[0].rider_results || {};
          teamResults = res[0].team_results || {};
        }
      }

      // Build rows with picks detail and calculated points
      const rows = picks
        .filter(p => p.picks_json && !p.picks_json.isPractice)
        .map(p => {
          const pj = p.picks_json;
          const riderPicks = pj.riders || [];
          const teamPickIds = (pj.teams || []).map(t => t.id);

          // Resolve rider details
          const allRiders = currentEvent.riders?.length
            ? currentEvent.riders
            : PREVIEW_RIDERS_2026;

          const resolvedRiders = riderPicks.map(rp => {
            const rider = allRiders.find(r => r.id === rp.id) ||
              PREVIEW_RIDERS_2026.find(r => r.id === rp.id);
            if (!rider) return null;
            const salary = rp.isCpt ? rider.salary + CPT_PREMIUM : rider.salary;
            const res = riderResults[String(rp.id)] || {};
            const gpPts = res.gpPos ? gpPosPts(res.gpPos) : null;
            const clearBonus = res.gpClear ? 20 : 0;
            const rawPts = gpPts !== null ? gpPts + clearBonus : null;
            const pts = rawPts !== null
              ? (rp.isCpt ? rawPts * CAPTAIN_MULT : rawPts)
              : null;
            return { rider, isCpt: rp.isCpt, salary, pts };
          }).filter(Boolean);

          // Resolve team details
          const resolvedTeams = teamPickIds.map(id => {
            const team = GCL_TEAMS_2026.find(t => t.id === id);
            if (!team) return null;
            const tr = teamResults[id] || {};
            const pos = tr.finalPos || null;
            const pts = pos ? teamPosPts(pos) : null;
            return { team, salary: team.salary, pts };
          }).filter(Boolean);

          // Total salary spent
          const totalSpent = resolvedRiders.reduce((s, r) => s + r.salary, 0) +
            resolvedTeams.reduce((s, t) => s + t.salary, 0);
          const gpSalaryUsed = resolvedRiders.reduce((s, r) => s + r.salary, 0);
          const teamSalaryUsed = resolvedTeams.reduce((s, t) => s + t.salary, 0);
          const remainingAfterTeams = CAP - teamSalaryUsed;

          // Total points if results available
          const hasResults = Object.keys(riderResults).length > 0;
          const totalPts = hasResults
            ? resolvedRiders.reduce((s, r) => s + (r.pts || 0), 0) +
              resolvedTeams.reduce((s, t) => s + (t.pts || 0), 0)
            : p.score;

          return {
            access_code: p.access_code,
            username: p.username || p.access_code,
            score: totalPts,
            riders: resolvedRiders,
            teams: resolvedTeams,
            totalSpent,
            remainingAfterTeams,
            hasResults,
            isPractice: pj.isPractice,
          };
        })
        .sort((a, b) => (b.score || 0) - (a.score || 0));

      setEventRows(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadSeasonLB = async () => {
    setLoading(true);
    try {
      const pastEvents = events.filter(e => e.status === 'past');
      const userTotals = {};
      for (const ev of pastEvents) {
        const evPicks = await sbFetch('picks?select=access_code,username,score&event=eq.' + ev.id) || [];
        evPicks.forEach(p => {
          if (p.score == null) return;
          if (!userTotals[p.access_code]) userTotals[p.access_code] = { name: p.username || p.access_code, total: 0, events: 0 };
          userTotals[p.access_code].total += p.score;
          userTotals[p.access_code].events++;
        });
      }
      const sorted = Object.values(userTotals).sort((a, b) => b.total - a.total);
      setSeasonRows(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadGCLStandings = async () => {
    setLoading(true);
    try {
      const pastEvents = events.filter(e => e.status === 'past');
      const teamTotals = {};
      for (const ev of pastEvents) {
        const rows = await sbFetch('results?event=eq.' + ev.supabaseKey + '&limit=1') || [];
        if (!rows.length) continue;
        const tr = rows[0].team_results || {};
        Object.entries(tr).forEach(([id, raw]) => {
          const pos = typeof raw === 'object' ? raw.finalPos : raw;
          const el = typeof raw === 'object' && (raw.el || raw.el2);
          if (!pos && !el) return;
          const pts = el ? 0 : gclStagePts(pos);
          if (!teamTotals[id]) teamTotals[id] = { pts: 0, wins: 0, events: 0 };
          teamTotals[id].pts += pts;
          teamTotals[id].events++;
          if (pos === 1) teamTotals[id].wins++;
        });
      }
      const sorted = Object.entries(teamTotals).map(([id, data]) => {
        const t = GCL_TEAMS_2026.find(x => x.id === id) || { id, name: 'Team ' + id };
        return { t, ...data };
      }).sort((a, b) => b.pts - a.pts || b.wins - a.wins);
      setGclRows(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: 'var(--ink)' }}>
      <div className="px-4 pt-4 pb-0" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        <div className="font-cinzel text-xs tracking-widest mb-0.5" style={{ color: 'var(--gold)' }}>STANDINGS</div>
        <div className="font-cormorant text-xl mb-3" style={{ color: 'var(--cream)' }}>Leaderboard</div>
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-shrink-0 px-3 py-1.5 font-cinzel text-xs transition-all rounded-t"
              style={{
                background: tab === t.id ? 'rgba(180,149,48,0.08)' : 'none',
                borderBottom: `2px solid ${tab === t.id ? 'var(--gold)' : 'transparent'}`,
                color: tab === t.id ? 'var(--gold)' : 'var(--mid)',
                letterSpacing: '0.08em',
              }}
            >
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="text-center py-12 font-cormorant text-lg italic" style={{ color: 'var(--mid)' }}>Loading…</div>
        ) : tab === 'event' ? (
          <EventLeaderboard rows={eventRows} event={currentEvent} />
        ) : tab === 'season' ? (
          <SeasonLeaderboard rows={seasonRows} />
        ) : (
          <GCLStandings rows={gclRows} />
        )}
      </div>
    </div>
  );
}

function EventLeaderboard({ rows, event }) {
  const [expanded, setExpanded] = useState({});

  if (!event) return <Empty msg="Select an event to view the leaderboard" />;

  const isLocked = event.status === 'past' ||
    new Date() >= new Date(event.teamLockISO);

  const isComplete = event.status === 'past';

  if (!isLocked) {
    return <Empty msg="Picks will appear here once the team lock closes" />;
  }

  if (!rows.length) return <Empty msg="No picks submitted yet" />;

  return (
    <div>
      {/* Header bar */}
      <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        <Lock size={11} style={{ color: 'var(--gold)' }} />
        <span className="text-xs" style={{ color: 'var(--mid)' }}>
          {event.flag} {event.city} · {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
          {isComplete ? ' · Final scores' : ' · Team picks locked'}
        </span>
      </div>

      {rows.map((row, i) => {
        const open = expanded[row.access_code];
        const hasScore = row.score != null && row.score > 0;
        const teamLocked = new Date() >= new Date(event?.teamLockISO);
        const gpLocked = new Date() >= new Date(event?.gpLockISO);

        return (
          <motion.div
            key={row.access_code}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            style={{ borderBottom: '1px solid rgba(42,40,32,0.4)' }}
          >
            {/* Main row */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer"
              onClick={() => setExpanded(p => ({ ...p, [row.access_code]: !p[row.access_code] }))}
            >
              {/* Rank */}
              <div className="font-cinzel text-sm w-7 text-center flex-shrink-0"
                style={{ color: i < 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
                {i < 3 ? ['🥇', '🥈', '🥉'][i] : ordinal(i + 1)}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="font-cormorant text-base" style={{ color: 'var(--cream)' }}>
                  {row.username}
                </div>
                {/* Remaining cap after team picks — show before GP lock */}
                {teamLocked && !gpLocked && (
                  <div className="text-xs" style={{ color: '#6aad8a' }}>
                    {fmt(row.remainingAfterTeams)} remaining for GP
                  </div>
                )}
              </div>

              {/* Score or locked indicator */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {hasScore ? (
                  <div className="font-cormorant text-xl font-bold" style={{ color: 'var(--gold-lt)' }}>
                    {typeof row.score === 'number' ? row.score.toFixed(1) : row.score} pts
                  </div>
                ) : (
                  <div className="font-cinzel text-xs" style={{ color: 'var(--mid)' }}>
                    {fmt(row.totalSpent)} spent
                  </div>
                )}
                {open
                  ? <ChevronUp size={13} style={{ color: 'var(--mid)' }} />
                  : <ChevronDown size={13} style={{ color: 'var(--mid)' }} />
                }
              </div>
            </div>

            {/* Expanded picks detail */}
            {open && (
              <div className="px-4 pb-3 pt-0" style={{ background: '#0d0c09', borderTop: '1px solid rgba(42,40,32,0.4)' }}>

                {/* Teams section */}
                {row.teams.length > 0 && (
                  <div className="mb-3 mt-2">
                    <div className="font-cinzel text-xs mb-1.5"
                      style={{ color: '#6aad8a', fontSize: 9, letterSpacing: '0.1em' }}>
                      GCL TEAMS
                    </div>
                    {row.teams.map(({ team, salary, pts }) => (
                      <div key={team.id} className="flex items-center gap-2 py-1">
                        <div className="flex-1 font-cormorant text-sm" style={{ color: 'var(--cream)' }}>
                          {team.name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--mid)' }}>{fmt(salary)}</div>
                        {pts !== null ? (
                          <div className="font-cormorant text-sm font-bold w-16 text-right"
                            style={{ color: 'var(--gold-lt)' }}>
                            {pts} pts
                          </div>
                        ) : (
                          <div className="text-xs w-16 text-right" style={{ color: 'var(--mid)' }}>—</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Remaining salary for GP */}
                {teamLocked && !gpLocked && (
                  <div className="mb-3 px-2 py-1.5 rounded text-xs font-cormorant"
                    style={{ background: 'rgba(61,90,76,0.1)', border: '1px solid rgba(61,90,76,0.25)', color: '#6aad8a' }}>
                    {fmt(row.remainingAfterTeams)} available for GP rider picks
                  </div>
                )}

                {/* Riders section */}
                {row.riders.length > 0 && (
                  <div>
                    <div className="font-cinzel text-xs mb-1.5"
                      style={{ color: 'var(--gold)', fontSize: 9, letterSpacing: '0.1em' }}>
                      GP RIDERS
                    </div>
                    {row.riders.map(({ rider, isCpt, salary, pts }) => (
                      <div key={rider.id} className="flex items-center gap-2 py-1">
                        {isCpt && (
                          <span className="font-cinzel text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'rgba(180,149,48,0.15)', color: 'var(--gold)', fontSize: 8 }}>
                            CPT
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-cormorant text-sm truncate" style={{ color: isCpt ? 'var(--gold-lt)' : 'var(--cream)' }}>
                            {rider.name}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--mid)', fontSize: 9 }}>{rider.nat}</div>
                        </div>
                        <div className="text-xs flex-shrink-0" style={{ color: 'var(--mid)' }}>{fmt(salary)}</div>
                        {pts !== null ? (
                          <div className="font-cormorant text-sm font-bold w-16 text-right flex-shrink-0"
                            style={{ color: isCpt ? 'var(--gold)' : 'var(--gold-lt)' }}>
                            {pts % 1 === 0 ? pts : pts.toFixed(1)} pts
                            {isCpt && <span className="text-xs ml-0.5" style={{ color: 'var(--mid)' }}>×1.5</span>}
                          </div>
                        ) : (
                          <div className="text-xs w-16 text-right flex-shrink-0" style={{ color: 'var(--mid)' }}>—</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Total */}
                <div className="flex items-center justify-between mt-3 pt-2"
                  style={{ borderTop: '1px solid rgba(42,40,32,0.4)' }}>
                  <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9 }}>
                    TOTAL SPENT: {fmt(row.totalSpent)}
                  </div>
                  {hasScore && (
                    <div className="font-cormorant text-base font-bold" style={{ color: 'var(--gold)' }}>
                      {typeof row.score === 'number' ? row.score.toFixed(1) : row.score} pts
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function SeasonLeaderboard({ rows }) {
  if (!rows.length) return <Empty msg="No season scores recorded yet" />;
  return (
    <div>
      {rows.map((row, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'rgba(42,40,32,0.4)' }}
        >
          <div className="font-cinzel text-sm w-7 text-center" style={{ color: i < 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
            {i < 3 ? ['🥇', '🥈', '🥉'][i] : ordinal(i + 1)}
          </div>
          <div className="flex-1">
            <div className="font-cormorant text-base" style={{ color: 'var(--cream)' }}>{row.name}</div>
            <div className="text-xs" style={{ color: 'var(--mid)' }}>{row.events} events</div>
          </div>
          <div className="font-cormorant text-xl font-bold" style={{ color: 'var(--gold-lt)' }}>
            {row.total} pts
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function GCLStandings({ rows }) {
  if (!rows.length) return <Empty msg="No GCL results recorded yet" />;
  return (
    <div>
      {rows.map(({ t, pts, wins, events }, i) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02 }}
          className="flex items-center gap-2.5 px-4 py-2.5 border-b"
          style={{ borderColor: 'rgba(42,40,32,0.4)' }}
        >
          <div className="font-cinzel text-xs w-5 text-center flex-shrink-0"
            style={{ color: i < 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-cormorant text-sm font-semibold" style={{ color: 'var(--cream)' }}>{t.name}</div>
            <div className="text-xs" style={{ color: 'var(--mid)' }}>{events} events · {wins || 0} wins</div>
          </div>
          <div className="font-cormorant text-base font-bold" style={{ color: 'var(--gold-lt)' }}>
            {pts} pts
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div className="text-center py-12 font-cormorant text-lg italic" style={{ color: 'var(--mid)' }}>
      {msg}
    </div>
  );
}