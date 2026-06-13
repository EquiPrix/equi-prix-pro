import React, { useState, useEffect } from 'react';
import { EVENTS_2026, GCL_TEAMS_2026, PREVIEW_RIDERS_2026, sbFetch } from '@/lib/equiprix-data';
import { loadStartListRemote } from '@/lib/startListStore';
import { Save, ChevronDown, ChevronUp } from 'lucide-react';

const ROUND_TABS = [
  { id: 'r1', label: 'Team R1' },
  { id: 'r2', label: 'Team R2' },
  { id: 'final', label: 'Final' },
  { id: 'gp', label: 'Grand Prix' },
];

function NumCell({ value, onChange, placeholder = '' }) {
  return (
    <input type="number" value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="rounded px-2 py-1 text-xs outline-none w-full"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }} />
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      className="px-2 py-1 rounded text-xs font-cinzel tracking-widest transition-all"
      style={{ background: value ? 'rgba(76,175,125,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${value ? '#4caf7d' : 'var(--ep-border)'}`, color: value ? '#4caf7d' : 'var(--mid)', minWidth: 36 }}>
      {label}
    </button>
  );
}

function TeamRoundEditor({ teams, round, data, onChange, startList }) {
  const faultsKey = round === 'r1' ? 'r1Faults' : 'r2Faults';
  const timeKey = round === 'r1' ? 'r1Time' : 'r2Time';
  const ridersKey = round === 'r1' ? 'r1Riders' : 'r2Riders';

  const get = (teamId) => data[teamId] || {};

  const getPreFilled = (teamId, idx) => {
    const pair = startList?.teamPairs?.[teamId]?.[round];
    return pair?.[idx] || { name: '', horse: '' };
  };

  const getInitRiders = (teamId) => [
    { ...getPreFilled(teamId, 0), faults: '', time: '' },
    { ...getPreFilled(teamId, 1), faults: '', time: '' },
  ];

  const set = (teamId, field, value) => {
    const cur = get(teamId);
    const riders = cur[ridersKey] || getInitRiders(teamId);
    onChange({ ...data, [teamId]: { ...cur, [ridersKey]: riders, [field]: value } });
  };

  const setRiderFault = (teamId, idx, field, value) => {
    const cur = get(teamId);
    const riders = [...(cur[ridersKey] || getInitRiders(teamId))];
    if (!riders[idx]) riders[idx] = { name: '', horse: '', faults: '', time: '' };
    riders[idx] = { ...riders[idx], [field]: value };
    onChange({ ...data, [teamId]: { ...cur, [ridersKey]: riders } });
  };

  return (
    <div className="space-y-2">
      {teams.map(team => {
        const d = get(team.id);
        const riders = d[ridersKey] || getInitRiders(team.id);

        return (
          <div key={team.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ep-border)' }}>
            {/* Team header — faults/time entry */}
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'rgba(180,149,48,0.04)' }}>
              <span className="flex-1 font-cormorant text-sm font-semibold" style={{ color: 'var(--cream)' }}>{team.name}</span>
              <div className="flex items-center gap-1.5">
                <div style={{ width: 72 }}>
                  <NumCell value={d[faultsKey]} onChange={v => set(team.id, faultsKey, v === '' ? '' : Number(v))} placeholder="Faults" />
                </div>
                <div style={{ width: 72 }}>
                  <NumCell value={d[timeKey]} onChange={v => set(team.id, timeKey, v === '' ? '' : Number(v))} placeholder="Time" />
                </div>
                <Toggle label="RET" value={!!d.ret} onChange={v => set(team.id, 'ret', v)} />
                <Toggle label="EL" value={!!d.el} onChange={v => set(team.id, 'el', v)} />
              </div>
            </div>

            {/* Rider rows — display only, with individual fault entry */}
            <div className="px-3 py-2 space-y-1.5" style={{ borderTop: '1px solid var(--ep-border)', background: '#0d0c09' }}>
              <div className="grid grid-cols-12 gap-1 text-xs font-cinzel mb-1" style={{ color: 'var(--mid)', fontSize: 9 }}>
                <div className="col-span-4">RIDER</div>
                <div className="col-span-4">HORSE</div>
                <div className="col-span-2">FAULTS</div>
                <div className="col-span-2">TIME</div>
              </div>
              {[0, 1].map(idx => {
                const r = riders[idx] || {};
                return (
                  <div key={idx} className="grid grid-cols-12 items-center gap-1">
                    {/* Rider name — fixed display */}
                    <div className="col-span-4 font-cormorant text-sm truncate" style={{ color: 'var(--cream)' }}>
                      {r.name || <span style={{ color: 'var(--mid)', fontStyle: 'italic' }}>—</span>}
                    </div>
                    {/* Horse — fixed display in gold */}
                    <div className="col-span-4 font-cormorant text-sm truncate italic" style={{ color: 'var(--gold-lt)' }}>
                      {r.horse || <span style={{ color: 'var(--mid)' }}>—</span>}
                    </div>
                    {/* Faults — editable */}
                    <div className="col-span-2">
                      <NumCell value={r.faults} onChange={v => setRiderFault(team.id, idx, 'faults', v === '' ? '' : Number(v))} placeholder="0" />
                    </div>
                    {/* Time — editable */}
                    <div className="col-span-2">
                      <NumCell value={r.time} onChange={v => setRiderFault(team.id, idx, 'time', v === '' ? '' : Number(v))} placeholder="0.0" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function calcFinalPositions(teams, teamResults) {
  const withData = teams.map(team => {
    const d = teamResults[team.id] || {};
    const r2Faults = d.r2Faults !== '' && d.r2Faults !== undefined ? Number(d.r2Faults) : null;
    const r2Time = d.r2Time !== '' && d.r2Time !== undefined ? Number(d.r2Time) : null;
    const r1Faults = d.r1Faults !== '' && d.r1Faults !== undefined ? Number(d.r1Faults) : null;
    const r1Time = d.r1Time !== '' && d.r1Time !== undefined ? Number(d.r1Time) : null;
    const didR2 = r2Faults !== null || !!d.r2Ret || !!d.r2El;
    const isR2Failed = didR2 && (!!d.r2Ret || !!d.r2El);
    return { id: team.id, didR2, isR2Failed, r2Faults: r2Faults ?? 9999, r2Time: r2Time ?? 9999, r1Faults: r1Faults ?? 9999, r1Time: r1Time ?? 9999 };
  });

  const tier0 = withData.filter(t => t.didR2 && !t.isR2Failed).sort((a, b) => a.r2Faults - b.r2Faults || a.r2Time - b.r2Time);
  const tier1 = withData.filter(t => t.isR2Failed).sort((a, b) => a.r2Faults - b.r2Faults || a.r2Time - b.r2Time);
  const tier2 = withData.filter(t => !t.didR2).sort((a, b) => a.r1Faults - b.r1Faults || a.r1Time - b.r1Time);

  const posMap = {};
  let pos = 1;
  for (const t of [...tier0, ...tier1, ...tier2]) { posMap[t.id] = pos++; }
  return posMap;
}

function FinalEditor({ teams, data, onChange }) {
  const get = (teamId) => data[teamId] || {};
  const set = (teamId, field, value) => onChange({ ...data, [teamId]: { ...get(teamId), [field]: value } });
  const posMap = calcFinalPositions(teams, data);
  const sortedTeams = [...teams].sort((a, b) => (posMap[a.id] || 99) - (posMap[b.id] || 99));

  return (
    <div className="space-y-1">
      <p className="font-cormorant italic text-xs mb-2" style={{ color: 'var(--mid)' }}>
        Positions auto-calculated: R2 faults → R2 time tiebreaker. R2 EL/RET teams rank above R1-only teams.
      </p>
      <div className="grid grid-cols-12 gap-2 px-3 py-1 text-xs font-cinzel" style={{ color: 'var(--mid)', fontSize: 9 }}>
        <div className="col-span-1 text-center">POS</div>
        <div className="col-span-5">TEAM</div>
        <div className="col-span-3 text-center">R2 FAULTS · TIME</div>
        <div className="col-span-3">FLAGS</div>
      </div>
      {sortedTeams.map(team => {
        const d = get(team.id);
        const pos = posMap[team.id];
        const didR2 = d.r2Faults !== '' && d.r2Faults !== undefined;
        return (
          <div key={team.id} className="grid grid-cols-12 items-center gap-2 px-3 py-2 rounded"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(42,40,32,0.5)' }}>
            <div className="col-span-1 font-cinzel text-sm text-center" style={{ color: pos <= 3 ? 'var(--gold)' : 'var(--mid)' }}>{pos}</div>
            <div className="col-span-5 font-cormorant text-sm truncate" style={{ color: didR2 ? 'var(--cream)' : 'var(--mid)' }}>{team.name}</div>
            <div className="col-span-3 text-center font-cormorant text-xs" style={{ color: 'var(--mid)' }}>
              {d.r2Faults !== '' && d.r2Faults !== undefined ? `${d.r2Faults}f · ${d.r2Time ?? '—'}s` : '—'}
            </div>
            <div className="col-span-3 flex gap-1">
              <Toggle label="R2 RET" value={!!d.r2Ret} onChange={v => set(team.id, 'r2Ret', v)} />
              <Toggle label="R2 EL" value={!!d.r2El} onChange={v => set(team.id, 'r2El', v)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GPEditor({ riders, data, onChange }) {
  const get = (riderId) => data[String(riderId)] || {};
  const set = (riderId, field, value) => onChange({ ...data, [String(riderId)]: { ...get(riderId), [field]: value } });

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-12 gap-1 px-3 py-1 text-xs font-cinzel" style={{ color: 'var(--mid)', fontSize: 9 }}>
        <div className="col-span-3">RIDER</div>
        <div className="col-span-2">HORSE</div>
        <div className="col-span-1 text-center">POS</div>
        <div className="col-span-1 text-center">FLT</div>
        <div className="col-span-1 text-center">TIME</div>
        <div className="col-span-1 text-center">CLR</div>
        <div className="col-span-1 text-center">JO</div>
        <div className="col-span-1 text-center">RET</div>
        <div className="col-span-1 text-center">EL</div>
      </div>
      {riders.map((r, i) => {
        const d = get(r.id);
        return (
          <div key={r.id} className="rounded" style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent', border: '1px solid rgba(42,40,32,0.3)' }}>
            <div className="grid grid-cols-12 items-center gap-1 px-3 py-1.5">
              {/* Rider name + rank — fixed display */}
              <div className="col-span-3">
                <div className="font-cormorant text-sm truncate" style={{ color: 'var(--cream)' }}>{r.name}</div>
                <div className="text-xs" style={{ color: 'var(--mid)', fontSize: 9 }}>#{r.rank}</div>
              </div>
              {/* Horse — fixed display in gold, editable only if missing */}
              <div className="col-span-2 font-cormorant text-sm italic truncate" style={{ color: 'var(--gold-lt)' }}>
                {d.horse || r.horse || <span style={{ color: 'var(--mid)' }}>—</span>}
              </div>
              <div className="col-span-1"><NumCell value={d.gpPos} onChange={v => set(r.id, 'gpPos', v === '' ? '' : Number(v))} placeholder="—" /></div>
              <div className="col-span-1"><NumCell value={d.r1Faults} onChange={v => set(r.id, 'r1Faults', v === '' ? '' : Number(v))} placeholder="0" /></div>
              <div className="col-span-1"><NumCell value={d.r1Time} onChange={v => set(r.id, 'r1Time', v === '' ? '' : Number(v))} placeholder="0.0" /></div>
              <div className="col-span-1 flex justify-center"><Toggle label="✓" value={!!d.gpClear} onChange={v => set(r.id, 'gpClear', v)} /></div>
              <div className="col-span-1 flex justify-center"><Toggle label="JO" value={!!d.gpJO} onChange={v => set(r.id, 'gpJO', v)} /></div>
              <div className="col-span-1 flex justify-center"><Toggle label="R" value={!!d.gpRet} onChange={v => set(r.id, 'gpRet', v)} /></div>
              <div className="col-span-1 flex justify-center"><Toggle label="E" value={!!d.gpEl} onChange={v => set(r.id, 'gpEl', v)} /></div>
            </div>
            {d.gpJO && (
              <div className="grid grid-cols-12 items-center gap-1 px-3 py-1.5" style={{ borderTop: '1px solid rgba(42,40,32,0.5)', background: 'rgba(180,149,48,0.04)' }}>
                <div className="col-span-3 font-cinzel text-xs" style={{ color: 'var(--gold)', fontSize: 9 }}>↳ JO</div>
                <div className="col-span-2" />
                <div className="col-span-1"><NumCell value={d.joPos} onChange={v => set(r.id, 'joPos', v === '' ? '' : Number(v))} placeholder="pos" /></div>
                <div className="col-span-1"><NumCell value={d.joFaults} onChange={v => set(r.id, 'joFaults', v === '' ? '' : Number(v))} placeholder="0" /></div>
                <div className="col-span-1"><NumCell value={d.joTime} onChange={v => set(r.id, 'joTime', v === '' ? '' : Number(v))} placeholder="0.0" /></div>
                <div className="col-span-1" />
                <div className="col-span-1" />
                <div className="col-span-1 flex justify-center"><Toggle label="R" value={!!d.joRet} onChange={v => set(r.id, 'joRet', v)} /></div>
                <div className="col-span-1 flex justify-center"><Toggle label="E" value={!!d.joEl} onChange={v => set(r.id, 'joEl', v)} /></div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ResultsEditor() {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeRound, setActiveRound] = useState('r1');
  const [teamResults, setTeamResults] = useState({});
  const [riderResults, setRiderResults] = useState({});
  const [startList, setStartList] = useState(null);
  const [loadingStartList, setLoadingStartList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const event = EVENTS_2026.find(e => e.id === selectedEventId);
  const teams = event?.teams?.length ? event.teams : GCL_TEAMS_2026;

  useEffect(() => {
    if (!selectedEventId) return;
    setLoadingStartList(true);
    setTeamResults({});
    setRiderResults({});
    setStartList(null);

    loadStartListRemote(selectedEventId).then(sl => {
      setStartList(sl);
      setLoadingStartList(false);

      const ev = EVENTS_2026.find(e => e.id === selectedEventId);
      const sourceRiders = sl?.gp?.length ? sl.gp : (ev?.gpRiders?.length ? ev.gpRiders : []);
      if (sourceRiders.length) {
        const pre = {};
        sourceRiders.forEach(r => { if (r.horse) pre[String(r.id)] = { horse: r.horse }; });
        setRiderResults(pre);
      }
    });
  }, [selectedEventId]);

  const gpRiders = startList?.gp?.length
    ? [...startList.gp].sort((a, b) => a.rank - b.rank)
    : (event?.gpRiders?.length ? event.gpRiders : event?.riders?.length ? event.riders : PREVIEW_RIDERS_2026.slice(0, 20))
        .sort((a, b) => a.rank - b.rank);

  const save = async () => {
    if (!event) return;
    setSaving(true);
    const posMap = calcFinalPositions(teams, teamResults);
    const teamResultsWithPos = { ...teamResults };
    Object.entries(posMap).forEach(([teamId, pos]) => {
      teamResultsWithPos[teamId] = { ...(teamResultsWithPos[teamId] || {}), finalPos: pos };
    });
    await sbFetch('results', {
      method: 'POST',
      body: JSON.stringify({
        event: event.supabaseKey,
        rider_results: riderResults,
        team_results: teamResultsWithPos,
        updated_at: new Date().toISOString()
      })
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div>
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>ENTER RESULTS</h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Auto-populated from start lists. Enter faults, times and positions.
      </p>
      <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
        className="w-full rounded px-3 py-2 mb-4 text-sm outline-none"
        style={{ background: 'var(--ep-card)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }}>
        <option value="">— Select Event —</option>
        {EVENTS_2026.map(ev => (
          <option key={ev.id} value={ev.id}>{ev.flag} {ev.city} · {ev.dates}</option>
        ))}
      </select>

      {event && (
        <>
          {loadingStartList && (
            <div className="mb-3 px-3 py-2 rounded text-xs font-cormorant italic" style={{ background: 'rgba(180,149,48,0.06)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--mid)' }}>Loading start list…</div>
          )}
          {!loadingStartList && startList && (
            <div className="mb-3 px-3 py-2 rounded text-xs font-cormorant italic" style={{ background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.2)', color: '#6aad8a' }}>
              ✓ Start list loaded — {startList.gp?.length || 0} GP riders, team pairs set
            </div>
          )}
          {!loadingStartList && !startList && (
            <div className="mb-3 px-3 py-2 rounded text-xs font-cormorant italic" style={{ background: 'rgba(180,149,48,0.06)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--mid)' }}>
              Using hardcoded start list — {event?.gpRiders?.length || 0} GP riders
            </div>
          )}
          <div className="flex gap-1 mb-4 flex-wrap">
            {ROUND_TABS.map(t => (
              <button key={t.id} onClick={() => setActiveRound(t.id)}
                className="px-3 py-1.5 rounded font-cinzel text-xs transition-all"
                style={{
                  background: activeRound === t.id ? 'rgba(180,149,48,0.12)' : 'none',
                  border: `1px solid ${activeRound === t.id ? 'rgba(180,149,48,0.4)' : 'var(--ep-border)'}`,
                  color: activeRound === t.id ? 'var(--gold)' : 'var(--mid)',
                  letterSpacing: '0.08em',
                }}>
                {t.label.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mb-4">
            {activeRound === 'r1' && <TeamRoundEditor teams={teams} round="r1" data={teamResults} onChange={setTeamResults} startList={startList} />}
            {activeRound === 'r2' && <TeamRoundEditor teams={teams} round="r2" data={teamResults} onChange={setTeamResults} startList={startList} />}
            {activeRound === 'final' && <FinalEditor teams={teams} data={teamResults} onChange={setTeamResults} />}
            {activeRound === 'gp' && <GPEditor riders={gpRiders} data={riderResults} onChange={setRiderResults} />}
          </div>
          <button onClick={save} disabled={saving}
            className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2 sticky bottom-4"
            style={{ background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)', color: saved ? '#4caf7d' : 'var(--ink)', border: saved ? '1px solid #4caf7d' : 'none' }}>
            <Save size={13} />
            {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE RESULTS'}
          </button>
        </>
      )}
    </div>
  );
}