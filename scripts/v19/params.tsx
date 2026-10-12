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
