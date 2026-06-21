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
      saveLocal(eventId, data);
      return data;
    }
  } catch (e) {
    console.warn('Could not load start list from Supabase:', e);
  }
  return loadLocal()[eventId] || null;
}

// supabaseKey is the event's supabaseKey (e.g. 'paris_2026_r1') — needed
// to also mirror GP riders into results.gp_riders so EquiPrixContext's
// loadEventData picks them up for the Draft tab's Riders list. The
// start_lists table uses the plain eventId as its key; results uses
// supabaseKey. Both are updated together on every save so they stay
// in sync.
export async function saveStartListRemote(eventId, data, supabaseKey) {
  // Save to localStorage immediately
  saveLocal(eventId, data);

  try {
    // 1. Save to start_lists (primary home for this data)
    const existing = await sbFetch('start_lists?event=eq.' + eventId + '&limit=1');
    if (existing && existing.length > 0) {
      await sbFetch('start_lists?event=eq.' + eventId, {
        method: 'PATCH',
        body: JSON.stringify({
          gp: data.gp || [],
          team_pairs: data.teamPairs || {},
          updated_at: new Date().toISOString()
        })
      });
    } else {
      await sbFetch('start_lists', {
        method: 'POST',
        body: JSON.stringify({
          event: eventId,
          gp: data.gp || [],
          team_pairs: data.teamPairs || {},
          updated_at: new Date().toISOString()
        })
      });
    }

    // 2. Mirror GP riders into results.gp_riders so EquiPrixContext's
    // loadEventData can read them for the Draft tab's Riders list.
    // This is the existing read path — EquiPrixContext reads from
    // results, not start_lists, so we write to both to keep them in
    // sync rather than changing the read path.
    if (supabaseKey && data.gp?.length) {
      const resRows = await sbFetch('results?event=eq.' + supabaseKey + '&limit=1');
      if (resRows && resRows.length > 0) {
        await sbFetch('results?event=eq.' + supabaseKey, {
          method: 'PATCH',
          body: JSON.stringify({
            gp_riders: data.gp,
            updated_at: new Date().toISOString()
          })
        });
      } else {
        await sbFetch('results', {
          method: 'POST',
          body: JSON.stringify({
            event: supabaseKey,
            gp_riders: data.gp,
            updated_at: new Date().toISOString()
          })
        });
      }
    }
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