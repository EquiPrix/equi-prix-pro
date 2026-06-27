import React, { useState, useEffect } from 'react';
import { GCL_TEAMS_2026, PREVIEW_RIDERS_2026, sbFetch } from '@/lib/equiprix-data';
import { ChevronDown, ChevronUp, Save, X } from 'lucide-react';

// ── TeamsEditor ───────────────────────────────────────────────────────────────
// Editable GCL team rosters — mirrors MlsjTeamsEditor structure exactly.
// Rosters default to GCL_TEAM_ROSTERS (hardcoded) but overrides are saved
// to results?event=gcl_rosters and merged on load so changes survive deploys.

const SUPABASE_KEY = 'gcl_rosters';

// Full 6-rider rosters — same data that was in the old TeamsEditor export.
export const GCL_TEAM_ROSTERS = {
  't01': [
    { id: 101, name: 'Henrik von Eckermann' }, { id: 121, name: 'Simon Delestre' },
    { id: 131, name: 'Abdel Saïd' },           { id: 141, name: 'Oliver Fletcher' },
    { id: 151, name: 'Hasan Şentürk' },        { id: 161, name: 'Efe Siyahi' },
  ],
  't02': [
    { id: 171, name: 'Zascha Nygaard' },       { id: 181, name: 'Andreas Schou' },
    { id: 116, name: 'Nicola Philippaerts' },  { id: 191, name: 'Olivier Philippaerts' },
    { id: 201, name: 'Géraldine Straumann' },  { id: 211, name: 'Marlon Modolo Zanotelli' },
  ],
  't03': [
    { id: 221, name: 'Thibeau Spits' },        { id: 231, name: 'Pieter Devos' },
    { id: 241, name: 'Niels Bruynseels' },     { id: 251, name: 'Anna Kellnerová' },
    { id: 261, name: 'Derin Demirsoy' },       { id: 271, name: 'Fernando Martinez Sommer' },
  ],
  't04': [
    { id: 103, name: 'Gilles Thomas' },        { id: 281, name: 'Edwina Tops-Alexander' },
    { id: 291, name: 'Thibault Philippaerts' },{ id: 301, name: 'Marcus Ehning' },
    { id: 311, name: 'Hans-Dieter Dreher' },   { id: 321, name: 'Lorenzo De Luca' },
  ],
  't05': [
    { id: 331, name: 'Jeanne Sadran' },        { id: 341, name: 'Antoine Ermann' },
    { id: 351, name: 'Jérôme Guery' },         { id: 361, name: 'Piergiorgio Bucci' },
    { id: 371, name: 'Nadja Peter Steiner' },  { id: 381, name: 'Kaitlin Campbell' },
  ],
  't06': [
    { id: 391, name: 'Peder Fredricson' },     { id: 401, name: 'Yuri Mansur' },
    { id: 411, name: 'Duarte Seabra' },        { id: 421, name: 'Gregory Cottard' },
    { id: 431, name: 'Iñigo Lopez de La Osa' },{ id: 441, name: 'Mariano Martinez Bastida' },
  ],
  't07': [
    { id: 124, name: 'Nayel Nassar' },         { id: 451, name: 'Dalma Malhas' },
    { id: 461, name: 'Inès Joly' },            { id: 471, name: 'Ismail El Borai' },
    { id: 481, name: 'Annelies Vorsselmans' }, { id: 491, name: 'Pim Mulder' },
  ],
  't08': [
    { id: 501, name: 'Philipp Weishaupt' },    { id: 105, name: 'Christian Kukuk' },
    { id: 511, name: 'Max Weishaupt' },        { id: 521, name: 'Emanuele Camilli' },
    { id: 531, name: 'Ciaran Nallon' },        { id: 541, name: 'Marco Kutscher' },
  ],
  't09': [
    { id: 551, name: 'Maikel van der Vleuten' },{ id: 561, name: 'Kim Emmen' },
    { id: 571, name: 'Eduardo Alvarez Aznar' }, { id: 581, name: 'Sergio Alvarez Moya' },
    { id: 591, name: 'Victor Bettendorf' },     { id: 601, name: 'Jack Whitaker' },
  ],
  't10': [
    { id: 611, name: 'Katrin Eckermann' },     { id: 621, name: 'Sophie Hinners' },
    { id: 631, name: 'Janne Meyer-Zimmermann' },{ id: 641, name: 'Jörne Sprehe' },
    { id: 651, name: 'Anastasia Nielsen' },    { id: 661, name: 'Angelica Augustsson Zanotelli' },
  ],
  't11': [
    { id: 102, name: 'Scott Brash' },          { id: 671, name: 'Bertram Allen' },
    { id: 681, name: 'Denis Lynch' },          { id: 691, name: 'Michael Pender' },
    { id: 701, name: 'Max Wachman' },          { id: 711, name: 'Georgina Bloomberg' },
  ],
  't12': [
    { id: 721, name: 'Jessica Mendoza' },      { id: 731, name: 'Sanne Thijssen' },
    { id: 741, name: 'Nathan Budd' },          { id: 751, name: 'Caroline Rehoff Pedersen' },
    { id: 761, name: 'Oliver Lazarus' },       { id: 771, name: 'Sheikh Ali Bin Khalid' },
  ],
  't13': [
    { id: 781, name: 'Daniel Deusser' },       { id: 104, name: 'Ben Maher' },
    { id: 791, name: 'Christian Ahlmann' },    { id: 801, name: 'Max Kühner' },
    { id: 811, name: 'Giacomo Casadei' },      { id: 821, name: 'Jane Richard' },
  ],
  't14': [
    { id: 831, name: 'Jur Vrieling' },         { id: 841, name: 'Sara Vingralkova' },
    { id: 851, name: 'Jorge Matte Capdevila' },{ id: 861, name: 'Lara Tryba' },
    { id: 871, name: 'Deirdre Reilly' },       { id: 881, name: 'Susan Fitzpatrick' },
  ],
  't15': [
    { id: 891, name: 'Carlos Hank Guerreiro' },{ id: 901, name: 'Zoe Hank Conter' },
    { id: 911, name: 'Eduardo Menezes' },      { id: 921, name: 'Niamh McEvoy' },
    { id: 931, name: 'Kendra Claricia Brinkop' },{ id: 941, name: 'Koen Vereecke' },
  ],
  't16': [
    { id: 951, name: "Cian O'Connor" },        { id: 961, name: 'Emanuele Gaudiano' },
    { id: 971, name: 'Tom Wachman' },          { id: 981, name: 'Rodrigo Gesteira Almeida' },
    { id: 991, name: 'Olivier Perreau' },      { id: 992, name: 'Mathijs Van Asten' },
  ],
  't17': [
    { id: 993, name: 'Guido Grimaldi' },       { id: 994, name: 'Jennifer Hochstaedter' },
    { id: 995, name: 'Yali Kass' },            { id: 996, name: 'Clara Pezzoli' },
    { id: 997, name: 'Ioli Mytilineou' },      { id: 998, name: 'Luiz Felipe Neto' },
  ],
};

// All riders available to pick from — PREVIEW_RIDERS_2026 is the shared pool
const ALL_RIDERS = [...PREVIEW_RIDERS_2026].sort((a, b) => {
  const ra = a.rank >= 999 ? 9999 : a.rank;
  const rb = b.rank >= 999 ? 9999 : b.rank;
  return ra - rb;
});

export default function TeamsEditor() {
  // rosters: { [teamId]: [{ id, name }] } — up to 6 per team
  const [rosters, setRosters] = useState(() => {
    const init = {};
    GCL_TEAMS_2026.forEach(t => { init[t.id] = [...(GCL_TEAM_ROSTERS[t.id] || [])]; });
    return init;
  });
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [search, setSearch]     = useState({}); // { [teamId]: string }

  // Load saved overrides from Supabase
  useEffect(() => {
    sbFetch('results?event=eq.' + SUPABASE_KEY + '&limit=1').then(rows => {
      if (rows && rows.length && rows[0].team_results) {
        const savedRosters = rows[0].team_results; // { [teamId]: [{ id, name }] }
        setRosters(prev => {
          const merged = { ...prev };
          Object.entries(savedRosters).forEach(([teamId, riders]) => {
            if (riders && riders.length) merged[teamId] = riders;
          });
          return merged;
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const toggleRider = (teamId, rider) => {
    setRosters(prev => {
      const current = prev[teamId] || [];
      const has = current.some(r => r.id === rider.id);
      if (has) return { ...prev, [teamId]: current.filter(r => r.id !== rider.id) };
      if (current.length >= 6) return prev;
      return { ...prev, [teamId]: [...current, { id: rider.id, name: rider.name }] };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      // Sync back into GCL_TEAM_ROSTERS in memory
      Object.entries(rosters).forEach(([teamId, riders]) => {
        GCL_TEAM_ROSTERS[teamId] = riders;
      });

      const existing = await sbFetch('results?event=eq.' + SUPABASE_KEY + '&limit=1');
      if (existing && existing.length > 0) {
        await sbFetch('results?event=eq.' + SUPABASE_KEY, {
          method: 'PATCH',
          body: JSON.stringify({
            team_results: rosters,
            updated_at: new Date().toISOString(),
          }),
        });
      } else {
        await sbFetch('results', {
          method: 'POST',
          body: JSON.stringify({
            event: SUPABASE_KEY,
            team_results: rosters,
            updated_at: new Date().toISOString(),
          }),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('GCL rosters save error:', e);
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="text-center py-8 font-cormorant italic" style={{ color: 'var(--mid)' }}>
      Loading rosters…
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>
        GCL TEAMS 2026
      </h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Edit each team's 6-rider roster. Changes persist here — no redeploy needed.
      </p>

      <div className="space-y-2 mb-4">
        {[...GCL_TEAMS_2026].sort((a, b) => (Number(a.rank) || 99) - (Number(b.rank) || 99)).map(team => {
          const open        = expanded[team.id];
          const roster      = rosters[team.id] || [];
          const rosterCount = roster.length;
          const teamSearch  = search[team.id] || '';

          return (
            <div key={team.id} className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--ep-border)' }}>

              {/* Header */}
              <button
                onClick={() => setExpanded(p => ({ ...p, [team.id]: !p[team.id] }))}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                style={{ background: open ? 'rgba(180,149,48,0.06)' : 'rgba(255,255,255,0.01)' }}>
                <span className="font-cinzel text-xs w-5 text-center flex-shrink-0"
                  style={{ color: 'var(--gold)' }}>{team.rank}</span>
                <span className="flex-1 font-cormorant text-sm font-semibold"
                  style={{ color: 'var(--cream)' }}>{team.name}</span>
                <span className="font-cinzel text-xs px-2 py-0.5 rounded"
                  style={{
                    background: rosterCount === 6 ? 'rgba(76,175,125,0.12)' : 'rgba(180,149,48,0.1)',
                    color: rosterCount === 6 ? '#4caf7d' : 'var(--gold)',
                    fontSize: 9,
                  }}>
                  {rosterCount}/6
                </span>
                {open
                  ? <ChevronUp size={13} style={{ color: 'var(--mid)', flexShrink: 0 }} />
                  : <ChevronDown size={13} style={{ color: 'var(--mid)', flexShrink: 0 }} />}
              </button>

              {open && (
                <div className="px-3 pb-3 pt-2"
                  style={{ borderTop: '1px solid var(--ep-border)', background: '#0d0c09' }}>

                  {/* Current roster chips */}
                  {roster.length > 0 && (
                    <div className="mb-3">
                      <div className="font-cinzel text-xs mb-1.5"
                        style={{ color: 'var(--gold)', fontSize: 9, letterSpacing: '0.1em' }}>
                        CURRENT ROSTER
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {roster.map(r => (
                          <div key={r.id}
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-cormorant"
                            style={{ background: 'rgba(180,149,48,0.1)', border: '1px solid rgba(180,149,48,0.3)', color: 'var(--gold-lt)' }}>
                            {r.name}
                            <button onClick={() => toggleRider(team.id, r)}
                              style={{ color: 'var(--mid)', marginLeft: 2 }}>
                              <X size={9} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rider picker */}
                  {rosterCount < 6 && (
                    <div>
                      <div className="font-cinzel text-xs mb-1.5"
                        style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.1em' }}>
                        ADD RIDER ({6 - rosterCount} slot{6 - rosterCount !== 1 ? 's' : ''} remaining)
                      </div>
                      <input
                        value={teamSearch}
                        onChange={e => setSearch(p => ({ ...p, [team.id]: e.target.value }))}
                        placeholder="Search rider…"
                        className="w-full rounded px-2 py-1.5 text-xs outline-none mb-1.5"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)' }}
                      />
                      <div className="rounded-lg overflow-hidden"
                        style={{ border: '1px solid var(--ep-border)', maxHeight: 200, overflowY: 'auto' }}>
                        {ALL_RIDERS
                          .filter(r => !roster.some(x => x.id === r.id))
                          .filter(r => !teamSearch || r.name.toLowerCase().includes(teamSearch.toLowerCase()))
                          .filter(r => !Object.entries(rosters).some(([tid, rs]) => tid !== team.id && rs.some(x => x.id === r.id)))
                          .map((r, i, arr) => (
                            <button key={r.id} onClick={() => toggleRider(team.id, r)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all"
                              style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(42,40,32,0.3)' : 'none', background: 'transparent' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(180,149,48,0.06)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <span className="font-cormorant text-sm flex-1"
                                style={{ color: 'var(--cream)' }}>{r.name}</span>
                              <span className="font-cinzel text-xs"
                                style={{ color: 'var(--mid)', fontSize: 9 }}>
                                #{r.rank >= 999 ? '—' : r.rank}
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {rosterCount === 6 && (
                    <p className="font-cormorant italic text-xs" style={{ color: '#4caf7d' }}>
                      ✓ Roster full — remove a rider to swap.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-3 rounded font-cinzel text-xs tracking-widest flex items-center justify-center gap-2 sticky bottom-4"
        style={{
          background: saved ? 'rgba(76,175,125,0.2)' : 'var(--gold)',
          color:      saved ? '#4caf7d' : 'var(--ink)',
          border:     saved ? '1px solid #4caf7d' : 'none',
        }}>
        <Save size={13} />
        {saved ? 'SAVED ✓' : saving ? 'SAVING…' : 'SAVE ROSTERS'}
      </button>
    </div>
  );
}