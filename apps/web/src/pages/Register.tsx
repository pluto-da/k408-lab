import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useRegister } from "../api/hooks";
import { errorMessage } from "../api/client";
import { safeNext } from "../lib/format";
import PasswordInput from "../components/PasswordInput";

/** 与服务端校验保持一致（apps/api/src/routes/auth.ts） */
const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const username = f.username.trim();
    const email = f.email.trim();
    if (!username && !email) return setLocalErr("用户名和邮箱至少填写一个");
    if (username && !USERNAME_RE.test(username)) return setLocalErr("用户名需 3–20 位，只能包含字母、数字、下划线或汉字");
    if (email && (!EMAIL_RE.test(email) || email.length > 120)) return setLocalErr("邮箱格式不正确");
    if (f.password.length < 8) return setLocalErr("密码至少 8 位");
    if (f.password.length > 72) return setLocalErr("密码最多 72 位");
    if (f.password !== f.confirm) return setLocalErr("两次输入的密码不一致");
    reg.mutate(
      { username: username || undefined, email: email || undefined, password: f.password, nickname: f.nickname.trim() || undefined },
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
          <input
            value={f.username}
            onChange={set("username")}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            placeholder="3–20 位，字母 / 数字 / 下划线 / 汉字"
            autoFocus
          />
        </label>
        <label>
          邮箱（选填）
          <input type="email" inputMode="email" value={f.email} onChange={set("email")} autoComplete="email" autoCapitalize="none" maxLength={120} placeholder="name@example.com" />
        </label>
        <label>
          昵称（选填）
          <input value={f.nickname} onChange={set("nickname")} autoComplete="nickname" maxLength={20} placeholder="不填则用用户名" />
        </label>
        <label>
          密码
          <PasswordInput value={f.password} onChange={set("password")} autoComplete="new-password" maxLength={72} placeholder="至少 8 位" />
        </label>
        <label>
          确认密码
          <PasswordInput value={f.confirm} onChange={set("confirm")} autoComplete="new-password" maxLength={72} />
        </label>
        {(localErr || reg.error) && <p className="form-err" role="alert">{localErr ?? errorMessage(reg.error)}</p>}
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
