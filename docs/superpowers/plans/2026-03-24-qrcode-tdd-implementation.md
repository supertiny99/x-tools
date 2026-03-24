# 二维码工具 TDD 改造 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为二维码工具建立覆盖“生成 + 解析”的 TDD 分层，并完成首轮核心逻辑抽离。

**Architecture:** 在 `src/lib/qrcode/` 下新增 `generate`、`parse`、`browser`、`types`、`index` 模块，将二维码生成和解析流程从组件中下沉。`generate` 侧通过依赖注入隔离 `qrcode`，`parse` 侧通过依赖注入隔离浏览器图片解码和 `jsQR` 扫描，组件只保留交互与展示。

**Tech Stack:** Astro, React, TypeScript, Vitest, Testing Library, qrcode, jsQR

---

### Task 1: 建立二维码模块骨架

**Files:**
- Create: `src/lib/qrcode/types.ts`
- Create: `src/lib/qrcode/index.ts`

- [x] **Step 1: 写最小共享类型**

在 `src/lib/qrcode/types.ts` 中定义：

```ts
export type ImageDataLike = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type QrGenerateResult =
  | { kind: 'empty' }
  | { kind: 'success'; dataUrl: string }
  | { kind: 'error'; message: string };

export type QrParseResult =
  | { kind: 'success'; text: string; previewUrl: string }
  | { kind: 'error'; message: string; previewUrl?: string };
```

- [x] **Step 2: 写统一导出入口**

在 `src/lib/qrcode/index.ts` 中导出后续模块和类型。

### Task 2: 为生成侧写失败测试并实现

**Files:**
- Create: `src/lib/qrcode/generate.test.ts`
- Create: `src/lib/qrcode/generate.ts`

- [x] **Step 1: 写生成侧失败测试**

覆盖：

```ts
test('returns empty for blank input')
test('returns success with generated data url')
test('returns unified error when generator throws')
```

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- src/lib/qrcode/generate.test.ts`
Expected: FAIL，缺少模块或导出。

- [x] **Step 3: 写最小生成实现**

实现：

```ts
export async function generateQrCode(text, deps): Promise<QrGenerateResult>
```

要求：
- 空白输入返回 `empty`
- 保持当前 `toDataURL` 选项与组件一致
- 异常统一返回“生成二维码失败”

- [x] **Step 4: 运行生成侧测试确认通过**

Run: `npm test -- src/lib/qrcode/generate.test.ts`
Expected: PASS

### Task 3: 为解析侧写失败测试并实现

**Files:**
- Create: `src/lib/qrcode/parse.test.ts`
- Create: `src/lib/qrcode/parse.ts`

- [x] **Step 1: 写解析侧失败测试**

覆盖：

```ts
test('rejects non-image files')
test('returns read failure when decodeImageFile rejects')
test('returns not found when scanQrCode returns null')
test('returns success when scanQrCode returns data')
```

- [x] **Step 2: 运行测试确认失败**

Run: `npm test -- src/lib/qrcode/parse.test.ts`
Expected: FAIL，缺少模块或导出。

- [x] **Step 3: 写最小解析实现**

实现：

```ts
export async function parseQrCodeFile(file, deps): Promise<QrParseResult>
```

要求：
- 非图片文件返回“请上传图片文件”
- 解码失败统一返回“读取图片失败”
- 无扫描结果返回“未能识别到二维码，请尝试更清晰的图片”
- 成功时返回文本和预览图地址

- [x] **Step 4: 运行解析侧测试确认通过**

Run: `npm test -- src/lib/qrcode/parse.test.ts`
Expected: PASS

### Task 4: 添加浏览器薄适配层

**Files:**
- Create: `src/lib/qrcode/browser.ts`

- [x] **Step 1: 写浏览器适配实现**

导出：

```ts
export async function decodeImageFile(file)
export function scanQrCode(imageData)
```

要求：
- `decodeImageFile` 仅实现当前组件所需的 `File -> previewUrl + ImageData`
- `scanQrCode` 包装 `jsQR` 并保持当前参数
- 不抽象拖拽、粘贴和文件输入来源

- [x] **Step 2: 将模块加入统一导出**

更新 `src/lib/qrcode/index.ts`

### Task 5: 重构二维码组件为适配层

**Files:**
- Modify: `src/components/QrCodeTool.tsx`

- [x] **Step 1: 将生成逻辑接到 `generateQrCode`**

要求：
- 保持生成输入和现有 `useEffect` 行为一致
- 由核心结果更新 `qrImageUrl` 和 `generateError`

- [x] **Step 2: 将解析逻辑接到 `parseQrCodeFile`**

要求：
- 上传、拖拽、粘贴统一复用同一个解析入口
- 组件只负责设置 `parseResult`、`parseError`、`uploadedImagePreview`

- [x] **Step 3: 保持复制与下载逻辑在组件中**

剪贴板和下载继续留在组件适配层，不在这轮下沉。

### Task 6: 添加组件接线测试

**Files:**
- Create: `src/components/QrCodeTool.test.tsx`

- [x] **Step 1: 写组件测试**

覆盖：

```ts
test('generate tab shows qr image after successful generation')
test('parse tab shows decoded text after successful parse')
test('parse tab shows error for invalid file')
```

- [x] **Step 2: 运行组件测试并根据需要调整接线**

Run: `npm test -- src/components/QrCodeTool.test.tsx`
Expected: PASS

### Task 7: 全量验证与收尾

**Files:**
- Modify: `docs/superpowers/plans/2026-03-24-qrcode-tdd-implementation.md`

- [x] **Step 1: 更新计划勾选状态**

将已完成步骤勾选。

- [x] **Step 2: 运行全量测试**

Run: `npm test`
Expected: PASS

- [x] **Step 3: 运行构建验证**

Run: `npm run build`
Expected: BUILD SUCCESS

- [x] **Step 4: 检查改动范围**

Run: `git status --short`
Expected: 仅包含二维码模块、组件接线、测试和相关文档变更，以及仓库既有未跟踪项。
