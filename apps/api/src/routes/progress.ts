import type { FastifyPluginAsync } from "fastify";
import { computeProgress } from "../lib/progress";

const progress: FastifyPluginAsync = async (app) => {
  app.get("/progress", async (req) => {
    const user = await app.requireUser(req);
    return computeProgress(app.prisma, user.id);
  });
};
export default progress;
