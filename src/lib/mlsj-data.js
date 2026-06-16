// EquiPrix — Major League Show Jumping (MLSJ) Module
// 2026-27 Season ("Season 6")
//
// Mirrors the conventions in equiprix-data.js (CAP, salary banding, sbFetch,
// fmt/ordinal helpers, rankToSalary) so the two series feel like one product
// and share the same admin tooling (Rankings import, etc).
//
// SCOPE (v1): GP scoring + Team Competition scoring (3 rounds). Qualifier is
// intentionally NOT scored yet — see scoreQualifier() stub at the bottom if/when
// that's needed.

import { SUPABASE_URL, SUPABASE_KEY, sbFetch, fmt, ordinal, rankToSalary } from './equiprix-data';

export { SUPABASE_URL, SUPABASE_KEY, sbFetch, fmt, ordinal, rankToSalary };

// ───────────────────────── Core constants ─────────────────────────

export const MLSJ_CAP = 50000;          // same cap convention as GCL — adjust per leg in admin if needed
export const MLSJ_CPT_PREMIUM = 1000;   // GP captain salary add-on, matches CPT_PREMIUM
export const MLSJ_CAPTAIN_MULT = 1.5;   // GP captain scoring multiplier, matches CAPTAIN_MULT

// GP individual scoring — reuse the exact GCL GP scale so riders feel the same
// to draft across both series (Greg's call: "same format to keep it simple").
export const MLSJ_GP_POS_PTS = { 1: 50, 2: 38, 3: 30, 4: 24, 5: 20, 6: 16, 7: 13, 8: 10 };
export function mlsjGpPosPts(pos) {
  if (pos <= 8) return MLSJ_GP_POS_PTS[pos] || 0;
  if (pos <= 12) return 6;
  if (pos <= 20) return 3;
  return 1;
}
export const MLSJ_GP_CLEAR_BONUS = 20; // matches GP_CLEAR_BONUS

// ───────────────────────── Team Competition scoring ─────────────────────────
// Locked spec (confirmed):
//   R1 advance (top 4 of 8):      8 pts
//   R1 eliminated (5th-8th):      tiered 3 / 2.5 / 2 / 1.5
//   Advance to Gold/Silver match: +6  (on top of the 8 for advancing R1)
//   Drop to Bronze match:         +3  (on top of the 8 for advancing R1)
//   Final: Gold 20 / Silver 15 / Bronze 11 / 4th 8
//   Retired mid-round:            -3
//   Eliminated for cause:         -4
//
// Max path to Gold = 8 (R1) + 6 (reach final) + 20 (win) = 34 pts

export const MLSJ_TEAM_R1_ADVANCE = 8;
export const MLSJ_TEAM_R1_ELIM_PTS = { 5: 3, 6: 2.5, 7: 2, 8: 1.5 };
export const MLSJ_TEAM_R2_GOLD_SIDE = 6;   // advanced to Gold/Silver match
export const MLSJ_TEAM_R2_BRONZE_SIDE = 3; // dropped to Bronze match
export const MLSJ_TEAM_FINAL_PTS = { gold: 20, silver: 15, bronze: 11, fourth: 8 };
export const MLSJ_TEAM_RETIRED = -3;
export const MLSJ_TEAM_ELIMINATED = -4;

/**
 * Compute a single real MLSJ team's fantasy points for one leg.
 *
 * @param {Object} result - shape stored in Supabase team_results JSONB, e.g.:
 *   {
 *     r1Place: 1-8,            // finishing position in Round 1 (1-4 advance, 5-8 eliminated)
 *     advancedR1: true/false,  // convenience flag, derived from r1Place <= 4 if omitted
 *     r2Side: 'gold' | 'bronze' | null,   // which bracket they landed in after R2 (null if elim'd R1)
 *     finalResult: 'gold' | 'silver' | 'bronze' | 'fourth' | null, // podium outcome (null if elim'd R1)
 *     retired: true/false,     // retired mid-round instead of completing
 *     eliminatedForCause: true/false, // DQ/elimination penalty case
 *   }
 * @returns {number} total fantasy points for this team at this leg
 */
export function scoreMlsjTeam(result) {
  if (!result) return 0;
  if (result.eliminatedForCause) return MLSJ_TEAM_ELIMINATED;
  if (result.retired) return MLSJ_TEAM_RETIRED;

  let pts = 0;
  const advanced = result.advancedR1 ?? (result.r1Place != null && result.r1Place <= 4);

  if (!advanced) {
    // Eliminated in Round 1 — tiered by 5th-8th place
    return MLSJ_TEAM_R1_ELIM_PTS[result.r1Place] ?? MLSJ_TEAM_R1_ELIM_PTS[8];
  }

  pts += MLSJ_TEAM_R1_ADVANCE;

  if (result.r2Side === 'gold') pts += MLSJ_TEAM_R2_GOLD_SIDE;
  else if (result.r2Side === 'bronze') pts += MLSJ_TEAM_R2_BRONZE_SIDE;

  if (result.finalResult && MLSJ_TEAM_FINAL_PTS[result.finalResult] != null) {
    pts += MLSJ_TEAM_FINAL_PTS[result.finalResult];
  }

  return pts;
}

// ───────────────────────── Team pricing ─────────────────────────
// Confirmed: price driven by the COMBINED FEI ranking of that leg's declared
// Round 1 trio — same banding shape as calcEventRiderSalaries(), applied to
// 8 teams instead of 17-40 riders. Average team ≈ $7,500.

/**
 * @param {Array} mlsjTeams - [{ id, name, declaredTrio: [{rank}, {rank}, {rank}] }, ...]
 * @returns {Array} same teams with `.salary` and `.fieldRank` attached
 */
export function calcMlsjTeamSalaries(mlsjTeams) {
  if (!mlsjTeams || !mlsjTeams.length) return mlsjTeams;

  const withStrength = mlsjTeams.map(t => {
    const trio = (t.declaredTrio || []).filter(r => r && r.rank != null);
    const ranks = trio.map(r => (!r.rank || r.rank >= 999) ? 600 : r.rank);
    const strength = ranks.length ? ranks.reduce((a, b) => a + b, 0) : 1800;
    return { ...t, _strength: strength };
  });

  const sorted = [...withStrength].sort((a, b) => a._strength - b._strength);

  return sorted.map((t, i) => {
    const fieldRank = i + 1;
    let raw;

    if (fieldRank === 1) {
      raw = 11000;
    } else if (fieldRank === 2) {
      raw = 9500;
    } else if (fieldRank <= 4) {
      raw = 8500 - (fieldRank - 3) * 1000;
    } else if (fieldRank <= 6) {
      raw = 7000 - (fieldRank - 5) * 1000;
    } else {
      raw = 5000 - (fieldRank - 7) * 1000;
    }

    const salary = Math.max(4000, Math.round(raw / 500) * 500);
    const { _strength, ...rest } = t;
    return { ...rest, salary, fieldRank };
  });
}

// ───────────────────────── MLSJ Master Rider List ─────────────────────────
// Every rider across all 8 MLSJ franchise rosters, flattened with a stable
// integer id (1001+, clear of GCL's 1-230 range), default rank 999 (unranked
// placeholder, same convention as GCL) and salary via the shared rankToSalary
// curve. This is the MLSJ twin of PREVIEW_RIDERS_2026 — the Rankings import
// tool updates rank/salary here the same way it does for GCL.
//
// id assignment is sequential by team then roster order below — DO NOT
// reorder existing entries once ids are referenced in saved picks/results;
// only append new riders at the end.

export const MLSJ_PREVIEW_RIDERS = [
  { id: 1001, name: 'Nicola Philippaerts', nat: '🇧🇪 Belgium', rank: 999, salary: rankToSalary(999), teamId: 'mt01' },
  { id: 1002, name: 'Alex Matz', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt01' },
  { id: 1003, name: 'Amy Millar', nat: '🇨🇦 Canada', rank: 999, salary: rankToSalary(999), teamId: 'mt01' },
  { id: 1004, name: 'Callie Schott', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt01' },
  { id: 1005, name: 'Aaron Vale', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt01' },
  { id: 1006, name: 'Francisco Goyoaga Mollet', nat: '🇪🇸 Spain', rank: 999, salary: rankToSalary(999), teamId: 'mt01' },

  { id: 1007, name: 'Natalie Dean', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt02' },
  { id: 1008, name: 'Lillie Keenan', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt02' },
  { id: 1009, name: 'Nayel Nassar', nat: '🇪🇬 Egypt', rank: 999, salary: rankToSalary(999), teamId: 'mt02' },
  { id: 1010, name: 'Charlotte Jacobs', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt02' },
  { id: 1011, name: 'Conor Swail', nat: '🇮🇪 Ireland', rank: 999, salary: rankToSalary(999), teamId: 'mt02' },
  { id: 1012, name: 'Abdel Saïd', nat: '🇧🇪 Belgium', rank: 999, salary: rankToSalary(999), teamId: 'mt02' },

  { id: 1013, name: 'Daniel Bluman', nat: '🇮🇱 Israel', rank: 999, salary: rankToSalary(999), teamId: 'mt03' },
  { id: 1014, name: 'Mark Bluman', nat: '🇨🇴 Colombia', rank: 999, salary: rankToSalary(999), teamId: 'mt03' },
  { id: 1015, name: "Uma O'Niell", nat: '🇳🇿 New Zealand', rank: 999, salary: rankToSalary(999), teamId: 'mt03' },
  { id: 1016, name: 'Thaisa Erwin', nat: '🇦🇺 Australia', rank: 999, salary: rankToSalary(999), teamId: 'mt03' },
  { id: 1017, name: 'Vanessa Hood', nat: '🇮🇱 Israel', rank: 999, salary: rankToSalary(999), teamId: 'mt03' },
  { id: 1018, name: 'Gabriel de Matos Machado', nat: '🇧🇷 Brazil', rank: 999, salary: rankToSalary(999), teamId: 'mt03' },

  { id: 1019, name: 'Kyle Timm', nat: '🇨🇦 Canada', rank: 999, salary: rankToSalary(999), teamId: 'mt04' },
  { id: 1020, name: 'Cassidy Rein', nat: '🇨🇦 Canada', rank: 999, salary: rankToSalary(999), teamId: 'mt04' },
  { id: 1021, name: 'Nina Mallevaey', nat: '🇫🇷 France', rank: 999, salary: rankToSalary(999), teamId: 'mt04' },
  { id: 1022, name: 'Nikki Walker', nat: '🇨🇦 Canada', rank: 999, salary: rankToSalary(999), teamId: 'mt04' },
  { id: 1023, name: 'Jessica Springsteen', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt04' },
  { id: 1024, name: 'Kyle King', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt04' },

  { id: 1025, name: 'Mclain Ward', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt05' },
  { id: 1026, name: 'Kaitlin Campbell', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt05' },
  { id: 1027, name: 'Erynn Ballard', nat: '🇨🇦 Canada', rank: 999, salary: rankToSalary(999), teamId: 'mt05' },
  { id: 1028, name: 'Laura Kraut', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt05' },
  { id: 1029, name: 'Gregory Wathelet', nat: '🇧🇪 Belgium', rank: 999, salary: rankToSalary(999), teamId: 'mt05' },
  { id: 1030, name: 'Elisa Broz', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt05' },

  { id: 1031, name: 'Jeanne Sadran', nat: '🇫🇷 France', rank: 999, salary: rankToSalary(999), teamId: 'mt06' },
  { id: 1032, name: 'Jordan Coyle', nat: '🇮🇪 Ireland', rank: 999, salary: rankToSalary(999), teamId: 'mt06' },
  { id: 1033, name: 'Skylar Wireman', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt06' },
  { id: 1034, name: 'Marilyn Little', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt06' },
  { id: 1035, name: 'Elena A Haas', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt06' },
  { id: 1036, name: 'Eduardo Pereira De Menezes', nat: '🇧🇷 Brazil', rank: 999, salary: rankToSalary(999), teamId: 'mt06' },

  { id: 1037, name: 'Roberto Teran', nat: '🇨🇴 Colombia', rank: 999, salary: rankToSalary(999), teamId: 'mt07' },
  { id: 1038, name: 'Rene Dittmer', nat: '🇩🇪 Germany', rank: 999, salary: rankToSalary(999), teamId: 'mt07' },
  { id: 1039, name: 'Tony Stormanns', nat: '🇩🇪 Germany', rank: 999, salary: rankToSalary(999), teamId: 'mt07' },
  { id: 1040, name: 'Michael Duffy', nat: '🇮🇪 Ireland', rank: 999, salary: rankToSalary(999), teamId: 'mt07' },
  { id: 1041, name: 'Genevieve Meyer', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt07' },
  { id: 1042, name: 'Richard Vogel', nat: '🇩🇪 Germany', rank: 999, salary: rankToSalary(999), teamId: 'mt07' },

  { id: 1043, name: 'Kent Farrington', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt08' },
  { id: 1044, name: 'Cassio Rivetti', nat: '🇧🇷 Brazil', rank: 999, salary: rankToSalary(999), teamId: 'mt08' },
  { id: 1045, name: "David O'Brien", nat: '🇮🇪 Ireland', rank: 999, salary: rankToSalary(999), teamId: 'mt08' },
  { id: 1046, name: 'Stella Wasserman', nat: '🇺🇸 USA', rank: 999, salary: rankToSalary(999), teamId: 'mt08' },
  { id: 1047, name: 'Mario Deslauriers', nat: '🇨🇦 Canada', rank: 999, salary: rankToSalary(999), teamId: 'mt08' },
  { id: 1048, name: 'Rodrigo Pessoa', nat: '🇧🇷 Brazil', rank: 999, salary: rankToSalary(999), teamId: 'mt08' },
];

// ───────────────────────── MLSJ Teams (Season 6 roster pool) ─────────────────────────
// Rosters reference MLSJ_PREVIEW_RIDERS by id — single source of truth for
// rider rank/salary lives in the master list above, not duplicated here.
// Source: majorleagueshowjumping.com/teams (current as of this build).

export const MLSJ_TEAMS_2026 = [
  { id: 'mt01', name: 'Archers', rosterIds: [1001, 1002, 1003, 1004, 1005, 1006] },
  { id: 'mt02', name: 'Trelawny Trailblazers', rosterIds: [1007, 1008, 1009, 1010, 1011, 1012] },
  { id: 'mt03', name: 'Maccabi United', rosterIds: [1013, 1014, 1015, 1016, 1017, 1018] },
  { id: 'mt04', name: 'Northern Lights', rosterIds: [1019, 1020, 1021, 1022, 1023, 1024] },
  { id: 'mt05', name: 'DIHP Roadrunners', rosterIds: [1025, 1026, 1027, 1028, 1029, 1030] },
  { id: 'mt06', name: 'Rainmakers', rosterIds: [1031, 1032, 1033, 1034, 1035, 1036] },
  { id: 'mt07', name: 'Helios', rosterIds: [1037, 1038, 1039, 1040, 1041, 1042] },
  { id: 'mt08', name: 'Team KPF', rosterIds: [1043, 1044, 1045, 1046, 1047, 1048] },
];

// Helper: get a team's full roster as rider objects (id, name, nat, rank, salary)
// joining against the master list. Use this anywhere you need "team X's riders"
// rather than re-deriving from rosterIds by hand.
export function getMlsjTeamRoster(teamId, riderList = MLSJ_PREVIEW_RIDERS) {
  const team = MLSJ_TEAMS_2026.find(t => t.id === teamId);
  if (!team) return [];
  return team.rosterIds
    .map(id => riderList.find(r => r.id === id))
    .filter(Boolean);
}

// ───────────────────────── 2026-27 Schedule ─────────────────────────
// supabaseKey format mirrors GCL: [city]_mlsj_[season]
// gpLockISO / teamLockISO = night-before-event lock for GP rider draft and
// Team Competition draft respectively (both open the night before their
// respective class; see status field)

export const MLSJ_EVENTS_2026_27 = [
  {
    id: 'toronto_mlsj_26', city: 'Toronto (Angelstone)', flag: '🇨🇦',
    dates: '3–5 Sep', dateLabel: '3–5 September 2026', status: 'future',
    supabaseKey: 'toronto_mlsj_26',
    gpLockISO: '2026-09-04T23:00:00Z',
    teamLockISO: '2026-09-04T23:00:00Z',
    gpRiders: [], teams: [],
  },
  {
    id: 'traverse_city_mlsj_26', city: 'Traverse City', flag: '🇺🇸',
    dates: '10–12 Sep', dateLabel: '10–12 September 2026', status: 'future',
    supabaseKey: 'traverse_city_mlsj_26',
    gpLockISO: '2026-09-11T23:00:00Z',
    teamLockISO: '2026-09-11T23:00:00Z',
    gpRiders: [], teams: [],
  },
  {
    id: 'greenwich_mlsj_26', city: 'Greenwich', flag: '🇺🇸',
    dates: '25–27 Sep', dateLabel: '25–27 September 2026', status: 'future',
    supabaseKey: 'greenwich_mlsj_26',
    gpLockISO: '2026-09-26T23:00:00Z',
    teamLockISO: '2026-09-26T23:00:00Z',
    gpRiders: [], teams: [],
  },
  {
    id: 'hudson_valley_mlsj_26', city: 'Hudson Valley', flag: '🇺🇸',
    dates: '9–11 Oct', dateLabel: '9–11 October 2026', status: 'future',
    supabaseKey: 'hudson_valley_mlsj_26',
    gpLockISO: '2026-10-10T23:00:00Z',
    teamLockISO: '2026-10-10T23:00:00Z',
    gpRiders: [], teams: [],
  },
  {
    id: 'tryon_mlsj_26', city: 'Tryon (Mill Spring)', flag: '🇺🇸',
    dates: '15–17 Oct', dateLabel: '15–17 October 2026', status: 'future',
    supabaseKey: 'tryon_mlsj_26',
    gpLockISO: '2026-10-16T23:00:00Z',
    teamLockISO: '2026-10-16T23:00:00Z',
    gpRiders: [], teams: [],
  },
  {
    id: 'palm_springs_1_mlsj_26', city: 'Palm Springs I', flag: '🇺🇸',
    dates: '3–5 Dec', dateLabel: '3–5 December 2026', status: 'future',
    supabaseKey: 'palm_springs_1_mlsj_26',
    gpLockISO: '2026-12-04T23:00:00Z',
    teamLockISO: '2026-12-04T23:00:00Z',
    gpRiders: [], teams: [],
  },
  {
    id: 'palm_springs_2_mlsj_26', city: 'Palm Springs II', flag: '🇺🇸',
    dates: '10–12 Dec', dateLabel: '10–12 December 2026', status: 'future',
    supabaseKey: 'palm_springs_2_mlsj_26',
    gpLockISO: '2026-12-11T23:00:00Z',
    teamLockISO: '2026-12-11T23:00:00Z',
    gpRiders: [], teams: [],
  },
  {
    id: 'kentucky_mlsj_27', city: 'Kentucky (Lexington)', flag: '🇺🇸',
    dates: '22–24 Apr', dateLabel: '22–24 April 2027', status: 'future',
    supabaseKey: 'kentucky_mlsj_27',
    gpLockISO: '2027-04-23T23:00:00Z',
    teamLockISO: '2027-04-23T23:00:00Z',
    gpRiders: [], teams: [],
  },
  {
    id: 'monterrey_mlsj_27', city: 'Monterrey Finals', flag: '🇲🇽',
    dates: '30 Apr – 2 May', dateLabel: '30 Apr – 2 May 2027', status: 'future',
    supabaseKey: 'monterrey_mlsj_27',
    gpLockISO: '2027-05-01T23:00:00Z',
    teamLockISO: '2027-05-01T23:00:00Z',
    gpRiders: [], teams: [],
    isFinal: true,
  },
];

// ───────────────────────── Helpers ─────────────────────────

export function getBand(rank) {
  if (rank <= 10) return { label: 'Top 10', cls: 'band-1' };
  if (rank <= 25) return { label: '11–25', cls: 'band-2' };
  return { label: '26+', cls: 'band-3' };
}

export function mlsjRoundLabel(round) {
  if (round === 1) return 'Round 1 (8 teams, 3 riders)';
  if (round === 2) return 'Round 2 (4 teams, 2 riders)';
  if (round === 3) return 'Round 3 — Final (anchor rider)';
  return '';
}

// Out of scope for v1 — stub left in place intentionally so future work has a home.
export function scoreQualifier(/* result */) {
  console.warn('scoreQualifier() is not implemented in v1 — Qualifier is unscored.');
  return 0;
}