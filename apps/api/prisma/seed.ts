import { PrismaClient } from "@prisma/client";
import { syncCatalog } from "../src/lib/catalog-sync";

const prisma = new PrismaClient();
syncCatalog(prisma)
  .then((r) => {
    console.log(`种子数据已写入：自测题 ${r.questions}`);
  })
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
