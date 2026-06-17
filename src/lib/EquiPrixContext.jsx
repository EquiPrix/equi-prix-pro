import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { EVENTS_2026, GCL_TEAMS_2026, PREVIEW_RIDERS_2026, sbFetch, NAMES, VALID_CODES, calcEventRiderSalaries, gclStagePts } from './equiprix-data';

const EquiPrixContext = createContext(null);

// Computes live GCL pts/rank/wins for every team from actual entered
// team_results across all past events — same logic LeaderboardTab's GCL
// Standings tab already uses. This is the SINGLE source of truth for
// rank/pts everywhere (Draft tab pricing order, admin Standings tab display),
// replacing the old approach of reading a static team_salaries Supabase row
// for rank/pts, which could silently drift out of sync with real results.
// Salary remains a separate, genuinely manual override (still read from the
// team_salaries row), since pricing is a draft decision, not a result.
//
// IMPORTANT: takes the live `events` array (with Supabase status overrides
// already merged in) as a parameter — NOT the static EVENTS_2026 import,
// which never reflects status changes made via the admin Status tab. Pass
// the `events` state from EquiPrixContext (or fetch it fresh) when calling
// this from outside the provider, e.g. from TeamStandingsEditor.
export async function computeLiveGclStandings(eventsList) {
  const sourceEvents = eventsList || EVENTS_2026;
  const pastEvents = sourceEvents.filter(e => e.status === 'past');
  const teamTotals = {};

  // Fetch all past events' results CONCURRENTLY instead of one at a time —
  // sequential awaits here were adding several seconds to every page load
  // (one Supabase round-trip per past event, six and growing). These are
  // independent reads with no ordering dependency, so Promise.all is safe.
  const allRows = await Promise.all(
    pastEvents.map(ev => sbFetch('results?event=eq.' + ev.supabaseKey + '&limit=1'))
  );

  allRows.forEach(rows => {
    if (!rows || !rows.length) return;
    const tr = rows[0].team_results || {};
    Object.entries(tr).forEach(([id, raw]) => {
      const pos = typeof raw === 'object' ? raw.finalPos : raw;
      const ret = typeof raw === 'object' && raw.ret;
      const el = typeof raw === 'object' && (raw.el || raw.el2);
      const madeR2 = typeof raw === 'object' && raw.r2Faults != null;
      if (!pos && !el && !ret) return;
      // Per official GCL Rule 5.22: R1-only elimination/retirement (never
      // reached R2) scores zero points. R2 elimination/retirement still
      // scores for whatever rank was assigned — the rule only dictates
      // placement, not point exclusion, once a team has reached Round 2.
      const isR1OnlyElimination = (ret || el) && !madeR2;
      const pts = isR1OnlyElimination ? 0 : gclStagePts(pos);
      if (!teamTotals[id]) teamTotals[id] = { pts: 0, wins: 0, events: 0 };
      teamTotals[id].pts += pts;
      teamTotals[id].events++;
      if (pos === 1) teamTotals[id].wins++;
    });
  });

  // Rank by pts descending, tiebreak by wins
  const ranked = Object.entries(teamTotals)
    .sort((a, b) => b[1].pts - a[1].pts || b[1].wins - a[1].wins)
    .map(([id, data], i) => ({ id, rank: i + 1, ...data }));

  return ranked;
}

export function EquiPrixProvider({ children }) {
  const [events, setEvents] = useState(() => EVENTS_2026.map(e => ({ ...e })));
  const [currentEvent, setCurrentEventState] = useState(null);
  const [userCode, setUserCode] = useState(() => localStorage.getItem('ep_code') || null);
  const [team, setTeam] = useState([]);
  const [teamPicks, setTeamPicks] = useState([]);
  const [riders, setRiders] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const hasAutoSelected = useRef(false);

  const userName = userCode ? (NAMES[userCode] || (userCode === 'EQUIPRIX' || userCode === 'BETA2026' ? 'Beta User' : userCode)) : null;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const getRiderList = (ev) => {
    const st = ev.status;
    if (st === 'teams') return [];
    if (st === 'past') return ev.riders || [];

    // Get the raw rider list
    let rawRiders = null;
    if (ev.gpRiders?.length) rawRiders = ev.gpRiders;
    else if (ev.previewRiders?.length) rawRiders = ev.previewRiders;
    else rawRiders = ev.riders || [];

    // Apply dynamic salary curve based on this event's field
    if (rawRiders.length) return calcEventRiderSalaries(rawRiders);
    return [];
  };

  const doSelectEvent = useCallback((ev) => {
    setCurrentEventState(ev);
    setRiders(getRiderList(ev));
    setTeams(ev.teams?.length ? ev.teams : GCL_TEAMS_2026);
    setTeam([]);
    setTeamPicks([]);
  }, []);

  const selectEvent = useCallback((id) => {
    setEvents(prev => {
      const ev = prev.find(e => e.id === id);
      if (ev) doSelectEvent(ev);
      return prev;
    });
  }, [doSelectEvent]);

  const loadEventData = useCallback(async () => {
    try {
      // Build the live events list FIRST (with Supabase status overrides
      // merged in) — standings computation below depends on knowing which
      // events are ACTUALLY 'past' right now, not just what the static
      // EVENTS_2026 file says.
      const rows = await sbFetch('results?select=event,event_status,gp_riders,preview_riders,team_lock_iso,gp_lock_iso');

      let updatedEvents = EVENTS_2026.map(e => ({ ...e }));

      if (rows && rows.length) {
        updatedEvents = updatedEvents.map(ev => {
          const row = rows.find(r => r.event === ev.supabaseKey);
          if (!row) return ev;
          return {
            ...ev,
            ...(row.event_status ? { status: row.event_status } : {}),
            ...(row.team_lock_iso ? { teamLockISO: row.team_lock_iso } : {}),
            ...(row.gp_lock_iso ? { gpLockISO: row.gp_lock_iso } : {}),
            ...(!ev.gpRiders?.length && row.gp_riders?.length ? { gpRiders: row.gp_riders } : {}),
            ...(row.preview_riders?.length ? { previewRiders: row.preview_riders } : {}),
          };
        });
      }

      setEvents(updatedEvents);

      // Compute live GCL rank/pts/wins from actual entered results, using
      // the SAME live-status event list the rest of the app now uses — this
      // is the single source of truth, not a hand-maintained Supabase row.
      const liveStandings = await computeLiveGclStandings(updatedEvents);
      liveStandings.forEach(({ id, rank, pts }) => {
        const t = GCL_TEAMS_2026.find(x => x.id === id);
        if (t) { t.rank = rank; t.pts = pts; }
      });

      // Salary is a separate, genuinely manual override — still read from
      // the team_salaries Supabase row, but ONLY for salary now (rank/pts
      // there are ignored, since they're superseded by the live computation
      // above and may be stale).
      const salRows = await sbFetch('results?event=eq.team_salaries&limit=1');
      if (salRows && salRows.length && salRows[0].gp_riders) {
        salRows[0].gp_riders.forEach(sv => {
          const t = GCL_TEAMS_2026.find(x => x.id === sv.id);
          if (t && sv.salary) t.salary = sv.salary;
        });
      }

      // Load FEI rankings (updates PREVIEW_RIDERS_2026 base ranks)
      const rankRows = await sbFetch('results?event=eq.fei_rankings&limit=1');
      if (rankRows && rankRows.length && rankRows[0].gp_riders) {
        rankRows[0].gp_riders.forEach(sr => {
          const r = PREVIEW_RIDERS_2026.find(pr => pr.id === sr.id);
          if (r) { r.rank = sr.rank; }
          // Note: salary is now calculated dynamically, not stored
        });
      }

      if (!hasAutoSelected.current) {
        hasAutoSelected.current = true;
        const priority = ['live', 'riders', 'teams', 'preview', 'future'];
        let best = null;
        for (const s of priority) {
          best = updatedEvents.find(e => e.status === s);
          if (best) break;
        }
        if (!best) {
          const pastEvents = updatedEvents.filter(e => e.status === 'past');
          best = pastEvents[pastEvents.length - 1];
        }
        if (best) doSelectEvent(best);
      } else {
        setCurrentEventState(cur => {
          if (!cur) return cur;
          const ev = updatedEvents.find(e => e.id === cur.id) || cur;
          setRiders(getRiderList(ev));
          setTeams(ev.teams?.length ? ev.teams : GCL_TEAMS_2026);
          return ev;
        });
      }

    } catch (e) {
      console.error('loadEventData error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [doSelectEvent]);

  useEffect(() => {
    loadEventData();
  }, [loadEventData]);

  const loadSavedPicks = useCallback(async (code, ev) => {
    if (!ev || !['preview', 'teams', 'riders', 'open'].includes(ev.status)) return;
    try {
      let rows = await sbFetch('picks?access_code=eq.' + encodeURIComponent(code) + '&event=eq.' + ev.id + '&limit=1');
      if (!rows || !rows.length) rows = await sbFetch('picks?access_code=eq.' + encodeURIComponent(code) + '&limit=1');
      if (rows && rows.length > 0) {
        const p = rows[0].picks_json;

        const allAvailableRiders = [
          ...(ev.gpRiders || []),
          ...(ev.previewRiders || []),
          ...(ev.riders || []),
          ...PREVIEW_RIDERS_2026,
        ];
        const seenIds = new Set();
        const evRiders = allAvailableRiders.filter(r => {
          if (seenIds.has(r.id)) return false;
          seenIds.add(r.id);
          return true;
        });

        // Apply dynamic salaries to restored picks too
        const evRidersWithSalaries = calcEventRiderSalaries(evRiders);

        const evTeams = ev.teams && ev.teams.length ? ev.teams : GCL_TEAMS_2026;
        const SLOT_IDS = ['cpt', 'r1', 'r2', 'r3', 'r4'];
        const newTeam = [];
        (p.riders || []).forEach(s => {
          const rider = evRidersWithSalaries.find(r => r.id === s.id);
          if (rider) newTeam.push({ rider, slotId: SLOT_IDS[newTeam.length], isCpt: s.isCpt });
        });
        const newTeamPicks = [];
        (p.teams || []).forEach((s, i) => {
          const t = evTeams.find(t => t.id === s.id);
          if (t) newTeamPicks.push({ ...t, slotId: 't' + (i + 1) });
        });
        setTeam(newTeam);
        setTeamPicks(newTeamPicks);
        showToast('Picks restored ✓');
      }
    } catch (e) {
      console.warn('Could not load picks:', e);
    }
  }, [riders, showToast]);

  const login = useCallback((code) => {
    const upper = code.trim().toUpperCase();
    const isNamedCode = VALID_CODES.includes(upper);
    const isEqprixCode = /^EQPRIX\d{2}$/.test(upper);
    const isDemoCode = upper === 'EQUIPRIX' || upper === 'BETA2026';
    if (isNamedCode || isEqprixCode || isDemoCode) {
      setUserCode(upper);
      localStorage.setItem('ep_code', upper);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUserCode(null);
    localStorage.removeItem('ep_code');
  }, []);

  return (
    <EquiPrixContext.Provider value={{
      events, setEvents,
      currentEvent, selectEvent,
      userCode, userName, login, logout,
      team, setTeam,
      teamPicks, setTeamPicks,
      riders, setRiders,
      teams, setTeams,
      isLoading,
      toast, showToast,
      loadSavedPicks,
      loadEventData,
    }}>
      {children}
    </EquiPrixContext.Provider>
  );
}

export function useEquiPrix() {
  const ctx = useContext(EquiPrixContext);
  if (!ctx) throw new Error('useEquiPrix must be used within EquiPrixProvider');
  return ctx;
}