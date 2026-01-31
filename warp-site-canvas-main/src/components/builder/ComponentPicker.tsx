import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Button } from "../ui/button";
import { Blocks } from "lucide-react";
import { COMPONENT_LIST } from "../../lib/component-list";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

interface ComponentPickerProps {
  onSelect: (componentName: string) => void;
}

export function ComponentPicker({ onSelect }: ComponentPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Blocks className="h-4 w-4" />
          <span className="hidden sm:inline">Components</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Component Library</DialogTitle>
          <DialogDescription>
             Choose a pre-built component to add to your project.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {COMPONENT_LIST.map((c) => (
              <div
                key={c.name}
                onClick={() => {
                  onSelect(c.name);
                  setOpen(false);
                }}
                className={cn(
                  "cursor-pointer rounded-lg border border-border bg-card p-3 hover:border-primary/50 hover:bg-muted/50 transition-all text-left",
                  "flex flex-col gap-2"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{c.name}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1">{c.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{c.description}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
