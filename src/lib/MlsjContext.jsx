import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  MLSJ_EVENTS_2026_27, MLSJ_TEAMS_2026, sbFetch, calcMlsjTeamSalaries,
} from './mlsj-data';
import { NAMES, VALID_CODES } from './equiprix-data';

const MlsjContext = createContext(null);

export function MlsjProvider({ children }) {
  const [events, setEvents] = useState(() => MLSJ_EVENTS_2026_27.map(e => ({ ...e })));
  const [currentEvent, setCurrentEventState] = useState(null);
  const [userCode, setUserCode] = useState(() => localStorage.getItem('ep_code') || null);

  // Combined roster: GP riders (with captain) + 2 picked real MLSJ teams, single cap
  const [gpTeam, setGpTeam] = useState([]);       // [{ rider, slotId, isCpt }]
  const [teamPicks, setTeamPicks] = useState([]); // [{ ...mlsjTeam, slotId: 'mt1' | 'mt2' }]

  const [riders, setRiders] = useState([]);       // available GP riders for current event
  const [mlsjTeams, setMlsjTeams] = useState([]); // available MLSJ teams (priced) for current event

  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const hasAutoSelected = useRef(false);

  const userName = userCode ? (NAMES[userCode] || (userCode === 'EQUIPRIX' || userCode === 'BETA2026' ? 'Beta User' : userCode)) : null;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Apply combined-trio pricing to whichever team list this event carries
  const getPricedTeams = (ev) => {
    const baseTeams = ev.declaredTeams?.length ? ev.declaredTeams : MLSJ_TEAMS_2026;
    return calcMlsjTeamSalaries(baseTeams);
  };

  const getRiderList = (ev) => {
    if (ev.status === 'past') return ev.riders || [];
    if (ev.gpRiders?.length) return ev.gpRiders;
    if (ev.previewRiders?.length) return ev.previewRiders;
    return ev.riders || [];
  };

  const doSelectEvent = useCallback((ev) => {
    setCurrentEventState(ev);
    setRiders(getRiderList(ev));
    setMlsjTeams(getPricedTeams(ev));
    setGpTeam([]);
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
      // Each leg's row in `results` (event = mlsj supabaseKey) carries:
      //   event_status, gp_riders (start list), declared_teams (8 teams w/ declaredTrio),
      //   team_results (per-team round outcomes), gp_lock_iso, team_lock_iso
      const rows = await sbFetch(
        'results?select=event,event_status,gp_riders,declared_teams,team_results,gp_lock_iso,team_lock_iso'
      );

      let updatedEvents = MLSJ_EVENTS_2026_27.map(e => ({ ...e }));

      if (rows && rows.length) {
        updatedEvents = updatedEvents.map(ev => {
          const row = rows.find(r => r.event === ev.supabaseKey);
          if (!row) return ev;
          return {
            ...ev,
            ...(row.event_status ? { status: row.event_status } : {}),
            ...(row.gp_lock_iso ? { gpLockISO: row.gp_lock_iso } : {}),
            ...(row.team_lock_iso ? { teamLockISO: row.team_lock_iso } : {}),
            ...(row.gp_riders?.length ? { gpRiders: row.gp_riders } : {}),
            ...(row.declared_teams?.length ? { declaredTeams: row.declared_teams } : {}),
            ...(row.team_results ? { teamResults: row.team_results } : {}),
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
          setMlsjTeams(getPricedTeams(ev));
          return ev;
        });
      }
    } catch (e) {
      console.error('MLSJ loadEventData error:', e);
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
      let rows = await sbFetch(
        'mlsj_picks?access_code=eq.' + encodeURIComponent(code) + '&event=eq.' + ev.id + '&limit=1'
      );
      if (!rows || !rows.length) return;

      const p = rows[0].picks_json;
      const evRiders = getRiderList(ev);
      const evTeams = getPricedTeams(ev);

      const SLOT_IDS = ['cpt', 'r1', 'r2', 'r3', 'r4'];
      const newGpTeam = [];
      (p.riders || []).forEach(s => {
        const rider = evRiders.find(r => r.id === s.id);
        if (rider) newGpTeam.push({ rider, slotId: SLOT_IDS[newGpTeam.length], isCpt: s.isCpt });
      });

      const newTeamPicks = [];
      (p.teams || []).forEach((s, i) => {
        const t = evTeams.find(t => t.id === s.id);
        if (t) newTeamPicks.push({ ...t, slotId: 'mt' + (i + 1) });
      });

      setGpTeam(newGpTeam);
      setTeamPicks(newTeamPicks);
      showToast('MLSJ picks restored ✓');
    } catch (e) {
      console.warn('Could not load MLSJ picks:', e);
    }
  }, [showToast]);

  const savePicks = useCallback(async (code, ev) => {
    if (!code || !ev) return false;
    try {
      const body = [{
        access_code: code,
        event: ev.id,
        picks_json: {
          riders: gpTeam.map(t => ({ id: t.rider.id, isCpt: !!t.isCpt })),
          teams: teamPicks.map(t => ({ id: t.id })),
        },
      }];
      await sbFetch('mlsj_picks?on_conflict=access_code,event', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showToast('Picks saved ✓');
      return true;
    } catch (e) {
      console.error('MLSJ savePicks error:', e);
      showToast('Save failed — try again');
      return false;
    }
  }, [gpTeam, teamPicks, showToast]);

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
    <MlsjContext.Provider value={{
      events, setEvents,
      currentEvent, selectEvent,
      userCode, userName, login, logout,
      gpTeam, setGpTeam,
      teamPicks, setTeamPicks,
      riders, setRiders,
      mlsjTeams, setMlsjTeams,
      isLoading,
      toast, showToast,
      loadSavedPicks, savePicks,
      loadEventData,
    }}>
      {children}
    </MlsjContext.Provider>
  );
}

export function useMlsj() {
  const ctx = useContext(MlsjContext);
  if (!ctx) throw new Error('useMlsj must be used within MlsjProvider');
  return ctx;
}