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

// Statuses where we should attempt to load results
const RESULTS_STATUSES = ['past', 'riders', 'live'];

export default function ResultsTab() {
  const { currentEvent } = useEquiPrix();
  const [subTab, setSubTab] = useState('final');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentEvent || !RESULTS_STATUSES.includes(currentEvent.status)) {
      setData(null);
      return;
    }
    loadResults();
  }, [currentEvent]);

  // Auto-select best tab based on available data
  useEffect(() => {
    if (!data) return;
    const tr = data.team_results || {};
    const rr = data.rider_results || {};
    const hasTeamResults = Object.keys(tr).length > 0;
    const hasGPResults = Object.keys(rr).length > 0;
    const hasFinal = Object.values(tr).some(r => r?.finalPos);

    if (hasGPResults && currentEvent?.status === 'past') setSubTab('gp');
    else if (hasFinal) setSubTab('final');
    else if (hasTeamResults) setSubTab('r1');
  }, [data]);

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

  if (!RESULTS_STATUSES.includes(currentEvent.status)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="text-5xl">🏟️</div>
        <div className="font-cormorant text-xl font-bold" style={{ color: 'var(--cream)' }}>
          {currentEvent.flag} {currentEvent.city}
        </div>
        <div className="font-cormorant text-base italic" style={{ color: 'rgba(242,237,226,0.5)' }}>
          Results available after the event begins
        </div>
        <div className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)' }}>
          {currentEvent.dateLabel}
        </div>
      </div>
    );
  }

  const riderResults = data?.rider_results || {};
  const teamResults = data?.team_results || {};
  const hasTeamResults = Object.keys(teamResults).length > 0;
  const hasGPResults = Object.keys(riderResults).length > 0;
  const hasFinal = Object.values(teamResults).some(r => r?.finalPos);
  const isComplete = currentEvent.status === 'past';

  const displayTeams = (currentEvent.teams && currentEvent.teams.length) ? currentEvent.teams : GCL_TEAMS_2026;
  const displayRiders = currentEvent.gpRiders && currentEvent.gpRiders.length
    ? currentEvent.gpRiders
    : Object.keys(riderResults).map(id => {
      const pr = PREVIEW_RIDERS_2026.find(r => String(r.id) === String(id));
      const horse = riderResults[id]?.horse || '';
      return pr ? { ...pr, horse: horse || pr.horse } : { id: parseInt(id) || id, name: 'Rider #' + id, horse, nat: '' };
    });

  // Filter tabs based on what data is available
  const availableTabs = SUB_TABS.filter(tab => {
    if (tab.id === 'r1') return hasTeamResults;
    if (tab.id === 'r2') return hasTeamResults && Object.values(teamResults).some(r => r?.r2Faults != null || r?.r2Riders?.length);
    if (tab.id === 'final') return hasFinal;
    if (tab.id === 'gp') return hasGPResults;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: 'var(--ink)' }}>
      <div className="px-4 pt-4 pb-0" style={{ borderBottom: '1px solid var(--ep-border)' }}>
        <div className="font-cinzel text-xs tracking-widest mb-0.5" style={{ color: 'var(--gold)' }}>RESULTS</div>
        <div className="font-cormorant text-xl mb-1" style={{ color: 'var(--cream)' }}>
          {currentEvent.flag} {currentEvent.city} · {currentEvent.dates}
        </div>

        {/* Status badge */}
        {!isComplete && hasTeamResults && (
          <div className="mb-2">
            <span className="font-cinzel text-xs px-2 py-0.5 rounded"
              style={{ background: 'rgba(180,149,48,0.12)', color: 'var(--gold)', fontSize: 9, letterSpacing: '0.1em' }}>
              {hasGPResults ? 'GP IN PROGRESS' : 'TEAM RESULTS IN · GP DRAFT OPEN'}
            </span>
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0">
          {availableTabs.map(tab => (
            <button key={tab.id} onClick={() => setSubTab(tab.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-t font-cinzel text-xs transition-all"
              style={{
                background: subTab === tab.id ? 'rgba(180,149,48,0.08)' : 'none',
                borderBottom: `2px solid ${subTab === tab.id ? 'var(--gold)' : 'transparent'}`,
                color: subTab === tab.id ? 'var(--gold)' : 'var(--mid)',
                letterSpacing: '0.1em',
              }}>
              {tab.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {loading ? (
          <div className="text-center py-12 font-cormorant text-lg italic" style={{ color: 'var(--mid)' }}>Loading…</div>
        ) : !data || (!hasTeamResults && !hasGPResults) ? (
          <div className="text-center py-12">
            <p className="font-cormorant text-lg italic mb-2" style={{ color: 'var(--mid)' }}>
              Results not yet entered
            </p>
            <p className="font-cormorant text-sm italic" style={{ color: 'var(--mid)', opacity: 0.6 }}>
              Team results will appear here as soon as they're posted
            </p>
          </div>
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
    const hasJO = typeof res === 'object' ? !!res.gpJO : false;
    const joPos = typeof res === 'object' ? (res.joPos || null) : null;
    const joFaults = typeof res === 'object' ? (res.joFaults != null ? res.joFaults : null) : null;
    const joTime = typeof res === 'object' ? (res.joTime || null) : null;
    const joRet = typeof res === 'object' ? (res.joRet || false) : false;
    const joEl = typeof res === 'object' ? (res.joEl || false) : false;
    return { r, pos, faults, time, clr, ret, el, hasJO, joPos, joFaults, joTime, joRet, joEl };
  }).filter(e => e.pos < 999 || e.ret || e.el)
    .sort((a, b) => (a.ret || a.el ? 9999 : a.pos) - (b.ret || b.el ? 9999 : b.pos));

  if (!entries.length) return <Empty msg="GP results not yet entered" />;

  return (
    <div>
      {entries.map(({ r, pos, faults, time, clr, ret, el, hasJO, joPos, joFaults, joTime, joRet, joEl }, i) => (
        <motion.div key={r.id}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02 }}
          className="border-b" style={{ borderColor: 'rgba(42,40,32,0.4)' }}>
          <div className="flex items-center gap-2.5 px-3 py-2.5"
            style={{ background: clr ? 'rgba(76,175,61,0.03)' : 'transparent' }}>
            <div className="font-cinzel text-xs w-6 text-center flex-shrink-0"
              style={{ color: pos <= 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
              {ret ? 'RET' : el ? 'EL' : pos}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-cormorant text-sm font-semibold" style={{ color: clr ? '#6aad8a' : 'var(--ep-text)' }}>
                {r.name}
                {clr && <span className="ml-1 text-xs px-1" style={{ background: 'rgba(76,175,61,0.15)', color: '#4caf7d', borderRadius: 2 }}>CLR</span>}
                {hasJO && <span className="ml-1 text-xs px-1" style={{ background: 'rgba(180,149,48,0.15)', color: 'var(--gold)', borderRadius: 2 }}>JO</span>}
              </div>
              <div className="text-xs" style={{ color: 'var(--mid)' }}>
                {r.horse ? <span style={{ color: 'var(--gold-lt)', fontStyle: 'italic' }}>{r.horse}</span> : r.nat}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              {time != null && <div className="text-xs" style={{ color: 'var(--mid)' }}>{Number(time).toFixed(2)}s</div>}
              {faults != null && (
                <div className="font-cormorant text-sm" style={{ color: faults === 0 ? '#4caf7d' : '#e88a3a' }}>
                  {faults === 0 ? '0 faults' : `${faults} faults`}
                </div>
              )}
            </div>
          </div>
          {hasJO && (
            <div className="flex items-center gap-2.5 px-3 py-1.5"
              style={{ background: 'rgba(180,149,48,0.04)', borderTop: '1px solid rgba(42,40,32,0.3)' }}>
              <div className="font-cinzel text-xs w-6 text-center flex-shrink-0" style={{ color: 'var(--gold)', fontSize: 9 }}>↳ JO</div>
              <div className="flex-1 font-cormorant text-xs italic" style={{ color: 'var(--mid)' }}>
                Jump-off
                {joRet && <span className="ml-1" style={{ color: '#e07070' }}>· RET</span>}
                {joEl && <span className="ml-1" style={{ color: '#e07070' }}>· EL</span>}
              </div>
              <div className="text-right flex-shrink-0 flex items-center gap-2">
                {joTime != null && <span className="text-xs" style={{ color: 'var(--mid)' }}>{Number(joTime).toFixed(2)}s</span>}
                {joFaults != null && (
                  <span className="font-cormorant text-sm" style={{ color: joFaults === 0 ? '#4caf7d' : '#e88a3a' }}>
                    {joFaults === 0 ? '0 faults' : `${joFaults} faults`}
                  </span>
                )}
                {joPos && <span className="font-cinzel text-xs font-bold" style={{ color: 'var(--gold)' }}>{joPos}</span>}
              </div>
            </div>
          )}
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
            <div className="flex-1 font-cormorant text-base font-semibold" style={{ color: 'var(--cream)' }}>{t.name}</div>
            {teamFaults != null && (
              <div className="font-cormorant text-sm" style={{ color: teamFaults === 0 ? '#4caf7d' : 'var(--gold-lt)' }}>
                {teamFaults} faults
              </div>
            )}
            {teamTime != null && <div className="text-xs" style={{ color: 'var(--mid)' }}>{Number(teamTime).toFixed(2)}s</div>}
          </div>
          {roundRiders.map((r, ri) => (
            <div key={ri} className="flex items-center gap-2 px-3 py-1.5 border-t" style={{ borderColor: 'rgba(42,40,32,0.3)' }}>
              <div className="w-5 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-xs" style={{ color: 'var(--ep-text)' }}>{r.name}</span>
                {r.horse && <span className="ml-1 text-xs italic" style={{ color: 'var(--gold-lt)' }}>/ {r.horse}</span>}
              </div>
              {r.faults != null && (
                <span className="text-xs font-cormorant" style={{ color: r.faults === 0 ? '#4caf7d' : r.faults > 0 ? '#e88a3a' : 'var(--mid)' }}>{r.faults}</span>
              )}
              {r.time != null && <span className="text-xs" style={{ color: 'var(--mid)' }}>{Number(r.time).toFixed(2)}s</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// FIXED: r2Faults is the CUMULATIVE R1+R2 total already (that's how it's
// read off the PDF scoreboards) — the old `combined = r1Faults + r2Faults`
// was double-counting Round 1. Now combined = r2Faults alone.
function TeamFinalResults({ teamResults, displayTeams }) {
  const entries = Object.entries(teamResults).map(([id, raw]) => {
    const t = displayTeams.find(x => x.id === id) || { id, name: 'Team ' + id };
    const pos = typeof raw === 'object' ? (raw.finalPos || null) : raw;
    const ret = typeof raw === 'object' ? (raw.ret || false) : false;
    const el = typeof raw === 'object' ? (raw.el || false) : false;
    const r1Faults = typeof raw === 'object' ? (raw.r1Faults ?? null) : null;
    const r2Faults = typeof raw === 'object' ? (raw.r2Faults ?? null) : null;
    const r2Time = typeof raw === 'object' ? (raw.r2Time ?? null) : null;
    const madeR2 = r2Faults != null;
    const combined = madeR2 ? r2Faults : null;
    // FIXED: eliminated/retired teams now score points for their actual
    // computed rank, same as any other team — elimination affects WHERE
    // they rank (via calcFinalPositions' tiering), not whether they score
    // once a rank is assigned. Previously this zeroed out points for any
    // el team regardless of final position.
    const pts = gclStagePts(pos);
    return { t, pos, ret, el, madeR2, combined, r2Time, pts };
  }).sort((a, b) => (a.pos || 999) - (b.pos || 999));

  if (!entries.length) return <Empty msg="Final standings not yet entered" />;

  return (
    <div>
      {entries.map(({ t, pos, ret, el, madeR2, combined, r2Time, pts }, i) => (
        <motion.div key={t.id}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02 }}
          className="flex items-center gap-2.5 px-3 py-2.5 border-b"
          style={{ borderColor: 'rgba(42,40,32,0.4)', background: madeR2 ? 'rgba(76,175,61,0.03)' : 'transparent' }}>
          <div className="font-cinzel text-xs w-5 text-center flex-shrink-0"
            style={{ color: pos <= 3 ? 'var(--gold)' : 'var(--gold-lt)' }}>
            {pos}
          </div>
          <div className="flex-1 font-cormorant text-base font-semibold flex items-center gap-1.5"
            style={{ color: madeR2 ? '#6aad8a' : 'var(--cream)' }}>
            {t.name}
            {madeR2 && (
              <span className="font-cinzel text-xs px-1"
                style={{ background: 'rgba(76,175,61,0.15)', color: '#4caf7d', borderRadius: 2, fontSize: 8, letterSpacing: '0.06em' }}>R2</span>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {(ret || el) && (
              <span className="font-cinzel text-xs px-1"
                style={{ background: 'rgba(224,112,112,0.15)', color: '#e07070', borderRadius: 2, fontSize: 8, letterSpacing: '0.06em' }}>
                {ret ? 'RET' : 'EL'}
              </span>
            )}
            {madeR2 && combined != null && <div className="text-xs" style={{ color: 'var(--mid)' }}>{combined} faults</div>}
            {madeR2 && r2Time != null && <div className="text-xs" style={{ color: 'var(--mid)' }}>{Number(r2Time).toFixed(2)}s</div>}
            <div className="font-cormorant text-base font-semibold" style={{ color: 'var(--gold-lt)' }}>
              {pts > 0 ? pts + ' pts' : '—'}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Empty({ msg }) {
  return <div className="text-center py-12 font-cormorant text-lg italic" style={{ color: 'var(--mid)' }}>{msg}</div>;
}