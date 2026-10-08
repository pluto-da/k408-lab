import { Link } from "react-router-dom";
import { FLOWS, LABS, SUBJECTS, SUBJECT_COLORS, SUBJECT_NAMES, CHAPTERS } from "@k408/shared";
import { useAuth } from "../store/auth";

export default function HomePage() {
  const { status, user } = useAuth();
  return (
    <div className="page-pad home">
      <section className="home-hero">
        <p className="eyebrow">考研 408 · 四门课一张图</p>
        <h1>把计算机拆开给你看</h1>
        <p className="lead">
          3D 拆开一块主板，看 CPU、内存、总线、网卡各管哪几章；{LABS.length} 个动画实验单步演示算法；
          {FLOWS.length} 条流程演示跟着数据走完全程。自测答错的题自动收进错题本。
        </p>
        <div className="row">
          <Link to="/lab" className="app-btn app-btn--big">
            进入实验室
          </Link>
          {status === "authed" ? (
            <Link to="/dashboard" className="app-btn app-btn--ghost app-btn--big">
              {user?.nickname}，继续学习
            </Link>
          ) : (
            <Link to="/register" className="app-btn app-btn--ghost app-btn--big">
              注册，保存进度
            </Link>
          )}
        </div>
      </section>

      <section className="home-grid" aria-label="四门科目">
        {SUBJECTS.map((s) => (
          <Link key={s} to={`/lab#${s}`} className="home-card" style={{ ["--c" as string]: SUBJECT_COLORS[s] }}>
            <b>{SUBJECT_NAMES[s]}</b>
            <span>
              {CHAPTERS.filter((c) => c.subject === s).length} 章 · {LABS.filter((l) => l.subject === s).length} 个实验
            </span>
          </Link>
        ))}
      </section>

      <section className="home-feats">
        <div>
          <h2>学习进度</h2>
          <p>看过的章节考点、打开过的实验、拆解过的部件、看过的流程演示都会记录，按四门课显示完成百分比。</p>
          <Link to="/dashboard">查看进度 →</Link>
        </div>
        <div>
          <h2>错题本</h2>
          <p>自测答错的题会连同你的选择和解析一起收录，按科目筛选，重做答对即标记已掌握。</p>
          <Link to="/mistakes">打开错题本 →</Link>
        </div>
      </section>
    </div>
  );
}
