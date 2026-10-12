
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
            S.push({ t: "结论二：树的后根 = 二叉树的中序", d: "结点 x 在二叉树中的左子树就是它原来的全部子孙，中序先访问左子树再访问 x，正是“先子树后根”。", on: [], tip: "森林的中序遍历（王道称后序遍历，即依次后根遍历每棵树）= 对应二叉树的中序遍历。树没有“中根遍历”。" });
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
