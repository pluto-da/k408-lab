import { Link } from "react-router-dom";
import { CATALOG, KIND_NAMES, SUBJECT_COLORS, type ItemKind } from "@k408/shared";
import { useMistakes, useProgress } from "../api/hooks";
import { errorMessage } from "../api/client";
import RequireAuth from "../components/RequireAuth";
import { Bar, SubjectTag } from "../components/ui";
import { fmtDate } from "../lib/format";
import { useAuth } from "../store/auth";

const KINDS: ItemKind[] = ["chapter", "lab", "part", "flow", "quiz"];
const KIND_HINT: Record<ItemKind, string> = {
  chapter: "在章节列表里点开考点卡",
  lab: "在可视化实验室切换到该实验",
  part: "在 3D 主板上点选部件聚焦",
  flow: "完成一次「我来操作」闯关",
  quiz: "在自测中答对",
};

function Ring({ percent }: { percent: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="ring" aria-hidden="true">
      <circle cx="60" cy="60" r={r} className="ring__bg" />
      <circle cx="60" cy="60" r={r} className="ring__fg" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} />
      <text x="60" y="66" textAnchor="middle">
        {percent}%
      </text>
    </svg>
  );
}

function DashboardInner() {
  const user = useAuth((s) => s.user);
  const q = useProgress(true);
  const m = useMistakes({ status: "active" }, true);
  if (q.isLoading) return <div className="page-pad muted">加载中…</div>;
  if (q.error || !q.data) return <div className="page-pad form-err">{errorMessage(q.error)}</div>;
  const p = q.data;
  const done = new Set(p.completedIds);
  const activeMistakes = m.data ? Object.values(m.data.counts).reduce((a, c) => a + c.active, 0) : 0;

  return (
    <div className="page-pad">
      <header className="page-head">
        <h1>学习进度</h1>
        <p className="muted">{user?.nickname}，共 {p.overall.total} 个学习点，已完成 {p.overall.done} 个。</p>
      </header>

      <section className="dash-top">
        <div className="panel dash-overall">
          <Ring percent={p.overall.percent} />
          <div>
            <b>总进度</b>
            <p className="muted">章节考点、实验、部件、流程闯关与自测题合计</p>
            <div className="row">
              <Link className="app-btn" to="/lab">
                继续学习
              </Link>
              <Link className="app-btn app-btn--ghost" to="/mistakes">
                错题本{activeMistakes ? `（${activeMistakes} 待复习）` : ""}
              </Link>
            </div>
          </div>
        </div>
        <div className="panel">
          <b>最近学习</b>
          {p.recent.length === 0 ? (
            <p className="muted">还没有记录。去实验室点开一个章节或实验试试。</p>
          ) : (
            <ul className="recent">
              {p.recent.map((r) => (
                <li key={r.itemId}>
                  <SubjectTag subject={r.subject} />
                  <span>{r.title}</span>
                  <small className="muted">
                    {KIND_NAMES[r.kind]} · {fmtDate(r.lastAt)}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="dash-subjects">
        {p.subjects.map((s) => (
          <article key={s.subject} className="panel subj" style={{ ["--c" as string]: SUBJECT_COLORS[s.subject] }}>
            <header>
              <h2>{s.name}</h2>
              <strong>{s.percent}%</strong>
            </header>
            <Bar percent={s.percent} color={SUBJECT_COLORS[s.subject]} />
            <p className="muted">
              {s.done} / {s.total}
            </p>
            <table className="kind-table">
              <tbody>
                {KINDS.filter((k) => s.byKind[k].total > 0).map((k) => (
                  <tr key={k} title={KIND_HINT[k]}>
                    <th>{KIND_NAMES[k]}</th>
                    <td>
                      {s.byKind[k].done} / {s.byKind[k].total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details>
              <summary>明细</summary>
              <ul className="checklist">
                {CATALOG.filter((c) => c.subject === s.subject).map((c) => (
                  <li key={c.id} className={done.has(c.id) ? "is-done" : undefined}>
                    {done.has(c.id) ? "✓" : "○"} {c.title}
                    <small className="muted"> · {KIND_NAMES[c.kind]}</small>
                  </li>
                ))}
              </ul>
            </details>
            <Link to={`/lab#${s.subject}`}>去学{s.name} →</Link>
          </article>
        ))}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth title="学习进度">
      <DashboardInner />
    </RequireAuth>
  );
}
