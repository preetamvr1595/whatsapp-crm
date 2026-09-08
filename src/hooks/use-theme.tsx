"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_THEME,
  STORAGE_KEY,
  isThemeId,
  type ThemeId,
} from "@/lib/themes";

export const STORAGE_KEY_MODE = "wacrm.mode";
export type ThemeMode = "dark" | "light";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
  mode: ThemeMode;
  setMode: (next: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const fromAttr = document.documentElement.dataset.theme;
  if (isThemeId(fromAttr)) return fromAttr;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {}
  return DEFAULT_THEME;
}

function readInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const fromAttr = document.documentElement.dataset.mode as ThemeMode;
  if (fromAttr === "light" || fromAttr === "dark") return fromAttr;
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MODE);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readInitialTheme);
  const [mode, setModeState] = useState<ThemeMode>(readInitialMode);

  const applyMode = useCallback((next: ThemeMode) => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.mode = next;
      if (next === "light") {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      } else {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      }
    }
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
    }
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    applyMode(next);
    try {
      localStorage.setItem(STORAGE_KEY_MODE, next);
    } catch {}
  }, [applyMode]);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "dark" ? "light" : "dark"));
  }, [setMode]);

  useEffect(() => {
    applyMode(mode);
  }, [mode, applyMode]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && isThemeId(e.newValue)) {
        setThemeState(e.newValue);
        document.documentElement.dataset.theme = e.newValue;
      }
      if (e.key === STORAGE_KEY_MODE && (e.newValue === "light" || e.newValue === "dark")) {
        setModeState(e.newValue);
        applyMode(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [applyMode]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
      mode: "dark",
      setMode: () => {},
      toggleMode: () => {},
    };
  }
  return ctx;
}
