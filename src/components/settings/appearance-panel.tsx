"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

/**
 * Appearance panel — toggles between Light and Dark mode.
 */
export function AppearancePanel() {
  const { mode, setMode } = useTheme();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Theme mode</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Toggle between light and dark visual aesthetics for Waflow. Saved to this device.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setMode("light")}
          aria-pressed={mode === "light"}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-6 text-center transition-all",
            mode === "light"
              ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Sun className="h-6 w-6" />
          <span className="text-sm font-semibold">Light Mode</span>
        </button>

        <button
          type="button"
          onClick={() => setMode("dark")}
          aria-pressed={mode === "dark"}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border bg-card p-6 text-center transition-all",
            mode === "dark"
              ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Moon className="h-6 w-6" />
          <span className="text-sm font-semibold">Dark Mode</span>
        </button>
      </div>
    </section>
  );
}
