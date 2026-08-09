import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { EVENTS_2026, GCL_TEAMS_2026, PREVIEW_RIDERS_2026, sbFetch, NAMES, VALID_CODES, calcEventRiderSalaries, resolveGpRiderPool } from './equiprix-data';

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

  // resolveGpRiderPool (equiprix-data.js) is now the single source of truth
  // for "this event's field, correctly priced" — shared with loadSavedPicks
  // below and with PicksEditor.jsx, so a rider's salary is always priced
  // against the same pool everywhere it's shown.
  const getRiderList = (ev) => resolveGpRiderPool(ev);

  const doSelectEvent = useCallback((ev) => {
    setCurrentEventState(ev);
    setRiders(getRiderList(ev));
    setTeams(ev.teams?.length ? ev.teams : GCL_TEAMS_2026);
    setTeam([]);
    setTeamPicks([]);
  }, []);

  // FIXED: re-clicking the already-selected event (e.g. navigating back to
  // Events and tapping the same event card) used to unconditionally call
  // doSelectEvent, which blanks team/teamPicks to []. That's fine the FIRST
  // time an event is selected — the picks-loading effect in EquiPrix.jsx
  // (keyed on currentEvent.id/status) re-fires right after and restores
  // saved picks. But on a re-click of the SAME event, id and status are
  // unchanged, so that effect never re-fires — team/teamPicks stayed wiped
  // permanently. This is what caused the salary cap to show the full
  // amount (instead of 50000 minus Team Draft spend) the moment a player
  // navigated back into an event after GP Draft opened: the event's status
  // had already flipped via the live subscription, so clicking it again
  // wiped picks with nothing to restore them. Now a re-click on the
  // already-current event is a no-op — riders/teams/status still update
  // live elsewhere (loadEventData), so nothing is lost by skipping the
  // reset here.
  const selectEvent = useCallback((id) => {
    if (currentEvent?.id === id) return;
    setEvents(prev => {
      const ev = prev.find(e => e.id === id);
      if (ev) doSelectEvent(ev);
      return prev;
    });
  }, [doSelectEvent, currentEvent]);

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

      // 2.5 fetch live rank/salary once here and overlay it onto every
      // event's gpRiders/previewRiders snapshot too. Those arrays are
      // saved snapshots — frozen at whatever rank values existed the last
      // time RidersEditor's "Save GP" button ran. Without this, a rider's
      // rank could be fixed in the riders table (e.g. via RankingsImport)
      // and still show 999 everywhere the Draft tab reads gpRiders/
      // previewRiders.
      const riderRowsForOverlay = await sbFetch('riders?select=id,rank,salary&limit=5000');
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

      // 2. GCL team standings read from dedicated gcl_team_standings table
      // (id=1, data jsonb). Shape: array of { id, rank, pts, salary }.
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

  // NEW: realtime subscription — any change to `results` (event status,
  // lock times, gp_riders snapshots) or `gcl_team_standings` (official GCL
  // standings) re-runs loadEventData() for everyone with the app open.
  // This is what makes an admin flipping event status, or updating team
  // standings, show up live for all users instead of requiring a manual
  // page refresh.
  useEffect(() => {
    let debounceTimer = null;
    const scheduleReload = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { loadEventData(); }, 300);
    };

    const channel = supabase
      .channel('equiprix-events-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gcl_team_standings' }, scheduleReload)
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [loadEventData]);

  const loadSavedPicks = useCallback(async (identity, ev, roomId = currentDestination) => {
    if (!ev || !['preview', 'teams', 'riders', 'open'].includes(ev.status)) return;
    try {
      const rows = await sbFetch('picks?user_email=eq.' + encodeURIComponent(identity) + '&event=eq.' + ev.id + '&room_id=eq.' + (roomId || GENERAL_ROOM_ID) + '&limit=1');
      if (rows && rows.length > 0) {
        const p = rows[0].picks_json;
        // FIXED: this used to build ITS OWN merged pool (gpRiders +
        // previewRiders + riders + all 169 PREVIEW_RIDERS_2026 — 200+
        // riders) and run calcEventRiderSalaries over that combined list.
        // But calcEventRiderSalaries prices the top 30 FIELD-RELATIVE —
        // salary depends on a rider's rank POSITION within whatever list
        // you hand it. A ~30-rider GP field and a 200+-rider merged pool
        // produce completely different field-rank positions (and so
        // different salaries) for the same rider. That's why a saved pick
        // could show a different price here than the live Draft tab's
        // rider list, and why the captain premium looked "missing" — it
        // WAS being added, just on top of that wrong base salary. Now this
        // uses getRiderList(ev), the exact same pool/pricing the Draft tab
        // itself renders, so a restored pick always matches what's shown
        // live. PREVIEW_RIDERS_2026 (priced independently, not blended in)
        // is only a fallback for a saved rider who's no longer in the
        // event's current field at all.
        const evRidersWithSalaries = getRiderList(ev);
        const fallbackRiders = calcEventRiderSalaries(PREVIEW_RIDERS_2026);
        const findRider = (id) =>
          evRidersWithSalaries.find(r => String(r.id) === String(id)) ||
          fallbackRiders.find(r => String(r.id) === String(id));
        const evTeams = ev.teams && ev.teams.length ? ev.teams : GCL_TEAMS_2026;
        const SLOT_IDS = ['cpt', 'r1', 'r2', 'r3', 'r4'];
        const newTeam = [];
        (p.riders || []).forEach(s => {
          const rider = findRider(s.id);
          if (rider) newTeam.push({ rider, slotId: SLOT_IDS[newTeam.length], isCpt: s.isCpt });
        });
        const newTeamPicks = [];
        (p.teams || []).forEach((s, i) => {
          const t = evTeams.find(t => String(t.id) === String(s.id));
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