-- 移除排行榜与流程答题记录：删除 FlowRun / Flow 表与来自流程步骤的错题，错题本只保留自测题。
-- 流程的进度条目（ContentItem kind = 'flow'）保留，改由观看自动演示计入。

-- DropForeignKey
ALTER TABLE "FlowRun" DROP CONSTRAINT "FlowRun_flowId_fkey";

-- DropForeignKey
ALTER TABLE "FlowRun" DROP CONSTRAINT "FlowRun_userId_fkey";

-- DropTable
DROP TABLE "FlowRun";

-- DropTable
DROP TABLE "Flow";

-- 删除流程来源的错题
DELETE FROM "Mistake" WHERE "source" = 'flow';

-- AlterTable
ALTER TABLE "Mistake" DROP COLUMN "flowId",
DROP COLUMN "source",
DROP COLUMN "stepIndex",
DROP COLUMN "stepType";

-- DropEnum
DROP TYPE "MistakeSource";
