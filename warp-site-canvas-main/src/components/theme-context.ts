import { createContext, useContext } from "react";

export type Theme = "dark" | "light" | "system";

export type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colors: {
    primary: string;
    radius: string;
  };
  setPrimaryColor: (color: string) => void;
  setRadius: (radius: string) => void;
};

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const THEME_COLORS = [
  { name: "Zinc", value: "240 5.9% 10%", hex: "#18181b" },
  { name: "Red", value: "0 72.2% 50.6%", hex: "#ef4444" },
  { name: "Rose", value: "346.8 77.2% 49.8%", hex: "#f43f5e" },
  { name: "Orange", value: "24.6 95% 53.1%", hex: "#f97316" },
  { name: "Green", value: "142.1 76.2% 36.3%", hex: "#22c55e" },
  { name: "Blue", value: "221.2 83.2% 53.3%", hex: "#3b82f6" },
  { name: "Yellow", value: "47.9 95.8% 53.1%", hex: "#eab308" },
  { name: "Violet", value: "262.1 83.3% 57.8%", hex: "#8b5cf6" },
  { name: "Cyan", value: "187 100% 50%", hex: "#06b6d4" },
];

export const RADII = ["0", "0.3rem", "0.5rem", "0.75rem", "1.0rem"];

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
