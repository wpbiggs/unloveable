import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { WORKSPACE_TEMPLATES } from "../../lib/workspace-templates";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { LayoutTemplate, ChevronRight, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { useState } from "react";

interface TemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateId: string) => void;
}

export function TemplateGallery({ open, onOpenChange, onSelect }: TemplateGalleryProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleCreate = () => {
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">New Workspace</DialogTitle>
              <DialogDescription>
                Start with a template or an empty project.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-muted/10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {WORKSPACE_TEMPLATES.map((t) => {
              const isActive = selected === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={cn(
                    "group relative cursor-pointer rounded-xl border-2 transition-all duration-200 hover:border-primary/50 hover:shadow-md",
                    isActive 
                      ? "border-primary bg-primary/5 shadow-md" 
                      : "border-border bg-card"
                  )}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                      )}>
                        {getTemplateIcon(t.id)}
                      </div>
                      {isActive && (
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    
                    <h3 className="font-semibold text-lg mb-1">{t.label}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                      {t.description}
                    </p>
                    
                    <div className="mt-4 flex flex-wrap gap-2">
                      {getTemplateTags(t.id).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-border bg-card flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!selected}
            className="min-w-[140px]"
          >
            Create Project
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getTemplateIcon(id: string) {
  // Simple icon mapping based on ID
  // In a real app we might store this in the template config
  switch (true) {
    case id.includes('react'): return <span className="font-bold text-sm">Ra</span>;
    case id.includes('next'): return <span className="font-bold text-sm">Nx</span>;
    case id.includes('express'): return <span className="font-bold text-sm">Ex</span>;
    case id === 'blank': return <span className="font-bold text-sm">./</span>;
    default: return <span className="font-bold text-sm">JS</span>;
  }
}

function getTemplateTags(id: string) {
  switch (id) {
    case 'express-spa': return ['Node.js', 'Express', 'HTML'];
    case 'vite-react-ts': return ['React', 'Vite', 'TypeScript', 'Tailwind'];
    case 'nextjs': return ['Next.js', 'React', 'App Router'];
    case 'blank': return ['Minimal', 'Empty'];
    default: return [];
  }
}
