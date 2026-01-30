import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/surreal-sites-logo.png";
import ModelSelector from "./ModelSelector";

interface BuilderHeaderProps {
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onExport: () => void;
  hasCode: boolean;
}

const BuilderHeader = ({ provider, model, onProviderChange, onModelChange, onExport, hasCode }: BuilderHeaderProps) => {
  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-xl flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back</span>
        </Link>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <img src={logo} alt="Surreal Sites" className="h-6 w-6" />
          <span className="font-display font-semibold text-sm text-gradient">Surreal Sites</span>
        </div>
        <div className="h-6 w-px bg-border" />
        <ModelSelector
          provider={provider}
          model={model}
          onProviderChange={onProviderChange}
          onModelChange={onModelChange}
        />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share</span>
        </Button>
        <Button 
          variant="glow" 
          size="sm" 
          className="gap-2"
          onClick={onExport}
          disabled={!hasCode}
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
    </header>
  );
};

export default BuilderHeader;
