-- 移除学习进度与错题本：删除进度条目、进度记录、自测作答记录与错题表。用户与登录相关表不受影响。

-- DropForeignKey
ALTER TABLE "ProgressRecord" DROP CONSTRAINT "ProgressRecord_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProgressRecord" DROP CONSTRAINT "ProgressRecord_itemId_fkey";

-- DropForeignKey
ALTER TABLE "QuizAnswer" DROP CONSTRAINT "QuizAnswer_userId_fkey";

-- DropForeignKey
ALTER TABLE "QuizAnswer" DROP CONSTRAINT "QuizAnswer_questionId_fkey";

-- DropForeignKey
ALTER TABLE "Mistake" DROP CONSTRAINT "Mistake_userId_fkey";

-- DropForeignKey
ALTER TABLE "Mistake" DROP CONSTRAINT "Mistake_questionId_fkey";

-- DropTable
DROP TABLE "ProgressRecord";

-- DropTable
DROP TABLE "ContentItem";

-- DropTable
DROP TABLE "QuizAnswer";

-- DropTable
DROP TABLE "Mistake";

-- DropEnum
DROP TYPE "ItemKind";
