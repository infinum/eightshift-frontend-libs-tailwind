# Code Review & Optimization Plan

**Project:** `@eightshift/frontend-libs-tailwind` v3.1.2
**Scope:** Full library review (≈4,600 LOC across `scripts/`, `webpack/`, `linters/`)
**Confidence column:** subjective confidence the issue is real and actionable.

---

## Critical — Fix First (Blockers / Real Bugs)

| #   | Location                                              | Issue                                                                                                                                                   | Confidence |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| C1  | `scripts/components/picker-placeholder.js:6`          | Self-referential package import (`@eightshift/frontend-libs-tailwind/scripts`) — creates circular dep, breaks bundling, fails if package not symlinked. | 99         |
| C2  | `scripts/editor/colors.js:20`                         | `getPaletteColors = usePaletteColors` — a React hook exposed under a non-hook name. Calls outside components throw "Invalid hook call".                 | 97         |
| C3  | `scripts/editor/fetch.js:~174`                        | `buildWpRestUrl` returned closure mutates captured `params` object — second call accumulates state.                                                     | 95         |
| C4  | `scripts/editor/registration.js:~440`                 | Pixel-merge logic reads `receiver[attribute]` where it should read `merger[attribute]`. Wrong value silently used.                                      | 85         |
| C5  | `scripts/helpers/cookies.js:58`                       | `getCookie` builds regex from unescaped key — breaks / mismatches for keys containing regex metachars (`.`, `+`, etc.).                                 | 92         |
| C6  | `scripts/components/settings/use-theme-options.js:12` | `JSON.parse(settings?.[settingName])` throws `SyntaxError` on first load when the option doesn't exist yet. No `try/catch`.                             | 97         |
| C7  | `package.json`                                        | No `engines` field while code uses `Array.prototype.toSorted()` / `toReversed()` (Node 20+). Silent breakage on Node 18.                                | 99         |

---

## High Priority

| #   | Location                                            | Issue                                                                                                                                                                                | Confidence |
| --- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| H1  | `scripts/editor/editor.js:113-118`                  | `GutenbergBlock` default `*PortalElement` runs `document.querySelector(...)` on every render in default-parameter scope; also renders InspectorControls/BlockControls duplicated 4×. | 88         |
| H2  | `webpack/base.mjs:33`                               | `process.browser` define is deprecated in Webpack 5.                                                                                                                                 | 99         |
| H3  | `webpack/base.mjs:15-18`                            | `ProvidePlugin` injects jQuery globally **by default** in a Tailwind-first library. Should be opt-in.                                                                                | 88         |
| H4  | `webpack/production.mjs:43`                         | Hardcoded `browserslist('>= 0.25%')` ignores consumer's `package.json#browserslist` / `.browserslistrc`.                                                                             | 95         |
| H5  | `webpack/base.mjs:29-32`                            | `process.env.VERSION` uses `Math.random()` — defeats version-based cache invalidation. Use `package.json` version or git SHA.                                                        | 97         |
| H6  | `scripts/plugins/yoast-seo.js:91`                   | `addAction('editor.savePost', ..., onSaveCallback)` — actions ignore return values; the `return edits` is misleading dead code. Likely intended `addFilter`.                         | 95         |
| H7  | `scripts/plugins/yoast-seo.js:13`                   | `options?.filterPriority \|\| 20` — falls through on valid `0` priority. Use `??`.                                                                                                   | 99         |
| H8  | `scripts/plugins/yoast-seo.js:27-28, 71`            | Mutable closure state + fire-and-forget async in `onSaveCallback` — refresh may use stale state.                                                                                     | 85         |
| H9  | `scripts/components/picker-placeholder.js:71`       | `presets.map(...)` with no fallback when neither prop nor manifest provides presets — throws.                                                                                        | 95         |
| H10 | `scripts/components/picker-placeholder.js:75`       | `async onPress` with no double-click guard and no `try/catch` — unhandled promise rejection on failure.                                                                              | 90         |
| H11 | `scripts/components/link-section-editor.js:264,280` | Array index used as React `key` — reorder/delete causes remount, lost editor state.                                                                                                  | 95         |
| H12 | `scripts/components/link-section-editor.js`         | Multiple `setTimeout(..., 20-25)` race conditions for focus handling. Replace with `requestAnimationFrame` / `flushSync`.                                                            | 80         |
| H13 | `scripts/components/settings/use-theme-options.js`  | No `isLoading` state for initial fetch; no unmount guard around `setSettings` (potential warning + race).                                                                            | 90         |
| H14 | `package.json`                                      | `@wordpress/api-fetch` is in `devDependencies` but imported at runtime — must be a `peerDependency`.                                                                                 | 99         |
| H15 | `package.json`                                      | `@swc/core` (~30 MB native binary) shipped as a runtime `dependency`. Should be peer or dev.                                                                                         | 90         |

---

## Medium Priority

| #   | Location                                                                       | Issue                                                                                                                                           |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| M1  | `scripts/editor/options.js:141`                                                | `getOptions` uses unanchored `String.replace` for prefix stripping — strips mid-key matches. Use `startsWith` + `slice` or `^`-anchored regex.  |
| M2  | `scripts/helpers/breakpoints.js:6-10`                                          | `.toSorted(desc).map(...).toReversed()` — two array ops; just sort ascending.                                                                   |
| M3  | `scripts/editor/tailwindcss.js`                                                | `getTwPart` / `getTwDynamicPart` / `getTwClasses` are deprecated but still carry ~150 lines of parallel logic. Delegate to `tailwindClasses()`. |
| M4  | `scripts/editor/tailwindcss.js:~105`                                           | `.split(' ')` instead of `.split(/\s+/).filter(Boolean)` — collapses on multi-space inputs. `unifyClasses()` exists but isn't used uniformly.   |
| M5  | `scripts/editor/store.js:64`                                                   | Deep selectors don't use optional chaining — throws if store partially initialized.                                                             |
| M6  | `scripts/editor/attributes.js:~43`                                             | `overrideInnerBlockAttributes` mutates its argument. Return a new object instead.                                                               |
| M7  | `scripts/editor/utility.js:49`                                                 | `getUnique()` yields ~6 base36 chars (~2.2B combos). Use `crypto.randomUUID()`.                                                                 |
| M8  | `linters/stylelint.config.js:108`                                              | `declaration-no-important: true` will conflict with Tailwind v4 `!` important modifier / `@apply ... !important`.                               |
| M9  | `linters/stylelint.config.js` (CJS) vs every other config (`.mjs`)             | Inconsistent module format.                                                                                                                     |
| M10 | `scripts/index.js` + `scripts/components/index.js` + `scripts/editor/index.js` | Overlapping barrels — every symbol has two valid import paths. Pick parent or sub-barrel, not both.                                             |
| M11 | `package.json`                                                                 | No `files` field — published tarball may include `linters/`, dotfiles, etc. Add explicit allowlist.                                             |
| M12 | `package.json`                                                                 | `"prepare": "husky"` fails in CI / production installs. Use `"husky                                                                             |     | true"`. |
| M13 | `scripts/editor/registration.js`                                               | Multiple `.map()` calls used for side effects; deep nesting in deprecation handling.                                                            |
| M14 | `scripts/editor/registration.js:684`                                           | `blockTopLevelId` from 6 base36 chars — collision risk.                                                                                         |
| M15 | `scripts/editor/fetch.js:103`                                                  | Singular `additionalParam` typo in option name → silently ignored.                                                                              |

---

## Low Priority / Housekeeping

| #   | Location                            | Issue                                                                                        |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| L1  | `scripts/editor/editor.js:27`       | Lock name prefix `undefined-lock-` reads like a bug. Rename to `es-lock-`.                   |
| L2  | `scripts/helpers/cookies.js`        | `setHalfDay()` etc. are methods that just return constants. Make them static fields.         |
| L3  | `scripts/editor/colors.js:23`       | Redundant `?.` after `Object.entries(...)`.                                                  |
| L4  | `scripts/editor/hooks.js`           | `blockClientId` set on both `attributes` and `block.attributes` — verify if both are needed. |
| L5  | `scripts/helpers/dynamic-import.js` | `paths.keys().forEach(paths)` is opaque; add inline comment or rename.                       |
| L6  | Various                             | Add `try/catch` around `apiFetch` calls; surface errors via `sonner` toast.                  |
| L7  | Project root                        | No tests, no `engines`, no `.editorconfig`. Either add tests or drop the unused `jest` deps. |
| L8  | Project root                        | No TypeScript declarations — add `.d.ts` files for DX, even without full TS migration.       |

---

## Implementation Plan

Each phase ships as its own PR. Phases are ordered so consumers see fixes ASAP without coupling unrelated changes.

### Phase 1 — Hotfix Release (v3.1.3, patch)

**Goal:** Ship the seven critical bugs. No API changes, no behavior changes consumers need to adapt to.

- [ ] **C1** Replace `from '@eightshift/frontend-libs-tailwind/scripts'` with relative import in `picker-placeholder.js`.
- [ ] **C2** Split `colors.js`:
  - Keep `usePaletteColors` (hook, uses `useSelect`).
  - Add `getPaletteColors` as a real function using `select(STORE_NAME).getSettings()?.globalVariables?.colors`.
- [ ] **C3** Fix `buildWpRestUrl` closure — clone `params` per call.
- [ ] **C4** Audit pixel-merge in `registration.js`; correct `receiver`/`merger` reference.
- [ ] **C5** Regex-escape `key` in `cookies.getCookie`.
- [ ] **C6** Wrap `JSON.parse` in `use-theme-options.js` with try/catch and default-to-empty.
- [ ] **C7** Add `"engines": { "node": ">=20" }` to `package.json`.
- [ ] Verify: lint, smoke-test in one consumer theme (load editor, open settings page, open a block with `PickerPlaceholder`).

**Ship as:** patch (3.1.3). Changelog under _Fixed_.

---

### Phase 2 — High-Impact Improvements (v3.2.0, minor)

**Goal:** Behavior changes that improve correctness and DX. Communicated in the changelog under _Changed_.

- [ ] **H1** Refactor `GutenbergBlock`:
  - Compute portal elements once via `useMemo` (or accept refs).
  - Extract `renderWithPortal(children, portal)` helper to collapse the 4× duplication.
- [ ] **H2** Remove deprecated `process.browser` define.
- [ ] **H3** Move jQuery `ProvidePlugin` behind an explicit opt-in flag (`options.overrides.includes('provideJquery')` inverted to enable).
- [ ] **H4** Read browserslist from consumer config; allow override via `options.config.browserslist`.
- [ ] **H5** Replace random `process.env.VERSION` with `package.json#version` or `git rev-parse --short HEAD`.
- [ ] **H6** Replace `addAction('editor.savePost', ...)` with the correct hook (likely `subscribe` on `core/editor` or `addFilter`); drop the dead `return edits`.
- [ ] **H7** Switch all `||` defaults that gate numeric/boolean options to `??`.
- [ ] **H8** Restructure `yoast-seo.js` to keep state in a module-scoped object guarded against double registration.
- [ ] **H9** Default `presets ?? []` in `PickerPlaceholder`.
- [ ] **H10** `PickerPlaceholder`: `useState` for `isInserting`, disable button while pending, `try/catch` around dispatch.
- [ ] **H11** `LinkSectionEditor`: replace index keys with stable IDs (generate on add via `crypto.randomUUID()`).
- [ ] **H12** Replace `setTimeout`-based focus orchestration with `requestAnimationFrame` or `flushSync` + immediate focus.
- [ ] **H13** `useThemeOptions`: add `isInitializing`, abort fetch on unmount.
- [ ] **H14, H15** Move `@wordpress/api-fetch` → `peerDependencies`; move `@swc/core` → `peerDependencies` (or document the size impact).

**Ship as:** minor (3.2.0). Document any breaking surface in a _Migration_ section if `H3` flips the jQuery default — otherwise minor is fine.

---

### Phase 3 — Code Quality Sweep (v3.3.0, minor)

**Goal:** Internal cleanup. Tree-shaking, consistency, deprecation removal.

- [ ] **M1** Anchor prefix replacement in `getOptions`.
- [ ] **M2** Simplify `getBreakpointNames` to a single sort.
- [ ] **M3** Make deprecated `getTwPart`/`getTwDynamicPart`/`getTwClasses` thin wrappers around `tailwindClasses()`.
- [ ] **M4** Apply `unifyClasses()` everywhere splitting/joining classes; use `\s+` regex consistently.
- [ ] **M5** Optional chaining throughout store selectors.
- [ ] **M6** Make `overrideInnerBlockAttributes` pure.
- [ ] **M7** Replace `getUnique` internals with `crypto.randomUUID()` (keep API stable).
- [ ] **M8** Disable `declaration-no-important` in stylelint config (or scope to non-Tailwind layers).
- [ ] **M9** Convert `stylelint.config.js` → `.mjs`.
- [ ] **M10** Pick one barrel pattern; remove the other.
- [ ] **M11** Add explicit `files` field to `package.json`.
- [ ] **M12** `"prepare": "husky || true"`.
- [ ] **M13** Replace side-effect `.map` with `.forEach`; flatten deprecation branch.
- [ ] **M14** Wider entropy for `blockTopLevelId`.
- [ ] **M15** Fix `additionalParam` → `additionalParams` typo (with backwards-compatible alias for one release).

---

### Phase 4 — Stretch / Future

**Goal:** Strategic improvements; not required for correctness.

- [ ] **L7/L8** Add TypeScript declarations (start with `.d.ts` files, keep JSDoc as source of truth).
- [ ] Replace `jest` dev deps with actual tests or remove them. Prioritize tests for: `attributes.js`, `tailwindcss.js`, `registration.js#prepareComponentAttributes`.
- [ ] Add `.editorconfig` and ensure `.prettierrc` is present.
- [ ] Document the public API surface in `README.md` (currently sparse).
- [ ] Investigate replacing `cookies` helper with the standard `Cookie Store API` where supported.
- [ ] Consider exporting subpath entry points (`@eightshift/frontend-libs-tailwind/components`, `/editor`, `/webpack`) instead of one giant barrel — better tree-shaking for consumers.

---

## Acceptance / Verification Checklist (per phase)

1. `bun run lint` clean.
2. Manual smoke test in a consumer theme:
   - Editor loads, blocks register.
   - `PickerPlaceholder`, `LinkSectionEditor`, `MediaPicker`, `FileSelector` render and respond.
   - Theme options page loads on a fresh install (no pre-existing setting).
   - Yoast integration refreshes content on save (if Yoast active).
3. Production webpack build succeeds with cache enabled.
4. Bundle size diff reported in PR (use `webpack-bundle-analyzer` once).
5. Changelog entry following Keep a Changelog format.
6. Semver bump applied via `my-version-bump`.

---

## Out of Scope (intentionally not addressed)

- Full TypeScript migration.
- Replacing Webpack with Vite / Rspack.
- Replacing Redux-style store with Jotai/Zustand.
- Rewriting `tailwindcss.js` class-generation pipeline from scratch.

These are valid follow-ups but each is its own project, not a review fix.
