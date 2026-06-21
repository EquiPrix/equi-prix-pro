import React, { useState, useEffect } from 'react';
import { useEquiPrix, GENERAL_ROOM_ID } from '@/lib/EquiPrixContext';
import { useAuth } from '@/lib/AuthContext';
import {
  sbFetch, ordinal, gpPosPts, teamPosPts,
  GCL_TEAMS_2026, EVENTS_2026, PREVIEW_RIDERS_2026,
  CAP, CPT_PREMIUM, CAPTAIN_MULT, fmt
} from '@/lib/equiprix-data';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Lock, Plus, Hash } from 'lucide-react';

const TABS = [
  { id: 'event', label: 'This Event' },
  { id: 'rooms', label: 'My Rooms' },
  { id: 'season', label: '2026 Season' },
  { id: 'gcl', label: 'GCL Standings' },
];

// FIXED: when riders tie on a clear first round and go to a jump-off,
// gpPos is entered as the tied value (e.g. several riders all at 1) and
// joPos holds the real position once the jump-off resolves the tie —
// same data shape as ResultsTab.jsx's GPResults. Scoring here was still
// reading gpPos directly with no awareness of joPos, so every rider in
// a jump-off group was being scored as if still tied for the same
// position (all getting 1st-place points), instead of their real
// 1st-through-Nth finish. This helper centralizes the "what position
// actually counts" resolution so calcPickScore and buildScoredRows use
// identical logic and can't drift apart from each other or from the
// display in ResultsTab.jsx.
function effectiveGpPos(res) {
  if (!res) return null;
  if (res.gpJO && res.joPos != null && res.joPos !== '') return Number(res.joPos);
  return res.gpPos || null;
}

function calcPickScore(picksJson, riderResults, teamResults) {
  const riderPts = (picksJson.riders || []).reduce((sum, rp) => {
    const res = riderResults[String(rp.id)] || {};
    const effPos = effectiveGpPos(res);
    const gpPts = effPos ? gpPosPts(effPos) : null;
    if (gpPts === null) return sum;
    const raw = gpPts + (res.gpClear ? 20 : 0);
    return sum + (rp.isCpt ? raw * CAPTAIN_MULT : raw);
  }, 0);
  const teamPts = (picksJson.teams || []).reduce((sum, t) => {
    const tr = teamResults[t.id] || {};
    const pos = tr.finalPos || null;
    return sum + (pos ? teamPosPts(pos) : 0);
  }, 0);
  return riderPts + teamPts;
}

// Shared by both the General leaderboard (EventLeaderboard) and a
// room's leaderboard (MyRooms) — previously each had its own row
// builder, and the room version only kept a flat { email, username,
// score } shape, dropping picks_json entirely. That meant the room
// view had no way to show team picks, remaining budget, or GP riders
// even though the data existed — this function restores parity so both
// views render identical detail, just scoped to a different picks
// query (room_id = GENERAL_ROOM_ID vs a specific room's id).
function buildScoredRows(picks, ev, riderResults, teamResults, hasResults) {
  const allRiders = [...(ev.gpRiders || []), ...(ev.riders || []), ...PREVIEW_RIDERS_2026];
  const seenIds = new Set();
  const evRiders = allRiders.filter(r => { if (seenIds.has(r.id)) return false; seenIds.add(r.id); return true; });

  return picks.filter(p => p.picks_json && !p.picks_json.isPractice).map(p => {
    const pj = p.picks_json;
    const resolvedRiders = (pj.riders || []).map(rp => {
      const rider = evRiders.find(r => r.id === rp.id);
      if (!rider) return null;
      const salary = rp.isCpt ? rider.salary + CPT_PREMIUM : rider.salary;
      const res = riderResults[String(rp.id)] || {};
      const effPos = effectiveGpPos(res);
      const gpPts = effPos ? gpPosPts(effPos) : null;
      const rawPts = gpPts !== null ? gpPts + (res.gpClear ? 20 : 0) : null;
      const pts = rawPts !== null ? (rp.isCpt ? rawPts * CAPTAIN_MULT : rawPts) : null;
      return { rider, isCpt: rp.isCpt, salary, pts };
    }).filter(Boolean);
    const resolvedTeams = (pj.teams || []).map(t => {
      const team = GCL_TEAMS_2026.find(x => x.id === t.id);
      if (!team) return null;
      const tr = teamResults[t.id] || {};
      const pos = tr.finalPos || null;
      return { team, salary: team.salary, pts: pos ? teamPosPts(pos) : null };
    }).filter(Boolean);
    const totalSpent = resolvedRiders.reduce((s, r) => s + r.salary, 0) + resolvedTeams.reduce((s, t) => s + t.salary, 0);
    const teamSalaryUsed = resolvedTeams.reduce((s, t) => s + t.salary, 0);
    const remainingAfterTeams = CAP - teamSalaryUsed;
    const hasTeamResults = Object.keys(teamResults).length > 0;
    const teamPts = resolvedTeams.reduce((s, t) => s + (t.pts || 0), 0);
    const riderPts = resolvedRiders.reduce((s, r) => s + (r.pts || 0), 0);
    const totalPts = hasResults ? teamPts + riderPts : null;
    return { user_email: p.user_email, username: p.username || p.user_email, score: totalPts, teamPts, riders: resolvedRiders, teams: resolvedTeams, totalSpent, remainingAfterTeams, hasResults, hasTeamResults };
  }).sort((a, b) => (b.score || 0) - (a.score || 0));
}

export default function LeaderboardTab() {
  const { currentEvent, events } = useEquiPrix();
  const { user } = useAuth();
  const [tab, setTab] = useState('event');
  const [eventRows, setEventRows] = useState([]);
  const [seasonRows, setSeasonRows] = useState([]);
  const [gclRows, setGclRows] = useState([]);
  const [myRooms, setMyRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomRows, setRoomRows] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'event' && currentEvent) loadEventLB();
    if (tab === 'season') loadSeasonLB();
    if (tab === 'gcl') loadGCLStandings();
    if (tab === 'rooms') loadMyRooms();
  }, [tab, currentEvent]);

  useEffect(() => {
    if (activeRoom) loadRoomLB(activeRoom);
  }, [activeRoom]);

  const loadEventLB = async () => {
    if (!currentEvent) return;
    setLoading(true);
    try {
      // "This Event" tab shows General Leaderboard picks only — room
      // picks are scored separately on the "My Rooms" tab. GENERAL_ROOM_ID
      // is the sentinel that marks a picks row as belonging to General
      // (a real fixed UUID, not NULL — NULL doesn't work reliably with
      // Postgres unique-constraint upserts).
      const picks = await sbFetch('picks?select=user_email,username,score,picks_json&event=eq.' + currentEvent.id + '&room_id=eq.' + GENERAL_ROOM_ID) || [];
      let riderResults = {}, teamResults = {};
      if (['past', 'riders'].includes(currentEvent.status)) {
        const res = await sbFetch('results?event=eq.' + currentEvent.supabaseKey + '&limit=1') || [];
        if (res.length) { riderResults = res[0].rider_results || {}; teamResults = res[0].team_results || {}; }
      }
      const hasResults = Object.keys(teamResults).length > 0 || Object.keys(riderResults).length > 0;
      const rows = buildScoredRows(picks, currentEvent, riderResults, teamResults, hasResults);

      setEventRows(rows);
      if (hasResults && currentEvent.status === 'past') {
        rows.forEach(async (row) => {
          if (row.score == null) return;
          try { await sbFetch('picks?user_email=eq.' + encodeURIComponent(row.user_email) + '&event=eq.' + currentEvent.id + '&room_id=eq.' + GENERAL_ROOM_ID, { method: 'PATCH', body: JSON.stringify({ score: row.score }) }); } catch (e) {}
        });
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadSeasonLB = async () => {
    setLoading(true);
    try {
      const pastEvents = events.filter(e => e.status === 'past');
      const userTotals = {};
      for (const ev of pastEvents) {
        // Season totals are General Leaderboard only — room competitions
        // are self-contained and scored on the My Rooms tab instead.
        const [evPicks, evResults] = await Promise.all([
          sbFetch('picks?select=user_email,username,picks_json&event=eq.' + ev.id + '&room_id=eq.' + GENERAL_ROOM_ID),
          sbFetch('results?event=eq.' + ev.supabaseKey + '&limit=1'),
        ]);
        const riderResults = evResults?.[0]?.rider_results || {};
        const teamResults = evResults?.[0]?.team_results || {};
        const hasResults = Object.keys(riderResults).length > 0 || Object.keys(teamResults).length > 0;
        (evPicks || []).forEach(p => {
          if (!p.picks_json || p.picks_json.isPractice) return;
          const score = hasResults ? calcPickScore(p.picks_json, riderResults, teamResults) : 0;
          const key = p.user_email;
          if (!userTotals[key]) userTotals[key] = { name: p.username || p.user_email, total: 0, events: 0 };
          userTotals[key].total += score;
          userTotals[key].events++;
        });
      }
      setSeasonRows(Object.values(userTotals).sort((a, b) => b.total - a.total));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // GCL Standings now read straight from GCL_TEAMS_2026 — rank and pts
  // there are entirely manually entered (via the admin Leaderboard ->
  // GCL Standings editor) and saved to the team_salaries row, then
  // applied by EquiPrixContext.loadEventData on every load. This is the
  // same array the admin editor and draft pricing both use, so there's
  // one number per team everywhere, not a live-computed one here and a
  // manual one elsewhere.
  const loadGCLStandings = async () => {
    setLoading(true);
    try {
      const ranked = [...GCL_TEAMS_2026].sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99));
      setGclRows(ranked.map(t => ({ t, pts: t.pts })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadMyRooms = async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const memberships = await sbFetch('room_members?user_email=eq.' + encodeURIComponent(user.email)) || [];
      if (!memberships.length) { setMyRooms([]); setLoading(false); return; }
      const roomIds = memberships.map(m => m.room_id);
      const roomList = await sbFetch('rooms?id=in.(' + roomIds.join(',') + ')') || [];
      setMyRooms(roomList);
      if (roomList.length && !activeRoom) setActiveRoom(roomList[0]);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadRoomLB = async (room) => {
    setLoading(true);
    try {
      const members = await sbFetch('room_members?room_id=eq.' + room.id) || [];
      const ev = EVENTS_2026.find(e => e.id === room.event_id);
      if (!ev || !members.length) { setRoomRows([]); setLoading(false); return; }

      // Direct room_id match — every pick saved while this room was the
      // active draft destination carries this room's id, so no more
      // fuzzy matching by username/access_code needed.
      const [allPicks, evResults] = await Promise.all([
        sbFetch('picks?select=user_email,username,picks_json&event=eq.' + ev.id + '&room_id=eq.' + room.id),
        sbFetch('results?event=eq.' + ev.supabaseKey + '&limit=1'),
      ]);
      const riderResults = evResults?.[0]?.rider_results || {};
      const teamResults = evResults?.[0]?.team_results || {};
      const hasResults = Object.keys(riderResults).length > 0 || Object.keys(teamResults).length > 0;

      // Build the same rich row shape (teams, riders, totalSpent,
      // remainingAfterTeams, etc.) the General leaderboard uses — a
      // member with picks but no row in `members` shouldn't happen, but
      // a member with no picks yet should still show up so the room
      // roster looks complete. buildScoredRows only returns rows for
      // picks that exist, so merge in any missing members at score 0.
      const scoredFromPicks = buildScoredRows(allPicks || [], ev, riderResults, teamResults, hasResults);
      const pickedEmails = new Set(scoredFromPicks.map(r => r.user_email));
      const missingMembers = members
        .filter(m => !pickedEmails.has(m.user_email))
        .map(m => ({
          user_email: m.user_email, username: m.username || m.user_email.split('@')[0],
          score: hasResults ? 0 : null, teamPts: 0, riders: [], teams: [],
          totalSpent: 0, remainingAfterTeams: CAP, hasResults, hasTeamResults: Object.keys(teamResults).length > 0,
        }));

      const rows = [...scoredFromPicks, ...missingMembers]
        .map(r => ({ ...r, isYou: user?.email === r.user_email }))
        .sort((a, b) => (b.score || 0) - (a.score || 0));

      setRoomRows(rows);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const joinWithCode = async () => {
    if (!joinCode.trim() || !user?.email) return;
    setJoining(true); setJoinMsg('');
    try {
      const rows = await sbFetch('rooms?join_code=eq.' + joinCode.trim().toUpperCase() + '&limit=1');
      if (!rows?.length) { setJoinMsg('Room not found.'); setJoining(false); return; }
      const room = rows[0];
      const members = await sbFetch('room_members?room_id=eq.' + room.id) || [];
      if (members.length >= room.max_size) { setJoinMsg('This room is full.'); setJoining(false); return; }
      await sbFetch('room_members', { method: 'POST', body: JSON.stringify({ room_id: room.id, user_email: user.email, username: user.user_metadata?.username || user.email.split('@')[0] }) });
      setJoinMsg('✓ Joined ' + room.name + '!');
      setJoinCode('');
      loadMyRooms();
    } catch (e) {
      setJoinMsg(e.message?.includes('unique') ? '✓ Already a member!' : 'Could not join room.');
    } finally { setJoining(false); }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: 'var(--ink)' }}>
      <div className="px-4 pt-4 pb-0" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        <div className="font-cinzel text-xs tracking-widest mb-0.5" style={{ color: 'var(--gold)' }}>STANDINGS</div>
        <div className="font-cormorant text-xl mb-3" style={{ color: 'var(--cream)' }}>Leaderboard</div>
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-shrink-0 px-3 py-1.5 font-cinzel text-xs transition-all rounded-t"
              style={{ background: tab === t.id ? 'rgba(180,149,48,0.08)' : 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--gold)' : 'transparent'}`, color: tab === t.id ? 'var(--gold)' : 'var(--mid)', letterSpacing: '0.08em' }}>
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {loading && tab !== 'rooms' ? (
          <div className="text-center py-12 font-cormorant text-lg italic" style={{ color: 'var(--mid)' }}>Loading…</div>
        ) : tab === 'event' ? (
          <EventLeaderboard rows={eventRows} event={currentEvent} />
        ) : tab === 'season' ? (
          <SeasonLeaderboard rows={seasonRows} />
        ) : tab === 'gcl' ? (
          <GCLStandings rows={gclRows} />
        ) : (
          <MyRooms
            rooms={myRooms} activeRoom={activeRoom} setActiveRoom={setActiveRoom}
            roomRows={roomRows} loading={loading}
            joinCode={joinCode} setJoinCode={setJoinCode}
            joinWithCode={joinWithCode} joining={joining} joinMsg={joinMsg} user={user}
          />
        )}
      </div>
    </div>
  );
}

function MyRooms({ rooms, activeRoom, setActiveRoom, roomRows, loading, joinCode, setJoinCode, joinWithCode, joining, joinMsg, user }) {
  const [expanded, setExpanded] = useState({});
  const roomEvent = activeRoom ? EVENTS_2026.find(e => e.id === activeRoom.event_id) : null;
  const teamLocked = roomEvent ? (roomEvent.status === 'past' || new Date() >= new Date(roomEvent.teamLockISO)) : true;
  const gpLocked = roomEvent ? (roomEvent.status === 'past' || new Date() >= new Date(roomEvent.gpLockISO)) : true;
  return (
    <div>
      {/* Join with code */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && joinWithCode()}
            placeholder="Enter room code…"
            maxLength={6}
            className="flex-1 rounded px-3 py-2 text-sm outline-none font-cinzel tracking-widest"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold)', fontSize: '16px' }}
          />
          <button onClick={joinWithCode} disabled={joining || !joinCode.trim()}
            className="px-4 py-2 rounded font-cinzel text-xs tracking-widest flex items-center gap-1.5 transition-all"
            style={{ background: 'var(--gold)', color: 'var(--ink)', opacity: !joinCode.trim() ? 0.4 : 1, letterSpacing: '0.08em' }}>
            <Plus size={12} />
            JOIN
          </button>
        </div>
        {joinMsg && (
          <p className="font-cormorant italic text-sm mt-2" style={{ color: joinMsg.startsWith('✓') ? '#4caf7d' : '#e07070' }}>
            {joinMsg}
          </p>
        )}
        <p className="font-cormorant italic text-xs mt-2" style={{ color: 'var(--mid)' }}>
          Want a private room for your group? Open your account (top right) to request one.
        </p>
      </div>

      {!rooms.length ? (
        <div className="text-center py-12">
          <p className="font-cormorant italic text-lg mb-2" style={{ color: 'var(--mid)' }}>No rooms yet.</p>
          <p className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>Enter a room code above or click an invite link to join.</p>
        </div>
      ) : (
        <>
          {/* Room tabs */}
          {rooms.length > 1 && (
            <div className="flex gap-1 px-4 py-2 overflow-x-auto" style={{ borderBottom: '1px solid var(--ep-border)' }}>
              {rooms.map(room => (
                <button key={room.id} onClick={() => setActiveRoom(room)}
                  className="flex-shrink-0 px-3 py-1.5 rounded font-cinzel text-xs transition-all"
                  style={{
                    background: activeRoom?.id === room.id ? 'rgba(180,149,48,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${activeRoom?.id === room.id ? 'rgba(180,149,48,0.4)' : 'rgba(180,149,48,0.1)'}`,
                    color: activeRoom?.id === room.id ? 'var(--gold)' : 'var(--mid)',
                    fontSize: 9, letterSpacing: '0.08em',
                    maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                  {room.name}
                </button>
              ))}
            </div>
          )}

          {/* Active room header */}
          {activeRoom && (
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--ep-border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-cormorant text-base font-semibold" style={{ color: 'var(--cream)' }}>{activeRoom.name}</div>
                  {activeRoom.prize_description && (
                    <div className="font-cormorant italic text-xs mt-0.5" style={{ color: 'var(--gold-lt)' }}>
                      🏆 {activeRoom.prize_description}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Hash size={10} style={{ color: 'var(--mid)' }} />
                    <span className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9 }}>{activeRoom.join_code}</span>
                  </div>
                </div>
                {user?.email === activeRoom.manager_email && (
                  <a href={'/room/' + activeRoom.join_code}
                    className="font-cinzel text-xs px-2.5 py-1.5 rounded flex-shrink-0 transition-all"
                    style={{ background: 'rgba(180,149,48,0.12)', border: '1px solid rgba(180,149,48,0.3)', color: 'var(--gold)', fontSize: 8, letterSpacing: '0.08em' }}>
                    MANAGE →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Room leaderboard */}
          {loading ? (
            <div className="text-center py-8 font-cormorant italic" style={{ color: 'var(--mid)' }}>Loading…</div>
          ) : !roomRows.length ? (
            <div className="text-center py-8 font-cormorant italic" style={{ color: 'var(--mid)' }}>No scores yet.</div>
          ) : roomRows.map((row, i) => (
            <ScoredRow key={row.user_email} row={row} i={i} teamLocked={teamLocked} gpLocked={gpLocked}
              expanded={expanded[row.user_email]} onToggle={() => setExpanded(p => ({ ...p, [row.user_email]: !p[row.user_email] }))} />
          ))}
        </>
      )}
    </div>
  );
}

// Shared expandable row used by both the General leaderboard and a
// room's leaderboard — click to expand and see team picks, remaining
// budget, and GP riders. Previously MyRooms had its own flat row with
// no expand/detail at all; this is the same UI EventLeaderboard already
// had, just lifted out so both can use it identically.
function ScoredRow({ row, i, teamLocked, gpLocked, expanded, onToggle }) {
  const open = expanded;
  const hasScore = row.score != null && row.score > 0;
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.03 }} style={{ borderBottom: '1px solid rgba(42,40,32,0.4)' }}>
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="font-cinzel text-sm w-7 text-center flex-shrink-0" style={{ color: i < 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
          {i < 3 ? ['🥇', '🥈', '🥉'][i] : ordinal(i + 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-cormorant text-base truncate" style={{ color: row.isYou ? 'var(--gold-lt)' : 'var(--cream)' }}>
            {row.username}{row.isYou && ' ★'}
          </div>
          {teamLocked && !gpLocked && <div className="text-xs" style={{ color: '#6aad8a' }}>{fmt(row.remainingAfterTeams)} remaining for GP</div>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasScore ? (
            <div className="font-cormorant text-xl font-bold" style={{ color: 'var(--gold-lt)' }}>
              {typeof row.score === 'number' ? row.score.toFixed(1) : row.score} pts
            </div>
          ) : (
            <div className="font-cinzel text-xs" style={{ color: 'var(--mid)' }}>{fmt(row.totalSpent)} spent</div>
          )}
          {open ? <ChevronUp size={13} style={{ color: 'var(--mid)' }} /> : <ChevronDown size={13} style={{ color: 'var(--mid)' }} />}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-3 pt-0" style={{ background: '#0d0c09', borderTop: '1px solid rgba(42,40,32,0.4)' }}>
          {row.teams.length > 0 ? (
            <div className="mb-3 mt-2">
              <div className="font-cinzel text-xs mb-1.5" style={{ color: '#6aad8a', fontSize: 9, letterSpacing: '0.1em' }}>GCL TEAMS</div>
              {row.teams.map(({ team, salary, pts }) => (
                <div key={team.id} className="flex items-center gap-2 py-1">
                  <div className="flex-1 font-cormorant text-sm" style={{ color: 'var(--cream)' }}>{team.name}</div>
                  <div className="text-xs" style={{ color: 'var(--mid)' }}>{fmt(salary)}</div>
                  {pts !== null ? <div className="font-cormorant text-sm font-bold w-16 text-right" style={{ color: 'var(--gold-lt)' }}>{pts} pts</div> : <div className="text-xs w-16 text-right" style={{ color: 'var(--mid)' }}>—</div>}
                </div>
              ))}
              {row.hasTeamResults && row.teamPts > 0 && (
                <div className="flex justify-end mt-1 pt-1" style={{ borderTop: '1px solid rgba(42,40,32,0.4)' }}>
                  <div className="font-cinzel text-xs" style={{ color: 'var(--gold)', fontSize: 9 }}>TEAM TOTAL: {row.teamPts} pts</div>
                </div>
              )}
            </div>
          ) : <div className="mb-3 mt-2 text-xs font-cormorant italic" style={{ color: 'var(--mid)' }}>No team picks saved</div>}
          {teamLocked && !gpLocked && (
            <div className="mb-3 px-2 py-1.5 rounded text-xs font-cormorant" style={{ background: 'rgba(61,90,76,0.1)', border: '1px solid rgba(61,90,76,0.25)', color: '#6aad8a' }}>
              {fmt(row.remainingAfterTeams)} available for GP rider picks
            </div>
          )}
          {!gpLocked ? (
            <div className="px-2 py-2 rounded text-xs font-cormorant italic text-center" style={{ background: 'rgba(180,149,48,0.05)', border: '1px solid rgba(180,149,48,0.15)', color: 'var(--mid)' }}>
              🔒 GP rider picks hidden until lock closes
            </div>
          ) : row.riders.length > 0 ? (
            <div>
              <div className="font-cinzel text-xs mb-1.5" style={{ color: 'var(--gold)', fontSize: 9, letterSpacing: '0.1em' }}>GP RIDERS</div>
              {row.riders.map(({ rider, isCpt, salary, pts }) => (
                <div key={rider.id} className="flex items-center gap-2 py-1">
                  {isCpt && <span className="font-cinzel text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(180,149,48,0.15)', color: 'var(--gold)', fontSize: 8 }}>CPT</span>}
                  <div className="flex-1 min-w-0">
                    <div className="font-cormorant text-sm truncate" style={{ color: isCpt ? 'var(--gold-lt)' : 'var(--cream)' }}>{rider.name}</div>
                    <div className="text-xs" style={{ color: 'var(--mid)', fontSize: 9 }}>{rider.nat}</div>
                  </div>
                  <div className="text-xs flex-shrink-0" style={{ color: 'var(--mid)' }}>{fmt(salary)}</div>
                  {pts !== null ? (
                    <div className="font-cormorant text-sm font-bold w-16 text-right flex-shrink-0" style={{ color: isCpt ? 'var(--gold)' : 'var(--gold-lt)' }}>
                      {pts % 1 === 0 ? pts : pts.toFixed(1)} pts
                      {isCpt && <span className="text-xs ml-0.5" style={{ color: 'var(--mid)' }}>×1.5</span>}
                    </div>
                  ) : <div className="text-xs w-16 text-right flex-shrink-0" style={{ color: 'var(--mid)' }}>—</div>}
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: '1px solid rgba(42,40,32,0.4)' }}>
            <div className="font-cinzel text-xs" style={{ color: 'var(--mid)', fontSize: 9 }}>TOTAL SPENT: {fmt(row.totalSpent)}</div>
            {hasScore && <div className="font-cormorant text-base font-bold" style={{ color: 'var(--gold)' }}>{typeof row.score === 'number' ? row.score.toFixed(1) : row.score} pts</div>}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function EventLeaderboard({ rows, event }) {
  const [expanded, setExpanded] = useState({});
  if (!event) return <Empty msg="Select an event to view the leaderboard" />;
  const teamLocked = event.status === 'past' || new Date() >= new Date(event.teamLockISO);
  const gpLocked = event.status === 'past' || new Date() >= new Date(event.gpLockISO);
  const isComplete = event.status === 'past';
  if (!teamLocked) return <Empty msg="Picks will appear here once the team lock closes" />;
  if (!rows.length) return <Empty msg="No picks submitted yet" />;

  return (
    <div>
      <div className="px-4 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        <Lock size={11} style={{ color: 'var(--gold)' }} />
        <span className="text-xs" style={{ color: 'var(--mid)' }}>
          {event.flag} {event.city} · {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
          {isComplete ? ' · Final scores' : gpLocked ? ' · GP picks locked' : ' · Team picks locked'}
        </span>
      </div>
      {rows.map((row, i) => (
        <ScoredRow key={row.user_email} row={row} i={i} teamLocked={teamLocked} gpLocked={gpLocked}
          expanded={expanded[row.user_email]} onToggle={() => setExpanded(p => ({ ...p, [row.user_email]: !p[row.user_email] }))} />
      ))}
    </div>
  );
}

function SeasonLeaderboard({ rows }) {
  if (!rows.length) return <Empty msg="No season scores recorded yet" />;
  return (
    <div>
      {rows.map((row, i) => (
        <motion.div key={row.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }} className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'rgba(42,40,32,0.4)' }}>
          <div className="font-cinzel text-sm w-7 text-center" style={{ color: i < 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
            {i < 3 ? ['🥇', '🥈', '🥉'][i] : ordinal(i + 1)}
          </div>
          <div className="flex-1">
            <div className="font-cormorant text-base" style={{ color: 'var(--cream)' }}>{row.name}</div>
            <div className="text-xs" style={{ color: 'var(--mid)' }}>{row.events} events</div>
          </div>
          <div className="font-cormorant text-xl font-bold" style={{ color: 'var(--gold-lt)' }}>
            {row.total % 1 === 0 ? row.total : row.total.toFixed(1)} pts
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// GCL Standings — wins/events-played columns removed, since those came
// from computeLiveGclStandings (now deleted) and there's no manual
// equivalent. Position number now reflects t.rank as saved on the
// Leaderboard editor, not just array index, so it stays correct even if
// GCL_TEAMS_2026 ever fails to be in perfect sorted order for some reason.
function GCLStandings({ rows }) {
  if (!rows.length) return <Empty msg="No GCL standings entered yet" />;
  return (
    <div>
      {rows.map(({ t, pts }, i) => (
        <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02 }} className="flex items-center gap-2.5 px-4 py-2.5 border-b"
          style={{ borderColor: 'rgba(42,40,32,0.4)' }}>
          <div className="font-cinzel text-xs w-5 text-center flex-shrink-0" style={{ color: i < 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>{t.rank || i + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="font-cormorant text-sm font-semibold" style={{ color: 'var(--cream)' }}>{t.name}</div>
          </div>
          <div className="font-cormorant text-base font-bold" style={{ color: 'var(--gold-lt)' }}>{pts} pts</div>
        </motion.div>
      ))}
    </div>
  );
}

function Empty({ msg }) {
  return <div className="text-center py-12 font-cormorant text-lg italic" style={{ color: 'var(--mid)' }}>{msg}</div>;
}