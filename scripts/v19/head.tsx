// 「化身数据」界面：路线选择、画面四角浮层、讲解栏（站点头 / 讲解区 / 操作区）、地址条、岔路、更多菜单、参数、结算、文字版路线。
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

type Panel = null | "params" | "text";
type Menu = null | "more" | "view";
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
  const [immersive, setImmersive] = useState(false);
  const [drawer, setDrawer] = useState<"peek" | "full" | "min">("peek");
  const [menu, setMenu] = useState<Menu>(null);
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

  // 浏览器返回键退出：进入时压入一条历史记录，返回时退出化身数据
  const pushedRef = useRef(false);
  const exitNow = useCallback(() => {
    const s = sceneRef.current;
    if (s) {
      s.exit();
      s.dispose();
      sceneRef.current = null;
      engine.exitRide();
    }
    onExit();
  }, [engine, onExit]);
  const exit = useCallback(() => {
    if (pushedRef.current && (window.history.state as { rdRide?: boolean } | null)?.rdRide) {
      pushedRef.current = false;
      window.history.back();
    }
    exitNow();
  }, [exitNow]);
  const exitRef = useRef(exitNow);
  exitRef.current = exitNow;
  useEffect(() => {
    const onPop = () => {
      if (!pushedRef.current) return;
      pushedRef.current = false;
      exitRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (phase !== "ride" || pushedRef.current) return;
    pushedRef.current = true;
    window.history.pushState({ ...((window.history.state as object | null) ?? {}), rdRide: true }, "");
  }, [phase]);

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
      if (!(e.target as HTMLElement | null)?.closest(".rd-more")) setMenu(null);
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
        else if (menu) setMenu(null);
        else if (immersive) setImmersive(false);
        else exit();
      } else if (k === "h" || k === "H") {
        e.preventDefault();
        setImmersive((v) => !v);
        setMenu(null);
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
  };
  const onPMove = (e: RPointerEvent<HTMLDivElement>) => {
    const p = ptrs.current.get(e.pointerId);
    if (!p) {
      // 电脑上鼠标悬停在焦点对象上：显示它是什么
      if (e.pointerType === "mouse") {
        const over = !!sceneRef.current?.overFocus(e.clientX, e.clientY);
        const t = over && st ? st.what.title : "";
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

