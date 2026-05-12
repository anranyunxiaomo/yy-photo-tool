# ✨ YY小工具 - 纯本地 AI 智能证件照引擎

[![GitHub Pages](https://img.shields.io/badge/部署-GitHub%20Pages-success.svg)](https://anranyunxiaomo.github.io/yy-photo-tool/)
[![PWA Ready](https://img.shields.io/badge/PWA-100%25%20离线可用-blue.svg)](#)
[![Privacy First](https://img.shields.io/badge/隐私保护-纯本地运算-orange.svg)](#)

这是一款完全在浏览器内运行的**智能证件照制作与排版工具**。基于极简的 Apple UI 审美（Glassmorphism）打造，实现了从图片裁剪、人像智能抠图、到背景色替换的完整工作流。

**最核心的特性是：应用一旦加载，将实现 100% 离线脱网运行，照片和隐私绝不上传任何服务器！**

## 🌐 线上体验地址
👉 [**点此立刻体验**](https://anranyunxiaomo.github.io/yy-photo-tool/) (手机端建议使用 Safari 或系统浏览器打开并**添加至主屏幕**以获得原生 App 体验)

---

## 🌳 分支架构说明

为了满足不同使用场景（极速加载 vs 超高画质），本项目拆分为了两大核心分支：

### 1. `main` 分支（极速轻应用版，当前默认）
这是面向大众用户的**默认线上版本**。
- **底层引擎**: Google `MediaPipe` (Selfie Segmentation)
- **优势**: 极其轻量！底层 WASM 与模型总大小**不到 3MB**，在任何网络环境下均可实现“秒开”与极速渲染。
- **性能**: 完全在主线程极速推断，低端手机也能达到 30fps+ 的运算响应速度，对 PWA 离线环境最友好。

### 2. `RMBG` 分支（工业级发丝超清版）
这是面向极致画质要求的**封存大模型版本**。
- **底层引擎**: 基于 `Transformers.js` (Web Worker 离线版) + `briaai/RMBG-1.4` (40MB 高精模型)。
- **优势**: 提供目前开源界最强的发丝级抠图效果。
- **性能**: 由于需要巨大的张量运算，我们为其配备了独立的多线程 `worker.js`，避免 UI 卡死。首次加载可能需要长达数十秒的下载，但抠图边缘质量无可挑剔。

---

## 🎨 核心功能亮点

- ✂️ **标准证件照裁剪**: 内置一寸、二寸标准比例预设，同时支持自由自定义毫米级尺寸。
- 🪄 **一键 AI 抠图**: 在本地运行神经网络模型剥离背景，速度极快。
- 🌈 **智能底色替换**: 内置标准红底、蓝底、白底、灰底及樱花粉底，一键切换。
- 📱 **纯正 PWA 体验**: 完全基于 Web App Manifest 与 Service Worker (`v25`) 技术构建，不仅可以在电脑端即开即用，在手机端添加到主屏幕后，断网状态下依旧能够流畅进行所有的 AI 抠图。
- 🍎 **iOS 保存机制兼容**: 针对 iOS Safari 对于直接生成文件的安全限制，提供了友好的“弹窗长按提取”体验。

---

## 💻 本地开发指南

由于项目已经是纯静态文件，您可以克隆代码后直接运行：

```bash
# 1. 克隆项目
git clone https://github.com/anranyunxiaomo/yy-photo-tool.git

# 2. 进入目录
cd yy-photo-tool

# 3. 启动一个任意的本地 HTTP 服务 (例如 Python)
python3 -m http.server 8080
```
然后在浏览器中访问 `http://127.0.0.1:8080` 即可开始测试。

---

## 📜 许可证 (License)
本项目仅供学习与交流使用，底层所调用的 AI 权重遵循各自模型发行方的开源许可协议。
