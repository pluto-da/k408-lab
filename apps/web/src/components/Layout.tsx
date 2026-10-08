import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import { useSync } from "../store/sync";

const NAV = [
  { to: "/lab", label: "实验室" },
  { to: "/dashboard", label: "学习进度" },
  { to: "/mistakes", label: "错题本" },
];

function Notice() {
  const notice = useSync((s) => s.notice);
  const set = useSync((s) => s.set);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => set({ notice: null }), 6000);
    return () => clearTimeout(t);
  }, [notice, set]);
  if (!notice) return null;
  return (
    <div className="app-toast" role="status">
      <span>{notice.text}</span>
      {notice.to && (
        <Link to={notice.to} onClick={() => set({ notice: null })}>
          {notice.toLabel ?? "查看"}
        </Link>
      )}
      <button type="button" aria-label="关闭" onClick={() => set({ notice: null })}>
        ×
      </button>
    </div>
  );
}

export default function Layout() {
  const { status, user } = useAuth();
  const pending = useSync((s) => s.pending);
  const lastError = useSync((s) => s.lastError);
  const loc = useLocation();
  const isLab = loc.pathname === "/lab";

  useEffect(() => {
    if (!isLab) window.scrollTo(0, 0);
  }, [loc.pathname, isLab]);

  return (
    <div className={isLab ? "app app--lab" : "app"}>
      <div className="app-bar">
        <div className="app-bar__in">
          <Link to="/" className="app-brand">
            考研408<b>动画实验室</b>
          </Link>
          <nav className="app-nav" aria-label="主导航">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "is-on" : undefined)}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="app-user">
            {status === "authed" && pending > 0 && (
              <span className="app-sync" title={lastError ?? "正在同步学习记录"}>
                {lastError ? "同步重试中" : "同步中"}
              </span>
            )}
            {status === "authed" && user ? (
              <NavLink to="/profile" className="app-user__name">
                {user.nickname}
              </NavLink>
            ) : status === "anon" ? (
              <>
                <Link to={`/login?next=${encodeURIComponent(loc.pathname)}`} className="app-btn app-btn--ghost">
                  登录
                </Link>
                <Link to="/register" className="app-btn">
                  注册
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <main className={isLab ? "app-main app-main--lab" : "app-main"}>
        <Outlet />
      </main>
      {!isLab && (
        <footer className="app-foot">
          <p>考研408动画实验室 · 数据结构 / 计算机组成原理 / 操作系统 / 计算机网络</p>
        </footer>
      )}
      <Notice />
    </div>
  );
}
