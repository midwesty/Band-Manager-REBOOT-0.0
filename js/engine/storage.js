const LS_PREFIX = "bandscape_v2_";

export function lsKey(key) {
  return `${LS_PREFIX}${key}`;
}

export function loadJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("loadJSON failed:", key, e);
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(lsKey(key), JSON.stringify(value));
  } catch (e) {
    console.warn("saveJSON failed:", key, e);
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(lsKey(key));
  } catch (e) {
    console.warn("removeKey failed:", key, e);
  }
}
