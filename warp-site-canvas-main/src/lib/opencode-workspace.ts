const KEY_ROOT = "opencode.workspace.root";
const KEY_PROJECT_ID = "opencode.workspace.projectID";
const KEY_RECENT = "opencode.workspace.recent";
const KEY_SHARED = "opencode.workspace.linkShared";
const KEY_AUTO = "opencode.workspace.autoCreate";
const KEY_TEMPLATE = "opencode.workspace.defaultTemplate";
const KEY_SEQ = "opencode.workspace.seq";
const KEY_SUPABASE_ENABLED = "opencode.supabase.enabled";
const KEY_SUPABASE_URL = "opencode.supabase.url";
const KEY_SUPABASE_ANON = "opencode.supabase.anonKey";

function get(key: string) {
  try {
    const v = window.localStorage.getItem(key);
    if (v && v.trim()) return v.trim();
  } catch {
    // ignore
  }
  return null;
}

function set(key: string, value: string | null) {
  try {
    if (!value || !value.trim()) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value.trim());
  } catch {
    // ignore
  }
}

export const OpenCodeWorkspace = {
  root: {
    get() {
      return get(KEY_ROOT);
    },
    set(value: string | null) {
      set(KEY_ROOT, value);
    },
    defaultValue: "/home/will/opencode-test/workspaces",
  },
  project: {
    get() {
      return get(KEY_PROJECT_ID);
    },
    set(value: string | null) {
      set(KEY_PROJECT_ID, value);
    },
  },
  recent: {
    get() {
      try {
        const raw = window.localStorage.getItem(KEY_RECENT);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.every(s => typeof s === "string")) return parsed as string[];
      } catch {
        // ignore
      }
      return [];
    },
    set(value: string[]) {
      try {
        window.localStorage.setItem(KEY_RECENT, JSON.stringify(value));
      } catch {
        // ignore
      }
    },
    add(path: string) {
      const current = this.get();
      const next = [path, ...current.filter(p => p !== path)].slice(0, 20); // Keep top 20
      this.set(next);
    },
    remove(path: string) {
      const current = this.get();
      this.set(current.filter(p => p !== path));
    }
  },
  linkShared: {
    get() {
      try {
        const v = window.localStorage.getItem(KEY_SHARED);
        if (v === null) return true;
        return v === "true";
      } catch {
        return true;
      }
    },
    set(value: boolean) {
      try {
        window.localStorage.setItem(KEY_SHARED, value ? "true" : "false");
      } catch {
        // ignore
      }
    },
  },
  autoCreate: {
    get() {
      try {
        const v = window.localStorage.getItem(KEY_AUTO);
        if (v === null) return true;
        return v === "true";
      } catch {
        return true;
      }
    },
    set(value: boolean) {
      try {
        window.localStorage.setItem(KEY_AUTO, value ? "true" : "false");
      } catch {
        // ignore
      }
    },
  },
  defaultTemplate: {
    get() {
      try {
        const v = window.localStorage.getItem(KEY_TEMPLATE);
        if (v && v.trim()) return v.trim();
      } catch {
        // ignore
      }
      return "express-spa";
    },
    set(value: string) {
      try {
        window.localStorage.setItem(KEY_TEMPLATE, value.trim());
      } catch {
        // ignore
      }
    },
  },
  nextName(prefix?: string) {
    const base = (prefix && prefix.trim()) ? prefix.trim() : "ws";
    const next = (() => {
      try {
        const raw = window.localStorage.getItem(KEY_SEQ);
        const n = raw ? Number.parseInt(raw, 10) : 0;
        const v = Number.isFinite(n) ? n + 1 : 1;
        window.localStorage.setItem(KEY_SEQ, String(v));
        return v;
      } catch {
        return Date.now();
      }
    })();
    const id = typeof next === "number" ? String(next).padStart(4, "0") : String(next);
    return `${base}-${id}`;
  },
  supabase: {
    enabled: {
      get() {
        try {
          const v = window.localStorage.getItem(KEY_SUPABASE_ENABLED);
          if (v === null) return false;
          return v === "true";
        } catch {
          return false;
        }
      },
      set(value: boolean) {
        try {
          window.localStorage.setItem(KEY_SUPABASE_ENABLED, value ? "true" : "false");
        } catch {
          // ignore
        }
      },
    },
    url: {
      get() {
        try {
          const v = window.localStorage.getItem(KEY_SUPABASE_URL);
          if (v && v.trim()) return v.trim();
        } catch {
          // ignore
        }
        return "http://localhost:8000";
      },
      set(value: string) {
        try {
          window.localStorage.setItem(KEY_SUPABASE_URL, value.trim());
        } catch {
          // ignore
        }
      },
    },
    anonKey: {
      get() {
        try {
          const v = window.localStorage.getItem(KEY_SUPABASE_ANON);
          if (v && v.trim()) return v.trim();
        } catch {
          // ignore
        }
        return "";
      },
      set(value: string) {
        try {
          if (!value.trim()) {
            window.localStorage.removeItem(KEY_SUPABASE_ANON);
            return;
          }
          window.localStorage.setItem(KEY_SUPABASE_ANON, value.trim());
        } catch {
          // ignore
        }
      },
    },
  },
};
