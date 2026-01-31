import { useEffect, useState } from "react";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { OpenCode } from "@/lib/opencode-client";

interface CodeEditorProps {
  filePath: string;
  content: string;
  language: string;
  onClose: () => void;
}

const CodeEditor = ({ filePath, content, language, onClose }: CodeEditorProps) => {
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await OpenCode.writeFile(filePath, editedContent);
      toast({
        title: "File saved",
        description: `Successfully saved ${filePath}`,
      });
    } catch (error) {
      console.warn("Failed to save file:", error);
      toast({
        variant: "destructive",
        title: "Error saving file",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Ctrl+S / Cmd+S for save
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
      return;
    }
    
    // Handle tab key for indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = editedContent.substring(0, start) + "  " + editedContent.substring(end);
      setEditedContent(newValue);
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
          {editedContent !== content && (
            <span className="text-[11px] text-yellow-400 font-medium">Unsaved changes</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || editedContent === content}
            className={cn(
              "h-7 px-2 text-xs gap-1.5",
              editedContent !== content ? "text-primary hover:text-primary" : "text-muted-foreground"
            )}
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save</span>
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
