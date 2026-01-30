import { OpenCode, type OpenCodeMessageResponse, type OpenCodePromptInput } from "@/lib/opencode-client";
import { extractClarificationSpec } from "@/lib/question-extract";
import type { OpenCodePromptPart } from "@/lib/opencode-client";

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

function safeString(input: unknown) {
  if (typeof input === "string") return input;
  return "";
}

function extractErrorMessage(msg: OpenCodeMessageResponse) {
  const err = msg.info?.error as unknown;
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof err !== "object") return "";

  const obj = err as Record<string, unknown>;
  const direct = safeString(obj.message);
  if (direct) return direct;

  const data = obj.data;
  if (data && typeof data === "object") {
    const dataMsg = safeString((data as Record<string, unknown>).message);
    if (dataMsg) return dataMsg;
  }

  const name = safeString(obj.name);
  if (name) return name;
  return "";
}

function summarizeToolPart(p: any) {
  if (!p || p.type !== "tool") return "";
  const tool = safeString(p.tool) || "tool";
  const state = p.state;
  const status = safeString(state?.status);
  if (status === "completed") {
    const out = safeString(state?.output);
    if (!out) return `[${tool}] completed`;
    return `[${tool}]\n${out}`;
  }
  if (status === "error") {
    const err = safeString(state?.error);
    if (!err) return `[${tool}] error`;
    return `[${tool}] error\n${err}`;
  }
  if (status) return `[${tool}] ${status}`;
  return `[${tool}]`;
}

function formatAssistantMessage(msg: OpenCodeMessageResponse) {
  const parts = Array.isArray(msg.parts) ? msg.parts : [];
  const textBlocks: string[] = [];
  const patchFiles = new Set<string>();
  const toolSummaries: string[] = [];
  const finishes: string[] = [];

  for (const p of parts) {
    if (!p || typeof p !== "object") continue;
    const type = (p as any).type;
    if (type === "text" || type === "reasoning") {
      const t = safeString((p as any).text);
      if (t) textBlocks.push(t);
      continue;
    }
    if (type === "patch") {
      const files = (p as any).files;
      if (Array.isArray(files)) {
        for (const f of files) {
          if (typeof f === "string" && f.trim()) patchFiles.add(f.trim());
        }
      }
      continue;
    }
    if (type === "tool") {
      const summary = summarizeToolPart(p);
      if (summary) toolSummaries.push(summary);
      continue;
    }
    if (type === "step-finish") {
      const reason = safeString((p as any).reason);
      if (reason) finishes.push(reason);
      continue;
    }
  }

  const out: string[] = [];
  const main = textBlocks.join("\n\n").trim();
  if (main) {
    const qs = extractClarificationSpec(main);
    if (!(qs.items.length && (qs.source === "json" || qs.source === "tag"))) {
      out.push(main);
    }
  }

  if (patchFiles.size) {
    out.push(
      [
        "Changes",
        ...Array.from(patchFiles)
          .sort((a, b) => a.localeCompare(b))
          .map((f) => `- ${f}`),
      ].join("\n"),
    );
  }

  if (toolSummaries.length) {
    out.push(["Run Log", ...toolSummaries.map((t) => `- ${t.replace(/\n/g, " ")}`)].join("\n"));
  }

  const err = extractErrorMessage(msg);
  if (err) out.push(`Error\n- ${err}`);

  if (finishes.length) out.push(`Finish\n- ${finishes[finishes.length - 1]}`);

  return out.join("\n\n").trim();
}

export function extractDisplayText(msg: OpenCodeMessageResponse) {
  return formatAssistantMessage(msg);
}

type StreamParams = {
  sessionID: string;
  parts: OpenCodePromptPart[];
  input?: Omit<OpenCodePromptInput, "parts">;
  signal?: AbortSignal;
  simulate?: boolean;
  onDelta: (text: string) => void;
  onDone: (fullText: string, msg: OpenCodeMessageResponse) => void;
  onError: (error: string) => void;
};

export async function streamOpenCodeMessage({ sessionID, parts, input, signal, simulate, onDelta, onDone, onError }: StreamParams) {
  try {
    const res = await OpenCode.sendMessageRaw(sessionID, parts, input, signal);

    // The /message endpoint returns a single JSON object (not an HTTP stream).
    // Use Response.json() for robustness; manual chunk parsing was causing
    // "Unexpected end of JSON input" on network hiccups.
    const msg = (await res
      .json()
      .catch(async () => {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to parse OpenCode response as JSON");
      })) as OpenCodeMessageResponse;

    const full = extractDisplayText(msg);

    if (simulate !== false) {
      // "Streaming" UI: reveal the assistant text progressively.
      if (full.length > 5000) {
        onDelta(full);
      } else {
        const chunks = full.match(/.{1,24}/g) ?? [];
        for (const chunk of chunks) {
          if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
          onDelta(chunk);
          await delay(12, signal);
        }
      }
    }

    await onDone(full, msg);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    const msg = err instanceof Error ? err.message : "Unknown error";
    await onError(msg);
    throw err;
  }
}

export async function streamOpenCodeTextMessage(params: Omit<StreamParams, "parts"> & { text: string }) {
  return streamOpenCodeMessage({
    ...params,
    parts: [{ type: "text", text: params.text }],
  });
}
