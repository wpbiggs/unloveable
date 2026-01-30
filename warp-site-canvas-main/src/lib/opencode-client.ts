type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type OpenCodeSession = {
  id: string;
  title: string;
  directory: string;
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
    error?: { message?: string };
  };
  parts: OpenCodeMessagePart[];
};

function baseUrl() {
  const raw = (import.meta.env.VITE_OPENCODE_URL as string | undefined) || "http://localhost:4096";
  return raw.replace(/\/$/, "");
}

function directoryParam() {
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
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `OpenCode request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const OpenCode = {
  async health() {
    return requestJson<{ healthy: true; version: string }>("/global/health");
  },

  async createSession() {
    return requestJson<OpenCodeSession>("/session", { method: "POST", body: JSON.stringify({}) });
  },

  async abortSession(sessionID: string) {
    return requestJson<boolean>(`/session/${encodeURIComponent(sessionID)}/abort`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  async sendTextMessage(sessionID: string, text: string, signal?: AbortSignal) {
    return requestJson<OpenCodeMessageResponse>(
      `/session/${encodeURIComponent(sessionID)}/message`,
      {
        method: "POST",
        body: JSON.stringify({
          parts: [{ type: "text", text }],
        }),
        signal,
      },
    );
  },

  async listFiles(path: string) {
    return requestJson<OpenCodeFileNode[]>("/file", undefined, { path });
  },

  async readFile(path: string) {
    return requestJson<OpenCodeFileContent>("/file/content", undefined, { path });
  },

  async fileStatus() {
    return requestJson<Array<{ path: string; status: "added" | "deleted" | "modified"; added: number; removed: number }>>(
      "/file/status",
    );
  },
};
