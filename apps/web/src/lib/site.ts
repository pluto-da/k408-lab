/** 运营者联系邮箱：构建时通过 VITE_CONTACT_EMAIL 传入，显示在页脚、用户协议与隐私政策中 */
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL?.trim() || undefined;

/** 用户协议与隐私政策的生效 / 最近更新日期 */
export const LEGAL_UPDATED = "2026 年 10 月 12 日";
