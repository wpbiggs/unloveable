const KEY_AGENT = "opencode.pref.agent";
const KEY_MODEL = "opencode.pref.model";

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

export const OpenCodePreferences = {
  agent: {
    get() {
      return get(KEY_AGENT);
    },
    set(value: string | null) {
      set(KEY_AGENT, value);
    },
  },
  model: {
    get() {
      return get(KEY_MODEL);
    },
    set(value: string | null) {
      set(KEY_MODEL, value);
    },
  },
};
