import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import ChatPanel from "@/components/builder/ChatPanel";
import PreviewPanel from "@/components/builder/PreviewPanel";
import BuilderHeader from "@/components/builder/BuilderHeader";
import ConsolePanel from "@/components/builder/ConsolePanel";
import FileTree from "@/components/builder/FileTree";
import CodeEditor from "@/components/builder/CodeEditor";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { Message } from "@/lib/ai-config";
import { useConsoleLogs } from "@/hooks/use-console-logs";
import { OpenCode, OpenCodeDirectory, type OpenCodeFileNode } from "@/lib/opencode-client";
import { extractDisplayText, streamOpenCodeMessage } from "@/lib/opencode-stream";
import { OpenCodePreferences } from "@/lib/opencode-preferences";
import { OpenCodeSessionStore } from "@/lib/opencode-session-store";
import { OpenCodeWorkspace } from "@/lib/opencode-workspace";
import { OpenCodePreviewStore } from "@/lib/opencode-preview-store";
import { loopIsBusy, loopReducer, type LoopContext, type LoopState } from "@/lib/builder-loop";
import { extractClarificationSpec, type QuestionSpec } from "@/lib/question-extract";
import { openOpenCodeEvents } from "@/lib/opencode-events";
import { extractPageSpec, stringifyPageSpec, type PageSpec } from "@/lib/page-spec";

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

  const [loop, dispatchLoop] = useReducer(loopReducer, { state: "IDLE", iteration: 0, lastError: null, lastRunLog: null } satisfies LoopContext);
  const loopStopRef = useRef(false);
  const [goal, setGoal] = useState<string | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<QuestionSpec[] | null>(null);
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

  const RECOMMENDED_DIRECTORY = "/home/will/opencode-test/warp-site-canvas-main";

  const stablePort = useMemo(() => {
    const dir = OpenCodeDirectory.get() ?? "";
    let hash = 0;
    for (let i = 0; i < dir.length; i++) hash = (hash * 31 + dir.charCodeAt(i)) >>> 0;
    return 3000 + (hash % 500);
  }, [directory]);

  const detectProjectRoot = useCallback(async () => {
    const rootPkg = await OpenCode.readFile("package.json").catch(() => null);
    if (rootPkg?.content) {
      try {
        return { path: ".", pkg: JSON.parse(rootPkg.content) as any };
      } catch {
        return { path: ".", pkg: null };
      }
    }

    // Common failure mode: the agent scaffolds a project in a subdirectory (e.g. ./app).
    // Try to detect a single obvious project root one level down.
    const nodes = await OpenCode.listFiles(".").catch(() => [] as any[]);
    const dirs = (Array.isArray(nodes) ? nodes : [])
      .filter((n: any) => n && n.type === "directory" && !n.ignored)
      .slice(0, 12);

    const hits: Array<{ path: string; pkg: any }> = [];
    for (const d of dirs) {
      const p = typeof d.path === "string" ? d.path : "";
      if (!p || p === "." || p === "..") continue;
      const subPkg = await OpenCode.readFile(`${p}/package.json`).catch(() => null);
      if (!subPkg?.content) continue;
      try {
        const json = JSON.parse(subPkg.content) as any;
        const scripts = json?.scripts;
        const looksRunnable = !!(scripts && typeof scripts === "object" && (scripts.dev || scripts.start || scripts.build || scripts.test));
        if (!looksRunnable) continue;
        hits.push({ path: p, pkg: json });
        if (hits.length > 1) break;
      } catch {
        // ignore
      }
    }

    if (hits.length === 1) return hits[0];
    return null;
  }, []);

  const refreshRootFiles = useCallback(async () => {
    const nodes = await OpenCode.listFiles(".");
    setRootFiles(nodes);
  }, []);

  const refreshPreview = useCallback(async () => {
    const saved = OpenCodePreviewStore.get(OpenCodeDirectory.get());
    setPreviewUrl(saved?.url ?? null);

    // Detect whether this workspace has a runnable dev server.
    // (Used to show/hide the "Run" preview affordance.)
    const probeAt = ((): { at: number; cached: boolean } => {
      const ref = (refreshPreview as any).__projectProbe as { at: number; cached: boolean } | undefined;
      const next = ref ?? { at: 0, cached: false };
      (refreshPreview as any).__projectProbe = next;
      return next;
    })();

    const pkg = await OpenCode.readFile("package.json").catch(() => null);
    const rootJson = (() => {
      if (!pkg?.content) return null;
      try {
        return JSON.parse(pkg.content) as any;
      } catch {
        return null;
      }
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
    const attemptAt = ((): Record<string, number> => {
      const ref = (refreshPreview as any).__attemptAt as Record<string, number> | undefined;
      const next = ref ?? {};
      (refreshPreview as any).__attemptAt = next;
      return next;
    })();

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
  }, [selectedFile]);

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
      const p = evt.properties;

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
        if (evt.type === "message.updated") return p?.info?.sessionID && matchIDs.includes(p.info.sessionID);
        if (evt.type === "message.part.updated") return p?.part?.sessionID && matchIDs.includes(p.part.sessionID);
        if (evt.type === "session.status") return p?.sessionID && matchIDs.includes(p.sessionID);
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
          const info = p?.info;
          const role = info?.role;
          const mid = info?.id;
          if (!live.messageID && role === "assistant" && typeof mid === "string") {
            liveRef.current = { ...live, messageID: mid, lastEventAt: Date.now() };
          }
        }
        if (evt.type === "message.part.updated") {
          const part = p?.part;
          const delta = typeof p?.delta === "string" ? p.delta : "";
          const type = part?.type;
          const mid = part?.messageID;
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
        const t = p?.status?.type;
        if (typeof t === "string") setServerStatus(t);
      }

      const text = (() => {
        if (evt.type === "message.part.updated") {
          const part = p?.part;
          const type = part?.type;
          const delta = typeof p?.delta === "string" ? p.delta : "";
          if (type === "tool") {
            const tool = part?.tool;
            const status = part?.state?.status;
            if (tool && status) return `[tool] ${tool} ${status}`;
            if (tool) return `[tool] ${tool}`;
          }
          if (type === "reasoning") {
            if (delta) return `[reasoning] +${delta.length} chars`;
            return `[reasoning] updated`;
          }
          if (type === "text") {
            if (delta) return `[text] ${delta.replace(/\n/g, " ").slice(0, 120)}`;
            return `[text] updated`;
          }
          if (typeof type === "string") return `[part] ${type}`;
          return "[part]";
        }

        if (evt.type === "message.updated") {
          const info = p?.info;
          const role = info?.role;
          const agent = info?.agent;
          if (role && agent) return `[message] ${role} (${agent})`;
          if (role) return `[message] ${role}`;
          return "[message] updated";
        }

        if (evt.type === "session.status") {
          const t = p?.status?.type;
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
    abortRef.current?.abort();
    abortRef.current = null;
    liveRef.current = null;

    if (sessionID) {
      await OpenCode.abortSession(sessionID).catch(() => undefined);
    }
    setIsGenerating(false);
    setStreamingContent("");
    dispatchLoop({ type: "SET_STATE", state: "STOPPED" });
  }, [sessionID]);

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
            const t = (p as any).type;
            if (t === "text") {
              const v = (p as any).text;
              if (typeof v === "string" && v) lines.push(v);
            }
            if (t === "file") {
              const url = typeof (p as any).url === "string" ? (p as any).url : "";
              const mime = typeof (p as any).mime === "string" ? (p as any).mime : "application/octet-stream";
              const filename = typeof (p as any).filename === "string" ? (p as any).filename : undefined;
              if (url) attachments.push({ url, mime, filename });
              lines.push(filename ? `[file] ${filename}` : "[file]");
            }
            if (t === "patch") {
              const files = Array.isArray((p as any).files) ? (p as any).files.join(", ") : "";
              lines.push(files ? `[patch] ${files}` : "[patch]");
            }
            if (t === "tool") {
              const tool = typeof (p as any).tool === "string" ? (p as any).tool : "tool";
              const status = (p as any).state?.status;
              if (status === "completed") lines.push(`[${tool}] completed`);
              if (status === "error") lines.push(`[${tool}] error`);

              const att = (p as any)?.state?.attachments;
              if (Array.isArray(att)) {
                for (const a of att) {
                  const url = typeof (a as any)?.url === "string" ? (a as any).url : "";
                  const mime = typeof (a as any)?.mime === "string" ? (a as any).mime : "application/octet-stream";
                  const filename = typeof (a as any)?.filename === "string" ? (a as any).filename : undefined;
                  if (url) attachments.push({ url, mime, filename });
                }
              }
            }
          }
          return { text: lines.join("\n").trim(), attachments };
        })();

        const err = (m.info as any).error;
        const errMsg = typeof err?.message === "string" ? err.message : "";
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
      (preferred && list.find((s: any) => s.id === preferred)) ||
      (list.length ? (list as any)[0] : null);
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

  const runShell = useCallback(
    async (command: string) => {
      // Use a dedicated shell session so checks/preview don't collide with the chat session.
      const sid = await ensureShellSession();
      const agent = OpenCodePreferences.agent.get() ?? "task";
      const msg = await OpenCode.runShell(sid, command, { agent, model: getModelOverride() });
      const messageID =
        typeof (msg as any)?.info?.id === "string"
          ? ((msg as any).info.id as string)
          : typeof (msg as any)?.id === "string"
            ? ((msg as any).id as string)
            : "";
      if (!messageID) {
        return { ok: false, output: "No message id returned from shell" };
      }
      const full = await OpenCode.getMessage(sid, messageID).catch(() => null);
      const parts = full && Array.isArray((full as any).parts) ? ((full as any).parts as any[]) : [];

      let ok = true;
      const out: string[] = [];
      for (const p of parts) {
        if (!p || p.type !== "tool") continue;
        const s = p.state;
        if (s?.status === "completed" && typeof s.output === "string" && s.output) out.push(s.output);
        if (s?.status === "error") {
          ok = false;
          if (typeof s.error === "string" && s.error) out.push(s.error);
        }
      }
      return { ok, output: out.join("\n").trim() };
    },
    [ensureShellSession, getModelOverride],
  );

  const runChecks = useCallback(async () => {
    const rootPkg = await OpenCode.readFile("package.json").catch(() => null);
    const rootJson = (() => {
      if (!rootPkg?.content) return null;
      try {
        return JSON.parse(rootPkg.content) as any;
      } catch {
        return null;
      }
    })();

    if (rootPkg?.content && !rootJson) {
      return { ok: false, log: "Invalid package.json in workspace root (JSON parse failed)" };
    }

    const detected = !rootJson ? await detectProjectRoot().catch(() => null) : null;
    const project = rootJson ? { path: ".", pkg: rootJson } : detected;
    if (!project) return { ok: true, log: "No package.json found (root or immediate subdir); skipping checks" };
    if (!project.pkg) return { ok: false, log: `Invalid package.json at ${project.path} (JSON parse failed)` };

    const prefix = project.path && project.path !== "." ? `cd "${project.path}" && ` : "";

    const scripts = project.pkg?.scripts && typeof project.pkg.scripts === "object" ? project.pkg.scripts : {};
    if (typeof scripts.test === "string") {
      const res = await runShell(`${prefix}npm test`);
      return { ok: res.ok, log: res.output || "(no output)" };
    }
    if (typeof scripts.build === "string") {
      const res = await runShell(`${prefix}npm run build`);
      return { ok: res.ok, log: res.output || "(no output)" };
    }

    const serverIndex = await OpenCode.readFile(project.path && project.path !== "." ? `${project.path}/server/index.js` : "server/index.js").catch(() => null);
    if (serverIndex?.content) {
      const res = await runShell(`${prefix}node -c server/index.js`);
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
      try {
        return JSON.parse(rootPkg.content) as any;
      } catch {
        return null;
      }
    })();
    if (rootPkg?.content && !rootJson) throw new Error("Invalid package.json in workspace root (JSON parse failed)");

    const detected = !rootJson ? await detectProjectRoot().catch(() => null) : null;
    const project = rootJson ? { path: ".", pkg: rootJson } : detected;
    if (!project) throw new Error("No package.json found (root or immediate subdir)");
    if (!project.pkg) throw new Error(`Invalid package.json at ${project.path} (JSON parse failed)`);

    const scripts = project.pkg?.scripts ?? {};
    const prefix = project.path && project.path !== "." ? `cd "${project.path}" && ` : "";
    const port = stablePort;

    const agent = OpenCodePreferences.agent.get() ?? "task";
    const session = await ensureShellSession();

    await OpenCode.runShell(session, `${prefix}test -d node_modules || npm install`, { agent });

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
        ? `${prefix}nohup npm run dev -- -p ${port} -H 127.0.0.1 > .opencode-preview.log 2>&1 & echo $!`
        : (hasDev && isVite)
          ? `${prefix}nohup npm run dev -- --port ${port} --host 127.0.0.1 > .opencode-preview.log 2>&1 & echo $!`
          : hasDev
            ? `${prefix}nohup npm run dev > .opencode-preview.log 2>&1 & echo $!`
            : hasStart
              ? `${prefix}nohup env PORT=${port} npm start > .opencode-preview.log 2>&1 & echo $!`
              : `${prefix}nohup npm run dev > .opencode-preview.log 2>&1 & echo $!`;

    const msg = await OpenCode.runShell(session, cmd, { agent });
    const messageID =
      typeof (msg as any)?.info?.id === "string"
        ? ((msg as any).info.id as string)
        : typeof (msg as any)?.id === "string"
          ? ((msg as any).id as string)
          : "";
    const full = messageID ? await OpenCode.getMessage(session, messageID).catch(() => null) : null;
    const parts = full && Array.isArray((full as any).parts) ? ((full as any).parts as any[]) : [];
    const out = parts
      .filter((p) => p?.type === "tool" && p.state?.status === "completed" && typeof p.state?.output === "string")
      .map((p) => p.state.output as string)
      .join("\n")
      .trim();
    const pid = Number.parseInt(out, 10);
    const url = `http://localhost:${port}`;

    OpenCodePreviewStore.set(dir, { url, pid: Number.isFinite(pid) ? pid : undefined, startedAt: Date.now() });
    setPreviewUrl(url);
    setCanRunPreview(false);
    return { url, pid: Number.isFinite(pid) ? pid : undefined };
  }, [detectProjectRoot, ensureShellSession, stablePort]);

  const observe = useCallback(async () => {
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
      await OpenCode.runShell(
        sid,
        [
          `URL="${url}"`,
          `OUT="${outPng}"`,
          `DOM="${outDom}"`,
          `LOG="${outLog}"`,
          "BROWSER=",
          "for c in google-chrome chromium chromium-browser; do",
          "  p=$(command -v $c 2>/dev/null || true)",
          "  if [ -n \"$p\" ] && \"$p\" --version >/dev/null 2>&1; then BROWSER=\"$p\"; break; fi",
          "done",
          "mkdir -p \"$(dirname \"$OUT\")\"",
          "for i in 1 2 3 4 5; do",
          "  curl -sSf --max-time 2 \"$URL\" > \"$DOM\" 2>/dev/null || { sleep 1; continue; }",
          "  if [ -z \"$BROWSER\" ]; then echo NO_HEADLESS_BROWSER > \"$LOG\"; echo SCREENSHOT:SKIP:$OUT; exit 0; fi",
          "  \"$BROWSER\" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1366,768 --dump-dom \"$URL\" > \"$DOM\" 2>\"$LOG\" || true",
          "  \"$BROWSER\" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --window-size=1366,768 --screenshot=\"$OUT\" \"$URL\" >/dev/null 2>&1 || \\",
          "  \"$BROWSER\" --headless --disable-gpu --no-sandbox --hide-scrollbars --window-size=1366,768 --screenshot=\"$OUT\" \"$URL\" >/dev/null 2>&1 || true",
          "  [ -s \"$OUT\" ] && { echo SCREENSHOT:OK:$OUT; exit 0; }",
          "  sleep 1",
          "done",
          "echo CONNECTION_FAILED > \"$LOG\"",
          "echo '<!-- CONNECTION_FAILED -->' > \"$DOM\"",
          "echo SCREENSHOT:FAIL:$OUT",
          "exit 0",
        ].join("; "),
        { agent },
      ).catch(() => undefined);

      const img = await OpenCode.readFile(outPng).catch(() => null);
      const dom = await OpenCode.readFile(outDom).catch(() => null);
      const log = await OpenCode.readFile(outLog).catch(() => null);

      const domText = dom?.content && typeof dom.content === "string" ? dom.content : "";
      const logText = log?.content && typeof log.content === "string" ? log.content : "";
      const hasOutput = !!(domText.trim() || logText.trim());
      const screenshot =
        img?.encoding === "base64" && img.mimeType?.startsWith("image/") && img.content
          ? `data:${img.mimeType};base64,${img.content}`
          : null;

      const hit = (() => {
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
    const selfUrl = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? `${window.location.origin}/builder`
      : `${window.location.protocol}//localhost:${port}/builder`;

    const selfBase = `.opencode/observe/builder-${iter}`;
    const self = await chromeProbe(selfUrl, selfBase);
    if (!self.ok) {
      const msg = `Builder render check failed for ${selfUrl}\n${self.hit}\nArtifacts:\n- ${self.outPng}\n- ${self.outDom}\n- ${self.outLog}`;
      logs.push(msg);
      info("UI render check: failed", msg);
      return { ok: false, log: msg };
    }

    const url = previewUrl;
    if (url) {
      const base = `.opencode/observe/preview-${iter}`;
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

      try {
        if (input.mode === "full") {
          setLoopState("PLANNING");
          info("Loop", `Iter ${loop.iteration + 1}: planning`);

          // Step 1: PageSpec (single source of truth for UI generation).
          const psRes = await handleSendMessage(
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
            { agent: "task", files: input.files },
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
          await handleSendMessage(
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
            { agent: "task", files: input.files },
          );
          if (questionRef.current) return;
          if (stopIfRequested()) return;
        }

        setLoopState("PATCHING");
        info("Loop", `Iter ${loop.iteration + 1}: patching`);
        const ctx = input.extraContext ? `\n\nContext:\n${input.extraContext}` : "";

        // Ensure we have a PageSpec even for "apply-next" runs.
        if (!pageSpecRaw) {
          const psRes = await handleSendMessage(
            [
              `User Goal:\n${input.goal}${ctx}`,
              "",
              "We are missing a PageSpec. Produce it now.",
              "Return ONLY one JSON code block (no other text).",
            ].join("\n"),
            { agent: "task" },
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

          await handleSendMessage(
            [
              `User Goal:\n${input.goal}${ctx}`,
              pageSpecRaw ? `\n\nPageSpec:\n\n\`\`\`json\n${pageSpecRaw}\n\`\`\`` : "",
              "",
              "Guardrails:",
              "- Work in the CURRENT directory only (treat it as the project root).",
              "- Do NOT create nested project folders. Apply changes in-place.",
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
            { agent: "task", files: input.files },
          );
        if (questionRef.current) return;
        if (stopIfRequested()) return;

        setLoopState("RUNNING");
        info("Loop", `Iter ${loop.iteration + 1}: running checks`);
        const res = await runChecks();
        dispatchLoop({ type: "SET_RUN_LOG", log: res.log });
        info(`Checks: ${res.ok ? "ok" : "failed"}`, res.log);
        if (stopIfRequested()) return;

        setLoopState("OBSERVING");
        info("Loop", `Iter ${loop.iteration + 1}: observing`);
        const obs = await observe();
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
          await handleSendMessage(
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
            { agent: "task" },
          );
          if (questionRef.current) return;
          if (stopIfRequested()) return;

          setLoopState("OBSERVING");
          const obs2 = await observe();
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
        await handleSendMessage(
          [
            STRICT_QUESTIONS,
            "",
            "We have a failing check. Fix it with a minimal patch.",
            "",
            `Error output:\n${res.log}`,
          ].join("\n"),
          { agent: "task" },
        );
        if (questionRef.current) return;
        if (stopIfRequested()) return;

        setLoopState("RUNNING");
        const res2 = await runChecks();
        dispatchLoop({ type: "SET_RUN_LOG", log: res2.log });
        info(`Checks: ${res2.ok ? "ok" : "failed"}`, res2.log);

        setLoopState("OBSERVING");
        await observe();

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
    [error, handleSendMessage, info, observe, pendingQuestions, runChecks, setLoopState, success, warn, loop.state, loop.iteration],
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
          `mkdir -p "$(dirname \"${dir}/${file}\")" && cat > "${dir}/${file}" <<'EOF'\n${safe}\nEOF`,
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
        await OpenCode.pathInfo()
          .then((p) => info("OpenCode directory", p.directory))
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

  const handleChangeDirectory = useCallback(async () => {
    const current = OpenCodeDirectory.get() ?? RECOMMENDED_DIRECTORY;
    const next = window.prompt(
      "OpenCode directory (absolute path). This controls which git repo/files OpenCode operates on.",
      current,
    );
    if (next === null) return;

    OpenCodeDirectory.set(next);
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
  }, [refreshRootFiles, refreshPreview, stop, info, ensureSession]);

  async function handleSendMessage(
    content: string,
    opts?: { agent?: string; files?: File[] },
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
            const msg = { info: { id: match.info.id, role: match.info.role, error: match.info.error }, parts: match.parts };
            const text = extractDisplayText(msg as any);

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
              const t = (p as any)?.type;
              if (t === "file") {
                const url = typeof (p as any).url === "string" ? (p as any).url : "";
                const mime = typeof (p as any).mime === "string" ? (p as any).mime : "application/octet-stream";
                const filename = typeof (p as any).filename === "string" ? (p as any).filename : undefined;
                if (url) out.push({ url, mime, filename });
              }
              if (t === "tool") {
                const att = (p as any)?.state?.attachments;
                if (Array.isArray(att)) {
                  for (const a of att) {
                    const url = typeof (a as any)?.url === "string" ? (a as any).url : "";
                    const mime = typeof (a as any)?.mime === "string" ? (a as any).mime : "application/octet-stream";
                    const filename = typeof (a as any)?.filename === "string" ? (a as any).filename : undefined;
                    if (url) out.push({ url, mime, filename });
                  }
                }
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
              const err = msg.info?.error as any;
              const url = typeof err?.data?.metadata?.url === "string" ? (err.data.metadata.url as string) : "";
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
              .filter((p) => p && (p as any).type && (((p as any).type === "text") || ((p as any).type === "reasoning")))
              .map((p) => (typeof (p as any).text === "string" ? (p as any).text : ""))
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

      const lines: string[] = ["Clarifications"]; 
      for (const q of pendingQuestions) {
        const a = answers.find((x) => x.id === q.id)?.answer || "(no answer)";
        lines.push(`- ${q.question}`);
        lines.push(`  Answer: ${a}`);
      }

      setPendingQuestions(null);
      await handleSendMessage(lines.join("\n"), { agent: "task" });
      if (goal) {
        await runLoopOnce({ goal, mode: "apply-next", extraContext: lines.join("\n") });
      }
    },
    [goal, pendingQuestions, runLoopOnce],
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
      await runLoopOnce({ goal: payload.content, mode: "full", files: payload.files });
    },
    [runLoopOnce],
  );

  return (
    <div className="h-screen flex flex-col bg-background">
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
