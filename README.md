# Come Chat（来聊吧）

基于 Electron 的桌面端 AI 聊天应用，集成 DeepSeek 大模型，支持流式对话、历史会话管理和 RAG 知识库增强。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 28 |
| 前端 | React 18 + TypeScript + Vite |
| 后端 | Express.js (嵌入 Electron 主进程) |
| AI 模型 | DeepSeek (via LangChain / OpenAI 兼容接口) |
| 向量数据库 | Milvus (知识库 RAG) |
| 本地存储 | SQLite (会话与消息持久化) |
| 文档解析 | pdf-parse + mammoth (支持 txt/pdf/docx) |

## 目录结构

```
electron-come-chat/
├── package.json                  # 根项目配置（Electron + 构建脚本）
├── electron-builder.json         # Electron Builder 打包配置
├── src/
│   ├── main/                     # Electron 主进程
│   │   ├── main.js               # 主进程入口，创建窗口并启动后端
│   │   └── preload.js            # 预加载脚本（安全暴露 API）
│   ├── frontend/                 # React 前端
│   │   ├── index.html            # HTML 入口
│   │   ├── vite.config.ts        # Vite 配置（含 API 代理）
│   │   └── src/
│   │       ├── main.tsx          # React 挂载入口
│   │       ├── App.tsx           # 根组件
│   │       ├── components/
│   │       │   ├── Chat.tsx      # 聊天主组件（消息、会话、输入）
│   │       │   └── Chat.css      # 聊天样式
│   │       └── services/
│   │           └── api.ts        # API 服务层（流式/历史接口封装）
│   ├── backend/                  # Express 后端服务
│   │   ├── .env                  # 环境变量（API Key、数据库地址等）
│   │   ├── package.json          # 后端依赖配置
│   │   └── src/
│   │       ├── app.js            # Express 应用入口（路由挂载、中间件）
│   │       ├── routes/
│   │       │   ├── chat.js       # 聊天接口（流式 SSE、历史会话）
│   │       │   └── admin.js      # 后台管理接口（知识库 CRUD、文件上传）
│   │       ├── services/
│   │       │   └── langchainService.js  # LangChain 流式对话 + RAG 检索
│   │       ├── utils/
│   │       │   ├── sqliteDb.js   # SQLite 数据库初始化与连接
│   │       │   └── milvusClient.js # Milvus 向量数据库客户端
│   │       └── views/
│   │           ├── layout.ejs    # 后台管理页面布局
│   │           └── admin/
│   │               ├── index.ejs # 知识列表页
│   │               └── upload.ejs # 文档上传页
│   └── resources/                # 应用图标资源
│       └── icon.png
```

## 功能特性

- **流式对话** — 基于 SSE 的实时流式响应，打字机效果逐字输出
- **会话管理** — 支持新建/切换/查看历史对话，数据持久化到 SQLite
- **RAG 知识库增强** — 开启后自动检索相关知识片段，增强回答准确度
- **后台管理** — 内置 Web 管理界面，支持上传文档（txt/pdf/docx）并向量化入库
- **跨平台** — 支持 Windows (NSIS)、macOS (DMG)、Linux (AppImage)

## 快速开始

### 环境要求

- Node.js >= 18
- Milvus 向量数据库（需提前启动，默认连接 `localhost:19530`）

### 安装依赖

```bash
# 根目录安装（含 Electron、构建工具）
npm install

# 以上命令会自动执行 postinstall，安装前后端子依赖
```

### 配置环境变量

编辑 `src/backend/.env`：

```env
PORT=3100
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
MILVUS_ADDRESS=localhost:19530
SQLITE_DB_PATH=./data/app.db
JWT_SECRET=your_jwt_secret
```

### 启动开发环境

```bash
npm run dev
```

该命令会同时启动三个进程：
- 后端服务 (Express, 端口 3100)
- 前端开发服务器 (Vite, 端口 5173)
- Electron 窗口（等待前端就绪后自动打开）

### 生产构建

```bash
npm run build
```

构建产物输出到 `release/` 目录。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat/stream` | 流式聊天（SSE） |
| GET | `/api/chat/conversations` | 获取会话列表 |
| GET | `/api/chat/history/:id` | 获取会话消息历史 |
| GET | `/admin` | 知识库管理页 |
| GET | `/admin/upload` | 文档上传页 |
| POST | `/admin/upload` | 上传文档并向量化 |
| POST | `/admin/delete` | 删除知识条目 |
| GET | `/health` | 健康检查 |
