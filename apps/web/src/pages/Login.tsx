import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLogin } from "../api/hooks";
import { errorMessage } from "../api/client";
import { safeNext } from "../lib/format";
import PasswordInput from "../components/PasswordInput";

export default function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const nav = useNavigate();
  const login = useLogin();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ account, password }, { onSuccess: () => nav(next, { replace: true }) });
  };

  return (
    <div className="page-pad">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>登录</h1>
        <label>
          用户名或邮箱
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={120}
            required
            autoFocus
          />
        </label>
        <label>
          密码
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" enterKeyHint="go" maxLength={72} required />
        </label>
        {login.error && <p className="form-err" role="alert">{errorMessage(login.error)}</p>}
        <button className="app-btn app-btn--big" disabled={login.isPending || !account || !password}>
          {login.isPending ? "登录中…" : "登录"}
        </button>
        <button type="button" className="app-btn app-btn--ghost" disabled title="即将开放">
          手机号验证码登录（即将开放）
        </button>
        <p className="muted">
          还没有账号？<Link to={`/register?next=${encodeURIComponent(next)}`}>注册</Link>
        </p>
      </form>
    </div>
  );
}
