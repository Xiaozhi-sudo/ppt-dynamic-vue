# Vue3 Frontend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the React/Next page frontend with a Vue 3 + TypeScript frontend while keeping the existing Next API backend and PPT generation modules.

**Architecture:** Keep Next.js API routes and `src/lib/ppt/**` as the backend. Add a Vite-powered Vue app in `src/frontend` that talks to the existing `/api` routes through Vite's dev proxy. Duplicate only frontend-safe DTO types and step metadata needed by the client.

**Tech Stack:** Vue 3, Vite, TypeScript, Vitest, Vue Test Utils, existing Next.js backend, existing PPT domain modules.

---

## File Structure

- Create `index.html`: Vite HTML entry.
- Create `vite.config.ts`: Vue plugin, test environment, and `/api` proxy to Next.
- Create `src/frontend/main.ts`: Vue app bootstrap.
- Create `src/frontend/App.vue`: root app shell.
- Create `src/frontend/styles.css`: migrated workspace styles.
- Create `src/frontend/types/ppt.ts`: frontend-safe API and slide types.
- Create `src/frontend/data/pptSteps.ts`: frontend copy of timeline step metadata.
- Create `src/frontend/components/PptWorkspace.vue`: main Vue workspace and API/SSE state.
- Create `src/frontend/components/TemplatePicker.vue`: template selector.
- Create `src/frontend/components/SlidePreview.vue`: slide renderer.
- Create `src/frontend/components/GenerationTimeline.vue`: progress timeline.
- Create `src/frontend/components/*.test.ts`: Vue component tests replacing React component coverage.
- Modify `package.json`: add Vue/Vite dependencies and scripts.
- Modify `tsconfig.json`: include Vue files and Vite types.
- Modify `eslint.config.mjs`: ignore Vue frontend for the existing Next ESLint preset unless Vue linting is later added.
- Remove React UI files once replacement tests pass: `src/app/page.tsx`, `src/components/*.tsx`, React component tests.

## Tasks

### Task 1: Add Vue Build Harness

- [ ] Write `index.html`, `src/frontend/main.ts`, and `src/frontend/App.vue`.
- [ ] Add `vite.config.ts` with `@vitejs/plugin-vue`, jsdom tests, `@` alias, and proxy from `/api` to `http://127.0.0.1:3000`.
- [ ] Update `package.json` scripts for `dev:api`, `dev:web`, `build:api`, `build:web`, and `dev`.
- [ ] Update `tsconfig.json` to include `.vue` files.
- [ ] Add `src/frontend/vite-env.d.ts` so TypeScript understands `.vue` imports.

### Task 2: Add Frontend Types and Step Data

- [ ] Create `src/frontend/types/ppt.ts` with API payload types copied from the current client contract.
- [ ] Create `src/frontend/data/pptSteps.ts` with the existing timeline labels and messages.
- [ ] Keep these files free of Next and Node imports.

### Task 3: Test and Build Template Picker

- [ ] Add `src/frontend/components/TemplatePicker.test.ts`.
- [ ] Verify the test fails before `TemplatePicker.vue` exists.
- [ ] Implement `TemplatePicker.vue` with `templates`, `selectedTemplateId`, and `select` event.
- [ ] Verify the test passes.

### Task 4: Test and Build Generation Timeline

- [ ] Add `src/frontend/components/GenerationTimeline.test.ts`.
- [ ] Verify the test fails before `GenerationTimeline.vue` exists.
- [ ] Implement `GenerationTimeline.vue` with the same step state rules as the React version.
- [ ] Verify the test passes.

### Task 5: Test and Build Slide Preview

- [ ] Add `src/frontend/components/SlidePreview.test.ts`.
- [ ] Verify the test fails before `SlidePreview.vue` exists.
- [ ] Implement `SlidePreview.vue` with region styles, accent rendering, placeholders, thumbnails, and generation cue text.
- [ ] Verify the test passes.

### Task 6: Build Workspace

- [ ] Implement `PptWorkspace.vue` using Vue refs/computed/onMounted/onBeforeUnmount.
- [ ] Preserve template loading, job creation, SSE retry, terminal status handling, active slide selection, errors, and download link behavior.
- [ ] Import migrated styles through `main.ts`.

### Task 7: Remove React Frontend Surface

- [ ] Remove obsolete React components and React component tests.
- [ ] Replace `src/app/page.tsx` with a minimal backend status page or remove React UI dependency from active scripts.
- [ ] Keep `src/app/api/**` and `src/lib/ppt/**` unchanged except for test compatibility if required.

### Task 8: Verify

- [ ] Run targeted Vue component tests.
- [ ] Run the full Vitest suite.
- [ ] Run `npm run build:web`.
- [ ] Run `npm run build:api` if dependencies and Next config allow it.
- [ ] Start the backend and frontend dev servers and report the Vue URL.

## Constraints

This project directory is not a git repository, so commit steps are intentionally omitted. Verification commands are the checkpoint mechanism for this migration.
