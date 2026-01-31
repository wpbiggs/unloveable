import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import ChatPanel from "@/components/builder/ChatPanel";
import PreviewPanel from "@/components/builder/PreviewPanel";
import BuilderHeader from "@/components/builder/BuilderHeader";
import { OpenCodeDirectoryDialog } from "@/components/builder/OpenCodeDirectoryDialog";
import ConsolePanel from "@/components/builder/ConsolePanel";
import FileTree from "@/components/builder/FileTree";
import CodeEditor from "@/components/builder/CodeEditor";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { Message } from "@/lib/ai-config";
import { useConsoleLogs } from "@/hooks/use-console-logs";
import { OpenCode, OpenCodeDirectory, type OpenCodeFileNode, type OpenCodeMessagePart, type OpenCodeMessageResponse } from "@/lib/opencode-client";
import { extractDisplayText, streamOpenCodeMessage } from "@/lib/opencode-stream";
import { OpenCodePreferences } from "@/lib/opencode-preferences";
import { OpenCodeSessionStore } from "@/lib/opencode-session-store";
import { OpenCodeWorkspace } from "@/lib/opencode-workspace";
import { OpenCodePreviewStore } from "@/lib/opencode-preview-store";
import { loopIsBusy, loopReducer, type LoopContext, type LoopState } from "@/lib/builder-loop";
import { extractClarificationSpec, type QuestionSpec } from "@/lib/question-extract";
import { openOpenCodeEvents } from "@/lib/opencode-events";
import { extractPageSpec, stringifyPageSpec, type PageSpec } from "@/lib/page-spec";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";

const guessLanguage = (path: string) => {
  const idx = path.lastIndexOf(".");
  const ext = idx === -1 ? "" : path.slice(idx + 1).toLowerCase();
  if (ext === "html") return "html";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "jsx") return "javascript";
  if (ext === "ts" || ext === "tsx") return "typescript";
  if (ext === "json") return "json";
  if (ext === "md") return "markdown";
  return "text";
};

const STRICT_QUESTIONS = [
  "If you need clarifications, respond with ONLY this JSON code block and nothing else:",
  "```json",
  JSON.stringify(
    {
      questions: [
        {
          id: "q1",
          question: "What do you need clarified?",
          type: "text",
          required: true,
        },
      ],
    },
    null,
    2,
  ),
  "```",
  "",
  "Rules:",
  "- id must be stable snake_case",
  "- question must end with ?",
  "- type is text | select | boolean",
  "- select requires options[]",
  "- boolean answers are yes/no",
].join("\n");

const INTAKE_QUESTIONS: QuestionSpec[] = [
  {
    id: "primary_user_success",
    question: "Who is the primary user, and what is the first success moment they should reach in <5 minutes?",
    type: "text",
    required: true,
  },
  {
    id: "must_haves_and_non_goals",
    question: "List 3 must-haves for v1, and 3 explicit non-goals (things we should NOT build yet).",
    type: "text",
    required: true,
  },
  {
    id: "sensitive_data_and_never_happens",
    question: "What sensitive data (if any) will be stored/processed, and what must never happen (security/privacy/financial/availability)?",
    type: "text",
    required: true,
  },
  {
    id: "runtime_and_deployment",
    question: "Where will this run and ship first (web/mobile/cli), and what's your deployment constraint (local only / single tenant / public SaaS)?",
    type: "text",
    required: true,
  },
  {
    id: "ux_direction",
    question: "Pick a UX direction: 3 adjectives + 1 reference product/site.",
    type: "text",
    required: true,
  },
];

type PendingQuestionKind = "intake" | "clarification";

const RECOMMENDED_DIRECTORY = "/home/will/opencode-test/warp-site-canvas-main";

type JsonRecord = Record<string, unknown>;

function isObj(input: unknown): input is JsonRecord {
  return !!input && typeof input === "object";
}

function parseJsonRecord(src: string): JsonRecord | null {
  try {
    const v = JSON.parse(src) as unknown;
    return isObj(v) ? v : null;
  } catch {
    return null;
  }
}

function commandFor(manager: "pnpm" | "npm", script: string) {
  if (manager === "pnpm") {
    if (script === "test") return "CI=1 corepack pnpm test";
    return `corepack pnpm ${script}`;
  }
  if (script === "install") return "npm install";
  // Ensure tests don't start watch mode (vitest/jest behave differently under CI).
  if (script === "test") return "CI=1 npm test";
  if (script === "start") return "npm start";
  return `npm run ${script}`;
}

async function detectPackageManager(runShell: (cmd: string, signal?: AbortSignal) => Promise<{ ok: boolean; output: string }>, prefix: string, signal?: AbortSignal) {
  // Prefer pnpm when a pnpm workspace or lockfile is present (or pnpm is available via corepack).
  const probe = await runShell(
    `${prefix}test -f pnpm-workspace.yaml -o -f pnpm-lock.yaml -o -f ../pnpm-workspace.yaml -o -f ../pnpm-lock.yaml && echo pnpm || echo npm`,
    signal,
  );
  return probe.ok && probe.output.trim() === "pnpm" ? "pnpm" : "npm";
}

function readMessageId(msg: unknown) {
  if (!isObj(msg)) return "";
  const info = isObj(msg.info) ? msg.info : null;
  const infoId = info && typeof info.id === "string" ? info.id : "";
  if (infoId) return infoId;
  return typeof msg.id === "string" ? msg.id : "";
}

function parseAttachmentsFromToolState(state: unknown) {
  const out: Array<{ url: string; mime: string; filename?: string }> = [];
  if (!isObj(state)) return out;
  const att = state.attachments;
  if (!Array.isArray(att)) return out;
  for (const a of att) {
    if (!isObj(a)) continue;
    const url = typeof a.url === "string" ? a.url : "";
    if (!url) continue;
    const mime = typeof a.mime === "string" ? a.mime : "application/octet-stream";
    const filename = typeof a.filename === "string" ? a.filename : undefined;
    out.push({ url, mime, filename });
  }
  return out;
}

const Builder = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionID, setSessionID] = useState<string | null>(null);
  const [shellSessionID, setShellSessionID] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Array<{ id: string; title: string; updated: number; directory: string }>>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [lastAssistantMessageID, setLastAssistantMessageID] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string; language: string } | null>(null);
  const [preview, setPreview] = useState<{ path: string; html: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [lastScreenshot, setLastScreenshot] = useState<{ path: string; dataUrl: string } | null>(null);
  const [canRunPreview, setCanRunPreview] = useState(false);
  const [isRunStarting, setIsRunStarting] = useState(false);
  const autoRunAttemptedRef = useRef<Set<string>>(new Set());
  const handleSendMessageRef = useRef<
    (content: string, opts?: { agent?: string; files?: File[]; signal?: AbortSignal }) => Promise<null | { text: string; messageID?: string }>
  >(async () => null);
  
  // Toggle for Command Palette (placeholder for now)
  const toggleCommandPalette = useCallback(() => {
    toast("Command Palette coming soon!");
  }, []);

  const toggleSidebar = useCallback(() => {
    // If we had a sidebar state, we would toggle it here.
    // For now, let's just log or toast.
    toast("Sidebar toggle triggered (not implemented yet)");
  }, []);

  useGlobalShortcuts({
    onSave: () => {
        // Global save if needed, but CodeEditor handles its own.
        // Maybe trigger a "Save All" if we track multiple open files?
        // For now, we can just toast.
        // toast("Global save triggered");
    },
    onSendMessage: () => {
      // This might be tricky because we need the input content.
      // Ideally, the ChatPanel handles its own Mod+Enter.
      // But we can focus the input if it's not focused.
      const chatInput = document.querySelector('textarea[placeholder^="Describe what you want"]');
      if (chatInput instanceof HTMLElement) {
        chatInput.focus();
      }
    },
    onToggleCommandPalette: toggleCommandPalette,
    onToggleSidebar: toggleSidebar
  });

  const [loop, dispatchLoop] = useReducer(loopReducer, { state: "IDLE", iteration: 0, lastError: null, lastRunLog: null } satisfies LoopContext);
  const loopStopRef = useRef(false);
  const autoLoopRef = useRef<{ active: boolean; goal: string; max: number; startedAt: number } | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<QuestionSpec[] | null>(null);
  const [pendingQuestionsKind, setPendingQuestionsKind] = useState<PendingQuestionKind | null>(null);
  const [pendingGoalToResume, setPendingGoalToResume] = useState<string | null>(null);
  const [intakeSnapshot, setIntakeSnapshot] = useState<null | { goal: string; answers: Array<{ id: string; answer: string }> }>(null);
  const [pageSpec, setPageSpec] = useState<PageSpec | null>(null);
  const [pageSpecRaw, setPageSpecRaw] = useState<string | null>(null);
  const questionRef = useRef(false);
  const [serverFeed, setServerFeed] = useState<Array<{ id: string; ts: number; text: string }>>([]);
  const [sseStatus, setSseStatus] = useState<{ state: "connecting" | "connected" | "error"; lastAt: number }>(() => ({
    state: "connecting",
    lastAt: Date.now(),
  }));
  const [serverStatus, setServerStatus] = useState<string | null>(null);
  const [rootFiles, setRootFiles] = useState<OpenCodeFileNode[]>([]);
  const [childrenByPath, setChildrenByPath] = useState<Record<string, OpenCodeFileNode[]>>({});
  const [directory, setDirectory] = useState<string | null>(() => OpenCodeDirectory.get());
  const [dirPickerOpen, setDirPickerOpen] = useState(false);
  const { logs: consoleLogItems, info, warn, error, success, debug, clearLogs } = useConsoleLogs();
  const abortRef = useRef<AbortController | null>(null);
  const didInitRef = useRef(false);
  const liveRef = useRef<
    | null
    | {
        startedAt: number;
        sessionID: string;
        assistantUI: string;
        messageID?: string;
        content: string;
        lastEventAt: number;
      }
  >(null);

  const projectProbeRef = useRef<{ at: number; cached: boolean }>({ at: 0, cached: false });
  const previewAttemptAtRef = useRef<Record<string, number>>({});

  const stablePort = useMemo(() => {
    const dir = directory ?? "";
    let hash = 0;
    for (let i = 0; i < dir.length; i++) hash = (hash * 31 + dir.charCodeAt(i)) >>> 0;
    return 3000 + (hash % 500);
  }, [directory]);

  const detectProjectRoot = useCallback(async () => {
    const rootPkg = await OpenCode.readFile("package.json").catch(() => null);
    if (rootPkg?.content) {
      const pkg = parseJsonRecord(rootPkg.content);
      return pkg ? { path: ".", pkg } : { path: ".", pkg: null };
    }

    // Common failure mode: the agent scaffolds a project in a subdirectory (e.g. ./app).
    // Try to detect a single obvious project root one level down.
    const nodes = await OpenCode.listFiles(".").catch(() => [] as OpenCodeFileNode[]);
    const dirs = nodes
      .filter((n) => n.type === "directory" && !n.ignored)
      .slice(0, 12);

    const hits: Array<{ path: string; pkg: JsonRecord }> = [];
    for (const d of dirs) {
      const p = typeof d.path === "string" ? d.path : "";
      if (!p || p === "." || p === "..") continue;
      const subPkg = await OpenCode.readFile(`${p}/package.json`).catch(() => null);
      if (!subPkg?.content) continue;
      const json = parseJsonRecord(subPkg.content);
      if (!json) continue;

      const scripts = isObj(json.scripts) ? json.scripts : null;
      const looksRunnable = !!(
        scripts &&
        (typeof scripts.dev === "string" ||
          typeof scripts.start === "string" ||
          typeof scripts.build === "string" ||
          typeof scripts.test === "string")
      );
      if (!looksRunnable) continue;
      hits.push({ path: p, pkg: json });
      if (hits.length > 1) break;
    }

    if (hits.length === 1) return hits[0];
    return null;
  }, []);

  const refreshRootFiles = useCallback(async () => {
    const nodes = await OpenCode.listFiles(".");
    setRootFiles(nodes);
  }, []);

  const refreshPreview = useCallback(async () => {
    const saved = OpenCodePreviewStore.get(directory);
    setPreviewUrl(saved?.url ?? null);

    // Detect whether this workspace has a runnable dev server.
    // (Used to show/hide the "Run" preview affordance.)
    const probeAt = projectProbeRef.current;

    const pkg = await OpenCode.readFile("package.json").catch(() => null);
    const rootJson = (() => {
      if (!pkg?.content) return null;
      return parseJsonRecord(pkg.content);
    })();

    const detected =
      rootJson || Date.now() - probeAt.at < 5000
        ? null
        : await detectProjectRoot().catch(() => null);
    if (!rootJson) probeAt.at = Date.now();

    const effective = rootJson ? { path: ".", pkg: rootJson } : detected;
    const scripts = effective?.pkg?.scripts;
    const runnable = !!(scripts && typeof scripts === "object" && (scripts.start || scripts.dev));
    setCanRunPreview(runnable);

    if (selectedFile?.language === "html") {
      setPreview({ path: selectedFile.path, html: selectedFile.content });
      return;
    }

    // Avoid spamming /file/content while the agent is generating.
    // We still want the preview to refresh, just not on every interval tick.
    const attemptAt = previewAttemptAtRef.current;

    const candidates = ["web/index.html", "index.html", "dist/index.html", "public/index.html"];
    for (const p of candidates) {
      const last = attemptAt[p] ?? 0;
      if (Date.now() - last < 4000) continue;
      const file = await OpenCode.readFile(p).catch(() => null);
      if (file?.content) {
        attemptAt[p] = Date.now();
        setPreview({ path: p, html: file.content });
        return;
      }
      attemptAt[p] = Date.now();
    }

    setPreview(null);
  }, [detectProjectRoot, directory, selectedFile]);

  const handlePreviewRefresh = useCallback(async () => {
    setPreviewNonce((n) => n + 1);
    await refreshPreview().catch(() => undefined);
  }, [refreshPreview]);

  const handlePreviewNavigate = useCallback(
    async (nextUrl: string) => {
      const dir = OpenCodeDirectory.get();
      const raw = (nextUrl || "").trim();

      if (!raw) {
        if (dir) OpenCodePreviewStore.set(dir, null);
        setPreviewUrl(null);
        setPreviewNonce((n) => n + 1);
        await refreshPreview().catch(() => undefined);
        return;
      }

      const normalized = raw.includes("://") ? raw : `http://${raw}`;
      if (dir) {
        const prev = OpenCodePreviewStore.get(dir);
        OpenCodePreviewStore.set(dir, { url: normalized, pid: prev?.pid, startedAt: prev?.startedAt });
      }
      setPreviewUrl(normalized);
      setPreviewNonce((n) => n + 1);
    },
    [refreshPreview],
  );

  useEffect(() => {
    if (previewUrl) return;
    if (!loopIsBusy(loop.state) && !isGenerating) return;
    const t = window.setInterval(() => {
      refreshPreview().catch(() => undefined);
    }, 900);
    return () => window.clearInterval(t);
  }, [isGenerating, loop.state, previewUrl, refreshPreview]);

  useEffect(() => {
    const cleanup = openOpenCodeEvents((evt) => {
      const sid = sessionID;
      const shid = shellSessionID;
      const p: JsonRecord = isObj(evt.properties) ? evt.properties : {};

      const liveSid = liveRef.current?.sessionID;
      const matchIDs = [sid, shid, liveSid].filter(Boolean) as string[];

      // Always show SSE connectivity in Activity so users can tell the stream is alive.
      if (
        evt.type === "client.sse.open" ||
        evt.type === "client.sse.error" ||
        evt.type === "server.connected" ||
        evt.type === "server.heartbeat"
      ) {
        setSseStatus(() => {
          if (evt.type === "client.sse.error") return { state: "error", lastAt: Date.now() };
          return { state: "connected", lastAt: Date.now() };
        });
        setServerFeed((prev) => {
          const text = (() => {
            if (evt.type === "client.sse.open") return "[sse] connected";
            if (evt.type === "client.sse.error") return "[sse] error";
            if (evt.type === "server.connected") return "[server] connected";
            return "[server] heartbeat";
          })();
          const next = [...prev, { id: crypto.randomUUID(), ts: Date.now(), text }];
          return next.slice(-120);
        });
      }

      const sessionMatch = (() => {
        if (evt.type === "message.updated") {
          const info = isObj(p.info) ? p.info : null;
          const session = info && typeof info.sessionID === "string" ? info.sessionID : "";
          return !!session && matchIDs.includes(session);
        }
        if (evt.type === "message.part.updated") {
          const part = isObj(p.part) ? p.part : null;
          const session = part && typeof part.sessionID === "string" ? part.sessionID : "";
          return !!session && matchIDs.includes(session);
        }
        if (evt.type === "session.status") {
          const session = typeof p.sessionID === "string" ? p.sessionID : "";
          return !!session && matchIDs.includes(session);
        }
        return false;
      })();

      if (!sessionMatch) return;

      if (liveRef.current) {
        liveRef.current = { ...liveRef.current, lastEventAt: Date.now() };
      }

      // Live-stream assistant text into the chat while the /message request is in-flight.
      const live = liveRef.current;
      if (live) {
        if (evt.type === "message.updated") {
          const info = isObj(p.info) ? p.info : null;
          const role = info && typeof info.role === "string" ? info.role : "";
          const mid = info && typeof info.id === "string" ? info.id : "";
          if (!live.messageID && role === "assistant" && typeof mid === "string") {
            liveRef.current = { ...live, messageID: mid, lastEventAt: Date.now() };
          }
        }
        if (evt.type === "message.part.updated") {
          const part = isObj(p.part) ? p.part : null;
          const delta = typeof p.delta === "string" ? p.delta : "";
          const type = part && typeof part.type === "string" ? part.type : "";
          const mid = part && typeof part.messageID === "string" ? part.messageID : "";
          const cur = liveRef.current;
          if (cur && !cur.messageID && typeof mid === "string") {
            // Some servers send part updates before message.updated.
            liveRef.current = { ...cur, messageID: mid, lastEventAt: Date.now() };
          }
          if (cur?.messageID && typeof mid === "string" && mid === cur.messageID && type === "text" && delta) {
            const next = cur.content + delta;
            liveRef.current = { ...cur, content: next, lastEventAt: Date.now() };
            setStreamingContent(next);
            setMessages((prev) => prev.map((m) => (m.id === cur.assistantUI ? { ...m, content: next } : m)));
          }
        }
      }

      if (evt.type === "session.status") {
        const status = isObj(p.status) ? p.status : null;
        const t = status && typeof status.type === "string" ? status.type : "";
        if (t) setServerStatus(t);
      }

      const text = (() => {
        if (evt.type === "message.part.updated") {
          const part = isObj(p.part) ? p.part : null;
          const type = part && typeof part.type === "string" ? part.type : "";
          const delta = typeof p.delta === "string" ? p.delta : "";
          if (type === "tool") {
            const tool = part && typeof part.tool === "string" ? part.tool : "";
            const state = part && isObj(part.state) ? part.state : null;
            const status = state && typeof state.status === "string" ? state.status : "";
            if (tool && status) return `TOOL ${tool} ${status}`;
            if (tool) return `TOOL ${tool}`;
          }
          if (type === "reasoning") {
            if (delta) return `[reasoning] +${delta.length} chars`;
            return `[reasoning] updated`;
          }
          if (type === "text") {
            if (delta) {
              const trimmed = delta.replace(/\r/g, "").trimEnd();
              if (trimmed) return trimmed.slice(0, 2000);
            }
            return `[text] updated`;
          }
          if (typeof type === "string") return `[part] ${type}`;
          return "[part]";
        }

        if (evt.type === "message.updated") {
          const info = isObj(p.info) ? p.info : null;
          const role = info && typeof info.role === "string" ? info.role : "";
          const agent = info && typeof info.agent === "string" ? info.agent : "";
          if (role && agent) return `[message] ${role} (${agent})`;
          if (role) return `[message] ${role}`;
          return "[message] updated";
        }

        if (evt.type === "session.status") {
          const status = isObj(p.status) ? p.status : null;
          const t = status && typeof status.type === "string" ? status.type : "";
          if (t === "retry") return `[session] retry`;
          if (t === "busy") return `[session] busy`;
          if (t === "idle") return `[session] idle`;
          return "[session] status";
        }

        return `[event] ${evt.type}`;
      })();

      setServerFeed((prev) => {
        const next = [...prev, { id: crypto.randomUUID(), ts: Date.now(), text }];
        return next.slice(-120);
      });
    });

    return cleanup;
  }, [sessionID, shellSessionID]);

  const stop = useCallback(async () => {
    loopStopRef.current = true;
    if (autoLoopRef.current) autoLoopRef.current = { ...autoLoopRef.current, active: false };
    loopAbortRef.current?.abort();
    abortRef.current?.abort();
    abortRef.current = null;
    liveRef.current = null;

    if (sessionID) {
      await OpenCode.abortSession(sessionID).catch(() => undefined);
    }
    if (shellSessionID) {
      await OpenCode.abortSession(shellSessionID).catch(() => undefined);
    }
    setIsGenerating(false);
    setStreamingContent("");
    dispatchLoop({ type: "SET_STATE", state: "STOPPED" });
  }, [sessionID, shellSessionID]);

  const isComplete = useCallback(async () => {
    const raw = await OpenCode.readFile(".unloveable/complete.json")
      .then((r) => (typeof r?.content === "string" ? r.content : ""))
      .catch(() => "");
    if (!raw.trim()) return false;
    const obj = parseJsonRecord(raw);
    return !!(obj && obj.complete === true);
  }, []);

  const ensureShellSession = useCallback(async () => {
    if (shellSessionID) return shellSessionID;
    const s = await OpenCode.createSession();
    setShellSessionID(s.id);
    return s.id;
  }, [shellSessionID]);

  const setLoopState = useCallback((s: LoopState) => dispatchLoop({ type: "SET_STATE", state: s }), []);

  const getPromptInput = useCallback(
    (agentOverride?: string) => {
      const agent = agentOverride ?? OpenCodePreferences.agent.get() ?? undefined;
      // When an agent is explicitly selected (e.g. loop uses "plan"/"task"),
      // prefer the agent's configured model rather than a global override.
      if (agentOverride) {
        return agent ? { agent } : undefined;
      }

      const modelRaw = OpenCodePreferences.model.get() ?? "";
      const idx = modelRaw.indexOf("/");
      const model = idx > 0 ? { providerID: modelRaw.slice(0, idx), modelID: modelRaw.slice(idx + 1) } : undefined;
      if (!agent && !model) return undefined;
      return { agent, model };
    },
    [],
  );

  const refreshSessions = useCallback(async () => {
    setIsSessionsLoading(true);
    try {
      const items = await OpenCode.listSessions({ roots: true, limit: 25 });
      setSessions(items.map((s) => ({ id: s.id, title: s.title, updated: s.time.updated, directory: s.directory })));
      return items;
    } finally {
      setIsSessionsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (id: string) => {
      const items = await OpenCode.listMessages(id);
      const mapped: Message[] = items.map((m) => {
        const built = (() => {
          const parts = Array.isArray(m.parts) ? m.parts : [];
          const lines: string[] = [];
          const attachments: Array<{ url: string; mime: string; filename?: string }> = [];
          for (const p of parts) {
            if (!p || typeof p !== "object") continue;
            const t = p.type;
            if (t === "text") {
              const v = p.text;
              if (typeof v === "string" && v) lines.push(v);
            }
            if (t === "file") {
              const url = typeof p.url === "string" ? p.url : "";
              const mime = typeof p.mime === "string" ? p.mime : "application/octet-stream";
              const filename = typeof p.filename === "string" ? p.filename : undefined;
              if (url) attachments.push({ url, mime, filename });
              lines.push(filename ? `[file] ${filename}` : "[file]");
            }
            if (t === "patch") {
              const files = Array.isArray(p.files)
                ? p.files
                    .filter((x) => typeof x === "string")
                    .join(", ")
                : "";
              lines.push(files ? `[patch] ${files}` : "[patch]");
            }
            if (t === "tool") {
              const tool = typeof p.tool === "string" ? p.tool : "tool";
              const state = isObj(p.state) ? p.state : null;
              const status = state && typeof state.status === "string" ? state.status : "";
              if (status === "completed") lines.push(`[${tool}] completed`);
              if (status === "error") lines.push(`[${tool}] error`);

              if (state) attachments.push(...parseAttachmentsFromToolState(state));
            }
          }
          return { text: lines.join("\n").trim(), attachments };
        })();

        const err = m.info.error;
        const errMsg = isObj(err) && typeof err.message === "string" ? err.message : "";
        const content = errMsg ? (built.text ? `${built.text}\n\n[error] ${errMsg}` : `[error] ${errMsg}`) : built.text;
        return {
          id: m.info.id,
          role: m.info.role,
          content,
          attachments: built.attachments.length ? built.attachments : undefined,
          timestamp: new Date(m.info.time.created),
        };
      });
      setMessages(mapped);
    },
    [setMessages],
  );

  const expandDir = useCallback(
    async (path: string) => {
      if (childrenByPath[path]) return;
      try {
        const nodes = await OpenCode.listFiles(path);
        setChildrenByPath((prev) => ({ ...prev, [path]: nodes }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load directory");
      }
    },
    [childrenByPath],
  );

  const getChildren = useCallback((path: string) => childrenByPath[path], [childrenByPath]);

  const ensureSession = useCallback(async () => {
    if (sessionID) return sessionID;
    const list = await refreshSessions().catch(() => []);
    const preferred = OpenCodeSessionStore.get(OpenCodeDirectory.get());
    const picked =
      (preferred && list.find((s) => s.id === preferred)) ||
      (list.length ? list[0] : null);
    if (picked) {
      setSessionID(picked.id);
      OpenCodeSessionStore.set(OpenCodeDirectory.get(), picked.id);
      info("OpenCode session selected", `Session: ${picked.id}`);
      await loadMessages(picked.id).catch(() => undefined);
      return picked.id;
    }
    const session = await OpenCode.createSession();
    setSessionID(session.id);
    OpenCodeSessionStore.set(OpenCodeDirectory.get(), session.id);
    info("OpenCode session created", `Session: ${session.id}`);
    await refreshSessions().catch(() => undefined);
    return session.id;
  }, [sessionID, refreshSessions, loadMessages, info]);

  const getModelOverride = useCallback(() => {
    const modelRaw = OpenCodePreferences.model.get() ?? "";
    const idx = modelRaw.indexOf("/");
    return idx > 0 ? { providerID: modelRaw.slice(0, idx), modelID: modelRaw.slice(idx + 1) } : undefined;
  }, []);

  const runHeadlessLoop = useCallback(async (mode: "exploration" | "production") => {
    setIsRunStarting(true);
    info("Headless Loop", `Starting ${mode} loop...`);
    try {
      const sid = await ensureShellSession();
      const agent = OpenCodePreferences.agent.get() ?? "task";
      
      // Stream output to console
      // Use standard runShell which returns on completion.
      // We rely on useConsoleLogs / server events to show progress in the UI if possible,
      // but runShell here blocks until the loop script exits.
      await OpenCode.runShell(
        sid, 
        `./run-loop.sh ${mode} > /dev/null 2>&1`, 
        { agent, model: getModelOverride() }
      );
      
      // Note: In a real implementation we would want to stream the output
      // For now, OpenCode.runShell returns the final result, so we'll just log success/fail
      success("Headless Loop", "Completed successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      error("Headless Loop Failed", msg);
    } finally {
      setIsRunStarting(false);
    }
  }, [ensureShellSession, getModelOverride, info, success, error]);

  const runShell = useCallback(
    async (command: string, signal?: AbortSignal) => {
      // Use a dedicated shell session so checks/preview don't collide with the chat session.
      const sid = await ensureShellSession();
      const agent = OpenCodePreferences.agent.get() ?? "task";
      const msg = await OpenCode.runShell(sid, command, { agent, model: getModelOverride(), signal });
      const messageID = readMessageId(msg);
      if (!messageID) {
        return { ok: false, output: "No message id returned from shell" };
      }
      const full = await OpenCode.getMessage(sid, messageID).catch(() => null);
      const parts = full?.parts ?? [];

      let ok = true;
      const out: string[] = [];
      for (const p of parts) {
        if (!p || p.type !== "tool") continue;
        const s = isObj(p.state) ? p.state : null;
        const status = s && typeof s.status === "string" ? s.status : "";
        const output = s && typeof s.output === "string" ? s.output : "";
        const err = s && typeof s.error === "string" ? s.error : "";

        if (status === "completed" && output) out.push(output);
        if (status === "error") {
          ok = false;
          if (err) out.push(err);
        }
      }
      return { ok, output: out.join("\n").trim() };
    },
    [ensureShellSession, getModelOverride],
  );

  const loopAbortRef = useRef<AbortController | null>(null);

  const runChecks = useCallback(async (signal?: AbortSignal) => {
    const rootPkg = await OpenCode.readFile("package.json").catch(() => null);
    const rootJson = (() => {
      if (!rootPkg?.content) return null;
      return parseJsonRecord(rootPkg.content);
    })();

    if (rootPkg?.content && !rootJson) {
      return { ok: false, log: "Invalid package.json in workspace root (JSON parse failed)" };
    }

    const detected = !rootJson ? await detectProjectRoot().catch(() => null) : null;
    const project = rootJson ? { path: ".", pkg: rootJson } : detected;
    if (!project) return { ok: true, log: "No package.json found (root or immediate subdir); skipping checks" };
    if (!project.pkg) return { ok: false, log: `Invalid package.json at ${project.path} (JSON parse failed)` };

    const prefix = project.path && project.path !== "." ? `cd "${project.path}" && ` : "";
    const pm = await detectPackageManager(runShell, prefix, signal);

    const scripts = project.pkg?.scripts && typeof project.pkg.scripts === "object" ? project.pkg.scripts : {};
    if (typeof scripts.test === "string") {
      const testScript = scripts.test;
      const usesVitest = /\bvitest\b/.test(testScript);

      // Cap test concurrency and avoid watch-mode for Vitest by running it explicitly.
      // (If it's not Vitest, fall back to `npm test`/`pnpm test` under CI.)
      const cmd = (() => {
        if (!usesVitest) return `${prefix}${commandFor(pm, "test")}`;

        // Extract args after `vitest` inside the script and force `run`.
        const m = /\bvitest\b([\s\S]*)$/.exec(testScript);
        let args = (m?.[1] ?? "").trim();
        args = args.replace(/\s--watch\b/g, "").replace(/\s-w\b/g, "").trim();
        if (!/^run\b/.test(args)) args = `run ${args}`.trim();

        // Use a Python wrapper to compute max-workers as 50% of CPU cores, without
        // relying on shell `$...` expansion (some OpenCode backends sanitize it).
        // Respect an explicit --max-workers if the script already sets one.
        if (/--max-workers\b/.test(args)) {
          return `${prefix}CI=1 ./node_modules/.bin/vitest ${args}`;
        }

        const py = [
          "python3 - <<'PY'",
          "import os, shlex, subprocess",
          `args = shlex.split(r'''${args}''')`,
          "cores = os.cpu_count() or 2",
          "workers = max(1, cores // 2)",
          "cmd = ['./node_modules/.bin/vitest', *args, f'--max-workers={workers}']",
          "env = os.environ.copy()",
          "env['CI'] = '1'",
          "p = subprocess.run(cmd, env=env)",
          "raise SystemExit(p.returncode)",
          "PY",
        ].join("\n");

        return `${prefix}${py}`;
      })();

      const res = await runShell(cmd, signal);

      // Cleanup: if vitest/jest spawned worker processes and leaked them, kill them.
      // This is scoped to the current project directory only.
      try {
        const dir = OpenCodeDirectory.get();
        const abs = dir ? (project.path && project.path !== "." ? `${dir.replace(/\/$/, "")}/${project.path}` : dir) : null;
        if (abs) {
          // Avoid shell variables and command substitution to survive backend sanitization.
          const cleanup = [
            "python3 - <<'PY'",
            "import os, signal",
            `ROOT = r'''${abs}'''`,
            "ROOT = ROOT.rstrip('/')",
            "killed = []",
            "for pid in os.listdir('/proc'):",
            "  if not pid.isdigit():",
            "    continue",
            "  p = int(pid)",
            "  try:",
            "    cwd = os.readlink(f'/proc/{pid}/cwd')",
            "  except Exception:",
            "    continue",
            "  if not (cwd == ROOT or cwd.startswith(ROOT + '/')):",
            "    continue",
            "  try:",
            "    cmd = open(f'/proc/{pid}/cmdline','rb').read().decode('utf-8','ignore').replace('\x00',' ').strip()",
            "  except Exception:",
            "    continue",
            "  if not cmd:",
            "    continue",
            "  low = cmd.lower()",
            "  if 'vitest' not in low and 'jest' not in low:",
            "    continue",
            "  # Don't kill the current python process.",
            "  if p == os.getpid():",
            "    continue",
            "  try:",
            "    os.kill(p, signal.SIGTERM)",
            "    killed.append(str(p))",
            "  except Exception:",
            "    pass",
            "print('killed_test_orphans=' + (','.join(killed) if killed else '<none>'))",
            "PY",
          ].join("\n");
          await runShell(cleanup, signal);
        }
      } catch {
        // Don't fail checks due to cleanup.
      }

      return { ok: res.ok, log: res.output || "(no output)" };
    }
    if (typeof scripts.build === "string") {
      const res = await runShell(`${prefix}${commandFor(pm, "build")}`, signal);
      return { ok: res.ok, log: res.output || "(no output)" };
    }

    const serverIndex = await OpenCode.readFile(project.path && project.path !== "." ? `${project.path}/server/index.js` : "server/index.js").catch(() => null);
    if (serverIndex?.content) {
      const res = await runShell(`${prefix}node -c server/index.js`, signal);
      return { ok: res.ok, log: res.output || "(no output)" };
    }

    return { ok: true, log: "No test/build scripts found; skipping checks" };
  }, [detectProjectRoot, runShell]);

  const startPreviewServer = useCallback(async () => {
    const dir = OpenCodeDirectory.get();
    if (!dir) throw new Error("No directory selected");

    const rootPkg = await OpenCode.readFile("package.json").catch(() => null);
    const rootJson = (() => {
      if (!rootPkg?.content) return null;
      return parseJsonRecord(rootPkg.content);
    })();
    if (rootPkg?.content && !rootJson) throw new Error("Invalid package.json in workspace root (JSON parse failed)");

    const detected = !rootJson ? await detectProjectRoot().catch(() => null) : null;
    const project = rootJson ? { path: ".", pkg: rootJson } : detected;
    if (!project) throw new Error("No package.json found (root or immediate subdir)");
    if (!project.pkg) throw new Error(`Invalid package.json at ${project.path} (JSON parse failed)`);

    const scripts = project.pkg?.scripts ?? {};
    const prefix = project.path && project.path !== "." ? `cd "${project.path}" && ` : "";
    const port = stablePort;

    const pm = await detectPackageManager(runShell, prefix, loopAbortRef.current?.signal ?? undefined);

    const agent = OpenCodePreferences.agent.get() ?? "task";
    const session = await ensureShellSession();

    await OpenCode.runShell(session, `${prefix}test -d node_modules || ${commandFor(pm, "install")}`, {
      agent,
      signal: loopAbortRef.current?.signal,
    });

    const isNext =
      typeof project.pkg?.dependencies?.next === "string" ||
      typeof project.pkg?.devDependencies?.next === "string" ||
      (typeof scripts.dev === "string" && scripts.dev.includes("next"));
    const isVite =
      typeof project.pkg?.devDependencies?.vite === "string" ||
      typeof project.pkg?.dependencies?.vite === "string" ||
      (typeof scripts.dev === "string" && scripts.dev.includes("vite"));

    // Prefer dev servers for preview (they're more reliable than `npm start` which often
    // depends on build artifacts and production-only env).
    const hasDev = typeof scripts.dev === "string";
    const hasStart = typeof scripts.start === "string";

    const cmd =
      (hasDev && isNext)
        ? `${prefix}nohup ${commandFor(pm, "dev")} -- -p ${port} -H 127.0.0.1 > .opencode-preview.log 2>&1 & echo $!`
        : (hasDev && isVite)
          ? `${prefix}nohup ${commandFor(pm, "dev")} -- --port ${port} --host 127.0.0.1 > .opencode-preview.log 2>&1 & echo $!`
          : hasDev
            ? `${prefix}nohup ${commandFor(pm, "dev")} > .opencode-preview.log 2>&1 & echo $!`
            : hasStart
              ? `${prefix}nohup env PORT=${port} ${commandFor(pm, "start")} > .opencode-preview.log 2>&1 & echo $!`
              : `${prefix}nohup ${commandFor(pm, "dev")} > .opencode-preview.log 2>&1 & echo $!`;

    const msg = await OpenCode.runShell(session, cmd, { agent, signal: loopAbortRef.current?.signal });
    const messageID = readMessageId(msg);
    const full = messageID ? await OpenCode.getMessage(session, messageID).catch(() => null) : null;
    const parts = full?.parts ?? [];
    const out = (() => {
      const lines: string[] = [];
      for (const p of parts) {
        if (!p || p.type !== "tool") continue;
        const state = isObj(p.state) ? p.state : null;
        const status = state && typeof state.status === "string" ? state.status : "";
        const output = state && typeof state.output === "string" ? state.output : "";
        if (status === "completed" && output) lines.push(output);
      }
      return lines.join("\n").trim();
    })();
    const pid = Number.parseInt(out, 10);
    const url = `http://localhost:${port}`;

    OpenCodePreviewStore.set(dir, { url, pid: Number.isFinite(pid) ? pid : undefined, startedAt: Date.now() });
    setPreviewUrl(url);
    setCanRunPreview(false);
    return { url, pid: Number.isFinite(pid) ? pid : undefined };
  }, [detectProjectRoot, ensureShellSession, runShell, stablePort]);

  const observe = useCallback(async (signal?: AbortSignal) => {
    await refreshRootFiles().catch(() => undefined);
    await refreshPreview().catch(() => undefined);

    const logs: string[] = [];

    const sid = await ensureShellSession();
    const agent = OpenCodePreferences.agent.get() ?? "task";
    const iter = String(loop.iteration).padStart(4, "0");

    const chromeProbe = async (url: string, base: string) => {
      const outPng = `${base}.png`;
      const outDom = `${base}.dom.html`;
      const outLog = `${base}.chromium.log`;

      // IMPORTANT: The OpenCode shell backend can sanitize `$...` expansions and `$(...)` substitutions.
      // Build a probe command that avoids *all* shell variables so it remains valid after sanitization.
      const cmd = [
        `mkdir -p "opencode-artifacts/observe"`,
        // Retry curl a few times.
        `for i in 1 2 3 4 5 6 7 8; do`,
        `  curl -4 -sSf --max-time 5 "${url}" > "${outDom}" 2>"${outLog}" && break || true`,
        `  sleep 1`,
        `done`,
        // Headless browser (best-effort). We avoid storing the chosen binary in a variable.
        `if google-chrome --version >/dev/null 2>&1; then`,
        `  google-chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1366,768 --dump-dom "${url}" > "${outDom}" 2>"${outLog}" || true`,
        `  google-chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1366,768 --screenshot="${outPng}" "${url}" >/dev/null 2>&1 || true`,
        `elif chromium --version >/dev/null 2>&1; then`,
        `  chromium --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1366,768 --dump-dom "${url}" > "${outDom}" 2>"${outLog}" || true`,
        `  chromium --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1366,768 --screenshot="${outPng}" "${url}" >/dev/null 2>&1 || true`,
        `elif chromium-browser --version >/dev/null 2>&1; then`,
        `  chromium-browser --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1366,768 --dump-dom "${url}" > "${outDom}" 2>"${outLog}" || true`,
        `  chromium-browser --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1366,768 --screenshot="${outPng}" "${url}" >/dev/null 2>&1 || true`,
        `else`,
        `  echo NO_HEADLESS_BROWSER > "${outLog}"`,
        `fi`,
        // If curl never succeeded, leave a clear marker.
        `test -s "${outDom}" || echo '<!-- CONNECTION_FAILED -->' >> "${outDom}"`,
        `test -s "${outDom}" || echo CONNECTION_FAILED >> "${outLog}"`,
        `exit 0`,
      ].join("\n");

      const shellErr = await OpenCode.runShell(
        sid,
        cmd,
        { agent, signal },
      )
        .then(() => "")
        .catch((err: unknown) => (err instanceof Error ? err.message : "OpenCode.runShell failed"));

      const imgRes = await OpenCode.readFile(outPng)
        .then((v) => ({ ok: true as const, v }))
        .catch((err: unknown) => ({ ok: false as const, err: err instanceof Error ? err.message : "readFile failed" }));
      const domRes = await OpenCode.readFile(outDom)
        .then((v) => ({ ok: true as const, v }))
        .catch((err: unknown) => ({ ok: false as const, err: err instanceof Error ? err.message : "readFile failed" }));
      const logRes = await OpenCode.readFile(outLog)
        .then((v) => ({ ok: true as const, v }))
        .catch((err: unknown) => ({ ok: false as const, err: err instanceof Error ? err.message : "readFile failed" }));

      const img = imgRes.ok ? imgRes.v : null;
      const dom = domRes.ok ? domRes.v : null;
      const log = logRes.ok ? logRes.v : null;

      const domText = dom?.content && typeof dom.content === "string" ? dom.content : "";
      const logText = log?.content && typeof log.content === "string" ? log.content : "";
      const hasOutput = !!(domText.trim() || logText.trim());
      const screenshot =
        img?.encoding === "base64" && img.mimeType?.startsWith("image/") && img.content
          ? `data:${img.mimeType};base64,${img.content}`
          : null;

      const hit = (() => {
        if (shellErr) return `SHELL_FAILED\n${shellErr}`;
        if (!imgRes.ok || !domRes.ok || !logRes.ok) {
          const readErr = (r: unknown) => {
            if (!r || typeof r !== "object") return "readFile failed";
            if ("err" in r && typeof (r as { err?: unknown }).err === "string") return (r as { err: string }).err;
            return "readFile failed";
          };
          return [
            "ARTIFACT_READ_FAILED",
            !imgRes.ok ? `- png: ${readErr(imgRes)}` : "",
            !domRes.ok ? `- dom: ${readErr(domRes)}` : "",
            !logRes.ok ? `- log: ${readErr(logRes)}` : "",
            "",
            `paths:\n- ${outPng}\n- ${outDom}\n- ${outLog}`,
          ]
            .filter(Boolean)
            .join("\n")
            .trim();
        }
        if (/\bCONNECTION_FAILED\b/.test(logText)) return "CONNECTION_FAILED";
        // If we can curl the page but can't screenshot, don't fail the check.
        if (/\bNO_HEADLESS_BROWSER\b/.test(logText)) return "";
        if (!hasOutput && !screenshot) return "CONNECTION_FAILED";
        return (domText + "\n" + logText)
          .split("\n")
          .filter((line) => /ReferenceError|TypeError|Uncaught|vite-error-overlay|react-error-overlay/i.test(line))
          .slice(0, 30)
          .join("\n")
          .trim();
      })();

      const ok = !hit;

      return { ok, hit, screenshot, outPng, outDom, outLog };
    };

    // Self-check: Builder should render (no overlay / uncaught errors)
    // We must probe "localhost" because the shell runs in the same container/netns as the server.
    // window.location.origin might be an external IP (if accessed from LAN) which the container can't resolve or reach.
    const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
    const selfUrl = `${window.location.protocol}//127.0.0.1:${port}/builder`;

    const selfBase = `opencode-artifacts/observe/builder-${iter}`;
    const self = await chromeProbe(selfUrl, selfBase);
      if (!self.ok) {
        // Fallback: if the shell cannot reach the dev server (common in containerized setups),
        // do a lightweight in-browser fetch so we don't block the loop on infra limitations.
        if (/\b(CONNECTION_FAILED|ARTIFACT_READ_FAILED|SHELL_FAILED)\b/.test(self.hit)) {
          try {
            const res = await fetch("/builder", { cache: "no-store" });
            if (res.ok) {
              info("UI render check", `shell probe failed (${self.hit}); browser fetch ok`);
              return { ok: true, log: logs.join("\n\n").trim() };
            }
          } catch {
            // keep failing below
          }
        }
        const msg = `Builder render check failed for ${selfUrl}\n${self.hit}\nArtifacts:\n- ${self.outPng}\n- ${self.outDom}\n- ${self.outLog}`;
        logs.push(msg);
        info("UI render check: failed", msg);
        return { ok: false, log: msg };
      }

    const url = previewUrl;
    if (url) {
      const base = `opencode-artifacts/observe/preview-${iter}`;
      const probe = await chromeProbe(url, base);
      if (probe.screenshot) {
        setLastScreenshot({ path: probe.outPng, dataUrl: probe.screenshot });
        info("Visual observe", `Screenshot: ${probe.outPng}`);
      }

      // If preview URL is localhost and looks like our managed port, try starting the dev server once.
      if (!probe.ok && canRunPreview && url.startsWith("http://localhost:") && url.endsWith(String(stablePort))) {
        const dir = OpenCodeDirectory.get();
        const saved = dir ? OpenCodePreviewStore.get(dir) : null;
        if (!saved?.pid) {
          info("Preview", "Starting dev server (auto)");
          await startPreviewServer().catch(() => undefined);
          const retry = await chromeProbe(`http://localhost:${stablePort}`, `${base}-retry`);
          if (retry.screenshot) {
            setLastScreenshot({ path: retry.outPng, dataUrl: retry.screenshot });
            info("Visual observe", `Screenshot: ${retry.outPng}`);
          }
          if (retry.ok) {
            info("UI render check", "ok");
            return { ok: true, log: logs.join("\n\n").trim(), url: `http://localhost:${stablePort}`, shotPath: retry.outPng, domPath: retry.outDom, logPath: retry.outLog };
          }
        }
      }

      if (!probe.ok) {
        const msg = `UI render check failed for ${url}\n${probe.hit}\nArtifacts:\n- ${probe.outPng}\n- ${probe.outDom}\n- ${probe.outLog}`;
        logs.push(msg);
        info("UI render check: failed", probe.hit);
        return { ok: false, log: msg, url, shotPath: probe.outPng, domPath: probe.outDom, logPath: probe.outLog };
      }

      info("UI render check", "ok");
      return { ok: true, log: logs.join("\n\n").trim(), url, shotPath: probe.outPng, domPath: probe.outDom, logPath: probe.outLog };
    }

    await OpenCode.fileStatus()
      .then((status) => {
        if (status.length > 0) {
          info(
            `Git status (${status.length})`,
            status.slice(0, 120).map((s) => `${s.status}: ${s.path}`).join("\n"),
          );
        } else {
          info("Git status", "clean");
        }
      })
      .catch(() => undefined);

    return { ok: true, log: logs.join("\n\n").trim() };
  }, [canRunPreview, ensureShellSession, info, loop.iteration, previewUrl, refreshPreview, refreshRootFiles, stablePort, startPreviewServer]);

  const runLoopOnce = useCallback(
    async (input: { goal: string; mode: "full" | "apply-next"; extraContext?: string; files?: File[] }) => {
      if (pendingQuestions?.length) {
        toast.error("Answer the pending questions to continue");
        return;
      }
      if (loopIsBusy(loop.state)) return;

      loopStopRef.current = false;
      dispatchLoop({ type: "START_ITERATION" });
      dispatchLoop({ type: "SET_ERROR", error: null });
      dispatchLoop({ type: "SET_RUN_LOG", log: null });

      const stopIfRequested = () => {
        if (!loopStopRef.current) return false;
        setLoopState("STOPPED");
        return true;
      };

      const abort = new AbortController();
      loopAbortRef.current = abort;
      const signal = abort.signal;

      try {
        if (input.mode === "full") {
          setLoopState("PLANNING");
          info("Loop", `Iter ${loop.iteration + 1}: planning`);

          // Step 1: PageSpec (single source of truth for UI generation).
          const psRes = await handleSendMessageRef.current(
            [
              `User Goal:\n${input.goal}`,
              "",
              "Produce a PageSpec for the UI you will build inside the CURRENT workspace.",
              "Return ONLY one JSON code block (no other text).",
              "Use these enums:",
              "- surface: app | marketing",
              "- layout: SplitView | TableWithFilters | Kanban | Landing",
              "- section.pattern: ChatPanel | FileTree | CodeEditor | Preview | Console",
              "",
              "Template:",
              "```json",
              JSON.stringify(
                {
                  route: "/",
                  surface: "app",
                  layout: "Landing",
                  title: "Page Title",
                  primaryAction: { label: "string", type: "button", target: "string" },
                  sections: [
                    {
                      id: "string",
                      pattern: "Preview",
                      props: {},
                      dataBindings: {},
                    },
                  ],
                  states: { loading: ["string"], empty: ["string"], error: ["string"] },
                },
                null,
                2,
              ),
              "```",
            ].join("\n"),
            { agent: "task", files: input.files, signal },
          );
          if (questionRef.current) return;
          if (stopIfRequested()) return;

          if (psRes?.text) {
            const parsed = extractPageSpec(psRes.text);
            if (parsed.ok === false) {
              dispatchLoop({ type: "SET_ERROR", error: parsed.error });
              setLoopState("ERROR");
              error("PageSpec", parsed.error);
              return;
            }
            setPageSpec(parsed.value);
            setPageSpecRaw(parsed.raw);
            info("PageSpec", `Captured: ${parsed.value.route} (${parsed.value.layout})`);
          }

          // Step 2: Plan (after PageSpec exists).
          await handleSendMessageRef.current(
            [
              `User Goal:\n${input.goal}`,
              "",
              pageSpec ? `PageSpec:\n\n\`\`\`json\n${stringifyPageSpec(pageSpec)}\n\`\`\`` : "",
              "",
              "Guardrails:",
              "- Work in the CURRENT directory only (treat it as the project root).",
              "- Do NOT scaffold into a new subfolder (no create-next-app <name>). Use '.' as the target.",
              "",
              "If you need clarifications, respond with ONLY this JSON code block and nothing else:",
              "```json",
              JSON.stringify(
                {
                  questions: [
                    {
                      id: "clarification",
                      question: "What do you need clarified?",
                      type: "text",
                      required: true,
                    },
                  ],
                },
                null,
                2,
              ),
              "```",
              "",
              "Otherwise: produce a small structured plan (3-7 steps). Keep it concrete: files to change and commands to run.",
            ]
              .filter(Boolean)
              .join("\n"),
            { agent: "task", files: input.files, signal },
          );
          if (questionRef.current) return;
          if (stopIfRequested()) return;
        }

        setLoopState("PATCHING");
        info("Loop", `Iter ${loop.iteration + 1}: patching`);
        const ctx = input.extraContext ? `\n\nContext:\n${input.extraContext}` : "";

        // Ensure we have a PageSpec even for "apply-next" runs.
        if (!pageSpecRaw) {
          const psRes = await handleSendMessageRef.current(
            [
              `User Goal:\n${input.goal}${ctx}`,
              "",
              "We are missing a PageSpec. Produce it now.",
              "Return ONLY one JSON code block (no other text).",
            ].join("\n"),
            { agent: "task", signal },
          );
          if (questionRef.current) return;
          if (stopIfRequested()) return;
          if (psRes?.text) {
            const parsed = extractPageSpec(psRes.text);
            if (parsed.ok) {
              setPageSpec(parsed.value);
              setPageSpecRaw(parsed.raw);
            }
          }
        }

          await handleSendMessageRef.current(
            [
              `User Goal:\n${input.goal}${ctx}`,
              pageSpecRaw ? `\n\nPageSpec:\n\n\`\`\`json\n${pageSpecRaw}\n\`\`\`` : "",
              "",
              "Guardrails:",
              "- Work in the CURRENT directory only (treat it as the project root).",
              "- Do NOT create nested project folders. Apply changes in-place.",
              "",
              "Completion:",
              "- If you believe the project is complete and deployable, write `.unloveable/complete.json` with JSON: {\"complete\": true, \"reason\": \"...\" }",
              "- Only mark complete when `npm run build` (or equivalent) passes and the app can be started locally.",
              "",
              "Speed:",
              "- Use subtasks/agents to parallelize (explore vs implement vs verify).",
              "- Batch file reads/searches; avoid serial probing.",
              "- Keep tool runs minimal; batch related edits.",
              "",
              "If you need clarifications, respond with ONLY this JSON code block and nothing else:",
              "```json",
              JSON.stringify(
                {
                questions: [
                  {
                    id: "scope",
                    question: "What should we build next?",
                    type: "select",
                    options: ["fix", "feature", "refactor"],
                    required: true,
                  },
                ],
              },
              null,
              2,
            ),
            "```",
            "",
            "Rules:",
            "- id must be stable snake_case",
            "- question must end with ?",
            "- type is text | select | boolean",
            "- select requires options[]",
            "- boolean answers are yes/no",
            "",
            "Otherwise: apply the minimal patch to make progress toward the goal. Keep changes small and run relevant checks.",
          ]
            .filter(Boolean)
            .join("\n"),
            { agent: "task", files: input.files, signal },
          );
        if (questionRef.current) return;
        if (stopIfRequested()) return;

        setLoopState("RUNNING");
        info("Loop", `Iter ${loop.iteration + 1}: running checks`);
        const res = await runChecks(signal);
        dispatchLoop({ type: "SET_RUN_LOG", log: res.log });
        info(`Checks: ${res.ok ? "ok" : "failed"}`, res.log);
        if (stopIfRequested()) return;

        setLoopState("OBSERVING");
        info("Loop", `Iter ${loop.iteration + 1}: observing`);
        const obs = await observe(signal);
        if (stopIfRequested()) return;

        if (!obs.ok) {
          dispatchLoop({ type: "SET_ERROR", error: obs.log || "UI render check failed" });

          // Infra failures (connection refused / no browser) are not fixable by the agent.
          // Never let the agent mutate the user's workspace to "fix" the Builder UI check.
          const isInfra = /\bCONNECTION_FAILED\b/.test(obs.log || "");
          if (isInfra) {
            setLoopState("ERROR");
            toast.error("Render check could not reach the Builder URL from the shell. Ensure the Builder dev server is running and reachable.");
            error(`Loop: Iter ${loop.iteration + 1}: ui check failed`, obs.log || "");
            return;
          }

          setLoopState("REPAIRING");
          info("Loop", `Iter ${loop.iteration + 1}: repairing (ui)`);
          await handleSendMessageRef.current(
            [
              STRICT_QUESTIONS,
              "",
              `The Builder UI failed a render check due to a client-side error overlay. Fix the Builder code (NOT the workspace project), then re-run the check.`,
              obs.url ? `URL: ${obs.url}` : "",
              obs.log ? `\nError:\n${obs.log}` : "",
              obs.shotPath ? `\nArtifacts:\n- ${obs.shotPath}\n- ${obs.domPath}\n- ${obs.logPath}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            { agent: "task", signal },
          );
          if (questionRef.current) return;
          if (stopIfRequested()) return;

          setLoopState("OBSERVING");
          const obs2 = await observe(signal);
          if (obs2.ok) {
            dispatchLoop({ type: "SET_ERROR", error: null });
          } else {
            dispatchLoop({ type: "SET_ERROR", error: obs2.log || "UI render check failed" });
            setLoopState("ERROR");
            error(`Loop: Iter ${loop.iteration + 1}: ui check failed`, obs2.log || "");
            return;
          }
        }

        if (res.ok) {
          setLoopState("DONE");
          success("Loop", `Iter ${loop.iteration + 1}: done`);
          return;
        }

        dispatchLoop({ type: "SET_ERROR", error: res.log });
        setLoopState("REPAIRING");
        info("Loop", `Iter ${loop.iteration + 1}: repairing`);
        await handleSendMessageRef.current(
          [
            STRICT_QUESTIONS,
            "",
            "We have a failing check. Fix it with a minimal patch.",
            "",
            `Error output:\n${res.log}`,
          ].join("\n"),
          { agent: "task", signal },
        );
        if (questionRef.current) return;
        if (stopIfRequested()) return;

        setLoopState("RUNNING");
        const res2 = await runChecks(signal);
        dispatchLoop({ type: "SET_RUN_LOG", log: res2.log });
        info(`Checks: ${res2.ok ? "ok" : "failed"}`, res2.log);

        setLoopState("OBSERVING");
        await observe(signal);

        if (res2.ok) {
          dispatchLoop({ type: "SET_ERROR", error: null });
          setLoopState("DONE");
          success("Loop", `Iter ${loop.iteration + 1}: done (after repair)`);
          return;
        }

        dispatchLoop({ type: "SET_ERROR", error: res2.log });
        setLoopState("ERROR");
        error(`Loop: Iter ${loop.iteration + 1}: failed`, res2.log);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        dispatchLoop({ type: "SET_ERROR", error: msg });
        setLoopState("ERROR");
        error("Loop", msg);
      }
    },
    [error, info, observe, pageSpec, pageSpecRaw, pendingQuestions, runChecks, setLoopState, success, loop.state, loop.iteration],
  );

  const runAutoLoop = useCallback(
    async (input: { goal: string; files?: File[] }) => {
      autoLoopRef.current = { active: true, goal: input.goal, max: 25, startedAt: Date.now() };
      loopStopRef.current = false;

      for (let i = 0; i < 25; i++) {
        if (!autoLoopRef.current?.active) return;
        if (loopStopRef.current) return;

        if (await isComplete()) {
          autoLoopRef.current = { ...autoLoopRef.current, active: false };
          success("Loop", "Project marked complete (.unloveable/complete.json)");
          return;
        }

        await runLoopOnce({ goal: input.goal, mode: i === 0 ? "full" : "apply-next", files: i === 0 ? input.files : undefined });
        await new Promise((r) => window.setTimeout(r, 0));
      }

      autoLoopRef.current = { ...autoLoopRef.current!, active: false };
      warn("Loop", "Stopped after 25 iterations (max)");
    },
    [isComplete, runLoopOnce, success, warn],
  );

  const runPreview = useCallback(async () => {
    setIsRunStarting(true);
    try {
      const started = await startPreviewServer();
      toast.success(`Preview running at ${started.url}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start preview");
    } finally {
      setIsRunStarting(false);
    }
  }, [startPreviewServer]);

  useEffect(() => {
    if (!canRunPreview) return;
    if (previewUrl) return;
    if (isGenerating || isRunStarting) return;
    const dir = OpenCodeDirectory.get();
    if (!dir) return;
    if (autoRunAttemptedRef.current.has(dir)) return;
    autoRunAttemptedRef.current.add(dir);
    runPreview().catch(() => {
      // Allow retry if the auto-run failed.
      autoRunAttemptedRef.current.delete(dir);
    });
  }, [canRunPreview, isGenerating, isRunStarting, previewUrl, runPreview, directory]);

  // If the Preview URL is set but the server isn't actually reachable, try to self-heal
  // by starting the preview server (common when a previous dev server was killed).
  const previewHealRef = useRef<Record<string, number>>({});
  useEffect(() => {
    const dir = OpenCodeDirectory.get();
    if (!dir) return;
    if (!previewUrl) return;
    if (!canRunPreview) return;
    if (isGenerating || isRunStarting) return;

    const url = previewUrl;
    const wants = `http://localhost:${stablePort}`;
    if (url !== wants) return;

    const last = previewHealRef.current[dir] ?? 0;
    if (Date.now() - last < 15000) return;
    previewHealRef.current[dir] = Date.now();

    // Don't probe with fetch() here (CORS will fail for most dev servers).
    // If we have a saved PID, assume it is (or was) started; otherwise start it.
    const saved = OpenCodePreviewStore.get(dir);
    if (!saved?.pid) {
      runPreview().catch(() => undefined);
    }
  }, [canRunPreview, directory, isGenerating, isRunStarting, previewUrl, runPreview, stablePort]);

  const selectSession = useCallback(
    async (id: string) => {
      await stop();
      setGoal(null);
      dispatchLoop({ type: "RESET" });

      const sess = await OpenCode.getSession(id).catch(() => null);
      if (sess?.directory) {
        OpenCodeDirectory.set(sess.directory);
        setDirectory(OpenCodeDirectory.get());
        setRootFiles([]);
        setChildrenByPath({});
        await refreshRootFiles().catch(() => undefined);
      }

      setSessionID(id);
      OpenCodeSessionStore.set(OpenCodeDirectory.get(), id);
      setStreamingContent("");
      setIsGenerating(false);
      await loadMessages(id).catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load session messages");
      });
    },
    [loadMessages, stop, refreshRootFiles],
  );

  const createWorkspaceSession = useCallback(async (template?: string, nameOverride?: string) => {
    const root = OpenCodeWorkspace.root.get() ?? OpenCodeWorkspace.root.defaultValue;
    const shared = `${root.replace(/\/$/, "")}/_shared/packages/shared`;
    const name = nameOverride ?? window.prompt("Workspace name (folder)", OpenCodeWorkspace.nextName(template));
    if (!name) return;

    const normalized = name.trim().replace(/\s+/g, "-");
    const dir = `${root.replace(/\/$/, "")}/${normalized}`;

    try {
      await stop();
      const id = await ensureShellSession();
      const agent = OpenCodePreferences.agent.get() ?? "task";
      await OpenCode.runShell(id, `mkdir -p "${dir}"`, { agent });

      const tpl = (template && template.trim()) ? template.trim() : "blank";
      const write = async (file: string, content: string) => {
        const safe = content.replace(/\r\n/g, "\n");
        await OpenCode.runShell(
          id,
          `mkdir -p "$(dirname "${dir}/${file}")" && cat > "${dir}/${file}" <<'EOF'\n${safe}\nEOF`,
          { agent },
        );
      };

      if (tpl === "blank") {
        await write(
          "package.json",
          JSON.stringify(
            {
              name: normalized,
              private: true,
              version: "0.0.0",
              type: "module",
              scripts: { start: "node index.js", dev: "node index.js" },
            },
            null,
            2,
          ),
        );
        await write("index.js", 'console.log("hello")\n');
        await write(".gitignore", "node_modules\n");
      }

      if (tpl === "express-spa") {
        await write(
          "package.json",
          JSON.stringify(
            {
              name: normalized,
              private: true,
              version: "0.0.0",
              type: "module",
              scripts: { start: "node server/index.js", dev: "node server/index.js" },
              dependencies: { express: "^4.19.0" },
            },
            null,
            2,
          ),
        );
        await write(
          "server/index.js",
          [
            'import express from "express"',
            "",
            "const app = express()",
            "app.use(express.json())",
            "app.use(express.static(\"web\"))",
            "",
            "app.get(\"/api/health\", (_req, res) => res.json({ ok: true }))",
            "",
            "const port = process.env.PORT || 3000",
            "app.listen(port, () => console.log(`listening on ${port}`))",
            "",
          ].join("\n"),
        );
        await write(
          "web/index.html",
          [
            "<!doctype html>",
            "<html>",
            "  <head>",
            "    <meta charset=\"UTF-8\" />",
            "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
            "    <title>Workspace App</title>",
            "    <style>",
            "      body{font-family:system-ui, sans-serif; margin:32px;}",
            "      .card{border:1px solid #ddd; border-radius:12px; padding:16px; max-width:720px;}",
            "    </style>",
            "  </head>",
            "  <body>",
            "    <div class=\"card\">",
            "      <h1>Express + SPA</h1>",
            "      <p>Minimal runnable workspace scaffold.</p>",
            "      <pre id=\"health\">Loading...</pre>",
            "    </div>",
            "    <script>",
            "      fetch('/api/health').then(r => r.json()).then(j => {",
            "        document.getElementById('health').textContent = JSON.stringify(j, null, 2)",
            "      })",
            "    </script>",
            "  </body>",
            "</html>",
            "",
          ].join("\n"),
        );
        await write(".gitignore", "node_modules\n");
      }

      if (tpl === "vite-react-ts") {
        await write(
          "package.json",
          JSON.stringify(
            {
              name: normalized,
              private: true,
              version: "0.0.0",
              type: "module",
              scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
              dependencies: { react: "^18.3.0", "react-dom": "^18.3.0" },
              devDependencies: {
                vite: "^5.2.0",
                "@vitejs/plugin-react": "^4.3.0",
                typescript: "^5.4.0",
                "@types/react": "^18.3.0",
                "@types/react-dom": "^18.3.0",
              },
            },
            null,
            2,
          ),
        );
        await write(
          "tsconfig.json",
          JSON.stringify(
            {
              compilerOptions: {
                target: "ESNext",
                module: "ESNext",
                jsx: "react-jsx",
                moduleResolution: "Bundler",
                strict: true,
                skipLibCheck: true,
              },
            },
            null,
            2,
          ),
        );
        await write(
          "vite.config.ts",
          [
            'import { defineConfig } from "vite"',
            'import react from "@vitejs/plugin-react"',
            "",
            "export default defineConfig({ plugins: [react()] })",
            "",
          ].join("\n"),
        );
        await write(
          "index.html",
          [
            "<!doctype html>",
            "<html>",
            "  <head>",
            "    <meta charset=\"UTF-8\" />",
            "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
            "    <title>Vite React TS</title>",
            "  </head>",
            "  <body>",
            "    <div id=\"root\"></div>",
            "    <script type=\"module\" src=\"/src/main.tsx\"></script>",
            "  </body>",
            "</html>",
            "",
          ].join("\n"),
        );
        await write(
          "src/main.tsx",
          [
            'import React from "react"',
            'import { createRoot } from "react-dom/client"',
            'import App from "./App"',
            "",
            'createRoot(document.getElementById("root")!).render(<App />)',
            "",
          ].join("\n"),
        );
        await write(
          "src/App.tsx",
          [
            "export default function App() {",
            "  return (",
            "    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>",
            "      <h1>Vite + React + TS</h1>",
            "      <p>Minimal runnable workspace scaffold.</p>",
            "    </main>",
            "  )",
            "}",
            "",
          ].join("\n"),
        );
        await write(".gitignore", "node_modules\ndist\n");
      }

      if (tpl === "nextjs") {
        await write(
          "package.json",
          JSON.stringify(
            {
              name: normalized,
              private: true,
              version: "0.0.0",
              scripts: { dev: "next dev", build: "next build", start: "next start" },
              dependencies: { next: "14.2.0", react: "^18.3.0", "react-dom": "^18.3.0" },
            },
            null,
            2,
          ),
        );
        await write(
          "tsconfig.json",
          JSON.stringify(
            {
              compilerOptions: {
                target: "ES2017",
                lib: ["dom", "dom.iterable", "esnext"],
                allowJs: true,
                skipLibCheck: true,
                strict: true,
                noEmit: true,
                esModuleInterop: true,
                module: "esnext",
                moduleResolution: "bundler",
                resolveJsonModule: true,
                isolatedModules: true,
                jsx: "preserve",
              },
              include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
              exclude: ["node_modules"],
            },
            null,
            2,
          ),
        );
        await write(
          "next-env.d.ts",
          "/// <reference types=\"next\" />\n/// <reference types=\"next/image-types/global\" />\n\nexport {}\n",
        );
        await write(
          "app/layout.tsx",
          [
            "export const metadata = { title: 'Next App' }",
            "",
            "export default function RootLayout({ children }: { children: React.ReactNode }) {",
            "  return (",
            "    <html lang=\"en\">",
            "      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>",
            "    </html>",
            "  )",
            "}",
            "",
          ].join("\n"),
        );
        await write(
          "app/page.tsx",
          [
            "export default function Page() {",
            "  return (",
            "    <main style={{ padding: 24 }}>",
            "      <h1>Hello Next.js</h1>",
            "      <p>Minimal runnable workspace scaffold.</p>",
            "    </main>",
            "  )",
            "}",
            "",
          ].join("\n"),
        );
        await write(".gitignore", "node_modules\n.next\n");
      }

      if (OpenCodeWorkspace.linkShared.get()) {
        await OpenCode.runShell(
          id,
          `mkdir -p "${shared}" && mkdir -p "${dir}/packages" && ln -sfn "${shared}" "${dir}/packages/shared"`,
          { agent },
        );
        await OpenCode.runShell(
          id,
          `test -f "${shared}/package.json" || cat > "${shared}/package.json" <<'EOF'
{
  "name": "@workspace/shared",
  "private": true,
  "version": "0.0.0",
  "type": "module"
}
EOF`,
          { agent },
        );
        await OpenCode.runShell(
          id,
          `test -f "${shared}/README.md" || cat > "${shared}/README.md" <<'EOF'
# Shared

Shared code for workspaces.
EOF`,
          { agent },
        );
        await OpenCode.runShell(
          id,
          `test -f "${shared}/index.ts" || cat > "${shared}/index.ts" <<'EOF'
export const shared = true
EOF`,
          { agent },
        );
      }

      if (OpenCodeWorkspace.supabase.enabled.get()) {
        const url = OpenCodeWorkspace.supabase.url.get();
        const key = OpenCodeWorkspace.supabase.anonKey.get();
        if (key) {
          await OpenCode.runShell(
            id,
            `test -f "${dir}/.env.local" || cat > "${dir}/.env.local" <<'EOF'
SUPABASE_URL=${url}
SUPABASE_ANON_KEY=${key}
EOF`,
            { agent },
          );
        }
      }

      OpenCodeDirectory.set(dir);
      setDirectory(OpenCodeDirectory.get());

      setShellSessionID(null);

      await stop();
      setSessionID(null);
      setMessages([]);
      setSelectedFile(null);
      setChildrenByPath({});

      await refreshRootFiles();
      await refreshPreview().catch(() => undefined);
      const session = await OpenCode.createSession();
      setSessionID(session.id);
      OpenCodeSessionStore.set(OpenCodeDirectory.get(), session.id);
      info("Workspace session created", `Dir: ${dir}`);
      setGoal(null);
      dispatchLoop({ type: "RESET" });
      await refreshSessions().catch(() => undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create workspace");
    }
  }, [ensureShellSession, info, refreshRootFiles, refreshPreview, refreshSessions, stop]);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    const existing = OpenCodeDirectory.get();
    if (!existing) {
      warn(
        "OpenCode directory not set",
        `OpenCode will operate in the server's current working directory. Click the Directory pill and set ${RECOMMENDED_DIRECTORY}.`,
      );
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "opencode.directory") return;
      setDirectory(OpenCodeDirectory.get());
    };
    window.addEventListener("storage", onStorage);

    (async () => {
      try {
        await OpenCode.health();
        await refreshRootFiles();
        await refreshPreview().catch(() => undefined);
        await ensureSession();
        const dirOverride = OpenCodeDirectory.get();
        if (dirOverride) info("OpenCode working directory", dirOverride);
        await OpenCode.pathInfo()
          .then((p) => info("OpenCode server directory", p.directory))
          .catch(() => undefined);
      } catch (err) {
        error(
          "OpenCode not reachable",
          err instanceof Error ? err.message : "Check VITE_OPENCODE_URL and server status",
        );
        toast.error("OpenCode server not reachable (check VITE_OPENCODE_URL)");
      }
    })();

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [ensureSession, refreshRootFiles, refreshPreview, info, warn, error]);

  const applyDirectory = useCallback(
    async (abs: string) => {
      OpenCodeDirectory.set(abs);
      setDirectory(OpenCodeDirectory.get());

      await stop();
      setSessionID(null);
      setMessages([]);
      setSelectedFile(null);
      setChildrenByPath({});

      try {
        await refreshRootFiles();
        await refreshPreview().catch(() => undefined);
        await ensureSession();
        setGoal(null);
        dispatchLoop({ type: "RESET" });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to switch directory");
      }
    },
    [ensureSession, refreshPreview, refreshRootFiles, stop],
  );

  const handleChangeDirectory = useCallback(async () => {
    setDirPickerOpen(true);
  }, []);

  async function handleSendMessage(
    content: string,
    opts?: { agent?: string; files?: File[]; signal?: AbortSignal },
  ): Promise<null | { text: string; messageID?: string }> {
    questionRef.current = false;

    const readAsDataUrl = (file: File) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.readAsDataURL(file);
      });
    };

    const selected = Array.isArray(opts?.files) ? opts!.files! : [];
    if (selected.length > 6) {
      toast.error("Too many attachments (max 6)");
      return;
  }

  handleSendMessageRef.current = handleSendMessage;

    let fileParts: Array<{ type: "file"; url: string; mime: string; filename?: string }> = [];
    let done = false;
    let resolveResult: ((v: null | { text: string; messageID?: string }) => void) | null = null;
    let rejectResult: ((err: unknown) => void) | null = null;
    const finishOk = (v: null | { text: string; messageID?: string }) => {
      if (done) return;
      done = true;
      resolveResult?.(v);
    };
    const finishErr = (err: unknown) => {
      if (done) return;
      done = true;
      rejectResult?.(err);
    };

     try {
      fileParts = await Promise.all(
        selected.map(async (f) => {
          if (f.size > 8 * 1024 * 1024) {
            throw new Error(`File too large: ${f.name} (max 8MB)`);
          }
          const url = await readAsDataUrl(f);
          return {
            type: "file" as const,
            url,
            mime: f.type || "application/octet-stream",
            filename: f.name,
          };
        }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to attach file");
      return;
    }

    const promptText = content.trim() ? content : (fileParts.length ? "See attached file(s)." : content);
    const promptParts = [{ type: "text" as const, text: promptText }, ...fileParts];

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: promptText,
      attachments: fileParts.map((p) => ({ url: p.url, mime: p.mime, filename: p.filename })),
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);
    setStreamingContent("");
    info("Sending message to OpenCode", `Prompt: ${promptText}`);

    const assistantMessageId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }]);

    let fullResponse = "";
    let pollID: number | null = null;

    try {
      const id = await ensureSession();
      const abort = new AbortController();
      abortRef.current = abort;
      const startedAt = Date.now();
      liveRef.current = { startedAt, sessionID: id, assistantUI: assistantMessageId, content: "", lastEventAt: startedAt };

      // Reliability: if the HTTP request hangs but the session completes server-side,
      // poll for a completed assistant message and hydrate the UI.
      pollID = window.setInterval(() => {
        const live = liveRef.current;
        if (!live || live.sessionID !== id || abort.signal.aborted) {
          if (pollID !== null) window.clearInterval(pollID);
          pollID = null;
          return;
        }
        OpenCode.listMessages(id, 12)
          .then((items) => {
            const match = items
              .filter((m) => m.info?.role === "assistant")
              .find((m) => {
                const created = m.info?.time?.created;
                const completed = m.info?.time?.completed;
                return typeof created === "number" && created >= startedAt - 2000 && typeof completed === "number";
              });
            if (!match) return;
            const msg: OpenCodeMessageResponse = {
              info: { id: match.info.id, role: match.info.role, error: match.info.error },
              parts: match.parts,
            };
            const text = extractDisplayText(msg);

             abortRef.current?.abort();
             abortRef.current = null;
             liveRef.current = null;
             setIsGenerating(false);
             setStreamingContent("");
             setMessages((prev) => prev.map((m) => (m.id === assistantMessageId ? { ...m, content: text } : m)));

             finishOk({ text, messageID: match.info.id });

            if (pollID !== null) window.clearInterval(pollID);
            pollID = null;
          })
          .catch(() => undefined);
      }, 1500);

      const result = await new Promise<null | { text: string; messageID?: string }>((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
        streamOpenCodeMessage({
           sessionID: id,
           parts: promptParts,
           input: getPromptInput(opts?.agent),
           signal: abort.signal,
           simulate: false,
           onDelta: (text) => {
             fullResponse += text;
             setStreamingContent(fullResponse);
             setMessages((prev) =>
               prev.map((m) => (m.id === assistantMessageId ? { ...m, content: fullResponse } : m)),
             );
           },
            onDone: async (responseText, msg) => {
          if (pollID !== null) window.clearInterval(pollID);
          pollID = null;
          liveRef.current = null;
           const ocMessageID = msg?.info?.id;
           if (ocMessageID) setLastAssistantMessageID(ocMessageID);

           const assistantAttachments = (() => {
             const out: Array<{ url: string; mime: string; filename?: string }> = [];
             const parts = Array.isArray(msg.parts) ? msg.parts : [];
             for (const p of parts) {
               if (!p || typeof p !== "object") continue;
               const part = p as OpenCodeMessagePart;
               const t = part.type;
               if (t === "file") {
                 const url = typeof part.url === "string" ? part.url : "";
                 if (!url) continue;
                 const mime = typeof part.mime === "string" ? part.mime : "application/octet-stream";
                 const filename = typeof part.filename === "string" ? part.filename : undefined;
                 out.push({ url, mime, filename });
                 continue;
               }
               if (t === "tool") {
                 out.push(...parseAttachmentsFromToolState(part.state));
               }
             }
             return out;
           })();
          const ocError = (() => {
            const err = msg.info?.error as unknown;
            if (!err) return "";
            if (typeof err === "string") return err;
            if (typeof err !== "object") return "";

            const obj = err as Record<string, unknown>;
            const direct = typeof obj.message === "string" ? obj.message : "";
            if (direct) return direct;

            const data = obj.data;
            if (!data || typeof data !== "object") return "";
            return typeof (data as Record<string, unknown>).message === "string"
              ? ((data as Record<string, unknown>).message as string)
              : "";
          })();
          if (ocError) {
            const hint = (() => {
              const err = msg.info?.error as unknown;
              if (!isObj(err)) return "";
              const data = isObj(err.data) ? err.data : null;
              const metadata = data && isObj(data.metadata) ? data.metadata : null;
              const url = metadata && typeof metadata.url === "string" ? metadata.url : "";
              if (url.includes("githubcopilot")) return "GitHub Copilot";
              if (url.includes("openai")) return "OpenAI";
              if (url.includes("anthropic")) return "Anthropic";
              return "";
            })();

            toast.error(hint ? `${hint} provider error: ${ocError}. Check Settings → Providers/Auth.` : ocError);
            error("OpenCode error", ocError);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content: `[error] ${ocError}`,
                    }
                  : m,
              ),
            );
            throw new Error(ocError);
          }

          if (!responseText.trim()) {
            const types = Array.isArray(msg.parts)
              ? msg.parts
                  .map((p) => (p && typeof p.type === "string" ? p.type : "unknown"))
                  .slice(0, 40)
                  .join(", ")
              : "(no parts)";

            info("OpenCode parts", types);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content:
                        "[OpenCode returned no text parts. Check Console for part types and any errors.]",
                      attachments: assistantAttachments,
                    }
                  : m,
              ),
            );
          }

          setIsGenerating(false);
          setStreamingContent("");
          abortRef.current = null;

          if (assistantAttachments.length) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMessageId ? { ...m, attachments: assistantAttachments } : m)),
            );
          }

           const raw = (() => {
             const parts = Array.isArray(msg.parts) ? msg.parts : [];
             return parts
               .filter((p): p is OpenCodeMessagePart => !!p && (p.type === "text" || p.type === "reasoning"))
               .map((p) => (typeof p.text === "string" ? p.text : ""))
               .filter(Boolean)
               .join("\n\n");
           })();

           const qs = extractClarificationSpec(raw || responseText);
          if (qs.source === "heuristic" && qs.items.length) {
            warn(
              "Clarifications were not JSON",
              "Model returned natural-language questions; using heuristic extraction. Ask it to return ONLY the JSON block next time.",
            );
          }
           if (qs.items.length) {
             questionRef.current = true;
             setPendingQuestions(qs.items);
             setPendingQuestionsKind("clarification");
             dispatchLoop({ type: "SET_STATE", state: "IDLE" });

            // Don't leave raw JSON in chat; replace with a short prompt.
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? { ...m, content: "I have a few quick questions — answer in the dialog to continue." }
                  : m,
              ),
            );
           }

          // If we're not in an active loop step, ensure the UI stops polling.
          if (!questionRef.current) {
            dispatchLoop({ type: "SET_STATE", state: "IDLE" });
          }

           success("OpenCode response complete", `${responseText.length} chars`);
           await refreshRootFiles().catch(() => undefined);
           await refreshPreview().catch(() => undefined);
          await OpenCode.fileStatus()
            .then((status) => {
              if (status.length > 0) {
                info(
                  `Git status (${status.length})`,
                  status.slice(0, 50).map((s) => `${s.status}: ${s.path}`).join("\n"),
                );
              }
            })
            .catch(() => undefined);
              finishOk({ text: raw || responseText, messageID: typeof ocMessageID === "string" ? ocMessageID : undefined });
         },
         onError: (errMsg) => {
            if (done) return;
            if (pollID !== null) window.clearInterval(pollID);
            pollID = null;
            toast.error(errMsg);
            error("OpenCode message failed", errMsg);
            setIsGenerating(false);
           setStreamingContent("");
           abortRef.current = null;
           liveRef.current = null;
           setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));

            finishErr(new Error(errMsg));
         },
        }).catch((e) => {
          if (done) return;
          finishErr(e);
        });
      });

      return result ?? null;
    } catch (err) {
      if (pollID !== null) window.clearInterval(pollID);
      pollID = null;
      liveRef.current = null;
      toast.error(err instanceof Error ? err.message : "Failed to send message");
      error("OpenCode message failed", err instanceof Error ? err.message : "Unknown error");
      setIsGenerating(false);
      setStreamingContent("");
      abortRef.current = null;
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));

       // Propagate failure to the loop so it doesn't continue as if planning/patching succeeded.
       throw err;
     }
      return null;
   }

  const handleAnswerQuestions = useCallback(
    async (answers: Array<{ id: string; answer: string }>) => {
      if (!pendingQuestions?.length) return;

      const kind = pendingQuestionsKind;

      // Close modal before doing network work.
      setPendingQuestions(null);
      setPendingQuestionsKind(null);

      if (kind === "intake") {
        const g = pendingGoalToResume || goal || "(no goal set)";
        const normalized = answers.map((a) => ({ id: a.id, answer: a.answer.trim() }));
        setIntakeSnapshot({ goal: g, answers: normalized });

        // Generate docs into the current workspace.
        const prompt = [
          "You are the Foundry Doc Generator.",
          "Do not write implementation code.",
          "Do not add features beyond the user's intent.",
          "",
          `User idea:\n${g}`,
          "",
          "User answers:",
          ...normalized.map((a) => `- ${a.id}: ${a.answer || "(no answer)"}`),
          "",
          "Write/update these files in the CURRENT directory:",
          "- spec.md",
          "- brand-and-ux-spec.md",
          "- architecture.md",
          "- implementation-plan.md",
          "- prompt.md",
          "",
          "Return ONLY one JSON code block with EXACT keys:",
          "spec.md, brand-and-ux-spec.md, architecture.md, implementation-plan.md, prompt.md",
          "Each value must be the full file content as a string.",
        ].join("\n");

        const res = await handleSendMessageRef.current(prompt, { agent: "task" });
        if (res?.text) {
          const m = /```json\s*([\s\S]*?)\s*```/i.exec(res.text);
          const obj = m ? parseJsonRecord(m[1]) : null;
          const files = obj && {
            spec: typeof obj["spec.md"] === "string" ? (obj["spec.md"] as string) : null,
            brand: typeof obj["brand-and-ux-spec.md"] === "string" ? (obj["brand-and-ux-spec.md"] as string) : null,
            arch: typeof obj["architecture.md"] === "string" ? (obj["architecture.md"] as string) : null,
            plan: typeof obj["implementation-plan.md"] === "string" ? (obj["implementation-plan.md"] as string) : null,
            loop: typeof obj["prompt.md"] === "string" ? (obj["prompt.md"] as string) : null,
          };

          if (!files || !files.spec || !files.brand || !files.arch || !files.plan || !files.loop) {
            toast.error("Doc generator did not return valid JSON for required files");
            return;
          }

          await OpenCode.writeFile("spec.md", files.spec);
          await OpenCode.writeFile("brand-and-ux-spec.md", files.brand);
          await OpenCode.writeFile("architecture.md", files.arch);
          await OpenCode.writeFile("implementation-plan.md", files.plan);
          await OpenCode.writeFile("prompt.md", files.loop);
          info("Intake", "Wrote docs: spec.md, brand-and-ux-spec.md, architecture.md, implementation-plan.md, prompt.md");
        }

        // Ensure we have a runnable project in blank workspaces.
        const hasPkg = await OpenCode.readFile("package.json")
          .then((r) => !!r?.content)
          .catch(() => false);
        if (!hasPkg) {
          info("Scaffold", "No package.json found; creating a minimal Vite React TS scaffold");
          const name = (OpenCodeDirectory.get() || "workspace").split("/").pop() || "workspace";
          const normalizedName = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
          await OpenCode.writeFile(
            "package.json",
            JSON.stringify(
              {
                name: normalizedName || "workspace",
                private: true,
                version: "0.0.0",
                type: "module",
                scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
                dependencies: { react: "^18.3.0", "react-dom": "^18.3.0" },
                devDependencies: {
                  vite: "^5.2.0",
                  "@vitejs/plugin-react": "^4.3.0",
                  typescript: "^5.4.0",
                  "@types/react": "^18.3.0",
                  "@types/react-dom": "^18.3.0",
                },
              },
              null,
              2,
            ),
          );
          await OpenCode.writeFile(
            "tsconfig.json",
            JSON.stringify(
              {
                compilerOptions: {
                  target: "ESNext",
                  module: "ESNext",
                  jsx: "react-jsx",
                  moduleResolution: "Bundler",
                  strict: true,
                  skipLibCheck: true,
                },
              },
              null,
              2,
            ),
          );
          await OpenCode.writeFile(
            "vite.config.ts",
            ['import { defineConfig } from "vite"', 'import react from "@vitejs/plugin-react"', "", "export default defineConfig({ plugins: [react()] })", ""].join("\n"),
          );
          await OpenCode.writeFile(
            "index.html",
            [
              "<!doctype html>",
              "<html>",
              "  <head>",
              "    <meta charset=\"UTF-8\" />",
              "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />",
              "    <title>Vite React TS</title>",
              "  </head>",
              "  <body>",
              "    <div id=\"root\"></div>",
              "    <script type=\"module\" src=\"/src/main.tsx\"></script>",
              "  </body>",
              "</html>",
              "",
            ].join("\n"),
          );
          await OpenCode.writeFile(
            "src/main.tsx",
            ['import React from "react"', 'import { createRoot } from "react-dom/client"', 'import App from "./App"', "", 'createRoot(document.getElementById("root")!).render(<App />)', ""].join("\n"),
          );
          await OpenCode.writeFile(
            "src/App.tsx",
            [
              "export default function App() {",
              "  return (",
              "    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>",
              "      <h1>New Project</h1>",
              "      <p>Scaffolded by UnLoveable intake.</p>",
              "    </main>",
              "  )",
              "}",
              "",
            ].join("\n"),
          );
          await OpenCode.writeFile(".gitignore", "node_modules\ndist\n");
        }

        // Kick off the loop and keep iterating until complete.
        setPendingGoalToResume(null);
        await runAutoLoop({ goal: g });
        return;
      }

      const lines: string[] = ["Clarifications"]; 
      for (const q of pendingQuestions) {
        const a = answers.find((x) => x.id === q.id)?.answer || "(no answer)";
        lines.push(`- ${q.question}`);
        lines.push(`  Answer: ${a}`);
      }

      await handleSendMessageRef.current(lines.join("\n"), { agent: "task" });
      if (goal) {
        await runLoopOnce({ goal, mode: "apply-next", extraContext: lines.join("\n") });
      }
    },
    [goal, info, pendingGoalToResume, pendingQuestions, pendingQuestionsKind, runAutoLoop, runLoopOnce],
  );

  const handleFileSelect = useCallback(
    async (path: string) => {
      try {
        const file = await OpenCode.readFile(path);
        const language = guessLanguage(path);
        setSelectedFile({ path, content: file.content, language });
        if (language === "html") {
          setPreview({ path, html: file.content });
        }
        debug(`Opened file: ${path}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to read file");
      }
    },
    [debug],
  );

  const handleCloseEditor = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleResetSession = useCallback(async () => {
    if (OpenCodeWorkspace.autoCreate.get()) {
      const hasProject = await OpenCode.readFile("package.json")
        .then((r) => !!r?.content)
        .catch(() => false);

      // Only auto-create a new workspace when the current directory isn't already a project.
      if (!hasProject) {
        const tpl = OpenCodeWorkspace.defaultTemplate.get();
        await createWorkspaceSession(tpl, OpenCodeWorkspace.nextName(tpl));
        return;
      }
    }

    await stop();
    setMessages([]);
    setSelectedFile(null);
    setChildrenByPath({});
    setGoal(null);
    dispatchLoop({ type: "RESET" });
    try {
      const session = await OpenCode.createSession();
      setSessionID(session.id);
      OpenCodeSessionStore.set(OpenCodeDirectory.get(), session.id);
      info("Session reset", `Session: ${session.id}`);
      await refreshSessions().catch(() => undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset session");
    }
  }, [createWorkspaceSession, info, stop, refreshSessions]);

  const handleApplyNextPatch = useCallback(async () => {
    const err = loop.lastError ? `\n\nLast error:\n${loop.lastError}` : "";
    await runLoopOnce({ goal: goal ?? "(no goal set)", mode: "apply-next", extraContext: err });
  }, [goal, loop.lastError, runLoopOnce]);

  const handleRunLoop = useCallback(async () => {
    if (!goal) {
      toast.error("Send a goal in chat first");
      return;
    }
    await runLoopOnce({ goal, mode: "full" });
  }, [goal, runLoopOnce]);

  const handleUserGoal = useCallback(
    async (payload: { content: string; files?: File[] }) => {
      setGoal(payload.content);

      // Intake: before doing any building, collect the 5 questions and generate the docs.
      // If docs already exist, skip straight to the loop.
      const hasPrompt = await OpenCode.readFile("prompt.md")
        .then((r) => !!r?.content)
        .catch(() => false);
      const hasSpec = await OpenCode.readFile("spec.md")
        .then((r) => !!r?.content)
        .catch(() => false);

      if (!hasPrompt || !hasSpec) {
        setPendingQuestions(INTAKE_QUESTIONS);
        setPendingQuestionsKind("intake");
        setPendingGoalToResume(payload.content);
        return;
      }

      await runAutoLoop({ goal: payload.content, files: payload.files });
    },
    [runAutoLoop],
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      <OpenCodeDirectoryDialog
        open={dirPickerOpen}
        onOpenChange={setDirPickerOpen}
        onSelectAbsolutePath={(abs) => {
          applyDirectory(abs).catch(() => undefined);
        }}
      />
      <BuilderHeader 
        sessions={sessions}
        isSessionsLoading={isSessionsLoading}
        onRefreshSessions={() => refreshSessions().catch(() => undefined)}
        onSelectSession={selectSession}
        onNewWorkspaceSession={createWorkspaceSession}
        sessionID={sessionID}
        lastAssistantMessageID={lastAssistantMessageID}
        directory={directory}
        loopState={loop.state}
        iteration={loop.iteration}
        sseStatus={sseStatus}
        isRunning={loopIsBusy(loop.state) || isGenerating || isRunStarting}
        onRunLoop={handleRunLoop}
        onRunHeadless={() => runHeadlessLoop("exploration")}
        onStop={stop}
        onApplyNextPatch={handleApplyNextPatch}
        onResetSession={handleResetSession}
        onChangeDirectory={handleChangeDirectory}
      />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* File Tree */}
        <ResizablePanel defaultSize={15} minSize={10} maxSize={25}>
          <FileTree
            files={rootFiles}
            selectedFile={selectedFile?.path || null}
            onSelectFile={handleFileSelect}
            onExpandDir={expandDir}
            getChildren={getChildren}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        
        {/* Chat Panel */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
        <ChatPanel 
          messages={messages} 
          onSendMessage={handleUserGoal}
          isGenerating={loopIsBusy(loop.state) || isGenerating || isRunStarting}
          streamingContent={streamingContent}
          activity={{
            loopState: loop.state,
            iteration: loop.iteration,
            lastError: loop.lastError,
            pageSpec: pageSpecRaw,
            logs: consoleLogItems,
            server: {
              status: serverStatus,
              feed: serverFeed,
            },
          }}
          questions={pendingQuestions ? { items: pendingQuestions } : null}
          onAnswerQuestions={handleAnswerQuestions}
        />
        </ResizablePanel>
        <ResizableHandle withHandle />
        
        {/* Main Content Area */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <ResizablePanelGroup direction="vertical">
            {/* Preview/Code Editor */}
            <ResizablePanel defaultSize={70} minSize={30}>
              {selectedFile ? (
                <CodeEditor
                  filePath={selectedFile.path}
                  content={selectedFile.content}
                  language={selectedFile.language}
                  onClose={handleCloseEditor}
                />
              ) : (
                <PreviewPanel
                  code={{ html: preview?.html ?? "", css: "", js: "" }}
                  isGenerating={isGenerating}
                  url={previewUrl}
                  canRun={canRunPreview}
                  isRunning={isRunStarting}
                  onRun={canRunPreview ? runPreview : undefined}
                  lastScreenshot={lastScreenshot?.dataUrl ?? null}
                  nonce={previewNonce}
                  onRefresh={handlePreviewRefresh}
                  onNavigate={handlePreviewNavigate}
                />
              )}
            </ResizablePanel>
            <ResizableHandle withHandle />
            
            {/* Console */}
            <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
              <ConsolePanel logs={consoleLogItems} onClear={clearLogs} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Builder;
