# Vue3 Frontend Migration Design

## Goal

Convert the current React/Next page layer into a Vue 3 + TypeScript frontend while keeping the existing backend style and PPT generation logic intact.

## Current State

The project is a Next.js application with:

- React UI in `src/app/page.tsx` and `src/components/*.tsx`.
- Next API routes in `src/app/api/**`.
- PPT domain logic in `src/lib/ppt/**`.
- Vitest tests for PPT domain behavior and React components.

The backend API surface already works as a clean boundary for a standalone frontend:

- `GET /api/templates`
- `POST /api/ppt/jobs`
- `GET /api/ppt/jobs/:jobId/events`
- `GET /api/ppt/jobs/:jobId/download`

## Architecture

Use a split frontend/backend setup inside the same repository:

- Keep Next.js as the API backend.
- Add a Vue 3 + Vite + TypeScript frontend under `src/frontend`.
- Run the Vue app separately in development.
- Use Vite proxy rules so frontend requests to `/api` reach the Next backend.

This keeps backend code close to its current form and avoids forcing Vue into Next's React-oriented app layer.

## Frontend Components

Migrate the current React components to Vue single-file components:

- `PptWorkspace.tsx` becomes `src/frontend/components/PptWorkspace.vue`.
- `TemplatePicker.tsx` becomes `src/frontend/components/TemplatePicker.vue`.
- `SlidePreview.tsx` becomes `src/frontend/components/SlidePreview.vue`.
- `GenerationTimeline.tsx` becomes `src/frontend/components/GenerationTimeline.vue`.

The Vue workspace keeps the current behavior:

- Load templates on mount.
- Select the first template by default.
- Create PPT jobs through `POST /api/ppt/jobs`.
- Subscribe to progress with `EventSource`.
- Retry transient SSE connection errors.
- Render active slide preview and thumbnails.
- Show download link after completion.

## Shared Types

Create frontend-safe TypeScript types under `src/frontend/types/ppt.ts`.

The type definitions mirror the API payloads and rendered slide structures. The Vue frontend should not import from backend modules because those modules may include Node or Next dependencies over time.

## Styles

Move the existing global workspace styles into the Vue frontend entry stylesheet. Keep the existing visual structure, spacing, and palette unless a Vue-specific issue requires adjustment.

## Scripts

Update project scripts to support both apps:

- `dev:api`: run the Next backend.
- `dev:web`: run the Vue/Vite frontend.
- `dev`: run both together.
- `build:api`: build the Next backend.
- `build:web`: build the Vue frontend.
- `test`: run Vitest.

The backend can stay available on port `3000`; the Vue frontend can run on port `5173`.

## Testing

Use Vitest with Vue Test Utils for frontend behavior. Cover the riskiest migrated behavior:

- Template picker renders options and emits selection.
- Generation timeline computes pending, active, done, and failed states.
- Slide preview renders title, subtitle, bullets, accents, and active generation cue.

Keep existing backend/domain tests. React component tests should be removed or replaced once the React components are removed.

## Non-Goals

- Do not rewrite PPT generation, rendering, job storage, or export behavior.
- Do not replace Next API routes with Express or another backend framework.
- Do not redesign the product UI beyond migration fixes.
- Do not add authentication, persistence, or deployment changes.

## Verification

Before completion:

- Run frontend and backend tests.
- Run lint if the configured lint stack supports the new Vue files.
- Run Vue build.
- Run Next backend build if feasible.
- Start the development servers and report the local frontend URL.
