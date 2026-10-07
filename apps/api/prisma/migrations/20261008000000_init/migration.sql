-- CreateEnum
CREATE TYPE "Subject" AS ENUM ('ds', 'co', 'os', 'cn');

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('chapter', 'lab', 'flow', 'part', 'quiz');

-- CreateEnum
CREATE TYPE "MistakeSource" AS ENUM ('quiz', 'flow');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "subject" "Subject" NOT NULL,
    "title" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "mistakes" INTEGER NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "score" INTEGER,
    "options" JSONB,
    "clientEventId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "subject" "Subject" NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answer" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "chosen" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mistake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "MistakeSource" NOT NULL,
    "subject" "Subject" NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "questionId" TEXT,
    "flowId" TEXT,
    "stepIndex" INTEGER,
    "stepType" TEXT NOT NULL DEFAULT 'single',
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "chosen" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "wrongCount" INTEGER NOT NULL DEFAULT 1,
    "mastered" BOOLEAN NOT NULL DEFAULT false,
    "masteredAt" TIMESTAMPTZ(3),
    "lastWrongAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mistake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "ContentItem_subject_idx" ON "ContentItem"("subject");

-- CreateIndex
CREATE INDEX "ProgressRecord_userId_lastAt_idx" ON "ProgressRecord"("userId", "lastAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressRecord_userId_itemId_key" ON "ProgressRecord"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "FlowRun_clientEventId_key" ON "FlowRun"("clientEventId");

-- CreateIndex
CREATE INDEX "FlowRun_flowId_createdAt_idx" ON "FlowRun"("flowId", "createdAt");

-- CreateIndex
CREATE INDEX "FlowRun_flowId_userId_idx" ON "FlowRun"("flowId", "userId");

-- CreateIndex
CREATE INDEX "QuizAnswer_userId_questionId_idx" ON "QuizAnswer"("userId", "questionId");

-- CreateIndex
CREATE INDEX "Mistake_userId_subject_mastered_idx" ON "Mistake"("userId", "subject", "mastered");

-- CreateIndex
CREATE UNIQUE INDEX "Mistake_userId_dedupeKey_key" ON "Mistake"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "ProgressRecord" ADD CONSTRAINT "ProgressRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressRecord" ADD CONSTRAINT "ProgressRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowRun" ADD CONSTRAINT "FlowRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowRun" ADD CONSTRAINT "FlowRun_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

