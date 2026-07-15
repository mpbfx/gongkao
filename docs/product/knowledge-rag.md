# 课程字幕 RAG 知识库

## 组件

- MySQL / Prisma：保存课程来源、字幕片段、导入状态、知识问答会话和引用。
- Qdrant：保存可重建的向量索引。
- OpenAI-compatible Embeddings：查询和字幕片段使用同一模型。
- Pi Agent Runtime：题目讲解中的按需课程检索，以及严格依据字幕的独立知识问答。
- `srt-parser-2`、`fastest-levenshtein`、`p-limit`：解析、近重复处理和批量限流。

当前 LlamaIndex.TS npm 包已经标记为 deprecated，因此实现使用官方 OpenAI 和 Qdrant SDK，避免将停更抽象层引入生产链路。

## 启动 Qdrant

```bash
docker compose -f docker-compose.qdrant.yml up -d
```

在 `.env.local` 中配置：

```env
QDRANT_URL="http://127.0.0.1:6333"
QDRANT_COLLECTION="gongkao_course_chunks"
EMBEDDING_MODEL="your-embedding-model"
EMBEDDING_DIMENSIONS="1536"
```

`EMBEDDING_API_KEY`、`EMBEDDING_BASE_URL` 为空时回退到现有 OpenAI 配置。模型名和维度必须与接口实际返回一致。

## 数据库与导入

```bash
npm run prisma:migrate

npm run knowledge:import -- \
  --path "C:/path/to/BV1pkKU68EXt" \
  --bvid "BV1pkKU68EXt" \
  --title "公考课程"
```

导入命令只读取 `P{数字}_transcript.srt`。同一原文件重复导入会复用现有片段，只重试未索引或失败项；文件内容变化时重建该分P的数据库片段和Qdrant向量。

```bash
npm run knowledge:resume -- --jobId "IMPORT_JOB_ID"
npm run knowledge:reindex -- --sourceId "SOURCE_ID"
```

## 产品入口

- `/knowledge`：已登录用户的持久多会话课程问答。
- 单题讲题助教：用户询问课程讲法、概念、标准方法、口诀或迁移规律时，Pi Agent 可调用 `search_course_knowledge`。
- 自动错题分析：不注册知识库工具，避免批处理额外检索。

独立知识问答每轮必须检索一次。检索结果为空时使用固定的资料不足回答，不允许模型使用通用知识补写。

## 评测

完成字幕导入后运行：

```bash
npm run knowledge:eval
```

`promptfooconfig.yaml` 包含30条公考检索用例，基础断言要求返回可跳转的B站引用。正式上线前应根据实际课程范围补充预期分P、时间窗口和拒答用例。
