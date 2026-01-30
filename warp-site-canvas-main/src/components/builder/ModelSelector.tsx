import { useState } from "react";
import { Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AI_PROVIDERS, AIModel, DEFAULT_MODEL, DEFAULT_PROVIDER } from "@/lib/ai-config";

interface ModelSelectorProps {
  provider: string;
  model: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
}

const ModelSelector = ({
  provider,
  model,
  onProviderChange,
  onModelChange,
}: ModelSelectorProps) => {
  const currentProvider = AI_PROVIDERS.find((p) => p.id === provider) || AI_PROVIDERS[0];
  const currentModel = currentProvider.models.find((m) => m.id === model) || currentProvider.models[0];

  const handleProviderChange = (newProvider: string) => {
    onProviderChange(newProvider);
    const newProviderConfig = AI_PROVIDERS.find((p) => p.id === newProvider);
    if (newProviderConfig && newProviderConfig.models.length > 0) {
      onModelChange(newProviderConfig.models[0].id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-7 text-xs">
          <Settings className="h-3 w-3" />
          {currentModel?.name || "Select Model"}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Provider</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={provider} onValueChange={handleProviderChange}>
          {AI_PROVIDERS.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id}>
              {p.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Model</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={model} onValueChange={onModelChange}>
          {currentProvider.models.map((m) => (
            <DropdownMenuRadioItem key={m.id} value={m.id}>
              {m.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ModelSelector;
