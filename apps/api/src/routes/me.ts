import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { toPublicUser } from "../plugins/auth";
import { nicknameSchema } from "./auth";

const profileSchema = z.object({ nickname: nicknameSchema });

const me: FastifyPluginAsync = async (app) => {
  app.get("/me", async (req) => {
    const user = await app.optionalUser(req);
    return { user: user ? toPublicUser(user) : null };
  });

  app.patch("/me", async (req) => {
    const user = await app.requireUser(req);
    const { nickname } = profileSchema.parse(req.body);
    const updated = await app.prisma.user.update({ where: { id: user.id }, data: { nickname } });
    return { user: toPublicUser(updated) };
  });
};
export default me;
