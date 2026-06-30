import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { EVENTS_2026, GCL_TEAMS_2026, PREVIEW_RIDERS_2026, sbFetch, NAMES, VALID_CODES, calcEventRiderSalaries } from './equiprix-data';

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

  const [currentDestination, setCurrentDestinationState] = useState(GENERAL_ROOM_ID);
  const [destinations, setDestinations] = useState([]);
  const [generalOptedOut, setGeneralOptedOut] = useState(false);
  const [destinationsLoading, setDestinationsLoading] = useState(false);

  const userName = userCode ? (NAMES[userCode] || (userCode === 'EQUIPRIX' || userCode === 'BETA2026' ? 'Beta User' : userCode)) : null;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

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

      let optedOut = false;
      if (myRooms.length) {
        try {
          const genRows = await sbFetch('picks?user_email=eq.' + encodeURIComponent(identity) + '&event=eq.' + ev.id + '&room_id=eq.' + GENERAL_ROOM_ID + '&limit=1');
          optedOut = !!(genRows && genRows.length && genRows[0].picks_json?.optedOutOfGeneral);
        } catch (e) { /* default to opted-in */ }
      }
      setGeneralOptedOut(optedOut);

      const list = [];
      if (!myRooms.length || !optedOut) {
        list.push({ id: GENERAL_ROOM_ID, name: 'General Leaderboard' });
      }
      myRooms.forEach(r => list.push({ id: r.id, name: r.name }));
      setDestinations(list);

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
    let rawRiders = null;
    if (ev.gpRiders?.length) rawRiders = ev.gpRiders;
    else if (ev.previewRiders?.length) rawRiders = ev.previewRiders;
    else rawRiders = ev.riders || [];
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
      // 1. Build live events list from results (status overrides, gp_riders, etc.)
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

      // 2.5 CHANGED: fetch live rank/salary once here (moved up from where
      // it used to only apply to PREVIEW_RIDERS_2026) and overlay it onto
      // every event's gpRiders/previewRiders snapshot too. Those arrays are
      // saved snapshots from results.gp_riders / results.preview_riders —
      // frozen at whatever rank values existed the last time RidersEditor's
      // "Save GP" button ran. Without this, a rider's rank could be fixed
      // in the riders table (e.g. via RankingsImport) and still show 999
      // everywhere the Draft tab reads gpRiders/previewRiders, since that
      // overlay previously only ever touched the separate PREVIEW_RIDERS_2026
      // array, not these per-event snapshots.
      const riderRowsForOverlay = await sbFetch('riders?select=id,rank,salary&limit=1000');
      const liveRankMap = {};
      if (riderRowsForOverlay && riderRowsForOverlay.length) {
        riderRowsForOverlay.forEach(r => {
          if (r.rank && r.rank !== 999) liveRankMap[String(r.id)] = { rank: r.rank, salary: r.salary };
        });
      }
      const overlayLiveRanks = (list) => (list || []).map(r => {
        const live = liveRankMap[String(r.id)];
        return live ? { ...r, rank: live.rank, salary: live.salary } : r;
      });
      updatedEvents = updatedEvents.map(ev => ({
        ...ev,
        ...(ev.gpRiders?.length ? { gpRiders: overlayLiveRanks(ev.gpRiders) } : {}),
        ...(ev.previewRiders?.length ? { previewRiders: overlayLiveRanks(ev.previewRiders) } : {}),
      }));

      setEvents(updatedEvents);

      // 2. CHANGED: GCL team standings now read from dedicated gcl_team_standings
      // table (id=1, data jsonb) instead of results sentinel row 'team_salaries'.
      // Shape is identical — array of { id, rank, pts, salary } objects.
      const standingsRows = await sbFetch('gcl_team_standings?id=eq.1&limit=1');
      if (standingsRows && standingsRows.length && standingsRows[0].data?.length) {
        standingsRows[0].data.forEach(sv => {
          const t = GCL_TEAMS_2026.find(x => x.id === sv.id);
          if (!t) return;
          if (sv.rank !== undefined && sv.rank !== '') t.rank = Number(sv.rank);
          if (sv.pts  !== undefined && sv.pts  !== '') t.pts  = Number(sv.pts);
          if (sv.salary) t.salary = sv.salary;
        });
        GCL_TEAMS_2026.sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));
      }

      // 3. Apply the same live rank/salary data (already fetched above) onto
      // PREVIEW_RIDERS_2026 as well, so every consumer that reads that
      // array directly also gets live ranks — same map, no second fetch.
      if (riderRowsForOverlay && riderRowsForOverlay.length) {
        PREVIEW_RIDERS_2026.forEach(r => {
          const live = liveRankMap[String(r.id)];
          if (live) {
            r.rank   = live.rank;
            r.salary = live.salary;
          }
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
        setTeam([]);
        setTeamPicks([]);
      }
    } catch (e) {
      console.warn('Could not load picks:', e);
    }
  }, [riders, showToast, currentDestination]);

  const login = useCallback((code) => {
    const upper = code.trim().toUpperCase();
    const isNamedCode   = VALID_CODES.includes(upper);
    const isEqprixCode  = /^EQPRIX\d{2}$/.test(upper);
    const isDemoCode    = upper === 'EQUIPRIX' || upper === 'BETA2026';
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