import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useRegister } from "../api/hooks";
import { errorMessage } from "../api/client";
import { safeNext } from "../lib/format";

export default function RegisterPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const nav = useNavigate();
  const reg = useRegister();
  const [f, setF] = useState({ username: "", email: "", password: "", confirm: "", nickname: "" });
  const [localErr, setLocalErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setLocalErr(null);
    if (!f.username.trim() && !f.email.trim()) return setLocalErr("用户名和邮箱至少填写一个");
    if (f.password.length < 8) return setLocalErr("密码至少 8 位");
    if (f.password !== f.confirm) return setLocalErr("两次输入的密码不一致");
    reg.mutate(
      { username: f.username.trim() || undefined, email: f.email.trim() || undefined, password: f.password, nickname: f.nickname.trim() || undefined },
      { onSuccess: () => nav(next, { replace: true }) },
    );
  };

  return (
    <div className="page-pad">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>注册</h1>
        <p className="muted">用户名、邮箱填一个即可，之后都能用来登录。</p>
        <label>
          用户名
          <input value={f.username} onChange={set("username")} autoComplete="username" placeholder="3–20 位，字母 / 数字 / 下划线 / 汉字" autoFocus />
        </label>
        <label>
          邮箱（选填）
          <input type="email" value={f.email} onChange={set("email")} autoComplete="email" placeholder="name@example.com" />
        </label>
        <label>
          昵称（选填）
          <input value={f.nickname} onChange={set("nickname")} maxLength={20} />
        </label>
        <label>
          密码
          <input type="password" value={f.password} onChange={set("password")} autoComplete="new-password" placeholder="至少 8 位" />
        </label>
        <label>
          确认密码
          <input type="password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" />
        </label>
        {(localErr || reg.error) && <p className="form-err">{localErr ?? errorMessage(reg.error)}</p>}
        <button className="app-btn app-btn--big" disabled={reg.isPending}>
          {reg.isPending ? "注册中…" : "注册并登录"}
        </button>
        <p className="muted">
          已有账号？<Link to={`/login?next=${encodeURIComponent(next)}`}>登录</Link>
        </p>
      </form>
    </div>
  );
}
