import { useEffect, useMemo, useState } from "react";
import { Code2, Eye, Monitor, Smartphone, Tablet, Copy, Check, Image as ImageIcon, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { GeneratedCode } from "@/lib/ai-config";
import { cn } from "@/lib/utils";

interface PreviewPanelProps {
  code: GeneratedCode;
  isGenerating: boolean;
  url?: string | null;
  canRun?: boolean;
  isRunning?: boolean;
  onRun?: () => void;
  lastScreenshot?: string | null;
  nonce?: number;
  onRefresh?: () => void;
  onNavigate?: (nextUrl: string) => void;
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const viewportSizes: Record<ViewportSize, { width: string; icon: typeof Monitor }> = {
  desktop: { width: "100%", icon: Monitor },
  tablet: { width: "768px", icon: Tablet },
  mobile: { width: "375px", icon: Smartphone },
};

const PreviewPanel = ({
  code,
  isGenerating,
  url,
  canRun,
  isRunning,
  onRun,
  lastScreenshot,
  nonce = 0,
  onRefresh,
  onNavigate,
}: PreviewPanelProps) => {
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "visual">("preview");
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [copied, setCopied] = useState(false);
  const [address, setAddress] = useState("");

  const handleCopy = () => {
    navigator.clipboard.writeText(code.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasCode = code.html.trim().length > 0;
  const hasUrl = !!url;
  const hasScreenshot = !!lastScreenshot;

  useEffect(() => {
    setAddress(url ?? "");
  }, [url]);

  const canShowAddress = activeTab === "preview" && typeof onNavigate === "function";
  const iframeKey = useMemo(() => {
    const base = hasUrl ? `url:${url}` : hasCode ? `doc:${code.html.length}` : "empty";
    return `${base}:${viewport}:${nonce}`;
  }, [code.html.length, hasCode, hasUrl, nonce, url, viewport]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Panel header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 gap-3">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "preview" | "code" | "visual")}>
          <TabsList className="h-8 bg-muted/50">
            <TabsTrigger value="preview" className="h-6 gap-1.5 text-xs px-3">
              <Eye className="h-3 w-3" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="code" className="h-6 gap-1.5 text-xs px-3">
              <Code2 className="h-3 w-3" />
              Code
            </TabsTrigger>
            {hasScreenshot && (
              <TabsTrigger value="visual" className="h-6 gap-1.5 text-xs px-3">
                <ImageIcon className="h-3 w-3" />
                Visual
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 min-w-0">
          {canShowAddress && (
            <form
              className="flex items-center gap-2 min-w-0"
              onSubmit={(e) => {
                e.preventDefault();
                onNavigate(address);
              }}
            >
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="http://localhost:3000"
                className="h-7 w-[340px] max-w-[45vw] text-xs"
                spellCheck={false}
              />
              <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                Go
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  if (!url) return;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                title="Open in new tab"
                disabled={!url}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </form>
          )}

          {activeTab === "preview" && (
            <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
              {(Object.keys(viewportSizes) as ViewportSize[]).map((size) => {
                const { icon: Icon } = viewportSizes[size];
                return (
                  <button
                    key={size}
                    onClick={() => setViewport(size)}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      viewport === size
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === "preview" && typeof onRefresh === "function" && (hasUrl || hasCode) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => onRefresh()}
              title="Refresh preview"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}

          {activeTab === "code" && hasCode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "preview" ? (
          <div className="h-full flex items-center justify-center bg-muted/20 p-4">
            {hasUrl ? (
              <div
                className="h-full bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
                style={{ width: viewportSizes[viewport].width, maxWidth: "100%" }}
              >
                <iframe key={iframeKey} src={url!} className="w-full h-full border-0" title="Preview" />
              </div>
            ) : hasCode ? (
              <div
                className="h-full bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
                style={{ width: viewportSizes[viewport].width, maxWidth: "100%" }}
              >
                <iframe
                  key={iframeKey}
                  srcDoc={code.html}
                  className="w-full h-full border-0"
                  title="Preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
            ) : (
              <div className="text-center">
                {isGenerating ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto animate-pulse">
                      <Code2 className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-foreground">Generating...</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your website is being created
                      </p>
                    </div>
                  </div>
                ) : canRun && onRun ? (
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                      <Monitor className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-foreground">Ready to run</p>
                      <p className="text-sm text-muted-foreground mt-1">Install and start the workspace app to preview it</p>
                    </div>
                    <Button variant="glow" onClick={onRun} disabled={isRunning}>
                      {isRunning ? "Starting..." : "Install & Run"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                      <Monitor className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-foreground">No preview yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Describe what you want to build in the chat
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === "visual" ? (
          <div className="h-full flex items-center justify-center bg-muted/20 p-4">
            {lastScreenshot ? (
              <div
                className="h-full bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
                style={{ width: viewportSizes[viewport].width, maxWidth: "100%" }}
              >
                <img src={lastScreenshot} className="w-full h-full object-contain" alt="Last screenshot" />
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No screenshot yet</div>
            )}
          </div>
        ) : (
          <div className="h-full overflow-auto bg-[#0d1117] p-4">
            {hasCode ? (
              <pre className="text-sm font-mono text-[#c9d1d9] whitespace-pre-wrap">
                <code>{code.html}</code>
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                {hasUrl ? "Select a file in the File Tree to view code." : "No code generated yet"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
