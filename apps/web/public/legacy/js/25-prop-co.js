/* 性质与公式 · 计算机组成原理（14 条）
   注册到 window.PROP（引擎 23-prop-core.js 负责渲染），纯计算函数挂在 window.PROPU.co 上供测试与动画共用。
   本文件不在加载时触碰 DOM；demo(box) 在卡片打开时才构建，返回 { destroy }。 */
(function () {
  var PROP = window.PROP = window.PROP || [];
  var PROPU = window.PROPU = window.PROPU || {};

  /* ======================= 纯函数 ======================= */
  function pow2(k) { return Math.pow(2, k); }
  function isInt(x) { return typeof x === "number" && isFinite(x) && Math.floor(x) === x; }
  function isPow2(x) { return isInt(x) && x > 0 && pow2(Math.round(Math.log(x) / Math.LN2)) === x; }
  function log2i(x) { return Math.round(Math.log(x) / Math.LN2); }
  function bits(v, n) { var s = ""; for (var i = n - 1; i >= 0; i--) s += Math.floor(v / pow2(i)) % 2; return s; }

  var CODE_NAME = { sign: "原码", ones: "反码", twos: "补码" };

  /** n 位（含符号位）定点数的表示范围；frac 为真时是定点小数 */
  function fixedRange(n, code, frac) {
    if (!isInt(n) || n < 2 || n > 32) return { err: "位数 n 应为 2 ~ 32 的整数" };
    if (!CODE_NAME[code]) return { err: "编码只能是原码、反码或补码" };
    var h = pow2(n - 1), r;
    if (frac) {
      var ulp = 1 / h;
      r = code === "twos" ? { min: -1, max: 1 - ulp } : { min: -(1 - ulp), max: 1 - ulp };
      r.ulp = ulp;
    } else {
      r = code === "twos" ? { min: -h, max: h - 1 } : { min: -(h - 1), max: h - 1 };
      r.ulp = 1;
    }
    r.zeros = code === "twos" ? 1 : 2;
    r.count = code === "twos" ? pow2(n) : pow2(n) - 1;
    r.code = code;
    r.n = n;
    return r;
  }

  /** 整数 x 的 n 位原码/反码/补码；超出范围返回 null */
  function encode(x, n, code) {
    var R = fixedRange(n, code, false);
    if (R.err || !isInt(x) || x < R.min || x > R.max) return null;
    var h = pow2(n - 1), M = pow2(n);
    if (code === "twos") return bits((x + M) % M, n);
    if (x >= 0) return bits(x, n);
    var mag = bits(-x, n - 1);
    if (code === "sign") return "1" + mag;
    return "1" + mag.replace(/[01]/g, function (c) { return c === "0" ? "1" : "0"; });
  }

  /** 补码加减法溢出：三种判断方法 */
  function overflow(x, y, n, op) {
    if (!isInt(n) || n < 2 || n > 24) return { err: "位数 n 应为 2 ~ 24 的整数" };
    if (op !== "+" && op !== "-") return { err: "运算只能是加法或减法" };
    var R = fixedRange(n, "twos", false);
    if (!isInt(x) || !isInt(y)) return { err: "x、y 应为整数" };
    if (x < R.min || x > R.max) return { err: "x = " + minus(x) + " 超出 " + n + " 位补码范围 " + minus(R.min) + " ~ " + R.max };
    if (y < R.min || y > R.max) return { err: "y = " + minus(y) + " 超出 " + n + " 位补码范围 " + minus(R.min) + " ~ " + R.max };
    var sub = op === "-", M = pow2(n), A = (x + M) % M, B = (y + M) % M;
    var Bp = sub ? M - 1 - B : B, cin = sub ? 1 : 0;
    var carries = [cin], c = cin;
    for (var i = 0; i < n; i++) {
      var s = Math.floor(A / pow2(i)) % 2 + Math.floor(Bp / pow2(i)) % 2 + c;
      c = s >= 2 ? 1 : 0;
      carries.push(c);
    }
    var S = (A + Bp + cin) % M, sa = A >= M / 2 ? 1 : 0, sy = B >= M / 2 ? 1 : 0, ss = S >= M / 2 ? 1 : 0;
    var m1 = sub ? (sa !== sy && ss !== sa) : (sa === sy && ss !== sa);
    var M2 = 2 * M, A2 = (x + M2) % M2, B2 = (y + M2) % M2, Bp2 = sub ? M2 - 1 - B2 : B2;
    var S2 = (A2 + Bp2 + cin) % M2, top = Math.floor(S2 / pow2(n - 1)) % 4;
    var m2 = top === 1 || top === 2;
    var Cn = carries[n], Cn1 = carries[n - 1], m3 = (Cn ^ Cn1) === 1;
    var truth = sub ? x - y : x + y, of = truth > R.max || truth < R.min;
    return {
      n: n, op: op, x: x, y: y, A: bits(A, n), B: bits(B, n), Bp: bits(Bp, n), S: bits(S, n), cin: cin,
      A2: bits(A2, n + 1), Bp2: bits(Bp2, n + 1), S2: bits(S2, n + 1), top: bits(top, 2),
      carries: carries, Cn: Cn, Cn1: Cn1, m1: m1, m2: m2, m3: m3, of: of,
      kind: of ? (truth > 0 ? "正溢出" : "负溢出") : null,
      truth: truth, value: S >= M / 2 ? S - M : S, min: R.min, max: R.max,
      agree: m1 === of && m2 === of && m3 === of
    };
  }

  /** 浮点格式（阶码 e 位、尾数 m 位、IEEE 754 规则）的极值 */
  function floatLimits(e, m) {
    if (!isInt(e) || e < 2 || e > 11) return { err: "阶码位数应为 2 ~ 11 的整数" };
    if (!isInt(m) || m < 1 || m > 52) return { err: "尾数位数应为 1 ~ 52 的整数" };
    var bias = pow2(e - 1) - 1, emax = bias, emin = 1 - bias;
    var one = function (k) { var s = ""; for (var i = 0; i < k; i++) s += "1"; return s; };
    var zero = function (k) { var s = ""; for (var i = 0; i < k; i++) s += "0"; return s; };
    return {
      e: e, m: m, bias: bias, emax: emax, emin: emin,
      maxNorm: (2 - pow2(-m)) * pow2(emax),
      minNorm: pow2(emin),
      maxDen: (1 - pow2(-m)) * pow2(emin),
      minDen: pow2(emin - m),
      overflowAt: (2 - pow2(-m - 1)) * pow2(emax),
      pat: {
        maxNorm: ["0", one(e - 1) + "0", one(m)],
        minNorm: ["0", zero(e - 1) + "1", zero(m)],
        maxDen: ["0", zero(e), one(m)],
        minDen: ["0", zero(e), zero(m - 1) + "1"],
        inf: ["0", one(e), zero(m)],
        nan: ["0", one(e), "1" + zero(m - 1)],
        zero: ["0", zero(e), zero(m)]
      }
    };
  }

  /** 按大小判断 x 在该格式下属于哪一类（就近舍入的粗略边界） */
  function floatClass(x, e, m) {
    var L = floatLimits(e, m);
    if (L.err) return L;
    if (typeof x !== "number" || isNaN(x)) return { err: "请输入一个十进制数" };
    var ax = Math.abs(x);
    if (ax === 0) return { kind: "zero", text: "零（阶码、尾数全 0）" };
    if (ax === Infinity || ax >= L.overflowAt) return { kind: "inf", text: "上溢，舍入为 " + (x < 0 ? "−∞" : "+∞") };
    if (ax >= L.minNorm) return { kind: "normal", text: "规格化数（1 ≤ E ≤ " + (pow2(e) - 2) + "）" };
    if (ax > L.minDen / 2) return { kind: "denormal", text: "非规格化数（E = 0，隐含位为 0）" };
    return { kind: "underflow", text: "下溢，舍入为 0" };
  }

  /** 单精度机器数（十六进制，大写 8 位） */
  function f32Hex(x) {
    var f = new Float32Array(1), u = new Uint32Array(f.buffer);
    f[0] = x;
    var h = u[0].toString(16).toUpperCase();
    while (h.length < 8) h = "0" + h;
    return h;
  }

  /** 纠 1 位错的海明码最少校验位数 k：2^k ≥ n + k + 1；secded 再加 1 位总校验位 */
  function hammingK(n, secded) {
    if (!isInt(n) || n < 1 || n > 4096) return { err: "数据位数 n 应为 1 ~ 4096 的整数" };
    var k = 1;
    while (pow2(k) < n + k + 1) k++;
    return { n: n, k: secded ? k + 1 : k, base: k, total: n + k + (secded ? 1 : 0) };
  }
  function hammingMaxN(k) { return pow2(k) - k - 1; }

  /** "64KB" "4K" "32B" "1MB" "4GB" → 字节数 */
  function parseSize(s) {
    var t = String(s == null ? "" : s).replace(/\s+/g, "").toUpperCase();
    var mt = /^(\d+(?:\.\d+)?)([KMGT]?)(I?B|字节)?$/.exec(t);
    if (!mt) return NaN;
    var mul = { "": 1, K: 1024, M: 1048576, G: 1073741824, T: 1099511627776 }[mt[2]];
    var v = parseFloat(mt[1]) * mul;
    return isInt(v) ? v : NaN;
  }
  /** "4K×4" "2Kx8" "64K*8位" → { words, bits } */
  function parseWB(s) {
    var t = String(s == null ? "" : s).replace(/\s+/g, "").toUpperCase();
    var mt = /^(\d+)([KMG]?)[×X*](\d+)(位|BIT|B)?$/.exec(t);
    if (!mt) return null;
    var mul = { "": 1, K: 1024, M: 1048576, G: 1073741824 }[mt[2]];
    return { words: parseInt(mt[1], 10) * mul, bits: parseInt(mt[3], 10) };
  }
  function ceilLog2(x) { var k = 0; while (pow2(k) < x) k++; return k; }

  /** 用 a×b 位芯片组成 A×B 位存储器 */
  function memExpand(chip, target) {
    if (!chip || !target) return { err: "请按“单元数×位数”填写，例如 4K×4" };
    var a = chip.words, b = chip.bits, A = target.words, B = target.bits;
    if (!isInt(a) || !isInt(b) || !isInt(A) || !isInt(B) || a < 1 || b < 1 || A < 1 || B < 1) return { err: "容量必须是正整数" };
    if (B % b !== 0) return { err: "目标字长 " + B + " 位不是芯片位数 " + b + " 的整数倍" };
    if (A % a !== 0) return { err: "目标单元数不是芯片单元数的整数倍" };
    var rows = A / a, cols = B / b;
    var kind = rows === 1 && cols === 1 ? "无需扩展" : rows === 1 ? "位扩展" : cols === 1 ? "字扩展" : "字位同时扩展";
    return {
      rows: rows, cols: cols, count: rows * cols, kind: kind,
      chipAddr: ceilLog2(a), totalAddr: ceilLog2(A), sel: ceilLog2(rows), data: B,
      chipBytes: a * b / 8, targetBytes: A * B / 8
    };
  }

  /** m 体低位交叉：依次读取 n 个连续字（存储周期 T，启动间隔 r） */
  function interleave(m, T, r, n) {
    if (!isInt(m) || m < 1 || m > 16) return { err: "存储体数 m 应为 1 ~ 16 的整数" };
    if (!(T > 0) || !(r > 0)) return { err: "存储周期 T 与总线传送周期 r 都必须大于 0" };
    if (!isInt(n) || n < 1 || n > 64) return { err: "连续读取的字数应为 1 ~ 64 的整数" };
    var starts = [], wait = 0;
    for (var i = 0; i < n; i++) {
      var s = i === 0 ? 0 : starts[i - 1] + r;
      if (i >= m && starts[i - m] + T > s) { wait += starts[i - m] + T - s; s = starts[i - m] + T; }
      starts.push(s);
    }
    var finish = starts[n - 1] + T;
    return { starts: starts, bank: starts.map(function (_, i) { return i % m; }), finish: finish, formula: T + (n - 1) * r, ideal: T <= m * r, seq: n * T, wait: wait };
  }

  /** Cache 地址划分与总容量 */
  function cacheFields(o) {
    var mem = o.memBytes, cache = o.cacheBytes, blk = o.blockBytes;
    if (!isPow2(mem) || !isPow2(cache) || !isPow2(blk)) return { err: "主存容量、Cache 容量和块大小都必须是 2 的整数次幂" };
    if (blk > cache) return { err: "块大小不能超过 Cache 容量" };
    if (cache >= mem) return { err: "Cache 容量应小于主存容量" };
    var memBits = log2i(mem), lines = cache / blk;
    var k = o.ways === "full" ? lines : o.ways;
    if (!isPow2(k) || k > lines) return { err: "相联度必须是 2 的整数次幂且不超过行数 " + lines };
    var sets = lines / k, offset = log2i(blk), index = log2i(sets), tag = memBits - index - offset;
    var lru = o.lru && k > 1 ? log2i(k) : 0, dirty = o.wb ? 1 : 0;
    var perLine = blk * 8 + tag + 1 + dirty + lru;
    return {
      memBits: memBits, lines: lines, ways: k, sets: sets, offset: offset, index: index, tag: tag,
      valid: 1, dirty: dirty, lru: lru, dataBits: blk * 8, perLine: perLine,
      total: lines * perLine, dataTotal: cache * 8, overhead: lines * (perLine - blk * 8),
      kind: k === 1 ? "直接映射" : k === lines ? "全相联" : k + " 路组相联"
    };
  }
  function cacheLocate(addr, blockBytes, sets) {
    var block = Math.floor(addr / blockBytes);
    return { block: block, set: block % sets, tag: Math.floor(block / sets), offset: addr % blockBytes };
  }

  function hitRate(nc, nm) {
    if (!isInt(nc) || !isInt(nm) || nc < 0 || nm < 0 || nc + nm === 0) return { err: "命中次数与缺失次数应为非负整数且不能同时为 0" };
    return { h: nc / (nc + nm) };
  }
  /** mode: "par" 同时访问；"seq" 先访问 Cache，缺失再访问主存 */
  function cacheTa(h, tc, tm, mode) {
    if (!(h >= 0 && h <= 1)) return { err: "命中率 h 应在 0 ~ 1 之间" };
    if (!(tc > 0) || !(tm > 0)) return { err: "访问时间必须大于 0" };
    if (tm < tc) return { err: "主存访问时间应不小于 Cache 访问时间" };
    var ta = mode === "seq" ? tc + (1 - h) * tm : h * tc + (1 - h) * tm;
    return { ta: ta, e: tc / ta };
  }

  function avgCPI(mix) {
    var sp = 0, c = 0;
    for (var i = 0; i < mix.length; i++) {
      var p = mix[i].p, q = mix[i].cpi;
      if (!(p >= 0) || !(q > 0)) return { err: "比例不能为负，CPI 必须大于 0" };
      sp += p; c += p * q;
    }
    if (Math.abs(sp - 1) > 1e-6) return { err: "各类指令比例之和应为 100%（现在是 " + Math.round(sp * 1000) / 10 + "%）" };
    return { cpi: c };
  }
  function cpuTime(ic, cpi, f) {
    if (!(ic > 0) || !(cpi > 0) || !(f > 0)) return { err: "指令条数、CPI 与主频都必须大于 0" };
    return { t: ic * cpi / f, mips: f / (cpi * 1e6), cycles: ic * cpi };
  }
  function mips(f, cpi) { return f / (cpi * 1e6); }

  function amdahl(f, s) {
    if (!(f >= 0 && f <= 1)) return { err: "可改进比例 f 应在 0 ~ 1 之间" };
    if (!(s >= 1)) return { err: "部件加速比 s 应不小于 1" };
    return { S: 1 / ((1 - f) + f / s), limit: f === 1 ? Infinity : 1 / (1 - f), rest: (1 - f) + f / s };
  }
  function amdahlMax(f) { return f >= 1 ? Infinity : 1 / (1 - f); }

  function pipeline(k, n, dt) {
    if (!isInt(k) || k < 1 || k > 32) return { err: "段数 k 应为 1 ~ 32 的整数" };
    if (!isInt(n) || n < 1) return { err: "指令条数 n 应为正整数" };
    if (!(dt > 0)) return { err: "Δt 必须大于 0" };
    var T = (k + n - 1) * dt;
    return { T: T, TP: n / T, S: n * k * dt / T, E: n / (k + n - 1), cycles: k + n - 1 };
  }

  /** 扩展操作码：classes = [{ addr: 地址个数, num: 条数 }]，按地址数从多到少处理 */
  function opcodeCheck(L, A, classes) {
    if (!isInt(L) || L < 2 || L > 48) return { err: "指令字长应为 2 ~ 48 的整数" };
    if (!isInt(A) || A < 1 || A > 24) return { err: "地址码位数应为 1 ~ 24 的整数" };
    if (!classes || !classes.length) return { err: "至少要有一类指令" };
    var cs = classes.slice().sort(function (p, q) { return q.addr - p.addr; });
    for (var i = 0; i < cs.length; i++) {
      if (!isInt(cs[i].addr) || cs[i].addr < 0 || cs[i].addr > 4) return { err: "地址个数应为 0 ~ 4" };
      if (!isInt(cs[i].num) || cs[i].num < 0) return { err: "指令条数应为非负整数" };
      if (i && cs[i].addr === cs[i - 1].addr) return { err: "同一种地址格式只能出现一次" };
    }
    var op = L - cs[0].addr * A;
    if (op < 1) return { err: "字长 " + L + " 位放不下 " + cs[0].addr + " 个 " + A + " 位地址字段" };
    var steps = [], left = 0, ok = true, failAt = -1;
    for (i = 0; i < cs.length; i++) {
      var d = i ? (cs[i - 1].addr - cs[i].addr) * A : 0;
      if (i) op += d;
      var avail = i ? left * pow2(d) : pow2(op);
      left = avail - cs[i].num;
      steps.push({ addr: cs[i].addr, op: op, d: d, avail: avail, num: cs[i].num, left: Math.max(left, 0), ok: left >= 0 });
      if (left < 0) { ok = false; failAt = i; break; }
    }
    var last = steps[steps.length - 1];
    return { ok: ok, failAt: failAt, steps: steps, maxLast: ok ? last.avail : null };
  }
  function opcodeMinLen(A, classes) {
    var top = 0;
    classes.forEach(function (c) { if (c.addr > top) top = c.addr; });
    for (var L = top * A + 1; L <= 48; L++) {
      var r = opcodeCheck(L, A, classes);
      if (r.err) return r;
      if (r.ok) return { bits: L, bytes: Math.ceil(L / 8) * 8 };
    }
    return { err: "字长在 48 位以内都无法编码" };
  }

  /** 总线带宽（字节/秒）：宽度 width 位，时钟 f Hz，每 cpb 个时钟周期一次传输，每个时钟周期传 tpc 次 */
  function busBW(width, f, cpb, tpc) {
    if (!(width > 0) || !(f > 0)) return { err: "总线宽度与时钟频率必须大于 0" };
    cpb = cpb == null ? 1 : cpb; tpc = tpc == null ? 1 : tpc;
    if (!(cpb > 0) || !(tpc > 0)) return { err: "每次传输的时钟周期数与每周期传输次数必须大于 0" };
    return { bw: width / 8 * f * tpc / cpb, rate: f * tpc / cpb };
  }
  /** 一次地址周期（addr 个总线周期）后连续传 n 个数据，每个总线周期 cpb 个时钟周期 */
  function burstBW(width, f, addr, n, cpb) {
    if (!(width > 0) || !(f > 0)) return { err: "总线宽度与时钟频率必须大于 0" };
    if (!isInt(n) || n < 1 || !(addr >= 0)) return { err: "突发长度应为正整数，地址周期数不能为负" };
    cpb = cpb || 1;
    var t = (addr + n) * cpb / f;
    return { bw: n * width / 8 / t, time: t };
  }

  /** 三种 I/O 方式占用 CPU 的比例：f Hz，rate 字节/秒 */
  function ioShare(o) {
    var keys = ["f", "rate", "unit", "pollCycles", "intrCycles", "block", "dmaCycles"];
    for (var i = 0; i < keys.length; i++) if (!(o[keys[i]] > 0)) return { err: "所有参数都必须大于 0" };
    if (o.block < o.unit) return { err: "DMA 数据块不应小于一次中断传送的数据量" };
    var q = o.rate / o.unit, b = o.rate / o.block;
    return {
      perSec: q, blocks: b,
      poll: q * o.pollCycles / o.f,
      intr: q * o.intrCycles / o.f,
      dma: b * o.dmaCycles / o.f
    };
  }

  var U = PROPU.co = {
    pow2: pow2, bits: bits, fixedRange: fixedRange, encode: encode, overflow: overflow,
    floatLimits: floatLimits, floatClass: floatClass, f32Hex: f32Hex,
    hammingK: hammingK, hammingMaxN: hammingMaxN,
    parseSize: parseSize, parseWB: parseWB, memExpand: memExpand, interleave: interleave,
    cacheFields: cacheFields, cacheLocate: cacheLocate, hitRate: hitRate, cacheTa: cacheTa,
    avgCPI: avgCPI, cpuTime: cpuTime, mips: mips, amdahl: amdahl, amdahlMax: amdahlMax,
    pipeline: pipeline, opcodeCheck: opcodeCheck, opcodeMinLen: opcodeMinLen,
    busBW: busBW, burstBW: burstBW, ioShare: ioShare
  };

  /* ======================= 展示用小工具 ======================= */
  var SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺" };
  function sup(n) { return String(n).replace(/[0-9+-]/g, function (c) { return SUP[c]; }); }
  function minus(s) { return String(s).replace(/^-/, "−").replace(/e-/, "e−"); }
  function trim(s) { return s.indexOf(".") >= 0 ? s.replace(/0+$/, "").replace(/\.$/, "") : s; }
  function fmt(x, d) {
    if (x === Infinity) return "∞";
    if (x === -Infinity) return "−∞";
    if (typeof x !== "number" || isNaN(x)) return "—";
    var ax = Math.abs(x);
    if (ax !== 0 && (ax >= 1e7 || ax < 1e-3)) return sci(x, 3);
    return minus(trim(x.toFixed(d == null ? 4 : d)));
  }
  function sci(x, d) {
    if (x === 0) return "0";
    var e = Math.floor(Math.log(Math.abs(x)) / Math.LN10), mnt = x / Math.pow(10, e);
    if (Math.abs(mnt) >= 9.9995) { mnt /= 10; e += 1; }
    return minus(trim(mnt.toFixed(d == null ? 3 : d))) + " × 10" + sup(e);
  }
  function pct(x) {
    if (x === 0) return "0%";
    var v = x * 100, a = Math.abs(v);
    return minus(trim(v.toFixed(a >= 10 ? 2 : a >= 0.1 ? 3 : 5))) + "%";
  }
  function par(t) { return t.indexOf("×") >= 0 ? "(" + t + ")" : t; }
  function fmtTime(t) {
    if (t >= 1) return fmt(t, 4) + " s";
    if (t >= 1e-3) return fmt(t * 1e3, 4) + " ms";
    if (t >= 1e-6) return fmt(t * 1e6, 4) + " μs";
    return fmt(t * 1e9, 4) + " ns";
  }
  function group4(s) { return s.replace(/\B(?=(\d{4})+(?!\d))/g, " "); }
  function readNum(s) {
    var t = String(s == null ? "" : s).trim().replace(/^−/, "-").replace(/，/g, ",");
    if (t === "") return NaN;
    if (/^-?0x[0-9a-f]+$/i.test(t)) return t.charAt(0) === "-" ? -parseInt(t.slice(1), 16) : parseInt(t, 16);
    if (/^[0-9a-f]+h$/i.test(t)) return parseInt(t.slice(0, -1), 16);
    if (!/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t)) return NaN;
    return parseFloat(t);
  }

  var C = { co: "#C0603E", soft: "#F6E3DA", ink: "#1A1C20", gray: "#5B606B", line: "#D9D6CF", ok: "#1F7A4D", okSoft: "#E3F2EA", bad: "#B3261E", badSoft: "#FBE9E7", blue: "#4766B3", blueSoft: "#E4EAF7", gold: "#C49431", goldSoft: "#F6EDD5", green: "#3A8475", paper: "#FFFFFF", faint: "#F4F2EE" };
  var NS = "http://www.w3.org/2000/svg";
  var MONO = "Geist Mono,Menlo,monospace";

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function sv(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function tx(parent, x, y, s, o) {
    o = o || {};
    var t = sv("text", {
      x: x, y: y, "font-size": o.size || 13, "text-anchor": o.anchor || "start", fill: o.fill || C.ink,
      "font-family": o.mono ? MONO : null, "font-weight": o.bold ? 600 : null
    }, parent);
    t.textContent = s;
    return t;
  }
  function rect(parent, x, y, w, h, fill, o) {
    o = o || {};
    return sv("rect", { x: x, y: y, width: Math.max(0, w), height: h, rx: o.rx == null ? 3 : o.rx, fill: fill, stroke: o.stroke || null, "stroke-width": o.stroke ? (o.sw || 1) : null, "stroke-dasharray": o.dash || null }, parent);
  }
  /** 带下标的标签（SVG 里用 tspan，避免依赖字体里的下标字符） */
  function subLbl(parent, x, y, base, sub) {
    tx(parent, x + 1, y, base, { anchor: "end", size: 13, fill: C.co, bold: true });
    return tx(parent, x + 1, y + 4, sub, { size: 13, fill: C.co });
  }
  function line(parent, x1, y1, x2, y2, color, o) {
    o = o || {};
    return sv("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: color || C.gray, "stroke-width": o.w || 1, "stroke-dasharray": o.dash || null }, parent);
  }

  /** 每个验证动画共用的骨架：控件区、错误提示、图形区、读数区；destroy 解绑全部监听并清除计时器 */
  function kit(box, label) {
    var offs = [], timers = [];
    var root = el("div", { class: "x-pc", role: "group", "aria-label": label || "动手验证" });
    var ctrl = el("div", { class: "x-pc__ctrl" });
    var err = el("p", { class: "x-pc__err", role: "alert" });
    var stage = el("div", { class: "x-pc__stage" });
    var out = el("div", { class: "x-pc__out", "aria-live": "polite" });
    root.appendChild(ctrl); root.appendChild(err); root.appendChild(stage); root.appendChild(out);
    box.appendChild(root);
    var row = null;
    function on(t, ev, fn) { t.addEventListener(ev, fn); offs.push([t, ev, fn]); }
    function cur() { if (!row) { row = el("div", { class: "x-pc__row" }); ctrl.appendChild(row); } return row; }
    function wrap(label, input, cls) {
      var w = el("label", { class: "x-pc__lbl" + (cls ? " " + cls : "") });
      w.appendChild(el("span", null, label));
      w.appendChild(input);
      cur().appendChild(w);
      return w;
    }
    var K = {
      root: root, ctrl: ctrl, stage: stage, out: out, on: on,
      row: function () { row = el("div", { class: "x-pc__row" }); ctrl.appendChild(row); return row; },
      num: function (label, value, change, o) {
        o = o || {};
        var i = el("input", { type: "text", class: "x-pc__num" + (o.wide ? " x-pc__num--wide" : ""), value: String(value), inputmode: o.text ? "text" : "decimal", spellcheck: "false", autocomplete: "off" });
        wrap(label, i);
        on(i, "input", change); on(i, "change", change);
        return i;
      },
      range: function (label, min, max, step, value, change, show) {
        var i = el("input", { type: "range", class: "x-pc__range", min: min, max: max, step: step, value: value });
        var v = el("output", { class: "x-pc__val" });
        var w = wrap(label, i);
        w.appendChild(v);
        var upd = function () { v.textContent = show ? show(+i.value) : i.value; };
        upd();
        on(i, "input", function () { upd(); change(); });
        i._upd = upd;
        return i;
      },
      seg: function (label, opts, value, pick) {
        var g = el("div", { class: "x-pc__seg", role: "group", "aria-label": label });
        if (label) g.appendChild(el("span", { class: "x-pc__seglbl" }, label));
        var btns = [], val = value;
        opts.forEach(function (o) {
          var b = el("button", { type: "button", class: "x-lab__btn", "aria-pressed": String(o.v === value) }, o.t);
          b._v = o.v;
          on(b, "click", function () { set(o.v); pick(o.v); });
          btns.push(b); g.appendChild(b);
        });
        function set(v) { val = v; btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b._v === v)); }); }
        cur().appendChild(g);
        return { set: set, get: function () { return val; }, el: g };
      },
      btn: function (text, fn, main) {
        var b = el("button", { type: "button", class: "x-lab__btn" + (main ? " x-lab__btn--main" : "") }, text);
        on(b, "click", fn);
        cur().appendChild(b);
        return b;
      },
      setErr: function (m) { err.textContent = m || ""; root.className = "x-pc" + (m ? " is-err" : ""); },
      svg: function (w, h, aria) {
        while (stage.firstChild) stage.removeChild(stage.firstChild);
        return sv("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": aria || "示意图", class: "x-pc__svg" }, stage);
      },
      clearStage: function () { while (stage.firstChild) stage.removeChild(stage.firstChild); },
      /** rows: [{ k, v, ok, hl }]，ok 为 true/false 时显示 ✓ / ✗ */
      show: function (rows, note) {
        while (out.firstChild) out.removeChild(out.firstChild);
        var dl = el("dl", { class: "x-pc__kv" });
        rows.forEach(function (r) {
          if (!r) return;
          var d = el("div", { class: "x-pc__item" + (r.hl ? " is-hl" : "") + (r.ok === true ? " is-ok" : r.ok === false ? " is-bad" : "") });
          d.appendChild(el("dt", null, r.k));
          var dd = el("dd", null, r.v);
          if (r.ok === true || r.ok === false) dd.appendChild(el("span", { class: "x-pc__mark", "aria-label": r.ok ? "成立" : "不成立" }, r.ok ? " ✓" : " ✗"));
          d.appendChild(dd);
          dl.appendChild(d);
        });
        out.appendChild(dl);
        if (note) out.appendChild(el("p", { class: "x-pc__note" + (note.ok === false ? " is-bad" : note.ok === true ? " is-ok" : "") }, note.t));
        return dl;
      },
      table: function (head, rows, hl) {
        var t = el("table", { class: "x-pc__tbl" }), tr = el("tr");
        head.forEach(function (h) { tr.appendChild(el("th", { scope: "col" }, h)); });
        var th = el("thead"); th.appendChild(tr); t.appendChild(th);
        var tb = el("tbody");
        rows.forEach(function (r, i) {
          var x = el("tr", { class: hl === i ? "is-hl" : null });
          r.forEach(function (c) { x.appendChild(el("td", null, c)); });
          tb.appendChild(x);
        });
        t.appendChild(tb);
        var w = el("div", { class: "x-pc__tblwrap", tabindex: "0" });
        w.appendChild(t);
        out.appendChild(w);
        return t;
      },
      later: function (fn, ms) { var id = setTimeout(fn, ms); timers.push(["t", id]); return id; },
      every: function (fn, ms) { var id = setInterval(fn, ms); timers.push(["i", id]); return id; },
      stop: function () { timers.forEach(function (t) { if (t[0] === "t") clearTimeout(t[1]); else clearInterval(t[1]); }); timers = []; },
      destroy: function () {
        K.stop();
        offs.forEach(function (o) { o[0].removeEventListener(o[1], o[2]); });
        offs = [];
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
    return K;
  }
  /** 读取并校验数值输入：失败时抛出中文提示 */
  function need(input, name, o) {
    o = o || {};
    var v = readNum(input.value);
    if (isNaN(v)) throw name + "：请输入数字";
    if (o.int && !isInt(v)) throw name + "：请输入整数";
    if (o.min != null && v < o.min) throw name + "不能小于 " + o.min;
    if (o.max != null && v > o.max) throw name + "不能大于 " + o.max;
    if (o.pos && !(v > 0)) throw name + "必须大于 0";
    return v;
  }
  /** 统一的刷新包装：异常显示为中文错误并清空图形 */
  function guard(K, fn) {
    return function () {
      try { K.setErr(""); fn(); }
      catch (e) {
        if (typeof e !== "string") throw e;
        K.setErr(e);
        K.clearStage();
        K.show([]);
      }
    };
  }

  /* ======================= 14 条性质 ======================= */
  var CH = {
    c1: "第 1 章 计算机系统概述", c2: "第 2 章 数据的表示和运算", c3: "第 3 章 存储器层次结构", c4: "第 4 章 指令系统",
    c5: "第 5 章 中央处理器（CPU）", c6: "第 6 章 总线和输入/输出系统", c7: "第 6 章 总线和输入/输出系统"
  };

  /* ---------- 1 定点数的表示范围 ---------- */
  PROP.push({
    id: "co-fixed-range", sub: "co", ch: CH.c2, name: "定点数的表示范围",
    def: "机器数用 n 位二进制表示，最高位是符号位（0 正 1 负），其余 n − 1 位是数值位。原码数值位存 |x|；反码对负数的数值位逐位取反；补码在反码基础上末位加 1，即 [x]补 = 2ⁿ + x（mod 2ⁿ）。",
    stmt: [
      "n 位补码整数：**−2ⁿ⁻¹ ~ 2ⁿ⁻¹ − 1**，共 2ⁿ 个数",
      "n 位原码、反码整数：**−(2ⁿ⁻¹ − 1) ~ 2ⁿ⁻¹ − 1**，0 有 +0、−0 两种编码",
      "补码 0 唯一，多出的编码 10…0 表示最小负数 −2ⁿ⁻¹（8 位补码 −128 ~ 127）"
    ],
    cond: "n 包含符号位。以上是定点整数；定点小数的补码范围是 −1 ~ 1 − 2⁻⁽ⁿ⁻¹⁾，原码、反码是 −(1 − 2⁻⁽ⁿ⁻¹⁾) ~ 1 − 2⁻⁽ⁿ⁻¹⁾。无符号整数没有符号位，范围 0 ~ 2ⁿ − 1。移码与补码范围相同，只是符号位相反。",
    proof: [
      "n 位二进制共有 2ⁿ 种编码，最高位为 0 的一半表示非负数，最高位为 1 的一半表示负数。",
      "非负数三种编码相同：符号位 0，数值位 n − 1 位，最大是 0 11…1 = 2ⁿ⁻¹ − 1。",
      "原码负数的数值位存 |x|，|x| 最大 2ⁿ⁻¹ − 1，所以最小为 −(2ⁿ⁻¹ − 1)；1 00…0 表示 −0。反码同理，1 11…1 是 −0。",
      "因此原码、反码中 0 占了两个编码，只能表示 2ⁿ − 1 个不同的数。",
      "补码 [x]补 = 2ⁿ + x：−1 是 11…1，+0 与 −0 都是 00…0（2ⁿ 的进位被舍去），0 只有一种编码。",
      "空出的 1 00…0 按 2ⁿ + x = 2ⁿ⁻¹ 解得 x = −2ⁿ⁻¹，所以补码范围是 −2ⁿ⁻¹ ~ 2ⁿ⁻¹ − 1，恰好 2ⁿ 个数。"
    ],
    traps: [
      "先看 n 是否包含符号位：8 位补码是 −128 ~ 127；若说“数值位 8 位”，机器数其实是 9 位。",
      "补码 10…0 是 −2ⁿ⁻¹ 而不是 −0；它没有对应的正数，对它求相反数会溢出。",
      "定点小数补码能表示 −1 却不能表示 +1；原码小数两端都取不到 ±1。"
    ],
    ex: {
      q: "某计算机用 8 位补码表示带符号整数。下列数值中，不能用一个 8 位补码直接表示的是（ ）。",
      opts: ["−128", "127", "128", "−1"], a: 2,
      why: "8 位补码范围是 −2⁷ ~ 2⁷ − 1，即 −128 ~ 127：−128 = 1000 0000，127 = 0111 1111，−1 = 1111 1111，128 超出上界。若误用原码范围 −127 ~ 127，会以为 −128 也不能表示。",
      src: "典型题"
    },
    links: { lab: ["booth"], proc: ["adder"] },
    demo: function (box) {
      var K = kit(box, "定点数表示范围验证");
      var mode = "int";
      var nIn = K.range("位数 n（含符号位）", 2, 16, 1, 8, function () { draw(); });
      var seg = K.seg("类型", [{ v: "int", t: "整数" }, { v: "frac", t: "小数" }], "int", function (v) { mode = v; xIn.disabled = v === "frac"; draw(); });
      K.row();
      var xIn = K.num("看看 x 的编码（整数）", -5, function () { draw(); });
      var draw = guard(K, function () {
        var n = +nIn.value, frac = mode === "frac";
        var R = { sign: fixedRange(n, "sign", frac), ones: fixedRange(n, "ones", frac), twos: fixedRange(n, "twos", frac) };
        var lo = R.twos.min, hi = frac ? 1 : R.twos.max + 1;
        var X0 = 90, X1 = 680, map = function (v) { return X0 + (v - lo) / (hi - lo) * (X1 - X0); };
        var x = NaN;
        if (!frac) {
          x = readNum(xIn.value);
          if (xIn.value.trim() !== "" && (isNaN(x) || !isInt(x))) throw "x：请输入整数";
        }
        var svg = K.svg(720, 250, n + " 位" + (frac ? "定点小数" : "整数") + "三种编码的表示范围");
        var rowsDef = [["sign", "原码", C.blue], ["ones", "反码", C.gold], ["twos", "补码", C.co]];
        rowsDef.forEach(function (d, i) {
          var r = R[d[0]], y = 40 + i * 62;
          tx(svg, 14, y + 18, d[1], { bold: true, size: 14 });
          rect(svg, X0, y + 4, X1 - X0, 20, C.faint, { rx: 4 });
          rect(svg, map(r.min), y + 4, map(r.max) - map(r.min), 20, d[2], { rx: 4 });
          if (d[0] === "twos") rect(svg, map(r.min), y + 4, Math.max(4, map(R.sign.min) - map(r.min)), 20, C.ink, { rx: 2 });
          tx(svg, map(r.min), y + 44, fmt(r.min, 6), { mono: true, fill: d[2] });
          tx(svg, map(r.max), y + 44, fmt(r.max, 6), { mono: true, anchor: "end", fill: d[2] });
          tx(svg, map(0), y + 44, r.zeros === 2 ? "±0" : "0", { mono: true, anchor: "middle", fill: C.gray });
          line(svg, map(0), y, map(0), y + 28, C.paper, { w: 2 });
        });
        line(svg, X0, 228, X1, 228, C.gray);
        [lo, 0, hi].forEach(function (v) { line(svg, map(v), 222, map(v), 234, C.gray); tx(svg, map(v), 248, fmt(v, 6), { anchor: "middle", mono: true, size: 13, fill: C.gray }); });
        if (!frac && !isNaN(x) && x >= lo - 0.5 && x < hi) {
          line(svg, map(x), 30, map(x), 230, C.ink, { w: 1.5, dash: "4 3" });
          tx(svg, map(x) + 4, 24, "x = " + minus(x), { mono: true, size: 13, anchor: map(x) > 600 ? "end" : "start" });
        }
        var rows = rowsDef.map(function (d) {
          var r = R[d[0]];
          return { k: d[1] + "范围", v: fmt(r.min, 8) + " ~ " + fmt(r.max, 8) + "，共 " + r.count + " 个数，0 有 " + r.zeros + " 种编码" };
        });
        var cnt = frac ? Math.round((R.twos.max - R.twos.min) / R.twos.ulp) + 1 : R.twos.max - R.twos.min + 1;
        rows.push({ k: "补码个数核对", v: "(" + fmt(R.twos.max, 8) + ") − (" + fmt(R.twos.min, 8) + ")" + (frac ? " 除以 2⁻⁽ⁿ⁻¹⁾" : "") + " + 1 = " + cnt + "，2" + sup(n) + " = " + pow2(n), ok: cnt === pow2(n), hl: true });
        if (!frac && !isNaN(x)) {
          var enc = ["sign", "ones", "twos"].map(function (c) { var b = encode(x, n, c); return CODE_NAME[c] + " " + (b ? group4(b) : "不可表示"); });
          rows.push({ k: "x = " + minus(x) + " 的编码", v: enc.join("；") });
        }
        K.show(rows, { t: "黑色小段就是补码比原码多出的那个数：" + fmt(R.twos.min, 8) + "（编码 1" + bits(0, n - 1) + "）。" });
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 2 溢出判断 ---------- */
  PROP.push({
    id: "co-overflow", sub: "co", ch: CH.c2, name: "补码加减运算的溢出判断",
    def: "溢出指运算结果超出了机器数的表示范围。补码减法统一变成加法：x − y 按 [x]补 + [−y]补 计算，硬件上把 [y]补 逐位取反、最低位进位 1。",
    stmt: [
      "**符号法**：同号相加（或异号相减），结果符号与被加数（被减数）相反 → 溢出",
      "**双符号位**：结果符号位 Sf₁Sf₂ = 01 正溢出，10 负溢出，00、11 无溢出",
      "**进位法**：V = Cₙ ⊕ Cₙ₋₁（最高位进位异或次高位进位），V = 1 表示溢出"
    ],
    cond: "适用于带符号补码定点数的加减法。无符号数加减看进位/借位标志 CF，不看溢出标志 OF；乘法溢出要看乘积高半部分是否全是符号扩展。双符号位（变形补码）只在运算器内部使用，存储时仍是单符号位。",
    proof: [
      "两个异号数相加，结果的绝对值不超过其中较大者，一定不会溢出；所以只有同号相加（等价于异号相减）才可能溢出。",
      "正 + 正 溢出时真实结果 ≥ 2ⁿ⁻¹，进到了符号位，结果符号变成 1；负 + 负 溢出时真实结果 < −2ⁿ⁻¹，符号位变成 0：这就是符号法。",
      "双符号位相当于用 n + 1 位运算，真实结果一定放得下：Sf₁ 是真实符号，Sf₂ 是 n 位结果的符号，两者不同（01 或 10）就是溢出，Sf₁ 指明方向。",
      "正 + 正 溢出时数值位向符号位有进位（Cₙ₋₁ = 1）而符号位不向外进位（Cₙ = 0）；负 + 负 溢出时 Cₙ₋₁ = 0、Cₙ = 1。",
      "不溢出时这两个进位要么都为 0、要么都为 1，所以 V = Cₙ ⊕ Cₙ₋₁ 恰好在溢出时为 1。"
    ],
    traps: [
      "“最高位有进位就溢出”是错的：(−1) + (−1) 的 Cₙ = 1 却没有溢出，要看 Cₙ 与 Cₙ₋₁ 是否不同。",
      "减法用符号法时比较的是 x 与 y 的符号：正 − 负 得负、负 − 正 得正才是溢出。",
      "双符号位 01 是**正**溢出（真实结果太大），10 是负溢出，别记反。"
    ],
    ex: {
      q: "8 位补码运算器中，x = 0111 0000B，y = 0010 0000B。计算 x + y 后，下列说法正确的是（ ）。",
      opts: ["结果为 1001 0000，Cₙ = 1，无溢出", "结果为 1001 0000，Cₙ ⊕ Cₙ₋₁ = 1，发生正溢出", "结果为 1001 0000，表示 −112，无溢出", "用双符号位计算得 11 1001 0000，无溢出"], a: 1,
      why: "x = 112，y = 32，真实和 144 > 127。数值位向符号位进位 Cₙ₋₁ = 1，符号位不向外进位 Cₙ = 0，V = 1；双符号位得 01 1001 0000，Sf₁Sf₂ = 01，是正溢出。1001 0000 按补码读是 −112，正是溢出后的错误结果。",
      src: "典型题"
    },
    links: { lab: ["booth"], proc: ["adder"] },
    demo: function (box) {
      var K = kit(box, "溢出判断三种方法对比");
      var op = "+";
      var xIn = K.num("x", 112, function () { draw(); });
      var opSeg = K.seg("运算", [{ v: "+", t: "x + y" }, { v: "-", t: "x − y" }], "+", function (v) { op = v; draw(); });
      var yIn = K.num("y", 32, function () { draw(); });
      K.row();
      var nIn = K.range("位数 n", 4, 12, 1, 8, function () { draw(); });
      K.row();
      function preset(x, o, y, n) { xIn.value = x; yIn.value = y; op = o; opSeg.set(o); nIn.value = n; nIn._upd(); draw(); }
      K.btn("正溢出 112 + 32", function () { preset(112, "+", 32, 8); });
      K.btn("负溢出 −100 + (−50)", function () { preset(-100, "+", -50, 8); });
      K.btn("不溢出 −1 + (−1)", function () { preset(-1, "+", -1, 8); });
      K.btn("减法溢出 100 − (−50)", function () { preset(100, "-", -50, 8); });
      var draw = guard(K, function () {
        var n = +nIn.value;
        var x = need(xIn, "x", { int: true }), y = need(yIn, "y", { int: true });
        var r = overflow(x, y, n, op);
        if (r.err) throw r.err;
        var cw = Math.min(34, 470 / (n + 2)), X0 = 700 - (n + 1) * cw;
        var svg = K.svg(720, 330, "补码加减法竖式与双符号位竖式");
        var col = function (i, total) { return X0 + (n + 1 - total + i) * cw + cw / 2; };
        function rowBits(y, s, label, color, hiIdx) {
          tx(svg, 14, y, label, { size: 13, fill: C.gray });
          for (var i = 0; i < s.length; i++) {
            var cx = col(i, s.length);
            if (hiIdx && hiIdx.indexOf(i) >= 0) rect(svg, cx - cw / 2 + 2, y - 17, cw - 4, 23, C.soft);
            tx(svg, cx, y, s.charAt(i), { mono: true, anchor: "middle", size: 16, fill: color || C.ink, bold: true });
          }
        }
        tx(svg, 14, 20, "单符号位（" + n + " 位补码）", { bold: true });
        /* 进位行：第 b 位（0 为最低位）画在第 n − b 列，进入第 b 位的进位 c_b 写在它上方；Cₙ 写在最左列 */
        var cy = 44;
        tx(svg, 14, cy, "进位", { size: 13, fill: C.gray });
        for (var b = 0; b <= n; b++) {
          var isKey = b === n || b === n - 1;
          tx(svg, X0 + (n - b) * cw + cw / 2, cy, String(r.carries[b]), { mono: true, anchor: "middle", size: 13, fill: isKey ? C.co : C.gray, bold: isKey });
        }
        subLbl(svg, col(0, n + 1), cy - 16, "C", "n");
        subLbl(svg, col(1, n + 1), cy - 16, "C", "n−1");
        rowBits(74, r.A, "[x]补", null, [0]);
        rowBits(102, op === "+" ? r.B : r.Bp, op === "+" ? "[y]补" : "[y]补取反（末位 +1）", null, [0]);
        line(svg, X0 - 6, 112, 704, 112, C.ink);
        rowBits(136, r.S, "结果", r.of ? C.bad : C.ok, [0]);
        tx(svg, 14, 186, "双符号位（变形补码，" + (n + 1) + " 位）", { bold: true });
        rowBits(216, r.A2, "[x]补", null, [0, 1]);
        rowBits(244, r.Bp2, op === "+" ? "[y]补" : "[y]补取反（末位 +1）", null, [0, 1]);
        line(svg, X0 - 6, 254, 704, 254, C.ink);
        rowBits(278, r.S2, "结果", r.of ? C.bad : C.ok, [0, 1]);
        tx(svg, 14, 314, "双符号位 = " + r.top + (r.top === "01" ? "：正溢出" : r.top === "10" ? "：负溢出" : "：无溢出"), { bold: true, fill: r.m2 ? C.bad : C.ok });
        var sx = r.A.charAt(0), sy = r.B.charAt(0), sr = r.S.charAt(0);
        K.show([
          { k: "真实结果", v: "x " + (op === "+" ? "+" : "−") + " y = " + minus(r.truth) + "，表示范围 " + minus(r.min) + " ~ " + r.max + (r.of ? "，" + r.kind : "，在范围内"), hl: true },
          { k: "机器结果", v: group4(r.S) + " = " + minus(r.value) },
          { k: "① 符号法", v: (op === "+" ? "x、y 符号 " + sx + "、" + sy + (sx === sy ? "（同号）" : "（异号）") : "x、y 符号 " + sx + "、" + sy + (sx !== sy ? "（异号相减）" : "（同号相减）")) + "，结果符号 " + sr + " → " + (r.m1 ? "溢出" : "无溢出"), ok: r.m1 === r.of },
          { k: "② 双符号位", v: "Sf₁Sf₂ = " + r.top + " → " + (r.m2 ? (r.top === "01" ? "正溢出" : "负溢出") : "无溢出"), ok: r.m2 === r.of },
          { k: "③ 进位法", v: "Cₙ = " + r.Cn + "，Cₙ₋₁ = " + r.Cn1 + "，Cₙ ⊕ Cₙ₋₁ = " + (r.Cn ^ r.Cn1) + " → " + (r.m3 ? "溢出" : "无溢出"), ok: r.m3 === r.of }
        ], { t: r.agree ? "三种方法结论一致，且与真实结果是否越界相符。" : "三种方法结论不一致（不应出现）。", ok: r.agree });
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 3 IEEE 754 单精度 ---------- */
  PROP.push({
    id: "co-ieee754", sub: "co", ch: CH.c2, name: "IEEE 754 单精度浮点数",
    def: "IEEE 754 单精度共 32 位：符号 S 1 位、阶码 E 8 位（移码，偏置值 127）、尾数 M 23 位；规格化数的尾数隐含最高位 1，不存储。",
    stmt: [
      "规格化数：**值 = (−1)ˢ × 1.M × 2ᴱ⁻¹²⁷**，1 ≤ E ≤ 254",
      "E 全 0：M = 0 表示 ±0，M ≠ 0 为非规格化数 (−1)ˢ × 0.M × 2⁻¹²⁶；E 全 1：M = 0 为 ±∞，M ≠ 0 为 NaN",
      "最大正数 (2 − 2⁻²³) × 2¹²⁷ ≈ 3.4 × 10³⁸（7F7F FFFFH）；最小规格化正数 2⁻¹²⁶（0080 0000H）；最小非规格化正数 2⁻¹⁴⁹"
    ],
    cond: "双精度为 1 + 11 + 52 位，偏置 1023，规格化范围 2⁻¹⁰²² ~ (2 − 2⁻⁵²) × 2¹⁰²³。偏置取 127 而不是 128，是因为 E 全 0、全 1 留作特殊值，真值指数范围为 −126 ~ +127。非规格化数的指数固定为 1 − 127 = −126，不是 −127。",
    proof: [
      "8 位阶码 E 取值 0 ~ 255，全 0 和全 1 留作特殊用途，规格化数只用 1 ~ 254。",
      "真值指数 e = E − 127，所以 e 的范围是 −126 ~ +127。",
      "规格化尾数 1.M 的范围是 1 ~ 2 − 2⁻²³（M 全 1）。",
      "最大正数取 E = 254、M 全 1：(2 − 2⁻²³) × 2¹²⁷ ≈ 3.4 × 10³⁸，编码 0 11111110 11…1 = 7F7F FFFFH。",
      "最小规格化正数取 E = 1、M = 0：1.0 × 2⁻¹²⁶，编码 0080 0000H。",
      "E = 0 时隐含位变成 0、指数固定为 −126，最小非规格化正数是 0.00…01 × 2⁻¹²⁶ = 2⁻¹⁴⁹，它们填补了 0 与 2⁻¹²⁶ 之间的空隙。"
    ],
    traps: [
      "尾数 23 位不含隐含的 1，写机器数时不要把“1.”写进尾数。",
      "偏置值是 127：阶码 = 指数 + 127，不是 + 128（+128 是一般移码的写法）。",
      "E 全 1、M = 0 是 ∞ 而不是最大数；最大正数的阶码是 1111 1110。"
    ],
    ex: {
      q: "float 型数据通常用 IEEE 754 单精度浮点数格式表示。若编译器将 float 型变量 x 分配在一个 32 位浮点寄存器 FR1 中，且 x = −8.25，则 FR1 的内容是（ ）。",
      opts: ["C104 0000H", "C242 0000H", "C184 0000H", "C1C2 0000H"], a: 0,
      why: "−8.25 = −1000.01B = −1.00001 × 2³。S = 1，E = 3 + 127 = 130 = 1000 0010，M = 0000 1000…0（隐含的 1 不存）。拼起来是 1 10000010 00001000…0 = C104 0000H。偏置误用 128 会得到 C184 0000H，再把隐含位写进尾数会得到 C1C2 0000H。",
      src: "2011 年真题"
    },
    links: { lab: ["ieee754"], proc: [] },
    demo: function (box) {
      var K = kit(box, "IEEE 754 极值与数轴");
      var fmtSeg = K.seg("格式", [{ v: "s", t: "单精度" }, { v: "d", t: "双精度" }, { v: "c", t: "自定义" }], "s", function (v) {
        if (v === "s") { eIn.value = 8; mIn.value = 23; }
        if (v === "d") { eIn.value = 11; mIn.value = 52; }
        eIn._upd(); mIn._upd(); draw();
      });
      K.row();
      var eIn = K.range("阶码位数", 2, 11, 1, 8, function () { sync(); draw(); });
      var mIn = K.range("尾数位数", 1, 52, 1, 23, function () { sync(); draw(); });
      K.row();
      var xIn = K.num("判断一个数 x", "-8.25", function () { draw(); });
      function sync() {
        var e = +eIn.value, m = +mIn.value;
        fmtSeg.set(e === 8 && m === 23 ? "s" : e === 11 && m === 52 ? "d" : "c");
      }
      function lg(v) { return Math.log(v) / Math.LN2; }
      function p2(k) { return "2" + sup(k); }
      function hexOf(p) {
        var s = p.join("");
        if (s.length % 4) return "—";
        var h = "";
        for (var i = 0; i < s.length; i += 4) h += parseInt(s.substr(i, 4), 2).toString(16).toUpperCase();
        return h.length > 8 ? h.replace(/(.{4})/g, "$1 ").trim() : h.replace(/(.{4})(.{4})/, "$1 $2");
      }
      function shortBits(s) { return s.length > 14 ? s.slice(0, 5) + "…" + s.slice(-5) : s; }
      var draw = guard(K, function () {
        var e = +eIn.value, m = +mIn.value, L = floatLimits(e, m);
        if (L.err) throw L.err;
        var x = readNum(xIn.value);
        if (xIn.value.trim() !== "" && isNaN(x)) throw "x：请输入十进制数，例如 −8.25 或 1e-40";
        var cls = isNaN(x) ? null : floatClass(x, e, m);
        var a = lg(L.minDen) - 6, b = lg(L.maxNorm) + 6, X0 = 30, X1 = 690;
        var map = function (v) { return X0 + (lg(v) - a) / (b - a) * (X1 - X0); };
        var svg = K.svg(720, 200, "正浮点数在对数坐标上的分区");
        tx(svg, 14, 20, "正数轴（以 2 为底的对数坐标），负数与之对称", { size: 13, fill: C.gray });
        var y = 74;
        rect(svg, X0, y, map(L.minDen) - X0, 26, C.faint, { rx: 0 });
        rect(svg, map(L.minDen), y, map(L.minNorm) - map(L.minDen), 26, C.goldSoft, { rx: 0 });
        rect(svg, map(L.minNorm), y, map(L.maxNorm) - map(L.minNorm), 26, C.soft, { rx: 0 });
        rect(svg, map(L.maxNorm), y, X1 - map(L.maxNorm), 26, C.badSoft, { rx: 0 });
        tx(svg, (X0 + map(L.minDen)) / 2, y + 18, "→0", { anchor: "middle", size: 13, fill: C.gray });
        tx(svg, (map(L.minDen) + map(L.minNorm)) / 2, y - 8, "非规格化", { anchor: "middle", size: 13, fill: C.gold });
        tx(svg, (map(L.minNorm) + map(L.maxNorm)) / 2, y + 18, "规格化数", { anchor: "middle", size: 14, bold: true, fill: C.co });
        tx(svg, (map(L.maxNorm) + X1) / 2, y + 18, "∞", { anchor: "middle", size: 14, fill: C.bad });
        [[L.minDen, p2(L.emin - m), "最小非规格化", 1], [L.minNorm, p2(L.emin), "最小规格化", 2], [1, "1", "", 1], [L.maxNorm, "≈ " + sci(L.maxNorm, 2), "最大正数", 2]].forEach(function (t, i) {
          var xx = map(t[0]), yy = t[3] === 1 ? 128 : 172;
          line(svg, xx, y - 2, xx, yy - 14, C.ink, { dash: i === 2 ? "3 3" : null });
          var anc = xx < 120 ? "start" : xx > 600 ? "end" : "middle";
          tx(svg, xx, yy, t[1], { anchor: anc, mono: true, size: 13 });
          if (t[2]) tx(svg, xx, yy + 17, t[2], { anchor: anc, size: 13, fill: C.gray });
        });
        if (cls && !cls.err && x !== 0 && isFinite(x)) {
          var ax = Math.abs(x), xx = Math.max(X0, Math.min(X1, map(ax)));
          sv("path", { d: "M" + xx + " " + (y - 4) + " l-6 -12 h12 z", fill: C.ink }, svg);
          tx(svg, xx, y - 22, "|x|", { anchor: "middle", size: 13, bold: true });
        }
        var rows = [
          { k: "偏置值", v: "2" + sup(e - 1) + " − 1 = " + L.bias + "；真值指数 " + minus(L.emin) + " ~ " + L.emax },
          { k: "最大正数", v: "(2 − 2" + sup(-m) + ") × 2" + sup(L.emax) + " ≈ " + sci(L.maxNorm, 4) },
          { k: "最小规格化正数", v: p2(L.emin) + " ≈ " + sci(L.minNorm, 4) },
          { k: "最小非规格化正数", v: p2(L.emin - m) + " ≈ " + sci(L.minDen, 4) },
          { k: "空隙核对", v: "最大非规格化数 (1 − 2" + sup(-m) + ") × " + p2(L.emin) + " 紧挨着最小规格化数", ok: L.maxDen < L.minNorm && L.minNorm - L.maxDen === L.minDen }
        ];
        if (cls && !cls.err) rows.push({ k: "x = " + minus(xIn.value.trim()), v: cls.text + (e === 8 && m === 23 && isFinite(x) ? "；单精度机器数 " + hexOf([bits(parseInt(f32Hex(x), 16), 32)]) + "H" : ""), hl: true });
        K.show(rows);
        var P = L.pat;
        K.table(["名称", "S", "E", "M", "十六进制"], [
          ["最大正数", P.maxNorm[0], shortBits(P.maxNorm[1]), shortBits(P.maxNorm[2]), hexOf(P.maxNorm)],
          ["最小规格化", P.minNorm[0], shortBits(P.minNorm[1]), shortBits(P.minNorm[2]), hexOf(P.minNorm)],
          ["最大非规格化", P.maxDen[0], shortBits(P.maxDen[1]), shortBits(P.maxDen[2]), hexOf(P.maxDen)],
          ["最小非规格化", P.minDen[0], shortBits(P.minDen[1]), shortBits(P.minDen[2]), hexOf(P.minDen)],
          ["+∞", P.inf[0], shortBits(P.inf[1]), shortBits(P.inf[2]), hexOf(P.inf)],
          ["NaN（之一）", P.nan[0], shortBits(P.nan[1]), shortBits(P.nan[2]), hexOf(P.nan)]
        ]);
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 4 海明码校验位数 ---------- */
  PROP.push({
    id: "co-hamming", sub: "co", ch: CH.c2, name: "海明码的校验位数",
    def: "海明码在 n 位数据中插入 k 个校验位，校验位放在第 1、2、4、8…（2 的幂）号位置；每个校验位负责位置编号的二进制中对应位为 1 的那些位。接收端算出的 k 位指误字直接给出出错位的编号。",
    stmt: [
      "**2ᵏ ≥ n + k + 1**，取满足条件的最小 k",
      "能发现并纠正 1 位错；要“检测 2 位错、纠正 1 位错”再加 1 个总校验位，共 k + 1 位",
      "n = 8 → k = 4（码长 12）；k 个校验位最多保护 2ᵏ − k − 1 位数据"
    ],
    cond: "针对纠正 1 位错的标准海明码，且最多 1 位出错。加总校验位后能区分 1 位错（可纠正）和 2 位错（只能检测）。也有资料写成 2ᵏ⁻¹ ≥ n + k（此处 k 已含总校验位），与“先按 2ᵏ ≥ n + k + 1 求 k，再加 1 位总校验位”是同一个结论。",
    proof: [
      "接收端的 k 位指误字共有 2ᵏ 种取值。",
      "需要区分的情况有：没有错误（1 种），以及 n + k 位中任意一位出错（n + k 种）。",
      "每种情况必须对应不同的指误字，所以 2ᵏ ≥ n + k + 1。",
      "n = 8：k = 3 时 2³ = 8 < 12，不够；k = 4 时 16 ≥ 13，满足，所以 k = 4，码长 12。",
      "若还要发现 2 位错，再加 1 位对全部位做偶校验：总校验正确而指误字不为 0，说明出现了 2 位错。"
    ],
    traps: [
      "右边是 n + k + 1，忘了 +1（“无错”这一种状态）会让 n = 4 时误算出 k = 2。",
      "k 本身也计入总位数：校验位自己也可能出错。",
      "“检 2 纠 1”要再加 1 位总校验位，n = 8 时共 5 位校验位。"
    ],
    ex: {
      q: "对 16 位数据采用能纠正 1 位错的海明码编码，最少需要的校验位位数是（ ）。",
      opts: ["4", "5", "6", "3"], a: 1,
      why: "k = 4 时 2⁴ = 16 < 16 + 4 + 1 = 21，不满足；k = 5 时 2⁵ = 32 ≥ 22，满足，所以最少 5 位。只看 2ᵏ ≥ n 会误选 4。",
      src: "典型题"
    },
    links: { lab: ["hamming"], proc: [] },
    demo: function (box) {
      var K = kit(box, "海明码最少校验位");
      var secded = false, focus = 1;
      var nIn = K.range("数据位数 n", 1, 64, 1, 8, function () { draw(); });
      K.seg("要求", [{ v: false, t: "纠 1 位错" }, { v: true, t: "检 2 纠 1（加总校验位）" }], false, function (v) { secded = v; draw(); });
      var draw = guard(K, function () {
        var n = +nIn.value, H = hammingK(n, secded);
        if (H.err) throw H.err;
        var k = H.base, N = n + k;
        if (focus >= N || (focus & (focus - 1)) !== 0) focus = 1;
        var show = Math.min(N, 40), perRow = 20, cw = 32;
        var rowsN = Math.ceil(show / perRow) + (secded ? 0 : 0);
        var svg = K.svg(720, 60 + rowsN * 70 + (secded ? 40 : 0), "海明码各位的排列，点校验位查看它负责的位");
        tx(svg, 14, 22, "码字排列（点任一校验位 P，看它负责哪些位）", { size: 13, fill: C.gray });
        var di = 0;
        for (var p = 1; p <= show; p++) {
          var isP = (p & (p - 1)) === 0, rr = Math.floor((p - 1) / perRow), cc = (p - 1) % perRow;
          var x = 30 + cc * cw, y = 40 + rr * 70;
          var covered = (p & focus) !== 0;
          var r = rect(svg, x, y, cw - 4, 30, isP ? (p === focus ? C.co : C.soft) : covered ? C.goldSoft : C.faint, { stroke: covered ? C.gold : null });
          if (!isP) di++;
          var t = tx(svg, x + (cw - 4) / 2, y + 20, isP ? "P" + (Math.log(p) / Math.LN2 + 1) : "D" + di, { anchor: "middle", size: 13, mono: true, bold: isP, fill: p === focus ? C.paper : C.ink });
          tx(svg, x + (cw - 4) / 2, y + 48, String(p), { anchor: "middle", size: 13, fill: C.gray, mono: true });
          if (isP) {
            (function (pp, rr2, tt) {
              rr2.setAttribute("style", "cursor:pointer");
              tt.setAttribute("style", "cursor:pointer");
              rr2.setAttribute("tabindex", "0");
              var pick = function () { focus = pp; draw(); };
              K.on(rr2, "click", pick); K.on(tt, "click", pick);
              K.on(rr2, "keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } });
            })(p, r, t);
          }
        }
        if (N > show) tx(svg, 30 + perRow * cw - 4, 40 + (rowsN - 1) * 70 + 20, "… 共 " + N + " 位", { anchor: "end", size: 13, fill: C.gray });
        if (secded) {
          var yy = 40 + rowsN * 70;
          rect(svg, 30, yy - 10, cw + 30, 30, C.blueSoft, { stroke: C.blue });
          tx(svg, 30 + (cw + 30) / 2, yy + 10, "P总", { anchor: "middle", size: 13, bold: true, fill: C.blue });
          tx(svg, 110, yy + 10, "总校验位：对全部位做偶校验，用来区分 1 位错与 2 位错", { size: 13, fill: C.gray });
        }
        var cov = [];
        for (var q = 1; q <= N; q++) if (q & focus) cov.push(q);
        var rows = [];
        for (var kk = Math.max(1, k - 2); kk <= k; kk++) {
          var okk = pow2(kk) >= n + kk + 1;
          rows.push({ k: "k = " + kk, v: "2" + sup(kk) + " = " + pow2(kk) + (okk ? " ≥ " : " < ") + n + " + " + kk + " + 1 = " + (n + kk + 1), ok: okk, hl: kk === k });
        }
        rows.push({ k: "结论", v: "最少 k = " + k + (secded ? "，加总校验位共 " + (k + 1) + " 位" : "") + "，码长 " + H.total, hl: true });
        rows.push({ k: "P" + (Math.log(focus) / Math.LN2 + 1) + " 负责的位置", v: cov.join("、") + "（编号二进制第 " + (Math.log(focus) / Math.LN2 + 1) + " 位为 1）" });
        K.show(rows);
        var trs = [], hl = -1;
        for (var t2 = 2; t2 <= 7; t2++) {
          var lo = t2 === 2 ? 1 : hammingMaxN(t2 - 1) + 1, hi = hammingMaxN(t2);
          if (n >= lo && n <= hi) hl = t2 - 2;
          trs.push(["k = " + t2, lo + " ~ " + hi, String(pow2(t2) - 1)]);
        }
        K.table(["校验位 k", "可保护的数据位 n", "最大码长 2ᵏ − 1"], trs, hl);
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 5 存储器扩展 ---------- */
  PROP.push({
    id: "co-mem-expand", sub: "co", ch: CH.c3, name: "存储器的字扩展与位扩展",
    def: "用容量较小、位数较少的存储芯片组成主存。a × b 位的芯片表示有 a 个存储单元、每个单元 b 位；片选信号决定哪一组芯片工作。",
    stmt: [
      "所需芯片数 = **(A/a) × (B/b)**（目标 A × B 位，芯片 a × b 位）",
      "位扩展（a = A）：地址线、片选并联，数据线各接不同的位；字扩展（b = B）：数据线并联，高位地址经译码产生片选",
      "片内地址线 log₂a 根；片选用 log₂(A/a) 位高位地址（字扩展的组数）"
    ],
    cond: "容量按“单元数 × 位数”比较，按字节编址时 B = 8。ROM 区与 RAM 区规格不同要分开计算再相加。“片选线”通常指参与译码的高位地址线数；若问译码器输出线，则为 A/a 根。",
    proof: [
      "先比位数：每个单元要 B 位，一片只给 b 位，所以每组要 B/b 片并排（位扩展）。",
      "再比单元数：一组只有 a 个单元，要 A 个，所以要 A/a 组（字扩展）。",
      "总片数 = 组数 × 每组片数 = (A/a)(B/b)，也等于总容量 A·B 除以单片容量 a·b。",
      "同一组各片地址相同，共用 log₂a 根片内地址线；不同组靠高位地址区分，送 log₂(A/a) 位进译码器产生片选。",
      "例：用 4K × 4 位芯片组成 60K × 8 位（60 KB）RAM：每组 2 片、共 15 组，需 30 片。"
    ],
    traps: [
      "字节容量要换算：4K × 4 位的芯片只有 2 KB，不是 4 KB。",
      "位扩展时各片片选并联，不需要译码器；只有字扩展才需要高位地址译码。",
      "ROM 区和 RAM 区用的芯片规格不同时，要分别算芯片数。"
    ],
    ex: {
      q: "某计算机主存容量为 64 KB，其中 ROM 区为 4 KB，其余为 RAM 区，按字节编址。现要用 2K × 8 位的 ROM 芯片和 4K × 4 位的 RAM 芯片来设计该存储器，则需要上述规格的 ROM 芯片数和 RAM 芯片数分别是（ ）。",
      opts: ["1、15", "2、15", "1、30", "2、30"], a: 3,
      why: "ROM：4K × 8 位 ÷ (2K × 8 位) = 2 片（字扩展）。RAM：60K × 8 位 ÷ (4K × 4 位) = 15 × 2 = 30 片（字位同时扩展）。把 4K × 4 位当成 4 KB 会算出 15。",
      src: "2009 年真题"
    },
    links: { lab: [], proc: ["decoder"] },
    demo: function (box) {
      var K = kit(box, "存储器扩展芯片阵列");
      var chipIn = K.num("芯片 a × b", "1K×4", function () { draw(); }, { text: true });
      var tgtIn = K.num("目标 A × B", "4K×8", function () { draw(); }, { text: true });
      K.row();
      function preset(c, t) { chipIn.value = c; tgtIn.value = t; draw(); }
      K.btn("位扩展 1K×4 → 1K×8", function () { preset("1K×4", "1K×8"); });
      K.btn("字扩展 2K×8 → 8K×8", function () { preset("2K×8", "8K×8"); });
      K.btn("字位扩展 1K×4 → 4K×8", function () { preset("1K×4", "4K×8"); });
      K.btn("2009 真题 RAM 4K×4 → 60K×8", function () { preset("4K×4", "60K×8"); });
      function unit(w) { return w % 1048576 === 0 ? w / 1048576 + "M" : w % 1024 === 0 ? w / 1024 + "K" : String(w); }
      var draw = guard(K, function () {
        var c = parseWB(chipIn.value), t = parseWB(tgtIn.value);
        if (!c) throw "芯片规格格式不对，请写成 a×b，例如 4K×4";
        if (!t) throw "目标容量格式不对，请写成 A×B，例如 64K×8";
        var r = memExpand(c, t);
        if (r.err) throw r.err;
        var R = Math.min(r.rows, 16), Cc = Math.min(r.cols, 8);
        var cw = Math.min(96, 470 / Cc), ch = r.rows > 8 ? 26 : 34, gap = 6, X0 = 190, Y0 = 56;
        var H = Y0 + R * (ch + gap) + 40;
        var svg = K.svg(720, Math.max(H, 180), r.count + " 片芯片组成的阵列");
        tx(svg, X0, 22, "数据线 D0 ~ D" + (t.bits - 1) + "（每列接 " + c.bits + " 位）", { size: 13, fill: C.gray });
        for (var j = 0; j < Cc; j++) {
          var lo = j * c.bits, hi = lo + c.bits - 1;
          tx(svg, X0 + j * cw + (cw - gap) / 2, 44, c.bits === 1 ? "D" + lo : "D" + lo + "~" + hi, { anchor: "middle", size: 13, mono: true, fill: C.blue });
        }
        if (r.rows > 1) {
          rect(svg, 20, Y0, 120, R * (ch + gap) - gap, C.blueSoft, { stroke: C.blue });
          tx(svg, 80, Y0 + 22, r.sel + "-" + pow2(r.sel) + " 译码器", { anchor: "middle", size: 13, bold: true, fill: C.blue });
          tx(svg, 80, Y0 + 42, "A" + (r.chipAddr) + (r.sel > 1 ? " ~ A" + (r.chipAddr + r.sel - 1) : ""), { anchor: "middle", size: 13, mono: true, fill: C.blue });
        } else {
          tx(svg, 20, Y0 + 22, "片选并联", { size: 13, fill: C.gray });
          tx(svg, 20, Y0 + 40, "（无需译码）", { size: 13, fill: C.gray });
        }
        for (var i = 0; i < R; i++) {
          var y = Y0 + i * (ch + gap);
          if (r.rows > 1) { line(svg, 140, y + ch / 2, X0 - 4, y + ch / 2, C.blue); tx(svg, 146, y + ch / 2 - 4, "CS" + i, { size: 13, mono: true, fill: C.blue }); }
          for (var j2 = 0; j2 < Cc; j2++) {
            rect(svg, X0 + j2 * cw, y, cw - gap, ch, C.soft, { stroke: C.co });
            if (cw > 54) tx(svg, X0 + j2 * cw + (cw - gap) / 2, y + ch / 2 + 5, unit(c.words) + "×" + c.bits, { anchor: "middle", size: 13, mono: true });
          }
        }
        if (r.rows > R || r.cols > Cc) tx(svg, X0, Y0 + R * (ch + gap) + 20, "（只画出前 " + R + " 行 × " + Cc + " 列，实际 " + r.rows + " 行 × " + r.cols + " 列）", { size: 13, fill: C.gray });
        K.show([
          { k: "芯片数", v: "(A/a) × (B/b) = " + r.rows + " × " + r.cols + " = " + r.count + " 片", hl: true },
          { k: "容量核对", v: "总容量 " + r.targetBytes + " B ÷ 单片 " + r.chipBytes + " B = " + (r.targetBytes / r.chipBytes), ok: r.targetBytes / r.chipBytes === r.count },
          { k: "扩展方式", v: r.kind },
          { k: "地址线", v: "共 " + r.totalAddr + " 根（按 " + t.bits + " 位一个单元编址）= 片内 " + r.chipAddr + " 根 + 片选 " + r.sel + " 根" },
          { k: "数据线", v: r.data + " 根" }
        ]);
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 6 低位交叉编址 ---------- */
  PROP.push({
    id: "co-interleave", sub: "co", ch: CH.c3, name: "多体低位交叉存储器",
    def: "多体交叉存储器由 m 个容量相同、能独立读写的存储体组成。低位交叉编址用地址的低 log₂m 位选择存储体，连续地址依次落在 0、1、…、m − 1 号体，各体每隔 r 时间轮流启动（流水方式）。",
    stmt: [
      "连续读取 m 个字的时间 **t = T + (m − 1)r**（T 为存储周期，r 为总线传送周期）",
      "理想交叉条件 **T = m·r**：每隔 r 启动下一个体，一轮后正好回到已恢复的 0 号体",
      "高位交叉（顺序方式）连续读 m 个字需要 m·T，带宽没有提高"
    ],
    cond: "要求访问的地址连续、依次落在不同的存储体；若 m·r < T，第 m + 1 个字回到 0 号体时它还没恢复，需要等待。连续读 n 个字（n 可大于 m）且 T ≤ m·r 时，时间为 T + (n − 1)r。",
    proof: [
      "低位交叉时体号 = 地址 mod m，地址 0、1、2… 依次落在 0、1、2… 号体。",
      "0 号体在 0 时刻启动，经过一个存储周期 T 读出第 1 个字。",
      "每隔 r 启动下一个体：第 i 个字（从 0 数）在 i·r 时刻启动、在 i·r + T 时刻读出。",
      "最后一个字 i = m − 1，读出时刻为 T + (m − 1)r，这就是总时间。",
      "当 m·r ≥ T 时，下一轮回到 0 号体时它已经恢复，不必等待；取 m·r = T 时没有空闲，称为理想交叉。",
      "顺序（高位交叉）方式下连续地址在同一个体里，只能一个接一个地读，用时 m·T。"
    ],
    traps: [
      "T + (m − 1)r 中的 r 是总线传送周期（相邻两体的启动间隔），不是存取时间。",
      "高位交叉的作用是扩大容量，连续访问并不加速；能并行的是低位交叉。",
      "数据跨越存储体行边界时要多一个存储周期，按字节编址时先算出数据占用了哪几行。"
    ],
    ex: {
      q: "某计算机主存按字节编址，由 4 个 64M × 8 位的 DRAM 芯片采用交叉编址方式构成，并与宽度为 32 位的存储器总线相连，主存每次最多读写 32 位数据。若 double 型变量 x 的主存地址为 804 001AH，则读取 x 需要的存储周期数是（ ）。",
      opts: ["1", "2", "3", "4"], a: 2,
      why: "4 体低位交叉，地址最低 2 位是体号，一个存储周期能并行读出同一行（地址 ÷ 4 相同）的 4 个字节。x 占 804 001AH ~ 804 0021H 共 8 字节：1AH、1BH 在一行，1CH ~ 1FH 在下一行，20H、21H 在第三行，所以要 3 个存储周期；若 x 按 4 字节对齐只需 2 个。",
      src: "2017 年真题"
    },
    links: { lab: [], proc: [] },
    demo: function (box) {
      var K = kit(box, "低位交叉存储器时间线");
      var mIn = K.range("存储体数 m", 1, 8, 1, 4, function () { draw(); });
      var nIn = K.range("连续读取 n 个字", 1, 16, 1, 4, function () { draw(); });
      K.row();
      var TIn = K.range("存储周期 T", 1, 16, 1, 4, function () { draw(); });
      var rIn = K.range("总线传送周期 r", 1, 8, 1, 1, function () { draw(); });
      K.btn("设为理想交叉 T = m·r", function () { TIn.value = Math.min(16, +mIn.value * +rIn.value); TIn._upd(); draw(); });
      var draw = guard(K, function () {
        var m = +mIn.value, n = +nIn.value, T = +TIn.value, r = +rIn.value;
        var R = interleave(m, T, r, n);
        if (R.err) throw R.err;
        var tmax = Math.max(R.finish, R.seq), X0 = 96, X1 = 700, sc = (X1 - X0) / tmax, bh = 24;
        var H = 50 + m * (bh + 6) + 80;
        var svg = K.svg(720, H, "低位交叉与顺序方式的读取时间线");
        tx(svg, 14, 20, "低位交叉（每隔 r 启动下一个体）", { bold: true });
        for (var b = 0; b < m; b++) {
          var y = 34 + b * (bh + 6);
          tx(svg, 14, y + 17, "体 " + b, { size: 13, mono: true, fill: C.gray });
          line(svg, X0, y + bh / 2, X1, y + bh / 2, C.line);
        }
        R.starts.forEach(function (s, i) {
          var b2 = R.bank[i], y2 = 34 + b2 * (bh + 6);
          rect(svg, X0 + s * sc, y2, T * sc - 1, bh, i >= m && !R.ideal ? C.goldSoft : C.soft, { stroke: C.co });
          if (T * sc > 30) tx(svg, X0 + s * sc + T * sc / 2, y2 + 17, "字" + i, { anchor: "middle", size: 13 });
        });
        var yF = 34 + m * (bh + 6);
        line(svg, X0 + R.finish * sc, 28, X0 + R.finish * sc, yF, C.co, { w: 1.5, dash: "4 3" });
        tx(svg, X0 + R.finish * sc, yF + 16, "t = " + R.finish, { anchor: R.finish * sc > X1 - X0 - 40 ? "end" : "middle", size: 13, bold: true, fill: C.co });
        var ys = yF + 32;
        tx(svg, 14, ys + 17, "顺序", { size: 13, fill: C.gray });
        for (var i = 0; i < n; i++) rect(svg, X0 + i * T * sc, ys, T * sc - 1, bh, C.blueSoft, { stroke: C.blue });
        tx(svg, X0 + R.seq * sc, ys + bh + 16, "n·T = " + R.seq, { anchor: R.seq * sc > X1 - X0 - 40 ? "end" : "middle", size: 13, bold: true, fill: C.blue });
        var useF = n <= m || R.ideal;
        K.show([
          { k: "模拟结果", v: "最后一个字在 t = " + R.finish + " 读出", hl: true },
          useF ? { k: "公式 T + (n − 1)r", v: T + " + " + (n - 1) + " × " + r + " = " + R.formula, ok: R.formula === R.finish } :
            { k: "公式 T + (n − 1)r", v: "= " + R.formula + "，但 m·r = " + m * r + " < T，回到同一体时要等待共 " + R.wait + "，实际 " + R.finish, ok: R.finish === R.formula + R.wait },
          { k: "顺序方式", v: "n·T = " + n + " × " + T + " = " + R.seq + "，交叉方式快 " + fmt(R.seq / R.finish, 2) + " 倍" },
          { k: "理想交叉", v: "m·r = " + m * r + (T === m * r ? " = T，恰好理想" : T < m * r ? " > T，体有空闲" : " < T，会冲突") }
        ]);
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 7 Cache 地址划分 ---------- */
  PROP.push({
    id: "co-cache-addr", sub: "co", ch: CH.c3, name: "Cache 地址划分与总容量",
    def: "Cache 与主存以块为单位交换数据。主存地址划分为 标记 Tag + 组号（行号）Index + 块内地址 Offset；Cache 每行存放一个数据块和它的标记，以及有效位、脏位、替换控制位。",
    stmt: [
      "块内地址 = log₂(块大小)；**直接映射**行号 = log₂(行数)；**k 路组相联**组号 = log₂(行数/k)；**全相联**没有组号",
      "Tag 位数 = 主存地址位数 − 组号（行号）位数 − 块内地址位数",
      "Cache 总容量 = 行数 × (数据位 + Tag + 有效位 1 + 脏位〔写回法〕 + 替换位〔LRU 时 log₂k〕)"
    ],
    cond: "按字节编址，各容量都是 2 的幂。“Cache 容量 64 KB”通常指数据区；全写法（写直达）不需要脏位；直接映射不需要替换位。按字编址时块内地址按字数计算。主存块装入的组号 = 主存块号 mod 组数。",
    proof: [
      "块大小 2ᵇ 字节，用最低 b 位区分块内字节，即块内地址 b 位。",
      "Cache 行数 = 数据区容量 ÷ 块大小；k 路组相联把每 k 行编为一组，组数 = 行数/k，需要 log₂(组数) 位组号。",
      "直接映射相当于 1 路组相联（组号就是行号）；全相联相当于只有 1 组，组号 0 位。",
      "剩下的高位都是 Tag：映射到同一组的块来自主存不同区域，要靠 Tag 区分。",
      "每行除数据外还要存 Tag 和 1 位有效位；写回法加 1 位脏位；LRU 每行再加 log₂k 位计数。",
      "例：32 位地址、64 KB 数据区、32 B 块、8 路、写回、LRU：Offset 5、组数 256 → Index 8、Tag 19，每行 256 + 19 + 1 + 1 + 3 = 280 位，共 2048 行。"
    ],
    traps: [
      "相联度越高 Tag 越长：k 每翻一倍，组号少 1 位、Tag 多 1 位。",
      "问“Cache 总容量”要把 Tag、有效位、脏位、替换位都算上，只算数据区是常见失分点。",
      "组号 = 主存块号 mod 组数，块号 = 地址 ÷ 块大小；不要直接拿地址 mod 组数。"
    ],
    ex: {
      q: "某计算机的 Cache 共有 16 块，采用 2 路组相联映射方式（即每组 2 块）。每个主存块大小为 32 字节，按字节编址。主存 129 号单元所在主存块应装入到的 Cache 组号是（ ）。",
      opts: ["0", "2", "4", "6"], a: 2,
      why: "组数 = 16/2 = 8，组号 3 位；块大小 32 B，块内地址 5 位。129 = 100 00001B：低 5 位是块内地址，往上 3 位 100 = 4 就是组号。也可以算：块号 = 129 ÷ 32 = 4（取整），4 mod 8 = 4。",
      src: "2009 年真题"
    },
    links: { lab: ["cache"], proc: ["cachewrite", "tlbcache"] },
    demo: function (box) {
      var K = kit(box, "Cache 地址字段与总容量");
      var ways = 8, wb = true, lru = true;
      var memIn = K.num("主存容量", "4GB", function () { draw(); }, { text: true });
      var cIn = K.num("Cache 数据区", "64KB", function () { draw(); }, { text: true });
      var bIn = K.num("块大小", "32B", function () { draw(); }, { text: true });
      K.row();
      var wSeg = K.seg("映射", [{ v: 1, t: "直接映射" }, { v: 2, t: "2 路" }, { v: 4, t: "4 路" }, { v: 8, t: "8 路" }, { v: "full", t: "全相联" }], 8, function (v) { ways = v; draw(); });
      K.row();
      var wbSeg = K.seg("写策略", [{ v: true, t: "写回（有脏位）" }, { v: false, t: "全写（无脏位）" }], true, function (v) { wb = v; draw(); });
      var lruSeg = K.seg("替换位", [{ v: true, t: "计入 LRU 位" }, { v: false, t: "不计" }], true, function (v) { lru = v; draw(); });
      K.row();
      var aIn = K.num("定位主存地址（十进制或 xxH）", "129", function () { draw(); }, { text: true });
      K.btn("2009 真题：16 块 2 路 32B", function () { memIn.value = "64KB"; cIn.value = "512B"; bIn.value = "32B"; ways = 2; wSeg.set(2); aIn.value = "129"; draw(); });
      K.btn("64KB 8 路写回例", function () { memIn.value = "4GB"; cIn.value = "64KB"; bIn.value = "32B"; ways = 8; wSeg.set(8); wb = true; wbSeg.set(true); lru = true; lruSeg.set(true); draw(); });
      function seg(svg, x, y, w, h, fill, stroke, a, b2) {
        rect(svg, x, y, w, h, fill, { stroke: stroke, rx: 2 });
        tx(svg, x + w / 2, y + 20, a, { anchor: "middle", size: 13, bold: true });
        if (b2) tx(svg, x + w / 2, y + h + 18, b2, { anchor: "middle", size: 13, mono: true, fill: C.gray });
      }
      function widths(arr, total, minW) {
        var sum = 0; arr.forEach(function (v) { sum += v; });
        var w = arr.map(function (v) { return v === 0 ? 0 : Math.max(minW, v / sum * total); });
        var s2 = 0; w.forEach(function (v) { s2 += v; });
        return w.map(function (v) { return v * total / s2; });
      }
      var draw = guard(K, function () {
        var mem = parseSize(memIn.value), cache = parseSize(cIn.value), blk = parseSize(bIn.value);
        if (isNaN(mem)) throw "主存容量格式不对，例如 4GB、256MB、64KB";
        if (isNaN(cache)) throw "Cache 容量格式不对，例如 64KB、512B";
        if (isNaN(blk)) throw "块大小格式不对，例如 32B、64B";
        var r = cacheFields({ memBytes: mem, cacheBytes: cache, blockBytes: blk, ways: ways, wb: wb, lru: lru });
        if (r.err) throw r.err;
        var addr = readNum(aIn.value);
        if (aIn.value.trim() !== "" && (isNaN(addr) || !isInt(addr) || addr < 0)) throw "地址应为非负整数，十六进制可写成 1A7CH";
        if (!isNaN(addr) && addr >= mem) throw "地址超出主存范围（0 ~ " + (mem - 1) + "）";
        var svg = K.svg(720, 250, "主存地址字段与 Cache 行结构");
        tx(svg, 14, 22, "主存地址 " + r.memBits + " 位（" + r.kind + "）", { bold: true });
        var parts = [r.tag, r.index, r.offset], ww = widths(parts, 660, 70), x = 30;
        var loc = isNaN(addr) ? null : cacheLocate(addr, blk, r.sets);
        var vals = loc ? [loc.tag, loc.set, loc.offset] : null;
        var names = ["Tag " + r.tag + " 位", (r.ways === 1 ? "行号 " : "组号 ") + r.index + " 位", "块内 " + r.offset + " 位"];
        var fills = [C.soft, C.blueSoft, C.goldSoft], strokes = [C.co, C.blue, C.gold];
        parts.forEach(function (p, i) {
          if (!ww[i]) return;
          var b2 = vals ? (p <= 20 ? bits(vals[i], p) : "…" + bits(vals[i] % 1048576, 20)) + " = " + vals[i] : null;
          if (b2 && ww[i] < b2.length * 7.2) b2 = String(vals[i]);
          seg(svg, x, 34, ww[i], 30, fills[i], strokes[i], names[i], b2);
          x += ww[i];
        });
        tx(svg, 14, 130, "Cache 每行 " + r.perLine + " 位，共 " + r.lines + " 行（" + r.sets + " 组 × " + r.ways + " 路）", { bold: true });
        var lp = [r.valid, r.dirty, r.lru, r.tag, Math.min(r.dataBits, 64)], lw = widths(lp, 660, 46);
        var ln = ["V", "D", "LRU", "Tag", "数据 " + r.dataBits + " 位"], ls = ["1", "1", String(r.lru), String(r.tag), "（按比例缩短）"];
        var lf = [C.okSoft, C.badSoft, C.blueSoft, C.soft, C.faint], lst = [C.ok, C.bad, C.blue, C.co, C.gray];
        x = 30;
        lp.forEach(function (p, i) {
          if (!lw[i]) return;
          seg(svg, x, 142, lw[i], 30, lf[i], lst[i], ln[i], ls[i]);
          x += lw[i];
        });
        var kb = r.total / 8 / 1024;
        var rows = [
          { k: "字段划分", v: "Tag " + r.tag + " + " + (r.ways === 1 ? "行号 " : "组号 ") + r.index + " + 块内 " + r.offset + " = " + (r.tag + r.index + r.offset) + " 位", ok: r.tag + r.index + r.offset === r.memBits, hl: true },
          { k: "行数与组数", v: cache + " B ÷ " + blk + " B = " + r.lines + " 行；" + r.lines + " ÷ " + r.ways + " = " + r.sets + " 组" },
          { k: "每行位数", v: r.dataBits + "（数据）+ " + r.tag + "（Tag）+ 1（有效）" + (r.dirty ? " + 1（脏）" : "") + (r.lru ? " + " + r.lru + "（LRU）" : "") + " = " + r.perLine },
          { k: "Cache 总容量", v: r.lines + " × " + r.perLine + " = " + r.total + " 位 ≈ " + fmt(kb, 3) + " KB（数据区 " + fmt(cache / 1024, 3) + " KB，额外 " + pct(r.overhead / r.dataTotal) + "）", hl: true }
        ];
        if (loc) rows.push({ k: "地址 " + addr, v: "块号 " + addr + " ÷ " + blk + " = " + loc.block + "，" + (r.ways === r.lines ? "全相联可放任意行" : (r.ways === 1 ? "行号 " : "组号 ") + loc.block + " mod " + r.sets + " = " + loc.set) + "，Tag = " + loc.tag });
        K.show(rows);
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 8 命中率与平均访问时间 ---------- */
  PROP.push({
    id: "co-cache-ta", sub: "co", ch: CH.c3, name: "Cache 命中率与平均访问时间",
    def: "命中率 h 是 CPU 要访问的信息在 Cache 中找到的比例。Tc 为 Cache 访问时间，Tm 为主存访问时间，Ta 为平均访问时间。",
    stmt: [
      "**h = Nc / (Nc + Nm)**（Nc 命中次数，Nm 缺失次数）",
      "Cache 与主存同时访问：**Ta = h·Tc + (1 − h)·Tm**",
      "先访问 Cache、缺失再访问主存：**Ta = Tc + (1 − h)·Tm** = h·Tc + (1 − h)(Tc + Tm)；效率 e = Tc / Ta"
    ],
    cond: "两种口径只差在缺失时是否先花掉一次 Tc：题目说“同时访问”用第一式，说“先访问 Cache，未命中再访问主存”用第二式。题目给出“缺失损失（缺失开销）”时 Ta = Tc + (1 − h) × 缺失损失。两种访问方式在真题和各类资料中都出现过，题干没写清时先确认是哪一种。",
    proof: [
      "共访问 Nc + Nm 次，命中 Nc 次，所以 h = Nc/(Nc + Nm)，缺失率为 1 − h。",
      "同时访问：命中时 Tc 内拿到数据；缺失时主存访问已同步开始，用时 Tm。按概率加权 Ta = h·Tc + (1 − h)·Tm。",
      "先 Cache 后主存：缺失时先花 Tc 发现不在 Cache，再花 Tm 访问主存，共 Tc + Tm。",
      "加权：h·Tc + (1 − h)(Tc + Tm) = Tc + (1 − h)·Tm。",
      "效率 e = Tc/Ta 衡量主存“看起来”有多快；h → 1 时 Ta → Tc，e → 1。"
    ],
    traps: [
      "先看题目是“同时访问”还是“先访问 Cache”，两式相差 (1 − h)·Tc。",
      "命中率按访问次数算：给出缺失次数时，命中次数 = 总次数 − 缺失次数。",
      "缺失时把整块调入 Cache 的时间一般计入缺失损失，不一定等于一次 Tm。"
    ],
    ex: {
      q: "某计算机 Cache 存取时间为 5 ns，主存存取时间为 50 ns。某程序执行中访存 1000 次，其中 Cache 缺失 50 次。若 CPU 先访问 Cache，缺失后再访问主存，则平均访问时间是（ ）。",
      opts: ["7.25 ns", "7.5 ns", "5 ns", "47.75 ns"], a: 1,
      why: "h = (1000 − 50)/1000 = 0.95。先访问 Cache：Ta = Tc + (1 − h)·Tm = 5 + 0.05 × 50 = 7.5 ns。7.25 ns 是“同时访问”口径 h·Tc + (1 − h)·Tm 的结果；47.75 ns 是把 h 和 1 − h 用反了。",
      src: "典型题"
    },
    links: { lab: ["cache"], proc: ["cachewrite", "tlbflow"] },
    demo: function (box) {
      var K = kit(box, "命中率与平均访问时间两种口径");
      var hIn = K.range("命中率 h", 0, 1, 0.01, 0.95, function () { draw(); }, function (v) { return v.toFixed(2); });
      var tcIn = K.num("Tc", 5, function () { draw(); });
      var tmIn = K.num("Tm", 50, function () { draw(); });
      K.row();
      var ncIn = K.num("命中次数 Nc", 950, function () {}, {});
      var nmIn = K.num("缺失次数 Nm", 50, function () {}, {});
      K.btn("按次数算 h", function () {
        try {
          var nc = need(ncIn, "命中次数", { int: true, min: 0 }), nm = need(nmIn, "缺失次数", { int: true, min: 0 });
          var r = hitRate(nc, nm);
          if (r.err) throw r.err;
          hIn.value = r.h; hIn._upd(); draw();
        } catch (e) { if (typeof e !== "string") throw e; K.setErr(e); }
      });
      var draw = guard(K, function () {
        var h = +hIn.value, tc = need(tcIn, "Tc", { pos: true }), tm = need(tmIn, "Tm", { pos: true });
        var P = cacheTa(h, tc, tm, "par"), S = cacheTa(h, tc, tm, "seq");
        if (P.err) throw P.err;
        var X0 = 70, X1 = 690, Y0 = 30, Y1 = 220, ymax = tc + tm;
        var mx = function (v) { return X0 + v * (X1 - X0); }, my = function (v) { return Y1 - v / ymax * (Y1 - Y0); };
        var svg = K.svg(720, 262, "平均访问时间随命中率变化的两条直线");
        line(svg, X0, Y1, X1, Y1, C.gray); line(svg, X0, Y0, X0, Y1, C.gray);
        [0, 0.25, 0.5, 0.75, 1].forEach(function (v) { line(svg, mx(v), Y1, mx(v), Y1 + 5, C.gray); tx(svg, mx(v), Y1 + 20, String(v), { anchor: "middle", size: 13, fill: C.gray }); });
        var lastY = -99;
        [tc + tm, tm, tc].forEach(function (v) {
          line(svg, X0 - 5, my(v), X0, my(v), C.gray);
          if (my(v) - lastY >= 20) { tx(svg, X0 - 8, my(v) + 5, fmt(v, 2), { anchor: "end", size: 13, fill: C.gray, mono: true }); lastY = my(v); }
        });
        tx(svg, X1, Y1 + 38, "命中率 h", { anchor: "end", size: 13, fill: C.gray });
        line(svg, mx(0), my(tc + tm), mx(1), my(tc), C.co, { w: 2.5 });
        line(svg, mx(0), my(tm), mx(1), my(tc), C.blue, { w: 2.5 });
        var lx = h < 0.5 ? 0.62 : 0.3;
        tx(svg, mx(lx), my(tc + (1 - lx) * tm) - 10, "先 Cache 后主存：Tc + (1 − h)Tm", { size: 13, fill: C.co, bold: true });
        tx(svg, mx(lx), my((lx + 0.38) * tc + (1 - lx - 0.38) * tm) + 22, "同时访问：h·Tc + (1 − h)Tm", { size: 13, fill: C.blue, bold: true });
        line(svg, mx(h), Y0, mx(h), Y1, C.ink, { dash: "4 3" });
        sv("circle", { cx: mx(h), cy: my(S.ta), r: 5, fill: C.co }, svg);
        sv("circle", { cx: mx(h), cy: my(P.ta), r: 5, fill: C.blue }, svg);
        var right = mx(h) > 560;
        tx(svg, mx(h) + (right ? -8 : 8), my(S.ta) - 8, fmt(S.ta, 3), { size: 13, mono: true, fill: C.co, anchor: right ? "end" : "start" });
        tx(svg, mx(h) + (right ? -8 : 8), my(P.ta) + 18, fmt(P.ta, 3), { size: 13, mono: true, fill: C.blue, anchor: right ? "end" : "start" });
        K.show([
          { k: "同时访问", v: "Ta = " + fmt(h, 4) + " × " + fmt(tc) + " + " + fmt(1 - h, 4) + " × " + fmt(tm) + " = " + fmt(P.ta, 4) + "，e = " + pct(P.e) },
          { k: "先 Cache 后主存", v: "Ta = " + fmt(tc) + " + " + fmt(1 - h, 4) + " × " + fmt(tm) + " = " + fmt(S.ta, 4) + "，e = " + pct(S.e) },
          { k: "两式之差", v: "(1 − h)·Tc = " + fmt((1 - h) * tc, 4), ok: Math.abs(S.ta - P.ta - (1 - h) * tc) < 1e-9, hl: true },
          { k: "等价写法核对", v: "h·Tc + (1 − h)(Tc + Tm) = " + fmt(h * tc + (1 - h) * (tc + tm), 4), ok: Math.abs(h * tc + (1 - h) * (tc + tm) - S.ta) < 1e-9 }
        ]);
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 9 CPU 性能 ---------- */
  PROP.push({
    id: "co-cpu-perf", sub: "co", ch: CH.c1, name: "CPU 执行时间与 MIPS",
    def: "CPI 是执行一条指令平均需要的时钟周期数；主频 f 是每秒的时钟周期数（时钟周期 = 1/f）；MIPS 是每秒执行多少百万条指令。",
    stmt: [
      "**CPU 时间 = 指令条数 × CPI / 主频** = 指令条数 × CPI × 时钟周期",
      "**MIPS = 主频 / (CPI × 10⁶)**",
      "平均 CPI = Σ（各类指令所占比例 × 该类指令的 CPI）"
    ],
    cond: "CPU 时间只算 CPU 执行程序的时间，不含 I/O 等待。MIPS 只能在指令集相同的机器之间比较；指令集不同时，同一程序的指令条数不同，要比 CPU 时间。比例按程序运行时实际执行的指令条数计算。",
    proof: [
      "一条指令平均 CPI 个时钟周期，程序共 IC 条指令，所以共需 IC × CPI 个时钟周期。",
      "每个时钟周期 1/f 秒，CPU 时间 = IC × CPI / f。",
      "每秒能执行 f / CPI 条指令，以百万条为单位就是 MIPS = f / (CPI × 10⁶)。",
      "各类指令 CPI 不同时，总周期数 = Σ ICᵢ × CPIᵢ，除以 IC 得平均 CPI = Σ pᵢ × CPIᵢ（pᵢ = ICᵢ/IC）。",
      "合起来 CPU 时间 = IC / (MIPS × 10⁶)：同一指令集下 MIPS 越大越快。"
    ],
    traps: [
      "1.2 GHz 是 1.2 × 10⁹ Hz，MIPS 公式里再除以 10⁶，单位别弄混。",
      "平均 CPI 要按比例加权，不能直接对各类 CPI 求算术平均。",
      "比较两台机器时看清问的是“M1/M2”还是“M2/M1”。"
    ],
    ex: {
      q: "假定计算机 M1 和 M2 具有相同的指令集体系结构（ISA），主频分别为 1.5 GHz 和 1.2 GHz。在 M1 和 M2 上运行某基准程序 P，平均 CPI 分别为 2 和 1，则程序 P 在 M1 和 M2 上运行时间的比值是（ ）。",
      opts: ["0.4", "0.625", "1.6", "2.5"], a: 2,
      why: "ISA 相同，同一程序的指令条数 IC 相同。T₁ = IC × 2 / 1.5 GHz，T₂ = IC × 1 / 1.2 GHz，T₁/T₂ = (2/1.5)/(1/1.2) = 1.6。0.625 是 T₂/T₁，比值方向弄反了。",
      src: "2017 年真题"
    },
    links: { lab: ["pipeline"], proc: ["icycle"] },
    demo: function (box) {
      var K = kit(box, "CPU 时间与 MIPS 计算器");
      var fIn = K.num("主频（MHz）", 1000, function () { draw(); });
      var icIn = K.num("指令条数", 10000, function () { draw(); });
      var mix = [];
      for (var i = 0; i < 4; i++) {
        K.row();
        mix.push({ p: K.num("第 " + (i + 1) + " 类比例 %", i === 0 ? 80 : i === 1 ? 20 : 0, function () { draw(); }), c: K.num("CPI", i === 0 ? 1 : i === 1 ? 10 : 1, function () { draw(); }) });
      }
      K.row();
      function preset(f, ic, rows) { fIn.value = f; icIn.value = ic; mix.forEach(function (m, j) { m.p.value = rows[j] ? rows[j][0] : 0; m.c.value = rows[j] ? rows[j][1] : 1; }); draw(); }
      K.btn("2022 真题：1 GHz，80%×1 + 20%×10", function () { preset(1000, 10000, [[80, 1], [20, 10]]); });
      K.btn("2017 真题 M1：1.5 GHz，CPI 2", function () { preset(1500, 10000, [[100, 2]]); });
      K.btn("2017 真题 M2：1.2 GHz，CPI 1", function () { preset(1200, 10000, [[100, 1]]); });
      var colors = [C.co, C.blue, C.gold, C.green];
      var draw = guard(K, function () {
        var f = need(fIn, "主频", { pos: true }) * 1e6, ic = need(icIn, "指令条数", { pos: true, int: true });
        var mx = [];
        mix.forEach(function (m, j) {
          var p = need(m.p, "第 " + (j + 1) + " 类比例", { min: 0, max: 100 });
          var c = need(m.c, "第 " + (j + 1) + " 类 CPI", { pos: true });
          if (p > 0) mx.push({ p: p / 100, cpi: c, j: j });
        });
        if (!mx.length) throw "至少要有一类指令的比例大于 0";
        var A = avgCPI(mx);
        if (A.err) throw A.err;
        var T = cpuTime(ic, A.cpi, f);
        var svg = K.svg(720, 150, "各类指令对平均 CPI 的贡献");
        tx(svg, 14, 22, "平均 CPI = Σ（比例 × 该类 CPI）的组成", { bold: true });
        var X0 = 30, W = 660, x = X0;
        mx.forEach(function (m) {
          var w = m.p * m.cpi / A.cpi * W;
          rect(svg, x, 40, w, 40, colors[m.j], { rx: 0 });
          if (w > 70) tx(svg, x + w / 2, 66, fmt(m.p, 3) + "×" + fmt(m.cpi, 3), { anchor: "middle", size: 13, fill: C.paper, bold: true });
          if (w > 50) tx(svg, x + w / 2, 104, pct(m.p * m.cpi / A.cpi), { anchor: "middle", size: 13, fill: C.gray });
          x += w;
        });
        tx(svg, X0 + W, 134, "合计 CPI = " + fmt(A.cpi, 4), { anchor: "end", size: 14, bold: true });
        K.show([
          { k: "平均 CPI", v: mx.map(function (m) { return fmt(m.p, 3) + "×" + fmt(m.cpi, 3); }).join(" + ") + " = " + fmt(A.cpi, 4), hl: true },
          { k: "CPU 时间", v: ic + " × " + fmt(A.cpi, 4) + " ÷ " + par(sci(f, 3) + " Hz") + " = " + fmtTime(T.t), hl: true },
          { k: "MIPS", v: sci(f, 3) + " ÷ (" + fmt(A.cpi, 4) + " × 10⁶) = " + fmt(T.mips, 3) },
          { k: "互相核对", v: "IC ÷ (MIPS × 10⁶) = " + fmtTime(ic / (T.mips * 1e6)), ok: Math.abs(ic / (T.mips * 1e6) - T.t) <= T.t * 1e-9 }
        ]);
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 10 Amdahl 定律 ---------- */
  PROP.push({
    id: "co-amdahl", sub: "co", ch: CH.c1, name: "Amdahl 定律",
    def: "Amdahl 定律描述只改进系统中一部分时，整体性能能提高多少。f 是可改进部分在改进前所占的执行时间比例，s 是这一部分自身的加速比。",
    stmt: [
      "整体加速比 **S = 1 / ((1 − f) + f/s)**",
      "s → ∞ 时 **S → 1/(1 − f)**：不可改进的部分决定上限",
      "改进后执行时间 = 原执行时间 × ((1 − f) + f/s)"
    ],
    cond: "f 按改进前的执行时间计算（不是指令条数的比例）；两部分互不重叠、串行执行。用于多核并行时，f 是可并行部分，s 是核数（理想情况）。",
    proof: [
      "设原执行时间为 1，其中可改进部分 f，不可改进部分 1 − f。",
      "可改进部分加速 s 倍后只需 f/s，不可改进部分仍是 1 − f。",
      "新执行时间 T′ = (1 − f) + f/s。",
      "加速比 S = 原时间 / 新时间 = 1 / ((1 − f) + f/s)。",
      "s 无限大时 f/s → 0，S → 1/(1 − f)；例如 f = 0.5 时无论部件多快，整体加速比都不超过 2。"
    ],
    traps: [
      "f = 0.5、s = 2 时 S = 1/(0.5 + 0.25) = 4/3，不是 2，也不是 1.5。",
      "f 是时间比例：题目给“某类指令占 40%”时，要先换算成这类指令的执行时间占比。",
      "要求整体加速比达到某个值时，先检验它是否超过上限 1/(1 − f)，超过则无论 s 多大都做不到。"
    ],
    ex: {
      q: "某程序运行时，浮点运算占总执行时间的 60%。若将浮点运算部件的速度提高到原来的 4 倍，则整个程序的加速比约为（ ）。",
      opts: ["1.82", "2.4", "4", "2.5"], a: 0,
      why: "S = 1/((1 − 0.6) + 0.6/4) = 1/0.55 ≈ 1.82。2.4 是误把 0.6 × 4 当加速比；4 只是部件自身的加速比；2.5 = 1/(1 − 0.6) 是 s → ∞ 时的上限。",
      src: "典型题"
    },
    links: { lab: [], proc: [] },
    demo: function (box) {
      var K = kit(box, "Amdahl 加速比曲线");
      var fIn = K.range("可改进比例 f", 0, 1, 0.01, 0.5, function () { draw(); }, function (v) { return v.toFixed(2); });
      var sIn = K.range("部件加速比 s", 1, 64, 0.5, 2, function () { draw(); }, function (v) { return String(v); });
      var draw = guard(K, function () {
        var f = +fIn.value, s = +sIn.value, A = amdahl(f, s);
        if (A.err) throw A.err;
        var smax = 64, X0 = 70, X1 = 690, Y0 = 30, Y1 = 220;
        var ytop = Math.min(isFinite(A.limit) ? A.limit * 1.12 : smax * 1.05, smax * 1.05);
        if (ytop < 1.2) ytop = 1.2;
        var mx = function (v) { return X0 + Math.log(v) / Math.log(smax) * (X1 - X0); }, my = function (v) { return Y1 - (v - 1) / (ytop - 1) * (Y1 - Y0); };
        var svg = K.svg(720, 262, "整体加速比随部件加速比变化的曲线");
        line(svg, X0, Y1, X1, Y1, C.gray); line(svg, X0, Y0, X0, Y1, C.gray);
        [1, 2, 4, 8, 16, 32, 64].forEach(function (v) { line(svg, mx(v), Y1, mx(v), Y1 + 5, C.gray); tx(svg, mx(v), Y1 + 20, String(v), { anchor: "middle", size: 13, fill: C.gray }); });
        tx(svg, X1, Y1 + 38, "部件加速比 s（对数坐标）", { anchor: "end", size: 13, fill: C.gray });
        var ticks = [1, (1 + ytop) / 2, ytop];
        ticks.forEach(function (v) { tx(svg, X0 - 8, my(v) + 5, fmt(v, 2), { anchor: "end", size: 13, fill: C.gray, mono: true }); });
        if (isFinite(A.limit) && A.limit <= ytop) {
          line(svg, X0, my(A.limit), X1, my(A.limit), C.bad, { dash: "6 4" });
          tx(svg, X1, my(A.limit) - 6, "上限 1/(1 − f) = " + fmt(A.limit, 3), { anchor: "end", size: 13, fill: C.bad });
        }
        var d = "";
        for (var i = 0; i <= 120; i++) {
          var v = Math.pow(smax, i / 120), S = amdahl(f, v).S;
          d += (i ? " L" : "M") + mx(v).toFixed(1) + " " + my(Math.min(S, ytop)).toFixed(1);
        }
        sv("path", { d: d, fill: "none", stroke: C.co, "stroke-width": 2.5 }, svg);
        sv("circle", { cx: mx(s), cy: my(A.S), r: 6, fill: C.co }, svg);
        tx(svg, mx(s) + (mx(s) > 560 ? -10 : 10), my(A.S) + 20, "S = " + fmt(A.S, 4), { size: 13, bold: true, anchor: mx(s) > 560 ? "end" : "start" });
        K.show([
          { k: "整体加速比", v: "1 / ((1 − " + f.toFixed(2) + ") + " + f.toFixed(2) + "/" + s + ") = " + fmt(A.S, 4), hl: true },
          { k: "改进后时间", v: "原来的 " + pct(A.rest) },
          { k: "上限", v: isFinite(A.limit) ? "s → ∞ 时 S → " + fmt(A.limit, 4) : "f = 1 时没有上限，S = s", ok: A.S <= A.limit + 1e-12 },
          { k: "两边核对", v: "原时间 1 ÷ 新时间 " + fmt(A.rest, 4) + " = " + fmt(1 / A.rest, 4), ok: Math.abs(1 / A.rest - A.S) < 1e-12 }
        ]);
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 11 流水线性能 ---------- */
  PROP.push({
    id: "co-pipeline", sub: "co", ch: CH.c5, name: "指令流水线的性能指标",
    def: "k 段线性流水线每段用时 Δt（一个时钟周期），各段可以同时处理不同的指令。吞吐率 TP 是单位时间完成的指令数；加速比 S 是不用流水线与用流水线的时间之比；效率 E 是时空图中被占用的格子所占比例。",
    stmt: [
      "**T = (k + n − 1)Δt**",
      "**TP = n / T**；**S = nkΔt / T = nk/(k + n − 1)**，n → ∞ 时 S → k",
      "**E = n / (k + n − 1)** = S/k，n → ∞ 时 E → 1"
    ],
    cond: "各段时间相等且流水线不断流（没有冒险和阻塞）。各段时间不等时 Δt 取最长段（瓶颈段）的时间，有段间锁存器延迟时还要加上；发生数据冒险或控制冒险时，要另加阻塞的周期数。",
    proof: [
      "第一条指令要依次经过全部 k 段，用时 kΔt。",
      "之后流水线已经充满，每过 Δt 流出一条指令，剩下 n − 1 条再用 (n − 1)Δt。",
      "总时间 T = kΔt + (n − 1)Δt = (k + n − 1)Δt。",
      "吞吐率 TP = n/T；不用流水线时每条指令要 kΔt，共 nkΔt，所以加速比 S = nkΔt/T = nk/(k + n − 1)。",
      "当 n 远大于 k 时，S 趋近于 k，TP 趋近于 1/Δt。",
      "时空图共 k × (k + n − 1) 个格子，被指令占用 nk 个，效率 E = n/(k + n − 1)。"
    ],
    traps: [
      "别漏掉 −1：写成 (k + n)Δt 会多算一拍；k = 4、n = 10 时应为 13 个周期。",
      "各段时间不等时 Δt 取最长段的时间，不是平均值。",
      "n = 1 时流水线没有任何加速（S = 1）；加速比和吞吐率都随 n 增大而增大。"
    ],
    ex: {
      q: "某 CPU 主频为 1.03 GHz，采用 4 级指令流水线，每个流水段的执行需要 1 个时钟周期。假定 CPU 执行了 100 条指令，在其执行过程中没有发生任何流水线阻塞，此时流水线的吞吐率为（ ）。",
      opts: ["0.25 × 10⁹ 条指令/秒", "0.97 × 10⁹ 条指令/秒", "1.0 × 10⁹ 条指令/秒", "1.03 × 10⁹ 条指令/秒"], a: 2,
      why: "T = (4 + 100 − 1) = 103 个时钟周期 = 103 ÷ 1.03 GHz = 100 ns；TP = 100 条 ÷ 100 ns = 1.0 × 10⁹ 条指令/秒。1.03 × 10⁹ 忽略了装满流水线的 3 个周期，0.25 × 10⁹ 是按不用流水线、每条 4 个周期计算的。",
      src: "2013 年真题"
    },
    links: { lab: ["pipeline"], proc: [] },
    demo: function (box) {
      var K = kit(box, "流水线时空图");
      var kIn = K.range("段数 k", 2, 8, 1, 4, function () { K.stop(); upto = Infinity; draw(); });
      var nIn = K.range("指令条数 n", 1, 20, 1, 10, function () { K.stop(); upto = Infinity; draw(); });
      K.row();
      var dtIn = K.num("Δt", 1, function () { draw(); });
      var upto = Infinity;
      K.btn("逐拍播放", function () {
        K.stop(); upto = 0; draw();
        K.every(function () {
          var tot = +kIn.value + +nIn.value - 1;
          upto++;
          if (upto >= tot) { K.stop(); upto = Infinity; }
          draw();
        }, 450);
      }, true);
      K.btn("全部显示", function () { K.stop(); upto = Infinity; draw(); });
      var draw = guard(K, function () {
        var k = +kIn.value, n = +nIn.value, dt = need(dtIn, "Δt", { pos: true });
        var P = pipeline(k, n, dt);
        if (P.err) throw P.err;
        var cols = P.cycles, X0 = 70, cw = Math.min(40, 630 / cols), ch = 28, Y0 = 40;
        var svg = K.svg(720, Y0 + k * ch + 56, k + " 段流水线执行 " + n + " 条指令的时空图");
        tx(svg, 14, 22, "时空图：纵轴是流水段，横轴是时钟周期，格中数字是指令序号", { size: 13, fill: C.gray });
        for (var s = 0; s < k; s++) {
          var y = Y0 + (k - 1 - s) * ch;
          tx(svg, 14, y + 19, "S" + (s + 1), { size: 13, mono: true, bold: true });
          for (var c = 0; c < cols; c++) {
            var ins = c - s + 1, busy = ins >= 1 && ins <= n, shown = c < upto + 1;
            rect(svg, X0 + c * cw, y, cw - 2, ch - 2, busy && shown ? (s === k - 1 ? C.co : C.soft) : C.faint, { rx: 2 });
            if (busy && shown) tx(svg, X0 + c * cw + (cw - 2) / 2, y + 19, String(ins), { anchor: "middle", size: 13, mono: true, fill: s === k - 1 ? C.paper : C.ink });
          }
        }
        var yb = Y0 + k * ch;
        for (var c2 = 0; c2 < cols; c2++) if (cols <= 14 || c2 % 2 === 0 || c2 === cols - 1) tx(svg, X0 + c2 * cw + (cw - 2) / 2, yb + 18, String(c2 + 1), { anchor: "middle", size: 13, fill: C.gray, mono: true });
        line(svg, X0, yb + 28, X0 + k * cw - 2, yb + 28, C.blue, { w: 2 });
        tx(svg, X0, yb + 46, "装满 k 拍", { size: 13, fill: C.blue });
        if (n > 1) {
          line(svg, X0 + k * cw, yb + 28, X0 + cols * cw - 2, yb + 28, C.co, { w: 2 });
          tx(svg, X0 + cols * cw - 2, yb + 46, "再流出 n − 1 = " + (n - 1) + " 条", { anchor: "end", size: 13, fill: C.co });
        }
        var busyCells = n * k, all = k * cols;
        K.show([
          { k: "总时间", v: "(k + n − 1)Δt = (" + k + " + " + n + " − 1) × " + fmt(dt) + " = " + fmt(P.T), hl: true },
          { k: "数格子核对", v: "最后一条指令在第 " + cols + " 拍流出", ok: cols * dt === P.T },
          { k: "吞吐率", v: "TP = n/T = " + n + "/" + fmt(P.T) + " = " + fmt(P.TP, 4) },
          { k: "加速比", v: "S = nkΔt/T = " + fmt(n * k * dt) + "/" + fmt(P.T) + " = " + fmt(P.S, 4) + "（上限 k = " + k + "）" },
          { k: "效率", v: "E = " + busyCells + " 格 / " + all + " 格 = " + fmt(P.E, 4), ok: Math.abs(busyCells / all - P.E) < 1e-12 }
        ], upto !== Infinity ? { t: "正在播放：第 " + Math.min(upto + 1, cols) + " 拍" } : null);
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 12 扩展操作码 ---------- */
  PROP.push({
    id: "co-opcode", sub: "co", ch: CH.c4, name: "扩展操作码的编码条件",
    def: "扩展操作码：指令字长固定，地址码少的指令把多出的地址字段让给操作码，操作码长度随地址数减少而增加。短操作码中留出的若干编码作为“扩展窗口”，充当更长操作码的前缀。",
    stmt: [
      "某级操作码 m 位、该类指令 x 条：剩余 **2ᵐ − x** 个编码作为扩展窗口",
      "下一级可用编码数 = (2ᵐ − x) × **2ᵈ**，d 为新增的操作码位数（让出的地址字段位数）",
      "逐级扣除，每一级指令数都不超过该级可用编码数才能编码；短操作码不能是长操作码的前缀"
    ],
    cond: "操作码按前缀码设计（短码不是长码的前缀），各类指令按地址数从多到少排列；指令字长固定、各地址字段等长。若题目说“操作码定长”则不能扩展，所有指令共用 ⌈log₂(总条数)⌉ 位操作码。",
    proof: [
      "地址最多的一类（例如三地址）留给操作码 m = 字长 − 3A 位，共 2ᵐ 个编码。",
      "该类 x 条指令各占一个编码，剩下 2ᵐ − x 个作为扩展窗口，不能再单独作为指令。",
      "下一类（二地址）把一个 A 位地址字段并入操作码，每个窗口后面接 A 位，得到 (2ᵐ − x) × 2ᴬ 个编码。",
      "依此类推：每一级可用编码 = 上一级剩下的窗口数 × 2ᵈ。",
      "最后一级的指令数不超过可用编码数就能编码；求最短字长就从小到大试，直到每一级都放得下。"
    ],
    traps: [
      "剩余窗口要乘 2ᵈ 而不是加 2ᵈ，而且要先减去本级已经用掉的编码。",
      "求“至少多少位”时，若指令要按字节存放，算出的位数还要向上取到 8 的倍数。",
      "“最多还能有多少条一地址指令”是在其他各级占用之后剩下的量，各级此消彼长。"
    ],
    ex: {
      q: "某计算机按字节编址，指令字长固定且只有两种指令格式，其中三地址指令 29 条，二地址指令 107 条，每个地址字段为 6 位，则指令字长至少应该是（ ）。",
      opts: ["24 位", "26 位", "28 位", "32 位"], a: 0,
      why: "设三地址指令操作码 m 位：需要 2ᵐ ≥ 29，且剩下的 (2ᵐ − 29) × 2⁶ ≥ 107，即 2ᵐ − 29 ≥ 2，2ᵐ ≥ 31，m = 5。字长 = 5 + 3 × 6 = 23 位；按字节编址，指令长度取 8 的倍数，至少 24 位。",
      src: "2017 年真题"
    },
    links: { lab: ["addressing"], proc: [] },
    demo: function (box) {
      var K = kit(box, "扩展操作码可行性检查");
      var LIn = K.num("指令字长 L", 16, function () { draw(); });
      var AIn = K.num("地址码位数 A", 4, function () { draw(); });
      K.row();
      var cls = [3, 2, 1, 0].map(function (a, i) { return { addr: a, inp: K.num(a + " 地址指令条数", [15, 15, 15, 16][i], function () { draw(); }) }; });
      K.row();
      K.btn("经典示例：16 位，15/15/15/16", function () { LIn.value = 16; AIn.value = 4; [15, 15, 15, 16].forEach(function (v, i) { cls[i].inp.value = v; }); draw(); });
      K.btn("2017 真题：29 条三地址、107 条二地址", function () { LIn.value = 24; AIn.value = 6; [29, 107, "", ""].forEach(function (v, i) { cls[i].inp.value = v; }); draw(); });
      K.btn("求最短字长", function () {
        try {
          var A = need(AIn, "地址码位数", { int: true, min: 1, max: 24 }), cs = gather();
          var r = opcodeMinLen(A, cs);
          if (r.err) throw r.err;
          LIn.value = r.bits; draw();
          K.show([{ k: "最短字长", v: r.bits + " 位；若指令按字节存放，取 " + r.bytes + " 位", hl: true }].concat(last));
        } catch (e) { if (typeof e !== "string") throw e; K.setErr(e); }
      });
      var last = [];
      function gather() {
        var cs = [];
        cls.forEach(function (c) {
          if (c.inp.value.trim() === "") return;
          cs.push({ addr: c.addr, num: need(c.inp, c.addr + " 地址指令条数", { int: true, min: 0 }) });
        });
        if (!cs.length) throw "至少填写一类指令的条数";
        return cs;
      }
      var draw = guard(K, function () {
        var L = need(LIn, "指令字长", { int: true, min: 2, max: 48 }), A = need(AIn, "地址码位数", { int: true, min: 1, max: 24 });
        var cs = gather(), r = opcodeCheck(L, A, cs);
        if (r.err) throw r.err;
        var svg = K.svg(720, 40 + r.steps.length * 62, "各级操作码编码空间的分配");
        tx(svg, 14, 22, "每一行是一级操作码的编码空间：深色为本级指令，浅色为留给下一级的扩展窗口", { size: 13, fill: C.gray });
        r.steps.forEach(function (st, i) {
          var y = 36 + i * 62, X0 = 150, W = 540;
          tx(svg, 14, y + 20, st.addr + " 地址", { bold: true });
          tx(svg, 14, y + 40, "操作码 " + st.op + " 位", { size: 13, fill: C.gray });
          rect(svg, X0, y + 4, W, 30, C.faint, { stroke: C.line });
          var used = st.avail ? Math.min(st.num, st.avail) / st.avail * W : 0;
          rect(svg, X0, y + 4, used, 30, st.ok ? C.co : C.bad, { rx: 2 });
          if (st.ok && st.left > 0) rect(svg, X0 + used, y + 4, st.left / st.avail * W, 30, C.goldSoft, { stroke: C.gold, rx: 2 });
          var label = "可用 " + st.avail + "：用 " + st.num + (st.ok ? "，留 " + st.left + " 个窗口" : "，不够！缺 " + (st.num - st.avail));
          tx(svg, X0 + 8, y + 24, label, { size: 13, bold: true, fill: used > 300 ? C.paper : C.ink });
          if (i < r.steps.length - 1) tx(svg, X0 + W, y + 52, "→ × 2" + sup(r.steps[i + 1].d) + " = " + r.steps[i + 1].avail, { anchor: "end", size: 13, fill: C.gold });
        });
        last = r.steps.map(function (st, i) {
          return { k: st.addr + " 地址指令", v: (i ? "上级窗口 × 2" + sup(st.d) + " = " : "2" + sup(st.op) + " = ") + st.avail + " 个编码，需要 " + st.num, ok: st.ok };
        });
        last.push({ k: "结论", v: r.ok ? "可以编码；在其他各级不变时，最后一级最多 " + r.maxLast + " 条" : "第 " + (r.failAt + 1) + " 级编码不够，无法实现", ok: r.ok, hl: true });
        K.show(last);
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 13 总线带宽 ---------- */
  PROP.push({
    id: "co-bus-bw", sub: "co", ch: CH.c6, name: "总线带宽",
    def: "总线宽度是数据线的位数；总线时钟频率是总线时钟每秒的周期数；一个总线周期（一次传输）可能占若干个时钟周期，一个时钟周期也可能传送多次（DDR 2 次、QDR 4 次）。总线带宽是单位时间内总线上能传送的最大数据量。",
    stmt: [
      "**总线带宽 = 总线宽度（字节）× 总线工作频率**（每秒传输次数）",
      "每次传输占 c 个时钟周期：带宽 = 宽度 × 时钟频率 / c；每个时钟周期传 q 次：带宽 = 宽度 × 时钟频率 × q",
      "突发传送：一个地址周期后连续传 m 个数据，有效带宽 = m × 宽度 ÷ ((地址周期 + m) × 每个总线周期的时间)"
    ],
    cond: "带宽指总线能达到的最高传输率；408 中 MB/s 一般按 10⁶ B/s 计算（题目另有说明除外）。“工作频率”是每秒传输次数，“时钟频率”是时钟本身的频率，两者在 DDR 或多周期总线上不相等。突发传送只在开头给一次地址。",
    proof: [
      "每次传输并行送出 宽度/8 个字节。",
      "每秒传输的次数就是总线工作频率。",
      "两者相乘就是每秒传送的字节数，即总线带宽。",
      "若一次传输占 c 个时钟周期，工作频率 = 时钟频率 / c；若一个时钟周期传 q 次，工作频率 = 时钟频率 × q。",
      "突发传送先用地址周期送出首地址，随后每个周期送一个数据：有效带宽 = 数据总量 ÷ 总时间，突发越长越接近峰值带宽。"
    ],
    traps: [
      "“一个总线周期占用 2 个时钟周期”要除以 2；“一个时钟周期传 2 次”要乘以 2。",
      "宽度给的是位，换成字节要除以 8；MB/s 与 Mb/s 相差 8 倍。",
      "非突发方式下每个数据前都要一个地址周期，有效带宽只有峰值的一半左右。"
    ],
    ex: {
      q: "假设某系统总线在一个总线周期中并行传输 4 字节信息，一个总线周期占用 2 个时钟周期，总线时钟频率为 10 MHz，则总线带宽是（ ）。",
      opts: ["10 MB/s", "20 MB/s", "40 MB/s", "80 MB/s"], a: 1,
      why: "总线工作频率 = 10 MHz ÷ 2 = 5 MHz，带宽 = 4 B × 5 MHz = 20 MB/s。忘记“一个总线周期占用 2 个时钟周期”会得到 40 MB/s。",
      src: "2009 年真题"
    },
    links: { lab: [], proc: ["icycle"] },
    demo: function (box) {
      var K = kit(box, "总线带宽与时序");
      var mode = "peak";
      var wIn = K.num("总线宽度（位）", 32, function () { draw(); });
      var fIn = K.num("时钟频率（MHz）", 10, function () { draw(); });
      var cIn = K.num("每次传输占时钟周期数", 2, function () { draw(); });
      K.row();
      var qSeg = K.seg("每个时钟周期传", [{ v: 1, t: "1 次" }, { v: 2, t: "2 次（DDR）" }, { v: 4, t: "4 次（QDR）" }], 1, function () { draw(); });
      K.row();
      var mSeg = K.seg("方式", [{ v: "peak", t: "峰值（只看数据）" }, { v: "burst", t: "突发：1 地址 + m 数据" }, { v: "single", t: "非突发：每个数据 1 地址" }], "peak", function (v) { mode = v; draw(); });
      var bIn = K.num("突发长度 m", 4, function () { draw(); });
      K.row();
      K.btn("2009 真题：4 B、10 MHz、2 个时钟周期", function () { wIn.value = 32; fIn.value = 10; cIn.value = 2; qSeg.set(1); mode = "peak"; mSeg.set("peak"); draw(); });
      var draw = guard(K, function () {
        var w = need(wIn, "总线宽度", { pos: true }), f = need(fIn, "时钟频率", { pos: true }) * 1e6, c = need(cIn, "每次传输的时钟周期数", { pos: true, int: true, max: 8 });
        var q = qSeg.get(), m = mode === "burst" ? need(bIn, "突发长度", { int: true, min: 1, max: 16 }) : 1;
        var P = busBW(w, f, c, q);
        if (P.err) throw P.err;
        var eff = P.bw, slots = [];
        if (mode === "peak") { for (var i = 0; i < 8; i++) slots.push("D"); }
        else if (mode === "burst") { slots.push("A"); for (var j = 0; j < m; j++) slots.push("D"); }
        else { for (var k2 = 0; k2 < 4; k2++) { slots.push("A"); slots.push("D"); } }
        if (mode !== "peak") eff = burstBW(w, P.rate, mode === "burst" ? 1 : 1, mode === "burst" ? m : 1, 1).bw;
        var nClk = Math.min(16, Math.ceil(slots.length * c / q)), X0 = 110, X1 = 700, cw = (X1 - X0) / Math.max(nClk, 1);
        var svg = K.svg(720, 160, "总线时钟与每次传输的时序");
        tx(svg, 14, 40, "时钟", { size: 13, fill: C.gray });
        var d = "M" + X0 + " 50";
        for (var t = 0; t < nClk; t++) { var x = X0 + t * cw; d += " L" + x + " 26 L" + (x + cw / 2) + " 26 L" + (x + cw / 2) + " 50 L" + (x + cw) + " 50"; }
        sv("path", { d: d, fill: "none", stroke: C.ink, "stroke-width": 1.5 }, svg);
        tx(svg, 14, 92, "数据总线", { size: 13, fill: C.gray });
        var sw = cw * c / q, dn = 0;
        for (var s = 0; s < slots.length && X0 + (s + 1) * sw <= X1 + 0.5; s++) {
          var isA = slots[s] === "A";
          if (!isA) dn++;
          rect(svg, X0 + s * sw + 1, 72, sw - 2, 30, isA ? C.blueSoft : C.soft, { stroke: isA ? C.blue : C.co, rx: 2 });
          if (sw > 24) tx(svg, X0 + s * sw + sw / 2, 92, isA ? "A" : "D" + dn, { anchor: "middle", size: 13, mono: true });
        }
        tx(svg, X0, 130, "每次传输 " + w / 8 + " B，占 " + c + " 个时钟周期" + (q > 1 ? "，每个时钟周期传 " + q + " 次" : ""), { size: 13, fill: C.gray });
        tx(svg, X0, 150, "工作频率 = " + fmt(f / 1e6, 4) + " MHz × " + q + " ÷ " + c + " = " + fmt(P.rate / 1e6, 4) + " MHz", { size: 13, fill: C.gray });
        K.show([
          { k: "峰值带宽", v: w / 8 + " B × " + fmt(P.rate / 1e6, 4) + " MHz = " + fmt(P.bw / 1e6, 4) + " MB/s", hl: true },
          { k: "另一种算法", v: "宽度 ÷ 总线周期 = " + w / 8 + " B ÷ " + fmt(c / q / f * 1e9, 4) + " ns = " + fmt(w / 8 / (c / q / f) / 1e6, 4) + " MB/s", ok: Math.abs(w / 8 / (c / q / f) - P.bw) < 1e-6 * P.bw },
          mode !== "peak" ? { k: mode === "burst" ? "突发有效带宽" : "非突发有效带宽", v: (mode === "burst" ? m + " 个数据 / (1 + " + m + ") 个总线周期" : "1 个数据 / 2 个总线周期") + " → " + fmt(eff / 1e6, 4) + " MB/s（峰值的 " + pct(eff / P.bw) + "）" } : null
        ]);
      });
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ---------- 14 I/O 方式的 CPU 开销 ---------- */
  PROP.push({
    id: "co-io-overhead", sub: "co", ch: CH.c7, name: "程序查询、中断与 DMA 的 CPU 占用率",
    def: "程序查询方式由 CPU 反复查询设备状态再传送；中断方式在设备准备好一个数据后发出中断请求，由中断服务程序传送；DMA 方式由 DMA 控制器直接在设备与主存之间传送整块数据，CPU 只做预处理和后处理。",
    stmt: [
      "**程序查询**：CPU 占用率 = 每秒查询次数 × 每次查询的时钟周期数 ÷ 主频",
      "**中断**：占用率 = 每秒中断次数（数据传输率 ÷ 每次传送的数据量）× 每次中断的时钟周期数 ÷ 主频",
      "**DMA**：占用率 = 每秒传送的数据块数 × 每块预处理与后处理的时钟周期数 ÷ 主频"
    ],
    cond: "假设每次查询或中断正好传送一个数据单位，为了不丢数据，每秒至少要处理（数据传输率 ÷ 单位）次；DMA 与 CPU 不发生访存冲突（忽略周期挪用的影响）。算出的占用率超过 100% 说明这种方式满足不了该设备。",
    proof: [
      "设备每秒产生 R 字节，每次传送 u 字节，CPU 每秒至少要处理 R/u 次。",
      "程序查询每次花 c₁ 个时钟周期：每秒用掉 (R/u) × c₁ 个周期，除以主频 f 得到占用比例。",
      "中断方式每次服务（响应、保护现场、传送、恢复现场）共 c₂ 个周期：占用率 = (R/u) × c₂ / f。",
      "DMA 每块 B 字节只在开始和结束时打扰 CPU：每秒 R/B 块，每块 c₃ 个周期，占用率 = (R/B) × c₃ / f。",
      "B 远大于 u，所以 DMA 的占用率比中断方式低几个数量级，适合高速设备。"
    ],
    traps: [
      "中断服务的时钟周期数 = 指令条数 × CPI；“其他开销相当于 2 条指令”也要算进去并乘 CPI。",
      "数据率 0.5 MB/s 一般按 0.5 × 10⁶ B/s 计算；以 32 位为传输单位即每次 4 字节。",
      "DMA 方式下 CPU 只在预处理和后处理时被占用，块内每个字的传送不占 CPU 时间。"
    ],
    ex: {
      q: "某计算机的 CPU 主频为 500 MHz，CPI 为 5。某外设的数据传输率为 0.5 MB/s，采用中断方式与主机进行数据传送，以 32 位为传输单位，对应的中断服务程序包含 18 条指令，中断服务的其他开销相当于 2 条指令的执行时间。CPU 用于该外设 I/O 的时间占整个 CPU 时间的百分比是（ ）。",
      opts: ["0.5%", "2.25%", "2.5%", "10%"], a: 2,
      why: "每次中断 (18 + 2) × 5 = 100 个时钟周期；每秒中断 0.5 × 10⁶ ÷ 4 = 1.25 × 10⁵ 次；占用率 1.25 × 10⁵ × 100 ÷ (500 × 10⁶) = 2.5%。忘记乘 CPI 得 0.5%，漏掉 2 条其他开销得 2.25%，误按每次 1 字节得 10%。原题为综合应用题第 43 题第 (1) 问，这里改为选择题。",
      src: "2009 年真题"
    },
    links: { lab: [], proc: ["intr", "dma"] },
    demo: function (box) {
      var K = kit(box, "三种 I/O 方式 CPU 占用率对比");
      var fIn = K.num("主频（MHz）", 500, function () { draw(); });
      var rIn = K.num("设备数据率（MB/s）", 0.5, function () { draw(); });
      var uIn = K.num("每次传送（字节）", 4, function () { draw(); });
      K.row();
      var pIn = K.num("每次查询时钟周期", 100, function () { draw(); });
      var iIn = K.num("每次中断时钟周期", 100, function () { draw(); });
      K.row();
      var bIn = K.num("DMA 块大小（字节）", 5000, function () { draw(); });
      var dIn = K.num("每块预/后处理周期", 500, function () { draw(); });
      K.row();
      function preset(r) { fIn.value = 500; rIn.value = r; uIn.value = 4; iIn.value = 100; bIn.value = 5000; dIn.value = 500; draw(); }
      K.btn("2009 真题 (1)：0.5 MB/s", function () { preset(0.5); });
      K.btn("2009 真题 (2)：5 MB/s", function () { preset(5); });
      var draw = guard(K, function () {
        var o = {
          f: need(fIn, "主频", { pos: true }) * 1e6, rate: need(rIn, "数据率", { pos: true }) * 1e6, unit: need(uIn, "每次传送字节数", { pos: true }),
          pollCycles: need(pIn, "每次查询周期", { pos: true }), intrCycles: need(iIn, "每次中断周期", { pos: true }),
          block: need(bIn, "DMA 块大小", { pos: true }), dmaCycles: need(dIn, "DMA 预/后处理周期", { pos: true })
        };
        var r = ioShare(o);
        if (r.err) throw r.err;
        var X0 = 150, X1 = 690, lo = -5, hi = 2.2;
        var mx = function (v) { var l = Math.log(Math.max(v * 100, 1e-5)) / Math.LN10; return X0 + (Math.min(l, hi) - lo) / (hi - lo) * (X1 - X0); };
        var svg = K.svg(720, 200, "三种方式的 CPU 占用率（对数坐标）");
        [1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 0.1, 1].forEach(function (v) {
          var x = mx(v); line(svg, x, 30, x, 160, v === 1 ? C.bad : C.line, { dash: v === 1 ? "5 4" : null });
          tx(svg, x, 180, pct(v), { anchor: "middle", size: 13, fill: v === 1 ? C.bad : C.gray });
        });
        [["程序查询", r.poll, C.gold], ["中断", r.intr, C.blue], ["DMA", r.dma, C.co]].forEach(function (d, i) {
          var y = 40 + i * 40, bad = d[1] > 1;
          tx(svg, 14, y + 20, d[0], { bold: true });
          rect(svg, X0, y, mx(d[1]) - X0, 26, bad ? C.bad : d[2], { rx: 3 });
          var w = mx(d[1]) - X0;
          tx(svg, w > 120 ? mx(d[1]) - 8 : mx(d[1]) + 8, y + 18, pct(d[1]) + (bad ? " 不可行" : ""), { anchor: w > 120 ? "end" : "start", size: 13, bold: true, fill: w > 120 ? C.paper : (bad ? C.bad : C.ink) });
        });
        K.show([
          { k: "每秒处理次数", v: "R/u = " + fmt(o.rate) + " ÷ " + fmt(o.unit) + " = " + fmt(r.perSec) + " 次；DMA 每秒 " + fmt(r.blocks) + " 块" },
          { k: "程序查询", v: fmt(r.perSec) + " × " + fmt(o.pollCycles) + " ÷ " + par(sci(o.f, 3)) + " = " + pct(r.poll), ok: r.poll <= 1 },
          { k: "中断", v: fmt(r.perSec) + " × " + fmt(o.intrCycles) + " ÷ " + par(sci(o.f, 3)) + " = " + pct(r.intr), ok: r.intr <= 1, hl: true },
          { k: "DMA", v: fmt(r.blocks) + " × " + fmt(o.dmaCycles) + " ÷ " + par(sci(o.f, 3)) + " = " + pct(r.dma), ok: r.dma <= 1 }
        ], { t: "✓ 表示 CPU 忙得过来（占用率 ≤ 100%）；同一设备中断方式的占用率是 DMA 的 " + fmt(r.intr / r.dma, 4) + " 倍。" });
      });
      draw();
      return { destroy: K.destroy };
    }
  });
})();
