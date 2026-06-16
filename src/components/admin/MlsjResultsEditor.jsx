import React, { useState, useEffect } from 'react';
import { MLSJ_TEAMS_2026, MLSJ_EVENTS_2026_27, sbFetch, scoreMlsjTeam } from '@/lib/mlsj-data';
import { PREVIEW_RIDERS_2026 } from '@/lib/equiprix-data';

// Self-contained admin tab: picks its own MLSJ leg, no props required.
// Usage: <MlsjResultsEditor />

export function MlsjResultsEditor() {
  const [eventId, setEventId] = useState(MLSJ_EVENTS_2026_27[0]?.id || '');
  const event = MLSJ_EVENTS_2026_27.find(e => e.id === eventId);

  const [results, setResults] = useState({}); // { [teamId]: {...} }
  const [declaredTrioIds, setDeclaredTrioIds] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!event) return;
    (async () => {
      const rows = await sbFetch('results?event=eq.' + encodeURIComponent(event.supabaseKey) + '&limit=1');
      if (rows && rows.length) {
        setResults(rows[0].team_results || {});
        setDeclaredTrioIds(rows[0].declared_trio_ids || {});
      } else {
        setResults({});
        setDeclaredTrioIds({});
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
      const body = [{ event: event.supabaseKey, team_results: results }];
      await sbFetch('results?on_conflict=event', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.error('Save failed', e);
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
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
          className="px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap"
          style={{ background: 'var(--gold)', color: '#0f0e0a' }}
        >
          {saving ? 'Saving…' : 'Save Results'}
        </button>
      </div>

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
                <input
                  type="checkbox"
                  checked={!!r.retired}
                  onChange={e => updateTeam(team.id, { retired: e.target.checked })}
                />
                Retired mid-round
              </label>

              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!!r.eliminatedForCause}
                  onChange={e => updateTeam(team.id, { eliminatedForCause: e.target.checked })}
                />
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
    </div>
  );
}