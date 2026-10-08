import { Link, useLocation } from "react-router-dom";

export default function NotFoundPage() {
  const { pathname } = useLocation();
  return (
    <div className="page-pad">
      <div className="empty">
        <p className="eyebrow">404</p>
        <h1>页面不存在</h1>
        <p>
          没有找到 <code>{pathname}</code>，链接可能已失效或输错了。
        </p>
        <div className="row">
          <Link className="app-btn" to="/">
            回到首页
          </Link>
          <Link className="app-btn app-btn--ghost" to="/lab">
            去实验室
          </Link>
          <Link className="app-btn app-btn--ghost" to="/pc">
            整机拆解
          </Link>
        </div>
      </div>
    </div>
  );
}
