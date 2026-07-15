# Skills Summary

本文档汇总当前为网站开发安装的 skills。它们主要覆盖前端设计、React/Next.js 工程实践、shadcn/ui、UI/UX 设计扩展、MySQL/Prisma/Auth.js 后端、安全检查和 Web 应用测试。

安装位置主要为 `~/.agents/skills`。新增 skill 通常需要重启 Codex 后完整生效。

## 推荐使用方式

开发网站时建议按下面顺序使用：

1. 产品和页面设计：`ui-ux-pro-max`、`frontend-design`、`web-design-guidelines`
2. 组件落地：`shadcn`、`ckm-ui-styling`
3. React/Next.js 实现：`vercel-react-best-practices`、`next-best-practices`
4. 后端和数据层：`mysql`、`prisma-orm-v7-skills`、`database-migration`
5. 登录和权限：`authjs-skills`、`nextjs-authentication`、`auth-sec`
6. API 设计和验收：`rest-api-design`、`webapp-testing`

## 前端与 Next.js

| Skill | 用途 | 适合场景 |
| --- | --- | --- |
| `frontend-design` | 创建高质量、生产级、视觉上更有辨识度的前端界面。 | 网站、落地页、仪表盘、React 组件、HTML/CSS 页面、美化已有 UI。 |
| `web-design-guidelines` | 按 Web UI/UX 和可访问性规范审查界面。 | UI review、UX audit、检查页面是否符合最佳实践。 |
| `vercel-react-best-practices` | Vercel 工程视角的 React/Next.js 性能优化实践。 | React 组件、Next 页面、数据获取、bundle 优化、性能重构。 |
| `next-best-practices` | Next.js 文件约定、RSC 边界、数据模式、metadata、错误处理、Route Handlers、图片/字体优化等。 | Next.js App Router 项目搭建、重构、排查服务端/客户端边界问题。 |
| `shadcn` | 管理 shadcn/ui 组件和项目。 | 添加、查找、调试、组合、样式化 shadcn/ui 组件；处理 `components.json`。 |
| `webapp-testing` | 使用 Playwright 测试本地 Web 应用。 | 功能验收、UI 行为调试、截图、浏览器日志检查。 |

## UI/UX 与品牌设计扩展

| Skill | 用途 | 适合场景 |
| --- | --- | --- |
| `ui-ux-pro-max` | 综合 UI/UX 设计智能，覆盖多种风格、色板、字体组合、产品类型、UX 指南和图表类型。 | 网站、后台、SaaS、作品集、电商、移动端、组件、图表、配色、排版、响应式、可访问性。 |
| `ckm-ui-styling` | 使用 shadcn/ui、Radix UI、Tailwind 构建美观且可访问的界面。 | 表单、弹窗、下拉菜单、表格、暗色模式、主题色、设计系统落地。 |
| `ckm-design-system` | 设计 token、组件规范、CSS 变量、间距/字体尺度、系统化设计。 | 建立设计系统、统一品牌和组件规范。 |
| `ckm-design` | 综合设计能力，包括品牌识别、设计 token、UI 样式、Logo、CIP、HTML 演示、banner、icon、社媒图片等。 | 品牌视觉、设计资产、多平台营销图、图标和演示物料。 |
| `ckm-brand` | 品牌声音、视觉身份、信息框架、资产管理和品牌一致性。 | 品牌文案、tone of voice、营销资产、品牌合规、style guide。 |
| `ckm-banner-design` | 设计社媒、广告、网站 hero、创意资产和印刷 banner。 | Facebook、X、LinkedIn、YouTube、Instagram、Google Display、网站首屏。 |
| `ckm-slides` | 创建带 Chart.js、设计 token、响应式布局和文案策略的 HTML 演示。 | 战略汇报、数据展示、产品方案、营销演示。 |

这些 UI/UX skills 之间有重叠。实际使用时可把 `ui-ux-pro-max` 当设计总控，`frontend-design` 负责前端界面质量，`ckm-ui-styling` 和 `shadcn` 负责组件落地。

## 后端、数据库与认证

| Skill | 用途 | 适合场景 |
| --- | --- | --- |
| `mysql` | MySQL/InnoDB schema、索引、查询调优、事务、运维和连接问题。 | 设计表结构、加索引、优化慢查询、分析锁、规划迁移、排查复制和连接问题。 |
| `database-migration` | 跨 ORM/平台执行数据库迁移，关注零停机、数据转换和回滚。 | schema 变更、数据迁移、上线迁移方案、回滚策略。 |
| `prisma-orm-v7-skills` | Prisma ORM 7 的关键事实和破坏性变化。 | Prisma 7 升级、生成 client、排查版本差异、迁移 schema。 |
| `authjs-skills` | Auth.js v5 在 Next.js 中的配置和集成，包括 OAuth、Credentials、环境变量和核心 API。 | 设置 Auth.js 登录、Google OAuth、账号密码登录、会话配置。 |
| `nextjs-authentication` | Next.js 15+ App Router 中使用 Auth.js 5 的认证实现模式。 | 保护路由、Server Components/Server Actions 会话、OAuth、RBAC、登录/退出流程。 |
| `rest-api-design` | REST API 资源建模、HTTP 方法、状态码、版本、文档和端点结构。 | 设计 Route Handlers、定义 request/response、API 版本、重构接口。 |
| `auth-sec` | 认证和授权安全入口，覆盖登录、会话、对象权限、JWT、OAuth、CORS、CSRF、SSO。 | 登录安全审查、越权检查、JWT/OAuth 配置、跨域和 CSRF 风险评估。 |

## 风险和注意事项

- `authjs-skills` 安装时被 CLI 标记为 `Critical Risk`。建议只把它当参考资料，涉及命令执行、敏感配置、安全策略时应结合官方文档和项目代码再次核对。
- `ui-ux-pro-max` 安装时被 CLI 标记为 `High Risk`。适合做设计思路和 UI/UX 检查，但不应盲目执行其建议的外部脚本或系统级命令。
- 多个设计类 skills 会给出相近建议。若建议冲突，优先级建议为：项目现有设计规范 > `web-design-guidelines` 的规范检查 > `frontend-design` 的页面质量建议 > `ui-ux-pro-max` 的风格扩展。
- 对 Next.js、Prisma、Auth.js 这类更新快的技术，实际编码时应结合当前项目依赖版本，并必要时查官方文档。

## 技术栈建议

针对计划中的 `Next.js + MySQL + Prisma + Auth.js`：

- 页面和组件：`next-best-practices`、`vercel-react-best-practices`、`shadcn`
- 数据模型：`mysql`、`prisma-orm-v7-skills`
- 数据库变更：`database-migration`
- 登录认证：`nextjs-authentication`、`authjs-skills`
- 权限和安全：`auth-sec`
- 接口设计：`rest-api-design`
- 最终验收：`webapp-testing`

## 已安装清单

前端和测试：

- `frontend-design`
- `web-design-guidelines`
- `vercel-react-best-practices`
- `next-best-practices`
- `shadcn`
- `webapp-testing`

UI/UX 和设计扩展：

- `ui-ux-pro-max`
- `ckm-banner-design`
- `ckm-brand`
- `ckm-design`
- `ckm-design-system`
- `ckm-slides`
- `ckm-ui-styling`

后端、数据库、认证和安全：

- `mysql`
- `database-migration`
- `prisma-orm-v7-skills`
- `authjs-skills`
- `nextjs-authentication`
- `rest-api-design`
- `auth-sec`
