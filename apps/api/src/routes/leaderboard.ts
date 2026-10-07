import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { FLOW_IDS, FLOWS } from "@k408/shared";
import { getLeaderboard } from "../lib/leaderboard";

const params = z.object({ flowId: z.string().refine((v) => FLOW_IDS.includes(v), "未知的流程") });
const query = z.object({ period: z.enum(["week", "all"]).default("week") });

const leaderboard: FastifyPluginAsync = async (app) => {
  app.get("/flows", async () => ({ flows: FLOWS }));

  /** 公开榜单；登录时附带自己的名次 */
  app.get("/leaderboard/:flowId", async (req) => {
    const { flowId } = params.parse(req.params);
    const { period } = query.parse(req.query);
    const me = await app.optionalUser(req);
    return getLeaderboard(app.prisma, flowId, period, me?.id ?? null);
  });
};
export default leaderboard;
