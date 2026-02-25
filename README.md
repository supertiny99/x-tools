# ✨ 在线工具箱 (Online Tools Collection)

基于 **Astro**、**React** 和 **Tailwind CSS** 构建的快捷高效的在线工具集合。起步目标是打造一系列可以在浏览器中直接完成且无需服务端处理开销（或者是极致轻量的）Web 应用集。

## �️ 目前已实现的工具

### 📡 WebRTC P2P 聊天与文件传输
这是一个真正的一对一直连（Peer-to-Peer）在线协同工具。

**核心功能 / Features:**
- **文本聊天**: 端到端加密通讯，消息不经过任何中央服务器。
- **文件发送**: 支持直接点对点发送任意文件。
- **拖拽上传支持**: 可以将本地文件或大量文件直接使用鼠标 **拖拽** 进聊天主干区域以光速发起传输。
- **安全与私密**: 一切均在浏览器的 WebRTC 数据通道内本地传输。

## 🚀 技术栈

- 框架: **[Astro](https://astro.build/)** (配合 `@astrojs/react` 集成)
- 界面: **React 18** + **Tailwind CSS**
- WebRTC 引擎: **[PeerJS](https://peerjs.com/)**
- 图标: **react-icons**

## 💻 本地开发

克隆项目后进入其根目录并运行以下命令：

```sh
# 安装依赖
npm install

# 启动本地开发服务器
npm run dev
```

启动后可在浏览器打开 `http://localhost:4321`，然后在两个不同的窗口（或发送你的 ID 给其它设备上的朋友）体验 WebRTC 聊天与文件拖拽传输功能。

## 📦 构建与部署

```sh
# 执行打包编译
npm run build

# 预览基于 ./dist 目录的生产版本
npm run preview
```
