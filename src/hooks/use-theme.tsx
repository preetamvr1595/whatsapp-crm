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

/**
 * ThemeProvider — wraps the whole app, owns the active theme state.
 *
 * The boot script in `src/app/layout.tsx` has already applied
 * `document.documentElement.dataset.theme` before React hydrates, so
 * by the time this Provider mounts the page is already painted in
 * the right colors. We just have to read what's there and keep it
 * in sync going forward.
 *
 * Persistence is localStorage only (device-scoped). A future
 * follow-up could mirror to `profiles.preferences` for cross-device
 * sync, but a per-device choice is also defensible — your phone may
 * deserve a different theme than your laptop.
 */

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (next: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  // Whatever the boot script applied is the truth. Fall back to
  // localStorage / default if for some reason the attribute is missing
  // (e.g. someone bypassed the boot script in a custom layout).
  const fromAttr = document.documentElement.dataset.theme;
  if (isThemeId(fromAttr)) return fromAttr;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    // localStorage can throw in private-browsing / sandboxed contexts.
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readInitialTheme);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
    }
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Same private-browsing edge case as above; the in-memory state
      // still updates so the current tab works for the session.
    }
  }, []);

  // Sync from other tabs — if you change your theme in tab A, tab B
  // catches up without a refresh.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      if (isThemeId(e.newValue) && e.newValue !== theme) {
        setThemeState(e.newValue);
        document.documentElement.dataset.theme = e.newValue;
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider — return a
    // no-op setter so callers don't crash. The boot script still
    // applied the right CSS attribute, so visually the page is fine.
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
    };
  }
  return ctx;
}
