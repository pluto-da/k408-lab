/* 计算机网络动画实验（7 个）：滑动窗口（停等 / GBN / SR）、CSMA/CD 与二进制指数退避、CRC 校验、IP 分片、
   最长前缀匹配、数字编码、RIP 距离向量。沿用 08-lab.js 的实验壳：
   LAB.push({ id, name, color, note, mount: function (panel, K) { ... return { step, reset, done }; } })
   纯计算函数挂在 window.LABU 上（不碰 DOM），由 src/legacy/labcn.test.ts 做单元测试。
   约定：mount 之外不访问 document / X，保证脚本能在 node:vm 沙箱里加载。 */
(function () {
  var LAB = window.LAB = window.LAB || [];
  var LABU = window.LABU = window.LABU || {};
  var CN = "var(--x-cn)";

  /* ================= 通用小工具 ================= */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function isBits(s) { return /^[01]+$/.test(s); }
  function toInt(v) { if (typeof v === "number") return Math.floor(v) === v ? v : NaN; v = String(v == null ? "" : v).trim(); return /^-?\d+$/.test(v) ? parseInt(v, 10) : NaN; }
  function toNum(v) { if (typeof v === "number") return v; v = String(v == null ? "" : v).trim(); return /^\d+(\.\d+)?$/.test(v) ? parseFloat(v) : NaN; }
  function xorStr(a, b) { var r = ""; for (var i = 0; i < a.length; i++) r += a.charAt(i) === b.charAt(i) ? "0" : "1"; return r; }
  function zeros(n) { var s = ""; while (s.length < n) s += "0"; return s; }
  function fmt(v) { return String(Math.round(v * 1000) / 1000); }
  function jn(a) { return a.join("、"); }
  function E(msg) { return { err: msg }; }
  LABU.fmt = fmt;

  /* 逗号 / 空格 / 顿号分隔的非负整数列表；空串得 [] */
  LABU.parseList = function (s) {
    if (Array.isArray(s)) return s.slice();
    s = String(s == null ? "" : s).trim();
    if (!s) return [];
    var parts = s.split(/[\s,，、;；]+/), out = [];
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var v = toInt(parts[i]);
      if (isNaN(v) || v < 0) return E("“" + parts[i] + "”不是非负整数，帧编号请用逗号分隔，例如 2,5");
      if (out.indexOf(v) < 0) out.push(v);
    }
    return out;
  };

  /* ================= CRC ================= */
  var SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
  /* "1101" 或 "x^3+x^2+1" / "x³+x²+1" → { bits } | { err } */
  LABU.parsePoly = function (s) {
    s = String(s == null ? "" : s).replace(/\s+/g, "");
    if (!s) return E("请输入生成多项式，例如 1101 或 x^3+x^2+1");
    var bits;
    if (/^[01]+$/.test(s)) bits = s;
    else {
      var t = s.replace(/X/g, "x").replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, function (m) {
        var r = "^"; for (var i = 0; i < m.length; i++) r += SUP[m.charAt(i)]; return r;
      });
      var terms = t.split("+"), pw = {}, max = -1;
      for (var i = 0; i < terms.length; i++) {
        var term = terms[i], p;
        if (term === "1") p = 0;
        else {
          var m = /^x(?:\^(\d+))?$/.exec(term);
          if (!m) return E("无法识别多项式中的“" + (term || "空项") + "”，请写成 1101 或 x^3+x^2+1 的形式");
          p = m[1] ? parseInt(m[1], 10) : 1;
        }
        if (pw[p]) return E("多项式中 x^" + p + " 出现了两次（模 2 下会相互抵消），请合并后再输入");
        pw[p] = true; if (p > max) max = p;
      }
      if (max > 30) return E("多项式次数过高");
      bits = "";
      for (var q = max; q >= 0; q--) bits += pw[q] ? "1" : "0";
    }
    if (bits.charAt(0) !== "1") return E("生成多项式的最高位必须为 1（例如 1101），现在是 " + bits);
    if (bits.length < 2) return E("生成多项式至少 2 位（最高次 ≥ 1），例如 11 或 1101");
    if (bits.length > 13) return E("生成多项式最多 13 位（最高次 ≤ 12），演示用");
    return { bits: bits };
  };
  /* 模 2 除法：dividend、gen 均为 0/1 串，返回逐步过程 */
  LABU.mod2div = function (dividend, gen) {
    var g = gen.length, steps = [], q = "", cur = dividend.substr(0, g), rem = cur.substr(1);
    for (var i = 0; i + g <= dividend.length; i++) {
      var lead = cur.charAt(0), sub = lead === "1" ? gen : zeros(g), x = xorStr(cur, sub), down = dividend.charAt(i + g);
      rem = x.substr(1);
      q += lead;
      steps.push({ i: i, win: cur, q: lead, sub: sub, xor: x, rem: rem, down: down });
      cur = rem + down;
    }
    return { steps: steps, quotient: q, remainder: rem };
  };
  function crcArgs(bitsLabel, s, gen, maxLen) {
    s = String(s == null ? "" : s).replace(/\s+/g, "");
    if (!s) return E("请输入" + bitsLabel);
    if (!isBits(s)) return E(bitsLabel + "只能包含 0 和 1");
    if (s.length > maxLen) return E(bitsLabel + "最多 " + maxLen + " 位（演示用）");
    var P = typeof gen === "string" ? LABU.parsePoly(gen) : gen;
    if (!P || P.err) return E(P ? P.err : "请输入生成多项式");
    return { s: s, g: P.bits, r: P.bits.length - 1 };
  }
  /* 发送端：数据后补 r 个 0 再做模 2 除法，余数即 FCS */
  LABU.crc = function (data, gen) {
    var a = crcArgs("数据位串", data, gen, 24);
    if (a.err) return a;
    var dividend = a.s + zeros(a.r), D = LABU.mod2div(dividend, a.g);
    return { data: a.s, gen: a.g, r: a.r, dividend: dividend, steps: D.steps, quotient: D.quotient, remainder: D.remainder, codeword: a.s + D.remainder };
  };
  /* 接收端：用同一生成多项式去除收到的整串，余数全 0 才判无差错 */
  LABU.crcCheck = function (recv, gen) {
    var a = crcArgs("接收位串", recv, gen, 36);
    if (a.err) return a;
    if (a.s.length <= a.r) return E("接收位串应比生成多项式长（至少 " + (a.r + 1) + " 位），其中末尾 " + a.r + " 位是 FCS");
    var D = LABU.mod2div(a.s, a.g);
    return { recv: a.s, gen: a.g, r: a.r, dividend: a.s, steps: D.steps, quotient: D.quotient, remainder: D.remainder, ok: !/1/.test(D.remainder) };
  };

  /* ================= IP 分片 ================= */
  LABU.ipFrag = function (total, hdr, mtu, df) {
    total = toInt(total); hdr = toInt(hdr); mtu = toInt(mtu);
    if (isNaN(total) || isNaN(hdr) || isNaN(mtu) || total <= 0 || hdr <= 0 || mtu <= 0) return E("总长度、首部长度、MTU 都应为正整数（单位：字节）");
    if (hdr < 20 || hdr > 60 || hdr % 4) return E("首部长度应为 20–60 字节且是 4 的倍数（首部长度字段以 4 字节为单位）");
    if (total > 65535) return E("总长度最大 65535 字节（总长度字段只有 16 位）");
    if (total <= hdr) return E("总长度必须大于首部长度，数据报至少要带 1 字节数据");
    if (mtu > 65535) return E("MTU 应不超过 65535 字节");
    if (mtu < hdr + 8) return E("MTU 不能小于首部长度 + 8 = " + (hdr + 8) + " 字节，否则一片连 8 字节数据都装不下");
    var data = total - hdr, room = mtu - hdr, max = Math.floor(room / 8) * 8, df1 = !!df && df !== "0";
    var R = { total: total, hdr: hdr, mtu: mtu, df: df1, data: data, room: room, max: max, need: total > mtu, drop: false, frags: [] };
    if (!R.need) { R.frags.push({ i: 0, start: 0, end: data - 1, len: data, off: 0, mf: 0, total: total }); return R; }
    if (df1) { R.drop = true; return R; }
    if (Math.ceil(data / max) > 32) return E("会分成 " + Math.ceil(data / max) + " 片，超过演示上限 32 片，请调大 MTU 或调小总长度");
    for (var start = 0, i = 0; start < data; i++) {
      var len = Math.min(max, data - start), last = start + len >= data;
      R.frags.push({ i: i, start: start, end: start + len - 1, len: len, off: start / 8, mf: last ? 0 : 1, total: len + hdr });
      start += len;
    }
    return R;
  };

  /* ================= IPv4 与最长前缀匹配 ================= */
  LABU.parseIp = function (s) {
    var m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*$/.exec(String(s == null ? "" : s));
    if (!m) return NaN;
    var u = 0;
    for (var i = 1; i <= 4; i++) { var v = parseInt(m[i], 10); if (v > 255) return NaN; u = u * 256 + v; }
    return u;
  };
  LABU.ipStr = function (u) { return [u >>> 24, (u >>> 16) & 255, (u >>> 8) & 255, u & 255].join("."); };
  LABU.mask = function (n) { return n === 0 ? 0 : (0xFFFFFFFF << (32 - n)) >>> 0; };
  LABU.bin = function (u) { var s = (u >>> 0).toString(2); while (s.length < 32) s = "0" + s; return s; };
  /* 每行“目的网络/前缀 下一跳 [接口]” → { rows } | { err } */
  LABU.parseTable = function (text) {
    var lines = String(text == null ? "" : text).split(/\r?\n/), rows = [];
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln) continue;
      var f = ln.split(/[\s,，]+/), m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(f[0]);
      var where = "路由表第 " + (rows.length + 1) + " 行“" + ln + "”：";
      if (!m) return E(where + "目的网络应写成 a.b.c.d/前缀，例如 128.96.39.0/25");
      var net = LABU.parseIp(m[1]), len = parseInt(m[2], 10);
      if (isNaN(net)) return E(where + "IP 地址每段应在 0–255 之间");
      if (len > 32) return E(where + "前缀长度应在 0–32 之间");
      if (((net & LABU.mask(len)) >>> 0) !== net) return E(where + "主机号部分不全为 0，按 /" + len + " 网络地址应为 " + LABU.ipStr((net & LABU.mask(len)) >>> 0));
      if (!f[1]) return E(where + "缺少下一跳（直接相连的网络写“直接交付”）");
      rows.push({ net: net, len: len, hop: f[1], ifc: f[2] || "—" });
    }
    if (!rows.length) return E("路由表至少要有一条表项");
    if (rows.length > 10) return E("路由表最多 10 条（演示用）");
    return { rows: rows };
  };
  /* table: [{ net: 数或点分串, len, hop, ifc }]，ip: 数或点分串 */
  LABU.lpm = function (table, ip) {
    var d = typeof ip === "number" ? ip : LABU.parseIp(ip);
    if (isNaN(d)) return E("目的 IP 格式应为 a.b.c.d，每段 0–255，例如 128.96.39.10");
    var rows = [], best = -1;
    for (var i = 0; i < table.length; i++) {
      var t = table[i], net = typeof t.net === "number" ? t.net : LABU.parseIp(t.net), m = LABU.mask(t.len), and = (d & m) >>> 0;
      var hit = and === net;
      rows.push({ net: net, len: t.len, mask: m, and: and, match: hit, hop: t.hop, ifc: t.ifc });
      if (hit && (best < 0 || t.len > rows[best].len)) best = i;
    }
    return { ip: d, rows: rows, best: best, entry: best >= 0 ? rows[best] : null, isDefault: best >= 0 && rows[best].len === 0 };
  };

  /* ================= 数字编码 ================= */
  /* 每位两个半周期电平（1 高 0 低）。inv=false：曼彻斯特位中间高→低表示 1（站内约定）；inv=true 相反。
     NRZI、差分曼彻斯特假设信号开始前为低电平。 */
  LABU.encode = function (bits, inv) {
    bits = String(bits == null ? "" : bits).replace(/\s+/g, "");
    if (!bits) return E("请输入比特串，例如 0110");
    if (!isBits(bits)) return E("比特串只能包含 0 和 1");
    if (bits.length > 16) return E("比特串最多 16 位（演示用）");
    var W = { nrz: [], nrzi: [], man: [], dman: [] }, li = 0, ld = 0;
    for (var i = 0; i < bits.length; i++) {
      var b = bits.charAt(i) === "1" ? 1 : 0;
      W.nrz.push(b, b);
      if (b) li = 1 - li;
      W.nrzi.push(li, li);
      var hiFirst = inv ? !b : !!b;
      W.man.push(hiFirst ? 1 : 0, hiFirst ? 0 : 1);
      var f = b ? ld : 1 - ld;
      W.dman.push(f, 1 - f); ld = 1 - f;
    }
    var mid = {}, start = {};
    for (var k in W) {
      mid[k] = []; start[k] = [];
      for (var j = 0; j < bits.length; j++) {
        var w = W[k], prev = j ? w[2 * j - 1] : 0;
        mid[k].push(w[2 * j] !== w[2 * j + 1]);
        start[k].push(w[2 * j] !== prev);
      }
    }
    return { bits: bits, n: bits.length, inv: !!inv, waves: W, mid: mid, start: start };
  };

  /* ================= CSMA/CD ================= */
  LABU.backoff = function (k, slot) {
    k = toInt(k); slot = slot == null ? 51.2 : toNum(slot);
    if (isNaN(k) || k < 1 || k > 16) return E("冲突次数 k 应为 1–16 的整数");
    if (isNaN(slot) || slot <= 0) return E("争用期 2τ 应为正数（单位 μs），以太网为 51.2");
    if (k >= 16) return { k: k, slot: slot, giveUp: true };
    var m = Math.min(k, 10), max = Math.pow(2, m) - 1;
    return { k: k, slot: slot, giveUp: false, m: m, min: 0, max: max, maxWait: max * slot };
  };
  /* 最短帧长 = 争用期 × 数据率；Mb/s × μs = bit */
  LABU.minFrame = function (rateMbps, slotUs) {
    var r = toNum(rateMbps), s = toNum(slotUs);
    if (isNaN(r) || r <= 0) return E("数据率应为正数（单位 Mb/s）");
    if (isNaN(s) || s <= 0) return E("争用期 2τ 应为正数（单位 μs）");
    var bits = Math.round(r * s * 1000) / 1000;
    return { bits: bits, bytes: bits / 8 };
  };

  /* ================= 滑动窗口模拟 ================= */
  /* opts: { mode: "sw"|"gbn"|"sr", bits, sw, rw, n, lost: 帧编号列表, lostAck: 帧编号列表 }
     时间以单程传播时延 τ 为单位：发一帧 0.25τ，ACK 发送时间忽略，RTT = 2τ，超时 3τ（从帧发完算起）。
     lost：该帧第一次发送时丢失；lostAck：该帧第一次到达后接收方回的那个 ACK 丢失。 */
  LABU.slideSim = function (o) {
    o = o || {};
    var mode = o.mode || "gbn";
    if (mode !== "sw" && mode !== "gbn" && mode !== "sr") return E("协议只能是停等、GBN 或 SR");
    var bits = toInt(o.bits), sw = toInt(o.sw), rw = toInt(o.rw), n = toInt(o.n);
    if (mode === "sw") { bits = 1; sw = 1; rw = 1; }
    if (isNaN(bits) || bits < 1 || bits > 5) return E("序号位数 n 应为 1–5 的整数");
    var M = 1 << bits;
    if (isNaN(n) || n < 1 || n > 20) return E("帧数应为 1–20 的整数");
    if (isNaN(sw) || sw < 1) return E("发送窗口 W_T 应为正整数");
    if (mode === "gbn") {
      if (sw > M - 1) return E("GBN 发送窗口必须满足 1 ≤ W_T ≤ 2^n − 1 = " + (M - 1) + "（现在 W_T = " + sw + "）。若 W_T = 2^n，一轮确认全部丢失时，重发的旧帧与新一轮同序号的帧无法区分。");
      rw = 1;
    }
    if (mode === "sr") {
      if (isNaN(rw) || rw < 1) return E("接收窗口 W_R 应为正整数");
      if (rw > M / 2) return E("SR 接收窗口必须满足 W_R ≤ 2^(n−1) = " + (M / 2) + "（现在 W_R = " + rw + "），否则新旧帧序号会落进同一个接收窗口。");
      if (sw + rw > M) return E("SR 必须满足 W_T + W_R ≤ 2^n = " + M + "（现在 " + sw + " + " + rw + " = " + (sw + rw) + "）。");
    }
    var lost = LABU.parseList(o.lost), lostAck = LABU.parseList(o.lostAck);
    if (lost.err) return E("丢失帧：" + lost.err);
    if (lostAck.err) return E("丢失 ACK：" + lostAck.err);
    var all = lost.concat(lostAck);
    for (var z = 0; z < all.length; z++) if (all[z] >= n) return E("帧编号应在 0–" + (n - 1) + " 之间（共 " + n + " 帧，编号从 0 起），“" + all[z] + "”超出范围");
    var lostSet = {}, lostAckSet = {};
    lost.forEach(function (v) { lostSet[v] = true; });
    lostAck.forEach(function (v) { lostAckSet[v] = true; });

    var TF = 0.25, TO = 3, EPS = 1e-9;
    var Q = [], ord = 0, tx = [], steps = [], txFree = 0, tok = {}, firstSent = {}, ackLostUsed = {};
    var base = 0, next = 0, acked = {}, exp = 0, buf = {}, dlv = [], cnt = 0, retx = [];
    var NAME = { sw: "停等", gbn: "GBN", sr: "SR" };
    function fname(i) { return n > M ? "第 " + i + " 帧（序号 " + (i % M) + "）" : i + " 号帧"; }
    function flist(a) { return n > M ? "第 " + jn(a) + " 帧" : jn(a) + " 号帧"; }
    function wstr(a, w) {
      if (w === 1) return "{" + (a % M) + "}";
      if (a % M + w - 1 < M) return (a % M) + "–" + ((a + w - 1) % M);
      var s = []; for (var k = 0; k < w; k++) s.push((a + k) % M); return "{" + s.join(",") + "}";
    }
    function q(e) { e.o = ord++; Q.push(e); }
    function sendF(i, t, re) {
      var ts = Math.max(t, txFree), lostNow = !re && !!lostSet[i] && !firstSent[i];
      txFree = ts + TF; firstSent[i] = true;
      var x = { id: tx.length, f: true, i: i, seq: i % M, t0: ts, t1: ts + TF + (lostNow ? 0.5 : 1), lost: lostNow, re: !!re };
      tx.push(x); cnt++; if (re) retx.push(i);
      q({ t: x.t1, k: lostNow ? "fl" : "fa", x: x });
      tok[i] = (tok[i] || 0) + 1;
      q({ t: ts + TF + TO, k: "to", i: i, tok: tok[i] });
    }
    function fill(t) { var s = []; while (next < n && next < base + sw) { sendF(next, t, false); s.push(next); next++; } return s; }
    function sendA(seq, t, forIdx) {
      var lostNow = !!lostAckSet[forIdx] && !ackLostUsed[forIdx];
      if (lostNow) ackLostUsed[forIdx] = true;
      var a = { id: tx.length, f: false, i: forIdx, seq: seq, t0: t, t1: t + (lostNow ? 0.5 : 1), lost: lostNow };
      tx.push(a); q({ t: a.t1, k: lostNow ? "al" : "aa", x: a });
    }
    function snap(kind, t, text, ex) {
      ex = ex || {};
      var ak = {}; for (var k in acked) ak[k] = true;
      var bf = {}; for (var b in buf) bf[b] = true;
      steps.push({ kind: kind, t: t, text: text, nTx: tx.length, x: ex.x == null ? -1 : ex.x, i: ex.i == null ? -1 : ex.i,
        base: base, next: next, acked: ak, exp: exp, buf: bf, dlv: dlv.slice(), cnt: cnt, re: retx.length,
        sent: ex.sent || [], resent: ex.resent || [], deliver: ex.deliver || [] });
    }
    var rule = mode === "sw" ? "停等协议：序号只用 1 位（0、1 交替），发送窗口 = 接收窗口 = 1。" :
      mode === "gbn" ? "GBN：发送窗口 W_T = " + sw + "（要求 ≤ 2^n − 1 = " + (M - 1) + "），接收窗口固定为 1，只按序接收，累积确认。" :
      "SR：发送窗口 W_T = " + sw + "、接收窗口 W_R = " + rw + "（要求 W_R ≤ 2^(n−1) = " + (M / 2) + "，W_T + W_R ≤ 2^n = " + M + "），乱序帧先缓存，逐帧单独确认。";
    snap("init", 0, "准备发送 " + n + " 帧，序号 " + bits + " 位（0–" + (M - 1) + "）。" + rule + "时间以单程传播时延 τ 为单位：发一帧 0.25τ，RTT = 2τ，超时重传时间 3τ。");
    var first = fill(0);
    snap("send", 0, mode === "sw" ? "发送方发出 " + fname(0) + "并启动计时器：停等协议发送窗口为 1，必须等到确认才能发下一帧。" :
      "发送方连续发出 " + flist(first) + "，窗口框住 " + wstr(0, sw) + "：窗口内的帧不必等确认就能连续发送，每帧发出时启动计时器。", { sent: first });

    var guard = 0;
    while (Q.length && base < n && guard++ < 600) {
      var bi = 0;
      for (var j = 1; j < Q.length; j++) if (Q[j].t < Q[bi].t - EPS || (Math.abs(Q[j].t - Q[bi].t) < EPS && Q[j].o < Q[bi].o)) bi = j;
      var e = Q.splice(bi, 1)[0], t = e.t, x = e.x, txt, s;
      if (e.k === "to") {
        if (e.tok !== tok[e.i] || e.i < base || acked[e.i]) continue;
        if (mode === "sr") {
          sendF(e.i, t, true);
          snap("to", t, fname(e.i) + "的计时器超时（发完后 3τ 仍未收到对它的确认）：SR 只重发这一帧；其他已被接收方缓存并单独确认的帧不必重发。", { i: e.i, resent: [e.i] });
        } else {
          var rs = [];
          for (var c = base; c < next; c++) { sendF(c, t, true); rs.push(c); }
          snap("to", t, fname(e.i) + "的计时器超时（发完后 3τ 仍未收到确认）：" + (mode === "sw" ? "停等协议重发这一帧。" :
            "GBN 回退 N 帧，从 " + fname(base) + "起把已发送但未确认的 " + flist(rs) + "全部重发（接收方丢弃过的乱序帧也要重发）。"), { i: e.i, resent: rs });
        }
        continue;
      }
      if (e.k === "fl") {
        snap("fl", t, fname(x.i) + "在链路上丢失（画 ×）：接收方收不到它，发送方要等它的计时器超时才会重发。", { x: x.id, i: x.i });
        continue;
      }
      if (e.k === "al") {
        snap("al", t, "ACK" + x.seq + " 在链路上丢失（画 ×）：" + (mode === "gbn" ? "GBN 是累积确认，后面更大的 ACK 到达时会把它一并确认。" :
          mode === "sr" ? "发送方收不到对 " + fname(x.i) + "的确认，该帧超时后会被重发，接收方收到重复帧要再确认一次。" :
          "发送方收不到确认会超时重发，接收方收到重复帧后丢弃并再次确认。"), { x: x.id, i: x.i });
        continue;
      }
      if (e.k === "fa") {
        if (mode === "sr") {
          var i = x.i;
          if (i >= exp && i < exp + rw) {
            if (buf[i]) { sendA(x.seq, t, i); txt = fname(i) + "到达，但它已经缓存过（重复帧）：丢弃，并再次回送 ACK" + x.seq + "。"; s = {}; }
            else {
              buf[i] = true; sendA(x.seq, t, i);
              if (i === exp) {
                var run = [];
                while (buf[exp]) { delete buf[exp]; run.push(exp); dlv.push(exp); exp++; }
                txt = fname(i) + "到达，正是接收窗口最左端：" + (run.length > 1 ? "连同已缓存的 " + jn(run.slice(1)) + " 一起" : "") + "按序交付上层，回送单独确认 ACK" + x.seq +
                  "，接收窗口滑到 " + wstr(exp, rw) + "。";
                s = { deliver: run };
              } else {
                var miss = []; for (var mm = exp; mm < i; mm++) if (!buf[mm]) miss.push(mm % M);
                txt = fname(i) + "到达，落在接收窗口 " + wstr(exp, rw) + " 内但不是最左端（还缺 " + jn(miss) + "）：SR 先缓存，回送对它的单独确认 ACK" + x.seq + "。";
                s = {};
              }
            }
          } else if (i < exp) { sendA(x.seq, t, i); txt = fname(i) + "到达，但它早已交付（重复帧，说明之前的 ACK 丢了）：丢弃，但必须再发一次 ACK" + x.seq + "，否则发送方会一直重发。"; s = {}; }
          else { txt = fname(i) + "落在接收窗口之外，丢弃。"; s = {}; }
        } else if (x.seq === exp % M && x.i === exp) {
          dlv.push(exp); exp++; sendA(exp % M, t, x.i);
          txt = fname(x.i) + "到达，序号正是接收方期待的 " + x.seq + "：交付上层，回送 ACK" + (exp % M) +
            (mode === "sw" ? "（ACK 号表示下一个期待的序号，0/1 交替）。" : "（累积确认：ACK n 表示 n 以前的帧都已正确收到，下一个期待 n）。");
          s = { deliver: [x.i] };
        } else {
          sendA(exp % M, t, x.i);
          txt = fname(x.i) + "到达，但接收方期待的是 " + (exp % M) + (x.i < exp ? "（这是已交付过的重复帧）" : "") + "：" +
            (mode === "sw" ? "丢弃，但仍回送 ACK" + (exp % M) + "，否则发送方会一直重发。" : "GBN 接收窗口为 1，只能按序接收，丢弃该帧并重复发送 ACK" + (exp % M) + "。");
          s = {};
        }
        s.x = x.id; s.i = x.i;
        snap("fa", t, txt, s);
        continue;
      }
      if (e.k === "aa") {
        var a = x.seq;
        if (mode === "sr") {
          var jj = -1;
          for (var c2 = base; c2 < next; c2++) if (c2 % M === a && !acked[c2]) { jj = c2; break; }
          if (jj >= 0) {
            acked[jj] = true; tok[jj] = (tok[jj] || 0) + 1;
            var old = base;
            while (acked[base]) base++;
            var sent = fill(t);
            txt = "发送方收到 ACK" + a + "：" + fname(jj) + "被单独确认" + (base > old ? "，窗口左沿已连续确认，滑到 " + wstr(base, sw) :
              "，但窗口左沿 " + fname(base) + "还没确认，窗口不能滑动") + (sent.length ? "，发出 " + flist(sent) : "") + (base >= n ? "。全部 " + n + " 帧都已确认，传输完成。" : "。");
            snap("aa", t, txt, { x: x.id, sent: sent });
          } else snap("aa", t, "发送方收到 ACK" + a + "：对应的帧早已确认（重复确认），忽略。", { x: x.id });
        } else {
          var jg = -1;
          for (var c3 = base + 1; c3 <= next; c3++) if (c3 % M === a) { jg = c3; break; }
          if (jg > 0) {
            var conf = [];
            for (var c4 = base; c4 < jg; c4++) { conf.push(c4); tok[c4] = (tok[c4] || 0) + 1; acked[c4] = true; }
            base = jg;
            var sent2 = fill(t);
            txt = "发送方收到 ACK" + a + "：" + (conf.length > 1 ? flist(conf) + "都被确认（累积确认）" : fname(conf[0]) + "被确认") +
              (base >= n ? "。全部 " + n + " 帧都已确认，传输完成。" : "，窗口滑到 " + wstr(base, sw) + (sent2.length ? "，" + (mode === "sw" ? "发出下一帧：" : "继续发出 ") + flist(sent2) : "") + "。");
            snap("aa", t, txt, { x: x.id, sent: sent2 });
          } else snap("aa", t, "发送方收到重复的 ACK" + a + "：确认号没有前进（期待的仍是 " + (base % M) + "），窗口不动；" +
            (mode === "sw" ? "忽略即可。" : "GBN 不靠重复 ACK 重传，要等计时器超时。"), { x: x.id });
        }
      }
    }
    var tEnd = steps[steps.length - 1].t;
    return { mode: mode, name: NAME[mode], bits: bits, M: M, sw: sw, rw: rw, n: n, tf: TF, to: TO, tx: tx, steps: steps, retx: retx,
      finished: base >= n, time: tEnd, sentCount: cnt, util: Math.min(1, sw * TF / (TF + 2)) };
  };

  /* ================= RIP ================= */
  /* "N1 3 A; N2 5 B" → [{ net, d, hop }]；withHop=false 时只要“网络 距离” */
  LABU.parseRip = function (text, withHop, who) {
    var parts = String(text == null ? "" : text).split(/[;；\n]+/), out = [], seen = {};
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      var f = p.split(/[\s,，]+/), where = who + "第 " + (out.length + 1) + " 项“" + p + "”：";
      if (f.length < (withHop ? 3 : 2)) return E(where + (withHop ? "应写成“网络 距离 下一跳”，如 N1 3 A" : "应写成“网络 距离”，如 N1 4"));
      var d = toInt(f[1]);
      if (isNaN(d) || d < 1 || d > 16) return E(where + "距离应为 1–16 的整数（16 表示不可达）");
      if (seen[f[0]]) return E(where + "网络 " + f[0] + " 重复出现");
      seen[f[0]] = true;
      out.push(withHop ? { net: f[0], d: d, hop: f[2] } : { net: f[0], d: d });
    }
    if (!out.length) return E(who + "至少要有一项");
    if (out.length > 8) return E(who + "最多 8 项（演示用）");
    return { rows: out };
  };
  /* 收到邻居 from 的距离向量 vector 后更新 table（RIP 距离向量规则：距离 + 1；同一下一跳无条件替换，不同下一跳更短才替换；16 = 不可达） */
  LABU.ripUpdate = function (table, from, vector) {
    var res = table.map(function (r) { return { net: r.net, d: r.d, hop: r.hop }; }), rows = [], inVec = {};
    vector.forEach(function (v) {
      inVec[v.net] = true;
      var nd = Math.min(v.d + 1, 16), idx = -1;
      for (var i = 0; i < res.length; i++) if (res[i].net === v.net) idx = i;
      var old = idx >= 0 ? { net: res[idx].net, d: res[idx].d, hop: res[idx].hop } : null, act, why;
      var nw = { net: v.net, d: nd, hop: from };
      if (!old) { act = "add"; res.push(nw); why = "原表中没有 " + v.net + "，直接加入：距离 " + nd + "，下一跳 " + from + "。"; }
      else if (old.hop === from) { act = "same"; res[idx] = nw; why = "原来到 " + v.net + " 的下一跳就是 " + from + "：以 " + from + " 的最新消息为准，无论变大变小都替换为 " + nd + "。"; }
      else if (nd < old.d) { act = "shorter"; res[idx] = nw; why = "下一跳不同（原来经 " + old.hop + "），但经 " + from + " 的距离 " + nd + " < 原距离 " + old.d + "，更短，更新为距离 " + nd + "、下一跳 " + from + "。"; }
      else { act = "keep"; why = "下一跳不同（原来经 " + old.hop + "），经 " + from + " 的距离 " + nd + (nd === old.d ? " 与原距离相等" : " ≥ 原距离 " + old.d) + "，不更新。"; }
      if (nd >= 16 && act !== "keep") why += "（距离 16 表示不可达）";
      rows.push({ net: v.net, adv: v.d, nd: nd, old: old, act: act, now: idx >= 0 ? res[idx] : res[res.length - 1], why: why });
    });
    var untouched = table.filter(function (r) { return !inVec[r.net]; }).map(function (r) { return r.net; });
    return { table: res, rows: rows, untouched: untouched };
  };
  /* 坏消息传得慢：N1 — A — B，A 与 N1 的链路断开后 A、B 互相学习，直到 16 */
  LABU.ripCountInf = function () {
    var A = [{ net: "N1", d: 1, hop: "直接" }], B = [{ net: "N1", d: 2, hop: "A" }], rounds = [];
    rounds.push({ from: "", A: A[0], B: B[0], text: "正常时：A 与网络 N1 直接相连，距离 1；B 经 A 到 N1，距离 2。" });
    A = [{ net: "N1", d: 16, hop: "—" }];
    rounds.push({ from: "", A: A[0], B: B[0], broken: true, text: "A 与 N1 之间的链路断开：A 把到 N1 的距离改为 16（不可达）。但 A 的这条坏消息还没发出去，B 的周期性更新先到了。" });
    var turn = "B", g = 0;
    while ((A[0].d < 16 || B[0].d < 16) && g++ < 40) {
      var r, msg;
      if (turn === "B") {
        r = LABU.ripUpdate(A, "B", [{ net: "N1", d: B[0].d }]); A = r.table;
        msg = "B → A：B 通告“到 N1 距离 " + B[0].d + "”。" + (r.rows[0].old.hop === "—" ? "A 现在到 N1 是 16（不可达），经 B 只要 " + A[0].d + "，更短，于是更新为距离 " + A[0].d + "、下一跳 B。" :
          "A 到 N1 的下一跳就是 B，必须按 B 的新消息更新：距离 " + A[0].d + "。") + (A[0].d < 16 ? "A 并不知道 B 的这条路其实要经过 A 自己。" : "");
      } else {
        r = LABU.ripUpdate(B, "A", [{ net: "N1", d: A[0].d }]); B = r.table;
        msg = "A → B：A 通告“到 N1 距离 " + A[0].d + "”。B 到 N1 的下一跳就是 A，必须按 A 的新消息更新：距离 " + B[0].d + "。";
      }
      rounds.push({ from: turn, A: A[0], B: B[0], text: msg });
      turn = turn === "B" ? "A" : "B";
    }
    rounds[rounds.length - 1].text += " 双方到 N1 的距离都到了 16，终于知道 N1 不可达——这就是“好消息传得快、坏消息传得慢”（无穷计数）。";
    return rounds;
  };

  /* ================= 界面小工具（只在 mount 里调用） ================= */
  function outs(K, keys) {
    var h = "";
    keys.forEach(function (k) {
      if (k === "st") h += '<div class="x-lab__stats" data-k="st"></div>';
      else if (k === "msg") h += '<p class="x-lab__seq x-lc-msg" data-k="msg" aria-live="polite"></p>';
      else if (k === "tip") h += '<p class="x-lc-tip" data-k="tip"></p>';
      else if (k === "log") h += '<div class="x-lc-log" data-k="log" tabindex="0" role="log" aria-label="步骤记录"></div>';
      else h += '<div class="x-lc-' + k + '" data-k="' + k + '"></div>';
    });
    K.out.innerHTML = h;
    var o = {};
    K.out.querySelectorAll("[data-k]").forEach(function (x) { o[x.getAttribute("data-k")] = x; });
    return o;
  }
  /* size: s / m / w；kind: numeric | decimal | text */
  function field(K, label, val, size, kind) {
    var l = X.el("label", { class: "x-lab__lbl x-lc-f" }, esc(label) + " ");
    var inp = X.el("input", { type: "text", class: "x-lab__sel x-lc-in x-lc-in--" + (size || "s"), value: val, spellcheck: "false", autocomplete: "off",
      autocapitalize: "off", inputmode: kind || "numeric", "aria-label": label });
    inp.addEventListener("change", function () { K.restart(); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); K.restart(); } });
    l.appendChild(inp); K.opts.appendChild(l);
    return inp;
  }
  function br(K) { K.opts.appendChild(X.el("span", { class: "x-lab__br" })); }
  function tag(K, s) { K.opts.appendChild(X.el("span", { class: "x-lab__lbl x-lc-tag" }, esc(s))); }
  function group(K, items, cur, onPick) {
    var btns = items.map(function (it) {
      var b = X.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": it[0] === cur ? "true" : "false" }, esc(it[1]));
      b.addEventListener("click", function () { set(it[0]); onPick(it[0]); });
      K.opts.appendChild(b); return b;
    });
    function set(id) { btns.forEach(function (b, i) { b.setAttribute("aria-pressed", items[i][0] === id ? "true" : "false"); }); }
    return set;
  }
  function preset(K, label, fn) {
    var b = X.el("button", { type: "button", class: "x-lab__btn x-lab__btn--ghost" }, esc(label));
    b.addEventListener("click", function () { fn(); K.restart(); });
    K.opts.appendChild(b); return b;
  }
  function svgIn(K, w, h) { return X.svg("svg", { viewBox: "0 0 " + w + " " + h, role: "img", class: "x-lc-svg" }, K.stage); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function T(p, cls, x, y, s, anchor) { var n = X.svg("text", { class: cls, x: x, y: y }, p); if (anchor) n.setAttribute("text-anchor", anchor); n.textContent = s; return n; }
  function Rc(p, cls, x, y, w, h, rx) { var a = { class: cls, x: x, y: y, width: Math.max(0, w), height: Math.max(0, h) }; if (rx) a.rx = rx; return X.svg("rect", a, p); }
  function Ln(p, cls, x1, y1, x2, y2, extra) { var a = { class: cls, x1: x1, y1: y1, x2: x2, y2: y2 }; for (var k in extra || {}) a[k] = extra[k]; return X.svg("line", a, p); }
  function cross(p, x, y, r) { var g = X.svg("g", { class: "x-lc-x" }, p); Ln(g, "", x - r, y - r, x + r, y + r); Ln(g, "", x - r, y + r, x + r, y - r); return g; }
  function marker(svg, id, cls) {
    var d = svg.querySelector("defs") || X.svg("defs", {}, svg);
    var m = X.svg("marker", { id: id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: "userSpaceOnUse", orient: "auto" }, d);
    X.svg("path", { d: "M0,0 L10,5 L0,10 z", class: cls }, m);
  }
  function showErr(o, svg, msg) {
    if (svg) {
      clear(svg);
      var vb = (svg.getAttribute("viewBox") || "0 0 680 120").split(" ");
      T(svg, "x-lc-ph", +vb[2] / 2, Math.min(+vb[3] / 2, 80), "输入有误，请按下方提示修改", "middle");
      svg.setAttribute("aria-label", "输入有误");
    }
    for (var k in o) if (k !== "msg") o[k].innerHTML = "";
    o.msg.innerHTML = '<span class="x-lab__err">' + esc(msg) + "</span>";
  }
  function stat(label, v, unit) { return "<span>" + label + " <b>" + esc(v) + "</b>" + (unit ? " " + unit : "") + "</span>"; }
  function badge(s, bad) { return '<span class="x-lab__badge' + (bad ? " is-bad" : "") + '">' + esc(s) + "</span>"; }

  /* ================= 实验 1：滑动窗口 ================= */
  LAB.push({
    id: "slidewin", name: "滑动窗口：停等 / GBN / SR", color: CN,
    note: "n 位序号：GBN 发送窗口 ≤ 2^n − 1、接收窗口 = 1，累积确认，超时回退重发全部已发未确认帧；SR 接收窗口 ≤ 2^(n−1)、W_T + W_R ≤ 2^n，逐帧确认、只重发出错帧，接收方缓存乱序帧；停等就是窗口为 1。信道利用率 U = W·T_d /(T_d + RTT)，超过 1 按 1 算。",
    mount: function (panel, K) {
      var mode = "gbn", S, pos;
      var setMode = group(K, [["sw", "停等"], ["gbn", "GBN"], ["sr", "SR"]], mode, function (m) { mode = m; K.restart(); });
      br(K);
      var fb = field(K, "序号位数", "3"), fs = field(K, "发送窗口", "4"), fr = field(K, "接收窗口", "4"), fn = field(K, "帧数", "8");
      br(K);
      var fl = field(K, "丢失帧", "2", "m", "text"), fa = field(K, "丢失 ACK", "", "m", "text");
      br(K);
      tag(K, "例题");
      function cfg(m, b, w1, w2, n, l, a) { return function () { mode = m; setMode(m); fb.value = b; fs.value = w1; fr.value = w2; fn.value = n; fl.value = l; fa.value = a; }; }
      preset(K, "GBN 丢第 2 帧", cfg("gbn", "3", "4", "4", "8", "2", ""));
      preset(K, "SR 丢第 2 帧", cfg("sr", "3", "4", "4", "8", "2", ""));
      preset(K, "丢 ACK1（累积确认）", cfg("gbn", "3", "4", "4", "8", "", "1"));
      var W = 680, H = 312, X0 = 76, X1 = 668, SY = 84, RY = 200, PX = 74, VIEW = (X1 - X0) / PX, AX1 = 24, AX2 = 254;
      var svg = svgIn(K, W, H);
      var o = outs(K, ["st", "msg", "tip", "legend", "log"]);
      var LEG = '<span><i class="x-lc-sw is-ack"></i>已确认 / 已交付</span><span><i class="x-lc-sw is-out"></i>已发未确认 / 已缓存</span>' +
        '<span><i class="x-lc-sw is-ok"></i>可发送 / 可接收</span><span><i class="x-lc-sw is-no"></i>不可发送</span><span><i class="x-lc-sw is-re"></i>重传帧</span>';
      function axis(y, label, n, cls, w0, w, wlab, labY) {
        T(svg, "x-lc-lb", 6, y + 20, label);
        var cw = Math.min(46, (X1 - X0) / n);
        for (var i = 0; i < n; i++) {
          Rc(svg, "x-lc-cell " + cls(i), X0 + i * cw + 1.5, y, cw - 3, 30, 3);
          T(svg, "x-lc-cellt " + cls(i), X0 + i * cw + cw / 2, y + 20, String(i % S.M), "middle");
          if (n > S.M) T(svg, "x-lc-idx", X0 + i * cw + cw / 2, y + 44, "#" + i, "middle");
        }
        if (w0 < n) {
          var x1 = X0 + w0 * cw - 1, x2 = X0 + Math.min(w0 + w, n) * cw + 1;
          Rc(svg, "x-lc-win", x1, y - 4, x2 - x1, 38, 5);
          T(svg, "x-lc-winl", Math.min(x1 + 2, X1 - 150), labY, wlab);
        }
      }
      function seg(g, cls, xa, ya, xb, yb, mk) {
        var a = { class: cls, x1: xa, y1: ya, x2: xb, y2: yb };
        if (mk) a["marker-end"] = "url(#" + mk + ")";
        return X.svg("line", a, g);
      }
      function draw(s) {
        clear(svg);
        marker(svg, "x-lc-sw-f", "x-lc-ah"); marker(svg, "x-lc-sw-r", "x-lc-ah is-re"); marker(svg, "x-lc-sw-a", "x-lc-ah is-ak");
        var cp = X.svg("clipPath", { id: "x-lc-sw-clip" }, svg.querySelector("defs"));
        Rc(cp, "", X0 - 10, SY - 30, X1 - X0 + 10, RY - SY + 60);
        var now = s.t, v0 = Math.max(0, now - VIEW + 2.5);
        function px(t) { return X0 + (t - v0) * PX; }
        var n = S.n, sw = S.sw, rw = S.rw;
        axis(AX1, "发送方", n, function (i) {
          return i < s.base || s.acked[i] ? "is-ack" : i < s.next ? "is-out" : i < s.base + sw ? "is-ok" : "is-no";
        }, s.base, sw, s.base < n ? "发送窗口 W_T=" + sw + "：" + (s.base % S.M) + " 起" : "", 16);
        /* 时序区 */
        T(svg, "x-lc-t", 6, SY + 4, "发送端");
        T(svg, "x-lc-t", 6, RY + 4, "接收端");
        for (var tk = Math.ceil(v0); tk <= v0 + VIEW + 1e-6; tk++) {
          Ln(svg, "x-lc-grid", px(tk), SY, px(tk), RY);
          if (Math.abs(tk - now) > 0.45) T(svg, "x-lc-tick", px(tk), RY + 44, tk ? tk + "τ" : "0", "middle");
        }
        Ln(svg, "x-lc-tl", X0, SY, X1, SY); Ln(svg, "x-lc-tl", X0, RY, X1, RY);
        var g = X.svg("g", { "clip-path": "url(#x-lc-sw-clip)" }, svg), ackN = 0;
        for (var k = 0; k < s.nTx; k++) {
          var x = S.tx[k], f = x.f, full = f ? x.t0 + S.tf + 1 : x.t0 + 1;
          if (x.t1 < v0 - 0.3 && x.t0 < v0 - 1.5) { if (!f) ackN++; continue; }
          var y0 = f ? SY : RY, yE = f ? RY : SY, frac = (x.t1 - x.t0) / (full - x.t0);
          var sx = px(x.t0), ex = px(x.t1), ey = y0 + (yE - y0) * frac;
          var cls = (f ? "x-lc-fr" + (x.re ? " is-re" : "") : "x-lc-ak") + (x.id === s.x ? " is-cur" : "");
          var mk = f ? (x.re ? "x-lc-sw-r" : "x-lc-sw-f") : "x-lc-sw-a";
          if (now >= x.t1 - 1e-9) { seg(g, cls, sx, y0, ex, ey, x.lost ? null : mk); if (x.lost) cross(g, ex, ey, 7); }
          else if (now <= x.t0 + 1e-9) seg(g, cls + " is-fut", sx, y0, ex, ey);
          else {
            var p = (now - x.t0) / (x.t1 - x.t0), mx = sx + (ex - sx) * p, my = y0 + (ey - y0) * p;
            seg(g, cls, sx, y0, mx, my); seg(g, cls + " is-fut", mx, my, ex, ey);
            X.svg("circle", { class: "x-lc-dot" + (f ? (x.re ? " is-re" : "") : " is-ak"), cx: mx, cy: my, r: 4 }, g);
          }
          if (f) T(g, "x-lc-fl" + (x.re ? " is-re" : ""), sx + 1, SY - 6, String(x.seq), "middle");
          else { T(g, "x-lc-al", sx, RY + (ackN % 2 ? 28 : 15), "ACK" + x.seq, "middle"); ackN++; }
        }
        Ln(svg, "x-lc-now", px(now), SY - 18, px(now), RY + 32);
        T(svg, "x-lc-nowt", px(now), RY + 44, "t=" + fmt(now) + "τ", "middle");
        axis(AX2, "接收方", n, function (i) {
          return i < s.exp ? "is-ack" : s.buf[i] ? "is-out" : i < s.exp + rw ? "is-ok" : "is-no";
        }, s.exp, rw, s.exp < n ? (S.mode === "sr" ? "接收窗口 W_R=" + rw + "：" + (s.exp % S.M) + " 起" : "接收窗口 = 1，期待 " + (s.exp % S.M)) : "", 302);
        svg.setAttribute("aria-label", S.name + " 时序图：t = " + fmt(now) + "τ，发送窗口从 " + s.base + " 号帧起，接收方已交付 " + s.dlv.length + " 帧");
      }
      function render() {
        var s = S.steps[pos];
        draw(s);
        o.st.innerHTML = stat("时间", fmt(s.t), "τ（" + fmt(s.t / 2) + " RTT）") + stat("已发送", s.cnt, "帧") + stat("重传", s.re, "帧") + stat("已交付", s.dlv.length + " / " + S.n) +
          badge(S.name + (pos === S.steps.length - 1 && S.finished ? " · 完成" : ""));
        o.msg.textContent = (pos ? "第 " + pos + " 步：" : "") + s.text;
        o.log.textContent = S.steps.slice(1, pos + 1).map(function (q, i) { return (i + 1 < 10 ? " " : "") + (i + 1) + ". t=" + fmt(q.t) + "τ  " + q.text; }).join("\n");
        o.log.hidden = !pos;
        o.log.scrollTop = o.log.scrollHeight;
      }
      function reset() {
        S = LABU.slideSim({ mode: mode, bits: fb.value, sw: fs.value, rw: fr.value, n: fn.value, lost: fl.value, lostAck: fa.value });
        pos = 0;
        if (S.err) { showErr(o, svg, S.err); return; }
        o.legend.innerHTML = LEG;
        var U = S.util;
        o.tip.textContent = "信道利用率 U = W_T·T_d /(T_d + RTT)：本例 T_d = 0.25τ、RTT = 2τ，无差错时 U = min(1, " + S.sw + " × 0.25 / 2.25) = " + (Math.round(U * 1000) / 10) + "%。" +
          (mode === "sw" ? " 停等协议的序号位数、窗口固定为 1，上方输入只用帧数和丢失项。" : mode === "gbn" ? " GBN 接收窗口固定为 1，“接收窗口”输入不起作用。" : "") +
          " 丢失帧 / 丢失 ACK 填帧编号（从 0 起，逗号分隔），只在第一次发送 / 第一次确认时丢失。";
        render();
      }
      function step() { if (S.err) return false; if (pos < S.steps.length - 1) { pos++; render(); } return pos < S.steps.length - 1; }
      reset();
      return { step: step, reset: reset, done: function () { return !!S.err || pos >= S.steps.length - 1; } };
    }
  });

  /* ================= 实验 2：CSMA/CD 与二进制指数退避 ================= */
  LAB.push({
    id: "csmacd", name: "CSMA/CD 与指数退避", color: CN,
    note: "先听后发、边发边听、冲突停发、随机重发。第 k 次碰撞后 r ∈ [0, 2^min(k,10) − 1]，退避 r × 2τ；16 次碰撞放弃。最短帧长 = 2τ × 数据率，10Mb/s 以太网为 512 bit = 64 字节；争用期内没检测到碰撞才能确定这次发送不会碰撞。",
    mount: function (panel, K) {
      var fk = field(K, "第几次冲突 k", "3"), ft = field(K, "争用期 2τ (μs)", "51.2", "s", "decimal"), fr = field(K, "随机数 r", "5"), fv = field(K, "数据率 (Mb/s)", "10", "s", "decimal");
      br(K);
      tag(K, "例题");
      function cfg(k, r) { return function () { fk.value = k; fr.value = r; ft.value = "51.2"; fv.value = "10"; }; }
      preset(K, "k=3", cfg("3", "5"));
      preset(K, "k=12", cfg("12", "1000"));
      preset(K, "k=16 放弃", cfg("16", "0"));
      var svg = svgIn(K, 680, 290), o = outs(K, ["st", "msg", "tip"]), B, F, r, pos, err, N = 8;
      var BUS = 90, XA = 80, XB = 600;
      var SIG = [null,
        { a: [XA, 300], st: ["监听空闲 → 开始发送", "监听中"] },
        { a: [XA, 440], b: [520, XB], st: ["发送中", "仍听到空闲 → 也开始发送"] },
        { a: [XA, 560], b: [400, XB], hit: [400, 560], star: 480, st: ["发送中（还不知道碰撞）", "发送中（还不知道碰撞）"] },
        { jam: true, st: ["检测到碰撞：停发 + 强化干扰", "检测到碰撞：停发 + 强化干扰"] }];
      function seg(cls, x1, x2) { Rc(svg, cls, Math.min(x1, x2), BUS - 7, Math.abs(x2 - x1), 14, 2); }
      function draw() {
        clear(svg);
        [[XA, "站 A"], [XB, "站 B"]].forEach(function (s) { Rc(svg, "x-lc-node", s[0] - 44, 12, 88, 34, 6); T(svg, "x-lc-lb", s[0], 34, s[1], "middle"); Ln(svg, "x-lc-tap", s[0], 46, s[0], BUS); });
        Ln(svg, "x-lc-bus", 40, BUS, 640, BUS);
        var sg = pos >= 1 && pos <= 4 ? SIG[pos] : null;
        if (sg) {
          if (sg.a) seg("x-lc-sa", sg.a[0], sg.a[1]);
          if (sg.b) seg("x-lc-sb", sg.b[0], sg.b[1]);
          if (sg.hit) { seg("x-lc-sc", sg.hit[0], sg.hit[1]); T(svg, "x-lc-boom", sg.star, BUS - 14, "碰撞！", "middle"); }
          if (sg.jam) { seg("x-lc-sc is-faint", 40, 640); Rc(svg, "x-lc-jam", XA - 4, BUS - 11, 36, 22, 3); Rc(svg, "x-lc-jam", XB - 32, BUS - 11, 36, 22, 3); T(svg, "x-lc-t is-bad", 340, BUS - 14, "强化干扰信号 32 bit，所有站都知道发生了碰撞", "middle"); }
          T(svg, "x-lc-t", 40, 118, "A：" + sg.st[0]);
          T(svg, "x-lc-t", 640, 118, "B：" + sg.st[1], "end");
        } else T(svg, "x-lc-t", 340, 118, pos === 0 ? "总线空闲" : pos >= 7 ? "总线空闲" : "两站都在退避等待，总线空闲", "middle");
        var y = 150;
        if (pos <= 4) {
          Ln(svg, "x-lc-dim", XA, y, XB, y); Ln(svg, "x-lc-dim", XA, y - 6, XA, y + 6); Ln(svg, "x-lc-dim", XB, y - 6, XB, y + 6);
          Rc(svg, "x-lc-dimbg", 260, y - 10, 160, 20); T(svg, "x-lc-t", 340, y + 5, "单程传播时延 τ", "middle");
          T(svg, "x-lc-t", 340, 186, "争用期 2τ = " + fmt(B.slot) + "μs：A 发出后最多经过 2τ 才能知道有没有碰撞", "middle");
          T(svg, "x-lc-t", 340, 210, "（最坏情况：B 在 A 的信号快到 B 时才开始发送，碰撞信号再传回 A 又要 τ）", "middle");
        } else if (pos <= 6) {
          if (B.giveUp) {
            T(svg, "x-lc-big is-bad", 340, 186, "第 16 次碰撞：放弃发送", "middle");
            T(svg, "x-lc-t", 340, 214, "向上层报告出错，由上层决定是否重传", "middle");
          } else {
            T(svg, "x-lc-lb", 340, y - 4, "第 " + B.k + " 次碰撞：r ∈ {0, 1, …, 2^" + B.m + " − 1} = [0, " + B.max + "]", "middle");
            if (B.max <= 15) {
              var cnt = B.max + 1, cw = Math.min(36, 560 / cnt), x0 = 340 - cnt * cw / 2;
              for (var i = 0; i < cnt; i++) {
                Rc(svg, "x-lc-cell " + (i === r ? "is-out" : "is-ok"), x0 + i * cw + 1, 164, cw - 2, 30, 3);
                T(svg, "x-lc-cellt " + (i === r ? "is-out" : ""), x0 + i * cw + cw / 2, 184, String(i), "middle");
              }
            } else {
              Rc(svg, "x-lc-cell is-ok", 60, 180, 560, 22, 3);
              var xr = 60 + r / B.max * 560;
              Rc(svg, "x-lc-cell is-out", 60, 180, xr - 60, 22, 3);
              T(svg, "x-lc-t", 60, 218, "0", "middle"); T(svg, "x-lc-t", 620, 218, String(B.max), "middle");
              X.svg("path", { class: "x-lc-tri", d: "M" + xr + ",178 l-6,-10 h12 z" }, svg);
              T(svg, "x-lc-t is-strong", xr > 340 ? xr - 10 : xr + 10, 174, "r = " + r, xr > 340 ? "end" : "start");
            }
            T(svg, "x-lc-lb", 340, 244, "退避时间 = r × 2τ = " + r + " × " + fmt(B.slot) + "μs = " + fmt(r * B.slot) + "μs", "middle");
            if (pos === 6) {
              var nx = LABU.backoff(B.k + 1, B.slot);
              T(svg, "x-lc-t", 340, 272, nx.giveUp ? "若再碰撞就是第 16 次，放弃发送" : "若再碰撞：k = " + (B.k + 1) + "，r ∈ [0, " + nx.max + "]" + (B.k >= 10 ? "（k ≥ 10 后范围不再增大）" : "（范围翻倍）"), "middle");
            }
          }
        } else {
          var w = 480, x1 = 100;
          T(svg, "x-lc-lb", 340, y, "最短帧长 = 2τ × 数据率", "middle");
          Rc(svg, "x-lc-cell is-ok", x1, 166, w, 24, 3); T(svg, "x-lc-cellt", x1 + w / 2, 183, "争用期 2τ = " + fmt(B.slot) + "μs", "middle");
          Rc(svg, "x-lc-cell is-out", x1, 198, w, 24, 3); T(svg, "x-lc-cellt is-out", x1 + w / 2, 215, "最短帧的发送时间 = " + fmt(F.bits) + " bit ÷ " + fv.value.trim() + "Mb/s", "middle");
          T(svg, "x-lc-lb", 340, 252, fmt(B.slot) + "μs × " + fv.value.trim() + "Mb/s = " + fmt(F.bits) + " bit = " + fmt(F.bytes) + " 字节", "middle");
        }
        svg.setAttribute("aria-label", "CSMA/CD 演示第 " + pos + " 步");
      }
      var MSG = [
        "两个站 A、B 连在同一条总线上，单程传播时延 τ。按“下一步”看一次碰撞、强化干扰和二进制指数退避；k、r 可以在上方修改。",
        "① 载波监听：站 A 先监听信道，信道空闲，立即开始发送；A 的信号以有限速度沿总线向 B 传播。",
        "② 站 B 也有数据要发：A 的信号还没传到 B，B 监听到的仍是“空闲”，于是也开始发送——传播时延让“先听后发”也避免不了碰撞。",
        "③ 两路信号在总线中途相遇发生碰撞，叠加后的碰撞信号继续向两端传播；此时 A、B 都还没察觉。",
        "④ 冲突检测：A、B 边发送边监听，检测到信号电压异常后立即停止发送，并发送 32 位（或 48 位）强化干扰信号，让所有站都知道发生了碰撞。"
      ];
      function text() {
        if (pos < 5) return MSG[pos];
        if (pos === 5) return B.giveUp ? "⑤ 这已经是第 16 次碰撞：以太网规定碰撞 16 次仍不成功就放弃发送，并向上层报告出错。" :
          "⑤ 二进制指数退避：第 k = " + B.k + " 次碰撞后，m = min(k, 10) = " + B.m + "，r 从 {0, 1, …, 2^m − 1} = [0, " + B.max + "] 中随机取，本例 r = " + r +
          "，退避时间 = r × 2τ = " + r + " × " + fmt(B.slot) + "μs = " + fmt(r * B.slot) + "μs。两站各自随机取 r，取值不同就能错开。";
        if (pos === 6) return B.giveUp ? "⑥ 放弃后由上层（如运输层的超时重传）处理；k 从 1 起数，第 16 次碰撞时放弃。" :
          "⑥ 退避时间到后重新监听，空闲就再次发送；若又碰撞，k 加 1，退避范围翻倍（k ≥ 10 后固定为 [0, 1023]），累计碰撞 16 次就放弃。";
        return "⑦ 最短帧长：站点最多经过争用期 2τ 才能确定没有碰撞，若帧在 2τ 内就发完，碰撞回来时已无法察觉、也不会重发。所以帧的发送时间不能小于 2τ：最短帧长 = 2τ × 数据率 = " +
          fmt(B.slot) + "μs × " + fv.value.trim() + "Mb/s = " + fmt(F.bits) + " bit = " + fmt(F.bytes) + " 字节。以太网规定最短 64 字节，更短的都是因冲突而中止的无效帧。";
      }
      function render() {
        draw();
        o.st.innerHTML = stat("冲突次数 k", B.k) + (B.giveUp ? badge("放弃发送", true) : stat("r 范围", "[0, " + B.max + "]") + stat("退避", fmt(r * B.slot), "μs")) + stat("最短帧", fmt(F.bytes), "字节");
        o.msg.textContent = text();
        o.tip.textContent = "公式：r ∈ [0, 2^min(k,10) − 1]，退避时间 = r × 争用期；k = 16 放弃。数据率 × 时间：1 Mb/s × 1 μs = 1 bit。";
      }
      function reset() {
        pos = 0; err = null;
        B = LABU.backoff(fk.value, ft.value);
        if (B.err) err = B.err;
        else {
          F = LABU.minFrame(fv.value, ft.value);
          if (F.err) err = F.err;
          else if (!B.giveUp) {
            r = toInt(fr.value);
            if (isNaN(r) || r < 0 || r > B.max) err = "第 " + B.k + " 次碰撞后 r 只能取 0–" + B.max + " 的整数（2^min(" + B.k + ",10) − 1 = " + B.max + "），现在 r = " + (fr.value.trim() || "空");
          } else r = 0;
        }
        if (err) { showErr(o, svg, err); return; }
        render();
      }
      function step() { if (err) return false; if (pos < N - 1) { pos++; render(); } return pos < N - 1; }
      reset();
      return { step: step, reset: reset, done: function () { return !!err || pos >= N - 1; } };
    }
  });

  /* ================= 实验 3：CRC 校验 ================= */
  LAB.push({
    id: "crc", name: "CRC 校验计算", color: CN,
    note: "生成多项式最高次 r：数据后补 r 个 0 做模 2 除法（异或、不借位），余数写满 r 位就是 FCS；接收端用同一多项式除整串，余数为 0 才无差错。CRC 只能检错、不能纠错，数据链路层的 CRC 只保证“无比特差错”，不等于可靠传输。",
    mount: function (panel, K) {
      var mode = "calc", S, pos, N, err;
      var setMode = group(K, [["calc", "发送端：求 FCS"], ["check", "接收端：校验"]], mode, function (m) { mode = m; K.restart(); });
      br(K);
      var fd = field(K, "数据位", "101001", "m"), fg = field(K, "生成多项式", "1101", "m", "text"), fr = field(K, "接收位串", "101001001", "w");
      br(K);
      tag(K, "例题");
      preset(K, "101001 ÷ 1101", function () { mode = "calc"; setMode(mode); fd.value = "101001"; fg.value = "1101"; fr.value = "101001001"; });
      preset(K, "1101011011 ÷ x⁴+x+1", function () { mode = "calc"; setMode(mode); fd.value = "1101011011"; fg.value = "x^4+x+1"; fr.value = "11010110111110"; });
      preset(K, "接收出错 101001011", function () { mode = "check"; setMode(mode); fg.value = "1101"; fr.value = "101001011"; });
      var svg = svgIn(K, 680, 200), o = outs(K, ["st", "msg", "tip"]);
      function draw() {
        clear(svg);
        var D = S.dividend, g = S.gen, r = S.r, L = D.length, st = S.steps, shown = Math.min(pos, st.length);
        var cw = Math.min(26, Math.floor(640 / (L + g.length + 2))), fs = cw >= 20 ? 15 : cw >= 15 ? 14 : 12;
        var X0 = 16 + (g.length + 1.3) * cw, RH = 24, y0 = 30, yD = 62, H = yD + st.length * 2 * RH + 26;
        svg.setAttribute("viewBox", "0 0 680 " + H);
        var G = X.svg("g", { style: "font-size:" + fs + "px" }, svg);
        function bx(c) { return X0 + c * cw + cw / 2; }
        function bitsAt(s, c0, y, cls) { for (var i = 0; i < s.length; i++) T(G, "x-lc-bit " + (typeof cls === "function" ? cls(i) : cls || ""), bx(c0 + i), y, s.charAt(i), "middle"); }
        for (var i = 0; i < g.length; i++) T(G, "x-lc-bit is-gen", 16 + i * cw + cw / 2, yD, g.charAt(i), "middle");
        X.svg("path", { class: "x-lc-divl", d: "M" + (X0 - cw * 0.35) + "," + (yD + 6) + " Q" + (X0 - cw * 0.05) + "," + (yD - 6) + " " + (X0 - cw * 0.35) + "," + (yD - 20) + " H" + (X0 + L * cw) }, svg);
        T(svg, "x-lc-t", 16, y0, "商", "start");
        bitsAt(D, 0, yD, function (i) { return i >= L - r ? "is-pad" : ""; });
        for (var k = 0; k < shown; k++) {
          var s = st[k], cur = k === shown - 1 && pos <= st.length ? " is-cur" : "", yS = yD + (2 * k + 1) * RH, yR = yS + RH;
          T(G, "x-lc-bit is-q" + cur, bx(s.i + r), y0, s.q, "middle");
          bitsAt(s.sub, s.i, yS, (s.q === "0" ? "is-zero" : "") + cur);
          Ln(svg, "x-lc-rule" + cur, X0 + s.i * cw + 2, yS + 7, X0 + (s.i + g.length) * cw - 2, yS + 7);
          bitsAt(s.rem, s.i + 1, yR, cur ? "is-cur" : "");
          if (s.down) T(G, "x-lc-bit is-down", bx(s.i + g.length), yR, s.down, "middle");
          if (k === st.length - 1 && pos > st.length) Rc(svg, "x-lc-box", X0 + (s.i + 1) * cw - 2, yR - RH + 7, r * cw + 4, RH, 4);
        }
        svg.setAttribute("aria-label", "模 2 除法：" + D + " ÷ " + g + "，已完成 " + shown + " / " + st.length + " 步");
      }
      function text() {
        var st = S.steps, g = S.gen;
        if (pos === 0) return mode === "calc" ? "生成多项式 " + g + " 共 " + g.length + " 位，最高次 r = " + S.r + "：在数据 " + S.data + " 后补 " + S.r + " 个 0（橙色），得被除数 " + S.dividend + "，然后做模 2 除法（每步异或，不借位、不进位）。" :
          "接收端用同一生成多项式 " + g + " 去除收到的整串 " + S.recv + "（不再补 0，末尾 " + S.r + " 位橙色是 FCS），看余数是否全为 0。";
        if (pos <= st.length) {
          var s = st[pos - 1];
          return "第 " + pos + " 步：当前 " + g.length + " 位 " + s.win + "，最高位是 " + s.q + (s.q === "1" ? "，够除：商记 1，与生成多项式 " + g + " 异或" : "，不够除：商记 0，与 " + zeros(g.length) + " 异或（相当于只移位）") +
            "，得 " + s.xor + "，去掉最高位得 " + s.rem + (s.down ? "；再移下一位 " + s.down + "，得到 " + s.rem + s.down + "。" : "。这是最后一步，" + s.rem + " 就是余数。");
        }
        if (mode === "calc") return "余数 " + S.remainder + " 就是帧检验序列 FCS（必须写满 r = " + S.r + " 位，前导 0 不能省）。发送的位串 = 数据 + FCS = " + S.data + " " + S.remainder + " = " + S.codeword +
          "。接收端用同一生成多项式去除整串，余数为 0 才判定无差错。";
        return S.ok ? "余数为 " + S.remainder + "，全为 0：判定传输无差错，接受该帧（去掉末尾 " + S.r + " 位 FCS 即为数据）。" :
          "余数为 " + S.remainder + " ≠ 0：判定传输出错，丢弃该帧。CRC 只能检错、不能纠错；数据链路层只保证“无比特差错”，帧丢失、重复、失序要靠上层解决。";
      }
      function render() {
        draw();
        var q = S.quotient.substr(0, Math.min(pos, S.steps.length)) || "—";
        o.st.innerHTML = stat("生成多项式", S.gen) + stat("r", S.r) + stat("商", q) + (pos > S.steps.length ? (mode === "calc" ? stat("FCS", S.remainder) + stat("发送", S.codeword) :
          stat("余数", S.remainder) + badge(S.ok ? "无差错" : "有差错", !S.ok)) : "");
        o.msg.textContent = text();
      }
      function reset() {
        pos = 0;
        S = mode === "calc" ? LABU.crc(fd.value, fg.value) : LABU.crcCheck(fr.value, fg.value);
        err = S.err || null;
        if (err) { showErr(o, svg, err); return; }
        N = S.steps.length + 2;
        o.tip.textContent = "多项式 ↔ 位串：各次幂的系数从高到低写出，如 x³+x²+1 → 1101、x⁴+x+1 → 10011；r = 最高次 = 位数 − 1。输入框两种写法都可以。";
        render();
      }
      function step() { if (err) return false; if (pos < N - 1) { pos++; render(); } return pos < N - 1; }
      reset();
      return { step: step, reset: reset, done: function () { return !!err || pos >= N - 1; } };
    }
  });

  /* ================= 实验 4：IP 分片 ================= */
  LAB.push({
    id: "ipfrag", name: "IP 分片", color: CN,
    note: "每片数据 ≤ MTU − 首部，且除最后一片外必须是 8 的倍数；片偏移 = 该片数据起点 ÷ 8；MF = 1 表示后面还有分片；每片都带首部、标识相同。DF = 1 而又超过 MTU 时丢弃并发 ICMP 差错报告。分片只在目的主机重组。",
    mount: function (panel, K) {
      var df = "0", S, pos, N, err;
      var ft = field(K, "总长度 (B)", "4000"), fh = field(K, "首部长度 (B)", "20"), fm = field(K, "MTU (B)", "1500");
      br(K);
      var setDf = group(K, [["0", "DF=0 允许分片"], ["1", "DF=1 不许分片"]], df, function (v) { df = v; K.restart(); });
      br(K);
      tag(K, "例题");
      function cfg(t, h, m, d) { return function () { ft.value = t; fh.value = h; fm.value = m; df = d; setDf(d); }; }
      preset(K, "4000 / 20 / 1500", cfg("4000", "20", "1500", "0"));
      preset(K, "DF=1 → 丢弃", cfg("4000", "20", "1500", "1"));
      preset(K, "MTU 576（向下取 8 的倍数）", cfg("1600", "20", "576", "0"));
      var svg = svgIn(K, 680, 210), o = outs(K, ["st", "msg", "tbl"]);
      var DX0 = 96, DX1 = 640;
      function draw() {
        clear(svg);
        var fr = S.frags, shown = S.need && !S.drop ? Math.max(0, Math.min(pos - 1, fr.length)) : 0;
        T(svg, "x-lc-lb", 40, 20, "原数据报：总长度 " + S.total + " B");
        Rc(svg, "x-lc-hdr", 40, 30, DX0 - 44, 30, 3); T(svg, "x-lc-cellt", 40 + (DX0 - 44) / 2, 50, "首部", "middle");
        Rc(svg, "x-lc-data", DX0, 30, DX1 - DX0, 30, 3);
        function dx(b) { return DX0 + b / S.data * (DX1 - DX0); }
        for (var i = 0; i < shown; i++) {
          var f = fr[i];
          Rc(svg, "x-lc-data is-on" + (i === shown - 1 && pos <= fr.length + 1 ? " is-cur" : ""), dx(f.start), 30, dx(f.end + 1) - dx(f.start), 30, 0);
          if (i < fr.length - 1) Ln(svg, "x-lc-cut", dx(f.end + 1), 26, dx(f.end + 1), 64);
        }
        T(svg, "x-lc-cellt", (DX0 + DX1) / 2, 50, "数据 " + S.data + " B（字节 0–" + (S.data - 1) + "）", "middle");
        if (!S.need || S.drop) {
          if (pos >= 1) T(svg, S.drop ? "x-lc-big is-bad" : "x-lc-big", 340, 118, S.drop ? "DF=1：不能分片 → 丢弃" : "总长度 ≤ MTU：不分片，原样转发", "middle");
          if (pos >= 1 && S.drop) T(svg, "x-lc-t", 340, 146, "并向源主机发送 ICMP 终点不可达（类型 3、代码 4：需要分片但 DF 置 1）", "middle");
          svg.setAttribute("aria-label", S.drop ? "DF=1，丢弃数据报" : "不需要分片");
          return;
        }
        T(svg, "x-lc-lb", 40, 98, "分片后（每片 = 首部 " + S.hdr + " B + 数据）");
        var n = fr.length, HW = 24, GAP = 8, avail = 600 - n * (HW + GAP), x = 40;
        for (var j = 0; j < n; j++) {
          var w = Math.max(6, fr[j].len / S.data * avail), on = j < shown, cur = on && j === shown - 1 && pos <= n + 1;
          if (on) {
            X.svg("path", { class: "x-lc-map", d: "M" + dx(fr[j].start) + ",60 L" + (x + HW) + ",108 M" + dx(fr[j].end + 1) + ",60 L" + (x + HW + w) + ",108" }, svg);
            Rc(svg, "x-lc-hdr" + (cur ? " is-cur" : ""), x, 108, HW, 30, 3);
            Rc(svg, "x-lc-data is-on" + (cur ? " is-cur" : ""), x + HW, 108, w, 30, 3);
            if (HW + w >= 52) {
              T(svg, "x-lc-cellt", x + HW + w / 2, 128, "片" + (j + 1), "middle");
              T(svg, "x-lc-t", x + (HW + w) / 2, 156, "偏移 " + fr[j].off, "middle");
              T(svg, "x-lc-t", x + (HW + w) / 2, 174, "MF=" + fr[j].mf, "middle");
              T(svg, "x-lc-t", x + (HW + w) / 2, 192, "总长 " + fr[j].total, "middle");
            }
          } else Rc(svg, "x-lc-ghost", x, 108, HW + w, 30, 3);
          x += HW + w + GAP;
        }
        svg.setAttribute("aria-label", "IP 分片：共 " + n + " 片，已算出 " + shown + " 片");
      }
      function table() {
        if (!S.need || S.drop || pos < 2) { o.tbl.innerHTML = ""; return; }
        var shown = Math.min(pos - 1, S.frags.length), h = '<div class="x-tbl x-lc-tbl"><table><thead><tr><th scope="col">片</th><th scope="col">数据字节</th><th scope="col">数据长度</th><th scope="col">总长度</th><th scope="col">片偏移</th><th scope="col">MF</th><th scope="col">DF</th></tr></thead><tbody>';
        for (var i = 0; i < shown; i++) {
          var f = S.frags[i];
          h += "<tr" + (i === shown - 1 && pos <= S.frags.length + 1 ? ' class="is-cur"' : "") + '><th scope="row">' + (i + 1) + "</th><td>" + f.start + "–" + f.end + "</td><td>" + f.len + " B</td><td>" + f.total + " B</td><td>" +
            f.off + "（" + f.start + "÷8）</td><td>" + f.mf + "</td><td>0</td></tr>";
        }
        o.tbl.innerHTML = h + "</tbody></table></div>";
      }
      function text() {
        if (pos === 0) return "数据部分 = 总长度 − 首部长度 = " + S.total + " − " + S.hdr + " = " + S.data + " B。分片只切数据部分，每一片都要带一个首部（复制原首部，标识字段相同）。";
        if (!S.need) return "总长度 " + S.total + " B ≤ MTU " + S.mtu + " B：不需要分片，直接转发（片偏移 0、MF = 0）。";
        if (S.drop) return "DF = 1 表示不允许分片，而总长度 " + S.total + " B > MTU " + S.mtu + " B：路由器只能丢弃该数据报，并向源主机发送 ICMP 差错报告报文（终点不可达，类型 3、代码 4：需要分片但 DF 置 1）。";
        var fr = S.frags;
        if (pos === 1) return "每片最多装 MTU − 首部 = " + S.mtu + " − " + S.hdr + " = " + S.room + " B 数据。片偏移以 8 字节为单位，所以除最后一片外数据长度必须是 8 的倍数：" +
          (S.room === S.max ? S.room + " ÷ 8 = " + (S.room / 8) + "，正好整除，取 " + S.max + " B。" : S.room + " 不是 8 的倍数，向下取到 ⌊" + S.room + "/8⌋ × 8 = " + S.max + " B。") +
          "共需 ⌈" + S.data + " / " + S.max + "⌉ = " + fr.length + " 片。";
        if (pos <= fr.length + 1) {
          var f = fr[pos - 2], last = f.mf === 0;
          return (last ? "最后一片（第 " + (f.i + 1) + " 片）：剩下 " : "第 " + (f.i + 1) + " 片：取数据 ") + f.start + "–" + f.end + " 共 " + f.len + " B" + (last ? "（最后一片不必是 8 的倍数）" : "（= 每片上限）") +
            "；片偏移 = " + f.start + " ÷ 8 = " + f.off + "；" + (last ? "MF = 0，表示这是最后一片" : "后面还有分片，MF = 1") + "；总长度 = " + f.len + " + " + S.hdr + " = " + f.total + " B。";
        }
        return "共 " + fr.length + " 片：片偏移 " + fr.map(function (f) { return f.off; }).join(" / ") + "，MF " + fr.map(function (f) { return f.mf; }).join(" / ") + "，总长度 " +
          fr.map(function (f) { return f.total; }).join(" / ") + "。分片由途中路由器完成，只在目的主机重组：靠标识认出同一数据报，靠片偏移排位置，靠 MF = 0 找到最后一片。";
      }
      function render() {
        draw(); table();
        o.st.innerHTML = stat("数据", S.data, "B") + (S.need && !S.drop ? stat("每片上限", S.max, "B") + stat("片数", S.frags.length) : "") + badge(S.drop ? "DF=1 丢弃" : "DF=" + (S.df ? 1 : 0), S.drop);
        o.msg.textContent = text();
      }
      function reset() {
        pos = 0;
        S = LABU.ipFrag(ft.value, fh.value, fm.value, df === "1");
        err = S.err || null;
        if (err) { showErr(o, svg, err); return; }
        N = S.need && !S.drop ? S.frags.length + 3 : 2;
        render();
      }
      function step() { if (err) return false; if (pos < N - 1) { pos++; render(); } return pos < N - 1; }
      reset();
      return { step: step, reset: reset, done: function () { return !!err || pos >= N - 1; } };
    }
  });

  /* ================= 实验 5：最长前缀匹配 ================= */
  var LPM_DEF = "128.96.39.0/25 直接交付 接口0\n128.96.39.128/25 直接交付 接口1\n128.96.40.0/25 R2 接口1\n192.4.153.0/26 R3 接口2\n0.0.0.0/0 R4 接口2";
  var LPM_B = "172.16.0.0/16 R1 接口0\n172.16.5.0/24 R2 接口1\n172.16.5.192/26 R3 接口2\n10.0.0.0/8 R4 接口3\n0.0.0.0/0 R5 接口3";
  LAB.push({
    id: "lpm", name: "最长前缀匹配", color: CN,
    note: "目的地址与每条表项的掩码逐位相与，结果等于该表项的网络地址就算匹配；所有匹配项中选前缀最长的（最具体）。默认路由 0.0.0.0/0 与任何地址都匹配，但前缀为 0，只有别的都不匹配时才用；都不匹配又没有默认路由就丢弃并发 ICMP 终点不可达。",
    mount: function (panel, K) {
      var S, P, pos, N, err;
      var fi = field(K, "目的 IP", "128.96.39.10", "w", "decimal");
      br(K);
      var tl = X.el("label", { class: "x-lab__lbl x-lc-f x-lc-f--ta" }, "路由表（每行：目的网络/前缀 下一跳 接口）");
      var ta = X.el("textarea", { class: "x-lc-ta", rows: 5, spellcheck: "false", autocapitalize: "off", "aria-label": "路由表" });
      ta.value = LPM_DEF;
      ta.addEventListener("change", function () { K.restart(); });
      tl.appendChild(ta); K.opts.appendChild(tl);
      br(K);
      var go = X.el("button", { type: "button", class: "x-lab__btn" }, "按新表重算");
      go.addEventListener("click", function () { K.restart(); }); K.opts.appendChild(go);
      tag(K, "例题");
      preset(K, "128.96.39.10", function () { fi.value = "128.96.39.10"; ta.value = LPM_DEF; });
      preset(K, "/16 与 /24 都匹配", function () { fi.value = "172.16.5.10"; ta.value = LPM_B; });
      preset(K, "走默认路由", function () { fi.value = "8.8.8.8"; ta.value = LPM_DEF; });
      var svg = svgIn(K, 680, 186), o = outs(K, ["st", "msg", "tbl", "tip"]);
      var X0 = 96, CW = 16;
      function xb(i) { return X0 + i * CW + Math.floor(i / 8) * 6; }
      function bit(u, i) { return (u >>> (31 - i)) & 1; }
      function cmpText(rw) {
        if (rw.len === 0) return "掩码全 0，任何地址相与都得 0.0.0.0 → 总是匹配，前缀长度 0（优先级最低）";
        var d = -1;
        for (var i = 0; i < rw.len; i++) if (bit(rw.and, i) !== bit(rw.net, i)) { d = i; break; }
        return LABU.ipStr(S.ip) + " AND " + LABU.ipStr(rw.mask) + " = " + LABU.ipStr(rw.and) + (rw.match ? "，与网络地址相同 → 匹配，前缀 " + rw.len + " 位" :
          "，≠ " + LABU.ipStr(rw.net) + " → 不匹配（第 " + (d + 1) + " 位不同）");
      }
      function draw() {
        clear(svg);
        var k = pos >= 1 && pos <= S.rows.length ? pos - 1 : pos > S.rows.length && S.best >= 0 ? S.best : -1, rw = k >= 0 ? S.rows[k] : null;
        var rows = [["目的地址", S.ip, 10]];
        if (rw) rows.push(["掩码 /" + rw.len, rw.mask, 40], ["相与结果", rw.and, 70], ["表项网络", rw.net, 100]);
        rows.forEach(function (r, ri) {
          T(svg, "x-lc-t", 4, r[2] + 17, r[0]);
          for (var i = 0; i < 32; i++) {
            var v = bit(r[1], i), inP = rw && i < rw.len, bad = rw && ri === 3 && inP && bit(rw.and, i) !== v;
            var cls = bad ? " is-bad" : (ri === 0 || ri >= 2) && inP ? " is-net" : ri === 1 && v ? " is-one" : "";
            Rc(svg, "x-lc-bc" + cls, xb(i), r[2], CW - 1, 24, 2);
            T(svg, "x-lc-bitc" + cls, xb(i) + CW / 2 - 0.5, r[2] + 17, String(v), "middle");
          }
        });
        if (rw && rw.len > 0 && rw.len < 32) { var cx = xb(rw.len) - (rw.len % 8 ? 0.5 : 3.5); Ln(svg, "x-lc-cut", cx, 4, cx, 130); }
        if (!rw) { T(svg, "x-lc-t", 4, 66, "目的地址 " + LABU.ipStr(S.ip) + " 的二进制如上；下一步开始逐条与路由表项比较。"); }

        else {
          T(svg, "x-lc-t is-strong", 4, 152, (k + 1) + ". " + LABU.ipStr(rw.net) + "/" + rw.len + (rw.match ? "  ✓ 匹配" : "  ✗ 不匹配"));
          T(svg, "x-lc-t", 4, 174, cmpText(rw).replace(/ → .*$/, "") + (rw.match ? "" : "（红色位不同）"));
        }
        svg.setAttribute("aria-label", rw ? "目的地址与表项 " + LABU.ipStr(rw.net) + "/" + rw.len + " 的二进制比较：" + (rw.match ? "匹配" : "不匹配") : "目的地址二进制");
      }
      function table() {
        var h = '<div class="x-tbl x-lc-tbl"><table><thead><tr><th scope="col">#</th><th scope="col">目的网络</th><th scope="col">掩码</th><th scope="col">下一跳</th><th scope="col">接口</th><th scope="col">目的 IP AND 掩码</th><th scope="col">结果</th></tr></thead><tbody>';
        S.rows.forEach(function (rw, i) {
          var done = i < pos, cur = i === pos - 1 && pos <= S.rows.length, best = pos > S.rows.length && i === S.best;
          h += "<tr" + (cur || best ? ' class="is-cur"' : "") + '><th scope="row">' + (i + 1) + "</th><td>" + LABU.ipStr(rw.net) + "/" + rw.len + "</td><td>" + LABU.ipStr(rw.mask) + "</td><td>" + esc(rw.hop) + "</td><td>" + esc(rw.ifc) +
            "</td><td>" + (done ? LABU.ipStr(rw.and) : "—") + "</td><td" + (done ? (rw.match ? ' class="is-ok"' : ' class="is-bad"') : "") + ">" + (done ? (rw.match ? "✓ 匹配 /" + rw.len : "✗") : "—") + (best ? " ← 选中" : "") + "</td></tr>";
        });
        o.tbl.innerHTML = h + "</tbody></table></div>";
      }
      function text() {
        var n = S.rows.length;
        if (pos === 0) return "目的地址 " + LABU.ipStr(S.ip) + "。路由器逐条检查路由表：用表项的掩码与目的地址逐位相与，结果等于表项的网络地址就是匹配。";
        if (pos <= n) {
          var rw = S.rows[pos - 1];
          return "第 " + pos + " 条 " + LABU.ipStr(rw.net) + "/" + rw.len + (rw.len === 0 ? "（默认路由）：" : "：掩码 " + LABU.ipStr(rw.mask) + "，") + cmpText(rw) + "。";
        }
        var m = S.rows.filter(function (r) { return r.match; }).map(function (r) { return "/" + r.len; });
        if (S.best < 0) return "没有任何表项匹配，也没有默认路由：路由器丢弃该分组，并向源主机发送 ICMP 终点不可达报文。";
        var e = S.entry, where = e.hop === "直接交付" ? "目的网络与路由器直接相连，直接交付" : "交给下一跳 " + e.hop;
        if (S.isDefault) return "除默认路由外没有表项匹配，于是走默认路由 0.0.0.0/0：" + where + "，从 " + e.ifc + " 转发。";
        return "匹配的表项有 " + m.join("、") + "，按最长前缀匹配选前缀最长的 " + LABU.ipStr(e.net) + "/" + e.len + "（地址块最小、最具体）：" + where + "，从 " + e.ifc + " 转发。";
      }
      function render() {
        draw(); table();
        var fin = pos > S.rows.length;
        o.st.innerHTML = stat("已比较", Math.min(pos, S.rows.length) + " / " + S.rows.length) + stat("匹配", S.rows.slice(0, pos).filter(function (r) { return r.match; }).length) +
          (fin ? (S.best >= 0 ? badge("下一跳 " + S.entry.hop + " · " + S.entry.ifc) : badge("丢弃", true)) : "");
        o.msg.textContent = text();
      }
      function reset() {
        pos = 0; err = null;
        P = LABU.parseTable(ta.value);
        if (P.err) err = P.err;
        else { S = LABU.lpm(P.rows, fi.value); if (S.err) err = S.err; }
        if (err) { showErr(o, svg, err); return; }
        N = S.rows.length + 2;
        o.tip.textContent = "与“子网划分计算器”同一个运算：地址 AND 掩码 = 网络地址。前缀越长，地址块越小、路由越具体，所以优先选它。";
        render();
      }
      function step() { if (err) return false; if (pos < N - 1) { pos++; render(); } return pos < N - 1; }
      reset();
      return { step: step, reset: reset, done: function () { return !!err || pos >= N - 1; } };
    }
  });

  /* ================= 实验 6：数字编码 ================= */
  LAB.push({
    id: "encoding", name: "数字编码波形", color: CN,
    note: "NRZ：高 1 低 0，整位不变；NRZI：遇 1 翻转、遇 0 不变；曼彻斯特：每位中间必跳变，跳变方向表示数据；差分曼彻斯特：中间跳变只作同步，位开始处有跳变表示 0、无跳变表示 1。后两者能自同步，但波特率是比特率的 2 倍。曼彻斯特的方向约定教材不一，以题目为准。",
    mount: function (panel, K) {
      var conv = "hl", S, pos, N, err;
      var fb = field(K, "比特串", "0110", "w");
      br(K);
      var setConv = group(K, [["hl", "曼彻斯特 1 = 高→低"], ["lh", "1 = 低→高"]], conv, function (c) { conv = c; K.restart(); });
      br(K);
      tag(K, "例题");
      preset(K, "0110", function () { fb.value = "0110"; });
      preset(K, "01001110", function () { fb.value = "01001110"; });
      preset(K, "11110000", function () { fb.value = "11110000"; });
      var ROWS = [["nrz", "NRZ"], ["nrzi", "NRZI"], ["man", "曼彻斯特"], ["dman", "差分曼彻斯特"]];
      var WX0 = 124, WX1 = 668, TOP = 44, RH = 72, H = TOP + RH * 4 + 6;
      var svg = svgIn(K, 680, H), o = outs(K, ["st", "msg", "tip"]);
      function draw() {
        clear(svg);
        var n = S.n, bw = (WX1 - WX0) / n, shown = Math.min(pos, n), cur = pos >= 1 && pos <= n ? pos - 1 : -1;
        if (cur >= 0) Rc(svg, "x-lc-colhl", WX0 + cur * bw, 8, bw, H - 12);
        for (var i = 0; i <= n; i++) Ln(svg, "x-lc-bd", WX0 + i * bw, 14, WX0 + i * bw, H - 4);
        for (var i2 = 0; i2 < n; i2++) {
          Ln(svg, "x-lc-md", WX0 + (i2 + 0.5) * bw, 36, WX0 + (i2 + 0.5) * bw, H - 4);
          T(svg, "x-lc-bith" + (i2 < shown ? "" : " is-dim"), WX0 + (i2 + 0.5) * bw, 30, S.bits.charAt(i2), "middle");
        }
        T(svg, "x-lc-t", 6, 30, "比特");
        ROWS.forEach(function (rw, k) {
          var top = TOP + k * RH, hi = top + 12, lo = top + 48, mid = (hi + lo) / 2, w = S.waves[rw[0]];
          T(svg, "x-lc-lb", 6, mid + 5, rw[1]);
          Ln(svg, "x-lc-base", WX0, lo + 8, WX1, lo + 8);
          if (!shown) return;
          var d = "M" + (WX0 - 10) + "," + lo + " H" + WX0, last = 0;
          for (var j = 0; j < 2 * shown; j++) {
            var y = w[j] ? hi : lo, x = WX0 + j * bw / 2;
            if (w[j] !== last) d += " V" + y;
            d += " H" + (x + bw / 2); last = w[j];
          }
          X.svg("path", { class: "x-lc-wave", d: d }, svg);
          for (var b = 0; b < shown; b++) {
            var big = b === cur ? 5 : 3.2;
            if (S.mid[rw[0]][b]) X.svg("circle", { class: "x-lc-mkm", cx: WX0 + (b + 0.5) * bw, cy: mid, r: big }, svg);
            if (S.start[rw[0]][b]) X.svg("circle", { class: "x-lc-mks", cx: WX0 + b * bw, cy: mid, r: big }, svg);
          }
        });
        svg.setAttribute("aria-label", "比特串 " + S.bits + " 的 NRZ、NRZI、曼彻斯特、差分曼彻斯特波形，已画 " + shown + " 位");
      }
      function text() {
        var n = S.n;
        if (pos === 0) return "比特串 " + S.bits + " 共 " + n + " 位，同时画四种编码，逐位前进。蓝点 = 位中间跳变，橙点 = 位开始处跳变。NRZI 与差分曼彻斯特假设信号开始前为低电平。";
        if (pos <= n) {
          var i = pos - 1, b = S.bits.charAt(i) === "1", hiFirst = S.waves.man[2 * i] === 1;
          return "第 " + pos + " 位 = " + (b ? 1 : 0) + "：NRZ " + (b ? "高电平" : "低电平") + "，整位不变；NRZI " + (b ? "遇 1 翻转（位开始处跳变）" : "遇 0 保持不变") +
            "；曼彻斯特 位中间" + (hiFirst ? "高→低" : "低→高") + "，表示 " + (b ? 1 : 0) + "；差分曼彻斯特 位开始处" + (b ? "不跳变（表示 1）" : "跳变（表示 0）") + "，位中间照常跳变（只作同步）。";
        }
        return "四种波形画完。NRZ、NRZI 遇到长串相同比特时没有跳变，接收方无法从信号中提取时钟；曼彻斯特、差分曼彻斯特每位中间都跳变，可自同步，代价是一个比特要两个码元：波特率 = 2 × 比特率（10Mb/s 以太网信号速率为 20MBaud），所需带宽加倍。差分曼彻斯特只看有无跳变、不看极性，抗干扰更好。";
      }
      function render() {
        draw();
        o.st.innerHTML = stat("比特数", S.n) + stat("当前位", pos >= 1 && pos <= S.n ? "第 " + pos + " 位 = " + S.bits.charAt(pos - 1) : "—") + badge(conv === "hl" ? "曼彻斯特：1 = 高→低" : "曼彻斯特：1 = 低→高");
        o.msg.textContent = text();
      }
      function reset() {
        pos = 0;
        S = LABU.encode(fb.value, conv === "lh");
        err = S.err || null;
        if (err) { showErr(o, svg, err); return; }
        N = S.n + 2;
        o.tip.textContent = "约定：站内默认曼彻斯特“位中间由高到低表示 1、由低到高表示 0”（国内教材和真题图示中较常见的画法）；IEEE 802.3 标准的定义正好相反。做题一律以题目给出的约定为准，可用上方按钮切换。";
        render();
      }
      function step() { if (err) return false; if (pos < N - 1) { pos++; render(); } return pos < N - 1; }
      reset();
      return { step: step, reset: reset, done: function () { return !!err || pos >= N - 1; } };
    }
  });

  /* ================= 实验 7：RIP 距离向量 ================= */
  LAB.push({
    id: "rip", name: "RIP 距离向量", color: CN,
    note: "收到邻居 X 的距离向量：先把每项距离加 1、下一跳改为 X；没有的目的网络直接加入；原下一跳就是 X 的无条件替换（无论变大变小）；下一跳不同的只在更短时替换。距离 16 = 不可达，所以 RIP 只适合小网络。坏消息传得慢（无穷计数），可用水平分割、毒性逆转、触发更新缓解。",
    mount: function (panel, K) {
      var mode = "upd", S, R, pos, N, err, C0, V;
      var setMode = group(K, [["upd", "距离向量更新"], ["inf", "坏消息传得慢"]], mode, function (m) { mode = m; K.restart(); });
      br(K);
      var fc = field(K, "C 的路由表", "N1 3 A; N2 5 B; N3 2 D", "w", "text"), fv = field(K, "B 的通告", "N1 4; N2 2; N4 3", "w", "text");
      br(K);
      tag(K, "例题");
      function cfg(c, v) { return function () { mode = "upd"; setMode(mode); fc.value = c; fv.value = v; }; }
      preset(K, "示例一", cfg("N1 3 A; N2 5 B; N3 2 D", "N1 4; N2 2; N4 3"));
      preset(K, "更短才更新", cfg("N 5 A", "N 3"));
      preset(K, "下一跳是 B：变远也更新", cfg("N 2 B", "N 5"));
      var svg = svgIn(K, 680, 150), o = outs(K, ["st", "msg", "tbl", "tip"]);
      function node(x, y, s, cls) { X.svg("circle", { class: "x-lc-rt" + (cls || ""), cx: x, cy: y, r: 20 }, svg); T(svg, "x-lc-rtt" + (cls || ""), x, y + 5, s, "middle"); }
      function drawUpd() {
        svg.setAttribute("viewBox", "0 0 680 150");
        marker(svg, "x-lc-rip-a", "x-lc-ah");
        Ln(svg, "x-lc-link", 150, 110, 320, 110); Ln(svg, "x-lc-link", 360, 110, 530, 110); Ln(svg, "x-lc-link", 340, 50, 340, 90);
        if (pos >= 1) {
          X.svg("line", { class: "x-lc-msgar", x1: 372, y1: 38, x2: 372, y2: 92, "marker-end": "url(#x-lc-rip-a)" }, svg);
          T(svg, "x-lc-t is-strong", 384, 64, "B 发来距离向量：" + V.map(function (v) { return v.net + " " + v.d; }).join("，"));
        }
        node(130, 110, "A"); node(340, 30, "B", pos >= 1 ? " is-src" : ""); node(340, 110, "C", pos >= 2 ? " is-cur" : ""); node(550, 110, "D");
        T(svg, "x-lc-t", 340, 146, "路由器 C 的邻居：A、B、D", "middle");
      }
      function drawInf() {
        var r = R[pos];
        svg.setAttribute("viewBox", "0 0 680 160");
        marker(svg, "x-lc-rip-a", "x-lc-ah");
        Rc(svg, "x-lc-node", 40, 44, 90, 34, 6); T(svg, "x-lc-lb", 85, 66, "网络 N1", "middle");
        Ln(svg, "x-lc-link" + (pos >= 1 ? " is-down" : ""), 130, 61, 310, 61); Ln(svg, "x-lc-link", 350, 61, 540, 61);
        if (pos >= 1) cross(svg, 220, 61, 10);
        node(330, 61, "A", r.from === "A" ? " is-src" : r.from === "B" ? " is-cur" : ""); node(560, 61, "B", r.from === "B" ? " is-src" : r.from === "A" ? " is-cur" : "");
        if (r.from) {
          var ab = r.from === "A";
          X.svg("line", { class: "x-lc-msgar", x1: ab ? 360 : 530, y1: 30, x2: ab ? 530 : 360, y2: 30, "marker-end": "url(#x-lc-rip-a)" }, svg);
          T(svg, "x-lc-t is-strong", 445, 22, r.from + " 通告：N1 距离 " + (ab ? R[pos - 1].A.d : R[pos - 1].B.d), "middle");
        }
        [["A", 330], ["B", 560]].forEach(function (z) {
          var e = r[z[0]];
          T(svg, "x-lc-t" + (e.d >= 16 ? " is-bad" : ""), z[1], 110, "到 N1：" + (e.d >= 16 ? "16（不可达）" : e.d), "middle");
          T(svg, "x-lc-t", z[1], 132, "下一跳：" + e.hop, "middle");
        });
      }
      function tblUpd() {
        var rows = S.rows, k = pos - 2, fin = pos > rows.length + 1;
        var h = '<div class="x-tbl x-lc-tbl"><table><caption>逐条比较（C 收到 B 的距离向量）</caption><thead><tr><th scope="col">目的网络</th><th scope="col">B 通告</th><th scope="col">+1 后（下一跳 B）</th><th scope="col">C 原来</th><th scope="col">结论</th><th scope="col">C 现在</th></tr></thead><tbody>';
        rows.forEach(function (rw, i) {
          var did = i <= k || fin, cur = i === k && !fin;
          var act = { add: "新增", same: "同一下一跳，替换", shorter: "更短，替换", keep: "不更新" }[rw.act];
          h += "<tr" + (cur ? ' class="is-cur"' : "") + '><th scope="row">' + esc(rw.net) + "</th><td>" + rw.adv + "</td><td>" + (pos >= 1 ? rw.nd + "，B" : "—") + "</td><td>" + (rw.old ? rw.old.d + "，" + esc(rw.old.hop) : "（无）") +
            "</td><td" + (did ? (rw.act === "keep" ? "" : ' class="is-ok"') : "") + ">" + (did ? act : "—") + "</td><td>" + (did ? rw.now.d + "，" + esc(rw.now.hop) : rw.old ? rw.old.d + "，" + esc(rw.old.hop) : "—") + "</td></tr>";
        });
        S.untouched.forEach(function (net) {
          var e = C0.filter(function (c) { return c.net === net; })[0];
          h += '<tr><th scope="row">' + esc(net) + "</th><td>—</td><td>—</td><td>" + e.d + "，" + esc(e.hop) + "</td><td>" + (fin ? "不在通告中，不变" : "—") + "</td><td>" + e.d + "，" + esc(e.hop) + "</td></tr>";
        });
        o.tbl.innerHTML = h + "</tbody></table></div>";
      }
      function tblInf() {
        var h = '<div class="x-tbl x-lc-tbl"><table><thead><tr><th scope="col">#</th><th scope="col">事件</th><th scope="col">A 到 N1</th><th scope="col">B 到 N1</th></tr></thead><tbody>';
        for (var i = 0; i <= pos; i++) {
          var r = R[i];
          h += "<tr" + (i === pos ? ' class="is-cur"' : "") + '><th scope="row">' + i + "</th><td>" + (i === 0 ? "正常" : i === 1 ? "A–N1 断开" : r.from + " → " + (r.from === "A" ? "B" : "A")) + "</td><td" + (r.A.d >= 16 ? ' class="is-bad"' : "") + ">" + r.A.d + "，" + esc(r.A.hop) +
            "</td><td" + (r.B.d >= 16 ? ' class="is-bad"' : "") + ">" + r.B.d + "，" + esc(r.B.hop) + "</td></tr>";
        }
        o.tbl.innerHTML = h + "</tbody></table></div>";
      }
      function textUpd() {
        var rows = S.rows;
        if (pos === 0) return "路由器 C 收到邻居 B 发来的距离向量（B 到各网络的距离）。下表“C 原来”一列是 C 原来的路由表，按“下一步”逐条更新。";
        if (pos === 1) return "第一步：把 B 通告的每个距离都加 1（C 要先走一跳到 B），下一跳都改为 B：" + rows.map(function (r) { return r.net + " " + r.adv + "→" + r.nd; }).join("，") + "。";
        if (pos <= rows.length + 1) { var rw = rows[pos - 2]; return rw.net + "：经 B 为 " + rw.nd + "。" + rw.why; }
        return "更新完成。" + (S.untouched.length ? jn(S.untouched) + " 不在 B 的通告中，保持不变。" : "") + "C 的新路由表：" + S.table.map(function (r) { return r.net + " " + r.d + " 经 " + r.hop; }).join("；") + "。";
      }
      function render() {
        clear(svg);
        if (mode === "upd") {
          drawUpd(); tblUpd();
          o.st.innerHTML = stat("通告项", S.rows.length) + stat("已处理", Math.max(0, Math.min(pos - 1, S.rows.length)) + " / " + S.rows.length) +
            (pos > S.rows.length + 1 ? stat("更新", S.rows.filter(function (r) { return r.act !== "keep"; }).length, "项") : "");
          o.msg.textContent = textUpd();
          o.tip.textContent = "格式：路由表每项“网络 距离 下一跳”，通告每项“网络 距离”，用分号分隔；距离 1–16，16 表示不可达。";
        } else {
          drawInf(); tblInf();
          var r = R[pos];
          o.st.innerHTML = stat("A 到 N1", r.A.d) + stat("B 到 N1", r.B.d) + (pos === R.length - 1 ? badge("都到 16：不可达", true) : "");
          o.msg.textContent = r.text + (pos === R.length - 1 ? " 缓解办法：水平分割（不把从某邻居学来的路由再通告回去）、毒性逆转、触发更新。" : "");
          o.tip.textContent = "这一模式使用固定拓扑 N1 — A — B，上方输入框不起作用。";
        }
        svg.setAttribute("aria-label", mode === "upd" ? "RIP 距离向量更新第 " + pos + " 步" : "RIP 坏消息传得慢第 " + pos + " 步");
      }
      function reset() {
        pos = 0; err = null;
        if (mode === "upd") {
          var a = LABU.parseRip(fc.value, true, "C 的路由表"), b = LABU.parseRip(fv.value, false, "B 的通告");
          if (a.err) err = a.err; else if (b.err) err = b.err;
          else { C0 = a.rows; V = b.rows; S = LABU.ripUpdate(C0, "B", V); N = S.rows.length + 3; }
        } else { R = LABU.ripCountInf(); N = R.length; }
        if (err) { showErr(o, svg, err); return; }
        render();
      }
      function step() { if (err) return false; if (pos < N - 1) { pos++; render(); } return pos < N - 1; }
      reset();
      return { step: step, reset: reset, done: function () { return !!err || pos >= N - 1; } };
    }
  });
})();
