# 文本脱敏工具 TDD 模式设计

## 背景

当前文本脱敏工具实现位于 [DesensitizeTool.tsx](/Users/supertiny/Myproject/xl/tools/src/components/DesensitizeTool.tsx)，在单个 React 组件中同时承载了以下职责：

- 内置脱敏规则定义
- 文本匹配与替换计算
- 地址级别等运行配置
- React 状态与事件处理
- 结果展示与交互反馈

这种组织方式在功能较少时可以工作，但会让测试边界模糊。只要规则、匹配、替换逻辑继续留在组件中，后续新增规则、修复误匹配或调整掩码策略时，就很难稳定地执行测试先行的开发方式。

## 目标

- 为文本脱敏工具建立适合当前仓库的 TDD 工作模式。
- 先做一轮小幅重构，将“脱敏规则 + 匹配计算”抽成纯函数核心。
- 保持现有 UI 结构基本不变，降低迁移风险。
- 让后续规则新增、规则修正、误伤修复都能先写失败测试，再做最小实现。

## 非目标

- 这轮不重写整个文本脱敏工具 UI。
- 这轮不把 diff 高亮、滚动同步、复制反馈等交互逻辑全部抽离。
- 这轮不推动全站所有工具立即采用同样的目录结构。
- 这轮不引入端到端测试作为主要保障手段。

## 方案对比

### 方案 A：最小抽离

把内置规则和匹配流程直接从组件挪到单个工具函数文件中，组件继续主导大部分业务判断。

优点：

- 改动最小
- 上手快

缺点：

- 规则定义、执行流程、类型边界仍然容易混在一起
- 后续扩展时容易重新长回“大组件”

### 方案 B：纯函数核心 + 组件适配层

将文本脱敏逻辑拆成 `rules` 层和 `engine` 层，组件只负责状态与渲染。

优点：

- 最适合围绕纯逻辑做 TDD
- 测试颗粒清晰
- 后续新增规则时路径固定
- 属于小幅重构，风险可控

缺点：

- 需要先整理类型与模块边界

### 方案 C：领域层彻底模块化

把规则定义、自定义规则校验、地址策略、diff 数据准备、UI 适配等全部拆成独立 domain 模块。

优点：

- 长期最整齐

缺点：

- 当前范围下投入偏大
- 容易超出“小幅重构”的目标

## 推荐方案

推荐采用方案 B：纯函数核心 + 组件适配层。

这个方案兼顾了两个目标：一方面能真正建立测试先行的开发约束，另一方面又不会把这次工作扩大成一次全面重构。对当前仓库规模来说，这是最稳妥也最有收益的起点。

## 建议架构

### 1. Rules 层

职责：

- 定义内置脱敏规则
- 提供规则类型
- 根据运行配置生成规则集

建议包含的内容：

- 手机号、身份证、邮箱、银行卡、中文姓名、IPv4、地址等规则定义
- 地址级别配置对应的规则行为
- 规则的掩码函数

约束：

- 不依赖 React
- 不读写 DOM
- 不直接处理组件状态

### 2. Engine 层

职责：

- 接收输入文本和启用规则
- 执行匹配与替换
- 返回可直接消费的纯结果

建议返回结果：

- `output`
- `matches`
- `matchCount`

约束：

- 不关心规则来自“内置”还是“自定义”
- 不关心开关按钮、输入框、滚动同步等 UI 概念
- 只接受纯数据输入，返回纯数据输出

### 3. 组件适配层

继续保留在 [DesensitizeTool.tsx](/Users/supertiny/Myproject/xl/tools/src/components/DesensitizeTool.tsx) 中，职责包括：

- 管理表单状态
- 响应规则启用/禁用
- 处理地址级别选择
- 管理自定义规则输入
- 调用纯函数核心并渲染结果

约束：

- 不再承载正则细节和掩码实现
- 不再在组件内部新增匹配统计逻辑

## 目录设计

建议新增局部逻辑目录：

```text
src/
  lib/
    desensitize/
      types.ts
      rules.ts
      engine.ts
```

职责建议如下：

- [types.ts](/Users/supertiny/Myproject/xl/tools/src/lib/desensitize/types.ts)：声明 `MaskRule`、`MatchInfo`、`AddressLevel`、`DesensitizeResult` 等类型
- [rules.ts](/Users/supertiny/Myproject/xl/tools/src/lib/desensitize/rules.ts)：定义并导出内置规则工厂
- [engine.ts](/Users/supertiny/Myproject/xl/tools/src/lib/desensitize/engine.ts)：提供统一执行入口

## 建议 API

建议保持 API 简洁，优先支持当前需求：

```ts
type DesensitizeOptions = {
  addressLevel: AddressLevel;
};

type DesensitizeResult = {
  output: string;
  matches: MatchInfo[];
  matchCount: number;
};

function createBuiltinRules(options: DesensitizeOptions): MaskRule[];
function desensitizeText(input: string, rules: MaskRule[]): DesensitizeResult;
```

设计意图：

- `createBuiltinRules` 负责把运行配置映射为规则集合
- `desensitizeText` 负责真正执行规则
- 组件只负责在调用前决定“哪些规则启用”

## TDD 工作模式

围绕 `rules` 和 `engine` 层执行固定的 Red-Green-Refactor 循环。

### Red

先写一个最小失败测试，只描述一个行为。例如：

- 手机号应保留前三后四
- 多条规则启用时应累计命中数
- 地址规则在不同级别下应产生不同结果

要求：

- 一次只测一个行为
- 测试名称必须清楚描述规则或结果
- 必须先观察到失败原因正确

### Green

只写让当前测试通过的最小实现。

要求：

- 优先修改 [rules.ts](/Users/supertiny/Myproject/xl/tools/src/lib/desensitize/rules.ts) 或 [engine.ts](/Users/supertiny/Myproject/xl/tools/src/lib/desensitize/engine.ts)
- 不为了“顺手优化”扩大实现范围
- 如果组件层没有必要，不触碰 [DesensitizeTool.tsx](/Users/supertiny/Myproject/xl/tools/src/components/DesensitizeTool.tsx)

### Refactor

在所有测试保持通过后，进行小步整理。例如：

- 提取重复的匹配结果组装代码
- 统一规则类型
- 收敛重复的正则处理路径

要求：

- 不引入新行为
- 重构后立即全量回归相关测试

## 第一批测试清单

### Rules 层测试

- 手机号规则正确保留前三后四
- 身份证规则正确保留前六后四
- 邮箱规则正确保留首字符和域名
- 中文姓名规则按 2、3、4 字长度正确掩码
- IPv4 规则正确变为 `x.x.*.*`
- 地址规则在不同 `addressLevel` 下返回不同掩码结果

### Engine 层测试

- 单条规则可生成正确 `output`
- 多条规则可累计 `matchCount`
- 返回的 `matches` 包含正确的 `start`、`end`、`original`、`masked`
- 禁用某条规则后不生效
- 空文本返回空结果
- 无匹配时保留原文不变

## 推荐测试工具栈

基于当前仓库使用 `Astro + React + Vite`，建议采用以下最小测试组合：

- `Vitest`
- `@testing-library/react`
- `jsdom`
- `v8` 覆盖率

使用原则：

- 这一轮以 `Vitest` 单元测试为主
- `@testing-library/react` 只为后续少量接线测试做准备
- 暂不把端到端测试作为主战场

## 团队约束

为保证 TDD 不流于口号，建议对文本脱敏工具约束以下规则：

1. 修改脱敏规则前，先写失败测试。
2. 匹配、替换、命中统计逻辑不得继续直接长在组件中。
3. 新增一类敏感信息时，至少补“命中成功”和“避免误伤”两类测试。
4. 组件层只负责状态、交互和渲染，规则细节必须下沉到纯函数模块。

## 风险与控制

主要风险：

- 组件接线改动时可能引入回归
- 地址规则属于复杂正则，测试样本不足时容易误判
- 如果一开始把范围扩得过大，TDD 节奏容易失真

控制方式：

- 先只抽“规则 + 匹配计算”，不扩散到 diff 和 UI 交互
- 先以内置规则建立测试基线
- 每次只做一个行为闭环，避免大批量迁移

## 结论

文本脱敏工具最适合作为当前仓库的 TDD 试点模块。

推荐先通过小幅重构建立 `rules + engine + component adapter` 三层边界，再以 `Vitest` 为核心围绕纯函数层推进测试先行开发。这样既能快速落地，也能为后续长期维护提供稳定的行为边界和更低成本的规则演进路径。
