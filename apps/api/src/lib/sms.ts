/**
 * 手机号短信登录 —— v1 仅预留接口，未实现。
 *
 * 接入步骤（后续版本）：
 * 1. 实现 SmsProvider（阿里云 / 腾讯云短信），在 createSmsProvider 中按环境变量选择；
 * 2. 验证码存 Redis 或数据库表（手机号、验证码哈希、过期时间、尝试次数）；
 * 3. 在 routes/auth.ts 中把 /auth/sms/send 与 /auth/sms/login 的 501 替换为真实逻辑，
 *    登录成功后复用 issueSession()；User.phone 字段已在数据库中预留。
 */
export interface SmsProvider {
  sendCode(phone: string, code: string): Promise<void>;
}

export interface SmsLoginService {
  requestCode(phone: string): Promise<{ cooldownSeconds: number }>;
  verifyCode(phone: string, code: string): Promise<boolean>;
}

export const SMS_ENABLED = false;

export function createSmsProvider(): SmsProvider | null {
  return null;
}
