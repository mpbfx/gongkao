import { prisma } from "../src/lib/db/prisma";
import { normalizeQuestionTagTaxonomy } from "../src/server/services/question-tag-taxonomy-maintenance";

normalizeQuestionTagTaxonomy()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
