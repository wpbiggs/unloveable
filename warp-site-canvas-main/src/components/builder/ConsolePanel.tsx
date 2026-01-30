import { useState } from "react";
import { Terminal, Trash2, ChevronDown, ChevronRight, AlertCircle, AlertTriangle, Info, CheckCircle, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConsoleLog } from "@/hooks/use-console-logs";
import { cn } from "@/lib/utils";

interface ConsolePanelProps {
  logs: ConsoleLog[];
  onClear: () => void;
}

const logIcons = {
  info: Info,
  warn: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
  debug: Bug,
};

const logColors = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  success: "text-green-400",
  debug: "text-purple-400",
};

const ConsolePanel = ({ logs, onClear }: ConsolePanelProps) => {
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<ConsoleLog["type"] | "all">("all");

  const toggleExpanded = (id: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredLogs = filter === "all" ? logs : logs.filter((log) => log.type === filter);

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="h-10 border-b border-border/50 flex items-center justify-between px-3 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Console</span>
          <span className="text-xs text-muted-foreground/50">({logs.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ConsoleLog["type"] | "all")}
            className="h-6 text-xs bg-[#0d1117] border border-border/50 rounded px-1.5 text-muted-foreground"
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="success">Success</option>
            <option value="debug">Debug</option>
          </select>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Logs */}
      <ScrollArea className="flex-1">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground/50 text-xs">
            No logs yet
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredLogs.map((log) => {
              const Icon = logIcons[log.type];
              const isExpanded = expandedLogs.has(log.id);
              const hasDetails = !!log.details;

              return (
                <div
                  key={log.id}
                  className={cn(
                    "group rounded px-2 py-1.5 text-xs font-mono hover:bg-[#1c2128] transition-colors",
                    hasDetails && "cursor-pointer"
                  )}
                  onClick={() => hasDetails && toggleExpanded(log.id)}
                >
                  <div className="flex items-start gap-2">
                    {hasDetails && (
                      <span className="text-muted-foreground mt-0.5">
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </span>
                    )}
                    <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", logColors[log.type])} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[#c9d1d9] break-all">{log.message}</span>
                        <span className="text-muted-foreground/50 shrink-0 text-[10px]">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      {isExpanded && log.details && (
                        <pre className="mt-2 p-2 bg-[#0d1117] rounded text-[#8b949e] whitespace-pre-wrap text-[11px] overflow-x-auto">
                          {log.details}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ConsolePanel;
