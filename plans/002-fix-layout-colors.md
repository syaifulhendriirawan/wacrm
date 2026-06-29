# Plan 002: Fix Hardcoded Layout Background and Text Colors via Dynamic CSS Variables

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e1175db..HEAD -- src/app/globals.css`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-*.md
- **Category**: style | bug
- **Planned at**: commit `bf822a7`, 2026-06-29

## Why this matters

The dashboard shell, sidebar, header, and page containers use hardcoded Tailwind classes like `bg-slate-950`, `bg-slate-900`, `border-slate-800`, and `text-white`. In Light Mode, these hardcoded classes remain dark, preventing the page backgrounds and borders from transitioning to light colors.

Instead of refactoring hundreds of files to remove these classes, we can dynamically override Tailwind v4's `slate` and `white` colors in [src/app/globals.css](file:///c:/wacrm/src/app/globals.css) by mapping them to CSS variables that invert in Light Mode.

## Current State

- **Relevant Files**:
  - [src/app/globals.css](file:///c:/wacrm/src/app/globals.css) — Custom Tailwind CSS v4 variables.

## Commands you will need

| Purpose   | Command         | Expected on success |
|-----------|-----------------|---------------------|
| Run Dev   | `npm run dev`   | Runs dev server     |
| Typecheck | `npm run typecheck` | exit 0, no errors |
| Test      | `npm run test`  | all tests pass      |
| Build     | `npm run build` | exit 0, build success |

## Scope

**In scope**:
- `src/app/globals.css`

**Out of scope**:
- Direct modifications to `dashboard-shell.tsx`, `sidebar.tsx`, `header.tsx`, or any other component file.

---

## Steps

### Step 1: Git Branch checkout
1. Make sure you are on the `rebrand-waflow` branch:
   ```bash
   git checkout rebrand-waflow
   ```

---

### Step 2: Map Slate and White variables in Tailwind v4 Theme
Update `@theme inline` in `src/app/globals.css` to map the `slate` palette and `white` to custom CSS variables.

Replace lines `7-49` (the `@theme inline` block) with:
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);

  /* Map standard slate and white colors to dynamic CSS variables */
  --color-slate-50: var(--slate-50);
  --color-slate-100: var(--slate-100);
  --color-slate-200: var(--slate-200);
  --color-slate-300: var(--slate-300);
  --color-slate-400: var(--slate-400);
  --color-slate-500: var(--slate-500);
  --color-slate-600: var(--slate-600);
  --color-slate-700: var(--slate-700);
  --color-slate-800: var(--slate-800);
  --color-slate-900: var(--slate-900);
  --color-slate-950: var(--slate-950);
  --color-white: var(--white);
}
```

---

### Step 3: Define Variable Colors for Light and Dark Modes
Update the color variable definitions in `src/app/globals.css`.

1. Add the slate variables to `:root` (Light Mode) section inside `src/app/globals.css`:
   ```css
     --slate-50: oklch(0.13 0.01 200);
     --slate-100: oklch(0.18 0.01 200);
     --slate-200: oklch(0.25 0.01 200);
     --slate-300: oklch(0.35 0.01 200);
     --slate-400: oklch(0.50 0.015 200);
     --slate-500: oklch(0.55 0.01 200);
     --slate-600: oklch(0.65 0.01 200);
     --slate-700: oklch(0.85 0.01 200);
     --slate-800: oklch(0.92 0.008 200);
     --slate-900: oklch(1 0 0);
     --slate-950: oklch(0.985 0.003 200);
     --white: oklch(0.18 0.01 200);
   ```

2. Add the slate variables to `html.dark` (Dark Mode) section inside `src/app/globals.css`:
   ```css
     --slate-50: oklch(0.985 0 0);
     --slate-100: oklch(0.92 0.008 200);
     --slate-200: oklch(0.85 0.01 200);
     --slate-300: oklch(0.65 0.01 200);
     --slate-400: oklch(0.55 0.01 200);
     --slate-500: oklch(0.45 0.01 200);
     --slate-600: oklch(0.35 0.01 200);
     --slate-700: oklch(0.285 0.01 200);
     --slate-800: oklch(0.225 0.01 200);
     --slate-900: oklch(0.185 0.01 200);
     --slate-950: oklch(0.135 0.01 200);
     --white: #ffffff;
   ```

**Verify**:
- In dev mode, click "Light Mode". The entire dashboard, including sidebar, header, and cards, should immediately turn to a clean, soft cream/slate theme.
- Click "Dark Mode". The entire dashboard should return to the dark OLED theme.

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
- [ ] No files outside `src/app/globals.css` are modified
- [ ] Layout background turns light when theme is set to light
- [ ] Text inside header and sidebar inverts colors correctly in light mode
- [ ] Status updated in `plans/README.md`
