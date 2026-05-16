# 公考题库系统 API 接口设计文档

技术栈：

- Next.js Route Handlers
- MySQL
- Prisma
- Auth.js
- Zod

设计目标：

- Web/PWA 与未来 React Native 共用同一套 API。
- 核心业务不依赖 Server Actions。
- 接口返回结构统一。
- 所有写入接口必须鉴权。
- 所有入参使用 Zod 校验。

## 1. API 总体规范

### 1.1 Base URL

开发环境：

```txt
http://localhost:3000/api
```

生产环境：

```txt
https://your-domain.com/api
```

### 1.2 数据格式

请求：

- `Content-Type: application/json`
- 文件导入接口使用 `multipart/form-data`

响应：

- `Content-Type: application/json`

成功响应：

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

失败响应：

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "请先登录",
    "details": null
  }
}
```

### 1.3 分页格式

请求参数：

```txt
page=1&pageSize=20
```

分页响应：

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

默认分页：

- `page = 1`
- `pageSize = 20`
- 最大 `pageSize = 100`

### 1.4 时间格式

所有时间字段使用 ISO 8601 字符串：

```txt
2026-05-12T12:00:00.000Z
```

### 1.5 ID 格式

第一版使用 Prisma `cuid()` 字符串 ID。

示例：

```txt
clx123abc0000abcd1234efgh
```

## 2. 认证与权限

### 2.1 Web/PWA 认证

Web 端使用 Auth.js session cookie。

服务端通过 Auth.js 获取当前用户：

- 未登录返回 `401 UNAUTHORIZED`
- 登录但权限不足返回 `403 FORBIDDEN`

### 2.2 未来 React Native 认证

后期 React Native 可复用以下方式之一：

- 继续使用 Auth.js 支持的 session/token 策略。
- 增加移动端专用 token 换取接口。

API 设计保持 JSON 化，不依赖浏览器专属能力。

### 2.3 权限级别

- Public：公开接口，不需要登录。
- User：普通登录用户。
- Member：会员用户。
- Admin：管理员。
- SuperAdmin：超级管理员。

## 3. 错误码

| HTTP | code | 含义 |
|---|---|---|
| 400 | BAD_REQUEST | 请求格式错误 |
| 400 | VALIDATION_ERROR | 参数校验失败 |
| 401 | UNAUTHORIZED | 未登录 |
| 403 | FORBIDDEN | 无权限 |
| 403 | MEMBERSHIP_REQUIRED | 需要会员 |
| 404 | NOT_FOUND | 资源不存在 |
| 409 | CONFLICT | 状态冲突或重复操作 |
| 422 | BUSINESS_ERROR | 业务规则不满足 |
| 429 | RATE_LIMITED | 请求过于频繁 |
| 500 | INTERNAL_ERROR | 服务端错误 |

校验错误示例：

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数校验失败",
    "details": [
      {
        "path": "pageSize",
        "message": "pageSize 不能超过 100"
      }
    ]
  }
}
```

## 4. 通用数据结构

### 4.1 QuestionDTO

```json
{
  "id": "question_id",
  "type": "SINGLE",
  "titleHtml": "<p>题干</p>",
  "materialHtml": "<p>材料</p>",
  "options": [
    {
      "id": "option_id",
      "label": "A",
      "value": "0",
      "contentHtml": "选项内容"
    }
  ],
  "difficulty": "MEDIUM",
  "globalAccuracy": "72.50",
  "source": "2026 国考行测",
  "tag": {
    "id": "tag_id",
    "name": "资料分析"
  }
}
```

注意：

- 普通练习未提交前不返回 `correctAnswer` 和 `analysisHtml`。
- 背题、回看、提交结果中可以返回答案和解析。

### 4.2 QuestionWithAnswerDTO

```json
{
  "id": "question_id",
  "type": "SINGLE",
  "titleHtml": "<p>题干</p>",
  "materialHtml": "<p>材料</p>",
  "options": [],
  "correctAnswer": "0",
  "analysisHtml": "<p>解析</p>",
  "globalAccuracy": "72.50",
  "source": "2026 国考行测",
  "tag": {
    "id": "tag_id",
    "name": "资料分析"
  }
}
```

### 4.3 PracticeSessionDTO

```json
{
  "id": "session_id",
  "title": "2026 年国考行测试卷",
  "mode": "PAPER",
  "status": "IN_PROGRESS",
  "totalCount": 120,
  "elapsedSeconds": 0,
  "model": [
    {
      "name": "常识判断",
      "snum": 1,
      "enum": 20
    }
  ],
  "questions": []
}
```

### 4.4 PracticeResultDTO

```json
{
  "sessionId": "session_id",
  "title": "专项练习",
  "totalCount": 20,
  "answeredCount": 18,
  "correctCount": 15,
  "wrongCount": 3,
  "unansweredCount": 2,
  "accuracy": "75.00",
  "elapsedSeconds": 1200,
  "answers": [
    {
      "questionId": "question_id",
      "answer": "0",
      "correctAnswer": "0",
      "isCorrect": true,
      "timeSpentSeconds": 20,
      "analysisHtml": "<p>解析</p>"
    }
  ]
}
```

## 5. Auth 接口

Auth.js 默认路由：

```txt
/api/auth/*
```

由 Auth.js 管理：

- 登录
- 登出
- OAuth 回调
- Session 获取

### GET /api/me

权限：User

说明：获取当前登录用户信息。

响应：

```json
{
  "ok": true,
  "data": {
    "id": "user_id",
    "name": "用户",
    "email": "user@example.com",
    "role": "USER",
    "membership": {
      "status": "ACTIVE",
      "endedAt": "2026-12-31T00:00:00.000Z"
    }
  },
  "error": null
}
```

## 6. 试卷接口

### GET /api/papers

权限：Public

说明：获取历年试卷列表。

Query：

```txt
year=2026&province=国家&examType=国考&page=1&pageSize=20
```

响应：

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "paper_id",
        "title": "2026 年国家公务员录用考试《行测》",
        "year": 2026,
        "province": "国家",
        "examType": "国考",
        "difficultyScore": "4.5",
        "questionCount": 120,
        "isVipOnly": false
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 153,
      "totalPages": 8
    }
  },
  "error": null
}
```

### GET /api/papers/groups

权限：Public

说明：获取试卷分类 tab。

响应：

```json
{
  "ok": true,
  "data": [
    {
      "key": "2026",
      "title": "2026",
      "count": 10
    }
  ],
  "error": null
}
```

### GET /api/papers/{paperId}

权限：User，会员试卷需要 Member

说明：获取试卷详情，不返回答案和解析。

响应：

```json
{
  "ok": true,
  "data": {
    "id": "paper_id",
    "title": "2026 年国家公务员录用考试《行测》",
    "year": 2026,
    "province": "国家",
    "examType": "国考",
    "difficultyScore": "4.5",
    "model": [
      {
        "name": "常识判断",
        "snum": 1,
        "enum": 20
      }
    ],
    "questions": []
  },
  "error": null
}
```

## 7. 专项分类接口

### GET /api/tags

权限：User

说明：获取专项分类树。

响应：

```json
{
  "ok": true,
  "data": [
    {
      "id": "tag_id",
      "name": "资料分析",
      "slug": "data-analysis",
      "isMaterialOnly": true,
      "children": []
    }
  ],
  "error": null
}
```

### GET /api/tags/{tagId}/stats

权限：User

说明：获取某知识点下用户统计。

响应：

```json
{
  "ok": true,
  "data": {
    "tagId": "tag_id",
    "answeredCount": 100,
    "correctCount": 80,
    "wrongCount": 20,
    "accuracy": "80.00"
  },
  "error": null
}
```

## 8. 练习会话接口

### POST /api/practice/sessions

权限：User，会员试卷需要 Member

说明：创建历年试卷练习。

请求：

```json
{
  "paperId": "paper_id",
  "mode": "PAPER"
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "id": "session_id",
    "title": "2026 年国考行测",
    "mode": "PAPER",
    "status": "IN_PROGRESS",
    "totalCount": 120,
    "elapsedSeconds": 0,
    "model": [],
    "questions": []
  },
  "error": null
}
```

### POST /api/practice/sessions/special

权限：User

说明：创建专项练习。

请求：

```json
{
  "reqs": [
    {
      "tagId": "tag_id",
      "num": 5
    }
  ],
  "difficulty": "MEDIUM",
  "mode": "SPECIAL"
}
```

业务规则：

- `reqs` 不能为空。
- 总题数不能小于 5。
- 材料类专项不能和其他专项混练。
- `difficulty` 可为空，表示不限难度。

响应：同 `PracticeSessionDTO`。

### POST /api/practice/sessions/daily

权限：User

说明：创建每日一练。

请求：

```json
{
  "date": "2026-05-12"
}
```

说明：

- `date` 可选。
- 不传时默认当天。

响应：同 `PracticeSessionDTO`。

### POST /api/practice/sessions/wrong

权限：User

说明：创建错题练习或背题。

请求：

```json
{
  "tagId": "tag_id",
  "mode": "WRONG",
  "count": 10
}
```

背题模式：

```json
{
  "tagId": "tag_id",
  "mode": "MEMORIZE",
  "count": 10
}
```

业务规则：

- 错题数量必须大于等于请求数量。
- 默认随机抽取 10 道。
- `MEMORIZE` 模式返回答案和解析。

### GET /api/practice/sessions/{sessionId}

权限：User

说明：获取练习会话详情。

规则：

- 只能访问自己的练习。
- `IN_PROGRESS` 不返回答案解析。
- `SUBMITTED` 或 `REVIEW` 返回答案解析。

响应：`PracticeSessionDTO`

### PATCH /api/practice/sessions/{sessionId}/progress

权限：User

说明：保存练习进度。用于 Web/PWA 和移动端恢复。

请求：

```json
{
  "currentIndex": 10,
  "elapsedSeconds": 600,
  "answers": [
    {
      "questionId": "question_id",
      "answer": "0",
      "timeSpentSeconds": 20
    }
  ]
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "savedAt": "2026-05-12T12:00:00.000Z"
  },
  "error": null
}
```

说明：

- 第一版可以只保存在客户端 IndexedDB。
- 如果要跨设备恢复，则实现该接口并写入服务端。

### POST /api/practice/sessions/{sessionId}/submit

权限：User

说明：提交练习。

请求：

```json
{
  "elapsedSeconds": 1200,
  "answers": [
    {
      "questionId": "question_id",
      "answer": "0",
      "timeSpentSeconds": 30
    }
  ]
}
```

业务规则：

- 只能提交自己的 `IN_PROGRESS` session。
- 已提交 session 不能重复提交。
- 完成率小于 50% 时，可返回 `saveRecord=false` 并不写统计。
- 提交时使用数据库事务：
  - 写入 `PracticeAnswer`
  - 更新 `PracticeSession`
  - upsert `WrongQuestion`
  - 更新 `UserTagStats`

响应：

```json
{
  "ok": true,
  "data": {
    "sessionId": "session_id",
    "saveRecord": true,
    "totalCount": 20,
    "answeredCount": 18,
    "correctCount": 15,
    "wrongCount": 3,
    "unansweredCount": 2,
    "accuracy": "75.00",
    "elapsedSeconds": 1200,
    "answers": []
  },
  "error": null
}
```

### POST /api/practice/sessions/{sessionId}/abandon

权限：User

说明：放弃练习。

响应：

```json
{
  "ok": true,
  "data": {
    "status": "ABANDONED"
  },
  "error": null
}
```

## 9. 练习记录接口

### GET /api/records

权限：User

说明：获取练习记录列表。

Query：

```txt
mode=PAPER&page=1&pageSize=20
```

响应：

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": "session_id",
        "title": "2026 年国考行测",
        "mode": "PAPER",
        "totalCount": 120,
        "answeredCount": 120,
        "correctCount": 90,
        "wrongCount": 30,
        "unansweredCount": 0,
        "accuracy": "75.00",
        "elapsedSeconds": 5400,
        "submittedAt": "2026-05-12T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 1,
      "totalPages": 1
    }
  },
  "error": null
}
```

### GET /api/records/{recordId}

权限：User

说明：获取单次练习记录详情，用于历史回看。

规则：

- 只能查看自己的记录。
- 返回答案、解析、用户作答。

响应：`PracticeResultDTO`

### DELETE /api/records/{recordId}

权限：User

说明：删除或隐藏练习记录。

规则：

- 第一版可标记为隐藏，不物理删除。
- 被统计引用的数据是否重算，后续决定。

响应：

```json
{
  "ok": true,
  "data": {
    "deleted": true
  },
  "error": null
}
```

## 10. 错题接口

### GET /api/wrong-questions

权限：User

说明：获取当前用户错题本。

Query：

```txt
tagId=tag_id&resolved=false&page=1&pageSize=20
```

响应：

```json
{
  "ok": true,
  "data": {
    "groups": [
      {
        "tag": {
          "id": "tag_id",
          "name": "资料分析"
        },
        "count": 20,
        "items": [
          {
            "id": "wrong_id",
            "questionId": "question_id",
            "preview": "题目预览",
            "wrongCount": 2,
            "lastWrongAt": "2026-05-12T12:00:00.000Z"
          }
        ]
      }
    ]
  },
  "error": null
}
```

### GET /api/wrong-questions/{id}

权限：User

说明：获取错题详情。

响应：

```json
{
  "ok": true,
  "data": {
    "id": "wrong_id",
    "wrongCount": 2,
    "lastWrongAt": "2026-05-12T12:00:00.000Z",
    "question": {}
  },
  "error": null
}
```

### POST /api/wrong-questions/{id}/resolve

权限：User

说明：标记错题已掌握。

响应：

```json
{
  "ok": true,
  "data": {
    "resolvedAt": "2026-05-12T12:00:00.000Z"
  },
  "error": null
}
```

### DELETE /api/wrong-questions/{id}

权限：User

说明：从错题本移除。

响应：

```json
{
  "ok": true,
  "data": {
    "deleted": true
  },
  "error": null
}
```

## 11. 统计接口

### GET /api/stats/overview

权限：User

说明：获取用户整体练习统计。

响应：

```json
{
  "ok": true,
  "data": {
    "totalSessions": 10,
    "totalQuestions": 500,
    "totalCorrect": 380,
    "totalWrong": 100,
    "totalElapsedSeconds": 36000,
    "accuracy": "76.00"
  },
  "error": null
}
```

### GET /api/stats/tags

权限：User

说明：获取知识点维度统计。

响应：

```json
{
  "ok": true,
  "data": [
    {
      "tag": {
        "id": "tag_id",
        "name": "资料分析"
      },
      "answeredCount": 100,
      "correctCount": 80,
      "wrongCount": 20,
      "accuracy": "80.00",
      "lastPracticedAt": "2026-05-12T12:00:00.000Z"
    }
  ],
  "error": null
}
```

### GET /api/stats/calendar

权限：User

说明：获取练习日历热力数据。

Query：

```txt
from=2026-01-01&to=2026-12-31
```

响应：

```json
{
  "ok": true,
  "data": [
    {
      "date": "2026-05-12",
      "sessionCount": 2,
      "questionCount": 50,
      "elapsedSeconds": 3600
    }
  ],
  "error": null
}
```

## 12. 每日一练接口

### GET /api/daily-practice/today

权限：User

说明：获取今日每日一练配置。

响应：

```json
{
  "ok": true,
  "data": {
    "date": "2026-05-12",
    "title": "每日一练",
    "questionCount": 10
  },
  "error": null
}
```

### POST /api/daily-practice/{id}/start

权限：User

说明：开始指定每日一练。

响应：`PracticeSessionDTO`

## 13. 管理后台接口

管理后台接口均需要 Admin 权限。

### GET /api/admin/questions

权限：Admin

说明：分页查询题目。

Query：

```txt
keyword=增长率&tagId=tag_id&type=SINGLE&page=1&pageSize=20
```

### POST /api/admin/questions

权限：Admin

说明：创建题目。

请求：

```json
{
  "type": "SINGLE",
  "titleHtml": "<p>题干</p>",
  "analysisHtml": "<p>解析</p>",
  "correctAnswer": "0",
  "difficulty": "MEDIUM",
  "tagId": "tag_id",
  "materialId": null,
  "options": [
    {
      "label": "A",
      "value": "0",
      "contentHtml": "选项 A",
      "sortOrder": 1
    }
  ]
}
```

### PATCH /api/admin/questions/{questionId}

权限：Admin

说明：更新题目。

### DELETE /api/admin/questions/{questionId}

权限：Admin

说明：软删除题目。

### POST /api/admin/papers

权限：Admin

说明：创建试卷。

请求：

```json
{
  "title": "2026 年国考行测",
  "year": 2026,
  "province": "国家",
  "examType": "国考",
  "difficultyScore": "4.5",
  "questionIds": ["question_id"]
}
```

### PATCH /api/admin/papers/{paperId}

权限：Admin

说明：更新试卷基础信息和题目顺序。

### POST /api/admin/tags

权限：Admin

说明：创建专项分类。

### PATCH /api/admin/tags/{tagId}

权限：Admin

说明：更新专项分类。

### POST /api/admin/import

权限：Admin

说明：批量导入题目或试卷。

请求：

- `multipart/form-data`
- 字段：
  - `type`: `questions` 或 `papers`
  - `file`: 文件

响应：

```json
{
  "ok": true,
  "data": {
    "jobId": "import_job_id",
    "status": "PENDING"
  },
  "error": null
}
```

### GET /api/admin/import/{jobId}

权限：Admin

说明：查看导入任务状态。

## 14. Zod Schema 草案

### 创建专项练习

```ts
import { z } from "zod";

export const createSpecialPracticeSchema = z.object({
  reqs: z.array(
    z.object({
      tagId: z.string().min(1),
      num: z.number().int().min(1).max(50)
    })
  ).min(1),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD", "UNKNOWN"]).optional().nullable(),
  mode: z.literal("SPECIAL").default("SPECIAL")
});
```

### 提交练习

```ts
export const submitPracticeSchema = z.object({
  elapsedSeconds: z.number().int().min(0),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      answer: z.string().nullable(),
      timeSpentSeconds: z.number().int().min(0)
    })
  )
});
```

### 分页

```ts
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});
```

## 15. 接口实现约定

Route Handler 推荐结构：

```ts
export async function GET(request: Request) {
  const user = await requireUser();
  const query = parseQuery(request, schema);
  const data = await service.list(user.id, query);
  return ok(data);
}
```

统一工具：

- `ok(data)`
- `fail(code, message, details?)`
- `requireUser()`
- `requireAdmin()`
- `requireMember()`
- `parseJson(request, schema)`
- `parseQuery(request, schema)`

## 16. MVP 接口优先级

第一阶段必须实现：

- `GET /api/me`
- `GET /api/papers`
- `GET /api/papers/{paperId}`
- `POST /api/practice/sessions`
- `GET /api/practice/sessions/{sessionId}`
- `POST /api/practice/sessions/{sessionId}/submit`
- `GET /api/records`
- `GET /api/records/{recordId}`

第二阶段实现：

- `GET /api/tags`
- `POST /api/practice/sessions/special`
- `POST /api/practice/sessions/daily`
- `PATCH /api/practice/sessions/{sessionId}/progress`

第三阶段实现：

- `GET /api/wrong-questions`
- `POST /api/practice/sessions/wrong`
- `POST /api/wrong-questions/{id}/resolve`
- `GET /api/stats/overview`
- `GET /api/stats/tags`

第四阶段实现：

- 管理后台题目、试卷、分类、导入接口。

## 17. 后续待确认

- 是否需要服务端跨设备保存未提交进度。
- 是否允许用户删除练习记录后重算统计。
- 错题答对几次后自动移出错题本。
- 每日一练是后台人工配置，还是系统自动抽题。
- React Native 阶段采用 Auth.js session 还是移动端专用 token。
