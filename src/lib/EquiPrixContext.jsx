import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { EVENTS_2026, GCL_TEAMS_2026, PREVIEW_RIDERS_2026, sbFetch, NAMES, VALID_CODES, calcEventRiderSalaries } from './equiprix-data';

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
      // Load team salaries from Supabase standings
      const salRows = await sbFetch('results?event=eq.team_salaries&limit=1');
      if (salRows && salRows.length && salRows[0].gp_riders) {
        salRows[0].gp_riders.forEach(sv => {
          const t = GCL_TEAMS_2026.find(x => x.id === sv.id);
          if (t && sv.salary) t.salary = sv.salary;
          if (t && sv.rank) t.rank = sv.rank;
          if (t && sv.pts) t.pts = sv.pts;
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