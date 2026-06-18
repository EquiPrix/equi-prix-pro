import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { EVENTS_2026, GCL_TEAMS_2026, PREVIEW_RIDERS_2026, sbFetch, NAMES, VALID_CODES, calcEventRiderSalaries } from './equiprix-data';

// Sentinel room_id representing "General Leaderboard" (not a real room).
// Using NULL here would break Postgres's unique-constraint upsert logic,
// since NULL is never considered equal to NULL in a uniqueness check —
// every General save would silently fail to find/update the existing
// row and either error or create duplicates. A real, fixed UUID avoids
// that entirely while still being unambiguous as "not a real room."
export const GENERAL_ROOM_ID = '00000000-0000-0000-0000-000000000000';

const EquiPrixContext = createContext(null);

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

  // Destinations: where a user's picks for the CURRENT event get saved.
  // null = General Leaderboard. A room object = that specific room.
  // destinations is the list of options available right now (General,
  // if not opted out, plus every room the user belongs to for this
  // event); currentDestination is whichever one is selected in the
  // Draft tab's selector.
  const [currentDestination, setCurrentDestinationState] = useState(GENERAL_ROOM_ID); // GENERAL_ROOM_ID = General Leaderboard
  const [destinations, setDestinations] = useState([]); // [{ id: null, name: 'General Leaderboard' }, { id: roomId, name, ... }]
  const [generalOptedOut, setGeneralOptedOut] = useState(false);
  const [destinationsLoading, setDestinationsLoading] = useState(false);

  const userName = userCode ? (NAMES[userCode] || (userCode === 'EQUIPRIX' || userCode === 'BETA2026' ? 'Beta User' : userCode)) : null;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Builds the destination list for a given user+event: General (unless
  // the user has opted out AND has at least one other room to fall back
  // to — a user with zero rooms always keeps General, no toggle), plus
  // every room scoped to this event the user is a member of.
  const loadDestinations = useCallback(async (identity, ev) => {
    if (!identity || !ev) { setDestinations([]); return; }
    setDestinationsLoading(true);
    try {
      const memberships = await sbFetch('room_members?user_email=eq.' + encodeURIComponent(identity)) || [];
      let myRooms = [];
      if (memberships.length) {
        const roomIds = memberships.map(m => m.room_id);
        const allRooms = await sbFetch('rooms?id=in.(' + roomIds.join(',') + ')') || [];
        myRooms = allRooms.filter(r => r.event_id === ev.supabaseKey || r.event_id === ev.id);
      }

      // Opt-out preference is stored on the General picks row itself
      // (picks_json.optedOutOfGeneral) so it's per-event and doesn't need
      // a separate table. A user with no rooms can't opt out — General
      // is their only destination, always on, no toggle shown.
      let optedOut = false;
      if (myRooms.length) {
        try {
          const genRows = await sbFetch('picks?user_email=eq.' + encodeURIComponent(identity) + '&event=eq.' + ev.id + '&room_id=eq.' + GENERAL_ROOM_ID + '&limit=1');
          optedOut = !!(genRows && genRows.length && genRows[0].picks_json?.optedOutOfGeneral);
        } catch (e) { /* default to opted-in if we can't tell */ }
      }
      setGeneralOptedOut(optedOut);

      const list = [];
      if (!myRooms.length || !optedOut) {
        list.push({ id: GENERAL_ROOM_ID, name: 'General Leaderboard' });
      }
      myRooms.forEach(r => list.push({ id: r.id, name: r.name }));
      setDestinations(list);

      // If the currently-selected destination no longer exists in the
      // new list (e.g. switched events, or opted out of the one we were
      // on), fall back to the first available option.
      setCurrentDestinationState(cur => {
        const stillValid = list.some(d => d.id === cur);
        return stillValid ? cur : (list[0]?.id ?? GENERAL_ROOM_ID);
      });
    } catch (e) {
      console.error('loadDestinations error:', e);
      setDestinations([{ id: GENERAL_ROOM_ID, name: 'General Leaderboard' }]);
    } finally {
      setDestinationsLoading(false);
    }
  }, []);

  const setCurrentDestination = useCallback((destId) => {
    setCurrentDestinationState(destId);
  }, []);

  const setGeneralOptOut = useCallback(async (identity, ev, optOut) => {
    if (!identity || !ev) return;
    setGeneralOptedOut(optOut);
    try {
      // Persist the flag on the General picks row (room_id = the
      // GENERAL_ROOM_ID sentinel) so it survives reloads. Doesn't touch
      // riders/teams already drafted for General — just marks visibility
      // going forward.
      const rows = await sbFetch('picks?user_email=eq.' + encodeURIComponent(identity) + '&event=eq.' + ev.id + '&room_id=eq.' + GENERAL_ROOM_ID + '&limit=1');
      const existing = rows && rows.length ? rows[0].picks_json : { riders: [], teams: [] };
      await sbFetch('picks?on_conflict=user_email,event,room_id', {
        method: 'POST',
        body: JSON.stringify({
          user_email: identity,
          event: ev.id,
          room_id: GENERAL_ROOM_ID,
          picks_json: { ...existing, optedOutOfGeneral: optOut },
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error('setGeneralOptOut error:', e);
    }
  }, []);

  const getRiderList = (ev) => {
    const st = ev.status;
    if (st === 'past') return ev.riders || [];

    // 'teams' status means the OFFICIAL GP start list isn't announced yet,
    // but riders should still be visible so people can budget their team
    // before the team lock — same gpRiders -> previewRiders -> riders
    // fallback chain as every other open status. Once the real GP list
    // is announced (ev.gpRiders populated), it takes over automatically;
    // picks made against preview riders still resolve correctly since
    // rider ids are stable across both lists.
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
      // merged in) — event status display/locking still depends on this.
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

      // GCL rank/pts/salary are now ENTIRELY manual — entered on the
      // Leaderboard tab (TeamStandingsEditor) and saved into the
      // team_salaries Supabase row. This is the single source of truth
      // for GCL_TEAMS_2026; nothing is derived from entered event results
      // anymore (that calculation — computeLiveGclStandings — has been
      // removed, since it drifted from the official GCL site and produced
      // a second, conflicting number). Draft pricing/ranking, the public
      // Leaderboard, and this admin context all now read the same saved
      // values, with no live-vs-manual disagreement possible.
      const salRows = await sbFetch('results?event=eq.team_salaries&limit=1');
      if (salRows && salRows.length && salRows[0].gp_riders) {
        salRows[0].gp_riders.forEach(sv => {
          const t = GCL_TEAMS_2026.find(x => x.id === sv.id);
          if (!t) return;
          if (sv.rank !== undefined && sv.rank !== '') t.rank = Number(sv.rank);
          if (sv.pts !== undefined && sv.pts !== '') t.pts = Number(sv.pts);
          if (sv.salary) t.salary = sv.salary;
        });
        // Keep GCL_TEAMS_2026 sorted by rank so every consumer that reads
        // it directly (Draft tab pricing order, public Leaderboard, etc.)
        // sees the manually-entered order.
        GCL_TEAMS_2026.sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));
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

  // identity is the user's email (activeUserIdentity from EquiPrix.jsx).
  // roomId is GENERAL_ROOM_ID for General Leaderboard, or a room's real
  // uuid — defaults to whatever's currently selected if not passed
  // explicitly.
  const loadSavedPicks = useCallback(async (identity, ev, roomId = currentDestination) => {
    if (!ev || !['preview', 'teams', 'riders', 'open'].includes(ev.status)) return;
    try {
      const rows = await sbFetch('picks?user_email=eq.' + encodeURIComponent(identity) + '&event=eq.' + ev.id + '&room_id=eq.' + (roomId || GENERAL_ROOM_ID) + '&limit=1');
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
      } else {
        // No saved picks for this destination yet — clear the roster
        // rather than leaving the previous destination's picks showing.
        setTeam([]);
        setTeamPicks([]);
      }
    } catch (e) {
      console.warn('Could not load picks:', e);
    }
  }, [riders, showToast, currentDestination]);

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
      currentDestination, setCurrentDestination,
      destinations, loadDestinations, destinationsLoading,
      generalOptedOut, setGeneralOptOut,
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