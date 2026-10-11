      /* 过程图解 · 数据结构：链表插入删除、循环队列、递归调用栈、中序线索化、树森林与二叉树、堆、红黑树插入、外部排序
         约定见各图解的注释与说明文字。结点用矩形，指针用连线；连线一旦画上就一直在，所以“被改掉的原指针”画成虚线，
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
            S.push({ t: "结果：L ⇄ a1 ⇄ s ⇄ a2 ⇄ a3", d: "正向、反向两条链都已接通。双链表插入只改 4 根指针，O(1)。", on: ["L", "a1", "s", "a2", "a3"], go: ["n4", "n1", "n2", "n3"], set: { a1: { segs: g("a1", null, "→s") }, CODE: { hi: -1 } }, tip: "顺序要点：p->next 是找到原后继的唯一线索，所以它必须最后改；s 的两个指针和原后继的 prior 都要在它之前处理完。" });
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

        /* ===================== 2. 循环队列的队空与队满 ===================== */
        /* 约定：front 指向队头元素，rear 指向队尾元素的下一个位置；MaxSize = 6 */
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

        /* ===================== 4. 二叉树的中序线索化 ===================== */
        /* 树：A(B(D, ∧), C(E, F))，中序 D B A E C F；结点横坐标按中序次序排列，线索都在相邻两列之间走，不会交叉 */
        function threadSpec(mode) {
          var P = { A: [320, 60], B: [215, 170], C: [530, 170], D: [110, 290], E: [425, 290], F: [635, 290] };
          var nodes = [], edges = [], S = [];
          each(P, function (k, p) { nodes.push({ id: k, k: "box", x: p[0], y: p[1], w: 70, h: 44, t: k }); });
          nodes.push({ id: "NL", k: "term", x: 100, y: 400, w: 90, h: 34, t: "NULL", sm: 1 });
          nodes.push({ id: "NR", k: "term", x: 625, y: 400, w: 90, h: 34, t: "NULL", sm: 1 });
          edges.push({ id: "tAB", a: "A", as: "l", b: "B", bs: "t" }, { id: "tAC", a: "A", as: "r", b: "C", bs: "t" }, { id: "tBD", a: "B", as: "l", b: "D", bs: "t" },
            { id: "tCE", a: "C", as: "l", b: "E", bs: "t" }, { id: "tCF", a: "C", as: "r", b: "F", bs: "t" });
          edges.push({ id: "hDl", a: "D", as: "b", b: "NL", bs: "t", dash: 1 }, { id: "hDr", a: "D", as: "r", b: "B", bs: "b", bo: -15, dash: 1 },
            { id: "hBr", a: "B", as: "r", b: "A", bs: "b", bo: -20, dash: 1 }, { id: "hEl", a: "E", as: "l", b: "A", bs: "b", bo: 20, dash: 1 },
            { id: "hEr", a: "E", as: "r", b: "C", bs: "b", bo: -15, dash: 1 }, { id: "hFl", a: "F", as: "l", b: "C", bs: "b", bo: 15, dash: 1 }, { id: "hFr", a: "F", as: "b", b: "NR", bs: "t", dash: 1 });
          var ORD = ["D", "B", "A", "E", "C", "F"];
          var R = { D: ["0", "0", "NULL", "NULL"], B: ["0", "0", "D", "NULL"], A: ["0", "0", "B", "C"], E: ["0", "0", "NULL", "NULL"], C: ["0", "0", "E", "F"], F: ["0", "0", "NULL", "NULL"] };
          var FIN = { D: ["1", "1", "NULL", "B"], B: ["0", "1", "D", "A"], A: ["0", "0", "B", "C"], E: ["1", "1", "A", "C"], C: ["0", "0", "E", "F"], F: ["1", "1", "C", "NULL"] };
          var cur = mode === "walk" ? FIN : R;
          function rows() { return [["结点", "ltag", "rtag", "lchild", "rchild"]].concat(ORD.map(function (k) { return [k].concat(cur[k]); })); }
          nodes.push({ id: "TAG", k: "table", x: 720, y: 40, w: 240, h: 26 + 7 * 22 + 6, rh: 22, t: "结点的标志域与指针域", cols: [0.16, 0.16, 0.16, 0.27], rows: rows() });
          nodes.push({ id: "PRE", k: "reg", x: 720, y: 270, w: 110, h: 56, t: mode === "walk" ? "p（当前）" : "pre", v: mode === "walk" ? "—" : "NULL" });
          nodes.push({ id: "CUR", k: "reg", x: 850, y: 270, w: 110, h: 56, t: mode === "walk" ? "下一步" : "p（当前）", v: "—" });
          nodes.push({ id: "SEQ", k: "box", x: 720, y: 360, w: 240, h: 56, t: mode === "walk" ? "已访问序列" : "中序序列", v: mode === "walk" ? "—" : "D B A E C F", sm: 1 });
          var row = function (k) { return ORD.indexOf(k) + 1; };
          function upd(k, i, v) { cur = JSON.parse(JSON.stringify(cur)); cur[k][i] = v; }
          if (mode === "walk") {
            var seen = [];
            var vis = function (k) { seen.push(k); return seen.join(" "); };
            S.push({ t: "已线索化的二叉树", d: "中序线索化后，7 个空指针域都变成了线索（虚线）。利用线索可以不用栈、不用递归完成中序遍历：先找第一个结点，再反复找后继。", on: ["TAG"], kv: { "访问序列": "—" } });
            S.push({ t: "Firstnode：从根 A 沿左孩子向下", d: "A 的 ltag = 0，左指针是孩子，走到 B；B 的 ltag = 0，再走到 D。", on: ["A", "B", "D"], go: ["tAB", "tBD"], set: { TAG: { hi: [row("A"), row("B")] }, PRE: { v: "A → B → D" } } });
            S.push({ t: "D 的 ltag = 1：D 是中序第一个结点", d: "ltag = 1 说明 D 没有左孩子，它就是最左下的结点，访问 D。", on: ["D"], set: { TAG: { hi: row("D") }, PRE: { v: "D" }, SEQ: { v: vis("D") } }, kv: { "访问序列": seen.join(" ") }, tip: "中序第一个结点 = 从根出发一直沿左指针走到 ltag = 1 的结点（不一定是叶子）。" });
            S.push({ t: "D 的 rtag = 1：后继就是 rchild = B", d: "rtag = 1 时右指针就是线索，直接指向中序后继 B，访问 B。", on: ["D", "B"], go: ["hDr"], set: { TAG: { hi: row("D") }, PRE: { v: "B" }, CUR: { v: "走线索" }, SEQ: { v: vis("B") } }, kv: { "访问序列": seen.join(" ") } });
            S.push({ t: "B 的 rtag = 1：后继是 A", d: "B 的右指针也是线索，直接到 A，访问 A。", on: ["B", "A"], go: ["hBr"], set: { TAG: { hi: row("B") }, PRE: { v: "A" }, SEQ: { v: vis("A") } }, kv: { "访问序列": seen.join(" ") } });
            S.push({ t: "A 的 rtag = 0：到右子树中找最左结点", d: "A 有右孩子 C，后继是右子树的中序第一个结点：从 C 沿左指针走到 E，E 的 ltag = 1，停下，访问 E。", on: ["A", "C", "E"], go: ["tAC", "tCE"], set: { TAG: { hi: [row("A"), row("C"), row("E")] }, PRE: { v: "E" }, CUR: { v: "找最左" }, SEQ: { v: vis("E") } }, kv: { "访问序列": seen.join(" ") }, tip: "Nextnode(p)：rtag = 1 时后继就是 rchild；rtag = 0 时后继是右子树中最左下的结点。" });
            S.push({ t: "E 的 rtag = 1：后继是 C", d: "沿线索到 C，访问 C。", on: ["E", "C"], go: ["hEr"], set: { TAG: { hi: row("E") }, PRE: { v: "C" }, CUR: { v: "走线索" }, SEQ: { v: vis("C") } }, kv: { "访问序列": seen.join(" ") } });
            S.push({ t: "C 的 rtag = 0：右子树最左结点是 F", d: "C 的右孩子 F 的 ltag = 1，F 本身就是右子树的第一个结点，访问 F。", on: ["C", "F"], go: ["tCF"], set: { TAG: { hi: [row("C"), row("F")] }, PRE: { v: "F" }, CUR: { v: "找最左" }, SEQ: { v: vis("F") } }, kv: { "访问序列": seen.join(" ") } });
            S.push({ t: "F 的 rtag = 1 且 rchild = NULL：遍历结束", d: "F 是中序最后一个结点，它的后继线索为 NULL，遍历结束。得到 D B A E C F。", on: ["F", "NR"], go: ["hFr"], set: { TAG: { hi: row("F") }, PRE: { v: "NULL" }, CUR: { v: "结束" } }, kv: { "访问序列": seen.join(" ") }, tip: "线索遍历不需要栈，空间复杂度 O(1)，时间 O(n)。中序线索树找前驱对称：ltag = 1 看 lchild，否则找左子树最右下结点。" });
            return { w: 980, h: 460, nodes: nodes, edges: edges, steps: S };
          }
          S.push({ t: "初始：6 个结点、7 个空指针域", d: "n 个结点的二叉链表有 2n 个指针域，其中 n − 1 个指向孩子，剩下 n + 1 = 7 个为空。中序线索化把它们改为指向中序前驱（左）或后继（右），中序序列为 D B A E C F。", on: ["TAG", "SEQ"], kv: { "已建线索": "0 / 7" } });
          S.push({ t: "InThread(A)：先递归处理左子树", d: "中序线索化就是一次中序遍历，访问结点时顺带修改指针。从 A 递归到左孩子 B，再到 D，D 没有左孩子，开始“访问”D。pre 初值为 NULL。", on: ["A", "B", "D"], go: ["tAB", "tBD"], set: { CUR: { v: "D" } } });
          upd("D", 0, "1");
          S.push({ t: "访问 D：左指针为空 → 前驱线索", d: "D->lchild == NULL，令 D->lchild = pre = NULL，D->ltag = 1。pre 为 NULL，没有前驱需要处理。然后 pre = D。", on: ["D", "NL", "TAG"], go: ["hDl"], set: { TAG: { rows: rows(), hi: row("D") }, PRE: { v: "D" }, CUR: { v: "D" } }, kv: { "已建线索": "1 / 7" }, tip: "第一个结点的前驱线索指向 NULL，但 ltag 仍要置 1。" });
          upd("D", 1, "1"); upd("D", 3, "B");
          S.push({ t: "访问 B：pre = D 的右指针为空 → 后继线索", d: "B->lchild = D 不空，不改。pre = D 且 D->rchild == NULL，令 D->rchild = B，D->rtag = 1。然后 pre = B。", on: ["B", "D", "TAG"], go: ["hDr"], set: { TAG: { rows: rows(), hi: row("D") }, PRE: { v: "B" }, CUR: { v: "B" } }, kv: { "已建线索": "2 / 7" }, tip: "后继线索是在“访问下一个结点时”才补给 pre 的，因为访问 pre 时还不知道它的后继是谁。" });
          upd("B", 1, "1"); upd("B", 3, "A");
          S.push({ t: "访问 A：给 pre = B 建后继线索", d: "A->lchild = B 不空。pre = B 且 B->rchild == NULL，令 B->rchild = A，B->rtag = 1。然后 pre = A，转去 A 的右子树。", on: ["A", "B", "TAG"], go: ["hBr"], set: { TAG: { rows: rows(), hi: row("B") }, PRE: { v: "A" }, CUR: { v: "A" } }, kv: { "已建线索": "3 / 7" } });
          upd("E", 0, "1"); upd("E", 2, "A");
          S.push({ t: "访问 E：左指针为空 → 前驱是 A", d: "从 A 递归到 C，再到 C 的左孩子 E。E->lchild == NULL，令 E->lchild = pre = A，E->ltag = 1。pre = A 的右孩子 C 不空，不改。然后 pre = E。", on: ["E", "A", "TAG"], go: ["tAC", "tCE", "hEl"], set: { TAG: { rows: rows(), hi: row("E") }, PRE: { v: "E" }, CUR: { v: "E" } }, kv: { "已建线索": "4 / 7" } });
          upd("E", 1, "1"); upd("E", 3, "C");
          S.push({ t: "访问 C：给 pre = E 建后继线索", d: "C->lchild = E 不空。pre = E 且 E->rchild == NULL，令 E->rchild = C，E->rtag = 1。然后 pre = C。", on: ["C", "E", "TAG"], go: ["hEr"], set: { TAG: { rows: rows(), hi: row("E") }, PRE: { v: "C" }, CUR: { v: "C" } }, kv: { "已建线索": "5 / 7" } });
          upd("F", 0, "1"); upd("F", 2, "C");
          S.push({ t: "访问 F：左指针为空 → 前驱是 C", d: "F->lchild == NULL，令 F->lchild = pre = C，F->ltag = 1。pre = C 的右孩子 F 不空，不改。然后 pre = F。", on: ["F", "C", "TAG"], go: ["tCF", "hFl"], set: { TAG: { rows: rows(), hi: row("F") }, PRE: { v: "F" }, CUR: { v: "F" } }, kv: { "已建线索": "6 / 7" } });
          upd("F", 1, "1");
          S.push({ t: "遍历结束：单独处理最后一个结点", d: "中序遍历结束时 pre 指向最后一个结点 F。主调函数还要补一句：pre->rchild = NULL; pre->rtag = 1;", on: ["F", "NR", "TAG", "PRE"], go: ["hFr"], set: { TAG: { rows: rows(), hi: row("F") }, CUR: { v: "遍历结束" } }, kv: { "已建线索": "7 / 7" }, tip: "CreateInThread 里最后这一句最容易漏写：最后一个结点的右指针不会在递归中被处理。" });
          S.push({ t: "结果：中序线索二叉树", d: "ltag / rtag 为 0 表示指针指向孩子，为 1 表示线索。7 条线索：D 的前驱 NULL、D→B、B→A、E 的前驱 A、E→C、F 的前驱 C、F 的后继 NULL。", on: ["D", "B", "A", "E", "C", "F", "TAG"], go: ["hDl", "hDr", "hBr", "hEl", "hEr", "hFl", "hFr"], set: { TAG: { hi: -1 }, CUR: { v: "—" } }, tip: "线索二叉树是一种物理结构（加了线索的二叉链表）。先序、后序线索化同理，只是“访问”的时机不同；后序线索树找后继仍需要知道双亲。" });
          return { w: 980, h: 460, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "thread", name: "二叉树的中序线索化", sub: "ds",
          lead: "一次中序遍历，pre 指针紧跟在当前结点后面：左指针空就指向 pre，pre 的右指针空就指向当前结点。",
          note: ["n 个结点的二叉链表有 n + 1 个空指针域，线索化就是利用它们。", "ltag = 0：lchild 指向左孩子；ltag = 1：lchild 指向前驱。rtag 同理指向后继。", "visit(q)：若 q->lchild 为空则 q->lchild = pre、ltag = 1；若 pre 非空且 pre->rchild 为空则 pre->rchild = q、rtag = 1；最后 pre = q。", "遍历结束后要单独处理最后一个结点：pre->rchild = NULL，pre->rtag = 1。", "中序线索树找后继：rtag = 1 直接取 rchild，否则取右子树最左下结点。"],
          modes: [{ name: "中序线索化", make: function () { return threadSpec("build"); } }, { name: "利用线索遍历", make: function () { return threadSpec("walk"); } }]
        });

        /* ===================== 5. 树、森林与二叉树的转换 ===================== */
        function forestSpec(mode) {
          var forest = mode === "forest", trav = mode === "trav";
          var nodes = [], edges = [], S = [];
          var LZ, RZ, L, B, W, H, LE, BE, ORDER;
          if (!forest) {
            LZ = [10, 30, 430, 420]; RZ = [465, 30, 495, 420]; W = 56; H = 40;
            L = { A: [205, 70], B: [85, 170], C: [205, 170], D: [325, 170], E: [30, 270], F: [140, 270], G: [325, 270] };
            LE = [["A", "B", -10, 0], ["A", "C", 0, 1], ["A", "D", 10, 1], ["B", "E", -10, 0], ["B", "F", 10, 1], ["D", "G", 0, 0]];
            var bx = function (i) { return 485 + i * 66; };
            B = { E: [bx(0), 2], F: [bx(1), 3], B: [bx(2), 1], C: [bx(3), 2], G: [bx(4), 4], D: [bx(5), 3], A: [bx(6), 0] };
            BE = [["A", "B", 0, 0], ["B", "E", -10, 0], ["B", "C", 10, 1], ["E", "F", 0, 1], ["C", "D", 0, 1], ["D", "G", 0, 0]];
            ORDER = ["A", "B", "E", "F", "C", "D", "G"];
          } else {
            LZ = [10, 30, 512, 420]; RZ = [535, 30, 435, 420]; W = 56; H = 40;
            L = { A: [115, 70], B: [25, 170], C: [115, 170], D: [205, 170], E: [290, 70], F: [290, 170], G: [410, 70], H: [365, 170], I: [455, 170] };
            LE = [["A", "B", -10, 0], ["A", "C", 0, 1], ["A", "D", 10, 1], ["E", "F", 0, 0], ["G", "H", -10, 0], ["G", "I", 10, 1]];
            var fx = function (i) { return 545 + i * 47; };
            B = { B: [fx(0), 1], C: [fx(1), 2], D: [fx(2), 3], A: [fx(3), 0], F: [fx(4), 2], E: [fx(5), 1], H: [fx(6), 3], I: [fx(7), 4], G: [fx(8), 2] };
            BE = [["A", "B", -8, 0], ["A", "E", 8, 1], ["B", "C", 0, 1], ["C", "D", 0, 1], ["E", "F", -8, 0], ["E", "G", 8, 1], ["G", "H", 0, 0], ["H", "I", 0, 1]];
          }
          nodes.push({ id: "ZL", k: "zone", x: LZ[0], y: LZ[1], w: LZ[2], h: LZ[3], t: forest ? "森林（三棵树）" : "原来的树" });
          nodes.push({ id: "ZR", k: "zone", x: RZ[0], y: RZ[1], w: RZ[2], h: RZ[3], t: "对应的二叉树（左孩子右兄弟）" });
          each(L, function (k, p) { nodes.push({ id: "t" + k, k: "box", x: p[0], y: p[1], w: W, h: H, t: k }); });
          var bw = forest ? 42 : 56, bh = forest ? 36 : 40;
          each(B, function (k, p) { nodes.push({ id: "b" + k, k: "box", x: p[0], y: 70 + p[1] * 80, w: bw, h: bh, t: trav ? k : "" }); });
          LE.forEach(function (e) { edges.push({ id: "e" + e[0] + e[1], a: "t" + e[0], as: "b", ao: e[2], b: "t" + e[1], bs: "t", t: !trav && e[3] ? "×" : undefined }); });
          if (!trav) {
            var sib = forest ? [["B", "C"], ["C", "D"], ["H", "I"], ["A", "E"], ["E", "G"]] : [["B", "C"], ["C", "D"], ["E", "F"]];
            sib.forEach(function (p) { edges.push({ id: "s" + p[0] + p[1], a: "t" + p[0], b: "t" + p[1], dash: 1 }); });
          }
          BE.forEach(function (e) { edges.push({ id: "b" + e[0] + e[1], a: "b" + e[0], as: "b", ao: e[2], b: "b" + e[1], bs: "t", dash: !!e[3] }); });
          var put = {};
          function place(k, t, d, go, tip) {
            put["b" + k] = { t: k };
            var s = { t: t, d: d, on: ["t" + k, "b" + k], set: JSON.parse(JSON.stringify(put)), go: go };
            if (tip) s.tip = tip;
            S.push(s);
          }
          if (trav) {
            var pre = [], post = [];
            S.push({ t: "树与二叉树的遍历对应", d: "左边是原树，右边是它转换得到的二叉树（实线是左孩子，虚线是右孩子，即原来的兄弟）。下面同时走一遍，看两边的访问次序。", on: [], kv: { "树的先根": "—", "二叉树先序": "—" } });
            ["A", "B", "E", "F", "C", "D", "G"].forEach(function (k, i) {
              pre.push(k);
              S.push({ t: "先根第 " + (i + 1) + " 个：" + k, d: i === 0 ? "树的先根遍历：先访问根，再依次先根遍历每棵子树。二叉树先序：根、左、右。两边第一个都是 A。" : "树中访问 " + k + "；二叉树先序遍历此时也恰好访问 " + k + "。", on: ["t" + k, "b" + k], kv: { "树的先根": pre.join(" "), "二叉树先序": pre.join(" ") } });
            });
            S.push({ t: "结论一：树的先根 = 二叉树的先序", d: "因为二叉树中“先左”就是先走第一个孩子，“后右”就是再走兄弟，和先根遍历的次序一致。", on: [], kv: { "树的后根": "—", "二叉树中序": "—" }, tip: "森林的先序遍历 = 对应二叉树的先序遍历。" });
            ["E", "F", "B", "C", "G", "D", "A"].forEach(function (k, i) {
              post.push(k);
              S.push({ t: "后根第 " + (i + 1) + " 个：" + k, d: i === 0 ? "树的后根遍历：先依次后根遍历每棵子树，最后访问根。二叉树中序：左、根、右。两边第一个都是 E。" : "树中访问 " + k + "；二叉树中序遍历此时也恰好访问 " + k + "。", on: ["t" + k, "b" + k], kv: { "树的后根": post.join(" "), "二叉树中序": post.join(" ") } });
            });
            S.push({ t: "结论二：树的后根 = 二叉树的中序", d: "结点 x 在二叉树中的左子树就是它原来的全部子孙，中序先访问左子树再访问 x，正是“先子树后根”。", on: [], tip: "森林的中序遍历（也有资料叫“后序遍历”，即依次对每棵树做后根遍历）= 对应二叉树的中序遍历。树没有“中根遍历”。" });
            return { w: 980, h: 470, nodes: nodes, edges: edges, steps: S };
          }
          if (!forest) {
            S.push({ t: "原树：A 有三个孩子", d: "树的结点孩子个数不定。孩子兄弟表示法（二叉链表）：左指针指向第一个孩子，右指针指向右边相邻的兄弟，于是任何树都能用二叉树存储。", on: ["tA", "tB", "tC", "tD", "tE", "tF", "tG"] });
            S.push({ t: "第一步 加线：兄弟之间连线", d: "在所有相邻的兄弟结点之间加一条线：B—C、C—D、E—F（虚线）。", on: ["tB", "tC", "tD", "tE", "tF"], go: ["sBC", "sCD", "sEF"] });
            S.push({ t: "第二步 抹线：只留与第一个孩子的连线", d: "对每个结点，只保留它与第一个孩子的连线，抹去与其他孩子的连线：A—C、A—D、B—F（标 × 的线）。", on: ["tA", "tB"], go: ["eAC", "eAD", "eBF"], tip: "抹线后每个结点最多剩两根线：一根向下到第一个孩子，一根向右到兄弟。" });
            place("A", "第三步 旋转：A 成为二叉树的根", "以树根为轴顺时针转 45°：向下的线变成左孩子，向右的兄弟线变成右孩子。A 是树根，没有兄弟。", []);
            place("B", "B 是 A 的第一个孩子 → A 的左孩子", "第一个孩子变成左孩子。", ["bAB"]);
            place("E", "E 是 B 的第一个孩子 → B 的左孩子", "同理，E 挂在 B 的左边。", ["bBE"]);
            place("F", "F 是 E 的右兄弟 → E 的右孩子", "兄弟变成右孩子（虚线）。", ["bEF"]);
            place("C", "C 是 B 的右兄弟 → B 的右孩子", "C 原本是 A 的第二个孩子，现在挂在 B 的右边。", ["bBC"]);
            place("D", "D 是 C 的右兄弟 → C 的右孩子", "兄弟链 B—C—D 在二叉树里变成一条向右下的右链。", ["bCD"]);
            place("G", "G 是 D 的第一个孩子 → D 的左孩子", "转换完成。", ["bDG"]);
            S.push({ t: "结果：根结点没有右子树", d: "树根没有兄弟，所以由树转换得到的二叉树，根的右子树一定为空。", on: ["bA", "bB", "bC", "bD", "bE", "bF", "bG"], go: ["bAB", "bBE", "bBC", "bEF", "bCD", "bDG"], tip: "二叉树中结点 x 的左子树 = 它在树中的全部子孙；x 沿右链能到达的结点 = 它的右兄弟们。" });
          } else {
            S.push({ t: "森林：三棵互不相交的树", d: "森林转二叉树：先把每棵树各自转成二叉树，再把第二棵、第三棵依次作为前一棵根的右子树。", on: ["tA", "tE", "tG"] });
            S.push({ t: "每棵树内部：加线、抹线", d: "兄弟之间加线：B—C—D、H—I；每个结点只保留与第一个孩子的连线，抹去 A—C、A—D、G—I。", on: ["tB", "tC", "tD", "tH", "tI"], go: ["sBC", "sCD", "sHI", "eAC", "eAD", "eGI"] });
            S.push({ t: "各树的根视为兄弟，相连", d: "把三棵树的根 A、E、G 看作兄弟，用线连起来：A—E—G。", on: ["tA", "tE", "tG"], go: ["sAE", "sEG"], tip: "这一步就是森林与单棵树转换的唯一区别。" });
            place("A", "A 成为二叉树的根", "第一棵树的根作为整棵二叉树的根。", []);
            place("B", "B → A 的左孩子", "A 的第一个孩子。", ["bAB"]);
            place("C", "C → B 的右孩子", "B 的右兄弟。", ["bBC"]);
            place("D", "D → C 的右孩子", "C 的右兄弟，第一棵树转换完毕。", ["bCD"]);
            place("E", "E → A 的右孩子", "第二棵树的根 E 是 A 的“兄弟”，挂到 A 的右边。", ["bAE"], "二叉树根的右子树不空，说明它对应的是森林而不是一棵树。");
            place("F", "F → E 的左孩子", "E 的第一个孩子。", ["bEF"]);
            place("G", "G → E 的右孩子", "第三棵树的根接在 E 的右边。", ["bEG"]);
            place("H", "H → G 的左孩子", "G 的第一个孩子。", ["bGH"]);
            place("I", "I → H 的右孩子", "H 的右兄弟。转换完成。", ["bHI"]);
            S.push({ t: "结果：根沿右链就是各棵树的根", d: "从二叉树的根 A 一直向右走：A → E → G，恰好是森林中三棵树的根，所以森林有 3 棵树。", on: ["bA", "bE", "bG"], go: ["bAE", "bEG"], kv: { "森林中树的棵数": "3" }, tip: "二叉树转森林反过来：断开根的右链，每段各自还原成一棵树。森林先序 = 二叉树先序，森林中序 = 二叉树中序。" });
          }
          return { w: 980, h: 470, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "forest", name: "树、森林与二叉树的转换", sub: "ds",
          lead: "左孩子右兄弟：加线、抹线、旋转三步把树变成二叉树；森林再把各树的根用右指针串起来。",
          note: ["树转二叉树：兄弟加线 → 只留与第一个孩子的连线 → 旋转 45°；左指针 = 第一个孩子，右指针 = 右兄弟。", "树转换得到的二叉树，根结点没有右子树；森林转换得到的二叉树，根的右链上是其余各树的根。", "树的先根遍历 = 二叉树先序；树的后根遍历 = 二叉树中序。", "森林的先序 = 二叉树先序；森林的中序（各树依次后根）= 二叉树中序。", "常考计数：森林有 n 个非终端结点，则对应二叉树中右指针域为空的结点有 n + 1 个。"],
          modes: [{ name: "树 → 二叉树", make: function () { return forestSpec("tree"); } }, { name: "森林 → 二叉树", make: function () { return forestSpec("forest"); } }, { name: "遍历对应关系", make: function () { return forestSpec("trav"); } }]
        });

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
          var data = nums(inp.heap == null ? "46 79 56 38 40 84 25 61 12 33" : inp.heap, 2, 10, "关键字序列");
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
        var HEAP_IN = { k: "heap", label: "初始关键字序列（2–10 个）", value: "46 79 56 38 40 84 25 61 12 33", ph: "空格或逗号分隔" };
        PROC.push({
          id: "heapop", name: "堆的插入与删除", sub: "ds",
          lead: "小根堆：数组和完全二叉树同步画。建堆从 ⌊n/2⌋ 开始向下筛选，插入放末尾再上浮，删除堆顶用末尾元素替换再下沉。",
          note: ["小根堆：A[i] ≤ A[2i] 且 A[i] ≤ A[2i+1]（下标从 1 开始）；大根堆相反。", "建堆从最后一个非叶结点 ⌊n/2⌋ 开始依次向前做下沉，时间复杂度 O(n)。", "插入：放到末尾，与双亲比较，小则交换，一路上浮，O(log n)。", "删除堆顶：末尾元素移到堆顶，与较小的孩子比较，大则交换，一路下沉，O(log n)。", "堆排序不稳定，时间 O(n log n)，空间 O(1)；比较次数是常考计算题，注意下沉时两个孩子之间也要比较一次。"],
          modes: [
            { name: "建堆（筛选法）", inputs: [HEAP_IN], make: function (inp) { return heapSpec("build", inp); }, presets: [{ label: "示例一（10 个，多层下沉）", v: { heap: "46 79 56 38 40 84 25 61 12 33" } }, { label: "逆序 8 个", v: { heap: "80 70 60 50 40 30 20 10" } }] },
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
          nodes.push({ id: "PROP", k: "table", x: 730, y: 40, w: 230, h: 26 + 3 * 24 + 6, rh: 24, t: "红黑性质检查", cols: [0.5], rows: [["根为黑", "—"], ["红结点不相邻", "—"], ["各路径黑高相等", "—"]] });
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
            set.PROP = { rows: [["根为黑", c.rootBlack ? "是 ✓" : "否 ✗"], ["红结点不相邻", c.redRed.length ? c.redRed[0] + " ✗" : "是 ✓"], ["各路径黑高相等", c.bhOk ? "bh = " + c.bh + " ✓" : "不同 ✗"]], bad: bad, hi: -1 };
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
            else if (e.kind === "ins" && ki === 0) s.tip = "新插入的结点总是红色：插红结点不改变黑高，最多只会破坏“红结点不相邻”这一条，修复代价小。";
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
          note: ["红黑性质：结点非红即黑；根黑；叶结点（NIL）黑；红结点的两个孩子都是黑（红结点不相邻）；任一结点到其每个叶结点路径上的黑结点数相同（各路径黑结点数相等）。", "新插入结点为红色（若是根则染黑）；父结点为黑，插入直接结束。", "父红叔红：父、叔染黑，爷染红，爷作为新结点继续向上调整（不旋转）。", "父红叔黑：LL 右单旋、RR 左单旋，LR 先左后右、RL 先右后左；旋转后新子树根染黑、原爷染红。", "黑高 bh：从某结点出发（不含该结点）到叶结点路径上的黑结点数；红黑树高 h ≤ 2log₂(n + 1)，查找、插入、删除都是 O(log n)。"],
          modes: [
            { name: "插入 20,10,5,30,40,57,3,2", inputs: [{ k: "rb", label: "关键字序列（不超过 10 个）", value: "20 10 5 30 40 57 3 2", ph: "空格或逗号分隔" }], make: function (inp) { return rbSpec(nums(inp.rb == null ? "20 10 5 30 40 57 3 2" : inp.rb, 1, 10, "关键字序列")); } },
            { name: "LR / RL 型：10,5,7,15,12", make: function () { return rbSpec([10, 5, 7, 15, 12]); } }
          ]
        });

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
          var data = nums(inp.rs == null ? "36 15 48 21 9 40 27 12 33 6 45" : inp.rs, 3, 15, "输入记录"), WA = 3;
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
          var K = 5, RUNS = [[17, 29, 41], [8, 23, 35], [26, 31, 44], [14, 19, 52], [11, 38, 47]];
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
          S.push({ t: "5 路归并：叶子装入各段的首记录", d: "叶子 b0–b4 分别是 5 个归并段的当前记录 " + b.join("、") + "。内部结点 ls[1]–ls[4] 将记录“败者”（较大者）所在的段号，胜者继续向上比，冠军放在 ls[0]。", on: ["b0", "b1", "b2", "b3", "b4", "RUNS"], set: snap({ RUNS: { rows: runRows(), hi: [0, 1, 2, 3, 4] } }), kv: kv() });
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
          note: ["外部排序的耗时由三块组成：生成初始段时的内部排序、反复读写外存、归并时的内部比较；真正的瓶颈是读写外存，所以优化都围绕减少 I/O 次数。", "r 个初始归并段做 k 路平衡归并，归并趟数 = ⌈log_k r⌉；增大 k 或减少 r 都能减少趟数。", "败者树：内部结点记败者，冠军在 ls[0]；每输出一个记录只需比较 ⌈log₂k⌉ 次，与 k 无关。", "置换—选择排序：每次输出 WA 中不小于 MINIMAX 的最小记录；得到的初始归并段长度不等，平均约为 WA 大小的 2 倍。", "最佳归并树：k 叉哈夫曼树，(n − 1) % (k − 1) ≠ 0 时补 (k − 1) − (n − 1) % (k − 1) 个虚段；读写次数 = 2 × WPL。"],
          modes: [
            { name: "置换—选择排序（WA = 3）", inputs: [{ k: "rs", label: "输入文件 FI 的记录（3–15 个）", value: "36 15 48 21 9 40 27 12 33 6 45", ph: "空格或逗号分隔" }], make: replSpec },
            { name: "败者树（k = 5）", make: loserSpec },
            { name: "最佳归并树（补虚段）", inputs: [{ k: "bl", label: "各归并段长度（2–12 个）", value: "2 3 6 9 12 17 18 24", ph: "空格或逗号分隔" }, { k: "bk", label: "归并路数 k", type: "select", value: "3", opts: [["2", "2 路"], ["3", "3 路"], ["4", "4 路"]] }], make: bestSpec, presets: [{ label: "8 段 3 路（补 1 个）", v: { bl: "2 3 6 9 12 17 18 24", bk: "3" } }, { label: "9 段 3 路（不补）", v: { bl: "9 12 18 3 17 2 6 30 24", bk: "3" } }, { label: "8 段 4 路（补 2 个）", v: { bl: "5 8 12 3 20 7 15 10", bk: "4" } }] }
          ]
        });
      })();
