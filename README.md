<div align="center">
  <img src="public/icons/icon.svg" width="72" height="72" alt="公考题库图标" />
  <h1>公考题库</h1>
  <p>面向学生端的公考刷题、专项训练、错题复盘与知识助教系统。</p>
</div>

> [!NOTE]
> 项目以确定性的训练流程为核心：设定考试目标、完成基准训练、按知识点专项练习、复盘错题，再进行定时重测。

## 功能

- **真题与专项练习**：按历年试卷或叶子知识点创建训练，支持基础训练规则与题库库存校验。
- **做题工作区**：支持严格/灵活计时、暂停、自动保存、离线草稿、答题卡与提交确认。
- **结果与错题复盘**：展示答案解析、训练对比、错题恢复、重练与错因报告。
- **学习情况**：基于服务端统计展示正确率、薄弱知识点与下一步训练建议。
- **知识助教**：围绕当前题目和课程知识库进行追问，支持流式回复与结构化错因记录。
- **PWA 支持**：提供安装入口与本地草稿存储，弱网场景下保留未提交内容。

## 技术栈

| 层级 | 方案 |
| --- | --- |
| Web | Next.js 16、React 19、TypeScript、Tailwind CSS |
| UI | Base UI、shadcn 风格组件、Lucide、ECharts |
| 数据 | Prisma 7、MariaDB |
| 助教与检索 | AI SDK、OpenAI 兼容接口、Qdrant |
| 测试 | Vitest |

## 快速开始

### Codex 一键启动

本地已准备好 `.env.local` 后，可让 Codex 或终端执行：

```bash
./scripts/codex-start.sh
```

也可以使用 `pnpm codex:start`。脚本会检查 Node、Docker、磁盘与依赖，启动 MariaDB，生成 Prisma Client，应用已有迁移，并从 `3002` 开始选择可用端口。启动时会监听 `0.0.0.0`，自动识别主网卡 IPv4 并将 Auth.js 地址配置为局域网访问地址，因此同一局域网内的设备可以正常登录和练习。知识库检索需要 Qdrant 时使用 `./scripts/codex-start.sh --with-qdrant`；需要先快进远程最新代码时使用 `./scripts/codex-start.sh --update`。

如果需要固定域名或手动指定访问地址，可使用：

```bash
CODEX_AUTH_URL=http://172.25.13.76:3002 pnpm codex:start
```

### 1. 准备环境

- Node.js `20.19+`
- Docker 与 Docker Compose（用于 MariaDB；知识库检索启用时同时启动 Qdrant）

```bash
git clone https://github.com/mpbfx/gongkao.git
cd gongkao
cp .env.example .env.local
docker compose -f docker-compose.dev.yml up -d
npm install
```

### 2. 配置与初始化

在 `.env.local` 中至少确认以下配置：

```env
DATABASE_URL="mysql://root:password@127.0.0.1:3306/gongkao_question_bank"
AUTH_SECRET="请替换为随机密钥"
AUTH_URL="http://localhost:3000"
```

如需启用助教，在同一文件中补充 `OPENAI_API_KEY`、`OPENAI_MODEL`；如需启用课程知识检索，再配置 Qdrant 与嵌入模型相关变量。

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)。

> [!TIP]
> `docker-compose.dev.yml` 默认将 MariaDB 映射到 `127.0.0.1:3306`，Qdrant 映射到 `127.0.0.1:6333`；仅做基础刷题时可以保留助教和检索相关环境变量为空。

## 常用命令

```bash
# 开发与生产构建
npm run dev
npm run build
npm start

# 质量检查
npm run lint
npm run typecheck
npm test

# 数据库
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run prisma:studio

# 课程知识库
npm run knowledge:import
npm run knowledge:resume
npm run knowledge:reindex
npm run knowledge:eval
```

## 项目结构

```text
src/
├─ app/          # App Router 页面与 API 路由
├─ components/   # 通用 UI、布局与交互组件
├─ features/     # 做题、错题、专项、助教等前端功能
├─ lib/          # 认证、离线草稿、展示与共享工具
└─ server/       # 服务、仓储、训练规则与助教运行时
prisma/          # Schema、迁移与种子数据
public/          # PWA 图标与静态资源
tools/           # 题库抓取、导入与知识处理工具
docs/            # 产品、架构与数据设计文档
```

## 配置说明

| 配置项 | 用途 |
| --- | --- |
| `DATABASE_URL` | MariaDB 连接地址 |
| `AUTH_SECRET` / `AUTH_URL` | 登录会话与站点地址 |
| `OPENAI_*` | 助教模型与兼容 API 配置 |
| `TUTOR_AUTO_REVIEW_*` | 提交后的自动错因分析 |
| `QDRANT_*` | 课程知识库检索服务 |
| `EMBEDDING_*` | 文档向量化模型与批处理参数 |

完整变量清单见 [`.env.example`](.env.example)。请勿提交 `.env.local`、真实密钥或生产数据。

## 训练规则

- 基础训练固定从一个有效叶子知识点抽取 15 题，答对至少 9 题才通过。
- 题目优先选择未做过的题，其次是历史错题，再次是最久未练习的题。
- 分数、正确性、掌握状态、错题状态与统计均由服务端统一计算和持久化。
- 严格计时到期后锁定答案；灵活计时记录暂停次数与暂停时长；离线草稿在浏览器恢复后可继续提交。
