import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, FolderOpen, Home, ArrowUp, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { OpenCodeFileNode } from "@/lib/opencode-client";
import { OpenCode } from "@/lib/opencode-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAbsolutePath: (absPath: string) => void;
};

type PathInfo = { directory: string; worktree: string };

function baseUrl() {
  const raw = (import.meta.env.VITE_OPENCODE_URL as string | undefined) || "http://localhost:4096";
  return raw.replace(/\/$/, "");
}

function normalizePickerPath(p: string) {
  const v = (p || ".").trim();
  if (!v || v === "/") return ".";
  return v.replace(/^\.\//, "");
}

function joinPickerPath(base: string, child: string) {
  const b = normalizePickerPath(base);
  const c = (child || "").trim().replace(/^\.\//, "").replace(/^\//, "");
  if (!c) return b;
  if (b === ".") return c;
  return `${b}/${c}`;
}

function parentPickerPath(p: string) {
  const v = normalizePickerPath(p);
  if (v === ".") return ".";
  const parts = v.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? parts.join("/") : ".";
}

async function requestJsonNoDirectory<T>(pathname: string, query?: Record<string, string | undefined>) {
  const url = new URL(baseUrl() + pathname);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined) continue;
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`OpenCode request failed (${res.status})`);
  return (await res.json()) as T;
}

export function OpenCodeDirectoryDialog({ open, onOpenChange, onSelectAbsolutePath }: Props) {
  const [busy, setBusy] = useState(false);
  const [pathInfo, setPathInfo] = useState<PathInfo | null>(null);
  const [path, setPath] = useState(".");
  const [items, setItems] = useState<OpenCodeFileNode[]>([]);
  const [showIgnored, setShowIgnored] = useState(false);
  const [shellSessionID, setShellSessionID] = useState<string | null>(null);

  const absPreview = useMemo(() => {
    const base = pathInfo?.directory || "";
    const rel = normalizePickerPath(path);
    if (!base) return "";
    return rel === "." ? base : `${base.replace(/\/$/, "")}/${rel}`;
  }, [path, pathInfo?.directory]);

  const load = useCallback(async (p: string) => {
    const rel = normalizePickerPath(p);
    setBusy(true);
    try {
      const info = await requestJsonNoDirectory<PathInfo>("/path");
      setPathInfo(info);
      const nodes = await requestJsonNoDirectory<OpenCodeFileNode[]>("/file", { path: rel });
      const alwaysHidden = new Set([".git", "node_modules"]);

      const isInWorkspaces = rel === "workspaces" || rel.startsWith("workspaces/");
      const isWorkspacePath = (nodePath: string) => nodePath === "workspaces" || nodePath.startsWith("workspaces/");
      const hideWorkspaceInternalRoot = (name: string) => name === "_infra" || name === "_shared" || name.startsWith("session-");

      const dirs = nodes
        .filter((x) => x.type === "directory")
        .filter((x) => !alwaysHidden.has(x.name))
        // Respect gitignore by default, but always allow browsing within `workspaces/`.
        // (It's gitignored in this repo, but it's a primary UX path for the builder.)
        .filter((x) => !x.ignored || showIgnored || isInWorkspaces || isWorkspacePath(x.path))
        // Keep the workspaces root focused on actual project folders by default.
        .filter((x) => (rel === "workspaces" && !showIgnored ? !hideWorkspaceInternalRoot(x.name) : true))
        .sort((a, b) => {
          const ai = a.ignored ? 1 : 0;
          const bi = b.ignored ? 1 : 0;
          if (ai !== bi) return ai - bi;
          return a.name.localeCompare(b.name);
        });
      setItems(dirs);
      setPath(rel);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to list directories");
    } finally {
      setBusy(false);
    }
  }, [showIgnored]);

  const ensureShellSession = useCallback(async () => {
    if (shellSessionID) return shellSessionID;
    const created = await OpenCode.createSession();
    setShellSessionID(created.id);
    return created.id;
  }, [shellSessionID]);

  const renameWorkspace = useCallback(
    async (oldName: string) => {
      const rel = normalizePickerPath(path);
      if (rel !== "workspaces") return;

      const next = window.prompt("Rename workspace folder", oldName);
      if (!next) return;
      const newName = next.trim();
      if (!newName || newName === oldName) return;
      if (/^[_.]/.test(newName) || /\//.test(newName) || /\s/.test(newName)) {
        toast.error("Invalid name (no spaces/slashes; cannot start with '_' or '.')");
        return;
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(newName)) {
        toast.error("Invalid name (use letters, numbers, '.', '_', '-')");
        return;
      }

      const root = pathInfo?.directory || (await requestJsonNoDirectory<PathInfo>("/path")).directory;
      if (!root) {
        toast.error("Server path info not loaded yet");
        return;
      }

      const oldRel = `workspaces/${oldName}`;
      const newRel = `workspaces/${newName}`;

      const sid = await ensureShellSession();
      setBusy(true);
      try {
        // Avoid shell variables; OpenCode shell backends may sanitize them.
        const cmd = [
          `cd "${root}"`,
          `test -d "${oldRel}"`,
          `test ! -e "${newRel}"`,
          `mv -- "${oldRel}" "${newRel}"`,
        ].join(" && ");
        await OpenCode.runShell(sid, cmd, { agent: "task" });
        toast.success(`Renamed to ${newName}`);
        await load("workspaces");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Rename failed");
      } finally {
        setBusy(false);
      }
    },
    [ensureShellSession, load, path, pathInfo?.directory],
  );

  useEffect(() => {
    if (!open) return;
    load(".").catch(() => undefined);
  }, [open, load]);

  const apply = useCallback(() => {
    if (!absPreview) {
      toast.error("Server path info not loaded yet");
      return;
    }

    const rel = normalizePickerPath(path);
    // In this repo, `workspaces/` contains internal folders we don't want selectable as project roots.
    if (rel === "workspaces/_infra" || rel === "workspaces/_shared" || rel.startsWith("workspaces/session-")) {
      toast.error("Select a project workspace (e.g. workspaces/blank-0001), not an internal workspace folder");
      return;
    }

    onSelectAbsolutePath(absPreview);
    onOpenChange(false);
  }, [absPreview, onOpenChange, onSelectAbsolutePath, path]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select OpenCode Directory</DialogTitle>
          <DialogDescription>Pick the folder OpenCode should operate in (git + files).</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => load(parentPickerPath(path))} disabled={busy}>
              <ArrowUp className="h-4 w-4 mr-2" />
              Up
            </Button>
            <Button variant="secondary" size="sm" onClick={() => load(".")} disabled={busy}>
              <Home className="h-4 w-4 mr-2" />
              Root
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowIgnored((v) => !v);
                // Refresh current listing so the toggle takes effect immediately.
                load(path).catch(() => undefined);
              }}
              disabled={busy}
            >
              {showIgnored ? "Hide ignored" : "Show ignored"}
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" size="sm" onClick={apply} disabled={busy || !absPreview}>
              <FolderOpen className="h-4 w-4 mr-2" />
              Use This Directory
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Relative path</div>
              <Input value={path} onChange={(e) => setPath(e.target.value)} onBlur={() => load(path)} disabled={busy} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Absolute path</div>
              <Input value={absPreview} readOnly />
            </div>
          </div>

          <div className="border border-border rounded-md overflow-hidden flex-1 min-h-0">
            <ScrollArea className="h-[50vh]" type="always">
              {items.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No subdirectories found.</div>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((d) => (
                    <button
                      key={d.path}
                      type="button"
                      onClick={() => load(joinPickerPath(path, d.name))}
                      disabled={busy}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-50"
                    >
                      <Folder className="h-4 w-4" />
                      <span className="font-mono text-xs truncate">{d.name}</span>
                      <div className="flex-1" />
                      {normalizePickerPath(path) === "workspaces" && !d.name.startsWith("_") && !d.name.startsWith("session-") ? (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-md p-1 hover:bg-muted"
                          aria-label={`Rename ${d.name}`}
                          title="Rename"
                          disabled={busy}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            renameWorkspace(d.name).catch(() => undefined);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={busy || !absPreview}>
            Use This Directory
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
