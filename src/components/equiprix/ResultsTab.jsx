import React, { useState, useEffect } from 'react';
import { useEquiPrix } from '@/lib/EquiPrixContext';
import { sbFetch, fmt, gclStagePts, GCL_TEAMS_2026, PREVIEW_RIDERS_2026 } from '@/lib/equiprix-data';
import { motion } from 'framer-motion';

const SUB_TABS = [
  { id: 'r1', label: 'Team R1' },
  { id: 'r2', label: 'Team R2' },
  { id: 'final', label: 'Final' },
  { id: 'gp', label: 'Grand Prix' },
];

export default function ResultsTab() {
  const { currentEvent } = useEquiPrix();
  const [subTab, setSubTab] = useState('gp');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentEvent || currentEvent.status !== 'past') { setData(null); return; }
    loadResults();
  }, [currentEvent]);

  const loadResults = async () => {
    if (!currentEvent) return;
    setLoading(true);
    try {
      const rows = await sbFetch('results?event=eq.' + currentEvent.supabaseKey + '&limit=1');
      setData(rows && rows.length ? rows[0] : null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!currentEvent) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--mid)' }}>
        <p className="font-cormorant text-lg italic">Select an event to view results</p>
      </div>
    );
  }

  if (currentEvent.status !== 'past') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="text-5xl">🏟️</div>
        <div className="font-cormorant text-xl font-bold" style={{ color: 'var(--cream)' }}>
          {currentEvent.flag} {currentEvent.city}
        </div>
        <div className="font-cormorant text-base italic" style={{ color: 'rgba(242,237,226,0.5)' }}>
          Results available after the event completes
        </div>
        <div className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)' }}>
          {currentEvent.dateLabel}
        </div>
      </div>
    );
  }

  const riderResults = data?.rider_results || {};
  const teamResults = data?.team_results || {};
  const displayTeams = (currentEvent.teams && currentEvent.teams.length) ? currentEvent.teams : GCL_TEAMS_2026;
  const displayRiders = currentEvent.gpRiders && currentEvent.gpRiders.length
    ? currentEvent.gpRiders
    : Object.keys(riderResults).map(id => {
      const pr = PREVIEW_RIDERS_2026.find(r => String(r.id) === String(id));
      const horse = riderResults[id]?.horse || '';
      return pr ? { ...pr, horse: horse || pr.horse } : { id: parseInt(id) || id, name: 'Rider #' + id, horse, nat: '' };
    });

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: 'var(--ink)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-0" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        <div className="font-cinzel text-xs tracking-widest mb-0.5" style={{ color: 'var(--gold)' }}>RESULTS</div>
        <div className="font-cormorant text-xl mb-3" style={{ color: 'var(--cream)' }}>
          {currentEvent.flag} {currentEvent.city} · {currentEvent.dates}
        </div>
        {/* Sub-tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0">
          {SUB_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-t font-cinzel text-xs transition-all"
              style={{
                background: subTab === tab.id ? 'rgba(180,149,48,0.08)' : 'none',
                borderBottom: `2px solid ${subTab === tab.id ? 'var(--gold)' : 'transparent'}`,
                color: subTab === tab.id ? 'var(--gold)' : 'var(--mid)',
                letterSpacing: '0.1em',
              }}
            >
              {tab.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="text-center py-12 font-cormorant text-lg italic" style={{ color: 'var(--mid)' }}>Loading…</div>
        ) : !data ? (
          <div className="text-center py-12 font-cormorant text-lg italic" style={{ color: 'var(--mid)' }}>Results not yet entered</div>
        ) : subTab === 'gp' ? (
          <GPResults riderResults={riderResults} displayRiders={displayRiders} />
        ) : subTab === 'r1' ? (
          <TeamRoundResults teamResults={teamResults} displayTeams={displayTeams} round="r1" />
        ) : subTab === 'r2' ? (
          <TeamRoundResults teamResults={teamResults} displayTeams={displayTeams} round="r2" />
        ) : (
          <TeamFinalResults teamResults={teamResults} displayTeams={displayTeams} />
        )}
      </div>
    </div>
  );
}

function GPResults({ riderResults, displayRiders }) {
  const entries = Object.entries(riderResults).map(([id, res]) => {
    let r = displayRiders.find(x => String(x.id) === String(id));
    if (!r) r = { id, name: 'Rider #' + id, nat: '', horse: '' };
    if (res?.horse && !r.horse) r = { ...r, horse: res.horse };
    const pos = typeof res === 'object' ? (res.gpPos || res.pos || 999) : res;
    const faults = typeof res === 'object' ? (res.r1Faults != null ? res.r1Faults : null) : null;
    const time = typeof res === 'object' ? (res.r1Time || null) : null;
    const clr = typeof res === 'object' ? (res.gpClear || res.clear || false) : false;
    const ret = typeof res === 'object' ? (res.gpRet || false) : false;
    const el = typeof res === 'object' ? (res.gpEl || false) : false;
    return { r, pos, faults, time, clr, ret, el };
  }).filter(e => e.pos < 999 || e.ret || e.el)
    .sort((a, b) => (a.ret || a.el ? 9999 : a.pos) - (b.ret || b.el ? 9999 : b.pos));

  if (!entries.length) return <Empty msg="GP results not yet entered" />;

  return (
    <div>
      {entries.map(({ r, pos, faults, time, clr, ret, el }, i) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02 }}
          className="flex items-center gap-2.5 px-3 py-2.5 border-b"
          style={{
            borderColor: 'rgba(42,40,32,0.4)',
            background: clr ? 'rgba(76,175,61,0.03)' : 'transparent',
          }}
        >
          <div className="font-cinzel text-xs w-6 text-center flex-shrink-0" style={{ color: pos <= 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
            {ret ? 'RET' : el ? 'EL' : pos}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-cormorant text-sm font-semibold" style={{ color: clr ? '#6aad8a' : 'var(--ep-text)' }}>
              {r.name}
              {clr && <span className="ml-1 text-xs px-1" style={{ background: 'rgba(76,175,61,0.15)', color: '#4caf7d', borderRadius: 2 }}>CLR</span>}
            </div>
            <div className="text-xs" style={{ color: 'var(--mid)' }}>
              {r.horse ? <span style={{ color: 'var(--gold-lt)', fontStyle: 'italic' }}>{r.horse}</span> : r.nat}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {time != null && <div className="text-xs" style={{ color: 'var(--mid)' }}>{time.toFixed(2)}s</div>}
            {faults != null && (
              <div className="font-cormorant text-sm" style={{ color: faults === 0 ? '#4caf7d' : faults > 0 ? '#e88a3a' : 'var(--ep-text)' }}>
                {faults === 0 ? '0 faults' : `${faults} faults`}
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TeamRoundResults({ teamResults, displayTeams, round }) {
  const ridersKey = round === 'r1' ? 'r1Riders' : 'r2Riders';
  const faultsKey = round === 'r1' ? 'r1Faults' : 'r2Faults';
  const timeKey = round === 'r1' ? 'r1Time' : 'r2Time';

  const entries = Object.entries(teamResults).map(([id, raw]) => {
    const t = displayTeams.find(x => x.id === id) || { id, name: 'Team ' + id };
    const roundRiders = typeof raw === 'object' ? (raw[ridersKey] || []) : [];
    const teamFaults = typeof raw === 'object' ? raw[faultsKey] : null;
    const teamTime = typeof raw === 'object' ? raw[timeKey] : null;
    const ret = typeof raw === 'object' ? raw.ret : false;
    const el = typeof raw === 'object' ? raw.el : false;
    return { t, roundRiders, teamFaults, teamTime, ret, el };
  }).filter(e => e.roundRiders.length || e.teamFaults != null || e.ret || e.el)
    .sort((a, b) => {
      if (a.ret || a.el) return 1;
      if (b.ret || b.el) return -1;
      if (a.teamFaults !== b.teamFaults) return (a.teamFaults || 999) - (b.teamFaults || 999);
      return (a.teamTime || 999) - (b.teamTime || 999);
    });

  if (!entries.length) return <Empty msg="Round data not yet entered" />;

  return (
    <div>
      {entries.map(({ t, roundRiders, teamFaults, teamTime, ret, el }, pos) => (
        <div key={t.id} className="border-b" style={{ borderColor: 'rgba(180,149,48,0.1)' }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'rgba(180,149,48,0.04)' }}>
            <div className="font-cinzel text-xs w-5 flex-shrink-0" style={{ color: 'var(--gold-lt)' }}>
              {ret ? 'RET' : el ? 'EL' : pos + 1}
            </div>
            <div className="flex-1 font-cormorant text-base font-semibold" style={{ color: 'var(--cream)' }}>
              {t.name}
            </div>
            {teamFaults != null && (
              <div className="font-cormorant text-sm" style={{ color: teamFaults === 0 ? '#4caf7d' : 'var(--gold-lt)' }}>
                {teamFaults} faults
              </div>
            )}
            {teamTime != null && (
              <div className="text-xs" style={{ color: 'var(--mid)' }}>{teamTime.toFixed(2)}s</div>
            )}
          </div>
          {roundRiders.map((r, ri) => (
            <div key={ri} className="flex items-center gap-2 px-3 py-1.5 border-t" style={{ borderColor: 'rgba(42,40,32,0.3)' }}>
              <div className="w-5 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-xs" style={{ color: 'var(--ep-text)' }}>{r.name}</span>
                {r.horse && <span className="ml-1 text-xs italic" style={{ color: 'var(--gold-lt)' }}>/ {r.horse}</span>}
              </div>
              {r.faults != null && (
                <span className="text-xs font-cormorant" style={{ color: r.faults === 0 ? '#4caf7d' : r.faults > 0 ? '#e88a3a' : 'var(--mid)' }}>
                  {r.faults}
                </span>
              )}
              {r.time != null && <span className="text-xs" style={{ color: 'var(--mid)' }}>{r.time.toFixed(2)}s</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TeamFinalResults({ teamResults, displayTeams }) {
  const entries = Object.entries(teamResults).map(([id, raw]) => {
    const t = displayTeams.find(x => x.id === id) || { id, name: 'Team ' + id };
    const pos = typeof raw === 'object' ? (raw.finalPos || null) : raw;
    const ret = typeof raw === 'object' ? raw.ret : false;
    const el = typeof raw === 'object' ? raw.el : false;
    const r1Faults = typeof raw === 'object' ? raw.r1Faults : null;
    const r2Faults = typeof raw === 'object' ? raw.r2Faults : null;
    const combined = r1Faults != null && r2Faults != null ? r1Faults + r2Faults : null;
    const pts = el ? 0 : gclStagePts(pos);
    return { t, pos, ret, el, combined, pts };
  }).sort((a, b) => {
    if (a.ret || a.el) return 1;
    if (b.ret || b.el) return -1;
    return (a.pos || 999) - (b.pos || 999);
  });

  if (!entries.length) return <Empty msg="Final standings not yet entered" />;

  return (
    <div>
      {entries.map(({ t, pos, ret, el, combined, pts }, i) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02 }}
          className="flex items-center gap-2.5 px-3 py-2.5 border-b"
          style={{ borderColor: 'rgba(42,40,32,0.4)' }}
        >
          <div className="font-cinzel text-xs w-5 text-center flex-shrink-0" style={{ color: pos <= 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
            {ret ? 'RET' : el ? 'EL' : pos}
          </div>
          <div className="flex-1 font-cormorant text-base font-semibold" style={{ color: 'var(--cream)' }}>
            {t.name}
          </div>
          {combined != null && (
            <div className="text-xs" style={{ color: 'var(--mid)' }}>{combined} faults</div>
          )}
          <div className="font-cormorant text-base font-semibold" style={{ color: 'var(--gold-lt)' }}>
            {pts > 0 ? pts + ' pts' : '—'}
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