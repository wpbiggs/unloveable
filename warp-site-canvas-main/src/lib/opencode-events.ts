type OpenCodeBusEvent = {
  type: string;
  properties: any;
};

type OpenCodeWireEvent =
  | OpenCodeBusEvent
  | {
      directory?: string;
      payload?: OpenCodeBusEvent;
    };

function baseUrl() {
  const raw = (import.meta.env.VITE_OPENCODE_URL as string | undefined) || "http://localhost:4096";
  return raw.replace(/\/$/, "");
}

function directoryParam() {
  try {
    const v = window.localStorage.getItem("opencode.directory");
    if (v && v.trim()) return v.trim();
  } catch {
    // ignore
  }

  const dir = import.meta.env.VITE_OPENCODE_DIRECTORY as string | undefined;
  return dir && dir.trim() ? dir.trim() : undefined;
}

export function openOpenCodeEvents(onEvent: (evt: OpenCodeBusEvent) => void) {
  if (typeof (globalThis as any).EventSource !== "function") {
    return () => undefined;
  }

  const url = new URL(baseUrl() + "/event");
  const dir = directoryParam();
  if (dir) url.searchParams.set("directory", dir);

  const es = new EventSource(url.toString());

  // Synthetic client events so the UI can show connectivity.
  es.onopen = () => {
    onEvent({ type: "client.sse.open", properties: {} });
  };
  es.onerror = () => {
    onEvent({ type: "client.sse.error", properties: {} });
  };

  es.onmessage = (m) => {
    try {
      const parsed = JSON.parse(m.data) as OpenCodeWireEvent;
      if (!parsed || typeof parsed !== "object") return;

      const payload = (() => {
        const direct = parsed as any;
        if (direct && typeof direct.type === "string") return direct as OpenCodeBusEvent;
        const wrapped = (parsed as any).payload;
        if (wrapped && typeof wrapped.type === "string") return wrapped as OpenCodeBusEvent;
        return null;
      })();

      if (!payload) return;
      onEvent(payload);
    } catch {
      // ignore
    }
  };

  return () => {
    es.close();
  };
}
