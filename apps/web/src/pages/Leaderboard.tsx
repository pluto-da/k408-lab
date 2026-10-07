import { Link, useSearchParams } from "react-router-dom";
import { FLOWS, FLOW_IDS, SUBJECT_COLORS } from "@k408/shared";
import { useLeaderboard } from "../api/hooks";
import { errorMessage } from "../api/client";
import { useAuth } from "../store/auth";
import { Stars } from "../components/ui";
import { fmtDate, fmtTime } from "../lib/format";

export default function LeaderboardPage() {
  const [params, setParams] = useSearchParams();
  const flowParam = params.get("flow");
  const flowId = flowParam && FLOW_IDS.includes(flowParam) ? flowParam : FLOWS[0]!.id;
  const period = params.get("period") === "all" ? "all" : "week";
  const status = useAuth((s) => s.status);
  const q = useLeaderboard(flowId, period);
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    n.set(k, v);
    setParams(n, { replace: true });
  };
  const me = q.data?.me;

  return (
    <div className="page-pad">
      <header className="page-head">
        <h1>排行榜</h1>
        <p className="muted">每人取最好成绩：星级高者在前，同星级比失误少，再比用时短。本周榜从北京时间周一 0 点起算。</p>
      </header>
      <div className="filters">
        <div className="chips" role="tablist" aria-label="流程">
          {FLOWS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === flowId}
              aria-pressed={f.id === flowId}
              style={{ ["--c" as string]: SUBJECT_COLORS[f.subject] }}
              onClick={() => set("flow", f.id)}
            >
              {f.title}
            </button>
          ))}
        </div>
        <div className="seg" role="tablist" aria-label="周期">
          <button type="button" role="tab" aria-selected={period === "week"} onClick={() => set("period", "week")}>
            本周
          </button>
          <button type="button" role="tab" aria-selected={period === "all"} onClick={() => set("period", "all")}>
            总榜
          </button>
        </div>
      </div>

      <div className="panel me-rank">
        {status !== "authed" ? (
          <p>
            <Link to={`/login?next=${encodeURIComponent(`/leaderboard?flow=${flowId}&period=${period}`)}`}>登录</Link>后显示你的名次。
          </p>
        ) : me ? (
          <p>
            我的名次：<b>第 {me.rank} 名</b>
            {q.data ? ` / ${q.data.totalPlayers} 人` : ""} · <Stars n={me.stars} /> · 失误 {me.mistakes} · 用时 {fmtTime(me.timeMs)}
          </p>
        ) : (
          <p>
            {period === "week" ? "本周" : "目前"}还没有你的成绩。<Link to="/lab#hero">去闯关 →</Link>
          </p>
        )}
      </div>

      {q.isLoading ? (
        <p className="muted">加载中…</p>
      ) : q.error ? (
        <p className="form-err">{errorMessage(q.error)}</p>
      ) : q.data && q.data.rows.length === 0 ? (
        <div className="empty">
          <p>{period === "week" ? "本周还没有人通关，第一名等你来拿。" : "还没有人通关。"}</p>
          <Link className="app-btn" to="/lab#hero">
            去闯关
          </Link>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="lb">
            <thead>
              <tr>
                <th scope="col">名次</th>
                <th scope="col">昵称</th>
                <th scope="col">星级</th>
                <th scope="col">失误</th>
                <th scope="col">用时</th>
                <th scope="col">达成时间</th>
              </tr>
            </thead>
            <tbody>
              {q.data?.rows.map((r) => (
                <tr key={r.userId} className={me && me.userId === r.userId ? "is-me" : undefined}>
                  <td className="lb-rank">{r.rank}</td>
                  <td>{r.nickname}</td>
                  <td>
                    <Stars n={r.stars} />
                  </td>
                  <td>{r.mistakes}</td>
                  <td>{fmtTime(r.timeMs)}</td>
                  <td className="muted">{fmtDate(r.achievedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">显示前 50 名，共 {q.data?.totalPlayers ?? 0} 人上榜。</p>
        </div>
      )}
    </div>
  );
}
