import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import { applyRouteMeta } from "../lib/seo";
import { CONTACT_EMAIL } from "../lib/site";

/** ICP 备案号：域名备案通过后在构建时通过 VITE_ICP_BEIAN 传入，页脚按工信部要求展示并链接到 beian.miit.gov.cn */
const ICP = import.meta.env.VITE_ICP_BEIAN?.trim();

const NAV = [
  { to: "/lab", label: "实验室" },
  { to: "/pc", label: "整机拆解" },
];

export default function Layout() {
  const { status, user } = useAuth();
  const loc = useLocation();
  const isLab = loc.pathname === "/lab";
  const isFull = loc.pathname === "/pc";
  // 手机（< 768px）上导航收进菜单：顶栏只留站名、账号和菜单按钮，菜单展开为全宽抽屉
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => mq.matches && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!isLab) window.scrollTo(0, 0);
  }, [loc.pathname, isLab]);

  useEffect(() => {
    applyRouteMeta(loc.pathname);
  }, [loc.pathname]);

  return (
    <div className={isLab ? "app app--lab" : isFull ? "app app--full" : "app"}>
      <a className="skip-link" href="#main">
        跳到正文
      </a>
      <div className={menuOpen ? "app-bar is-menu" : "app-bar"}>
        <div className="app-bar__in">
          <Link to="/" className="app-brand">
            考研408<b>动画实验室</b>
          </Link>
          <nav id="app-nav" className="app-nav" aria-label="主导航">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "is-on" : undefined)}>
                {n.label}
              </NavLink>
            ))}
            {status === "authed" && user ? (
              <NavLink to="/profile" className={({ isActive }) => (isActive ? "app-nav__acct is-on" : "app-nav__acct")}>
                个人中心（{user.nickname}）
              </NavLink>
            ) : status === "anon" ? (
              <>
                <Link to={`/login?next=${encodeURIComponent(loc.pathname)}`} className="app-nav__acct">
                  登录
                </Link>
                <Link to="/register" className="app-nav__acct">
                  注册
                </Link>
              </>
            ) : null}
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
                <Link to="/register" className="app-btn app-user__reg">
                  注册
                </Link>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="app-menu"
            aria-expanded={menuOpen}
            aria-controls="app-nav"
            aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span aria-hidden="true" />
          </button>
        </div>
      </div>
      {menuOpen && <div className="app-scrim" aria-hidden="true" onClick={() => setMenuOpen(false)} />}
      <main id="main" tabIndex={-1} className={isLab ? "app-main app-main--lab" : isFull ? "app-main app-main--full" : "app-main"}>
        <Outlet />
      </main>
      {!isLab && !isFull && (
        <footer className="app-foot">
          <p>考研408动画实验室 · 内容依据 408 统考大纲整理，仅供个人复习</p>
          <nav className="app-foot__nav" aria-label="页脚导航">
            <Link to="/terms">用户协议</Link>
            <Link to="/privacy">隐私政策</Link>
            {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>}
            {ICP && (
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
                {ICP}
              </a>
            )}
          </nav>
        </footer>
      )}
    </div>
  );
}
