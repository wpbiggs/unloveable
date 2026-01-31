
import React, { useEffect, useState } from "react";
import { ThemeContext, type Theme } from "./theme-context";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("theme") as Theme) || "system"
  );
  
  const [primary, setPrimary] = useState(
    () => localStorage.getItem("theme-primary") || "187 100% 50%" // Default Cyan
  );
  
  const [radius, setRadius] = useState(
    () => localStorage.getItem("theme-radius") || "0.75rem"
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--ring", primary);
    
    // Also update the glow variables that use the primary color
    // In our index.css, --glow-cyan is often used as a primary accent
    root.style.setProperty("--glow-cyan", primary);
    
    localStorage.setItem("theme-primary", primary);
  }, [primary]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.style.setProperty("--radius", radius);
    localStorage.setItem("theme-radius", radius);
  }, [radius]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem("theme", theme);
      setTheme(theme);
    },
    colors: {
      primary,
      radius,
    },
    setPrimaryColor: setPrimary,
    setRadius,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
