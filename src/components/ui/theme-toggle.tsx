"use client";

import { useTheme } from "@/hooks/use-theme";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeToggle({ className }: { className?: string }) {
  const { mode, toggleMode } = useTheme();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMode}
              aria-label={mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className={`relative h-9 w-9 border-slate-700/80 bg-slate-900/60 text-slate-200 hover:bg-slate-800 hover:text-white dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-200 light:border-slate-300 light:bg-white light:text-slate-700 light:hover:bg-slate-100 transition-all ${className}`}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 light:rotate-0 light:scale-100 text-amber-500" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 light:rotate-90 light:scale-0 text-violet-400" />
            </Button>
          }
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 light:rotate-0 light:scale-100 text-amber-500" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 light:rotate-90 light:scale-0 text-violet-400" />
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {mode === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ThemeModeSegmented() {
  const { mode, setMode } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-700/60 bg-slate-900/80 p-1 dark:border-slate-700/60 dark:bg-slate-900/80 light:border-slate-300 light:bg-slate-200/80">
      <button
        type="button"
        onClick={() => setMode("light")}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
          mode === "light"
            ? "bg-white text-slate-900 shadow-md"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <Sun className="h-3.5 w-3.5 text-amber-500" />
        Light
      </button>
      <button
        type="button"
        onClick={() => setMode("dark")}
        className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
          mode === "dark"
            ? "bg-slate-800 text-white shadow-md border border-slate-700"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <Moon className="h-3.5 w-3.5 text-violet-400" />
        Dark
      </button>
    </div>
  );
}
