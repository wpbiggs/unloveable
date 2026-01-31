import { useMemo, useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, Activity, Paperclip, ImagePlus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Message } from "@/lib/ai-config";
import { cn } from "@/lib/utils";
import type { ConsoleLog } from "@/hooks/use-console-logs";
import type { QuestionSpec } from "@/lib/question-extract";

import { Progress } from "@/components/ui/progress";

function sanitizeAssistantText(text: string) {
  const src = (text || "").trim();
  if (!src) return "";

  // Keep chat focused; route noisy tool diagnostics to Activity.
  const lines = src.split("\n");
  const filtered = lines.filter((l) => {
    const t = l.trim();
    if (!t) return true;
    if (/^LSP errors detected/i.test(t)) return false;
    if (/^<diagnostics\b/i.test(t)) return false;
    if (/^ERROR \[\d+:\d+\]/.test(t)) return false;
    if (/Tool execution aborted/i.test(t)) return false;
    return true;
  });

  const out = filtered.join("\n").trim();
  if (!out) return "Agent hit workspace errors. Open Activity for details.";
  if (out !== src) return out;
  return src;
}

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (payload: { content: string; files?: File[] }) => void;
  isGenerating: boolean;
  streamingContent?: string;
  activity?: {
    loopState: string;
    iteration: number;
    lastError: string | null;
    pageSpec?: string | null;
    logs: ConsoleLog[];
    server?: {
      status: string | null;
      feed: Array<{ id: string; ts: number; text: string }>;
    };
  };

  questions?: {
    items: QuestionSpec[];
  } | null;

  onAnswerQuestions?: (answers: Array<{ id: string; answer: string }>) => void;
}

const ChatPanel = ({ messages, onSendMessage, isGenerating, streamingContent, activity, questions, onAnswerQuestions }: ChatPanelProps) => {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [answers, setAnswers] = useState<Array<{ id: string; answer: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const recent = useMemo(() => {
    const logs = activity?.logs ?? [];
    return logs.slice(-80);
  }, [activity?.logs]);

  const server = useMemo(() => {
    return activity?.server?.feed ?? [];
  }, [activity?.server?.feed]);

  const recentActivityInline = useMemo(() => {
    const logItems = recent.map((l) => ({
      id: l.id,
      ts: l.timestamp?.getTime ? l.timestamp.getTime() : 0,
      label: l.type,
      text: l.message,
    }));
    const serverItems = server.map((e) => ({ id: e.id, ts: e.ts, label: "server", text: e.text }));
    const merged = [...logItems, ...serverItems].sort((a, b) => a.ts - b.ts);
    const lastBeat = [...serverItems].reverse().find((e) => e.text.includes("[server] heartbeat") || e.text.includes("[sse]"));
    const tail = merged.slice(-6);
    if (!lastBeat) return tail;
    if (tail.some((x) => x.id === lastBeat.id)) return tail;
    return [...tail.slice(0, 5), lastBeat];
  }, [recent, server]);

  const recentInline = recentActivityInline;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  useEffect(() => {
    if (!questions?.items?.length) return;
    setAnswers(questions.items.map((q) => ({ id: q.id, answer: "" })));
    setQuestionsOpen(true);
  }, [questions?.items]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if ((text || files.length) && !isGenerating) {
      onSendMessage({ content: text, files });
      setInput("");
      setFiles([]);
    }
  };

  const addFiles = (incoming: File[] | FileList | null) => {
    if (!incoming) return;
    const list = Array.isArray(incoming) ? incoming : Array.from(incoming);
    if (!list.length) return;
    const next = [...files];
    for (const f of list) {
      // Prevent duplicates by name+size (good enough for UI).
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
    }
    setFiles(next);
  };

  const submitAnswers = () => {
    if (!questions?.items?.length || !onAnswerQuestions) return;
    onAnswerQuestions(answers.map((a) => ({ id: a.id, answer: a.answer.trim() })));
    setQuestionsOpen(false);
  };

  const canContinue = useMemo(() => {
    const items = questions?.items ?? [];
    if (!items.length) return true;
    for (let i = 0; i < items.length; i++) {
      const q = items[i];
      const required = q.required !== false;
      if (!required) continue;
      const a = answers[i]?.answer ?? "";
      if (!a.trim()) return false;
    }
    return true;
  }, [answers, questions?.items]);

  const missing = useMemo(() => {
    const items = questions?.items ?? [];
    const out: boolean[] = [];
    for (let i = 0; i < items.length; i++) {
      const q = items[i];
      const required = q.required !== false;
      const a = answers[i]?.answer ?? "";
      out.push(required && !a.trim());
    }
    return out;
  }, [answers, questions?.items]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const suggestions = [
    "Create a modern SaaS landing page",
    "Build an e-commerce product page",
    "Design a portfolio website",
    "Make a blog layout",
  ];

  return (
    <div className="h-full flex flex-col bg-card/30">
      {/* Chat header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Chat
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={() => setActivityOpen(true)}
            disabled={!activity}
          >
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Activity</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Describe what you want to build
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-foreground mb-2">
              Start building
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Describe your dream website and I'll bring it to life
            </p>
            <div className="space-y-2 w-full">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (isGenerating) return;
                    onSendMessage({ content: suggestion });
                  }}
                  disabled={isGenerating}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {message.role === "assistant" && message.content ? (
                    <div className="whitespace-pre-wrap">
                      {sanitizeAssistantText(message.content)}
                      {message.attachments?.length ? (
                        <div className="mt-3 space-y-2">
                          {message.attachments.map((a, idx) => {
                            const label = a.filename || a.mime;
                            const isImg = typeof a.mime === "string" && a.mime.startsWith("image/");
                            return isImg ? (
                              <a
                                key={idx}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg border border-border bg-background/40 overflow-hidden"
                              >
                                <img src={a.url} alt={label} className="w-full max-h-[260px] object-contain bg-black/5" />
                              </a>
                            ) : (
                              <a
                                key={idx}
                                href={a.url}
                                download={a.filename}
                                className="block text-xs font-mono rounded-lg border border-border bg-background/40 px-3 py-2 hover:bg-background/60"
                              >
                                {label}
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : message.role === "assistant" && isGenerating ? (
                    <div className="space-y-3 min-w-[200px]" data-testid="ai-loading-indicator">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="font-medium text-foreground">Thinking...</span>
                      </div>
                      
                      {activity ? (
                        <div className="space-y-1.5 pl-6">
                           <div className="flex justify-between text-xs text-muted-foreground">
                             <span>{activity.loopState}</span>
                             <span>Iter {activity.iteration}</span>
                           </div>
                           <Progress 
                             value={
                               activity.loopState === "PLANNING" ? 10 :
                               activity.loopState === "RUNNING" ? 50 : 
                               activity.loopState === "OBSERVING" ? 90 : 
                               activity.loopState === "PATCHING" ? 70 : 
                               activity.loopState === "COMPLETED" ? 100 : 0
                             } 
                             className="h-1.5 bg-muted-foreground/20"
                             data-testid="ai-progress-bar"
                           />
                        </div>
                      ) : null}

                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">
                      {message.content}
                      {message.attachments?.length ? (
                        <div className="mt-3 space-y-2">
                          {message.attachments.map((a, idx) => {
                            const label = a.filename || a.mime;
                            const isImg = typeof a.mime === "string" && a.mime.startsWith("image/");
                            return isImg ? (
                              <a
                                key={idx}
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-lg border border-border bg-background/40 overflow-hidden"
                              >
                                <img src={a.url} alt={label} className="w-full max-h-[260px] object-contain bg-black/5" />
                              </a>
                            ) : (
                              <a
                                key={idx}
                                href={a.url}
                                download={a.filename}
                                className="block text-xs font-mono rounded-lg border border-border bg-background/40 px-3 py-2 hover:bg-background/60"
                              >
                                {label}
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        {!questionsOpen && questions?.items?.length ? (
          <button
            type="button"
            onClick={() => setQuestionsOpen(true)}
            className="mb-3 w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Questions pending</div>
              <div className="text-xs text-muted-foreground">{questions.items.length}</div>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Answer to continue the loop</div>
          </button>
        ) : null}
        {isGenerating && activity ? (
          <button
            type="button"
            onClick={() => setActivityOpen(true)}
            className="mb-3 w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Live activity</div>
              <div className="text-xs text-muted-foreground">{activity.loopState} • iter {activity.iteration}</div>
            </div>
            <div className="mt-2 space-y-1">
              {recentInline.length ? (
                recentInline.map((l) => (
                  <div key={l.id} className="text-[11px] font-mono text-foreground/90 truncate">
                    <span className="text-muted-foreground">[{l.label}]</span> {l.text}
                  </div>
                ))
              ) : (
                <div className="text-[11px] text-muted-foreground">No logs yet</div>
              )}
            </div>
          </button>
        ) : null}
        {files.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {files.map((f, idx) => (
              <div
                key={`${f.name}:${f.size}:${idx}`}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5"
              >
                <div className="text-[11px] font-mono text-foreground/90 max-w-[240px] truncate">
                  {f.name}
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="relative">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
          <input
            ref={imageRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*"
            onChange={(e) => {
              addFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items || !items.length) return;

              const pasted: File[] = [];
              for (const it of Array.from(items)) {
                if (!it.type || !it.type.startsWith("image/")) continue;
                const f = it.getAsFile();
                if (!f) continue;
                const ext = f.type.split("/")[1] || "png";
                const name = f.name && f.name !== "blob" ? f.name : `pasted-${Date.now()}.${ext}`;
                pasted.push(new File([f], name, { type: f.type }));
              }

              if (pasted.length) {
                e.preventDefault();
                addFiles(pasted);
              }
            }}
            placeholder="Describe what you want to build..."
            rows={2}
            className="w-full resize-none rounded-xl bg-input border border-border px-4 py-3 pr-[84px] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isGenerating}
          />

          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => imageRef.current?.click()}
              disabled={isGenerating}
              title="Attach screenshot/image"
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => fileRef.current?.click()}
              disabled={isGenerating}
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              type="submit"
              variant="glow"
              size="icon"
              className="h-8 w-8 rounded-lg"
              disabled={(!input.trim() && files.length === 0) || isGenerating}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </form>

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agent Activity</DialogTitle>
            <DialogDescription>
              {activity ? `State: ${activity.loopState} • Iteration: ${activity.iteration}` : "No activity"}
            </DialogDescription>
          </DialogHeader>

          {activity?.lastError ? (
            <pre className="text-xs rounded-md border border-border bg-red-500/10 text-red-500 p-3 whitespace-pre-wrap font-mono">{activity.lastError}</pre>
          ) : null}

          {activity?.pageSpec ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">PageSpec</div>
              <pre className="text-xs rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap">{activity.pageSpec}</pre>
            </div>
          ) : null}

          {activity?.server?.status ? (
            <div className="text-xs text-muted-foreground">Server session: {activity.server.status}</div>
          ) : null}

            {server.length ? (
              <div className="rounded-md border border-border bg-background max-h-[20vh] overflow-auto">
                <div className="p-3 space-y-1">
                  {server.slice(-40).map((e) => (
                    <div key={e.id} className="text-[11px] font-mono text-foreground/90">
                      {e.text}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No server events yet</div>
            )}

          <div className="rounded-md border border-border bg-background max-h-[50vh] overflow-auto">
            {recent.length ? (
              <div className="p-3 space-y-2">
                {recent.map((l) => (
                  <div key={l.id} className="text-xs font-mono">
                    <span className="text-muted-foreground">[{l.type}]</span> {l.message}
                    {l.details ? (
                      <pre className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap">{l.details}</pre>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-xs text-muted-foreground">No logs yet</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={questionsOpen} onOpenChange={setQuestionsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quick Questions</DialogTitle>
            <DialogDescription>Answer these so the agent can continue.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[55vh] overflow-auto">
            {!canContinue ? (
              <div className="text-xs text-muted-foreground">Answer all required questions to continue.</div>
            ) : null}
            {(questions?.items ?? []).map((q, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{idx + 1}. {q.question}</div>
                  {q.required !== false ? (
                    <span className="text-[11px] text-muted-foreground">Required</span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Optional</span>
                  )}
                </div>
                {q.type === "select" ? (
                  <select
                    value={answers[idx]?.answer ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[idx] = { id: q.id, answer: e.target.value };
                        return next;
                      })
                    }
                    className={cn(
                      "h-10 w-full rounded-md border bg-input px-3 text-sm",
                      missing[idx] ? "border-red-500/60" : "border-border",
                    )}
                  >
                    <option value="">Select…</option>
                    {(q.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : q.type === "boolean" ? (
                  <select
                    value={answers[idx]?.answer ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[idx] = { id: q.id, answer: e.target.value };
                        return next;
                      })
                    }
                    className={cn(
                      "h-10 w-full rounded-md border bg-input px-3 text-sm",
                      missing[idx] ? "border-red-500/60" : "border-border",
                    )}
                  >
                    <option value="">Select…</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                ) : (
                  <textarea
                    value={answers[idx]?.answer ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => {
                        const next = [...prev];
                        next[idx] = { id: q.id, answer: e.target.value };
                        return next;
                      })
                    }
                    rows={2}
                    className={cn(
                      "w-full resize-none rounded-md bg-input border px-3 py-2 text-sm",
                      missing[idx] ? "border-red-500/60" : "border-border",
                    )}
                    placeholder="Your answer"
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => setQuestionsOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="glow"
              onClick={submitAnswers}
              disabled={!questions?.items?.length || !canContinue}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPanel;
