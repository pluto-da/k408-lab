import { useEffect, useRef, useState } from "react";
import { bootLegacy, legacyBootedInto, removeLegacyCss } from "../legacy/loadLegacy";

/** 打开 /lab#… 时定位：#lab-<实验> 切到该实验，#board/#hero 展开立体图，其余按 id 滚动 */
function goToHash(hash: string) {
  if (!hash) return;
  const id = /^lab-(.+)$/.exec(hash)?.[1];
  if (id && document.getElementById(`tab-${id}`) && window.X_OPEN_LAB) {
    window.X_OPEN_LAB(id);
    document.getElementById("lab")?.scrollIntoView();
    return;
  }
  const proc = /^proc-(.+)$/.exec(hash)?.[1];
  if (proc && window.X_OPEN_PROC?.(proc)) {
    document.getElementById("proc")?.scrollIntoView();
    return;
  }
  if ((hash === "board" || hash === "hero") && window.X_BOARD) {
    void window.X_BOARD.open().catch(() => undefined);
    document.getElementById("board")?.scrollIntoView();
    return;
  }
  document.getElementById(hash)?.scrollIntoView();
}

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
        goToHash(decodeURIComponent(window.location.hash.slice(1)));
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
          <p>可能是网络不稳定，请稍候或换个网络再试。</p>
          <button type="button" className="app-btn app-btn--big" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </div>
      )}
      {!ready && !failed && (
        <div className="lab-loading" role="status" aria-live="polite">
          <div className="lab-loading__bar" aria-hidden="true">
            <i style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }} />
          </div>
          <p>正在加载实验室</p>
        </div>
      )}
      <div ref={ref} className="legacy-root" />
    </div>
  );
}
