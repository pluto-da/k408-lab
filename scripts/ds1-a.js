      /* 数据结构动画实验（一）：中缀转后缀、循环队列、KMP、哈夫曼树、二叉排序树 / AVL、B 树、并查集。
         纯计算函数挂在 window.LABU 上，统一以 ds 前缀命名（dsInfix / dsCqRun / dsKmpNext / dsKmpNextval / dsKmpMatch / dsNaiveMatch /
         dsHuffman / dsBstInsert / dsBstDelete / dsAvlInsert / dsBstFrames / dsBtree / dsBtreeCheck / dsUnion / dsFind / dsUfRun …），
         界面通过 LAB.push 注册，顶层不访问 DOM。教材口径：王道 / 严蔚敏。 */
      (function () {
        var LAB = window.LAB = window.LAB || [];
        var LABU = window.LABU = window.LABU || {};

        /* ======================= 小工具 ======================= */
        function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
        function fnum(v) { var s = String(Math.round(v * 1e6) / 1e6); return s.replace(/^-/, "−"); }
        function normList(s) { return String(s == null ? "" : s).replace(/[−–—－]/g, "-").replace(/[，、；;。]/g, ",").replace(/[\s,]+/g, " ").replace(/^\s+|\s+$/g, ""); }
        function log2floor(n) { var k = 0; while ((1 << (k + 1)) <= n) k++; return k; }

        /* 关键字序列解析：整数、互不相同、个数有上限 */
        LABU.dsParseKeys = function (s, opt) {
          opt = opt || {};
          var max = opt.max || 15, min = opt.min == null ? 1 : opt.min, lo = opt.lo == null ? 0 : opt.lo, hi = opt.hi == null ? 999 : opt.hi;
          var t = normList(s);
          if (!t) return min ? { err: "请输入" + (opt.name || "关键字") + "，用空格或逗号分隔" } : { keys: [] };
          var parts = t.split(" "), keys = [], seen = {};
          for (var i = 0; i < parts.length; i++) {
            var p = parts[i];
            if (!/^-?\d+$/.test(p)) return { err: "“" + p + "”不是整数" + (opt.name ? "（" + opt.name + "）" : "关键字") };
            var v = parseInt(p, 10);
            if (v < lo || v > hi) return { err: (opt.name || "关键字") + "应在 " + lo + "–" + hi + " 之间：" + p };
            if (seen[v] && !opt.dup) return { err: (opt.name || "关键字") + " " + v + " 重复出现，" + (opt.dupWhy || "同一棵树中关键字互不相同") };
            seen[v] = 1; keys.push(v);
          }
          if (keys.length > max) return { err: (opt.name || "关键字") + "太多：最多 " + max + " 个（当前 " + keys.length + " 个）" };
          if (keys.length < min) return { err: "至少需要 " + min + " 个" + (opt.name || "关键字") };
          return { keys: keys };
        };

        /* ======================= 1. 中缀转后缀 + 后缀求值 ======================= */
        var PREC = { "+": 1, "-": 1, "*": 2, "/": 2 };
        LABU.dsInfixTokens = function (s) {
          var t = String(s == null ? "" : s).replace(/（/g, "(").replace(/）/g, ")").replace(/[×＊]/g, "*").replace(/[÷／]/g, "/")
            .replace(/[−–—－]/g, "-").replace(/＋/g, "+").replace(/\s+/g, "");
          if (!t) return { err: "请输入中缀表达式，例如 a+b*(c-d)-e/f" };
          if (t.length > 60) return { err: "表达式太长：最多 60 个字符" };
          var tk = [], i = 0, k;
          while (i < t.length) {
            var c = t.charAt(i);
            if (/[0-9.]/.test(c)) {
              var j = i; while (j < t.length && /[0-9.]/.test(t.charAt(j))) j++;
              var num = t.slice(i, j);
              if (!/^\d+(\.\d+)?$/.test(num)) return { err: "“" + num + "”不是合法的数" };
              if (num.length > 6) return { err: "数“" + num + "”太长：最多 6 个字符" };
              tk.push({ t: "n", v: num }); i = j;
            } else if (/[A-Za-z]/.test(c)) { tk.push({ t: "v", v: c }); i++; }
            else if (PREC[c]) { tk.push({ t: "o", v: c }); i++; }
            else if (c === "(" || c === ")") { tk.push({ t: c, v: c }); i++; }
            else return { err: "不支持的字符“" + c + "”：只能使用单个字母、数字、+ - * / 和括号" };
          }
          if (tk.length > 31) return { err: "记号太多：最多 31 个（当前 " + tk.length + " 个）" };
          var depth = 0, prev = null;
          for (k = 0; k < tk.length; k++) {
            var x = tk[k], ty = x.t === "n" || x.t === "v" ? "x" : x.t;
            if (ty === "x") { if (prev === "x" || prev === ")") return { err: "第 " + (k + 1) + " 个记号“" + x.v + "”前缺少运算符（多字母变量请用单个字母）" }; }
            else if (ty === "o") {
              if (prev !== "x" && prev !== ")") return { err: x.v === "-" && (prev === null || prev === "(") ? "暂不支持单目负号：请把 -x 写成 (0-x)" : "运算符“" + x.v + "”前缺少操作数" };
            } else if (ty === "(") { if (prev === "x" || prev === ")") return { err: "第 " + (k + 1) + " 个记号“(”前缺少运算符" }; depth++; }
            else {
              if (prev === "(") return { err: "括号内为空：“()”" };
              if (prev !== "x" && prev !== ")") return { err: "第 " + (k + 1) + " 个记号“)”前缺少操作数" };
              if (!depth) return { err: "括号不匹配：第 " + (k + 1) + " 个记号“)”没有对应的“(”" };
              depth--;
            }
            prev = ty;
          }
          if (prev === "o" || prev === "(") return { err: "表达式不完整：末尾缺少操作数" };
          if (depth) return { err: "括号不匹配：有 " + depth + " 个“(”没有闭合" };
          return { tokens: tk };
        };
        LABU.dsInfix = function (s) {
          var r = LABU.dsInfixTokens(s);
          if (r.err) return r;
          var tk = r.tokens, st = [], out = [], steps = [], maxD = 0, maxOps = 0;
          function snap(i, act, d, pop) {
            maxD = Math.max(maxD, st.length);
            maxOps = Math.max(maxOps, st.filter(function (c) { return c !== "("; }).length);
            steps.push({ i: i, act: act, stack: st.slice(), out: out.slice(), pop: pop || [], d: d });
          }
          tk.forEach(function (x, i) {
            if (x.t === "n" || x.t === "v") { out.push(x.v); snap(i, "输出 " + x.v, "扫描到操作数 " + x.v + "，操作数直接加入后缀表达式。"); }
            else if (x.t === "(") { st.push("("); snap(i, "( 入栈", "扫描到“(”，左括号直接入栈（它只能被右括号弹出）。"); }
            else if (x.t === ")") {
              var pops = [];
              while (st[st.length - 1] !== "(") { var o = st.pop(); out.push(o); pops.push(o); }
              st.pop();
              snap(i, pops.length ? "弹出 " + pops.join(" ") + "，( 出栈" : "( 出栈", "扫描到“)”，" + (pops.length ? "依次弹出 " + pops.join("、") + " 加入输出，" : "") + "直到遇到“(”，把“(”出栈丢弃（括号不进入后缀表达式）。", pops);
            } else {
              var popped = [];
              while (st.length && st[st.length - 1] !== "(" && PREC[st[st.length - 1]] >= PREC[x.v]) { var o2 = st.pop(); popped.push(o2); out.push(o2); }
              var top = st.length ? st[st.length - 1] : null, d = "扫描到运算符 " + x.v + "：";
              if (popped.length) d += "栈顶 " + popped.join("、") + " 的优先级不低于 " + x.v + "（同级按左结合先算），依次弹出加入输出；";
              d += top === null ? "此时栈空，" : top === "(" ? "栈顶是“(”，停止弹出，" : "栈顶 " + top + " 优先级低于 " + x.v + "，不弹，";
              d += x.v + " 入栈。";
              st.push(x.v);
              snap(i, (popped.length ? "弹出 " + popped.join(" ") + "，" : "") + x.v + " 入栈", d, popped);
            }
          });
          while (st.length) { var o3 = st.pop(); out.push(o3); snap(tk.length, "弹出 " + o3, "扫描结束，弹出栈中剩余的 " + o3 + " 加入输出" + (st.length ? "。" : "，栈空，转换完成。"), [o3]); }
          var compact = out.every(function (x) { return x.length === 1; });
          var res = { tokens: tk, steps: steps, post: out, postfix: out.join(compact ? "" : " "), maxDepth: maxD, maxOps: maxOps, numeric: tk.every(function (x) { return x.t !== "v"; }) };
          if (res.numeric) {
            var vs = [], ev = [], emax = 0;
            for (var i = 0; i < out.length; i++) {
              var x = out[i];
              if (!PREC[x]) { vs.push(parseFloat(x)); emax = Math.max(emax, vs.length); ev.push({ i: i, stack: vs.slice(), d: "扫描到操作数 " + x + "，压入操作数栈。" }); }
              else {
                var b = vs.pop(), a = vs.pop(), v;
                if (x === "/" && b === 0) { res.evalErr = "后缀求值时出现除数为 0：" + fnum(a) + " / 0"; break; }
                v = x === "+" ? a + b : x === "-" ? a - b : x === "*" ? a * b : a / b;
                vs.push(v);
                ev.push({ i: i, stack: vs.slice(), calc: fnum(a) + " " + x + " " + fnum(b) + " = " + fnum(v), d: "扫描到运算符 " + x + "：先弹出的 " + fnum(b) + " 是右操作数，再弹出的 " + fnum(a) + " 是左操作数，计算 " + fnum(a) + " " + x + " " + fnum(b) + " = " + fnum(v) + "，结果入栈。" });
              }
            }
            res.evalSteps = ev; res.evalMax = emax;
            if (!res.evalErr) res.value = vs[0];
          }
          return res;
        };

        /* ======================= 2. 循环队列 ======================= */
        LABU.CQ_SCHEMES = [["sac", "牺牲一个单元"], ["size", "增设 size"], ["tag", "增设 tag"]];
        LABU.dsCqInit = function (N) { var q = []; for (var i = 0; i < N; i++) q.push(null); return { N: N, q: q, front: 0, rear: 0, size: 0, tag: 0 }; };
        LABU.dsCqEmpty = function (s, sc) { return sc === "size" ? s.size === 0 : sc === "tag" ? s.front === s.rear && s.tag === 0 : s.front === s.rear; };
        LABU.dsCqFull = function (s, sc) { return sc === "size" ? s.size === s.N : sc === "tag" ? s.front === s.rear && s.tag === 1 : (s.rear + 1) % s.N === s.front; };
        LABU.dsCqLen = function (s, sc) { return sc === "size" ? s.size : sc === "tag" && s.front === s.rear && s.tag === 1 ? s.N : (s.rear - s.front + s.N) % s.N; };
        LABU.dsCqCond = function (s, sc) {
          var N = s.N, r;
          if (sc === "size") r = { ef: "size == 0", ev: s.size + " == 0", ff: "size == MaxSize", fv: s.size + " == " + N };
          else if (sc === "tag") r = { ef: "front == rear && tag == 0", ev: s.front + " == " + s.rear + " && " + s.tag + " == 0", ff: "front == rear && tag == 1", fv: s.front + " == " + s.rear + " && " + s.tag + " == 1" };
          else r = { ef: "front == rear", ev: s.front + " == " + s.rear, ff: "(rear+1) % MaxSize == front", fv: "(" + s.rear + "+1) % " + N + " = " + ((s.rear + 1) % N) + " == " + s.front };
          r.empty = r.ef + "（" + r.ev + "）"; r.full = r.ff + "（" + r.fv + "）";
          return r;
        };
        LABU.dsCqOp = function (s0, op, sc) {
          var s = { N: s0.N, q: s0.q.slice(), front: s0.front, rear: s0.rear, size: s0.size, tag: s0.tag }, d, ok = true;
          var cond = LABU.dsCqCond(s0, sc);
          if (op[0] === "E") {
            if (LABU.dsCqFull(s0, sc)) { ok = false; d = "入队 " + op[1] + " 失败：判满条件 " + cond.full + " 成立，队列已满" + (sc === "sac" ? "（牺牲一个单元，只能存 MaxSize − 1 = " + (s.N - 1) + " 个元素）" : "") + "。"; }
            else {
              var r = s.rear; s.q[r] = op[1]; s.rear = (r + 1) % s.N; s.size++; if (sc === "tag") s.tag = 1;
              d = "入队 " + op[1] + "：先判满不成立，Q[rear = " + r + "] = " + op[1] + "，再 rear = (" + r + " + 1) % " + s.N + " = " + s.rear + (s.rear < r ? "（绕回到 0 号单元）" : "") + (sc === "tag" ? "，入队后置 tag = 1" : sc === "size" ? "，size = " + s.size : "") + "。";
            }
          } else {
            if (LABU.dsCqEmpty(s0, sc)) { ok = false; d = "出队失败：判空条件 " + cond.empty + " 成立，队列为空。"; }
            else {
              var f = s.front, x = s.q[f]; s.q[f] = null; s.front = (f + 1) % s.N; s.size--; if (sc === "tag") s.tag = 0;
              d = "出队：先判空不成立，取出 Q[front = " + f + "] = " + x + "，再 front = (" + f + " + 1) % " + s.N + " = " + s.front + (s.front < f ? "（绕回到 0 号单元）" : "") + (sc === "tag" ? "，出队后置 tag = 0" : sc === "size" ? "，size = " + s.size : "") + "。";
            }
          }
          return { s: s, ok: ok, d: d, op: op };
        };
        LABU.CQ_DEF = [["E", "a"], ["E", "b"], ["E", "c"], ["E", "d"], ["E", "e"], ["E", "f"], ["D"], ["D"], ["E", "g"], ["E", "h"]];
        LABU.dsCqRun = function (N, sc, ops) {
          if (!(N >= 3 && N <= 10)) return { err: "MaxSize 应在 3–10 之间" };
          var s = LABU.dsCqInit(N), frames = [{ s: s, op: null, ok: true, d: "初始化：front = rear = 0，" + (sc === "size" ? "size = 0，" : sc === "tag" ? "tag = 0，" : "") + "队列为空。方案：" + (sc === "size" ? "增设 size 记录元素个数，可存满 MaxSize 个。" : sc === "tag" ? "增设 tag，最近一次是入队置 1、出队置 0，front == rear 时靠 tag 区分空和满。" : "牺牲一个单元，队尾指针再走一步就追上队头时视为满。") }];
          ops.forEach(function (op) { var r = LABU.dsCqOp(s, op, sc); s = r.s; frames.push(r); });
          return { frames: frames, s: s };
        };

        /* ======================= 3. KMP ======================= */
        LABU.dsKmpNext = function (p) {
          var m = p.length, next = [], steps = [];
          for (var j = 1; j <= m; j++) {
            if (j === 1) { next.push(0); steps.push({ j: 1, sub: "", len: -1, v: 0 }); continue; }
            var sub = p.slice(0, j - 1), L = 0;
            for (var k = sub.length - 1; k >= 1; k--) if (sub.slice(0, k) === sub.slice(sub.length - k)) { L = k; break; }
            next.push(L + 1); steps.push({ j: j, sub: sub, len: L, v: L + 1 });
          }
          return { next: next, steps: steps };
        };
        LABU.dsKmpNextval = function (p, next) {
          next = next || LABU.dsKmpNext(p).next;
          var nv = [];
          for (var j = 1; j <= p.length; j++) {
            if (j === 1) { nv.push(0); continue; }
            var k = next[j - 1];
            nv.push(p.charAt(j - 1) === p.charAt(k - 1) ? nv[k - 1] : k);
          }
          return nv;
        };
        LABU.dsKmpMatch = function (s, p, arr) {
          var n = s.length, m = p.length, i = 1, j = 1, cmp = 0, steps = [];
          while (i <= n && j <= m) {
            if (j === 0) { steps.push({ k: "z", i: i, j: 0, cmp: cmp }); i++; j = 1; continue; }
            cmp++;
            var eq = s.charAt(i - 1) === p.charAt(j - 1);
            steps.push({ k: "c", i: i, j: j, eq: eq, cmp: cmp });
            if (eq) { i++; j++; } else { var nj = arr[j - 1]; steps.push({ k: "s", i: i, j: j, nj: nj, cmp: cmp }); j = nj; }
          }
          return { pos: j > m ? i - m : 0, cmp: cmp, steps: steps };
        };
        LABU.dsNaiveMatch = function (s, p) {
          var n = s.length, m = p.length, i = 1, j = 1, cmp = 0, steps = [];
          while (i <= n && j <= m) {
            cmp++;
            var eq = s.charAt(i - 1) === p.charAt(j - 1);
            steps.push({ k: "c", i: i, j: j, eq: eq, cmp: cmp });
            if (eq) { i++; j++; } else { steps.push({ k: "b", i: i, j: j, ni: i - j + 2, cmp: cmp }); i = i - j + 2; j = 1; }
          }
          return { pos: j > m ? i - m : 0, cmp: cmp, steps: steps };
        };

        /* ======================= 4. 哈夫曼树 ======================= */
        LABU.dsHuffParse = function (s) {
          var t = normList(s).replace(/[：=]/g, ":").replace(/\s*:\s*/g, ":");
          if (!t) return { err: "请输入权值，例如 7 5 2 4 或 a:45 b:13" };
          var parts = t.split(" "), items = [], seen = {}, withCh = null;
          for (var i = 0; i < parts.length; i++) {
            var m = /^(?:([^:\s]{1,3}):)?(\d+(?:\.\d{1,2})?)$/.exec(parts[i]);
            if (!m) return { err: "“" + parts[i] + "”格式不对：写成权值（如 7）或 字符:权值（如 a:45），权值为正数、最多 2 位小数" };
            var has = !!m[1];
            if (withCh === null) withCh = has; else if (withCh !== has) return { err: "要么全部只写权值，要么全部写成 字符:权值，不要混用" };
            var w = parseFloat(m[2]);
            if (!(w > 0)) return { err: "权值必须大于 0：" + parts[i] };
            if (w > 9999) return { err: "权值太大：最大 9999" };
            if (has) { if (seen[m[1]]) return { err: "字符“" + m[1] + "”重复出现" }; seen[m[1]] = 1; }
            items.push({ ch: has ? m[1] : "", w: w });
          }
          if (items.length < 2) return { err: "至少需要 2 个权值" };
          if (items.length > 15) return { err: "权值太多：最多 15 个（当前 " + items.length + " 个）" };
          return { items: items };
        };
        LABU.dsHuffman = function (items) {
          if (typeof items === "string") { var pr = LABU.dsHuffParse(items); if (pr.err) return pr; items = pr.items; }
          if (!items || items.length < 2) return { err: "至少需要 2 个权值" };
          var nodes = items.map(function (it, i) { return { id: i, w: it.w, ch: it.ch || "", l: -1, r: -1 }; });
          var forest = nodes.map(function (n) { return n.id; }), steps = [{ forest: forest.slice(), pick: null, made: -1 }];
          function argmin(list, skip) { var b = -1; list.forEach(function (id) { if (id !== skip && (b < 0 || nodes[id].w < nodes[b].w)) b = id; }); return b; }
          while (forest.length > 1) {
            var a = argmin(forest, -1), b = argmin(forest, a), before = forest.slice();
            var z = { id: nodes.length, w: Math.round((nodes[a].w + nodes[b].w) * 100) / 100, ch: "", l: a, r: b };
            nodes.push(z);
            forest = forest.filter(function (id) { return id !== a && id !== b; }); forest.push(z.id);
            steps.push({ forest: forest.slice(), before: before, pick: [a, b], made: z.id });
          }
          var root = forest[0], codes = [], wpl = 0;
          (function walk(id, code) {
            var n = nodes[id];
            if (n.l < 0) { codes[id] = { id: id, ch: n.ch, w: n.w, code: code || "0", len: code.length }; wpl += n.w * code.length; return; }
            walk(n.l, code + "0"); walk(n.r, code + "1");
          })(root, "");
          wpl = Math.round(wpl * 100) / 100;
          var inner = nodes.filter(function (n) { return n.l >= 0; }).reduce(function (s, n) { return s + n.w; }, 0);
          var sumW = items.reduce(function (s, it) { return s + it.w; }, 0);
          return { nodes: nodes, root: root, steps: steps, codes: codes.slice(0, items.length), wpl: wpl, total: nodes.length, innerSum: Math.round(inner * 100) / 100, sumW: Math.round(sumW * 100) / 100 };
        };

        /* ======================= 5. 二叉排序树 / AVL ======================= */
        function hgt(n) { return n ? 1 + Math.max(hgt(n.l), hgt(n.r)) : 0; }
        function bfOf(n) { return hgt(n.l) - hgt(n.r); }
        function tclone(n) { return n ? { k: n.k, l: tclone(n.l), r: tclone(n.r) } : null; }
        function rotR(a) { var b = a.l; a.l = b.r; b.r = a; return b; }
        function rotL(a) { var b = a.r; a.r = b.l; b.l = a; return b; }
        function inorder(n, out) { out = out || []; if (n) { inorder(n.l, out); out.push(n.k); inorder(n.r, out); } return out; }
        LABU.dsHeight = hgt; LABU.dsBf = bfOf; LABU.dsInorder = function (n) { return inorder(n, []); };
        function bstIns(root, k) {
          var nn = { k: k, l: null, r: null };
          if (!root) return { root: nn, path: [nn], cmp: [], node: nn };
          var n = root, path = [], cmp = [];
          for (;;) {
            path.push(n);
            if (k === n.k) return { root: root, path: path, cmp: cmp, dup: true };
            var dir = k < n.k ? "l" : "r";
            cmp.push({ at: n.k, dir: dir, empty: !n[dir] });
            if (!n[dir]) { n[dir] = nn; path.push(nn); return { root: root, path: path, cmp: cmp, node: nn, parent: n.k, dir: dir }; }
            n = n[dir];
          }
        }
        /* AVL 插入（就地修改），cb(kind, root, info) 在插入后、发现失衡、LR/RL 第一步、旋转后各回调一次 */
        function avlIns(root, k, cb) {
          var r = bstIns(root, k);
          if (r.dup) return { root: r.root, dup: true, cmp: r.cmp };
          root = r.root;
          var path = r.path;
          if (cb) cb("ins", root, r);
          for (var t = path.length - 2; t >= 0; t--) {
            var A = path[t], b = bfOf(A);
            if (b > 1 || b < -1) {
              var type = b > 1 ? (k < A.l.k ? "LL" : "LR") : (k > A.r.k ? "RR" : "RL");
              var B = b > 1 ? A.l : A.r, C = type === "LR" ? B.r : type === "RL" ? B.l : null;
              var info = { type: type, A: A.k, B: B.k, C: C ? C.k : null, bf: b };
              if (cb) cb("unb", root, info);
              var sub;
              if (type === "LL") sub = rotR(A);
              else if (type === "RR") sub = rotL(A);
              else if (type === "LR") { A.l = rotL(B); if (cb) cb("half", root, info); sub = rotR(A); }
              else { A.r = rotR(B); if (cb) cb("half", root, info); sub = rotL(A); }
              if (t === 0) root = sub; else { var P = path[t - 1]; if (P.l === A) P.l = sub; else P.r = sub; }
              info.top = sub.k;
              if (cb) cb("rot", root, info);
              return { root: root, rot: type, at: A.k, pivot: sub.k, cmp: r.cmp };
            }
          }
          return { root: root, rot: null, cmp: r.cmp };
        }
        LABU.dsBstInsert = function (root, k) { var r = bstIns(tclone(root), k); return { root: r.root, dup: !!r.dup, cmp: r.cmp }; };
        LABU.dsAvlInsert = function (root, k) { return avlIns(tclone(root), k, null); };
        function bstDel(root, k, pred) {
          var n = root, par = null, cmp = [];
          while (n && n.k !== k) { cmp.push({ at: n.k, dir: k < n.k ? "l" : "r" }); par = n; n = k < n.k ? n.l : n.r; }
          if (!n) return { root: root, found: false, cmp: cmp };
          function put(p, old, nw) { if (!p) root = nw; else if (p.l === old) p.l = nw; else p.r = nw; }
          if (!n.l && !n.r) { put(par, n, null); return { root: root, found: true, kind: "leaf", cmp: cmp }; }
          if (!n.l || !n.r) { var only = n.l || n.r; put(par, n, only); return { root: root, found: true, kind: n.l ? "left" : "right", child: only.k, cmp: cmp }; }
          var sp = n, s = pred ? n.l : n.r;
          if (pred) while (s.r) { sp = s; s = s.r; } else while (s.l) { sp = s; s = s.l; }
          var child = pred ? s.l : s.r;
          if (sp === n) { if (pred) n.l = child; else n.r = child; } else { if (pred) sp.r = child; else sp.l = child; }
          n.k = s.k;
          return { root: root, found: true, kind: "two", rep: s.k, cmp: cmp };
        }
        LABU.dsBstDelete = function (root, k, pred) { return bstDel(tclone(root), k, !!pred); };
        LABU.dsBstAsl = function (root) {
          var lv = [];
          (function w(n, d) { if (!n) return; lv[d] = (lv[d] || 0) + 1; w(n.l, d + 1); w(n.r, d + 1); })(root, 0);
          var sum = 0, cnt = 0, parts = [];
          lv.forEach(function (c, d) { sum += c * (d + 1); cnt += c; parts.push((d + 1) + "×" + c); });
          return { sum: sum, n: cnt, asl: cnt ? sum / cnt : 0, expr: cnt ? "(" + parts.join(" + ") + ") / " + cnt + " = " + sum + "/" + cnt + (sum % cnt ? " ≈ " + (Math.round(sum / cnt * 100) / 100) : " = " + sum / cnt) : "—" };
        };
        function bfMap(root) { var m = {}; (function w(n) { if (!n) return; m[n.k] = bfOf(n); w(n.l); w(n.r); })(root); return m; }
        /* 逐帧：每帧 { t: 树快照, hl: { 关键字: 样式 }, d: 说明, rot?: 旋转标签 } */
        LABU.dsBstFrames = function (keys, opt) {
          opt = opt || {};
          var avl = !!opt.avl, dels = opt.dels || [], pred = !!opt.pred, root = null, F = [], rots = [];
          function snap(hl, d, extra) { var f = { t: tclone(root), hl: hl || {}, d: d }; for (var k in extra || {}) f[k] = extra[k]; F.push(f); }
          snap({}, "空树。依次" + (avl ? "插入关键字并在每次插入后检查平衡因子（BF = 左子树高 − 右子树高）" : "插入关键字构造二叉排序树") + "：" + keys.join("、") + (dels.length && !avl ? "；再依次删除 " + dels.join("、") : "") + "。");
          function cmpFrames(k, cmp, verb) {
            cmp.forEach(function (c) {
              var h = {}; h[c.at] = "is-cur";
              snap(h, verb + " " + k + "：比较 " + k + " 与 " + c.at + "，" + k + (c.dir === "l" ? " < " : " > ") + c.at + "，进入" + (c.dir === "l" ? "左" : "右") + "子树" + (c.empty ? "（为空）" : "") + "。", { ph: "cmp" });
            });
          }
          keys.forEach(function (k) {
            if (!avl) {
              var r = bstIns(root, k);
              if (!r.dup) {
                cmpFrames(k, r.cmp, "插入");
                root = r.root;
                var h = {}; h[k] = "is-new";
                snap(h, r.parent == null ? "树为空，" + k + " 成为根结点。" : k + " 插入为 " + r.parent + " 的" + (r.dir === "l" ? "左" : "右") + "孩子（新结点总是叶结点）。", { ph: "ins" });
              }
              return;
            }
            var probe = bstIns(tclone(root), k);
            if (probe.dup) return;
            cmpFrames(k, probe.cmp, "插入");
            var res = avlIns(root, k, function (kind, rt, info) {
              if (kind === "ins") {
                var h = {}; h[k] = "is-new";
                var bm = bfMap(rt), bad = Object.keys(bm).filter(function (x) { return Math.abs(bm[x]) > 1; });
                root = rt;
                snap(h, (info.parent == null ? "树为空，" + k + " 成为根结点。" : k + " 插入为 " + info.parent + " 的" + (info.dir === "l" ? "左" : "右") + "孩子。") + (bad.length ? "沿插入路径向上更新平衡因子，出现 |BF| = 2 的结点 " + bad.join("、") + "，失去平衡。" : "沿插入路径向上更新平衡因子，所有结点 |BF| ≤ 1，仍然平衡。"), { ph: "ins" });
              } else if (kind === "unb") {
                var h2 = {}; h2[info.A] = "is-bad"; h2[info.B] = "is-piv"; if (info.C != null) h2[info.C] = "is-piv2"; h2[k] = h2[k] || "is-new";
                var side = info.type.charAt(0) === "L" ? "左" : "右", side2 = info.type.charAt(1) === "L" ? "左" : "右";
                var how = info.type === "LL" ? "以 " + info.B + " 为轴右旋一次" : info.type === "RR" ? "以 " + info.B + " 为轴左旋一次" :
                  info.type === "LR" ? "先以 " + info.C + " 为轴左旋（转成 LL 型），再以 " + info.C + " 为轴右旋" : "先以 " + info.C + " 为轴右旋（转成 RR 型），再以 " + info.C + " 为轴左旋";
                snap(h2, "离插入点最近的失衡结点是 " + info.A + "（BF = " + (info.bf > 0 ? info.bf : "−" + (-info.bf)) + "），以它为根的子树是最小不平衡子树；" + k + " 插在 " + info.A + " 的" + side + "孩子 " + info.B + " 的" + side2 + "子树上，属于 " + info.type + " 型，" + how + "。", { rot: info.type + " 型", ph: "unb" });
              } else if (kind === "half") {
                root = rt;
                var h3 = {}; h3[info.A] = "is-bad"; h3[info.C] = "is-piv2";
                snap(h3, info.type + " 型第一步：对 " + info.A + " 的" + (info.type === "LR" ? "左" : "右") + "孩子 " + info.B + " 做一次" + (info.type === "LR" ? "左" : "右") + "旋，" + info.C + " 上升为 " + info.A + " 的" + (info.type === "LR" ? "左" : "右") + "孩子，转成 " + (info.type === "LR" ? "LL" : "RR") + " 型。", { rot: info.type + " 型 ①", ph: "half" });
              } else if (kind === "rot") {
                root = rt;
                var h4 = {}; h4[info.top] = "is-piv"; h4[info.A] = "is-done2";
                rots.push(info.type);
                snap(h4, (info.type === "LR" || info.type === "RL" ? info.type + " 型第二步：再" + (info.type === "LR" ? "右" : "左") + "旋一次。" : "") + "旋转完成：" + info.top + " 成为这棵子树的新根，" + info.A + " 成为它的" + (info.type === "LL" || info.type === "LR" ? "右" : "左") + "孩子；中序序列不变，所有结点 |BF| ≤ 1。", { rot: info.type + " 型 ✓", ph: "rot" });
              }
            });
            root = res.root;
          });
          if (!avl) dels.forEach(function (k) {
            var probe = bstDel(tclone(root), k, pred);
            cmpFrames(k, probe.cmp, "删除");
            if (!probe.found) { snap({}, "删除 " + k + "：查找失败，树中没有关键字 " + k + "，不做任何修改。", { ph: "miss" }); return; }
            var h = {}; h[k] = "is-bad";
            if (probe.kind === "leaf") snap(h, "找到 " + k + "，它是叶结点（情况①），直接删除，不影响二叉排序树的性质。", { ph: "del" });
            else if (probe.kind !== "two") snap(h, "找到 " + k + "，它只有" + (probe.kind === "left" ? "左" : "右") + "子树（情况②），让该子树（根为 " + probe.child + "）代替 " + k + " 的位置。", { ph: "del" });
            else { h[probe.rep] = "is-piv"; snap(h, "找到 " + k + "，它有左右两棵子树（情况③），用中序直接" + (pred ? "前驱 " + probe.rep + "（左子树中最右下的结点）" : "后继 " + probe.rep + "（右子树中最左下的结点）") + "代替 " + k + "，再删去原来的 " + probe.rep + "（它最多只有一棵子树）。", { ph: "del" }); }
            root = probe.root;
            var h5 = {}; if (probe.kind === "two") h5[probe.rep] = "is-new"; else if (probe.child != null) h5[probe.child] = "is-new";
            snap(h5, "删除 " + k + " 完成，中序序列仍然有序：" + inorder(root, []).join(" ") + "。", { ph: "deld" });
          });
          var asl = LABU.dsBstAsl(root);
          snap({}, "全部完成。中序序列 " + (inorder(root, []).join(" ") || "（空）") + " 有序；树高 " + hgt(root) + "；查找成功 ASL = " + asl.expr + "。", { ph: "end" });
          return { frames: F, root: root, asl: asl, rots: rots };
        };

        /* ======================= 6. B 树 ======================= */
        function bclone(n) { return n ? { id: n.id, keys: n.keys.slice(), ch: n.ch.map(bclone) } : null; }
        function bmin(m) { return Math.ceil(m / 2) - 1; }
        function nodeStr(n) { return "[" + n.keys.join(" ") + "]"; }
        LABU.dsBtreeCheck = function (root, m) {
          if (!root) return { ok: true, height: 0, count: 0 };
          var leafDepth = -1, count = 0, msg = "";
          (function w(n, d, lo, hi, isRoot) {
            if (msg) return;
            var c = n.keys.length;
            count += c;
            if (isRoot ? (c < 1 || c > m - 1) : (c < bmin(m) || c > m - 1)) { msg = "结点 " + nodeStr(n) + " 关键字数 " + c + " 越界"; return; }
            for (var i = 0; i < c; i++) {
              if (i && n.keys[i - 1] >= n.keys[i]) { msg = "结点 " + nodeStr(n) + " 无序"; return; }
              if ((lo != null && n.keys[i] <= lo) || (hi != null && n.keys[i] >= hi)) { msg = "结点 " + nodeStr(n) + " 超出父结点划分的范围"; return; }
            }
            if (!n.ch.length) { if (leafDepth < 0) leafDepth = d; else if (leafDepth !== d) msg = "叶结点不在同一层"; return; }
            if (n.ch.length !== c + 1) { msg = "结点 " + nodeStr(n) + " 的子树个数应为关键字数 + 1"; return; }
            for (var j = 0; j <= c; j++) w(n.ch[j], d + 1, j ? n.keys[j - 1] : lo, j < c ? n.keys[j] : hi, false);
          })(root, 0, null, null, true);
          return msg ? { ok: false, msg: msg } : { ok: true, height: leafDepth + 1, count: count };
        };
        LABU.dsBtreeKeys = function (root) { var o = []; (function w(n) { if (!n) return; for (var i = 0; i <= n.keys.length; i++) { if (n.ch[i]) w(n.ch[i]); if (i < n.keys.length) o.push(n.keys[i]); } })(root); return o; };
        /* T = { root, m, uid }，log(hl, d, extra) 记录一帧 */
        function bSearchText(n, k, i) {
          var c = n.keys;
          if (c.length === 1) return k + (k < c[0] ? " < " : " > ") + c[0];
          if (i === 0) return k + " < " + c[0];
          if (i === c.length) return k + " > " + c[c.length - 1];
          return c[i - 1] + " < " + k + " < " + c[i];
        }
        function bInsert(T, k, log) {
          var m = T.m;
          if (!T.root) { T.root = { id: T.uid++, keys: [k], ch: [] }; var h0 = {}; h0[T.root.id] = "is-new"; log(h0, "插入 " + k + "：树为空，新建根结点 [" + k + "]。", { nk: k }); return; }
          var n = T.root, path = [];
          for (;;) {
            var i = 0; while (i < n.keys.length && n.keys[i] < k) i++;
            if (n.keys[i] === k) { var hx = {}; hx[n.id] = "is-cur"; log(hx, "插入 " + k + "：结点 " + nodeStr(n) + " 中已有 " + k + "，B 树关键字互不相同，跳过。"); return; }
            path.push({ n: n, i: i });
            if (!n.ch.length) break;
            var h = {}; h[n.id] = "is-cur";
            log(h, "插入 " + k + "：在结点 " + nodeStr(n) + " 中比较，" + bSearchText(n, k, i) + "，进入第 " + (i + 1) + " 棵子树。", { ph: "cmp" });
            n = n.ch[i];
          }
          var at = path[path.length - 1].i;
          n.keys.splice(at, 0, k);
          var over = n.keys.length > m - 1, h1 = {}; h1[n.id] = over ? "is-bad" : "is-new";
          log(h1, "插入 " + k + "：" + (path.length > 1 ? "到达终端结点，" : "") + "按序插入得 " + nodeStr(n) + "，关键字数 " + n.keys.length + (over ? " > m − 1 = " + (m - 1) + "，上溢，需要分裂。" : " ≤ m − 1 = " + (m - 1) + "，不用分裂。"), { nk: k });
          var lv = path.length - 1;
          while (n.keys.length > m - 1) {
            var mid = Math.ceil(m / 2) - 1, up = n.keys[mid];
            var R = { id: T.uid++, keys: n.keys.slice(mid + 1), ch: n.ch.slice(mid + 1) };
            var Lk = n.keys.slice(0, mid);
            n.ch = n.ch.slice(0, mid + 1); n.keys = Lk;
            var par = lv > 0 ? path[lv - 1] : null, hs = {}, why = "从第 ⌈m/2⌉ = " + (mid + 1) + " 个关键字 " + up + " 处分裂：左边 [" + n.keys.join(" ") + "] 留在原结点，右边 [" + R.keys.join(" ") + "] 成为新结点，" + up + " 上移";
            if (!par) {
              T.root = { id: T.uid++, keys: [up], ch: [n, R] };
              hs[T.root.id] = "is-new"; hs[n.id] = "is-split"; hs[R.id] = "is-split";
              log(hs, why + "成为新的根结点，树高加 1。", { ph: "split" });
              break;
            }
            par.n.keys.splice(par.i, 0, up); par.n.ch.splice(par.i + 1, 0, R);
            var o2 = par.n.keys.length > m - 1;
            hs[par.n.id] = o2 ? "is-bad" : "is-new"; hs[n.id] = "is-split"; hs[R.id] = "is-split";
            log(hs, why + "到父结点，父结点变为 " + nodeStr(par.n) + (o2 ? "，又超过 m − 1 = " + (m - 1) + "，继续分裂。" : "，不超过 m − 1，分裂结束。"), { ph: "split" });
            n = par.n; lv--;
          }
        }
        function bDelete(T, k, log) {
          var m = T.m, mn = bmin(m);
          if (!T.root) { log({}, "删除 " + k + "：树为空。"); return; }
          var n = T.root, path = [], i;
          for (;;) {
            i = 0; while (i < n.keys.length && n.keys[i] < k) i++;
            path.push({ n: n, i: i });
            if (n.keys[i] === k) break;
            if (!n.ch.length) { var hm = {}; hm[n.id] = "is-cur"; log(hm, "删除 " + k + "：查到终端结点 " + nodeStr(n) + " 仍没有 " + k + "，查找失败，不做修改。"); return; }
            var h = {}; h[n.id] = "is-cur";
            log(h, "删除 " + k + "：在结点 " + nodeStr(n) + " 中比较，" + bSearchText(n, k, i) + "，进入第 " + (i + 1) + " 棵子树。", { ph: "cmp" });
            n = n.ch[i];
          }
          if (n.ch.length) {
            var c = n.ch[i];
            while (c.ch.length) { path.push({ n: c, i: c.ch.length - 1 }); c = c.ch[c.ch.length - 1]; }
            var p = c.keys[c.keys.length - 1];
            var hp = {}; hp[n.id] = "is-cur"; hp[c.id] = "is-piv";
            log(hp, "删除 " + k + "：" + k + " 在非终端结点 " + nodeStr(n) + " 中，用它的直接前驱 " + p + "（左子树中最大的关键字）替代，问题转化为删除终端结点中的 " + p + "。", { ph: "rep" });
            n.keys[i] = p;
            path.push({ n: c, i: c.keys.length - 1 });
            c.keys.pop();
            n = c;
          } else n.keys.splice(i, 1);
          fix(path.length - 1, true);
          function fix(idx, first) {
            var nd = path[idx].n, hh = {};
            if (idx === 0) {
              if (!nd.keys.length) {
                if (!nd.ch.length) { T.root = null; log({}, first ? "删除 " + k + " 后根结点为空，树变为空树。" : "根结点的关键字被合并下移后为空，树变为空树。"); }
                else { T.root = nd.ch[0]; hh[T.root.id] = "is-new"; log(hh, "根结点的唯一关键字下移参与合并后变空，删除旧根，合并后的结点成为新根，树高减 1。", { ph: "merge" }); }
              } else { hh[nd.id] = "is-new"; log(hh, first ? "删除 " + k + "：直接从根结点删除，根结点至少有 1 个关键字即可，结束。" : "根结点还剩 " + nd.keys.length + " 个关键字（根至少 1 个），结束。", { ph: "ok" }); }
              return;
            }
            if (nd.keys.length >= mn) { hh[nd.id] = "is-new"; log(hh, first ? "删除 " + k + "：直接删除，结点变为 " + nodeStr(nd) + "，关键字数 " + nd.keys.length + " ≥ ⌈m/2⌉ − 1 = " + mn + "，结束。" : "父结点变为 " + nodeStr(nd) + "，关键字数 " + nd.keys.length + " ≥ " + mn + "，结束。", { ph: "ok" }); return; }
            var par = path[idx - 1].n, ci = path[idx - 1].i, L = ci > 0 ? par.ch[ci - 1] : null, R = ci < par.ch.length - 1 ? par.ch[ci + 1] : null;
            hh[nd.id] = "is-bad";
            log(hh, (first ? "删除 " + k + " 后结点" : "结点") + "变为 " + nodeStr(nd) + "，关键字数 " + nd.keys.length + " < ⌈m/2⌉ − 1 = " + mn + "，下溢，看相邻兄弟能否借。", { ph: "under" });
            var hb = {};
            if (L && L.keys.length > mn) {
              var down = par.keys[ci - 1], upk = L.keys.pop();
              nd.keys.unshift(down); par.keys[ci - 1] = upk; if (L.ch.length) nd.ch.unshift(L.ch.pop());
              hb[nd.id] = "is-new"; hb[L.id] = "is-piv"; hb[par.id] = "is-cur";
              log(hb, "向左兄弟借：左兄弟有 " + (L.keys.length + 1) + " 个关键字 > " + mn + "，父结点中的 " + down + " 下移到本结点，左兄弟最大的 " + upk + " 上移到父结点。", { ph: "borrow" });
              return;
            }
            if (R && R.keys.length > mn) {
              var down2 = par.keys[ci], upk2 = R.keys.shift();
              nd.keys.push(down2); par.keys[ci] = upk2; if (R.ch.length) nd.ch.push(R.ch.shift());
              hb[nd.id] = "is-new"; hb[R.id] = "is-piv"; hb[par.id] = "is-cur";
              log(hb, "向右兄弟借：右兄弟有 " + (R.keys.length + 1) + " 个关键字 > " + mn + "，父结点中的 " + down2 + " 下移到本结点，右兄弟最小的 " + upk2 + " 上移到父结点。", { ph: "borrow" });
              return;
            }
            var sep, merged;
            if (L) { sep = par.keys[ci - 1]; L.keys = L.keys.concat([sep], nd.keys); L.ch = L.ch.concat(nd.ch); par.keys.splice(ci - 1, 1); par.ch.splice(ci, 1); merged = L; }
            else { sep = par.keys[ci]; nd.keys = nd.keys.concat([sep], R.keys); nd.ch = nd.ch.concat(R.ch); par.keys.splice(ci, 1); par.ch.splice(ci + 1, 1); merged = nd; }
            hb[merged.id] = "is-split"; hb[par.id] = "is-cur";
            log(hb, "相邻兄弟都只有 ⌈m/2⌉ − 1 = " + mn + " 个关键字，借不到，与" + (L ? "左" : "右") + "兄弟合并：父结点中的分隔关键字 " + sep + " 下移，合并为 " + nodeStr(merged) + "；父结点少了一个关键字。", { ph: "merge" });
            fix(idx - 1, false);
          }
        }
        LABU.dsBtreeInsert = function (root, k, m) { var T = { root: bclone(root), m: m, uid: 1000 + Math.floor(Math.random() * 1e6) }; bInsert(T, k, function () {}); return T.root; };
        LABU.dsBtreeDelete = function (root, k, m) { var T = { root: bclone(root), m: m, uid: 0 }; bDelete(T, k, function () {}); return T.root; };
        /* 整个过程：frames[i] = { t: 树快照, hl: { 结点 id: 样式 }, d } */
        LABU.dsBtree = function (m, keys, dels) {
          if ([3, 4, 5].indexOf(m) < 0) return { err: "阶数 m 只能取 3、4、5" };
          dels = dels || [];
          var T = { root: null, m: m, uid: 1 }, F = [];
          function log(hl, d, ex) { var f = { t: bclone(T.root), hl: hl, d: d }; for (var q in ex || {}) f[q] = ex[q]; F.push(f); }
          log({}, m + " 阶 B 树：每个结点最多 m − 1 = " + (m - 1) + " 个关键字、最多 " + m + " 棵子树；非根结点至少 ⌈m/2⌉ − 1 = " + bmin(m) + " 个关键字，根结点至少 1 个。依次插入 " + keys.join("、") + (dels.length ? "，再删除 " + dels.join("、") : "") + "。");
          keys.forEach(function (k) { bInsert(T, k, log); });
          if (dels.length) log({}, "插入完成，共 " + LABU.dsBtreeKeys(T.root).length + " 个关键字。下面依次删除 " + dels.join("、") + "。", { ph: "mid" });
          dels.forEach(function (k) { bDelete(T, k, log); });
          var ck = LABU.dsBtreeCheck(T.root, m);
          log({}, "全部完成。树高 " + (ck.height || 0) + "，关键字 " + (ck.count || 0) + " 个；" + (ck.ok ? "每个非根结点关键字数都在 " + bmin(m) + "–" + (m - 1) + " 之间，所有叶结点在同一层。" : "（校验失败：" + ck.msg + "）"), { ph: "end" });
          return { frames: F, root: T.root, check: ck };
        };

        /* ======================= 7. 并查集 ======================= */
        LABU.dsUfInit = function (n) { var p = [], rk = []; for (var i = 0; i < n; i++) { p.push(-1); rk.push(1); } return { n: n, p: p, rk: rk }; };
        LABU.dsFind = function (st, x, compress) {
          var path = [x];
          while (st.p[path[path.length - 1]] >= 0) path.push(st.p[path[path.length - 1]]);
          var r = path[path.length - 1], moved = [];
          if (compress) path.slice(0, -1).forEach(function (v) { if (st.p[v] !== r) { st.p[v] = r; moved.push(v); } });
          return { root: r, path: path, moved: moved };
        };
        /* mode: "plain"（Union(a, b) 让 b 的根指向 a 的根）| "rank"（按秩 = 树高合并，矮树并入高树） */
        LABU.dsUnion = function (st, a, b, mode, compress) {
          var fa = LABU.dsFind(st, a, compress), fb = LABU.dsFind(st, b, compress), ra = fa.root, rb = fb.root;
          if (ra === rb) return { same: true, fa: fa, fb: fb, ra: ra, rb: rb };
          var child = rb, par = ra, grew = false;
          if (mode === "rank") {
            if (st.rk[ra] < st.rk[rb]) { child = ra; par = rb; }
            if (st.rk[ra] === st.rk[rb]) { st.rk[par]++; grew = true; }
          }
          st.p[par] += st.p[child]; st.p[child] = par;
          return { same: false, fa: fa, fb: fb, ra: ra, rb: rb, child: child, parent: par, grew: grew };
        };
        LABU.dsUfHeight = function (st) {
          var best = 0;
          for (var i = 0; i < st.n; i++) { var h = 1, v = i; while (st.p[v] >= 0) { v = st.p[v]; h++; } best = Math.max(best, h); }
          return best;
        };
        LABU.dsUfParse = function (s, n) {
          var t = String(s == null ? "" : s).replace(/union|合并|并/gi, " U ").replace(/find|查找|查/gi, " F ").replace(/[（(]/g, " ").replace(/[）)]/g, " ")
            .replace(/[，、；;,]/g, " ").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
          if (!t) return { err: "请输入操作序列，例如 U 1 2, F 3" };
          var tk = t.split(" "), ops = [], i = 0;
          function num(x) {
            if (x == null) return { err: "操作序列不完整：缺少元素编号" };
            if (!/^\d+$/.test(x)) return { err: "“" + x + "”不是元素编号" };
            var v = parseInt(x, 10); if (v >= n) return { err: "元素 " + v + " 超出范围 0–" + (n - 1) };
            return { v: v };
          }
          while (i < tk.length) {
            var w = tk[i].toUpperCase();
            if (w === "U") { var a = num(tk[i + 1]); if (a.err) return a; var b = num(tk[i + 2]); if (b.err) return b; ops.push(["U", a.v, b.v]); i += 3; }
            else if (w === "F") { var c = num(tk[i + 1]); if (c.err) return c; ops.push(["F", c.v]); i += 2; }
            else return { err: "无法识别“" + tk[i] + "”：合并写成 U a b 或 Union(a,b)，查找写成 F x 或 Find(x)" };
          }
          if (ops.length > 30) return { err: "操作太多：最多 30 个（当前 " + ops.length + " 个）" };
          return { ops: ops };
        };
        function ufClone(st) { return { n: st.n, p: st.p.slice(), rk: st.rk.slice() }; }
        LABU.dsUfRun = function (n, ops, mode, compress) {
          if (!(n >= 2 && n <= 15)) return { err: "元素个数 n 应在 2–15 之间" };
          var st = LABU.dsUfInit(n), F = [], visits = 0;
          function snap(hl, d, ex) { var f = { st: ufClone(st), hl: hl || {}, d: d }; for (var q in ex || {}) f[q] = ex[q]; F.push(f); }
          snap({}, "初始化：" + n + " 个元素各自成一个集合，parent 全为 −1（根结点存集合大小的相反数）。合并方式：" + (mode === "rank" ? "按秩（树高）合并，矮树并入高树" : "普通合并，Union(a, b) 让 b 的根指向 a 的根") + (compress ? "；Find 时做路径压缩。" : "；不做路径压缩。"));
          function pathTxt(f) { return f.path.join(" → "); }
          ops.forEach(function (op) {
            var hl = {};
            if (op[0] === "F") {
              var before = ufClone(st), f = LABU.dsFind(st, op[1], false);
              visits += f.path.length;
              f.path.forEach(function (v) { hl[v] = "is-path"; }); hl[f.root] = "is-root"; hl[op[1]] = "is-cur";
              st = before;
              snap(hl, "Find(" + op[1] + ")：沿 parent 向上 " + pathTxt(f) + "，parent[" + f.root + "] = " + st.p[f.root] + " < 0，" + f.root + " 是根，经过 " + f.path.length + " 个结点。", { path: f.path });
              if (compress) {
                var f2 = LABU.dsFind(st, op[1], true);
                if (f2.moved.length) { var h2 = {}; f2.moved.forEach(function (v) { h2[v] = "is-new"; }); h2[f2.root] = "is-root"; snap(h2, "路径压缩：把路径上的 " + f2.moved.join("、") + " 直接挂到根 " + f2.root + " 下（parent 改为 " + f2.root + "），以后查找它们只需 2 步。"); }
              }
              return;
            }
            var a = op[1], b = op[2], s0 = ufClone(st), pa = LABU.dsFind(ufClone(s0), a, false), pb = LABU.dsFind(ufClone(s0), b, false);
            visits += pa.path.length + pb.path.length;
            pa.path.forEach(function (v) { hl[v] = "is-path"; }); pb.path.forEach(function (v) { hl[v] = "is-path"; });
            hl[pa.root] = "is-root"; hl[pb.root] = "is-root";
            snap(hl, "Union(" + a + ", " + b + ")：先 Find(" + a + ")：" + pathTxt(pa) + "，根为 " + pa.root + "；Find(" + b + ")：" + pathTxt(pb) + "，根为 " + pb.root + "。", { path: pa.path.concat(pb.path) });
            var r = LABU.dsUnion(st, a, b, mode, compress), moved = r.fa.moved.concat(r.fb.moved), h3 = {};
            if (r.same) { h3[r.ra] = "is-root"; snap(h3, a + " 和 " + b + " 的根都是 " + r.ra + "，已在同一集合，不合并。" + (moved.length ? "（顺带压缩了 " + moved.join("、") + "）" : "")); return; }
            h3[r.child] = "is-new"; h3[r.parent] = "is-root";
            var why = mode === "rank" ? (r.grew ? "两棵树高度相同（都为 " + (st.rk[r.parent] - 1) + "），" + r.rb + " 的根挂到 " + r.ra + " 下，树高加 1 变为 " + st.rk[r.parent] : "树 " + r.child + " 的高度 " + st.rk[r.child] + " 小于树 " + r.parent + " 的高度 " + st.rk[r.parent] + "，矮树 " + r.child + " 挂到高树 " + r.parent + " 下，树高不变") : "普通合并：让 " + b + " 的根 " + r.rb + " 指向 " + a + " 的根 " + r.ra;
            snap(h3, why + "；parent[" + r.child + "] = " + r.parent + "，parent[" + r.parent + "] = " + st.p[r.parent] + "（集合大小 " + (-st.p[r.parent]) + "）。" + (moved.length ? "Find 时已把 " + moved.join("、") + " 压缩到根下。" : ""));
          });
          var H = LABU.dsUfHeight(st), roots = st.p.filter(function (v) { return v < 0; }).length;
          snap({}, "全部完成：共 " + roots + " 个集合，最高的树有 " + H + " 层（⌊log₂" + n + "⌋ + 1 = " + (log2floor(n) + 1) + "），各次 Find 共经过 " + visits + " 个结点。", { end: true });
          return { frames: F, st: st, height: H, visits: visits };
        };
