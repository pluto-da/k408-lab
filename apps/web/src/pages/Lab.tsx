import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { bootLegacy, legacyBootedInto, removeLegacyCss } from "../legacy/loadLegacy";
import { useAuth } from "../store/auth";
import { useSync } from "../store/sync";

export default function LabPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const status = useAuth((s) => s.status);
  const pending = useSync((s) => s.pending);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    document.documentElement.classList.add("is-lab");
    const booted = legacyBootedInto();
    if (booted && booted !== el) {
      // 旧模块已在别的容器里运行过：整页刷新重新挂载
      window.location.reload();
      return;
    }
    let alive = true;
    bootLegacy(el, (p) => alive && setProgress(p))
      .then(() => {
        if (!alive) return;
        setReady(true);
        const hash = window.location.hash.slice(1);
        if (hash) document.getElementById(decodeURIComponent(hash))?.scrollIntoView();
      })
      .catch((e: unknown) => console.error(e));
    return () => {
      alive = false;
      // StrictMode 的二次执行路径名不变；真正离开 /lab 时，整页加载目标页，释放 3D 场景
      setTimeout(() => {
        if (window.location.pathname !== "/lab" && window.__LEGACY_BOOTED__) {
          removeLegacyCss();
          window.location.reload();
        }
      }, 0);
    };
  }, []);

  return (
    <div className="lab-page">
      {!ready && (
        <div className="lab-loading" role="status" aria-live="polite">
          <div className="lab-loading__bar">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p>正在搭建实验室… {Math.round(progress * 100)}%</p>
        </div>
      )}
      {status === "anon" && (
        <div className="lab-hint">
          学习记录暂存在本页{pending ? `（${pending} 条）` : ""}，<Link to="/login?next=/lab">登录</Link>后自动保存进度、错题和闯关成绩。
        </div>
      )}
      <div ref={ref} className="legacy-root" />
    </div>
  );
}
