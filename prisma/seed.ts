import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/db/prisma";
import { normalizeQuestionTagTaxonomy } from "../src/server/services/question-tag-taxonomy-maintenance";

type SeedQuestion = {
  id: string;
  type: "SINGLE" | "MULTIPLE" | "JUDGE";
  tagSlug: string;
  title: string;
  answer: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  analysis: string;
  options: Array<{
    label: string;
    value: string;
    content: string;
  }>;
};

const tags = [
  { id: "seed_tag_common_sense", name: "常识判断", slug: "common-sense", sortOrder: 1 },
  { id: "seed_tag_verbal", name: "言语理解", slug: "verbal", sortOrder: 2 },
  { id: "seed_tag_judgement", name: "判断推理", slug: "judgement", sortOrder: 3 },
];

const questions: SeedQuestion[] = [
  {
    id: "seed_q_001",
    type: "SINGLE",
    tagSlug: "common-sense",
    title: "下列关于我国宪法的说法，正确的是哪一项？",
    answer: "A",
    difficulty: "EASY",
    analysis: "宪法是国家的根本法，具有最高法律效力。",
    options: [
      { label: "A", value: "A", content: "宪法具有最高法律效力" },
      { label: "B", value: "B", content: "地方性法规效力高于宪法" },
      { label: "C", value: "C", content: "行政规章可以修改宪法" },
      { label: "D", value: "D", content: "宪法只调整经济关系" },
    ],
  },
  {
    id: "seed_q_002",
    type: "SINGLE",
    tagSlug: "common-sense",
    title: "行政机关作出影响公民权利义务的决定时，通常应遵循哪项原则？",
    answer: "C",
    difficulty: "MEDIUM",
    analysis: "依法行政要求行政机关在法定权限和程序内行使职权。",
    options: [
      { label: "A", value: "A", content: "效率优先，程序从简" },
      { label: "B", value: "B", content: "自由裁量不受约束" },
      { label: "C", value: "C", content: "依法行政" },
      { label: "D", value: "D", content: "以内部意见为准" },
    ],
  },
  {
    id: "seed_q_003",
    type: "JUDGE",
    tagSlug: "common-sense",
    title: "我国公民在法律面前一律平等。",
    answer: "T",
    difficulty: "EASY",
    analysis: "法律面前人人平等是我国宪法确认的基本原则。",
    options: [
      { label: "A", value: "T", content: "正确" },
      { label: "B", value: "F", content: "错误" },
    ],
  },
  {
    id: "seed_q_004",
    type: "MULTIPLE",
    tagSlug: "common-sense",
    title: "下列哪些属于公共服务供给需要关注的目标？",
    answer: "A,C,D",
    difficulty: "MEDIUM",
    analysis: "公共服务供给通常强调公平、可及、质量和效率。",
    options: [
      { label: "A", value: "A", content: "公平性" },
      { label: "B", value: "B", content: "排他性" },
      { label: "C", value: "C", content: "可及性" },
      { label: "D", value: "D", content: "服务质量" },
    ],
  },
  {
    id: "seed_q_005",
    type: "SINGLE",
    tagSlug: "common-sense",
    title: "宏观调控中，降低存款准备金率通常会产生什么效果？",
    answer: "B",
    difficulty: "MEDIUM",
    analysis: "降低准备金率一般会提高银行可贷资金规模。",
    options: [
      { label: "A", value: "A", content: "减少市场流动性" },
      { label: "B", value: "B", content: "增加市场流动性" },
      { label: "C", value: "C", content: "冻结财政支出" },
      { label: "D", value: "D", content: "直接提高税率" },
    ],
  },
  {
    id: "seed_q_006",
    type: "SINGLE",
    tagSlug: "common-sense",
    title: "下列哪个节气通常标志着夏季开始？",
    answer: "D",
    difficulty: "EASY",
    analysis: "二十四节气中，立夏通常表示夏季开始。",
    options: [
      { label: "A", value: "A", content: "惊蛰" },
      { label: "B", value: "B", content: "清明" },
      { label: "C", value: "C", content: "谷雨" },
      { label: "D", value: "D", content: "立夏" },
    ],
  },
  {
    id: "seed_q_007",
    type: "SINGLE",
    tagSlug: "verbal",
    title: "依次填入句中横线处最恰当的一组词是：治理要有耐心，改革要有____，服务要有温度。",
    answer: "A",
    difficulty: "EASY",
    analysis: "与改革搭配更自然的是“定力”。",
    options: [
      { label: "A", value: "A", content: "定力" },
      { label: "B", value: "B", content: "景气" },
      { label: "C", value: "C", content: "频率" },
      { label: "D", value: "D", content: "噪声" },
    ],
  },
  {
    id: "seed_q_008",
    type: "SINGLE",
    tagSlug: "verbal",
    title: "“一项政策若要落地，既要听见多数人的声音，也不能忽略少数人的困难。”这句话主要强调：",
    answer: "C",
    difficulty: "MEDIUM",
    analysis: "句子强调政策执行中的兼顾与包容。",
    options: [
      { label: "A", value: "A", content: "政策应只关注效率" },
      { label: "B", value: "B", content: "多数意见必然正确" },
      { label: "C", value: "C", content: "政策执行需要兼顾不同群体" },
      { label: "D", value: "D", content: "少数需求应替代整体目标" },
    ],
  },
  {
    id: "seed_q_009",
    type: "MULTIPLE",
    tagSlug: "verbal",
    title: "下列词语中，适合描述基层治理能力的有：",
    answer: "A,B,D",
    difficulty: "EASY",
    analysis: "协同、精细、响应均可用于描述治理能力。",
    options: [
      { label: "A", value: "A", content: "协同" },
      { label: "B", value: "B", content: "精细" },
      { label: "C", value: "C", content: "僵化" },
      { label: "D", value: "D", content: "响应" },
    ],
  },
  {
    id: "seed_q_010",
    type: "SINGLE",
    tagSlug: "verbal",
    title: "“数字化不是简单把线下流程搬到线上，而是重塑服务逻辑。”这句话反对的是：",
    answer: "B",
    difficulty: "MEDIUM",
    analysis: "题干反对机械搬运线下流程。",
    options: [
      { label: "A", value: "A", content: "优化服务体验" },
      { label: "B", value: "B", content: "机械复制线下流程" },
      { label: "C", value: "C", content: "重构业务逻辑" },
      { label: "D", value: "D", content: "提升数据协同" },
    ],
  },
  {
    id: "seed_q_011",
    type: "JUDGE",
    tagSlug: "verbal",
    title: "阅读理解题只需要定位关键词，不需要理解上下文。",
    answer: "F",
    difficulty: "EASY",
    analysis: "关键词定位有帮助，但仍需结合上下文判断语义。",
    options: [
      { label: "A", value: "T", content: "正确" },
      { label: "B", value: "F", content: "错误" },
    ],
  },
  {
    id: "seed_q_012",
    type: "SINGLE",
    tagSlug: "verbal",
    title: "填入下列横线最恰当的是：城市更新不能____历史记忆。",
    answer: "D",
    difficulty: "MEDIUM",
    analysis: "“割裂历史记忆”搭配自然，语义准确。",
    options: [
      { label: "A", value: "A", content: "催生" },
      { label: "B", value: "B", content: "抚慰" },
      { label: "C", value: "C", content: "铺陈" },
      { label: "D", value: "D", content: "割裂" },
    ],
  },
  {
    id: "seed_q_013",
    type: "SINGLE",
    tagSlug: "verbal",
    title: "“让数据多跑路，让群众少跑腿”体现的行政服务理念是：",
    answer: "A",
    difficulty: "EASY",
    analysis: "该表述强调便民和服务效率。",
    options: [
      { label: "A", value: "A", content: "便民高效" },
      { label: "B", value: "B", content: "层层审批" },
      { label: "C", value: "C", content: "信息封闭" },
      { label: "D", value: "D", content: "流程外包" },
    ],
  },
  {
    id: "seed_q_014",
    type: "SINGLE",
    tagSlug: "judgement",
    title: "所有青年都是学习者，有些学习者是志愿者。由此一定能推出：",
    answer: "D",
    difficulty: "HARD",
    analysis: "有些学习者是志愿者，不能推出青年与志愿者必然有交集。",
    options: [
      { label: "A", value: "A", content: "有些青年是志愿者" },
      { label: "B", value: "B", content: "所有志愿者都是青年" },
      { label: "C", value: "C", content: "所有学习者都是青年" },
      { label: "D", value: "D", content: "无法确定青年中是否有志愿者" },
    ],
  },
  {
    id: "seed_q_015",
    type: "SINGLE",
    tagSlug: "judgement",
    title: "1，3，6，10，15，（ ）",
    answer: "C",
    difficulty: "EASY",
    analysis: "相邻差为2、3、4、5、6，所以下一项是21。",
    options: [
      { label: "A", value: "A", content: "18" },
      { label: "B", value: "B", content: "20" },
      { label: "C", value: "C", content: "21" },
      { label: "D", value: "D", content: "24" },
    ],
  },
  {
    id: "seed_q_016",
    type: "MULTIPLE",
    tagSlug: "judgement",
    title: "下列推理形式中，属于削弱论证的常见方式有：",
    answer: "A,B,C",
    difficulty: "MEDIUM",
    analysis: "另有他因、因果倒置、样本不足都可以削弱论证。",
    options: [
      { label: "A", value: "A", content: "指出另有他因" },
      { label: "B", value: "B", content: "指出因果倒置" },
      { label: "C", value: "C", content: "指出样本不足" },
      { label: "D", value: "D", content: "重复题干结论" },
    ],
  },
  {
    id: "seed_q_017",
    type: "JUDGE",
    tagSlug: "judgement",
    title: "充分条件命题“如果A，那么B”等价于“如果非B，那么非A”。",
    answer: "T",
    difficulty: "MEDIUM",
    analysis: "该转换是逆否命题，二者等价。",
    options: [
      { label: "A", value: "T", content: "正确" },
      { label: "B", value: "F", content: "错误" },
    ],
  },
  {
    id: "seed_q_018",
    type: "SINGLE",
    tagSlug: "judgement",
    title: "甲、乙、丙三人中只有一人说真话。甲说：乙说真话。乙说：丙说真话。丙说：我说假话。说真话的是：",
    answer: "A",
    difficulty: "HARD",
    analysis: "丙说“我说假话”自指矛盾，不可能为真；若乙真则丙真矛盾，所以甲为真。",
    options: [
      { label: "A", value: "A", content: "甲" },
      { label: "B", value: "B", content: "乙" },
      { label: "C", value: "C", content: "丙" },
      { label: "D", value: "D", content: "无法判断" },
    ],
  },
  {
    id: "seed_q_019",
    type: "SINGLE",
    tagSlug: "judgement",
    title: "图形推理中，若每一步都增加一个相同元素，常见规律是：",
    answer: "B",
    difficulty: "EASY",
    analysis: "元素数量递增是图形推理的基础规律之一。",
    options: [
      { label: "A", value: "A", content: "位置镜像" },
      { label: "B", value: "B", content: "数量递增" },
      { label: "C", value: "C", content: "颜色互换" },
      { label: "D", value: "D", content: "空间折叠" },
    ],
  },
  {
    id: "seed_q_020",
    type: "MULTIPLE",
    tagSlug: "judgement",
    title: "定义判断中，审题时应重点关注哪些要素？",
    answer: "A,C,D",
    difficulty: "MEDIUM",
    analysis: "定义判断通常关注主体、条件、结果或核心属性。",
    options: [
      { label: "A", value: "A", content: "主体" },
      { label: "B", value: "B", content: "字体" },
      { label: "C", value: "C", content: "条件" },
      { label: "D", value: "D", content: "结果或属性" },
    ],
  },
];

function html(text: string) {
  return `<p>${text}</p>`;
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.user.upsert({
    where: { email: "demo@saduck.local" },
    update: {
      name: "Demo User",
      passwordHash,
      role: "USER",
    },
    create: {
      name: "Demo User",
      email: "demo@saduck.local",
      passwordHash,
      role: "USER",
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@saduck.local" },
    update: {
      name: "Admin User",
      passwordHash,
      role: "ADMIN",
    },
    create: {
      name: "Admin User",
      email: "admin@saduck.local",
      passwordHash,
      role: "ADMIN",
    },
  });

  if (process.env.SEED_DEMO_CONTENT !== "true") {
    console.log("Seeded demo/admin users. Skipped demo question content.");
    return;
  }

  for (const tag of tags) {
    await prisma.questionTag.upsert({
      where: { slug: tag.slug },
      update: {
        name: tag.name,
        sortOrder: tag.sortOrder,
        path: tag.name,
        isLeaf: true,
        taxonomySource: "seed",
        isActive: true,
      },
      create: { ...tag, path: tag.name, isLeaf: true, taxonomySource: "seed" },
    });
  }

  const tagBySlug = new Map(
    (await prisma.questionTag.findMany({
      where: { slug: { in: tags.map((tag) => tag.slug) } },
      select: { id: true, slug: true },
    })).map((tag) => [tag.slug, tag.id])
  );

  for (const question of questions) {
    const tagId = tagBySlug.get(question.tagSlug);

    if (!tagId) {
      throw new Error(`Missing seed tag: ${question.tagSlug}`);
    }

    await prisma.question.upsert({
      where: { id: question.id },
      update: {
        type: question.type,
        titleHtml: html(question.title),
        plainText: question.title,
        analysisHtml: html(question.analysis),
        correctAnswer: question.answer,
        difficulty: question.difficulty,
        source: "P1 种子题库",
        tagId,
        isActive: true,
        options: {
          deleteMany: {},
          create: question.options.map((option, index) => ({
            id: `${question.id}_${option.value}`,
            label: option.label,
            value: option.value,
            contentHtml: html(option.content),
            plainText: option.content,
            sortOrder: index + 1,
          })),
        },
      },
      create: {
        id: question.id,
        type: question.type,
        titleHtml: html(question.title),
        plainText: question.title,
        analysisHtml: html(question.analysis),
        correctAnswer: question.answer,
        difficulty: question.difficulty,
        source: "P1 种子题库",
        tagId,
        options: {
          create: question.options.map((option, index) => ({
            id: `${question.id}_${option.value}`,
            label: option.label,
            value: option.value,
            contentHtml: html(option.content),
            plainText: option.content,
            sortOrder: index + 1,
          })),
        },
      },
    });
  }

  await prisma.paper.upsert({
    where: { slug: "p1-demo-paper-2026" },
    update: {
      title: "P1 公考行测模拟卷",
      year: 2026,
      province: "全国",
      examType: "行测",
      durationSeconds: 7200,
      isActive: true,
      questions: {
        deleteMany: {},
        create: questions.map((question, index) => ({
          id: `seed_paper_question_${String(index + 1).padStart(3, "0")}`,
          questionId: question.id,
          sortOrder: index + 1,
          sectionName: tags.find((tag) => tag.slug === question.tagSlug)?.name,
          score: 1,
        })),
      },
    },
    create: {
      id: "seed_paper_001",
      title: "P1 公考行测模拟卷",
      slug: "p1-demo-paper-2026",
      year: 2026,
      province: "全国",
      examType: "行测",
      durationSeconds: 7200,
      isActive: true,
      questions: {
        create: questions.map((question, index) => ({
          id: `seed_paper_question_${String(index + 1).padStart(3, "0")}`,
          questionId: question.id,
          sortOrder: index + 1,
          sectionName: tags.find((tag) => tag.slug === question.tagSlug)?.name,
          score: 1,
        })),
      },
    },
  });

  await prisma.dailyPractice.upsert({
    where: { date: new Date("2026-05-12T00:00:00.000Z") },
    update: {
      title: "P1 每日练习",
      isActive: true,
      questions: {
        deleteMany: {},
        create: questions.slice(0, 5).map((question, index) => ({
          id: `seed_daily_question_${String(index + 1).padStart(3, "0")}`,
          questionId: question.id,
          sortOrder: index + 1,
        })),
      },
    },
    create: {
      id: "seed_daily_20260512",
      date: new Date("2026-05-12T00:00:00.000Z"),
      title: "P1 每日练习",
      isActive: true,
      questions: {
        create: questions.slice(0, 5).map((question, index) => ({
          id: `seed_daily_question_${String(index + 1).padStart(3, "0")}`,
          questionId: question.id,
          sortOrder: index + 1,
        })),
      },
    },
  });

  const taxonomy = await normalizeQuestionTagTaxonomy();
  console.log("Normalized question tags:", JSON.stringify(taxonomy));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
