import { useState } from "react";
import { ChevronDown, ChevronRight, EyeOff, FileCode, FileJson, Folder, FolderOpen, Search } from "lucide-react";
import type { OpenCodeFileNode } from "@/lib/opencode-client";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FileTreeProps {
  files: OpenCodeFileNode[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onExpandDir: (path: string) => void;
  getChildren: (path: string) => OpenCodeFileNode[] | undefined;
}

const fileIcons: Record<string, typeof FileCode> = {
  html: FileCode,
  css: FileCode,
  js: FileCode,
  jsx: FileCode,
  ts: FileCode,
  tsx: FileCode,
  json: FileJson,
  md: FileCode,
};

function extname(name: string) {
  const idx = name.lastIndexOf(".");
  if (idx === -1) return "";
  return name.slice(idx + 1).toLowerCase();
}

const FileTreeNode = ({
  node,
  selectedFile,
  onSelectFile,
  onExpandDir,
  getChildren,
  level = 0,
}: {
  node: OpenCodeFileNode;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onExpandDir: (path: string) => void;
  getChildren: (path: string) => OpenCodeFileNode[] | undefined;
  level?: number;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentPath = node.path;
  const isFolder = node.type === "directory";
  const isSelected = selectedFile === currentPath;
  const children = isFolder ? getChildren(currentPath) : undefined;

  const handleClick = () => {
    if (isFolder) {
      const next = !isOpen;
      setIsOpen(next);
      if (next && children === undefined) {
        onExpandDir(currentPath);
      }
      return;
    }

    onSelectFile(currentPath);
  };

  const Icon = isFolder
    ? isOpen
      ? FolderOpen
      : Folder
    : fileIcons[extname(node.name)] || FileCode;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-sm text-xs",
          "hover:bg-muted/50 transition-colors",
          isSelected && "bg-primary/20 text-primary",
          node.ignored && "opacity-50"
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
            extname(node.name) === "html" && "text-orange-400",
            extname(node.name) === "css" && "text-blue-400",
            extname(node.name) === "js" && "text-yellow-400"
          )}
        />
        <span className="truncate">{node.name}</span>
      </div>
      {isFolder && isOpen && children && (
        <div>
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              onExpandDir={onExpandDir}
              getChildren={getChildren}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree = ({ files, selectedFile, onSelectFile, onExpandDir, getChildren }: FileTreeProps) => {
  const [showIgnored, setShowIgnored] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const visible = (showIgnored ? files : files.filter((n) => !n.ignored))
    .filter(n => searchQuery ? n.name.toLowerCase().includes(searchQuery.toLowerCase()) : true);

  return (
    <div className="h-full flex flex-col bg-card/30">
      <div className="h-auto border-b border-border flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-medium text-muted-foreground">Files</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-2 text-xs"
            onClick={() => setShowIgnored((v) => !v)}
          >
            <EyeOff className="h-3.5 w-3.5" />
            {showIgnored ? "Hide ignored" : "Show ignored"}
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            className="h-8 pl-8 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-2">
          {visible.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              onExpandDir={onExpandDir}
              getChildren={getChildren}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default FileTree;
