import React, { useState, useEffect } from 'react';
import { useEquiPrix } from '@/lib/EquiPrixContext';
import { sbFetch, ordinal, gclStagePts, GCL_TEAMS_2026, EVENTS_2026 } from '@/lib/equiprix-data';
import { motion } from 'framer-motion';
import { Trophy, BarChart3 } from 'lucide-react';

const TABS = [
  { id: 'event', label: 'This Event' },
  { id: 'season', label: '2026 Season' },
  { id: 'gcl', label: 'GCL Standings' },
];

export default function LeaderboardTab() {
  const { currentEvent, events } = useEquiPrix();
  const [tab, setTab] = useState('event');
  const [eventRows, setEventRows] = useState([]);
  const [seasonRows, setSeasonRows] = useState([]);
  const [gclRows, setGclRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 'event' && currentEvent) loadEventLB();
    if (tab === 'season') loadSeasonLB();
    if (tab === 'gcl') loadGCLStandings();
  }, [tab, currentEvent]);

  const loadEventLB = async () => {
    if (!currentEvent) return;
    setLoading(true);
    try {
      const rows = await sbFetch('picks?select=access_code,username,score&order=score.desc.nullslast&event=eq.' + currentEvent.id) || [];
      setEventRows(rows.filter(r => r.score != null));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadSeasonLB = async () => {
    setLoading(true);
    try {
      const pastEvents = events.filter(e => e.status === 'past');
      const userTotals = {};
      for (const ev of pastEvents) {
        const evPicks = await sbFetch('picks?select=access_code,username,score&event=eq.' + ev.id) || [];
        evPicks.forEach(p => {
          if (p.score == null) return;
          if (!userTotals[p.access_code]) userTotals[p.access_code] = { name: p.username || p.access_code, total: 0, events: 0 };
          userTotals[p.access_code].total += p.score;
          userTotals[p.access_code].events++;
        });
      }
      const sorted = Object.values(userTotals).sort((a, b) => b.total - a.total);
      setSeasonRows(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadGCLStandings = async () => {
    setLoading(true);
    try {
      const pastEvents = events.filter(e => e.status === 'past');
      const teamTotals = {};
      for (const ev of pastEvents) {
        const rows = await sbFetch('results?event=eq.' + ev.supabaseKey + '&limit=1') || [];
        if (!rows.length) continue;
        const tr = rows[0].team_results || {};
        Object.entries(tr).forEach(([id, raw]) => {
          const pos = typeof raw === 'object' ? raw.finalPos : raw;
          const el = typeof raw === 'object' && (raw.el || raw.el2);
          if (!pos && !el) return;
          const pts = el ? 0 : gclStagePts(pos);
          if (!teamTotals[id]) teamTotals[id] = { pts: 0, wins: 0, events: 0 };
          teamTotals[id].pts += pts;
          teamTotals[id].events++;
          if (pos === 1) teamTotals[id].wins++;
        });
      }
      const sorted = Object.entries(teamTotals).map(([id, data]) => {
        const t = GCL_TEAMS_2026.find(x => x.id === id) || { id, name: 'Team ' + id };
        return { t, ...data };
      }).sort((a, b) => b.pts - a.pts || b.wins - a.wins);
      setGclRows(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: 'var(--ink)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-0" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        <div className="font-cinzel text-xs tracking-widest mb-0.5" style={{ color: 'var(--gold)' }}>STANDINGS</div>
        <div className="font-cormorant text-xl mb-3" style={{ color: 'var(--cream)' }}>Leaderboard</div>
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-shrink-0 px-3 py-1.5 font-cinzel text-xs transition-all rounded-t"
              style={{
                background: tab === t.id ? 'rgba(180,149,48,0.08)' : 'none',
                borderBottom: `2px solid ${tab === t.id ? 'var(--gold)' : 'transparent'}`,
                color: tab === t.id ? 'var(--gold)' : 'var(--mid)',
                letterSpacing: '0.08em',
              }}
            >
              {t.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="text-center py-12 font-cormorant text-lg italic" style={{ color: 'var(--mid)' }}>Loading…</div>
        ) : tab === 'event' ? (
          <EventLeaderboard rows={eventRows} event={currentEvent} />
        ) : tab === 'season' ? (
          <SeasonLeaderboard rows={seasonRows} />
        ) : (
          <GCLStandings rows={gclRows} />
        )}
      </div>
    </div>
  );
}

function EventLeaderboard({ rows, event }) {
  if (!event) return <Empty msg="Select an event to view the leaderboard" />;
  if (!rows.length) return <Empty msg="No picks submitted yet" />;
  return (
    <div>
      <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        <span className="text-xs" style={{ color: 'var(--mid)' }}>
          {event.flag} {event.city} · {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      {rows.map((row, i) => (
        <motion.div
          key={row.access_code}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'rgba(42,40,32,0.4)' }}
        >
          <div className="font-cinzel text-sm w-7 text-center" style={{ color: i < 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
            {i < 3 ? ['🥇', '🥈', '🥉'][i] : ordinal(i + 1)}
          </div>
          <div className="flex-1">
            <div className="font-cormorant text-base" style={{ color: 'var(--cream)' }}>
              {row.username || row.access_code}
            </div>
          </div>
          <div className="font-cormorant text-xl font-bold" style={{ color: 'var(--gold-lt)' }}>
            {row.score} pts
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function SeasonLeaderboard({ rows }) {
  if (!rows.length) return <Empty msg="No season scores recorded yet" />;
  return (
    <div>
      {rows.map((row, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.03 }}
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: 'rgba(42,40,32,0.4)' }}
        >
          <div className="font-cinzel text-sm w-7 text-center" style={{ color: i < 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
            {i < 3 ? ['🥇', '🥈', '🥉'][i] : ordinal(i + 1)}
          </div>
          <div className="flex-1">
            <div className="font-cormorant text-base" style={{ color: 'var(--cream)' }}>{row.name}</div>
            <div className="text-xs" style={{ color: 'var(--mid)' }}>{row.events} events</div>
          </div>
          <div className="font-cormorant text-xl font-bold" style={{ color: 'var(--gold-lt)' }}>
            {row.total} pts
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function GCLStandings({ rows }) {
  if (!rows.length) return <Empty msg="No GCL results recorded yet" />;
  return (
    <div>
      {rows.map(({ t, pts, wins, events }, i) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02 }}
          className="flex items-center gap-2.5 px-4 py-2.5 border-b"
          style={{ borderColor: 'rgba(42,40,32,0.4)' }}
        >
          <div className="font-cinzel text-xs w-5 text-center flex-shrink-0" style={{ color: i < 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-cormorant text-sm font-semibold" style={{ color: 'var(--cream)' }}>{t.name}</div>
            <div className="text-xs" style={{ color: 'var(--mid)' }}>{events} events · {wins || 0} wins</div>
          </div>
          <div className="font-cormorant text-base font-bold" style={{ color: 'var(--gold-lt)' }}>
            {pts} pts
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Empty({ msg }) {
  return (
    <div className="text-center py-12 font-cormorant text-lg italic" style={{ color: 'var(--mid)' }}>
      {msg}
    </div>
  );
}