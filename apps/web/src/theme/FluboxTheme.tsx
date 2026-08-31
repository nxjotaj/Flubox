import { LayerProvider, Theme, defineTheme } from "@astryxdesign/core";
import { neutralIconRegistry } from "@astryxdesign/theme-neutral";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type FluboxColorMode = "light" | "dark" | "system";

export const fluboxTheme = defineTheme({
  name: "flubox",
  tokens: {
    "--color-accent": ["#C2410C", "#FB923C"],
    "--color-accent-muted": ["#FFEDD5", "#431407"],
    "--color-text-accent": ["#C2410C", "#FDBA74"],
    "--color-background-body": ["#F5F5F5", "#111111"],
    "--color-background-surface": ["#FFFFFF", "#171717"],
    "--color-background-card": ["#FFFFFF", "#1C1C1C"],
    "--color-background-popover": ["#FFFFFF", "#1C1C1C"],
    "--color-background-muted": ["#FAFAFA", "#262626"],
    "--color-text-primary": ["#171717", "#FAFAFA"],
    "--color-text-secondary": ["#666666", "#A3A3A3"],
    "--color-text-disabled": ["#A3A3A3", "#666666"],
    "--color-border": ["#E5E5E5", "#333333"],
    "--color-border-emphasized": ["#D4D4D4", "#525252"],
    "--color-success": ["#168A52", "#4ADE80"],
    "--color-success-muted": ["#DCFCE7", "#123C28"],
    "--color-error": ["#D92D3F", "#FB7185"],
    "--color-error-muted": ["#FFE4E6", "#4C1520"],
    "--color-warning": ["#9A4E08", "#FDBA74"],
    "--color-warning-muted": ["#FFEDD5", "#431407"],
    "--focus-outline-color": ["#F97316", "#FB923C"],
    "--font-family-body": "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    "--font-family-heading": "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    "--radius-container": "12px",
  },
  components: {
    button: {
      base: { fontWeight: "700" },
      "variant:primary": {
        backgroundColor: "#F97316",
        color: "#111111",
        ":hover": { backgroundColor: "#EA580C", color: "#FFFFFF" },
        ":active": { backgroundColor: "#C2410C", color: "#FFFFFF" },
      },
      "variant:destructive": { backgroundColor: "#D92D3F", color: "#FFFFFF" },
    },
    card: { base: { borderRadius: "12px" } },
  },
  icons: neutralIconRegistry,
});

type ThemeContextValue = { mode: FluboxColorMode; setMode: (mode: FluboxColorMode) => void; toggleMode: () => void };
const FluboxModeContext = createContext<ThemeContextValue | null>(null);

export function FluboxThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<FluboxColorMode>(() => (localStorage.getItem("flubox-theme") as FluboxColorMode) || "light");
  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    setMode(next) { localStorage.setItem("flubox-theme", next); setModeState(next); },
    toggleMode() { const next = mode === "dark" ? "light" : "dark"; localStorage.setItem("flubox-theme", next); setModeState(next); },
  }), [mode]);
  return <FluboxModeContext.Provider value={value}><Theme theme={fluboxTheme} mode={mode}><LayerProvider>{children}</LayerProvider></Theme></FluboxModeContext.Provider>;
}

export function useFluboxTheme() { const value = useContext(FluboxModeContext); if (!value) throw new Error("FluboxThemeProvider ausente"); return value; }
