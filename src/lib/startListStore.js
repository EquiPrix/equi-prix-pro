import { sbFetch } from '@/lib/equiprix-data';

// localStorage cache key
const KEY = 'equiprix_start_lists';
const HORSE_KEY = 'equiprix_horse_db';

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

function saveLocal(eventId, data) {
  const all = loadLocal();
  all[eventId] = data;
  localStorage.setItem(KEY, JSON.stringify(all));
}

function loadHorseDBLocal() {
  try { return JSON.parse(localStorage.getItem(HORSE_KEY) || '{}'); } catch { return {}; }
}

function saveHorseDBLocal(db) {
  localStorage.setItem(HORSE_KEY, JSON.stringify(db));
}

// ── Start list: load from Supabase, fall back to localStorage ─────────────────

export async function loadStartListRemote(eventId) {
  try {
    const rows = await sbFetch('start_lists?event=eq.' + eventId + '&limit=1');
    if (rows && rows.length) {
      const data = {
        gp: rows[0].gp || [],
        teamPairs: rows[0].team_pairs || {},
      };
      saveLocal(eventId, data); // update local cache
      return data;
    }
  } catch (e) {
    console.warn('Could not load start list from Supabase:', e);
  }
  // Fall back to localStorage cache
  return loadLocal()[eventId] || null;
}

export async function saveStartListRemote(eventId, data) {
  // Save to localStorage immediately
  saveLocal(eventId, data);

  // Save to Supabase
  try {
    await sbFetch('start_lists', {
      method: 'POST',
      body: JSON.stringify({
        event: eventId,
        gp: data.gp || [],
        team_pairs: data.teamPairs || {},
        updated_at: new Date().toISOString()
      })
    });
  } catch (e) {
    console.error('Could not save start list to Supabase:', e);
  }
}

// ── Horse DB: load from Supabase, merge with localStorage ────────────────────

export async function loadHorseDBRemote() {
  try {
    const rows = await sbFetch('results?event=eq.horse_registry&limit=1');
    if (rows && rows.length && rows[0].rider_results) {
      const remoteDB = rows[0].rider_results;
      // Merge remote into local (remote wins)
      const localDB = loadHorseDBLocal();
      const merged = { ...localDB };
      Object.entries(remoteDB).forEach(([rider, horses]) => {
        if (!merged[rider]) merged[rider] = [];
        horses.forEach(h => {
          if (!merged[rider].includes(h)) merged[rider].push(h);
        });
      });
      saveHorseDBLocal(merged);
      return merged;
    }
  } catch (e) {
    console.warn('Could not load horse DB from Supabase:', e);
  }
  return loadHorseDBLocal();
}

export async function saveHorseDBRemote(db) {
  saveHorseDBLocal(db);
  try {
    await sbFetch('results', {
      method: 'POST',
      body: JSON.stringify({
        event: 'horse_registry',
        rider_results: db,
        updated_at: new Date().toISOString()
      })
    });
  } catch (e) {
    console.error('Could not save horse DB to Supabase:', e);
  }
}

// ── Legacy sync API (for backward compat with ResultsEditor) ─────────────────

export function loadStartLists() {
  return loadLocal();
}

export function saveStartList(eventId, data) {
  saveLocal(eventId, data);
}

export function getStartList(eventId) {
  return loadLocal()[eventId] || null;
}