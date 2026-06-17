// EquiPrix 2026 Season Data

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://tkqupuppxjuaxafocmsq.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const ADMIN_PASSWORD = 'equiprix2026';

export const NAMES = {
  'EQPRIX01': 'Greg', 'EQPRIX02': 'Siena', 'EQPRIX03': 'Eddie',
  'EQPRIX04': 'Karla', 'EQPRIX05': 'Kara', 'EQPRIX06': 'Frederike',
  'EQPRIX07': 'Danny',
};

export const VALID_CODES = Object.keys(NAMES);

export const CAP = 50000;
export const CPT_PREMIUM = 1000;
export const GP_CLEAR_BONUS = 20;
export const CAPTAIN_MULT = 1.5;
export const TEAM_ADVANCE = 15;

export const GP_POS_PTS = { 1: 50, 2: 38, 3: 30, 4: 24, 5: 20, 6: 16, 7: 13, 8: 10 };
export const TEAM_PTS_MAP = { 1: 40, 2: 30, 3: 22 };

export function gpPosPts(pos) {
  if (pos <= 8) return GP_POS_PTS[pos] || 0;
  if (pos <= 12) return 6;
  if (pos <= 20) return 3;
  return 1;
}

export function teamPosPts(pos) {
  if (pos <= 3) return TEAM_PTS_MAP[pos];
  if (pos <= 6) return 15;
  if (pos <= 10) return 8;
  return 3;
}

export const GCL_STAGE_PTS = {
  1: 30, 2: 25, 3: 21, 4: 19, 5: 17, 6: 16, 7: 15, 8: 14,
  9: 13, 10: 12, 11: 11, 12: 10, 13: 9, 14: 8, 15: 7, 16: 6, 17: 5
};

export function gclStagePts(pos) { return GCL_STAGE_PTS[pos] || 0; }

export function rankToSalary(rank) {
  if (rank <= 3) return 13000;
  if (rank <= 5) return 12000;
  if (rank <= 7) return 11000;
  if (rank <= 8) return 10500;
  if (rank <= 9) return 10000;
  if (rank <= 10) return 9500;
  if (rank <= 12) return 9000;
  if (rank <= 14) return 8500;
  if (rank <= 16) return 8000;
  if (rank <= 18) return 8000;
  if (rank <= 20) return 7500;
  if (rank <= 22) return 7500;
  if (rank <= 25) return 7000;
  if (rank <= 30) return 6500;
  if (rank <= 35) return 6000;
  if (rank <= 40) return 5500;
  if (rank <= 50) return 5000;
  if (rank <= 60) return 4500;
  if (rank <= 70) return 4000;
  if (rank <= 80) return 3500;
  if (rank <= 100) return 3000;
  if (rank <= 120) return 2500;
  if (rank <= 150) return 2000;
  if (rank <= 200) return 1500;
  return 1000;
}
// Add this function to equiprix-data.js after rankToSalary()
// Replace the static salary on each rider with a dynamic one based on field strength

export function calcEventRiderSalaries(gpRiders) {
  if (!gpRiders || !gpRiders.length) return gpRiders;

  // Sort by FEI rank within this event's field — rank 999/missing = worst
  const sorted = [...gpRiders].sort((a, b) => {
    const ra = (!a.rank || a.rank >= 999) ? 99999 : a.rank;
    const rb = (!b.rank || b.rank >= 999) ? 99999 : b.rank;
    return ra - rb;
  });

  return sorted.map((rider, i) => {
    const fieldRank = i + 1; // 1 = best FEI rank in this event's GP field
    let raw;

    if (fieldRank <= 5) {
      // Top 5: $11,000 → $9,000
      raw = 11000 - (fieldRank - 1) * 500;
    } else if (fieldRank <= 15) {
      // Ranks 6–15: $9,000 → $7,000
      raw = 9000 - (fieldRank - 6) * 200;
    } else if (fieldRank <= 30) {
      // Ranks 16–30: $7,500 → $5,000
      raw = 7500 - (fieldRank - 16) * 167;
    } else {
      // Ranks 31–40: $4,000 → $3,000
      raw = 4000 - (fieldRank - 31) * 100;
    }

    const salary = Math.max(3000, Math.round(raw / 500) * 500);
    return { ...rider, salary, fieldRank };
  });
}
export function getBand(rank) {
  if (rank <= 10) return { label: 'Top 10', cls: 'band-1' };
  if (rank <= 25) return { label: '11–25', cls: 'band-2' };
  return { label: '26+', cls: 'band-3' };
}

export function fmt(n) {
  return '$' + Number(n).toLocaleString();
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Supabase API helper
export async function sbFetch(path, opts = {}) {
  const url = SUPABASE_URL + '/rest/v1/' + path;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };
  if (opts.method === 'POST') headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
  if (opts.method === 'PATCH') headers['Prefer'] = 'return=representation';
  try {
    const resp = await fetch(url, { ...opts, headers });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      if (opts.method === 'POST' || opts.method === 'PATCH') {
        throw new Error('Supabase ' + resp.status + ': ' + errText.slice(0, 120));
      }
      return null;
    }
    const txt = await resp.text();
    return txt ? JSON.parse(txt) : [];
  } catch (e) {
    if (e.message && e.message.startsWith('Supabase')) throw e;
    console.error('sbFetch network error:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// PREVIEW_RIDERS_2026 — the ONE master rider list shared across GCL and
// MLSJ. Every rider, regardless of which league(s) they compete in, has
// exactly one entry here under one continuous ascending id sequence.
// New riders (from either league) get the next available id — no
// separate id blocks, no duplicate entries. The monthly FEI rankings
// upload updates this list, and both leagues' draft pools, pricing, and
// scoring read from it automatically.
//
// ids 1-230: original GCL roster
// ids 231-236: added for Paris 2026 (Dilasser, Moissonnier, Leprevost,
//   Bost, Keenan, Rizvi)
// ids 237-268: MLSJ-only riders (not previously in the GCL pool). Lillie
//   Keenan is NOT duplicated here — her MLSJ roster slot (Trelawny
//   Trailblazers) points directly at id 235 in mlsj-data.js.
// Next new rider, from either league: id 269.
// ─────────────────────────────────────────────────────────────────

export const PREVIEW_RIDERS_2026 = [
  { id: 101, name: "Henrik von Eckermann", nat: "🇸🇪 Sweden", rank: 999, salary: 1000, region: "europe" },
  { id: 102, name: "Scott Brash", nat: "🇬🇧 UK", rank: 3, salary: 13000, region: "europe" },
  { id: 103, name: "Gilles Thomas", nat: "🇧🇪 Belgium", rank: 5, salary: 12000, region: "europe" },
  { id: 104, name: "Ben Maher", nat: "🇬🇧 UK", rank: 4, salary: 12000, region: "europe" },
  { id: 105, name: "Christian Kukuk", nat: "🇩🇪 Germany", rank: 8, salary: 10500, region: "europe" },
  { id: 106, name: "Peder Fredricson", nat: "🇸🇪 Sweden", rank: 78, salary: 3500, region: "europe" },
  { id: 107, name: "Maikel van der Vleuten", nat: "🇳🇱 Netherlands", rank: 999, salary: 1000, region: "europe" },
  { id: 108, name: "Philipp Weishaupt", nat: "🇩🇪 Germany", rank: 53, salary: 4500, region: "europe" },
  { id: 109, name: "Simon Delestre", nat: "🇫🇷 France", rank: 15, salary: 8000, region: "europe" },
  { id: 110, name: "Daniel Deusser", nat: "🇩🇪 Germany", rank: 20, salary: 7500, region: "europe" },
  { id: 111, name: "Bertram Allen", nat: "🇮🇪 Ireland", rank: 44, salary: 5000, region: "europe" },
  { id: 112, name: "Pieter Devos", nat: "🇧🇪 Belgium", rank: 34, salary: 6000, region: "europe" },
  { id: 113, name: "Thibault Philippaerts", nat: "🇧🇪 Belgium", rank: 233, salary: 1000, region: "europe" },
  { id: 114, name: "Marcus Ehning", nat: "🇩🇪 Germany", rank: 132, salary: 2000, region: "europe" },
  { id: 115, name: "Christian Ahlmann", nat: "🇩🇪 Germany", rank: 47, salary: 5000, region: "europe" },
  { id: 116, name: "Nicola Philippaerts", nat: "🇧🇪 Belgium", rank: 13, salary: 8500, region: "europe" },
  { id: 117, name: "Olivier Philippaerts", nat: "🇧🇪 Belgium", rank: 166, salary: 1500, region: "europe" },
  { id: 118, name: "Lorenzo De Luca", nat: "🇮🇹 Italy", rank: 999, salary: 1000, region: "europe" },
  { id: 119, name: "Eduardo Alvarez Aznar", nat: "🇪🇸 Spain", rank: 999, salary: 1000, region: "europe" },
  { id: 120, name: "Edwina Tops-Alexander", nat: "🇦🇺 Australia", rank: 176, salary: 1500, region: "europe" },
  { id: 121, name: "Katrin Eckermann", nat: "🇩🇪 Germany", rank: 76, salary: 3500, region: "europe" },
  { id: 122, name: "Janne Meyer-Zimmermann", nat: "🇩🇪 Germany", rank: 68, salary: 4000, region: "europe" },
  { id: 123, name: "Emanuele Camilli", nat: "🇮🇹 Italy", rank: 73, salary: 3500, region: "europe" },
  { id: 124, name: "Nayel Nassar", nat: "🇪🇬 Egypt", rank: 58, salary: 4500, region: "americas" },
  { id: 125, name: "Jérôme Guery", nat: "🇧🇪 Belgium", rank: 80, salary: 3500, region: "europe" },
  { id: 126, name: "Hans-Dieter Dreher", nat: "🇩🇪 Germany", rank: 66, salary: 4000, region: "europe" },
  { id: 127, name: "Niels Bruynseels", nat: "🇧🇪 Belgium", rank: 110, salary: 2500, region: "europe" },
  { id: 128, name: "Max Kühner", nat: "🇦🇹 Austria", rank: 26, salary: 6500, region: "europe" },
  { id: 129, name: "Marco Kutscher", nat: "🇩🇪 Germany", rank: 165, salary: 1500, region: "europe" },
  { id: 130, name: "Ciaran Nallon", nat: "🇮🇪 Ireland", rank: 320, salary: 1000, region: "europe" },
  { id: 131, name: "Jur Vrieling", nat: "🇳🇱 Netherlands", rank: 85, salary: 3000, region: "europe" },
  { id: 132, name: "Max Weishaupt", nat: "🇩🇪 Germany", rank: 53, salary: 4500, region: "europe" },
  { id: 133, name: "Anastasia Nielsen", nat: "🇲🇨 Monaco", rank: 134, salary: 2000, region: "europe" },
  { id: 134, name: "Jörne Sprehe", nat: "🇩🇪 Germany", rank: 87, salary: 3000, region: "europe" },
  { id: 135, name: "Gregory Cottard", nat: "🇫🇷 France", rank: 999, salary: 1000, region: "europe" },
  { id: 136, name: "Zascha Nygaard", nat: "🇩🇰 Denmark", rank: 123, salary: 2000, region: "europe" },
  { id: 137, name: "Andreas Schou", nat: "🇩🇰 Denmark", rank: 70, salary: 4000, region: "europe" },
  { id: 138, name: "Duarte Seabra", nat: "🇵🇹 Portugal", rank: 999, salary: 1000, region: "europe" },
  { id: 139, name: "Angelica Augustsson Zanotelli", nat: "🇸🇪 Sweden", rank: 999, salary: 1000, region: "europe" },
  { id: 140, name: "Kim Emmen", nat: "🇳🇱 Netherlands", rank: 42, salary: 5000, region: "europe" },
  { id: 141, name: "Jessica Mendoza", nat: "🇬🇧 UK", rank: 24, salary: 7000, region: "europe" },
  { id: 142, name: "Sanne Thijssen", nat: "🇳🇱 Netherlands", rank: 88, salary: 3000, region: "europe" },
  { id: 143, name: "Sergio Alvarez Moya", nat: "🇪🇸 Spain", rank: 999, salary: 1000, region: "europe" },
  { id: 144, name: "Pim Mulder", nat: "🇳🇱 Netherlands", rank: 999, salary: 1000, region: "europe" },
  { id: 145, name: "Jane Richard", nat: "🇨🇭 Switzerland", rank: 999, salary: 1000, region: "europe" },
  { id: 146, name: "Thibeau Spits", nat: "🇧🇪 Belgium", rank: 33, salary: 6000, region: "europe" },
  { id: 147, name: "Victor Bettendorf", nat: "🇱🇺 Luxembourg", rank: 49, salary: 5000, region: "europe" },
  { id: 148, name: "Jeanne Sadran", nat: "🇫🇷 France", rank: 999, salary: 1000, region: "europe" },
  { id: 149, name: "Antoine Ermann", nat: "🇫🇷 France", rank: 50, salary: 5000, region: "europe" },
  { id: 150, name: "Giacomo Casadei", nat: "🇮🇹 Italy", rank: 120, salary: 2500, region: "europe" },
  { id: 151, name: "Yuri Mansur", nat: "🇧🇷 Brazil", rank: 84, salary: 3000, region: "americas" },
  { id: 152, name: "Carlos Hank Guerreiro", nat: "🇲🇽 Mexico", rank: 999, salary: 1000, region: "americas" },
  { id: 153, name: "Jack Whitaker", nat: "🇬🇧 UK", rank: 999, salary: 1000, region: "europe" },
  { id: 154, name: "Sara Vingralkova", nat: "🇨🇿 Czech Rep.", rank: 999, salary: 1000, region: "europe" },
  { id: 155, name: "Cian O'Connor", nat: "🇮🇪 Ireland", rank: 32, salary: 6000, region: "europe" },
  { id: 156, name: "Emanuele Gaudiano", nat: "🇮🇹 Italy", rank: 57, salary: 4500, region: "europe" },
  { id: 157, name: "Tom Wachman", nat: "🇮🇪 Ireland", rank: 63, salary: 4000, region: "europe" },
  { id: 158, name: "Dalma Malhas", nat: "🇸🇦 Saudi Arabia", rank: 999, salary: 1000, region: "europe" },
  { id: 159, name: "Nathan Budd", nat: "🇬🇧 UK", rank: 999, salary: 1000, region: "europe" },
  { id: 160, name: "Inès Joly", nat: "🇫🇷 France", rank: 217, salary: 1000, region: "europe" },
  { id: 161, name: "Koen Vereecke", nat: "🇧🇪 Belgium", rank: 94, salary: 3000, region: "europe" },
  { id: 162, name: "Max Wachman", nat: "🇮🇪 Ireland", rank: 259, salary: 1000, region: "europe" },
  { id: 163, name: "Zoe Hank Conter", nat: "🇧🇪 Belgium", rank: 177, salary: 1500, region: "americas" },
  { id: 164, name: "Michael Pender", nat: "🇮🇪 Ireland", rank: 105, salary: 2500, region: "europe" },
  { id: 165, name: "Eduardo Menezes", nat: "🇧🇷 Brazil", rank: 999, salary: 1000, region: "americas" },
  { id: 166, name: "Denis Lynch", nat: "🇮🇪 Ireland", rank: 60, salary: 4500, region: "europe" },
  { id: 167, name: "Jorge Matte Capdevila", nat: "🇨🇱 Chile", rank: 999, salary: 1000, region: "americas" },
  { id: 168, name: "Kaitlin Campbell", nat: "🇺🇸 USA", rank: 107, salary: 2500, region: "americas" },
  { id: 169, name: "Jennifer Hochstaedter", nat: "🏳️ LIE", rank: 360, salary: 1000, region: "americas" },
  { id: 170, name: "Guido Grimaldi", nat: "🇮🇹 Italy", rank: 531, salary: 1000, region: "europe" },
  { id: 171, name: "Luiz Felipe Neto", nat: "🇧🇷 Brazil", rank: 999, salary: 1000, region: "americas" },
  { id: 172, name: "Rodrigo Gesteira Almeida", nat: "🇵🇹 Portugal", rank: 89, salary: 3000, region: "europe" },
  { id: 173, name: "Caroline Rehoff Pedersen", nat: "🇩🇰 Denmark", rank: 368, salary: 1000, region: "europe" },
  { id: 174, name: "Lara Tryba", nat: "🇫🇷 France", rank: 333, salary: 1000, region: "europe" },
  { id: 175, name: "Nadja Peter Steiner", nat: "🇨🇭 Switzerland", rank: 999, salary: 1000, region: "europe" },
  { id: 176, name: "Piergiorgio Bucci", nat: "🇮🇹 Italy", rank: 22, salary: 7000, region: "europe" },
  { id: 177, name: "Marlon Modolo Zanotelli", nat: "🇧🇷 Brazil", rank: 999, salary: 1000, region: "americas" },
  { id: 178, name: "Annelies Vorsselmans", nat: "🇧🇪 Belgium", rank: 149, salary: 2000, region: "europe" },
  { id: 179, name: "Iñigo Lopez de La Osa", nat: "🇲🇨 Monaco", rank: 999, salary: 1000, region: "europe" },
  { id: 180, name: "Anna Kellnerová", nat: "🇨🇿 Czech Rep.", rank: 999, salary: 1000, region: "europe" },
  { id: 181, name: "Olivier Perreau", nat: "🇫🇷 France", rank: 999, salary: 1000, region: "europe" },
  { id: 182, name: "Mathijs Van Asten", nat: "🇳🇱 Netherlands", rank: 999, salary: 1000, region: "europe" },
  { id: 183, name: "Niamh McEvoy", nat: "🇮🇪 Ireland", rank: 999, salary: 1000, region: "europe" },
  { id: 184, name: "Kendra Claricia Brinkop", nat: "🇩🇪 Germany", rank: 223, salary: 1000, region: "europe" },
  { id: 185, name: "Sophie Hinners", nat: "🇩🇪 Germany", rank: 21, salary: 7000, region: "europe" },
  { id: 186, name: "Deirdre Reilly", nat: "🇮🇪 Ireland", rank: 999, salary: 1000, region: "europe" },
  { id: 187, name: "Susan Fitzpatrick", nat: "🇮🇪 Ireland", rank: 348, salary: 1000, region: "europe" },
  { id: 188, name: "Géraldine Straumann", nat: "🇨🇭 Switzerland", rank: 999, salary: 1000, region: "europe" },
  { id: 189, name: "Oliver Fletcher", nat: "🇬🇧 UK", rank: 240, salary: 1000, region: "europe" },
  { id: 190, name: "Hasan Şentürk", nat: "🇹🇷 Turkey", rank: 999, salary: 1000, region: "europe" },
  { id: 191, name: "Efe Siyahi", nat: "🇹🇷 Turkey", rank: 749, salary: 1000, region: "europe" },
  { id: 192, name: "Georgina Bloomberg", nat: "🇺🇸 USA", rank: 1082, salary: 1000, region: "americas" },
  { id: 193, name: "Oliver Lazarus", nat: "🇿🇦 South Africa", rank: 999, salary: 1000, region: "europe" },
  { id: 194, name: "Sheikh Ali Bin Khalid", nat: "🇶🇦 Qatar", rank: 999, salary: 1000, region: "europe" },
  { id: 195, name: "Derin Demirsoy", nat: "🇹🇷 Turkey", rank: 881, salary: 1000, region: "europe" },
  { id: 196, name: "Fernando Martinez Sommer", nat: "🇵🇾 Paraguay", rank: 999, salary: 1000, region: "americas" },
  { id: 197, name: "Yali Kass", nat: "🇮🇱 Israel", rank: 482, salary: 1000, region: "europe" },
  { id: 198, name: "Clara Pezzoli", nat: "🇮🇹 Italy", rank: 999, salary: 1000, region: "europe" },
  { id: 199, name: "Ioli Mytilineou", nat: "🇬🇷 Greece", rank: 999, salary: 1000, region: "europe" },
  { id: 200, name: "Mariano Martinez Bastida", nat: "🇦🇷 Argentina", rank: 999, salary: 1000, region: "americas" },
  { id: 201, name: "Ismail El Borai", nat: "🇪🇬 Egypt", rank: 999, salary: 1000, region: "europe" },
  { id: 202, name: "Abdel Saïd", nat: "🇧🇪 Belgium", rank: 19, salary: 7500, region: "europe" },
  { id: 203, name: "Kent Farrington", nat: "🇺🇸 USA", rank: 1, salary: 13000, region: "americas" },
  { id: 204, name: "Laura Kraut", nat: "🇺🇸 USA", rank: 9, salary: 10000, region: "americas" },
  { id: 205, name: "Harrie Smolders", nat: "🇳🇱 Netherlands", rank: 18, salary: 8000, region: "europe" },
  { id: 206, name: "Julien Epaillard", nat: "🇫🇷 France", rank: 11, salary: 9000, region: "europe" },
  { id: 207, name: "Gregory Wathelet", nat: "🇧🇪 Belgium", rank: 28, salary: 6500, region: "europe" },
  { id: 208, name: "Kristen Vanderveen", nat: "🇺🇸 USA", rank: 29, salary: 6500, region: "americas" },
  { id: 209, name: "Stephan De Freitas Barcha", nat: "🇧🇷 Brazil", rank: 999, salary: 1000, region: "americas" },
  { id: 210, name: "Robin Muhr", nat: "🇮🇱 Israel", rank: 125, salary: 2000, region: "europe" },
  { id: 211, name: "Richard Vogel", nat: "🇩🇪 Germany", rank: 2, salary: 13000, region: "europe" },
  { id: 212, name: "Shane Sweetnam", nat: "🇮🇪 Ireland", rank: 6, salary: 11000, region: "europe" },
  { id: 213, name: "Nina Mallevaey", nat: "🇫🇷 France", rank: 7, salary: 11000, region: "europe" },
  { id: 214, name: "Steve Guerdat", nat: "🇨🇭 Switzerland", rank: 10, salary: 9500, region: "europe" },
  { id: 215, name: "Daniel Bluman", nat: "🇮🇱 Israel", rank: 12, salary: 9000, region: "americas" },
  { id: 216, name: "Mclain Ward", nat: "🇺🇸 USA", rank: 14, salary: 8500, region: "americas" },
  { id: 217, name: "Karl Cook", nat: "🇺🇸 USA", rank: 16, salary: 8000, region: "americas" },
  { id: 218, name: "Daniel Coyle", nat: "🇮🇪 Ireland", rank: 17, salary: 8000, region: "europe" },
  { id: 219, name: "Willem Greve", nat: "🇳🇱 Netherlands", rank: 23, salary: 7000, region: "europe" },
  { id: 220, name: "Erynn Ballard", nat: "🇨🇦 Canada", rank: 25, salary: 7000, region: "americas" },
  { id: 221, name: "Martin Fuchs", nat: "🇨🇭 Switzerland", rank: 27, salary: 6500, region: "europe" },
  { id: 222, name: "Aaron Vale", nat: "🇺🇸 USA", rank: 31, salary: 6000, region: "americas" },
  { id: 223, name: "Jordan Coyle", nat: "🇮🇪 Ireland", rank: 38, salary: 5500, region: "europe" },
  { id: 224, name: "Harry Charles", nat: "🇬🇧 UK", rank: 48, salary: 5000, region: "europe" },
  { id: 225, name: "Darragh Kenny", nat: "🇮🇪 Ireland", rank: 51, salary: 4500, region: "europe" },
  { id: 226, name: "Harry Allen", nat: "🇮🇪 Ireland", rank: 272, salary: 1000, region: "europe" },
  { id: 227, name: "Julien Anquetin", nat: "🇫🇷 France", rank: 99, salary: 3000, region: "europe" },
  { id: 228, name: "Arthur Le Vot", nat: "🇫🇷 France", rank: 999, salary: 1000, region: "europe" },
  { id: 229, name: "Alexa Ferrer", nat: "🇫🇷 France", rank: 999, salary: 1000, region: "europe" },
  { id: 230, name: "Jean-Luc Mourier", nat: "🇫🇷 France", rank: 999, salary: 1000, region: "europe" },
  { id: 231, name: "Marc Dilasser", nat: "🇫🇷 France", rank: 116, salary: 2500, region: "europe" },
  { id: 232, name: "Mégan Moissonnier", nat: "🇫🇷 France", rank: 138, salary: 2000, region: "europe" },
  { id: 233, name: "Penelope Leprevost", nat: "🇫🇷 France", rank: 124, salary: 2000, region: "europe" },
  { id: 234, name: "Roger-Yves Bost", nat: "🇫🇷 France", rank: 86, salary: 3000, region: "europe" },
  { id: 235, name: "Lillie Keenan", nat: "🇺🇸 USA", rank: 29, salary: 6500, region: "americas" },
  { id: 236, name: "Zayna Rizvi", nat: "🇺🇸 USA", rank: 265, salary: 1000, region: "americas" },
  { id: 237, name: "Alex Matz", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 238, name: "Amy Millar", nat: "🇨🇦 Canada", rank: 999, salary: 1000, region: "mlsj" },
  { id: 239, name: "Callie Schott", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 240, name: "Francisco Goyoaga Mollet", nat: "🇪🇸 Spain", rank: 999, salary: 1000, region: "mlsj" },
  { id: 241, name: "Natalie Dean", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 242, name: "Charlotte Jacobs", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 243, name: "Conor Swail", nat: "🇮🇪 Ireland", rank: 999, salary: 1000, region: "mlsj" },
  { id: 244, name: "Mark Bluman", nat: "🇨🇴 Colombia", rank: 999, salary: 1000, region: "mlsj" },
  { id: 245, name: "Uma O'Niell", nat: "🇳🇿 New Zealand", rank: 999, salary: 1000, region: "mlsj" },
  { id: 246, name: "Thaisa Erwin", nat: "🇦🇺 Australia", rank: 999, salary: 1000, region: "mlsj" },
  { id: 247, name: "Vanessa Hood", nat: "🇮🇱 Israel", rank: 999, salary: 1000, region: "mlsj" },
  { id: 248, name: "Gabriel de Matos Machado", nat: "🇧🇷 Brazil", rank: 999, salary: 1000, region: "mlsj" },
  { id: 249, name: "Kyle Timm", nat: "🇨🇦 Canada", rank: 999, salary: 1000, region: "mlsj" },
  { id: 250, name: "Cassidy Rein", nat: "🇨🇦 Canada", rank: 999, salary: 1000, region: "mlsj" },
  { id: 251, name: "Nikki Walker", nat: "🇨🇦 Canada", rank: 999, salary: 1000, region: "mlsj" },
  { id: 252, name: "Jessica Springsteen", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 253, name: "Kyle King", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 254, name: "Elisa Broz", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 255, name: "Skylar Wireman", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 256, name: "Marilyn Little", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 257, name: "Elena A Haas", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 258, name: "Eduardo Pereira De Menezes", nat: "🇧🇷 Brazil", rank: 999, salary: 1000, region: "mlsj" },
  { id: 259, name: "Roberto Teran", nat: "🇨🇴 Colombia", rank: 999, salary: 1000, region: "mlsj" },
  { id: 260, name: "Rene Dittmer", nat: "🇩🇪 Germany", rank: 999, salary: 1000, region: "mlsj" },
  { id: 261, name: "Tony Stormanns", nat: "🇩🇪 Germany", rank: 999, salary: 1000, region: "mlsj" },
  { id: 262, name: "Michael Duffy", nat: "🇮🇪 Ireland", rank: 999, salary: 1000, region: "mlsj" },
  { id: 263, name: "Genevieve Meyer", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 264, name: "Cassio Rivetti", nat: "🇧🇷 Brazil", rank: 999, salary: 1000, region: "mlsj" },
  { id: 265, name: "David O'Brien", nat: "🇮🇪 Ireland", rank: 999, salary: 1000, region: "mlsj" },
  { id: 266, name: "Stella Wasserman", nat: "🇺🇸 USA", rank: 999, salary: 1000, region: "mlsj" },
  { id: 267, name: "Mario Deslauriers", nat: "🇨🇦 Canada", rank: 999, salary: 1000, region: "mlsj" },
  { id: 268, name: "Rodrigo Pessoa", nat: "🇧🇷 Brazil", rank: 999, salary: 1000, region: "mlsj" },
];

// REPLACE the existing GCL_TEAMS_2026 array in equiprix-data.js with this
// block in its entirety. Corrected to match the official GCL 2026 Standings
// PDF exactly (rank, pts). Salary follows the same banding curve the app
// already used (11000 down to 3000 across 17 teams), now applied in the
// CORRECT rank order so the highest real points total gets the highest
// salary — this was previously out of sync because pts were stale.

export const GCL_TEAMS_2026 = [
  { id: 't03', name: 'Prague Lions', pts: 114, rank: 1, salary: 11000, key: 'Spits · Devos · Bruynseels · Demirsoy' },
  { id: 't08', name: 'Riesenbeck International', pts: 101, rank: 2, salary: 10000, key: 'Weishaupt · Nallon · Kukuk · Camilli' },
  { id: 't01', name: 'Istanbul Warriors', pts: 98, rank: 3, salary: 9000, key: 'von Eckermann · Saïd · Delestre · Siyahi' },
  { id: 't02', name: 'Basel Cosmopolitans', pts: 98, rank: 4, salary: 8000, key: 'Nygaard · Schou · N. Philippaerts · O. Philippaerts' },
  { id: 't11', name: 'New York Empire', pts: 94, rank: 5, salary: 8000, key: 'Brash · M. Wachman · Allen · Lynch' },
  { id: 't06', name: 'Monaco Aces', pts: 92, rank: 6, salary: 7000, key: 'Fredricson · Mansur · Seabra · Cottard' },
  { id: 't10', name: 'Cannes Stars', pts: 92, rank: 7, salary: 7000, key: 'Nielsen · Sprehe · K. Eckermann · Hinners' },
  { id: 't12', name: 'Doha Falcons', pts: 89, rank: 8, salary: 6000, key: 'Mendoza · Thijssen · Budd · Pedersen' },
  { id: 't04', name: 'Valkenswaard United', pts: 84.5, rank: 9, salary: 6000, key: 'Thomas · Tops-Alexander · T. Philippaerts · Ehning' },
  { id: 't05', name: 'St. Tropez Pirates', pts: 82, rank: 10, salary: 5000, key: 'Sadran · Ermann · Guery · Bucci' },
  { id: 't07', name: 'Cairo Pharaohs', pts: 82, rank: 11, salary: 5000, key: 'Nassar · Malhas · Joly · Mulder' },
  { id: 't13', name: 'Shanghai Swans', pts: 76, rank: 12, salary: 4000, key: 'Deusser · Casadei · Maher · Kühner' },
  { id: 't09', name: 'Madrid In Motion', pts: 75, rank: 13, salary: 4000, key: 'Emmen · Alvarez Moya · van der Vleuten' },
  { id: 't15', name: 'Mexico Amigos', pts: 71, rank: 14, salary: 3500, key: 'Hank Guerreiro · Hank Conter · Menezes' },
  { id: 't16', name: 'Riyadh Knights', pts: 57, rank: 15, salary: 3500, key: "O'Connor · Gaudiano · T. Wachman" },
  { id: 't14', name: 'Scandinavian Vikings', pts: 50.5, rank: 16, salary: 3000, key: 'Vrieling · Vingralkova · Matte Capdevila' },
  { id: 't17', name: 'Rome Gladiators', pts: 35, rank: 17, salary: 3000, key: 'Hochstaedter · Grimaldi · Kass · Pezzoli' },
];

export const EVENTS_2026 = [
  { id: 'miami_2026', city: 'Miami Beach', flag: '🇺🇸', dates: '3–5 Apr', dateLabel: '3–5 April 2026', status: 'past', supabaseKey: 'miami_2026_r1', teamLockISO: '2026-04-03T15:00:00Z', gpLockISO: '2026-04-05T15:00:00Z', riders: [], teams: [] },
  { id: 'mexico_2026', city: 'Mexico City', flag: '🇲🇽', dates: '16–19 Apr', dateLabel: '16–19 April 2026', status: 'past', supabaseKey: 'mexico_2026_r1', teamLockISO: '2026-04-17T15:00:00Z', gpLockISO: '2026-04-19T15:00:00Z', riders: [], teams: [] },
  { id: 'shanghai_2026', city: 'Shanghai', flag: '🇨🇳', dates: '1–3 May', dateLabel: '1–3 May 2026', status: 'past', supabaseKey: 'shanghai_2026_r1', teamLockISO: '2026-05-01T09:00:00Z', gpLockISO: '2026-05-03T09:00:00Z', riders: [], teams: [] },
  { id: 'madrid_2026', city: 'Madrid', flag: '🇪🇸', dates: '15–17 May', dateLabel: '15–17 May 2026', status: 'past', supabaseKey: 'madrid_2026_r1', teamLockISO: '2026-05-15T14:00:00Z', gpLockISO: '2026-05-17T14:00:00Z', riders: [], teams: [] },
  {
    id: 'cannes_2026', city: 'Cannes', flag: '🇫🇷', dates: '4–6 Jun', dateLabel: '4–6 June 2026', status: 'past', supabaseKey: 'cannes_2026_r1',
    teamLockISO: '2026-06-04T15:00:00Z', gpLockISO: '2026-06-06T15:00:00Z',
    riders: [
      { id: 1, name: "Scott Brash", nat: "🇬🇧 UK", rank: 3, salary: 13000, region: "europe", horse: "Hello Jefferson" },
      { id: 2, name: "Gilles Thomas", nat: "🇧🇪 Belgium", rank: 5, salary: 12000, region: "europe", horse: "Chuck Marienshof Z" },
      { id: 3, name: "Henrik von Eckermann", nat: "🇸🇪 Sweden", rank: 11, salary: 9500, region: "europe", horse: "King Edward" },
      { id: 4, name: "Harrie Smolders", nat: "🇳🇱 Netherlands", rank: 13, salary: 8500, region: "europe", horse: "" },
      { id: 5, name: "Philipp Weishaupt", nat: "🇩🇪 Germany", rank: 15, salary: 8000, region: "europe", horse: "Oreo D.R." },
      { id: 6, name: "Daniel Deusser", nat: "🇩🇪 Germany", rank: 18, salary: 8000, region: "europe", horse: "Otello de Guldenboom" },
      { id: 7, name: "Pieter Devos", nat: "🇧🇪 Belgium", rank: 20, salary: 7500, region: "europe", horse: "Primo DV" },
      { id: 8, name: "Simon Delestre", nat: "🇫🇷 France", rank: 22, salary: 7000, region: "europe", horse: "" },
      { id: 9, name: "Edwina Tops-Alexander", nat: "🇦🇺 Australia", rank: 28, salary: 6500, region: "europe", horse: "Fellow Castlefield" },
      { id: 10, name: "Kim Emmen", nat: "🇳🇱 Netherlands", rank: 46, salary: 5000, region: "europe", horse: "Hellix du Seigneur" },
      { id: 11, name: "Nayel Nassar", nat: "🇺🇸 USA", rank: 48, salary: 5000, region: "americas", horse: "Orphea HQ" },
      { id: 12, name: "Emanuele Gaudiano", nat: "🇮🇹 Italy", rank: 57, salary: 4500, region: "europe", horse: "Chalou's Love PS" },
      { id: 13, name: "Jur Vrieling", nat: "🇳🇱 Netherlands", rank: 42, salary: 5500, region: "europe", horse: "Corlou PS" },
      { id: 14, name: "Sanne Thijssen", nat: "🇳🇱 Netherlands", rank: 44, salary: 5000, region: "europe", horse: "Cupcake Z" },
      { id: 15, name: "Cian O'Connor", nat: "🇮🇪 Ireland", rank: 52, salary: 4500, region: "europe", horse: "Gospel Tame" },
    ],
    teams: GCL_TEAMS_2026
  },
  {
    id: 'st_tropez_2026', city: 'St. Tropez', flag: '🇫🇷', dates: '11–13 Jun', dateLabel: '11–13 June 2026', status: 'riders', supabaseKey: 'st_tropez_2026_r1',
    teamLockISO: '2026-06-11T14:00:00Z', gpLockISO: '2026-06-14T14:00:00Z',
    gpRiders: [
      { id: 105, name: "Christian Kukuk", nat: "🇩🇪 Germany", rank: 8, salary: 10500, region: "europe", horse: "Checker 47" },
      { id: 202, name: "Abdel Saïd", nat: "🇧🇪 Belgium", rank: 19, salary: 7500, region: "europe", horse: "Wathnan Quaker Brimbelles Z" },
      { id: 128, name: "Max Kühner", nat: "🇦🇹 Austria", rank: 26, salary: 6500, region: "europe", horse: "EIC Up Too Jacco Blue" },
      { id: 208, name: "Kristen Vanderveen", nat: "🇺🇸 USA", rank: 29, salary: 6500, region: "americas", horse: "Bull Run's Jireh" },
      { id: 146, name: "Thibeau Spits", nat: "🇧🇪 Belgium", rank: 33, salary: 6000, region: "europe", horse: "Impress-K Van't Kattenheye Z" },
      { id: 140, name: "Kim Emmen", nat: "🇳🇱 Netherlands", rank: 42, salary: 5000, region: "europe", horse: "Hellix Du Seigneur" },
      { id: 156, name: "Emanuele Gaudiano", nat: "🇮🇹 Italy", rank: 57, salary: 4500, region: "europe", horse: "Esteban De Hus" },
      { id: 166, name: "Denis Lynch", nat: "🇮🇪 Ireland", rank: 60, salary: 4500, region: "europe", horse: "Conterno-Blue PS" },
      { id: 126, name: "Hans-Dieter Dreher", nat: "🇩🇪 Germany", rank: 66, salary: 4000, region: "europe", horse: "Elysium" },
      { id: 121, name: "Katrin Eckermann", nat: "🇩🇪 Germany", rank: 76, salary: 3500, region: "europe", horse: "Iron Dames Dialou Blue PS" },
      { id: 106, name: "Peder Fredricson", nat: "🇸🇪 Sweden", rank: 78, salary: 3500, region: "europe", horse: "Alcapone Des Carmille" },
      { id: 125, name: "Jérôme Guery", nat: "🇧🇪 Belgium", rank: 80, salary: 3500, region: "europe", horse: "Quito De Mariposa" },
      { id: 227, name: "Julien Anquetin", nat: "🇫🇷 France", rank: 99, salary: 3000, region: "europe", horse: "Beau De Laubry Z" },
      { id: 164, name: "Michael Pender", nat: "🇮🇪 Ireland", rank: 105, salary: 2500, region: "europe", horse: "HHS Cyprus" },
      { id: 107, name: "Maikel van der Vleuten", nat: "🇳🇱 Netherlands", rank: 107, salary: 2500, region: "europe", horse: "Quastor VD Heffinck" },
      { id: 168, name: "Kaitlin Campbell", nat: "🇺🇸 USA", rank: 107, salary: 2500, region: "americas", horse: "Karius" },
      { id: 127, name: "Niels Bruynseels", nat: "🇧🇪 Belgium", rank: 110, salary: 2500, region: "europe", horse: "Delux Van T&L" },
      { id: 150, name: "Giacomo Casadei", nat: "🇮🇹 Italy", rank: 120, salary: 2500, region: "europe", horse: "Chagracon PS" },
      { id: 210, name: "Robin Muhr", nat: "🇮🇱 Israel", rank: 125, salary: 2000, region: "europe", horse: "Galaxy HM" },
      { id: 114, name: "Marcus Ehning", nat: "🇩🇪 Germany", rank: 132, salary: 2000, region: "europe", horse: "Priam Du Roset" },
      { id: 133, name: "Anastasia Nielsen", nat: "🇲🇨 Monaco", rank: 134, salary: 2000, region: "europe", horse: "ESI Rocky" },
      { id: 138, name: "Duarte Seabra", nat: "🇵🇹 Portugal", rank: 138, salary: 2000, region: "europe", horse: "Cooper LB" },
      { id: 143, name: "Sergio Alvarez Moya", nat: "🇪🇸 Spain", rank: 143, salary: 2000, region: "europe", horse: "No Nonsense TN" },
      { id: 148, name: "Jeanne Sadran", nat: "🇫🇷 France", rank: 148, salary: 2000, region: "europe", horse: "Dexter De Kerglenn" },
      { id: 178, name: "Annelies Vorsselmans", nat: "🇧🇪 Belgium", rank: 149, salary: 2000, region: "europe", horse: "VDL Kelton" },
      { id: 117, name: "Olivier Philippaerts", nat: "🇧🇪 Belgium", rank: 166, salary: 1500, region: "europe", horse: "Hipster SV" },
      { id: 120, name: "Edwina Tops-Alexander", nat: "🇦🇺 Australia", rank: 176, salary: 1500, region: "europe", horse: "Fellow Castlefield" },
      { id: 163, name: "Zoe Hank Conter", nat: "🇧🇪 Belgium", rank: 177, salary: 1500, region: "americas", horse: "Tombola Z" },
      { id: 182, name: "Mathijs Van Asten", nat: "🇳🇱 Netherlands", rank: 182, salary: 1500, region: "europe", horse: "Vedet DK Z" },
      { id: 152, name: "Carlos Hank Guerreiro", nat: "🇲🇽 Mexico", rank: 152, salary: 1500, region: "americas", horse: "H5 Ganesh Hero Z" },
      { id: 154, name: "Sara Vingralkova", nat: "🇨🇿 Czech Rep.", rank: 154, salary: 1500, region: "europe", horse: "Rock'n Roll MXL" },
      { id: 165, name: "Eduardo Menezes", nat: "🇧🇷 Brazil", rank: 165, salary: 1500, region: "americas", horse: "H5 Knockando" },
      { id: 171, name: "Luiz Felipe Neto", nat: "🇧🇷 Brazil", rank: 171, salary: 1500, region: "americas", horse: "Pandora Boy Z" },
      { id: 160, name: "Inès Joly", nat: "🇫🇷 France", rank: 217, salary: 1000, region: "europe", horse: "Crack D'Aiguilly Z" },
      { id: 177, name: "Marlon Modolo Zanotelli", nat: "🇧🇷 Brazil", rank: 340, salary: 1000, region: "americas", horse: "Dorette Old" },
      { id: 173, name: "Caroline Rehoff Pedersen", nat: "🇩🇰 Denmark", rank: 368, salary: 1000, region: "europe", horse: "Polonis L" },
      { id: 191, name: "Efe Siyahi", nat: "🇹🇷 Turkey", rank: 749, salary: 1000, region: "europe", horse: "Cantate" },
      { id: 228, name: "Arthur Le Vot", nat: "🇫🇷 France", rank: 999, salary: 1000, region: "europe", horse: "Djinn Cece" },
      { id: 229, name: "Alexa Ferrer", nat: "🇫🇷 France", rank: 999, salary: 1000, region: "europe", horse: "Vitalhorse Fleur D'Oz" },
      { id: 230, name: "Jean-Luc Mourier", nat: "🇫🇷 France", rank: 999, salary: 1000, region: "europe", horse: "New Libero One D'Asschaut" },
    ],
    teams: GCL_TEAMS_2026,
  },
  { id: 'paris_2026', city: 'Paris', flag: '🇫🇷', dates: '19–21 Jun', dateLabel: '19–21 June 2026', status: 'future', supabaseKey: 'paris_2026_r1', teamLockISO: '2026-06-19T14:00:00Z', gpLockISO: '2026-06-21T14:00:00Z', gpRiders: [], teams: [] },
  { id: 'monaco_2026', city: 'Monaco', flag: '🇲🇨', dates: '2–4 Jul', dateLabel: '2–4 July 2026', status: 'future', supabaseKey: 'monaco_2026_r1', teamLockISO: '2026-07-02T14:00:00Z', gpLockISO: '2026-07-04T14:00:00Z', gpRiders: [], teams: [] },
  { id: 'riesenbeck_2026', city: 'Riesenbeck', flag: '🇩🇪', dates: '16–19 Jul', dateLabel: '16–19 July 2026', status: 'future', supabaseKey: 'riesenbeck_2026_r1', teamLockISO: '2026-07-16T14:00:00Z', gpLockISO: '2026-07-19T14:00:00Z', gpRiders: [], teams: [] },
  { id: 'london_2026', city: 'London', flag: '🇬🇧', dates: '7–9 Aug', dateLabel: '7–9 August 2026', status: 'future', supabaseKey: 'london_2026_r1', teamLockISO: '2026-08-07T14:00:00Z', gpLockISO: '2026-08-09T14:00:00Z', gpRiders: [], teams: [] },
  { id: 'valkenswaard_2026', city: 'Valkenswaard', flag: '🇳🇱', dates: '4–6 Sep', dateLabel: '4–6 September 2026', status: 'future', supabaseKey: 'valkenswaard_2026_r1', teamLockISO: '2026-09-04T14:00:00Z', gpLockISO: '2026-09-06T14:00:00Z', gpRiders: [], teams: [] },
  { id: 'vienna_2026', city: 'Vienna', flag: '🇦🇹', dates: '24–27 Sep', dateLabel: '24–27 September 2026', status: 'future', supabaseKey: 'vienna_2026_r1', teamLockISO: '2026-09-24T14:00:00Z', gpLockISO: '2026-09-27T14:00:00Z', gpRiders: [], teams: [] },
  { id: 'rome_2026', city: 'Rome', flag: '🇮🇹', dates: '9–11 Oct', dateLabel: '9–11 October 2026', status: 'future', supabaseKey: 'rome_2026_r1', teamLockISO: '2026-10-09T14:00:00Z', gpLockISO: '2026-10-11T14:00:00Z', gpRiders: [], teams: [] },
  { id: 'cairo_2026', city: 'Cairo', flag: '🇪🇬', dates: '22–24 Oct', dateLabel: '22–24 October 2026', status: 'future', supabaseKey: 'cairo_2026_r1', teamLockISO: '2026-10-22T14:00:00Z', gpLockISO: '2026-10-24T14:00:00Z', gpRiders: [], teams: [] },
  { id: 'rabat_2026', city: 'Rabat', flag: '🇲🇦', dates: '30 Oct–1 Nov', dateLabel: '30 Oct–1 Nov 2026', status: 'future', supabaseKey: 'rabat_2026_r1', teamLockISO: '2026-10-30T14:00:00Z', gpLockISO: '2026-11-01T14:00:00Z', gpRiders: [], teams: [] },
  { id: 'riyadh_2026', city: 'Riyadh Playoffs', flag: '🇸🇦', dates: '18–21 Nov', dateLabel: '18–21 November 2026', status: 'future', supabaseKey: 'riyadh_2026_r1', teamLockISO: '2026-11-18T12:00:00Z', gpLockISO: '2026-11-21T12:00:00Z', gpRiders: [], teams: [] },
];