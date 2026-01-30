import { useState } from "react";
import { Code2, Eye, Monitor, Smartphone, Tablet, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GeneratedCode } from "@/lib/ai-config";
import { cn } from "@/lib/utils";

interface PreviewPanelProps {
  code: GeneratedCode;
  isGenerating: boolean;
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const viewportSizes: Record<ViewportSize, { width: string; icon: typeof Monitor }> = {
  desktop: { width: "100%", icon: Monitor },
  tablet: { width: "768px", icon: Tablet },
  mobile: { width: "375px", icon: Smartphone },
};

const PreviewPanel = ({ code, isGenerating }: PreviewPanelProps) => {
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");
  const [viewport, setViewport] = useState<ViewportSize>("desktop");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasCode = code.html.trim().length > 0;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Panel header */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "preview" | "code")}>
          <TabsList className="h-8 bg-muted/50">
            <TabsTrigger value="preview" className="h-6 gap-1.5 text-xs px-3">
              <Eye className="h-3 w-3" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="code" className="h-6 gap-1.5 text-xs px-3">
              <Code2 className="h-3 w-3" />
              Code
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
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
            {hasCode ? (
              <div
                className="h-full bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300"
                style={{ width: viewportSizes[viewport].width, maxWidth: "100%" }}
              >
                <iframe
                  srcDoc={code.html}
                  className="w-full h-full border-0"
                  title="Preview"
                  sandbox="allow-scripts"
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
        ) : (
          <div className="h-full overflow-auto bg-[#0d1117] p-4">
            {hasCode ? (
              <pre className="text-sm font-mono text-[#c9d1d9] whitespace-pre-wrap">
                <code>{code.html}</code>
              </pre>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No code generated yet
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;
