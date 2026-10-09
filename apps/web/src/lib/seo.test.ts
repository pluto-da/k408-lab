import { describe, expect, it } from "vitest";
import { applyRouteMeta, routeMeta, SITE_NAME } from "./seo";
import { safeNext } from "./format";

describe("routeMeta", () => {
  it("已知路由有独立标题，未知路由按 404 处理且不收录", () => {
    expect(routeMeta("/lab").title).toContain("实验室");
    expect(routeMeta("/lab/").title).toContain("实验室");
    expect(routeMeta("/").title).toContain(SITE_NAME);
    expect(routeMeta("/nope")).toMatchObject({ noindex: true });
    expect(routeMeta("/login").noindex).toBe(true);
    expect(routeMeta("/terms").title).toContain("用户协议");
    expect(routeMeta("/privacy").title).toContain("隐私政策");
    expect(routeMeta("/privacy").noindex).toBeFalsy();
  });

  it("写入 document.title 与 meta", () => {
    applyRouteMeta("/login");
    expect(document.title).toContain("登录");
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex");
    applyRouteMeta("/pc");
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute("content")).toContain("整机拆解");
  });
});

describe("safeNext", () => {
  it("只允许站内路径", () => {
    expect(safeNext("/profile?a=1")).toBe("/profile?a=1");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/%5Cevil.example")).toBe("/%5Cevil.example");
  });
});
