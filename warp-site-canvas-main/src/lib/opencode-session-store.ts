const KEY = "opencode.activeSessionByDir";

function dirKey(dir: string | null) {
  return dir && dir.trim() ? dir.trim() : "__default__";
}

function readMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, string>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export const OpenCodeSessionStore = {
  get(directory: string | null) {
    const map = readMap();
    return map[dirKey(directory)] ?? null;
  },
  set(directory: string | null, sessionID: string | null) {
    const map = readMap();
    const key = dirKey(directory);
    if (!sessionID || !sessionID.trim()) {
      delete map[key];
      writeMap(map);
      return;
    }
    map[key] = sessionID.trim();
    writeMap(map);
  },
};
