import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FLOWS, LABS, SUBJECTS, SUBJECT_COLORS, SUBJECT_NAMES, CHAPTERS } from "@k408/shared";
import heroImg from "../assets/home-pc.webp";

/** 首页主图上的热点：位置是主图（/pc 影棚模式截图，1180×820）上的百分比坐标，点了直接去整机拆解 */
const SPOTS = [
  { x: 40, y: 32, label: "CPU", sub: "运算器 + 控制器", c: "#E8843A" },
  { x: 50.4, y: 31, label: "内存", sub: "主存 · DDR5", c: "#B07CFF" },
  { x: 45.3, y: 48, label: "显卡", sub: "PCIe x16", c: "#3CA8FF" },
  { x: 52.3, y: 78.5, label: "硬盘", sub: "SATA · 持久化", c: "#FF9A3C" },
];

/** 一条指令 / 一次数据的旅程：首页时间线 */
const STOPS = [
  { t: "网卡收帧", d: "MAC · CRC 校验", s: "cn" },
  { t: "DMA 写内存", d: "不经 CPU 搬运数据", s: "co" },
  { t: "中断响应", d: "保存断点与现场", s: "os" },
  { t: "Cache 缺失", d: "按块调入 · 局部性", s: "co" },
  { t: "写 Cache", d: "写回法 · 脏位", s: "co" },
  { t: "显卡输出", d: "PCIe 带宽", s: "co" },
  { t: "落盘 SSD", d: "文件系统 · 缓冲", s: "os" },
] as const;

const BOOT = ["POST 自检 … 正常", "CPU 8 核 16 线程 … 正常", "内存 32768 MB … 正常", "PCIe x16 显卡 … 就绪", "NVMe 固态硬盘 … 就绪", "引导 408 知识系统 …"];

function BootLine() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % BOOT.length), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="hx-boot" aria-hidden="true">
      <span key={i}>&gt; {BOOT[i]}</span>
    </p>
  );
}

export default function HomePage() {
  return (
    <div className="home">
      <section className="hx-hero">
        <div className="hx-hero__in">
          <div className="hx-copy">
            <p className="hx-eyebrow">考研 408 · 四门课一台电脑</p>
            <h1>
              把计算机
              <br />
              <em>拆开</em>给你看
            </h1>
            <p className="hx-lead">
              一台按真实尺寸做出来的整机：点一下 CPU、内存、显卡、硬盘，把它拆出来、打开看内部，对上 408 的每一章。
              再配 {LABS.length} 个动画实验和 {FLOWS.length} 条流程演示，把抽象的考点变成看得见的过程。
            </p>
            <div className="hx-cta">
              <Link to="/pc" className="hx-btn hx-btn--main">
                拆开整机 <span aria-hidden="true">→</span>
              </Link>
              <Link to="/pc?tour=1" className="hx-btn">
                ▶ 跟着数据走一遍
              </Link>
              <Link to="/lab" className="hx-btn hx-btn--ghost">
                进入实验室
              </Link>
            </div>
            <p className="hx-note">免费使用 · 无需注册 · 手机、平板、电脑都能打开</p>
            <BootLine />
          </div>
          <Link to="/pc" className="hx-stage" aria-label="打开整机拆解">
            <img src={heroImg} alt="一台侧透机箱的台式电脑：CPU 塔式散热器、两条内存、显卡、电源和机械硬盘清晰可见" width={1180} height={820} />
            <svg className="hx-trace" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path d="M52.3 78.5 C 54 68, 52 60, 49 55 S 41 42, 40 32" />
              <path d="M40 32 C 43 29, 47 29, 50.4 31" className="is-b" />
              <path d="M40 32 C 41 38, 43.5 43, 45.3 48" className="is-c" />
            </svg>
            {SPOTS.map((s) => (
              <span key={s.label} className="hx-spot" style={{ left: `${s.x}%`, top: `${s.y}%`, ["--c" as string]: s.c }}>
                <i />
                <b>
                  {s.label}
                  <small>{s.sub}</small>
                </b>
              </span>
            ))}
          </Link>
        </div>
      </section>

      <section className="hx-journey page-pad" aria-label="一次数据的旅程">
        <div className="hx-sec-head">
          <h2>一次数据的旅程</h2>
          <p>从网线到屏幕和硬盘，一个数据包会经过四门课里的哪些考点？</p>
        </div>
        <ol className="hx-stops">
          {STOPS.map((s, i) => (
            <li key={s.t} style={{ ["--c" as string]: SUBJECT_COLORS[s.s], ["--i" as string]: i }}>
              <span className="hx-stops__n">{String(i + 1).padStart(2, "0")}</span>
              <b>{s.t}</b>
              <small>{s.d}</small>
            </li>
          ))}
        </ol>
        <Link to="/pc?tour=1" className="hx-link">
          在 3D 整机里看这段旅程 →
        </Link>
      </section>

      <section className="page-pad hx-subjects" aria-label="四门科目">
        <div className="hx-sec-head">
          <h2>四门课，一张图</h2>
          <p>每个部件都连着教材里的章节，点进去就是对应的考点与动画实验。</p>
        </div>
        <div className="home-grid">
          {SUBJECTS.map((s) => (
            <Link key={s} to={`/lab#${s}`} className="home-card" style={{ ["--c" as string]: SUBJECT_COLORS[s] }}>
              <b>{SUBJECT_NAMES[s]}</b>
              <span>
                {CHAPTERS.filter((c) => c.subject === s).length} 章 · {LABS.filter((l) => l.subject === s).length} 个实验
              </span>
              <i aria-hidden="true">→</i>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
