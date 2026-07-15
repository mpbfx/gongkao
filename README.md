# 公考题库

面向学生端的公考刷题、专项训练、错题复盘与知识助教系统，基于 Next.js App Router、Prisma 和 MariaDB 构建。

## 本地启动

```bash
cp .env.example .env.local
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## 常用命令

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

项目代码、Prisma schema、静态资源和工具脚本均位于仓库根目录，便于本地开发与部署。
