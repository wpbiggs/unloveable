import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode, FileJson, Folder, FolderOpen } from "lucide-react";
import { FileNode } from "@/lib/code-parser";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FileTreeProps {
  files: FileNode[];
  selectedFile: string | null;
  onSelectFile: (path: string, content: string, language: string) => void;
}

const fileIcons: Record<string, typeof FileCode> = {
  html: FileCode,
  css: FileCode,
  javascript: FileCode,
  json: FileJson,
};

const FileTreeNode = ({
  node,
  path,
  selectedFile,
  onSelectFile,
  level = 0,
}: {
  node: FileNode;
  path: string;
  selectedFile: string | null;
  onSelectFile: (path: string, content: string, language: string) => void;
  level?: number;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const currentPath = path ? `${path}/${node.name}` : node.name;
  const isFolder = node.type === "folder";
  const isSelected = selectedFile === currentPath;

  const handleClick = () => {
    if (isFolder) {
      setIsOpen(!isOpen);
    } else if (node.content !== undefined && node.language) {
      onSelectFile(currentPath, node.content, node.language);
    }
  };

  const Icon = isFolder
    ? isOpen
      ? FolderOpen
      : Folder
    : fileIcons[node.language || ""] || FileCode;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-sm text-xs",
          "hover:bg-muted/50 transition-colors",
          isSelected && "bg-primary/20 text-primary"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isFolder && (
          <span className="text-muted-foreground">
            {isOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        )}
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            isFolder ? "text-yellow-500" : "text-muted-foreground",
            node.language === "html" && "text-orange-400",
            node.language === "css" && "text-blue-400",
            node.language === "javascript" && "text-yellow-400"
          )}
        />
        <span className="truncate">{node.name}</span>
      </div>
      {isFolder && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.name}
              node={child}
              path={currentPath}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree = ({ files, selectedFile, onSelectFile }: FileTreeProps) => {
  return (
    <div className="h-full flex flex-col bg-card/30">
      <div className="h-10 border-b border-border flex items-center px-3">
        <span className="text-xs font-medium text-muted-foreground">Files</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-2">
          {files.map((node) => (
            <FileTreeNode
              key={node.name}
              node={node}
              path=""
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FileTree;
