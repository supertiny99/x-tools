# 二维码工具 TDD 模式设计

## 背景

当前二维码工具实现位于 [QrCodeTool.tsx](/Users/supertiny/Myproject/xl/tools/src/components/QrCodeTool.tsx)，在单个 React 组件内同时处理以下职责：

- 二维码生成输入与结果展示
- 图片文件校验
- 浏览器图片解码与 Canvas 提取
- `jsQR` 扫码
- 拖拽、上传、粘贴交互
- 复制、下载和错误提示

与此前的文本脱敏工具类似，这种结构在功能扩展前问题不大，但一旦需要建立稳定的 TDD 节奏，就会暴露边界不清的问题。尤其是“解析二维码”这半边同时依赖文件、图片、Canvas 和第三方扫描库，如果不先拆层，测试会很快退化为难维护的组件大杂烩。

## 目标

- 将二维码工具迁移到适合当前仓库的 TDD 模式。
- 同一轮内同时覆盖“生成二维码”和“解析二维码”两个子模块。
- 将“生成”拆为可测试核心逻辑，将“解析”拆为可注入依赖的编排逻辑。
- 保持当前 UI 交互与页面结构不大改。

## 非目标

- 这轮不重做二维码工具视觉布局。
- 这轮不为上传、拖拽、粘贴建立统一输入抽象层。
- 这轮不在浏览器适配层做额外平台兼容增强。
- 这轮不把剪贴板复制和下载逻辑一起抽成通用服务。

## 方案对比

### 方案 A：双核心模块 + 组件适配层

将二维码工具拆为 `generate`、`parse`、`browser` 三层：

- `generate` 负责二维码生成
- `parse` 负责二维码解析流程编排
- `browser` 负责实际浏览器图片解码与扫描适配

优点：

- 生成和解析都能建立清晰 TDD 边界
- 组件职责收敛明显
- 适合渐进扩展

缺点：

- 解析层需要设计依赖注入

### 方案 B：生成彻底抽离，解析轻封装

生成二维码完全下沉为纯函数模块，解析二维码只提取少量辅助函数，其余保留在组件。

优点：

- 实现更快

缺点：

- 解析部分测试价值有限
- 后续仍要补第二轮重构

### 方案 C：完整适配层体系

把生成、解析、拖拽、粘贴、复制、下载都拆为 service + adapter。

优点：

- 长期结构最完整

缺点：

- 当前范围下成本偏高
- 超出“小幅重构”的节奏

## 推荐方案

推荐采用方案 A，并明确约束：浏览器适配层只做“足够支撑当前组件”的薄封装，不扩展为统一输入系统。

这能在一轮内同时覆盖生成和解析两半逻辑，又不会把二维码工具重构做成新的复杂工程。

## 建议架构

建议新增目录：

```text
src/
  lib/
    qrcode/
      types.ts
      generate.ts
      parse.ts
      browser.ts
      index.ts
```

### 1. Generate 层

职责：

- 处理输入文本
- 调用 `qrcode.toDataURL`
- 统一返回生成结果

边界：

- 不依赖 React
- 不处理下载和复制
- 通过依赖注入替代直接依赖第三方库

### 2. Parse 层

职责：

- 校验文件类型
- 调用浏览器解码器拿到 `ImageData`
- 调用扫码器拿到解析结果
- 统一转换错误和成功结果

边界：

- 不直接使用 `Image`、`canvas`、`URL.createObjectURL`
- 通过依赖注入接收浏览器解码器和扫描器

### 3. Browser 层

职责：

- 将图片文件解码为 `ImageData`
- 将 `jsQR` 扫描包装为统一接口

边界：

- 只做当前组件所需的薄封装
- 不额外抽象拖拽、粘贴、文件上传入口

### 4. 组件适配层

继续保留在 [QrCodeTool.tsx](/Users/supertiny/Myproject/xl/tools/src/components/QrCodeTool.tsx) 中，职责包括：

- tab 切换
- 输入框与按钮状态
- 拖拽、上传、粘贴事件
- 复制与下载
- 结果展示与错误展示

约束：

- 不再直接持有二维码生成与解析核心逻辑
- 不再在组件中直接实现文件校验和扫描结果归一化

## 建议 API

```ts
type ImageDataLike = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

type QrGenerateResult =
  | { kind: 'empty' }
  | { kind: 'success'; dataUrl: string }
  | { kind: 'error'; message: string };

type QrParseResult =
  | { kind: 'success'; text: string; previewUrl: string }
  | { kind: 'error'; message: string; previewUrl?: string };

type QrGenerateDeps = {
  toDataURL: (text: string, options: object) => Promise<string>;
};

type QrParseDeps = {
  decodeImageFile: (file: File) => Promise<{ previewUrl: string; imageData: ImageDataLike }>;
  scanQrCode: (imageData: ImageDataLike) => { data: string } | null;
};

async function generateQrCode(text: string, deps: QrGenerateDeps): Promise<QrGenerateResult>;
async function parseQrCodeFile(file: File, deps: QrParseDeps): Promise<QrParseResult>;
```

## TDD 工作模式

### Generate 侧

1. 先写失败测试：
   - 空输入返回 `empty`
   - 成功生成返回 `success`
   - 底层异常返回统一错误
2. 只写最小实现让测试通过
3. 再整理参数常量与结果类型

### Parse 侧

1. 先写失败测试：
   - 非图片文件
   - 解码失败
   - 扫描无结果
   - 扫描成功
2. 用依赖注入隔离浏览器和第三方库
3. 最小实现通过后再补组件接线测试

### 组件侧

只补关键接线行为测试，不在组件测试里重复覆盖底层解析分支。

## 第一批测试清单

### `generate.test.ts`

- 空输入返回 `empty`
- 非空输入生成 data URL
- 底层生成失败时返回“生成二维码失败”

### `parse.test.ts`

- 非图片文件返回“请上传图片文件”
- 浏览器解码失败时返回“读取图片失败”
- 无扫描结果时返回“未能识别到二维码，请尝试更清晰的图片”
- 成功时返回解析文本和预览地址

### `QrCodeTool.test.tsx`

- 生成 tab 输入文本后显示二维码图片
- 解析 tab 成功后显示解析结果
- 非法文件时显示解析错误

## 推荐迁移顺序

1. 新建 `src/lib/qrcode/` 目录与类型
2. 写 `generate` 失败测试并实现
3. 写 `parse` 失败测试并实现
4. 新建 `browser` 薄适配层
5. 重构 [QrCodeTool.tsx](/Users/supertiny/Myproject/xl/tools/src/components/QrCodeTool.tsx) 只做适配
6. 补组件接线测试
7. 跑全量测试与构建

## 风险与控制

主要风险：

- `parse` 涉及浏览器 API，边界划分不当会导致测试难写
- 组件重构时容易不小心改动拖拽或粘贴行为
- 第三方库调用参数如果在重构时偏移，可能出现行为回归

控制方式：

- `parse` 只在流程编排层做测试，浏览器层维持薄封装
- 组件测试只覆盖高价值接线场景
- 先保持当前 `QRCode.toDataURL` 和 `jsQR` 参数不变

## 结论

二维码工具适合按“生成核心 + 解析核心 + 浏览器薄适配 + 组件适配层”的结构迁移到 TDD 模式。

推荐在同一轮内同时覆盖生成与解析两半逻辑，但控制浏览器层抽象深度，只做支撑当前组件所需的最小封装。这样既能建立稳定测试边界，也不会让本轮重构超出合理范围。
