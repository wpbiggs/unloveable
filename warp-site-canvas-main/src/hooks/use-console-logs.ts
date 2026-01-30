import { useState, useCallback } from "react";

export interface ConsoleLog {
  id: string;
  type: "info" | "warn" | "error" | "success" | "debug";
  message: string;
  timestamp: Date;
  details?: string;
}

export function useConsoleLogs() {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);

  const addLog = useCallback((type: ConsoleLog["type"], message: string, details?: string) => {
    const newLog: ConsoleLog = {
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: new Date(),
      details,
    };
    setLogs((prev) => [...prev, newLog]);
    return newLog.id;
  }, []);

  const info = useCallback((message: string, details?: string) => addLog("info", message, details), [addLog]);
  const warn = useCallback((message: string, details?: string) => addLog("warn", message, details), [addLog]);
  const error = useCallback((message: string, details?: string) => addLog("error", message, details), [addLog]);
  const success = useCallback((message: string, details?: string) => addLog("success", message, details), [addLog]);
  const debug = useCallback((message: string, details?: string) => addLog("debug", message, details), [addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    logs,
    addLog,
    info,
    warn,
    error,
    success,
    debug,
    clearLogs,
  };
}
