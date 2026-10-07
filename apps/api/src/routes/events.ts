import type { FastifyPluginAsync } from "fastify";
import { eventBatchSchema } from "@k408/shared";
import { ingestEvents } from "../lib/ingest";

const events: FastifyPluginAsync = async (app) => {
  /** 批量接收旧版模块发出的 lab:event（需登录；未登录时前端先在内存排队） */
  app.post("/events", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (req) => {
    const user = await app.requireUser(req);
    const { events } = eventBatchSchema.parse(req.body);
    return ingestEvents(app.prisma, user.id, events);
  });
};
export default events;
