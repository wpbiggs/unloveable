import { Button } from "@/components/ui/button";
import { ArrowLeft, RotateCcw, Play, Square, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/surreal-sites-logo.png";
import ModelSelector from "./ModelSelector";

interface BuilderHeaderProps {
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  sessionID: string | null;
  isRunning: boolean;
  onRunLoop: () => void;
  onStop: () => void;
  onApplyNextPatch: () => void;
  onResetSession: () => void;
}

const BuilderHeader = ({
  provider,
  model,
  onProviderChange,
  onModelChange,
  sessionID,
  isRunning,
  onRunLoop,
  onStop,
  onApplyNextPatch,
  onResetSession,
}: BuilderHeaderProps) => {
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
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground mr-2">
          <span className="px-2 py-1 rounded-md bg-muted/60 border border-border">
            {sessionID ? `Session: ${sessionID}` : "Session: (none)"}
          </span>
        </div>

        <Button variant="ghost" size="sm" className="gap-2" onClick={onResetSession}>
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Reset Session</span>
        </Button>
        <Button variant="ghost" size="sm" className="gap-2" onClick={onApplyNextPatch} disabled={!sessionID || isRunning}>
          <Wand2 className="h-4 w-4" />
          <span className="hidden sm:inline">Apply Next Patch</span>
        </Button>
        {isRunning ? (
          <Button variant="destructive" size="sm" className="gap-2" onClick={onStop}>
            <Square className="h-4 w-4" />
            <span className="hidden sm:inline">Stop</span>
          </Button>
        ) : (
          <Button variant="glow" size="sm" className="gap-2" onClick={onRunLoop} disabled={!sessionID}>
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline">Run Loop</span>
          </Button>
        )}
      </div>
    </header>
  );
};

export default BuilderHeader;
