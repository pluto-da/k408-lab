import type { FastifyPluginAsync } from "fastify";

const questions: FastifyPluginAsync = async (app) => {
  /** 自测题题干与选项（不含答案，答案在提交后由服务端判定） */
  app.get("/questions", async () => {
    const qs = await app.prisma.question.findMany({ orderBy: { sort: "asc" } });
    return { items: qs.map((q) => ({ id: q.id, subject: q.subject, stem: q.stem, options: q.options })) };
  });
};
export default questions;
