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

/** 常见弱密码（各大泄露库里最常见的一批，统一转小写比较） */
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "p@ssw0rd", "qwerty123", "qwertyuiop", "qwerty12", "1qaz2wsx", "1q2w3e4r", "1q2w3e4r5t",
  "abc12345", "abcd1234", "a1234567", "a12345678", "aa123456", "asd12345", "asdfghjk", "zxcvbnm1", "iloveyou", "admin123", "admin888", "root1234",
  "woaini1314", "woaini520", "5201314a", "13141314", "12345678", "123456789", "1234567890", "0123456789", "87654321", "11223344", "12341234",
  "123123123", "111111111", "123qweasd", "qweasdzxc", "qwe123456", "kaoyan408", "computer", "football", "baseball", "sunshine", "princess",
]);

/** 返回弱密码的原因；可以接受时返回 null */
export function weakPasswordReason(password: string, username?: string | null, email?: string | null): string | null {
  const p = password.toLowerCase();
  if (COMMON.has(p)) return "这个密码太常见，容易被猜中，请换一个";
  if (/^(.)\1+$/.test(p)) return "密码不能是同一个字符重复";
  if (/^\d+$/.test(p) && ("01234567890".includes(p) || "09876543210".includes(p))) return "密码不能是连续数字";
  if (username && p.includes(username.toLowerCase()) && username.length >= 3) return "密码不能包含用户名";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 3 && p.includes(local)) return "密码不能包含邮箱前缀";
  return null;
}
