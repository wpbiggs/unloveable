import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, ChevronDown, RefreshCw, RotateCcw, Play, Square, Wand2, FolderCog, Settings, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import { WORKSPACE_TEMPLATES } from "@/lib/workspace-templates";
import type { LoopState } from "@/lib/builder-loop";
import { OpenCode } from "@/lib/opencode-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BuilderHeaderProps {
  sessions: Array<{ id: string; title: string; updated: number }>;
  isSessionsLoading: boolean;
  onRefreshSessions: () => void;
  onSelectSession: (sessionID: string) => void;
  sessionID: string | null;
  lastAssistantMessageID?: string | null;
  directory: string | null;
  loopState: LoopState;
  iteration: number;
  isRunning: boolean;
  onRunLoop: () => void;
  onStop: () => void;
  onApplyNextPatch: () => void;
  onResetSession: () => void;
  onNewWorkspaceSession: (template?: string) => void;
  onChangeDirectory: () => void;
  sseStatus?: { state: "connecting" | "connected" | "error"; lastAt: number };
}

const TEMPLATES = WORKSPACE_TEMPLATES;

import { OpenCodeWorkspace } from "@/lib/opencode-workspace";

const BuilderHeader = ({
  sessions,
  isSessionsLoading,
  onRefreshSessions,
  onSelectSession,
  sessionID,
  lastAssistantMessageID,
  directory,
  loopState,
  iteration,
  isRunning,
  onRunLoop,
  onStop,
  onApplyNextPatch,
  onResetSession,
  onNewWorkspaceSession,
  onChangeDirectory,
  sseStatus,
}: BuilderHeaderProps) => {
  const [open, setOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesLoading, setChangesLoading] = useState(false);
  const [status, setStatus] = useState<Array<{ path: string; status: string; added: number; removed: number }>>([]);
  const [diffs, setDiffs] = useState<Array<{ file: string; additions: number; deletions: number; before: string; after: string }>>([]);
  const [selectedDiff, setSelectedDiff] = useState<string | null>(null);

  const refreshChanges = useCallback(async () => {
    if (!sessionID) return;
    setChangesLoading(true);
    try {
      const [s, d] = await Promise.all([
        OpenCode.fileStatus().catch(() => []),
        OpenCode.sessionDiff(sessionID, lastAssistantMessageID ?? undefined).catch(() => []),
      ]);
      setStatus(s as any);
      setDiffs(
        (d as any[]).map((x) => ({
          file: typeof x.file === "string" ? x.file : "(unknown)",
          additions: typeof x.additions === "number" ? x.additions : 0,
          deletions: typeof x.deletions === "number" ? x.deletions : 0,
          before: typeof x.before === "string" ? x.before : "",
          after: typeof x.after === "string" ? x.after : "",
        })),
      );
    } finally {
      setChangesLoading(false);
    }
  }, [lastAssistantMessageID, sessionID]);

  const revertLast = useCallback(async () => {
    if (!sessionID || !lastAssistantMessageID) {
      toast.error("No last message to revert");
      return;
    }
    setChangesLoading(true);
    try {
      await OpenCode.revert(sessionID, { messageID: lastAssistantMessageID });
      toast.success("Reverted last message");
      await refreshChanges();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revert");
    } finally {
      setChangesLoading(false);
    }
  }, [lastAssistantMessageID, refreshChanges, sessionID]);

  const sorted = useMemo(() => {
    return [...sessions].sort((a, b) => b.updated - a.updated);
  }, [sessions]);

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-xl flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back</span>
        </Link>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 flex items-center justify-center" role="img" aria-label="poop">
            💩
          </span>
          <span className="font-display font-semibold text-sm text-gradient">UnLoveable</span>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="text-xs text-muted-foreground">Builder</div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2 mr-1">
          <div
            className={cn(
              "h-2.5 w-2.5 rounded-full border border-border",
              sseStatus?.state === "connected" ? "bg-emerald-500/90" : sseStatus?.state === "error" ? "bg-red-500/90" : "bg-amber-400/90",
            )}
            title={
              sseStatus
                ? `${sseStatus.state} (last event ${Math.max(0, Math.round((Date.now() - sseStatus.lastAt) / 1000))}s ago)`
                : "stream: unknown"
            }
          />
          <Badge variant="outline">{loopState}</Badge>
          <Badge variant="outline">iter {iteration}</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mr-2">
          <button
            type="button"
            onClick={onChangeDirectory}
            className="px-2 py-1 rounded-md bg-muted/60 border border-border hover:bg-muted transition-colors inline-flex items-center gap-2"
            title={directory || "Set OpenCode directory"}
          >
            <FolderCog className="h-3.5 w-3.5" />
            <span className="max-w-[220px] sm:max-w-[320px] truncate">{directory ? directory : "Directory: (default)"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onRefreshSessions();
              setOpen(true);
            }}
            className="px-2 py-1 rounded-md bg-muted/60 border border-border hover:bg-muted transition-colors inline-flex items-center gap-2"
            title={sessionID || "Select session"}
          >
            <span className="truncate max-w-[220px]">{sessionID ? `Session: ${sessionID}` : "Session: (none)"}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>


        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button variant="destructive" size="sm" className="gap-2" onClick={onStop}>
              <Square className="h-4 w-4" />
              <span className="hidden sm:inline">Stop</span>
            </Button>
          ) : (
            <Button variant="glow" size="sm" className="gap-2" onClick={onRunLoop} disabled={!sessionID}>
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Run Loop</span>
            </Button>
          )}

          <Button variant="ghost" size="sm" className="gap-2" onClick={onApplyNextPatch} disabled={!sessionID || isRunning}>
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">Apply Next Patch</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setChangesOpen(true);
                  refreshChanges().catch(() => undefined);
                }}
                disabled={!sessionID}
              >
                <div className="flex items-center justify-between w-full">
                  <span>Changes</span>
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                    {status.length}
                  </Badge>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onResetSession}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Session
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/builder/settings" className="flex items-center w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Sessions</DialogTitle>
            <DialogDescription>Pick a session for the active directory.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[50vh] overflow-auto">
            {sorted.length === 0 ? (
              <div className="text-sm text-muted-foreground">No sessions found for this directory.</div>
            ) : (
              sorted.map((s) => {
                const active = sessionID === s.id;
                const when = new Date(s.updated).toLocaleString();
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onSelectSession(s.id);
                      setOpen(false);
                    }}
                    className="w-full text-left rounded-md border border-border bg-card hover:bg-muted/40 transition-colors px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{s.title || s.id}</div>
                        <div className="text-xs text-muted-foreground truncate font-mono">{s.id}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {active ? <Badge variant="secondary">active</Badge> : null}
                        <div className="text-xs text-muted-foreground">{when}</div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={onRefreshSessions}
              disabled={isSessionsLoading}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-2">
                  New Workspace
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem
                  onClick={() => {
                    onNewWorkspaceSession("blank");
                    setOpen(false);
                  }}
                >
                  <div className="flex flex-col">
                    <span>Blank</span>
                    <span className="text-xs text-muted-foreground">Minimal Node project</span>
                  </div>
                </DropdownMenuItem>
                {TEMPLATES.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => {
                      onNewWorkspaceSession(t.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{t.label}</span>
                      <span className="text-xs text-muted-foreground">{t.description}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="glow"
              size="sm"
              className="gap-2"
              onClick={() => {
                // Always create a session for the active directory.
                // "New Workspace" is a separate action above.
                onResetSession();
                setOpen(false);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              New Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Changes</DialogTitle>
            <DialogDescription>Current working tree + last session diff.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[55vh] overflow-auto">
            <div className="text-xs text-muted-foreground">Working tree</div>
            <pre className="text-xs rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap">
              {status.length
                ? status
                    .slice(0, 200)
                    .map((s) => `${s.status}: ${s.path}`)
                    .join("\n")
                : "clean"}
            </pre>

            <div className="text-xs text-muted-foreground">Session diff (numstat)</div>
            <div className="rounded-md border border-border bg-muted/30">
              {diffs.length ? (
                <div className="max-h-[220px] overflow-auto">
                  {diffs.slice(0, 200).map((d) => (
                    <button
                      key={d.file}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-muted/50 border-b border-border last:border-b-0"
                      onClick={() => setSelectedDiff(d.file)}
                    >
                      {d.additions}\t{d.deletions}\t{d.file}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-xs font-mono">(no diff recorded)</div>
              )}
            </div>

            {selectedDiff ? (
              <div className="rounded-md border border-border bg-background">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <div className="text-xs font-mono truncate">{selectedDiff}</div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDiff(null)}>
                    Close
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                  {(() => {
                    const d = diffs.find((x) => x.file === selectedDiff);
                    const before = d?.before ?? "";
                    const after = d?.after ?? "";
                    return (
                      <>
                        <div className="border-b md:border-b-0 md:border-r border-border">
                          <div className="px-3 py-2 text-xs text-muted-foreground">before</div>
                          <pre className="px-3 pb-3 text-[11px] font-mono whitespace-pre-wrap max-h-[240px] overflow-auto">{before || "(empty)"}</pre>
                        </div>
                        <div>
                          <div className="px-3 py-2 text-xs text-muted-foreground">after</div>
                          <pre className="px-3 pb-3 text-[11px] font-mono whitespace-pre-wrap max-h-[240px] overflow-auto">{after || "(empty)"}</pre>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="secondary" size="sm" onClick={() => refreshChanges().catch(() => undefined)} disabled={changesLoading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="destructive" size="sm" onClick={revertLast} disabled={changesLoading || !lastAssistantMessageID}>
              Revert Last
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default BuilderHeader;
