import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  MLSJ_EVENTS_2026_27, MLSJ_TEAMS_2026, sbFetch, calcMlsjTeamSalaries,
} from './mlsj-data';
import { PREVIEW_RIDERS_2026 } from './equiprix-data';

// Shared sentinel — picks with no room assigned land in the General
// Leaderboard. Must match the value in EquiPrixContext.
export const GENERAL_ROOM_ID = '00000000-0000-0000-0000-000000000000';
const MLSJ_LEAGUE = 'mlsj';

const MlsjContext = createContext(null);

export function MlsjProvider({ children }) {
  const [events, setEvents]   = useState(() => MLSJ_EVENTS_2026_27.map(e => ({ ...e })));
  const [currentEvent, setCurrentEventState] = useState(null);
  const [gpTeam, setGpTeam]       = useState([]);
  const [teamPicks, setTeamPicks] = useState([]);
  const [riders, setRiders]       = useState([]);
  const [mlsjTeams, setMlsjTeams] = useState([]);
  const [mlsjRiderRankings, setMlsjRiderRankings] = useState(PREVIEW_RIDERS_2026);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast]         = useState(null);
  const hasAutoSelected = useRef(false);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const getPricedTeams = (ev, riderList = mlsjRiderRankings) => {
    const declaredByTeam = ev.declaredTrioIds || {};
    const withTrio = MLSJ_TEAMS_2026.map(team => {
      const ids = declaredByTeam[team.id] || [];
      const declaredTrio = ids.map(id => riderList.find(r => r.id === id)).filter(Boolean);
      return { ...team, declaredTrio };
    });
    return calcMlsjTeamSalaries(withTrio);
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
    setMlsjTeams(getPricedTeams(ev, mlsjRiderRankings));
    setGpTeam([]);
    setTeamPicks([]);
  }, [mlsjRiderRankings]);

  const selectEvent = useCallback((id) => {
    setEvents(prev => {
      const ev = prev.find(e => e.id === id);
      if (ev) doSelectEvent(ev);
      return prev;
    });
  }, [doSelectEvent]);

  const loadEventData = useCallback(async () => {
    try {
      // CHANGED: read live FEI rankings from riders table instead of
      // results sentinel row 'fei_rankings' — same source as GCL.
      const riderRows = await sbFetch('riders?select=id,rank,salary&limit=1000');
      let updatedRankings = PREVIEW_RIDERS_2026.map(r => ({ ...r }));
      if (riderRows && riderRows.length) {
        const rankMap = {};
        riderRows.forEach(r => { rankMap[String(r.id)] = { rank: r.rank, salary: r.salary }; });
        updatedRankings = updatedRankings.map(r => {
          const live = rankMap[String(r.id)];
          return live && live.rank && live.rank !== 999
            ? { ...r, rank: live.rank, salary: live.salary }
            : { ...r };
        });
      }
      setMlsjRiderRankings(updatedRankings);

      const rows = await sbFetch(
        'results?select=event,event_status,gp_riders,declared_trio_ids,team_results,gp_lock_iso,team_lock_iso'
      );

      let updatedEvents = MLSJ_EVENTS_2026_27.map(e => ({ ...e }));
      if (rows && rows.length) {
        updatedEvents = updatedEvents.map(ev => {
          const row = rows.find(r => r.event === ev.supabaseKey);
          if (!row) return ev;
          return {
            ...ev,
            ...(row.event_status      ? { status:           row.event_status      } : {}),
            ...(row.gp_lock_iso       ? { gpLockISO:        row.gp_lock_iso       } : {}),
            ...(row.team_lock_iso     ? { teamLockISO:      row.team_lock_iso     } : {}),
            ...(row.gp_riders?.length ? { gpRiders:         row.gp_riders         } : {}),
            ...(row.declared_trio_ids ? { declaredTrioIds:  row.declared_trio_ids } : {}),
            ...(row.team_results      ? { teamResults:      row.team_results      } : {}),
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
        if (best) {
          setCurrentEventState(best);
          setRiders(getRiderList(best));
          setMlsjTeams(getPricedTeams(best, updatedRankings));
          setGpTeam([]);
          setTeamPicks([]);
        }
      } else {
        setCurrentEventState(cur => {
          if (!cur) return cur;
          const ev = updatedEvents.find(e => e.id === cur.id) || cur;
          setRiders(getRiderList(ev));
          setMlsjTeams(getPricedTeams(ev, updatedRankings));
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

  // CHANGED: reads from shared picks table with league='mlsj' filter.
  // room_id defaults to GENERAL_ROOM_ID so rooms support works from day one.
  const loadSavedPicks = useCallback(async (identity, ev, roomId = GENERAL_ROOM_ID) => {
    if (!ev || !['preview', 'teams', 'riders', 'open'].includes(ev.status)) return;
    try {
      const rows = await sbFetch(
        'picks?user_email=eq.' + encodeURIComponent(identity) +
        '&event=eq.' + ev.id +
        '&league=eq.' + MLSJ_LEAGUE +
        '&room_id=eq.' + roomId +
        '&limit=1'
      );
      if (!rows || !rows.length) return;

      const p        = rows[0].picks_json;
      const evRiders = getRiderList(ev);
      const evTeams  = getPricedTeams(ev);

      const SLOT_IDS  = ['cpt', 'r1', 'r2', 'r3', 'r4'];
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

  // CHANGED: upserts into shared picks table with league='mlsj'.
  // Conflict key: user_email + event + league + room_id (picks_unique_league_dest).
  const savePicks = useCallback(async (identity, ev, explicitGpTeam, explicitTeamPicks, roomId = GENERAL_ROOM_ID) => {
    if (!identity || !ev) return false;
    const gt = explicitGpTeam   ?? gpTeam;
    const tp = explicitTeamPicks ?? teamPicks;
    try {
      await sbFetch('picks?on_conflict=user_email,event,league,room_id', {
        method: 'POST',
        body: JSON.stringify([{
          user_email: identity,
          event:      ev.id,
          league:     MLSJ_LEAGUE,
          room_id:    roomId,
          picks_json: {
            riders: gt.map(t => ({ id: t.rider.id, isCpt: !!t.isCpt })),
            teams:  tp.map(t => ({ id: t.id })),
          },
          updated_at: new Date().toISOString(),
        }]),
      });
      showToast('Picks saved ✓');
      return true;
    } catch (e) {
      console.error('MLSJ savePicks error:', e);
      showToast('Save failed — try again');
      return false;
    }
  }, [gpTeam, teamPicks, showToast]);

  return (
    <MlsjContext.Provider value={{
      events, setEvents,
      currentEvent, selectEvent,
      gpTeam, setGpTeam,
      teamPicks, setTeamPicks,
      riders, setRiders,
      mlsjTeams, setMlsjTeams,
      mlsjRiderRankings, setMlsjRiderRankings,
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