import { OpenCode, type OpenCodeMessageResponse } from "@/lib/opencode-client";

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export function extractAssistantText(msg: OpenCodeMessageResponse) {
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  return parts
    .filter((p) => p && p.type === "text" && typeof (p as any).text === "string")
    .map((p) => (p as any).text as string)
    .join("");
}

type StreamParams = {
  sessionID: string;
  text: string;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
  onDone: (fullText: string, msg: OpenCodeMessageResponse) => void;
  onError: (error: string) => void;
};

export async function streamOpenCodeTextMessage({ sessionID, text, signal, onDelta, onDone, onError }: StreamParams) {
  try {
    const msg = await OpenCode.sendTextMessage(sessionID, text, signal);
    const full = extractAssistantText(msg);

    // "Streaming" UI: reveal the assistant text progressively.
    const chunks = full.match(/.{1,24}/g) ?? [];
    for (const chunk of chunks) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      onDelta(chunk);
      await delay(12, signal);
    }

    onDone(full, msg);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    onError(err instanceof Error ? err.message : "Unknown error");
  }
}
