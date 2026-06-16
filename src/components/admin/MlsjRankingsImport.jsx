import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { MLSJ_PREVIEW_RIDERS, rankToSalary, sbFetch } from '@/lib/mlsj-data';
import { Upload, Loader2 } from 'lucide-react';

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

function buildResults(extracted) {
  const updated = [];
  const notFound = [];
  for (const rider of MLSJ_PREVIEW_RIDERS) {
    let newRank = extracted[rider.name];
    if (!newRank) {
      const key = Object.keys(extracted).find(k =>
        k.toLowerCase() === rider.name.toLowerCase() ||
        rider.name.toLowerCase().includes(k.toLowerCase().split(' ').pop())
      );
      if (key) newRank = extracted[key];
    }
    if (newRank && newRank !== rider.rank) {
      updated.push({ id: rider.id, name: rider.name, oldRank: rider.rank, newRank, oldSalary: rider.salary, newSalary: rankToSalary(newRank) });
    } else if (!newRank) {
      notFound.push(rider.name);
    }
  }
  return { updated, notFound };
}

export default function MlsjRankingsImport() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState(null);
  const [status, setStatus] = useState('idle');
  const [results, setResults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setMode(f.name.endsWith('.csv') ? 'csv' : 'pdf');
    setStatus('idle');
    setResults(null);
  };

  const handleImport = async () => {
    if (!file) return;

    if (mode === 'csv') {
      setStatus('parsing');
      const text = await file.text();
      const extracted = parseCsv(text);
      const { updated, notFound } = buildResults(extracted);
      setResults({ updated, notFound });
      setStatus('done');
      return;
    }

    setStatus('uploading');
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setStatus('parsing');
    const riderNames = MLSJ_PREVIEW_RIDERS.map(r => r.name).join(', ');
    const extracted = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract FEI Longines World Rankings from this PDF. Find the world ranking number for each of these riders (allow slight name variations): ${riderNames}. Return a JSON object: {"Rider Name": rankNumber, ...}. Use null if not found.`,
      file_urls: [file_url],
      response_json_schema: { type: 'object', additionalProperties: { type: ['integer', 'null'] } }
    });
    const { updated, notFound } = buildResults(extracted);
    setResults({ updated, notFound });
    setStatus('done');
  };

  // Unlike GCL's RankingsImport (which produces a copy-paste snippet for
  // equiprix-data.js), this writes directly to Supabase since MLSJ riders
  // don't live in a hand-edited source file the same way — they're seeded
  // once in mlsj-data.js and then kept current via this shared rankings row.
  const applyChanges = async () => {
    if (!results?.updated?.length) return;
    setSaving(true);
    try {
      const gp_riders = results.updated.map(r => ({ id: r.id, rank: r.newRank, salary: r.newSalary }));
      await sbFetch('results', {
        method: 'POST',
        body: JSON.stringify({
          event: 'mlsj_rankings',
          gp_riders,
          updated_at: new Date().toISOString(),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('MLSJ rankings save error:', e);
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>IMPORT MLSJ RANKINGS</h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Upload FEI Rankings as a <strong style={{ color: 'var(--ep-text)' }}>CSV</strong> (rank, name, country) or <strong style={{ color: 'var(--ep-text)' }}>PDF</strong>. Updates rank/salary for the 48 MLSJ roster riders.
      </p>

      <div className="rounded-lg p-3 mb-4 text-xs font-mono" style={{ background: '#0a0907', border: '1px solid var(--ep-border)', color: '#9fead4' }}>
        CSV format: <span style={{ color: 'var(--gold-lt)' }}>rank,name,country</span><br />
        1,Kent Farrington,USA<br />
        2,Mclain Ward,USA
      </div>

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
        <input type="file" accept=".pdf,.csv" onChange={handleFileChange} className="hidden" />
      </label>

      {file && status === 'idle' && (
        <button onClick={handleImport} className="w-full py-3 rounded font-cinzel text-xs tracking-widest" style={{ background: 'var(--gold)', color: 'var(--ink)' }}>
          EXTRACT RANKINGS →
        </button>
      )}

      {(status === 'uploading' || status === 'parsing') && (
        <div className="flex items-center gap-3 py-4 justify-center">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--gold)' }} />
          <span className="font-cormorant text-base italic" style={{ color: 'var(--mid)' }}>
            {status === 'uploading' ? 'Uploading…' : mode === 'pdf' ? 'AI extracting rankings…' : 'Parsing CSV…'}
          </span>
        </div>
      )}

      {status === 'done' && results && (
        <div className="mt-2 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg p-3 text-center" style={{ background: 'rgba(76,175,125,0.1)', border: '1px solid rgba(76,175,125,0.3)' }}>
              <div className="font-cinzel text-xl" style={{ color: '#4caf7d' }}>{results.updated.length}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--mid)' }}>Changes found</div>
            </div>
            <div className="flex-1 rounded-lg p-3 text-center" style={{ background: 'rgba(139,26,26,0.1)', border: '1px solid rgba(139,26,26,0.3)' }}>
              <div className="font-cinzel text-xl" style={{ color: 'var(--crimson)' }}>{results.notFound.length}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--mid)' }}>Not matched</div>
            </div>
          </div>

          {results.updated.length > 0 && (
            <div>
              <div className="font-cinzel text-xs tracking-widest mb-2" style={{ color: 'var(--gold)' }}>RANKING CHANGES</div>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ep-border)', maxHeight: 280, overflowY: 'auto' }}>
                {results.updated.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2 text-xs" style={{
                    borderBottom: i < results.updated.length - 1 ? '1px solid var(--ep-border)' : 'none',
                    background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'
                  }}>
                    <span className="flex-1 font-cormorant text-sm" style={{ color: 'var(--cream)' }}>{r.name}</span>
                    <span style={{ color: 'var(--mid)' }}>#{r.oldRank} →</span>
                    <span style={{ color: r.newRank < r.oldRank ? '#4caf7d' : 'var(--crimson)' }}>#{r.newRank}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(180,149,48,0.1)', color: 'var(--gold)', fontSize: 9 }}>
                      ${r.newSalary.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <button onClick={applyChanges} disabled={saving}
                className="mt-2 w-full py-2.5 rounded font-cinzel text-xs tracking-widest transition-all"
                style={{ background: saved ? 'rgba(76,175,125,0.15)' : 'var(--gold)', color: saved ? '#4caf7d' : 'var(--ink)', border: saved ? '1px solid #4caf7d' : 'none' }}>
                {saved ? '✓ APPLIED' : saving ? 'SAVING…' : 'APPLY TO SUPABASE'}
              </button>
            </div>
          )}

          {results.notFound.length > 0 && (
            <div>
              <div className="font-cinzel text-xs tracking-widest mb-1" style={{ color: 'var(--crimson)' }}>NOT MATCHED</div>
              <div className="text-xs rounded-lg p-3" style={{ background: 'rgba(139,26,26,0.08)', border: '1px solid rgba(139,26,26,0.2)', color: 'var(--mid)' }}>
                {results.notFound.join(', ')}
              </div>
            </div>
          )}

          <button onClick={() => { setFile(null); setStatus('idle'); setResults(null); setMode(null); }}
            className="w-full py-2 rounded text-xs font-cinzel tracking-widest"
            style={{ border: '1px solid var(--ep-border)', color: 'var(--mid)', background: 'none' }}>
            IMPORT ANOTHER FILE
          </button>
        </div>
      )}
    </div>
  );
}