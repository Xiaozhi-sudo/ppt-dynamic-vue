# PPT Generator MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js full-stack MVP where users choose a PPT template, watch text fill into slides through live progress events, preview generated slides, and download a real PPTX.

**Architecture:** A single Next.js App Router project owns UI, API routes, in-memory jobs, server-sent events, deterministic deck generation, template rendering, and PPTX export. Domain logic lives under `src/lib/ppt/*` and is kept independent from React so it can be tested and later wired to a real YiCe AI model adapter.

**Tech Stack:** Next.js, React, TypeScript, CSS Modules/global CSS, `pptxgenjs`, Node test runner or Vitest.

---

## File Structure

- Create `package.json`: npm scripts and dependencies.
- Create `tsconfig.json`: strict TypeScript config.
- Create `next.config.ts`: minimal Next.js config.
- Create `src/app/layout.tsx`: root HTML shell.
- Create `src/app/page.tsx`: main two-column YiCe AI style interface.
- Create `src/app/globals.css`: app layout and slide preview styling.
- Create `src/app/api/templates/route.ts`: returns built-in templates.
- Create `src/app/api/ppt/jobs/route.ts`: creates a generation job.
- Create `src/app/api/ppt/jobs/[jobId]/events/route.ts`: SSE stream for job progress.
- Create `src/app/api/ppt/jobs/[jobId]/download/route.ts`: serves completed PPTX.
- Create `src/lib/ppt/types.ts`: shared types.
- Create `src/lib/ppt/templates.ts`: three built-in templates.
- Create `src/lib/ppt/generator.ts`: deterministic simulated AI deck generator.
- Create `src/lib/ppt/renderer.ts`: combines generated deck and template into rendered slides.
- Create `src/lib/ppt/exporter.ts`: writes a PPTX file with `pptxgenjs`.
- Create `src/lib/ppt/jobs.ts`: in-memory job state and event subscription.
- Create `src/lib/ppt/steps.ts`: generation step constants and user-facing labels.
- Create `src/components/PptWorkspace.tsx`: client-side workflow UI.
- Create `src/components/SlidePreview.tsx`: reusable slide preview component.
- Create `src/components/GenerationTimeline.tsx`: generation step timeline.
- Create `src/components/TemplatePicker.tsx`: template selection UI.
- Create `src/lib/ppt/*.test.ts`: unit tests for generator, renderer, and templates.

---

### Task 1: Scaffold The Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "scripts": {
    "dev": "next dev --host 127.0.0.1 --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "next": "^15.0.0",
    "pptxgenjs": "^3.12.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and dependencies install without errors.

- [ ] **Step 3: Create TypeScript config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Create root layout**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YiCe AI PPT Generator",
  description: "Template-driven PPT generation MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Create initial global CSS**

```css
:root {
  color: #172033;
  background: #f5f7fb;
  font-family: Arial, "Microsoft YaHei", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
textarea,
select {
  font: inherit;
}
```

- [ ] **Step 7: Verify scaffold**

Run: `npm run build`

Expected: Next.js compiles or reports only missing page errors that are resolved in Task 6.

---

### Task 2: Define PPT Domain Types And Templates

**Files:**
- Create: `src/lib/ppt/types.ts`
- Create: `src/lib/ppt/templates.ts`
- Create: `src/lib/ppt/templates.test.ts`

- [ ] **Step 1: Write tests for template validity**

```ts
import { describe, expect, it } from "vitest";
import { getTemplateById, templates } from "./templates";

describe("templates", () => {
  it("exposes three built-in templates", () => {
    expect(templates.map((template) => template.id)).toEqual([
      "business-blue",
      "tech-dark",
      "fresh-green"
    ]);
  });

  it("provides all required layout types for every template", () => {
    for (const template of templates) {
      expect(Object.keys(template.layouts).sort()).toEqual([
        "agenda",
        "content",
        "cover",
        "section",
        "summary"
      ]);
    }
  });

  it("finds a template by id", () => {
    expect(getTemplateById("business-blue")?.name).toBe("商务蓝");
    expect(getTemplateById("missing")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- src/lib/ppt/templates.test.ts`

Expected: FAIL because `templates.ts` does not exist yet.

- [ ] **Step 3: Create `types.ts`**

Define `SlideLayoutType`, `PptTemplate`, `GeneratedDeck`, `GeneratedSlide`, `RenderedSlide`, `PptJob`, `PptJobEvent`, and `PptStepKey`.

- [ ] **Step 4: Create `templates.ts`**

Create three templates with ids `business-blue`, `tech-dark`, and `fresh-green`. Each template must include `cover`, `agenda`, `section`, `content`, and `summary` layouts with normalized coordinates from `0` to `1`.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/lib/ppt/templates.test.ts`

Expected: PASS.

---

### Task 3: Build Simulated Deck Generation

**Files:**
- Create: `src/lib/ppt/generator.ts`
- Create: `src/lib/ppt/generator.test.ts`

- [ ] **Step 1: Write generator tests**

```ts
import { describe, expect, it } from "vitest";
import { generateDeckContent } from "./generator";

describe("generateDeckContent", () => {
  it("creates a six-slide deck from a topic", () => {
    const deck = generateDeckContent("新能源汽车市场分析");

    expect(deck.title).toContain("新能源汽车市场分析");
    expect(deck.slides).toHaveLength(6);
    expect(deck.slides.map((slide) => slide.layoutType)).toEqual([
      "cover",
      "agenda",
      "content",
      "content",
      "content",
      "summary"
    ]);
  });

  it("rejects an empty topic", () => {
    expect(() => generateDeckContent("   ")).toThrow("主题不能为空");
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- src/lib/ppt/generator.test.ts`

Expected: FAIL because `generateDeckContent` is missing.

- [ ] **Step 3: Implement `generateDeckContent(topic: string): GeneratedDeck`**

Use deterministic Chinese copy:

- Cover title: `${topic} PPT`
- Subtitle: `易策 AI 自动生成演示文稿`
- Agenda bullets: `背景与趋势`, `核心洞察`, `行动建议`
- Three content slides with 3 bullets each.
- Summary slide with 3 bullets.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/ppt/generator.test.ts`

Expected: PASS.

---

### Task 4: Render Generated Deck Into Template Slides

**Files:**
- Create: `src/lib/ppt/renderer.ts`
- Create: `src/lib/ppt/renderer.test.ts`

- [ ] **Step 1: Write renderer tests**

```ts
import { describe, expect, it } from "vitest";
import { generateDeckContent } from "./generator";
import { renderDeck } from "./renderer";
import { getTemplateById } from "./templates";

describe("renderDeck", () => {
  it("merges generated content with a template", () => {
    const template = getTemplateById("business-blue");
    if (!template) throw new Error("template missing");

    const rendered = renderDeck(generateDeckContent("行业研究"), template);

    expect(rendered).toHaveLength(6);
    expect(rendered[0].templateId).toBe("business-blue");
    expect(rendered[0].title).toContain("行业研究");
    expect(rendered[0].style.background).toBe(template.layouts.cover.background);
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- src/lib/ppt/renderer.test.ts`

Expected: FAIL because `renderDeck` is missing.

- [ ] **Step 3: Implement `renderDeck(deck, template): RenderedSlide[]`**

Map every generated slide to its matching template layout. Preserve slide text and add `status: "ready"`.

- [ ] **Step 4: Run renderer tests**

Run: `npm test -- src/lib/ppt/renderer.test.ts`

Expected: PASS.

---

### Task 5: Add PPTX Export

**Files:**
- Create: `src/lib/ppt/exporter.ts`
- Create: `src/lib/ppt/exporter.test.ts`
- Create directory at runtime: `.generated/pptx`

- [ ] **Step 1: Write exporter test**

```ts
import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exportPptx } from "./exporter";
import { generateDeckContent } from "./generator";
import { renderDeck } from "./renderer";
import { getTemplateById } from "./templates";

describe("exportPptx", () => {
  it("writes a non-empty pptx file", async () => {
    const template = getTemplateById("business-blue");
    if (!template) throw new Error("template missing");

    const slides = renderDeck(generateDeckContent("测试主题"), template);
    const filePath = await exportPptx({ slides, template, jobId: "test-job" });

    expect(existsSync(filePath)).toBe(true);
    expect(statSync(filePath).size).toBeGreaterThan(1000);
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- src/lib/ppt/exporter.test.ts`

Expected: FAIL because `exportPptx` is missing.

- [ ] **Step 3: Implement `exportPptx`**

Use `pptxgenjs`, `pptx.layout = "LAYOUT_WIDE"`, add one slide per rendered slide, draw backgrounds/accent rectangles, title, subtitle, and bullet text, then write to `.generated/pptx/<jobId>.pptx`.

- [ ] **Step 4: Run exporter test**

Run: `npm test -- src/lib/ppt/exporter.test.ts`

Expected: PASS and file exists under `.generated/pptx/test-job.pptx`.

---

### Task 6: Implement Job State And SSE Events

**Files:**
- Create: `src/lib/ppt/steps.ts`
- Create: `src/lib/ppt/jobs.ts`
- Create: `src/lib/ppt/jobs.test.ts`

- [ ] **Step 1: Write job tests**

```ts
import { describe, expect, it } from "vitest";
import { createPptJob, getPptJob } from "./jobs";

describe("ppt jobs", () => {
  it("creates and completes a job", async () => {
    const job = createPptJob({
      topic: "智能制造趋势",
      templateId: "business-blue"
    });

    expect(job.status).toBe("queued");

    await new Promise((resolve) => setTimeout(resolve, 2500));
    const completed = getPptJob(job.id);

    expect(completed?.status).toBe("completed");
    expect(completed?.slides).toHaveLength(6);
    expect(completed?.downloadPath).toContain(".pptx");
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- src/lib/ppt/jobs.test.ts`

Expected: FAIL because job functions are missing.

- [ ] **Step 3: Implement `steps.ts`**

Define ordered steps:

- `analyzing`
- `outline`
- `matching_template`
- `filling_slides`
- `rendering_preview`
- `exporting`
- `completed`

- [ ] **Step 4: Implement `jobs.ts`**

Use a module-level `Map<string, PptJob>`. Create jobs with ids like `job_${Date.now()}_${random}`. Start generation asynchronously with timed progress updates. Use an event listener set per job so SSE routes can subscribe.

- [ ] **Step 5: Run job tests**

Run: `npm test -- src/lib/ppt/jobs.test.ts`

Expected: PASS.

---

### Task 7: Implement API Routes

**Files:**
- Create: `src/app/api/templates/route.ts`
- Create: `src/app/api/ppt/jobs/route.ts`
- Create: `src/app/api/ppt/jobs/[jobId]/events/route.ts`
- Create: `src/app/api/ppt/jobs/[jobId]/download/route.ts`

- [ ] **Step 1: Create templates route**

Return `NextResponse.json({ templates })`.

- [ ] **Step 2: Create job creation route**

Parse `{ topic, templateId }`, validate both fields, validate template exists, call `createPptJob`, return `{ jobId }`.

- [ ] **Step 3: Create SSE route**

Return a `ReadableStream` with `Content-Type: text/event-stream`. Emit current snapshot immediately, then subscribe to future job events. Close after `completed` or `failed`.

- [ ] **Step 4: Create download route**

Validate job exists, status is `completed`, and `downloadPath` exists. Return a `Response` with PPTX bytes and `Content-Disposition: attachment; filename="<jobId>.pptx"`.

- [ ] **Step 5: Build check**

Run: `npm run build`

Expected: PASS.

---

### Task 8: Build The Frontend UI

**Files:**
- Create: `src/components/TemplatePicker.tsx`
- Create: `src/components/GenerationTimeline.tsx`
- Create: `src/components/SlidePreview.tsx`
- Create: `src/components/PptWorkspace.tsx`
- Create: `src/app/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Build `TemplatePicker`**

Render template options as compact selectable buttons showing name, description, and theme colors.

- [ ] **Step 2: Build `GenerationTimeline`**

Render all seven generation steps with states `pending`, `active`, `done`, or `failed`.

- [ ] **Step 3: Build `SlidePreview`**

Render a 16:9 slide preview from `RenderedSlide`, using absolute-positioned regions based on normalized template coordinates.

- [ ] **Step 4: Build `PptWorkspace`**

Client component state:

- `topic`
- `templates`
- `selectedTemplateId`
- `jobId`
- `status`
- `currentStep`
- `progress`
- `slides`
- `activeSlideIndex`
- `error`

Flow:

- Fetch templates on mount.
- Create job on generate.
- Open `EventSource` to `/api/ppt/jobs/${jobId}/events`.
- Update state as events arrive.
- Show download button when completed.

- [ ] **Step 5: Build page**

`src/app/page.tsx` should render `<PptWorkspace />`.

- [ ] **Step 6: Expand CSS**

Style the app as a dense assistant workspace with left chat input and right PPT panel. Use stable 16:9 preview dimensions and responsive stacking for narrow screens.

- [ ] **Step 7: Build check**

Run: `npm run build`

Expected: PASS.

---

### Task 9: End-To-End Manual Verification

**Files:**
- No new files unless a small `README.md` is added.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

Expected: app serves at `http://127.0.0.1:3000`.

- [ ] **Step 2: Verify templates API**

Run: `curl -sS http://127.0.0.1:3000/api/templates`

Expected: JSON includes `business-blue`, `tech-dark`, and `fresh-green`.

- [ ] **Step 3: Verify job creation API**

Run:

```bash
curl -sS -X POST http://127.0.0.1:3000/api/ppt/jobs \
  -H 'Content-Type: application/json' \
  -d '{"topic":"新能源汽车市场分析","templateId":"business-blue"}'
```

Expected: JSON includes `jobId`.

- [ ] **Step 4: Verify browser flow**

Open `http://127.0.0.1:3000`, enter a topic, choose a template, click generate, observe timeline updates, slide previews, and final download button.

- [ ] **Step 5: Verify PPTX download**

Download the completed file and confirm it is non-empty and opens in a compatible Office viewer.

- [ ] **Step 6: Final build and tests**

Run: `npm test` and `npm run build`

Expected: both PASS.

---

## Self-Review

- Spec coverage: The plan covers templates, simulated generation, text fill preview, SSE progress, PPTX export, API routes, frontend UI, and verification.
- Placeholder scan: No planned behavior is left as an unspecified placeholder. Implementation tasks name concrete files, functions, routes, and expected outputs.
- Type consistency: `PptTemplate`, `GeneratedDeck`, `RenderedSlide`, `PptJob`, `PptJobEvent`, and `PptStepKey` are introduced before all dependent tasks.
