import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { rankToSalary, sbFetch } from '@/lib/equiprix-data';
import { Upload, Loader2, Save } from 'lucide-react';

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const result = {};
  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const rank = parseInt(cols[0]);
    const name = cols[1];
    if (!isNaN(rank) && name && name.toLowerCase() !== 'name') {
      result[name] = rank;
    }
  }
  return result;
}

// ── Match extracted rankings against the LIVE riders table ───────────────────
// CHANGED: now matches against every rider currently in Supabase (the
// `riders` table), not just the static PREVIEW_RIDERS_2026 array. Any
// rider added later via the admin Riders page — like Kevin Staut, added
// directly through the UI — is now included in future ranking imports.
// Previously, riders not present in PREVIEW_RIDERS_2026 were silently
// skipped no matter how many times the import ran, since the match loop
// only iterated that static array.
function buildChanges(extracted, liveRiders) {
  const updated = [];
  const notFound = [];

  for (const rider of liveRiders) {
    let newRank = extracted[rider.name];

    // Case-insensitive / partial fallback
    if (!newRank) {
      const key = Object.keys(extracted).find(k =>
        k.toLowerCase() === rider.name.toLowerCase() ||
        rider.name.toLowerCase().includes(k.toLowerCase().split(' ').pop())
      );
      if (key) newRank = extracted[key];
    }

    if (newRank && newRank !== 999 && newRank !== rider.rank) {
      updated.push({
        id: String(rider.id),
        name: rider.name,
        oldRank: rider.rank,
        newRank,
        oldSalary: rider.salary,
        newSalary: rankToSalary(newRank),
      });
    } else if (!newRank) {
      notFound.push(rider.name);
    }
  }

  return { updated, notFound };
}

// ── Save changes to riders table ─────────────────────────────────────────────
async function saveRankingsToSupabase(changes) {
  const errors = [];
  for (const r of changes) {
    try {
      await sbFetch('riders?id=eq.' + r.id, {
        method: 'PATCH',
        body: JSON.stringify({ rank: r.newRank, salary: r.newSalary }),
      });
    } catch (e) {
      errors.push(r.name);
      console.error('Failed to update rider', r.name, e);
    }
  }
  return errors;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RankingsImport() {
  const [file, setFile]       = useState(null);
  const [mode, setMode]       = useState(null);
  const [status, setStatus]   = useState('idle');
  const [results, setResults] = useState(null);
  const [saveErrors, setSaveErrors] = useState([]);

  // CHANGED: load the full live riders list from Supabase on mount,
  // instead of relying on the static PREVIEW_RIDERS_2026 array. This is
  // what the import is matched against.
  const [liveRiders, setLiveRiders] = useState([]);
  const [loadingRiders, setLoadingRiders] = useState(true);

  useEffect(() => {
    sbFetch('riders?select=id,name,rank,salary&limit=2000')
      .then(rows => setLiveRiders(rows || []))
      .catch(e => console.error('Failed to load riders for ranking import:', e))
      .finally(() => setLoadingRiders(false));
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setMode(f.name.endsWith('.csv') ? 'csv' : 'pdf');
    setStatus('idle');
    setResults(null);
    setSaveErrors([]);
  };

  const handleImport = async () => {
    if (!file) return;

    if (mode === 'csv') {
      setStatus('parsing');
      const text = await file.text();
      const extracted = parseCsv(text);
      const { updated, notFound } = buildChanges(extracted, liveRiders);
      setResults({ updated, notFound });
      setStatus('done');
      return;
    }

    // PDF — AI extraction
    setStatus('uploading');
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setStatus('parsing');
    const riderNames = liveRiders.map(r => r.name).join(', ');
    const extracted = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract FEI Longines World Rankings from this PDF. Find the world ranking number for each of these riders (allow slight name variations): ${riderNames}. Return a JSON object: {"Rider Name": rankNumber, ...}. Use null if not found.`,
      file_urls: [file_url],
      response_json_schema: { type: 'object', additionalProperties: { type: ['integer', 'null'] } },
    });
    const { updated, notFound } = buildChanges(extracted, liveRiders);
    setResults({ updated, notFound });
    setStatus('done');
  };

  const handleSave = async () => {
    if (!results?.updated?.length) return;
    setStatus('saving');
    setSaveErrors([]);
    const errors = await saveRankingsToSupabase(results.updated);
    setSaveErrors(errors);
    setStatus('saved');
  };

  const reset = () => {
    setFile(null);
    setStatus('idle');
    setResults(null);
    setMode(null);
    setSaveErrors([]);
  };

  return (
    <div className="max-w-lg">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>
        IMPORT FEI RANKINGS
      </h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Upload the FEI Rankings as a <strong style={{ color: 'var(--ep-text)' }}>CSV</strong> (rank, name, country) or{' '}
        <strong style={{ color: 'var(--ep-text)' }}>PDF</strong>. Matches against every rider currently in the database — changes save directly, no manual edits needed.
      </p>

      {loadingRiders && (
        <div className="flex items-center gap-2 mb-3 text-xs font-cormorant italic" style={{ color: 'var(--mid)' }}>
          <Loader2 size={13} className="animate-spin" /> Loading rider database…
        </div>
      )}
      {!loadingRiders && (
        <div className="mb-4 text-xs font-cormorant italic" style={{ color: 'var(--mid)' }}>
          Matching against {liveRiders.length} riders currently in the database.
        </div>
      )}

      {/* Format hint */}
      <div className="rounded-lg p-3 mb-4 text-xs font-mono"
        style={{ background: '#0a0907', border: '1px solid var(--ep-border)', color: '#9fead4' }}>
        CSV format: <span style={{ color: 'var(--gold-lt)' }}>rank,name,country</span><br />
        1,Kent Farrington,USA<br />
        2,Scott Brash,GBR<br />
        3,Henrik von Eckermann,SWE
      </div>

      {/* File picker */}
      <label className="flex flex-col items-center justify-center gap-3 rounded-xl p-8 mb-4 cursor-pointer transition-all"
        style={{
          border: `2px dashed ${file ? 'rgba(180,149,48,0.5)' : 'rgba(180,149,48,0.2)'}`,
          background: file ? 'rgba(180,149,48,0.05)' : 'transparent',
        }}>
        <Upload size={24} style={{ color: 'var(--gold)' }} />
        <div className="text-center">
          <div className="font-cinzel text-xs tracking-widest" style={{ color: file ? 'var(--gold)' : 'var(--mid)' }}>
            {file ? file.name : 'TAP TO SELECT FILE'}
          </div>
          {!file && <div className="text-xs mt-1" style={{ color: 'var(--mid)' }}>CSV or PDF</div>}
          {file && <div className="text-xs mt-1 uppercase" style={{ color: 'var(--mid)' }}>{mode} detected</div>}
        </div>
        <input type="file" accept=".pdf,.csv" onChange={handleFileChange} className="hidden" disabled={loadingRiders} />
      </label>

      {file && status === 'idle' && (
        <button onClick={handleImport} disabled={loadingRiders}
          className="w-full py-3 rounded font-cinzel text-xs tracking-widest"
          style={{ background: 'var(--gold)', color: 'var(--ink)', opacity: loadingRiders ? 0.5 : 1 }}>
          EXTRACT RANKINGS →
        </button>
      )}

      {(status === 'uploading' || status === 'parsing' || status === 'saving') && (
        <div className="flex items-center gap-3 py-4 justify-center">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--gold)' }} />
          <span className="font-cormorant text-base italic" style={{ color: 'var(--mid)' }}>
            {status === 'uploading' ? 'Uploading…'
              : status === 'parsing' ? (mode === 'pdf' ? 'AI extracting rankings…' : 'Parsing CSV…')
              : `Saving ${results?.updated?.length} riders to database…`}
          </span>
        </div>
      )}

      {(status === 'done' || status === 'saved') && results && (
        <div className="mt-2 space-y-4">

          <div className="flex gap-3">
            <div className="flex-1 rounded-lg p-3 text-center"
              style={{ background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.3)' }}>
              <div className="font-cinzel text-xl" style={{ color: '#4caf7d' }}>{results.updated.length}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--mid)' }}>Changes found</div>
            </div>
            <div className="flex-1 rounded-lg p-3 text-center"
              style={{ background: 'rgba(139,26,26,0.1)', border: '1px solid rgba(139,26,26,0.3)' }}>
              <div className="font-cinzel text-xl" style={{ color: 'var(--crimson)' }}>{results.notFound.length}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--mid)' }}>Not matched</div>
            </div>
          </div>

          {status === 'saved' && (
            <div className="rounded-lg px-4 py-3 text-sm font-cormorant"
              style={{
                background: saveErrors.length ? 'rgba(139,26,26,0.1)' : 'rgba(76,175,125,0.1)',
                border: `1px solid ${saveErrors.length ? 'rgba(139,26,26,0.3)' : 'rgba(76,175,125,0.3)'}`,
                color: saveErrors.length ? 'var(--crimson)' : '#4caf7d',
              }}>
              {saveErrors.length
                ? `⚠ ${results.updated.length - saveErrors.length} saved, ${saveErrors.length} failed: ${saveErrors.join(', ')}`
                : `✓ ${results.updated.length} riders updated in database. Rank and salary live everywhere immediately.`}
            </div>
          )}

          {results.updated.length > 0 && (
            <div>
              <div className="font-cinzel text-xs tracking-widest mb-2" style={{ color: 'var(--gold)' }}>
                RANKING CHANGES
              </div>
              <div className="rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--ep-border)', maxHeight: 280, overflowY: 'auto' }}>
                {results.updated.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2 text-xs"
                    style={{
                      borderBottom: i < results.updated.length - 1 ? '1px solid var(--ep-border)' : 'none',
                      background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}>
                    <span className="flex-1 font-cormorant text-sm" style={{ color: 'var(--cream)' }}>{r.name}</span>
                    <span style={{ color: 'var(--mid)' }}>#{r.oldRank} →</span>
                    <span style={{ color: r.newRank < r.oldRank ? '#4caf7d' : 'var(--crimson)' }}>#{r.newRank}</span>
                    {r.newSalary !== r.oldSalary && (
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(180,149,48,0.1)', color: 'var(--gold)', fontSize: 9 }}>
                        ${r.newSalary.toLocaleString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {status === 'done' && (
                <button onClick={handleSave}
                  className="mt-3 w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2"
                  style={{ background: 'var(--gold)', color: 'var(--ink)' }}>
                  <Save size={13} />
                  SAVE {results.updated.length} CHANGES TO DATABASE
                </button>
              )}
            </div>
          )}

          {results.notFound.length > 0 && (
            <div>
              <div className="font-cinzel text-xs tracking-widest mb-1" style={{ color: 'var(--crimson)' }}>
                NOT MATCHED
              </div>
              <div className="text-xs rounded-lg p-3"
                style={{ background: 'rgba(139,26,26,0.08)', border: '1px solid rgba(139,26,26,0.2)', color: 'var(--mid)' }}>
                {results.notFound.join(', ')}
              </div>
            </div>
          )}

          <button onClick={reset}
            className="w-full py-2 rounded text-xs font-cinzel tracking-widest"
            style={{ border: '1px solid var(--ep-border)', color: 'var(--mid)', background: 'none' }}>
            IMPORT ANOTHER FILE
          </button>
        </div>
      )}
    </div>
  );
}