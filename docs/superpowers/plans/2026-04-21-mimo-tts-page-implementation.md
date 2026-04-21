# MiMo TTS Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new MiMo TTS tool page that lets users enter an API key, configure voice and audio format, compose overall style plus fine-grained audio tags, generate speech, preview it, and download the result.

**Architecture:** Keep the site static and perform the MiMo TTS call directly from the browser against Xiaomi's OpenAI-compatible chat completions endpoint. Isolate request-body assembly and response parsing in a small library module so the React page component can focus on UI state, validation, and playback.

**Tech Stack:** Astro, React, TypeScript, Vitest, Testing Library, Fetch API, browser Blob/audio APIs

---

### Task 1: Add MiMo TTS request helpers

**Files:**
- Create: `src/lib/mimo-tts/index.ts`
- Create: `src/lib/mimo-tts/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildMimoTtsRequestBody, composeStyledAssistantText } from './index';

test('builds assistant text with style prefix and inline tag content', () => {
  expect(
    composeStyledAssistantText({
      style: '温柔、缓慢、略带耳语',
      text: '今天辛苦了。（轻轻停顿）先休息一下吧。',
    }),
  ).toContain('<style>温柔、缓慢、略带耳语</style>');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/mimo-tts/index.test.ts`
Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function composeStyledAssistantText(...) { ... }
export function buildMimoTtsRequestBody(...) { ... }
export function extractAudioPayload(...) { ... }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/mimo-tts/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/mimo-tts/index.ts src/lib/mimo-tts/index.test.ts
git commit -m "feat: add mimo tts request helpers"
```

### Task 2: Build the MiMo TTS React tool

**Files:**
- Create: `src/components/MimoTtsTool.tsx`
- Create: `src/components/MimoTtsTool.test.tsx`
- Modify: `src/test/setup.ts`

- [ ] **Step 1: Write the failing test**

```tsx
test('submits MiMo request and shows generated audio player', async () => {
  render(<MimoTtsTool />);
  // fill API key, text, click generate, expect audio controls
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/MimoTtsTool.test.tsx`
Expected: FAIL because the component is not implemented yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
export default function MimoTtsTool() {
  // auth fields, audio config, style/tag controls, generate handler, player/download UI
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/MimoTtsTool.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/MimoTtsTool.tsx src/components/MimoTtsTool.test.tsx src/test/setup.ts
git commit -m "feat: add mimo tts tool component"
```

### Task 3: Wire Astro routes and home navigation

**Files:**
- Create: `src/pages/tools/mimo-tts.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Write the failing test**

Manual verification target:
Visit `/tools/mimo-tts` and confirm the page renders inside the shared layout and the home page includes the new card.

- [ ] **Step 2: Run verification to confirm it currently fails**

Run: `npm run build`
Expected: Build either lacks the new route or home navigation entry.

- [ ] **Step 3: Write minimal implementation**

```astro
<MimoTtsTool client:only="react" />
```

- [ ] **Step 4: Run verification to confirm it passes**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/tools/mimo-tts.astro src/pages/index.astro
git commit -m "feat: add mimo tts tool page"
```

### Task 4: Final verification

**Files:**
- Modify: none

- [ ] **Step 1: Run focused test suite**

Run: `npm test -- src/lib/mimo-tts/index.test.ts src/components/MimoTtsTool.test.tsx`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Review requirements against implementation**

Checklist:
- API key is user-entered in browser
- voice/format configurable
- overall style configurable
- fine-grained tag content editable
- generated audio can be previewed and downloaded
- home page has entry point

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add mimo tts page"
```
