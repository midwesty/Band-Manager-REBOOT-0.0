async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.json();
}

async function fetchJSONOptional(path, fallback) {
  try {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

export async function loadAllData() {
  const [items, buffs, guitar, location, npcs] = await Promise.all([
    fetchJSON("data/items.json"),
    fetchJSON("data/buffs.json"),
    fetchJSON("data/instruments/guitar.json"),
    fetchJSON("data/locations/apartment.json"),
    fetchJSONOptional("data/npcs.json", { npcs: [] })
  ]);

  const instruments = {};
  instruments[guitar.id] = guitar;

  return {
    items,
    buffs,
    instruments,
    location,
    npcs
  };
}