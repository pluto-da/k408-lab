// 「化身数据」界面：路线选择、HUD、数据外壳、小地图、时间轴、岔路口、参数、结算、文字版路线。
// 进入时才加载（含 CPU / 内存内部场景），不影响整机拆解首屏。
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { Link } from "react-router-dom";
import type { PcEngine } from "../engine";
import { RideScene, type RideMode as Mode, type RideView } from "./rideScene";
import { buildAccessPlan } from "./routeAccess";
import { ROUTES } from "./routes";
import {
  BLOCK_SIZES,
  DEFAULT_ACCESS,
  L1_SIZES,
  PAGE_SIZES,
  WAY_OPTIONS,
  fmtNs,
  type AccessParams,
  type CacheOutcome,
  type Policy,
} from "./sim/access";
import { hex32Spaced, parseHexAddr } from "./sim/addr";
import { TONE } from "./three/kit";
import type { RidePlan, RideStation, ShellState, World } from "./types";
import "./ride.css";

interface Props {
  engine: PcEngine;
  /** 深链接 /pc?ride=<id> 直接出发的路线 */
  route: string | null;
  onExit: () => void;
}

type Panel = null | "params" | "text" | "what" | "settings";

function useMedia(q: string) {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setM(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [q]);
  return m;
}

const VIEWS: { id: RideView; label: string }[] = [
  { id: "first", label: "第一人称" },
  { id: "follow", label: "跟随" },
  { id: "map", label: "整机全景" },
];

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function RideMode({ engine, route, onExit }: Props) {
  const fxRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RideScene | null>(null);
  const prefersReduced = useMedia("(prefers-reduced-motion: reduce)");
  const phone = useMedia("(max-width: 767.98px)");
  const landscape = useMedia("(orientation: landscape) and (max-height: 500px)");
  const [phase, setPhase] = useState<"pick" | "loading" | "ride">(route === "access" ? "loading" : "pick");
  const [params, setParams] = useState<AccessParams>(DEFAULT_ACCESS);
  const plan = useMemo<RidePlan>(() => buildAccessPlan(params), [params]);
  const [idx, setIdx] = useState(0);
  const [arrived, setArrived] = useState(false);
  const [cueDone, setCueDone] = useState<Set<number>>(() => new Set());
  const [answers, setAnswers] = useState<Record<number, { pick: string; ok: boolean }>>({});
  const [mode, setMode] = useState<Mode>("auto");
  const [judge, setJudge] = useState(false);
  const [autoNext, setAutoNext] = useState(false);
  const [view, setView] = useState<RideView>("first");
  const [reduced, setReduced] = useState(prefersReduced);
  const [paused, setPaused] = useState(false);
  const [capSize, setCapSize] = useState(1);
  const [panel, setPanel] = useState<Panel>(null);
  const [showMap, setShowMap] = useState(false);
  const [capOpen, setCapOpen] = useState(true);
  const [summary, setSummary] = useState(false);
  const [pos, setPos] = useState<{ world: World; i: number; u: number }>({ world: "chip", i: 0, u: -1 });
  const [visited, setVisited] = useState<Set<string>>(() => new Set(["cpu"]));
  const [demo, setDemo] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [hint, setHint] = useState(true);

  const st: RideStation | undefined = plan.stations[idx];
  const N = plan.stations.length;
  const revealed = !st?.fork || !judge || answers[idx] !== undefined;
  const prevShell: ShellState = idx === 0 ? plan.initialShell : plan.stations[idx - 1]!.shell;
  const shell = arrived && st ? st.shell : prevShell;
  const clockNs = st ? (arrived ? st.clock : st.clock - st.cost) : 0;

  // ---------------------------------------------------------------- scene lifecycle
  const startRide = useCallback(
    async (p: AccessParams, intro: boolean) => {
      setSummary(false);
      setAnswers({});
      setCueDone(new Set());
      setIdx(0);
      setArrived(false);
      setDemo(0);
      setVisited(new Set(["cpu"]));
      const nextPlan = buildAccessPlan(p);
      let scene = sceneRef.current;
      if (!scene) {
        setPhase("loading");
        const host = await engine.enterRide();
        scene = new RideScene(host, () => fxRef.current, {
          onStation: (i, a) => {
            setIdx(i);
            setArrived(a);
          },
          onCueDone: (i) => setCueDone((s) => new Set(s).add(i)),
          onPos: (world, i, u) => setPos((o) => (o.world === world && o.i === i && Math.abs(o.u - u) < 0.02 ? o : { world, i, u })),
          onEnd: () => setSummary(true),
        });
        sceneRef.current = scene;
      }
      scene.setReduced(reduced);
      scene.setMode(mode);
      scene.setAutoNext(autoNext);
      scene.setView(view);
      scene.setPaused(false);
      setPaused(false);
      scene.setPlan(nextPlan, judge);
      scene.start(intro);
      setPhase("ride");
    },
    // 只在出发时读取当前设置
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine],
  );

  useEffect(() => {
    if (route === "access") void startRide(DEFAULT_ACCESS, true);
  }, [route, startRide]);

  useEffect(
    () => () => {
      const s = sceneRef.current;
      if (s) {
        s.exit();
        s.dispose();
        sceneRef.current = null;
        engine.exitRide();
      }
    },
    [engine],
  );

  const exit = useCallback(() => {
    const s = sceneRef.current;
    if (s) {
      s.exit();
      s.dispose();
      sceneRef.current = null;
      engine.exitRide();
    }
    onExit();
  }, [engine, onExit]);

  useEffect(() => sceneRef.current?.setReduced(reduced), [reduced]);
  useEffect(() => sceneRef.current?.setMode(mode), [mode]);
  useEffect(() => sceneRef.current?.setJudge(judge), [judge]);
  useEffect(() => sceneRef.current?.setAutoNext(autoNext), [autoNext]);
  useEffect(() => sceneRef.current?.setView(view), [view]);
  useEffect(() => sceneRef.current?.setPaused(paused), [paused]);

  // 底部界面占去的高度（横屏时是右侧宽度）：画面中心移到剩下区域的中间，HUD 不挡住正在讲的东西
  useEffect(() => {
    const b = bottomRef.current;
    const root = rootRef.current;
    if (!b || !root || phase !== "ride") return;
    const measure = () => {
      const s = sceneRef.current;
      if (!s) return;
      const R = root.getBoundingClientRect();
      const r = b.getBoundingClientRect();
      if (landscape) s.setInsets(0, Math.max(0, R.right - r.left));
      else s.setInsets(Math.max(0, R.bottom - r.top + 8), 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(b);
    ro.observe(root);
    return () => ro.disconnect();
  }, [phase, landscape]);

  // 演示时间
  useEffect(() => {
    if (phase !== "ride" || paused || summary) return;
    const t = setInterval(() => setDemo((d) => d + 0.25), 250);
    return () => clearInterval(t);
  }, [phase, paused, summary]);

  // 走过的部件（小地图）
  useEffect(() => {
    if (!st) return;
    const add: string[] = [];
    if (pos.world === "pc") add.push("bus");
    if (pos.world === "mem") add.push("bus", "ram");
    if (add.length) setVisited((v) => (add.every((x) => v.has(x)) ? v : new Set([...v, ...add])));
  }, [pos, st]);

  useEffect(() => {
    const t = setTimeout(() => setHint(false), 6000);
    return () => clearTimeout(t);
  }, []);

  // ---------------------------------------------------------------- actions
  const next = useCallback(() => sceneRef.current?.next(), []);
  const prev = useCallback(() => sceneRef.current?.prev(), []);
  const goTo = useCallback((i: number) => sceneRef.current?.goTo(i), []);
  const cycleView = useCallback(() => setView((v) => VIEWS[(VIEWS.findIndex((x) => x.id === v) + 1) % VIEWS.length]!.id), []);
  const changeSpeed = useCallback((f: number) => {
    const s = sceneRef.current;
    if (!s) return;
    s.setSpeed(Math.round(s.getSpeed() * f * 10) / 10);
    setSpeedState(s.getSpeed());
  }, []);

  const answer = (opt: string) => {
    if (!st?.fork || answers[idx]) return;
    setAnswers((a) => ({ ...a, [idx]: { pick: opt, ok: opt === st.fork!.answer } }));
    sceneRef.current?.reveal(idx);
  };

  const applyParams = (p: AccessParams) => {
    setParams(p);
    setPanel(null);
    void startRide(p, false);
  };

  // 路线选择面板：Esc 关闭
  useEffect(() => {
    if (phase !== "pick") return;
    const f = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [phase, onExit]);

  // 键盘
  useEffect(() => {
    if (phase !== "ride") return;
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const s = sceneRef.current;
      if (!s) return;
      const k = e.key;
      if (k === "Escape") {
        e.preventDefault();
        if (panel) setPanel(null);
        else exit();
      } else if (k === "w" || k === "W" || k === "ArrowUp") {
        e.preventDefault();
        if (!e.repeat) {
          setMode("manual");
          s.setMode("manual");
          s.drive(1);
        }
      } else if (k === "s" || k === "S" || k === "ArrowDown") {
        e.preventDefault();
        if (!e.repeat) {
          setMode("manual");
          s.setMode("manual");
          s.drive(-1);
        }
      } else if (k === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (k === "Enter" || k === "ArrowRight") {
        if ((e.target as HTMLElement | null)?.tagName === "BUTTON" && k === "Enter") return;
        e.preventDefault();
        next();
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (k === "q" || k === "Q") changeSpeed(1 / 1.25);
      else if (k === "e" || k === "E") changeSpeed(1.25);
      else if (k === "v" || k === "V") cycleView();
    };
    const up = (e: KeyboardEvent) => {
      if (["w", "W", "s", "S", "ArrowUp", "ArrowDown"].includes(e.key)) sceneRef.current?.drive(0);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [phase, panel, exit, next, prev, changeSpeed, cycleView]);

  // 拖动转头 · 双指捏合调速度
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const onPDown = (e: RPointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    }
    setHint(false);
  };
  const onPMove = (e: RPointerEvent<HTMLDivElement>) => {
    const p = ptrs.current.get(e.pointerId);
    if (!p) return;
    const s = sceneRef.current;
    if (ptrs.current.size >= 2 && pinch.current) {
      ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (Math.abs(d / pinch.current - 1) > 0.12) {
        changeSpeed(d > pinch.current ? 1.2 : 1 / 1.2);
        pinch.current = d;
      }
      return;
    }
    s?.look(e.clientX - p.x, e.clientY - p.y);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPUp = (e: RPointerEvent<HTMLDivElement>) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (ptrs.current.size === 0) sceneRef.current?.lookEnd();
  };
  const hold = (d: 1 | -1) => ({
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setMode("manual");
      sceneRef.current?.setMode("manual");
      sceneRef.current?.drive(d);
    },
    onPointerUp: () => sceneRef.current?.drive(0),
    onPointerCancel: () => sceneRef.current?.drive(0),
    onKeyDown: (e: RKeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        setMode("manual");
        sceneRef.current?.setMode("manual");
        sceneRef.current?.goTo(Math.max(0, Math.min(N - 1, idx + (arrived ? d : d > 0 ? 0 : d))));
      }
    },
  });

  // ---------------------------------------------------------------- render
  if (phase === "pick") {
    return (
      <div className="rd-root">
        <div className="rd-pick" role="dialog" aria-modal="true" aria-labelledby="rd-pick-h">
          <h2 id="rd-pick-h">化身数据</h2>
          <p>变成一段数据，钻进电脑里亲自走一遍。选一条路线：</p>
          <ul>
            {ROUTES.map((r) => (
              <li key={r.id}>
                <button type="button" disabled={!r.ready} onClick={() => void startRide(params, true)}>
                  <b>{r.title}</b>
                  <small>{r.brief}</small>
                  {!r.ready && <em>即将开放</em>}
                </button>
              </li>
            ))}
          </ul>
          <div className="rd-pick__foot">
            <button type="button" className="pc-btn" onClick={onExit}>
              返回整机
            </button>
          </div>
        </div>
      </div>
    );
  }

  const forkNow = !!st?.fork && arrived && phase === "ride";
  const ans = answers[idx];
  const canNext = arrived ? revealed : true;
  const showResult = !!st?.result && arrived && (judge ? !!ans || !st.fork : cueDone.has(idx));
  const style = { ["--rd-cap" as string]: String(capSize) } as CSSProperties;
  const judged = Object.values(answers);

  return (
    <div ref={rootRef} className={`rd-root${landscape ? " rd-root--land" : ""}${phone ? " rd-root--phone" : ""}`} style={style}>
      <div ref={fxRef} className="rd-fx" aria-hidden="true" />
      <div className="rd-look" onPointerDown={onPDown} onPointerMove={onPMove} onPointerUp={onPUp} onPointerCancel={onPUp} aria-hidden="true" />

      {phase === "loading" && (
        <div className="rd-toast" role="status">
          正在缩小成一段数据…
        </div>
      )}

      {/* 左上：位置与时间 */}
      <div className="rd-loc" role="status" aria-live="polite">
        <b>{st?.loc ?? "CPU"}</b>
        <span>
          <em>真实</em> {fmtNs(clockNs)} <i aria-hidden="true">·</i> <em>演示</em> {fmtClock(demo)}
        </span>
      </div>

      {/* 右上：工具与小地图 */}
      <div className="rd-tools">
        <button type="button" className="pc-btn rd-exit" onClick={exit} aria-label="退出化身数据（Esc）">
          退出
        </button>
        {!phone && (
          <button type="button" className="pc-btn" onClick={cycleView} aria-label={`视角：${VIEWS.find((v) => v.id === view)!.label}（V 切换）`}>
            {VIEWS.find((v) => v.id === view)!.label}
          </button>
        )}
        <button type="button" className={panel === "params" ? "pc-btn is-on" : "pc-btn"} onClick={() => setPanel(panel === "params" ? null : "params")}>
          参数
        </button>
        <button type="button" className={panel === "text" ? "pc-btn is-on" : "pc-btn"} onClick={() => setPanel(panel === "text" ? null : "text")}>
          文字版
        </button>
        <button type="button" className={panel === "settings" ? "pc-btn is-on" : "pc-btn"} onClick={() => setPanel(panel === "settings" ? null : "settings")} aria-label="设置">
          设置
        </button>
        {(phone || landscape) && (
          <button type="button" className={showMap ? "pc-btn is-on" : "pc-btn"} onClick={() => setShowMap((v) => !v)}>
            地图
          </button>
        )}
      </div>
      {(!(phone || landscape) || showMap) && <MiniMap world={pos.world} place={plan.stations[pos.i]?.place ?? "core"} u={pos.u} visited={visited} />}

      {hint && phase === "ride" && !summary && (
        <div className="rd-hint" aria-hidden="true">
          {phone || landscape ? "单指拖动转头 · 右下按住前进 / 后退" : "拖动转头 · W / S 前进后退 · 空格暂停 · V 切换视角 · Esc 退出"}
        </div>
      )}

      {/* 底部：数据外壳、字幕、岔路、时间轴、控制 */}
      <div ref={bottomRef} className="rd-bottom">
        <Shell shell={shell} />
        {st && (
          <section className={capOpen ? "rd-cap" : "rd-cap is-closed"} aria-live="polite" aria-label="讲解">
            <header>
              <button type="button" className="rd-cap__toggle" onClick={() => setCapOpen((v) => !v)} aria-expanded={capOpen}>
                <span className="rd-cap__n">
                  {idx + 1}/{N}
                </span>
                <h2>{st.title}</h2>
              </button>
              <button type="button" className="rd-what" onClick={() => setPanel(panel === "what" ? null : "what")} aria-expanded={panel === "what"}>
                这是什么？
              </button>
            </header>
            {capOpen && (
              <div className="rd-cap__body">
                <p>
                  {st.caption}
                  {showResult && <b className="rd-result"> {st.result}</b>}
                </p>
                <div className="rd-tags">
                  {st.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                  {st.cost > 0 && arrived && <span className="rd-tag--t">+{fmtNs(st.cost)}</span>}
                </div>
              </div>
            )}
            {forkNow && st.fork && (
              <div className="rd-fork" role="group" aria-label={st.fork.question}>
                <b>{st.fork.question}</b>
                <div className="rd-fork__opts">
                  {st.fork.options.map((o) => {
                    const chosen = judge ? ans?.pick === o.id : false;
                    const correct = (judge ? !!ans : cueDone.has(idx)) && o.id === st.fork!.answer;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={`rd-opt${correct ? " is-ok" : ""}${chosen && !ans?.ok ? " is-bad" : ""}`}
                        disabled={!judge || !!ans}
                        onClick={() => answer(o.id)}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                {judge && !ans && <small>你来判断：选一条通道</small>}
                {judge && ans && <small className={ans.ok ? "is-ok" : "is-bad"}>{ans.ok ? `判断正确：${st.fork.why}` : `不对。${st.fork.wrong}`}</small>}
              </div>
            )}
          </section>
        )}
        <nav className="rd-timeline" aria-label="站点">
          {plan.stations.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={i === idx ? "is-on" : i < idx || (i === idx && arrived) ? "is-done" : undefined}
              onClick={() => goTo(i)}
              aria-label={`第 ${i + 1} 站：${s.title}`}
              aria-current={i === idx ? "step" : undefined}
              title={s.title}
            >
              <i />
            </button>
          ))}
        </nav>
        <div className="rd-ctl">
          <button type="button" className="pc-btn" onClick={prev} disabled={idx === 0 && !arrived} aria-label="上一站（←）">
            上一站
          </button>
          <button type="button" className="pc-btn" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label="暂停（空格）">
            {paused ? "继续播放" : "暂停"}
          </button>
          <button type="button" className="pc-btn rd-next" onClick={next} disabled={!canNext} aria-label="继续前进（Enter）">
            {arrived && idx === N - 1 ? "看小结" : arrived ? "继续 →" : "到站"}
          </button>
          <div className="pc-seg" role="group" aria-label="前进方式">
            <button type="button" className={mode === "auto" ? "is-on" : undefined} onClick={() => setMode("auto")}>
              自动巡航
            </button>
            <button type="button" className={mode === "manual" ? "is-on" : undefined} onClick={() => setMode("manual")}>
              手动游走
            </button>
          </div>
          {speed !== 1 && <span className="rd-speed">{speed}×</span>}
        </div>
      </div>

      {mode === "manual" && (
        <div className="rd-pad" role="group" aria-label="手动游走">
          <button type="button" className="rd-pad__btn" aria-label="按住前进（W）" {...hold(1)}>
            ▲
          </button>
          <button type="button" className="rd-pad__btn" aria-label="按住后退（S）" {...hold(-1)}>
            ▼
          </button>
        </div>
      )}

      {panel === "what" && st && (
        <aside className="rd-card rd-card--what" role="dialog" aria-label={st.what.title}>
          <header>
            <h3>{st.what.title}</h3>
            <button type="button" className="rd-x" onClick={() => setPanel(null)} aria-label="关闭">
              ×
            </button>
          </header>
          <p>{st.what.body}</p>
          <div className="rd-links">
            {st.labs.map((l) => (
              <Link key={l.to} to={l.to}>
                {l.label} →
              </Link>
            ))}
          </div>
        </aside>
      )}

      {panel === "settings" && (
        <aside className="rd-card rd-card--set" role="dialog" aria-label="设置">
          <header>
            <h3>设置</h3>
            <button type="button" className="rd-x" onClick={() => setPanel(null)} aria-label="关闭">
              ×
            </button>
          </header>
          <label className="rd-row">
            <span>岔路口</span>
            <span className="pc-seg">
              <button type="button" className={!judge ? "is-on" : undefined} onClick={() => setJudge(false)}>
                自动
              </button>
              <button type="button" className={judge ? "is-on" : undefined} onClick={() => setJudge(true)}>
                我来判断
              </button>
            </span>
          </label>
          <label className="rd-row">
            <span>讲完自动继续</span>
            <input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} />
          </label>
          <label className="rd-row">
            <span>减少动态效果</span>
            <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
          </label>
          <div className="rd-row">
            <span>字幕大小</span>
            <span className="pc-seg">
              {[0.9, 1, 1.18].map((v, i) => (
                <button key={v} type="button" className={capSize === v ? "is-on" : undefined} onClick={() => setCapSize(v)}>
                  {["小", "中", "大"][i]}
                </button>
              ))}
            </span>
          </div>
          <div className="rd-row">
            <span>视角</span>
            <span className="pc-seg">
              {VIEWS.map((v) => (
                <button key={v.id} type="button" className={view === v.id ? "is-on" : undefined} onClick={() => setView(v.id)}>
                  {v.label}
                </button>
              ))}
            </span>
          </div>
          <p className="rd-keys">键盘：W / S 前进后退，← / → 上一站 / 下一站，Enter 继续，空格暂停，Q / E 减速 / 加速，V 切换视角，Esc 退出。</p>
        </aside>
      )}

      {panel === "params" && <ParamsPanel value={params} onApply={applyParams} onClose={() => setPanel(null)} />}

      {panel === "text" && (
        <aside className="rd-card rd-card--text" role="dialog" aria-label="文字版路线">
          <header>
            <h3>文字版路线 · {plan.title}</h3>
            <button type="button" className="rd-x" onClick={() => setPanel(null)} aria-label="关闭">
              ×
            </button>
          </header>
          <ol className="rd-textroute">
            {plan.stations.map((s, i) => (
              <li key={s.id} className={i === idx ? "is-on" : undefined}>
                <button type="button" onClick={() => goTo(i)}>
                  <b>{s.title}</b>
                  <small>
                    {s.loc}
                    {s.cost > 0 ? ` · +${fmtNs(s.cost)}` : ""} · 累计 {fmtNs(s.clock)}
                  </small>
                </button>
                <p>
                  {s.caption} {s.result}
                </p>
              </li>
            ))}
          </ol>
          <p className="rd-total">
            本次访问时间：<b>{plan.summary.formula}</b>
          </p>
        </aside>
      )}

      {summary && (
        <div className="rd-sum" role="dialog" aria-modal="true" aria-labelledby="rd-sum-h">
          <div className="rd-sum__card">
            <header>
              <h2 id="rd-sum-h">旅程小结 · {plan.title}</h2>
              <button type="button" className="rd-x" onClick={() => setSummary(false)} aria-label="关闭">
                ×
              </button>
            </header>
            <div className="rd-sum__total">
              <b>{fmtNs(plan.summary.totalNs)}</b>
              <span>{plan.summary.formula}</span>
            </div>
            <ul className="rd-sum__rows">
              {plan.summary.rows.map((r) => (
                <li key={r.label} className={r.bad ? "is-bad" : "is-ok"}>
                  <span>{r.label}</span>
                  <b>{r.value}</b>
                </li>
              ))}
              {judged.length > 0 && (
                <li className="is-ok">
                  <span>判断</span>
                  <b>
                    {judged.filter((a) => a.ok).length}/{judged.length} 正确
                  </b>
                </li>
              )}
            </ul>
            <p className="rd-sum__parts">经过：{plan.summary.parts.join(" → ")}</p>
            {plan.summary.formulas.map((f) => (
              <div key={f.title} className="rd-sum__f">
                <h3>{f.title}</h3>
                {f.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            ))}
            <p className="rd-sum__note">时间按示意数量级给出，题目给出的数值以题目为准。</p>
            <h3>本次涉及的考点</h3>
            <div className="rd-links">
              {plan.summary.topics.map((l) => (
                <Link key={l.to} to={l.to}>
                  {l.label} →
                </Link>
              ))}
            </div>
            <h3>换个参数再走一遍</h3>
            <div className="rd-retry">
              {plan.summary.retry.map((r) => (
                <button key={r.label} type="button" className="pc-btn" onClick={() => applyParams({ ...params, ...(r.patch as Partial<AccessParams>) })}>
                  <b>{r.label}</b>
                  <small>{r.hint}</small>
                </button>
              ))}
            </div>
            <div className="rd-sum__foot">
              <button type="button" className="pc-btn" onClick={() => applyParams(params)}>
                再走一遍
              </button>
              <button type="button" className="pc-btn" onClick={() => setPanel("params")}>
                调参数
              </button>
              <button type="button" className="pc-btn pc-btn--back" onClick={exit}>
                退出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 数据外壳：我现在携带的内容，随处理过程变化 */
function Shell({ shell }: { shell: ShellState }) {
  return (
    <div className="rd-shell" aria-label={`我现在是：${shell.kind}`}>
      <span className="rd-shell__kind">{shell.kind}</span>
      <span className="rd-shell__segs">
        {shell.segs.map((s) => (
          <span key={s.label + s.value} className="rd-seg" style={{ ["--c" as string]: TONE[s.tone] ?? "#fff" }}>
            <small>
              {s.label}
              {s.bits ? ` · ${s.bits} 位` : ""}
            </small>
            <b>{s.value}</b>
          </span>
        ))}
      </span>
    </div>
  );
}

/** 小地图：整台电脑的简化俯视图，标出自己的位置和走过的路 */
function MiniMap({ world, place, u, visited }: { world: World; place: string; u: number; visited: Set<string> }) {
  const cpu = { x: 64, y: 30, w: 34, h: 34 };
  const ram = { x: 112, y: 22, w: 14, h: 50 };
  const a = { x: cpu.x + cpu.w, y: cpu.y + cpu.h / 2 };
  const b = { x: ram.x, y: ram.y + ram.h / 2 };
  const back = place === "busBack" || place === "busMemBack";
  let dot = { x: cpu.x + cpu.w / 2, y: cpu.y + cpu.h / 2 };
  const inCpu: Record<string, [number, number]> = { core: [0.3, 0.75], reg: [0.3, 0.75], tlb: [0.5, 0.55], mmu: [0.6, 0.5], l1: [0.55, 0.35], fill: [0.55, 0.35], l2: [0.75, 0.3], l3: [0.85, 0.2] };
  if (world === "pc" && u >= 0) {
    const k = back ? 1 - u : u;
    dot = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  } else if (world === "mem") dot = { x: ram.x + ram.w / 2, y: ram.y + ram.h / 2 };
  else if (inCpu[place]) dot = { x: cpu.x + cpu.w * inCpu[place]![0], y: cpu.y + cpu.h * inCpu[place]![1] };
  const box = (r: { x: number; y: number; w: number; h: number }, label: string, on: boolean, c: string) => (
    <g>
      <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={3} fill={on ? c : "rgba(255,255,255,0.05)"} fillOpacity={on ? 0.22 : 1} stroke={on ? c : "rgba(255,255,255,0.28)"} />
      <text x={r.x + r.w / 2} y={r.y + r.h + 9} textAnchor="middle">
        {label}
      </text>
    </g>
  );
  return (
    <div className="rd-map" aria-label="小地图">
      <svg viewBox="0 0 160 118" role="img" aria-label={`当前位置：${world === "pc" ? "内存总线" : world === "mem" ? "内存条" : "CPU 内部"}`}>
        <rect x={2} y={2} width={156} height={114} rx={8} fill="rgba(14,17,23,0.6)" stroke="rgba(255,255,255,0.12)" />
        {box({ x: 14, y: 82, w: 92, h: 10 }, "显卡", false, "#3CA8FF")}
        {box({ x: 112, y: 86, w: 20, h: 14 }, "", false, "#2FD0B8")}
        <text x={122} y={110} textAnchor="middle">
          芯片组
        </text>
        {box({ x: 14, y: 24, w: 30, h: 22 }, "电源", false, "#FFC24A")}
        {box(cpu, "CPU", visited.has("cpu"), "#82D278")}
        {box(ram, "内存", visited.has("ram"), "#B07CFF")}
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#B07CFF" strokeWidth={visited.has("bus") ? 2.4 : 1.2} strokeOpacity={visited.has("bus") ? 1 : 0.45} />
        <line x1={cpu.x + cpu.w / 2} y1={cpu.y + cpu.h} x2={60} y2={82} stroke="#3CA8FF" strokeOpacity={0.35} />
        <line x1={cpu.x + cpu.w} y1={cpu.y + cpu.h - 4} x2={122} y2={86} stroke="#2FD0B8" strokeOpacity={0.35} />
        <circle cx={dot.x} cy={dot.y} r={6} fill="#fff" fillOpacity={0.18} className="rd-map__pulse" />
        <circle cx={dot.x} cy={dot.y} r={3} fill="#fff" />
      </svg>
    </div>
  );
}

function ParamsPanel({ value, onApply, onClose }: { value: AccessParams; onApply: (p: AccessParams) => void; onClose: () => void }) {
  const [p, setP] = useState<AccessParams>(value);
  const [va, setVa] = useState(hex32Spaced(value.va));
  const vaOk = parseHexAddr(va) !== null;
  const set = <K extends keyof AccessParams>(k: K, v: AccessParams[K]) => setP((o) => ({ ...o, [k]: v }));
  const setT = (k: keyof AccessParams["t"], v: number) => setP((o) => ({ ...o, t: { ...o.t, [k]: v } }));
  const seg = <T extends string | number | boolean>(label: string, cur: T, opts: [T, string][], on: (v: T) => void) => (
    <div className="rd-row">
      <span>{label}</span>
      <span className="pc-seg">
        {opts.map(([v, l]) => (
          <button key={String(v)} type="button" className={cur === v ? "is-on" : undefined} onClick={() => on(v)}>
            {l}
          </button>
        ))}
      </span>
    </div>
  );
  const sel = (label: string, cur: number, opts: number[], fmt: (v: number) => string, on: (v: number) => void) => (
    <label className="rd-row">
      <span>{label}</span>
      <select value={cur} onChange={(e) => on(Number(e.target.value))}>
        {opts.map((v) => (
          <option key={v} value={v}>
            {fmt(v)}
          </option>
        ))}
      </select>
    </label>
  );
  const num = (label: string, k: keyof AccessParams["t"]) => (
    <label className="rd-num">
      <span>{label}</span>
      <input type="number" min={0} step="any" inputMode="decimal" value={p.t[k]} onChange={(e) => setT(k, Math.max(0, Number(e.target.value) || 0))} />
    </label>
  );
  const kb = (v: number) => `${v / 1024} KB`;
  return (
    <aside className="rd-card rd-card--params" role="dialog" aria-label="参数">
      <header>
        <h3>参数</h3>
        <button type="button" className="rd-x" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </header>
      <label className="rd-row">
        <span>虚拟地址</span>
        <input className={vaOk ? "rd-in" : "rd-in is-bad"} value={va} onChange={(e) => setVa(e.target.value)} spellCheck={false} aria-invalid={!vaOk} />
      </label>
      {sel("页大小", p.pageSize, PAGE_SIZES, kb, (v) => set("pageSize", v))}
      {seg("页表", p.levels, [[1, "一级"], [2, "二级"]], (v) => set("levels", v as 1 | 2))}
      {seg("TLB", p.tlbHit, [[true, "命中"], [false, "缺失"]], (v) => setP((o) => ({ ...o, tlbHit: v, resident: v ? true : o.resident })))}
      {seg("页在主存", p.resident, [[true, "在"], [false, "不在（缺页）"]], (v) => setP((o) => ({ ...o, resident: v, tlbHit: v ? o.tlbHit : false, outcome: v ? o.outcome : "mem" })))}
      {sel("L1 容量", p.l1Size, L1_SIZES, kb, (v) => set("l1Size", v))}
      {sel("块大小", p.blockSize, BLOCK_SIZES, (v) => `${v} B`, (v) => set("blockSize", v))}
      {sel("相联度", p.ways, WAY_OPTIONS, (v) => (v === 1 ? "直接映射" : `${v} 路组相联`), (v) => set("ways", v))}
      {seg<Policy>("替换策略", p.policy, [["lru", "LRU"], ["fifo", "FIFO"], ["random", "随机"]], (v) => set("policy", v))}
      {seg<CacheOutcome>("数据在", p.outcome, [["l1", "L1"], ["l2", "L2"], ["l3", "L3"], ["mem", "主存"]], (v) => setP((o) => ({ ...o, outcome: v, resident: v === "mem" ? o.resident : true })))}
      {seg("查找方式", p.mode, [["seq", "先查后访"], ["par", "同时访问"]], (v) => set("mode", v as "seq" | "par"))}
      <h4>访问时间（ns）</h4>
      <div className="rd-nums">
        {num("TLB", "tlb")}
        {num("L1", "l1")}
        {num("L2", "l2")}
        {num("L3", "l3")}
        {num("主存", "mem")}
      </div>
      {seg("缺页时外存", p.t.disk, [[10_000_000, "机械硬盘 10 ms"], [100_000, "固态硬盘 100 µs"]], (v) => setT("disk", v))}
      <p className="rd-note">默认数值是常见的数量级；题目给出的数值以题目为准。</p>
      <div className="rd-card__foot">
        <button type="button" className="pc-btn" onClick={() => { setP(DEFAULT_ACCESS); setVa(hex32Spaced(DEFAULT_ACCESS.va)); }}>
          恢复默认
        </button>
        <button type="button" className="pc-btn pc-btn--tour" disabled={!vaOk} onClick={() => onApply({ ...p, va: parseHexAddr(va) ?? p.va })}>
          按新参数出发
        </button>
      </div>
    </aside>
  );
}
