import { useState, useEffect } from "react";
import { OpenCode, type OpenCodeFileNode } from "@/lib/opencode-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { List, CheckCircle, Circle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface RunlogPanelProps {
  className?: string;
}

interface Runlog {
  id: string;
  name: string;
  path: string;
  iter: number;
}

export function RunlogPanel({ className }: RunlogPanelProps) {
  const [logs, setLogs] = useState<Runlog[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string | null>(null);

  useEffect(() => {
    // Only load list when dialog opens
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedLog) {
      loadLogContent(selectedLog);
    }
  }, [selectedLog]);

  const loadLogs = async () => {
    try {
      const files = await OpenCode.listFiles("runlogs");
      const list = files
        .filter((f) => f.name.endsWith(".md") && f.name.startsWith("iter_"))
        .map((f) => {
          const match = f.name.match(/iter_(\d+)/);
          return {
            id: f.name,
            name: f.name,
            path: f.path,
            iter: match ? parseInt(match[1], 10) : 0,
          };
        })
        .sort((a, b) => b.iter - a.iter); // Newest first
      setLogs(list);
    } catch (err) {
      console.warn("Failed to list runlogs", err);
      toast.error("Failed to list runlogs");
    }
  };

  const loadLogContent = async (path: string) => {
    try {
      const res = await OpenCode.readFile(path);
      if (res.type === "text") {
        setLogContent(res.content);
      }
    } catch (err) {
      console.warn("Failed to read log", err);
      toast.error("Failed to read log");
      setLogContent("Error reading log file.");
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={cn("gap-2", className)}
        onClick={() => setIsOpen(true)}
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">Runlogs</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Runlogs</DialogTitle>
            <DialogDescription>
              History of automated loop iterations.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar list */}
            <div className="w-64 border-r bg-muted/10 overflow-y-auto p-2 space-y-1">
              {logs.map((log) => (
                <button
                  key={log.id}
                  onClick={() => setSelectedLog(log.path)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2",
                    selectedLog === log.path
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  <CheckCircle className="h-3 w-3 opacity-70" />
                  {log.name}
                </button>
              ))}
              {logs.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  No runlogs found.
                </div>
              )}
            </div>

            {/* Content view */}
            <div className="flex-1 overflow-y-auto p-6 bg-card">
              {logContent ? (
                <pre className="text-sm font-mono whitespace-pre-wrap text-foreground/80">
                  {logContent}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Select a runlog to view details
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
