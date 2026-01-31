import React from "react";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  before: string;
  after: string;
  className?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ before, after, className }) => {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-0 border rounded-md border-border bg-background", className)}>
      <div className="border-b md:border-b-0 md:border-r border-border">
        <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-b border-border">Before</div>
        <pre className="px-3 py-3 text-[11px] font-mono whitespace-pre-wrap max-h-[300px] overflow-auto before-content">
          {before || "(empty)"}
        </pre>
      </div>
      <div>
        <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30 border-b border-border">After</div>
        <pre className="px-3 py-3 text-[11px] font-mono whitespace-pre-wrap max-h-[300px] overflow-auto after-content">
          {after || "(empty)"}
        </pre>
      </div>
    </div>
  );
};
