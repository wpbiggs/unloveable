import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import ChatPanel from "@/components/builder/ChatPanel";
import PreviewPanel from "@/components/builder/PreviewPanel";
import BuilderHeader from "@/components/builder/BuilderHeader";
import ConsolePanel from "@/components/builder/ConsolePanel";
import FileTree from "@/components/builder/FileTree";
import CodeEditor from "@/components/builder/CodeEditor";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { streamChat, extractHtmlFromResponse } from "@/lib/ai-stream";
import { Message, GeneratedCode, DEFAULT_PROVIDER, DEFAULT_MODEL } from "@/lib/ai-config";
import { parseGeneratedCode, generateFileTree, ParsedFiles } from "@/lib/code-parser";
import { exportAsZip } from "@/lib/export-utils";
import { useConsoleLogs } from "@/hooks/use-console-logs";

const Builder = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode>({ html: "", css: "", js: "" });
  const [parsedFiles, setParsedFiles] = useState<ParsedFiles>({ html: "", css: "", js: "" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string; language: string } | null>(null);
  const consoleLogs = useConsoleLogs();

  const fileTree = generateFileTree(parsedFiles);

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
    consoleLogs.info(`Starting generation with ${model}`, `Provider: ${provider}\nPrompt: ${content}`);

    const assistantMessageId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }]);

    let fullResponse = "";

    await streamChat({
      messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
      provider,
      model,
      onDelta: (text) => {
        fullResponse += text;
        setStreamingContent(fullResponse);
        setMessages(prev => prev.map(m => 
          m.id === assistantMessageId 
            ? { ...m, content: fullResponse }
            : m
        ));
      },
      onDone: (response) => {
        const code = extractHtmlFromResponse(response);
        setGeneratedCode(code);
        const parsed = parseGeneratedCode(code);
        setParsedFiles(parsed);
        setIsGenerating(false);
        setStreamingContent("");
        consoleLogs.success("Generation complete", `HTML: ${code.html.length} chars`);
      },
      onError: (error) => {
        toast.error(error);
        consoleLogs.error("Generation failed", error);
        setIsGenerating(false);
        setStreamingContent("");
        setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
      },
    });
  };

  const handleFileSelect = useCallback((path: string, content: string, language: string) => {
    setSelectedFile({ path, content, language });
    consoleLogs.debug(`Opened file: ${path}`);
  }, [consoleLogs]);

  const handleFileSave = useCallback((content: string) => {
    if (!selectedFile) return;
    
    // Update the parsed files based on which file was edited
    setParsedFiles(prev => {
      const updated = { ...prev };
      if (selectedFile.path.includes("index.html")) {
        updated.html = content;
      } else if (selectedFile.path.includes(".css")) {
        updated.css = content;
      } else if (selectedFile.path.includes(".js")) {
        updated.js = content;
      }
      return updated;
    });
    
    // Update generated code to trigger preview refresh
    setGeneratedCode(prev => {
      if (selectedFile.path.includes("index.html")) {
        return { ...prev, html: content };
      }
      return prev;
    });
    
    setSelectedFile(prev => prev ? { ...prev, content } : null);
    consoleLogs.success(`Saved: ${selectedFile.path}`);
    toast.success("File saved");
  }, [selectedFile, consoleLogs]);

  const handleCloseEditor = useCallback(() => {
    setSelectedFile(null);
  }, []);

  const handleExport = useCallback(async () => {
    if (!parsedFiles.html) {
      toast.error("No website to export");
      return;
    }
    consoleLogs.info("Exporting website as ZIP...");
    try {
      await exportAsZip(parsedFiles, "surreal-site");
      consoleLogs.success("Export complete");
      toast.success("Website exported successfully");
    } catch (error) {
      consoleLogs.error("Export failed", error instanceof Error ? error.message : "Unknown error");
      toast.error("Failed to export website");
    }
  }, [parsedFiles, consoleLogs]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <BuilderHeader 
        provider={provider}
        model={model}
        onProviderChange={setProvider}
        onModelChange={setModel}
        onExport={handleExport}
        hasCode={parsedFiles.html.length > 0}
      />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* File Tree */}
        <ResizablePanel defaultSize={15} minSize={10} maxSize={25}>
          <FileTree
            files={fileTree}
            selectedFile={selectedFile?.path || null}
            onSelectFile={handleFileSelect}
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
                  onSave={handleFileSave}
                  onClose={handleCloseEditor}
                />
              ) : (
                <PreviewPanel code={generatedCode} isGenerating={isGenerating} />
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
