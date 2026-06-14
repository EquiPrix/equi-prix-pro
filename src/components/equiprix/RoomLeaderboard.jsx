import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { sbFetch, gpPosPts, teamPosPts, CAPTAIN_MULT, EVENTS_2026, GCL_TEAMS_2026, PREVIEW_RIDERS_2026 } from '@/lib/equiprix-data';
import { motion } from 'framer-motion';
import { ordinal } from '@/lib/equiprix-data';
import { ChevronDown, ChevronUp } from 'lucide-react';

function calcPickScore(picksJson, riderResults, teamResults) {
  const riderPts = (picksJson.riders || []).reduce((sum, rp) => {
    const res = riderResults[String(rp.id)] || {};
    const gpPts = res.gpPos ? gpPosPts(res.gpPos) : null;
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

export default function RoomLeaderboard({ room }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (room) loadLeaderboard();
  }, [room]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const members = await sbFetch('room_members?room_id=eq.' + room.id) || [];
      const memberEmails = members.map(m => m.user_email);
      if (!memberEmails.length) { setRows([]); setLoading(false); return; }

      const ev = EVENTS_2026.find(e => e.id === room.event_id);
      if (!ev) { setLoading(false); return; }

      const [allPicks, evResults] = await Promise.all([
        sbFetch('picks?select=access_code,username,picks_json&event=eq.' + ev.id),
        sbFetch('results?event=eq.' + ev.supabaseKey + '&limit=1'),
      ]);

      const riderResults = evResults?.[0]?.rider_results || {};
      const teamResults = evResults?.[0]?.team_results || {};
      const hasResults = Object.keys(riderResults).length > 0 || Object.keys(teamResults).length > 0;

      const allRiders = [...(ev.gpRiders || []), ...(ev.riders || []), ...PREVIEW_RIDERS_2026];
      const seenIds = new Set();
      const evRiders = allRiders.filter(r => { if (seenIds.has(r.id)) return false; seenIds.add(r.id); return true; });

      // Match picks to room members by email
      const scored = members.map(member => {
        const pick = (allPicks || []).find(p =>
          p.access_code === member.user_email ||
          p.username === member.username
        );
        const score = pick && hasResults ? calcPickScore(pick.picks_json, riderResults, teamResults) : 0;
        return {
          email: member.user_email,
          username: member.username || member.user_email.split('@')[0],
          score,
          picks_json: pick?.picks_json || null,
          isYou: user?.email === member.user_email,
        };
      }).sort((a, b) => b.score - a.score);

      setRows(scored);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8 font-cormorant italic" style={{ color: 'var(--mid)' }}>Loading…</div>;
  if (!rows.length) return <div className="text-center py-8 font-cormorant italic" style={{ color: 'var(--mid)' }}>No members yet.</div>;

  return (
    <div>
      {rows.map((row, i) => (
        <motion.div key={row.email}
          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          style={{ borderBottom: '1px solid rgba(42,40,32,0.4)' }}>
          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
            onClick={() => setExpanded(p => ({ ...p, [row.email]: !p[row.email] }))}>
            <div className="font-cinzel text-sm w-7 text-center flex-shrink-0"
              style={{ color: i < 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
              {i < 3 ? ['🥇', '🥈', '🥉'][i] : ordinal(i + 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-cormorant text-base" style={{ color: row.isYou ? 'var(--gold-lt)' : 'var(--cream)' }}>
                {row.username}{row.isYou && ' ★'}
              </div>
            </div>
            <div className="font-cormorant text-xl font-bold flex-shrink-0" style={{ color: 'var(--gold-lt)' }}>
              {row.score % 1 === 0 ? row.score : row.score.toFixed(1)} pts
            </div>
            {expanded[row.email]
              ? <ChevronUp size={13} style={{ color: 'var(--mid)' }} />
              : <ChevronDown size={13} style={{ color: 'var(--mid)' }} />}
          </div>
        </motion.div>
      ))}
    </div>
  );
}