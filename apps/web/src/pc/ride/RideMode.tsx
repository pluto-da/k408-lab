// 「化身数据」界面：路线选择、HUD、数据外壳、小地图、时间轴、岔路口、参数、结算、文字版路线。
// 进入时才加载（含 CPU / 内存内部场景），不影响整机拆解首屏。
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
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
/** 版式：宽屏（右侧讲解栏）/ 竖屏（下方讲解抽屉）/ 矮横屏（右侧窄讲解栏） */
type Layout = "wide" | "tall" | "short";

function layoutOf(w: number, h: number): Layout {
  const a = w / Math.max(1, h);
  if (a >= 1.3 && h < 500) return "short";
  return a >= 1.3 ? "wide" : "tall";
}

const clampI = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

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
  const viewRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<RideScene | null>(null);
  const prefersReduced = useMedia("(prefers-reduced-motion: reduce)");
  const touch = useMedia("(pointer: coarse)");
  const [layout, setLayout] = useState<Layout>(() => (typeof window === "undefined" ? "wide" : layoutOf(window.innerWidth, window.innerHeight)));
  const [sideOpen, setSideOpen] = useState(true);
  const [immersive, setImmersive] = useState(false);
  const [drawer, setDrawer] = useState<"peek" | "full" | "min">("peek");
  const [menu, setMenu] = useState(false);
  const [shellFloat, setShellFloat] = useState(false);
  const [mapOpen, setMapOpen] = useState(() => typeof window === "undefined" || window.innerHeight >= 820);
  const [flightOpen, setFlightOpen] = useState(false);
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
        }, () => labelRef.current);
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

  // 版式：按化身数据区域本身的宽高决定
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const f = () => {
      const r = root.getBoundingClientRect();
      if (r.width && r.height) setLayout(layoutOf(r.width, r.height));
    };
    f();
    const ro = new ResizeObserver(f);
    ro.observe(root);
    return () => ro.disconnect();
  }, [phase]);

  // 观察窗口与安全区：渲染只覆盖观察窗口；贴边的按钮、位置条占去的上下边带从安全区里扣掉，取景时焦点不进这些边带
  const measure = useCallback(() => {
    const s = sceneRef.current;
    const view = viewRef.current;
    const stage = stageRef.current;
    if (!s || !view || !stage) return;
    const C = s.canvasRect();
    const V = view.getBoundingClientRect();
    if (!V.width || !V.height) return;
    let top = 0;
    let bottom = 0;
    stage.querySelectorAll<HTMLElement>(".rd-ov").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") return;
      if (r.bottom <= V.top || r.top >= V.bottom || r.right <= V.left || r.left >= V.right) return;
      if ((r.top + r.bottom) / 2 < V.top + V.height / 2) top = Math.max(top, r.bottom - V.top + 8);
      else bottom = Math.max(bottom, V.bottom - r.top + 8);
    });
    s.setLayout({ x: V.left - C.left, y: V.top - C.top, w: V.width, h: V.height }, { x: 0, y: top, w: V.width, h: Math.max(40, V.height - top - bottom) });
  }, []);
  useLayoutEffect(() => {
    if (phase !== "ride") return;
    measure();
    const stage = stageRef.current;
    const ro = new ResizeObserver(measure);
    if (viewRef.current) ro.observe(viewRef.current);
    stage?.querySelectorAll(".rd-ov").forEach((el) => ro.observe(el));
    const t = setTimeout(measure, 400);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  });

  // 飞行段（总线）讲解区自动收成一行标题；换站后恢复
  useEffect(() => setFlightOpen(false), [idx]);
  useEffect(() => {
    if (!menu) return;
    const f = (e: PointerEvent) => {
      if (!(e.target as HTMLElement | null)?.closest(".rd-more")) setMenu(false);
    };
    window.addEventListener("pointerdown", f);
    return () => window.removeEventListener("pointerdown", f);
  }, [menu]);

  // 测试构建的检查接口（生产构建里 __RIDE_AUDIT__ 为 false，整段被删除）
  const planRef = useRef(plan);
  planRef.current = plan;
  useEffect(() => {
    if (!__RIDE_AUDIT__) return;
    const w = window as unknown as Record<string, unknown>;
    w.__ride = {
      probe: () => sceneRef.current?.probe?.() ?? null,
      goTo: (i: number) => sceneRef.current?.goTo(i),
      pause: (v: boolean) => setPaused(v),
      start: (patch: Partial<AccessParams>) => {
        const p = { ...DEFAULT_ACCESS, ...patch };
        setParams(p);
        void startRide(p, false);
      },
      stations: () => planRef.current.stations.map((s) => ({ id: s.id, title: s.title, kind: s.cue.kind, stop: s.stop })),
    };
    return () => {
      delete w.__ride;
    };
  }, [startRide]);

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
        else if (menu) setMenu(false);
        else if (immersive) setImmersive(false);
        else exit();
      } else if (k === "h" || k === "H") {
        e.preventDefault();
        setImmersive((v) => !v);
        setMenu(false);
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
  }, [phase, panel, menu, immersive, exit, next, prev, changeSpeed, cycleView]);

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
    if (!p) {
      // 电脑上鼠标悬停在焦点对象上：显示它是什么
      if (e.pointerType === "mouse") {
        const over = !!sceneRef.current?.overFocus(e.clientX, e.clientY);
        const t = over && st ? `${st.what.title} · 点「这是什么？」看说明` : "";
        if (e.currentTarget.title !== t) e.currentTarget.title = t;
      }
      return;
    }
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

  const flight = st?.cue.kind === "bus";
  const minimized = flight && !flightOpen;
  const wideL = layout === "wide";
  const tallL = layout === "tall";
  const shortL = layout === "short";
  const nextLabel = arrived && idx === N - 1 ? "看小结" : arrived ? "下一站" : "到站";
  const note = shellNote(st, arrived);
  const openPanel = (p: Panel) => {
    setMenu(false);
    setPanel(panel === p ? null : p);
  };
  const toggleMode = () => setMode((m) => (m === "auto" ? "manual" : "auto"));
  const rootCls = ["rd-root", `rd-L--${layout}`, immersive ? "is-imm" : "", wideL && !sideOpen ? "is-side-closed" : "", tallL ? `is-drawer-${minimized ? "min" : drawer}` : "", touch ? "is-touch" : ""].filter(Boolean).join(" ");

  const moreMenu = menu && (
    <div className="rd-menu" role="menu" aria-label="更多">
      <button type="button" role="menuitem" onClick={() => openPanel("params")}>
        参数
      </button>
      <button type="button" role="menuitem" onClick={() => openPanel("text")}>
        文字版
      </button>
      <button type="button" role="menuitem" onClick={() => openPanel("settings")}>
        设置
      </button>
      {shortL && (
        <button type="button" role="menuitem" onClick={() => openPanel("what")}>
          这是什么？
        </button>
      )}
      {!wideL && (
        <button type="button" role="menuitem" onClick={() => (setMenu(false), cycleView())}>
          视角：{VIEWS.find((v) => v.id === view)!.label}
        </button>
      )}
      {!wideL && (
        <button type="button" role="menuitem" aria-pressed={showMap} onClick={() => (setMenu(false), setShowMap((v) => !v))}>
          {showMap ? "收起小地图" : "小地图"}
        </button>
      )}
      {shortL && (
        <button type="button" role="menuitem" onClick={() => (setMenu(false), setImmersive(true))}>
          沉浸模式
        </button>
      )}
    </div>
  );

  const tools = (
    <div className={shortL ? "rd-tools" : "rd-tools rd-ov"} role="toolbar" aria-label="工具">
      {!shortL && (
        <button type="button" className="rd-tb rd-exit" onClick={exit} aria-label="退出化身数据（Esc）">
          退出
        </button>
      )}
      {wideL && (
        <button type="button" className="rd-tb" onClick={cycleView} aria-label={`视角：${VIEWS.find((v) => v.id === view)!.label}（V 切换）`}>
          {VIEWS.find((v) => v.id === view)!.label}
        </button>
      )}
      {!shortL && (
        <button type="button" className="rd-tb" onClick={() => (setMenu(false), setImmersive(true))} aria-label="沉浸模式：只看画面（H）" title="只看画面（H）">
          沉浸
        </button>
      )}
      <span className="rd-more">
        <button type="button" className={menu ? "rd-tb is-on" : "rd-tb"} onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-haspopup="menu">
          更多
        </button>
        {moreMenu}
      </span>
      {shortL && (
        <button type="button" className="rd-tb rd-exit" onClick={exit} aria-label="退出化身数据（Esc）">
          退出
        </button>
      )}
    </div>
  );

  const pad = (
    <>
      <button type="button" className="rd-pad__btn" aria-label="按住后退（S）" {...hold(-1)}>
        <Icon d="M6 10l6 6 6-6" />
      </button>
      <button type="button" className="rd-pad__btn" aria-label="按住前进（W）" {...hold(1)}>
        <Icon d="M6 14l6-6 6 6" />
      </button>
    </>
  );

  const progress = (
    <div
      className="rd-prog"
      role="progressbar"
      aria-label="路线进度"
      aria-valuemin={1}
      aria-valuemax={N}
      aria-valuenow={idx + 1}
      aria-valuetext={`第 ${idx + 1} 站：${st?.title ?? ""}`}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        goTo(clampI(Math.floor(((e.clientX - r.left) / Math.max(1, r.width)) * N), 0, N - 1));
      }}
    >
      {plan.stations.map((s, i) => (
        <i key={s.id} className={i === idx ? "is-on" : i < idx || (i === idx && arrived) ? "is-done" : undefined} title={s.title} />
      ))}
    </div>
  );

  const ctl = (
    <div className="rd-ctl" role="toolbar" aria-label="控制">
      <button type="button" className="rd-cb" onClick={prev} disabled={idx === 0 && !arrived} aria-label="上一站（←）" title="上一站">
        {shortL ? <Icon d="M15 6l-6 6 6 6" /> : "上一站"}
      </button>
      {shortL && mode === "manual" ? (
        pad
      ) : (
        <button type="button" className="rd-cb" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? "继续播放（空格）" : "暂停（空格）"} title={paused ? "继续播放" : "暂停"}>
          {shortL ? paused ? <Icon d="M8 5l11 7-11 7z" fill /> : <Icon d="M8 5v14M16 5v14" /> : paused ? "继续播放" : "暂停"}
        </button>
      )}
      <button type="button" className="rd-cb rd-next" onClick={next} disabled={!canNext} aria-label={`${nextLabel}（Enter）`}>
        {nextLabel}
      </button>
      <button type="button" className={mode === "manual" ? "rd-cb rd-mode is-on" : "rd-cb rd-mode"} onClick={toggleMode} aria-pressed={mode === "manual"} aria-label={mode === "auto" ? "自动巡航，点按切换为手动游走" : "手动游走，点按切换为自动巡航"} title="切换前进方式">
        {shortL ? (mode === "auto" ? "巡航" : "手动") : mode === "auto" ? "自动巡航" : "手动游走"}
      </button>
      {wideL && progress}
      {speed !== 1 && <span className="rd-speed">{speed}×</span>}
    </div>
  );

  const shellEl = <Shell shell={shell} note={note} float={shellFloat} />;

  const headTitle = st && (
    <>
      <span className="rd-cap__n">
        {idx + 1}/{N}
      </span>
      <h2>{st.title}</h2>
    </>
  );
  const head = st && (
    <header className="rd-head">
      {flight || tallL ? (
        <button
          type="button"
          className="rd-head__t"
          onClick={() => (flight ? setFlightOpen((v) => !v) : setDrawer((d) => (d === "min" ? "peek" : "min")))}
          aria-expanded={!minimized && !(tallL && drawer === "min")}
          aria-label={`${st.title}：${minimized || drawer === "min" ? "展开讲解" : "收成一行"}`}
        >
          {headTitle}
        </button>
      ) : (
        <div className="rd-head__t">{headTitle}</div>
      )}
      {shortL && tools}
      {tallL && (
        <button type="button" className="rd-tb" onClick={() => (minimized ? setFlightOpen(true) : setDrawer((d) => (d === "full" ? "peek" : "full")))} aria-label={drawer === "full" && !minimized ? "收起讲解" : "展开讲解"}>
          {drawer === "full" && !minimized ? "收起" : "展开"}
        </button>
      )}
      {wideL && (
        <button type="button" className="rd-tb rd-tb--icon" onClick={() => setSideOpen(false)} aria-label="收起讲解栏" title="收起讲解栏">
          <Icon d="M9 6l6 6-6 6" />
        </button>
      )}
    </header>
  );

  const fork =
    forkNow && st?.fork ? (
      <div className="rd-fork" role="group" aria-label={st.fork.question}>
        <b>{st.fork.question}</b>
        <div className="rd-fork__opts">
          {st.fork.options.map((o) => {
            const chosen = judge ? ans?.pick === o.id : false;
            const correct = (judge ? !!ans : cueDone.has(idx)) && o.id === st.fork!.answer;
            return (
              <button key={o.id} type="button" className={`rd-opt${correct ? " is-ok" : ""}${chosen && !ans?.ok ? " is-bad" : ""}`} disabled={!judge || !!ans} onClick={() => answer(o.id)}>
                {o.label}
              </button>
            );
          })}
        </div>
        {judge && !ans && <small>你来判断：选一条通道</small>}
        {judge && ans && <small className={ans.ok ? "is-ok" : "is-bad"}>{ans.ok ? `判断正确：${st.fork.why}` : `不对。${st.fork.wrong}`}</small>}
      </div>
    ) : null;

  const body = st && !minimized && !(tallL && drawer === "min") && (
    <div className="rd-body" tabIndex={0} aria-label="讲解正文">
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
      {tallL && (
        <button type="button" className="rd-tb rd-what" onClick={() => setPanel(panel === "what" ? null : "what")} aria-expanded={panel === "what"}>
          这是什么？
        </button>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className={rootCls} style={style}>
      <div ref={stageRef} className="rd-stage">
        <div ref={viewRef} className="rd-view">
          <div className="rd-look" onPointerDown={onPDown} onPointerMove={onPMove} onPointerUp={onPUp} onPointerCancel={onPUp} aria-hidden="true" />
          <div ref={labelRef} className="rd-labels" aria-hidden="true" />
          <div ref={fxRef} className="rd-fx" aria-hidden="true" />
        </div>
        {phase === "loading" && (
          <div className="rd-toast" role="status">
            正在缩小成一段数据…
          </div>
        )}
        {immersive ? (
          <button type="button" className="rd-tb rd-restore rd-ov" onClick={() => setImmersive(false)} aria-label="显示讲解和按钮（H）">
            显示讲解
          </button>
        ) : (
          <>
            {!shortL && (
              <div className="rd-loc rd-ov" role="status" aria-live="polite">
                <b>{st?.loc ?? "CPU"}</b>
                <span>
                  <em>真实</em> {fmtNs(clockNs)}
                  <span className="rd-loc__demo">
                    {" "}
                    <i aria-hidden="true">·</i> <em>演示</em> {fmtClock(demo)}
                  </span>
                </span>
              </div>
            )}
            {!shortL && tools}
            {!wideL && showMap && (
              <div className="rd-mapfloat rd-ov">
                <MiniMap world={pos.world} place={plan.stations[pos.i]?.place ?? "core"} u={pos.u} visited={visited} />
              </div>
            )}
            {hint && wideL && phase === "ride" && !summary && (
              <div className="rd-hint rd-ov" aria-hidden="true">
                拖动转头 · W / S 前进后退 · 空格暂停 · H 只看画面
              </div>
            )}
            {mode === "manual" && !shortL && (
              <div className="rd-pad rd-ov" role="group" aria-label="手动游走">
                {pad}
              </div>
            )}
            {shellFloat && <div className="rd-floatshell rd-ov">{shellEl}</div>}
          </>
        )}
      </div>

      {!immersive && wideL && ctl}

      {!immersive && wideL && !sideOpen && (
        <aside className="rd-strip" aria-label="讲解（已收起）">
          <button type="button" className="rd-tb rd-tb--icon" onClick={() => setSideOpen(true)} aria-label="展开讲解栏" title="展开讲解栏">
            <Icon d="M15 6l-6 6 6 6" />
          </button>
          <span className="rd-cap__n">
            {idx + 1}/{N}
          </span>
        </aside>
      )}

      {!immersive && !(wideL && !sideOpen) && st && (
        <section className={minimized ? "rd-panel is-min" : "rd-panel"} aria-live="polite" aria-label="讲解">
          {head}
          {!minimized && !shellFloat && shellEl}
          {tallL || shortL ? (
            !minimized && drawer !== "min" ? (
              <div className="rd-scroll">
                {body}
                {fork}
              </div>
            ) : null
          ) : (
            <>
              {body}
              {!minimized && fork}
            </>
          )}
          {wideL && !minimized && (
            <div className="rd-panel__row">
              <button type="button" className="rd-tb" onClick={() => setPanel(panel === "what" ? null : "what")} aria-expanded={panel === "what"}>
                这是什么？
              </button>
              <button type="button" className="rd-tb" onClick={() => setMapOpen((v) => !v)} aria-expanded={mapOpen}>
                {mapOpen ? "收起地图" : "小地图"}
              </button>
            </div>
          )}
          {wideL && mapOpen && !minimized && <MiniMap world={pos.world} place={plan.stations[pos.i]?.place ?? "core"} u={pos.u} visited={visited} />}
          {!wideL && progress}
          {!wideL && ctl}
        </section>
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
            <span>数据外壳悬浮在画面下沿</span>
            <input type="checkbox" checked={shellFloat} onChange={(e) => setShellFloat(e.target.checked)} />
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
          <p className="rd-keys">键盘：W / S 前进后退，← / → 上一站 / 下一站，Enter 继续，空格暂停，Q / E 减速 / 加速，V 切换视角，H 只看画面，Esc 退出。</p>
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

/** 数据外壳：我现在携带的内容，随处理过程变化（放在讲解区；设置里可改为悬浮在画面下沿） */
function Shell({ shell, note, float }: { shell: ShellState; note: string | null; float: boolean }) {
  return (
    <div className={float ? "rd-shell is-float" : "rd-shell"} aria-label={`我现在是：${shell.kind}`}>
      <span className="rd-shell__kind">我现在是 · {shell.kind}</span>
      <span className="rd-shell__segs">
        {shell.segs.map((s) => (
          <span key={s.label + s.value} className="rd-seg" style={{ ["--c" as string]: TONE[s.tone] ?? "#fff" }}>
            <small>
              {s.label}
              {s.bits ? <i> · {s.bits} 位</i> : null}
            </small>
            <b>{s.value}</b>
          </span>
        ))}
      </span>
      {note && <small className="rd-shell__note">{note}</small>}
    </div>
  );
}

/** 外壳下的一行补充：第 1 站写出地址加法，查快表时写出组号从哪几位来（只用站点里已有的数据推出） */
function shellNote(st: RideStation | undefined, arrived: boolean): string | null {
  if (!st || !arrived) return null;
  const c = st.cue;
  if (c.kind === "core" && c.phase === "issue") {
    const base = parseHexAddr(c.base);
    const va = parseHexAddr(c.value);
    if (base === null || va === null) return null;
    return `基址 ${c.reg} = ${c.base}，加偏移 ${va - base} 得到 ${c.value}`;
  }
  if (c.kind === "tlb") {
    const set = st.shell.segs.find((x) => x.tone === "set");
    if (!set) return null;
    return `虚页号的低 ${set.bits ?? 0} 位 = ${set.value}，作为 TLB 组号；其余高位是标记`;
  }
  return null;
}

function Icon({ d, fill }: { d: string; fill?: boolean }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path d={d} fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
