import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="page-pad">
      <div className="empty">
        <h1>页面不存在</h1>
        <p>链接可能已失效。</p>
        <Link className="app-btn" to="/">
          回到首页
        </Link>
      </div>
    </div>
  );
}
