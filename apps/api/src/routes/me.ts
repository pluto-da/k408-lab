import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { toPublicUser } from "../plugins/auth";
import { verifyPassword } from "../lib/password";
import { HttpError } from "../lib/errors";
import { nicknameSchema } from "./auth";

const profileSchema = z.object({ nickname: nicknameSchema });
const deleteSchema = z.object({ password: z.string().min(1, "请输入密码").max(72) });

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

  /** 注销账号：校验密码后删除账号及其全部数据（目前只有 User 一张表），并清除本机会话 */
  app.delete("/me", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const user = await app.requireUser(req);
    const { password } = deleteSchema.parse(req.body);
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new HttpError(403, "WRONG_PASSWORD", "密码不正确");
    }
    await app.prisma.user.delete({ where: { id: user.id } });
    app.clearSession(reply);
    return { ok: true };
  });
};
export default me;
