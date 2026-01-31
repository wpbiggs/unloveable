type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type OpenCodeSession = {
  id: string;
  slug: string;
  projectID: string;
  directory: string;
  parentID?: string;
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
    compacting?: number;
    archived?: number;
  };
};

export type OpenCodeSessionMessage = {
  info: {
    id: string;
    role: "user" | "assistant";
    time: { created: number; completed?: number };
    error?: Json;
  };
  parts: OpenCodeMessagePart[];
};

export type OpenCodeFileDiff = {
  file: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
};

export type OpenCodeFileNode = {
  name: string;
  path: string;
  absolute: string;
  type: "file" | "directory";
  ignored: boolean;
};

export type OpenCodeFileContent = {
  type: "text";
  content: string;
  diff?: string;
  encoding?: "base64";
  mimeType?: string;
};

export type OpenCodeMessagePart = {
  type: string;
  [key: string]: Json;
};

export type OpenCodeMessageResponse = {
  info: {
    id: string;
    role?: string;
    error?: Json;
  };
  parts: OpenCodeMessagePart[];
};

export type OpenCodePromptModel = {
  providerID: string;
  modelID: string;
};

export type OpenCodePromptInput = {
  parts: OpenCodePromptPart[];
  agent?: string;
  model?: OpenCodePromptModel;
  variant?: string;
  system?: string;
  noReply?: boolean;
};

export type OpenCodePromptPart =
  | {
      type: "text";
      text: string;
      id?: string;
    }
  | {
      type: "file";
      url: string;
      mime: string;
      filename?: string;
      id?: string;
    };

export type OpenCodeAuthInfo =
  | {
      type: "api";
      key: string;
    }
  | {
      type: "oauth";
      refresh: string;
      access: string;
      expires: number;
      accountId?: string;
      enterpriseUrl?: string;
    }
  | {
      type: "wellknown";
      key: string;
      token: string;
    };

export type OpenCodeProviderInfo = {
  id: string;
  name: string;
  source: "env" | "config" | "custom" | "api";
  env: string[];
  key?: string;
  options: Record<string, Json>;
  models: Record<string, Json>;
};

export type OpenCodeProviderListResponse = {
  all: OpenCodeProviderInfo[];
  default: Record<string, string>;
  connected: string[];
};

export type OpenCodeProviderAuthMethod = {
  type: "oauth" | "api";
  label: string;
};

export type OpenCodeProviderAuthMethodsResponse = Record<string, OpenCodeProviderAuthMethod[]>;

export type OpenCodeProviderAuthorization = {
  url: string;
  method: "auto" | "code";
  instructions: string;
};

export type OpenCodeConfig = Record<string, Json>;

const DIRECTORY_STORAGE_KEY = "opencode.directory";

function getDirectoryOverride() {
  try {
    const v = window.localStorage.getItem(DIRECTORY_STORAGE_KEY);
    if (v && v.trim()) return v.trim();
  } catch {
    // ignore
  }
  return undefined;
}

function setDirectoryOverride(dir: string | null) {
  try {
    if (!dir || !dir.trim()) {
      window.localStorage.removeItem(DIRECTORY_STORAGE_KEY);
      return;
    }
    const cleanDir = dir.trim();

    // Safety checks
    const forbidden = [
      /^\/$/, // Unix root
      /^[a-zA-Z]:\\$/, // Windows root drive (C:\)
      /^[a-zA-Z]:\/$/, // Windows root drive (C:/)
      /^\/(etc|var|bin|usr|sbin|sys|proc|dev|root|boot|lib|lib64|opt|srv|tmp|run)(\/|$)/, // System dirs
      /\.\./, // Parent directory traversal
    ];

    if (forbidden.some(regex => regex.test(cleanDir))) {
      throw new Error("Path is not allowed");
    }

    window.localStorage.setItem(DIRECTORY_STORAGE_KEY, cleanDir);
  } catch (err) {
    if (err instanceof Error && err.message === "Path is not allowed") {
        throw err;
    }
    // ignore storage errors
  }
}

function baseUrl() {
  const raw = (import.meta.env.VITE_OPENCODE_URL as string | undefined) || "http://localhost:4096";
  return raw.replace(/\/$/, "");
}

function directoryParam() {
  const override = getDirectoryOverride();
  if (override) return override;

  const dir = import.meta.env.VITE_OPENCODE_DIRECTORY as string | undefined;
  return dir && dir.trim() ? dir.trim() : undefined;
}

function buildUrl(pathname: string, query?: Record<string, string | undefined>) {
  const url = new URL(baseUrl() + pathname);
  const dir = directoryParam();
  if (dir) url.searchParams.set("directory", dir);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function requestJson<T>(pathname: string, init?: RequestInit, query?: Record<string, string | undefined>): Promise<T> {
  const res = await fetch(buildUrl(pathname, query), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: init?.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `OpenCode request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

async function requestRaw(pathname: string, init?: RequestInit, query?: Record<string, string | undefined>): Promise<Response> {
  const res = await fetch(buildUrl(pathname, query), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: init?.signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `OpenCode request failed (${res.status})`);
  }
  return res;
}

export const OpenCode = {
  async health() {
    return requestJson<{ healthy: true; version: string }>("/global/health");
  },

  async pathInfo() {
    return requestJson<{ directory: string; worktree: string }>("/path");
  },

  async createSession() {
    return requestJson<OpenCodeSession>("/session", { method: "POST", body: JSON.stringify({}) });
  },

  async listSessions(query?: { roots?: boolean; start?: number; search?: string; limit?: number }, signal?: AbortSignal) {
    return requestJson<OpenCodeSession[]>("/session", { signal }, {
      roots: query?.roots === undefined ? undefined : String(query.roots),
      start: query?.start === undefined ? undefined : String(query.start),
      search: query?.search,
      limit: query?.limit === undefined ? undefined : String(query.limit),
    });
  },

  async getSession(sessionID: string) {
    return requestJson<OpenCodeSession>(`/session/${encodeURIComponent(sessionID)}`);
  },

  async listMessages(sessionID: string, limit?: number) {
    return requestJson<OpenCodeSessionMessage[]>(`/session/${encodeURIComponent(sessionID)}/message`, undefined, {
      limit: limit === undefined ? undefined : String(limit),
    });
  },

  async getMessage(sessionID: string, messageID: string) {
    return requestJson<OpenCodeSessionMessage>(
      `/session/${encodeURIComponent(sessionID)}/message/${encodeURIComponent(messageID)}`,
    );
  },

  async sessionDiff(sessionID: string, messageID?: string) {
    return requestJson<OpenCodeFileDiff[]>(`/session/${encodeURIComponent(sessionID)}/diff`, undefined, {
      messageID,
    });
  },

  async revert(sessionID: string, input: { messageID: string; partID?: string }) {
    return requestJson<OpenCodeSession>(`/session/${encodeURIComponent(sessionID)}/revert`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async runShell(sessionID: string, command: string, input?: { agent?: string; model?: OpenCodePromptModel; signal?: AbortSignal }) {
    const body = {
      agent: input?.agent ?? "task",
      model: input?.model,
      command,
    };

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const max = 10;
    const signal = input?.signal;

    for (let i = 0; i < max; i++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      try {
        return await requestJson<Json>(`/session/${encodeURIComponent(sessionID)}/shell`, {
          method: "POST",
          body: JSON.stringify(body),
          signal,
        });
      } catch (err) {
        if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) throw err;
        const msg = err instanceof Error ? err.message : "";
        if (!/is busy/i.test(msg) || i === max - 1) throw err;
        await wait(200 + i * 150);
      }
    }

    // unreachable
    return requestJson<Json>(`/session/${encodeURIComponent(sessionID)}/shell`, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
  },

  async abortSession(sessionID: string) {
    return requestJson<boolean>(`/session/${encodeURIComponent(sessionID)}/abort`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  async sendMessage(
    sessionID: string,
    parts: OpenCodePromptPart[],
    input?: Omit<OpenCodePromptInput, "parts">,
    signal?: AbortSignal,
  ) {
    return requestJson<OpenCodeMessageResponse>(
      `/session/${encodeURIComponent(sessionID)}/message`,
      {
        method: "POST",
        body: JSON.stringify({
          parts,
          ...(input ?? {}),
        }),
        signal,
      },
    );
  },

  async sendMessageRaw(
    sessionID: string,
    parts: OpenCodePromptPart[],
    input?: Omit<OpenCodePromptInput, "parts">,
    signal?: AbortSignal,
  ) {
    return requestRaw(
      `/session/${encodeURIComponent(sessionID)}/message`,
      {
        method: "POST",
        body: JSON.stringify({
          parts,
          ...(input ?? {}),
        }),
        signal,
      },
    );
  },

  async sendTextMessage(sessionID: string, text: string, input?: Omit<OpenCodePromptInput, "parts">, signal?: AbortSignal) {
    return OpenCode.sendMessage(sessionID, [{ type: "text", text }], input, signal);
  },

  async sendTextMessageRaw(
    sessionID: string,
    text: string,
    input?: Omit<OpenCodePromptInput, "parts">,
    signal?: AbortSignal,
  ) {
    return OpenCode.sendMessageRaw(sessionID, [{ type: "text", text }], input, signal);
  },

  async listFiles(path: string) {
    return requestJson<OpenCodeFileNode[]>("/file", undefined, { path });
  },

  async readFile(path: string) {
    return requestJson<OpenCodeFileContent>("/file/content", undefined, { path });
  },

  async writeFile(path: string, content: string) {
    return requestJson<void>("/file/content", {
      method: "PUT",
      body: JSON.stringify({ content }),
    }, { path });
  },

  async fileStatus() {
    return requestJson<Array<{ path: string; status: "added" | "deleted" | "modified"; added: number; removed: number }>>(
      "/file/status",
    );
  },

  async listProviders() {
    return requestJson<OpenCodeProviderListResponse>("/provider");
  },

  async providerAuthMethods() {
    return requestJson<OpenCodeProviderAuthMethodsResponse>("/provider/auth");
  },

  async providerOAuthAuthorize(providerID: string, method: number) {
    return requestJson<OpenCodeProviderAuthorization | undefined>(
      `/provider/${encodeURIComponent(providerID)}/oauth/authorize`,
      {
        method: "POST",
        body: JSON.stringify({ method }),
      },
    );
  },

  async providerOAuthCallback(providerID: string, method: number, code?: string) {
    return requestJson<boolean>(`/provider/${encodeURIComponent(providerID)}/oauth/callback`, {
      method: "POST",
      body: JSON.stringify({ method, code }),
    });
  },

  async getConfig() {
    return requestJson<OpenCodeConfig>("/config");
  },

  async patchConfig(patch: OpenCodeConfig) {
    return requestJson<OpenCodeConfig>("/config", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async setAuth(providerID: string, auth: OpenCodeAuthInfo) {
    return requestJson<boolean>(`/auth/${encodeURIComponent(providerID)}`, {
      method: "PUT",
      body: JSON.stringify(auth),
    });
  },

  async removeAuth(providerID: string) {
    return requestJson<boolean>(`/auth/${encodeURIComponent(providerID)}`, {
      method: "DELETE",
    });
  },
};

export const OpenCodeDirectory = {
  get() {
    return getDirectoryOverride() ?? (import.meta.env.VITE_OPENCODE_DIRECTORY as string | undefined) ?? null;
  },
  set(dir: string | null) {
    setDirectoryOverride(dir);
  },
};
