      /* 数据结构动画实验（三）：散列表、折半查找与判定树、排序补充（希尔 / 简单选择 / 折半插入 / 基数）。
         纯计算函数挂在 window.LABU 上（dsParseInts / dsHash / dsBsearch / dsBsTree / dsShell / dsShellIncs / dsSelect /
         dsBinInsert / dsRadix / dsFrac），界面通过 LAB.push 注册（id：hash、bsearch、sort2），顶层不访问 DOM。 */
      (function () {
        var LAB = window.LAB = window.LAB || [];
        var LABU = window.LABU = window.LABU || {};

        /* ======================= 小工具 ======================= */
        function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
        function fill(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }
        function minus(s) { return String(s).replace(/^-/, "−"); }
        function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }
        function round2(v) { return Math.round(v * 100) / 100; }
        /* 分数 num/den 的展示：30/12 = 2.5；44/12 = 11/3 ≈ 3.67 */
        LABU.dsFrac = function (num, den) {
          if (!den) return { num: num, den: den, val: 0, text: num + "/0" };
          var v = num / den, g = gcd(num, den), s = num + "/" + den, rn = num / g, rd = den / g;
          var exact = rd === 1 || /^\d+(\.\d{1,2})?$/.test(String(Math.abs(v)));
          if (g > 1 && rd !== 1 && !exact) s += " = " + rn + "/" + rd;
          s += exact ? " = " + round2(v) : " ≈ " + round2(v).toFixed(2);
          return { num: num, den: den, val: v, text: s };
        };
        /* 解析一串整数：逗号、空格、顿号、分号都可分隔；o = { name, min, max, nonneg, noDup, lo, hi } */
        LABU.dsParseInts = function (s, o) {
          o = o || {};
          var name = o.name || "关键字";
          var t = String(s == null ? "" : s).replace(/[−–—－]/g, "-").replace(/[{}（）()\[\]【】{}]/g, " ").replace(/[，、；;。\s]+/g, ",");
          var parts = t.split(",").filter(function (x) { return x !== ""; }), v = [], i;
          if (!parts.length) return { err: "请输入" + name + "，用逗号或空格分隔" };
          for (i = 0; i < parts.length; i++) {
            if (!/^[+-]?\d{1,6}$/.test(parts[i])) return { err: name + "中的“" + parts[i] + "”不是整数" };
            v.push(parseInt(parts[i], 10));
          }
          if (o.min && v.length < o.min) return { err: name + "至少需要 " + o.min + " 个" };
          if (o.max && v.length > o.max) return { err: name + "最多 " + o.max + " 个（当前 " + v.length + " 个），考试规模一般 8–15 个" };
          var lo = o.lo == null ? -9999 : o.lo, hi = o.hi == null ? 9999 : o.hi;
          for (i = 0; i < v.length; i++) {
            if (o.nonneg && v[i] < 0) return { err: name + "须为非负整数（出现 " + minus(v[i]) + "）" };
            if (v[i] < lo || v[i] > hi) return { err: name + " " + minus(v[i]) + " 超出范围 " + minus(lo) + " ~ " + hi };
          }
          if (o.noDup) for (i = 0; i < v.length; i++) if (v.indexOf(v[i]) !== i) return { err: name + " " + minus(v[i]) + " 重复出现，请删去重复的" + name };
          return { v: v };
        };

        /* ======================= 散列表 ======================= */
        LABU.HASH_METHODS = [["linear", "线性探测"], ["quad", "平方探测"], ["chain", "拉链法"]];
        /* 失败比较次数的约定：std = 常见约定（开放定址与空位置的比较计 1 次，拉链法空指针不计）；无法识别的值按 std 处理 */
        LABU.HASH_EMPTY = [["std", "常见约定"], ["yes", "空位计 1 次"], ["no", "空位不计"]];
        /* 开放定址第 i 次探测的增量 d_i；返回 null 表示探测序列已用完 */
        function hashInc(meth, i, m) {
          if (meth === "linear") return i < m ? i : null;
          if (i === 0) return 0;
          var j = Math.ceil(i / 2);
          if (j > Math.floor(m / 2)) return null;
          return i % 2 ? j * j : -j * j;
        }
        function incTxt(meth, i, d) {
          if (i === 0) return "d₀ = 0";
          if (meth === "linear") return "d" + i + " = " + i;
          var j = Math.ceil(i / 2);
          return "d" + i + " = " + (d > 0 ? "+" : "−") + j + "²";
        }
        LABU.dsHash = function (o) {
          o = o || {};
          var keys = o.keys || [], p = o.p, m = o.m, meth = o.method || "linear", em = o.empty || "std", n = keys.length, i, j;
          if (["std", "yes", "no"].indexOf(em) < 0) em = "std"; /* 未知或旧版本的选项值一律按常见约定处理 */
          if (["linear", "quad", "chain"].indexOf(meth) < 0) return { err: "未知的冲突处理方法" };
          if (!n) return { err: "请至少输入 1 个关键字" };
          if (n > 15) return { err: "关键字最多 15 个（当前 " + n + " 个）" };
          for (i = 0; i < n; i++) {
            if (typeof keys[i] !== "number" || keys[i] % 1 !== 0 || keys[i] < 0) return { err: "关键字须为非负整数" };
            if (keys.indexOf(keys[i]) !== i) return { err: "关键字 " + keys[i] + " 重复，散列表中同一关键字只存一次" };
          }
          if (typeof p !== "number" || p % 1 !== 0 || p < 1) return { err: "除数 p 须为正整数" };
          if (typeof m !== "number" || m % 1 !== 0 || m < 1) return { err: "表长 m 须为正整数" };
          if (m > 20) return { err: "表长最多 20（当前 " + m + "）" };
          if (p > m) return { err: "p = " + p + " 大于表长 m = " + m + "，H(key) = key % p 会超出表的地址范围；p 应取不大于 m 的最大素数" };
          if (meth !== "chain" && m < n) return { err: "表长 m = " + m + " 小于关键字个数 n = " + n + "，开放定址法放不下所有关键字" };
          var cntEmpty = em === "yes" || (em === "std" && meth !== "chain");
          var frames = [], recs = [], T = fill(m, null), C = [], fail = "";
          for (i = 0; i < m; i++) C.push([]);
          function snap(f) {
            f.T = T.slice(); f.C = C.map(function (c) { return c.slice(); }); f.nrec = recs.length;
            frames.push(f);
          }
          snap({ ki: -1, probes: [], d: "初始：表长 m = " + m + "，散列函数 H(key) = key % " + p + "，冲突处理：" + (meth === "linear" ? "线性探测 dᵢ = 0, 1, 2, …（地址 = (H + dᵢ) % m）" : meth === "quad" ? "平方探测 dᵢ = 0, +1², −1², +2², −2², …（地址 = (H + dᵢ) % m）" : "拉链法（同义词放在同一链表中，本实验尾插）") + "。" });
          for (var ki = 0; ki < n; ki++) {
            var k = keys[ki], h = k % p, rec = { key: k, h: h, probes: [], cmp: 0, pos: -1 };
            if (meth === "chain") {
              var L = C[h].length;
              C[h].push(k); rec.probes = [h]; rec.cmp = L + 1; rec.pos = h; rec.rank = L + 1;
              recs.push(rec);
              snap({ ki: ki, probes: [h], put: h, d: "插入 " + k + "：H(" + k + ") = " + k + " % " + p + " = " + h + "。" + (L ? "链表 " + h + " 已有 " + L + " 个同义词，" + k + " 接在表尾，是第 " + (L + 1) + " 个结点，查找成功需比较 " + (L + 1) + " 次。" : "链表 " + h + " 为空，" + k + " 成为第 1 个结点，比较 1 次。") });
              continue;
            }
            for (i = 0; ; i++) {
              var dd = hashInc(meth, i, m);
              if (dd === null) break;
              var a = ((h + dd) % m + m) % m;
              rec.probes.push(a);
              var head = i === 0 ? "插入 " + k + "：H(" + k + ") = " + k + " % " + p + " = " + h + "。" : "第 " + (i + 1) + " 次探测：" + incTxt(meth, i, dd) + "，地址 (" + h + (dd < 0 ? " − " + (-dd) : " + " + dd) + ") % " + m + " = " + a + "。";
              if (T[a] === null) {
                T[a] = k; rec.pos = a; rec.cmp = rec.probes.length;
                recs.push(rec);
                snap({ ki: ki, probes: rec.probes.slice(), put: a, d: head + "地址 " + a + " 为空，放入 " + k + "，共比较 " + rec.cmp + " 次。" });
                break;
              }
              recs.push(rec);
              snap({ ki: ki, probes: rec.probes.slice(), hit: a, d: head + "地址 " + a + " 已被 " + T[a] + " 占用，冲突，继续探测。" });
              recs.pop();
            }
            if (rec.pos < 0) {
              rec.cmp = rec.probes.length;
              recs.push(rec);
              fail = "平方探测无法为关键字 " + k + " 找到空位置：已探测地址 " + rec.probes.join(", ") + "（k 最大取到 ⌊m/2⌋ = " + Math.floor(m / 2) + "），表中仍有空位但探测不到。平方探测不一定能探测到全部单元，表长取 4j + 3 形式的素数才能保证。";
              snap({ ki: ki, probes: rec.probes.slice(), fail: true, d: fail });
              return { method: meth, p: p, m: m, n: n, fail: fail, recs: recs, table: T, chains: C, frames: frames, cntEmpty: cntEmpty };
            }
          }
          /* 查找成功 */
          var sn = 0, sExpr;
          recs.forEach(function (r) { sn += r.cmp; });
          if (meth === "chain") {
            var byRank = {};
            recs.forEach(function (r) { byRank[r.rank] = (byRank[r.rank] || 0) + 1; });
            sExpr = "(" + Object.keys(byRank).map(function (r) { return r + "×" + byRank[r]; }).join(" + ") + ")/" + n;
          } else sExpr = "(" + recs.map(function (r) { return r.cmp; }).join(" + ") + ")/" + n;
          var succ = LABU.dsFrac(sn, n); succ.expr = sExpr; succ.full = "ASL成功 = " + sExpr + " = " + succ.text;
          /* 查找失败：对 H 的每个取值 0 ~ p−1 */
          var per = [], fn = 0;
          for (var a0 = 0; a0 < p; a0++) {
            var pr = [], cnt = 0, hitE = false;
            if (meth === "chain") {
              cnt = C[a0].length + (cntEmpty ? 1 : 0); hitE = true; pr = C[a0].slice();
            } else {
              for (i = 0; ; i++) {
                var d2 = hashInc(meth, i, m);
                if (d2 === null) break;
                var b = ((a0 + d2) % m + m) % m;
                pr.push(b);
                if (T[b] === null) { hitE = true; break; }
                cnt++;
              }
              if (hitE && cntEmpty) cnt++;
            }
            per.push({ a: a0, probes: pr, cnt: cnt, empty: hitE });
            fn += cnt;
          }
          var fl = LABU.dsFrac(fn, p);
          fl.expr = "(" + per.map(function (x) { return x.cnt; }).join(" + ") + ")/" + p;
          fl.full = "ASL失败 = " + fl.expr + " = " + fl.text;
          fl.rule = meth === "chain" ? (cntEmpty ? "与空指针的比较计 1 次" : "只计与关键字的比较，空指针不计（常见约定）") : (cntEmpty ? "与空位置的比较计 1 次（真题常用）" : "与空位置的比较不计");
          per.forEach(function (x) {
            var why;
            if (meth === "chain") why = "地址 " + x.a + "：链表有 " + (x.probes.length ? x.probes.length + " 个结点（" + x.probes.join(" → ") + "）" : "0 个结点") + "，查找失败要比较 " + x.cnt + " 次" + (cntEmpty ? "（含与空指针的 1 次）" : "") + "。";
            else if (x.empty) why = "地址 " + x.a + " 出发查找失败：依次比较地址 " + x.probes.join(", ") + "，到空位置 " + x.probes[x.probes.length - 1] + " 才确定失败，比较 " + x.cnt + " 次" + (cntEmpty ? "（空位置计 1 次）" : "（空位置不计）") + "。";
            else why = "地址 " + x.a + " 出发：探测序列 " + x.probes.join(", ") + " 用完仍未遇到空位置，比较 " + x.cnt + " 次后失败。";
            frames.push({ ki: n, probes: x.probes, failA: x.a, fail2: true, T: T.slice(), C: C.map(function (c) { return c.slice(); }), nrec: n, nfail: x.a + 1, d: why });
          });
          frames.push({ ki: n, probes: [], end: true, T: T.slice(), C: C.map(function (c) { return c.slice(); }), nrec: n, nfail: p, d: "全部完成。" + succ.full + "；" + fl.full + "（" + fl.rule + "）。" });
          return { method: meth, p: p, m: m, n: n, recs: recs, table: T, chains: C, succ: succ, fail2: fl, per: per, frames: frames, cntEmpty: cntEmpty, total: sn };
        };

        /* ======================= 折半查找 ======================= */
        /* arr 升序；返回 1 起下标的过程 */
        LABU.dsBsearch = function (arr, key) {
          var n = arr.length, low = 1, high = n, steps = [], pos = -1;
          while (low <= high) {
            var mid = Math.floor((low + high) / 2), v = arr[mid - 1], c = key === v ? 0 : key < v ? -1 : 1;
            steps.push({ low: low, high: high, mid: mid, v: v, c: c });
            if (c === 0) { pos = mid; break; }
            if (c < 0) high = mid - 1; else low = mid + 1;
          }
          return { found: pos > 0, pos: pos, cmps: steps.length, steps: steps, low: low, high: high, path: steps.map(function (s) { return s.mid; }) };
        };
        /* 折半查找判定树（mid 向下取整），结点为下标 1..n */
        LABU.dsBsTree = function (n) {
          var nodes = [], ext = [], depth = 0;
          function build(lo, hi, d, par, side) {
            if (lo > hi) { ext.push({ lo: lo, hi: hi, parent: par, side: side, d: d - 1 }); return 0; }
            var mid = Math.floor((lo + hi) / 2), nd = { i: mid, d: d, parent: par, l: 0, r: 0 };
            nodes[mid] = nd; if (d > depth) depth = d;
            nd.l = build(lo, mid - 1, d + 1, mid, "l");
            nd.r = build(mid + 1, hi, d + 1, mid, "r");
            return mid;
          }
          var root = n > 0 ? build(1, n, 1, 0, "") : 0;
          ext.sort(function (a, b) { return a.lo - b.lo; });
          var lv = fill(depth + 1, 0), sn = 0, i;
          for (i = 1; i <= n; i++) { lv[nodes[i].d]++; sn += nodes[i].d; }
          var succ = LABU.dsFrac(sn, n), parts = [];
          for (i = 1; i <= depth; i++) if (lv[i]) parts.push(i + "×" + lv[i]);
          succ.expr = "(" + parts.join(" + ") + ")/" + n; succ.full = "ASL成功 = " + succ.expr + " = " + succ.text;
          var fe = {}, fn = 0;
          ext.forEach(function (e) { fe[e.d] = (fe[e.d] || 0) + 1; fn += e.d; });
          var fl = LABU.dsFrac(fn, n + 1);
          fl.expr = "(" + Object.keys(fe).map(function (d) { return d + "×" + fe[d]; }).join(" + ") + ")/" + (n + 1);
          fl.full = "ASL失败 = " + fl.expr + " = " + fl.text;
          return { root: root, nodes: nodes, ext: ext, depth: depth, levels: lv, succ: succ, fail: fl, h: Math.ceil(Math.log(n + 1) / Math.LN2) };
        };

        /* ======================= 排序补充 ======================= */
        function items(arr) { return arr.map(function (v, i) { return { v: v, id: i }; }); }
        function vals(a) { return a.map(function (x) { return x.v; }); }
        function ids(a) { return a.map(function (x) { return x.id; }); }
        LABU.dsShellIncs = function (n) { var r = []; for (var d = Math.floor(n / 2); d >= 1; d = Math.floor(d / 2)) r.push(d); return r; };
        LABU.dsShell = function (arr, incs) {
          var n = arr.length, i, j;
          if (!incs || !incs.length) incs = LABU.dsShellIncs(n);
          for (i = 0; i < incs.length; i++) {
            if (typeof incs[i] !== "number" || incs[i] % 1 !== 0 || incs[i] < 1) return { err: "增量必须是正整数" };
            if (i && incs[i] >= incs[i - 1]) return { err: "增量序列必须严格递减（如 5, 3, 1）" };
          }
          if (incs[incs.length - 1] !== 1) return { err: "增量序列最后一个必须是 1，否则最后不能保证整体有序" };
          if (n > 1 && incs[0] >= n) return { err: "第一个增量 " + incs[0] + " 不小于元素个数 " + n + "，每组只有 1 个元素，请取小于 n 的增量" };
          var a = items(arr), passes = [], cmps = 0, moves = 0;
          incs.forEach(function (d) {
            var before = a.slice(), pc = 0;
            /* 约定：i 从 d 开始，把 a[i] 插入所在组的有序前缀（各组交替进行） */
            for (i = d; i < n; i++) {
              pc++;
              if (a[i].v < a[i - d].v) {
                var t = a[i];
                for (j = i - d; j >= 0; j -= d) {
                  if (j !== i - d) pc++;
                  if (t.v < a[j].v) { a[j + d] = a[j]; moves++; } else break;
                }
                a[j + d] = t; moves++;
              }
            }
            cmps += pc;
            var groups = [];
            for (var g = 0; g < d && g < n; g++) { var gi = []; for (j = g; j < n; j += d) gi.push(j); groups.push(gi); }
            passes.push({ d: d, groups: groups, before: vals(before), beforeIds: ids(before), after: vals(a), afterIds: ids(a), cmps: pc });
          });
          return { incs: incs, passes: passes, result: vals(a), resultIds: ids(a), cmps: cmps, moves: moves };
        };
        LABU.dsSelect = function (arr) {
          var a = items(arr), n = a.length, passes = [], cmps = 0, swaps = 0;
          for (var i = 0; i < n - 1; i++) {
            var before = a.slice(), mn = i;
            for (var j = i + 1; j < n; j++) { cmps++; if (a[j].v < a[mn].v) mn = j; }
            var sw = mn !== i;
            if (sw) { var t = a[i]; a[i] = a[mn]; a[mn] = t; swaps++; }
            passes.push({ i: i, min: mn, minVal: a[i].v, swapped: sw, before: vals(before), beforeIds: ids(before), after: vals(a), afterIds: ids(a), cmps: n - 1 - i });
          }
          return { passes: passes, result: vals(a), resultIds: ids(a), cmps: cmps, swaps: swaps };
        };
        LABU.dsBinInsert = function (arr) {
          var a = items(arr), n = a.length, passes = [], cmps = 0, moves = 0;
          for (var i = 1; i < n; i++) {
            var before = a.slice(), t = a[i], low = 0, high = i - 1, steps = [];
            while (low <= high) {
              var mid = Math.floor((low + high) / 2), lt = t.v < a[mid].v;
              steps.push({ low: low, high: high, mid: mid, v: a[mid].v, lt: lt });
              cmps++;
              if (lt) high = mid - 1; else low = mid + 1; /* 相等时继续向右找，保证稳定 */
            }
            for (var j = i - 1; j >= low; j--) { a[j + 1] = a[j]; moves++; }
            a[low] = t;
            passes.push({ i: i, key: t.v, keyId: t.id, steps: steps, pos: low, shift: i - low, before: vals(before), beforeIds: ids(before), after: vals(a), afterIds: ids(a) });
          }
          return { passes: passes, result: vals(a), resultIds: ids(a), cmps: cmps, moves: moves };
        };
        LABU.RADIX_NAMES = ["个位", "十位", "百位", "千位", "万位", "十万位"];
        LABU.dsRadix = function (arr) {
          var n = arr.length, i;
          for (i = 0; i < n; i++) if (typeof arr[i] !== "number" || arr[i] < 0 || arr[i] % 1 !== 0) return { err: "基数排序（LSD）只支持非负整数" };
          var mx = 0; for (i = 0; i < n; i++) if (arr[i] > mx) mx = arr[i];
          var D = String(mx).length, a = items(arr), passes = [];
          for (var k = 0, base = 1; k < D; k++, base *= 10) {
            var before = a.slice(), Q = [], dist = [];
            for (i = 0; i < 10; i++) Q.push([]);
            a.forEach(function (x) { var dg = Math.floor(x.v / base) % 10; Q[dg].push(x); dist.push({ v: x.v, id: x.id, q: dg }); });
            a = [].concat.apply([], Q);
            passes.push({ k: k, name: LABU.RADIX_NAMES[k], dist: dist, queues: Q.map(vals), queueIds: Q.map(ids), before: vals(before), beforeIds: ids(before), after: vals(a), afterIds: ids(a) });
          }
          return { d: D, passes: passes, result: vals(a), resultIds: ids(a) };
        };

        /* ======================= 界面公共部分 ======================= */
        function ui(K) {
          K.out.innerHTML = '<div class="x-lab__stats" data-k="st"></div><p class="x-d3-say" data-k="say" aria-live="polite"></p><div data-k="tb"></div><p class="x-d3-tip" data-k="tip"></p>';
          var o = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { o[x.getAttribute("data-k")] = x; });
          return o;
        }
        function br(K) { K.opts.appendChild(X.el("span", { class: "x-lab__br" })); }
        function btnGroup(parent, list, cur, cb, lab) {
          var wrap = X.el("div", { class: "x-d3-grp", role: "group", "aria-label": lab || "选项" });
          if (lab) wrap.appendChild(X.el("span", { class: "x-lab__lbl" }, esc(lab)));
          parent.appendChild(wrap);
          var bs = list.map(function (it) {
            var b = X.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": it[0] === cur ? "true" : "false" }, esc(it[1]));
            b.addEventListener("click", function () { set(it[0]); cb(it[0]); });
            wrap.appendChild(b); return b;
          });
          function set(v) { bs.forEach(function (b, i) { b.setAttribute("aria-pressed", list[i][0] === v ? "true" : "false"); }); }
          return { set: set };
        }
        function field(parent, label, val, attrs, cb, small) {
          var l = X.el("label", { class: "x-lab__lbl x-d3-f" + (small ? " x-d3-f--s" : "") }, esc(label) + " ");
          var a = { type: "text", class: "x-lab__in", value: val, spellcheck: "false", autocomplete: "off" };
          for (var k in attrs || {}) a[k] = attrs[k];
          var i = X.el("input", a); l.appendChild(i); parent.appendChild(l);
          i.addEventListener("change", function () { cb(i.value); });
          i.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); cb(i.value); } });
          return i;
        }
        function presets(K, list) {
          var w = X.el("div", { class: "x-d3-grp x-d3-try", role: "group", "aria-label": "试试" }, '<span class="x-lab__lbl">试试</span>');
          list.forEach(function (p) {
            var b = X.el("button", { type: "button", class: "x-lab__btn x-lab__btn--ghost" }, esc(p[0]));
            b.addEventListener("click", p[1]); w.appendChild(b);
          });
          K.opts.appendChild(w);
        }
        function player(compute, render) {
          var S = { f: [], cur: 0, err: "", r: null };
          function reset() {
            var r;
            try { r = compute(); } catch (e) { r = { err: "计算出错：" + (e && e.message ? e.message : e) }; }
            S.r = r; S.err = r.err || ""; S.f = r.frames || []; S.cur = 0;
            try { render(S); } catch (e2) { S.err = "绘制出错：" + (e2 && e2.message ? e2.message : e2); render(S); }
          }
          function step() {
            if (S.err || S.cur >= S.f.length - 1) return false;
            S.cur++;
            try { render(S); } catch (e) { S.err = "绘制出错：" + (e && e.message ? e.message : e); render(S); return false; }
            return S.cur < S.f.length - 1;
          }
          return { S: S, api: { step: step, reset: reset, done: function () { return !!S.err || S.cur >= S.f.length - 1; } } };
        }
        function showErr(K, o, err) {
          K.stage.innerHTML = ""; o.st.innerHTML = ""; o.tb.innerHTML = ""; o.tip.textContent = "";
          o.say.innerHTML = '<span class="x-lab__err">' + esc(err) + "</span>";
        }
        function newSvg(K, w, h, label) {
          K.stage.innerHTML = "";
          return X.svg("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": label, class: "x-d3-svg" }, K.stage);
        }
        function T(svg, x, y, s, cls, anchor, size) {
          var t = X.svg("text", { x: x, y: y, class: "x-d3-t" + (cls ? " " + cls : ""), "text-anchor": anchor || "middle", "font-size": size || 13 }, svg);
          t.textContent = s; return t;
        }
        function R(svg, x, y, w, h, cls) { return X.svg("rect", { x: x, y: y, width: Math.max(0, w), height: h, rx: 3, class: cls || "x-d3-cell" }, svg); }
        function Ln(svg, x1, y1, x2, y2, cls) { return X.svg("line", { x1: x1, y1: y1, x2: x2, y2: y2, class: cls || "x-d3-ln" }, svg); }
        function tbl(cap, head, rows, cur, cls) {
          var h = '<div class="x-tbl x-d3-tbl' + (cls ? " " + cls : "") + '" tabindex="0"><table>' + (cap ? "<caption>" + cap + "</caption>" : "") + "<thead><tr>" +
            head.map(function (c) { return '<th scope="col">' + c + "</th>"; }).join("") + "</tr></thead><tbody>";
          rows.forEach(function (r, i) { h += "<tr" + (i === cur ? ' class="is-cur"' : "") + ">" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; });
          return h + "</tbody></table></div>";
        }
        function stat(k, v) { return "<span>" + k + " <b>" + v + "</b></span>"; }
        function intOf(s, name, lo, hi) {
          var t = String(s == null ? "" : s).replace(/\s+/g, "");
          if (!/^\d{1,3}$/.test(t)) return { err: name + "须为正整数" };
          var v = parseInt(t, 10);
          if (v < lo || v > hi) return { err: name + "应在 " + lo + " ~ " + hi + " 之间" };
          return { v: v };
        }

        /* ======================= 实验 1：散列表 ======================= */
        LAB.push({
          id: "hash", name: "散列表", color: "var(--x-ds)",
          note: "① 散列函数常用除留余数法 H(key) = key % p，p 取不大于表长 m 的最大素数。② 线性探测会产生“堆积”（聚集），使同义词与非同义词争夺地址；平方探测可减少堆积，但不一定能探测到所有单元，表长须为 4j + 3 形式的素数。③ ASL 成功按每个关键字的比较次数平均；ASL 失败按 H 的取值 0 ~ p−1 平均（不是表长 m），开放定址法比较到空位置为止。④ 本实验默认用常见约定：开放定址法探测到空位置也算 1 次比较（近年真题多按此计），拉链法只数与关键字的比较、空指针不算；也有题目规定不计空位置，这时每条以空位置结束的探测少算 1 次（线性探测时 ASL失败正好小 1），题目写明约定时照题目算。⑤ 开放定址法不能随便物理删除元素（会截断探测序列），只能做删除标记；装填因子 α = n/m 越大，冲突越多，ASL 与 α 有关而与 n 无直接关系。",
          mount: function (panel, K) {
            var keyS = "19, 14, 23, 1, 68, 20, 84, 27, 55, 11, 10, 79", pS = "13", mS = "16", meth = "linear", em = "std";
            var mg = btnGroup(K.opts, LABU.HASH_METHODS, meth, function (v) { meth = v; K.restart(); }, "冲突处理");
            var eg = btnGroup(K.opts, LABU.HASH_EMPTY, em, function (v) { em = v; K.restart(); }, "失败口径");
            br(K);
            var ik = field(K.opts, "关键字", keyS, { inputmode: "numeric", "aria-label": "关键字序列，逗号分隔" }, function (v) { keyS = v; K.restart(); });
            var ip = field(K.opts, "H = key %", pS, { inputmode: "numeric", "aria-label": "除数 p" }, function (v) { pS = v; K.restart(); }, true);
            var im = field(K.opts, "表长 m", mS, { inputmode: "numeric", "aria-label": "表长 m" }, function (v) { mS = v; K.restart(); }, true);
            br(K);
            var CLS = "19, 14, 23, 1, 68, 20, 84, 27, 55, 11, 10, 79";
            presets(K, [["经典例·线性探测", CLS, "13", "16", "linear"], ["同数据·平方探测", CLS, "13", "16", "quad"], ["同数据·拉链法", CLS, "13", "13", "chain"], ["平方探测找不到空位", "0, 5, 10, 15", "5", "5", "quad"]].map(function (p) {
              return [p[0], function () { keyS = p[1]; pS = p[2]; mS = p[3]; meth = p[4]; ik.value = keyS; ip.value = pS; im.value = mS; mg.set(meth); K.restart(); }];
            }));
            var o = ui(K);
            var P = player(function () {
              var a = LABU.dsParseInts(keyS, { name: "关键字", max: 15, nonneg: true, noDup: true, hi: 9999 }); if (a.err) return a;
              var p = intOf(pS, "除数 p ", 1, 20); if (p.err) return p;
              var m = intOf(mS, "表长 m ", 1, 20); if (m.err) return m;
              var r = LABU.dsHash({ keys: a.v, p: p.v, m: m.v, method: meth, empty: em });
              if (r.err) return r;
              r.cmp = LABU.HASH_METHODS.map(function (x) {
                var mm = x[0] === "chain" ? Math.max(m.v, p.v) : m.v;
                return x[0] !== "chain" && mm < a.v.length ? { err: "表长不足" } : LABU.dsHash({ keys: a.v, p: p.v, m: mm, method: x[0], empty: em });
              });
              return r;
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var r = S.r, f = S.f[S.cur], m = r.m, p = r.p, i, chain = r.method === "chain";
              var cw = Math.min(44, Math.floor(680 / m)), x0 = Math.round((720 - cw * m) / 2), cy = 56, ch = 36;
              var maxL = 0; f.C.forEach(function (c) { if (c.length > maxL) maxL = c.length; });
              var H = chain ? cy + ch + 20 + Math.max(1, maxL) * 40 : cy + ch + 46;
              var cur = f.ki >= 0 && f.ki < r.n ? r.recs[f.ki] : null;
              var svg = newSvg(K, 720, H, "散列表，表长 " + m + "：" + (chain ? f.C.map(function (c, j) { return j + ":" + (c.join("→") || "空"); }).join("，") : f.T.map(function (v, j) { return j + ":" + (v === null ? "空" : v); }).join("，")));
              T(svg, 12, 22, cur ? "当前关键字 " + cur.key + "，H(" + cur.key + ") = " + cur.key + " % " + p + " = " + cur.h : f.fail2 ? "查找失败：从地址 " + f.failA + " 出发" : f.end ? "散列表构造完成" : "H(key) = key % " + p + "，表长 " + m, "x-d3-b", "start", 14);
              for (i = 0; i < m; i++) {
                var x = x0 + i * cw, pi = f.probes.indexOf(i), cls = "x-d3-cell";
                if (i >= p) cls += " is-out";
                if (f.fail2 && pi >= 0) cls += pi === f.probes.length - 1 && (chain || f.T[i] === null) ? " is-fail" : " is-range";
                else if (f.put === i) cls += " is-new";
                else if (f.hit === i) cls += " is-hit";
                else if (pi >= 0) cls += " is-probe";
                R(svg, x + 1, cy, cw - 2, ch, cls);
                T(svg, x + cw / 2, cy - 6, String(i), "x-d3-dim x-d3-mono", "middle", 13);
                if (!chain && f.T[i] !== null) T(svg, x + cw / 2, cy + 23, String(f.T[i]), "x-d3-mono", "middle", cw < 36 ? 13 : 14);
                if (chain) T(svg, x + cw / 2, cy + 23, f.C[i].length ? "•" : "^", "x-d3-dim", "middle", 14);
                if (!chain && pi >= 0 && !f.fail2) T(svg, x + cw / 2, cy + ch + 18, String(pi + 1), "x-d3-p", "middle", 13);
              }
              if (!chain && f.fail2) {
                for (i = 0; i < f.probes.length; i++) T(svg, x0 + f.probes[i] * cw + cw / 2, cy + ch + 18, String(i + 1), "x-d3-p", "middle", 13);
              }
              if (!chain) T(svg, 708, cy + ch + 38, (f.fail2 ? "数字 = 失败查找的比较顺序" : "数字 = 第几次探测") + (p < m ? "；灰色地址 ≥ p，不会是散列地址" : ""), "x-d3-dim", "end", 13);
              if (chain) {
                for (i = 0; i < m; i++) {
                  var cx = x0 + i * cw + cw / 2, c = f.C[i];
                  for (var j = 0; j < c.length; j++) {
                    var ny = cy + ch + 14 + j * 40;
                    Ln(svg, cx, ny - 14, cx, ny, "x-d3-ln");
                    var isNew = f.put === i && j === c.length - 1 && !f.fail2;
                    R(svg, x0 + i * cw + 3, ny, cw - 6, 26, "x-d3-cell" + (isNew ? " is-new" : f.fail2 && f.failA === i ? " is-range" : ""));
                    T(svg, cx, ny + 18, String(c[j]), "x-d3-mono", "middle", 13);
                  }
                }
              }
              /* 统计与表格 */
              var nrec = f.nrec, done = r.recs.slice(0, nrec), tot = 0;
              done.forEach(function (x, j) { if (x.pos >= 0 && (j !== f.ki || f.put != null || chain)) tot += x.cmp; });
              o.st.innerHTML = stat("已插入", done.filter(function (x, j) { return x.pos >= 0 && (j !== f.ki || f.put != null); }).length + " / " + r.n) + stat("比较次数之和", tot) + stat("装填因子 α", r.n + "/" + m + " ≈ " + round2(r.n / m)) + (f.end ? stat("ASL成功", round2(r.succ.val)) + stat("ASL失败", round2(r.fail2.val)) : "");
              o.say.innerHTML = f.fail ? '<span class="x-lab__err">' + esc(f.d) + "</span>" : esc(f.d);
              var rows = done.map(function (x, j) {
                var live = j === f.ki && !chain, pr = live ? f.probes : x.probes, res;
                if (live && f.fail) res = '<span class="is-bad">无法放入</span>';
                else if (live && f.put == null) res = "…";
                else res = live ? String(pr.length) : String(x.cmp);
                return ['<span class="x-d3-mono">' + x.key + "</span>", String(x.h), '<span class="x-d3-mono">' + (chain ? "链表 " + x.h + " 第 " + x.rank + " 个" : pr.join(" → ")) + "</span>", res];
              });
              var h = tbl("插入过程（每个关键字的探测序列与比较次数）", ["关键字", "H(key)", chain ? "位置" : "探测地址序列", "比较次数"], rows, f.ki < r.n ? nrec - 1 : -1, "x-d3-wrap");
              if (f.nfail) {
                h += tbl("查找失败（H 的取值 0 ~ " + (p - 1) + "，口径：" + r.fail2.rule + "）", ["地址", chain ? "链表结点" : "比较到空位置的地址序列", "比较次数"], r.per.slice(0, f.nfail).map(function (x) {
                  return [String(x.a), '<span class="x-d3-mono">' + (x.probes.join(chain ? " → " : ", ") || "（空链）") + "</span>", String(x.cnt)];
                }), f.fail2 ? f.nfail - 1 : -1, "x-d3-wrap");
              }
              if (f.end) {
                h += '<p class="x-d3-asl">' + esc(r.succ.full) + "<br>" + esc(r.fail2.full) + "</p>";
                h += tbl("同一组数据三种方法对比（按当前失败口径）", ["方法", "ASL成功", "ASL失败"], r.cmp.map(function (c, j) {
                  return [LABU.HASH_METHODS[j][1] + (LABU.HASH_METHODS[j][0] === "chain" && c.m !== m ? "（" + c.m + " 个链表）" : ""), c.err || c.fail ? '<span class="is-bad">' + (c.err || "无法全部放入") + "</span>" : esc(c.succ.text), c.err || c.fail ? "—" : esc(c.fail2.text)];
                }), LABU.HASH_METHODS.map(function (x) { return x[0]; }).indexOf(r.method));
              }
              o.tb.innerHTML = h;
              o.tip.textContent = "ASL失败按散列函数可能取到的地址 0 ~ p−1 共 " + p + " 个计算。当前口径：" + (r.method === "chain" ? (r.cntEmpty ? "空指针计 1 次" : "空指针不计（常见约定）") : (r.cntEmpty ? "与空位置的比较计 1 次（真题常用）" : "与空位置的比较不计（另一种约定）")) + "；切换“失败口径”可对比，两种口径结果相差 1。";
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 2：折半查找与判定树 ======================= */
        LAB.push({
          id: "bsearch", name: "折半查找与判定树", color: "var(--x-ds)",
          note: "① 折半查找只适用于有序的顺序表（不能用于链表），mid = ⌊(low + high)/2⌋。② 判定树是平衡的二叉排序树，n 个结点的树高 h = ⌈log₂(n + 1)⌉，查找成功和失败的比较次数都不超过 h。③ 判定树中任一结点左右子树的结点数之差不超过 1；mid 向下取整时右子树结点数 ≥ 左子树（向上取整则相反），选择题常据此判断某棵树能否是判定树。④ ASL成功 = Σ(层号 × 该层结点数)/n；失败结点（方框）共 n + 1 个，比较次数等于其父结点的层号。⑤ 时间复杂度 O(log₂n)。",
          mount: function (panel, K) {
            var arrS = "5, 13, 19, 21, 37, 56, 64, 75, 80, 88, 92", keyS = "21";
            var ia = field(K.opts, "有序表", arrS, { inputmode: "numeric", "aria-label": "有序表，逗号分隔" }, function (v) { arrS = v; K.restart(); });
            var ik = field(K.opts, "查找", keyS, { inputmode: "numeric", "aria-label": "要查找的关键字" }, function (v) { keyS = v; K.restart(); }, true);
            br(K);
            presets(K, [["经典示例：查 21", "5, 13, 19, 21, 37, 56, 64, 75, 80, 88, 92", "21"], ["同表：查 85（失败）", "5, 13, 19, 21, 37, 56, 64, 75, 80, 88, 92", "85"], ["15 个元素·满二叉树", "3, 8, 12, 17, 24, 30, 36, 41, 47, 52, 58, 63, 69, 75, 80", "52"], ["无序输入（自动排序）", "48, 9, 33, 71, 15, 62, 27", "15"]].map(function (p) {
              return [p[0], function () { arrS = p[1]; keyS = p[2]; ia.value = arrS; ik.value = keyS; K.restart(); }];
            }));
            var o = ui(K);
            var P = player(function () {
              var a = LABU.dsParseInts(arrS, { name: "有序表元素", max: 15, noDup: true }); if (a.err) return a;
              var kk = LABU.dsParseInts(keyS, { name: "查找关键字", max: 1 }); if (kk.err) return kk;
              var arr = a.v.slice(), key = kk.v[0], sorted = true, i;
              for (i = 1; i < arr.length; i++) if (arr[i] < arr[i - 1]) sorted = false;
              if (!sorted) arr.sort(function (x, y) { return x - y; });
              var s = LABU.dsBsearch(arr, key), t = LABU.dsBsTree(arr.length), n = arr.length;
              var fr = [{ low: 1, high: n, mid: 0, path: [], d: (sorted ? "" : "输入不是升序，折半查找要求有序表，已自动排序为：" + arr.join(", ") + "。") + "初始 low = 1，high = " + n + "，查找 " + key + "。" }];
              s.steps.forEach(function (st, k) {
                var path = s.path.slice(0, k + 1);
                fr.push({ low: st.low, high: st.high, mid: st.mid, path: path, cur: st.mid, d: "第 " + (k + 1) + " 次：mid = ⌊(" + st.low + " + " + st.high + ")/2⌋ = " + st.mid + "，取出 A[" + st.mid + "] = " + st.v + "。" });
                var nl = st.c > 0 ? st.mid + 1 : st.low, nh = st.c < 0 ? st.mid - 1 : st.high;
                var d = "比较 " + key + " 与 " + st.v + "：" + (st.c === 0 ? key + " = " + st.v + "，查找成功，位置 " + st.mid + "，共比较 " + (k + 1) + " 次。" :
                  st.c < 0 ? key + " < " + st.v + "，在左半部分继续，high = mid − 1 = " + nh + "，进入判定树左子树。" : key + " > " + st.v + "，在右半部分继续，low = mid + 1 = " + nl + "，进入判定树右子树。");
                if (st.c !== 0 && nl > nh) d += "此时 low = " + nl + " > high = " + nh + "，查找失败，共比较 " + (k + 1) + " 次，落在失败结点 (" + (nh >= 1 ? arr[nh - 1] : "−∞") + ", " + (nl <= n ? arr[nl - 1] : "+∞") + ")。";
                fr.push({ low: st.c === 0 ? st.low : nl, high: st.c === 0 ? st.high : nh, mid: st.mid, path: path, cur: st.mid, found: st.c === 0, failed: st.c !== 0 && nl > nh, d: d });
              });
              fr.push({ low: s.found ? 0 : s.low, high: s.found ? 0 : s.high, mid: s.found ? s.pos : 0, path: s.path, end: true, found: s.found, failed: !s.found, d: (s.found ? "查找 " + key + " 成功，比较 " + s.cmps + " 次（= 它在判定树中的层号）。" : "查找 " + key + " 失败，比较 " + s.cmps + " 次（= 失败结点父结点的层号）。") + t.succ.full + "；" + t.fail.full + "。" });
              return { arr: arr, key: key, s: s, t: t, sorted: sorted, frames: fr };
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var r = S.r, f = S.f[S.cur], arr = r.arr, n = arr.length, t = r.t, i;
              var cw = Math.min(44, Math.floor(680 / n)), x0 = Math.round((720 - cw * n) / 2), ay = 40, ty = 176, gap = 58;
              var H = ty + (t.depth) * gap + 16;
              var svg = newSvg(K, 720, H, "有序表与折半查找判定树，查找路径：" + f.path.map(function (m) { return arr[m - 1]; }).join(" → "));
              function cxOf(k) { return x0 + (k - 0.5) * cw; }
              var active = !f.end && f.low >= 1 && f.low <= f.high;
              for (i = 1; i <= n; i++) {
                var cls = "x-d3-cell";
                if (i === f.mid && (f.found || !f.end)) cls += f.found ? " is-new" : " is-probe";
                else if (!f.end && S.cur > 0 && (i < f.low || i > f.high)) cls += " is-out";
                else if (active && i >= f.low && i <= f.high) cls += " is-range";
                R(svg, x0 + (i - 1) * cw + 1, ay, cw - 2, 34, cls);
                T(svg, cxOf(i), ay - 6, String(i), "x-d3-dim x-d3-mono", "middle", 13);
                T(svg, cxOf(i), ay + 22, String(arr[i - 1]), "x-d3-mono", "middle", 13);
              }
              if (!f.end) {
                var lab = [["low", f.low, 92], ["mid", f.mid, 110], ["high", f.high, 128]];
                lab.forEach(function (L) {
                  var k = L[1];
                  if (!k && L[0] === "mid") return;
                  var x = k < 1 ? x0 - 18 : k > n ? x0 + n * cw + 18 : cxOf(k);
                  T(svg, x, L[2], L[0] + (k < 1 || k > n ? "=" + k : ""), L[0] === "mid" ? "x-d3-p" : "x-d3-dim", "middle", 13);
                });
              }
              T(svg, 12, 156, "判定树（mid 向下取整，方框为失败结点）", "x-d3-dim", "start", 13);
              /* 判定树：结点 i 画在数组第 i 格正下方 */
              var path = f.path, R0 = Math.min(17, Math.floor(cw / 2) - 3);
              function ny(d) { return ty + (d - 1) * gap; }
              for (i = 1; i <= n; i++) {
                var nd = t.nodes[i];
                [nd.l, nd.r].forEach(function (c) {
                  if (!c) return;
                  var on = path.indexOf(i) >= 0 && path.indexOf(c) >= 0;
                  Ln(svg, cxOf(i), ny(nd.d), cxOf(c), ny(nd.d + 1), "x-d3-edge" + (on ? " is-on" : ""));
                });
              }
              var failEnd = f.failed ? (f.low - 1) : -1;
              t.ext.forEach(function (e) {
                var ex = x0 + (e.lo - 1) * cw, ey = ny(e.d + 1) - 2, par = e.parent;
                var on = failEnd >= 0 && e.hi === failEnd && path.indexOf(par) >= 0 && par === path[path.length - 1];
                Ln(svg, cxOf(par), ny(e.d), ex, ey - 4, "x-d3-edge x-d3-edge--e" + (on ? " is-on" : ""));
                R(svg, ex - 4.5, ey - 4.5, 9, 9, "x-d3-ext" + (on ? " is-fail" : ""));
              });
              for (i = 1; i <= n; i++) {
                var nd2 = t.nodes[i], pi = path.indexOf(i), c2 = "x-d3-node";
                if (pi >= 0) c2 += i === f.cur || (f.end && pi === path.length - 1) ? (f.found && pi === path.length - 1 ? " is-new" : " is-cur") : " is-on";
                X.svg("circle", { cx: cxOf(i), cy: ny(nd2.d), r: R0, class: c2 }, svg);
                T(svg, cxOf(i), ny(nd2.d) + 4.5, String(arr[i - 1]), "x-d3-mono", "middle", 13);
              }
              o.st.innerHTML = stat("n", n) + stat("比较次数", f.path.length) + stat("树高 ⌈log₂(n+1)⌉", t.h) + stat("ASL成功", round2(t.succ.val)) + stat("ASL失败", round2(t.fail.val));
              o.say.textContent = f.d;
              var rows = r.s.steps.slice(0, Math.floor(S.cur / 2)).map(function (st, k) {
                return [String(k + 1), String(st.low), String(st.high), String(st.mid), r.key + (st.c === 0 ? " = " : st.c < 0 ? " < " : " > ") + st.v, st.c === 0 ? '<span class="is-ok">成功</span>' : st.c < 0 ? "high = " + (st.mid - 1) : "low = " + (st.mid + 1)];
              });
              var lv = [];
              for (i = 1; i <= t.depth; i++) lv.push(["第 " + i + " 层", String(t.levels[i]), String(i * t.levels[i])]);
              o.tb.innerHTML = tbl("查找过程", ["次数", "low", "high", "mid", "比较", "结果"], rows, rows.length - 1) +
                tbl("判定树各层（ASL成功）", ["层", "结点数", "层号 × 结点数"], lv, -1) +
                '<p class="x-d3-asl">' + esc(t.succ.full) + "<br>" + esc(t.fail.full) + "</p>";
              o.tip.textContent = (r.sorted ? "" : "注意：输入已自动排序。") + "失败结点的比较次数按其父结点层号计（不把方框本身算一次），这是最常见的约定；若题目另有规定，以题目为准。";
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 3：排序补充 ======================= */
        var SORT2 = [
          ["shell", "希尔", false, "希尔排序：不稳定；时间复杂度依赖增量序列，约 O(n^1.3)，最坏 O(n²)；空间 O(1)；只适用于顺序表。"],
          ["select", "简单选择", false, "简单选择排序：不稳定（交换会跨过相等元素）；比较次数恒为 n(n−1)/2，与初始序列无关，时间 O(n²)；移动次数最多 3(n−1)；空间 O(1)；每趟确定一个元素的最终位置。"],
          ["bins", "折半插入", true, "折半插入排序：稳定（相等时继续向右找插入位置）；比较次数降为 O(n log₂n) 且与初始序列无关，但移动次数不变，时间仍为 O(n²)；空间 O(1)；只适用于顺序表。"],
          ["radix", "基数排序", true, "基数排序（LSD）：稳定（每趟分配收集必须稳定）；d 趟，每趟分配 O(n)、收集 O(r)，时间 O(d(n + r))；空间 O(r)（r 个队列）；不基于比较，不能用于任意关键字。"]
        ];
        LAB.push({
          id: "sort2", name: "排序补充（希尔/选择/折半插入/基数）", color: "var(--x-ds)",
          note: "① 选择题常问“第 i 趟后的序列”：简单选择每趟定一个最小值到前面；希尔每趟后各组内有序；折半插入每趟后前缀有序但元素不一定在最终位置；基数排序第 i 趟后按低 i 位有序。② 稳定性：折半插入、基数稳定；希尔、简单选择不稳定（带 * 的是相等关键字中后出现的，观察它们的相对次序）。③ 比较次数与初始序列无关的：简单选择、折半插入（比较部分）；基数排序不比较关键字。④ 空间：希尔、选择、折半插入 O(1)，基数 O(r)。⑤ 希尔增量最后一个必须是 1；本实验默认增量 d₁ = ⌊n/2⌋，之后逐次减半。",
          mount: function (panel, K) {
            var DEF = "49, 38, 65, 97, 76, 13, 27, 49, 55, 4", RDX = "278, 109, 63, 930, 589, 184, 505, 269, 8, 83";
            var alg = "shell", arrS = DEF, incS = "";
            var ag = btnGroup(K.opts, SORT2.map(function (s) { return [s[0], s[1]]; }), alg, function (v) { alg = v; K.restart(); }, "算法");
            br(K);
            var ia = field(K.opts, "序列", arrS, { inputmode: "numeric", "aria-label": "待排序序列，逗号分隔" }, function (v) { arrS = v; K.restart(); });
            var ii = field(K.opts, "希尔增量", incS, { inputmode: "numeric", placeholder: "默认 n/2 减半", "aria-label": "希尔增量序列，如 5, 3, 1，留空为 n/2 逐次减半" }, function (v) { incS = v; K.restart(); }, true);
            br(K);
            presets(K, [["经典示例·希尔", DEF, "shell", ""], ["经典示例·增量 5,3,1", DEF, "shell", "5, 3, 1"], ["选择不稳定", "5, 8, 5, 2, 9", "select", ""], ["折半插入", "20, 30, 10, 30, 50, 40, 10", "bins", ""], ["基数排序经典例", RDX, "radix", ""]].map(function (p) {
              return [p[0], function () { arrS = p[1]; alg = p[2]; incS = p[3]; ia.value = arrS; ii.value = incS; ag.set(alg); K.restart(); }];
            }));
            var o = ui(K);
            function labels(arr) {
              var seen = {};
              return arr.map(function (v) { seen[v] = (seen[v] || 0) + 1; var s = ""; for (var k = 1; k < seen[v]; k++) s += "*"; return s; });
            }
            var P = player(function () {
              var a = LABU.dsParseInts(arrS, { name: "待排序元素", min: 2, max: 15, nonneg: alg === "radix" }); if (a.err) return a;
              var arr = a.v, n = arr.length, star = labels(arr), r, fr = [], log = [];
              var W = alg === "radix" ? String(Math.max.apply(null, arr)).length : 0;
              function lab(id) { var v = arr[id], s = String(v); if (W) while (s.length < W) s = "0" + s; return s + star[id]; }
              function seq(idsA) { return idsA.map(lab).join(" "); }
              function F(o2) { o2.log = log.slice(); fr.push(o2); return o2; }
              var init = arr.map(function (_, k) { return k; });
              F({ a: init, d: "初始序列：" + seq(init) + "。" + (star.join("") ? "带 * 的是与前面某个元素相等、但后出现的关键字，用来观察稳定性。" : "") });
              if (alg === "shell") {
                var incs = null;
                if (String(incS).replace(/\s+/g, "")) { var ic = LABU.dsParseInts(incS, { name: "增量", max: 8, lo: 1, hi: 99 }); if (ic.err) return ic; incs = ic.v; }
                r = LABU.dsShell(arr, incs); if (r.err) return r;
                r.passes.forEach(function (ps, pi) {
                  var grp = [], cur = ps.beforeIds.slice();
                  ps.groups.forEach(function (g, gi) { g.forEach(function (x) { grp[x] = gi; }); });
                  F({ a: cur.slice(), grp: grp, d: "第 " + (pi + 1) + " 趟：增量 d = " + ps.d + "，相距 " + ps.d + " 的元素为一组，共 " + ps.groups.length + " 组：" + ps.groups.map(function (g) { return "{" + g.map(function (x) { return lab(cur[x]); }).join(", ") + "}"; }).join(" ") + "。" });
                  ps.groups.forEach(function (g, gi) {
                    if (g.length < 2) return;
                    var bf = g.map(function (x) { return cur[x]; }), sorted = bf.slice();
                    for (var u = 1; u < sorted.length; u++) { var tt = sorted[u], w = u - 1; while (w >= 0 && arr[sorted[w]] > arr[tt]) { sorted[w + 1] = sorted[w]; w--; } sorted[w + 1] = tt; }
                    g.forEach(function (x, k) { cur[x] = sorted[k]; });
                    var ch = bf.join() !== sorted.join();
                    F({ a: cur.slice(), grp: grp, hg: gi, hl: g, d: "第 " + (gi + 1) + " 组（位置 " + g.map(function (x) { return x + 1; }).join(", ") + "）组内直接插入排序：" + bf.map(lab).join(" ") + (ch ? " → " + sorted.map(lab).join(" ") : "，已有序，不变") + "。" });
                  });
                  log.push(["第 " + (pi + 1) + " 趟（d = " + ps.d + "）", seq(ps.afterIds)]);
                  F({ a: ps.afterIds.slice(), pass: true, d: "第 " + (pi + 1) + " 趟后：" + seq(ps.afterIds) + "（与按增量 " + ps.d + " 分组直接插入的结果相同；本趟比较 " + ps.cmps + " 次）。" });
                });
              } else if (alg === "select") {
                r = LABU.dsSelect(arr);
                r.passes.forEach(function (ps, pi) {
                  var b = ps.beforeIds, sortedTo = ps.i;
                  F({ a: b.slice(), done: sortedTo, range: [ps.i, n - 1], min: ps.min, cur: ps.i, d: "第 " + (pi + 1) + " 趟：在位置 " + (ps.i + 1) + " ~ " + n + " 中比较 " + ps.cmps + " 次，选出最小值 " + lab(b[ps.min]) + "（位置 " + (ps.min + 1) + "）。" });
                  log.push(["第 " + (pi + 1) + " 趟", seq(ps.afterIds)]);
                  F({ a: ps.afterIds.slice(), done: ps.i + 1, swap: ps.swapped ? [ps.i, ps.min] : null, pass: true, d: (ps.swapped ? "交换位置 " + (ps.i + 1) + " 与 " + (ps.min + 1) + "：" + lab(b[ps.min]) + " 归位。" : "最小值已在位置 " + (ps.i + 1) + "，不交换。") + "第 " + (pi + 1) + " 趟后：" + seq(ps.afterIds) + "。" });
                });
              } else if (alg === "bins") {
                r = LABU.dsBinInsert(arr);
                r.passes.forEach(function (ps, pi) {
                  var b = ps.beforeIds;
                  F({ a: b.slice(), done: ps.i, cur: ps.i, sortedPre: ps.i, d: "第 " + (pi + 1) + " 趟：把 A[" + (ps.i + 1) + "] = " + lab(ps.keyId) + " 插入有序区 A[1.." + ps.i + "]，先折半查找插入位置。" });
                  ps.steps.forEach(function (st) {
                    F({ a: b.slice(), cur: ps.i, sortedPre: ps.i, ptr: { low: st.low, mid: st.mid, high: st.high }, mid: st.mid, d: "low = " + (st.low + 1) + "，high = " + (st.high + 1) + "，mid = " + (st.mid + 1) + "：" + lab(ps.keyId) + (st.lt ? " < " : " ≥ ") + lab(b[st.mid]) + (st.lt ? "，high = mid − 1 = " + st.mid : "，low = mid + 1 = " + (st.mid + 2) + (arr[ps.keyId] === st.v ? "（相等时向右找，保证稳定）" : "")) + "。" });
                  });
                  log.push(["第 " + (pi + 1) + " 趟", seq(ps.afterIds)]);
                  F({ a: ps.afterIds.slice(), sortedPre: ps.i + 1, ins: ps.pos, pass: true, d: "low > high，插入位置为 low = " + (ps.pos + 1) + "，" + (ps.shift ? "A[" + (ps.pos + 1) + ".." + ps.i + "] 共 " + ps.shift + " 个元素后移一位，" : "无需移动，") + "放入 " + lab(ps.keyId) + "。第 " + (pi + 1) + " 趟后：" + seq(ps.afterIds) + "。" });
                });
              } else {
                r = LABU.dsRadix(arr); if (r.err) return r;
                r.passes.forEach(function (ps, pi) {
                  var Q = [], k; for (k = 0; k < 10; k++) Q.push([]);
                  F({ a: ps.beforeIds.slice(), q: Q.map(function (x) { return x.slice(); }), sent: 0, d: "第 " + (pi + 1) + " 趟：按" + ps.name + "分配。从左到右扫描序列，按" + ps.name + "数字放入队列 Q0 ~ Q9 的队尾。" });
                  ps.dist.forEach(function (x, j) {
                    Q[x.q].push(x.id);
                    F({ a: ps.beforeIds.slice(), q: Q.map(function (y) { return y.slice(); }), sent: j + 1, hq: x.q, last: x.id, d: lab(x.id) + " 的" + ps.name + "是 " + x.q + "，进入队列 Q" + x.q + "。" });
                  });
                  log.push(["第 " + (pi + 1) + " 趟（" + ps.name + "）", seq(ps.afterIds)]);
                  F({ a: ps.afterIds.slice(), q: Q.map(function (y) { return y.slice(); }), coll: true, pass: true, d: "收集：按 Q0 → Q9 依次把各队列从队头到队尾接起来。第 " + (pi + 1) + " 趟后：" + seq(ps.afterIds) + "（按低 " + (pi + 1) + " 位有序）。" });
                });
              }
              fr.push({ a: r.resultIds.slice(), end: true, log: log.slice(), d: "排序完成：" + seq(r.resultIds) + "。" + (alg === "radix" ? "共 " + r.d + " 趟分配与收集。" : "共比较 " + r.cmps + " 次。") });
              return { arr: arr, lab: lab, r: r, frames: fr };
            }, render);
            var GN = 6;
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var r = S.r, f = S.f[S.cur], arr = r.arr, n = arr.length, info = SORT2.filter(function (s) { return s[0] === alg; })[0], i;
              var cw = Math.min(46, Math.floor(680 / n)), x0 = Math.round((720 - cw * n) / 2), ay = 40, ch = 38;
              var maxQ = 0; if (f.q) f.q.forEach(function (x) { if (x.length > maxQ) maxQ = x.length; });
              var H = f.q ? 152 + Math.max(1, maxQ) * 28 + 10 : 150;
              var svg = newSvg(K, 720, H, "当前序列：" + f.a.map(r.lab).join(" "));
              var sentSet = {};
              if (f.q && !f.coll) for (i = 0; i < f.sent; i++) sentSet[i] = 1;
              for (i = 0; i < n; i++) {
                var id = f.a[i], cls = "x-d3-cell";
                if (f.end) cls += " is-done";
                else if (f.grp && f.grp[i] != null) { cls += " x-d3-g" + (f.grp[i] % GN); if (f.hl && f.hl.indexOf(i) < 0) cls += " is-faded"; }
                else if (alg === "select") {
                  if (i < f.done) cls += " is-done";
                  else if (f.swap && (i === f.swap[0] || i === f.swap[1])) cls += " is-new";
                  else if (i === f.min) cls += " is-hit";
                  else if (f.range && i >= f.range[0]) cls += " is-range";
                } else if (alg === "bins") {
                  if (i === f.ins) cls += " is-new";
                  else if (i === f.cur) cls += " is-hit";
                  else if (f.ptr && i === f.mid) cls += " is-probe";
                  else if (f.ptr && (i < f.ptr.low || i > f.ptr.high) && i < f.sortedPre) cls += " is-out";
                  else if (i < f.sortedPre) cls += " is-range";
                } else if (alg === "radix") {
                  if (sentSet[i]) cls += " is-out";
                  else if (f.coll) cls += " is-new";
                }
                R(svg, x0 + i * cw + 1, ay, cw - 2, ch, cls);
                T(svg, x0 + i * cw + cw / 2, ay - 6, String(i + 1), "x-d3-dim x-d3-mono", "middle", 13);
                T(svg, x0 + i * cw + cw / 2, ay + 24, r.lab(id), "x-d3-mono" + (/\*/.test(r.lab(id)) ? " x-d3-b" : ""), "middle", 13);
              }
              if (f.grp) {
                for (i = 0; i < n; i++) if (f.grp[i] != null) T(svg, x0 + i * cw + cw / 2, ay + ch + 18, "组" + (f.grp[i] + 1), "x-d3-dim", "middle", 13);
              }
              if (f.ptr) {
                [["low", f.ptr.low, 98], ["mid", f.ptr.mid, 114], ["high", f.ptr.high, 130]].forEach(function (L) {
                  var k = L[1], x = k < 0 ? x0 - 16 : x0 + k * cw + cw / 2;
                  T(svg, x, L[2], L[0], L[0] === "mid" ? "x-d3-p" : "x-d3-dim", "middle", 13);
                });
              }
              if (alg === "select" && f.range && !f.end) T(svg, x0 + f.min * cw + cw / 2, ay + ch + 18, "最小", "x-d3-p", "middle", 13);
              if (alg === "bins" && !f.ptr && f.cur != null && !f.end) T(svg, x0 + f.cur * cw + cw / 2, ay + ch + 18, "待插入", "x-d3-p", "middle", 13);
              if (f.q) {
                var qw = 68, qx0 = 20, qy = 132;
                for (var q = 0; q < 10; q++) {
                  var qx = qx0 + q * qw;
                  T(svg, qx + qw / 2, qy - 6, "Q" + q, q === f.hq ? "x-d3-p" : "x-d3-dim", "middle", 13);
                  Ln(svg, qx + 4, qy, qx + qw - 4, qy, "x-d3-ln");
                  f.q[q].forEach(function (qid, j) {
                    var isLast = qid === f.last && q === f.hq;
                    R(svg, qx + 6, qy + 4 + j * 28, qw - 12, 24, "x-d3-cell" + (isLast ? " is-new" : f.coll ? " is-range" : ""));
                    T(svg, qx + qw / 2, qy + 21 + j * 28, r.lab(qid), "x-d3-mono", "middle", 13);
                  });
                }
              }
              var passNo = f.log.length;
              o.st.innerHTML = stat("n", n) + stat("已完成趟数", passNo) + (alg === "radix" ? stat("趟数 d", r.r.d) : stat("比较次数（全部）", r.r.cmps)) +
                '<span class="x-lab__badge' + (info[2] ? "" : " is-bad") + '">' + (info[2] ? "稳定" : "不稳定") + "</span>";
              o.say.textContent = f.d;
              o.tb.innerHTML = tbl("每趟结束后的序列（选择题问法：第 i 趟后）", ["趟次", "序列"], f.log.map(function (x) { return [x[0], '<span class="x-d3-mono">' + esc(x[1]) + "</span>"]; }), f.pass ? passNo - 1 : -1, "x-d3-wrap");
              o.tip.textContent = info[3];
            }
            P.api.reset();
            return P.api;
          }
        });
      })();
