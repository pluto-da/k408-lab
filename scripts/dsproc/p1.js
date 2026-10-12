      /* 过程图解 · 数据结构：链表插入删除、循环队列、递归调用栈、中序线索化、树森林与二叉树、堆、红黑树插入、外部排序
         口径：王道考研 / 严蔚敏《数据结构》。结点用矩形，指针用连线；连线一旦画上就一直在，所以“被改掉的原指针”画成虚线，
         新指针在它被赋值的那一步才点亮（之前是浅灰色）。纯计算函数挂在 window.PROCU.ds 上，便于单元测试。 */
      (function () {
        var PROC = window.PROC = window.PROC || [];
        var U = window.PROCU = window.PROCU || {};
        var DS = U.ds = U.ds || {};

        /* ---------- 公用小工具 ---------- */
        function nums(s, lo, hi, name) {
          var a = String(s == null ? "" : s).trim().split(/[\s,，、;；]+/).filter(function (x) { return x !== ""; });
          if (a.length < lo) throw new Error(name + "至少要有 " + lo + " 个数");
          if (a.length > hi) throw new Error(name + "最多 " + hi + " 个数，图里放不下更多");
          return a.map(function (x) {
            if (!/^\d{1,3}$/.test(x)) throw new Error("“" + x + "”不是 0–999 之间的整数");
            return Number(x);
          });
        }
        function code(id, x, y, w, title, lines) {
          return { id: id, k: "table", x: x, y: y, w: w, h: 26 + lines.length * 20 + 6, rh: 20, t: title, cols: [0.09], rows: lines };
        }
        function each(o, f) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) f(k, o[k]); }

        /* ===================== 1. 单链表与双链表的插入删除 ===================== */
        var LH = 48;
        function sSeg(d, n, on) { return [{ t: "data", v: d, w: 1 }, { t: "next", v: n, w: 1, on: !!on }]; }
        function dSeg(p, d, n, onP, onN) { return [{ t: "prior", v: p, w: 1, on: !!onP }, { t: "data", v: d, w: 1 }, { t: "next", v: n, w: 1, on: !!onN }]; }
        function fNode(id, x, y, w, t, segs) { return { id: id, k: "fields", unit: 1, x: x, y: y, w: w, h: LH, t: t, segs: segs }; }

        function sll(kind) {
          var Y = 120, X = [30, 230, 430, 630], NM = ["L", "a1", "a2", "a3"];
          var TT = { L: "头结点 L", a1: "a1", a2: "a2", a3: "a3" };
          var NX = { L: "→a1", a1: "→a2", a2: "→a3", a3: "∧" }, DT = { L: "", a1: "a1", a2: "a2", a3: "a3" };
          var dashOld = { head: "e1", pos: "e3", del: "e2" }[kind];
          var nodes = [], edges = [], S = [];
          NM.forEach(function (k, i) {
            nodes.push(fNode(k, X[i], Y, 130, TT[k], sSeg(DT[k], NX[k])));
            if (i) edges.push({ id: "e" + i, a: NM[i - 1], b: k, dash: dashOld === "e" + i });
          });
          var sg = function (k, n, on) { return sSeg(DT[k], n, on); };
          var p = function (k) { return { t: TT[k] + "  ← p" }; };
          if (kind === "head") {
            nodes.push(fNode("s", 150, 300, 130, "s（新结点）", sSeg("", "")));
            nodes.push(code("CODE", 30, 380, 480, "头插法：在头结点之后插入 s", [["①", "s->next = L->next;"], ["②", "L->next = s;"]]));
            edges.push({ id: "n1", a: "s", as: "r", b: "a1", bs: "b", t: "①" });
            edges.push({ id: "n2", a: "L", as: "b", b: "s", bs: "l", t: "②" });
            S.push({ t: "初始：带头结点的单链表", d: "L 是头结点，后面依次是 a1、a2、a3，a3->next 为 NULL（∧）。头插法要把新结点 s 插到头结点之后、a1 之前。虚线是将被改掉的原指针，浅灰细线是即将建立的新指针。", on: ["L", "a1", "a2", "a3"], kv: { "当前语句": "—", "表长": "3" } });
            S.push({ t: "申请新结点 s", d: "s = (LNode *)malloc(sizeof(LNode)); s->data = e;  此时 s->next 还没有赋值。", on: ["s"], set: { s: { segs: sSeg("e", "?") } } });
            S.push({ t: "① s->next = L->next", d: "先让 s 指向 L 原来的后继 a1。这一步只改 s 自己的指针域，链表里原有的连接一根都没有断。", on: ["s", "a1", "CODE"], go: ["n1"], set: { s: { segs: sSeg("e", "→a1", 1) }, CODE: { hi: 0 } }, kv: { "当前语句": "①" }, tip: "“先连后断”：先把新结点接到后继上，再修改前驱的指针。" });
            S.push({ t: "② L->next = s", d: "再让头结点指向 s。原来 L → a1 的指针被覆盖（虚线），a1 改由 s->next 找到。", on: ["L", "s", "CODE"], go: ["n2"], set: { L: { segs: sSeg("", "→s", 1) }, s: { segs: sSeg("e", "→a1") }, CODE: { hi: 1 } }, kv: { "当前语句": "②", "表长": "4" }, tip: "①② 不能颠倒：若先执行 L->next = s，a1 的地址就丢了，再执行 s->next = L->next 只会让 s 指向自己。" });
            S.push({ t: "结果：e 成为第一个结点", d: "现在 L → e → a1 → a2 → a3。每次都在表头插入，不需要查找，时间复杂度 O(1)。", on: ["L", "s", "a1", "a2", "a3"], go: ["n2", "n1", "e2", "e3"], set: { L: { segs: sSeg("", "→s") }, CODE: { hi: -1 } }, tip: "头插法建立单链表时，链表中元素的顺序与读入顺序相反，可用来实现链表逆置。" });
            return { w: 860, h: 480, nodes: nodes, edges: edges, steps: S, minScale: 0.8 };
          }
          if (kind === "pos") {
            nodes.push(fNode("s", 530, 300, 130, "s（新结点）", sSeg("", "")));
            nodes.push(code("CODE", 30, 340, 460, "ListInsert(L, 3, e)", [["0", "p = L; j = 0;"], ["1", "while (p != NULL && j < i - 1)"], ["2", "    { p = p->next; j++; }"], ["①", "s->next = p->next;"], ["②", "p->next = s;"]]));
            edges.push({ id: "n1", a: "s", as: "r", b: "a3", bs: "b", t: "①" });
            edges.push({ id: "n2", a: "a2", as: "b", b: "s", bs: "l", t: "②" });
            S.push({ t: "初始：在第 3 个位置插入 e", d: "按位序插入 ListInsert(L, i, e)，i = 3。单链表只能从头往后找，所以要先找到第 i − 1 = 2 个结点 a2，再在它后面插入。", on: ["L", "a1", "a2", "a3"], kv: { "j": "—", "当前语句": "—", "表长": "3" } });
            S.push({ t: "p = L，j = 0", d: "p 从头结点出发，头结点看作第 0 个结点。", on: ["L", "CODE"], set: { L: p("L"), CODE: { hi: 0 } }, kv: { "j": "0", "当前语句": "0" } });
            S.push({ t: "p 后移：p = a1，j = 1", d: "j = 0 < i − 1 = 2，继续：p = p->next，j++。", on: ["a1", "CODE"], go: ["e1"], set: { L: { t: TT.L }, a1: p("a1"), CODE: { hi: [1, 2] } }, kv: { "j": "1", "当前语句": "1–2" } });
            S.push({ t: "p 后移：p = a2，j = 2，停止", d: "j = 2 不再小于 i − 1，循环结束。p 指向第 2 个结点 a2，它就是插入位置的前驱。", on: ["a2", "CODE"], go: ["e2"], set: { a1: { t: TT.a1 }, a2: p("a2"), CODE: { hi: 1 } }, kv: { "j": "2" }, tip: "若循环结束时 p == NULL，说明 i 不合法（大于表长 + 1），返回 false。" });
            S.push({ t: "申请新结点 s", d: "s = (LNode *)malloc(sizeof(LNode)); s->data = e;", on: ["s"], set: { s: { segs: sSeg("e", "?") } } });
            S.push({ t: "① s->next = p->next", d: "s 指向 p 原来的后继 a3。a2 → a3 这根原指针此时还在，链没有断。", on: ["s", "a3", "CODE"], go: ["n1"], set: { s: { segs: sSeg("e", "→a3", 1) }, CODE: { hi: 3 } }, kv: { "当前语句": "①" } });
            S.push({ t: "② p->next = s", d: "a2 改为指向 s，原来的 a2 → a3（虚线）被覆盖。插入完成。", on: ["a2", "s", "CODE"], go: ["n2"], set: { a2: { segs: sg("a2", "→s", 1) }, s: { segs: sSeg("e", "→a3") }, CODE: { hi: 4 } }, kv: { "当前语句": "②", "表长": "4" }, tip: "①② 顺序不能颠倒。" });
            S.push({ t: "结果：L → a1 → a2 → e → a3", d: "e 成为第 3 个结点。查找前驱用 O(n)，插入本身只改两根指针，O(1)。", on: ["L", "a1", "a2", "s", "a3"], go: ["e1", "e2", "n2", "n1"], set: { a2: { t: TT.a2, segs: sg("a2", "→s") }, CODE: { hi: -1 } }, tip: "前插操作（在 p 之前插入）：先在 p 之后插入 s，再交换 p 与 s 的数据域，同样是 O(1)。" });
            return { w: 860, h: 500, nodes: nodes, edges: edges, steps: S, minScale: 0.8 };
          }
          nodes.push(code("CODE", 30, 220, 460, "ListDelete(L, 2, &e)", [["0", "p = GetElem(L, i - 1);"], ["1", "q = p->next;  e = q->data;"], ["①", "p->next = q->next;"], ["②", "free(q);"]]));
          edges.push({ id: "n1", a: "a1", as: "t", ao: 40, b: "a3", bs: "t", bo: -40, my: 60, t: "①" });
          S.push({ t: "初始：删除第 2 个结点", d: "ListDelete(L, 2, &e)：要删除 a2，必须先找到它的前驱，即第 i − 1 = 1 个结点 a1。", on: ["L", "a1", "a2", "a3"], kv: { "j": "—", "当前语句": "—", "表长": "3", "e": "—" } });
          S.push({ t: "p = L，j = 0", d: "p 从头结点出发向后找第 i − 1 个结点。", on: ["L", "CODE"], set: { L: p("L"), CODE: { hi: 0 } }, kv: { "j": "0", "当前语句": "0" } });
          S.push({ t: "p = a1，j = 1，找到前驱", d: "p 后移一次到达 a1，j = 1 = i − 1，停止。", on: ["a1", "CODE"], go: ["e1"], set: { L: { t: TT.L }, a1: p("a1") }, kv: { "j": "1" } });
          S.push({ t: "q = p->next，e = q->data", d: "q 指向被删结点 a2，用 e 带回它的数据。", on: ["a2", "CODE"], go: ["e2"], set: { a2: { t: "a2  ← q" }, CODE: { hi: 1 } }, kv: { "当前语句": "1", "e": "a2" } });
          S.push({ t: "① p->next = q->next", d: "a1 直接指向 a3，把 a2 从链中“断开”。原来的 a1 → a2（虚线）被覆盖。", on: ["a1", "a3", "CODE"], go: ["n1"], set: { a1: { segs: sg("a1", "→a3", 1) }, CODE: { hi: 2 } }, kv: { "当前语句": "①", "表长": "2" }, tip: "必须先用 q 记下被删结点，否则改完 p->next 就再也找不到它，无法释放。" });
          S.push({ t: "② free(q)", d: "释放 a2 占用的空间。a2 → a3 那根指针随结点一起消失。", on: ["a2", "CODE"], set: { a2: { t: "a2（已释放）", segs: sSeg("—", "—") }, a1: { segs: sg("a1", "→a3") }, CODE: { hi: 3 } }, kv: { "当前语句": "②" } });
          S.push({ t: "结果：L → a1 → a3", d: "删除操作的主要时间花在查找前驱上，时间复杂度 O(n)；删除本身 O(1)。", on: ["L", "a1", "a3"], go: ["e1", "n1"], set: { a1: { t: TT.a1 }, CODE: { hi: -1 } }, tip: "删除给定结点 *p（不知道前驱）：把后继的数据复制到 p，再删除后继，O(1)；但 p 是尾结点时不能这样做。" });
          return { w: 860, h: 380, nodes: nodes, edges: edges, steps: S, minScale: 0.8 };
        }

        function dll(kind) {
          var Y = 140, X = [20, 230, 600, 810], NM = ["L", "a1", "a2", "a3"];
          var TT = { L: "头结点 L", a1: "a1  ← p", a2: kind === "del" ? "a2  ← q" : "a2", a3: "a3" };
          var PR = { L: "∧", a1: "←L", a2: "←a1", a3: "←a2" }, NX = { L: "→a1", a1: "→a2", a2: "→a3", a3: "∧" }, DT = { L: "", a1: "a1", a2: "a2", a3: "a3" };
          var dashed = kind === "del" ? { nx2: 1, pr3: 1 } : { nx2: 1, pr2: 1 };
          var nodes = [], edges = [], S = [];
          NM.forEach(function (k, i) {
            nodes.push(fNode(k, X[i], Y, 150, TT[k], dSeg(PR[k], DT[k], NX[k])));
            if (i) {
              edges.push({ id: "nx" + i, a: NM[i - 1], as: "r", ao: -10, b: k, bs: "l", bo: -10, dash: !!dashed["nx" + i] });
              edges.push({ id: "pr" + i, a: k, as: "l", ao: 10, b: NM[i - 1], bs: "r", bo: 10, dash: !!dashed["pr" + i] });
            }
          });
          var g = function (k, p, n, op, on) { return dSeg(p == null ? PR[k] : p, DT[k], n == null ? NX[k] : n, op, on); };
          if (kind === "del") {
            nodes.push(code("CODE", 20, 330, 500, "删除 p 的后继 q", [["0", "q = p->next;"], ["①", "p->next = q->next;"], ["②", "q->next->prior = p;"], ["③", "free(q);"]]));
            edges.push({ id: "b1", a: "a1", as: "t", ao: 40, b: "a3", bs: "t", bo: -40, my: 70, t: "①" });
            edges.push({ id: "b2", a: "a3", as: "b", ao: -40, b: "a1", bs: "b", bo: 40, my: 250, t: "②" });
            S.push({ t: "初始：删除 p 的后继 q", d: "p 指向 a1，q = p->next 指向要删除的 a2。双链表删除要改两根指针：a1 的 next 和 a3 的 prior（图中两根虚线）。", on: ["a1", "a2", "CODE"], set: { CODE: { hi: 0 } }, kv: { "当前语句": "0", "表长": "3" } });
            S.push({ t: "① p->next = q->next", d: "a1 的后继改为 a3，正向链跳过 a2。", on: ["a1", "a3", "CODE"], go: ["b1"], set: { a1: { segs: g("a1", null, "→a3", 0, 1) }, CODE: { hi: 1 } }, kv: { "当前语句": "①" } });
            S.push({ t: "② q->next->prior = p", d: "q->next 就是 a3，把它的前驱改为 a1，反向链也跳过 a2。", on: ["a3", "a1", "CODE"], go: ["b2"], set: { a1: { segs: g("a1", null, "→a3") }, a3: { segs: g("a3", "←a1", null, 1) }, CODE: { hi: 2 } }, kv: { "当前语句": "②" }, tip: "若 q 是最后一个结点，q->next 为 NULL，这一句要先判断 q->next != NULL 才能执行。" });
            S.push({ t: "③ free(q)", d: "两条链都已绕过 a2，释放它。", on: ["a2", "CODE"], set: { a2: { t: "a2（已释放）", segs: dSeg("—", "—", "—") }, a3: { segs: g("a3", "←a1") }, CODE: { hi: 3 } }, kv: { "当前语句": "③", "表长": "2" } });
            S.push({ t: "结果：L ⇄ a1 ⇄ a3", d: "①② 的顺序可以交换，因为 q 一直保存着被删结点，两句都通过 q 找到 a1、a3。", on: ["L", "a1", "a3"], go: ["b1", "b2"], set: { CODE: { hi: -1 } }, tip: "双链表删除给定结点 *q 是 O(1)（能直接找到前驱）；单链表要先找前驱，O(n)。" });
            return { w: 980, h: 470, nodes: nodes, edges: edges, steps: S };
          }
          nodes.push(fNode("s", 415, 330, 150, "s（新结点）", dSeg("", "", "")));
          nodes.push({ id: "LOST", k: "box", x: 600, y: 440, w: 360, h: 60, t: "从 p 出发能否找到 a2", v: "能：p->next" });
          edges.push({ id: "n4", a: "a1", as: "b", ao: 55, b: "s", bs: "l", bo: -10, t: kind === "bad" ? "1" : "④", lp: [360, 240] });
          edges.push({ id: "n3", a: "s", as: "l", ao: 10, b: "a1", bs: "b", bo: 30, t: kind === "bad" ? "4" : "③", lp: [335, 300] });
          if (kind === "ins") {
            nodes.push(code("CODE", 20, 420, 500, "在 p 之后插入 s（正确顺序）", [["①", "s->next = p->next;"], ["②", "p->next->prior = s;"], ["③", "s->prior = p;"], ["④", "p->next = s;"]]));
            edges.push({ id: "n1", a: "s", as: "r", ao: -10, b: "a2", bs: "b", bo: -55, t: "①", lp: [620, 240] });
            edges.push({ id: "n2", a: "a2", as: "b", ao: -30, b: "s", bs: "r", bo: 10, t: "②", lp: [645, 300] });
            S.push({ t: "初始：在 p 之后插入 s", d: "p 指向 a1，要把 s 插到 a1 与 a2 之间。需要改 4 根指针：s 的两根、a1 的 next、a2 的 prior（后两根是图中的虚线）。", on: ["a1", "a2"], kv: { "当前语句": "—", "表长": "3", "a2 可达": "是" } });
            S.push({ t: "申请新结点 s", d: "s = (DNode *)malloc(sizeof(DNode)); s->data = e;  s 的 prior、next 还没有赋值。", on: ["s"], set: { s: { segs: dSeg("?", "e", "?") } } });
            S.push({ t: "① s->next = p->next", d: "s 的后继指向 a2。这时 p->next 仍是 a2，原链完好。", on: ["s", "a2", "CODE"], go: ["n1"], set: { s: { segs: dSeg("?", "e", "→a2", 0, 1) }, CODE: { hi: 0 } }, kv: { "当前语句": "①" } });
            S.push({ t: "② p->next->prior = s", d: "p->next 还是 a2，所以这句把 a2 的前驱改成 s，a2 → a1 的原指针（虚线）被覆盖。", on: ["a2", "s", "CODE"], go: ["n2"], set: { s: { segs: dSeg("?", "e", "→a2") }, a2: { segs: g("a2", "←s", null, 1) }, CODE: { hi: 1 } }, kv: { "当前语句": "②" }, tip: "这一句借助 p->next 找到 a2，所以必须在 ④ 修改 p->next 之前执行。若 p 是尾结点（p->next == NULL），要先判断再执行。" });
            S.push({ t: "③ s->prior = p", d: "s 的前驱指向 a1。这句只改 s 自己，放在 ④ 之前的任何位置都可以。", on: ["s", "a1", "CODE"], go: ["n3"], set: { a2: { segs: g("a2", "←s") }, s: { segs: dSeg("←a1", "e", "→a2", 1) }, CODE: { hi: 2 } }, kv: { "当前语句": "③" } });
            S.push({ t: "④ p->next = s", d: "最后让 a1 指向 s，原来的 a1 → a2（虚线）被覆盖。此时 a2 已经能通过 s->next 找到，不会丢失。", on: ["a1", "s", "CODE", "LOST"], go: ["n4"], set: { s: { segs: dSeg("←a1", "e", "→a2") }, a1: { segs: g("a1", null, "→s", 0, 1) }, CODE: { hi: 3 }, LOST: { v: "能：p->next->next" } }, kv: { "当前语句": "④", "表长": "4" }, tip: "①② 必须在 ④ 之前；④ 一旦先执行，p 原来的后继就再也找不到了。" });
            S.push({ t: "结果：L ⇄ a1 ⇄ s ⇄ a2 ⇄ a3", d: "正向、反向两条链都已接通。双链表插入只改 4 根指针，O(1)。", on: ["L", "a1", "s", "a2", "a3"], go: ["n4", "n1", "n2", "n3"], set: { a1: { segs: g("a1", null, "→s") }, CODE: { hi: -1 } }, tip: "记忆口诀：先搞定 s 的两根和后继的 prior，最后才动 p->next。" });
            return { w: 980, h: 560, nodes: nodes, edges: edges, steps: S };
          }
          /* 错误顺序：先执行 p->next = s */
          nodes.push(code("CODE", 20, 420, 500, "错误顺序：先改了 p->next", [["1", "p->next = s;"], ["2", "s->next = p->next;"], ["3", "p->next->prior = s;"], ["4", "s->prior = p;"]]));
          edges.push({ id: "loop", a: "s", as: "r", ao: -10, b: "s", bs: "t", bo: 40, pts: [[600, 344], [600, 305], [530, 305]], t: "2" });
          S.push({ t: "初始：同样在 p 之后插入 s", d: "p 指向 a1，后继是 a2。这次把 ④ p->next = s 放到最前面执行，看看会发生什么。", on: ["a1", "a2"], kv: { "当前语句": "—", "a2 可达": "是" } });
          S.push({ t: "申请新结点 s", d: "s = (DNode *)malloc(sizeof(DNode)); s->data = e;", on: ["s"], set: { s: { segs: dSeg("?", "e", "?") } } });
          S.push({ t: "1. 先执行 p->next = s", d: "a1 的 next 改为 s。原来唯一记着 a2 地址的指针 p->next 被覆盖了，而 a2 的地址还没有保存到别处。", on: ["a1", "s", "CODE", "LOST"], go: ["n4"], set: { a1: { segs: g("a1", null, "→s", 0, 1) }, s: { segs: dSeg("?", "e", "?") }, CODE: { hi: 0, bad: 0 }, LOST: { v: "不能 ✗（地址已丢）" } }, kv: { "当前语句": "1", "a2 可达": "否" }, tip: "从这一刻起，从 p 出发沿 next 再也到不了 a2：后继丢失。" });
          S.push({ t: "2. s->next = p->next：s 指向自己", d: "p->next 现在是 s 本身，于是 s->next = s，形成自环；本该指向 a2 的指针指错了。", on: ["s", "CODE"], go: ["loop"], set: { a1: { segs: g("a1", null, "→s") }, s: { segs: dSeg("?", "e", "→s", 0, 1) }, CODE: { hi: 1, bad: 1 } }, kv: { "当前语句": "2" } });
          S.push({ t: "3. p->next->prior = s：又改错了结点", d: "p->next 仍是 s，所以这句执行的是 s->prior = s；本该修改的 a2->prior 没有被改，仍指向 a1。", on: ["s", "a2", "CODE"], set: { s: { segs: dSeg("←s", "e", "→s", 1) }, CODE: { hi: 2, bad: 2 } }, kv: { "当前语句": "3" } });
          S.push({ t: "4. s->prior = p", d: "这一句本身没错，s 的前驱改为 a1。但前面造成的断链已无法挽回。", on: ["s", "a1", "CODE"], go: ["n3"], set: { s: { segs: dSeg("←a1", "e", "→s", 1) }, CODE: { hi: 3, bad: -1 } }, kv: { "当前语句": "4" } });
          S.push({ t: "结果：链在 s 处断开", d: "从 L 向后走：L → a1 → s → s → …，陷入自环，a2、a3 再也访问不到；而 a2->prior 仍指向 a1，两条链不再一致。", on: ["s", "a2", "a3", "LOST"], go: ["n4", "loop"], set: { s: { segs: dSeg("←a1", "e", "→s") }, CODE: { hi: -1 } }, kv: { "a2 可达": "否（后继丢失）" }, tip: "正确顺序：① s->next = p->next；② p->next->prior = s；③ s->prior = p；④ p->next = s。①② 必须在 ④ 之前。" });
          return { w: 980, h: 560, nodes: nodes, edges: edges, steps: S };
        }

        PROC.push({
          id: "linklist", name: "单链表与双链表的插入删除", sub: "ds",
          lead: "每一步只改一根指针：看清先改哪根、为什么不能反过来。虚线是将被改掉的原指针，浅灰细线是尚未赋值的新指针。",
          note: ["单链表在 p 之后插入：s->next = p->next; p->next = s; 两句不能颠倒。", "双链表在 p 之后插入：s->next = p->next; p->next->prior = s; s->prior = p; p->next = s; 前两句必须在最后一句之前。", "单链表按位序插入、删除都要先找第 i − 1 个结点，时间复杂度 O(n)；给定结点的后插 O(1)。", "删除结点要先用 q 保存被删结点，改完指针再 free(q)。", "头插法建表得到的顺序与输入相反；尾插法需要一个尾指针 r，顺序相同。"],
          modes: [
            { name: "单链表·头插法", make: function () { return sll("head"); } },
            { name: "单链表·按位序插入", make: function () { return sll("pos"); } },
            { name: "单链表·删除", make: function () { return sll("del"); } },
            { name: "双链表·插入", make: function () { return dll("ins"); } },
            { name: "双链表·错误顺序", make: function () { return dll("bad"); } },
            { name: "双链表·删除", make: function () { return dll("del"); } }
          ]
        });
