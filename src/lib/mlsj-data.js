// EquiPrix — Major League Show Jumping (MLSJ) Module
// 2026-27 Season ("Season 6")
//
// IMPORTANT: rider data lives in the SHARED PREVIEW_RIDERS_2026 list in
// equiprix-data.js, not in a separate MLSJ list. A rider who competes in both
// GCL and MLSJ (e.g. Nicola Philippaerts, Nayel Nassar, Lillie Keenan) has
// exactly one id, one rank, one salary — uploading FEI rankings once updates
// them everywhere. MLSJ_TEAMS_2026 rosters below reference riders by id into
// that shared list. There is no separate MLSJ id block — MLSJ-only riders
// are simply the next sequential entries in the same array (e.g. 237-268).

import {
  SUPABASE_URL, SUPABASE_KEY, sbFetch, fmt, ordinal, rankToSalary, PREVIEW_RIDERS_2026,
} from './equiprix-data';

export { SUPABASE_URL, SUPABASE_KEY, sbFetch, fmt, ordinal, rankToSalary };

// ───────────────────────── Core constants ─────────────────────────

export const MLSJ_CAP = 50000;
export const MLSJ_CPT_PREMIUM = 1000;
export const MLSJ_CAPTAIN_MULT = 1.5;

export const MLSJ_GP_POS_PTS = { 1: 50, 2: 38, 3: 30, 4: 24, 5: 20, 6: 16, 7: 13, 8: 10 };
export function mlsjGpPosPts(pos) {
  if (pos <= 8) return MLSJ_GP_POS_PTS[pos] || 0;
  if (pos <= 12) return 6;
  if (pos <= 20) return 3;
  return 1;
}
export const MLSJ_GP_CLEAR_BONUS = 20;

// ───────────────────────── Team Competition scoring ─────────────────────────

export const MLSJ_TEAM_R1_ADVANCE = 8;
export const MLSJ_TEAM_R1_ELIM_PTS = { 5: 3, 6: 2.5, 7: 2, 8: 1.5 };
export const MLSJ_TEAM_R2_GOLD_SIDE = 6;
export const MLSJ_TEAM_R2_BRONZE_SIDE = 3;
export const MLSJ_TEAM_FINAL_PTS = { gold: 20, silver: 15, bronze: 11, fourth: 8 };
export const MLSJ_TEAM_RETIRED = -3;
export const MLSJ_TEAM_ELIMINATED = -4;

export function scoreMlsjTeam(result) {
  if (!result) return 0;
  if (result.eliminatedForCause) return MLSJ_TEAM_ELIMINATED;
  if (result.retired) return MLSJ_TEAM_RETIRED;

  let pts = 0;
  const advanced = result.advancedR1 ?? (result.r1Place != null && result.r1Place <= 4);

  if (!advanced) {
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

    if (fieldRank === 1) raw = 11000;
    else if (fieldRank === 2) raw = 9500;
    else if (fieldRank <= 4) raw = 8500 - (fieldRank - 3) * 1000;
    else if (fieldRank <= 6) raw = 7000 - (fieldRank - 5) * 1000;
    else raw = 5000 - (fieldRank - 7) * 1000;

    const salary = Math.max(4000, Math.round(raw / 500) * 500);
    const { _strength, ...rest } = t;
    return { ...rest, salary, fieldRank };
  });
}

// ───────────────────────── MLSJ Teams (Season 6 roster pool) ─────────────────────────
// rosterIds reference the SHARED PREVIEW_RIDERS_2026 list (in equiprix-data.js),
// not a separate MLSJ list. 15 of these 48 slots point at riders who already
// exist there from GCL (e.g. id 116 = Nicola Philippaerts, id 124 = Nayel
// Nassar) — those riders share one rank/salary across both leagues. The
// other 32 MLSJ-only riders are simply the next entries in that SAME
// sequential id range (no separate 1000+ block) — e.g. id 237 onward.
// One master list, one id sequence, regardless of which league a rider
// plays in. Source: majorleagueshowjumping.com/teams.

export const MLSJ_TEAMS_2026 = [
  { id: 'mt01', name: 'Archers', rosterIds: [116, 237, 238, 239, 222, 240], rank: 1, pts: 0, salary: 7500 },
  { id: 'mt02', name: 'Trelawny Trailblazers', rosterIds: [241, 235, 124, 242, 243, 202], rank: 2, pts: 0, salary: 7500 },
  { id: 'mt03', name: 'Maccabi United', rosterIds: [215, 244, 245, 246, 247, 248], rank: 3, pts: 0, salary: 7500 },
  { id: 'mt04', name: 'Northern Lights', rosterIds: [249, 250, 213, 251, 252, 253], rank: 4, pts: 0, salary: 7500 },
  { id: 'mt05', name: 'DIHP Roadrunners', rosterIds: [216, 168, 220, 204, 207, 254], rank: 5, pts: 0, salary: 7500 },
  { id: 'mt06', name: 'Rainmakers', rosterIds: [148, 223, 255, 256, 257, 258], rank: 6, pts: 0, salary: 7500 },
  { id: 'mt07', name: 'Helios', rosterIds: [259, 260, 261, 262, 263, 211], rank: 7, pts: 0, salary: 7500 },
  { id: 'mt08', name: 'Team KPF', rosterIds: [203, 264, 265, 266, 267, 268], rank: 8, pts: 0, salary: 7500 },
];

// Helper: get a team's full roster as rider objects, joining against the
// shared rider list (defaults to PREVIEW_RIDERS_2026, pass a fresher list —
// e.g. with updated ranks from Rankings import — if you have one in hand).
export function getMlsjTeamRoster(teamId, riderList = PREVIEW_RIDERS_2026) {
  const team = MLSJ_TEAMS_2026.find(t => t.id === teamId);
  if (!team) return [];
  return team.rosterIds
    .map(id => riderList.find(r => r.id === id))
    .filter(Boolean);
}

// ───────────────────────── 2026-27 Schedule ─────────────────────────

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

export function scoreQualifier(/* result */) {
  console.warn('scoreQualifier() is not implemented in v1 — Qualifier is unscored.');
  return 0;
}