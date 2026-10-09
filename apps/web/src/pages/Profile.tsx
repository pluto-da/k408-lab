import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDeleteAccount, useLogout, useLogoutAll, useUpdateProfile } from "../api/hooks";
import { errorMessage } from "../api/client";
import { useAuth } from "../store/auth";
import RequireAuth from "../components/RequireAuth";
import { fmtDate } from "../lib/format";
import PasswordInput from "../components/PasswordInput";

function ProfileInner() {
  const user = useAuth((s) => s.user)!;
  const [nickname, setNickname] = useState(user.nickname);
  const update = useUpdateProfile();
  const logout = useLogout();
  const logoutAll = useLogoutAll();
  const del = useDeleteAccount();
  const [confirmAll, setConfirmAll] = useState(false);
  const [delPassword, setDelPassword] = useState("");
  const nav = useNavigate();
  const busy = logout.isPending || logoutAll.isPending || del.isPending;

  // 成功后登录态立即清空、本组件随之卸载，mutate 的 onSuccess 回调不会再执行，所以用 mutateAsync 再跳转
  const after = (p: Promise<unknown>, to: string) =>
    p.then(
      () => nav(to, { replace: true }),
      () => undefined, // 错误已由 mutation.error 展示
    );

  const deleteAccount = (e: FormEvent) => {
    e.preventDefault();
    if (!delPassword) return;
    void after(del.mutateAsync({ password: delPassword }), "/");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({ nickname: nickname.trim() });
  };

  return (
    <div className="page-pad">
      <div className="auth-card auth-card--wide">
        <h1>个人资料</h1>
        <section className="pf-group" aria-labelledby="h-account">
          <h2 id="h-account">账户信息</h2>
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
            {update.error && <p className="form-err" role="alert">{errorMessage(update.error)}</p>}
            {update.isSuccess && !update.isPending && (
              <p className="form-ok" role="status">
                已保存
              </p>
            )}
            <div className="row">
              <button className="app-btn" disabled={update.isPending || !nickname.trim() || nickname.trim() === user.nickname}>
                保存昵称
              </button>
            </div>
          </form>
        </section>
        <section className="pf-group" aria-labelledby="h-security">
          <h2 id="h-security">安全</h2>
          <p className="muted small">在网吧、图书馆或别人的手机上登录过？退出所有设备后，所有已登录的地方（包括这台设备）都需要重新登录。</p>
          {logoutAll.error && <p className="form-err" role="alert">{errorMessage(logoutAll.error)}</p>}
          <div className="row">
            <button
              type="button"
              className="app-btn app-btn--ghost"
              disabled={busy}
              onClick={() => void after(logout.mutateAsync(), "/")}
            >
              退出登录
            </button>
            {confirmAll ? (
              <>
                <button
                  type="button"
                  className="app-btn"
                  disabled={busy}
                  onClick={() => void after(logoutAll.mutateAsync(), "/login")}
                >
                  {logoutAll.isPending ? "正在退出…" : "确认退出所有设备"}
                </button>
                <button type="button" className="app-btn app-btn--text" onClick={() => setConfirmAll(false)}>
                  取消
                </button>
              </>
            ) : (
              <button type="button" className="app-btn app-btn--ghost" disabled={busy} onClick={() => setConfirmAll(true)}>
                退出所有设备
              </button>
            )}
          </div>
        </section>
        <section className="pf-group pf-group--danger" aria-labelledby="h-danger">
          <h2 id="h-danger">危险操作</h2>
          <details className="danger-zone__del">
            <summary>注销账号</summary>
            <form onSubmit={deleteAccount} className="stack">
              <p className="muted small">
                注销后账号与昵称会被立即永久删除，无法恢复，用户名和邮箱可以重新注册。详见<Link to="/privacy">隐私政策</Link>。
              </p>
              <label>
                输入当前密码确认
                <PasswordInput value={delPassword} onChange={(e) => setDelPassword(e.target.value)} autoComplete="current-password" maxLength={72} />
              </label>
              {del.error && <p className="form-err" role="alert">{errorMessage(del.error)}</p>}
              <div className="row">
                <button className="app-btn app-btn--danger" disabled={busy || !delPassword}>
                  {del.isPending ? "正在注销…" : "永久注销账号"}
                </button>
              </div>
            </form>
          </details>
        </section>
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
