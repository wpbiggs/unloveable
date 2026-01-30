import { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface CodeEditorProps {
  filePath: string;
  content: string;
  language: string;
  onSave: (content: string) => void;
  onClose: () => void;
}

const CodeEditor = ({ filePath, content, language, onSave, onClose }: CodeEditorProps) => {
  const [editedContent, setEditedContent] = useState(content);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setEditedContent(content);
    setHasChanges(false);
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
    setHasChanges(e.target.value !== content);
  };

  const handleSave = () => {
    onSave(editedContent);
    setHasChanges(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
    
    // Handle tab key for indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = editedContent.substring(0, start) + "  " + editedContent.substring(end);
      setEditedContent(newValue);
      setHasChanges(true);
      // Set cursor position after the inserted spaces
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Header */}
      <div className="h-10 border-b border-border/50 flex items-center justify-between px-3 bg-[#161b22]">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-medium",
              language === "html" && "text-orange-400",
              language === "css" && "text-blue-400",
              language === "javascript" && "text-yellow-400"
            )}
          >
            {filePath}
          </span>
          {hasChanges && (
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges}
            className="h-6 gap-1 text-xs"
          >
            <Save className="h-3 w-3" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Editor */}
      <ScrollArea className="flex-1">
        <div className="relative min-h-full">
          <textarea
            value={editedContent}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            className={cn(
              "w-full h-full min-h-[400px] p-4 bg-transparent resize-none",
              "font-mono text-sm text-[#c9d1d9] leading-6",
              "focus:outline-none focus:ring-0 border-0",
              "placeholder:text-muted-foreground/30"
            )}
            placeholder="Start typing..."
          />
        </div>
      </ScrollArea>
    </div>
  );
};

export default CodeEditor;
