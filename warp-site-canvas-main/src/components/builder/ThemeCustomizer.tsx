
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Label } from "../ui/label";
import { Paintbrush, Moon, Sun, Monitor } from "lucide-react";
import { useTheme, THEME_COLORS, RADII } from "../theme-context";
import { cn } from "../../lib/utils";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

export function ThemeCustomizer() {
  const { theme, setTheme, colors, setPrimaryColor, setRadius } = useTheme();

  const setThemeFromToggle = (val: string) => {
    if (val === "light" || val === "dark" || val === "system") {
      setTheme(val);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" title="Customize Theme">
          <Paintbrush className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Theme Settings</h4>
            <p className="text-sm text-muted-foreground">
              Customize the look and feel of your workspace.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label>Mode</Label>
            <ToggleGroup
              type="single"
              value={theme}
              onValueChange={(val) => {
                if (val) setThemeFromToggle(val);
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="light" aria-label="Light mode">
                <Sun className="h-4 w-4 mr-2" />
                Light
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark mode">
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </ToggleGroupItem>
              <ToggleGroupItem value="system" aria-label="System mode">
                <Monitor className="h-4 w-4 mr-2" />
                System
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label>Primary Color</Label>
            <div className="grid grid-cols-5 gap-2">
              {THEME_COLORS.map((color) => (
                <button
                  key={color.name}
                  onClick={() => setPrimaryColor(color.value)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs",
                    colors.primary === color.value
                      ? "border-primary"
                      : "border-transparent hover:border-muted-foreground/50"
                  )}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {colors.primary === color.value && (
                    <span className="h-2 w-2 rounded-full bg-white dark:bg-black" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Radius</Label>
            <div className="flex gap-2">
              {RADII.map((r) => (
                <Button
                  key={r}
                  variant={colors.radius === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRadius(r)}
                  className="w-12"
                >
                  {r.replace("rem", "")}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
