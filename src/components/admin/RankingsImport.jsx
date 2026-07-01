import React, { useState, useEffect } from 'react';
import { rankToSalary, sbFetch } from '@/lib/equiprix-data';
import { Upload, Loader2, Save } from 'lucide-react';

// ── CSV parser ────────────────────────────────────────────────────────────────
// Accepts: rank,name,country  (header row optional)
// Tied ranks are allowed and all rows are kept.
function parseCsv(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const rank = parseInt(cols[0]);
    const name = cols[1];
    const nat  = cols[2] || '';
    // Skip header rows
    if (isNaN(rank) || !name || name.toLowerCase() === 'name') continue;
    rows.push({ rank, name, nat });
  }
  return rows;
}

// ── Name matching ─────────────────────────────────────────────────────────────
// Returns the DB rider whose name best matches the CSV name, or null.
function matchName(csvName, dbMap) {
  const lower = csvName.toLowerCase();

  // 1. Exact match
  if (dbMap.has(lower)) return dbMap.get(lower);

  // 2. Case-insensitive with normalised apostrophes/accents
  const norm = lower.replace(/[''`]/g, "'").normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, rider] of dbMap) {
    const keyNorm = key.replace(/[''`]/g, "'").normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (keyNorm === norm) return rider;
  }

  // 3. Last-word (surname) fallback — only if there is a single match
  const lastWord = lower.split(' ').pop();
  const hits = [];
  for (const [key, rider] of dbMap) {
    if (key.split(' ').pop() === lastWord) hits.push(rider);
  }
  if (hits.length === 1) return hits[0];

  return null;
}

// ── Build plan ────────────────────────────────────────────────────────────────
// Returns { toUpdate, toInsert, unchanged }
// toUpdate  — existing DB riders whose rank/salary/nat will change
// toInsert  — CSV rows with no matching DB rider → will be inserted as new
// unchanged — existing riders whose data already matches (no-op)
function buildPlan(csvRows, liveRiders, maxId) {
  const dbMap = new Map(liveRiders.map(r => [r.name.toLowerCase(), r]));

  const toUpdate  = [];
  const toInsert  = [];
  const unchanged = [];
  let nextId = maxId + 1;

  for (const row of csvRows) {
    const newSalary = rankToSalary(row.rank);
    const existing  = matchName(row.name, dbMap);

    if (existing) {
      const changed =
        existing.rank   !== row.rank   ||
        existing.salary !== newSalary  ||
        (row.nat && existing.nat !== row.nat);

      if (changed) {
        toUpdate.push({
          id:        String(existing.id),
          name:      existing.name,
          oldRank:   existing.rank,
          newRank:   row.rank,
          oldSalary: existing.salary,
          newSalary,
          nat:       row.nat || existing.nat,
        });
      } else {
        unchanged.push(existing.name);
      }
    } else {
      // Brand-new rider — will be inserted
      toInsert.push({
        id:     String(nextId++),
        name:   row.name,
        rank:   row.rank,
        nat:    row.nat,
        salary: newSalary,
      });
    }
  }

  return { toUpdate, toInsert, unchanged };
}

// ── Execute plan ──────────────────────────────────────────────────────────────
async function executePlan(toUpdate, toInsert, onProgress) {
  const errors = [];

  // 1. Updates — run in parallel batches of 20
  const UPDATE_BATCH = 20;
  for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
    const batch = toUpdate.slice(i, i + UPDATE_BATCH);
    await Promise.all(batch.map(r =>
      sbFetch(`riders?id=eq.${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ rank: r.newRank, salary: r.newSalary, nat: r.nat }),
      }).catch(() => errors.push(r.name))
    ));
    onProgress && onProgress(i + batch.length, toUpdate.length, 'update');
  }

  // 2. Inserts — Supabase accepts a JSON array in one POST
  const INSERT_BATCH = 200;
  for (let i = 0; i < toInsert.length; i += INSERT_BATCH) {
    const batch = toInsert.slice(i, i + INSERT_BATCH);
    await sbFetch('riders', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(batch),
    }).catch(() => batch.forEach(r => errors.push(r.name)));
    onProgress && onProgress(i + batch.length, toInsert.length, 'insert');
  }

  return errors;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RankingsImport() {
  const [file, setFile]         = useState(null);
  const [status, setStatus]     = useState('idle');
  const [plan, setPlan]         = useState(null);
  const [progress, setProgress] = useState('');
  const [saveErrors, setSaveErrors] = useState([]);
  const [liveRiders, setLiveRiders] = useState([]);
  const [loadingRiders, setLoadingRiders] = useState(true);

  // Load full rider list on mount
  useEffect(() => {
    sbFetch('riders?select=id,name,rank,nat,salary&limit=5000')
      .then(rows => setLiveRiders(rows || []))
      .catch(e => console.error('Failed to load riders:', e))
      .finally(() => setLoadingRiders(false));
  }, []);

  const maxId = liveRiders.length
    ? Math.max(...liveRiders.map(r => Number(r.id) || 0))
    : 999;

  const handleFileChange = e => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setStatus('idle');
    setPlan(null);
    setSaveErrors([]);
  };

  const handleExtract = async () => {
    if (!file) return;
    setStatus('parsing');
    try {
      const text    = await file.text();
      const csvRows = parseCsv(text);
      const result  = buildPlan(csvRows, liveRiders, maxId);
      setPlan({ ...result, totalCsv: csvRows.length });
      setStatus('preview');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  const handleSave = async () => {
    if (!plan) return;
    setStatus('saving');
    setSaveErrors([]);

    const errors = await executePlan(
      plan.toUpdate,
      plan.toInsert,
      (done, total, type) => setProgress(
        type === 'update'
          ? `Updating ${done}/${total} riders…`
          : `Inserting ${done}/${total} new riders…`
      )
    );

    setSaveErrors(errors);
    setStatus('saved');
  };

  const reset = () => {
    setFile(null);
    setStatus('idle');
    setPlan(null);
    setSaveErrors([]);
    setProgress('');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>
        IMPORT FEI RANKINGS
      </h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Upload the monthly FEI Rankings CSV. Every rider is upserted — existing riders are
        updated, new ones are added. Tied ranks are kept as-is.
      </p>

      {/* DB status */}
      <div className="mb-4 text-xs font-cormorant italic" style={{ color: 'var(--mid)' }}>
        {loadingRiders
          ? <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Loading rider database…</span>
          : <span>{liveRiders.length.toLocaleString()} riders currently in database</span>
        }
      </div>

      {/* Format hint */}
      <div className="rounded-lg p-3 mb-4 text-xs font-mono"
        style={{ background: '#0a0907', border: '1px solid var(--ep-border)', color: '#9fead4' }}>
        CSV format: <span style={{ color: 'var(--gold-lt)' }}>rank,name,country</span><br />
        1,Kent Farrington,USA<br />
        3,Scott Brash,GBR<br />
        3,Ben Maher,GBR &nbsp;<span style={{ color: 'var(--mid)' }}>← tied ranks allowed</span>
      </div>

      {/* File picker */}
      <label className="flex flex-col items-center justify-center gap-3 rounded-xl p-8 mb-4 cursor-pointer transition-all"
        style={{
          border: `2px dashed ${file ? 'rgba(180,149,48,0.5)' : 'rgba(180,149,48,0.2)'}`,
          background: file ? 'rgba(180,149,48,0.05)' : 'transparent',
        }}>
        <Upload size={24} style={{ color: 'var(--gold)' }} />
        <div className="text-center">
          <div className="font-cinzel text-xs tracking-widest"
            style={{ color: file ? 'var(--gold)' : 'var(--mid)' }}>
            {file ? file.name : 'TAP TO SELECT CSV'}
          </div>
          {!file && <div className="text-xs mt-1" style={{ color: 'var(--mid)' }}>CSV only</div>}
        </div>
        <input type="file" accept=".csv" onChange={handleFileChange}
          className="hidden" disabled={loadingRiders} />
      </label>

      {/* Extract button */}
      {file && status === 'idle' && (
        <button onClick={handleExtract} disabled={loadingRiders}
          className="w-full py-3 rounded font-cinzel text-xs tracking-widest"
          style={{ background: 'var(--gold)', color: 'var(--ink)', opacity: loadingRiders ? 0.5 : 1 }}>
          PREVIEW CHANGES →
        </button>
      )}

      {/* Parsing spinner */}
      {status === 'parsing' && (
        <div className="flex items-center gap-3 py-4 justify-center">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--gold)' }} />
          <span className="font-cormorant text-base italic" style={{ color: 'var(--mid)' }}>
            Parsing CSV…
          </span>
        </div>
      )}

      {/* Saving progress */}
      {status === 'saving' && (
        <div className="flex items-center gap-3 py-4 justify-center">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--gold)' }} />
          <span className="font-cormorant text-base italic" style={{ color: 'var(--mid)' }}>
            {progress || 'Saving…'}
          </span>
        </div>
      )}

      {/* Preview / Saved */}
      {(status === 'preview' || status === 'saved') && plan && (
        <div className="mt-2 space-y-4">

          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.3)' }}>
              <div className="font-cinzel text-xl" style={{ color: '#4caf7d' }}>
                {plan.toUpdate.length.toLocaleString()}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--mid)' }}>Updated</div>
            </div>
            <div className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(180,149,48,0.1)', border: '1px solid rgba(180,149,48,0.3)' }}>
              <div className="font-cinzel text-xl" style={{ color: 'var(--gold)' }}>
                {plan.toInsert.length.toLocaleString()}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--mid)' }}>New riders</div>
            </div>
            <div className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--ep-border)' }}>
              <div className="font-cinzel text-xl" style={{ color: 'var(--mid)' }}>
                {plan.unchanged.length.toLocaleString()}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--mid)' }}>Unchanged</div>
            </div>
          </div>

          {/* Saved confirmation */}
          {status === 'saved' && (
            <div className="rounded-lg px-4 py-3 text-sm font-cormorant"
              style={{
                background: saveErrors.length ? 'rgba(139,26,26,0.1)' : 'rgba(76,175,125,0.1)',
                border: `1px solid ${saveErrors.length ? 'rgba(139,26,26,0.3)' : 'rgba(76,175,125,0.3)'}`,
                color: saveErrors.length ? 'var(--crimson)' : '#4caf7d',
              }}>
              {saveErrors.length
                ? `⚠ ${saveErrors.length} failed: ${saveErrors.slice(0, 5).join(', ')}${saveErrors.length > 5 ? '…' : ''}`
                : `✓ ${plan.toUpdate.length} updated · ${plan.toInsert.length} added · rankings live immediately`
              }
            </div>
          )}

          {/* Rank changes list */}
          {plan.toUpdate.length > 0 && (
            <div>
              <div className="font-cinzel text-xs tracking-widest mb-2" style={{ color: 'var(--gold)' }}>
                RANK CHANGES ({plan.toUpdate.length})
              </div>
              <div className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--ep-border)', maxHeight: 260, overflowY: 'auto' }}>
                {plan.toUpdate.map((r, i) => (
                  <div key={r.id}
                    className="flex items-center gap-2 px-3 py-2 text-xs"
                    style={{
                      borderBottom: i < plan.toUpdate.length - 1 ? '1px solid var(--ep-border)' : 'none',
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}>
                    <span className="flex-1 font-cormorant text-sm truncate" style={{ color: 'var(--cream)' }}>
                      {r.name}
                    </span>
                    <span style={{ color: 'var(--mid)' }}>#{r.oldRank} →</span>
                    <span style={{ color: r.newRank < r.oldRank ? '#4caf7d' : 'var(--crimson)' }}>
                      #{r.newRank}
                    </span>
                    {r.newSalary !== r.oldSalary && (
                      <span className="px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(180,149,48,0.1)', color: 'var(--gold)', fontSize: 9 }}>
                        ${r.newSalary.toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New riders list */}
          {plan.toInsert.length > 0 && (
            <div>
              <div className="font-cinzel text-xs tracking-widest mb-2" style={{ color: 'var(--gold)' }}>
                NEW RIDERS ({plan.toInsert.length})
              </div>
              <div className="rounded-lg p-3 text-xs"
                style={{ background: 'rgba(180,149,48,0.05)', border: '1px solid rgba(180,149,48,0.2)',
                         maxHeight: 120, overflowY: 'auto' }}>
                <div className="font-cormorant" style={{ color: 'var(--mid)', lineHeight: 1.6 }}>
                  {plan.toInsert.map(r => (
                    <span key={r.id} className="mr-2">
                      {r.name} <span style={{ color: 'var(--gold)', fontSize: 9 }}>#{r.rank}</span>
                      {' · '}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Save / reset buttons */}
          {status === 'preview' && (
            <button onClick={handleSave}
              className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2"
              style={{ background: 'var(--gold)', color: 'var(--ink)' }}>
              <Save size={13} />
              SAVE {(plan.toUpdate.length + plan.toInsert.length).toLocaleString()} CHANGES TO DATABASE
            </button>
          )}

          <button onClick={reset}
            className="w-full py-2 rounded text-xs font-cinzel tracking-widest"
            style={{ border: '1px solid var(--ep-border)', color: 'var(--mid)', background: 'none' }}>
            IMPORT ANOTHER FILE
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg px-4 py-3 text-sm font-cormorant mt-2"
          style={{ background: 'rgba(139,26,26,0.1)', border: '1px solid rgba(139,26,26,0.3)', color: 'var(--crimson)' }}>
          Failed to parse file. Make sure it's a CSV with rank,name,country columns.
        </div>
      )}
    </div>
  );
}