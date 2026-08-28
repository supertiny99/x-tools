# Poster QR Replacement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local poster QR replacement workflow to the existing image processing tool.

**Architecture:** Add a `posterQr` tab to `ImageTool.tsx`, backed by a small `src/lib/image/poster-qr.ts` helper for clamping and Canvas composition. The UI stores overlay coordinates in original poster pixels, while the preview maps them to scaled display pixels for drag and resize interactions.

**Tech Stack:** Astro, React, TypeScript, Canvas API, Vitest, Testing Library.

---

### Task 1: Composition Core

**Files:**
- Create: `src/lib/image/poster-qr.ts`
- Create: `src/lib/image/poster-qr.test.ts`

- [x] Write failing tests for clamping QR layers inside poster bounds and exporting a PNG canvas at poster size.
- [x] Implement minimal helper functions.
- [x] Run `npm test -- src/lib/image/poster-qr.test.ts`.

### Task 2: Image Tool UI

**Files:**
- Modify: `src/components/ImageTool.tsx`
- Create/modify: `src/components/ImageTool.test.tsx`

- [x] Write failing component tests for the new tab and controls.
- [x] Add the tab, upload controls, overlay preview, drag/resize handlers, numeric controls, and PNG export path.
- [x] Run `npm test -- src/components/ImageTool.test.tsx`.

### Task 3: Verification

**Files:**
- Modify as needed: `src/components/ImageTool.tsx`, `src/lib/image/poster-qr.ts`

- [x] Run focused tests.
- [x] Run `npm run build`.
- [x] Start the dev server and smoke test the page if needed.
