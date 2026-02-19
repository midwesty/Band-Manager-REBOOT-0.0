async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.json();
}

export async function loadAllData() {
  const [items, buffs, guitar, location] = await Promise.all([
    fetchJSON("data/items.json"),
    fetchJSON("data/buffs.json"),
    fetchJSON("data/instruments/guitar.json"),
    fetchJSON("data/locations/apartment.json")
  ]);

  // Instruments registry by id
  const instruments = {};
  instruments[guitar.id] = guitar;

  return {
    items,
    buffs,
    instruments,
    location
  };
}
