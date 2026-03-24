# 文本脱敏 TDD 改造 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为文本脱敏工具建立可持续的 TDD 基础设施，并完成首轮“规则 + 匹配计算”纯函数抽离。

**Architecture:** 保持现有 Astro 页面和 React 组件结构不变，在 `src/lib/desensitize/` 下新增纯逻辑模块，将规则定义和脱敏执行从组件中下沉。测试以 Vitest 为主，优先覆盖 rules 和 engine 两层，再让组件只负责状态与渲染接线。

**Tech Stack:** Astro, React, TypeScript, Vitest, jsdom, Testing Library

---

### Task 1: 建立测试基础设施

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Test: `npm test`

- [x] **Step 1: 为测试脚本写出目标配置**

在 `package.json` 中新增：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

- [x] **Step 2: 安装并配置 Vitest 运行环境**

新增 `vitest.config.ts`，配置 `jsdom`、`setupFiles`、覆盖 `src/**/*.test.ts?(x)`。

Run: `npm test`
Expected: 测试框架可启动，即使当前无测试文件也应正常退出或提示无测试。

- [x] **Step 3: 建立前端测试初始化文件**

新增 `src/test/setup.ts`，引入：

```ts
import '@testing-library/jest-dom/vitest';
```

- [x] **Step 4: 再次运行测试验证基础设施可用**

Run: `npm test`
Expected: Vitest 正常运行，无配置报错。

### Task 2: 为纯逻辑抽离写第一批失败测试

**Files:**
- Create: `src/lib/desensitize/rules.test.ts`
- Create: `src/lib/desensitize/engine.test.ts`
- Test: `src/lib/desensitize/*.test.ts`

- [x] **Step 1: 写 rules 层失败测试**

覆盖以下行为：

```ts
test('phone rule masks middle digits')
test('email rule preserves first char and domain')
test('name rule masks 2/3/4-char Chinese names')
test('ipv4 rule masks last two octets')
test('address rule output changes by address level')
```

- [x] **Step 2: 运行 rules 测试并确认失败**

Run: `npm test -- src/lib/desensitize/rules.test.ts`
Expected: FAIL，报缺少模块或导出。

- [x] **Step 3: 写 engine 层失败测试**

覆盖以下行为：

```ts
test('desensitizeText returns masked output for enabled rules')
test('desensitizeText counts matches')
test('desensitizeText returns match positions and values')
test('desensitizeText keeps original text when no rules match')
```

- [x] **Step 4: 运行 engine 测试并确认失败**

Run: `npm test -- src/lib/desensitize/engine.test.ts`
Expected: FAIL，报缺少模块或导出。

### Task 3: 实现纯函数类型与规则模块

**Files:**
- Create: `src/lib/desensitize/types.ts`
- Create: `src/lib/desensitize/rules.ts`
- Test: `src/lib/desensitize/rules.test.ts`

- [x] **Step 1: 写最小类型定义**

在 `types.ts` 中定义：

```ts
export type AddressLevel = 'province' | 'district' | 'street';

export interface MaskRule {
  id: string;
  name: string;
  enabled: boolean;
  builtin: boolean;
  pattern: RegExp;
  mask: (match: string) => string;
}

export interface MatchInfo {
  start: number;
  end: number;
  original: string;
  masked: string;
}
```

- [x] **Step 2: 实现内置规则工厂的最小版本**

在 `rules.ts` 中导出：

```ts
export function createBuiltinRules(options: { addressLevel: AddressLevel }): MaskRule[]
```

要求：
- 复用现有组件中的规则行为
- 地址规则按 `addressLevel` 产出不同 mask

- [x] **Step 3: 运行 rules 测试并使其通过**

Run: `npm test -- src/lib/desensitize/rules.test.ts`
Expected: PASS

- [x] **Step 4: 做一次小重构**

整理重复的匹配组装或地址掩码逻辑，但不新增行为。

### Task 4: 实现纯函数执行引擎

**Files:**
- Create: `src/lib/desensitize/engine.ts`
- Test: `src/lib/desensitize/engine.test.ts`

- [x] **Step 1: 实现最小执行入口**

导出：

```ts
export function desensitizeText(input: string, rules: MaskRule[]): {
  output: string;
  matches: MatchInfo[];
  matchCount: number;
}
```

要求：
- 只处理启用规则
- 收集全部匹配并按位置排序
- 与组件当前逻辑一致地处理重叠命中

- [x] **Step 2: 运行 engine 测试并使其通过**

Run: `npm test -- src/lib/desensitize/engine.test.ts`
Expected: PASS

- [x] **Step 3: 全量运行 desensitize 单测**

Run: `npm test -- src/lib/desensitize`
Expected: PASS

### Task 5: 将组件接到纯函数核心

**Files:**
- Modify: `src/components/DesensitizeTool.tsx`
- Test: `src/lib/desensitize/*.test.ts`

- [x] **Step 1: 迁移组件中的类型和内置规则来源**

让组件改为从 `src/lib/desensitize/` 导入类型、规则工厂和引擎，而不再内联内置规则定义。

- [x] **Step 2: 用纯函数引擎替换组件内联匹配逻辑**

保留组件现有交互行为，但将实际脱敏执行委托给 `desensitizeText(...)`。

- [x] **Step 3: 保持 diff 构造逻辑在组件中**

继续使用组件内的 `textToLineData`，只根据引擎输出的 `matches` 组装旧文本/新文本高亮范围。

- [x] **Step 4: 运行相关测试并验证组件可编译**

Run: `npm test -- src/lib/desensitize`
Expected: PASS

Run: `npm run build`
Expected: BUILD SUCCESS

### Task 6: 验证与收尾

**Files:**
- Modify: `docs/superpowers/plans/2026-03-24-desensitize-tdd-implementation.md`

- [x] **Step 1: 更新计划勾选状态**

将已完成步骤勾选。

- [x] **Step 2: 跑最终验证**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: BUILD SUCCESS

- [x] **Step 3: 检查改动范围**

Run: `git status --short`
Expected: 仅包含本次测试基础设施、纯逻辑模块、组件接线和文档变更。

注：仓库中另有既存未跟踪目录 `.claude/`、`.github/`、`.vscode/mcp.json`、`.npmrc`，未在本次实现中改动。
