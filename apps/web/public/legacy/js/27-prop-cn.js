      /* 性质与公式 · 计算机网络（14 条）
         注册到 window.PROP；纯计算函数挂在 window.PROPU.cn 上（不碰 DOM，可在 node 里单测，见 src/legacy/propcn.test.ts）。
         demo(box) 只在卡片打开时调用，返回 { destroy }；加载时不访问 DOM。样式见 css/legacy-14.css，类名前缀 x-pq-
         （x-pn__ 已被过程图解引擎占用）。 */
      (function () {
        var PROP = window.PROP = window.PROP || [];
        var PROPU = window.PROPU = window.PROPU || {};

        /* ================= 纯函数 ================= */
        function log2(x) { return Math.log(x) / Math.LN2; }
        function round(x, d) { var p = Math.pow(10, d == null ? 2 : d); return Math.round(x * p) / p; }
        function fmt(x, d) {
          if (x === Infinity) return "∞";
          if (typeof x !== "number" || isNaN(x)) return "—";
          var r = round(x, d == null ? 2 : d);
          return String(r);
        }
        /* 带单位的速率：b/s → kb/s → Mb/s → Gb/s（1k = 1000） */
        function rate(bps, d) {
          if (typeof bps !== "number" || isNaN(bps)) return "—";
          var u = ["b/s", "kb/s", "Mb/s", "Gb/s", "Tb/s"], i = 0, v = bps;
          while (Math.abs(v) >= 1000 && i < u.length - 1) { v /= 1000; i++; }
          return fmt(v, d == null ? 3 : d) + " " + u[i];
        }
        /* 时间（秒）→ 合适的单位 */
        function dur(s, d) {
          if (typeof s !== "number" || isNaN(s)) return "—";
          if (s === 0) return "0 s";
          var a = Math.abs(s);
          if (a >= 1) return fmt(s, d == null ? 4 : d) + " s";
          if (a >= 1e-3) return fmt(s * 1e3, d == null ? 4 : d) + " ms";
          if (a >= 1e-6) return fmt(s * 1e6, d == null ? 4 : d) + " μs";
          return fmt(s * 1e9, d == null ? 4 : d) + " ns";
        }
        /* 解析一个数：允许全角数字、中文负号、科学计数；opt: {min, max, int, name, gt} */
        function num(s, opt) {
          opt = opt || {};
          var name = opt.name || "数值";
          var t = String(s == null ? "" : s).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); })
            .replace(/[−－]/g, "-").replace(/．/g, ".").replace(/\s+/g, "");
          if (t === "") return { err: "请输入" + name };
          if (!/^-?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?$/i.test(t)) return { err: name + "“" + s + "”不是合法的数" };
          var v = parseFloat(t);
          if (!isFinite(v)) return { err: name + "超出范围" };
          if (opt.int && Math.floor(v) !== v) return { err: name + "必须是整数" };
          if (opt.gt != null && !(v > opt.gt)) return { err: name + "必须大于 " + opt.gt };
          if (opt.min != null && v < opt.min) return { err: name + "不能小于 " + opt.min };
          if (opt.max != null && v > opt.max) return { err: name + "不能大于 " + opt.max };
          return { v: v };
        }

        /* ---------- 物理层 ---------- */
        function nyquist(W, V) {
          return { baud: 2 * W, bits: log2(V), rate: 2 * W * log2(V) };
        }
        function dbToSN(dB) { return Math.pow(10, dB / 10); }
        function snToDb(sn) { return 10 * Math.log(sn) / Math.LN10; }
        function shannon(W, dB) { return W * log2(1 + dbToSN(dB)); }
        /* 同时给出 W、V、dB：两个极限取小 */
        function limit(W, V, dB) {
          var ny = nyquist(W, V).rate, sh = shannon(W, dB);
          return { nyquist: ny, shannon: sh, rate: Math.min(ny, sh), by: ny <= sh ? "nyquist" : "shannon" };
        }
        /* 码元速率：曼彻斯特 / 差分曼彻斯特每比特 2 个码元 */
        var SCHEMES = { nrz: { name: "NRZ", per: 1 }, nrzi: { name: "NRZI", per: 1 }, man: { name: "曼彻斯特", per: 2 }, dman: { name: "差分曼彻斯特", per: 2 } };
        function baudOf(bitRate, scheme) { var s = SCHEMES[scheme]; return s ? bitRate * s.per : NaN; }
        /* 波形：返回每半个比特的电平（0 低 1 高），NRZ/NRZI 两半相同；NRZI、差分曼彻斯特假设开始前为低电平；
           曼彻斯特默认“1 = 高→低”（谢希仁画法），hl=false 时相反 */
        function encode(bits, scheme, hl) {
          if (hl == null) hl = true;
          var out = [], lv = 0;
          for (var i = 0; i < bits.length; i++) {
            var b = bits.charAt(i) === "1";
            if (scheme === "nrz") { out.push(b ? 1 : 0, b ? 1 : 0); }
            else if (scheme === "nrzi") { if (b) lv = 1 - lv; out.push(lv, lv); }
            else if (scheme === "man") { var first = (b === hl) ? 1 : 0; out.push(first, 1 - first); }
            else if (scheme === "dman") { if (!b) lv = 1 - lv; out.push(lv, 1 - lv); lv = 1 - lv; }
          }
          return out;
        }

        /* ---------- 时延 ---------- */
        function delays(L, R, d, v) {
          var tx = L / R, prop = d / v;
          return { tx: tx, prop: prop, total: tx + prop, bdp: prop * R };
        }
        /* t 时刻还在链路上的比特数：发送窗口 [0, tx]，每比特在链路上停留 prop */
        function inFlight(t, L, R, d, v) {
          var tx = L / R, prop = d / v;
          var a = Math.max(0, t - prop), b = Math.min(tx, t);
          return Math.max(0, b - a) * R;
        }

        /* ---------- 数据链路层 ---------- */
        function swU(TD, RTT, TA) { return TD / (TD + RTT + (TA || 0)); }
        function arqU(W, TD, RTT, TA) { return Math.min(1, W * TD / (TD + RTT + (TA || 0))); }
        /* 达到利用率 u 至少要的窗口；再按 GBN/SR 求最少序号位数 */
        function needWindow(u, TD, RTT) { return Math.ceil(u * (TD + RTT) / TD - 1e-9); }
        function seqBits(W, proto) {
          var n = 1;
          while ((proto === "sr" ? Math.pow(2, n - 1) : Math.pow(2, n) - 1) < W) n++;
          return n;
        }
        function winMax(n) { return { M: Math.pow(2, n), gbn: Math.pow(2, n) - 1, sr: Math.pow(2, n - 1) }; }
        /* 窗口混淆检查：发送方发出 0..Wt-1 号帧全部收到、ACK 全丢，发送方重发旧帧；
           接收方此时的窗口是 Wt..Wt+Wr-1（模 2^n）。两者重叠即混淆。GBN 的 Wr = 1 */
        function winCheck(proto, n, Wt, Wr) {
          var M = Math.pow(2, n);
          if (proto === "gbn") Wr = 1;
          var old = [], recv = [], overlap = [], i, inOld = {};
          for (i = 0; i < Wt; i++) { old.push(i % M); inOld[i % M] = 1; }
          for (i = 0; i < Wr; i++) { var s = (Wt + i) % M; recv.push(s); if (inOld[s] && overlap.indexOf(s) < 0) overlap.push(s); }
          var lim = proto === "gbn" ? M - 1 : M;
          return { M: M, old: old, recv: recv, overlap: overlap, ok: overlap.length === 0, limit: lim, sum: Wt + Wr };
        }
        function tauOf(d, v) { return d / v; }
        function minFrame(R, tau) { return 2 * tau * R; }
        /* 第 n 次冲突后：k = min(n, 10)，r ∈ [0, 2^k − 1]，等待 r × 争用期；第 16 次冲突后放弃 */
        function backoff(n, slot) {
          var k = Math.min(n, 10), maxR = Math.pow(2, k) - 1;
          return { k: k, maxR: maxR, maxWait: maxR * (slot || 0), discard: n >= 16 };
        }
        /* 以太网 MAC 帧：首部 14 + FCS 4 = 18 B；数据 46 ~ 1500 B，不足补齐 */
        function etherFrame(data) {
          if (data > 1500) return { err: "数据部分超过 1500 字节，以太网帧装不下，需要在 IP 层分片" };
          var pad = Math.max(0, 46 - data);
          return { data: data, pad: pad, frame: data + pad + 18 };
        }
        /* 冲突域 / 广播域：links = [[a, b], …]，types = {节点: "host"|"hub"|"switch"|"router"}。
           集线器把所连的链路并成一个冲突域；集线器、交换机都把链路并成一个广播域；路由器隔开两者 */
        function domains(types, links) {
          function uf(n) { var p = []; for (var i = 0; i < n; i++) p.push(i); return p; }
          function find(p, x) { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; }
          var pc = uf(links.length), pb = uf(links.length), at = {};
          links.forEach(function (l, i) { [l[0], l[1]].forEach(function (nd) { (at[nd] = at[nd] || []).push(i); }); });
          Object.keys(at).forEach(function (nd) {
            var t = types[nd], ls = at[nd];
            for (var j = 1; j < ls.length; j++) {
              if (t === "hub") pc[find(pc, ls[j])] = find(pc, ls[0]);
              if (t === "hub" || t === "switch") pb[find(pb, ls[j])] = find(pb, ls[0]);
            }
          });
          var cid = {}, bid = {}, coll = [], bc = [];
          links.forEach(function (l, i) {
            var a = find(pc, i), b = find(pb, i);
            if (cid[a] == null) cid[a] = Object.keys(cid).length;
            if (bid[b] == null) bid[b] = Object.keys(bid).length;
            coll.push(cid[a]); bc.push(bid[b]);
          });
          return { collision: Object.keys(cid).length, broadcast: Object.keys(bid).length, coll: coll, bc: bc };
        }

        /* ---------- 网络层 ---------- */
        function ipParse(s) {
          var t = String(s == null ? "" : s).replace(/\s+/g, "").replace(/。/g, ".").replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); });
          var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(t);
          if (!m) return { err: "IP 地址“" + s + "”格式不对，应为点分十进制，如 192.168.1.10" };
          var v = 0;
          for (var i = 1; i <= 4; i++) {
            var x = +m[i];
            if (x > 255) return { err: "IP 地址每段应在 0 ~ 255 之间，“" + m[i] + "”超出范围" };
            v = v * 256 + x;
          }
          return { v: v };
        }
        function ipStr(v) { return [v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255].join("."); }
        function maskOf(p) { return p === 0 ? 0 : (0xFFFFFFFF << (32 - p)) >>> 0; }
        function bin32(v, dots) {
          var s = (v >>> 0).toString(2);
          while (s.length < 32) s = "0" + s;
          return dots === false ? s : s.slice(0, 8) + "." + s.slice(8, 16) + "." + s.slice(16, 24) + "." + s.slice(24);
        }
        function parseCidr(s) {
          var t = String(s == null ? "" : s).replace(/\s+/g, "");
          var m = /^([^/]+)\/(\d{1,2})$/.exec(t);
          if (!m) return { err: "“" + s + "”应写成 地址/前缀，如 172.16.4.0/22" };
          var a = ipParse(m[1]);
          if (a.err) return a;
          var p = +m[2];
          if (p > 32) return { err: "前缀长度应在 0 ~ 32 之间" };
          return { v: a.v, p: p, net: (a.v & maskOf(p)) >>> 0 };
        }
        function subnet(addr, p) {
          var mask = maskOf(p), net = (addr & mask) >>> 0, h = 32 - p;
          var size = Math.pow(2, h), bc = (net + size - 1) >>> 0;
          var hosts = Math.max(0, size - 2);
          return { mask: mask, network: net, broadcast: bc, h: h, size: size, hosts: hosts,
            first: hosts ? net + 1 : null, last: hosts ? bc - 1 : null };
        }
        /* s 位子网号：2^s 个子网（CIDR 下全 0、全 1 子网可用），每个子网可用主机 2^(h−s) − 2 */
        function split(p, s) { return { subnets: Math.pow(2, s), prefix: p + s, hosts: Math.max(0, Math.pow(2, 32 - p - s) - 2) }; }
        /* 路由聚合：各前缀的网络地址取最长公共前缀（不超过最短的前缀） */
        function aggregate(list) {
          if (!list.length) return { err: "至少给出一个地址块" };
          var L = 32, base = list[0].net, cover = 0;
          list.forEach(function (c) { L = Math.min(L, c.p); });
          list.forEach(function (c) {
            var x = (c.net ^ base) >>> 0, same = 0;
            while (same < 32 && !(x & (0x80000000 >>> same))) same++;
            L = Math.min(L, same);
          });
          var net = (base & maskOf(L)) >>> 0, seen = {};
          list.forEach(function (c) { var k = c.net + "/" + c.p; if (!seen[k]) { seen[k] = 1; cover += Math.pow(2, 32 - c.p); } });
          var size = Math.pow(2, 32 - L);
          return { len: L, net: net, text: ipStr(net) + "/" + L, size: size, extra: Math.max(0, size - cover) };
        }
        /* 最长前缀匹配：返回命中的下标（都不匹配为 -1） */
        function lpm(list, dst) {
          var best = -1, bl = -1;
          list.forEach(function (c, i) { if (((dst & maskOf(c.p)) >>> 0) === c.net && c.p > bl) { best = i; bl = c.p; } });
          return best;
        }
        /* IP 分片：total 为原分组总长度（含首部），hdr 为首部长度，mtu 为链路 MTU */
        function fragment(total, hdr, mtu) {
          if (!(hdr >= 20 && hdr <= 60 && hdr % 4 === 0)) return { err: "首部长度应为 20 ~ 60 字节，且是 4 的倍数" };
          if (!(total > hdr)) return { err: "总长度必须大于首部长度" };
          if (total > 65535) return { err: "IP 分组总长度最大 65535 字节（总长度字段 16 位）" };
          if (mtu < hdr + 8) return { err: "MTU 至少要能装下首部 + 8 字节数据" };
          var data = total - hdr, list = [], off = 0;
          if (total <= mtu) return { max: data, frags: [{ i: 1, data: data, len: total, off: 0, off8: 0, mf: 0 }], whole: true };
          var max = Math.floor((mtu - hdr) / 8) * 8;
          while (off < data) {
            var d = Math.min(max, data - off);
            list.push({ i: list.length + 1, data: d, len: d + hdr, off: off, off8: off / 8, mf: off + d < data ? 1 : 0 });
            off += d;
          }
          return { max: max, frags: list, whole: false };
        }

        /* ---------- 传输层 ---------- */
        /* TCP Reno：st = {cwnd, ssthresh}（单位 MSS）。ev: "ok" 一个 RTT 全部确认 / "timeout" / "dup3" */
        function renoNext(st, ev) {
          var c = st.cwnd, s = st.ssthresh, half = Math.max(1, Math.floor(c / 2));
          if (ev === "timeout") return { cwnd: 1, ssthresh: half, phase: "慢开始", ev: ev };
          if (ev === "dup3") return { cwnd: half, ssthresh: half, phase: "拥塞避免", ev: ev };
          if (c < s) { var n = Math.min(2 * c, s); return { cwnd: n, ssthresh: s, phase: n < s ? "慢开始" : "拥塞避免", ev: ev }; }
          return { cwnd: c + 1, ssthresh: s, phase: "拥塞避免", ev: ev };
        }
        function renoRun(cwnd0, ssthresh0, evs) {
          var st = { cwnd: cwnd0, ssthresh: ssthresh0, phase: cwnd0 < ssthresh0 ? "慢开始" : "拥塞避免", ev: "start" }, out = [st];
          (evs || []).forEach(function (e) { st = renoNext(st, e); out.push(st); });
          return out;
        }
        /* 吞吐量：发送窗口 = min(rwnd, cwnd)；上限 = 窗口 / RTT，再不超过链路带宽 */
        function throughput(rwnd, cwnd, rtt, bw) {
          var w = Math.min(rwnd, cwnd), tp = w * 8 / rtt;
          var cap = bw ? Math.min(tp, bw) : tp;
          return { win: w, by: rwnd <= cwnd ? "rwnd" : "cwnd", tp: tp, cap: cap, util: bw ? cap / bw : null };
        }
        function maxRwnd(shift) { return 65535 * Math.pow(2, shift || 0); }
        /* 三次握手 + 客户端发数据 + 四次挥手，逐个报文段的 seq / ack（服务器不发数据） */
        function tcpWalk(x, y, lens) {
          var segs = [], cs = x, ss = y;
          function push(from, flags, seq, ack, len, note) { segs.push({ from: from, flags: flags, seq: seq, ack: ack, len: len || 0, note: note }); }
          push("C", "SYN", x, null, 0, "SYN 不带数据，但消耗 1 个序号");
          push("S", "SYN, ACK", y, x + 1, 0, "确认号 = x + 1，表示期望收到客户端第 x + 1 号字节");
          push("C", "ACK", x + 1, y + 1, 0, "纯 ACK 不消耗序号，所以下一个数据段仍从 x + 1 开始");
          cs = x + 1; ss = y + 1;
          (lens || []).forEach(function (L, i) {
            push("C", "ACK", cs, ss, L, "第 " + (i + 1) + " 段数据 " + L + " 字节：序号 " + cs + " ~ " + (cs + L - 1));
            cs += L;
            push("S", "ACK", ss, cs, 0, "确认号 = " + cs + " = 期望的下一个字节");
          });
          push("C", "FIN, ACK", cs, ss, 0, "FIN 不带数据，也消耗 1 个序号");
          push("S", "ACK", ss, cs + 1, 0, "确认 FIN：确认号 = FIN 的序号 + 1");
          push("S", "FIN, ACK", ss, cs + 1, 0, "服务器没发过数据，FIN 的序号仍是 y + 1");
          push("C", "ACK", cs + 1, ss + 1, 0, "最后一个 ACK，之后客户端等待 2MSL");
          return segs;
        }

        PROPU.cn = {
          fmt: fmt, rate: rate, dur: dur, num: num, log2: log2,
          nyquist: nyquist, dbToSN: dbToSN, snToDb: snToDb, shannon: shannon, limit: limit,
          SCHEMES: SCHEMES, baudOf: baudOf, encode: encode,
          delays: delays, inFlight: inFlight,
          swU: swU, arqU: arqU, needWindow: needWindow, seqBits: seqBits, winMax: winMax, winCheck: winCheck,
          tauOf: tauOf, minFrame: minFrame, backoff: backoff, etherFrame: etherFrame, domains: domains,
          ipParse: ipParse, ipStr: ipStr, maskOf: maskOf, bin32: bin32, parseCidr: parseCidr, subnet: subnet, split: split,
          aggregate: aggregate, lpm: lpm, fragment: fragment,
          renoNext: renoNext, renoRun: renoRun, throughput: throughput, maxRwnd: maxRwnd, tcpWalk: tcpWalk
        };
        var U = PROPU.cn;

        /* ================= 界面工具（只在 demo 里调用） ================= */
        var NS = "http://www.w3.org/2000/svg";
        function E(tag, attrs, text) {
          var n = document.createElement(tag);
          for (var k in attrs || {}) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
          if (text != null) n.textContent = text;
          return n;
        }
        function S(tag, attrs, parent) {
          var n = document.createElementNS(NS, tag);
          for (var k in attrs || {}) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
          if (parent) parent.appendChild(n);
          return n;
        }
        function T(parent, x, y, s, attrs) {
          var a = { x: x, y: y, "font-size": 13, class: "x-pq-t" };
          for (var k in attrs || {}) a[k] = attrs[k];
          var t = S("text", a, parent);
          t.textContent = s;
          return t;
        }
        function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }
        function reduced() { return !!(window.X && window.X.reduced); }

        /* 每个 demo 的骨架：控件区 + 画布 + 读数；destroy 统一清理定时器与节点 */
        function kit(box, label) {
          var root = E("div", { class: "x-pq", role: "group", "aria-label": label });
          var ctrl = E("div", { class: "x-pq__ctrl" });
          var stage = E("div", { class: "x-pq__stage" });
          var out = E("div", { class: "x-pq__out", "aria-live": "polite" });
          root.appendChild(ctrl); root.appendChild(stage); root.appendChild(out);
          box.appendChild(root);
          var timers = [], dead = false;
          var K = {
            root: root, ctrl: ctrl, stage: stage, out: out,
            row: function () { var r = E("div", { class: "x-pq__line" }); ctrl.appendChild(r); return r; },
            field: function (label, val, opt) {
              opt = opt || {};
              var l = E("label", { class: "x-lab__lbl x-pq__f" + (opt.wide ? " x-pq__f--w" : "") });
              l.appendChild(document.createTextNode(label + " "));
              var inp = E("input", { type: "text", class: "x-lab__sel x-pq__in" + (opt.wide ? " x-pq__in--w" : ""), value: val, spellcheck: "false",
                autocomplete: "off", autocapitalize: "off", inputmode: opt.mode || "decimal", "aria-label": label });
              l.appendChild(inp);
              if (opt.unit) l.appendChild(E("span", { class: "x-pq__u" }, opt.unit));
              (opt.parent || ctrl).appendChild(l);
              if (opt.on) inp.addEventListener("input", opt.on);
              return inp;
            },
            range: function (label, min, max, step, val, on, parent) {
              var l = E("label", { class: "x-lab__lbl x-pq__f x-pq__f--r" });
              l.appendChild(document.createTextNode(label + " "));
              var inp = E("input", { type: "range", class: "x-pq__range", min: min, max: max, step: step, value: val, "aria-label": label });
              var v = E("b", { class: "x-pq__rv" }, String(val));
              l.appendChild(inp); l.appendChild(v);
              (parent || ctrl).appendChild(l);
              inp.addEventListener("input", function () { v.textContent = inp.value; on(+inp.value); });
              return { input: inp, set: function (x) { inp.value = x; v.textContent = String(x); } };
            },
            btn: function (label, on, opt) {
              opt = opt || {};
              var b = E("button", { type: "button", class: "x-lab__btn x-pq__btn" + (opt.main ? " x-lab__btn--main" : ""), "aria-pressed": opt.toggle ? "false" : null }, label);
              b.addEventListener("click", on);
              (opt.parent || ctrl).appendChild(b);
              return b;
            },
            group: function (items, cur, on, parent) {
              var wrap = E("div", { class: "x-pq__grp", role: "group" });
              var btns = items.map(function (it) {
                var b = E("button", { type: "button", class: "x-lab__btn x-pq__btn", "aria-pressed": it[0] === cur ? "true" : "false" }, it[1]);
                b.addEventListener("click", function () { set(it[0]); on(it[0]); });
                wrap.appendChild(b);
                return b;
              });
              function set(k) { items.forEach(function (it, i) { btns[i].setAttribute("aria-pressed", it[0] === k ? "true" : "false"); }); }
              (parent || ctrl).appendChild(wrap);
              return { set: set, btns: btns };
            },
            svg: function (w, h, label) {
              clearNode(stage);
              var s = S("svg", { viewBox: "0 0 " + w + " " + h, class: "x-pq__svg", role: "img", "aria-label": label || "" }, stage);
              return s;
            },
            show: function (rows, note) {
              clearNode(out);
              var dl = E("div", { class: "x-pq__rows" });
              rows.forEach(function (r) {
                var it = E("div", { class: "x-pq__kv" + (r[2] ? " is-hl" : "") });
                it.appendChild(E("span", { class: "x-pq__k" }, r[0]));
                it.appendChild(E("b", { class: "x-pq__v" }, r[1]));
                dl.appendChild(it);
              });
              out.appendChild(dl);
              if (note) out.appendChild(E("p", { class: "x-pq__note" }, note));
            },
            err: function (msg) {
              clearNode(out);
              out.appendChild(E("p", { class: "x-pq__err x-lab__err", role: "alert" }, msg));
            },
            every: function (ms, fn) { var id = setInterval(function () { if (!dead) fn(); }, ms); timers.push(id); return id; },
            stop: function (id) { clearInterval(id); var i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1); },
            destroy: function () {
              dead = true;
              timers.forEach(function (id) { clearInterval(id); });
              timers = [];
              if (root.parentNode) root.parentNode.removeChild(root);
            }
          };
          return K;
        }
        /* 取多个输入框的数：{ok, v: {…}} 或 {err} */
        function readAll(specs) {
          var v = {};
          for (var i = 0; i < specs.length; i++) {
            var sp = specs[i], r = num(sp[1].value, sp[2]);
            if (r.err) return { err: r.err };
            v[sp[0]] = r.v;
          }
          return { v: v };
        }
        function axis(svg, x0, y0, x1, y1) {
          S("line", { x1: x0, y1: y1, x2: x1, y2: y1, class: "x-pq-ax" }, svg);
          S("line", { x1: x0, y1: y0, x2: x0, y2: y1, class: "x-pq-ax" }, svg);
        }
        var PAL = ["#4766B3", "#C0603E", "#3A8475", "#C49431", "#8A5AB5", "#2F8FA8", "#B5476E", "#6E7B2F"];

        /* ================= 1. 奈奎斯特定理 ================= */
        function demoNyquist(box) {
          var K = kit(box, "奈奎斯特定理验证"), W = 3, e = 4;
          K.range("带宽 W（kHz）", 1, 20, 1, W, function (x) { W = x; draw(); });
          K.range("电平数 V = 2^", 1, 8, 1, e, function (x) { e = x; draw(); });
          function draw() {
            var V = Math.pow(2, e), r = U.nyquist(W * 1000, V);
            var svg = K.svg(720, 220, "V = " + V + " 个电平的码元波形");
            var x0 = 60, x1 = 700, y0 = 24, y1 = 180, n = 16;
            axis(svg, x0, y0, x1, y1);
            var levels = Math.min(V, 16);
            for (var l = 0; l < levels; l++) {
              var y = y1 - (l + 0.5) * (y1 - y0) / levels;
              S("line", { x1: x0, y1: y, x2: x1, y2: y, class: "x-pq-grid" }, svg);
            }
            var d = "", w = (x1 - x0) / n, seed = 7;
            for (var i = 0; i < n; i++) {
              seed = (seed * 37 + 11) % 101;
              var lv = seed % levels, yy = y1 - (lv + 0.5) * (y1 - y0) / levels;
              d += (i ? "L" : "M") + (x0 + i * w) + " " + yy + " L" + (x0 + (i + 1) * w) + " " + yy + " ";
              T(svg, x0 + i * w + w / 2, 205, String(lv), { "text-anchor": "middle", class: "x-pq-t x-pq-t--m" });
            }
            S("path", { d: d, class: "x-pq-wave" }, svg);
            T(svg, x0 - 8, y0 + 6, V > 16 ? V + " 级（示意 16 级）" : V + " 级", { "text-anchor": "end", class: "x-pq-t x-pq-t--s" });
            T(svg, 6, 205, "码元取值", { class: "x-pq-t x-pq-t--s" });
            K.show([
              ["极限码元速率 2W", U.fmt(r.baud / 1000, 3) + " kBaud"],
              ["每个码元携带 log₂V", U.fmt(r.bits, 3) + " bit"],
              ["极限数据速率 2W·log₂V", U.rate(r.rate), true]
            ], "带宽决定每秒最多 " + U.fmt(r.baud / 1000) + "k 个码元；要再提速只能让每个码元多带比特（增大 V）。V = 16 时 log₂16 = 4，3 kHz 正好是 24 kb/s。");
          }
          draw();
          return { destroy: K.destroy };
        }

        /* ================= 2. 香农定理 ================= */
        function demoShannon(box) {
          var K = kit(box, "香农定理验证"), mode = "db";
          var r1 = K.row();
          var iW = K.field("带宽 W", "3", { unit: "kHz", on: draw, parent: r1 });
          var iS = K.field("信噪比", "30", { unit: "dB", on: draw, parent: r1 });
          var iV = K.field("码元电平数 V", "16", { on: draw, parent: r1, mode: "numeric" });
          var unit = iS.parentNode.querySelector(".x-pq__u");
          K.group([["db", "按 dB 输入"], ["sn", "按 S/N 输入"]], mode, function (m) {
            var cur = num(iS.value, {});
            if (!cur.err) iS.value = m === "sn" ? String(round(U.dbToSN(cur.v), 4)) : String(round(U.snToDb(cur.v), 4));
            mode = m; unit.textContent = m === "db" ? "dB" : "（S/N 倍数）"; draw();
          });
          function draw() {
            var a = readAll([["W", iW, { name: "带宽", gt: 0 }], ["V", iV, { name: "电平数 V", int: true, min: 2, max: 65536 }]]);
            if (a.err) return K.err(a.err);
            var s = num(iS.value, { name: "信噪比" });
            if (s.err) return K.err(s.err);
            if (mode === "sn" && !(s.v > 0)) return K.err("S/N 是功率之比，必须大于 0");
            var dB = mode === "db" ? s.v : U.snToDb(s.v), sn = U.dbToSN(dB), W = a.v.W * 1000;
            var L = U.limit(W, a.v.V, dB);
            var svg = K.svg(720, 170, "奈奎斯特与香农极限速率对比");
            var mx = Math.max(L.nyquist, L.shannon) || 1, x0 = 150, wmax = 400;
            [["奈奎斯特 2W·log₂V", L.nyquist, "nyquist", 30], ["香农 W·log₂(1+S/N)", L.shannon, "shannon", 90]].forEach(function (it) {
              var w = Math.max(2, it[1] / mx * wmax);
              S("rect", { x: x0, y: it[3], width: w, height: 34, rx: 4, class: "x-pq-bar" + (L.by === it[2] ? " is-min" : "") }, svg);
              T(svg, x0 - 8, it[3] + 22, it[0].split(" ")[0], { "text-anchor": "end" });
              T(svg, x0 + w + 10, it[3] + 22, U.rate(it[1]), { class: "x-pq-t x-pq-t--m" });
            });
            T(svg, x0, 158, "实际极限取两者较小值（深色）", { class: "x-pq-t x-pq-t--s" });
            K.show([
              ["S/N（倍数）", U.fmt(sn, 4)],
              ["信噪比（dB）= 10·lg(S/N)", U.fmt(dB, 4) + " dB"],
              ["香农极限", U.rate(L.shannon)],
              ["奈奎斯特极限", U.rate(L.nyquist)],
              ["实际上限 min(…)", U.rate(L.rate), true]
            ], (L.by === "nyquist" ? "码元电平数不够，受奈奎斯特限制；" : "噪声是瓶颈，受香农限制；") +
              "30 dB 对应 S/N = 1000，不是 30。3 kHz、30 dB 时 C = 3000 × log₂1001 ≈ 29.9 kb/s。");
          }
          draw();
          return { destroy: K.destroy };
        }

        /* ================= 3. 时延与时延带宽积 ================= */
        function demoDelay(box) {
          var K = kit(box, "发送时延、传播时延与时延带宽积"), t = 0, timer = null, P = null;
          var r1 = K.row();
          var iL = K.field("数据长度", "8000", { unit: "bit", parent: r1, on: reset });
          var iR = K.field("发送速率", "1", { unit: "Mb/s", parent: r1, on: reset });
          var r2 = K.row();
          var iD = K.field("链路长度", "1000", { unit: "km", parent: r2, on: reset });
          var iV = K.field("传播速率", "200000", { unit: "km/s", parent: r2, on: reset });
          var r3 = K.row();
          var bPlay = K.btn("播放", function () { if (timer) pause(); else play(); }, { main: true, toggle: true, parent: r3 });
          K.btn("单步", function () { pause(); step(); }, { parent: r3 });
          K.btn("重置", function () { pause(); reset(); }, { parent: r3 });
          function params() {
            var a = readAll([["L", iL, { name: "数据长度", gt: 0 }], ["R", iR, { name: "发送速率", gt: 0 }], ["d", iD, { name: "链路长度", gt: 0 }], ["v", iV, { name: "传播速率", gt: 0 }]]);
            if (a.err) return a;
            var v = a.v;
            return { L: v.L, R: v.R * 1e6, d: v.d * 1000, v: v.v * 1000 };
          }
          function reset() { t = 0; P = params(); draw(); }
          function step() {
            if (!P || P.err) return;
            var D = U.delays(P.L, P.R, P.d, P.v);
            t = Math.min(D.total, t + D.total / 40);
            draw();
            if (t >= D.total) pause();
          }
          function play() {
            if (!P || P.err) return;
            var D = U.delays(P.L, P.R, P.d, P.v);
            if (t >= D.total) t = 0;
            bPlay.setAttribute("aria-pressed", "true"); bPlay.textContent = "暂停";
            timer = K.every(reduced() ? 400 : 80, step);
          }
          function pause() { if (timer) K.stop(timer); timer = null; bPlay.setAttribute("aria-pressed", "false"); bPlay.textContent = "播放"; }
          function draw() {
            if (P.err) return K.err(P.err);
            var D = U.delays(P.L, P.R, P.d, P.v), x0 = 90, x1 = 650, y = 80;
            var svg = K.svg(720, 190, "链路上正在传输的比特");
            S("rect", { x: 20, y: y - 26, width: 60, height: 52, rx: 6, class: "x-pq-node" }, svg);
            T(svg, 50, y + 5, "发送方", { "text-anchor": "middle" });
            S("rect", { x: 660, y: y - 26, width: 52, height: 52, rx: 6, class: "x-pq-node" }, svg);
            T(svg, 686, y + 5, "接收", { "text-anchor": "middle" });
            S("rect", { x: x0, y: y - 12, width: x1 - x0, height: 24, class: "x-pq-pipe" }, svg);
            var front = Math.min(P.d, Math.max(0, t) * P.v), back = Math.max(0, (t - D.tx) * P.v);
            var fx = x0 + front / P.d * (x1 - x0), bx = x0 + Math.min(back, P.d) / P.d * (x1 - x0);
            if (fx > bx) S("rect", { x: bx, y: y - 12, width: fx - bx, height: 24, class: "x-pq-bits" }, svg);
            var on = U.inFlight(t, P.L, P.R, P.d, P.v), sent = Math.min(P.L, t * P.R), got = Math.max(0, Math.min(P.L, (t - D.prop) * P.R));
            T(svg, x0, 132, "已发出 " + U.fmt(sent, 1) + " bit", { class: "x-pq-t x-pq-t--s" });
            T(svg, (x0 + x1) / 2, 132, "链路上 " + U.fmt(on, 1) + " bit", { "text-anchor": "middle", class: "x-pq-t x-pq-t--hl" });
            T(svg, x1, 132, "已收到 " + U.fmt(got, 1) + " bit", { "text-anchor": "end", class: "x-pq-t x-pq-t--s" });
            T(svg, x0, 30, "t = " + U.dur(t), { class: "x-pq-t x-pq-t--m" });
            var prog = D.total ? t / D.total : 0;
            S("rect", { x: x0, y: 160, width: (x1 - x0), height: 8, rx: 4, class: "x-pq-track" }, svg);
            S("rect", { x: x0, y: 160, width: (x1 - x0) * prog, height: 8, rx: 4, class: "x-pq-prog" }, svg);
            K.show([
              ["发送时延 L/R", U.dur(D.tx)],
              ["传播时延 d/v", U.dur(D.prop)],
              ["总时延（不计排队、处理）", U.dur(D.total)],
              ["时延带宽积 = 传播时延 × R", U.fmt(D.bdp, 2) + " bit", true],
              ["此刻链路上的比特", U.fmt(on, 1) + " bit"]
            ], "链路上同时“装着”的比特最多是 min(L, 时延带宽积) = " + U.fmt(Math.min(P.L, D.bdp), 2) + " bit。数据比时延带宽积短时，第一个比特还没到对端，最后一个比特已经发完。");
          }
          reset();
          return { destroy: function () { pause(); K.destroy(); } };
        }

        /* ================= 4. 停等 / 连续 ARQ 利用率 ================= */
        function demoArqU(box) {
          var K = kit(box, "停止—等待与连续 ARQ 的信道利用率"), mode = "sw";
          var r1 = K.row();
          var iTD = K.field("发送时延 T_D", "62.5", { unit: "ms", parent: r1, on: draw });
          var iRTT = K.field("往返时延 RTT", "500", { unit: "ms", parent: r1, on: draw });
          var iTA = K.field("确认帧时延 T_A", "0", { unit: "ms", parent: r1, on: draw });
          var iW = K.field("发送窗口 W", "8", { parent: r1, mode: "numeric", on: draw });
          K.group([["sw", "停止—等待"], ["arq", "连续 ARQ（窗口 W）"]], mode, function (m) { mode = m; draw(); });
          function draw() {
            var a = readAll([["TD", iTD, { name: "发送时延", gt: 0 }], ["RTT", iRTT, { name: "RTT", min: 0 }], ["TA", iTA, { name: "确认帧时延", min: 0 }], ["W", iW, { name: "窗口", int: true, min: 1, max: 4096 }]]);
            if (a.err) return K.err(a.err);
            var v = a.v, W = mode === "sw" ? 1 : v.W, Tc = v.TD + v.RTT + v.TA;
            var Uu = mode === "sw" ? U.swU(v.TD, v.RTT, v.TA) : U.arqU(W, v.TD, v.RTT, v.TA);
            var svg = K.svg(720, 200, "发送方时间线：深色为正在发送");
            var x0 = 70, x1 = 700, cycles = 3, span = cycles * Tc, sc = (x1 - x0) / span;
            T(svg, 8, 66, "发送方", {});
            S("rect", { x: x0, y: 46, width: x1 - x0, height: 30, class: "x-pq-track" }, svg);
            var busy = 0;
            for (var c = 0; c < cycles; c++) {
              var st = c * Tc, end = (c + 1) * Tc, k = 0;
              for (; k < W && st + (k + 1) * v.TD <= end + 1e-9; k++) {
                S("rect", { x: x0 + (st + k * v.TD) * sc, y: 46, width: Math.max(1, v.TD * sc - (v.TD * sc > 4 ? 1 : 0)), height: 30, class: "x-pq-busy" }, svg);
              }
              busy += k * v.TD;
              S("line", { x1: x0 + end * sc, y1: 40, x2: x0 + end * sc, y2: 100, class: "x-pq-grid" }, svg);
              T(svg, x0 + (st + v.TD) * sc + 4, 120, "第 " + (c + 1) + " 个周期", { class: "x-pq-t x-pq-t--s" });
            }
            T(svg, x0, 30, "一个周期 = T_D + RTT + T_A = " + U.fmt(Tc, 3) + " ms", { class: "x-pq-t x-pq-t--m" });
            S("rect", { x: x0, y: 150, width: x1 - x0, height: 14, rx: 7, class: "x-pq-track" }, svg);
            S("rect", { x: x0, y: 150, width: (x1 - x0) * Uu, height: 14, rx: 7, class: "x-pq-prog" }, svg);
            T(svg, x0, 188, "利用率 " + U.fmt(Uu * 100, 2) + "%（时间线实测 " + U.fmt(busy / span * 100, 2) + "%）", { class: "x-pq-t x-pq-t--hl" });
            var need = U.needWindow(0.8, v.TD, v.RTT + v.TA);
            K.show([
              ["停等 U = T_D /(T_D + RTT + T_A)", U.fmt(U.swU(v.TD, v.RTT, v.TA) * 100, 3) + "%"],
              ["连续 ARQ U = min(1, W·T_D / 周期)", U.fmt(U.arqU(v.W, v.TD, v.RTT, v.TA) * 100, 3) + "%", mode === "arq"],
              ["让信道跑满所需窗口 ⌈周期 / T_D⌉", String(Math.ceil(Tc / v.TD - 1e-9))],
              ["利用率 ≥ 80% 至少要窗口", need + "（GBN 至少 " + U.seqBits(need, "gbn") + " 位序号，SR 至少 " + U.seqBits(need, "sr") + " 位）"]
            ], "128 kb/s、1000 B 帧时 T_D = 62.5 ms，单程 250 ms 则 RTT = 500 ms：停等只有约 11%，W ≥ 8 才能到 80%。");
          }
          draw();
          return { destroy: K.destroy };
        }

        /* ================= 5. 窗口上限与新旧帧混淆 ================= */
        function demoWindow(box) {
          var K = kit(box, "滑动窗口上限：超限时演示新旧帧混淆"), proto = "gbn";
          var r1 = K.row();
          var iN = K.field("序号位数 n", "3", { parent: r1, mode: "numeric", on: draw });
          var iWt = K.field("发送窗口 W_T", "8", { parent: r1, mode: "numeric", on: draw });
          var iWr = K.field("接收窗口 W_R（SR）", "4", { parent: r1, mode: "numeric", on: draw });
          K.group([["gbn", "GBN（接收窗口 = 1）"], ["sr", "SR（选择重传）"]], proto, function (p) { proto = p; draw(); });
          var r2 = K.row();
          K.btn("取上限", function () {
            var n = num(iN.value, { int: true, min: 1, max: 5 });
            if (n.err) return K.err(n.err);
            var m = U.winMax(n.v);
            iWt.value = String(proto === "gbn" ? m.gbn : m.sr); iWr.value = String(m.sr); draw();
          }, { parent: r2 });
          K.btn("超出 1 个", function () {
            var n = num(iN.value, { int: true, min: 1, max: 5 });
            if (n.err) return K.err(n.err);
            var m = U.winMax(n.v);
            iWt.value = String(proto === "gbn" ? m.M : m.sr + 1); iWr.value = String(m.sr); draw();
          }, { parent: r2 });
          function draw() {
            var a = readAll([["n", iN, { name: "序号位数", int: true, min: 1, max: 5 }], ["Wt", iWt, { name: "发送窗口", int: true, min: 1 }], ["Wr", iWr, { name: "接收窗口", int: true, min: 1 }]]);
            if (a.err) return K.err(a.err);
            var v = a.v, M = Math.pow(2, v.n);
            if (v.Wt > M) return K.err("发送窗口不能超过序号总数 2^n = " + M + "，否则窗口内就有重号的帧");
            if (proto === "sr" && v.Wr > M) return K.err("接收窗口不能超过 2^n = " + M);
            var c = U.winCheck(proto, v.n, v.Wt, v.Wr), Wr = proto === "gbn" ? 1 : v.Wr;
            var svg = K.svg(720, 210, "序号环展开：上行为发送方重发的旧帧，下行为接收方期待的新帧");
            var x0 = 120, bw = Math.min(56, (700 - x0) / M);
            T(svg, 8, 60, "重发的旧帧", {});
            T(svg, 8, 130, "接收窗口", {});
            for (var s = 0; s < M; s++) {
              var x = x0 + s * bw, isO = c.old.indexOf(s) >= 0, isR = c.recv.indexOf(s) >= 0, bad = c.overlap.indexOf(s) >= 0;
              S("rect", { x: x + 1, y: 38, width: bw - 2, height: 34, rx: 3, class: "x-pq-cell" + (isO ? " is-on" : "") + (bad ? " is-bad" : "") }, svg);
              S("rect", { x: x + 1, y: 108, width: bw - 2, height: 34, rx: 3, class: "x-pq-cell" + (isR ? " is-on2" : "") + (bad ? " is-bad" : "") }, svg);
              T(svg, x + bw / 2, 60, String(s), { "text-anchor": "middle", class: "x-pq-t x-pq-t--m" });
              T(svg, x + bw / 2, 130, String(s), { "text-anchor": "middle", class: "x-pq-t x-pq-t--m" });
            }
            T(svg, x0, 26, "发送方已发 0 ~ " + (v.Wt - 1) + " 号帧（序号模 " + M + "），全部收到但 ACK 全丢，超时后重发", { class: "x-pq-t x-pq-t--s" });
            T(svg, x0, 170, c.ok ? "两行没有重叠：旧帧一定落在接收窗口外，会被丢弃并重新确认" :
              "红格重叠：接收方把重发的旧帧 " + c.overlap.join("、") + " 当成新帧收下，数据出错", { class: "x-pq-t " + (c.ok ? "x-pq-t--ok" : "x-pq-t--bad") });
            T(svg, x0, 194, proto === "gbn" ? "GBN 条件：W_T ≤ 2^n − 1 = " + (M - 1) : "SR 条件：W_T + W_R ≤ 2^n = " + M + "，通常各取 2^(n−1) = " + M / 2, { class: "x-pq-t x-pq-t--s" });
            K.show([
              ["序号个数 2^n", String(M)],
              ["GBN 发送窗口上限 2^n − 1", String(M - 1)],
              ["SR 窗口（各取）2^(n−1)", String(M / 2)],
              [proto === "gbn" ? "当前 W_T" : "当前 W_T + W_R", proto === "gbn" ? String(v.Wt) : v.Wt + " + " + Wr + " = " + (v.Wt + Wr), true],
              ["结论", c.ok ? "不会混淆" : "会混淆（超过上限）"]
            ]);
          }
          draw();
          return { destroy: K.destroy };
        }

        /* ================= 6. CSMA/CD 最短帧长 ================= */
        function demoCsmacd(box) {
          var K = kit(box, "CSMA/CD 最短帧长与截断二进制指数退避"), n = 0;
          var r1 = K.row();
          var iR = K.field("数据率", "10", { unit: "Mb/s", parent: r1, on: draw });
          var iD = K.field("最远两站距离", "5120", { unit: "m", parent: r1, on: draw });
          var iV = K.field("传播速率", "200000", { unit: "km/s", parent: r1, on: draw });
          var r2 = K.row();
          K.btn("再冲突一次", function () { n = Math.min(16, n + 1); draw(); }, { parent: r2 });
          K.btn("清零冲突次数", function () { n = 0; draw(); }, { parent: r2 });
          K.btn("10 Mb/s 以太网（τ = 25.6 μs）", function () { iR.value = "10"; iD.value = "5120"; iV.value = "200000"; draw(); }, { parent: r2 });
          function draw() {
            var a = readAll([["R", iR, { name: "数据率", gt: 0 }], ["d", iD, { name: "距离", gt: 0 }], ["v", iV, { name: "传播速率", gt: 0 }]]);
            if (a.err) return K.err(a.err);
            var R = a.v.R * 1e6, d = a.v.d, v = a.v.v * 1000, tau = U.tauOf(d, v), Lmin = U.minFrame(R, tau), slot = 2 * tau;
            var svg = K.svg(720, 230, "最短帧长随距离线性增长");
            var x0 = 80, x1 = 690, y0 = 20, y1 = 180, dmax = d * 2, Lmax = U.minFrame(R, U.tauOf(dmax, v));
            axis(svg, x0, y0, x1, y1);
            S("line", { x1: x0, y1: y1, x2: x1, y2: y0, class: "x-pq-line" }, svg);
            var px = x0 + (x1 - x0) / 2, py = y1 - (y1 - y0) / 2;
            S("line", { x1: px, y1: y1, x2: px, y2: py, class: "x-pq-grid" }, svg);
            S("line", { x1: x0, y1: py, x2: px, y2: py, class: "x-pq-grid" }, svg);
            S("circle", { cx: px, cy: py, r: 7, class: "x-pq-dot" }, svg);
            T(svg, px + 14, py + 24, U.fmt(Lmin, 2) + " bit", { class: "x-pq-t x-pq-t--hl" });
            T(svg, x1, y1 + 22, "距离 " + U.fmt(dmax, 0) + " m", { "text-anchor": "end", class: "x-pq-t x-pq-t--s" });
            T(svg, px, y1 + 22, U.fmt(d, 0) + " m", { "text-anchor": "middle", class: "x-pq-t x-pq-t--s" });
            T(svg, x0 + 6, y0 + 4, "最短帧长 " + U.fmt(Lmax, 0) + " bit", { class: "x-pq-t x-pq-t--s" });
            T(svg, x0, 222, "数据率不变时，距离减半，最短帧长也减半（L_min = 2dR / v）", { class: "x-pq-t x-pq-t--s" });
            var rows = [
              ["单程传播时延 τ = d / v", U.dur(tau)],
              ["争用期 2τ", U.dur(slot)],
              ["最短帧长 2τ × R", U.fmt(Lmin, 3) + " bit = " + U.fmt(Lmin / 8, 3) + " B", true]
            ];
            var note = "帧的发送时间必须 ≥ 2τ，否则发完了还没收到碰撞信号，会误以为发送成功。";
            if (n > 0) {
              var b = U.backoff(n, slot);
              rows.push(["已冲突次数 → k = min(n, 10)", n + " → " + b.k]);
              rows.push(b.discard ? ["处理", "累计 16 次冲突，放弃并报告上层", true] : ["随机数 r 取值", "0 ~ " + b.maxR + "，最长等 " + U.dur(b.maxWait)]);
            }
            K.show(rows, note);
          }
          draw();
          return { destroy: K.destroy };
        }

        /* ================= 7. 编码与速率 ================= */
        function demoEncoding(box) {
          var K = kit(box, "编码方式与码元速率"), sch = "man";
          var r1 = K.row();
          var iB = K.field("比特串", "01100111", { parent: r1, mode: "numeric", wide: true, on: draw });
          var iR = K.field("数据率", "10", { unit: "Mb/s", parent: r1, on: draw });
          K.group([["nrz", "NRZ"], ["nrzi", "NRZI"], ["man", "曼彻斯特"], ["dman", "差分曼彻斯特"]], sch, function (s) { sch = s; draw(); });
          function draw() {
            var bits = String(iB.value).replace(/\s+/g, "");
            if (!/^[01]{1,24}$/.test(bits)) return K.err("比特串只能由 0 和 1 组成，长度 1 ~ 24");
            var r = num(iR.value, { name: "数据率", gt: 0 });
            if (r.err) return K.err(r.err);
            var lv = U.encode(bits, sch), n = bits.length;
            var svg = K.svg(720, 200, U.SCHEMES[sch].name + " 编码波形");
            var x0 = 40, x1 = 700, w = (x1 - x0) / n, yH = 60, yL = 130, d = "", trans = 0, prev = null;
            for (var i = 0; i < n; i++) {
              S("line", { x1: x0 + i * w, y1: 30, x2: x0 + i * w, y2: 150, class: "x-pq-grid" }, svg);
              if (U.SCHEMES[sch].per === 2) S("line", { x1: x0 + i * w + w / 2, y1: 50, x2: x0 + i * w + w / 2, y2: 140, class: "x-pq-grid x-pq-grid--h" }, svg);
              T(svg, x0 + i * w + w / 2, 24, bits.charAt(i), { "text-anchor": "middle", class: "x-pq-t x-pq-t--m" });
            }
            for (var h = 0; h < lv.length; h++) {
              var y = lv[h] ? yH : yL, xa = x0 + h * w / 2, xb = xa + w / 2;
              if (prev != null && prev !== lv[h]) trans++;
              d += (h ? "L" : "M") + xa + " " + y + " L" + xb + " " + y + " ";
              prev = lv[h];
            }
            S("path", { d: d, class: "x-pq-wave" }, svg);
            var per = U.SCHEMES[sch].per, baud = U.baudOf(r.v * 1e6, sch);
            T(svg, x0, 180, n + " 个比特 → " + n * per + " 个码元（每比特 " + per + " 个），共 " + trans + " 次跳变", { class: "x-pq-t x-pq-t--hl" });
            K.show([
              ["编码", U.SCHEMES[sch].name],
              ["每比特码元数", String(per)],
              ["数据率", U.rate(r.v * 1e6)],
              ["码元速率（波特率）", U.fmt(baud / 1e6, 3) + " MBaud", true]
            ], per === 2 ? "每位中间都跳变 → 自带时钟，可自同步；代价是波特率 = 2 × 比特率，所需带宽加倍。" :
              "一位一个码元，波特率 = 比特率；长串相同比特没有跳变，接收方无法从信号中提取时钟。");
          }
          draw();
          return { destroy: K.destroy };
        }

        /* ================= 8. 子网划分计算器 ================= */
        function bitsRow(svg, y, v, split, label, cls) {
          var s = U.bin32(v, false), x0 = 120, w = 18;
          T(svg, 8, y + 16, label, {});
          for (var i = 0; i < 32; i++) {
            var x = x0 + i * w + Math.floor(i / 8) * 4;
            S("rect", { x: x, y: y, width: w - 2, height: 24, rx: 2, class: "x-pq-bit" + (i < split ? " " + (cls || "is-net") : "") }, svg);
            T(svg, x + (w - 2) / 2, y + 17, s.charAt(i), { "text-anchor": "middle", class: "x-pq-t x-pq-t--m" });
          }
        }
        function demoSubnet(box) {
          var K = kit(box, "子网划分计算器");
          var r1 = K.row();
          var iA = K.field("IP 地址", "192.168.5.37", { parent: r1, wide: true, mode: "decimal", on: draw });
          var iP = K.field("前缀长度 /", "26", { parent: r1, mode: "numeric", on: draw });
          var iS = K.field("再借子网位 s", "0", { parent: r1, mode: "numeric", on: draw });
          function draw() {
            var a = U.ipParse(iA.value);
            if (a.err) return K.err(a.err);
            var p = num(iP.value, { name: "前缀长度", int: true, min: 0, max: 32 });
            if (p.err) return K.err(p.err);
            var s = num(iS.value, { name: "子网位数", int: true, min: 0 });
            if (s.err) return K.err(s.err);
            if (p.v + s.v > 32) return K.err("前缀长度 + 子网位数不能超过 32");
            var r = U.subnet(a.v, p.v);
            var svg = K.svg(720, 160, "地址的网络位与主机位");
            bitsRow(svg, 14, a.v, p.v, "地址", "is-net");
            bitsRow(svg, 50, r.mask, p.v, "掩码", "is-net");
            bitsRow(svg, 86, r.network, p.v, "网络地址", "is-net");
            bitsRow(svg, 122, r.broadcast, p.v, "广播地址", "is-net");
            var rows = [
              ["子网掩码", U.ipStr(r.mask) + "（/" + p.v + "）"],
              ["网络地址（主机号全 0）", U.ipStr(r.network)],
              ["广播地址（主机号全 1）", U.ipStr(r.broadcast)],
              ["可分配范围", r.hosts ? U.ipStr(r.first) + " ~ " + U.ipStr(r.last) : "无"],
              ["地址总数 2^" + r.h, String(r.size)],
              ["可用主机数 2^h − 2", String(r.hosts), true]
            ];
            if (s.v > 0) {
              var sp = U.split(p.v, s.v);
              rows.push(["借 " + s.v + " 位子网号", sp.subnets + " 个 /" + sp.prefix + " 子网，每个可用 " + sp.hosts + " 台主机"]);
            }
            K.show(rows, p.v >= 31 ? "/31、/32 没有可分配给主机的普通地址（/31 点对点链路的 RFC 3021 用法不在 408 考查范围）。" :
              "主机号 h = 32 − " + p.v + " = " + r.h + " 位，全 0 是网络地址、全 1 是广播地址，都不能分给主机。");
          }
          draw();
          return { destroy: K.destroy };
        }

        /* ================= 9. 路由聚合与最长前缀匹配 ================= */
        function demoAggregate(box) {
          var K = kit(box, "路由聚合：取公共前缀");
          var ta = E("textarea", { class: "x-pq__ta", rows: 4, spellcheck: "false", "aria-label": "要聚合的地址块，每行一个" });
          ta.value = "172.16.4.0/24\n172.16.5.0/24\n172.16.6.0/24\n172.16.7.0/24";
          var lab = E("label", { class: "x-lab__lbl x-pq__f x-pq__f--ta" }, "地址块（每行一个，地址/前缀）");
          lab.appendChild(ta); K.ctrl.appendChild(lab);
          ta.addEventListener("input", draw);
          var r1 = K.row();
          var iD = K.field("目的地址（最长前缀匹配）", "172.16.6.9", { parent: r1, wide: true, on: draw });
          K.btn("示例：不连续的块", function () { ta.value = "202.118.1.0/25\n202.118.1.128/25\n202.118.3.0/24"; draw(); }, { parent: r1 });
          function draw() {
            var lines = ta.value.split(/[\n,，;；]+/).map(function (s) { return s.trim(); }).filter(function (x) { return !!x; }), list = [];
            if (!lines.length) return K.err("请至少输入一个地址块");
            if (lines.length > 8) return K.err("最多 8 个地址块");
            for (var i = 0; i < lines.length; i++) {
              var c = U.parseCidr(lines[i]);
              if (c.err) return K.err("第 " + (i + 1) + " 行：" + c.err);
              list.push(c);
            }
            var ag = U.aggregate(list), dst = U.ipParse(iD.value), hit = dst.err ? -1 : U.lpm(list, dst.v);
            var svg = K.svg(720, 40 + (list.length + 1) * 34, "各地址块的二进制与公共前缀");
            list.forEach(function (c, j) { bitsRow(svg, 10 + j * 34, c.net, ag.len, "/" + c.p + (j === hit ? " ← 命中" : ""), j === hit ? "is-hit" : "is-net"); });
            bitsRow(svg, 10 + list.length * 34 + 6, ag.net, ag.len, "聚合 /" + ag.len, "is-agg");
            var rows = [
              ["公共前缀位数", String(ag.len)],
              ["聚合结果", ag.text, true],
              ["聚合块地址数", String(ag.size)],
              ["多覆盖的地址", ag.extra ? ag.extra + " 个（原来不属于这些块）" : "0（恰好覆盖）"]
            ];
            if (dst.err) rows.push(["最长前缀匹配", dst.err]);
            else rows.push(["目的地址 " + U.ipStr(dst.v) + " 匹配", hit >= 0 ? U.ipStr(list[hit].net) + "/" + list[hit].p + "（前缀最长）" : "都不匹配，走默认路由"]);
            K.show(rows, "聚合只看网络地址的二进制从左往右有几位相同；聚合后的块可能比原来的块之和大，转发时靠最长前缀匹配区分更具体的路由。");
          }
          draw();
          return { destroy: K.destroy };
        }

        /* ================= 10. IP 分片 ================= */
        function demoIpfrag(box) {
          var K = kit(box, "IP 分片表");
          var r1 = K.row();
          var iT = K.field("原分组总长度", "4000", { unit: "B", parent: r1, mode: "numeric", on: draw });
          var iH = K.field("首部长度", "20", { unit: "B", parent: r1, mode: "numeric", on: draw });
          var iM = K.field("链路 MTU", "1500", { unit: "B", parent: r1, mode: "numeric", on: draw });
          function draw() {
            var a = readAll([["t", iT, { name: "总长度", int: true, min: 1 }], ["h", iH, { name: "首部长度", int: true, min: 1 }], ["m", iM, { name: "MTU", int: true, min: 1 }]]);
            if (a.err) return K.err(a.err);
            var f = U.fragment(a.v.t, a.v.h, a.v.m);
            if (f.err) return K.err(f.err);
            var data = a.v.t - a.v.h, n = f.frags.length;
            var svg = K.svg(720, 70 + n * 26, "各分片数据部分在原数据中的位置");
            var x0 = 90, x1 = 700, sc = (x1 - x0) / data;
            T(svg, x0, 18, "原数据 " + data + " B（不含首部）", { class: "x-pq-t x-pq-t--s" });
            f.frags.forEach(function (fr, i) {
              var y = 30 + i * 26;
              S("rect", { x: x0 + fr.off * sc, y: y, width: Math.max(2, fr.data * sc - 1), height: 20, rx: 2, class: "x-pq-frag" + (fr.mf ? "" : " is-last") }, svg);
              T(svg, 8, y + 15, "第 " + fr.i + " 片", {});
              T(svg, Math.min(x0 + fr.off * sc + 6, x1 - 150), y + 15, "偏移 " + fr.off8 + "，MF=" + fr.mf, { class: "x-pq-t x-pq-t--in" });
            });
            clearNode(K.out);
            var tb = E("table", { class: "x-pq__tbl" }), hd = E("tr", {});
            ["片", "总长度", "数据长度", "片偏移（×8 B）", "数据起点", "MF"].forEach(function (h) { hd.appendChild(E("th", { scope: "col" }, h)); });
            tb.appendChild(hd);
            f.frags.forEach(function (fr) {
              var tr = E("tr", {});
              [fr.i, fr.len, fr.data, fr.off8, fr.off, fr.mf].forEach(function (c) { tr.appendChild(E("td", {}, String(c))); });
              tb.appendChild(tr);
            });
            var wrap = E("div", { class: "x-pq__tblw" }); wrap.appendChild(tb); K.out.appendChild(wrap);
            K.out.appendChild(E("p", { class: "x-pq__note" }, f.whole ? "总长度不超过 MTU，不用分片。" :
              "每片最多装 ⌊(MTU − 首部)/8⌋ × 8 = " + f.max + " B 数据（必须是 8 的倍数），共 " + n + " 片；只有最后一片 MF = 0，各片 DF = 0、标识相同。"));
          }
          draw();
          return { destroy: K.destroy };
        }

        /* ================= 11. TCP 拥塞控制（Reno） ================= */
        function demoCwnd(box) {
          var K = kit(box, "TCP Reno 拥塞窗口曲线"), pts = null, timer = null;
          var r1 = K.row();
          var iS = K.field("初始 ssthresh", "16", { unit: "MSS", parent: r1, mode: "numeric", on: reset });
          var r2 = K.row();
          K.btn("下一个 RTT", function () { add("ok"); }, { main: true, parent: r2 });
          K.btn("注入超时", function () { add("timeout"); }, { parent: r2 });
          K.btn("注入 3 个重复 ACK", function () { add("dup3"); }, { parent: r2 });
          var bAuto = K.btn("自动", function () { if (timer) halt(); else { bAuto.setAttribute("aria-pressed", "true"); timer = K.every(reduced() ? 600 : 350, function () { if (pts && pts.length > 40) halt(); else add("ok"); }); } }, { toggle: true, parent: r2 });
          K.btn("重置", function () { halt(); reset(); }, { parent: r2 });
          function halt() { if (timer) K.stop(timer); timer = null; bAuto.setAttribute("aria-pressed", "false"); }
          function reset() {
            var s = num(iS.value, { name: "ssthresh", int: true, min: 1, max: 64 });
            if (s.err) { pts = null; return K.err(s.err); }
            pts = U.renoRun(1, s.v, []); draw();
          }
          function add(ev) {
            if (!pts) return;
            if (pts.length > 60) pts = pts.slice(pts.length - 60);
            pts.push(U.renoNext(pts[pts.length - 1], ev)); draw();
          }
          function draw() {
            var svg = K.svg(720, 250, "拥塞窗口随传输轮次变化");
            var x0 = 50, x1 = 700, y0 = 20, y1 = 210, n = Math.max(16, pts.length), mx = 4;
            pts.forEach(function (p) { mx = Math.max(mx, p.cwnd, p.ssthresh); });
            mx = Math.ceil(mx * 1.15);
            axis(svg, x0, y0, x1, y1);
            function X(i) { return x0 + i * (x1 - x0) / (n - 1); }
            function Y(c) { return y1 - c * (y1 - y0) / mx; }
            for (var g = 0; g <= mx; g += Math.max(1, Math.ceil(mx / 6))) T(svg, x0 - 6, Y(g) + 5, String(g), { "text-anchor": "end", class: "x-pq-t x-pq-t--s" });
            var d = "", ds = "";
            pts.forEach(function (p, i) {
              d += (i ? "L" : "M") + X(i) + " " + Y(p.cwnd) + " ";
              ds += (i ? "L" : "M") + X(i) + " " + Y(p.ssthresh) + " ";
            });
            S("path", { d: ds, class: "x-pq-thr" }, svg);
            S("path", { d: d, class: "x-pq-line" }, svg);
            pts.forEach(function (p, i) {
              S("circle", { cx: X(i), cy: Y(p.cwnd), r: 4, class: "x-pq-dot" + (p.ev === "timeout" ? " is-bad" : p.ev === "dup3" ? " is-warn" : "") }, svg);
              if (p.ev === "timeout" || p.ev === "dup3") T(svg, X(i) + 6, Y(p.cwnd) - 8, p.ev === "timeout" ? "超时" : "3 dup", { class: "x-pq-t x-pq-t--s" });
            });
            T(svg, x1, 240, "传输轮次（RTT）", { "text-anchor": "end", class: "x-pq-t x-pq-t--s" });
            T(svg, x0 + 8, 34, "实线 cwnd，虚线 ssthresh（单位 MSS）", { class: "x-pq-t x-pq-t--s" });
            var last = pts[pts.length - 1];
            K.show([
              ["轮次", String(pts.length - 1)],
              ["cwnd", last.cwnd + " MSS", true],
              ["ssthresh", last.ssthresh + " MSS"],
              ["阶段", last.phase]
            ], last.ev === "timeout" ? "超时：ssthresh = ⌊cwnd/2⌋，cwnd 回到 1，重新慢开始。" :
              last.ev === "dup3" ? "3 个重复 ACK：快重传，快恢复令 ssthresh = cwnd = ⌊cwnd/2⌋，直接进入拥塞避免。" :
              "慢开始每个 RTT 翻倍（不越过 ssthresh），到达 ssthresh 后拥塞避免每个 RTT 加 1。");
          }
          reset();
          return { destroy: function () { halt(); K.destroy(); } };
        }

        /* ================= 12. TCP 吞吐量 ================= */
        function demoTcpThru(box) {
          var K = kit(box, "TCP 吞吐量 = 窗口 / RTT");
          var r1 = K.row();
          var iRw = K.field("接收窗口 rwnd", "65535", { unit: "B", parent: r1, mode: "numeric", on: draw });
          var iCw = K.field("拥塞窗口 cwnd", "100000", { unit: "B", parent: r1, mode: "numeric", on: draw });
          var r2 = K.row();
          var iRtt = K.field("RTT", "100", { unit: "ms", parent: r2, on: draw });
          var iBw = K.field("链路带宽", "100", { unit: "Mb/s", parent: r2, on: draw });
          var iSh = K.field("窗口扩大因子", "0", { parent: r2, mode: "numeric", on: draw });
          function draw() {
            var a = readAll([["rw", iRw, { name: "接收窗口", min: 1 }], ["cw", iCw, { name: "拥塞窗口", min: 1 }], ["rtt", iRtt, { name: "RTT", gt: 0 }], ["bw", iBw, { name: "带宽", gt: 0 }], ["sh", iSh, { name: "窗口扩大因子", int: true, min: 0, max: 14 }]]);
            if (a.err) return K.err(a.err);
            var v = a.v, lim = U.maxRwnd(v.sh);
            if (v.rw > lim) return K.err("窗口字段 16 位，扩大因子为 " + v.sh + " 时 rwnd 最大 " + lim + " 字节");
            var r = U.throughput(v.rw, v.cw, v.rtt / 1000, v.bw * 1e6);
            var send = r.win * 8 / (v.bw * 1e6), rtt = v.rtt / 1000;
            var svg = K.svg(720, 170, "每个 RTT 内：深色为发送窗口内的数据在发送");
            var x0 = 60, x1 = 700, cyc = Math.max(rtt, send), span = 3 * cyc, sc = (x1 - x0) / span;
            S("rect", { x: x0, y: 40, width: x1 - x0, height: 34, class: "x-pq-track" }, svg);
            for (var c = 0; c < 3; c++) {
              S("rect", { x: x0 + c * cyc * sc, y: 40, width: Math.max(2, Math.min(send, cyc) * sc - 1), height: 34, class: "x-pq-busy" }, svg);
              S("line", { x1: x0 + (c + 1) * cyc * sc, y1: 32, x2: x0 + (c + 1) * cyc * sc, y2: 84, class: "x-pq-grid" }, svg);
            }
            T(svg, 8, 62, "发送", {});
            T(svg, x0, 26, "发一窗 " + U.dur(send) + "，等确认要 RTT = " + U.dur(rtt), { class: "x-pq-t x-pq-t--m" });
            T(svg, x0, 110, "链路利用率 " + U.fmt(r.util * 100, 2) + "%", { class: "x-pq-t x-pq-t--hl" });
            T(svg, x0, 140, r.tp >= v.bw * 1e6 ? "窗口 ≥ 带宽 × RTT，链路被跑满" : "窗口太小：带宽 × RTT = " + U.fmt(v.bw * 1e6 * rtt / 8, 0) + " B 才能跑满", { class: "x-pq-t x-pq-t--s" });
            K.show([
              ["发送窗口 = min(rwnd, cwnd)", r.win + " B（受 " + r.by + " 限制）", true],
              ["窗口 / RTT", U.rate(r.tp)],
              ["实际吞吐量上限（不超过带宽）", U.rate(r.cap), true],
              ["rwnd 上限 65535 × 2^因子", String(lim) + " B"]
            ], "不用窗口扩大选项时窗口最多 65535 B：RTT = 100 ms 时吞吐量不超过 65535 × 8 / 0.1 ≈ 5.24 Mb/s，与带宽多大无关。");
          }
          draw();
          return { destroy: K.destroy };
        }

        /* ================= 13. TCP 序号与确认号 ================= */
        function demoTcpSeq(box) {
          var K = kit(box, "TCP 序号与确认号逐段推算"), segs = [], pos = 0;
          var r1 = K.row();
          var iX = K.field("客户端初始序号 x", "200", { parent: r1, mode: "numeric", on: reset });
          var iY = K.field("服务器初始序号 y", "500", { parent: r1, mode: "numeric", on: reset });
          var iL = K.field("客户端各段数据长度", "300,500", { parent: r1, wide: true, on: reset });
          var r2 = K.row();
          K.btn("上一步", function () { if (pos > 0) { pos--; draw(); } }, { parent: r2 });
          K.btn("下一步", function () { if (pos < segs.length) { pos++; draw(); } }, { main: true, parent: r2 });
          K.btn("全部", function () { pos = segs.length; draw(); }, { parent: r2 });
          function reset() {
            var a = readAll([["x", iX, { name: "x", int: true, min: 0, max: 4294967295 }], ["y", iY, { name: "y", int: true, min: 0, max: 4294967295 }]]);
            if (a.err) { segs = []; return K.err(a.err); }
            var parts = String(iL.value).split(/[,，\s]+/).filter(function (x) { return !!x; }), lens = [];
            if (parts.length > 4) { segs = []; return K.err("最多 4 段数据"); }
            for (var i = 0; i < parts.length; i++) {
              var r = num(parts[i], { name: "数据长度", int: true, min: 1, max: 65495 });
              if (r.err) { segs = []; return K.err("第 " + (i + 1) + " 段：" + r.err); }
              lens.push(r.v);
            }
            segs = U.tcpWalk(a.v.x, a.v.y, lens); pos = 1; draw();
          }
          function draw() {
            if (!segs.length) return;
            var rowH = 30, H = 40 + segs.length * rowH;
            var svg = K.svg(720, H, "客户端与服务器之间的报文段");
            var xc = 110, xs = 610;
            T(svg, xc, 20, "客户端", { "text-anchor": "middle" });
            T(svg, xs, 20, "服务器", { "text-anchor": "middle" });
            S("line", { x1: xc, y1: 28, x2: xc, y2: H - 4, class: "x-pq-ax" }, svg);
            S("line", { x1: xs, y1: 28, x2: xs, y2: H - 4, class: "x-pq-ax" }, svg);
            for (var i = 0; i < pos; i++) {
              var g = segs[i], y = 40 + i * rowH, a = g.from === "C" ? xc : xs, b = g.from === "C" ? xs : xc;
              S("line", { x1: a, y1: y, x2: b, y2: y + rowH - 10, class: "x-pq-arrow" + (i === pos - 1 ? " is-cur" : "") }, svg);
              var hx = b + (g.from === "C" ? -8 : 8);
              S("path", { d: "M" + b + " " + (y + rowH - 10) + " L" + hx + " " + (y + rowH - 16) + " L" + hx + " " + (y + rowH - 6) + " Z", class: "x-pq-ah" }, svg);
              T(svg, (xc + xs) / 2, y + 8, g.flags + " seq=" + g.seq + (g.ack != null ? " ack=" + g.ack : "") + (g.len ? " 数据 " + g.len + " B" : ""),
                { "text-anchor": "middle", class: "x-pq-t x-pq-t--m" + (i === pos - 1 ? " x-pq-t--hl" : "") });
            }
            var cur = segs[pos - 1];
            K.show(cur ? [
              ["第 " + pos + " / " + segs.length + " 个报文段", (cur.from === "C" ? "客户端 → 服务器" : "服务器 → 客户端") + "：" + cur.flags],
              ["序号 seq", String(cur.seq), true],
              ["确认号 ack", cur.ack == null ? "—（ACK = 0）" : String(cur.ack), true],
              ["数据长度", cur.len + " B"]
            ] : [["进度", "按“下一步”开始"]], cur ? cur.note : "");
          }
          reset();
          return { destroy: K.destroy };
        }

        /* ================= 14. 以太网帧长与冲突域 / 广播域 ================= */
        var TOPOS = {
          hub: { name: "集线器", nodes: { D: [360, 110, "hub", "集线器"], A: [120, 40, "host", "A"], B: [600, 40, "host", "B"], C: [120, 180, "host", "C"], E: [600, 180, "host", "D"] }, links: [["D", "A"], ["D", "B"], ["D", "C"], ["D", "E"]] },
          sw: { name: "交换机", nodes: { D: [360, 110, "switch", "交换机"], A: [120, 40, "host", "A"], B: [600, 40, "host", "B"], C: [120, 180, "host", "C"], E: [600, 180, "host", "D"] }, links: [["D", "A"], ["D", "B"], ["D", "C"], ["D", "E"]] },
          rt: { name: "路由器", nodes: { D: [360, 110, "router", "路由器"], A: [120, 40, "host", "A"], B: [600, 40, "host", "B"], C: [120, 180, "host", "C"], E: [600, 180, "host", "D"] }, links: [["D", "A"], ["D", "B"], ["D", "C"], ["D", "E"]] },
          mix: { name: "组合", nodes: { R: [360, 36, "router", "路由器"], S: [200, 112, "switch", "交换机"], H: [560, 112, "hub", "集线器"],
            A: [70, 190, "host", "A"], B: [190, 190, "host", "B"], H2: [320, 190, "hub", "集线器"], E1: [260, 262, "host", "E"], F: [380, 262, "host", "F"],
            C: [500, 190, "host", "C"], E: [640, 190, "host", "D"] },
            links: [["R", "S"], ["R", "H"], ["S", "A"], ["S", "B"], ["S", "H2"], ["H2", "E1"], ["H2", "F"], ["H", "C"], ["H", "E"]] }
        };
        function demoEther(box) {
          var K = kit(box, "以太网帧长与冲突域、广播域"), topo = "mix", view = "coll";
          var r1 = K.row();
          var iD = K.field("上层数据长度", "30", { unit: "B", parent: r1, mode: "numeric", on: draw });
          K.group([["hub", "集线器"], ["sw", "交换机"], ["rt", "路由器"], ["mix", "组合"]], topo, function (t) { topo = t; draw(); });
          K.group([["coll", "看冲突域"], ["bc", "看广播域"]], view, function (v) { view = v; draw(); });
          function draw() {
            var dv = num(iD.value, { name: "数据长度", int: true, min: 0 });
            if (dv.err) return K.err(dv.err);
            var f = U.etherFrame(dv.v), tp = TOPOS[topo], types = {};
            Object.keys(tp.nodes).forEach(function (k) { types[k] = tp.nodes[k][2]; });
            var dm = U.domains(types, tp.links), ids = view === "coll" ? dm.coll : dm.bc;
            var svg = K.svg(720, topo === "mix" ? 290 : 236, tp.name + "：同色链路属于同一个" + (view === "coll" ? "冲突域" : "广播域"));
            tp.links.forEach(function (l, i) {
              var a = tp.nodes[l[0]], b = tp.nodes[l[1]];
              S("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: PAL[ids[i] % PAL.length], "stroke-width": 6, "stroke-linecap": "round", class: "x-pq-link" }, svg);
            });
            Object.keys(tp.nodes).forEach(function (k) {
              var nd = tp.nodes[k], w = nd[2] === "host" ? 44 : 84;
              S("rect", { x: nd[0] - w / 2, y: nd[1] - 16, width: w, height: 32, rx: nd[2] === "host" ? 16 : 6, class: "x-pq-node x-pq-node--" + nd[2] }, svg);
              T(svg, nd[0], nd[1] + 5, nd[3], { "text-anchor": "middle" });
            });
            var rows = [
              ["冲突域个数", String(dm.collision), view === "coll"],
              ["广播域个数", String(dm.broadcast), view === "bc"]
            ];
            if (f.err) rows.push(["帧长", f.err]);
            else rows.push(["MAC 帧长 = 数据 + 填充 + 18", f.data + " + " + f.pad + " + 18 = " + f.frame + " B", true]);
            K.show(rows, "集线器（物理层）所有端口一个冲突域；交换机每个端口一个冲突域，但整体一个广播域；路由器每个接口一个广播域。数据不足 46 B 补齐到 46 B，帧最短 64 B、最长 1518 B。");
          }
          draw();
          return { destroy: K.destroy };
        }

        /* ================= 注册 ================= */
        var C1 = "第 1 章 计算机网络体系结构", C2 = "第 2 章 物理层", C3 = "第 3 章 数据链路层", C4 = "第 4 章 网络层", C5 = "第 5 章 传输层";

        PROP.push({
          id: "cn-nyquist", sub: "cn", ch: C2, name: "奈奎斯特定理",
          def: "码元：承载信息的基本信号单位，一个码元可取 V 种离散电平（状态）。波特率 = 每秒码元数，比特率 = 每秒比特数。",
          stmt: ["理想低通（无噪声、带宽受限）信道：极限码元速率 = **2W 波特**", "极限数据传输速率 = **2W·log₂V**（b/s）"],
          cond: "只适用于无噪声的理想低通信道，W 为带宽（Hz）。有噪声时还要受香农定理限制；QAM 等调制的 V = 相位数 × 振幅数。",
          proof: [
            "带宽为 W 的理想低通信道，码元速率超过 2W 就会出现码间串扰，接收端无法正确识别码元，所以每秒最多传 2W 个码元。",
            "一个码元有 V 种取值，V 种状态最多区分 log₂V 位二进制信息。",
            "数据速率 = 码元速率 × 每码元比特数 = 2W × log₂V。",
            "示例：W = 3 kHz、V = 16 时，2 × 3000 × 4 = 24 kb/s。",
            "结论：带宽固定时，提速只能靠增大 V（多元调制），但 V 越大越怕噪声，这正是香农定理要回答的问题。"
          ],
          traps: ["“4 个相位、每个相位 4 种振幅”的 V 是 4 × 4 = 16，不是 4 或 8。", "极限码元速率是 2W 波特，不是 W；题目问波特率时不要乘 log₂V。", "比特率 = 波特率 × log₂V，反求波特率要除以 log₂V（4 相位调制 2400 b/s 对应 1200 波特）。"],
          ex: { q: "在无噪声情况下，若某通信链路的带宽为 3 kHz，采用 4 个相位、每个相位具有 4 种振幅的 QAM 调制技术，则该通信链路的最大数据传输速率是（ ）。",
            opts: ["12 kb/s", "24 kb/s", "48 kb/s", "96 kb/s"], a: 1,
            why: "V = 4 × 4 = 16，每码元 log₂16 = 4 位；极限速率 = 2W·log₂V = 2 × 3k × 4 = 24 kb/s。12 kb/s 漏乘了系数 2；48 kb/s、96 kb/s 是把每码元比特数 log₂16 = 4 错当成 8、16。",
            src: "2009 年真题" },
          links: { lab: ["encoding"], proc: [] },
          demo: demoNyquist
        });

        PROP.push({
          id: "cn-shannon", sub: "cn", ch: C2, name: "香农定理与信噪比",
          def: "信噪比 S/N：信号平均功率与噪声平均功率之比，常用分贝表示：信噪比（dB）= 10·lg(S/N)。",
          stmt: ["有噪声信道极限数据速率 **C = W·log₂(1 + S/N)**（b/s）", "信噪比（dB）= **10·log₁₀(S/N)**，30 dB 即 S/N = 1000", "同时给出 V 和信噪比时，实际上限取 **min(2W·log₂V, W·log₂(1+S/N))**"],
          cond: "适用于带宽受限且有高斯白噪声的信道；它给出的是理论上限，与采用多少电平无关。公式里的 S/N 是倍数，不是分贝值。",
          proof: [
            "信道带宽 W 限制了码元速率不超过 2W（奈奎斯特）。",
            "噪声使接收端只能可靠区分有限个电平：信号越强、噪声越弱，可区分的电平越多。",
            "香农证明：在带宽 W、信噪比 S/N 下，无差错传输的极限速率为 C = W·log₂(1 + S/N)。",
            "分贝换算：dB = 10·lg(S/N)，所以 S/N = 10^(dB/10)；30 dB → 1000，20 dB → 100。",
            "示例：W = 3 kHz、30 dB：C = 3000 × log₂1001 ≈ 3000 × 9.97 ≈ 29.9 kb/s。",
            "若还限定了码元电平数 V，奈奎斯特给出 2W·log₂V，两个上限都要满足，所以取较小值。"
          ],
          traps: ["把 30 dB 直接当成 S/N = 30 代入，得到 W·log₂31 是最常见的错误。", "香农极限与 V 无关；只给信噪比不给 V 时不能用奈奎斯特。", "题目问“无噪声极限 ≥ 有噪声极限时 V 至少多少”，要令 2W·log₂V ≥ W·log₂(1+S/N) 再求 V。"],
          ex: { q: "某信道带宽为 4 kHz，信噪比为 30 dB，若采用 8 种电平的码元传输，则该信道的最大数据传输速率约为（ ）。",
            opts: ["24 kb/s", "39.9 kb/s", "19.8 kb/s", "120 kb/s"], a: 0,
            why: "奈奎斯特：2 × 4k × log₂8 = 24 kb/s；香农：S/N = 10^3 = 1000，4k × log₂1001 ≈ 39.9 kb/s。两者都要满足，取较小值 24 kb/s。39.9 kb/s 忽略了电平限制，19.8 kb/s 是把 S/N 当成 30。",
            src: "典型题" },
          links: { lab: ["encoding"], proc: [] },
          demo: demoShannon
        });

        PROP.push({
          id: "cn-delay", sub: "cn", ch: C1, name: "时延与时延带宽积",
          def: "发送时延：把数据块的所有比特推上链路所用的时间；传播时延：电磁波在信道中传播一段距离所用的时间。",
          stmt: ["发送时延 = **数据长度 / 发送速率**", "传播时延 = **信道长度 / 传播速率**", "时延带宽积 = **传播时延 × 带宽**，即链路上最多能容纳的比特数"],
          cond: "总时延 = 发送 + 传播 + 处理 + 排队；题目常忽略后两项。存储转发每经过一个结点要再发送一次，传播时延按每段链路累加。",
          proof: [
            "发送方以速率 R 把 L 个比特逐个推上链路，最后一个比特离开发送方需要 L/R。",
            "每个比特在长 d 的链路上以速度 v 传播，需要 d/v 才到达对端。",
            "第一个比特刚到达对端时，链路上已有 (d/v) × R 个比特在途，这就是时延带宽积。",
            "若 L 小于时延带宽积，数据发完时第一个比特还没到对端，链路上最多只有 L 个比特。",
            "多段存储转发：总时间 = 所有分组的发送时间 + 最后一个分组在每个中间结点再发送一次的时间 + 各段传播时延。"
          ],
          traps: ["发送速率决定发送时延，与链路长度无关；传播时延只与距离和介质有关，与速率无关。", "单位：1 kb/s = 1000 b/s，1 KB = 1024 B 还是 1000 B 看题目（常注明 M = 10⁶）。", "时延带宽积用的是单程传播时延；“往返时延带宽积”才是 RTT × 带宽。"],
          ex: { q: "两段链路的数据传输速率均为 100 Mb/s，时延带宽积（即单向传播时延 × 带宽）均为 1000 bit。若 H1 经路由器 R 向 H2 发送一个 1 MB 的文件，分组长度为 1000 B，则从 H1 开始发送到 H2 收到全部数据至少需要（M = 10⁶）（ ）。",
            opts: ["80.02 ms", "80.08 ms", "80.09 ms", "80.10 ms"], a: 3,
            why: "传播时延 = 1000 bit / 100 Mb/s = 0.01 ms，每个分组发送时延 8000 bit / 100 Mb/s = 0.08 ms，共 1000 个分组。H1 发完用 80 ms，最后一个分组再经过 0.01（传播）+ 0.08（R 转发）+ 0.01（传播）= 0.10 ms，共 80.10 ms。",
            src: "2023 年真题" },
          links: { lab: [], proc: ["encap"] },
          demo: demoDelay
        });

        PROP.push({
          id: "cn-arqu", sub: "cn", ch: C3, name: "停等协议与连续 ARQ 的信道利用率",
          def: "信道利用率：发送方在一个发送周期内用于发送有效数据的时间所占的比例。",
          stmt: ["停止—等待：**U = T_D /(T_D + RTT + T_A)**", "连续 ARQ（发送窗口 W）：**U = min(1, W·T_D /(T_D + RTT + T_A))**，题目忽略确认帧时 T_A = 0"],
          cond: "T_D 为数据帧发送时延，T_A 为确认帧发送时延，RTT 为往返传播时延（2 × 单程）。假设无差错、无重传，接收方收到即确认。",
          proof: [
            "停等协议发完一帧（T_D）后必须等确认：确认帧要传播回来（RTT）并发送完（T_A），一个周期为 T_D + RTT + T_A。",
            "这个周期内只发送了 T_D 的有效数据，所以 U = T_D /(T_D + RTT + T_A)。",
            "连续 ARQ 在一个周期内最多可连发 W 帧，占用 W·T_D 的时间。",
            "若 W·T_D ≥ 周期，第一帧的确认在窗口用完前就回来了，发送方一刻不停，U = 1。",
            "否则 U = W·T_D / 周期；令 U ≥ 目标值即可反求所需最小窗口，再按 GBN（2^n − 1 ≥ W）或 SR（2^(n−1) ≥ W）求序号位数。"
          ],
          traps: ["RTT 是单程传播时延的 2 倍，题目给的“单向传播时延”不要直接当周期。", "利用率最高时要把 T_D 也算进周期：周期 = T_D + RTT（不是只有 RTT）。", "求出窗口后，GBN 要 2^n ≥ W + 1，SR 要 2^(n−1) ≥ W，位数不同。"],
          ex: { q: "主机甲通过 128 kb/s 卫星链路，采用滑动窗口协议向主机乙发送数据，链路单向传播时延为 250 ms，帧长为 1000 字节。不考虑确认帧的开销，为使链路利用率不小于 80%，帧序号的比特数至少是（ ）。",
            opts: ["3", "4", "7", "8"], a: 1,
            why: "T_D = 8000 bit / 128 kb/s = 62.5 ms，周期 = 62.5 + 2 × 250 = 562.5 ms。W × 62.5 / 562.5 ≥ 0.8 得 W ≥ 7.2，取 W = 8；按 2^n ≥ W + 1 得 n = 4。",
            src: "2015 年真题" },
          links: { lab: ["slidewin"], proc: [] },
          demo: demoArqU
        });

        PROP.push({
          id: "cn-window", sub: "cn", ch: C3, name: "GBN 与 SR 的窗口上限",
          def: "用 n 位给帧编号，序号在 0 ~ 2^n − 1 之间循环使用；发送窗口 W_T、接收窗口 W_R 分别是允许发送、允许接收的序号范围。",
          stmt: ["GBN：**W_T ≤ 2^n − 1**（接收窗口为 1）", "SR：**W_T + W_R ≤ 2^n**，通常 **W_T = W_R = 2^(n−1)**", "停止—等待相当于 W_T = W_R = 1，1 位序号即可"],
          cond: "前提是确认可能丢失、帧可能重传，接收方必须靠序号区分新帧和重传的旧帧。窗口大于上限时不一定每次出错，但存在使接收方误收旧帧的情形。",
          proof: [
            "n 位序号可以表示 2^n 个序号，序号用完后循环。",
            "GBN 接收窗口为 1。若发送窗口等于 2^n，发送方连发 2^n 帧全被收下但 ACK 全丢，接收方下一个期待的序号正好是 0。",
            "发送方超时重发的旧 0 号帧与接收方期待的新 0 号帧序号相同，接收方无法区分，所以 GBN 发送窗口最大 2^n − 1。",
            "SR 接收窗口大于 1：旧帧序号是 0 ~ W_T − 1，接收方窗口已移到 W_T ~ W_T + W_R − 1，二者不能重叠。",
            "不重叠的条件是 W_T + W_R ≤ 2^n；接收窗口不应超过发送窗口，所以常取 W_T = W_R = 2^(n−1)。"
          ],
          traps: ["GBN 的上限是 2^n − 1，SR 是 2^(n−1)，不要混用。", "SR 题给出发送窗口后问接收窗口最大值时，用 W_R = 2^n − W_T（且不超过 W_T）。", "序号位数相同时，GBN 的窗口可以比 SR 大，所以“最大信道利用率”GBN 不低于 SR。"],
          ex: { q: "假设通过同一信道，数据链路层分别采用停—等协议、GBN 协议和 SR 协议（发送窗口和接收窗口相等）传输数据，三个协议数据帧长相同，忽略确认帧长度，帧序号位数为 3 比特。若对应三个协议的发送方最大信道利用率分别是 U1、U2 和 U3，则它们满足的关系是（ ）。",
            opts: ["U1 ≤ U2 ≤ U3", "U1 ≤ U3 ≤ U2", "U2 ≤ U3 ≤ U1", "U3 ≤ U2 ≤ U1"], a: 1,
            why: "3 位序号：停等窗口 1，SR 窗口最大 2^2 = 4，GBN 窗口最大 2^3 − 1 = 7。利用率 = min(1, W·T_D / 周期)，随窗口单调不减，所以 U1 ≤ U3 ≤ U2。",
            src: "2023 年真题" },
          links: { lab: ["slidewin"], proc: [] },
          demo: demoWindow
        });

        PROP.push({
          id: "cn-csmacd", sub: "cn", ch: C3, name: "CSMA/CD 最短帧长与退避",
          def: "争用期（冲突窗口）：站点从开始发送到确知没有碰撞的最长时间，等于端到端往返传播时延 2τ（τ 为单程传播时延）。",
          stmt: ["最短帧长 = **2τ × 数据传输速率**", "10 Mb/s 以太网争用期 **51.2 μs**，最短帧 **512 bit = 64 字节**", "截断二进制指数退避：k = **min(重传次数, 10)**，从 0 ~ 2^k − 1 中随机取 r，等待 r × 2τ；**16 次**失败后丢弃"],
          cond: "适用于半双工共享总线（集线器）以太网。全双工交换式以太网不存在碰撞，不用 CSMA/CD，但为了兼容仍保留 64 字节最短帧。",
          proof: [
            "站点发送后，信号最远要经过 τ 到达对端；对端在信号到达前一刻开始发送，碰撞信号再经过 τ 传回，所以最迟 2τ 才能检测到碰撞。",
            "如果帧在 2τ 之内就发完了，站点停止检测，即使之后发生碰撞也会以为发送成功。",
            "所以帧的发送时间至少为 2τ：L_min / R ≥ 2τ，最短帧长 L_min = 2τ × R。",
            "10 Mb/s 以太网取争用期 51.2 μs，得最短帧 51.2 μs × 10 Mb/s = 512 位，即 64 字节。",
            "数据率不变时 L_min 与距离成正比：帧长每减少 ΔL，最远距离要减少 ΔL × v /(2R)。"
          ],
          traps: ["τ 是单程传播时延，最短帧长要乘 2τ，不是 τ。", "退避时间单位是争用期 2τ（10 Mb/s 为 51.2 μs），连续 n 次冲突后 k = min(n, 10)，最大等待 (2^k − 1) × 51.2 μs。", "最短帧 64 字节指整个 MAC 帧（含首部和 FCS），对应数据部分至少 46 字节。"],
          ex: { q: "在一个采用 CSMA/CD 协议的网络中，传输介质是一根完整的电缆，传输速率为 1 Gb/s，电缆中的信号传播速度是 200 000 km/s。若最小数据帧长度减少 800 比特，则最远的两个站点之间的距离至少需要（ ）。",
            opts: ["增加 160 m", "增加 80 m", "减少 160 m", "减少 80 m"], a: 3,
            why: "L_min = 2dR/v，帧长减少 800 bit 对应的距离变化 Δd = ΔL × v /(2R) = 800 × 2×10⁸ /(2 × 10⁹) = 80 m，帧变短距离也要变短，所以减少 80 m。选 160 m 是忘了往返的 2 倍。",
            src: "2009 年真题" },
          links: { lab: ["csmacd"], proc: [] },
          demo: demoCsmacd
        });

        PROP.push({
          id: "cn-encoding", sub: "cn", ch: C2, name: "编码方式与码元速率",
          def: "数字基带编码把比特映射为电平波形：NRZ 一位一个电平；曼彻斯特、差分曼彻斯特每位中间都有一次跳变。",
          stmt: ["曼彻斯特、差分曼彻斯特：**码元速率 = 2 × 数据速率**", "NRZ、NRZI：码元速率 = 数据速率", "10 Mb/s 以太网采用曼彻斯特编码，信号速率为 **20 MBaud**"],
          cond: "这里的码元指一个持续不变的电平段（半个比特宽）。曼彻斯特“高→低表示 1”还是相反，各教材约定不同，做题以题目给出的约定为准。",
          proof: [
            "曼彻斯特编码把每个比特周期分成前后两半，两半电平相反，位中间必有一次跳变。",
            "每个比特需要两个电平段，即两个码元，所以码元速率是比特率的 2 倍。",
            "差分曼彻斯特同样每位中间跳变（只作同步），用位开始处有无跳变表示 0 / 1，码元数相同。",
            "代价：传同样的数据要两倍的波特率，所需带宽加倍；好处是每位都有跳变，接收方可从信号中提取时钟（自同步）。"
          ],
          traps: ["问的是“波特率”还是“数据率”要看清：10 Mb/s 曼彻斯特是 20 MBaud，不是 10 MBaud 或 5 MBaud。", "差分曼彻斯特看位开始处有无跳变，不看电平高低；NRZI 是“遇 1 翻转”。", "曼彻斯特 1 的方向（高→低或低→高）以题目为准。"],
          ex: { q: "10 Mb/s 以太网采用曼彻斯特编码，其码元传输速率（波特率）为（ ）。",
            opts: ["5 MBaud", "10 MBaud", "20 MBaud", "40 MBaud"], a: 2,
            why: "曼彻斯特每比特两个码元（位中间跳变），码元速率 = 2 × 10 Mb/s = 20 MBaud。",
            src: "典型题" },
          links: { lab: ["encoding"], proc: [] },
          demo: demoEncoding
        });

        PROP.push({
          id: "cn-subnet", sub: "cn", ch: C4, name: "子网划分与可用主机数",
          def: "IP 地址 = 网络前缀 + 主机号；前缀长度 /p 对应的子网掩码前 p 位为 1。主机号全 0 为网络地址，全 1 为直接广播地址。",
          stmt: ["主机号 h 位：可用主机数 **2^h − 2**", "子网号 s 位：可划分 **2^s** 个子网（CIDR 下全 0、全 1 子网可用）", "网络地址 = IP **AND** 掩码；广播地址 = 网络地址的主机号置**全 1**"],
          cond: "“−2”去掉的是网络地址和广播地址；题目若问“地址个数”或“地址块大小”则不减。旧式分类编址（RFC 950）里全 0、全 1 子网不可用，是 2^s − 2，现已不用。",
          proof: [
            "前缀 /p 表示前 p 位是网络号，剩下 h = 32 − p 位是主机号，一共 2^h 个地址。",
            "主机号全 0 表示网络本身，全 1 表示本网广播，都不能分配给主机，所以可用 2^h − 2 个。",
            "从主机号中借出 s 位作子网号：子网号有 2^s 种取值，每个子网剩 h − s 位主机号，可用 2^(h−s) − 2 台主机。",
            "求某地址所在子网：把地址与掩码逐位相与得网络地址；把主机位置 1 得广播地址；二者之间就是可分配范围。",
            "示例：/26 的 h = 6，可用 2^6 − 2 = 62 台主机。"
          ],
          traps: ["可用主机数要减 2，但“地址块包含多少地址”不减。", "掩码 255.255.255.248 是 /29：h = 3，每个子网 6 台主机；在 /24 里借了 5 位，有 32 个子网。", "找子网范围时只对“跨字节”的那一段做二进制运算最快，如 /20 只看第三字节的高 4 位。"],
          ex: { q: "某网络的 IP 地址空间为 192.168.5.0/24，采用定长子网划分，子网掩码为 255.255.255.248，则该网络中的最大子网个数、每个子网内的最大可分配地址个数分别是（ ）。",
            opts: ["32，8", "32，6", "8，32", "8，30"], a: 1,
            why: "248 = 11111000，从 8 位主机号中借 5 位作子网号，CIDR 下有 2^5 = 32 个子网；剩 3 位主机号，可分配 2^3 − 2 = 6 个地址。",
            src: "2010 年真题" },
          links: { lab: ["subnet"], proc: ["arp"] },
          demo: demoSubnet
        });

        PROP.push({
          id: "cn-aggregate", sub: "cn", ch: C4, name: "路由聚合与最长前缀匹配",
          def: "路由聚合（构成超网）：把多个前缀相同的地址块合并成一条更短前缀的路由；最长前缀匹配：有多条路由都匹配时选前缀最长的一条。",
          stmt: ["聚合后的前缀 = 各网络地址的**最长公共前缀**，前缀长度 = 公共前缀位数", "转发时按**最长前缀匹配**：匹配的表项中前缀越长越具体，优先选用", "默认路由 0.0.0.0/0 能匹配任何地址，但前缀最短，最后才用"],
          cond: "聚合块可能覆盖原来不属于这些子网的地址（如 /25 + /24 不连续时）；只有它们从同一接口转发时才适合聚合。",
          proof: [
            "把各地址块的网络地址写成 32 位二进制，从左到右比较。",
            "所有块都相同的最左边那几位就是公共前缀，位数记为 L（不能超过各块自身的前缀长度）。",
            "聚合地址 = 公共前缀 + 后面全 0，写成 网络地址/L。",
            "聚合块共 2^(32−L) 个地址；若原来各块之和小于它，说明聚合多包含了别的地址。",
            "转发时把目的地址分别与每个表项的掩码相与，与表项网络地址相同的都算匹配，取前缀最长的那条。"
          ],
          traps: ["聚合要比较的是网络地址的二进制，不能只看十进制数字是否连续。", "172.16.4.0/24 ~ 172.16.7.0/24 四块聚合为 /22，而 172.16.5.0/24 ~ 172.16.8.0/24 就不能聚合成一个 /22。", "最长前缀匹配比的是“匹配的前缀长度”，不是表项在路由表里的顺序。"],
          ex: { q: "某路由器的路由表如下：169.96.40.0/23 → S1，169.96.40.0/25 → S2，169.96.40.0/27 → S3，0.0.0.0/0 → S4。若路由器收到一个目的地址为 169.96.40.5 的 IP 分组，则转发该 IP 分组的接口是（ ）。",
            opts: ["S1", "S2", "S3", "S4"], a: 2,
            why: "169.96.40.5 与 /23、/25、/27 三项都匹配（最后一字节 5 = 00000101，前 3 位为 0），按最长前缀匹配选 /27，从 S3 转发。",
            src: "2015 年真题" },
          links: { lab: ["lpm", "rip"], proc: [] },
          demo: demoAggregate
        });

        PROP.push({
          id: "cn-ipfrag", sub: "cn", ch: C4, name: "IP 分片",
          def: "IP 分组长度超过链路 MTU 时要分片。首部中的标识、标志（MF、DF）和片偏移三个字段用于重装。",
          stmt: ["片偏移以 **8 字节**为单位：片偏移 = 该片数据在原数据中的起点 / 8", "除最后一片外，每片的数据部分长度必须是 **8 的整数倍**", "**MF = 1** 表示后面还有分片；最后一片 MF = 0；DF = 1 时禁止分片"],
          cond: "MTU 限制的是整个 IP 分组（首部 + 数据）；每个分片都要带一份首部。分片在路由器上进行，重装只在目的主机进行。",
          proof: [
            "原分组数据部分长度 = 总长度 − 首部长度。",
            "每片能装的数据不超过 MTU − 首部长度；又因为片偏移以 8 字节计，除最后一片外数据长度要向下取到 8 的倍数：⌊(MTU − 首部)/8⌋ × 8。",
            "依次切下这么多数据，第 i 片的片偏移 = 前面各片数据总和 / 8。",
            "最后一片装剩下的数据，长度不必是 8 的倍数，MF = 0；其余各片 MF = 1。",
            "示例：总长 4000 B（首部 20 B）过 MTU 1500：每片 1480 B，分 3 片，数据 1480、1480、1020，片偏移 0、185、370。"
          ],
          traps: ["片偏移字段的值要除以 8，不是字节数。", "分片的“总长度”包含首部；算数据长度时别忘了减首部。", "MTU − 首部不是 8 的倍数时要向下取整（如 MTU 820、首部 20 时每片数据 800 B）。"],
          ex: { q: "一个总长度为 1500 B（首部 20 B，无选项）的 IP 分组要经过 MTU = 820 B 的链路，若分片时尽可能使每片最大，则第二个分片的片偏移字段值和 MF 分别是（ ）。",
            opts: ["100，0", "800，0", "100，1", "99，1"], a: 0,
            why: "数据 1480 B；每片最多 ⌊(820 − 20)/8⌋ × 8 = 800 B。第一片数据 0 ~ 799（偏移 0，MF = 1），第二片 680 B 从 800 开始，片偏移 = 800/8 = 100，是最后一片所以 MF = 0。",
            src: "典型题" },
          links: { lab: ["ipfrag"], proc: ["encap"] },
          demo: demoIpfrag
        });

        PROP.push({
          id: "cn-cwnd", sub: "cn", ch: C5, name: "TCP 拥塞控制（慢开始、拥塞避免、快重传快恢复）",
          def: "拥塞窗口 cwnd：发送方根据网络拥塞程度维护的窗口；慢开始门限 ssthresh：区分慢开始和拥塞避免的分界。",
          stmt: ["慢开始：cwnd < ssthresh 时每经过一个 RTT **翻倍**", "拥塞避免：cwnd ≥ ssthresh 后每个 RTT **加 1**（MSS）", "超时：**ssthresh = cwnd/2，cwnd = 1**；3 个重复 ACK：快重传，快恢复令 **cwnd = ssthresh = cwnd/2**"],
          cond: "以 TCP Reno 为准，cwnd 以 MSS 为单位、按“每个 RTT”离散计算；发送窗口还要受接收窗口限制（取 min）。慢开始翻倍时不越过 ssthresh，到达后转入拥塞避免。",
          proof: [
            "连接刚建立时不知道网络能承受多少，cwnd 从 1 开始，每收到一个确认 cwnd 加 1，一个 RTT 内的确认使 cwnd 翻倍。",
            "cwnd 增长到 ssthresh 后改为拥塞避免：每个 RTT 只加 1，线性试探。",
            "发生超时说明网络严重拥塞：ssthresh 降为当时 cwnd 的一半，cwnd 回到 1 重新慢开始。",
            "收到 3 个重复 ACK 说明只是个别报文段丢失：立即重传（快重传），并令 ssthresh = cwnd/2、cwnd = ssthresh，直接进入拥塞避免（快恢复）。",
            "示例：cwnd = 16 时超时，ssthresh = 8，之后 4 个 RTT：1 → 2 → 4 → 8 → 9。"
          ],
          traps: ["超时后 cwnd 回到 1，3 个重复 ACK 后 cwnd 不回到 1（王道口径 cwnd = 新 ssthresh）。", "数 RTT 时注意“第 n 个 RTT 内发送的段都被确认时”的 cwnd 是第 n 次增长之后的值。", "发送窗口 = min(cwnd, rwnd)，接收方缓存满时 cwnd 再大也发不出去。"],
          ex: { q: "一个 TCP 连接总是以 1 KB 的最大段长发送 TCP 段，发送方有足够多的数据要发送。当拥塞窗口为 16 KB 时发生了超时，如果接下来的 4 个 RTT 内的 TCP 段的传输都是成功的，那么当第 4 个 RTT 内发送的所有 TCP 段都得到肯定应答时，拥塞窗口大小是（ ）。",
            opts: ["7 KB", "8 KB", "9 KB", "16 KB"], a: 2,
            why: "超时后 ssthresh = 8 KB、cwnd = 1 KB；慢开始 3 个 RTT 后为 2、4、8 KB，达到门限转入拥塞避免，第 4 个 RTT 后为 9 KB。",
            src: "2009 年真题" },
          links: { lab: ["tcp"], proc: [] },
          demo: demoCwnd
        });

        PROP.push({
          id: "cn-tcpthru", sub: "cn", ch: C5, name: "TCP 最大吞吐量与发送窗口",
          def: "发送窗口：发送方在未收到确认时最多能发出的字节数，受接收方通告的接收窗口 rwnd 和自身拥塞窗口 cwnd 共同限制。",
          stmt: ["发送窗口 = **min(rwnd, cwnd)**", "吞吐量上限 = **发送窗口 / RTT**（不超过链路带宽）", "窗口字段 16 位，最大 **65535 字节**；窗口扩大选项可左移最多 14 位"],
          cond: "假设发送方数据充足、忽略首部开销和发送时延；若窗口 ≥ 带宽 × RTT，链路被跑满，吞吐量就等于带宽。",
          proof: [
            "发送方发完一个窗口的数据后，必须等第一个字节的确认回来（约一个 RTT）才能继续发。",
            "所以每个 RTT 最多送出一个窗口的数据，吞吐量 ≤ 窗口 / RTT。",
            "窗口既不能超过接收方的接收窗口（流量控制），也不能超过拥塞窗口（拥塞控制），取两者较小值。",
            "窗口字段 16 位，不用扩大选项时窗口最多 65535 B：RTT = 100 ms 时吞吐量不超过约 5.24 Mb/s。",
            "已发出未确认的数据要从窗口里扣除：可发送字节数 = 发送窗口 − 已发未确认字节数。"
          ],
          traps: ["吞吐量用的是窗口 / RTT，不是窗口 / 单程时延。", "收到确认后可发送的字节数 = min(rwnd, cwnd) − 仍未确认的字节，不要忘了扣掉在途数据。", "65535 是字节，换成比特要乘 8。"],
          ex: { q: "主机甲和主机乙之间已建立一个 TCP 连接，TCP 最大段长度为 1000 字节。若主机甲的当前拥塞窗口为 4000 字节，在主机甲向主机乙连续发送两个最大段后，成功收到主机乙发送的第一个段的确认段，确认段中通告的接收窗口大小为 2000 字节，则此时主机甲还可以向主机乙发送的最大字节数是（ ）。",
            opts: ["1000", "2000", "3000", "4000"], a: 0,
            why: "发送窗口 = min(4000, 2000) = 2000 字节；第二个段（1000 字节）尚未确认，还占着窗口，所以还能发 2000 − 1000 = 1000 字节。",
            src: "2010 年真题" },
          links: { lab: ["tcp", "slidewin"], proc: [] },
          demo: demoTcpThru
        });

        PROP.push({
          id: "cn-tcpseq", sub: "cn", ch: C5, name: "TCP 序号与确认号",
          def: "TCP 面向字节流，给每个字节编号。报文段的序号是其数据第一个字节的编号；确认号是期望收到对方下一个报文段数据的第一个字节的序号。",
          stmt: ["确认号 = **期望收到的下一个字节的序号**（已正确收到的最后一个字节 + 1）", "**SYN 和 FIN 各消耗一个序号**，即使不携带数据", "纯 ACK 报文段**不消耗**序号；下一个报文段序号 = 本段序号 + 数据长度（+1 若含 SYN/FIN）"],
          cond: "TCP 采用累积确认；初始序号由双方各自随机选择。只有 ACK 标志为 1 时确认号字段才有效（第一个 SYN 中 ACK = 0）。",
          proof: [
            "第一次握手：客户端 SYN，seq = x，不带数据但消耗一个序号。",
            "第二次握手：服务器 SYN + ACK，seq = y，ack = x + 1（期望客户端从 x + 1 号字节发）。",
            "第三次握手：客户端 ACK，seq = x + 1，ack = y + 1；它不带数据，不消耗序号。",
            "客户端发数据：第一段 seq = x + 1，长 L₁；服务器确认 ack = x + 1 + L₁；第二段 seq = x + 1 + L₁，以此类推。",
            "挥手：FIN 也消耗一个序号，对 FIN 的确认号 = FIN 的序号 + 1。"
          ],
          traps: ["第三次握手的纯 ACK 不占序号，紧接着的数据段序号仍是 x + 1。", "确认号是“下一个期望的字节”，不是“最后收到的字节”，所以要 +1。", "收到乱序段时确认号仍指向缺失的那个字节（累积确认）。"],
          ex: { q: "主机甲与主机乙之间已建立一个 TCP 连接，主机甲向主机乙发送了两个连续的 TCP 段，分别包含 300 字节和 500 字节的有效载荷，第一个段的序列号为 200，主机乙正确接收到两个段后，发送给主机甲的确认序列号是（ ）。",
            opts: ["500", "700", "800", "1000"], a: 3,
            why: "第一个段占 200 ~ 499，第二个段占 500 ~ 999，乙期望的下一个字节是 1000，所以确认号为 1000。",
            src: "2009 年真题" },
          links: { lab: ["tcpconn"], proc: ["webvisit"] },
          demo: demoTcpSeq
        });

        PROP.push({
          id: "cn-ether", sub: "cn", ch: C3, name: "以太网帧长与冲突域、广播域",
          def: "冲突域：同一时刻只能有一个站点成功发送的网络范围；广播域：一个广播帧能到达的范围。",
          stmt: ["以太网 MAC 帧**最短 64 字节、最长 1518 字节**，数据部分 **46 ~ 1500 字节**（首部 14 B + FCS 4 B）", "集线器：所有端口**同一个冲突域**；交换机：**每个端口一个冲突域**，整体一个广播域", "路由器：**隔离广播域**（每个接口一个广播域），也隔离冲突域"],
          cond: "帧长不含 8 字节前导码。数据不足 46 字节时填充到 46 字节；超过 1500 字节须在 IP 层分片。VLAN 可在交换机上划分多个广播域（不在本条讨论范围）。",
          proof: [
            "CSMA/CD 要求帧的发送时间不少于争用期，10 Mb/s 时为 512 bit，即 64 字节最短帧。",
            "MAC 帧首部 14 字节（目的地址 6、源地址 6、类型 2），尾部 FCS 4 字节，共 18 字节开销，所以数据至少 64 − 18 = 46 字节。",
            "集线器工作在物理层，只是把信号转发到所有端口，任意两站同时发送都会碰撞，所以整体一个冲突域。",
            "交换机工作在数据链路层，按 MAC 地址转发并存储转发，每个端口独立，所以每个端口一个冲突域；但广播帧会被转发到所有端口，整体一个广播域。",
            "路由器工作在网络层，不转发链路层广播，所以每个接口一个广播域，能抑制广播风暴。"
          ],
          traps: ["64 字节是整个帧（含首部和 FCS），不是数据部分。", "交换机分割冲突域但不分割广播域；只有路由器（网络层设备）能抑制广播风暴。", "集线器下挂的多台主机算一个冲突域，接到交换机的一个端口上也只算一个。"],
          ex: { q: "下列网络设备中，能够抑制广播风暴的是（ ）。Ⅰ. 中继器　Ⅱ. 集线器　Ⅲ. 网桥　Ⅳ. 路由器",
            opts: ["仅 Ⅰ 和 Ⅱ", "仅 Ⅲ", "仅 Ⅲ 和 Ⅳ", "仅 Ⅳ"], a: 3,
            why: "中继器、集线器在物理层，既不隔离冲突域也不隔离广播域；网桥（交换机）隔离冲突域但会转发广播；只有路由器隔离广播域，能抑制广播风暴。",
            src: "2010 年真题" },
          links: { lab: ["csmacd"], proc: ["switch", "arp"] },
          demo: demoEther
        });
      })();
