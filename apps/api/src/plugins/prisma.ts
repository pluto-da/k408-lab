import fp from "fastify-plugin";
import type { PrismaClient } from "@prisma/client";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export default fp<{ client: PrismaClient; disconnectOnClose: boolean }>(async (app, opts) => {
  app.decorate("prisma", opts.client);
  if (opts.disconnectOnClose) app.addHook("onClose", async () => opts.client.$disconnect());
});
