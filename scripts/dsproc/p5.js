
        /* ===================== 8. 外部排序 ===================== */
        DS.dummy = function (n, k) { var r = (n - 1) % (k - 1); return r === 0 ? 0 : (k - 1) - r; };
        DS.replSel = function (data, wa) {
          var inp = data.slice(), WA = [], runs = [], cur = [], mm = null, ev = [];
          while (WA.length < wa && inp.length) WA.push({ v: inp.shift(), fz: false });
          ev.push({ type: "fill", WA: WA.map(function (x) { return x.v; }) });
          for (;;) {
            var best = -1;
            WA.forEach(function (x, i) { if (x && !x.fz && (mm == null || x.v >= mm) && (best < 0 || x.v < WA[best].v)) best = i; });
            if (best < 0) {
              if (!WA.some(function (x) { return x; })) { if (cur.length) runs.push(cur); ev.push({ type: "end", runs: runs.slice() }); break; }
              runs.push(cur); cur = []; mm = null;
              WA.forEach(function (x) { if (x) x.fz = false; });
              ev.push({ type: "cut", run: runs.length });
              continue;
            }
            var out = WA[best].v; cur.push(out); mm = out;
            var rd = inp.length ? inp.shift() : null;
            WA[best] = rd == null ? null : { v: rd, fz: rd < mm };
            ev.push({ type: "out", slot: best, v: out, read: rd });
          }
          return { runs: runs, ev: ev };
        };
        function replSpec(inp) {
          var data = nums(inp.rs == null ? "17 21 5 44 10 12 56 32 29" : inp.rs, 3, 15, "输入记录"), WA = 3;
          var R = DS.replSel(data, WA);
          var nodes = [], edges = [], S = [];
          nodes.push({ id: "FI", k: "fields", unit: 1, x: 20, y: 60, w: 940, h: 56, t: "输入文件 FI（按顺序读入）", segs: [] });
          nodes.push({ id: "ZW", k: "zone", x: 250, y: 160, w: 400, h: 120, t: "工作区 WA（容量 3）" });
          for (var i = 0; i < WA; i++) nodes.push({ id: "W" + i, k: "box", x: 280 + i * 120, y: 200, w: 100, h: 56, t: "WA[" + i + "]", v: " " });
          nodes.push({ id: "MM", k: "reg", x: 740, y: 200, w: 200, h: 56, t: "MINIMAX", v: "—" });
          nodes.push({ id: "OUT", k: "table", x: 20, y: 330, w: 940, h: 26 + Math.max(2, R.runs.length) * 22 + 6, rh: 22, t: "输出文件 FO：初始归并段", cols: [0.12], rows: [["", "（还没有输出）"]] });
          edges.push({ id: "rd", a: "FI", as: "b", ao: -40, b: "W1", bs: "t", t: "读入" });
          edges.push({ id: "out", a: "W1", as: "b", b: "OUT", bs: "t", bo: -40, t: "输出" });
          edges.push({ id: "mm", a: "W2", as: "r", b: "MM", bs: "l", t: "记录" });
          var pos = 0, WAv = [null, null, null], fz = [false, false, false], runs = [[]], mm = null;
          function fi() { return data.map(function (v, i) { return { t: String(i + 1), v: i < pos ? "" : String(v), w: 1, on: i === pos - 1 }; }); }
          function setAll(extra) {
            var o = { FI: { segs: fi() }, MM: { v: mm == null ? "—" : String(mm) } };
            for (var i = 0; i < WA; i++) o["W" + i] = { v: WAv[i] == null ? " " : String(WAv[i]), badge: WAv[i] != null && fz[i] ? "下一段" : "" };
            var rows = runs.filter(function (r, i) { return r.length || i < runs.length - 1; }).map(function (r, i) { return ["段 " + (i + 1), r.join("  ")]; });
            o.OUT = { rows: rows.length ? rows : [["", "（还没有输出）"]], hi: rows.length - 1 };
            each(extra || {}, function (k, v) { o[k] = v; });
            return o;
          }
          var kvs = function (o) { o = o || {}; o["已读入"] = pos + " / " + data.length; o["归并段数"] = String(runs.filter(function (r) { return r.length; }).length); return o; };
          R.ev.forEach(function (e) {
            if (e.type === "fill") {
              e.WA.forEach(function (v, i) { WAv[i] = v; }); pos = e.WA.length;
              S.push({ t: "先从 FI 读入 " + pos + " 个记录装满工作区", d: "置换—选择排序：工作区 WA 能放 3 个记录。先顺序读入 " + e.WA.join("、") + "，此时还没有输出，MINIMAX 为空。", on: ["FI", "W0", "W1", "W2"], go: ["rd"], set: setAll(), kv: kvs(), tip: "置换—选择排序生成的初始归并段长度不等，平均长度约为工作区大小的 2 倍（本例 WA = 3）。" });
            } else if (e.type === "out") {
              var cand = WAv.map(function (v, i) { return v != null && !fz[i] ? v : null; }).filter(function (v) { return v != null; });
              runs[runs.length - 1].push(e.v); mm = e.v; WAv[e.slot] = e.read;
              if (e.read != null) { pos++; fz[e.slot] = e.read < mm; } else fz[e.slot] = false;
              var rdTxt = e.read == null ? "FI 已读完，WA[" + e.slot + "] 空出。" : "从 FI 读入 " + e.read + " 放进 WA[" + e.slot + "]" + (e.read < mm ? "；" + e.read + " < MINIMAX，本段不能再输出它，标为“下一段”。" : "。");
              S.push({ t: "输出 " + e.v + "，MINIMAX = " + e.v, d: "在 WA 中可输出的记录 " + cand.join("、") + " 里，选出不小于 MINIMAX 的最小者 " + e.v + "，输出到归并段 " + runs.length + "，并记 MINIMAX = " + e.v + "。" + rdTxt, on: ["W" + e.slot, "MM", "OUT"], go: e.read == null ? ["out", "mm"] : ["out", "mm", "rd"], set: setAll(), kv: kvs({ "MINIMAX": String(mm) }) });
            } else if (e.type === "cut") {
              var left = WAv.filter(function (v) { return v != null; });
              S.push({ t: "归并段 " + e.run + " 结束", d: "WA 中剩下的 " + left.join("、") + " 都比 MINIMAX = " + mm + " 小，当前归并段不能再延长，段 " + e.run + " 结束。清空 MINIMAX，这些记录全部进入下一段。", on: ["W0", "W1", "W2", "MM", "OUT"], set: (function () { fz = [false, false, false]; mm = null; runs.push([]); return setAll(); })(), kv: kvs({ "MINIMAX": "—" }), tip: "MINIMAX 的作用：只有不小于它的记录才能接在当前段后面，保证段内有序。" });
            } else {
              var lens = R.runs.map(function (r) { return r.length; });
              S.push({ t: "FI 读完、WA 清空：得到 " + R.runs.length + " 个初始归并段", d: "初始归并段：" + R.runs.map(function (r, i) { return "段 " + (i + 1) + "（" + r.length + " 个）"; }).join("，") + "。平均长度 " + (data.length / R.runs.length).toFixed(1) + "，比工作区容量 3 大。", on: ["OUT"], set: setAll({ OUT: { rows: R.runs.map(function (r, i) { return ["段 " + (i + 1), r.join("  ")]; }), hi: -1 } }), kv: kvs({ "各段长度": lens.join("、") }), tip: "初始归并段越少、越长，后面的归并趟数就越少：归并趟数 = ⌈log_k r⌉（r 为初始归并段数）。" });
            }
          });
          return { w: 980, h: Math.max(400, 330 + 26 + Math.max(2, R.runs.length) * 22 + 30), nodes: nodes, edges: edges, steps: S };
        }

        /* 败者树：k = 5，内部结点 ls[1..4]，叶子 b0..b4 对应完全二叉树编号 5..9；ls[0] 存冠军 */
        DS.loser = function (vals) {
          var K = vals.length, ls = [], b = vals.slice();
          function win(t) {
            if (t >= K) return t - K;
            var x = win(2 * t), y = win(2 * t + 1);
            if (b[x] <= b[y]) { ls[t] = y; return x; }
            ls[t] = x; return y;
          }
          ls[0] = win(1);
          return { ls: ls, champion: ls[0] };
        };
        function loserSpec() {
          var K = 5, RUNS = [[10, 15, 16], [9, 18, 20], [20, 22, 40], [6, 15, 25], [12, 37, 48]];
          var ptr = [0, 0, 0, 0, 0], b = RUNS.map(function (r) { return r[0]; }), ls = [], cmp = 0, out = [];
          var nodes = [], edges = [], S = [];
          var POS = { ls0: [2.5, 0], ls1: [2.5, 1], ls2: [1.5, 2], ls3: [3.5, 2], ls4: [0.5, 3], b0: [2, 3], b1: [3, 3], b2: [4, 3], b3: [0, 4], b4: [1, 4] };
          each(POS, function (id, p) {
            var t = id === "ls0" ? "ls[0] 冠军" : id.charAt(0) === "l" ? "ls[" + id.slice(2) + "]" : "b" + id.slice(1);
            nodes.push({ id: id, k: id.charAt(0) === "b" ? "reg" : "box", x: 20 + p[0] * 130, y: 30 + p[1] * 95, w: 84, h: 46, t: t, v: "", sm: id === "ls0" ? 1 : 0 });
          });
          var idOf = function (t) { return t >= K ? "b" + (t - K) : "ls" + t; };
          for (var t = 2; t <= 2 * K - 1; t++) edges.push({ id: "u_" + idOf(t), a: idOf(t), as: "t", b: idOf(t >> 1), bs: "b", bo: t % 2 ? 12 : -12 });
          edges.push({ id: "u_ls1", a: "ls1", as: "t", b: "ls0", bs: "b", t: "冠军" });
          nodes.push({ id: "RUNS", k: "table", x: 650, y: 30, w: 310, h: 26 + 5 * 22 + 6, rh: 22, t: "5 个归并段（[ ] 为当前记录）", cols: [0.2], rows: [] });
          nodes.push({ id: "OUTB", k: "box", x: 650, y: 210, w: 310, h: 60, t: "输出序列", v: "—" });
          nodes.push({ id: "CMP", k: "box", x: 650, y: 310, w: 310, h: 60, t: "本次比较", v: "—", sm: 1 });
          function runRows() { return RUNS.map(function (r, i) { var rest = r.slice(ptr[i]); return ["段 " + i, rest.length ? "[" + rest[0] + "] " + rest.slice(1).join(" ") : "[∞] 已取完"]; }); }
          function snap(extra) {
            var o = {};
            for (var i = 0; i < K; i++) o["b" + i] = { v: String(b[i]) };
            for (var j = 1; j < K; j++) o["ls" + j] = { v: ls[j] == null ? "" : "b" + ls[j] + " · " + b[ls[j]] };
            o.ls0 = { v: ls[0] == null ? "" : "b" + ls[0] + " · " + b[ls[0]] };
            o.RUNS = { rows: runRows(), hi: -1 };
            o.OUTB = { v: out.length ? out.join(" ") : "—" };
            each(extra || {}, function (k, v) { o[k] = v; });
            return o;
          }
          function kv(o) { o = o || {}; o["比较次数"] = String(cmp); o["已输出"] = out.length ? out.join(" ") : "—"; return o; }
          S.push({ t: "5 路归并：叶子装入各段的首记录", d: "叶子 b0–b4 分别是 5 个归并段的当前记录 10、9、20、6、12。内部结点 ls[1]–ls[4] 将记录“败者”（较大者）所在的段号，胜者继续向上比，冠军放在 ls[0]。", on: ["b0", "b1", "b2", "b3", "b4", "RUNS"], set: snap({ RUNS: { rows: runRows(), hi: [0, 1, 2, 3, 4] } }), kv: kv() });
          /* 建树：按 ls[4]、ls[2]、ls[3]、ls[1] 的次序自底向上比赛 */
          var W = {};
          function play(t) {
            var x = t * 2, y = t * 2 + 1;
            var wx = x >= K ? x - K : W[x], wy = y >= K ? y - K : W[y];
            cmp++;
            var winr = b[wx] <= b[wy] ? wx : wy, los = winr === wx ? wy : wx;
            ls[t] = los; W[t] = winr;
            S.push({ t: "ls[" + t + "]：b" + wx + "(" + b[wx] + ") 与 b" + wy + "(" + b[wy] + ") 比较", d: "较大的 b" + los + "(" + b[los] + ") 是败者，段号 " + los + " 记入 ls[" + t + "]；胜者 b" + winr + "(" + b[winr] + ") 继续向上参加比较。", on: ["ls" + t, idOf(x), idOf(y)], go: ["u_" + idOf(x), "u_" + idOf(y)], set: snap({ CMP: { v: b[wx] + " vs " + b[wy] + " → 败者 b" + los } }), kv: kv() });
          }
          play(4); play(2); play(3); play(1);
          ls[0] = W[1];
          S.push({ t: "冠军 b" + ls[0] + "(" + b[ls[0]] + ") 放入 ls[0]", d: "ls[1] 的胜者就是全局最小记录，即冠军。败者树建成。", on: ["ls0", "ls1"], go: ["u_ls1"], set: snap({ CMP: { v: "冠军 = 最小值 " + b[ls[0]] } }), kv: kv({ "冠军": String(b[ls[0]]) }), tip: "冠军一定是 k 个叶子中的最小值；内部结点存的是败者的段号（下标），不是关键字本身。" });
          for (var r = 0; r < 4; r++) {
            var s = ls[0], v = b[s];
            out.push(v); ptr[s]++;
            b[s] = ptr[s] < RUNS[s].length ? RUNS[s][ptr[s]] : Infinity;
            S.push({ t: "输出冠军 " + v + "，段 " + s + " 补入 " + b[s], d: "把冠军 " + v + "（来自段 " + s + "）写到输出缓冲区，再用段 " + s + " 的下一个记录 " + b[s] + " 替换叶子 b" + s + "。接下来只需沿 b" + s + " 到根的路径重新比较。", on: ["ls0", "b" + s, "OUTB", "RUNS"], set: snap({ RUNS: { rows: runRows(), hi: s }, CMP: { v: "从 b" + s + " 向上调整" } }), kv: kv(), tip: r === 0 ? "每输出一个记录只调整一条从叶到根的路径，比较次数不超过 ⌈log₂k⌉ = 3（k = 5 时叶子深度不一，有的路径只比 2 次），与 k 个记录逐个比较无关。" : undefined });
            var tt = (s + K) >> 1, from = idOf(s + K), path = [];
            while (tt > 0) {
              cmp++;
              var o = ls[tt], lose = b[s] > b[o];
              var txt = "b" + s + "(" + b[s] + ") 与 ls[" + tt + "] 中的败者 b" + o + "(" + b[o] + ") 比较：";
              if (lose) { ls[tt] = s; s = o; txt += b[ls[tt]] + " > " + b[o] + "，b" + ls[tt] + " 输，留在 ls[" + tt + "]；b" + s + " 胜，继续向上。"; }
              else txt += b[s] + " ≤ " + b[o] + "，b" + s + " 胜，继续向上；ls[" + tt + "] 不变。";
              path.push(tt);
              S.push({ t: "调整 ls[" + tt + "]", d: txt, on: ["ls" + tt], go: ["u_" + from], set: snap({ CMP: { v: lose ? "败者换成 b" + ls[tt] + "，胜者 b" + s : "b" + s + " 胜，ls[" + tt + "] 不变" } }), kv: kv() });
              from = "ls" + tt; tt >>= 1;
            }
            ls[0] = s;
            S.push({ t: "新冠军 b" + s + "(" + b[s] + ")", d: "调整到根，胜者 b" + s + " 放入 ls[0]，它就是下一个要输出的记录。本次调整比较了 " + path.length + " 次。", on: ["ls0"], go: ["u_ls1"], set: snap({ CMP: { v: "冠军 = " + b[s] } }), kv: kv({ "冠军": String(b[s]) }) });
          }
          S.push({ t: "小结", d: "已输出 " + out.join("、") + "，恰好是 5 个段合起来的前 " + out.length + " 小。每次输出后只沿一条路径比较 2–3 次（不超过 ⌈log₂k⌉ = 3）；若每次都在 k 个记录中顺序选最小，要比较 k − 1 = 4 次。", on: ["OUTB"], set: snap(), kv: kv(), tip: "败者树使内部归并的比较次数与 k 无关，所以可以增大归并路数 k 来减少归并趟数，但 k 受内存缓冲区个数限制。" });
          return { w: 980, h: 480, nodes: nodes, edges: edges, steps: S };
        }

        /* 最佳归并树：k 叉哈夫曼树，必要时补长度为 0 的虚段 */
        DS.bestTree = function (lens, k) {
          var d = DS.dummy(lens.length, k), seq = 0, items = [];
          lens.forEach(function (v) { items.push({ v: v, id: seq++, leaf: true, kids: [] }); });
          for (var i = 0; i < d; i++) items.push({ v: 0, id: seq++, leaf: true, dummy: true, kids: [] });
          var forest = items.slice(), merges = [];
          while (forest.length > 1) {
            forest.sort(function (a, b) { return a.v - b.v || a.id - b.id; });
            var take = forest.splice(0, k), node = { v: 0, id: seq++, kids: take };
            take.forEach(function (x) { node.v += x.v; });
            merges.push(node); forest.push(node);
          }
          var wpl = 0;
          merges.forEach(function (m) { wpl += m.v; });
          return { dummy: d, leaves: items, merges: merges, root: forest[0], wpl: wpl, io: 2 * wpl };
        };
        function bestSpec(inp) {
          var lens = nums(inp.bl == null ? "2 3 6 9 12 17 18 24" : inp.bl, 2, 12, "归并段长度"), k = Number(inp.bk || 3);
          if ([2, 3, 4].indexOf(k) < 0) throw new Error("k 只能取 2、3、4");
          var T = DS.bestTree(lens, k), n = lens.length;
          /* 布局：叶子按深度优先次序排列，内部结点取孩子横坐标的平均值 */
          var order = [], depth = {}, maxD = 0;
          (function walk(x, dd) { depth[x.id] = dd; maxD = Math.max(maxD, dd); if (!x.kids.length) order.push(x); x.kids.forEach(function (c) { walk(c, dd + 1); }); })(T.root, 0);
          if (maxD > 5) throw new Error("归并树太深（超过 6 层），图里放不下；可以增大 k 或减少归并段");
          var sp = 900 / order.length, bw = Math.min(60, Math.floor(sp - 16)), gy = maxD ? Math.min(100, Math.floor(340 / maxD)) : 100, X = {};
          order.forEach(function (x, i) { X[x.id] = 40 + (i + 0.5) * sp; });
          (function fx(x) { if (!x.kids.length) return X[x.id]; var s = 0; x.kids.forEach(function (c) { s += fx(c); }); X[x.id] = s / x.kids.length; return X[x.id]; })(T.root);
          var nodes = [], edges = [], S = [], all = T.leaves.concat(T.merges);
          all.forEach(function (x) { nodes.push({ id: "m" + x.id, k: x.leaf ? "reg" : "box", x: Math.round(X[x.id] - bw / 2), y: 40 + depth[x.id] * gy, w: bw, h: 40, t: x.leaf && !x.dummy ? String(x.v) : "" }); });
          T.merges.forEach(function (m) { m.kids.forEach(function (c) { edges.push({ id: "e" + c.id, a: "m" + m.id, as: "b", b: "m" + c.id, bs: "t" }); }); });
          var by = 40 + maxD * gy + 40 + 50;
          var r = (n - 1) % (k - 1);
          nodes.push({ id: "FORM", k: "box", x: 20, y: by, w: 440, h: 60, t: "补虚段个数（k = " + k + "，n = " + n + "）", v: r === 0 ? "(n−1) % (k−1) = 0，不补" : "(k−1) − (n−1)%(k−1) = " + (k - 1) + " − " + r + " = " + T.dummy, sm: 1 });
          nodes.push({ id: "FOR", k: "box", x: 500, y: by, w: 440, h: 60, t: "当前各段长度（升序）", v: "", sm: 1 });
          var forest = T.leaves.filter(function (x) { return !x.dummy; }).map(function (x) { return x.v; }), shown = {};
          T.leaves.forEach(function (x) { if (!x.dummy) shown["m" + x.id] = { t: String(x.v) }; });
          function fv() { return forest.slice().sort(function (a, b) { return a - b; }).join(" "); }
          function snap(extra) { var o = JSON.parse(JSON.stringify(shown)); o.FOR = { v: fv() }; each(extra || {}, function (kk, v) { o[kk] = v; }); return o; }
          var wpl = 0;
          S.push({ t: n + " 个初始归并段，做 " + k + " 路归并", d: "各段长度（记录数或块数）：" + lens.join("、") + "。归并树的带权路径长度 WPL = 归并过程的总读记录数；要让读写次数最少，就用哈夫曼思想构造 " + k + " 叉最佳归并树。", on: T.leaves.filter(function (x) { return !x.dummy; }).map(function (x) { return "m" + x.id; }), set: snap(), kv: { "n": String(n), "k": String(k) } });
          if (T.dummy) {
            T.leaves.filter(function (x) { return x.dummy; }).forEach(function (x) { shown["m" + x.id] = { t: "0", badge: "虚段" }; forest.push(0); });
            S.push({ t: "补 " + T.dummy + " 个长度为 0 的虚段", d: "严格 " + k + " 叉树要求 (n − 1) % (k − 1) = 0。这里 (" + n + " − 1) % " + (k - 1) + " = " + r + " ≠ 0，需补 (k − 1) − (n − 1) % (k − 1) = " + T.dummy + " 个虚段，使每次都能凑满 " + k + " 个段归并。", on: ["FORM"].concat(T.leaves.filter(function (x) { return x.dummy; }).map(function (x) { return "m" + x.id; })), set: snap(), kv: { "虚段数": String(T.dummy) }, tip: "虚段长度为 0，放在最深层，不增加读写次数；不补虚段会让最后一次归并不满 k 路，WPL 变大。" });
          } else {
            S.push({ t: "不需要补虚段", d: "(n − 1) % (k − 1) = (" + n + " − 1) % " + (k - 1) + " = 0，每次取 " + k + " 个段归并，正好合成一棵严格 " + k + " 叉树。", on: ["FORM"], set: snap(), kv: { "虚段数": "0" }, tip: "若余数不为 0，要补 (k − 1) − (n − 1) % (k − 1) 个虚段。" });
          }
          T.merges.forEach(function (m, i) {
            var vs = m.kids.map(function (c) { return c.v; });
            vs.forEach(function (v) { forest.splice(forest.indexOf(v), 1); });
            forest.push(m.v); wpl += m.v;
            shown["m" + m.id] = { t: String(m.v) };
            S.push({ t: "第 " + (i + 1) + " 次归并：" + vs.join(" + ") + " = " + m.v, d: "从当前各段中选最短的 " + k + " 个（" + vs.join("、") + "）归并成一个长度为 " + m.v + " 的新段，这一次要读入 " + m.v + " 个记录、写出 " + m.v + " 个记录。", on: ["m" + m.id].concat(m.kids.map(function (c) { return "m" + c.id; })), go: m.kids.map(function (c) { return "e" + c.id; }), set: snap(), kv: { "WPL（累计）": String(wpl) } });
          });
          S.push({ t: "WPL = " + T.wpl + "，读写次数 = 2 × WPL = " + T.io, d: "WPL = Σ 叶子长度 × 层数（根为第 0 层）= 各次归并的段长之和 = " + T.merges.map(function (m) { return m.v; }).join(" + ") + " = " + T.wpl + "。每个记录读一次写一次，总 I/O 次数 = 2 × " + T.wpl + " = " + T.io + "。", on: ["m" + T.root.id], set: snap(), kv: { "WPL": String(T.wpl), "读写次数": String(T.io) }, tip: "最佳归并树的 WPL 最小，但不改变归并趟数；虚段要放在离根最远处（最先参加归并）。" });
          return { w: 980, h: by + 80, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "extsort", name: "外部排序：置换—选择、败者树、最佳归并树", sub: "ds",
          lead: "外部排序 = 生成初始归并段 + 多路归并。置换—选择排序让初始段更长，败者树让 k 路归并的比较次数与 k 无关，最佳归并树让读写次数最少。",
          note: ["外部排序时间 = 内部排序时间 + 外存读写时间 + 内部归并时间，其中读写外存占主要部分。", "r 个初始归并段做 k 路平衡归并，归并趟数 = ⌈log_k r⌉；增大 k 或减少 r 都能减少趟数。", "败者树：内部结点记败者，冠军在 ls[0]；每输出一个记录只需比较 ⌈log₂k⌉ 次，与 k 无关。", "置换—选择排序：每次输出 WA 中不小于 MINIMAX 的最小记录；得到的初始归并段长度不等，平均约为 WA 大小的 2 倍。", "最佳归并树：k 叉哈夫曼树，(n − 1) % (k − 1) ≠ 0 时补 (k − 1) − (n − 1) % (k − 1) 个虚段；读写次数 = 2 × WPL。"],
          modes: [
            { name: "置换—选择排序（WA = 3）", inputs: [{ k: "rs", label: "输入文件 FI 的记录（3–15 个）", value: "17 21 5 44 10 12 56 32 29", ph: "空格或逗号分隔" }], make: replSpec },
            { name: "败者树（k = 5）", make: loserSpec },
            { name: "最佳归并树（补虚段）", inputs: [{ k: "bl", label: "各归并段长度（2–12 个）", value: "2 3 6 9 12 17 18 24", ph: "空格或逗号分隔" }, { k: "bk", label: "归并路数 k", type: "select", value: "3", opts: [["2", "2 路"], ["3", "3 路"], ["4", "4 路"]] }], make: bestSpec, presets: [{ label: "8 段 3 路（补 1 个）", v: { bl: "2 3 6 9 12 17 18 24", bk: "3" } }, { label: "9 段 3 路（不补）", v: { bl: "9 12 18 3 17 2 6 30 24", bk: "3" } }, { label: "8 段 4 路（补 2 个）", v: { bl: "5 8 12 3 20 7 15 10", bk: "4" } }] }
          ]
        });
      })();
