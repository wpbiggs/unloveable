import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const PromptInput = () => {
  const [prompt, setPrompt] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();

  const placeholders = [
    "Build me a SaaS landing page with pricing...",
    "Create an e-commerce store for handmade jewelry...",
    "Design a portfolio site for a photographer...",
    "Make a dashboard for project management...",
  ];

  const [placeholderIndex] = useState(0);

  const handleSubmit = () => {
    navigate("/builder");
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div 
        className={`
          relative rounded-2xl transition-all duration-300
          ${isFocused ? 'glow-mixed' : ''}
        `}
      >
        <div className="border-gradient rounded-2xl bg-card p-1">
          <div className="relative flex items-center gap-3 rounded-xl bg-input/50 px-4 py-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={placeholders[placeholderIndex]}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-base"
            />
            <Button 
              variant="glow" 
              size="icon"
              className="shrink-0 h-10 w-10 rounded-xl"
              onClick={handleSubmit}
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {["Landing Page", "E-commerce", "Portfolio", "Dashboard", "Blog"].map((tag) => (
          <button
            key={tag}
            onClick={() => {
              setPrompt(`Build me a ${tag.toLowerCase()}...`);
              navigate("/builder");
            }}
            className="px-3 py-1.5 text-xs rounded-full border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PromptInput;
