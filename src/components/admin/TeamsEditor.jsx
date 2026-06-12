import React, { useState } from 'react';
import { GCL_TEAMS_2026, PREVIEW_RIDERS_2026 } from '@/lib/equiprix-data';
import { ChevronDown, ChevronUp, Plus, X, Database } from 'lucide-react';

// Persistent horse DB: { [riderName]: [horse1, horse2, ...] }
const HORSES_KEY = 'equiprix_horse_db';

function loadHorseDB() {
  try { return JSON.parse(localStorage.getItem(HORSES_KEY) || '{}'); } catch { return {}; }
}

function saveHorseDB(db) {
  localStorage.setItem(HORSES_KEY, JSON.stringify(db));
}

function HorseSelect({ riderName, value, onChange, horseDB, onAddHorse }) {
  const [newHorse, setNewHorse] = useState('');
  const [adding, setAdding] = useState(false);
  const horses = horseDB[riderName] || [];

  const handleAdd = () => {
    if (!newHorse.trim()) return;
    onAddHorse(riderName, newHorse.trim());
    onChange(newHorse.trim());
    setNewHorse('');
    setAdding(false);
  };

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="flex-1 rounded px-2 py-1 text-xs outline-none min-w-0"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--ep-border)',
          color: value ? 'var(--gold-lt)' : 'var(--mid)',
          fontStyle: value ? 'italic' : 'normal'
        }}
      >
        <option value="">— horse —</option>
        {horses.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={newHorse}
            onChange={e => setNewHorse(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Horse name"
            className="rounded px-2 py-1 text-xs outline-none"
            style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.3)', color: 'var(--ep-text)', width: 110 }}
          />
          <button onClick={handleAdd} className="text-xs px-1.5 py-1 rounded" style={{ background: 'rgba(180,149,48,0.15)', color: 'var(--gold)' }}>✓</button>
          <button onClick={() => setAdding(false)} style={{ color: 'var(--mid)' }}><X size={11} /></button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} title="Add horse to database"
          className="flex-shrink-0 p-1 rounded transition-all"
          style={{ color: 'var(--mid)', border: '1px solid var(--ep-border)' }}>
          <Plus size={10} />
        </button>
      )}
    </div>
  );
}

function RiderPicker({ label, riderName, horse, teamRiders, onRiderChange, onHorseChange, horseDB, onAddHorse }) {
  return (
    <div className="flex items-center gap-2 py-1.5 flex-wrap">
      <span className="font-cinzel text-xs flex-shrink-0" style={{ color: 'var(--mid)', fontSize: 9, width: 16 }}>{label}</span>
      <select
        value={riderName || ''}
        onChange={e => { onRiderChange(e.target.value); onHorseChange(''); }}
        className="rounded px-2 py-1 text-xs outline-none flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ep-border)', color: 'var(--ep-text)', width: 170 }}
      >
        <option value="">— rider —</option>
        {teamRiders.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
      </select>
      {riderName && (
        <HorseSelect
          riderName={riderName}
          value={horse}
          onChange={onHorseChange}
          horseDB={horseDB}
          onAddHorse={onAddHorse}
        />
      )}
    </div>
  );
}

export default function TeamsEditor() {
  const [horseDB, setHorseDB] = useState(loadHorseDB);
  const [expanded, setExpanded] = useState({});
  const [teamPairs, setTeamPairs] = useState({});

  const addHorse = (riderName, horse) => {
    if (!riderName || !horse) return;
    const db = { ...horseDB };
    if (!db[riderName]) db[riderName] = [];
    if (!db[riderName].includes(horse)) {
      db[riderName] = [...db[riderName], horse];
      setHorseDB(db);
      saveHorseDB(db);
    }
  };

  const removeHorse = (riderName, horse) => {
    const db = { ...horseDB };
    db[riderName] = (db[riderName] || []).filter(h => h !== horse);
    setHorseDB(db);
    saveHorseDB(db);
  };

  const getRound = (teamId, round) =>
    teamPairs[teamId]?.[round] || [{ name: '', horse: '' }, { name: '', horse: '' }];

  const setRoundRider = (teamId, round, idx, field, value) => {
    setTeamPairs(prev => {
      const base = prev[teamId]?.[round] || [{ name: '', horse: '' }, { name: '', horse: '' }];
      const arr = base.map((r, i) => i === idx ? { ...r, [field]: value } : r);
      return { ...prev, [teamId]: { ...(prev[teamId] || {}), [round]: arr } };
    });
  };

  const totalHorses = Object.values(horseDB).flat().length;

  return (
    <div className="max-w-2xl">
      <h2 className="font-cinzel text-sm tracking-widest mb-1" style={{ color: 'var(--gold)' }}>GCL TEAMS 2026</h2>
      <p className="font-cormorant text-base italic mb-4" style={{ color: 'var(--mid)' }}>
        Select 2 riders + horses per team per round. Horse names build up in a persistent database per rider.
      </p>

      {/* Horse DB panel */}
      <details className="mb-4 rounded-lg overflow-hidden" style={{ border: '1px solid var(--ep-border)' }}>
        <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
          style={{ background: 'rgba(180,149,48,0.04)' }}>
          <Database size={12} style={{ color: 'var(--gold)' }} />
          <span className="font-cinzel text-xs tracking-widest" style={{ color: 'var(--gold)' }}>HORSE DATABASE</span>
          <span className="ml-auto text-xs" style={{ color: 'var(--mid)' }}>{totalHorses} horses</span>
        </summary>
        <div className="px-3 py-3 space-y-2.5 max-h-64 overflow-y-auto" style={{ background: '#0d0c09' }}>
          {totalHorses === 0 && (
            <p className="text-xs font-cormorant italic" style={{ color: 'var(--mid)' }}>
              No horses yet — click <strong style={{ color: 'var(--gold)' }}>+</strong> next to a horse selector to add one.
            </p>
          )}
          {Object.entries(horseDB).filter(([, h]) => h.length > 0).map(([rider, horses]) => (
            <div key={rider}>
              <div className="font-cormorant text-xs font-semibold mb-1" style={{ color: 'var(--cream)' }}>{rider}</div>
              <div className="flex flex-wrap gap-1">
                {horses.map(h => (
                  <span key={h} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                    style={{ background: 'rgba(180,149,48,0.08)', border: '1px solid rgba(180,149,48,0.2)', color: 'var(--gold-lt)' }}>
                    <span className="italic">{h}</span>
                    <button onClick={() => removeHorse(rider, h)} style={{ color: 'var(--mid)' }}><X size={9} /></button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </details>

      {/* Teams list */}
      <div className="space-y-2">
        {GCL_TEAMS_2026.map(team => {
          const open = expanded[team.id];
          const teamRiders = GCL_TEAM_ROSTERS[team.id] || [];
          const r1 = getRound(team.id, 'r1');
          const r2 = getRound(team.id, 'r2');
          const r1Set = r1[0].name || r1[1].name;
          const r2Set = r2[0].name || r2[1].name;

          return (
            <div key={team.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ep-border)' }}>
              <button
                onClick={() => setExpanded(p => ({ ...p, [team.id]: !p[team.id] }))}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
                style={{ background: open ? 'rgba(180,149,48,0.06)' : 'rgba(255,255,255,0.01)' }}
              >
                <span className="font-cinzel text-xs w-5 flex-shrink-0 text-center" style={{ color: 'var(--gold)' }}>
                  {team.rank}
                </span>
                <span className="flex-1 font-cormorant text-sm font-semibold" style={{ color: 'var(--cream)' }}>
                  {team.name}
                </span>
                <div className="flex gap-1.5 text-xs mr-1">
                  {r1Set && <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(180,149,48,0.1)', color: 'var(--gold)', fontSize: 9 }}>R1✓</span>}
                  {r2Set && <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(61,90,76,0.15)', color: '#6aad8a', fontSize: 9 }}>R2✓</span>}
                </div>
                {open ? <ChevronUp size={13} style={{ color: 'var(--mid)', flexShrink: 0 }} /> : <ChevronDown size={13} style={{ color: 'var(--mid)', flexShrink: 0 }} />}
              </button>

              {open && (
                <div className="px-3 pb-3 pt-2 space-y-3" style={{ borderTop: '1px solid var(--ep-border)', background: '#0d0c09' }}>
                  {/* Squad chips */}
                  <div>
                    <div className="font-cinzel mb-1.5" style={{ color: 'var(--mid)', fontSize: 9, letterSpacing: '0.1em' }}>
                      SQUAD · {teamRiders.length} RIDERS
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {teamRiders.map(r => (
                        <span key={r.name} className="text-xs px-2 py-0.5 rounded-full font-cormorant"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(42,40,32,0.8)', color: 'var(--ep-text)' }}>
                          {r.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Round 1 */}
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(180,149,48,0.03)', border: '1px solid rgba(180,149,48,0.15)' }}>
                    <div className="font-cinzel mb-1" style={{ color: 'var(--gold)', fontSize: 9, letterSpacing: '0.1em' }}>
                      ROUND 1 — 2 COMPETING RIDERS
                    </div>
                    {[0, 1].map(idx => (
                      <RiderPicker
                        key={idx}
                        label={idx === 0 ? 'A' : 'B'}
                        riderName={r1[idx]?.name}
                        horse={r1[idx]?.horse}
                        teamRiders={teamRiders}
                        onRiderChange={v => setRoundRider(team.id, 'r1', idx, 'name', v)}
                        onHorseChange={v => setRoundRider(team.id, 'r1', idx, 'horse', v)}
                        horseDB={horseDB}
                        onAddHorse={addHorse}
                      />
                    ))}
                  </div>

                  {/* Round 2 */}
                  <div className="rounded-lg px-3 py-2.5" style={{ background: 'rgba(61,90,76,0.04)', border: '1px solid rgba(61,90,76,0.2)' }}>
                    <div className="font-cinzel mb-1" style={{ color: '#6aad8a', fontSize: 9, letterSpacing: '0.1em' }}>
                      ROUND 2 — 2 COMPETING RIDERS
                    </div>
                    {[0, 1].map(idx => (
                      <RiderPicker
                        key={idx}
                        label={idx === 0 ? 'A' : 'B'}
                        riderName={r2[idx]?.name}
                        horse={r2[idx]?.horse}
                        teamRiders={teamRiders}
                        onRiderChange={v => setRoundRider(team.id, 'r2', idx, 'name', v)}
                        onHorseChange={v => setRoundRider(team.id, 'r2', idx, 'horse', v)}
                        horseDB={horseDB}
                        onAddHorse={addHorse}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Full 6-rider rosters sourced from GCL 2026 official lineup
export const GCL_TEAM_ROSTERS = {
  't01': [ // Istanbul Warriors
    { name: 'Henrik von Eckermann' }, { name: 'Simon Delestre' }, { name: 'Abdel Saïd' },
    { name: 'Oliver Fletcher' }, { name: 'Hasan Şentürk' }, { name: 'Efe Siyahi' },
  ],
  't02': [ // Basel Cosmopolitans
    { name: 'Zascha Nygaard' }, { name: 'Andreas Schou' }, { name: 'Nicola Philippaerts' },
    { name: 'Olivier Philippaerts' }, { name: 'Géraldine Straumann' }, { name: 'Marlon Modolo Zanotelli' },
  ],
  't03': [ // Prague Lions
    { name: 'Thibeau Spits' }, { name: 'Pieter Devos' }, { name: 'Niels Bruynseels' },
    { name: 'Anna Kellnerová' }, { name: 'Derin Demirsoy' }, { name: 'Fernando Martinez Sommer' },
  ],
  't04': [ // Valkenswaard United
    { name: 'Gilles Thomas' }, { name: 'Edwina Tops-Alexander' }, { name: 'Thibault Philippaerts' },
    { name: 'Marcus Ehning' }, { name: 'Hans-Dieter Dreher' }, { name: 'Lorenzo De Luca' },
  ],
  't05': [ // St. Tropez Pirates
    { name: 'Jeanne Sadran' }, { name: 'Antoine Ermann' }, { name: 'Jérôme Guery' },
    { name: 'Piergiorgio Bucci' }, { name: 'Nadja Peter Steiner' }, { name: 'Kaitlin Campbell' },
  ],
  't06': [ // Monaco Aces
    { name: 'Peder Fredricson' }, { name: 'Yuri Mansur' }, { name: 'Duarte Seabra' },
    { name: 'Gregory Cottard' }, { name: 'Iñigo Lopez de La Osa' }, { name: 'Mariano Martinez Bastida' },
  ],
  't07': [ // Cairo Pharaohs
    { name: 'Nayel Nassar' }, { name: 'Dalma Malhas' }, { name: 'Inès Joly' },
    { name: 'Ismail El Borai' }, { name: 'Annelies Vorsselmans' }, { name: 'Pim Mulder' },
  ],
  't08': [ // Riesenbeck International
    { name: 'Philipp Weishaupt' }, { name: 'Christian Kukuk' }, { name: 'Max Weishaupt' },
    { name: 'Emanuele Camilli' }, { name: 'Ciaran Nallon' }, { name: 'Marco Kutscher' },
  ],
  't09': [ // Madrid In Motion
    { name: 'Maikel van der Vleuten' }, { name: 'Kim Emmen' }, { name: 'Eduardo Alvarez Aznar' },
    { name: 'Sergio Alvarez Moya' }, { name: 'Victor Bettendorf' }, { name: 'Jack Whitaker' },
  ],
  't10': [ // Cannes Stars
    { name: 'Katrin Eckermann' }, { name: 'Sophie Hinners' }, { name: 'Janne Meyer-Zimmermann' },
    { name: 'Jörne Sprehe' }, { name: 'Anastasia Nielsen' }, { name: 'Angelica Augustsson Zanotelli' },
  ],
  't11': [ // New York Empire
    { name: 'Scott Brash' }, { name: 'Bertram Allen' }, { name: 'Denis Lynch' },
    { name: 'Michael Pender' }, { name: 'Max Wachman' }, { name: 'Georgina Bloomberg' },
  ],
  't12': [ // Doha Falcons
    { name: 'Jessica Mendoza' }, { name: 'Sanne Thijssen' }, { name: 'Nathan Budd' },
    { name: 'Caroline Rehoff Pedersen' }, { name: 'Oliver Lazarus' }, { name: 'Sheikh Ali Bin Khalid' },
  ],
  't13': [ // Shanghai Swans
    { name: 'Daniel Deusser' }, { name: 'Ben Maher' }, { name: 'Christian Ahlmann' },
    { name: 'Max Kühner' }, { name: 'Giacomo Casadei' }, { name: 'Jane Richard' },
  ],
  't14': [ // Scandinavian Vikings
    { name: 'Jur Vrieling' }, { name: 'Sara Vingralkova' }, { name: 'Jorge Matte Capdevila' },
    { name: 'Lara Tryba' }, { name: 'Deirdre Reilly' }, { name: 'Susan Fitzpatrick' },
  ],
  't15': [ // Mexico Amigos
    { name: 'Carlos Hank Guerreiro' }, { name: 'Zoe Hank Conter' }, { name: 'Eduardo Menezes' },
    { name: 'Niamh McEvoy' }, { name: 'Kendra Claricia Brinkop' }, { name: 'Koen Vereecke' },
  ],
  't16': [ // Riyadh Knights
    { name: "Cian O'Connor" }, { name: 'Emanuele Gaudiano' }, { name: 'Tom Wachman' },
    { name: 'Rodrigo Gesteira Almeida' }, { name: 'Olivier Perreau' }, { name: 'Mathijs Van Asten' },
  ],
  't17': [ // Rome Gladiators
    { name: 'Guido Grimaldi' }, { name: 'Jennifer Hochstaedter' }, { name: 'Yali Kass' },
    { name: 'Clara Pezzoli' }, { name: 'Ioli Mytilineou' }, { name: 'Luiz Felipe Neto' },
  ],
};