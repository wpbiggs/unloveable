const KEY = "opencode.previewByDir";

type Entry = {
  url: string;
  pid?: number;
  startedAt?: number;
};

function dirKey(dir: string | null) {
  return dir && dir.trim() ? dir.trim() : "__default__";
}

function read(): Record<string, Entry> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, Entry> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const val = v as Record<string, unknown>;
      const url = val.url;
      if (typeof url !== "string" || !url.trim()) continue;
      const pid = val.pid;
      const startedAt = val.startedAt;
      out[k] = {
        url,
        pid: typeof pid === "number" ? pid : undefined,
        startedAt: typeof startedAt === "number" ? startedAt : undefined,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function write(map: Record<string, Entry>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export const OpenCodePreviewStore = {
  get(directory: string | null) {
    const map = read();
    return map[dirKey(directory)] ?? null;
  },
  set(directory: string | null, entry: Entry | null) {
    const map = read();
    const key = dirKey(directory);
    if (!entry) {
      delete map[key];
      write(map);
      return;
    }
    map[key] = entry;
    write(map);
  },
};
