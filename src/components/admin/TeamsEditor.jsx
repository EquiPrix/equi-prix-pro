import React, { useState, useEffect, useMemo } from 'react';
import { GCL_TEAMS_2026, PREVIEW_RIDERS_2026, sbFetch } from '@/lib/equiprix-data';
import { ChevronDown, ChevronUp, Save, X } from 'lucide-react';

// ── TeamsEditor ───────────────────────────────────────────────────────────────
// Editable GCL team rosters — mirrors MlsjTeamsEditor structure exactly.
// Rosters default to GCL_TEAM_ROSTERS (hardcoded) but overrides are saved
// to results?event=gcl_rosters and merged on load so changes survive deploys.

const SUPABASE_KEY = 'gcl_rosters';

// Full 6-rider rosters — ids re-synced to match PREVIEW_RIDERS_2026's current
// unified id sequence (matched by name). The previous ids here were left over
// from before the master rider list was renumbered, so they no longer pointed
// at the right riders — that mismatch was blocking correct riders from
// appearing in the "add rider" picker below.
export const GCL_TEAM_ROSTERS = {
  't01': [
    { id: 101, name: "Henrik von Eckermann" },
    { id: 109, name: "Simon Delestre" },
    { id: 202, name: "Abdel Saïd" },
    { id: 189, name: "Oliver Fletcher" },
    { id: 190, name: "Hasan Şentürk" },
    { id: 191, name: "Efe Siyahi" },
  ],
  't02': [
    { id: 136, name: "Zascha Nygaard" },
    { id: 137, name: "Andreas Schou" },
    { id: 116, name: "Nicola Philippaerts" },
    { id: 117, name: "Olivier Philippaerts" },
    { id: 188, name: "Géraldine Straumann" },
    { id: 177, name: "Marlon Modolo Zanotelli" },
  ],
  't03': [
    { id: 146, name: "Thibeau Spits" },
    { id: 112, name: "Pieter Devos" },
    { id: 127, name: "Niels Bruynseels" },
    { id: 180, name: "Anna Kellnerová" },
    { id: 195, name: "Derin Demirsoy" },
    { id: 196, name: "Fernando Martinez Sommer" },
  ],
  't04': [
    { id: 103, name: "Gilles Thomas" },
    { id: 120, name: "Edwina Tops-Alexander" },
    { id: 113, name: "Thibault Philippaerts" },
    { id: 114, name: "Marcus Ehning" },
    { id: 126, name: "Hans-Dieter Dreher" },
    { id: 118, name: "Lorenzo De Luca" },
  ],
  't05': [
    { id: 148, name: "Jeanne Sadran" },
    { id: 149, name: "Antoine Ermann" },
    { id: 125, name: "Jérôme Guery" },
    { id: 176, name: "Piergiorgio Bucci" },
    { id: 175, name: "Nadja Peter Steiner" },
    { id: 168, name: "Kaitlin Campbell" },
  ],
  't06': [
    { id: 106, name: "Peder Fredricson" },
    { id: 151, name: "Yuri Mansur" },
    { id: 138, name: "Duarte Seabra" },
    { id: 135, name: "Gregory Cottard" },
    { id: 179, name: "Iñigo Lopez de La Osa" },
    { id: 200, name: "Mariano Martinez Bastida" },
  ],
  't07': [
    { id: 124, name: "Nayel Nassar" },
    { id: 158, name: "Dalma Malhas" },
    { id: 160, name: "Inès Joly" },
    { id: 201, name: "Ismail El Borai" },
    { id: 178, name: "Annelies Vorsselmans" },
    { id: 144, name: "Pim Mulder" },
  ],
  't08': [
    { id: 108, name: "Philipp Weishaupt" },
    { id: 105, name: "Christian Kukuk" },
    { id: 132, name: "Max Weishaupt" },
    { id: 123, name: "Emanuele Camilli" },
    { id: 130, name: "Ciaran Nallon" },
    { id: 129, name: "Marco Kutscher" },
  ],
  't09': [
    { id: 107, name: "Maikel van der Vleuten" },
    { id: 140, name: "Kim Emmen" },
    { id: 119, name: "Eduardo Alvarez Aznar" },
    { id: 143, name: "Sergio Alvarez Moya" },
    { id: 147, name: "Victor Bettendorf" },
    { id: 153, name: "Jack Whitaker" },
  ],
  't10': [
    { id: 121, name: "Katrin Eckermann" },
    { id: 185, name: "Sophie Hinners" },
    { id: 122, name: "Janne Meyer-Zimmermann" },
    { id: 134, name: "Jörne Sprehe" },
    { id: 133, name: "Anastasia Nielsen" },
    { id: 139, name: "Angelica Augustsson Zanotelli" },
  ],
  't11': [
    { id: 102, name: "Scott Brash" },
    { id: 111, name: "Bertram Allen" },
    { id: 166, name: "Denis Lynch" },
    { id: 164, name: "Michael Pender" },
    { id: 162, name: "Max Wachman" },
    { id: 192, name: "Georgina Bloomberg" },
  ],
  't12': [
    { id: 141, name: "Jessica Mendoza" },
    { id: 142, name: "Sanne Thijssen" },
    { id: 159, name: "Nathan Budd" },
    { id: 173, name: "Caroline Rehoff Pedersen" },
    { id: 193, name: "Oliver Lazarus" },
    { id: 194, name: "Sheikh Ali Bin Khalid" },
  ],
  't13': [
    { id: 110, name: "Daniel Deusser" },
    { id: 104, name: "Ben Maher" },
    { id: 115, name: "Christian Ahlmann" },
    { id: 128, name: "Max Kühner" },
    { id: 150, name: "Giacomo Casadei" },
    { id: 145, name: "Jane Richard" },
  ],
  't14': [
    { id: 131, name: "Jur Vrieling" },
    { id: 154, name: "Sara Vingralkova" },
    { id: 167, name: "Jorge Matte Capdevila" },
    { id: 174, name: "Lara Tryba" },
    { id: 186, name: "Deirdre Reilly" },
    { id: 187, name: "Susan Fitzpatrick" },
  ],
  't15': [
    { id: 152, name: "Carlos Hank Guerreiro" },
    { id: 163, name: "Zoe Hank Conter" },
    { id: 165, name: "Eduardo Menezes" },
    { id: 183, name: "Niamh McEvoy" },
    { id: 184, name: "Kendra Claricia Brinkop" },
    { id: 161, name: "Koen Vereecke" },
  ],
  't16': [
    { id: 155, name: "Cian O'Connor" },
    { id: 156, name: "Emanuele Gaudiano" },
    { id: 157, name: "Tom Wachman" },
    { id: 172, name: "Rodrigo Gesteira Almeida" },
    { id: 181, name: "Olivier Perreau" },
    { id: 182, name: "Mathijs Van Asten" },
  ],
  't17': [
    { id: 170, name: "Guido Grimaldi" },
    { id: 169, name: "Jennifer Hochstaedter" },
    { id: 197, name: "Yali Kass" },
    { id: 198, name: "Clara Pezzoli" },
    { id: 199, name: "Ioli Mytilineou" },
    { id: 171, name: "Luiz Felipe Neto" },
  ],
};

// FIXED: this is now the single source of truth for "what are this team's
// current riders right now" — GCL_TEAM_ROSTERS defaults merged with any
// saved Supabase overrides. Previously StartListEditor imported the raw
// GCL_TEAM_ROSTERS constant directly. That constant only reflects saved
// overrides if THIS component's save() already ran earlier in the SAME
// browser session (save() patches the constant in memory as a side
// effect) — a fresh page load, a different device, or just opening Start
// Lists without visiting Teams first in that session never pulled the
// saved overrides back in, so an edited roster silently reverted to the
// hardcoded defaults when setting up a later event's start list (e.g.
// Valkenswaard) — exactly the "rosters aren't loading to the next event"
// symptom. Both this editor and StartListEditor now call this function
// instead of trusting the static import.
export async function loadGCLRostersRemote() {
  const merged = {};
  GCL_TEAMS_2026.forEach(t => { merged[t.id] = [...(GCL_TEAM_ROSTERS[t.id] || [])]; });
  try {
    const rows = await sbFetch('results?event=eq.' + SUPABASE_KEY + '&limit=1');
    if (rows && rows.length && rows[0].team_results) {
      Object.entries(rows[0].team_results).forEach(([teamId, riders]) => {
        if (riders && riders.length) merged[teamId] = riders;
      });
    }
  } catch (e) {
    console.warn('Could not load saved GCL rosters:', e);
  }
  return merged;
}

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

  // All riders available to pick from — pulled live from the Supabase
  // `riders` table (same table RankingsImport upserts into on every FEI
  // rankings CSV upload), not the static PREVIEW_RIDERS_2026 array, which
  // is just a ~170-rider fallback seed and never grows when new riders are
  // imported. PREVIEW_RIDERS_2026 is used only as an initial placeholder so
  // the picker isn't empty for the instant before the live fetch resolves.
  const [allRiders, setAllRiders]     = useState(() => [...PREVIEW_RIDERS_2026]);
  const [ridersLoading, setRidersLoading] = useState(true);

  useEffect(() => {
    sbFetch('riders?order=rank.asc&limit=5000').then(rows => {
      if (rows && rows.length) {
        setAllRiders(rows.map(r => ({
          ...r,
          id:     Number(r.id),
          rank:   Number(r.rank)   || 999,
          salary: Number(r.salary) || 1000,
        })));
      }
      setRidersLoading(false);
    }).catch(() => setRidersLoading(false));
  }, []);

  const ALL_RIDERS = useMemo(() => [...allRiders].sort((a, b) => {
    const ra = a.rank >= 999 ? 9999 : a.rank;
    const rb = b.rank >= 999 ? 9999 : b.rank;
    return ra - rb;
  }), [allRiders]);

  // Load saved overrides from Supabase (merged with defaults by the same
  // function StartListEditor now uses, so the two never drift apart).
  useEffect(() => {
    loadGCLRostersRemote()
      .then(merged => setRosters(merged))
      .finally(() => setLoading(false));
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

  if (loading || ridersLoading) return (
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