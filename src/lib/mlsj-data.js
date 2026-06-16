// EquiPrix — Major League Show Jumping (MLSJ) Module
// 2026-27 Season ("Season 6")
//
// Mirrors the conventions in equiprix-data.js (CAP, salary banding, sbFetch,
// fmt/ordinal helpers) so the two series feel like one product.
//
// SCOPE (v1): GP scoring + Team Competition scoring (3 rounds). Qualifier is
// intentionally NOT scored yet — see scoreQualifier() stub at the bottom if/when
// that's needed.

import { SUPABASE_URL, SUPABASE_KEY, sbFetch, fmt, ordinal } from './equiprix-data';

export { SUPABASE_URL, SUPABASE_KEY, sbFetch, fmt, ordinal };

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
    // Combined strength = sum of declared trio's FEI ranks (lower sum = stronger team)
    const strength = ranks.length ? ranks.reduce((a, b) => a + b, 0) : 1800; // worst-case default
    return { ...t, _strength: strength };
  });

  // Sort by strength ascending — rank 1 (lowest sum) is the strongest team
  const sorted = [...withStrength].sort((a, b) => a._strength - b._strength);

  return sorted.map((t, i) => {
    const fieldRank = i + 1; // 1 = strongest declared trio this leg, 8 = weakest
    let raw;

    if (fieldRank === 1) {
      raw = 11000; // top trio premium
    } else if (fieldRank === 2) {
      raw = 9500;
    } else if (fieldRank <= 4) {
      // ranks 3-4: $8,500 → $7,500, bracketing the $7,500 average
      raw = 8500 - (fieldRank - 3) * 1000;
    } else if (fieldRank <= 6) {
      // ranks 5-6: $7,000 → $6,000
      raw = 7000 - (fieldRank - 5) * 1000;
    } else {
      // ranks 7-8: $5,000 → $4,000, weakest team extra cheap
      raw = 5000 - (fieldRank - 7) * 1000;
    }

    const salary = Math.max(4000, Math.round(raw / 500) * 500);
    const { _strength, ...rest } = t;
    return { ...rest, salary, fieldRank };
  });
}

// ───────────────────────── MLSJ Teams (Season 6 roster pool) ─────────────────────────
// Six to seven riders per franchise; team manager declares 3 for Round 1 each leg.
// Source: majorleagueshowjumping.com/teams (current as of this build).

export const MLSJ_TEAMS_2026 = [
  {
    id: 'mt01', name: 'Archers',
    roster: [
      { name: 'Nicola Philippaerts', nat: '🇧🇪 Belgium' },
      { name: 'Alex Matz', nat: '🇺🇸 USA' },
      { name: 'Amy Millar', nat: '🇨🇦 Canada' },
      { name: 'Callie Schott', nat: '🇺🇸 USA' },
      { name: 'Aaron Vale', nat: '🇺🇸 USA' },
      { name: 'Francisco Goyoaga Mollet', nat: '🇪🇸 Spain' },
    ],
  },
  {
    id: 'mt02', name: 'Trelawny Trailblazers',
    roster: [
      { name: 'Natalie Dean', nat: '🇺🇸 USA' },
      { name: 'Lillie Keenan', nat: '🇺🇸 USA' },
      { name: 'Nayel Nassar', nat: '🇪🇬 Egypt' },
      { name: 'Charlotte Jacobs', nat: '🇺🇸 USA' },
      { name: 'Conor Swail', nat: '🇮🇪 Ireland' },
      { name: 'Abdel Saïd', nat: '🇧🇪 Belgium' },
    ],
  },
  {
    id: 'mt03', name: 'Maccabi United',
    roster: [
      { name: 'Daniel Bluman', nat: '🇮🇱 Israel' },
      { name: 'Mark Bluman', nat: '🇨🇴 Colombia' },
      { name: "Uma O'Niell", nat: '🇳🇿 New Zealand' },
      { name: 'Thaisa Erwin', nat: '🇦🇺 Australia' },
      { name: 'Vanessa Hood', nat: '🇮🇱 Israel' },
      { name: 'Gabriel de Matos Machado', nat: '🇧🇷 Brazil' },
    ],
  },
  {
    id: 'mt04', name: 'Northern Lights',
    roster: [
      { name: 'Kyle Timm', nat: '🇨🇦 Canada' },
      { name: 'Cassidy Rein', nat: '🇨🇦 Canada' },
      { name: 'Nina Mallevaey', nat: '🇫🇷 France' },
      { name: 'Nikki Walker', nat: '🇨🇦 Canada' },
      { name: 'Jessica Springsteen', nat: '🇺🇸 USA' },
      { name: 'Kyle King', nat: '🇺🇸 USA' },
    ],
  },
  {
    id: 'mt05', name: 'DIHP Roadrunners',
    roster: [
      { name: 'Mclain Ward', nat: '🇺🇸 USA' },
      { name: 'Kaitlin Campbell', nat: '🇺🇸 USA' },
      { name: 'Erynn Ballard', nat: '🇨🇦 Canada' },
      { name: 'Laura Kraut', nat: '🇺🇸 USA' },
      { name: 'Gregory Wathelet', nat: '🇧🇪 Belgium' },
      { name: 'Elisa Broz', nat: '🇺🇸 USA' },
    ],
  },
  {
    id: 'mt06', name: 'Rainmakers',
    roster: [
      { name: 'Jeanne Sadran', nat: '🇫🇷 France' },
      { name: 'Jordan Coyle', nat: '🇮🇪 Ireland' },
      { name: 'Skylar Wireman', nat: '🇺🇸 USA' },
      { name: 'Marilyn Little', nat: '🇺🇸 USA' },
      { name: 'Elena A Haas', nat: '🇺🇸 USA' },
      { name: 'Eduardo Pereira De Menezes', nat: '🇧🇷 Brazil' },
    ],
  },
  {
    id: 'mt07', name: 'Helios',
    roster: [
      { name: 'Roberto Teran', nat: '🇨🇴 Colombia' },
      { name: 'Rene Dittmer', nat: '🇩🇪 Germany' },
      { name: 'Tony Stormanns', nat: '🇩🇪 Germany' },
      { name: 'Michael Duffy', nat: '🇮🇪 Ireland' },
      { name: 'Genevieve Meyer', nat: '🇺🇸 USA' },
      { name: 'Richard Vogel', nat: '🇩🇪 Germany' },
    ],
  },
  {
    id: 'mt08', name: 'Team KPF',
    roster: [
      { name: 'Kent Farrington', nat: '🇺🇸 USA' },
      { name: 'Cassio Rivetti', nat: '🇧🇷 Brazil' },
      { name: "David O'Brien", nat: '🇮🇪 Ireland' },
      { name: 'Stella Wasserman', nat: '🇺🇸 USA' },
      { name: 'Mario Deslauriers', nat: '🇨🇦 Canada' },
      { name: 'Rodrigo Pessoa', nat: '🇧🇷 Brazil' },
    ],
  },
];

// ───────────────────────── 2026-27 Schedule ─────────────────────────
// supabaseKey format mirrors GCL: [city]_mlsj_[season]
// rosterLockISO = night-before-event lock for GP rider draft AND team draft
// (both open the night before their respective class; see status field)

export const MLSJ_EVENTS_2026_27 = [
  {
    id: 'toronto_mlsj_26', city: 'Toronto (Angelstone)', flag: '🇨🇦',
    dates: '3–5 Sep', dateLabel: '3–5 September 2026', status: 'future',
    supabaseKey: 'toronto_mlsj_26',
    gpLockISO: '2026-09-04T23:00:00Z',   // night before GP
    teamLockISO: '2026-09-04T23:00:00Z', // night before Team Competition (once R1 trios declared)
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
    isFinal: true, // note for future: MLSJ doubles points at the Final — not yet implemented in scoreMlsjTeam
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