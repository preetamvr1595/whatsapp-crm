"use client";

import { Check, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";

export function AppearancePanel() {
  const { theme, setTheme, mode, setMode } = useTheme();

  return (
    <section className="space-y-8">
      {/* Light / Dark Mode Picker */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white dark:text-white light:text-slate-900">
            Interface Mode
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose whether you prefer a clean Light aesthetic or an immersive Cyberpunk Dark experience.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Light Mode Card */}
          <button
            type="button"
            onClick={() => setMode("light")}
            className={cn(
              "flex items-center gap-4 rounded-xl border p-4 text-left transition-all",
              mode === "light"
                ? "border-primary bg-white text-slate-900 shadow-lg ring-2 ring-primary/40"
                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-white"
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Sun className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white light:text-slate-900">
                  Light Mode
                </span>
                {mode === "light" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <Check className="h-3 w-3" />
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Crisp, clean high-contrast daytime layout.
              </p>
            </div>
          </button>

          {/* Dark Mode Card */}
          <button
            type="button"
            onClick={() => setMode("dark")}
            className={cn(
              "flex items-center gap-4 rounded-xl border p-4 text-left transition-all",
              mode === "dark"
                ? "border-primary bg-slate-900 text-white shadow-lg ring-2 ring-primary/40"
                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-white"
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
              <Moon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Dark Mode</span>
                {mode === "dark" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <Check className="h-3 w-3" />
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Immersive Cyberpunk Glassmorphism & Neon theme.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Accent Color Theme */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white dark:text-white light:text-slate-900">
            Accent Color Palette
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Pick the primary accent color used for buttons, badges, navigation highlights, and charts.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              id={t.id}
              name={t.name}
              tagline={t.tagline}
              swatch={t.swatch}
              isActive={t.id === theme}
              onPick={() => setTheme(t.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ThemeCard({
  id,
  name,
  tagline,
  swatch,
  isActive,
  onPick,
}: {
  id: ThemeId;
  name: string;
  tagline: string;
  swatch: string;
  isActive: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={isActive}
      aria-label={`Use ${name} theme`}
      className={cn(
        "flex flex-col gap-3 rounded-xl border glass-card p-4 text-left transition-all",
        isActive
          ? "border-primary/60 ring-2 ring-primary/40"
          : "border-slate-800 hover:border-slate-700",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          aria-hidden
          className="h-8 w-8 shrink-0 rounded-full"
          style={{
            background: swatch,
            boxShadow: "inset 0 0 0 1px oklch(1 0 0 / 0.15)",
          }}
        />
        {isActive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <Check className="h-3 w-3" />
            Active
          </span>
        )}
      </div>
      <div>
        <div className="text-sm font-semibold text-white dark:text-white light:text-slate-900">{name}</div>
        <div className="mt-1 text-xs leading-relaxed text-slate-400">
          {tagline}
        </div>
      </div>
      <div
        className="mt-1 flex h-2 overflow-hidden rounded-full"
        aria-hidden
      >
        <span className="flex-1" style={{ background: swatch }} />
        <span className="w-3 bg-slate-700" />
        <span className="w-3 bg-slate-800" />
        <span className="w-3 bg-slate-900" />
      </div>
      <span className="sr-only">Theme id: {id}</span>
    </button>
  );
}
