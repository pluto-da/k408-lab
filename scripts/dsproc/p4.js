
        /* ===================== 6. 堆的插入与删除（小根堆） ===================== */
        /* 比较次数口径：下沉时有两个孩子先比较两个孩子（1 次），再与较小者比较（1 次）；只有左孩子时只比 1 次；上浮每层 1 次 */
        DS.buildHeap = function (a) {
          var A = [null].concat(a), n = a.length, cmp = 0;
          for (var i = n >> 1; i >= 1; i--) cmp += sink(A, i, n);
          return { heap: A.slice(1), cmp: cmp };
        };
        function sink(A, k, n) {
          var c = 0;
          while (2 * k <= n) {
            var j = 2 * k;
            if (j < n) { c++; if (A[j + 1] < A[j]) j++; }
            c++;
            if (A[j] < A[k]) { var t = A[j]; A[j] = A[k]; A[k] = t; k = j; } else break;
          }
          return c;
        }
        DS.isMinHeap = function (h) { for (var i = 2; i <= h.length; i++) if (h[i - 1] < h[(i >> 1) - 1]) return false; return true; };
        function heapSpec(mode, inp) {
          var data = nums(inp.heap == null ? "53 17 78 9 45 65 87 32" : inp.heap, 2, 10, "关键字序列");
          var key = mode === "ins" ? nums(inp.hkey == null ? "13" : inp.hkey, 1, 1, "插入的关键字")[0] : null;
          var A = [null].concat(mode === "build" ? data : DS.buildHeap(data).heap), n = data.length, cmp = 0;
          var m = mode === "ins" ? n + 1 : n;
          var nodes = [], edges = [], S = [];
          for (var i = 1; i <= m; i++) {
            var d = Math.floor(Math.log(i) / Math.LN2), j = i - (1 << d), cx = 20 + (j + 0.5) * 940 / (1 << d);
            nodes.push({ id: "h" + i, k: "box", x: Math.round(cx - 32), y: 40 + d * 90, w: 64, h: 46, t: "[" + i + "]", v: " " });
            if (i > 1) edges.push({ id: "e" + i, a: "h" + (i >> 1), as: "b", ao: i % 2 ? 12 : -12, b: "h" + i, bs: "t" });
          }
          nodes.push({ id: "ARR", k: "fields", unit: 1, x: 20, y: 430, w: 64 * m, h: 56, t: "数组 A[1.." + m + "]（下标从 1 开始，A[i] 的孩子是 A[2i]、A[2i+1]，双亲是 A[⌊i/2⌋]）", segs: [] });
          var size = n;
          function snap(mark, onIdx) {
            var o = {}, segs = [];
            for (var i = 1; i <= m; i++) {
              var has = i <= size && A[i] != null;
              o["h" + i] = { v: has ? String(A[i]) : " ", badge: (mark && mark[i]) || "" };
              segs.push({ t: String(i), v: has ? String(A[i]) : "", w: 1, on: !!(onIdx && onIdx.indexOf(i) >= 0) });
            }
            o.ARR = { segs: segs };
            return o;
          }
          function push(t, d, on, go, mark, tip, extraKv) {
            var idx = on.map(function (x) { return Number(x.slice(1)); });
            var kv = { "比较次数": String(cmp), "n": String(size) };
            each(extraKv || {}, function (k, v) { kv[k] = v; });
            var s = { t: t, d: d, on: on, set: snap(mark, idx), kv: kv };
            if (go && go.length) s.go = go;
            if (tip) s.tip = tip;
            S.push(s);
          }
          function down(k, label) {
            while (2 * k <= size) {
              var l = 2 * k, r = l + 1, c = l, why;
              if (r <= size) { cmp++; c = A[r] < A[l] ? r : l; why = "两个孩子 A[" + l + "] = " + A[l] + "、A[" + r + "] = " + A[r] + "，较小的是 A[" + c + "] = " + A[c] + "；"; }
              else why = "只有左孩子 A[" + l + "] = " + A[l] + "；";
              cmp++;
              if (A[c] < A[k]) {
                var x = A[k];
                A[k] = A[c]; A[c] = x;
                var mk = {}; mk[c] = label;
                push(A[k] + " < " + x + "：交换，" + x + " 下沉到 A[" + c + "]", why + A[k] + " < " + x + "，交换两者，" + x + " 继续向下比较。", ["h" + k, "h" + c], ["e" + c], mk);
                k = c;
              } else {
                var mk2 = {}; mk2[k] = label;
                push(A[k] + " 不大于较小孩子，筛选结束", why + A[k] + " ≤ " + A[c] + "，以 A[" + k + "] 为根的子树已经是小根堆。", ["h" + k, "h" + c], null, mk2);
                return;
              }
            }
            var mk3 = {}; mk3[k] = label;
            push(A[k] + " 已到叶结点，筛选结束", "A[" + k + "] 没有孩子（" + (2 * k) + " > n），下沉到底。", ["h" + k], null, mk3);
          }
          if (mode === "build") {
            push("初始序列：按层次放进完全二叉树", "把 " + n + " 个关键字依次放入 A[1.." + n + "]，它就是一棵完全二叉树，但还不满足小根堆的性质 A[i] ≤ A[2i]、A[i] ≤ A[2i+1]。", ["h1"], null, null, "建堆只调整非叶结点：完全二叉树中下标大于 ⌊n/2⌋ 的都是叶结点。");
            for (var i2 = n >> 1; i2 >= 1; i2--) {
              var mk = {}; mk[i2] = "筛选";
              push("筛选 A[" + i2 + "] = " + A[i2], (i2 === n >> 1 ? "从最后一个非叶结点 ⌊n/2⌋ = " + i2 + " 开始，" : "") + "对以 A[" + i2 + "] 为根的子树做向下筛选（下沉）。", ["h" + i2], null, mk);
              down(i2, "筛选");
            }
            push("建堆完成", "得到小根堆 " + A.slice(1).join(" ") + "，堆顶 A[1] = " + A[1] + " 是最小值。本例共比较 " + cmp + " 次。", ["h1"], null, null, "建堆的时间复杂度是 O(n)，不是 O(n log n)：大部分结点在底层，下沉距离很短。");
          } else if (mode === "ins") {
            push("插入前：已建好的小根堆", "当前小根堆 " + A.slice(1, n + 1).join(" ") + "，要插入 " + key + "。", ["h1"], null, null);
            size = n + 1; A[size] = key;
            var mkN = {}; mkN[size] = "新";
            push("把 " + key + " 放到堆的末尾 A[" + size + "]", "新元素先放在数组末尾，也就是完全二叉树最下层最右边的位置，然后向上调整（上浮）。", ["h" + size], null, mkN);
            var k = size;
            while (k > 1) {
              var p = k >> 1; cmp++;
              var mkU = {}; mkU[k] = "新";
              if (A[k] < A[p]) {
                var x = A[k]; A[k] = A[p]; A[p] = x;
                mkU = {}; mkU[p] = "新";
                push(x + " < 双亲 " + A[k] + "：交换，上浮到 A[" + p + "]", "与双亲 A[⌊" + k + "/2⌋] = A[" + p + "] 比较，" + x + " 更小，交换。", ["h" + p, "h" + k], ["e" + k], mkU);
                k = p;
              } else {
                push(A[k] + " ≥ 双亲 " + A[p] + "：停止", "与双亲 A[" + p + "] = " + A[p] + " 比较，不小于双亲，上浮结束。", ["h" + k, "h" + p], null, mkU);
                break;
              }
            }
            if (k === 1) push(key + " 到达堆顶", "已经上浮到根结点，插入结束。", ["h1"], null, { 1: "新" });
            push("插入完成", "新的小根堆：" + A.slice(1, size + 1).join(" ") + "。上浮最多走树高 ⌊log₂n⌋ 层，时间复杂度 O(log n)。", ["h" + k], null, null, "上浮每层只和双亲比较 1 次；下沉每层可能要比较 2 次（先比两个孩子，再和较小者比）。");
          } else {
            push("删除前：已建好的小根堆", "当前小根堆 " + A.slice(1, n + 1).join(" ") + "，删除堆顶 " + A[1] + "（即取出最小值）。", ["h1"], null, null);
            var top = A[1], last = A[n];
            A[1] = last; A[n] = null; size = n - 1;
            push("末尾元素 " + last + " 移到堆顶", "输出堆顶 " + top + "，把最后一个元素 A[" + n + "] = " + last + " 移到 A[1]，堆的长度减 1。此时根破坏了堆的性质，要向下调整。", ["h1", "h" + n], null, { 1: "下沉" }, "删除堆顶不是直接删掉根：用最后一个元素补位，才能保持完全二叉树的形状。", { "输出": String(top) });
            down(1, "下沉");
            push("删除完成", "新的小根堆：" + A.slice(1, size + 1).join(" ") + "。下沉最多走树高层，时间复杂度 O(log n)。堆排序就是反复做“删除堆顶 + 下沉”。", ["h1"], null, null, "堆排序：建堆 O(n)，n − 1 次下沉各 O(log n)，总 O(n log n)；空间 O(1)；不稳定。");
          }
          return { w: 980, h: 510, nodes: nodes, edges: edges, steps: S };
        }
        var HEAP_IN = { k: "heap", label: "初始关键字序列（2–10 个）", value: "53 17 78 9 45 65 87 32", ph: "空格或逗号分隔" };
        PROC.push({
          id: "heapop", name: "堆的插入与删除", sub: "ds",
          lead: "小根堆：数组和完全二叉树同步画。建堆从 ⌊n/2⌋ 开始向下筛选，插入放末尾再上浮，删除堆顶用末尾元素替换再下沉。",
          note: ["小根堆：A[i] ≤ A[2i] 且 A[i] ≤ A[2i+1]（下标从 1 开始）；大根堆相反。", "建堆从最后一个非叶结点 ⌊n/2⌋ 开始依次向前做下沉，时间复杂度 O(n)。", "插入：放到末尾，与双亲比较，小则交换，一路上浮，O(log n)。", "删除堆顶：末尾元素移到堆顶，与较小的孩子比较，大则交换，一路下沉，O(log n)。", "堆排序不稳定，时间 O(n log n)，空间 O(1)；比较次数是常考计算题，注意下沉时两个孩子之间也要比较一次。"],
          modes: [
            { name: "建堆（筛选法）", inputs: [HEAP_IN], make: function (inp) { return heapSpec("build", inp); }, presets: [{ label: "王道例题", v: { heap: "53 17 78 9 45 65 87 32" } }, { label: "逆序 8 个", v: { heap: "80 70 60 50 40 30 20 10" } }] },
            { name: "插入（上浮）", inputs: [HEAP_IN, { k: "hkey", label: "插入关键字", value: "13", num: 1 }], make: function (inp) { return heapSpec("ins", inp); } },
            { name: "删除堆顶（下沉）", inputs: [HEAP_IN], make: function (inp) { return heapSpec("del", inp); } }
          ]
        });

        /* ===================== 7. 红黑树的插入 ===================== */
        /* 黑高口径：从结点出发（不含该结点）到叶结点（NIL，计入）路径上的黑结点数 */
        DS.rbCheck = function (slots) {
          /* slots: { 下标: [key, "R"|"B"] }，下标按完全二叉树编号（根 1，左 2i，右 2i+1） */
          var res = { rootBlack: true, redRed: [], bh: null, bhOk: true, bst: true };
          if (!slots[1]) return res;
          res.rootBlack = slots[1][1] === "B";
          var hs = [];
          (function walk(i, lo, hi, blacks) {
            var n = slots[i];
            if (!n) { hs.push(blacks + 1); return; }
            if (n[0] <= lo || n[0] >= hi) res.bst = false;
            if (n[1] === "R" && i > 1 && slots[i >> 1][1] === "R") res.redRed.push(slots[i >> 1][0] + "—" + n[0]);
            var b = blacks + (i > 1 && n[1] === "B" ? 1 : 0);
            walk(2 * i, lo, n[0], b); walk(2 * i + 1, n[0], hi, b);
          })(1, -Infinity, Infinity, 0);
          res.bh = hs[0];
          res.bhOk = hs.every(function (h) { return h === hs[0]; });
          return res;
        };
        DS.rbInsert = function (keys) {
          var root = null, log = [], rot = 0;
          function rotL(x) { var y = x.r; x.r = y.l; if (y.l) y.l.p = x; y.p = x.p; if (!x.p) root = y; else if (x === x.p.l) x.p.l = y; else x.p.r = y; y.l = x; x.p = y; rot++; }
          function rotR(x) { var y = x.l; x.l = y.r; if (y.r) y.r.p = x; y.p = x.p; if (!x.p) root = y; else if (x === x.p.r) x.p.r = y; else x.p.l = y; y.r = x; x.p = y; rot++; }
          function slots() { var m = {}; (function w(n, i) { if (!n) return; m[i] = [n.k, n.c]; w(n.l, 2 * i); w(n.r, 2 * i + 1); })(root, 1); return m; }
          function rec(key, kind, t, d, roles, extra) { log.push({ key: key, kind: kind, t: t, d: d, slots: slots(), roles: roles || {}, rot: rot, done: !!(extra && extra.done), cs: extra && extra.cs }); }
          var C = function (c) { return c === "R" ? "红" : "黑"; };
          keys.forEach(function (k) {
            var z = { k: k, c: "R", l: null, r: null, p: null }, y = null, x = root, path = [];
            while (x) {
              y = x;
              if (k === x.k) throw new Error("关键字 " + k + " 重复：红黑树中关键字互不相同");
              path.push(k < x.k ? k + " < " + x.k + " 往左" : k + " > " + x.k + " 往右");
              x = k < x.k ? x.l : x.r;
            }
            z.p = y;
            if (!y) root = z; else if (k < y.k) y.l = z; else y.r = z;
            var roles = {}; roles[k] = "新";
            if (!y) { rec(k, "ins", "插入 " + k + "：树空，作为根", "新结点一律染红后插入。树为空，" + k + " 成为根结点。", roles); }
            else {
              var where = "作为 " + y.k + " 的" + (k < y.k ? "左" : "右") + "孩子";
              if (y.c === "B") roles[y.k] = "父";
              else { roles[y.k] = "父"; var g0 = y.p, u0 = g0 && (g0.l === y ? g0.r : g0.l); if (g0) roles[g0.k] = "爷"; if (u0) roles[u0.k] = "叔"; }
              rec(k, "ins", "插入 " + k + "（红）", "从根开始比较：" + path.join("，") + "，" + where + "插入，染成红色。", roles);
            }
            for (;;) {
              var r0 = {};
              if (z === root) {
                if (z.c === "R") { z.c = "B"; r0[z.k] = "根"; rec(k, "root", z.k === k ? "根结点染黑" : "向上传到根：" + z.k + " 染黑", z.k === k ? "根结点必须是黑色，把 " + k + " 染黑。" : z.k + " 被染红后成了根，根必须为黑，再把它染黑。变色一路传到根，整棵树的黑高因此增加了 1（bh 不计根结点本身，所以是上一步父、叔染黑时增加的）。", r0, { done: true, cs: "根染黑" }); }
                else rec(k, "end", "调整结束", "根已经是黑色。", r0, { done: true, cs: "—" });
                break;
              }
              var p = z.p;
              if (p.c === "B") {
                r0[z.k] = z.k === k ? "新" : "z"; r0[p.k] = "父";
                rec(k, "end", z.k === k ? "父结点 " + p.k + " 为黑：插入结束" : z.k + " 的父结点 " + p.k + " 为黑：调整结束", z.k === k ? "插入红结点不改变任何路径上黑结点的个数，父结点又是黑色，没有红红相连，不需要调整。" : "向上传递的 " + z.k + " 是红色，但它的父结点 " + p.k + " 为黑，不再违反性质。", r0, { done: true, cs: "父黑" });
                break;
              }
              var g = p.p, u = g.l === p ? g.r : g.l;
              if (u && u.c === "R") {
                p.c = "B"; u.c = "B"; g.c = "R";
                r0[p.k] = "父"; r0[u.k] = "叔"; r0[g.k] = "z";
                rec(k, "flip", "父红叔红：父、叔染黑，爷染红", "父 " + p.k + "、叔 " + u.k + " 都是红色：把父和叔染黑、爷 " + g.k + " 染红，不旋转。爷变红后可能和它的父结点又红红相连，所以把爷 " + g.k + " 当作新插入的结点继续向上检查。", r0, { cs: "父红叔红（变色）" });
                z = g; continue;
              }
              var uTxt = u ? "叔 " + u.k + " 为黑" : "叔结点不存在（NIL 视为黑）";
              var type = g.l === p ? (p.l === z ? "LL" : "LR") : (p.r === z ? "RR" : "RL");
              if (type === "LR" || type === "RL") {
                if (type === "LR") rotL(p); else rotR(p);
                r0[z.k] = "父"; r0[p.k] = "z"; r0[g.k] = "爷";
                rec(k, "rot1", type + " 型第一步：以 " + z.k + " 为轴" + (type === "LR" ? "左" : "右") + "旋", "父 " + p.k + " 红、" + uTxt + "，" + z.k + " 是父结点的" + (type === "LR" ? "右" : "左") + "孩子，属于 " + type + " 型。先对父结点 " + p.k + " 做一次" + (type === "LR" ? "左" : "右") + "旋，" + z.k + " 上升，变成 " + (type === "LR" ? "LL" : "RR") + " 型。", r0, { cs: "父红叔黑 " + type });
                var t0 = z; z = p; p = t0;
              }
              var big = type.charAt(0);
              if (big === "L") rotR(g); else rotL(g);
              p.c = "B"; g.c = "R";
              var r1 = {}; r1[p.k] = "父"; r1[g.k] = "爷";
              var two = type === "LR" || type === "RL";
              rec(k, "rot", two ? type + " 型第二步：以 " + p.k + " 为轴" + (big === "L" ? "右" : "左") + "旋并变色" : type + " 型：右单旋并变色".replace("右", big === "L" ? "右" : "左"),
                (two ? "" : "父 " + p.k + " 红、" + uTxt + "，" + z.k + " 是父结点的" + (big === "L" ? "左" : "右") + "孩子，属于 " + type + " 型。") + "以 " + p.k + " 为轴" + (big === "L" ? "右" : "左") + "旋：" + p.k + " 上升取代原来的爷结点 " + g.k + "，然后 " + p.k + " 染黑、" + g.k + " 染红（相当于两者交换颜色）。", r1, { done: true, cs: "父红叔黑 " + type });
              break;
            }
          });
          return { log: log, slots: slots(), rot: rot, C: C };
        };
        function rbSpec(keys) {
          var R = DS.rbInsert(keys), all = {};
          R.log.forEach(function (e) { each(e.slots, function (i) { all[i] = 1; }); });
          var maxI = Math.max.apply(null, Object.keys(all).map(Number));
          if (maxI >= 16) throw new Error("插入过程中树高超过 4 层，图里放不下；请减少关键字个数或换一个顺序");
          var nodes = [], edges = [], S = [];
          Object.keys(all).map(Number).sort(function (a, b) { return a - b; }).forEach(function (i) {
            var d = Math.floor(Math.log(i) / Math.LN2), j = i - (1 << d), cx = 20 + (j + 0.5) * 680 / (1 << d);
            nodes.push({ id: "s" + i, k: "box", x: Math.round(cx - 32), y: 40 + d * 100, w: 64, h: 46, t: "" });
            if (i > 1) edges.push({ id: "e" + i, a: "s" + (i >> 1), as: "b", ao: i % 2 ? 12 : -12, b: "s" + i, bs: "t" });
          });
          nodes.push({ id: "PROP", k: "table", x: 730, y: 40, w: 230, h: 26 + 3 * 24 + 6, rh: 24, t: "红黑性质检查", cols: [0.5], rows: [["根为黑", "—"], ["无红红相连", "—"], ["黑路同", "—"]] });
          nodes.push({ id: "CASE", k: "box", x: 730, y: 190, w: 230, h: 64, t: "当前情况", v: "—" });
          nodes.push({ id: "BH", k: "box", x: 730, y: 290, w: 230, h: 64, t: "树的黑高 bh（根）", v: "—" });
          nodes.push({ id: "SEQ", k: "fields", unit: 1, x: 20, y: 460, w: Math.min(940, 85 * keys.length), h: 52, t: "插入序列", segs: keys.map(function (k, i) { return { t: String(i + 1), v: String(k), w: 1 }; }) });
          var prevSlots = {};
          R.log.forEach(function (e) {
            var set = {}, on = [], go = [], ki = keys.indexOf(e.key);
            Object.keys(all).forEach(function (i) {
              var n = e.slots[i];
              set["s" + i] = n ? { t: String(n[0]), v: R.C(n[1]), badge: e.roles[n[0]] || "" } : { t: i > 1 && e.slots[i >> 1] ? "NIL" : "", v: "", badge: "" };
              if (n && e.roles[n[0]]) on.push("s" + i);
              if (n && i > 1 && (!prevSlots[i] || prevSlots[i][0] !== n[0]) && e.slots[i >> 1]) go.push("e" + i);
            });
            prevSlots = e.slots;
            var c = DS.rbCheck(e.slots), bad = !c.rootBlack ? 0 : c.redRed.length ? 1 : !c.bhOk ? 2 : -1;
            set.PROP = { rows: [["根为黑", c.rootBlack ? "是 ✓" : "否 ✗"], ["无红红相连", c.redRed.length ? c.redRed[0] + " ✗" : "是 ✓"], ["黑路同", c.bhOk ? "bh = " + c.bh + " ✓" : "不同 ✗"]], bad: bad, hi: -1 };
            set.CASE = { v: e.cs || (c.redRed.length ? "红红相连，需调整" : "无冲突") };
            set.BH = { v: c.bhOk ? String(c.bh) : "—" };
            set.SEQ = { segs: keys.map(function (k, i) { return { t: String(i + 1), v: String(k), w: 1, on: i === ki }; }) };
            on.push("PROP");
            var s = { t: e.t, d: e.d, on: on, set: set, kv: { "插入": String(e.key), "黑高": c.bhOk ? String(c.bh) : "—", "旋转次数": String(e.rot) } };
            if (go.length) s.go = go;
            if (e.done) { s.rb = e.slots; }
            if (e.kind === "flip") s.tip = "父红叔红只变色不旋转，但问题可能上移到爷结点，要继续向上检查，一直可能传到根。";
            else if (e.kind === "rot" && /^(LL|RR)/.test(e.t)) s.tip = "父红叔黑：旋转方式与 AVL 的 LL/RR/LR/RL 相同，旋转后原来的父（或新结点）成为子树根并染黑，爷染红。";
            else if (e.kind === "rot1") s.tip = "LR / RL 型要旋转两次：第一次把它变成 LL / RR 型，第二次再按 LL / RR 处理。";
            else if (e.kind === "root" && e.key !== keys[0]) s.tip = "只有“父红叔红”一路传到根时，树的黑高才会增加 1。";
            else if (e.kind === "ins" && ki === 0) s.tip = "新插入的结点总是红色：插红结点不改变黑高，最多只会破坏“不红红”这一条，修复代价小。";
            S.push(s);
          });
          var fin = DS.rbCheck(R.slots), clr = {};
          Object.keys(all).forEach(function (i) { clr["s" + i] = { badge: "" }; });
          clr.CASE = { v: "插入结束" };
          clr.SEQ = { segs: keys.map(function (k, i) { return { t: String(i + 1), v: String(k), w: 1 }; }) };
          S.push({ t: "全部插入完成", d: "最终红黑树满足：根为黑；红结点的孩子都是黑结点；从任一结点到其每个叶结点（NIL）的路径上黑结点数相同。树的黑高 bh = " + fin.bh + "，共旋转 " + R.rot + " 次。", on: ["PROP", "BH"], rb: R.slots, set: clr, kv: { "插入": "—" }, tip: "红黑树的高度 h ≤ 2log₂(n + 1)；根的黑高 ≥ h/2。插入最多旋转 2 次，变色可能一路向上。" });
          return { w: 980, h: 530, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "rbtree", name: "红黑树的插入", sub: "ds",
          lead: "新结点染红插入：父黑直接结束；父红叔红就变色并把爷当新结点继续；父红叔黑按 LL / RR / LR / RL 旋转后变色。每一步都检查红黑性质并标出黑高。",
          note: ["红黑性质：结点非红即黑；根黑；叶结点（NIL）黑；红结点的两个孩子都是黑（不红红）；任一结点到其每个叶结点路径上的黑结点数相同（黑路同）。", "新插入结点为红色（若是根则染黑）；父结点为黑，插入直接结束。", "父红叔红：父、叔染黑，爷染红，爷作为新结点继续向上调整（不旋转）。", "父红叔黑：LL 右单旋、RR 左单旋，LR 先左后右、RL 先右后左；旋转后新子树根染黑、原爷染红。", "黑高 bh：从某结点出发（不含该结点）到叶结点路径上的黑结点数；红黑树高 h ≤ 2log₂(n + 1)，查找、插入、删除都是 O(log n)。"],
          modes: [
            { name: "插入 20,10,5,30,40,57,3,2", inputs: [{ k: "rb", label: "关键字序列（不超过 10 个）", value: "20 10 5 30 40 57 3 2", ph: "空格或逗号分隔" }], make: function (inp) { return rbSpec(nums(inp.rb == null ? "20 10 5 30 40 57 3 2" : inp.rb, 1, 10, "关键字序列")); } },
            { name: "LR / RL 型：10,5,7,15,12", make: function () { return rbSpec([10, 5, 7, 15, 12]); } }
          ]
        });
