// Shared localStorage store for start list data
// Used by StartListEditor to save, ResultsEditor to auto-populate

const KEY = 'equiprix_start_lists';

export function loadStartLists() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function saveStartList(eventId, data) {
  const all = loadStartLists();
  all[eventId] = data;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getStartList(eventId) {
  return loadStartLists()[eventId] || null;
}

// data shape: { gp: [{name, horse, rank, nat, id}], r1: { [teamId]: [{name, horse}, {name, horse}] }, r2: { [teamId]: [{name, horse}, {name, horse}] } }