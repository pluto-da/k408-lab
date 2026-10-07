import argon2 from "argon2";

// OWASP 推荐的 argon2id 参数（19 MiB, t=2），2 vCPU 小机器上单次约 30–60ms
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | null = null;
/** 账号不存在时也做一次校验，避免通过响应时间探测账号是否存在 */
export async function burnPasswordCheck(plain: string): Promise<void> {
  dummy ??= hashPassword("k408-dummy-password");
  await verifyPassword(await dummy, plain);
}
