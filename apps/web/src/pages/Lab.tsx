import { useEffect, useRef, useState } from "react";
import { bootLegacy, legacyBootedInto, removeLegacyCss } from "../legacy/loadLegacy";

const BOOT = ["载入四门课章节目录", "装配 3D 主板与总线", "加载 11 个动画实验", "连接流程演示", "串起跨科知识连线"];

export default function LabPage() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

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
      .catch((e: unknown) => {
        console.error(e);
        if (alive) setFailed(true);
      });
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
      {failed && (
        <div className="lab-error" role="alert">
          <h1>实验室没能加载出来</h1>
          <p>可能是网络不稳定。实验室需要下载约 1.5 MB 的 3D 模型和脚本，网络较慢时请稍候或换个网络再试。</p>
          <button type="button" className="app-btn app-btn--big" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      )}
      {!ready && !failed && (
        <div className="lab-loading" role="status" aria-live="polite">
          <div className="lab-loading__bar">
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p>正在搭建实验室… {Math.round(progress * 100)}%</p>
          <ul className="lab-boot" aria-hidden="true">
            {BOOT.filter((_, i) => progress >= i / BOOT.length).map((b) => (
              <li key={b}>
                {b} <b>OK</b>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div ref={ref} className="legacy-root" />
    </div>
  );
}
