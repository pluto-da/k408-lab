import { Link } from "react-router-dom";
import { CHAPTERS, LABS, SUBJECTS, SUBJECT_NAMES, type Subject } from "@k408/shared";
import heroImg from "../assets/home-pc.webp";

/** 每门课的分值、题号与最常考的几处（首页信息卡用） */
const SUBJECT_INFO: Record<Subject, { score: number; qs: string; hot: string[] }> = {
  ds: { score: 45, qs: "选择 1–11 · 综合 2 题", hot: ["树与二叉树", "图的最短路径", "排序"] },
  co: { score: 45, qs: "选择 12–22 · 综合 2 题", hot: ["Cache 映射", "指令流水线", "浮点数表示"] },
  os: { score: 35, qs: "选择 23–32 · 综合 2 题", hot: ["PV 同步", "页面置换", "文件分配"] },
  cn: { score: 25, qs: "选择 33–40 · 综合 1 题", hot: ["子网划分", "TCP 拥塞控制", "滑动窗口"] },
};

/** 常用实验：点了直达实验室里对应的演示 */
const COMMON_LABS: { id: string; d: string }[] = [
  { id: "sort", d: "5 种排序，一趟一趟看" },
  { id: "tree", d: "先序、中序、后序、层序" },
  { id: "dijkstra", d: "每轮选最近顶点、松弛边" },
  { id: "paging", d: "看 LRU、OPT 每一步怎么换页" },
  { id: "tcp", d: "慢启动、拥塞避免、快恢复" },
  { id: "cache", d: "地址怎么切分，命中还是缺失" },
];

/** 一次数据的旅程：从网线到屏幕和硬盘 */
const STOPS = [
  { t: "网卡收帧", d: "MAC 地址 · CRC 校验" },
  { t: "DMA 写内存", d: "不经 CPU 搬运数据" },
  { t: "中断响应", d: "保存断点与现场" },
  { t: "Cache 缺失", d: "按块调入 · 局部性" },
  { t: "写 Cache", d: "写回法 · 脏位" },
  { t: "显卡输出", d: "PCIe 带宽" },
  { t: "落盘 SSD", d: "文件系统 · 缓冲" },
];

const LAB_BY_ID = Object.fromEntries(LABS.map((l) => [l.id, l]));

export default function HomePage() {
  return (
    <div className="home">
      <section className="hm-hero" aria-labelledby="hm-title">
        <div className="hm-wrap">
          <div>
            <h1 id="hm-title">408 四门课，拆开来学</h1>
            <p className="hm-lead">
              章节考点、{LABS.length} 个能单步看的动画实验，还有一台能拆开的电脑。打开就能复习，不用注册。
            </p>
            <div className="hm-cta">
              <a href="#subjects" className="app-btn app-btn--big">
                开始学习
              </a>
              <Link to="/pc" className="app-btn app-btn--big app-btn--ghost">
                拆开整机
              </Link>
            </div>
            <p className="hm-note">免费使用 · 手机、平板、电脑都能打开</p>
          </div>
          <figure className="hm-pic">
            <img
              src={heroImg}
              alt="一台侧透机箱的台式电脑：CPU 散热器、内存、显卡、电源和硬盘清晰可见"
              width={1180}
              height={820}
              decoding="async"
              loading="lazy"
            />
          </figure>
        </div>
      </section>

      <section id="subjects" className="hm-sec" aria-labelledby="hm-subjects">
        <div className="hm-wrap">
          <div className="hm-head">
            <h2 id="hm-subjects">四门课</h2>
            <p>满分 150 · 点进去看章节考点和易错点</p>
          </div>
          <ul className="hm-subjects">
            {SUBJECTS.map((s) => {
              const info = SUBJECT_INFO[s];
              return (
                <li key={s}>
                  <Link to={`/lab#${s}`} className="hm-card" style={{ ["--c" as string]: `var(--${s})` }}>
                    <div className="hm-card__top">
                      <h3>{SUBJECT_NAMES[s]}</h3>
                      <span className="hm-card__score">
                        {info.score}
                        <small>分</small>
                      </span>
                    </div>
                    <p className="hm-card__meta">
                      <span>
                        {CHAPTERS.filter((c) => c.subject === s).length} 章 · {LABS.filter((l) => l.subject === s).length} 个实验
                      </span>
                      <span>{info.qs}</span>
                    </p>
                    <ul className="hm-card__pts" aria-label="高频考点">
                      {info.hot.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                    <span className="hm-card__go">看考点 →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="hm-sec" aria-labelledby="hm-labs">
        <div className="hm-wrap">
          <div className="hm-head">
            <h2 id="hm-labs">常用实验</h2>
            <Link to="/lab#lab" className="hm-more">
              全部 {LABS.length} 个实验 →
            </Link>
          </div>
          <ul className="hm-labs">
            {COMMON_LABS.map(({ id, d }) => {
              const lab = LAB_BY_ID[id];
              if (!lab) return null;
              return (
                <li key={id}>
                  <Link to={`/lab#lab-${id}`} className="hm-lab" style={{ ["--c" as string]: `var(--${lab.subject})` }}>
                    <i className="hm-lab__dot" aria-hidden="true" />
                    <span>
                      <b>{lab.title}</b>
                      <small>{d}</small>
                    </span>
                    <span className="hm-lab__arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="hm-sec" aria-labelledby="hm-journey">
        <div className="hm-wrap">
          <div className="hm-head">
            <h2 id="hm-journey">一次数据的旅程</h2>
            <Link to="/pc?tour=1" className="hm-more">
              在整机里走一遍 →
            </Link>
          </div>
          <ol className="hm-steps">
            {STOPS.map((s) => (
              <li key={s.t}>
                <b>{s.t}</b>
                <small>{s.d}</small>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
