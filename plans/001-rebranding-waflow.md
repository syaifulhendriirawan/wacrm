# Plan 001: Rebrand Product to Waflow and Implement Light & Dark Mode with Theme Toggle (Single Theme)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1175db..HEAD -- src/app/globals.css src/app/layout.tsx src/hooks/use-theme.tsx src/components/settings/appearance-panel.tsx package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: migration | direction | style
- **Planned at**: commit `e1175db`, 2026-06-29

## Why this matters

The goal is to rebrand the product from **wacrm** to **waflow**. This migration involves:
1. Renaming user-facing and metadata references in the codebase.
2. Migrating the single-theme (dark-only) architecture to support both Light and Dark Modes under a single brand-aware soft emerald/teal theme.
3. Simplifying the theme configuration by removing the multi-accent theme picker (Violet, Cobalt, Amber, Rose, etc.) and replacing it with a simple Light/Dark theme mode selector.

All existing CSS variable bindings (e.g. `--background`, `--foreground`, etc.) must remain unchanged to ensure backward compatibility and prevent breaking layout elements.

## Current State

- **Relevant Files**:
  - [package.json](file:///c:/wacrm/package.json) — Defines app name.
  - [src/app/layout.tsx](file:///c:/wacrm/src/app/layout.tsx) — Main layout, title metadata, and inline theme boot script.
  - [src/lib/themes.ts](file:///c:/wacrm/src/lib/themes.ts) — Theme ID constants (DELETE: we will replace this with a single theme and remove picker cards).
  - [src/hooks/use-theme.tsx](file:///c:/wacrm/src/hooks/use-theme.tsx) — ThemeProvider React Context (currently accent-based).
  - [src/app/globals.css](file:///c:/wacrm/src/app/globals.css) — Custom Tailwind CSS v4 variables (all themes hard-coded to dark/OLED values).
  - [src/components/settings/appearance-panel.tsx](file:///c:/wacrm/src/components/settings/appearance-panel.tsx) — Accent theme picker.

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Run Dev   | `npm run dev`   | Runs dev server     |
| Typecheck | `npm run typecheck` | exit 0, no errors |
| Test      | `npm run test`  | all tests pass      |
| Build     | `npm run build` | exit 0, build success |

> [!NOTE]
> If typecheck fails with errors inside the `.next/` directory (e.g., validator schema import errors), delete the `.next` directory (`rm -r .next`) and re-run the build/typecheck command to regenerate clean type definitions.

## Scope

**In scope**:
- `package.json`
- `src/app/layout.tsx`
- `src/lib/themes.ts` (delete)
- `src/hooks/use-theme.tsx`
- `src/app/globals.css`
- `src/components/settings/appearance-panel.tsx`
- User-facing references to "wacrm" in labels (e.g., `invite-member-dialog.tsx`, `whatsapp-config.tsx`, `template-manager.tsx`, etc.)

**Out of scope**:
- Modifying underlying database schema names (Supabase tables/triggers remain unchanged).
- Mutating meta API core webhook endpoints.

## Git Workflow

- **Branch**: `rebrand-waflow`
- **Commit style**: `feat(rebrand): <message>` or `style(theme): <message>`

---

## Steps

### Step 1: Git Branch Creation & Rebranding Renames
1. Create and checkout a new branch:
   ```bash
   git checkout -b rebrand-waflow
   ```
2. Update the name in `package.json`:
   - Change `"name": "wacrm"` to `"name": "waflow"`
3. Update metadata in `src/app/layout.tsx` (`L14-32`):
   - Title default: `"waflow"`
   - Title template: `"%s — waflow"`
   - Description: `"Self-hostable CRM template for WhatsApp."`
4. Globally rename other instances of `"wacrm"` to `"waflow"` in user-facing texts:
   - [src/components/settings/invite-member-dialog.tsx](file:///c:/wacrm/src/components/settings/invite-member-dialog.tsx) (`L143`, `L170-173`)
   - [src/components/settings/template-manager.tsx](file:///c:/wacrm/src/components/settings/template-manager.tsx) (`L1038-1039`)
   - [src/components/settings/whatsapp-config.tsx](file:///c:/wacrm/src/components/settings/whatsapp-config.tsx) (`L446`, `L630`)
   - Update `STORAGE_KEY` in `src/components/flows/flow-editor-shell.tsx` (`L40`) to `"waflow.flowEditor.view"`
5. **Delete** [src/lib/themes.ts](file:///c:/wacrm/src/lib/themes.ts) entirely:
   ```bash
   rm src/lib/themes.ts
   ```

**Verify**:
- File `src/lib/themes.ts` is deleted.

---

### Step 2: Implement Light/Dark Mode Logic in Theme Hook
Replace `src/hooks/use-theme.tsx` entirely with a simplified Light/Dark Mode hook that doesn't reference multiple accent colors:
```typescript
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Mode = "light" | "dark";

interface ThemeContextValue {
  mode: Mode;
  setMode: (next: Mode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "waflow.mode";

function readInitialMode(): Mode {
  if (typeof window === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(readInitialMode);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    if (typeof document !== "undefined") {
      if (next === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.style.colorScheme = "dark";
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.style.colorScheme = "light";
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);



  // Sync across tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark") && e.newValue !== mode) {
        const next = e.newValue as Mode;
        setModeState(next);
        if (next === "dark") {
          document.documentElement.classList.add("dark");
          document.documentElement.style.colorScheme = "dark";
        } else {
          document.documentElement.classList.remove("dark");
          document.documentElement.style.colorScheme = "light";
        }
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: "dark",
      setMode: () => {},
    };
  }
  return ctx;
}
```

---

### Step 3: Update Main Layout
Modify `src/app/layout.tsx`:
1. Remove the import from `@/lib/themes` (line 7).
2. Simplify the `THEME_BOOT_SCRIPT` string to only run the mode checking:
   ```javascript
   const THEME_BOOT_SCRIPT = `
   (function(){
     try {
       var savedMode = localStorage.getItem("waflow.mode");
       var isDark = savedMode === "dark" || (!savedMode && window.matchMedia("(prefers-color-scheme: dark)").matches);
       if (isDark) {
         document.documentElement.classList.add("dark");
         document.documentElement.style.colorScheme = "dark";
       } else {
         document.documentElement.classList.remove("dark");
         document.documentElement.style.colorScheme = "light";
       }
     } catch (_e) {
       document.documentElement.classList.add("dark");
       document.documentElement.style.colorScheme = "dark";
     }
   })();
   `;
   ```
3. Remove the `data-theme` attribute from the `<html>` tag (lines `69-80`):
   ```tsx
   <html
     lang="en"
     className={`${inter.variable} h-full antialiased`}
     suppressHydrationWarning
   >
   ```

---

### Step 4: Configure Theme Colors (Light & Dark Mode) in CSS
Replace variables in `src/app/globals.css`. We will configure a single soft emerald theme. Overwrite lines `72-258` in `src/app/globals.css` with the following:

```css
/* ============================================================
 * LIGHT MODE (Default theme - soft, minimalist, modern)
 * ============================================================ */
:root {
  --background: oklch(0.985 0.003 200);
  --foreground: oklch(0.18 0.01 200);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.18 0.01 200);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.18 0.01 200);
  --primary: oklch(0.48 0.14 162);
  --primary-foreground: oklch(0.99 0.002 162);
  --primary-hover: oklch(0.40 0.14 162);
  --primary-soft: oklch(0.48 0.14 162 / 0.08);
  --primary-soft-2: oklch(0.48 0.14 162 / 0.16);
  --secondary: oklch(0.95 0.004 200);
  --secondary-foreground: oklch(0.18 0.01 200);
  --muted: oklch(0.95 0.004 200);
  --muted-foreground: oklch(0.50 0.015 200);
  --accent: oklch(0.95 0.004 200);
  --accent-foreground: oklch(0.18 0.01 200);
  --destructive: oklch(0.60 0.18 20);
  --destructive-foreground: oklch(0.98 0.005 20);
  --border: oklch(0.92 0.008 200);
  --input: oklch(0.92 0.008 200);
  --ring: oklch(0.48 0.14 162);
  --chart-1: oklch(0.48 0.14 162);
  --chart-2: oklch(0.60 0.12 180);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.97 0.004 200);
  --sidebar-foreground: oklch(0.18 0.01 200);
  --sidebar-primary: oklch(0.48 0.14 162);
  --sidebar-primary-foreground: oklch(0.99 0.002 162);
  --sidebar-accent: oklch(0.93 0.008 200);
  --sidebar-accent-foreground: oklch(0.18 0.01 200);
  --sidebar-border: oklch(0.92 0.008 200);
  --sidebar-ring: oklch(0.48 0.14 162);
}

/* ============================================================
 * DARK MODE (OLED theme - rich, high contrast, professional)
 * ============================================================ */
html.dark {
  --background: oklch(0.135 0.01 200);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.185 0.01 200);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.185 0.01 200);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.62 0.16 162);
  --primary-foreground: oklch(0.16 0.02 162);
  --primary-hover: oklch(0.68 0.15 162);
  --primary-soft: oklch(0.62 0.16 162 / 0.12);
  --primary-soft-2: oklch(0.62 0.16 162 / 0.22);
  --secondary: oklch(0.225 0.01 200);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.225 0.01 200);
  --muted-foreground: oklch(0.65 0.01 200);
  --accent: oklch(0.225 0.01 200);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.285 0.01 200);
  --input: oklch(0.285 0.01 200);
  --ring: oklch(0.62 0.16 162);
  --chart-1: oklch(0.62 0.16 162);
  --chart-2: oklch(0.7 0.14 195);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.165 0.01 200);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.62 0.16 162);
  --sidebar-primary-foreground: oklch(0.16 0.02 162);
  --sidebar-accent: oklch(0.225 0.01 200);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.285 0.01 200);
  --sidebar-ring: oklch(0.62 0.16 162);
}
```

---

### Step 5: Implement Theme Toggle UI in Settings
Replace `src/components/settings/appearance-panel.tsx` entirely to remove the accent color cards and show a premium Light Mode vs Dark Mode selector:
```tsx
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
```

---

## Test Plan

- Verify unit tests:
  ```bash
  npm run test
  ```
  All tests must pass.
- Verify production build compiles without errors:
  ```bash
  npm run build
  ```

## Done Criteria

- [ ] `npm run build` succeeds (exit 0)
- [ ] `src/lib/themes.ts` is deleted
- [ ] Switching between modes updates the DOM class list (adds/removes `.dark` on `<html>`) and persists correctly in local storage under `waflow.mode`
- [ ] No visual flashing occurs on page load
- [ ] All instances of "wacrm" renamed to "waflow" in layout metadata and invitation configs
- [ ] Status updated in `plans/README.md`

## STOP Conditions

- The boot script in `src/app/layout.tsx` causes hydration mismatches in React.
- Existing custom hooks throw typescript compile errors after updating context signature.

## Maintenance Notes

- When adding new views/pages, ensure use of semantic colors (`bg-background`, `text-foreground`, `border-border`) instead of Tailwind grey literals (like `bg-slate-900` or `text-slate-200`) so they render perfectly in both modes automatically.
