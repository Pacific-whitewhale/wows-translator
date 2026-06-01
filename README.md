# WoWS Translator — 海战黑话翻译姬

[![Electron](https://img.shields.io/badge/Electron-42.x-47848f?logo=electron)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

> A floating desktop meme translator for World of Warships random battle chat.
> 一个悬浮在桌面上的《战舰世界》随机战聊天黑话翻译器。

<p align="center">
  <img src="./screenshot.png" alt="screenshot" width="420" />
</p>

---

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 🔍 **黑话翻译** | 输入一句海战黑话，输出表面含义、真实含义、盐分指数、甩锅指数和推荐回复 |
| 🎲 **随机换词** | 随机抽取一条已收录的黑话，看看别人都在阴阳什么 |
| 💬 **随机真话** | 随机展示一条战舰世界人生哲理（扎心真相） |
| 📋 **复制结果** | 一键复制翻译结果，粘贴到聊天框反击 |
| 🪟 **悬浮置顶** | 无边框透明窗口，始终置顶，不遮挡游戏画面 |

## 🧠 匹配机制

翻译引擎采用多层匹配策略，逐级降级：

| 层级 | 匹配方式 | 置信度 | 说明 |
|------|----------|--------|------|
| 1 | 精确匹配 | 100% | 输入与原词条完全一致 |
| 2 | 别名匹配 | 98% | 输入命中词条别名（如 `no supp` → `no support`） |
| 3 | 包含匹配 | 85% | 输入包含词条或词条包含输入 |
| 4 | 关键词匹配 | ~70-85% | 基于中英文关键词提取 + Jaccard 相似度 |
| 5 | 模糊匹配 | ~58-72% | 编辑距离（Levenshtein）+ Jaccard + 关键词加权组合 |
| 6 | 兜底回复 | 0% | 未命中词库时返回默认调侃 |

同时包含英文缩写展开（`supp` → `support`）、中文口语规范化（`为啥` → `为什么`）等预处理。

## 📦 技术栈

- **框架**: [Electron](https://www.electronjs.org/) — 桌面端跨平台
- **前端**: 原生 HTML / CSS / JavaScript，无额外依赖
- **匹配算法**: Levenshtein 编辑距离 + Jaccard 相似度 + 关键词重叠 + 中文分词
- **数据**: 本地 JSON 词库（`phrases.json` / `truths.json` / `class_dialogues.json`）
- **构建**: [electron-builder](https://www.electron.build/) — 打包为 Windows NSIS 安装包

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装运行

```bash
# 克隆仓库
git clone https://github.com/Pacific-whitewhale/wows-translator.git
cd wows-translator

# 安装依赖
npm install

# 启动应用
npm start
```

### 打包

```bash
# 仅打包目录（调试用）
npm run pack

# 打包为安装包
npm run dist
```

打包产物在 `dist/` 目录下。

## 📁 项目结构

```
wows-translator/
├── index.html          # 主界面
├── main.js             # Electron 主进程
├── preload.js          # 预加载脚本（安全桥接）
├── renderer.js         # 渲染进程（翻译引擎核心）
├── style.css           # 毛玻璃 UI 样式
├── package.json        # 项目配置 & 构建脚本
├── data/
│   ├── phrases.json    # 黑话词库
│   ├── truths.json     # 随机真话库
│   └── class_dialogues.json  # 舰种特色对话
└── docs/
    ├── contributing_phrases.md  # 贡献词条指南
    ├── fuzzy_matching.md        # 模糊匹配策略说明
    └── tone_guide.md            # 语气风格指南
```

## 🤝 贡献词条

欢迎提交 PR 扩充词库！请参考 [贡献指南](./docs/contributing_phrases.md) 和 [语气风格指南](./docs/tone_guide.md)。

新增词条格式（`data/phrases.json`）：

```json
{
  "phrase": "no support",
  "aliases": ["no help", "where support"],
  "keywords": ["support", "help", "team"],
  "surface_meaning": "缺少队友支援。",
  "real_meaning": "我冲到了一个没人能救的位置，但我希望你看到并质疑团队而不是我。",
  "salt_score": 82,
  "blame_score": 90,
  "reply": "支援在路上，只是路比较远。",
  "tags": ["甩锅", "支援", "抱怨"]
}
```

## ⚠️ 免责声明

本项目与 Wargaming 无关，仅供娱乐用途。Not affiliated with Wargaming. For entertainment only.

## 📄 License

MIT
