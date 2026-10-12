import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LAYERS, LINKS, PART_BY_ID, PARTS, type PartId } from "../pc/parts";
import type { EngineState, LightMode, PcEngine } from "../pc/engine";
import { JOURNEY } from "../pc/journey";
import "../pc/pc.css";

// 「化身数据」第一人称模式：点开时才加载
const RideMode = lazy(() => import("../pc/ride/RideMode"));

const RGB_SWATCHES = ["#7a5cff", "#22c3ff", "#ff4f8b", "#3fe08a", "#ffb02e"];
const RGB_MODES = ["彩虹流动", "单色常亮", "呼吸"];

const ORDER: PartId[] = ["cpu", "ram", "gpu", "ssd", "hdd", "nic", "psu", "board", "case"];

function useWide() {
  const q = "(min-width: 1024px)";
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setWide(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return wide;
}

export default function PcPage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const engineRef = useRef<PcEngine | null>(null);
  const [supported, setSupported] = useState(true);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<EngineState>("loading");
  const [selected, setSelected] = useState<PartId | null>(null);
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [panelOpen, setPanelOpen] = useState(() => typeof window === "undefined" || window.innerWidth >= 1280);
  const [light, setLight] = useState<LightMode>("studio");
  const [rgbMode, setRgbMode] = useState(0);
  const [rgbColor, setRgbColor] = useState(RGB_SWATCHES[0]!);
  const [explode, setExplode] = useState(0);
  const [jStep, setJStep] = useState<number | null>(null);
  // teardown progress: the bar is written straight to the DOM (no React render per frame); React only
  // re-renders when the number of removed layers changes
  const [dis, setDis] = useState<{ k: number; layers: string[] }>({ k: 0, layers: [] });
  const fillRef = useRef<HTMLElement>(null);
  const wide = useWide();
  // 「拖动旋转」提示：第一次触碰 / 点按场景后不再显示
  const [touched, setTouched] = useState(false);
  const [ride, setRide] = useState<null | { route: string | null }>(null);
  const touringNow = state === "journey" || !!ride;
  // 化身数据进行中：矮横屏收起站点顶栏，把高度留给画面和讲解
  useEffect(() => {
    if (!ride) return;
    document.documentElement.classList.add("is-ride");
    return () => document.documentElement.classList.remove("is-ride");
  }, [ride]);

  useEffect(() => {
    document.documentElement.classList.add("is-pc");
    return () => document.documentElement.classList.remove("is-pc");
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const overlay = overlayRef.current;
    if (!stage || !overlay) return;
    let alive = true;
    let engine: PcEngine | null = null;
    void (async () => {
      const mod = await import("../pc/engine");
      if (!alive) return;
      if (!mod.webglAvailable()) {
        setSupported(false);
        return;
      }
      try {
        engine = new mod.PcEngine(stage, overlay, {
          onProgress: (p) => alive && setProgress(p),
          onReady: () => alive && setReady(true),
          onState: (s, part) => {
            if (!alive) return;
            setState(s);
            setSelected(part);
          },
          onHover: (p) => alive && setHovered(p),
          onInteriorProgress: (p) => alive && setOpening(p),
          onError: (m) => alive && setError(m),
          onJourney: (i) => alive && setJStep(i),
          onDisassembly: (k, layers) => {
            if (!alive) return;
            if (fillRef.current) fillRef.current.style.transform = `scaleY(${k})`;
            const n = layers.length;
            const r = Math.floor(k * n + 1e-3);
            setDis((d) => (Math.floor(d.k * n + 1e-3) === r && d.layers.length === n && d.layers[0] === layers[0] ? d : { k, layers }));
          },
        });
      } catch {
        setSupported(false);
        return;
      }
      engineRef.current = engine;
      void engine.load();
    })().catch(() => alive && setError("模块加载失败"));
    return () => {
      alive = false;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  // keep the model centred in the area left of the docked panel
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const w = wide && panelOpen && !touringNow && panelRef.current ? panelRef.current.offsetWidth + 24 : 0;
    e.setInset(w);
  }, [wide, panelOpen, ready, selected, touringNow]);

  useEffect(() => {
    engineRef.current?.setShowAll(showAll);
  }, [showAll]);

  useEffect(() => {
    engineRef.current?.setLightMode(light, rgbMode, rgbColor);
  }, [light, rgbMode, rgbColor, ready]);

  useEffect(() => {
    if (state === "overview") engineRef.current?.setExplode(explode);
  }, [explode, state]);

  useEffect(() => {
    if (selected || state === "journey") setExplode(0);
  }, [selected, state]);

  // /pc?ride=<路线>：整机就绪后直接进入「化身数据」
  const rideAsked = useRef(new URLSearchParams(window.location.search).get("ride"));
  useEffect(() => {
    if (state !== "overview" || !rideAsked.current) return;
    const r = rideAsked.current;
    rideAsked.current = null;
    setRide({ route: r });
  }, [state]);

  // /pc?tour=1（首页「跟着数据走一遍」）：整机就绪后自动开始数据旅程
  const tourAsked = useRef(new URLSearchParams(window.location.search).get("tour") === "1");
  useEffect(() => {
    if (state !== "overview" || !tourAsked.current) return;
    tourAsked.current = false;
    const t = setTimeout(() => engineRef.current?.startJourney(0), 400);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        engineRef.current?.stopJourney();
        engineRef.current?.select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = useCallback((id: PartId | null) => {
    if (window.innerWidth >= 1280) setPanelOpen(true);
    engineRef.current?.select(id);
  }, []);

  const def = selected ? PART_BY_ID[selected] : null;
  const busy = state === "extracting" || state === "closing";
  const touring = state === "journey" || !!ride;
  const step = jStep !== null ? JOURNEY[jStep] : null;
  const disN = dis.layers.length;
  const disShow = !!selected && disN > 0 && (state === "open" || state === "extracting");
  const removed = Math.floor(dis.k * disN + 1e-3);

  if (!supported) return <Fallback />;

  return (
    <div className="pc-page">
      <div ref={stageRef} className="pc-stage" onPointerDown={() => setTouched(true)} />
      <div ref={overlayRef} className="pc-overlay" aria-hidden="true" />

      <header className="pc-head" hidden={!!ride}>
        <h1>整机拆解</h1>
        <p>{touring ? "一次数据的旅程 · 跟着发光的数据包走一遍" : def ? `${def.name} · ${def.tag}` : "点一下任意部件，把它从机箱里拆出来看看里面"}</p>
      </header>

      {!ready && !error && (
        <div className="pc-loading" role="status" aria-live="polite">
          <div className="pc-loading__ring" style={{ ["--p" as string]: progress }} />
          <b>{Math.round(progress * 100)}%</b>
          <span>正在组装整机…</span>
        </div>
      )}
      {error && (
        <div className="pc-loading pc-loading--err" role="alert">
          <b>加载失败</b>
          <span>网络不太稳定，刷新页面再试一次。</span>
          <button type="button" className="pc-btn" onClick={() => window.location.reload()}>
            刷新
          </button>
        </div>
      )}
      {opening !== null && (
        <div className="pc-opening" role="status">
          正在打开… {Math.round(opening * 100)}%
        </div>
      )}
      {hovered && state === "overview" && <div className="pc-hoverchip">{PART_BY_ID[hovered].name}</div>}
      {ready && !touched && state === "overview" && !ride && (
        <div className="pc-hint" aria-hidden="true">
          拖动旋转 · 双指缩放 · 点部件拆开
        </div>
      )}

      <nav className="pc-parts" aria-label="部件" hidden={touring}>
        {ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={selected === id ? "is-on" : undefined}
            disabled={!ready || busy || touring}
            onClick={() => pick(selected === id ? null : id)}
          >
            {PART_BY_ID[id].name}
          </button>
        ))}
      </nav>

      <div className="pc-tools" hidden={!!ride}>
        {!selected && !touring && (
          <button type="button" className="pc-btn pc-btn--tour" disabled={!ready || state !== "overview"} onClick={() => engineRef.current?.startJourney(0)}>
            ▶ 数据旅程
          </button>
        )}
        {!selected && !touring && (
          <button type="button" className="pc-btn pc-btn--tour" disabled={!ready || state !== "overview"} onClick={() => setRide({ route: null })}>
            化身数据
          </button>
        )}
        <div className="pc-seg" role="group" aria-label="灯光">
          <button type="button" className={light === "studio" ? "is-on" : undefined} onClick={() => setLight("studio")}>
            展示
          </button>
          <button type="button" className={light === "rgb" ? "is-on" : undefined} onClick={() => setLight("rgb")}>
            氛围灯
          </button>
        </div>
        {selected && (
          <button type="button" className="pc-btn pc-btn--back" disabled={busy} onClick={() => pick(null)}>
            ← 返回整机
          </button>
        )}
        <label className="pc-switch">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          <span>全部连线</span>
        </label>
        <button type="button" className="pc-btn" disabled={!ready} onClick={() => engineRef.current?.resetView()}>
          重置视角
        </button>
        <button type="button" className={panelOpen ? "pc-btn is-on" : "pc-btn"} onClick={() => setPanelOpen((v) => !v)}>
          {panelOpen ? "收起考点" : "408 考点"}
        </button>
      </div>

      {light === "rgb" && !ride && (
        <div className="pc-rgb" role="group" aria-label="灯效">
          {RGB_MODES.map((m, i) => (
            <button key={m} type="button" className={rgbMode === i ? "is-on" : undefined} onClick={() => setRgbMode(i)}>
              {m}
            </button>
          ))}
          {rgbMode > 0 &&
            RGB_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className={rgbColor === c ? "pc-sw is-on" : "pc-sw"}
                style={{ ["--c" as string]: c }}
                aria-label={`灯光颜色 ${c}`}
                onClick={() => setRgbColor(c)}
              />
            ))}
        </div>
      )}

      {ready && !selected && !touring && (
        <label className="pc-explode">
          <span>拆开看</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={explode}
            disabled={state !== "overview"}
            onChange={(e) => setExplode(Number(e.target.value))}
          />
        </label>
      )}

      {disShow && (
        <div className="pc-dhud" aria-label="拆解进度">
          <div className="pc-dhud__rail">
            <i ref={fillRef} />
            {dis.layers.map((n, i) => (
              <span key={n} style={{ bottom: `${((i + 1) / disN) * 100}%` }} />
            ))}
          </div>
          <div className="pc-dhud__text">
            <b>
              {removed > 0 ? LAYERS[selected!]?.[dis.layers[removed - 1]!]?.label ?? "" : "组装状态"}
              <em>
                {removed}/{disN}
              </em>
            </b>
            <span>{removed > 0 ? LAYERS[selected!]?.[dis.layers[removed - 1]!]?.note : "单指上下滑：拆开 / 装回；左右滑：绕着它转。双指自由旋转、缩放，松手即停。"}</span>
          </div>
        </div>
      )}

      {state === "journey" && step && (
        <div className="pc-journey" role="status" aria-live="polite">
          <div className="pc-journey__dots">
            {JOURNEY.map((s, i) => (
              <button
                key={s.title}
                type="button"
                className={i === jStep ? "is-on" : i < (jStep ?? 0) ? "is-done" : undefined}
                style={{ ["--c" as string]: s.color }}
                aria-label={s.title}
                onClick={() => engineRef.current?.journeyGo(i)}
              />
            ))}
          </div>
          <h2 style={{ ["--c" as string]: step.color }}>{step.title}</h2>
          <p>{step.caption}</p>
          <small>{step.tag}</small>
          <div className="pc-journey__nav">
            <button type="button" className="pc-btn" disabled={jStep === 0} onClick={() => engineRef.current?.journeyGo((jStep ?? 0) - 1)}>
              上一站
            </button>
            <button type="button" className="pc-btn" onClick={() => engineRef.current?.journeyGo((jStep ?? 0) + 1)}>
              {jStep === JOURNEY.length - 1 ? "完成" : "下一站"}
            </button>
            <button type="button" className="pc-btn pc-btn--ghost" onClick={() => engineRef.current?.stopJourney()}>
              退出
            </button>
          </div>
        </div>
      )}

      {ride && engineRef.current && (
        <Suspense fallback={<div className="pc-opening" role="status">正在准备…</div>}>
          <RideMode engine={engineRef.current} route={ride.route} onExit={() => setRide(null)} />
        </Suspense>
      )}

      {panelOpen && !touring && (
        <aside ref={panelRef} className={wide ? "pc-panel" : "pc-panel pc-panel--sheet"} aria-live="polite">
          {def ? (
            <>
              <div className="pc-panel__tag">{def.tag}</div>
              <h2>
                {def.name} <small>{def.en}</small>
              </h2>
              <p className="pc-panel__brief">{def.brief}</p>
              <h3>408 考点</h3>
              <ul className="pc-points">
                {def.points.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              {def.callouts.some((c) => c.color) && (
                <>
                  <h3>图中标注</h3>
                  <ul className="pc-legend">
                    {def.callouts
                      .filter((c) => c.color)
                      .map((c) => (
                        <li key={c.anchor}>
                          <i style={{ background: c.color }} />
                          {c.label}
                        </li>
                      ))}
                  </ul>
                </>
              )}
              <h3>相关章节</h3>
              <div className="pc-chapters">
                {def.chapters.map((c) => (
                  <Link key={c.label} to={c.to}>
                    {c.label} →
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="pc-panel__tag">数据通路</div>
              <h2>部件之间怎么连？</h2>
              <p className="pc-panel__brief">
                发光的线是真实的物理通路：内存和显卡直连 CPU，硬盘、网卡这些慢一些的设备挂在芯片组上，电源给所有部件供电。
              </p>
              <ul className="pc-legend pc-legend--links">
                {LINKS.filter((l, i, a) => a.findIndex((x) => x.label === l.label) === i).map((l) => (
                  <li
                    key={l.id}
                    onMouseEnter={() => engineRef.current?.setHighlightLink(l.id)}
                    onMouseLeave={() => engineRef.current?.setHighlightLink(null)}
                  >
                    <i style={{ background: l.color }} />
                    {l.label}
                  </li>
                ))}
              </ul>
              <h3>怎么玩</h3>
              <ul className="pc-points pc-points--tips">
                <li>拖动旋转，双指或滚轮缩放。</li>
                <li>点部件：先从机箱里滑出来，再打开看内部结构。</li>
                <li>点空白处或「返回整机」回到全景。</li>
                <li>「数据旅程」：跟着一个数据包从网卡走到内存、CPU、显卡和硬盘。</li>
                <li>「化身数据」：变成一个地址，钻进 CPU 和内存里亲自走一遍，还能改参数看路线怎么变。</li>
                <li>「拆开看」滑块把所有部件一起拉开；「氛围灯」切换机箱灯效。</li>
              </ul>
            </>
          )}
          <p className="pc-copy">© 2026 考研408动画实验室 保留所有权利</p>
        </aside>
      )}
    </div>
  );
}

function Fallback() {
  const [id, setId] = useState<PartId>("cpu");
  const def = PART_BY_ID[id];
  return (
    <div className="pc-fallback page-pad">
      <h1>整机拆解</h1>
      <p className="pc-fallback__msg">
        当前浏览器无法显示 3D 场景（可能关闭了硬件加速，或浏览器版本较旧）。换用新版 Safari / Chrome / Edge 即可查看；下面仍然可以浏览每个部件的考点。
      </p>
      <div className="pc-parts pc-parts--static">
        {PARTS.map((p) => (
          <button key={p.id} type="button" className={p.id === id ? "is-on" : undefined} onClick={() => setId(p.id)}>
            {p.name}
          </button>
        ))}
      </div>
      <section className="pc-panel pc-panel--static">
        <div className="pc-panel__tag">{def.tag}</div>
        <h2>{def.name}</h2>
        <p className="pc-panel__brief">{def.brief}</p>
        <ul className="pc-points">
          {def.points.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
