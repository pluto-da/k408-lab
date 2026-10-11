      /* 数据结构动画实验（一）：中缀转后缀、循环队列、KMP、哈夫曼树、二叉排序树 / AVL、B 树、并查集。
         纯计算函数挂在 window.LABU 上，统一以 ds 前缀命名（dsInfix / dsCqRun / dsKmpNext / dsKmpNextval / dsKmpMatch / dsNaiveMatch /
         dsHuffman / dsBstInsert / dsBstDelete / dsAvlInsert / dsBstFrames / dsBtree / dsBtreeCheck / dsUnion / dsFind / dsUfRun …），
         界面通过 LAB.push 注册，顶层不访问 DOM。约定：KMP 下标从 1 开始（next[1] = 0）；循环队列 rear 指向队尾元素的下一个位置。 */
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

        /* ======================= 界面公共部分 ======================= */
        function ui(K) {
          K.out.innerHTML = '<div class="x-lab__stats" data-k="st"></div><p class="x-d1-say" data-k="say" aria-live="polite"></p><div data-k="tb"></div><p class="x-d1-tip" data-k="tip"></p>';
          var o = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { o[x.getAttribute("data-k")] = x; });
          return o;
        }
        function br(K) { K.opts.appendChild(X.el("span", { class: "x-lab__br" })); }
        function btnGroup(parent, list, cur, cb, lab) {
          var wrap = X.el("div", { class: "x-d1-grp", role: "group", "aria-label": lab || "选项" });
          if (lab) wrap.appendChild(X.el("span", { class: "x-lab__lbl" }, esc(lab)));
          parent.appendChild(wrap);
          var bs = list.map(function (it) {
            var b = X.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": it[0] === cur ? "true" : "false" }, esc(it[1]));
            b.addEventListener("click", function () { set(it[0]); cb(it[0]); });
            wrap.appendChild(b); return b;
          });
          function set(v) { bs.forEach(function (b, i) { b.setAttribute("aria-pressed", list[i][0] === v ? "true" : "false"); }); }
          return { set: set, el: wrap };
        }
        function field(parent, label, val, attrs, cb, small) {
          var l = X.el("label", { class: "x-lab__lbl x-d1-f" + (small ? " x-d1-f--s" : "") }, esc(label) + " ");
          var a = { type: "text", class: "x-lab__in", value: val, spellcheck: "false", autocomplete: "off" };
          for (var k in attrs || {}) a[k] = attrs[k];
          var i = X.el("input", a); l.appendChild(i); parent.appendChild(l);
          i.addEventListener("change", function () { cb(i.value); });
          i.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); cb(i.value); } });
          return i;
        }
        function presets(K, list) {
          var w = X.el("div", { class: "x-d1-grp x-d1-try", role: "group", "aria-label": "试试" }, '<span class="x-lab__lbl">试试</span>');
          list.forEach(function (p) {
            var b = X.el("button", { type: "button", class: "x-lab__btn x-lab__btn--ghost" }, esc(p[0]));
            b.addEventListener("click", p[1]); w.appendChild(b);
          });
          K.opts.appendChild(w);
        }
        function player(compute, render) {
          var S = { f: [], cur: 0, err: "", r: null };
          function draw() { try { render(S); } catch (e) { S.err = "绘制出错：" + (e && e.message ? e.message : e); render(S); } }
          function reset() {
            var r;
            try { r = compute(); } catch (e) { r = { err: "计算出错：" + (e && e.message ? e.message : e) }; }
            S.r = r; S.err = r.err || ""; S.f = r.frames || []; S.cur = 0; draw();
          }
          function step() { if (S.err || S.cur >= S.f.length - 1) return false; S.cur++; draw(); return S.cur < S.f.length - 1; }
          return { S: S, draw: draw, api: { step: step, reset: reset, done: function () { return !!S.err || S.cur >= S.f.length - 1; } } };
        }
        function showErr(K, o, err) {
          K.stage.innerHTML = ""; o.st.innerHTML = ""; o.tb.innerHTML = ""; o.tip.textContent = "";
          o.say.innerHTML = '<span class="x-lab__err">' + esc(err) + "</span>";
        }
        function newSvg(K, w, h, label) {
          K.stage.innerHTML = "";
          return X.svg("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": label, class: "x-d1-svg" }, K.stage);
        }
        function T(svg, x, y, s, cls, anchor, size) {
          var t = X.svg("text", { x: r1(x), y: r1(y), class: "x-d1-t" + (cls ? " " + cls : ""), "text-anchor": anchor || "middle", "font-size": size || 14 }, svg);
          t.textContent = s; return t;
        }
        function R(svg, x, y, w, h, cls) { return X.svg("rect", { x: r1(x), y: r1(y), width: r1(Math.max(0, w)), height: r1(h), rx: 3, class: cls || "x-d1-box" }, svg); }
        function L(svg, x1, y1, x2, y2, cls) { return X.svg("line", { x1: r1(x1), y1: r1(y1), x2: r1(x2), y2: r1(y2), class: cls || "x-d1-ln" }, svg); }
        function r1(v) { return Math.round(v * 10) / 10; }
        function tbl(cap, head, rows, cur, cls) {
          var h = '<div class="x-tbl x-d1-tbl' + (cls ? " " + cls : "") + '" tabindex="0"><table>' + (cap ? "<caption>" + cap + "</caption>" : "") + "<thead><tr>" +
            head.map(function (c) { return '<th scope="col">' + c + "</th>"; }).join("") + "</tr></thead><tbody>";
          rows.forEach(function (r, i) { h += "<tr" + (i === cur ? ' class="is-cur"' : "") + ">" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; });
          return h + "</tbody></table></div>";
        }
        function scroll(html) { return '<div class="x-d1-scroll">' + html + "</div>"; }
        function stat(k, v) { return "<span>" + k + " <b>" + v + "</b></span>"; }
        function arrowDefs(svg) {
          var defs = X.svg("defs", {}, svg);
          var mk = X.svg("marker", { id: "x-d1-ar", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 10, markerHeight: 10, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
          X.svg("path", { d: "M0,0 L10,5 L0,10 z", class: "x-d1-arh" }, mk);
        }

        /* 带关键字的结点树：按 id 复用 SVG 元素，位置变化用 CSS 过渡（旋转、合并时结点平滑移动） */
        function treeView() {
          var o = { svg: null, eg: null, ng: null, xg: null, N: {}, E: {} };
          function clearG(g) { while (g.firstChild) g.removeChild(g.firstChild); }
          o.draw = function (K, W, H, label, nodes, edges, extra) {
            if (!o.svg || o.svg.parentNode !== K.stage) {
              K.stage.innerHTML = "";
              o.svg = X.svg("svg", { class: "x-d1-svg", role: "img" }, K.stage);
              o.eg = X.svg("g", {}, o.svg); o.lg = X.svg("g", {}, o.svg); o.ng = X.svg("g", {}, o.svg); o.xg = X.svg("g", {}, o.svg); o.N = {}; o.E = {};
            }
            o.svg.setAttribute("viewBox", "0 0 " + W + " " + r1(H));
            o.svg.setAttribute("aria-label", label);
            var seen = {}, id;
            edges.forEach(function (e) {
              var p = o.E[e.id];
              if (!p) p = o.E[e.id] = X.svg("path", {}, o.eg);
              var d = "M" + r1(e.x1) + "," + r1(e.y1) + " L" + r1(e.x2) + "," + r1(e.y2);
              p.setAttribute("d", d);
              if (p.style) p.style.setProperty("d", 'path("' + d + '")');
              p.setAttribute("class", "x-d1-edge" + (e.cls ? " " + e.cls : ""));
              seen[e.id] = 1;
            });
            for (id in o.E) if (!seen[id]) { o.eg.removeChild(o.E[id]); delete o.E[id]; }
            seen = {};
            nodes.forEach(function (n) {
              var g = o.N[n.id];
              if (!g) {
                g = o.N[n.id] = { g: X.svg("g", {}, o.ng) };
                g.c = X.svg("circle", { cx: 0, cy: 0 }, g.g);
                g.t = X.svg("text", { class: "x-d1-nt", x: 0, y: 5, "text-anchor": "middle" }, g.g);
                g.s = X.svg("text", { class: "x-d1-ns", x: 0, y: 0, "text-anchor": "middle" }, g.g);
                g.b = X.svg("text", { class: "x-d1-nb", x: 0, y: 5, "text-anchor": "start" }, g.g);
              }
              var r = n.r || 18;
              g.g.setAttribute("transform", "translate(" + r1(n.x) + "," + r1(n.y) + ")");
              if (g.g.style) g.g.style.setProperty("transform", "translate(" + r1(n.x) + "px," + r1(n.y) + "px)");
              g.g.setAttribute("class", "x-d1-node" + (n.cls ? " " + n.cls : ""));
              g.c.setAttribute("r", r);
              g.t.textContent = n.t;
              g.t.setAttribute("font-size", n.fs || (String(n.t).length > 3 ? 13 : 15));
              g.s.textContent = n.sub || ""; g.s.setAttribute("y", r + 17);
              g.b.textContent = n.bf == null ? "" : n.bf; g.b.setAttribute("x", r + 3);
              g.b.setAttribute("class", "x-d1-nb" + (n.bfBad ? " is-bad" : ""));
              seen[n.id] = 1;
            });
            for (id in o.N) if (!seen[id]) { o.ng.removeChild(o.N[id].g); delete o.N[id]; }
            clearG(o.lg); clearG(o.xg);
            edges.forEach(function (e) {
              if (e.label == null) return;
              var mx = (e.x1 + e.x2) / 2, my = (e.y1 + e.y2) / 2;
              R(o.lg, mx - 8, my - 10, 16, 19, "x-d1-wbg");
              T(o.lg, mx, my + 5, e.label, "x-d1-el", "middle", 13);
            });
            if (extra) extra(o.xg);
          };
          return o;
        }
        /* 二叉树按中序名次横向排列、按层纵向排列：任意两棵子树不会重叠 */
        function layBin(root, gap) {
          var list = [], md = 0;
          (function walk(n, d) { if (!n) return; walk(n.l, d + 1); list.push({ n: n, d: d }); if (d > md) md = d; walk(n.r, d + 1); })(root, 0);
          var cnt = list.length, sp = cnt > 1 ? Math.min(64, 640 / (cnt - 1)) : 0, x0 = 360 - sp * (cnt - 1) / 2, pos = {}, yg = gap || 62;
          list.forEach(function (o, i) { pos[o.n.k] = { x: x0 + i * sp, y: 46 + o.d * yg }; });
          return { pos: pos, H: 46 + md * yg + 48, list: list };
        }
        /* 森林：叶子依次占一个槽位，双亲居中于孩子之上 */
        function layForest(roots, kids, leafCount, yg) {
          var trees = roots.length, gap = trees > 1 ? Math.max(0, Math.min(0.6, (15 - leafCount) / (trees - 1))) : 0;
          var pos = {}, slot = 0, md = 0;
          function walk(id, d) {
            if (d > md) md = d;
            var c = kids(id);
            if (!c.length) { pos[id] = { s: slot, d: d }; slot += 1; return pos[id].s; }
            var a = c.map(function (x) { return walk(x, d + 1); });
            pos[id] = { s: (a[0] + a[a.length - 1]) / 2, d: d };
            return pos[id].s;
          }
          roots.forEach(function (r, i) { if (i) slot += gap; walk(r, 0); });
          var total = slot - 1, sp = total > 0 ? Math.min(66, 640 / total) : 0, x0 = 360 - sp * total / 2;
          for (var id in pos) { pos[id].x = x0 + pos[id].s * sp; pos[id].y = 44 + pos[id].d * (yg || 60); }
          return { pos: pos, H: 44 + md * (yg || 60) + 40 };
        }

        /* ======================= 实验 1：中缀转后缀 ======================= */
        LAB.push({
          id: "infix", name: "中缀转后缀与求值", color: "var(--x-ds)",
          note: "转换规则：操作数直接输出；“(”直接入栈；“)”弹栈到“(”为止；运算符先弹出栈顶所有优先级不低于它的运算符（同级左结合也要弹），再入栈；扫描完把栈弹空。后缀表达式里操作数的相对次序与中缀相同，运算符次序可能变化，括号全部消失。后缀求值只用一个操作数栈：遇运算符弹两个，先弹出的是右操作数。选择题常问“栈中最多同时有几个运算符”，2012 年真题口径把“(”也算进去。",
          mount: function (panel, K) {
            var expr = "a+b*(c-d)-e/f", inp;
            inp = field(K.opts, "中缀表达式", expr, { "aria-label": "中缀表达式", inputmode: "text" }, function (v) { expr = v; K.restart(); });
            br(K);
            presets(K, [["a+b*(c-d)-e/f", "a+b*(c-d)-e/f"], ["3+4*(2-1)-6/3", "3+4*(2-1)-6/3"], ["2012 真题", "a+b-a*((c+d)/e-f)+g"], ["(15-3)/(2+2)*5", "(15-3)/(2+2)*5"]].map(function (p) {
              return [p[0], function () { expr = p[1]; inp.value = expr; K.restart(); }];
            }));
            var o = ui(K);
            var P = player(function () {
              var r = LABU.dsInfix(expr);
              if (r.err) return r;
              var fr = [{ ph: "c0", d: "从左到右扫描中缀表达式 " + r.tokens.map(function (t) { return t.v; }).join("") + "，用一个运算符栈完成转换。按“播放”或“下一步”。" }];
              r.steps.forEach(function (s, i) { fr.push({ ph: "c", k: i, d: s.d }); });
              fr.push({ ph: "cd", d: "转换结果：后缀表达式 " + r.postfix + "；栈中最多同时有 " + r.maxDepth + " 个元素" + (r.maxDepth !== r.maxOps ? "（含“(”；只数运算符为 " + r.maxOps + " 个）" : "") + "。" + (r.numeric ? (r.evalErr ? r.evalErr : "下面用操作数栈对后缀表达式求值。") : "含字母变量，不做求值。") });
              if (r.numeric && !r.evalErr) {
                r.evalSteps.forEach(function (s, i) { fr.push({ ph: "e", k: i, d: s.d }); });
                fr.push({ ph: "ed", d: "后缀表达式扫描完，操作数栈中只剩一个数 " + fnum(r.value) + "，就是表达式的值；求值时操作数栈最多 " + r.evalMax + " 个元素。" });
              }
              r.frames = fr;
              return r;
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var r = S.r, f = S.f[S.cur], ph = f.ph, i;
              var conv = r.steps, cs = ph === "c" ? conv[f.k] : ph === "c0" ? null : conv[conv.length - 1];
              var es = ph === "e" ? r.evalSteps[f.k] : ph === "ed" ? r.evalSteps[r.evalSteps.length - 1] : null;
              var inEval = ph === "e" || ph === "ed";
              var maxSt = Math.max(r.maxDepth, r.evalMax || 0, 1), H = Math.max(250, 150 + maxSt * 30 + 20);
              var svg = newSvg(K, 720, H, inEval ? "后缀表达式求值：操作数栈 " + (es ? es.stack.map(fnum).join(" ") : "") : "中缀转后缀：运算符栈 " + (cs ? cs.stack.join(" ") : "空") + "，输出 " + (cs ? cs.out.join(" ") : "空"));
              /* 输入记号条 */
              var toks = inEval ? r.post : r.tokens.map(function (t) { return t.v; }), n = toks.length;
              var cw = Math.min(34, Math.floor(660 / n)), x0 = (720 - cw * n) / 2, curI = inEval ? (es ? es.i : -1) : (cs ? cs.i : -1);
              T(svg, x0, 22, inEval ? "后缀表达式（逐个扫描）" : "中缀表达式（逐个扫描）", "x-d1-b x-d1-dim", "start", 13);
              for (i = 0; i < n; i++) {
                var done = i < curI || (ph === "cd") || (ph === "ed");
                R(svg, x0 + i * cw, 32, cw, 30, "x-d1-box" + (i === curI ? " is-hl" : done ? " is-was" : ""));
                T(svg, x0 + i * cw + cw / 2, 52, toks[i], "x-d1-mono", "middle", toks[i].length > 2 ? 13 : 15);
              }
              if (curI >= 0 && curI < n) T(svg, x0 + curI * cw + cw / 2, 80, "▲", "x-d1-acc", "middle", 13);
              /* 栈 */
              var stack = inEval ? (es ? es.stack.map(fnum) : []) : (cs ? cs.stack : []), sx = 40, sw = 96, by = H - 22;
              T(svg, sx + sw / 2, 108, inEval ? "操作数栈" : "运算符栈", "x-d1-b", "middle", 14);
              L(svg, sx, 118, sx, by, "x-d1-wall"); L(svg, sx + sw, 118, sx + sw, by, "x-d1-wall"); L(svg, sx, by, sx + sw, by, "x-d1-wall");
              stack.forEach(function (v, k) { var y = by - (k + 1) * 30; R(svg, sx + 4, y + 2, sw - 8, 26, "x-d1-box" + (k === stack.length - 1 ? " is-top" : "")); T(svg, sx + sw / 2, y + 20, v, "x-d1-mono", "middle", 15); });
              if (stack.length) T(svg, sx + sw + 8, by - stack.length * 30 + 20, "← 栈顶", "x-d1-dim", "start", 13);
              T(svg, sx + sw / 2, by + 18, "深度 " + stack.length, "x-d1-dim", "middle", 13);
              /* 输出 */
              var ox = 210;
              if (!inEval) {
                var out = cs ? cs.out : [], on = r.post.length, ow = Math.min(34, Math.floor(490 / on));
                T(svg, ox, 122, "后缀表达式（输出）", "x-d1-b", "start", 14);
                for (i = 0; i < on; i++) {
                  var has = i < out.length, fresh = cs && has && i >= out.length - (cs.pop.length || (/^输出/.test(cs.act) ? 1 : 0));
                  R(svg, ox + i * ow, 134, ow, 30, "x-d1-box" + (fresh && ph === "c" ? " is-new" : has ? "" : " is-empty"));
                  if (has) T(svg, ox + i * ow + ow / 2, 154, out[i], "x-d1-mono", "middle", out[i].length > 2 ? 13 : 15);
                }
                if (cs && ph === "c") T(svg, ox, 196, "本步：" + cs.act, "x-d1-acc", "start", 14);
                if (ph === "cd") T(svg, ox, 196, "后缀：" + r.postfix + (r.numeric && !r.evalErr ? "" : ""), "x-d1-acc x-d1-mono", "start", 15);
              } else {
                T(svg, ox, 122, "运算", "x-d1-b", "start", 14);
                if (es && es.calc) T(svg, ox, 156, es.calc, "x-d1-acc x-d1-mono", "start", 18);
                if (ph === "ed") T(svg, ox, 196, "表达式的值 = " + fnum(r.value), "x-d1-acc", "start", 16);
              }
              /* 统计 */
              o.st.innerHTML = stat("当前栈深度", stack.length) + stat("转换时栈最大深度", ph === "c0" ? "—" : r.maxDepth + (r.maxDepth !== r.maxOps ? "（运算符 " + r.maxOps + "）" : "")) +
                (ph === "cd" || inEval ? stat("后缀", esc(r.postfix)) : "") + (ph === "ed" ? stat("值", fnum(r.value)) : "");
              o.say.textContent = f.d;
              var rows = [], upto = ph === "c" ? f.k : ph === "c0" ? -1 : conv.length - 1;
              for (i = 0; i <= upto; i++) { var s = conv[i]; rows.push([String(i + 1), esc(s.i < r.tokens.length ? r.tokens[s.i].v : "结束"), esc(s.act), '<span class="x-d1-mono">' + esc(s.stack.join(" ") || "空") + "</span>", '<span class="x-d1-mono">' + esc(s.out.join(" ")) + "</span>"]); }
              var h = rows.length ? scroll(tbl("转换过程（答题格式）", ["步", "扫描", "操作", "栈（底→顶）", "输出"], rows, ph === "c" ? f.k : -1, "x-d1-wrap")) : "";
              if (inEval) {
                var rows2 = [], up2 = ph === "e" ? f.k : r.evalSteps.length - 1;
                for (i = 0; i <= up2; i++) { var e = r.evalSteps[i]; rows2.push([String(i + 1), esc(r.post[e.i]), esc(e.calc || "入栈"), '<span class="x-d1-mono">' + e.stack.map(fnum).join(" ") + "</span>"]); }
                h = scroll(tbl("后缀求值过程", ["步", "扫描", "运算", "操作数栈（底→顶）"], rows2, ph === "e" ? f.k : -1)) + h;
              }
              o.tb.innerHTML = h;
              o.tip.textContent = "优先级：* / 高于 + −，同级左结合；“(”在栈外优先级最高（直接入栈）、在栈内最低（只被“)”弹出）。栈深度按栈中元素个数统计，“(”也计入（2012 年真题口径）。";
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 2：循环队列 ======================= */
        LAB.push({
          id: "cqueue", name: "循环队列", color: "var(--x-ds)",
          note: "入队 rear = (rear + 1) % MaxSize，出队 front = (front + 1) % MaxSize。只靠 front == rear 无法区分空和满，三种办法：①牺牲一个单元，队满 (rear + 1) % MaxSize == front，最多存 MaxSize − 1 个；②增设 size，队空 size == 0、队满 size == MaxSize；③增设 tag，入队置 1、出队置 0，front == rear 时 tag 为 0 是空、为 1 是满。队列长度 (rear − front + MaxSize) % MaxSize。注意题目约定：有的教材让 rear 指向队尾元素本身，此时公式整体差 1。",
          mount: function (panel, K) {
            var N = 6, sc = "sac", ops = LABU.CQ_DEF.slice(), nextV = "i", iN, iV;
            iN = field(K.opts, "MaxSize", String(N), { inputmode: "numeric", "aria-label": "队列容量 MaxSize（3–10）" }, function (v) { var t = parseInt(v, 10); N = t; K.restart(); }, true);
            btnGroup(K.opts, LABU.CQ_SCHEMES, sc, function (v) { sc = v; K.restart(); }, "判满方案");
            br(K);
            iV = field(K.opts, "元素", nextV, { "aria-label": "要入队的元素", maxlength: "3" }, function (v) { nextV = v; }, true);
            var bE = X.el("button", { type: "button", class: "x-lab__btn x-lab__btn--main" }, "入队");
            var bD = X.el("button", { type: "button", class: "x-lab__btn" }, "出队");
            var bC = X.el("button", { type: "button", class: "x-lab__btn x-lab__btn--ghost" }, "清空重来");
            var ow = X.el("div", { class: "x-d1-grp", role: "group", "aria-label": "队列操作" });
            ow.appendChild(bE); ow.appendChild(bD); ow.appendChild(bC); K.opts.appendChild(ow);
            br(K);
            presets(K, [
              ["默认脚本", function () { N = 6; iN.value = "6"; ops = LABU.CQ_DEF.slice(); K.restart(); }],
              ["入满→出队→绕回", function () { N = 5; iN.value = "5"; ops = [["E", "1"], ["E", "2"], ["E", "3"], ["E", "4"], ["E", "5"], ["D"], ["D"], ["D"], ["E", "6"], ["E", "7"], ["E", "8"], ["D"]]; K.restart(); }],
              ["空队出队", function () { ops = [["D"], ["E", "x"], ["D"], ["D"]]; K.restart(); }]
            ]);
            function act(op) {
              if (P.S.err) return;
              ops = ops.slice(0, P.S.cur).concat([op]);
              K.restart();
              P.S.cur = Math.max(0, P.S.f.length - 1); P.draw();
            }
            bE.addEventListener("click", function () {
              var v = String(iV.value || "").replace(/\s+/g, "");
              if (!v) { o.say.innerHTML = '<span class="x-lab__err">请先在“元素”框里填要入队的值</span>'; return; }
              if (v.length > 3) { o.say.innerHTML = '<span class="x-lab__err">元素最多 3 个字符</span>'; return; }
              act(["E", v]);
              if (/^[a-y]$/.test(v)) { nextV = String.fromCharCode(v.charCodeAt(0) + 1); iV.value = nextV; }
              else if (/^\d+$/.test(v)) { nextV = String(parseInt(v, 10) + 1); iV.value = nextV; }
            });
            bD.addEventListener("click", function () { act(["D"]); });
            bC.addEventListener("click", function () { ops = []; K.restart(); });
            var o = ui(K);
            var P = player(function () {
              if (!/^\d+$/.test(String(N)) || N < 3 || N > 10) return { err: "MaxSize 应为 3–10 之间的整数" };
              return LABU.dsCqRun(N, sc, ops);
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var f = S.f[S.cur], s = f.s, n = s.N, i, cx = 215, cy = 172, r0 = 56, r1_ = 100;
              var svg = newSvg(K, 720, 344, "循环队列 MaxSize " + n + "，front " + s.front + "，rear " + s.rear);
              arrowDefs(svg);
              function pt(a, r) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
              function ang(k) { return -Math.PI / 2 + (k + 0.5) * 2 * Math.PI / n; }
              for (i = 0; i < n; i++) {
                var a0 = -Math.PI / 2 + i * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n, p1 = pt(a0, r1_), p2 = pt(a1, r1_), p3 = pt(a1, r0), p4 = pt(a0, r0);
                var dd = "M" + r1(p1[0]) + "," + r1(p1[1]) + " A" + r1_ + "," + r1_ + " 0 0 1 " + r1(p2[0]) + "," + r1(p2[1]) + " L" + r1(p3[0]) + "," + r1(p3[1]) + " A" + r0 + "," + r0 + " 0 0 0 " + r1(p4[0]) + "," + r1(p4[1]) + " Z";
                var full = s.q[i] != null, touched = f.op && f.ok && ((f.op[0] === "E" && i === (s.rear - 1 + n) % n) || (f.op[0] === "D" && i === (s.front - 1 + n) % n));
                var cls = "x-d1-slot" + (full ? " is-full" : "") + (touched ? " is-touch" : "") + (sc === "sac" && !full && i === s.rear && LABU.dsCqFull(s, sc) ? " is-sac" : "");
                X.svg("path", { d: dd, class: cls }, svg);
                var pm = pt(ang(i), (r0 + r1_) / 2);
                T(svg, pm[0], pm[1] + 6, full ? String(s.q[i]) : "", "x-d1-mono x-d1-b", "middle", 17);
                var pi = pt(ang(i), r0 - 14);
                T(svg, pi[0], pi[1] + 5, String(i), "x-d1-dim", "middle", 13);
              }
              function ptr(k, label, rr, cls) {
                var a = ang(k), pa = pt(a, r1_ + 4), pb = pt(a, rr);
                L(svg, pb[0], pb[1], pa[0], pa[1], "x-d1-ptr " + cls).setAttribute("marker-end", "url(#x-d1-ar)");
                var pl = pt(a, rr + 14);
                T(svg, pl[0], pl[1] + 5, label, "x-d1-b " + cls + "-t", Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle", 14);
              }
              ptr(s.front, "front", r1_ + 26, "x-d1-pf");
              ptr(s.rear, "rear", r1_ + 50, "x-d1-pr");
              var c = LABU.dsCqCond(s, sc), em = LABU.dsCqEmpty(s, sc), fu = LABU.dsCqFull(s, sc), len = LABU.dsCqLen(s, sc), x = 440, y = 34;
              T(svg, x, y, "MaxSize = " + n + "（" + LABU.CQ_SCHEMES.filter(function (q) { return q[0] === sc; })[0][1] + "）", "x-d1-b", "start", 15);
              T(svg, x, y + 28, "front = " + s.front + "   rear = " + s.rear, "x-d1-mono", "start", 15);
              if (sc !== "sac") T(svg, x, y + 50, sc === "size" ? "size = " + s.size : "tag = " + s.tag, "x-d1-mono", "start", 15);
              T(svg, x, y + 84, "判空  " + c.ef, "x-d1-b", "start", 13);
              T(svg, x, y + 104, c.ev + (em ? "  ✓ 空" : "  ✗"), "x-d1-mono" + (em ? " x-d1-acc" : ""), "start", 13);
              T(svg, x, y + 136, "判满  " + c.ff, "x-d1-b", "start", 13);
              T(svg, x, y + 156, c.fv + (fu ? "  ✓ 满" : "  ✗"), "x-d1-mono" + (fu ? " x-d1-bad" : ""), "start", 13);
              var lf = (s.rear - s.front + n) % n;
              T(svg, x, y + 190, "长度 (rear−front+MaxSize)%MaxSize", "x-d1-b", "start", 13);
              T(svg, x, y + 210, "= (" + s.rear + " − " + s.front + " + " + n + ") % " + n + " = " + lf, "x-d1-mono", "start", 13);
              if (len !== lf) T(svg, x, y + 230, "tag = 1 表示满，实际长度 " + len, "x-d1-dim", "start", 13);
              if (f.op) T(svg, x, y + 264, (f.op[0] === "E" ? "入队 " + f.op[1] : "出队") + (f.ok ? " ✓" : " ✗ 失败"), f.ok ? "x-d1-acc x-d1-b" : "x-d1-bad x-d1-b", "start", 16);
              o.st.innerHTML = stat("元素个数", len) + stat("最多可存", sc === "sac" ? n - 1 : n) + stat("操作", S.cur + " / " + (S.f.length - 1));
              o.say.textContent = f.d;
              var rows = [];
              for (i = 1; i <= S.cur; i++) { var g = S.f[i]; rows.push([String(i), g.op[0] === "E" ? "入队 " + esc(g.op[1]) : "出队", g.ok ? "成功" : '<span class="is-bad">失败</span>', String(g.s.front), String(g.s.rear), sc === "size" ? String(g.s.size) : sc === "tag" ? String(g.s.tag) : "—", String(LABU.dsCqLen(g.s, sc))]); }
              o.tb.innerHTML = rows.length ? scroll(tbl("操作记录", ["#", "操作", "结果", "front", "rear", sc === "tag" ? "tag" : "size", "长度"], rows, S.cur - 1)) : "";
              o.tip.textContent = "“播放”按顺序执行操作脚本；也可以随时用“入队 / 出队”按钮手动操作（从当前这一步接着做，后面的脚本被替换）。约定：front 指向队头元素，rear 指向队尾元素的下一个位置。";
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 3：KMP ======================= */
        LAB.push({
          id: "kmp", name: "KMP 与 next 数组", color: "var(--x-ds)",
          note: "next[j] = P[1..j−1] 的最长相等前后缀长度 + 1，约定 next[1] = 0、next[2] = 1（下标从 1 开始，国内考题最常见的约定；若下标从 0 开始，next 整体减 1，首位为 −1）。失配时主串指针 i 不回溯，模式串指针 j = next[j]；j = 0 时 i、j 同时后移。nextval：若 P[j] = P[next[j]] 则 nextval[j] = nextval[next[j]]，否则等于 next[j]。KMP 时间复杂度 O(m + n)，朴素匹配最坏 O(mn)；主串与模式串部分匹配多时 KMP 优势才明显。",
          mount: function (panel, K) {
            var S0 = "abaabaabcabaabc", P0 = "abaabc", mode = "next", iS, iP;
            iS = field(K.opts, "主串 S", S0, { "aria-label": "主串" }, function (v) { S0 = v; K.restart(); });
            iP = field(K.opts, "模式串 T", P0, { "aria-label": "模式串" }, function (v) { P0 = v; K.restart(); });
            br(K);
            btnGroup(K.opts, [["next", "按 next 匹配"], ["nextval", "按 nextval 匹配"], ["naive", "朴素匹配"]], mode, function (v) { mode = v; K.restart(); }, "匹配方式");
            br(K);
            presets(K, [["2019 真题（比较 10 次）", "abaabaabcabaabc", "abaabc"], ["2015 真题", "abaabaabacacaabaabcc", "abaabc"], ["nextval 优势", "aaabaaaab", "aaaab"], ["ababaaababaa", "ababaabababaaababaa", "ababaaababaa"]].map(function (p) {
              return [p[0], function () { S0 = p[1]; P0 = p[2]; iS.value = S0; iP.value = P0; K.restart(); }];
            }));
            var o = ui(K);
            var P = player(function () {
              var s = String(S0).replace(/\s+/g, ""), p = String(P0).replace(/\s+/g, "");
              if (!s || !p) return { err: "主串和模式串都不能为空" };
              if (s.length > 30) return { err: "主串太长：最多 30 个字符（当前 " + s.length + " 个）" };
              if (p.length > 15) return { err: "模式串太长：最多 15 个字符（当前 " + p.length + " 个）" };
              if (p.length > s.length) return { err: "模式串不能比主串长" };
              var nx = LABU.dsKmpNext(p), nv = LABU.dsKmpNextval(p, nx.next);
              var mk = LABU.dsKmpMatch(s, p, nx.next), mv = LABU.dsKmpMatch(s, p, nv), nb = LABU.dsNaiveMatch(s, p);
              var run = mode === "next" ? mk : mode === "nextval" ? mv : nb, arr = mode === "nextval" ? nv : nx.next;
              var fr = [{ ph: "i", d: "先求模式串 " + p + " 的 next 数组（下标从 1 开始），再求 nextval，最后在主串上逐步匹配。" }];
              nx.steps.forEach(function (st) {
                var d = st.j === 1 ? "next[1] = 0：约定值，表示 P[1] 都失配时主串指针后移。" : st.j === 2 ? "next[2] = 1：约定值（P[1] 只有一个字符，没有真前后缀），失配时从 P[1] 重新比。" :
                  "第 " + st.j + " 位前面的子串 " + st.sub + " 的最长相等前后缀" + (st.len ? "是 " + st.sub.slice(0, st.len) + "，长度 " + st.len : "长度为 0") + "，所以 next[" + st.j + "] = " + st.len + " + 1 = " + st.v + "。";
                fr.push({ ph: "n", j: st.j, len: st.len, d: d });
              });
              for (var j = 1; j <= p.length; j++) {
                var d2;
                if (j === 1) d2 = "nextval[1] = 0（约定）。";
                else { var k = nx.next[j - 1], same = p.charAt(j - 1) === p.charAt(k - 1); d2 = "j = " + j + "：next[" + j + "] = " + k + "，P[" + j + "] = " + p.charAt(j - 1) + (same ? " 等于 " : " 不等于 ") + "P[" + k + "] = " + p.charAt(k - 1) + (same ? "，失配后再比 P[" + k + "] 必然也失配，所以 nextval[" + j + "] = nextval[" + k + "] = " + nv[k - 1] + "。" : "，所以 nextval[" + j + "] = next[" + j + "] = " + k + "。"); }
                fr.push({ ph: "v", j: j, d: d2 });
              }
              fr.push({ ph: "m0", d: "开始" + (mode === "naive" ? "朴素匹配：失配时主串指针 i 回溯到 i − j + 2，模式串从头比。" : "KMP 匹配（按 " + mode + " 数组）：失配时 i 不动，j = " + mode + "[j]。") });
              run.steps.forEach(function (st) {
                var d3;
                if (st.k === "c") d3 = "第 " + st.cmp + " 次比较：S[" + st.i + "] = " + s.charAt(st.i - 1) + (st.eq ? " = " : " ≠ ") + "T[" + st.j + "] = " + p.charAt(st.j - 1) + (st.eq ? "，相等，i、j 都后移。" : "，失配。");
                else if (st.k === "s") d3 = "失配后 i = " + st.i + " 不回溯，j = " + mode + "[" + st.j + "] = " + st.nj + (st.nj === 0 ? "，j 为 0 表示 T[1] 也不用比了，下一步 i、j 同时后移。" : "，模式串向右滑动 " + (st.j - st.nj) + " 位，用 T[" + st.nj + "] 接着和 S[" + st.i + "] 比。");
                else if (st.k === "z") d3 = "j = 0：i 后移到 " + (st.i + 1) + "，j = 1，从 T[1] 与 S[" + (st.i + 1) + "] 开始比。";
                else d3 = "朴素匹配失配：i 回溯到 i − j + 2 = " + st.ni + "，j 回到 1，模式串只右移 1 位。";
                fr.push({ ph: "m", st: st, d: d3 });
              });
              fr.push({ ph: "md", d: (run.pos ? "匹配成功，模式串在主串中的位置是 " + run.pos + "（从 1 开始）" : "匹配失败，主串中没有该模式串") + "，共比较 " + run.cmp + " 次。对比：按 next " + mk.cmp + " 次，按 nextval " + mv.cmp + " 次，朴素匹配 " + nb.cmp + " 次。" });
              return { frames: fr, s: s, p: p, next: nx.next, nv: nv, run: run, arr: arr, mk: mk, mv: mv, nb: nb, nsteps: nx.steps };
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var r = S.r, f = S.f[S.cur], s = r.s, p = r.p, n = s.length, m = p.length, i, ph = f.ph;
              var nDone = 0, vDone = 0;
              for (i = 0; i <= S.cur; i++) { if (S.f[i].ph === "n") nDone = S.f[i].j; if (S.f[i].ph === "v") vDone = S.f[i].j; }
              var matchPh = ph === "m" || ph === "m0" || ph === "md";
              var svg;
              if (!matchPh) {
                svg = newSvg(K, 720, 190, "模式串 " + p);
                var cw = Math.min(40, Math.floor(640 / m)), x0 = (720 - cw * m) / 2;
                T(svg, x0 - 8, 44, "j", "x-d1-dim", "end", 13); T(svg, x0 - 8, 74, "T[j]", "x-d1-dim", "end", 13);
                for (i = 0; i < m; i++) {
                  var j = i + 1, cls = "x-d1-box";
                  if (ph === "n" && j === f.j) cls += " is-hl";
                  else if (ph === "n" && f.len > 0 && j < f.j && (j <= f.len || j >= f.j - f.len)) cls += j <= f.len ? " is-pre" : " is-suf";
                  else if (ph === "v" && (j === f.j || (f.j > 1 && j === r.next[f.j - 1]))) cls += j === f.j ? " is-hl" : " is-pre";
                  T(svg, x0 + i * cw + cw / 2, 44, String(j), "x-d1-dim", "middle", 13);
                  R(svg, x0 + i * cw, 52, cw, 32, cls);
                  T(svg, x0 + i * cw + cw / 2, 74, p.charAt(i), "x-d1-mono x-d1-b", "middle", 16);
                }
                if (ph === "n" && f.j > 2) {
                  if (f.len > 0) {
                    L(svg, x0 + 2, 96, x0 + f.len * cw - 2, 96, "x-d1-brk x-d1-brk--a");
                    L(svg, x0 + (f.j - 1 - f.len) * cw + 2, 104, x0 + (f.j - 1) * cw - 2, 104, "x-d1-brk x-d1-brk--b");
                    T(svg, 360, 136, "最长相等前后缀：" + p.slice(0, f.len) + "（长度 " + f.len + "）→ next[" + f.j + "] = " + (f.len + 1), "x-d1-acc", "middle", 15);
                  } else T(svg, 360, 136, p.slice(0, f.j - 1) + " 没有相等的真前后缀 → next[" + f.j + "] = 1", "x-d1-acc", "middle", 15);
                  L(svg, x0, 90, x0 + (f.j - 1) * cw, 90, "x-d1-ln");
                } else if (ph === "n") T(svg, 360, 136, "next[" + f.j + "] = " + r.next[f.j - 1] + "（约定）", "x-d1-acc", "middle", 15);
                else if (ph === "v") T(svg, 360, 136, "nextval[" + f.j + "] = " + r.nv[f.j - 1], "x-d1-acc", "middle", 15);
                else T(svg, 360, 136, "模式串长度 m = " + m + "，主串长度 n = " + n, "x-d1-dim", "middle", 14);
              } else {
                var cols = n + m - 1, cw2 = Math.max(14, Math.min(32, Math.floor(690 / cols)));
                var x1 = Math.max(24, Math.min((720 - cw2 * n) / 2, 716 - cw2 * cols));
                svg = newSvg(K, 720, 200, "主串 " + s + "，模式串 " + p);
                var st = ph === "m" ? f.st : null, ii = st ? st.i : 1, jj = st ? (st.k === "s" ? st.j : st.j) : 1;
                var start = st ? (st.k === "z" ? st.i + 1 : st.i - st.j + 1) : 1;
                if (ph === "md") { start = r.run.pos || start; ii = -1; }
                if (st && st.k === "s") start = st.i - st.nj + 1;
                if (st && st.k === "b") start = st.ni;
                T(svg, x1 - 6, 52, "S", "x-d1-b", "end", 14); T(svg, x1 - 6, 132, "T", "x-d1-b", "end", 14);
                for (i = 0; i < n; i++) {
                  var c1 = "x-d1-box" + (st && st.k === "c" && i + 1 === ii ? (st.eq ? " is-ok" : " is-bad") : "") + (ph === "md" && r.run.pos && i + 1 >= r.run.pos && i + 1 < r.run.pos + m ? " is-ok" : "");
                  if (cw2 >= 18 || (i + 1) % 5 === 0 || i === 0) T(svg, x1 + i * cw2 + cw2 / 2, 26, String(i + 1), "x-d1-dim", "middle", 13);
                  R(svg, x1 + i * cw2, 32, cw2, 30, c1);
                  T(svg, x1 + i * cw2 + cw2 / 2, 53, s.charAt(i), "x-d1-mono", "middle", 15);
                }
                for (i = 0; i < m; i++) {
                  var px = x1 + (start - 1 + i) * cw2, c2 = "x-d1-box";
                  if (st && st.k === "c" && i + 1 === jj) c2 += st.eq ? " is-ok" : " is-bad";
                  if (st && st.k === "s" && i + 1 === st.nj) c2 += " is-hl";
                  R(svg, px, 112, cw2, 30, c2);
                  T(svg, px + cw2 / 2, 133, p.charAt(i), "x-d1-mono", "middle", 15);
                  if (cw2 >= 18) T(svg, px + cw2 / 2, 160, String(i + 1), "x-d1-dim", "middle", 13);
                }
                if (st && st.k !== "z") {
                  var ix = x1 + (st.i - 1) * cw2 + cw2 / 2;
                  T(svg, ix, 82, "i = " + st.i, "x-d1-pf-t x-d1-b", "middle", 13);
                  L(svg, ix, 86, ix, 108, "x-d1-ptr x-d1-pf");
                }
                var msg = st ? (st.k === "c" ? (st.eq ? "相等" : "失配") : st.k === "s" ? "j = " + r.arr[st.j - 1] + "（i 不动，T 右滑 " + (st.j - st.nj) + " 位）" : st.k === "z" ? "j = 0 → i++、j = 1" : "i 回溯到 " + st.ni + "，j = 1") : ph === "md" ? (r.run.pos ? "匹配成功，位置 " + r.run.pos : "匹配失败") : "从 i = 1、j = 1 开始";
                T(svg, 360, 190, msg + "    已比较 " + (st ? st.cmp : ph === "md" ? r.run.cmp : 0) + " 次", "x-d1-acc", "middle", 15);
              }
              o.st.innerHTML = stat("next", nDone >= m ? r.next.join(" ") : "…") + stat("nextval", vDone >= m ? r.nv.join(" ") : "…") +
                (ph === "md" ? stat("比较次数", "next " + r.mk.cmp + " / nextval " + r.mv.cmp + " / 朴素 " + r.nb.cmp) : "");
              o.say.textContent = f.d;
              var head = ["j"], rP = ["T[j]"], rL = ["最长相等前后缀长度"], rN = ["next[j]"], rV = ["nextval[j]"];
              for (i = 0; i < m; i++) {
                var jx = i + 1, curC = (ph === "n" || ph === "v") && f.j === jx;
                head.push(String(jx));
                rP.push('<span class="x-d1-mono">' + esc(p.charAt(i)) + "</span>");
                rL.push(jx <= nDone ? (jx <= 2 ? "—" : String(r.nsteps[i].len)) : "");
                rN.push(jx <= nDone ? (curC && ph === "n" ? "<b>" + r.next[i] + "</b>" : String(r.next[i])) : "");
                rV.push(jx <= vDone ? (curC && ph === "v" ? "<b>" + r.nv[i] + "</b>" : String(r.nv[i])) : "");
              }
              o.tb.innerHTML = tbl("next / nextval 表（下标从 1 开始）", head, [rP, rL, rN, rV], ph === "n" ? 2 : ph === "v" ? 3 : -1, "x-d1-kmp");
              o.tip.textContent = "约定：下标从 1 开始，next[1] = 0。若按下标从 0 开始的写法（next[0] = −1），每一项都比这里小 1，滑动结果完全相同。比较次数只统计字符之间的比较，j = 0 的那一步不算。";
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 4：哈夫曼树 ======================= */
        LAB.push({
          id: "huffman", name: "哈夫曼树与编码", color: "var(--x-ds)",
          note: "每次从森林中选两棵根权值最小的树合并，新根权值为两者之和；n 个叶子合并 n − 1 次，结点总数 2n − 1，没有度为 1 的结点。WPL = Σ 叶子权值 × 路径长度 = 所有非叶结点权值之和。权值相同时选法不同、左右次序不同，哈夫曼树不唯一，但 WPL 相同且最小。哈夫曼编码是前缀编码（任何编码都不是另一个的前缀），左 0 右 1 只是约定。",
          mount: function (panel, K) {
            var txt = "7 5 2 4", inp;
            inp = field(K.opts, "权值", txt, { "aria-label": "权值序列，可写成 a:45 b:13" }, function (v) { txt = v; K.restart(); });
            br(K);
            presets(K, [["7 5 2 4", "7 5 2 4"], ["2023 真题 3 4 5 6 8 10", "3 4 5 6 8 10"], ["经典示例·8 字符", "a:5 b:29 c:7 d:8 e:14 f:23 g:3 h:11"], ["a:45 b:13 c:12 d:16 e:9 f:5", "a:45 b:13 c:12 d:16 e:9 f:5"]].map(function (p) {
              return [p[0], function () { txt = p[1]; inp.value = txt; K.restart(); }];
            }));
            var o = ui(K), tv = treeView();
            var P = player(function () {
              var pr = LABU.dsHuffParse(txt); if (pr.err) return pr;
              var r = LABU.dsHuffman(pr.items); if (r.err) return r;
              var N = r.nodes, nm = function (id) { return N[id].ch ? N[id].ch + "(" + fnum(N[id].w) + ")" : fnum(N[id].w); };
              var fr = [{ ph: "i", k: 0, d: "初始森林：" + pr.items.length + " 棵只有根结点的树，权值 " + pr.items.map(function (it) { return fnum(it.w); }).join("、") + "。每一步选两棵根权值最小的树合并。" }];
              r.steps.slice(1).forEach(function (st, i) {
                fr.push({ ph: "m", k: i + 1, d: "第 " + (i + 1) + " 步：森林 {" + st.before.map(nm).join(", ") + "} 中最小的两个是 " + nm(st.pick[0]) + " 和 " + nm(st.pick[1]) + "，合并成新结点 " + fnum(N[st.made].w) + "（较小者作左孩子），森林变为 {" + st.forest.map(nm).join(", ") + "}。" });
              });
              fr.push({ ph: "c", k: r.steps.length - 1, d: "合并结束，只剩一棵树，就是哈夫曼树。左分支记 0、右分支记 1，从根到叶的 0/1 串就是该字符的哈夫曼编码。" });
              fr.push({ ph: "w", k: r.steps.length - 1, d: "WPL = " + r.codes.map(function (c) { return fnum(c.w) + "×" + c.len; }).join(" + ") + " = " + fnum(r.wpl) + "；也等于所有非叶结点权值之和 " + fnum(r.innerSum) + "。结点总数 2n − 1 = " + r.total + "。" });
              r.frames = fr; r.items = pr.items;
              return r;
            }, render);
            function render(S) {
              if (S.err) { tv.svg = null; return showErr(K, o, S.err); }
              var r = S.r, f = S.f[S.cur], st = r.steps[f.k], N = r.nodes, n = r.items.length;
              var kids = function (id) { return N[id].l >= 0 ? [N[id].l, N[id].r] : []; };
              var lay = layForest(st.forest, kids, n, 64), nodes = [], edges = [], fin = f.ph === "c" || f.ph === "w";
              function walk(id) {
                var p = lay.pos[id], nd = N[id], cls = "";
                if (f.ph === "m" && st.pick && (id === st.pick[0] || id === st.pick[1])) cls = "is-piv";
                if (f.ph === "m" && id === st.made) cls = "is-new";
                if (fin && nd.l < 0) cls = "is-leaf";
                var code = fin && nd.l < 0 ? r.codes[id].code : "";
                nodes.push({ id: id, x: p.x, y: p.y, t: fnum(nd.w), r: 19, cls: cls + (nd.l < 0 ? " x-d1-lf" : ""), sub: nd.l < 0 ? (nd.ch ? nd.ch + (code ? " " + code : "") : code) : "" });
                kids(id).forEach(function (c, k) { var q = lay.pos[c]; edges.push({ id: "e" + c, x1: p.x, y1: p.y, x2: q.x, y2: q.y, label: k ? "1" : "0", cls: f.ph === "m" && id === st.made ? "is-hl" : "" }); walk(c); });
              }
              st.forest.forEach(walk);
              var hasSub = fin || r.items.some(function (it) { return it.ch; });
              tv.draw(K, 720, lay.H + (hasSub ? 22 : 0), "哈夫曼森林：" + st.forest.map(function (id) { return fnum(N[id].w); }).join("、"), nodes, edges);
              o.st.innerHTML = stat("叶子 n", n) + stat("森林中树的棵数", st.forest.length) + stat("已合并", f.k + " / " + (n - 1)) + (f.ph === "w" ? stat("WPL", fnum(r.wpl)) + stat("结点总数", r.total) : "");
              o.say.textContent = f.d;
              var rows = [];
              for (var i = 1; i <= f.k; i++) { var s2 = r.steps[i]; rows.push([String(i), fnum(N[s2.pick[0]].w) + " + " + fnum(N[s2.pick[1]].w), "<b>" + fnum(N[s2.made].w) + "</b>", s2.forest.map(function (id) { return fnum(N[id].w); }).join(", ")]); }
              var h = rows.length ? tbl("合并过程", ["步", "选出的两棵", "新结点", "合并后森林"], rows, f.ph === "m" ? f.k - 1 : -1) : "";
              if (fin) {
                var rows2 = r.codes.map(function (c) { return [esc(c.ch || "—"), fnum(c.w), '<span class="x-d1-mono">' + c.code + "</span>", String(c.len), fnum(c.w * c.len)]; });
                rows2.push(["合计", fnum(r.sumW), "", "", "<b>WPL = " + fnum(r.wpl) + "</b>"]);
                h = tbl("哈夫曼编码（左 0 右 1）", ["字符", "权值", "编码", "码长", "权值 × 码长"], rows2, -1) + h;
              }
              o.tb.innerHTML = h;
              o.tip.textContent = "本实验的取法：权值相同时先取在森林中排得靠前的（新结点排在最后），较小者作左孩子。换一种取法树形会变，但 WPL 不变。平均码长 = WPL / 权值总和" + (fin ? " = " + fnum(r.wpl) + " / " + fnum(r.sumW) + " ≈ " + fnum(Math.round(r.wpl / r.sumW * 1000) / 1000) : "") + "。";
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 5：二叉排序树 / AVL ======================= */
        LAB.push({
          id: "bst", name: "二叉排序树与 AVL", color: "var(--x-ds)",
          note: "二叉排序树中序遍历有序；插入的新结点一定是叶结点。删除：叶结点直接删；只有一棵子树就让子树顶替；有两棵子树用中序直接后继（或前驱）替代再删它。AVL 平衡因子 = 左子树高 − 右子树高，|BF| ≤ 1。插入后只需调整离插入点最近的最小不平衡子树：LL 右旋、RR 左旋、LR 先左后右、RL 先右后左，一次调整后整棵树恢复平衡。高度为 h 的 AVL 最少结点数 n(h) = n(h−1) + n(h−2) + 1（1, 2, 4, 7, 12…），查找 O(log n)。",
          mount: function (panel, K) {
            var mode = "avl", ks = "3 2 1 4 5 6 7 16 15 14", ds = "", pred = false, iK, iD;
            var mg = btnGroup(K.opts, [["bst", "二叉排序树（含删除）"], ["avl", "平衡二叉树 AVL"]], mode, function (v) { mode = v; K.restart(); }, "模式");
            br(K);
            iK = field(K.opts, "插入序列", ks, { inputmode: "numeric", "aria-label": "依次插入的关键字" }, function (v) { ks = v; K.restart(); });
            iD = field(K.opts, "删除（BST）", ds, { inputmode: "numeric", placeholder: "可留空", "aria-label": "插入后依次删除的关键字" }, function (v) { ds = v; K.restart(); });
            br(K);
            var pg = btnGroup(K.opts, [[false, "后继替代"], [true, "前驱替代"]], pred, function (v) { pred = v; K.restart(); }, "删除双子结点");
            br(K);
            presets(K, [
              ["AVL：3 2 1（LL）", "avl", "3 2 1", ""],
              ["AVL 四种旋转", "avl", "20 10 5 30 40 25 23 8 9", ""],
              ["AVL 连续插入", "avl", "3 2 1 4 5 6 7 16 15 14", ""],
              ["BST 三种删除", "bst", "50 30 70 20 40 60 80 35 45 65", "20 60 30 50"]
            ].map(function (p) {
              return [p[0], function () { mode = p[1]; mg.set(mode); ks = p[2]; ds = p[3]; iK.value = ks; iD.value = ds; K.restart(); }];
            }));
            var o = ui(K), tv = treeView();
            var P = player(function () {
              var a = LABU.dsParseKeys(ks, { name: "关键字", dupWhy: "二叉排序树中关键字互不相同" }); if (a.err) return a;
              var b = LABU.dsParseKeys(ds, { min: 0, name: "删除的关键字" }); if (b.err) return b;
              var r = LABU.dsBstFrames(a.keys, { avl: mode === "avl", dels: mode === "avl" ? [] : b.keys, pred: pred });
              r.keys = a.keys; r.ignoredDel = mode === "avl" && b.keys.length > 0;
              return r;
            }, render);
            function render(S) {
              if (S.err) { tv.svg = null; return showErr(K, o, S.err); }
              var r = S.r, f = S.f[S.cur], t = f.t, lay = layBin(t, 64), nodes = [], edges = [];
              var bm = {}; (function w(n) { if (!n) return; bm[n.k] = LABU.dsBf(n); w(n.l); w(n.r); })(t);
              lay.list.forEach(function (it) {
                var n = it.n, p = lay.pos[n.k], b = bm[n.k];
                nodes.push({ id: n.k, x: p.x, y: p.y, t: String(n.k), cls: f.hl[n.k] || "", bf: mode === "avl" || f.ph === "end" ? (b > 0 ? "+" + b : b < 0 ? "−" + (-b) : "0") : null, bfBad: Math.abs(b) > 1 });
                [n.l, n.r].forEach(function (c) { if (c) { var q = lay.pos[c.k]; edges.push({ id: "e" + c.k, x1: p.x, y1: p.y, x2: q.x, y2: q.y, cls: f.hl[c.k] && f.hl[n.k] ? "is-hl" : "" }); } });
              });
              tv.draw(K, 720, Math.max(lay.H, f.rot ? 120 : 90), "二叉树，中序：" + LABU.dsInorder(t).join(" "), nodes, edges, function (g) {
                if (!t) T(g, 360, 56, "空树", "x-d1-dim", "middle", 15);
                if (f.rot) { R(g, 10, 8, 120, 30, "x-d1-tag"); T(g, 70, 29, f.rot, "x-d1-tag-t", "middle", 16); }
              });
              var cnt = lay.list.length;
              o.st.innerHTML = stat("结点数", cnt) + stat("树高", LABU.dsHeight(t)) + (mode === "avl" ? stat("已旋转", r.rots.length ? r.rots.join("、") : "—") : "") + (f.ph === "end" ? stat("ASL 成功", esc(r.asl.expr)) : "");
              o.say.textContent = f.d;
              o.tb.innerHTML = cnt ? tbl("当前中序序列（应当有序）", ["中序"], [['<span class="x-d1-mono">' + LABU.dsInorder(t).join(" ") + "</span>"]], -1) : "";
              o.tip.textContent = (mode === "avl" ? "结点右上角数字是平衡因子 BF = 左子树高 − 右子树高（红色表示 |BF| = 2）。红圈 = 最小不平衡子树的根，橙圈 = 旋转轴。" : "删除有两棵子树的结点时，可切换用中序后继或前驱替代，两种结果都正确。") +
                (r.ignoredDel ? " AVL 模式只演示插入，删除序列已忽略。" : "");
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 6：B 树 ======================= */
        LAB.push({
          id: "btree", name: "B 树插入与删除", color: "var(--x-ds)",
          note: "m 阶 B 树：每个结点至多 m 棵子树、m − 1 个关键字；非根结点至少 ⌈m/2⌉ 棵子树、⌈m/2⌉ − 1 个关键字；根至少 1 个关键字；所有叶结点（终端结点）在同一层。插入总在终端结点，溢出时从第 ⌈m/2⌉ 个关键字处分裂、中间关键字上移，分裂到根时树长高。删除非终端结点的关键字先用前驱（或后继）替代；下溢时兄弟够借就“父下移、兄上移”，不够借就与兄弟及父结点的分隔关键字合并，合并可能一路传到根使树变矮。含 n 个关键字的 m 阶 B 树高度 h ≤ log⌈m/2⌉((n+1)/2) + 1。",
          mount: function (panel, K) {
            var m = 3, ks = "53 75 139 49 145 36 101 20 66 88", ds = "36 145 53 88", iK, iD;
            var mg = btnGroup(K.opts, [[3, "3 阶"], [4, "4 阶"], [5, "5 阶"]], m, function (v) { m = v; K.restart(); }, "阶数 m");
            br(K);
            iK = field(K.opts, "插入序列", ks, { inputmode: "numeric", "aria-label": "依次插入的关键字" }, function (v) { ks = v; K.restart(); });
            iD = field(K.opts, "删除序列", ds, { inputmode: "numeric", placeholder: "可留空", "aria-label": "插入后依次删除的关键字" }, function (v) { ds = v; K.restart(); });
            br(K);
            presets(K, [
              ["3 阶 插入 + 删除", 3, "53 75 139 49 145 36 101 20 66 88", "36 145 53 88"],
              ["2020 真题（4 阶）", 4, "5 6 9 13 8 2 12 15", ""],
              ["3 阶 10 20 30 …", 3, "10 20 30 40 50 60 70 80 90", "40 10 90"],
              ["5 阶 借与合并", 5, "1 2 3 4 5 6 7 8 9 10 11 12 13", "4 3 13 8"]
            ].map(function (p) {
              return [p[0], function () { m = p[1]; mg.set(m); ks = p[2]; ds = p[3]; iK.value = ks; iD.value = ds; K.restart(); }];
            }));
            var o = ui(K);
            var P = player(function () {
              var a = LABU.dsParseKeys(ks, { name: "关键字", dupWhy: "B 树中关键字互不相同" }); if (a.err) return a;
              var b = LABU.dsParseKeys(ds, { min: 0, name: "删除的关键字", dupWhy: "同一个关键字只能删除一次" }); if (b.err) return b;
              return LABU.dsBtree(m, a.keys, b.keys);
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var r = S.r, f = S.f[S.cur], t = f.t, i;
              /* 布局：叶子从左到右排，双亲居中 */
              var levels = [], md = 0;
              (function w(n, d) { if (!n) return; md = Math.max(md, d); (levels[d] = levels[d] || []).push(n); n.ch.forEach(function (c) { w(c, d + 1); }); })(t, 0);
              var leaves = t ? levels[md] : [], gap = 14, cw = 30;
              var widthOf = function (n) { return Math.max(1, n.keys.length) * cw; };
              var tot = leaves.reduce(function (s, n) { return s + widthOf(n); }, 0) + gap * Math.max(0, leaves.length - 1);
              if (tot > 700) { cw = Math.max(22, Math.floor(cw * 700 / tot)); tot = leaves.reduce(function (s, n) { return s + widthOf(n); }, 0) + gap * Math.max(0, leaves.length - 1); }
              var pos = {}, x = (720 - tot) / 2, yg = 74;
              (function place(n, d) {
                if (!n.ch.length) { pos[n.id] = { x: x, y: 30 + d * yg, w: widthOf(n) }; x += widthOf(n) + gap; return; }
                n.ch.forEach(function (c) { place(c, d + 1); });
                var a0 = pos[n.ch[0].id], a1 = pos[n.ch[n.ch.length - 1].id], cx = (a0.x + a1.x + a1.w) / 2, w = widthOf(n);
                pos[n.id] = { x: cx - w / 2, y: 30 + d * yg, w: w };
              })(t || { ch: [], keys: [], id: -1 }, 0);
              var H = 30 + md * yg + 60;
              var svg = newSvg(K, 720, Math.max(H, 110), m + " 阶 B 树，关键字：" + LABU.dsBtreeKeys(t).join(" "));
              if (!t) T(svg, 360, 60, "空树", "x-d1-dim", "middle", 15);
              (function draw(n) {
                if (!n) return;
                var p = pos[n.id], hc = f.hl[n.id] || "";
                n.ch.forEach(function (c, k) { var q = pos[c.id]; L(svg, p.x + k * cw, p.y + 30, q.x + q.w / 2, q.y, "x-d1-bedge" + (hc && f.hl[c.id] ? " is-hl" : "")); draw(c); });
                R(svg, p.x - 2, p.y - 2, p.w + 4, 34, "x-d1-bnode" + (hc ? " " + hc : ""));
                for (var k = 0; k < n.keys.length; k++) {
                  if (k) L(svg, p.x + k * cw, p.y, p.x + k * cw, p.y + 30, "x-d1-bsep");
                  T(svg, p.x + k * cw + cw / 2, p.y + 20, String(n.keys[k]), "x-d1-mono" + (f.nk === n.keys[k] ? " x-d1-acc x-d1-b" : ""), "middle", String(n.keys[k]).length > 2 && cw < 30 ? 13 : 14);
                }
                if (n.keys.length > m - 1) T(svg, p.x + p.w + 6, p.y + 20, n.keys.length + " > " + (m - 1), "x-d1-bad", "start", 13);
              })(t);
              var ck = LABU.dsBtreeCheck(t, m), mn = Math.ceil(m / 2) - 1;
              o.st.innerHTML = stat("阶 m", m) + stat("非根结点关键字数", mn + "–" + (m - 1)) + stat("根", "1–" + (m - 1)) + stat("树高", t ? md + 1 : 0) + stat("关键字", LABU.dsBtreeKeys(t).length);
              o.say.textContent = f.d;
              var rows = [];
              levels.forEach(function (lv, d) { rows.push(["第 " + (d + 1) + " 层", lv.map(function (n) { return "[" + n.keys.join(" ") + "]"; }).join("  "), lv.map(function (n) { return n.keys.length; }).join(", ")]); });
              o.tb.innerHTML = rows.length ? tbl("各层结点（关键字数）", ["层", "结点", "关键字数"], rows, -1, "x-d1-wrap") : "";
              o.tip.textContent = "分裂位置取第 ⌈m/2⌉ 个关键字（m 为偶数时左边少一个，如 4 阶 [a b c d] 以 b 上移）。删除非终端结点的关键字时本实验用直接前驱替代；借关键字时先看左兄弟、再看右兄弟，都借不到时优先与左兄弟合并。" + (ck.ok ? "" : " 当前处于调整中间状态。");
              void i;
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 7：并查集 ======================= */
        LAB.push({
          id: "ufset", name: "并查集", color: "var(--x-ds)",
          note: "并查集用双亲表示法：parent[x] 是 x 的双亲，根结点的 parent 为负数（其绝对值是集合大小）。Find 沿 parent 走到根，Union 先 Find 两个根再把一个根挂到另一个下。普通合并可能退化成链，Find 最坏 O(n)；按秩（高度）或按大小合并后树高 ≤ ⌊log₂n⌋ + 1，Find 为 O(log n)；再加路径压缩，均摊接近 O(α(n))，几乎是常数。Kruskal 算法用并查集判断加边是否成环。",
          mount: function (panel, K) {
            var n = 8, opsTxt = "U 1 0, U 2 1, U 3 2, U 4 3, U 5 6, U 7 5, U 4 7, F 0, F 6, F 0", mode = "plain", comp = false, iN, iO;
            iN = field(K.opts, "元素个数 n", String(n), { inputmode: "numeric", "aria-label": "元素个数（2–15），编号 0 到 n−1" }, function (v) { n = parseInt(v, 10); K.restart(); }, true);
            var mg = btnGroup(K.opts, [["plain", "普通合并"], ["rank", "按秩（高度）合并"]], mode, function (v) { mode = v; K.restart(); }, "合并");
            var cg = btnGroup(K.opts, [[false, "不压缩"], [true, "路径压缩"]], comp, function (v) { comp = v; K.restart(); }, "查找");
            br(K);
            iO = field(K.opts, "操作", opsTxt, { "aria-label": "操作序列：U a b 合并，F x 查找" }, function (v) { opsTxt = v; K.restart(); });
            br(K);
            presets(K, [
              ["链式退化", 8, "U 1 0, U 2 1, U 3 2, U 4 3, U 5 6, U 7 5, U 4 7, F 0, F 6, F 0", "plain", false],
              ["按秩对比", 8, "U 1 0, U 2 1, U 3 2, U 4 3, U 5 6, U 7 5, U 4 7, F 0, F 6, F 0", "rank", false],
              ["路径压缩", 8, "U 1 0, U 2 1, U 3 2, U 4 3, U 5 6, U 7 5, U 4 7, F 0, F 6, F 0", "plain", true],
              ["Kruskal 判环", 6, "U 0 2, U 3 5, U 1 4, U 2 5, F 0, F 3, U 1 2, F 5, F 4", "rank", true]
            ].map(function (p) {
              return [p[0], function () { n = p[1]; iN.value = String(n); opsTxt = p[2]; iO.value = opsTxt; mode = p[3]; mg.set(mode); comp = p[4]; cg.set(comp); K.restart(); }];
            }));
            var o = ui(K), tv = treeView();
            var P = player(function () {
              if (!(n >= 2 && n <= 15)) return { err: "元素个数 n 应为 2–15 之间的整数" };
              var pr = LABU.dsUfParse(opsTxt, n); if (pr.err) return pr;
              var r = LABU.dsUfRun(n, pr.ops, mode, comp); if (r.err) return r;
              r.cmp = [["plain", false], ["plain", true], ["rank", false], ["rank", true]].map(function (c) { var x = LABU.dsUfRun(n, pr.ops, c[0], c[1]); return { mode: c[0], comp: c[1], h: x.height, v: x.visits }; });
              return r;
            }, render);
            function render(S) {
              if (S.err) { tv.svg = null; return showErr(K, o, S.err); }
              var r = S.r, f = S.f[S.cur], st = f.st, N = st.n, i;
              var kids = function (id) { var c = []; for (var k = 0; k < N; k++) if (st.p[k] === id) c.push(k); return c; };
              var roots = []; for (i = 0; i < N; i++) if (st.p[i] < 0) roots.push(i);
              var lay = layForest(roots, kids, N, 58), nodes = [], edges = [], arrTop = lay.H + 4;
              for (i = 0; i < N; i++) {
                var p = lay.pos[i];
                nodes.push({ id: i, x: p.x, y: p.y, t: String(i), cls: f.hl[i] || "" });
                if (st.p[i] >= 0) { var q = lay.pos[st.p[i]]; edges.push({ id: "e" + i, x1: p.x, y1: p.y, x2: q.x, y2: q.y, cls: f.hl[i] && f.hl[st.p[i]] ? "is-hl" : "" }); }
              }
              var rows = mode === "rank" ? 3 : 2, H = arrTop + rows * 30 + 20;
              tv.draw(K, 720, H, "并查集森林，parent 数组：" + st.p.join(" "), nodes, edges, function (g) {
                var cw = Math.min(44, Math.floor(600 / N)), x0 = (720 - cw * N) / 2 + 30;
                T(g, x0 - 8, arrTop + 20, "下标", "x-d1-dim", "end", 13);
                T(g, x0 - 8, arrTop + 50, "parent", "x-d1-b", "end", 13);
                if (mode === "rank") T(g, x0 - 8, arrTop + 80, "rank(高)", "x-d1-dim", "end", 13);
                for (var k = 0; k < N; k++) {
                  T(g, x0 + k * cw + cw / 2, arrTop + 20, String(k), "x-d1-dim", "middle", 13);
                  var ch = S.cur > 0 && S.f[S.cur - 1].st.p[k] !== st.p[k];
                  R(g, x0 + k * cw, arrTop + 30, cw, 28, "x-d1-box" + (ch ? " is-new" : f.hl[k] ? " is-hl" : ""));
                  T(g, x0 + k * cw + cw / 2, arrTop + 50, fnum(st.p[k]), "x-d1-mono", "middle", 14);
                  if (mode === "rank") T(g, x0 + k * cw + cw / 2, arrTop + 80, st.p[k] < 0 ? String(st.rk[k]) : "", "x-d1-mono x-d1-dim", "middle", 13);
                }
              });
              o.st.innerHTML = stat("集合数", roots.length) + stat("当前最高树", LABU.dsUfHeight(st) + " 层") + stat("上界 ⌊log₂n⌋+1", log2floor(N) + 1);
              o.say.textContent = f.d;
              var h = "";
              if (f.end) h = tbl("同一组操作在四种策略下的对比", ["合并方式", "路径压缩", "最终最高树（层）", "Find 共经过结点数"], r.cmp.map(function (c) {
                var on = c.mode === mode && c.comp === comp;
                return [(c.mode === "rank" ? "按秩（高度）" : "普通") + (on ? " ◀ 当前" : ""), c.comp ? "是" : "否", String(c.h), String(c.v)];
              }), -1);
              o.tb.innerHTML = h;
              o.tip.textContent = "约定：元素编号 0 到 n − 1；普通合并 Union(a, b) 让 b 的根指向 a 的根；按秩合并时 rank 记树高，高度相同则 b 的根挂到 a 的根下、高度加 1（做了路径压缩后 rank 只是高度的上界）。根结点 parent 存集合大小的相反数。";
            }
            P.api.reset();
            return P.api;
          }
        });
      })();
