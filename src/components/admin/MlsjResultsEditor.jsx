import React, { useState, useEffect } from 'react';
import { MLSJ_TEAMS_2026, MLSJ_EVENTS_2026_27, sbFetch, scoreMlsjTeam } from '@/lib/mlsj-data';
import { PREVIEW_RIDERS_2026 } from '@/lib/equiprix-data';
import { Save } from 'lucide-react';

// Self-contained admin tab: picks its own MLSJ leg, no props required.
// Usage: <MlsjResultsEditor />

// ── ADDED: shared NumCell + Toggle helpers (mirrors GCL ResultsEditor)
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

// ── ADDED: GP results entry — identical structure to GCL's GPEditor.
// Reads riders from gp_riders saved in the MLSJ start list, lets admin
// enter position, faults, time, clear/JO/ret/el flags per rider.
function GPEditor({ riders, data, onChange }) {
  const get = (riderId) => data[String(riderId)] || {};
  const set = (riderId, field, value) =>
    onChange({ ...data, [String(riderId)]: { ...get(riderId), [field]: value } });

  if (!riders.length) {
    return (
      <div className="rounded-lg p-6 text-center" style={{ border: '1px dashed var(--ep-border)' }}>
        <p className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>
          No GP riders in start list yet — add them in the GP tab of MLSJ Start Lists first.
        </p>
      </div>
    );
  }

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
              <div className="col-span-3">
                <div className="font-cormorant text-sm truncate" style={{ color: 'var(--cream)' }}>{r.name}</div>
                <div className="text-xs" style={{ color: 'var(--mid)', fontSize: 9 }}>#{r.rank >= 999 ? '—' : r.rank}</div>
              </div>
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
                <div className="col-span-1" /><div className="col-span-1" />
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

// ── ADDED: tab config — Team Competition + Grand Prix
const ROUND_TABS = [
  { id: 'team', label: 'Team Competition' },
  { id: 'gp',   label: 'Grand Prix' },
];

export function MlsjResultsEditor() {
  const [eventId, setEventId] = useState(MLSJ_EVENTS_2026_27[0]?.id || '');
  const event = MLSJ_EVENTS_2026_27.find(e => e.id === eventId);

  // ── ADDED: tab state
  const [activeTab, setActiveTab] = useState('team');

  const [results, setResults] = useState({});
  const [declaredTrioIds, setDeclaredTrioIds] = useState({});
  // ── ADDED: GP rider results + start list riders
  const [gpRiderResults, setGpRiderResults] = useState({});
  const [gpRiders, setGpRiders] = useState([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!event) return;
    (async () => {
      const rows = await sbFetch('results?event=eq.' + encodeURIComponent(event.supabaseKey) + '&limit=1');
      if (rows && rows.length) {
        setResults(rows[0].team_results || {});
        setDeclaredTrioIds(rows[0].declared_trio_ids || {});
        // ── ADDED: load GP rider results + GP start list riders
        setGpRiderResults(rows[0].gp_rider_results || {});
        // gp_riders holds the start list (rider objects with name/rank/horse)
        const startRiders = (rows[0].gp_riders || []).sort((a, b) => a.rank - b.rank);
        setGpRiders(startRiders);
      } else {
        setResults({});
        setDeclaredTrioIds({});
        setGpRiderResults({});
        setGpRiders([]);
      }
    })();
  }, [eventId]);

  const trioNames = (teamId) => (declaredTrioIds[teamId] || [])
    .map(id => PREVIEW_RIDERS_2026.find(r => r.id === id)?.name)
    .filter(Boolean)
    .join(' · ');

  function updateTeam(teamId, patch) {
    setResults(prev => ({ ...prev, [teamId]: { ...prev[teamId], ...patch } }));
  }

  async function handleSave() {
    if (!event) return;
    setSaving(true);
    try {
      // ── CHANGED: payload now includes gp_rider_results alongside
      // team_results so both are persisted in the same results row.
      const payload = {
        team_results: results,
        gp_rider_results: gpRiderResults,
        updated_at: new Date().toISOString(),
      };
      const existing = await sbFetch('results?event=eq.' + encodeURIComponent(event.supabaseKey) + '&limit=1');
      if (existing && existing.length > 0) {
        await sbFetch('results?event=eq.' + encodeURIComponent(event.supabaseKey), {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await sbFetch('results', {
          method: 'POST',
          body: JSON.stringify({ event: event.supabaseKey, ...payload }),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('Save failed', e);
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-3">
      {/* Event selector */}
      <div className="flex items-center gap-3">
        <select
          value={eventId}
          onChange={e => setEventId(e.target.value)}
          className="bg-transparent border rounded px-2 py-1.5 text-sm flex-1"
          style={{ borderColor: 'rgba(180,149,48,0.3)', color: 'var(--gold-lt)' }}
        >
          {MLSJ_EVENTS_2026_27.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.flag} {ev.city} — {ev.dates}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap flex items-center gap-1.5"
          style={{ background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)', color: saved ? '#4caf7d' : '#0f0e0a', border: saved ? '1px solid #4caf7d' : 'none' }}
        >
          <Save size={13} />
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Results'}
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1">
        {ROUND_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="px-3 py-1.5 rounded font-cinzel text-xs transition-all"
            style={{
              background: activeTab === t.id ? 'rgba(180,149,48,0.12)' : 'none',
              border: `1px solid ${activeTab === t.id ? 'rgba(180,149,48,0.4)' : 'var(--ep-border)'}`,
              color: activeTab === t.id ? 'var(--gold)' : 'var(--mid)',
              letterSpacing: '0.08em',
            }}>
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── Team Competition tab (unchanged from original) */}
      {activeTab === 'team' && (
        <>
          <h3 className="font-cormorant text-lg" style={{ color: 'var(--gold-lt)' }}>
            {event?.city} — Team Competition Results
          </h3>
          <div className="text-xs opacity-60 mb-2">
            R1 place 1-4 = advanced; 5-8 = eliminated. R2 side only applies if advanced. Final result only applies if reached Round 3.
          </div>

          {MLSJ_TEAMS_2026.map(team => {
            const r = results[team.id] || {};
            return (
              <div key={team.id} className="px-3 py-3 rounded space-y-2" style={{ background: 'var(--ep-card)', border: '1px solid rgba(180,149,48,0.2)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{team.name}</div>
                    {trioNames(team.id) && (
                      <div className="text-xs opacity-50">{trioNames(team.id)}</div>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--gold-lt)' }}>{scoreMlsjTeam(r)} pts</div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-1">
                    R1 Place
                    <select
                      value={r.r1Place ?? ''}
                      onChange={e => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        updateTeam(team.id, { r1Place: val, advancedR1: val != null ? val <= 4 : undefined });
                      }}
                      className="bg-transparent border rounded px-1 py-0.5"
                      style={{ borderColor: 'rgba(180,149,48,0.3)' }}
                    >
                      <option value="">—</option>
                      {[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>

                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!r.retired} onChange={e => updateTeam(team.id, { retired: e.target.checked })} />
                    Retired mid-round
                  </label>

                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!r.eliminatedForCause} onChange={e => updateTeam(team.id, { eliminatedForCause: e.target.checked })} />
                    Eliminated for cause
                  </label>

                  {r.advancedR1 && (
                    <>
                      <label className="flex items-center gap-1">
                        R2 Side
                        <select
                          value={r.r2Side ?? ''}
                          onChange={e => updateTeam(team.id, { r2Side: e.target.value || null })}
                          className="bg-transparent border rounded px-1 py-0.5"
                          style={{ borderColor: 'rgba(180,149,48,0.3)' }}
                        >
                          <option value="">—</option>
                          <option value="gold">Gold/Silver match</option>
                          <option value="bronze">Bronze match</option>
                        </select>
                      </label>

                      <label className="flex items-center gap-1">
                        Final Result
                        <select
                          value={r.finalResult ?? ''}
                          onChange={e => updateTeam(team.id, { finalResult: e.target.value || null })}
                          className="bg-transparent border rounded px-1 py-0.5"
                          style={{ borderColor: 'rgba(180,149,48,0.3)' }}
                        >
                          <option value="">—</option>
                          <option value="gold">Gold</option>
                          <option value="silver">Silver</option>
                          <option value="bronze">Bronze</option>
                          <option value="fourth">4th</option>
                        </select>
                      </label>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ── ADDED: Grand Prix tab */}
      {activeTab === 'gp' && (
        <>
          <h3 className="font-cormorant text-lg" style={{ color: 'var(--gold-lt)' }}>
            {event?.city} — Grand Prix Results
          </h3>
          <p className="font-cormorant text-sm italic mb-2" style={{ color: 'var(--mid)' }}>
            Riders pulled from the MLSJ GP start list. Enter position, faults, time and flags per rider.
          </p>
          <GPEditor riders={gpRiders} data={gpRiderResults} onChange={setGpRiderResults} />
        </>
      )}
    </div>
  );
}