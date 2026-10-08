import { useState, type InputHTMLAttributes } from "react";

/** 带“显示/隐藏”切换的密码框：手机上输错密码很常见，能看一眼能少很多登录失败 */
export default function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <span className="pw-field">
      <input {...props} type={show ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button type="button" className="pw-toggle" aria-pressed={show} aria-label={show ? "隐藏密码" : "显示密码"} onClick={() => setShow((s) => !s)}>
        {show ? "隐藏" : "显示"}
      </button>
    </span>
  );
}
