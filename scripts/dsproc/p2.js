
        /* ===================== 2. 循环队列的队空与队满 ===================== */
        /* 约定（王道）：front 指向队头元素，rear 指向队尾元素的下一个位置；MaxSize = 6 */
        function cqueue(scheme) {
          var M = 6, POS = [[40, 90], [190, 90], [340, 90], [340, 260], [190, 260], [40, 260]];
          var nodes = [{ id: "RING", k: "zone", x: 20, y: 30, w: 440, h: 330, t: "循环队列 Q[0..5]（MaxSize = 6）" }], edges = [], S = [];
          POS.forEach(function (p, i) { nodes.push({ id: "c" + i, k: "box", x: p[0], y: p[1], w: 100, h: 60, t: "Q[" + i + "]", v: " " }); });
          edges.push({ id: "r0", a: "c0", b: "c1" }, { id: "r1", a: "c1", b: "c2" }, { id: "r2", a: "c2", as: "b", b: "c3", bs: "t" },
            { id: "r3", a: "c3", as: "l", b: "c4", bs: "r" }, { id: "r4", a: "c4", as: "l", b: "c5", bs: "r" }, { id: "r5", a: "c5", as: "t", b: "c0", bs: "b", t: "(i+1)%6" });
          var COND = {
            sac: [["队空", "front == rear"], ["队满", "(rear + 1) % MaxSize == front"], ["长度", "(rear − front + MaxSize) % MaxSize"]],
            size: [["队空", "size == 0"], ["队满", "size == MaxSize"], ["长度", "size"]],
            tag: [["队空", "front == rear && tag == 0"], ["队满", "front == rear && tag == 1"], ["长度", "满时 6，否则同左式"]]
          }[scheme];
          var TITLE = { sac: "方案一：牺牲一个存储单元", size: "方案二：类型中增设 size", tag: "方案三：类型中增设 tag" }[scheme];
          nodes.push({ id: "COND", k: "table", x: 500, y: 40, w: 440, h: 104, rh: 24, t: TITLE, cols: [0.16], rows: COND });
          nodes.push({ id: "DEC", k: "dec", x: 500, y: 180, w: 250, h: 120, t: "判断" });
          nodes.push({ id: "OP", k: "box", x: 790, y: 205, w: 150, h: 70, t: "本次操作", v: "—" });
          var q = [null, null, null, null, null, null], f = 0, r = 0, size = 0, tag = 0, cnt = 0;
          function cells() {
            var o = {};
            for (var i = 0; i < M; i++) {
              var b = i === f && i === r ? "front rear" : i === f ? "front" : i === r ? "rear" : "";
              o["c" + i] = { v: q[i] == null ? " " : q[i], badge: b };
            }
            return o;
          }
          function kv() {
            var o = { "front": String(f), "rear": String(r), "元素个数": String(cnt) };
            if (scheme === "size") o.size = String(size);
            if (scheme === "tag") o.tag = String(tag);
            return o;
          }
          function full() { return scheme === "sac" ? (r + 1) % M === f : scheme === "size" ? size === M : f === r && tag === 1; }
          function fullTxt() {
            if (scheme === "sac") return "(" + r + "+1)%6 = " + ((r + 1) % M) + (full() ? " = front" : " ≠ front(" + f + ")");
            if (scheme === "size") return "size = " + size + (full() ? " = MaxSize" : " < MaxSize");
            return "front" + (f === r ? "==" : "≠") + "rear，tag = " + tag;
          }
          function mk(t, d, on, go, extra, tip) {
            var set = cells();
            each(extra || {}, function (k, v) { set[k] = v; });
            var st = { t: t, d: d, on: on, set: set, kv: kv() };
            if (go && go.length) st.go = go;
            if (tip) st.tip = tip;
            S.push(st);
          }
          function enq(x) {
            var at = r, chk = fullTxt();
            q[r] = x; r = (r + 1) % M; cnt++;
            if (scheme === "size") size++;
            if (scheme === "tag") tag = 1;
            var how = scheme === "size" ? "，size++ 得 " + size : scheme === "tag" ? "，入队成功令 tag = 1" : "";
            mk("入队 " + x + "：rear = " + r, "先判满：" + chk + "，未满。Q[rear] = Q[" + at + "] = " + x + "，rear = (rear + 1) % 6 = " + r + how + "。",
              ["c" + at, "DEC", "OP"], at < M - 1 ? ["r" + at] : ["r5"], { DEC: { t: "队满？\n" + chk + "\n否，可以入队" }, OP: { v: "入队 " + x }, COND: { hi: 1 } },
              at === M - 1 ? "rear 从 5 加 1 后对 6 取余回到 0，这就是“循环”：存储空间首尾相接。" : null);
          }
          function deq() {
            var at = f, x = q[f];
            q[f] = null; f = (f + 1) % M; cnt--;
            if (scheme === "size") size--;
            if (scheme === "tag") tag = 0;
            var how = scheme === "size" ? "，size-- 得 " + size : scheme === "tag" ? "，出队成功令 tag = 0" : "";
            mk("出队 " + x + "：front = " + f, "先判空：" + (scheme === "size" ? "size ≠ 0" : scheme === "tag" ? "front ≠ rear" : "front ≠ rear") + "，非空。x = Q[front] = Q[" + at + "] = " + x + "，front = (front + 1) % 6 = " + f + how + "。",
              ["c" + at, "DEC", "OP"], ["r" + at], { DEC: { t: "队空？\n否，可以出队" }, OP: { v: "出队 " + x }, COND: { hi: 0 } });
          }
          function tryFull(x, extraTip) {
            var chk = fullTxt();
            mk("再入队 " + x + "：队满，拒绝", "判满：" + chk + "，队列已满，入队失败。此时队中有 " + cnt + " 个元素。", ["DEC", "c" + r, "COND"], null,
              { DEC: { t: "队满？\n" + chk + "\n是 ✓ 入队失败" }, OP: { v: "入队 " + x + " ✗" }, COND: { hi: 1 } }, extraTip);
          }
          var init = { sac: "front = rear = 0。", size: "front = rear = 0，size = 0。", tag: "front = rear = 0，tag = 0。" }[scheme];
          mk("初始化：队空", "InitQueue：" + init + "front 指向队头元素，rear 指向队尾元素的下一个位置。此时 front == rear，队空。", ["c0", "COND", "DEC"], null,
            { DEC: { t: "队空？\nfront == rear\n是" }, COND: { hi: 0 } }, "rear 的含义有两种约定：指向队尾元素的下一位置（本图）或指向队尾元素本身，两种约定下判空判满式子不同，做题先看清。");
          var first = scheme === "sac" ? ["a", "b", "c", "d", "e"] : ["a", "b", "c", "d", "e", "f"];
          first.forEach(enq);
          if (scheme === "sac") {
            tryFull("f", "牺牲一个单元：队满时 rear 与 front 之间空着一格，只存 MaxSize − 1 = 5 个元素，用来区分“满”与“空”（空时 front == rear）。");
          } else if (scheme === "size") {
            tryFull("g", "此时 front == rear == 0，和队空时一样，单靠 front、rear 区分不了；size 记录元素个数，6 个单元全部可用。");
          } else {
            tryFull("g", "只有入队才可能导致队满，只有出队才可能导致队空：所以 front == rear 时看最近一次操作，tag = 1 是满，tag = 0 是空。");
          }
          deq(); deq();
          var more = scheme === "sac" ? ["f", "g"] : ["g", "h"];
          more.forEach(enq);
          tryFull(scheme === "sac" ? "h" : "i");
          var len = scheme === "sac" ? "(rear − front + MaxSize) % MaxSize = (" + r + " − " + f + " + 6) % 6 = " + ((r - f + M) % M) : scheme === "size" ? "长度直接就是 size = " + size : "front == rear 且 tag = 1，长度为 MaxSize = 6";
          S.push({ t: "小结：rear 绕回后再次队满", d: "rear 已绕回到 " + r + "，front = " + f + "。" + len + "。", on: ["COND"], set: { COND: { hi: 2 }, OP: { v: "求长度" }, DEC: { t: "长度 = " + cnt } }, kv: { "队列长度": String(cnt) },
            tip: scheme === "sac" ? "三种方案的判满条件常被混着考：牺牲单元 (rear+1)%MaxSize == front；size 方案 size == MaxSize；tag 方案 front == rear && tag == 1。" : "增设 size 或 tag 后，MaxSize 个单元可以全部用上；牺牲单元方案最多只能存 MaxSize − 1 个。" });
          return { w: 960, h: 390, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "cqueue", name: "循环队列的队空与队满", sub: "ds",
          lead: "MaxSize = 6：入队到满 → 出队两个 → 再入队让 rear 绕回，三种判满方案分别走一遍。",
          note: ["front 指向队头元素，rear 指向队尾元素的下一个位置；入队 rear = (rear + 1) % MaxSize，出队 front = (front + 1) % MaxSize。", "牺牲一个单元：队空 front == rear，队满 (rear + 1) % MaxSize == front，最多存 MaxSize − 1 个元素。", "队列长度 = (rear − front + MaxSize) % MaxSize。", "增设 size：队空 size == 0，队满 size == MaxSize；增设 tag：front == rear 时 tag = 0 为空、tag = 1 为满。", "若 rear 改为指向队尾元素本身，初始化 rear = MaxSize − 1，判空判满式子要相应调整。"],
          modes: [
            { name: "牺牲一个单元", make: function () { return cqueue("sac"); } },
            { name: "增设 size", make: function () { return cqueue("size"); } },
            { name: "增设 tag", make: function () { return cqueue("tag"); } }
          ]
        });

        /* ===================== 3. 递归与函数调用栈 ===================== */
        function stackNodes(nodes) {
          nodes.push({ id: "ZS", k: "zone", x: 20, y: 30, w: 300, h: 540, t: "系统栈（栈顶在上）" });
          nodes.push({ id: "RET", k: "reg", x: 40, y: 64, w: 260, h: 52, t: "最近一次返回值", v: "—" });
          for (var k = 0; k < 5; k++) nodes.push({ id: "S" + k, k: "box", x: 40, y: 496 - k * 80, w: 260, h: 56, t: "", sm: 1 });
        }
        function frames(stack) {
          var o = {};
          for (var k = 0; k < 5; k++) {
            var f = stack[k];
            o["S" + k] = f ? { t: f[0], v: f[1], badge: k === stack.length - 1 ? "栈顶" : "" } : { t: "", v: "", badge: "" };
          }
          return o;
        }
        function fact() {
          var nodes = [], edges = [], S = [];
          stackNodes(nodes);
          nodes.push({ id: "ZT", k: "zone", x: 350, y: 30, w: 600, h: 540, t: "递归调用树" });
          var X = [370, 510, 650, 790], Y = [70, 170, 270, 370];
          for (var i = 0; i < 4; i++) nodes.push({ id: "f" + (4 - i), k: "box", x: X[i], y: Y[i], w: 120, h: 50, t: "fact(" + (4 - i) + ")", v: "" });
          nodes.push({ id: "RES", k: "box", x: 370, y: 480, w: 200, h: 56, t: "main 得到", v: "fact(4) = ?" });
          var RV = { 4: "返回 6", 3: "返回 2", 2: "返回 1" };
          for (var n = 4; n > 1; n--) {
            edges.push({ id: "c" + n, a: "f" + n, as: "r", b: "f" + (n - 1), bs: "t" });
            edges.push({ id: "r" + n, a: "f" + (n - 1), as: "l", b: "f" + n, bs: "b", t: RV[n] });
          }
          edges.push({ id: "rm", a: "f4", as: "b", ao: -40, b: "RES", bs: "t", bo: -80, t: "返回 24" });
          var st = [["main()", "调用 fact(4)"]];
          var push = function (n, from) { st.push(["fact(" + n + ") 的栈帧", "n=" + n + " · 返回→" + from]); };
          var pop = function () { st.pop(); };
          var kv = function (o) { o["栈深度"] = String(st.length - 1); return o; };
          var setF = function (extra) { var o = frames(st); each(extra || {}, function (k, v) { o[k] = v; }); return o; };
          S.push({ t: "main 调用 fact(4)", d: "int fact(int n) { if (n == 0 || n == 1) return 1; return n * fact(n − 1); }  每调用一次函数，系统就在栈顶压入一个栈帧：保存实参、返回地址和局部变量。", on: ["S0", "f4"], set: setF(), kv: kv({ "调用次数": "0" }) });
          push(4, "main");
          S.push({ t: "压入 fact(4) 的栈帧", d: "n = 4 不是递归出口，要先求 fact(3)，fact(4) 的计算暂停在“4 × □”处，返回地址记在栈帧里。", on: ["S1", "f4"], set: setF(), kv: kv({ "调用次数": "1" }) });
          push(3, "fact(4)");
          S.push({ t: "fact(4) 调用 fact(3)", d: "n = 3，继续递归，再压入一个栈帧。每一层的 n 都是自己的，互不干扰。", on: ["S2", "f3"], go: ["c4"], set: setF(), kv: kv({ "调用次数": "2" }) });
          push(2, "fact(3)");
          S.push({ t: "fact(3) 调用 fact(2)", d: "n = 2，继续递归。", on: ["S3", "f2"], go: ["c3"], set: setF(), kv: kv({ "调用次数": "3" }) });
          push(1, "fact(2)");
          S.push({ t: "fact(2) 调用 fact(1)：到达递归出口", d: "n = 1 满足递归出口条件，直接返回 1，不再调用。此时栈深度最大，为 4 层（不含 main）。", on: ["S4", "f1"], go: ["c2"], set: setF({ f1: { v: "= 1" } }), kv: kv({ "调用次数": "4", "最大深度": "4" }), tip: "递归必须有出口（递归边界），否则会无限压栈直到栈溢出。" });
          pop();
          S.push({ t: "fact(1) 返回 1，弹出栈帧", d: "按栈帧中保存的返回地址回到 fact(2)，fact(2) 算出 2 × 1 = 2。", on: ["S3", "f2"], go: ["r2"], set: setF({ f2: { v: "= 2" }, RET: { v: "1" } }), kv: kv({}) });
          pop();
          S.push({ t: "fact(2) 返回 2", d: "回到 fact(3)：3 × 2 = 6。", on: ["S2", "f3"], go: ["r3"], set: setF({ f3: { v: "= 6" }, RET: { v: "2" } }), kv: kv({}) });
          pop();
          S.push({ t: "fact(3) 返回 6", d: "回到 fact(4)：4 × 6 = 24。", on: ["S1", "f4"], go: ["r4"], set: setF({ f4: { v: "= 24" }, RET: { v: "6" } }), kv: kv({}) });
          pop();
          S.push({ t: "fact(4) 返回 24，回到 main", d: "栈中只剩 main 的栈帧，递归调用全部结束。后调用的先返回，正是“后进先出”。", on: ["S0", "RES"], go: ["rm"], set: setF({ RES: { v: "fact(4) = 24" }, RET: { v: "24" } }), kv: kv({ "结果": "24" }), tip: "递归调用 n 层，栈中最多有 n 个栈帧，空间复杂度 O(n)；可以借助栈把递归改写成非递归。" });
          return { w: 960, h: 590, nodes: nodes, edges: edges, steps: S };
        }
        function fib() {
          var nodes = [], edges = [], S = [];
          stackNodes(nodes);
          nodes.push({ id: "ZT", k: "zone", x: 350, y: 30, w: 600, h: 540, t: "递归调用树" });
          /* 调用树：结点 id、n、列（按叶子顺序）、层 */
          var T = [["F4", 4, 2.375, 0], ["F3", 3, 1.25, 1], ["F2a", 2, 0.5, 2], ["F1a", 1, 0, 3], ["F0a", 0, 1, 3], ["F1b", 1, 2, 2], ["F2b", 2, 3.5, 1], ["F1c", 1, 3, 2], ["F0b", 0, 4, 2]];
          var PAR = { F3: ["F4", -18], F2b: ["F4", 18], F2a: ["F3", -18], F1b: ["F3", 18], F1a: ["F2a", -18], F0a: ["F2a", 18], F1c: ["F2b", -18], F0b: ["F2b", 18] };
          T.forEach(function (r) { nodes.push({ id: r[0], k: "box", x: Math.round(370 + r[2] * 118), y: 70 + r[3] * 100, w: 96, h: 46, t: "Fib(" + r[1] + ")", v: "" }); });
          each(PAR, function (c, p) { edges.push({ id: "e" + c, a: p[0], as: "b", ao: p[1], b: c, bs: "t" }); });
          nodes.push({ id: "RES", k: "box", x: 370, y: 480, w: 240, h: 56, t: "main 得到", v: "Fib(4) = ?" });
          var st = [["main()", "调用 Fib(4)"]], calls = 0, maxd = 0, vals = {};
          var NAME = {}; T.forEach(function (r) { NAME[r[0]] = "Fib(" + r[1] + ")"; });
          function setF(extra) { var o = frames(st); each(vals, function (k, v) { o[k] = { v: "= " + v }; }); each(extra || {}, function (k, v) { o[k] = v; }); return o; }
          function kv(o) { o = o || {}; o["栈深度"] = String(st.length - 1); o["调用次数"] = String(calls); o["最大深度"] = String(maxd); return o; }
          function call(id, from, d, tip) {
            var fn = from ? NAME[from] : "main";
            calls++; st.push([NAME[id] + " 的栈帧", "n=" + NAME[id].replace(/\D/g, "") + " · 返回→" + fn]);
            maxd = Math.max(maxd, st.length - 1);
            var s = { t: fn + " 调用 " + NAME[id] + (from ? "" : "：压栈"), d: d, on: ["S" + (st.length - 1), id], set: setF(), kv: kv() };
            if (PAR[id]) s.go = ["e" + id];
            if (tip) s.tip = tip;
            S.push(s);
          }
          function leaf(id, from, v) {
            calls++; st.push([NAME[id] + " 的栈帧", "n=" + v + " · 返回→" + NAME[from]]);
            maxd = Math.max(maxd, st.length - 1);
            vals[id] = v;
            var s = { t: NAME[from] + " 调用 " + NAME[id] + "，直接返回 " + v, d: NAME[id] + " 是递归出口（n = " + v + "），压栈后立即返回 " + v + "，栈帧随即弹出，回到 " + NAME[from] + "。", on: ["S" + (st.length - 1), id], go: ["e" + id], kv: kv() };
            st.pop();
            s.set = setF({ RET: { v: String(v) } });
            s.set["S" + st.length] = { t: NAME[id] + " 的栈帧", v: "n=" + v + " · 返回 " + v + " 后弹出", badge: "出栈" };
            S.push(s);
          }
          function ret(id, v, d, tip) {
            st.pop(); vals[id] = v;
            var s = { t: NAME[id] + " 返回 " + v, d: d, on: [id, "S" + (st.length - 1)], set: setF({ RET: { v: String(v) } }), kv: kv() };
            if (tip) s.tip = tip;
            S.push(s);
          }
          S.push({ t: "main 调用 Fib(4)", d: "int Fib(int n) { if (n == 0) return 0; if (n == 1) return 1; return Fib(n − 1) + Fib(n − 2); }  先算 Fib(n − 1)，再算 Fib(n − 2)。", on: ["S0"], set: setF(), kv: kv() });
          call("F4", null, "压入 Fib(4) 的栈帧。n = 4 不是出口，先递归求 Fib(3)。");
          call("F3", "F4", "Fib(4) 暂停在“□ + Fib(2)”，先压入 Fib(3) 的栈帧。");
          call("F2a", "F3", "Fib(3) 先求 Fib(2)，再压一层。");
          leaf("F1a", "F2a", 1);
          S[S.length - 1].tip = "此刻栈中有 Fib(4)、Fib(3)、Fib(2)、Fib(1) 四个栈帧，这是整个过程的最大深度 4 = n。";
          leaf("F0a", "F2a", 0);
          ret("F2a", 1, "Fib(2) 的两个子调用都已返回：1 + 0 = 1，弹出栈帧回到 Fib(3)。");
          leaf("F1b", "F3", 1);
          ret("F3", 2, "Fib(3) = Fib(2) + Fib(1) = 1 + 1 = 2，弹出栈帧回到 Fib(4)，接着去算 Fib(2)。");
          call("F2b", "F4", "Fib(4) 的右半边：再算一次 Fib(2)。这次计算和左边那次完全重复。", "斐波那契的朴素递归有大量重复计算，调用次数随 n 指数增长，时间复杂度 O(2ⁿ)。");
          leaf("F1c", "F2b", 1);
          leaf("F0b", "F2b", 0);
          ret("F2b", 1, "Fib(2) = 1 + 0 = 1，回到 Fib(4)。");
          ret("F4", 3, "Fib(4) = Fib(3) + Fib(2) = 2 + 1 = 3，栈中只剩 main。");
          S[S.length - 1].set.RES = { v: "Fib(4) = 3" };
          S[S.length - 1].on = ["F4", "RES", "S0"];
          S.push({ t: "小结：调用 9 次，最大深度 4", d: "递归调用树有 9 个结点，就是调用了 9 次；栈的最大深度等于调用树的高度 4，而不是调用次数。", on: ["F4", "F3", "F2a", "F1a"], set: setF({ RES: { v: "Fib(4) = 3" } }), kv: kv({ "结果": "3" }), tip: "空间复杂度看递归深度 O(n)，时间复杂度看调用次数；用数组从小到大递推可降到 O(n) 时间。" });
          return { w: 960, h: 590, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "recursion", name: "递归与函数调用栈", sub: "ds",
          lead: "每调用一次就压入一个栈帧（实参、返回地址、局部变量），到达递归出口后逐层返回；右边同步画出递归调用树。",
          note: ["递归 = 递归表达式（递归体）+ 递归出口（边界条件），缺一不可。", "函数调用通过系统栈实现：调用时压栈帧，返回时弹栈帧，后调用的先返回。", "递归的空间复杂度取决于最大递归深度（调用树的高度），不是调用次数。", "朴素递归求斐波那契有大量重复计算，时间复杂度 O(2ⁿ)。", "递归可以借助栈改写成非递归算法；尾递归可直接改成循环。"],
          modes: [{ name: "阶乘 fact(4)", make: fact }, { name: "斐波那契 Fib(4)", make: fib }]
        });
