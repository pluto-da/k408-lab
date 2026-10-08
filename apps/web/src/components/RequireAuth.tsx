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
          <p>登录后即可管理你的账号资料。</p>
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
