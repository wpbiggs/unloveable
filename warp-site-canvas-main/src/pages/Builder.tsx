import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import ChatPanel from "@/components/builder/ChatPanel";
import PreviewPanel from "@/components/builder/PreviewPanel";
import BuilderHeader from "@/components/builder/BuilderHeader";
import ConsolePanel from "@/components/builder/ConsolePanel";
import FileTree from "@/components/builder/FileTree";
import CodeEditor from "@/components/builder/CodeEditor";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Message, DEFAULT_PROVIDER, DEFAULT_MODEL } from "@/lib/ai-config";
import { useConsoleLogs } from "@/hooks/use-console-logs";
import { OpenCode, type OpenCodeFileNode } from "@/lib/opencode-client";
import { streamOpenCodeTextMessage } from "@/lib/opencode-stream";

const guessLanguage = (path: string) => {
  const idx = path.lastIndexOf(".");
  const ext = idx === -1 ? "" : path.slice(idx + 1).toLowerCase();
  if (ext === "html") return "html";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "jsx") return "javascript";
  if (ext === "ts" || ext === "tsx") return "typescript";
  if (ext === "json") return "json";
  if (ext === "md") return "markdown";
  return "text";
};

const Builder = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionID, setSessionID] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string; language: string } | null>(null);
  const [rootFiles, setRootFiles] = useState<OpenCodeFileNode[]>([]);
  const [childrenByPath, setChildrenByPath] = useState<Record<string, OpenCodeFileNode[]>>({});
  const consoleLogs = useConsoleLogs();
  const abortRef = useRef<AbortController | null>(null);

  const refreshRootFiles = useCallback(async () => {
    const nodes = await OpenCode.listFiles(".");
    setRootFiles(nodes);
  }, []);

  const expandDir = useCallback(
    async (path: string) => {
      if (childrenByPath[path]) return;
      try {
        const nodes = await OpenCode.listFiles(path);
        setChildrenByPath((prev) => ({ ...prev, [path]: nodes }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load directory");
      }
    },
    [childrenByPath],
  );

  const getChildren = useCallback((path: string) => childrenByPath[path], [childrenByPath]);

  const ensureSession = useCallback(async () => {
    if (sessionID) return sessionID;
    const session = await OpenCode.createSession();
    setSessionID(session.id);
    consoleLogs.info("OpenCode session created", `Session: ${session.id}`);
    return session.id;
  }, [sessionID, consoleLogs]);

  const stop = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (sessionID) {
      await OpenCode.abortSession(sessionID).catch(() => undefined);
    }
    setIsGenerating(false);
    setStreamingContent("");
  }, [sessionID]);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([OpenCode.health(), refreshRootFiles(), ensureSession()]);
      } catch (err) {
        consoleLogs.error(
          "OpenCode not reachable",
          err instanceof Error ? err.message : "Check VITE_OPENCODE_URL and server status",
        );
        toast.error("OpenCode server not reachable (check VITE_OPENCODE_URL)");
      }
    })();
  }, [consoleLogs, ensureSession, refreshRootFiles]);

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);
    setStreamingContent("");
    consoleLogs.info("Sending message to OpenCode", `Prompt: ${content}`);

    const assistantMessageId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }]);

    let fullResponse = "";

    try {
      const id = await ensureSession();
      const abort = new AbortController();
      abortRef.current = abort;

      await streamOpenCodeTextMessage({
        sessionID: id,
        text: content,
        signal: abort.signal,
        onDelta: (text) => {
          fullResponse += text;
          setStreamingContent(fullResponse);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessageId ? { ...m, content: fullResponse } : m)),
          );
        },
        onDone: async (responseText, msg) => {
          const error = msg.info?.error?.message;
          if (error) {
            consoleLogs.error("OpenCode error", error);
          }

          if (!responseText.trim()) {
            const types = Array.isArray(msg.parts)
              ? msg.parts
                  .map((p) => (p && typeof p.type === "string" ? p.type : "unknown"))
                  .slice(0, 40)
                  .join(", ")
              : "(no parts)";

            consoleLogs.info("OpenCode parts", types);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content:
                        "[OpenCode returned no text parts. Check Console for part types and any errors.]",
                    }
                  : m,
              ),
            );
          }

          setIsGenerating(false);
          setStreamingContent("");
          abortRef.current = null;

          consoleLogs.success("OpenCode response complete", `${responseText.length} chars`);
          await refreshRootFiles().catch(() => undefined);
          await OpenCode.fileStatus()
            .then((status) => {
              if (status.length > 0) {
                consoleLogs.info("Git status", status.slice(0, 20).map((s) => `${s.status}: ${s.path}`).join("\n"));
              }
            })
            .catch(() => undefined);
        },
        onError: (error) => {
          toast.error(error);
          consoleLogs.error("OpenCode message failed", error);
          setIsGenerating(false);
          setStreamingContent("");
          abortRef.current = null;
          setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
      consoleLogs.error("OpenCode message failed", err instanceof Error ? err.message : "Unknown error");
      setIsGenerating(false);
      setStreamingContent("");
      abortRef.current = null;
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
    }
  };

  const handleFileSelect = useCallback(
    async (path: string) => {
      try {
        const file = await OpenCode.readFile(path);
        const language = guessLanguage(path);
        setSelectedFile({ path, content: file.content, language });
        consoleLogs.debug(`Opened file: ${path}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to read file");
      }
    },
    [consoleLogs],
  );

  const handleCloseEditor = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleResetSession = useCallback(async () => {
    await stop();
    setMessages([]);
    setSelectedFile(null);
    setChildrenByPath({});
    try {
      const session = await OpenCode.createSession();
      setSessionID(session.id);
      consoleLogs.info("Session reset", `Session: ${session.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset session");
    }
  }, [consoleLogs, stop]);

  const handleApplyNextPatch = useCallback(async () => {
    await handleSendMessage(
      "Apply the next patch based on the current repo state and any previous errors. Keep changes minimal and run the relevant checks.",
    );
  }, [handleSendMessage]);

  const handleRunLoop = useCallback(async () => {
    await handleSendMessage(
      "Run one iteration of the Ralph Wiggum loop: plan, make the minimal patch, run checks, observe failures, and repair once.",
    );
  }, [handleSendMessage]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <BuilderHeader 
        provider={provider}
        model={model}
        onProviderChange={setProvider}
        onModelChange={setModel}
        sessionID={sessionID}
        isRunning={isGenerating}
        onRunLoop={handleRunLoop}
        onStop={stop}
        onApplyNextPatch={handleApplyNextPatch}
        onResetSession={handleResetSession}
      />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* File Tree */}
        <ResizablePanel defaultSize={15} minSize={10} maxSize={25}>
          <FileTree
            files={rootFiles}
            selectedFile={selectedFile?.path || null}
            onSelectFile={handleFileSelect}
            onExpandDir={expandDir}
            getChildren={getChildren}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        
        {/* Chat Panel */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
          <ChatPanel 
            messages={messages} 
            onSendMessage={handleSendMessage}
            isGenerating={isGenerating}
            streamingContent={streamingContent}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        
        {/* Main Content Area */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <ResizablePanelGroup direction="vertical">
            {/* Preview/Code Editor */}
            <ResizablePanel defaultSize={70} minSize={30}>
              {selectedFile ? (
                <CodeEditor
                  filePath={selectedFile.path}
                  content={selectedFile.content}
                  language={selectedFile.language}
                  onClose={handleCloseEditor}
                />
              ) : (
                <PreviewPanel code={{ html: "", css: "", js: "" }} isGenerating={isGenerating} />
              )}
            </ResizablePanel>
            <ResizableHandle withHandle />
            
            {/* Console */}
            <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
              <ConsolePanel logs={consoleLogs.logs} onClear={consoleLogs.clearLogs} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Builder;
