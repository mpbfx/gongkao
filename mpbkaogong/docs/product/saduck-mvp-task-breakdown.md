# 公考题库系统 MVP 开发任务拆分文档

关联文档：

- `saduck-questionbank-requirements.md`
- `saduck-technical-architecture.md`
- `saduck-database-design.md`
- `saduck-api-design.md`
- `saduck-interaction-design.md`

技术栈：

- Next.js
- MySQL
- Prisma
- Auth.js
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zod
- Dexie / IndexedDB

## 1. MVP 目标

MVP 目标是先做出一个可用的移动端优先刷题系统，覆盖最核心闭环：

```txt
登录 -> 浏览试卷 -> 开始练习 -> 答题 -> 提交 -> 查看结果 -> 查看练习记录
```

MVP 不追求一次性复刻全部能力，优先保证：

- 数据模型稳定。
- 答题体验完整。
- 提交流程可靠。
- 练习记录可追溯。
- 后续专项、错题、统计可以自然接入。

## 2. 阶段总览

| 阶段 | 名称 | 目标 |
|---|---|---|
| Phase 0 | 项目初始化 | 搭好工程、数据库、基础规范 |
| Phase 1 | 认证与基础数据 | 用户登录、Prisma schema、种子数据 |
| Phase 2 | 历年试卷刷题闭环 | 试卷列表、创建练习、答题、提交 |
| Phase 3 | 练习记录与复盘 | 历史记录、结果回看、答案解析 |
| Phase 4 | 专项练习与每日一练 | 分类树、专项组卷、每日一练 |
| Phase 5 | 错题本与背题模式 | 错题沉淀、错题练习、背题 |
| Phase 6 | 移动端体验增强 | PWA、本地恢复、弱网保护 |
| Phase 7 | 管理后台基础版 | 题目、试卷、分类管理 |

建议实际 MVP 截止点：

- 必做：Phase 0 到 Phase 3。
- 强烈建议：Phase 4。
- 可后置：Phase 5 到 Phase 7。

## 3. Phase 0：项目初始化

目标：创建可开发、可运行、可测试的基础工程。

### 0.1 创建 Next.js 项目

任务：

- 初始化 Next.js App Router 项目。
- 使用 TypeScript。
- 启用 ESLint。
- 配置 Tailwind CSS。
- 安装 shadcn/ui。

交付物：

- `package.json`
- `app/`
- `components/`
- `lib/`
- `tailwind.config.ts`

验收标准：

- `npm run dev` 可启动。
- 首页可访问。
- Tailwind 样式生效。
- shadcn/ui Button 可正常渲染。

### 0.2 安装核心依赖

任务：

- 安装 Prisma、Auth.js、Zod、TanStack Query、Dexie。
- 配置基础别名。

建议依赖：

```txt
@prisma/client
prisma
next-auth
zod
@tanstack/react-query
dexie
lucide-react
```

验收标准：

- 依赖安装成功。
- TypeScript 无类型错误。

### 0.3 建立目录结构

任务：

创建目录：

```txt
app/
  (auth)/
  (app)/
  api/
components/
  ui/
  layout/
  practice/
  question/
features/
  auth/
  papers/
  practice/
  records/
  tags/
  wrong-questions/
lib/
  api/
  auth/
  db/
  validators/
  offline/
server/
  services/
  repositories/
  policies/
prisma/
```

验收标准：

- 目录结构和架构文档一致。
- 页面层、业务层、服务层边界清晰。

## 4. Phase 1：认证与基础数据

目标：完成登录、数据库 schema、基础种子数据。

### 1.1 配置 MySQL 与 Prisma

任务：

- 创建 MySQL 数据库。
- 配置 `.env` 中 `DATABASE_URL`。
- 创建 `prisma/schema.prisma`。
- 根据数据库设计文档落地第一版 schema。
- 执行迁移。

交付物：

- `prisma/schema.prisma`
- migration 文件。

验收标准：

- `npx prisma migrate dev` 成功。
- `npx prisma studio` 可打开。
- 数据库表结构生成正确。

### 1.2 配置 Auth.js

任务：

- 接入 Auth.js。
- 配置 Prisma Adapter。
- 实现 session 获取工具。
- 实现 `requireUser`、`requireAdmin`。
- 第一版可优先支持邮箱密码登录，或先接一个 OAuth。

交付物：

- `lib/auth.ts`
- `app/api/auth/[...nextauth]/route.ts`
- 登录页。

验收标准：

- 用户可以登录。
- `/api/me` 返回当前用户。
- 未登录访问受限 API 返回 401。

### 1.3 基础 UI Shell

任务：

- 实现 AppShell。
- 实现移动端 BottomTabBar。
- 实现桌面端 Sidebar。
- 实现 TopBar。

验收标准：

- 移动端显示底部导航。
- 桌面端显示侧边导航。
- 页面主体不会被底部栏遮挡。

### 1.4 种子数据

任务：

- 准备少量题目、选项、试卷、分类。
- 使用 Prisma seed 导入。
- 至少包含：
  - 1 套试卷。
  - 20 道题。
  - 3 个专项分类。
  - 单选、多选、判断题。

交付物：

- `prisma/seed.ts`

验收标准：

- `npx prisma db seed` 成功。
- 试卷列表能查到数据。

## 5. Phase 2：历年试卷刷题闭环

目标：完成最小刷题闭环。

### 2.1 试卷列表 API

任务：

- 实现 `GET /api/papers`。
- 实现分页。
- 支持年份、地区、类型筛选。

验收标准：

- 返回统一响应结构。
- 支持空列表。
- 参数非法返回 400。

### 2.2 试卷详情 API

任务：

- 实现 `GET /api/papers/{paperId}`。
- 返回试卷基础信息、模块模型、题目列表。
- 未提交前不返回答案和解析。

验收标准：

- 登录用户可获取试卷题目。
- 非会员访问会员试卷返回 403。
- 不存在的试卷返回 404。

### 2.3 创建练习 API

任务：

- 实现 `POST /api/practice/sessions`。
- 创建 `PracticeSession`。
- 生成题目快照或题目顺序。
- 返回 session 与题目。

验收标准：

- 创建成功后状态为 `IN_PROGRESS`。
- 重复开始同一试卷可以创建新 session。
- 返回题目顺序稳定。

### 2.4 试卷列表页

任务：

- 实现 `/question-bank/papers`。
- 展示试卷卡片。
- 支持筛选。
- 支持 loading、empty、error。

验收标准：

- 移动端无横向滚动。
- 筛选后列表刷新。
- 点击卡片可进入详情或开始练习。

### 2.5 答题页基础版

任务：

- 实现 `/practice/[sessionId]`。
- 展示题目、材料、选项。
- 支持上一题、下一题。
- 支持单选、多选、判断。
- 支持答题卡。
- 支持计时器。

验收标准：

- 可完成一套试卷所有题目。
- 移动端底部操作栏不遮挡内容。
- 答题卡题号状态正确。

### 2.6 提交练习 API

任务：

- 实现 `POST /api/practice/sessions/{sessionId}/submit`。
- 校验 session 归属。
- 计算正确、错误、未答、正确率。
- 写入 `PracticeAnswer`。
- 更新 `PracticeSession`。
- 使用事务。

验收标准：

- 已提交 session 不能重复提交。
- 提交结果准确。
- 提交后返回答案和解析。
- 异常时不产生半写入数据。

### 2.7 答题页提交与结果态

任务：

- 实现提交确认弹窗。
- 实现完成率不足 50% 提示。
- 提交后切换结果态。
- 显示正确答案、我的答案、解析、正确率。

验收标准：

- 提交中按钮不可重复点击。
- 提交失败不丢答案。
- 提交后选项不可再改。

## 6. Phase 3：练习记录与复盘

目标：用户可以查看历史练习和回看解析。

### 3.1 练习记录 API

任务：

- 实现 `GET /api/records`。
- 支持分页。
- 支持按 mode 筛选。

验收标准：

- 只返回当前用户记录。
- 按提交时间倒序。
- 无记录时返回空列表。

### 3.2 练习详情 API

任务：

- 实现 `GET /api/records/{recordId}`。
- 返回题目、用户答案、正确答案、解析。

验收标准：

- 只能查看自己的记录。
- 记录不存在返回 404。

### 3.3 练习记录页

任务：

- 实现 `/question-bank/records`。
- 展示统计卡片。
- 展示练习记录列表。
- 点击记录进入回看。

验收标准：

- 移动端记录卡片信息完整。
- 点击历史记录可进入结果态答题页。

### 3.4 历史回看模式

任务：

- 答题页支持 `REVIEW`。
- 默认显示答案和解析。
- 不允许修改答案。

验收标准：

- 历史记录题目与当次作答一致。
- 答题卡正确/错误状态准确。

## 7. Phase 4：专项练习与每日一练

目标：完成定向训练能力。

### 4.1 专项分类 API

任务：

- 实现 `GET /api/tags`。
- 返回树结构。

验收标准：

- 支持多级分类。
- 只返回 active 分类。

### 4.2 专项练习创建 API

任务：

- 实现 `POST /api/practice/sessions/special`。
- 支持知识点、题量、难度。
- 校验材料类专项不能混练。
- 随机抽题。

验收标准：

- 总题数少于 5 返回业务错误。
- 无题目返回业务错误。
- 返回 session 可进入答题页。

### 4.3 专项练习页

任务：

- 实现 `/question-bank/special`。
- 展示难度 segmented control。
- 展示分类树。
- 支持选择节点和题量。
- 展示已选汇总。
- 支持清空和开始练习。

验收标准：

- 移动端底部操作栏显示已选数量和预计题数。
- 材料类混选有明确提示。

### 4.4 每日一练

任务：

- 实现 `GET /api/daily-practice/today`。
- 实现 `POST /api/practice/sessions/daily`。
- 在题库首页和专项页显示每日一练入口。

验收标准：

- 点击每日一练可进入答题页。
- 今日已完成时显示查看记录。

## 8. Phase 5：错题本与背题模式

目标：让用户可以围绕错题复习。

### 5.1 错题沉淀

任务：

- 提交练习时 upsert `WrongQuestion`。
- 答对后可标记掌握。

验收标准：

- 答错题进入错题本。
- 同一题多次答错累计 wrongCount。

### 5.2 错题 API

任务：

- 实现 `GET /api/wrong-questions`。
- 实现 `POST /api/practice/sessions/wrong`。
- 实现 `POST /api/wrong-questions/{id}/resolve`。

验收标准：

- 按 tag 聚合错题。
- 错题不足时返回业务错误。
- 可创建错题练习。

### 5.3 我的错题页

任务：

- 在 `/question-bank/records` 或独立 `/question-bank/wrong` 展示错题。
- 支持展开分类。
- 支持练习和背题。

验收标准：

- 背题模式选择后立即显示解析。
- 普通错题练习提交后沉淀新结果。

## 9. Phase 6：移动端体验增强

目标：提升真实移动端可用性。

### 6.1 IndexedDB 本地恢复

任务：

- 使用 Dexie 保存答题状态。
- 保存 currentIndex、answers、elapsedSeconds、timeSpent。
- 页面刷新后恢复。

验收标准：

- 刷新页面后答案不丢。
- 提交成功后清除本地缓存。

### 6.2 PWA

任务：

- 配置 manifest。
- 配置图标、名称、主题色。
- 支持添加到桌面。

验收标准：

- Chrome Lighthouse PWA 基础项通过。
- 手机浏览器可添加到主屏幕。

### 6.3 弱网提交保护

任务：

- 提交失败保留本地提交草稿。
- 提示用户稍后重试。

验收标准：

- 断网提交不会丢答案。
- 网络恢复后可以再次提交。

### 6.4 草稿纸

任务：

- 实现 `DraftCanvas`。
- 支持触摸绘制。
- 支持画笔、橡皮、撤销、清空和关闭；底色切换作为后续增强。
- 草稿按题保存到 IndexedDB，切题后自动恢复对应草稿。
- 提交后结果页和错题回看可只读查看草稿。

验收标准：

- 移动端触摸绘制流畅。
- 草稿纸开启时不会误触选项。
- 切题、刷新、离线恢复后，已写草稿不会丢失。

## 10. Phase 7：管理后台基础版

目标：支持维护题库数据。

### 7.1 管理后台权限

任务：

- 实现 Admin 路由保护。
- 管理员导航。

验收标准：

- 非管理员不可访问后台。

### 7.2 题目管理

任务：

- 题目列表。
- 创建题目。
- 编辑题目。
- 软删除题目。

验收标准：

- 支持单选、多选、判断。
- 支持富文本题干和解析。

### 7.3 试卷管理

任务：

- 创建试卷。
- 维护题目顺序。
- 设置模块分组。

验收标准：

- 新建试卷可在前台列表出现。
- 答题卡分组正确。

### 7.4 批量导入

任务：

- 上传 JSON/CSV。
- 创建 ImportJob。
- 展示导入结果。

验收标准：

- 成功和失败行数可追踪。
- 失败原因可查看。

## 11. 横向工程任务

### 11.1 API 工具

任务：

- 实现统一 `ok()`、`fail()`。
- 实现 `parseJson()`、`parseQuery()`。
- 实现错误处理中间层或包装函数。

验收标准：

- 所有 API 响应格式一致。

### 11.2 权限工具

任务：

- `requireUser()`
- `requireAdmin()`
- `requireMember()`
- `assertOwner()`

验收标准：

- 受限接口无越权访问。

### 11.3 测试

任务：

- 服务层单元测试。
- API 集成测试。
- 答题页组件测试。
- 关键流程 E2E。

优先测试：

- 提交判分。
- 多选题判分。
- 错题 upsert。
- 试卷题序。
- 权限拦截。

### 11.4 数据安全

任务：

- 富文本白名单清洗。
- 防止 XSS。
- 管理后台输入校验。

验收标准：

- 题干和解析渲染不执行脚本。

## 12. 推荐开发顺序

严格顺序：

1. Phase 0：项目初始化。
2. Phase 1.1：Prisma schema。
3. Phase 1.2：Auth.js。
4. Phase 1.4：种子数据。
5. Phase 2.1 到 2.3：试卷和练习 API。
6. Phase 2.4 到 2.5：试卷页和答题页。
7. Phase 2.6 到 2.7：提交和结果态。
8. Phase 3：记录与回看。
9. Phase 4：专项练习。
10. Phase 6.1：本地恢复。
11. Phase 5：错题。
12. Phase 7：管理后台。

## 13. 里程碑验收

### Milestone A：工程可运行

验收：

- 项目启动成功。
- 数据库迁移成功。
- 登录成功。
- `/api/me` 正常。

### Milestone B：能刷一套试卷

验收：

- 能看到试卷列表。
- 能创建练习。
- 能完成答题。
- 能提交。
- 能看到正确率和解析。

### Milestone C：能复盘

验收：

- 能看到练习记录。
- 能打开历史记录。
- 历史回看中答案和解析正确。

### Milestone D：能专项训练

验收：

- 能选择知识点。
- 能按题量和难度组卷。
- 能完成专项练习。

### Milestone E：移动端可用

验收：

- 手机宽度无横向滚动。
- 底部操作栏不遮挡内容。
- 刷新不丢答题进度。
- 可添加到桌面。

## 14. 暂缓事项

第一版不做或后置：

- React Native App。
- 题目全文搜索。
- 排行榜。
- 评论区。
- 题目收藏。
- 题目笔记。
- 支付系统。
- 消息推送。
- 大规模后台任务队列。

## 15. 风险与应对

### 15.1 答题状态复杂

风险：

- 当前题号、答案、计时、草稿、本地缓存容易不一致。

应对：

- 设计 `PracticeRuntimeState`。
- 答题页状态集中管理。
- 提交前统一从状态生成 payload。

### 15.2 富文本安全

风险：

- 题干、解析、材料包含 HTML，可能带来 XSS。

应对：

- 入库前清洗。
- 渲染前白名单过滤。
- 禁止 script、事件属性、危险 URL。

### 15.3 Prisma + Serverless 连接数

风险：

- 部署到 Serverless 时 MySQL 连接过多。

应对：

- 开发阶段可先用 VPS/Railway。
- 生产使用连接池方案。
- 避免长事务。

### 15.4 移动端答题体验

风险：

- 材料长、选项多、答题卡复杂，移动端容易拥挤。

应对：

- 材料折叠。
- 答题卡底部抽屉。
- 底部操作栏固定。
- 选项大点击区域。

## 16. 下一步执行建议

下一步可以正式进入工程初始化：

1. 创建 Next.js 项目。
2. 安装依赖。
3. 落地 Prisma schema。
4. 配置 Auth.js。
5. 写 seed 数据。
6. 实现第一批 API。

建议先不要做 UI 细节打磨，先把“能刷一套试卷”跑通。
