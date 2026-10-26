# Agent instructions

## Project layout

- This is an npm workspace monorepo: `apps/web` is the React/Vite app, `packages/engine` contains canvas geometry/routing/state logic, and `packages/shared` contains shared types.
- The web app imports workspace packages through the `@diagrammer/engine` and `@diagrammer/shared` aliases defined in both `tsconfig.base.json` and `apps/web/vite.config.ts`; preserve those package boundaries.
- The browser entrypoint is `apps/web/src/main.tsx`; the main interactive canvas is `apps/web/src/components/canvas/InfiniteCanvas.tsx`, with Zustand state in `apps/web/src/stores/useCanvasStore.ts`.

## Commands

- Install dependencies with `npm install` from the repository root; use the checked-in `package-lock.json` and do not add another package manager lockfile.
- Run the app with `npm run dev`; Vite serves on port `5173` and is configured with `host: true` and polling file watching.
- Run all tests with `npm test` (`node --test`); the tests load TypeScript engine sources through `jiti` and include `packages/engine/test/*.mjs`.
- Run the production check with `npm run build`; it runs the web TypeScript check followed by `vite build`.
- For a focused engine test, run `node --test packages/engine/test/<file>.mjs` from the repository root.

## Implementation constraints

- Keep canvas behavior changes covered in `packages/engine/test/engine.test.mjs` or an appropriate neighboring test; connector routing and obstacle avoidance have extensive behavioral invariants.
- The engine's `SpatialIndex` is the shared path for canvas hit testing and marquee queries; update it consistently when changing object loading or mutation behavior.
- Board persistence is offline-first: `apps/web/src/services/storage.ts` uses IndexedDB with localStorage fallback, while `apps/web/src/services/api.ts` attempts the API and falls back locally. Do not remove the fallback when changing persistence.
- `DocumentStore` commands provide undo/redo; user-visible mutations should go through the existing command classes rather than bypassing history.
- `apps/web/src/components/canvas/InfiniteCanvas.tsx` performs high-frequency pointer and wheel work; avoid introducing per-event deep clones, full-board scans, or unnecessary React state updates.

## Verification

- After engine or interaction changes, run `npm test`; after web/build changes, run `npm run build` as well.
- Do not treat a successful TypeScript check alone as a successful build: `npm run build` must complete through Vite.
