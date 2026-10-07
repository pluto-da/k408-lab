import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function RequireAuth({ children, title }: { children: ReactNode; title: string }) {
  const status = useAuth((s) => s.status);
  const loc = useLocation();
  if (status === "loading") return <div className="page-pad muted">加载中…</div>;
  if (status === "anon") {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return (
      <div className="page-pad">
        <div className="empty">
          <h1>{title}</h1>
          <p>登录后，你在实验室里的每一步都会被记下来：看过的考点、打开的实验、闯关成绩和错题。</p>
          <div className="row">
            <Link className="app-btn" to={`/login?next=${next}`}>
              登录
            </Link>
            <Link className="app-btn app-btn--ghost" to={`/register?next=${next}`}>
              注册新账号
            </Link>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
