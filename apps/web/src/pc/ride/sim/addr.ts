// 地址工具：与实验室过程图解（TLB + Cache 地址转换、二级页表地址转换）使用同一个确定性散列，
// 同一个虚拟地址在两处看到的页目录号、页表索引、页表所在页框、TLB 组号相同。

/** 与实验室过程图解相同的整数散列 */
export function mix(a: number, b: number): number {
  let x = (Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x27d4eb2f, 0xc2b2ae35)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  return (x ^ (x >>> 12)) >>> 0;
}

/** 0x 开头、大写、按位宽补零的十六进制 */
export function hex(v: number, width = 1): string {
  return "0x" + (v >>> 0).toString(16).toUpperCase().padStart(width, "0");
}

/** 位数对应的十六进制位数 */
export const hexWidth = (bits: number) => Math.max(1, Math.ceil(bits / 4));

/** 把 32 位地址写成 0x0040 2A7C 这样中间留空的形式，便于阅读 */
export function hex32Spaced(v: number): string {
  const s = (v >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `0x${s.slice(0, 4)} ${s.slice(4)}`;
}

export function bin(v: number, width: number): string {
  return (v >>> 0).toString(2).padStart(width, "0").slice(-width);
}

/** 解析十六进制地址（可带 0x、空格、下划线），超出 32 位或非法时返回 null */
export function parseHexAddr(s: string): number | null {
  const t = s.trim().replace(/[\s_]/g, "").replace(/^0x/i, "");
  if (!/^[0-9a-f]{1,8}$/i.test(t)) return null;
  return parseInt(t, 16) >>> 0;
}

export const log2i = (n: number) => Math.round(Math.log2(n));
