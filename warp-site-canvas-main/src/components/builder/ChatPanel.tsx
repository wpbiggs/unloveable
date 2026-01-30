import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message } from "@/lib/ai-config";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isGenerating: boolean;
  streamingContent?: string;
}

const ChatPanel = ({ messages, onSendMessage, isGenerating, streamingContent }: ChatPanelProps) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isGenerating) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const suggestions = [
    "Create a modern SaaS landing page",
    "Build an e-commerce product page",
    "Design a portfolio website",
    "Make a blog layout",
  ];

  return (
    <div className="h-full flex flex-col bg-card/30">
      {/* Chat header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Chat
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Describe what you want to build
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-foreground mb-2">
              Start building
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Describe your dream website and I'll bring it to life
            </p>
            <div className="space-y-2 w-full">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (isGenerating) return;
                    onSendMessage(suggestion);
                  }}
                  disabled={isGenerating}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  {message.role === "assistant" && message.content ? (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  ) : message.role === "assistant" && isGenerating ? (
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  ) : (
                    message.content
                  )}
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            rows={2}
            className="w-full resize-none rounded-xl bg-input border border-border px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isGenerating}
          />
          <Button
            type="submit"
            variant="glow"
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
            disabled={!input.trim() || isGenerating}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
