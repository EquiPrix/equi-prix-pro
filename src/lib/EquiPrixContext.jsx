import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { EVENTS_2026, GCL_TEAMS_2026, PREVIEW_RIDERS_2026, sbFetch, NAMES, VALID_CODES } from './equiprix-data';

const EquiPrixContext = createContext(null);

export function EquiPrixProvider({ children }) {
  const [events, setEvents] = useState(() => EVENTS_2026.map(e => ({ ...e })));
  const [currentEvent, setCurrentEventState] = useState(null);
  const [userCode, setUserCode] = useState(() => localStorage.getItem('ep_code') || null);
  const [team, setTeam] = useState([]); // [{rider, slotId, isCpt}]
  const [teamPicks, setTeamPicks] = useState([]); // [{...team, slotId}]
  const [riders, setRiders] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const userName = userCode ? (NAMES[userCode] || (userCode === 'EQUIPRIX' || userCode === 'BETA2026' ? 'Beta User' : userCode)) : null;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Load event data from Supabase
  const loadEventData = useCallback(async () => {
    try {
      // Load team salaries
      const salRows = await sbFetch('results?event=eq.team_salaries&limit=1');
      if (salRows && salRows.length && salRows[0].gp_riders) {
        const saved = salRows[0].gp_riders;
        setEvents(prev => prev.map(ev => ({ ...ev })));
        // Update GCL_TEAMS_2026 salaries in place
        saved.forEach(sv => {
          const t = GCL_TEAMS_2026.find(x => x.id === sv.id);
          if (t && sv.salary) t.salary = sv.salary;
        });
      }

      // Load FEI rankings
      const rankRows = await sbFetch('results?event=eq.fei_rankings&limit=1');
      if (rankRows && rankRows.length && rankRows[0].gp_riders) {
        rankRows[0].gp_riders.forEach(sr => {
          const r = PREVIEW_RIDERS_2026.find(pr => pr.id === sr.id);
          if (r) { r.rank = sr.rank; r.salary = sr.salary; }
        });
      }

      // Load all result rows for statuses
      const rows = await sbFetch('results?select=event,event_status,gp_riders,preview_riders,team_lock_iso,gp_lock_iso');
      if (rows && rows.length) {
        setEvents(prev => prev.map(ev => {
          const row = rows.find(r => r.event === ev.supabaseKey);
          if (!row) return ev;
          return {
            ...ev,
            ...(row.event_status ? { status: row.event_status } : {}),
            ...(row.team_lock_iso ? { teamLockISO: row.team_lock_iso } : {}),
            ...(row.gp_lock_iso ? { gpLockISO: row.gp_lock_iso } : {}),
            ...(row.gp_riders && row.gp_riders.length ? { gpRiders: row.gp_riders } : {}),
            ...(row.preview_riders && row.preview_riders.length ? { previewRiders: row.preview_riders } : {}),
          };
        }));
      }
    } catch (e) {
      console.error('loadEventData error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEventData();
  }, [loadEventData]);

  // Select event — just sets currentEvent; riders/teams derived reactively below
  const selectEvent = useCallback((id) => {
    setEvents(prev => {
      const ev = prev.find(e => e.id === id);
      if (!ev) return prev;
      setCurrentEventState(ev);
      setTeam([]);
      setTeamPicks([]);
      return prev;
    });
  }, []);

  // Reactively derive riders/teams whenever currentEvent changes
  // (also re-runs if events array updates with fresh previewRiders from Supabase)
  useEffect(() => {
    if (!currentEvent) return;
    // Re-read the event from the latest events array to pick up any async updates
    setEvents(prev => {
      const ev = prev.find(e => e.id === currentEvent.id) || currentEvent;
      const st = ev.status;
      const riderList =
        st === 'riders' ? (ev.gpRiders?.length ? ev.gpRiders : ev.riders || []) :
        st === 'teams'  ? [] :
        st === 'past'   ? (ev.riders || []) :
        (ev.previewRiders?.length ? ev.previewRiders : ev.riders || []);
      setRiders(riderList);
      const teamList = ev.teams?.length ? ev.teams : GCL_TEAMS_2026;
      setTeams(teamList);
      return prev;
    });
  }, [currentEvent, events]);

  // Auto-select best event once after loading completes
  const hasAutoSelected = React.useRef(false);
  useEffect(() => {
    if (isLoading || hasAutoSelected.current) return;
    hasAutoSelected.current = true;
    const priority = ['live', 'riders', 'teams', 'preview', 'future'];
    let best = null;
    for (const s of priority) {
      best = events.find(e => e.status === s);
      if (best) break;
    }
    if (!best) {
      const pastEvents = events.filter(e => e.status === 'past');
      best = pastEvents[pastEvents.length - 1];
    }
    if (best) selectEvent(best.id);
  }, [isLoading]);

  // Load saved picks
  const loadSavedPicks = useCallback(async (code, ev) => {
    if (!ev || !['preview', 'teams', 'riders', 'open'].includes(ev.status)) return;
    try {
      let rows = await sbFetch('picks?access_code=eq.' + encodeURIComponent(code) + '&event=eq.' + ev.id + '&limit=1');
      if (!rows || !rows.length) rows = await sbFetch('picks?access_code=eq.' + encodeURIComponent(code) + '&limit=1');
      if (rows && rows.length > 0) {
        const p = rows[0].picks_json;
        const evRiders = ev.gpRiders || ev.riders || riders;
        const evTeams = ev.teams && ev.teams.length ? ev.teams : GCL_TEAMS_2026;
        const SLOT_IDS = ['cpt', 'r1', 'r2', 'r3', 'r4'];
        const newTeam = [];
        (p.riders || []).forEach(s => {
          const rider = evRiders.find(r => r.id === s.id);
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
    // Valid codes: specific named codes, EQPRIX01-99 pattern, or demo code
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