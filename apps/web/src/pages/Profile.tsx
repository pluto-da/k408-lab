import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout, useUpdateProfile } from "../api/hooks";
import { errorMessage } from "../api/client";
import { useAuth } from "../store/auth";
import RequireAuth from "../components/RequireAuth";
import { fmtDate } from "../lib/format";

function ProfileInner() {
  const user = useAuth((s) => s.user)!;
  const [nickname, setNickname] = useState(user.nickname);
  const update = useUpdateProfile();
  const logout = useLogout();
  const nav = useNavigate();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({ nickname: nickname.trim() });
  };

  return (
    <div className="page-pad">
      <div className="auth-card">
        <h1>个人资料</h1>
        <dl className="kv">
          <div>
            <dt>用户名</dt>
            <dd>{user.username ?? "未设置"}</dd>
          </div>
          <div>
            <dt>邮箱</dt>
            <dd>{user.email ?? "未设置"}</dd>
          </div>
          <div>
            <dt>注册时间</dt>
            <dd>{fmtDate(user.createdAt)}</dd>
          </div>
        </dl>
        <form onSubmit={submit} className="stack">
          <label>
            昵称
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} />
          </label>
          {update.error && <p className="form-err">{errorMessage(update.error)}</p>}
          {update.isSuccess && !update.isPending && <p className="form-ok">已保存</p>}
          <button className="app-btn" disabled={update.isPending || !nickname.trim() || nickname.trim() === user.nickname}>
            保存昵称
          </button>
        </form>
        <hr />
        <button
          type="button"
          className="app-btn app-btn--ghost"
          disabled={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSuccess: () => nav("/", { replace: true }) })}
        >
          退出登录
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth title="个人资料">
      <ProfileInner />
    </RequireAuth>
  );
}
