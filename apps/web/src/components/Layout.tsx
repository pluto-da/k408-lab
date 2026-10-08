import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";

const NAV = [
  { to: "/lab", label: "实验室" },
  { to: "/pc", label: "整机拆解" },
];

export default function Layout() {
  const { status, user } = useAuth();
  const loc = useLocation();
  const isLab = loc.pathname === "/lab";
  const isFull = loc.pathname === "/pc";

  useEffect(() => {
    if (!isLab) window.scrollTo(0, 0);
  }, [loc.pathname, isLab]);

  return (
    <div className={isLab ? "app app--lab" : isFull ? "app app--full" : "app"}>
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
      <main className={isLab ? "app-main app-main--lab" : isFull ? "app-main app-main--full" : "app-main"}>
        <Outlet />
      </main>
      {!isLab && !isFull && (
        <footer className="app-foot">
          <p>考研408动画实验室 · 数据结构 / 计算机组成原理 / 操作系统 / 计算机网络</p>
        </footer>
      )}
    </div>
  );
}
