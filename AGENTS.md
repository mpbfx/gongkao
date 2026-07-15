# Repository Guidelines

## Project Structure & Module Organization

The repository root is a Next.js App Router application. Routes and API handlers are under `src/app/`; reusable UI is in `src/components/`; domain code is grouped in `src/features/`; shared utilities belong in `src/lib/`; and server-only policies, repositories, services, and agent workflows live in `src/server/`. Prisma schema, migrations, and seed data are in `prisma/`, while static assets are in `public/`. Scraping and import utilities are isolated in `tools/saduck-scraper/`.

## Build, Test, and Development Commands

Run application commands from the repository root:

- `npm install` installs the locked Node dependencies (Node `20.19+` is required).
- `npm run dev` starts the local Next.js development server.
- `npm run build` creates a production build; `npm start` serves it.
- `npm run lint` checks Next.js and TypeScript ESLint rules.
- `npm run typecheck` runs strict TypeScript validation without emitting files.
- `npm test` runs the Vitest suite once.
- `npm run prisma:migrate` applies development migrations; `npm run prisma:seed` loads seed data.

Copy `.env.example` to `.env.local` before database or authentication work.

## Coding Style & Naming Conventions

Use TypeScript with strict types, ES modules, and the `@/` alias for `src/`. Match the existing two-space indentation and semicolon style. Name React components and exported types in `PascalCase`, functions and variables in `camelCase`, and route or feature files in descriptive kebab-case. Keep browser components, server logic, and persistence concerns in their established layers. Run lint and typecheck before submitting.

## Testing Guidelines

Vitest uses the Node environment and discovers `src/**/*.test.ts`. Place tests beside the implementation, for example `recommendation-engine.test.ts`. Add focused tests for service rules, agent behavior, validation, and regressions. There is no fixed coverage threshold; changed business logic should be meaningfully exercised.

## Commit & Pull Request Guidelines

Commit titles must use `<type>: <中文简短信息>`, without scope, terminal punctuation, or English prose. Use only `feat`, `fix`, `refactor`, `docs`, `chore`, or `test`, selected by the actual change. Merge commits use `chore: 合并 PR #编号`. Keep each commit scoped to one coherent change. Pull requests should explain the problem and solution, note schema or environment changes, link relevant issues, and include screenshots for visible UI changes. Report the commands used to verify the change.

- Pull request title and body must be written in clear, natural Chinese. Keep technical identifiers, file paths, commands, branch names, and API names in their original form.
- Pull request descriptions should use Chinese headings to summarize the changes, motivation, data/configuration impact, validation commands, and any follow-up work.

## Security & Configuration

Never commit `.env.local`, credentials, API keys, or production data. Review generated Prisma migrations before committing them.

## Training-Flow Implementation Guidelines

The student product is a deterministic training system, not a collection of loosely connected quiz pages. Preserve the flow from exam goal, benchmark, leaf-type foundation practice, review, timed retest, and wrong-question practice.

### Domain boundaries

- Keep question source and learning intent separate. `PracticeMode` describes where questions come from; `PracticePurpose` describes why the session exists. Do not overload one field with both meanings.
- Keep scoring, foundation-pass rules, next-action selection, and comparison calculations in small pure functions. Pages and client components should render service results rather than reimplement business rules.
- Treat the server as authoritative for scores, correctness, mastery, wrong-question state, and tag statistics. Client calculations are display-only.
- Give each workflow one clear owner: exam-goal services select benchmarks, practice services create and submit sessions, foundation services select leaf questions, and comparison services compare submitted papers.

### KISS and coupling control

- Prefer deterministic rule services over new agents, queues, workflow engines, or global state stores when the rule can be expressed directly.
- Introduce a component, hook, or service only when it has one stable responsibility and removes real duplication or state coupling. Do not split short cohesive code merely to increase file count.
- Extract focused hooks for complex browser concerns such as timing, offline drafts, and event logging. Keep persistence and scoring out of presentation components.
- Handle states supported by the current product: loading, empty inventory, offline drafts, timed expiry, repeated submission, and ownership checks. Avoid speculative state branches.
- Do not create parallel sources of truth. Aggregate tables such as `UserTagStats` must be updated in the same transaction as submitted answers and covered by tests.

### Practice and taxonomy rules

- A foundation round uses exactly 15 questions from one active leaf tag and passes at 9 correct answers. Ordinary special practice does not change foundation status.
- A leaf with fewer than 15 active questions is reported as insufficient inventory and excluded from foundation completion totals. Do not fabricate questions or mark it complete.
- Prefer unseen questions, then historical wrong questions, then least-recently practiced questions. Keep selection logic in the foundation service.
- Parent tags are navigation and aggregation nodes. Bind practice to stored leaf taxonomy data instead of inferring parents from Chinese display names at runtime.
- Show taxonomy hints after submission or during review when showing them before answering would reveal the solving method.

### Submission, timing, and offline data

- Submit answers, scores, behavior events, wrong-question changes, and tag statistics in one database transaction. Reject repeated submission before changing aggregates.
- Strict timed sessions hide pause controls and lock answers at expiry. Flexible timed sessions record pause count and paused seconds. Untimed sessions retain count-up behavior.
- Batch behavior events with final submission instead of sending a request for every click. Keep the event vocabulary small: view, answer change, skip, return, pause, resume, and expiry.
- Extend IndexedDB draft shapes with optional fields and defaults so existing drafts remain readable. Preserve answers, per-question time, notes, scratch work, timing state, and pending submission together.

### Tutor and review data

- Interactive tutor messages support open-ended follow-up questions but do not rewrite structured mistake analysis on every turn.
- Automatic post-submission review owns the structured mistake record for a practice answer. Keep chat persistence and mistake-review persistence separate.
- Learning comparisons report observable facts such as score, time, module accuracy, skips, returns, and answer changes. Do not invent psychological conclusions from behavior data.

### Verification expectations

- Add boundary tests for pure rules, especially 8/15 versus 9/15, weighted-score fallback, benchmark matching, and comparison deltas.
- Add service tests for transactionally updated answers, events, wrong questions, and tag statistics, including repeated-submission protection.
- After schema changes, run Prisma validation and generation, apply the development migration, then run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
- Verify timed, offline, result-comparison, foundation, and wrong-review flows at mobile width and at 1280px and 1440px desktop widths.

## Frontend Product and Design Philosophy

### Scope and product truth

- 先围绕当前已经实现的学生端功能和真实代码工作；未开发、无关或不在本轮范围内的模块不应驱动页面设计。
- 不因为设计稿而虚构业务能力、数据、趋势、接口或操作路径。没有真实状态、接口或服务支撑的按钮、入口、标签、快捷操作和装饰性控制应直接删除，而不是做成“看起来能用”的假功能。
- 保留现有核心业务流程和入口语义：登录、开练、专项组卷、答案保存、暂停、离线草稿、提交、历史回看、错题掌握、助教和报告筛选。
- 真实内容优先于视觉装饰；中文文案必须自然、准确、可读，不生成乱码、占位 lorem ipsum 或无意义数据。

### Architecture and maintainability

- 保持 App Router、Server Component 数据读取边界、Client Component 交互边界、服务层、API 返回类型、数据库和练习状态机稳定；视觉重构不应反向侵入后端领域逻辑。
- 遵循高内聚、低耦合。组件职责单一，页面编排、交互控制、展示组件、纯逻辑工具和服务调用应合理分层，避免继续堆叠成“万能页面组件”。
- 复用优先：先查找并复用现有组件、hooks、工具函数、状态组件和公共逻辑，再决定是否抽象新能力。通用场景优先使用项目已有的 shadcn/Base UI、Lucide 和成熟开源方案，不为追求短代码重复造轮子。
- 新增构件应是小而稳定的基础能力，例如页面骨架、编辑式页眉、数据账簿、纸张画布、状态面板、固定操作栏；不要用新的全局状态管理、动画框架或运行时依赖解决局部视觉问题。
- 对已被多处引用的导出保持兼容，优先通过包装层或渐进迁移完成重构；不得为了视觉改造破坏既有调用方。

### Visual and interaction direction

- 设计稿是信息层级、构图和体验方向的参考，不直接作为页面图片使用；最终实现必须由 React、Tailwind、现有组件和可维护的 CSS 完成。
- 学生端可以大胆重构布局和视觉语言，但跨页面必须保持统一的配色、字体、图标、间距、圆角、边界、状态色和交互反馈。视觉应有明确的产品概念，避免模板化后台和泛化的“AI 风格”。
- “备考编辑部”方向强调编辑式排版、答题纸、卷宗、墨线和批改标记；装饰必须服务于信息层级和操作效率，不能吞噬题目、解析、答题卡或助教的有效空间。
- 优先使用清晰的非对称分栏、连续版面、墨线和留白建立层级，减少同质化圆角卡片、无意义阴影、过度渐变、玻璃拟态和漂浮装饰。
- 信息密度应服从任务：KPI 和状态信息紧凑，核心题目、解析、答题卡和助教获得足够空间；重要操作不应被装饰或重复信息挤出首屏。
- 交互控件必须有真实反馈：加载、空数据、搜索无结果、接口错误、离线、禁用、悬停、焦点、提交中、暂停、弹窗和恢复状态都应与现有业务逻辑一致。
- 不为“看起来完整”添加没有业务价值的活动轨道、历史入口、标记入口、纠错入口、重复标签或虚假的推荐按钮；当已有页面已经提供同一信息时，优先合并而不是重复展示。

### Responsive and accessibility requirements

- 桌面端和移动端都必须保持可用。桌面视觉重构可以使用 `lg:` 断点，但不得破坏移动端现有导航、流程和触控操作。
- 保证键盘可达、焦点可见、颜色对比度足够、交互目标尽量达到 44px，并支持 `prefers-reduced-motion`。
- 固定栏、滚动面板、答题卡和助教面板必须有清晰的滚动边界，不能因为 `height: 100%`、sticky 或嵌套 flex 造成内容被挤出视口。
- 页面结构要能被屏幕阅读器理解：导航、主要内容、题目、答案状态、错误提示和提交状态使用语义化元素与可访问名称。

### Assets, data, and verification

- 静态图片、纹理、插画或图标如果确有必要，应优先使用本地、可许可、可压缩的资源；不得让生产页面依赖未经确认的第三方运行时地址。
- 不新增后端不存在的统计维度、趋势数据或业务字段；展示数据必须来自现有服务返回值，并正确处理空值和异常。
- 可参考或生成设计稿，但每次实现都要在 1280px 和 1440px 等桌面尺寸进行真实截图检查，重点比较首屏构图、栏宽、密度、滚动和固定区域。
- 涉及交互的改动至少验证对应真实流程，并在提交前运行 `npm run lint`、`npm run typecheck`、`npm test` 和 `npm run build`。
