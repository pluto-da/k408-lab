      /* 实验室外壳。 Add a demo with one call:
         LAB.push({ id, name, color, note, mount: function (panel, K) { ... return { step, reset, done }; } })
         K = { opts, stage, out, restart }. step() advances one frame and returns true while frames remain. */
      (function () {
        var LAB = window.LAB = window.LAB || [];
        function build() {
          var root = document.getElementById("x-lab");
          if (!root || root.dataset.built) return;
          root.dataset.built = "1";
          var tabs = root.querySelector(".x-lab__tabs"), items = [];
          /* 按科目分组：数据结构 / 组成原理 / 操作系统 / 计算机网络，组内保持注册顺序 */
          var SUBS = [["var(--x-ds)", "数据结构"], ["var(--x-co)", "组成原理"], ["var(--x-os)", "操作系统"], ["var(--x-cn)", "计算机网络"]];
          var subOf = function (d) { for (var k = 0; k < SUBS.length; k++) if (SUBS[k][0] === d.color) return k; return SUBS.length; };
          var reg = LAB.slice();
          LAB.sort(function (a, b) { return (subOf(a) - subOf(b)) || (reg.indexOf(a) - reg.indexOf(b)); });
          tabs.classList.add("x-lab__tabs--grp");
          var grps = {};
          LAB.forEach(function (d, i) {
            var tab = X.el("button", { type: "button", class: "x-lab__tab", role: "tab", id: "tab-" + d.id, "aria-controls": "lab-" + d.id, style: "--c:" + d.color });
            tab.textContent = d.name;
            var gk = subOf(d);
            if (!grps[gk]) {
              grps[gk] = X.el("div", { class: "x-lab__grp", role: "presentation" });
              var gl = X.el("span", { class: "x-lab__gl", style: "--c:" + (SUBS[gk] ? SUBS[gk][0] : "#888") });
              gl.textContent = SUBS[gk] ? SUBS[gk][1] : "其他";
              grps[gk].appendChild(gl);
              tabs.appendChild(grps[gk]);
            }
            grps[gk].appendChild(tab);
            var p = X.el("div", { class: "x-lab__panel", role: "tabpanel", id: "lab-" + d.id, "aria-labelledby": "tab-" + d.id, style: "--c:" + d.color },
              /* 布局：main（选项 + 画布）与 side（控制条、统计与步骤、考点）。宽屏左右两栏，窄屏 side 展开成画布下方的几行（见 legacy-15.css） */
              '<div class="x-lab__top"><div class="x-lab__main"><div class="x-lab__opts"></div><div class="x-lab__stage"></div></div>' +
              '<div class="x-lab__side"><div class="x-lab__ctrl"><button type="button" class="x-lab__btn" data-a="reset">重置</button>' +
              '<button type="button" class="x-lab__btn x-lab__btn--main" data-a="play" aria-pressed="false">播放</button>' +
              '<button type="button" class="x-lab__btn" data-a="step">下一步</button>' +
              '<label class="x-lab__speed">速度 <input type="range" min="1" max="10" value="5" aria-label="播放速度"></label></div>' +
              '<p class="x-lab__hint" role="status" hidden></p>' +
              '<div class="x-lab__out"></div>' +
              '<details class="x-lab__note" open><summary><b>考点</b></summary><p></p></details></div></div>');
            p.querySelector(".x-lab__note p").textContent = d.note || "";
            /* 手机竖屏：考点默认折叠，点开再看 */
            if (window.matchMedia && window.matchMedia("(max-width: 767px)").matches) p.querySelector(".x-lab__note").removeAttribute("open");
            root.appendChild(p);
            tab.addEventListener("click", function () { show(i, true); });
            items.push({ d: d, p: p, tab: tab });
          });
          tabs.addEventListener("keydown", function (e) {
            var k = items.findIndex(function (o) { return o.tab.getAttribute("aria-selected") === "true"; });
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              var dir = e.key === "ArrowRight" ? 1 : -1;
              for (var n = 0; n < items.length; n++) { k = (k + dir + items.length) % items.length; if (!items[k].tab.hidden) break; }
              show(k, true); items[k].tab.focus();
            }
          });
          function show(k, user) {
            items.forEach(function (o, i) {
              var on = i === k;
              o.tab.setAttribute("aria-selected", on ? "true" : "false");
              o.tab.tabIndex = on ? 0 : -1;
              o.p.hidden = !on;
              if (!on && o.stop) o.stop();
              if (on && !o.stop) init(o);
            });
            if (items[k] && typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("x:active", { detail: { kind: "lab", id: items[k].d.id, user: !!user } }));
          }
          function init(o) {
            var q = function (s) { return o.p.querySelector(s); };
            var play = q('[data-a="play"]'), speed = q(".x-lab__speed input"), timer = null, demo, n = 0;
            function stop() { clearTimeout(timer); timer = null; play.textContent = "播放"; play.setAttribute("aria-pressed", "false"); }
            function loop() { if (demo.step()) { n++; timer = setTimeout(loop, 1100 - speed.value * 100); } else { n++; stop(); } }
            o.stop = stop;
            var K = { opts: q(".x-lab__opts"), stage: q(".x-lab__stage"), out: q(".x-lab__out"), restart: function () { stop(); n = 0; demo.reset(); } };
            demo = o.d.mount(o.p, K);
            q('[data-a="step"]').addEventListener("click", function () { stop(); if (demo.done()) { n = 0; demo.reset(); } else { n++; demo.step(); } });
            /* 键盘上一步：从头重放到前一帧（实验只提供 step / reset） */
            o.back = function () { stop(); if (n <= 0) return; var k = n - 1; n = 0; demo.reset(); while (n < k && !demo.done()) { n++; demo.step(); } };
            o.atStart = function () { return n <= 0; };
            o.atEnd = function () { return demo.done(); };
            q('[data-a="reset"]').addEventListener("click", K.restart);
            play.addEventListener("click", function () {
              if (timer) return stop();
              if (demo.done()) { n = 0; demo.reset(); }
              play.textContent = "暂停"; play.setAttribute("aria-pressed", "true");
              timer = setTimeout(loop, 0);
            });
          }
          if (items.length) show(0);
          /* 供键盘快捷键调用（28-rwd.js）：a = "step" | "play" | "reset" | "back"
             第 0 步再按 ←、最后一步再按 → 都不改变画面，只给一句提示（最后一步不再自动重置） */
          window.X_LAB_ACT = function (a) {
            var o = items.filter(function (x) { return !x.p.hidden; })[0];
            if (!o) return false;
            var hintBox = o.p.querySelector(".x-lab__hint");
            if (a === "back") {
              if (o.atStart && o.atStart()) { X.hint(hintBox, "已经是第一步", o.p.querySelector('[data-a="reset"]')); return true; }
              if (o.back) o.back();
              return true;
            }
            if (a === "step" && o.atEnd && o.atEnd()) { X.hint(hintBox, "已到最后一步，按 R 或点“重置”重新开始", o.p.querySelector('[data-a="step"]')); return true; }
            var b = o.p.querySelector('[data-a="' + a + '"]');
            if (b) b.click();
            return !!b;
          };
        }
        /* 由 React 页面按顺序加载时，等所有演示注册完（legacy:ready）再搭建 */
        if (window.__LEGACY_LOADER__) window.addEventListener("legacy:ready", build);
        else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
        else setTimeout(build, 0);
      })();

      /* demo 1: sorting */
      LAB.push({
        id: "sort", name: "排序动画", color: "var(--x-ds)",
        note: "单步时盯住每一趟结束的那一刻，看谁已经归位：冒泡和堆每趟定一个最值，快排每趟定一个枢轴，插入只保证前缀有序。",
        mount: function (panel, K) {
          var N = 16;
          var ALG = [
            { id: "bubble", name: "冒泡", stable: true, mv: "交换", gen: bubble },
            { id: "insert", name: "直接插入", stable: true, mv: "移动", gen: insert },
            { id: "quick", name: "快速", stable: false, mv: "移动", gen: quick },
            { id: "heap", name: "堆", stable: false, mv: "交换", gen: heap },
            { id: "merge", name: "归并", stable: true, mv: "移动", gen: merge }
          ];
          var alg = ALG[0], base, a, ops, pos, nc, nm, np, last, hl;

          function bubble(b, O) {
            for (var i = 0; i < N - 1; i++) {
              var sw = false;
              for (var j = N - 1; j > i; j--) { O.c(j - 1, j); if (b[j - 1] > b[j]) { O.s(j - 1, j); sw = true; } }
              O.p(); if (!sw) break;
            }
          }
          function insert(b, O) {
            for (var i = 1; i < N; i++) {
              var t = b[i], j = i - 1;
              while (j >= 0) { O.c(j, j + 1); if (b[j] > t) { O.w(j + 1, b[j]); j--; } else break; }
              if (j + 1 !== i) O.w(j + 1, t);
              O.p();
            }
          }
          function quick(b, O) {
            (function qs(lo, hi) {
              if (lo >= hi) return;
              var low = lo, high = hi, piv = b[low];
              while (low < high) {
                while (low < high) { O.c(high, low); if (b[high] >= piv) high--; else break; }
                if (low !== high) O.w(low, b[high]);
                while (low < high) { O.c(low, high); if (b[low] <= piv) low++; else break; }
                if (low !== high) O.w(high, b[low]);
              }
              O.w(low, piv); O.p();
              qs(lo, low - 1); qs(low + 1, hi);
            })(0, N - 1);
          }
          function heap(b, O) {
            function sift(i, n) {
              for (;;) {
                var l = 2 * i + 1, big = l;
                if (l >= n) return;
                if (l + 1 < n) { O.c(l, l + 1); if (b[l + 1] > b[l]) big = l + 1; }
                O.c(i, big);
                if (b[big] > b[i]) { O.s(i, big); i = big; } else return;
              }
            }
            for (var i = (N >> 1) - 1; i >= 0; i--) sift(i, N);
            O.p("建堆");
            for (var e = N - 1; e > 0; e--) { O.s(0, e); sift(0, e); O.p(); }
          }
          function merge(b, O) {
            for (var w = 1; w < N; w *= 2) {
              for (var lo = 0; lo < N - w; lo += 2 * w) {
                var mid = lo + w - 1, hi = Math.min(lo + 2 * w - 1, N - 1), aux = b.slice(lo, hi + 1), i = lo, j = mid + 1, k = lo;
                while (i <= mid && j <= hi) { O.c(i, j); O.w(k++, aux[i - lo] <= aux[j - lo] ? aux[i++ - lo] : aux[j++ - lo]); }
                while (i <= mid) O.w(k++, aux[i++ - lo]);
                while (j <= hi) O.w(k++, aux[j++ - lo]);
              }
              O.p();
            }
          }

          function compile() {
            var b = base.slice(), list = [];
            alg.gen(b, {
              c: function (i, j) { list.push(["c", i, j]); },
              s: function (i, j) { var t = b[i]; b[i] = b[j]; b[j] = t; list.push(["s", i, j]); },
              w: function (i, v) { b[i] = v; list.push(["w", i, v]); },
              p: function (lab) { list.push(["p", lab]); }
            });
            return list;
          }
          function shuffle() {
            var pool = []; for (var v = 5; v <= 99; v++) pool.push(v);
            for (var i = pool.length - 1; i > 0; i--) { var r = Math.floor(Math.random() * (i + 1)), t = pool[i]; pool[i] = pool[r]; pool[r] = t; }
            base = pool.slice(0, N);
          }

          /* controls */
          var btns = ALG.map(function (g) {
            var b = X.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": g === alg ? "true" : "false" }, g.name);
            b.addEventListener("click", function () { alg = g; btns.forEach(function (x, i) { x.setAttribute("aria-pressed", ALG[i] === g ? "true" : "false"); }); K.restart(); });
            K.opts.appendChild(b); return b;
          });
          var rnd = X.el("button", { type: "button", class: "x-lab__btn x-lab__btn--ghost" }, "新随机数组");
          rnd.addEventListener("click", function () { shuffle(); K.restart(); });
          K.opts.appendChild(rnd);

          var svg = X.svg("svg", { viewBox: "0 0 640 214", role: "img", "aria-label": "16 根柱子表示待排序数组，高度即数值" }, K.stage);
          var bars = [];
          for (var i = 0; i < N; i++) bars.push(X.svg("rect", { class: "x-lab-bar", x: i * 40 + 5, width: 30 }, svg));
          K.out.innerHTML = '<div class="x-lab__stats"><span>比较次数 <b data-k="c">0</b></span><span><i data-k="mvl">交换</i>次数 <b data-k="m">0</b></span><span>趟 <b data-k="p">0</b></span><span class="x-lab__badge" data-k="st"></span></div>' +
            '<p class="x-lab__seq">当前 <span data-k="cur"></span></p><p class="x-lab__seq" data-k="lastl">第 0 趟后 <span data-k="last">—</span></p>';
          var out = {}; K.out.querySelectorAll("[data-k]").forEach(function (n) { out[n.dataset.k] = n; });

          function render() {
            var done = pos >= ops.length;
            for (var i = 0; i < N; i++) {
              var h = a[i] * 1.9;
              bars[i].setAttribute("y", 206 - h); bars[i].setAttribute("height", h);
              bars[i].setAttribute("class", "x-lab-bar" + (done ? " is-done" : (hl.c.indexOf(i) > -1 ? " is-c" : "") + (hl.w.indexOf(i) > -1 ? " is-w" : "")));
            }
            out.c.textContent = nc; out.m.textContent = nm; out.p.textContent = np; out.mvl.textContent = alg.mv;
            out.st.textContent = alg.stable ? "稳定" : "不稳定";
            out.st.className = "x-lab__badge" + (alg.stable ? "" : " is-bad");
            out.cur.textContent = a.join(" ");
            out.lastl.firstChild.textContent = (last ? last.label : "第 0 趟后") + " ";
            out.last.textContent = last ? last.seq : "—";
          }
          function apply(op) {
            if (op[0] === "c") { nc++; hl.c = [op[1], op[2]]; }
            else if (op[0] === "s") { var t = a[op[1]]; a[op[1]] = a[op[2]]; a[op[2]] = t; nm++; hl.w = [op[1], op[2]]; }
            else if (op[0] === "w") { a[op[1]] = op[2]; nm++; hl.w = [op[1]]; }
            else { if (op[1]) last = { label: op[1] + "后", seq: a.join(" ") }; else { np++; last = { label: "第 " + np + " 趟后", seq: a.join(" ") }; } }
          }
          function reset() { ops = compile(); a = base.slice(); pos = nc = nm = np = 0; last = null; hl = { c: [], w: [] }; render(); }
          function step() {
            if (pos >= ops.length) return false;
            hl = { c: [], w: [] };
            var op = ops[pos++]; apply(op);
            if (op[0] === "w" || op[0] === "s") { var prev = ops[pos - 2]; if (prev && prev[0] === "c") hl.c = [prev[1], prev[2]]; }
            while (pos < ops.length && ops[pos][0] === "p") apply(ops[pos++]);
            render();
            return pos < ops.length;
          }
          shuffle(); reset();
          return { step: step, reset: reset, done: function () { return pos >= ops.length; } };
        }
      });

      /* demo 2: binary tree traversal */
      LAB.push({
        id: "tree", name: "二叉树遍历", color: "var(--x-ds)",
        note: "由遍历序列构造二叉树，必须含中序：先序+中序、后序+中序、层序+中序都能唯一确定，先序+后序不行。先序首个/后序末个是根，再到中序里切左右子树。",
        mount: function (panel, K) {
          var P = { A: [240, 36], B: [130, 104], C: [350, 104], D: [70, 172], E: [190, 172], F: [410, 172], G: [150, 236] };
          var T = { A: ["B", "C"], B: ["D", "E"], C: [null, "F"], D: [null, null], E: ["G", null], F: [null, null], G: [null, null] };
          function walk(n, kind, r) {
            if (!n) return r;
            if (kind === "pre") r.push(n);
            walk(T[n][0], kind, r);
            if (kind === "in") r.push(n);
            walk(T[n][1], kind, r);
            if (kind === "post") r.push(n);
            return r;
          }
          function level() { var q = ["A"], r = []; while (q.length) { var n = q.shift(); r.push(n); T[n].forEach(function (c) { if (c) q.push(c); }); } return r; }
          var KINDS = [
            { name: "先序", note: "根 → 左 → 右", seq: walk("A", "pre", []) },
            { name: "中序", note: "左 → 根 → 右", seq: walk("A", "in", []) },
            { name: "后序", note: "左 → 右 → 根", seq: walk("A", "post", []) },
            { name: "层序", note: "逐层，自左向右（队列）", seq: level() }
          ];
          var kind = KINDS[0], pos = 0;
          var btns = KINDS.map(function (k) {
            var b = X.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": k === kind ? "true" : "false" }, k.name);
            b.addEventListener("click", function () { kind = k; btns.forEach(function (x, i) { x.setAttribute("aria-pressed", KINDS[i] === k ? "true" : "false"); }); K.restart(); });
            K.opts.appendChild(b); return b;
          });
          var svg = X.svg("svg", { viewBox: "0 0 480 266", role: "img", "aria-label": "二叉树：A 的左孩子 B、右孩子 C；B 的左孩子 D、右孩子 E；E 的左孩子 G；C 的右孩子 F" }, K.stage);
          Object.keys(T).forEach(function (n) {
            T[n].forEach(function (c) { if (c) X.svg("line", { class: "x-lab-edge", x1: P[n][0], y1: P[n][1], x2: P[c][0], y2: P[c][1] }, svg); });
          });
          var G = {}, O = {};
          Object.keys(P).forEach(function (n) {
            var g = X.svg("g", { class: "x-lab-node" }, svg);
            X.svg("circle", { cx: P[n][0], cy: P[n][1], r: 21 }, g);
            X.svg("text", { x: P[n][0], y: P[n][1] }, g).textContent = n;
            O[n] = X.svg("text", { class: "x-lab-ord", x: P[n][0] + 30, y: P[n][1] - 16 }, svg);
            G[n] = g;
          });
          K.out.innerHTML = '<div class="x-lab__stats"><span data-k="rule"></span><span>已访问 <b data-k="n">0</b> / 7</span></div><p class="x-lab__seq">输出</p><p class="x-lab__big" data-k="seq"></p>';
          var out = {}; K.out.querySelectorAll("[data-k]").forEach(function (n) { out[n.dataset.k] = n; });
          function render() {
            var seen = kind.seq.slice(0, pos);
            Object.keys(G).forEach(function (n) {
              var i = seen.indexOf(n);
              G[n].setAttribute("class", "x-lab-node" + (i < 0 ? "" : i === pos - 1 ? " is-cur" : " is-done"));
              O[n].textContent = i < 0 ? "" : String(i + 1);
            });
            out.rule.textContent = kind.name + "：" + kind.note;
            out.n.textContent = pos;
            out.seq.textContent = seen.join(" ") || "—";
          }
          function reset() { pos = 0; render(); }
          function step() { if (pos < 7) { pos++; render(); } return pos < 7; }
          reset();
          return { step: step, reset: reset, done: function () { return pos >= 7; } };
        }
      });

      /* demo 3: Dijkstra */
      var LAB_DJ = {
        id: "dijkstra", name: "Dijkstra 最短路径", color: "var(--x-ds)", toc: "Dijkstra 最短路",
        note: "Dijkstra 不能处理负权边；OSPF 用的就是它",
        graph: {
          P: [[60, 160], [210, 70], [210, 250], [380, 70], [380, 250], [530, 160]],
          E: [[0, 1, 10], [0, 2, 3], [2, 1, 4], [1, 3, 2], [2, 3, 8], [2, 4, 2], [4, 3, 5], [3, 5, 1], [4, 5, 7]]
        },
        calc: function (n, E, s) {
          var INF = Infinity, dist = [], prev = [], pe = [], done = [], frames = [], i;
          for (i = 0; i < n; i++) { dist.push(INF); prev.push(-1); pe.push(-1); done.push(false); }
          dist[s] = 0;
          function snap(u, eds, tree) { frames.push({ u: u, eds: eds, tree: !!tree, dist: dist.slice(), prev: prev.slice(), pe: pe.slice(), done: done.slice() }); }
          snap(-1, []);
          for (;;) {
            var u = -1;
            for (i = 0; i < n; i++) if (!done[i] && dist[i] < INF && (u < 0 || dist[i] < dist[u])) u = i;
            if (u < 0) break;
            done[u] = true;
            var eds = [];
            E.forEach(function (e, k) {
              if (e[0] !== u) return;
              var ok = !done[e[1]] && dist[u] + e[2] < dist[e[1]];
              if (ok) { dist[e[1]] = dist[u] + e[2]; prev[e[1]] = u; pe[e[1]] = k; }
              eds.push({ k: k, ok: ok });
            });
            snap(u, eds);
          }
          snap(-1, [], true);
          return { dist: dist, prev: prev, frames: frames };
        },
        mount: function (panel, K) {
          var G = LAB_DJ.graph, n = G.P.length, src = 0, fr, pos;
          K.opts.appendChild(X.el("span", { class: "x-lab__lbl" }, "源点"));
          var srcBtns = G.P.map(function (_, i) {
            var b = X.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": i === src ? "true" : "false" }, "V" + i);
            b.addEventListener("click", function () { src = i; srcBtns.forEach(function (x, j) { x.setAttribute("aria-pressed", j === i ? "true" : "false"); }); K.restart(); });
            K.opts.appendChild(b); return b;
          });
          var svg = X.svg("svg", { viewBox: "0 0 590 316", role: "img", "aria-label": "有向带权图，边：" + G.E.map(function (e) { return "V" + e[0] + "→V" + e[1] + " 权 " + e[2]; }).join("，") }, K.stage);
          var defs = X.svg("defs", {}, svg);
          ["n", "c", "t"].forEach(function (m) {
            var mk = X.svg("marker", { id: "x-dj-mk-" + m, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 11, markerHeight: 11, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
            X.svg("path", { d: "M0,0 L10,5 L0,10 z", class: "x-lab-mk--" + m }, mk);
          });
          var arcs = G.E.map(function (e) {
            var p = G.P[e[0]], q = G.P[e[1]], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy), ux = dx / L, uy = dy / L;
            return X.svg("line", { class: "x-lab-arc", x1: p[0] + ux * 22, y1: p[1] + uy * 22, x2: q[0] - ux * 23, y2: q[1] - uy * 23, "marker-end": "url(#x-dj-mk-n)" }, svg);
          });
          G.E.forEach(function (e) {
            var p = G.P[e[0]], q = G.P[e[1]], cx = (p[0] + q[0]) / 2, cy = (p[1] + q[1]) / 2;
            var g = X.svg("g", { class: "x-lab-w" }, svg);
            X.svg("rect", { x: cx - 13, y: cy - 10, width: 26, height: 20, rx: 2 }, g);
            X.svg("text", { x: cx, y: cy }, g).textContent = e[2];
          });
          var nodes = [], dl = [];
          G.P.forEach(function (p, i) {
            var g = X.svg("g", { class: "x-lab-node" }, svg);
            X.svg("circle", { cx: p[0], cy: p[1], r: 21 }, g);
            X.svg("text", { x: p[0], y: p[1] }, g).textContent = "V" + i;
            nodes.push(g);
            dl.push(X.svg("text", { class: "x-lab-dist", x: p[0], y: p[1] > 200 ? p[1] + 36 : p[1] - 34 }, svg));
          });
          K.out.innerHTML = '<p class="x-lab__seq" data-k="msg"></p><div data-k="tbl"></div>';
          var out = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { out[x.dataset.k] = x; });
          function d2s(v) { return v === Infinity ? "∞" : String(v); }
          function render() {
            var f = fr[pos], before = pos > 0 ? fr[pos - 1] : f, upd = {};
            f.eds.forEach(function (r) { if (r.ok) upd[G.E[r.k][1]] = 1; });
            arcs.forEach(function (ln, k) {
              var cls = "x-lab-arc", mk = "n", r = f.eds.filter(function (x) { return x.k === k; })[0];
              if (f.tree) { if (f.pe.indexOf(k) > -1) { cls += " is-tree"; mk = "c"; } else cls += " is-off"; }
              else if (r) { cls += r.ok ? " is-relax" : " is-try"; mk = r.ok ? "c" : "t"; }
              ln.setAttribute("class", cls); ln.setAttribute("marker-end", "url(#x-dj-mk-" + mk + ")");
            });
            nodes.forEach(function (g, i) {
              g.setAttribute("class", "x-lab-node" + (i === f.u ? " is-cur" : f.done[i] ? " is-done" : ""));
              dl[i].textContent = "d=" + d2s(f.dist[i]);
              dl[i].setAttribute("class", "x-lab-dist" + (upd[i] ? " is-upd" : ""));
            });
            var msg;
            if (f.tree) {
              var miss = f.dist.map(function (d, i) { return d === Infinity ? "V" + i : null; }).filter(Boolean);
              msg = "完成：加粗边即以 V" + src + " 为根的最短路径树。" + (miss.length ? miss.join("、") + " 不可达。" : "");
            } else if (f.u < 0) msg = "初始化：dist[V" + src + "] = 0，其余为 ∞。";
            else {
              msg = "第 " + pos + " 轮：选未确定顶点中 dist 最小的 V" + f.u + "（" + f.dist[f.u] + "），确定它，松弛出边 → " +
                (f.eds.length ? f.eds.map(function (r) {
                  var e = G.E[r.k], v = e[1], s = "V" + f.u + "→V" + v + "：";
                  if (before.done[v]) return s + "V" + v + " 已确定";
                  var nd = f.dist[f.u] + e[2];
                  return s + f.dist[f.u] + "+" + e[2] + "=" + nd + (r.ok ? " < " + d2s(before.dist[v]) + "，更新" : " ≥ " + d2s(before.dist[v]) + "，不变");
                }).join("；") : "无出边");
            }
            out.msg.textContent = msg;
            var h = '<div class="x-tbl"><table><thead><tr><th scope="col">顶点</th><th scope="col">dist</th><th scope="col">path</th><th scope="col">已确定</th></tr></thead><tbody>';
            for (var i = 0; i < n; i++) {
              var p = [], v = i;
              if (f.dist[i] !== Infinity) while (v !== -1) { p.unshift("V" + v); v = f.prev[v]; }
              h += '<tr' + (i === f.u ? ' class="is-cur"' : "") + '><th scope="row">V' + i + "</th><td" + (upd[i] ? ' class="is-ok"' : "") + ">" + d2s(f.dist[i]) +
                "</td><td>" + (p.length ? p.join("→") : "—") + "</td><td" + (f.done[i] ? ' class="is-ok">✓' : ">—") + "</td></tr>";
            }
            out.tbl.innerHTML = h + "</tbody></table></div>";
          }
          function reset() { fr = LAB_DJ.calc(n, G.E, src).frames; pos = 0; render(); }
          function step() { if (pos < fr.length - 1) { pos++; render(); } return pos < fr.length - 1; }
          reset();
          return { step: step, reset: reset, done: function () { return pos >= fr.length - 1; } };
        }
      };
      LAB.push(LAB_DJ);

      /* demo 4: Cache address mapping */
      var LAB_CA = {
        id: "cache", name: "Cache 地址映射", color: "var(--x-co)",
        note: "地址划分 + 命中率计算是组成原理大题常客",
        /* ways 0 = fully associative */
        split: function (bits, C, B, ways) {
          var lines = C / B, w = ways === 0 ? lines : Math.min(ways, lines), sets = lines / w;
          var off = Math.round(Math.log2(B)), idx = Math.round(Math.log2(sets));
          return { lines: lines, ways: w, sets: sets, off: off, idx: idx, tag: bits - idx - off };
        },
        run: function (addrs, s, B) {
          var store = {}, t = 0, hits = 0, log = [];
          addrs.forEach(function (a) {
            var blk = Math.floor(a / B), set = blk % s.sets, tag = Math.floor(blk / s.sets), slots = store[set] || (store[set] = []);
            var way = -1, ev = null, hit = false, i;
            for (i = 0; i < slots.length; i++) if (slots[i].tag === tag) { way = i; hit = true; }
            if (hit) hits++;
            else if (slots.length < s.ways) { way = slots.length; slots.push({ tag: tag }); }
            else { way = 0; for (i = 1; i < slots.length; i++) if (slots[i].t < slots[way].t) way = i; ev = slots[way].tag; slots[way] = { tag: tag }; }
            slots[way].t = ++t;
            var snap = {}; for (var k in store) snap[k] = store[k].map(function (x) { return x.tag; });
            log.push({ a: a, set: set, tag: tag, off: a % B, hit: hit, way: way, ev: ev, snap: snap });
          });
          return { log: log, hits: hits };
        },
        mount: function (panel, K) {
          var cfg = { bits: 32, C: 16384, B: 64, ways: 1 };
          var MAPS = [["直接", 1], ["2路组相联", 2], ["4路组相联", 4], ["8路组相联", 8], ["全相联", 0]];
          var s, log, hits, sets, cols, err, pos;
          function sel(label, list, key, fmt) {
            var l = X.el("label", { class: "x-lab__lbl" }, label + " "), el = X.el("select", { class: "x-lab__sel" });
            list.forEach(function (v) { var o = X.el("option", { value: v }, fmt(v)); if (v === cfg[key]) o.selected = true; el.appendChild(o); });
            el.addEventListener("change", function () { cfg[key] = +el.value; K.restart(); });
            l.appendChild(el); K.opts.appendChild(l);
          }
          sel("主存地址", [16, 20, 24, 32], "bits", function (v) { return v + " 位"; });
          sel("Cache 容量", [1024, 2048, 4096, 8192, 16384, 32768, 65536], "C", function (v) { return v / 1024 + "KB"; });
          sel("块大小", [16, 32, 64, 128], "B", function (v) { return v + "B"; });
          K.opts.appendChild(X.el("span", { class: "x-lab__br" }));
          var mb = MAPS.map(function (m) {
            var b = X.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": m[1] === cfg.ways ? "true" : "false" }, m[0]);
            b.addEventListener("click", function () { cfg.ways = m[1]; mb.forEach(function (x, i) { x.setAttribute("aria-pressed", MAPS[i] === m ? "true" : "false"); }); K.restart(); });
            K.opts.appendChild(b); return b;
          });
          K.opts.appendChild(X.el("span", { class: "x-lab__br" }));
          var inp = X.el("input", { type: "text", class: "x-lab__in", "aria-label": "访问地址序列，十六进制，逗号分隔", spellcheck: "false", value: "0x0000,0x0040,0x4000,0x0000,0x8000,0x0040,0x4000" });
          var load = X.el("button", { type: "button", class: "x-lab__btn" }, "载入序列");
          load.addEventListener("click", K.restart);
          inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); K.restart(); } });
          K.opts.appendChild(inp); K.opts.appendChild(load);
          var svg = X.svg("svg", { viewBox: "0 0 640 112", role: "img", "aria-label": "主存地址划分" }, K.stage);
          K.out.innerHTML = '<div class="x-lab__stats" data-k="fmt"></div><p class="x-lab__seq x-lab__err" data-k="err"></p>' +
            '<div class="x-lab__stats" data-k="run" style="margin-top:8px"></div><div data-k="grid"></div><div data-k="log"></div>';
          var out = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { out[x.dataset.k] = x; });
          function hx(v, w) { return "0x" + v.toString(16).toUpperCase().padStart(w || 1, "0"); }
          function ixName() { return s.ways === 1 ? "行号" : "组号"; }
          function drawBar(cur) {
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            var x0 = 20, W = 600, cw = W / cfg.bits, y = 44, h = 34, x = x0;
            var segs = [["Tag", s.tag, "tag"], [ixName(), s.idx, "idx"], ["块内地址", s.off, "off"]].filter(function (g) { return g[1] > 0; });
            segs.forEach(function (g) {
              var w = g[1] * cw;
              X.svg("rect", { class: "x-lab-seg x-lab-seg--" + g[2], x: x, y: y, width: w, height: h }, svg);
              X.dim(svg, x + 1, x + w - 1, 22, g[1] + " 位");
              X.svg("text", { class: "x-lab-segt", x: x + w / 2, y: 100 }, svg).textContent = g[0];
              x += w;
            });
            var bin = cur ? cur.a.toString(2).padStart(cfg.bits, "0") : "";
            for (var i = 0; i < cfg.bits; i++) {
              if (i) X.svg("line", { class: "x-lab-tick", x1: x0 + i * cw, y1: y + 4, x2: x0 + i * cw, y2: y + h - 4 }, svg);
              if (bin) X.svg("text", { class: "x-lab-bit", x: x0 + (i + .5) * cw, y: y + h / 2 }, svg).textContent = bin[i];
            }
            svg.setAttribute("aria-label", "主存地址 " + cfg.bits + " 位 = " + segs.map(function (g) { return g[0] + " " + g[1] + " 位"; }).join(" + "));
          }
          function render() {
            var cur = pos > 0 ? log[pos - 1] : null;
            drawBar(cur);
            out.fmt.innerHTML = "<span>Tag <b>" + s.tag + "</b></span>" + (s.idx > 0 ? "<span>" + ixName() + " <b>" + s.idx + "</b></span>" : "") +
              "<span>块内 <b>" + s.off + "</b></span><span>共 " + s.lines + " 行" + (s.ways === 1 ? "" : " · " + s.sets + " 组 × " + s.ways + " 路") + "</span>";
            out.err.textContent = err; out.err.hidden = !err;
            var rate = pos ? (hits(pos) + "/" + pos + " = " + (hits(pos) / pos * 100).toFixed(1) + "%") : "—";
            out.run.innerHTML = "<span>访问 <b>" + pos + "</b> / " + log.length + "</span><span>命中 <b>" + hits(pos) + "</b></span>" +
              "<span>" + (pos === log.length && pos ? "最终命中率" : "命中率") + " <b>" + rate + "</b></span>" +
              (cur ? '<span class="x-lab__badge' + (cur.hit ? "" : " is-bad") + '">' + hx(cur.a, 4) + " " + (cur.hit ? "命中" : "缺失") + "</span>" : "");
            var g = '<div class="x-tbl"><table><caption>Cache 状态（LRU，只显示访问到的' + (s.ways === 1 ? "行" : "组") +
              (s.ways > cols ? "；该组共 " + s.ways + " 行，只显示用到的 " + cols + " 行" : "") + '）</caption><thead><tr><th scope="col">' + ixName() + "</th>";
            for (var c = 0; c < cols; c++) g += '<th scope="col">' + (s.ways === 1 ? "Tag" : "路 " + c) + "</th>";
            g += "</tr></thead><tbody>";
            sets.forEach(function (st) {
              var tags = cur ? cur.snap[st] || [] : [];
              g += "<tr" + (cur && cur.set === st ? ' class="is-cur"' : "") + '><th scope="row">' + st + "</th>";
              for (var c = 0; c < cols; c++) {
                var on = cur && cur.set === st && cur.way === c;
                g += "<td" + (on ? ' class="' + (cur.hit ? "is-ok" : "is-bad") + '"' : "") + ">" + (c < tags.length ? hx(tags[c]) : "—") +
                  (on ? (cur.hit ? " 命中" : cur.ev !== null ? " 替换 " + hx(cur.ev) : " 调入") : "") + "</td>";
              }
              g += "</tr>";
            });
            out.grid.innerHTML = log.length ? g + "</tbody></table></div>" : "";
            var l = '<div class="x-tbl"><table><thead><tr><th scope="col">#</th><th scope="col">地址</th><th scope="col">Tag</th><th scope="col">' + ixName() +
              '</th><th scope="col">块内</th><th scope="col">结果</th></tr></thead><tbody>';
            log.forEach(function (r, i) {
              var seen = i < pos;
              l += "<tr" + (i === pos - 1 ? ' class="is-cur"' : "") + '><th scope="row">' + (i + 1) + "</th><td>" + hx(r.a, 4) + "</td><td>" + (seen ? hx(r.tag) : "") +
                "</td><td>" + (seen ? (s.idx > 0 ? r.set : "—") : "") + "</td><td>" + (seen ? r.off : "") + "</td><td" + (seen ? ' class="' + (r.hit ? "is-ok" : "is-bad") + '">' + (r.hit ? "命中" : "缺失") : ">") + "</td></tr>";
            });
            out.log.innerHTML = log.length ? l + "</tbody></table></div>" : "";
          }
          function reset() {
            s = LAB_CA.split(cfg.bits, cfg.C, cfg.B, cfg.ways);
            var bad = [], addrs = [];
            inp.value.split(/[,，\s]+/).filter(Boolean).forEach(function (t) {
              if (!/^(0x)?[0-9a-f]+$/i.test(t)) return bad.push(t);
              var v = parseInt(t.replace(/^0x/i, ""), 16);
              if (v >= Math.pow(2, cfg.bits)) bad.push(t); else addrs.push(v);
            });
            err = bad.length ? "已跳过无效或超出 " + cfg.bits + " 位的地址：" + bad.join(", ") : "";
            var r = LAB_CA.run(addrs, s, cfg.B);
            log = r.log;
            hits = function (k) { return log.slice(0, k).filter(function (x) { return x.hit; }).length; };
            sets = log.map(function (x) { return x.set; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
            if (s.ways <= 8) cols = s.ways;
            else { cols = 1; sets.forEach(function (st) { var u = {}; log.forEach(function (x) { if (x.set === st) u[x.tag] = 1; }); cols = Math.max(cols, Math.min(s.ways, Object.keys(u).length)); }); }
            pos = 0; render();
          }
          function step() { if (pos < log.length) { pos++; render(); } return pos < log.length; }
          reset();
          return { step: step, reset: reset, done: function () { return pos >= log.length; } };
        }
      };
      LAB.push(LAB_CA);

      /* demo 5: instruction pipeline */
      var LAB_PL = {
        id: "pipeline", name: "指令流水线", color: "var(--x-co)",
        note: "三种冒险：数据、结构、控制；转发解决大部分数据冒险，load-use 仍需阻塞一拍",
        STAGES: ["IF", "ID", "EX", "MEM", "WB"],
        DEF: "add r1,r2,r3; sub r4,r1,r5; and r6,r1,r7; or r8,r2,r9; lw r10,0(r1)",
        parse: function (txt) {
          var ins = [], bad = [];
          txt.split(/[;；\n]+/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (s) {
            var m = /^([a-z]+)\s+(.+)$/i.exec(s), regs = m ? (m[2].match(/r\d+/gi) || []).map(function (r) { return r.toLowerCase(); }) : [];
            if (!m || !regs.length) return bad.push(s);
            var op = m[1].toLowerCase(), d = null, src;
            if (op === "sw" || op === "beq" || op === "bne") src = regs.slice(0, 2);
            else { d = regs[0]; src = regs.slice(1); }
            ins.push({ text: s.replace(/\s*,\s*/g, ","), op: op, dst: d === "r0" ? null : d, src: src.filter(function (r) { return r !== "r0"; }), load: op === "lw" });
          });
          return { ins: ins.slice(0, 10), bad: bad, cut: ins.length > 10 };
        },
        /* no forwarding: write WB first half, read ID second half, so ID(i) >= WB(p).
           forwarding: ALU EX->EX needs nothing; load needs ID(i) >= MEM(p) (one stall) */
        plan: function (ins, fwd) {
          var t = [], deps = [];
          ins.forEach(function (x, i) {
            var IF = i ? t[i - 1].ID : 1, need = IF + 1;
            x.src.forEach(function (r) {
              for (var j = i - 1; j >= 0; j--) if (ins[j].dst === r) break;
              if (j < 0) return;
              var p = t[j], at = !fwd ? p.WB : ins[j].load ? p.MEM : p.EX;
              deps.push({ from: j, to: i, reg: r, at: at, kind: !fwd ? "wb" : ins[j].load ? "mem" : "ex" });
              need = Math.max(need, at);
            });
            t.push({ IF: IF, ID: need, EX: need + 1, MEM: need + 2, WB: need + 3, stall: need - IF - 1 });
          });
          deps = deps.filter(function (d, k) { return deps.findIndex(function (e) { return e.from === d.from && e.to === d.to && e.reg === d.reg; }) === k; });
          return { t: t, deps: deps, total: t.length ? t[t.length - 1].WB : 0, ideal: t.length ? t.length + 4 : 0 };
        },
        mount: function (panel, K) {
          var S = LAB_PL.STAGES, fwd = false, P, ins, cur, err;
          var modes = [["无转发", false], ["有转发", true]].map(function (m) {
            var b = X.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": m[1] === fwd ? "true" : "false" }, m[0]);
            b.addEventListener("click", function () { fwd = m[1]; modes.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); K.restart(); });
            K.opts.appendChild(b); return b;
          });
          K.opts.appendChild(X.el("span", { class: "x-lab__br" }));
          var inp = X.el("input", { type: "text", class: "x-lab__in", "aria-label": "指令序列，分号分隔", spellcheck: "false", value: LAB_PL.DEF });
          var load = X.el("button", { type: "button", class: "x-lab__btn" }, "载入指令");
          load.addEventListener("click", K.restart);
          inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); K.restart(); } });
          K.opts.appendChild(inp); K.opts.appendChild(load);
          var svg = X.svg("svg", { role: "img" }, K.stage);
          K.out.innerHTML = '<div class="x-lab__stats" data-k="st"></div><p class="x-lab__seq x-lab__err" data-k="err"></p><p class="x-lab__seq" data-k="msg"></p><div data-k="deps"></div>';
          var out = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { out[x.dataset.k] = x; });
          var LW = 170, CW = 44, RH = 38, TOP = 30;
          function cellAt(i, c) {
            var t = P.t[i];
            for (var s = 0; s < 5; s++) if (t[S[s]] === c) return S[s];
            return c > t.IF && c < t.ID ? "bub" : null;
          }
          function draw() {
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            var n = ins.length, cols = Math.max(P.total, 9), W = LW + cols * CW + 8, H = TOP + n * RH + 6;
            svg.setAttribute("viewBox", "0 0 " + W + " " + H);
            var defs = X.svg("defs", {}, svg);
            var pt = X.svg("pattern", { id: "x-pl-hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
            X.svg("rect", { width: 6, height: 6, fill: "var(--x-paper)" }, pt);
            X.svg("line", { class: "x-pl-hl", x1: 0, y1: 0, x2: 0, y2: 6 }, pt);
            var mk = X.svg("marker", { id: "x-pl-mk", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
            X.svg("path", { d: "M0,0 L10,5 L0,10 z", class: "x-pl-mk" }, mk);
            if (cur > 0) X.svg("rect", { class: "x-pl-col", x: LW + (cur - 1) * CW, y: 0, width: CW, height: H }, svg);
            for (var c = 1; c <= cols; c++) X.svg("text", { class: "x-pl-hd", x: LW + (c - .5) * CW, y: 18 }, svg).textContent = "C" + c;
            for (var c2 = 0; c2 <= cols; c2++) X.svg("line", { class: "x-pl-grid", x1: LW + c2 * CW, y1: TOP - 4, x2: LW + c2 * CW, y2: H }, svg);
            ins.forEach(function (x, i) {
              var y = TOP + i * RH;
              X.svg("text", { class: "x-pl-lab", x: 4, y: y + RH / 2 - 2 }, svg).textContent = "I" + (i + 1) + " " + x.text;
              for (var c = 1; c <= Math.min(cur, P.total); c++) {
                var k = cellAt(i, c);
                if (!k) continue;
                var x0 = LW + (c - 1) * CW + 2, now = c === cur;
                if (k === "bub") {
                  X.svg("rect", { class: "x-pl-bub", x: x0, y: y + 2, width: CW - 4, height: RH - 8 }, svg);
                  X.svg("text", { class: "x-pl-bt", x: x0 + CW / 2 - 2, y: y + RH / 2 - 2 }, svg).textContent = "气泡";
                } else {
                  X.svg("rect", { class: "x-pl-st" + (now ? " is-now" : ""), x: x0, y: y + 2, width: CW - 4, height: RH - 8 }, svg);
                  X.svg("text", { class: "x-pl-t" + (now ? " is-now" : ""), x: x0 + CW / 2 - 2, y: y + RH / 2 - 2 }, svg).textContent = k;
                }
              }
            });
            /* dependency arrows once both ends are on screen */
            P.deps.forEach(function (d) {
              var p = P.t[d.from], q = P.t[d.to], y1 = TOP + d.from * RH + RH / 2 - 2, y2 = TOP + d.to * RH + RH / 2 - 2, x1, x2, end;
              if (d.kind === "wb") { x1 = LW + (p.WB - .5) * CW; x2 = LW + (q.ID - .5) * CW; end = q.ID; y1 += RH / 2 - 6; y2 -= RH / 2 - 6; }
              else { var src = d.kind === "mem" ? p.MEM : p.EX; x1 = LW + src * CW - 2; x2 = LW + (q.EX - 1) * CW + 2; end = q.EX; }
              if (cur < end) return;
              X.svg("path", { class: "x-pl-fw", d: "M" + x1 + "," + y1 + " L" + x2 + "," + y2, "marker-end": "url(#x-pl-mk)" }, svg);
            });
            svg.setAttribute("aria-label", "流水线时空图，" + (fwd ? "有转发" : "无转发") + "：" + ins.map(function (x, i) {
              var t = P.t[i]; return "I" + (i + 1) + " IF 在 C" + t.IF + "，WB 在 C" + t.WB + (t.stall ? "，阻塞 " + t.stall + " 拍" : "");
            }).join("；"));
          }
          function render() {
            draw();
            var stalls = P.total - P.ideal;
            out.st.innerHTML = "<span>当前周期 <b>" + cur + "</b> / " + P.total + "</span><span>理想 <b>" + P.ideal + "</b> = 5+" + (ins.length - 1) + "</span>" +
              "<span>实际 <b>" + P.total + "</b></span><span class=\"x-lab__badge" + (stalls ? " is-bad" : "") + "\">" + (stalls ? "阻塞 " + stalls + " 拍" : "无阻塞") + "</span>";
            out.err.textContent = err; out.err.hidden = !err;
            var act = [];
            if (cur > 0) ins.forEach(function (x, i) { var k = cellAt(i, cur); if (k) act.push("I" + (i + 1) + " " + (k === "bub" ? "气泡" : k)); });
            out.msg.textContent = cur === 0 ? "按单步，每次推进一个时钟周期。" + (fwd ? "有转发：EX 结果直接送下一条的 EX。" : "无转发：寄存器在 WB 前半拍写、ID 后半拍读，相关指令的 ID 最早与生产者 WB 同拍。")
              : "C" + cur + "：" + act.join("，") + (cur === P.total ? "。全部完成，共 " + P.total + " 个周期。" : "");
            if (!P.deps.length) { out.deps.innerHTML = ""; return; }
            var h = '<div class="x-tbl"><table><caption>数据相关（RAW）</caption><thead><tr><th scope="col">相关</th><th scope="col">寄存器</th><th scope="col">' + (fwd ? "处理" : "约束") + '</th><th scope="col">阻塞</th></tr></thead><tbody>';
            P.deps.forEach(function (d) {
              var p = P.t[d.from], q = P.t[d.to], st = q.ID - (q.IF + 1), how;
              if (d.kind === "wb") how = "I" + (d.to + 1) + " ID ≥ I" + (d.from + 1) + " WB（C" + p.WB + "）";
              else if (d.kind === "mem") how = "load-use：MEM→EX 转发，I" + (d.to + 1) + " EX 在 C" + (p.MEM + 1) + " 起";
              else how = "EX→EX 转发（C" + p.EX + "→C" + (p.EX + 1) + "）";
              var shown = cur >= q.ID;
              h += "<tr" + (cur && q.ID === cur ? ' class="is-cur"' : "") + '><th scope="row">I' + (d.from + 1) + " → I" + (d.to + 1) + "</th><td>" + d.reg + "</td><td>" + how +
                "</td><td" + (shown ? (st ? ' class="is-bad">' + st + " 拍" : ' class="is-ok">0') : ">—") + "</td></tr>";
            });
            out.deps.innerHTML = h + "</tbody></table></div>";
          }
          function reset() {
            var r = LAB_PL.parse(inp.value);
            if (!r.ins.length) r = LAB_PL.parse(LAB_PL.DEF), r.bad = ["（无有效指令，已恢复默认）"];
            ins = r.ins;
            err = (r.bad.length ? "已跳过无法识别的指令：" + r.bad.join("；") : "") + (r.cut ? " 最多 10 条，其余已忽略。" : "");
            P = LAB_PL.plan(ins, fwd); cur = 0; render();
          }
          function step() { if (cur < P.total) { cur++; render(); } return cur < P.total; }
          reset();
          return { step: step, reset: reset, done: function () { return cur >= P.total; } };
        }
      };
      LAB.push(LAB_PL);

      /* demo 6: CPU scheduling Gantt chart */
      var LAB_GT = {
        id: "gantt", name: "CPU 调度甘特图", color: "var(--x-os)",
        note: "周转=完成−到达，带权周转=周转/运行时间",
        ALG: [["fcfs", "FCFS"], ["sjf", "SJF(非抢占)"], ["srtf", "SRTF(抢占式短作业)"], ["prio", "优先级(非抢占, 数字小优先)"], ["rr", "RR"]],
        DEF: [{ a: 0, b: 8, p: 3 }, { a: 1, b: 4, p: 1 }, { a: 2, b: 9, p: 4 }, { a: 3, b: 5, p: 2 }],
        /* returns tl: process index per time unit (-1 idle), q: waiting list at each unit, fin: completion times */
        sched: function (P, alg, Q) {
          var n = P.length, rem = P.map(function (p) { return p.b; }), fin = P.map(function () { return 0; }), tl = [], qs = [], t = 0, left = n;
          var order = P.map(function (_, i) { return i; }).sort(function (x, y) { return P[x].a - P[y].a || x - y; });
          function arrived(i) { return P[i].a <= t && rem[i] > 0; }
          function waiting(run) { return order.filter(function (i) { return arrived(i) && i !== run; }); }
          function tick(i, q) { tl.push(i); qs.push(q); t++; if (i >= 0 && --rem[i] === 0) { fin[i] = t; left--; } }
          if (alg === "rr") {
            var queue = [], added = 0;
            var admit = function () { while (added < n && P[order[added]].a <= t) queue.push(order[added++]); };
            admit();
            while (left) {
              if (!queue.length) { tick(-1, []); admit(); continue; }
              var p = queue.shift();
              for (var k = 0; k < Q && rem[p] > 0; k++) { tick(p, queue.slice()); admit(); }
              if (rem[p] > 0) queue.push(p);
            }
          } else {
            var run = -1;
            var key = { fcfs: function (i) { return [P[i].a]; }, sjf: function (i) { return [P[i].b, P[i].a]; }, srtf: function (i) { return [rem[i], P[i].a]; }, prio: function (i) { return [P[i].p, P[i].a]; } }[alg];
            while (left) {
              if (alg === "srtf" || run < 0 || rem[run] === 0) {
                var c = waiting(-1).sort(function (x, y) { var kx = key(x), ky = key(y); return kx[0] - ky[0] || (kx[1] || 0) - (ky[1] || 0) || x - y; });
                run = c.length ? c[0] : -1;
              }
              tick(run, run < 0 ? [] : waiting(run));
            }
          }
          return { tl: tl, qs: qs, fin: fin };
        },
        avg: function (P, fin) {
          var ta = 0, w = 0;
          P.forEach(function (p, i) { ta += fin[i] - p.a; w += (fin[i] - p.a) / p.b; });
          return { ta: (ta / P.length).toFixed(2), w: (w / P.length).toFixed(2) };
        },
        mount: function (panel, K) {
          var rows = LAB_GT.DEF.map(function (r) { return { a: r.a, b: r.b, p: r.p }; }), alg = "fcfs", Q = 2, S, cur, err, P;
          var la = X.el("label", { class: "x-lab__lbl" }, "算法 "), sel = X.el("select", { class: "x-lab__sel" });
          LAB_GT.ALG.forEach(function (g) { sel.appendChild(X.el("option", { value: g[0] }, g[1])); });
          sel.addEventListener("change", function () { alg = sel.value; lq.hidden = alg !== "rr"; K.restart(); });
          la.appendChild(sel); K.opts.appendChild(la);
          var lq = X.el("label", { class: "x-lab__lbl" }, "时间片 "), qin = X.el("input", { type: "number", class: "x-lab__sel x-gt-num", min: 1, max: 20, value: Q });
          qin.addEventListener("change", function () { var v = Math.round(+qin.value); Q = v >= 1 && v <= 20 ? v : 2; qin.value = Q; K.restart(); });
          lq.appendChild(qin); lq.hidden = true; K.opts.appendChild(lq);
          var add = X.el("button", { type: "button", class: "x-lab__btn x-lab__btn--ghost" }, "添加进程");
          add.addEventListener("click", function () {
            if (rows.length >= 8) return;
            var last = rows[rows.length - 1];
            rows.push({ a: last ? last.a + 1 : 0, b: 3, p: rows.length + 1 }); table(); K.restart();
          });
          K.opts.appendChild(add);
          var tw = X.el("div", { class: "x-tbl", style: "flex-basis:100%" });
          K.opts.appendChild(tw);
          var FIELDS = [["a", "到达时间", 0], ["b", "运行时间", 1], ["p", "优先级", 0]];
          function table() {
            var h = '<table><caption>进程表（可编辑，最多 8 个）</caption><thead><tr><th scope="col">进程</th>' + FIELDS.map(function (f) { return '<th scope="col">' + f[1] + "</th>"; }).join("") + '<th scope="col"></th></tr></thead><tbody>';
            rows.forEach(function (r, i) {
              h += '<tr><th scope="row">P' + (i + 1) + "</th>" + FIELDS.map(function (f) {
                return '<td><input type="number" class="x-lab__sel x-gt-num" min="' + f[2] + '" max="99" step="1" data-i="' + i + '" data-f="' + f[0] + '" value="' + r[f[0]] + '" aria-label="P' + (i + 1) + " " + f[1] + '"></td>';
              }).join("") + '<td><button type="button" class="x-lab__btn x-lab__btn--ghost" data-del="' + i + '"' + (rows.length < 2 ? " disabled" : "") + ' aria-label="删除 P' + (i + 1) + '">删除</button></td></tr>';
            });
            tw.innerHTML = h + "</tbody></table>";
            add.disabled = rows.length >= 8;
          }
          tw.addEventListener("change", function (e) {
            var x = e.target; if (!x.dataset.f) return;
            var f = FIELDS.filter(function (g) { return g[0] === x.dataset.f; })[0], v = Math.round(+x.value);
            if (x.value === "" || isNaN(v) || v < f[2] || v > 99) { x.value = rows[+x.dataset.i][f[0]]; return; }
            rows[+x.dataset.i][f[0]] = v; x.value = v; K.restart();
          });
          tw.addEventListener("click", function (e) {
            var b = e.target.closest("[data-del]"); if (!b || rows.length < 2) return;
            rows.splice(+b.dataset.del, 1); table(); K.restart();
          });
          table();
          var svg = X.svg("svg", { viewBox: "0 0 640 110", role: "img" }, K.stage);
          K.out.innerHTML = '<div class="x-lab__stats" data-k="st"></div><p class="x-lab__seq" data-k="msg"></p><div data-k="res"></div>';
          var out = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { out[x.dataset.k] = x; });
          var OP = [1, .55, .3, .8, .42, .68, .2, .9];
          function draw() {
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            var T = S.tl.length, x0 = 20, W = 600, u = W / T, y = 22, h = 44, i = 0;
            while (i < cur) {
              var p = S.tl[i], j = i; while (j < cur && S.tl[j] === p) j++;
              if (p < 0) X.svg("rect", { class: "x-gt-idle", x: x0 + i * u, y: y, width: (j - i) * u, height: h }, svg);
              else X.svg("rect", { class: "x-gt-blk", x: x0 + i * u, y: y, width: (j - i) * u, height: h, "fill-opacity": OP[p % 8] }, svg);
              if ((j - i) * u >= 22) X.svg("text", { class: "x-gt-name", x: x0 + (i + j) / 2 * u, y: y + h / 2 }, svg).textContent = p < 0 ? "空闲" : "P" + (p + 1);
              i = j;
            }
            X.svg("line", { class: "x-gt-axis", x1: x0, y1: y + h, x2: x0 + W, y2: y + h }, svg);
            var marks = {}, last = -99; marks[0] = 1; marks[T] = 1;
            for (var k = 1; k < T; k++) if (S.tl[k] !== S.tl[k - 1]) marks[k] = 1;
            for (var t = 0; t <= T; t++) {
              var x = x0 + t * u, big = marks[t];
              X.svg("line", { class: "x-gt-axis", x1: x, y1: y + h, x2: x, y2: y + h + (big ? 8 : 4) }, svg);
              if (big && t <= cur && (x - last >= 18 || t === T)) { X.svg("text", { class: "x-gt-tk", x: x, y: y + h + 22 }, svg).textContent = t; last = x; }
            }
            if (cur > 0 && cur < T) X.svg("line", { class: "x-gt-now", x1: x0 + cur * u, y1: y - 8, x2: x0 + cur * u, y2: y + h + 8 }, svg);
            var segs = [], s0 = 0;
            for (var m = 1; m <= T; m++) if (m === T || S.tl[m] !== S.tl[m - 1]) { segs.push((S.tl[s0] < 0 ? "空闲" : "P" + (S.tl[s0] + 1)) + " " + s0 + "–" + m); s0 = m; }
            svg.setAttribute("aria-label", "甘特图：" + segs.join("，"));
          }
          function render() {
            draw();
            var T = S.tl.length, name = LAB_GT.ALG.filter(function (g) { return g[0] === alg; })[0][1] + (alg === "rr" ? "，q=" + Q : "");
            out.st.innerHTML = "<span>时刻 <b>" + cur + "</b> / " + T + "</span><span>" + name + "</span>";
            if (cur === 0) out.msg.textContent = "按单步，每次推进 1 个时间单位。";
            else {
              var r = S.tl[cur - 1], q = S.qs[cur - 1];
              out.msg.textContent = "[" + (cur - 1) + ", " + cur + ")：" + (r < 0 ? "CPU 空闲" : "运行 P" + (r + 1)) + "；" + (alg === "rr" ? "就绪队列 " : "等待 ") +
                (q.length ? q.map(function (i) { return "P" + (i + 1); }).join(" → ") : "空") + (cur === T ? "。全部完成。" : "");
            }
            var h = '<div class="x-tbl"><table><caption>结果</caption><thead><tr><th scope="col">进程</th><th scope="col">到达</th><th scope="col">运行</th><th scope="col">完成时间</th><th scope="col">周转时间</th><th scope="col">带权周转时间</th></tr></thead><tbody>';
            P.forEach(function (p, i) {
              var f = S.fin[i], seen = f <= cur, ta = f - p.a;
              h += "<tr" + (seen && f === cur ? ' class="is-cur"' : "") + '><th scope="row">P' + (i + 1) + "</th><td>" + p.a + "</td><td>" + p.b + "</td><td>" + (seen ? f : "—") +
                "</td><td>" + (seen ? ta : "—") + "</td><td>" + (seen ? (ta / p.b).toFixed(2) : "—") + "</td></tr>";
            });
            h += "</tbody></table></div>";
            if (cur === T) {
              var av = LAB_GT.avg(P, S.fin);
              h += '<div class="x-lab__stats" style="margin-top:12px"><span>平均周转 <b>' + av.ta + "</b></span><span>平均带权周转 <b>" + av.w + "</b></span></div>";
            }
            out.res.innerHTML = h;
          }
          function reset() {
            P = rows.map(function (r) { return { a: r.a, b: r.b, p: r.p }; });
            S = LAB_GT.sched(P, alg, Q); cur = 0; render();
          }
          function step() { if (cur < S.tl.length) { cur++; render(); } return cur < S.tl.length; }
          reset();
          return { step: step, reset: reset, done: function () { return cur >= S.tl.length; } };
        }
      };
      LAB.push(LAB_GT);

      /* demo 7: page replacement (OPT / FIFO / LRU / CLOCK side by side) */
      var LAB_PR = {
        id: "paging", name: "页面置换", color: "var(--x-os)",
        note: "OPT 不可实现只作标杆；FIFO 会出现 Belady 异常；LRU 需要硬件支持",
        DEF: "7,0,1,2,0,3,0,4,2,3,0,3,2,1,2,0,1,7,0,1",
        BEL: "1,2,3,4,1,2,5,1,2,3,4,5",
        ALG: [["opt", "OPT"], ["fifo", "FIFO"], ["lru", "LRU"], ["clock", "CLOCK"]],
        parse: function (s) {
          var a = String(s).split(/[\s,，、]+/).filter(function (x) { return x !== ""; });
          if (!a.length) return { err: "访问串为空" };
          if (a.length > 30) return { err: "访问串最多 30 项" };
          for (var i = 0; i < a.length; i++) if (!/^\d{1,2}$/.test(a[i])) return { err: "“" + a[i] + "”不是 0–99 的页号" };
          return { refs: a.map(Number) };
        },
        /* one column per reference: frames after it, use bits, clock pointer, miss flag, slot touched, page evicted */
        sim: function (refs, n, alg) {
          var f = [], u = [], ld = [], last = [], ptr = 0, cols = [], faults = 0;
          for (var k = 0; k < n; k++) { f.push(null); u.push(0); ld.push(-1); last.push(-1); }
          refs.forEach(function (r, t) {
            var slot = f.indexOf(r), miss = slot < 0, out = null;
            if (!miss) { last[slot] = t; u[slot] = 1; }
            else {
              faults++;
              if (alg === "clock") {
                while (f[ptr] !== null && u[ptr]) { u[ptr] = 0; ptr = (ptr + 1) % n; }
                slot = ptr; ptr = (ptr + 1) % n;
              } else {
                slot = f.indexOf(null);
                if (slot < 0) {
                  var best = -Infinity;
                  for (var j = 0; j < n; j++) {
                    var score;
                    if (alg === "fifo") score = -ld[j];
                    else if (alg === "lru") score = -last[j];
                    else { var nx = refs.indexOf(f[j], t + 1); score = nx < 0 ? Infinity : nx; }
                    if (score > best) { best = score; slot = j; }
                  }
                }
              }
              out = f[slot]; f[slot] = r; ld[slot] = t; last[slot] = t; u[slot] = 1;
            }
            cols.push({ f: f.slice(), u: u.slice(), p: ptr, miss: miss, slot: slot, out: out });
          });
          return { cols: cols, faults: faults };
        },
        mount: function (panel, K) {
          var str = LAB_PR.DEF, n = 3, refs, R, cur, err;
          var ls = X.el("label", { class: "x-lab__lbl", style: "flex:1 1 300px" }, "访问串 ");
          var sin = X.el("input", { type: "text", class: "x-lab__in", value: str, inputmode: "numeric", "aria-label": "访问串，逗号分隔" });
          ls.appendChild(sin); K.opts.appendChild(ls);
          var lf = X.el("label", { class: "x-lab__lbl" }, "物理块数 ");
          var fin = X.el("input", { type: "number", class: "x-lab__sel x-gt-num", min: 1, max: 8, value: n });
          lf.appendChild(fin); K.opts.appendChild(lf);
          var bel = X.el("button", { type: "button", class: "x-lab__btn x-lab__btn--ghost" }, "Belady 异常");
          K.opts.appendChild(bel);
          sin.addEventListener("change", function () { str = sin.value; K.restart(); });
          fin.addEventListener("change", function () { var v = Math.round(+fin.value); n = v >= 1 && v <= 8 ? v : 3; fin.value = n; K.restart(); });
          bel.addEventListener("click", function () {
            if (str === LAB_PR.BEL) n = n === 3 ? 4 : 3; else { str = LAB_PR.BEL; n = 3; }
            sin.value = str; fin.value = n; K.restart();
          });
          var grids = X.el("div", { class: "x-pr-grids" });
          K.stage.appendChild(grids);
          K.out.innerHTML = '<div class="x-lab__stats" data-k="st"></div><p class="x-lab__seq" data-k="msg"></p><p class="x-lab__seq" data-k="bel"></p>';
          var out = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { out[x.dataset.k] = x; });
          function grid(a) {
            var cols = R[a[0]].cols, miss = 0;
            for (var t = 0; t < cur; t++) if (cols[t].miss) miss++;
            var rate = cur ? (miss / cur * 100).toFixed(1) + "%" : "—";
            var h = '<div class="x-tbl"><table><caption>' + a[1] + " · 缺页 " + miss + " 次 · 缺页率 " + rate + '</caption><thead><tr><th scope="col">访问</th>';
            refs.forEach(function (r, t) { h += '<th scope="col"' + (t === cur - 1 ? ' class="is-col"' : "") + ">" + r + "</th>"; });
            h += "</tr></thead><tbody>";
            for (var k = 0; k < n; k++) {
              h += '<tr><th scope="row">块' + k + "</th>";
              refs.forEach(function (_, t) {
                var c = cols[t], v = t < cur ? c.f[k] : null, cl = [];
                if (t === cur - 1) cl.push("is-col");
                if (t < cur && c.slot === k) cl.push(c.miss ? "is-new" : "is-hit");
                if (a[0] === "clock" && t === cur - 1 && c.p === k) cl.push("is-ptr");
                h += "<td" + (cl.length ? ' class="' + cl.join(" ") + '"' : "") + ">" + (v === null ? "" : v + (a[0] === "clock" ? "<sub>" + c.u[k] + "</sub>" : "")) + "</td>";
              });
              h += "</tr>";
            }
            h += '<tr><th scope="row">缺页</th>';
            refs.forEach(function (_, t) { h += '<td class="x-pr-miss' + (t === cur - 1 ? " is-col" : "") + '">' + (t < cur && cols[t].miss ? "缺" : "") + "</td>"; });
            h += '</tr><tr><th scope="row">换出</th>';
            refs.forEach(function (_, t) { var o = t < cur ? cols[t].out : null; h += '<td class="x-pr-out' + (t === cur - 1 ? " is-col" : "") + '">' + (o === null ? "" : o) + "</td>"; });
            return h + "</tr></tbody></table></div>";
          }
          function render() {
            if (err) { grids.innerHTML = ""; out.st.innerHTML = ""; out.msg.innerHTML = '<span class="x-lab__err">' + err + "</span>"; out.bel.textContent = ""; return; }
            grids.innerHTML = LAB_PR.ALG.map(grid).join("");
            out.st.innerHTML = "<span>访问 <b>" + cur + "</b> / " + refs.length + "</span><span>" + n + " 个物理块</span>" +
              (cur === refs.length ? LAB_PR.ALG.map(function (a) { return "<span>" + a[1] + " <b>" + R[a[0]].faults + "</b></span>"; }).join("") : "");
            if (cur === 0) out.msg.textContent = "按单步，四种算法同时处理下一次访问。框线 = 新调入，下划线 = 命中" + "，CLOCK 下标为访问位、▸ 为指针。";
            else {
              var r = refs[cur - 1];
              out.msg.textContent = "第 " + cur + " 次访问页 " + r + "：" + LAB_PR.ALG.map(function (a) {
                var c = R[a[0]].cols[cur - 1];
                return a[1] + (c.miss ? " 缺页" + (c.out === null ? "（装入空块）" : "，换出 " + c.out) : " 命中");
              }).join("；") + (cur === refs.length ? "。全部访问完毕。" : "");
            }
            var f3 = LAB_PR.sim(refs, n, "fifo").faults, f4 = LAB_PR.sim(refs, n + 1, "fifo").faults;
            out.bel.innerHTML = "FIFO 对比：" + n + " 块缺页 <span>" + f3 + "</span> 次，" + (n + 1) + " 块缺页 <span>" + f4 + "</span> 次" +
              (f4 > f3 ? ' <span class="x-lab__badge is-bad">Belady 异常：块数增加，缺页反而增加</span>' : "");
          }
          function reset() {
            var p = LAB_PR.parse(str);
            err = p.err; cur = 0;
            if (!err) { refs = p.refs; R = {}; LAB_PR.ALG.forEach(function (a) { R[a[0]] = LAB_PR.sim(refs, n, a[0]); }); }
            render();
          }
          function step() { if (err) return false; if (cur < refs.length) { cur++; render(); } return cur < refs.length; }
          reset();
          return { step: step, reset: reset, done: function () { return !!err || cur >= refs.length; } };
        }
      };
      LAB.push(LAB_PR);

      /* demo 8: banker's algorithm */
      var LAB_BK = {
        id: "banker", name: "银行家算法", color: "var(--x-os)",
        note: "Need = Max − Allocation；存在一个安全序列即为安全状态",
        RES: ["A", "B", "C"],
        DEF: { av: [2, 2, 1], max: [[6, 4, 3], [3, 2, 2], [8, 0, 3], [2, 3, 2], [5, 2, 4]], al: [[1, 1, 0], [2, 0, 1], [3, 0, 2], [1, 2, 1], [0, 1, 2]] },
        need: function (max, al) { return max.map(function (r, i) { return r.map(function (v, j) { return v - al[i][j]; }); }); },
        le: function (a, b) { return a.every(function (v, j) { return v <= b[j]; }); },
        add: function (a, b, s) { return a.map(function (v, j) { return v + (s || 1) * b[j]; }); },
        /* each round picks the lowest-numbered unfinished process with Need <= Work */
        safe: function (av, max, al) {
          var need = LAB_BK.need(max, al), n = max.length, work = av.slice(), fin = max.map(function () { return false; }), steps = [], seq = [];
          while (seq.length < n) {
            var rej = [], pick = -1;
            for (var i = 0; i < n; i++) {
              if (fin[i]) continue;
              if (LAB_BK.le(need[i], work)) { pick = i; break; }
              rej.push(i);
            }
            if (pick < 0) { steps.push({ i: -1, rej: rej, w0: work.slice(), w1: work.slice() }); return { steps: steps, seq: seq, ok: false, need: need }; }
            var w1 = LAB_BK.add(work, al[pick]);
            steps.push({ i: pick, rej: rej, w0: work.slice(), w1: w1 });
            work = w1; fin[pick] = true; seq.push(pick);
          }
          return { steps: steps, seq: seq, ok: true, need: need };
        },
        request: function (av, max, al, p, req) {
          var need = LAB_BK.need(max, al);
          if (!LAB_BK.le(req, need[p])) return { ok: false, why: "Request > Need：超过 P" + p + " 宣称的最大需求，出错" };
          if (!LAB_BK.le(req, av)) return { ok: false, why: "Request > Available：资源不足，P" + p + " 等待" };
          var av2 = LAB_BK.add(av, req, -1), al2 = al.map(function (r, i) { return i === p ? LAB_BK.add(r, req) : r.slice(); });
          var s = LAB_BK.safe(av2, max, al2);
          return { ok: s.ok, tried: true, seq: s.seq, av: av2, al: al2, why: s.ok ? "试探分配后系统仍安全" : "试探分配后找不到安全序列，撤销试探" };
        },
        mount: function (panel, K) {
          var D = LAB_BK.DEF, av = D.av.slice(), max = D.max.map(function (r) { return r.slice(); }), al = D.al.map(function (r) { return r.slice(); });
          var RES = LAB_BK.RES, S, cur, err, pend = null;
          function vec(v) { return "(" + v.join(",") + ")"; }
          function ps(a) { return a.map(function (i) { return "P" + i; }).join(" → "); }
          var tw = X.el("div", { class: "x-tbl x-bk-grid", style: "flex-basis:100%;margin-top:0" });
          K.opts.appendChild(tw);
          function cell(m, i, j, v, lab) {
            return '<td><input type="number" class="x-lab__sel x-bk-in" min="0" max="20" step="1" data-m="' + m + '" data-i="' + i + '" data-j="' + j + '" value="' + v + '" aria-label="' + lab + '"></td>';
          }
          function matrix() {
            var need = LAB_BK.need(max, al), hd = RES.map(function (r) { return '<th scope="col">' + r + "</th>"; }).join("");
            var h = '<table><caption>系统状态（Max、Allocation、Available 可编辑；Need 自动计算）</caption><thead><tr><th scope="col" rowspan="2">进程</th><th scope="colgroup" colspan="3">Max</th><th scope="colgroup" colspan="3">Allocation</th><th scope="colgroup" colspan="3">Need</th></tr><tr>' + hd + hd + hd + "</tr></thead><tbody>";
            max.forEach(function (r, i) {
              h += '<tr><th scope="row">P' + i + "</th>";
              r.forEach(function (v, j) { h += cell("max", i, j, v, "P" + i + " Max " + RES[j]); });
              al[i].forEach(function (v, j) { h += cell("al", i, j, v, "P" + i + " Allocation " + RES[j]); });
              need[i].forEach(function (v) { h += "<td" + (v < 0 ? ' class="is-bad"' : "") + ">" + v + "</td>"; });
              h += "</tr>";
            });
            h += '<tr><th scope="row">Available</th>';
            av.forEach(function (v, j) { h += cell("av", 0, j, v, "Available " + RES[j]); });
            tw.innerHTML = h + '<td colspan="6"></td></tr></tbody></table>';
          }
          tw.addEventListener("change", function (e) {
            var x = e.target; if (!x.dataset.m) return;
            var v = Math.round(+x.value), i = +x.dataset.i, j = +x.dataset.j, arr = x.dataset.m === "av" ? av : (x.dataset.m === "max" ? max : al)[i];
            if (x.value === "" || isNaN(v) || v < 0 || v > 20) { x.value = arr[j]; return; }
            arr[j] = v; matrix(); K.restart();
          });
          matrix();
          var stage = X.el("div");
          K.stage.appendChild(stage);
          K.out.innerHTML = '<div class="x-lab__stats" data-k="st"></div><p class="x-lab__seq" data-k="msg"></p><p class="x-lab__seq" data-k="hist"></p><p class="x-lab__big" data-k="seq"></p><p class="x-lab__seq" data-k="tip"></p>' +
            '<div class="x-bk-form"><span class="x-lab__lbl">请求资源</span><select class="x-lab__sel" data-k="rp" aria-label="请求进程"></select>' +
            RES.map(function (r, j) { return '<label class="x-lab__lbl">' + r + ' <input type="number" class="x-lab__sel x-bk-in" min="0" max="20" value="' + [1, 0, 1][j] + '" data-r="' + j + '"></label>'; }).join("") +
            '<button type="button" class="x-lab__btn" data-k="go">检查请求</button><button type="button" class="x-lab__btn x-lab__btn--ghost" data-k="ok" hidden>确认分配</button></div><p class="x-lab__seq" data-k="res"></p>';
          var out = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { out[x.dataset.k] = x; });
          for (var p = 0; p < 5; p++) out.rp.appendChild(X.el("option", { value: p }, "P" + p));
          out.rp.value = "1";
          out.go.addEventListener("click", function () {
            var pi = +out.rp.value, req = [].map.call(K.out.querySelectorAll("[data-r]"), function (x) { var v = Math.round(+x.value); return isNaN(v) || v < 0 ? 0 : v; });
            if (err) { out.res.innerHTML = '<span class="x-lab__err">先修正系统状态</span>'; return; }
            var r = LAB_BK.request(av, max, al, pi, req);
            pend = r.ok ? { av: r.av, al: r.al } : null;
            out.ok.hidden = !r.ok;
            out.res.innerHTML = "P" + pi + " 请求 " + vec(req) + "：" + (r.tried ? "① Request ≤ Need ✓ ② Request ≤ Available ✓ ③ 试探分配，Available → " + vec(r.av) + "，运行安全性检查。" : "") +
              ' <span class="x-lab__badge' + (r.ok ? "" : " is-bad") + '">' + (r.ok ? "可以分配" : r.tried ? "不安全拒绝" : "拒绝") + "</span> " + r.why +
              (r.ok ? "，安全序列 <span>" + ps(r.seq) + "</span>。" : "。");
          });
          out.ok.addEventListener("click", function () {
            if (!pend) return;
            av = pend.av; al = pend.al; pend = null; out.ok.hidden = true;
            out.res.textContent += " 已分配，系统状态已更新。";
            matrix(); K.restart();
          });
          function render() {
            if (err) { stage.innerHTML = ""; out.st.innerHTML = ""; out.msg.innerHTML = '<span class="x-lab__err">' + err + "</span>"; out.hist.textContent = out.seq.textContent = out.tip.textContent = ""; return; }
            var steps = S.steps, last = steps[cur - 1], fin = {};
            for (var k = 0; k < cur; k++) if (steps[k].i >= 0) fin[steps[k].i] = k;
            var h = '<div class="x-tbl x-bk-grid"><table><caption>安全性检查</caption><thead><tr><th scope="col">进程</th><th scope="col">Work</th><th scope="col">Need</th><th scope="col">Allocation</th><th scope="col">Work + Allocation</th><th scope="col">Finish</th></tr></thead><tbody>';
            for (var m = 0; m < 5; m++) {
              var at = fin[m], done = at !== undefined;
              h += "<tr" + (last && last.i === m ? ' class="is-cur"' : "") + '><th scope="row">P' + m + "</th><td>" + (done ? vec(steps[at].w0) : "—") + "</td><td>" + vec(S.need[m]) +
                "</td><td>" + vec(al[m]) + "</td><td>" + (done ? vec(steps[at].w1) : "—") + '</td><td class="' + (done ? "is-ok" : "") + '">' + (done ? "true（第 " + (at + 1) + " 个）" : "false") + "</td></tr>";
            }
            stage.innerHTML = h + "</tbody></table></div>";
            var seq = [], hist = [vec(av)];
            for (var q = 0; q < cur; q++) if (steps[q].i >= 0) { seq.push(steps[q].i); hist.push(vec(steps[q].w1)); }
            out.st.innerHTML = "<span>第 <b>" + cur + "</b> / " + steps.length + " 轮</span><span>Available " + vec(av) + "</span>" +
              (cur === steps.length ? ' <span class="x-lab__badge' + (S.ok ? "" : " is-bad") + '">' + (S.ok ? "安全状态" : "不安全状态") + "</span>" : "");
            if (!last) out.msg.textContent = "Work = Available，Finish 全为 false。按单步，每轮从 P0 起找第一个 Need ≤ Work 的未完成进程。";
            else {
              var rj = last.rej.map(function (j) { return "P" + j + " Need" + vec(S.need[j]) + " ≰ Work"; }).join("，");
              out.msg.textContent = "Work = " + vec(last.w0) + "：" + (rj ? rj + "；" : "") + (last.i < 0 ? "没有进程能满足，系统不安全。" :
                "P" + last.i + " Need" + vec(S.need[last.i]) + " ≤ Work ✓，运行完归还资源，Work = " + vec(last.w0) + " + " + vec(al[last.i]) + " = " + vec(last.w1) + "，Finish[" + last.i + "] = true。");
            }
            out.hist.innerHTML = "Work 历史：<span>" + hist.join(" → ") + "</span>";
            out.seq.textContent = seq.length ? "安全序列 " + ps(seq) : "安全序列 —";
            out.tip.textContent = cur === steps.length && S.ok ? "按“每轮选编号最小的可执行进程”得到上面的序列；换一种挑选顺序（如 P3 → P1 → P4 → P0 → P2）同样成立，找到任意一个安全序列即可。" : "";
          }
          function reset() {
            var need = LAB_BK.need(max, al), bad = [];
            need.forEach(function (r, i) { if (r.some(function (v) { return v < 0; })) bad.push("P" + i); });
            err = bad.length ? bad.join("、") + " 的 Allocation 超过 Max，Need 不能为负" : null;
            cur = 0;
            if (!err) S = LAB_BK.safe(av, max, al);
            render();
          }
          function step() { if (err) return false; if (cur < S.steps.length) { cur++; render(); } return cur < S.steps.length; }
          reset();
          return { step: step, reset: reset, done: function () { return !!err || cur >= S.steps.length; } };
        }
      };
      LAB.push(LAB_BK);

      /* demo 9: TCP congestion control */
      var LAB_TC = {
        id: "tcp", name: "TCP 拥塞控制", color: "var(--x-cn)",
        note: "发送窗口 = min(rwnd, cwnd)；超时回到 1，三个重复 ACK 减半",
        MAX: 60,
        PH: { ss: "慢开始", ca: "拥塞避免", fr: "快恢复" },
        phase: function (c, s) { return c < s ? "ss" : "ca"; },
        init: function (ssth, cwnd) { return [{ r: 1, cwnd: cwnd, ssth: ssth, ph: LAB_TC.phase(cwnd, ssth), ev: null }]; },
        /* one RTT: below ssthresh double but never past it, otherwise +1 */
        next: function (p) {
          var c = p.cwnd < p.ssth ? Math.min(p.cwnd * 2, p.ssth) : p.cwnd + 1;
          return { r: p.r + 1, cwnd: c, ssth: p.ssth, ph: LAB_TC.phase(c, p.ssth), ev: null, from: p.cwnd, cap: p.cwnd < p.ssth && p.cwnd * 2 > p.ssth };
        },
        /* "to" = timeout, "dup" = 3 duplicate ACKs (Reno fast recovery: cwnd = new ssthresh, the usual 408 convention) */
        event: function (p, kind) {
          var s = Math.max(Math.floor(p.cwnd / 2), 2), c = kind === "to" ? 1 : s;
          return { r: p.r + 1, cwnd: c, ssth: s, ph: kind === "to" ? LAB_TC.phase(1, s) : "fr", ev: kind, from: p.cwnd };
        },
        mount: function (panel, K) {
          var T = LAB_TC, R;
          function num(label, val, max) {
            var l = X.el("label", { class: "x-lab__lbl" }, label + " "), el = X.el("input", { type: "number", class: "x-lab__sel x-tc-num", min: 1, max: max, step: 1, value: val });
            el.addEventListener("change", function () {
              var v = Math.round(+el.value);
              el.value = isNaN(v) || el.value === "" ? val : Math.min(Math.max(v, +el.min), max);
              K.restart();
            });
            l.appendChild(el); K.opts.appendChild(l); return el;
          }
          var ssIn = num("初始 ssthresh", 16, 64); ssIn.min = 2;
          var cwIn = num("初始 cwnd", 1, 64);
          K.opts.appendChild(X.el("span", { class: "x-lab__br" }));
          [["to", "超时"], ["dup", "3个重复ACK"]].forEach(function (e) {
            var b = X.el("button", { type: "button", class: "x-lab__btn x-lab__btn--ghost" }, e[1]);
            b.addEventListener("click", function () { if (R.length < T.MAX) { R.push(T.event(R[R.length - 1], e[0])); render(); } });
            K.opts.appendChild(b);
          });
          var svg = X.svg("svg", { viewBox: "0 0 640 324", role: "img" }, K.stage);
          K.out.innerHTML = '<div class="x-lab__stats" data-k="st"></div><p class="x-lab__seq" data-k="msg"></p><div class="x-tc-log" data-k="log" tabindex="0" role="log" aria-label="每轮记录"></div>';
          var out = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { out[x.dataset.k] = x; });
          function t(cls, x, y, s, extra) { var n = X.svg("text", Object.assign({ class: cls, x: x, y: y }, extra || {}), svg); n.textContent = s; return n; }
          function draw() {
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            var L = 44, RR = 600, TOP = 70, B = 286, xmax = Math.max(16, R.length + 1);
            var hi = Math.max.apply(null, R.map(function (p) { return Math.max(p.cwnd, p.ssth); }));
            var st = hi <= 20 ? 4 : hi <= 40 ? 8 : 16, ymax = Math.ceil((hi + 2) / st) * st;
            function fx(r) { return L + (r - 1) / (xmax - 1) * (RR - L); }
            function fy(v) { return B - v / ymax * (B - TOP); }
            for (var v = st; v <= ymax; v += st) X.svg("line", { class: "x-tc-gd", x1: L, y1: fy(v), x2: RR + 8, y2: fy(v) }, svg);
            for (v = 0; v <= ymax; v += st) t("x-tc-tk", L - 8, fy(v) + 4, v, { "text-anchor": "end" });
            var k = xmax <= 20 ? 1 : xmax <= 40 ? 2 : 5;
            for (var r = 1; r <= xmax; r++) if (r === 1 || r % k === 0) t("x-tc-tk", fx(r), B + 18, r, { "text-anchor": "middle" });
            X.svg("line", { class: "x-tc-ax", x1: L, y1: TOP - 10, x2: L, y2: B }, svg);
            X.svg("line", { class: "x-tc-ax", x1: L, y1: B, x2: RR + 8, y2: B }, svg);
            t("x-tc-ttl", L + 6, TOP - 6, "cwnd（MSS）");
            t("x-tc-ttl", RR + 8, B + 36, "传输轮次（RTT）", { "text-anchor": "end" });
            /* ssthresh as a dashed step line */
            var d = "M" + L + "," + fy(R[0].ssth);
            R.forEach(function (p, i) {
              if (i && p.ssth !== R[i - 1].ssth) d += " L" + fx(p.r) + "," + fy(R[i - 1].ssth);
              d += " L" + fx(p.r) + "," + fy(p.ssth);
            });
            var last = R[R.length - 1];
            d += " L" + (RR + 8) + "," + fy(last.ssth);
            X.svg("path", { class: "x-tc-ss", d: d }, svg);
            t("x-tc-sst", RR + 8, fy(last.ssth) - 7, "ssthresh = " + last.ssth);
            /* phase brackets in two alternating rows; fast recovery is marked at its point */
            var runs = [];
            R.forEach(function (p) {
              var cur = runs[runs.length - 1];
              if (p.ph === "fr") { runs.push({ ph: "fr", a: p.r, b: p.r }); return; }
              if (cur && cur.ph === p.ph) cur.b = p.r; else runs.push({ ph: p.ph, a: p.r, b: p.r });
            });
            var row = 0;
            runs.forEach(function (u) {
              if (u.ph === "fr") return;
              var y = row++ % 2 ? 38 : 16, x1 = fx(u.a) - (u.a === u.b ? 6 : 0), x2 = fx(u.b) + (u.a === u.b ? 6 : 0);
              X.svg("path", { class: "x-tc-br", d: "M" + x1 + "," + (y + 12) + " V" + (y + 6) + " H" + x2 + " V" + (y + 12) }, svg);
              t("x-tc-ph", (x1 + x2) / 2, y, T.PH[u.ph]);
            });
            X.svg("polyline", { class: "x-tc-ln", points: R.map(function (p) { return fx(p.r) + "," + fy(p.cwnd); }).join(" ") }, svg);
            R.forEach(function (p, i) {
              if (p.ev) {
                t("x-tc-ev", fx(p.r - 1), fy(p.from) - (i === R.length - 1 ? 12 : 22), p.ev === "to" ? "超时" : "3个重复ACK");
                if (p.ev === "dup") t("x-tc-ph", fx(p.r) + 4, fy(p.cwnd) + 20, "快恢复");
              }
              X.svg("circle", { class: "x-tc-pt" + (i === R.length - 1 ? " is-now" : ""), cx: fx(p.r), cy: fy(p.cwnd), r: i === R.length - 1 ? 5 : 3 }, svg);
            });
            if (!last.ev) t("x-tc-val", fx(last.r), fy(last.cwnd) - 12, last.cwnd);
            svg.setAttribute("aria-label", "cwnd 随传输轮次变化：" + R.map(function (p) { return p.cwnd; }).join("，") + "；当前 ssthresh = " + last.ssth);
          }
          function why(p) {
            if (p.ev === "to") return "超时：ssthresh = max(" + p.from + "/2, 2) = " + p.ssth + "，cwnd = 1，重新慢开始。";
            if (p.ev === "dup") return "3 个重复 ACK：ssthresh = max(" + p.from + "/2, 2) = " + p.ssth + "，cwnd = ssthresh = " + p.cwnd + "（快恢复），下一轮起拥塞避免。";
            if (p.from < p.ssth) return "慢开始：cwnd 翻倍 " + p.from + " → " + p.cwnd + (p.cap ? "（" + p.from * 2 + " 超过 ssthresh，只增到 " + p.ssth + "）" : "") + (p.cwnd >= p.ssth ? "，达到 ssthresh，转入拥塞避免。" : "。");
            return "拥塞避免：每轮 cwnd 加 1，" + p.from + " → " + p.cwnd + "。";
          }
          function pad(v, w) { return String(v).padStart(w, " "); }
          function render() {
            draw();
            var p = R[R.length - 1];
            out.st.innerHTML = "<span>轮次 <b>" + p.r + "</b></span><span>cwnd <b>" + p.cwnd + "</b></span><span>ssthresh <b>" + p.ssth + "</b></span>" +
              '<span class="x-lab__badge' + (p.ev === "to" ? " is-bad" : "") + '">' + T.PH[p.ph] + "</span>";
            out.msg.textContent = R.length === 1 ? "第 1 轮：cwnd = " + p.cwnd + "，ssthresh = " + p.ssth + "。单步一次过一个 RTT；“超时”和“3个重复ACK”随时可按。" : why(p) +
              (R.length >= T.MAX ? " 已到 " + T.MAX + " 轮上限，按重置重来。" : "");
            out.log.textContent = R.map(function (q) {
              return "轮次 " + pad(q.r, 2) + "  cwnd " + pad(q.cwnd, 3) + "  ssthresh " + pad(q.ssth, 3) + "  " + T.PH[q.ph] +
                (q.ev ? "  ← " + (q.ev === "to" ? "超时" : "3个重复ACK") : "");
            }).join("\n");
            out.log.scrollTop = out.log.scrollHeight;
          }
          function reset() { R = T.init(Math.max(2, +ssIn.value || 16), Math.max(1, +cwIn.value || 1)); render(); }
          function step() { if (R.length < T.MAX) { R.push(T.next(R[R.length - 1])); render(); } return R.length < T.MAX; }
          reset();
          return { step: step, reset: reset, done: function () { return R.length >= T.MAX; } };
        }
      };
      LAB.push(LAB_TC);

      /* demo 10: subnet calculator */
      var LAB_SN = {
        id: "subnet", name: "子网划分计算器", color: "var(--x-cn)",
        note: "CIDR 可用主机数减 2（全 0 网络号、全 1 广播）",
        DEF: "192.168.10.77/26",
        parse: function (s) {
          var m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*\/\s*(\d{1,2})\s*$/.exec(s);
          if (!m) return { err: "格式应为 a.b.c.d/n，例如 192.168.10.77/26" };
          var o = m.slice(1, 5).map(Number), n = +m[5];
          if (o.some(function (v) { return v > 255; })) return { err: "每个字节应在 0–255 之间" };
          if (n > 32) return { err: "前缀长度应在 0–32 之间" };
          return { ip: o[0] * 16777216 + o[1] * 65536 + o[2] * 256 + o[3], n: n };
        },
        mask: function (n) { return n === 0 ? 0 : (0xFFFFFFFF << (32 - n)) >>> 0; },
        ip: function (u) { return [u >>> 24, (u >>> 16) & 255, (u >>> 8) & 255, u & 255].join("."); },
        bin: function (u) { return u.toString(2).padStart(32, "0").replace(/(.{8})(?!$)/g, "$1."); },
        calc: function (ip, n) {
          var m = LAB_SN.mask(n), net = (ip & m) >>> 0, bc = (net | (~m >>> 0)) >>> 0, r = { n: n, mask: m, net: net, bc: bc };
          if (n <= 30) { r.hosts = Math.pow(2, 32 - n) - 2; r.first = net + 1; r.last = bc - 1; }
          else if (n === 31) { r.hosts = 2; r.first = net; r.last = bc; r.note = "/31 只有 2 个地址：按公式 2^1 − 2 = 0；RFC 3021 允许点对点链路把两个地址都分给主机，不设网络号和广播地址。"; }
          else { r.hosts = 1; r.first = r.last = net; r.note = "/32 只含这一个地址，是单个主机路由：按公式 2^0 − 2 = −1 无意义，网络地址、广播地址和主机都是它自己。"; }
          return r;
        },
        /* equal split into k subnets: borrow b bits so that 2^b >= k */
        split: function (ip, n, k) {
          var b = 0; while (Math.pow(2, b) < k) b++;
          var n2 = n + b;
          if (n2 > 32) return { err: "/" + n + " 只剩 " + (32 - n) + " 位主机号，最多分 " + Math.pow(2, 32 - n) + " 个子网" };
          var net = LAB_SN.calc(ip, n).net, size = Math.pow(2, 32 - n2), count = Math.pow(2, b), list = [];
          for (var i = 0; i < Math.min(count, 64); i++) list.push(LAB_SN.calc(net + i * size, n2));
          return { b: b, n2: n2, count: count, size: size, list: list };
        },
        mount: function (panel, K) {
          var S = LAB_SN, P, C, err, pos;
          var inp = X.el("input", { type: "text", class: "x-lab__in", "aria-label": "IPv4 地址/前缀长度", spellcheck: "false", value: S.DEF });
          var go = X.el("button", { type: "button", class: "x-lab__btn" }, "计算");
          K.opts.appendChild(inp); K.opts.appendChild(go);
          K.opts.appendChild(X.el("span", { class: "x-lab__br" }));
          var kl = X.el("label", { class: "x-lab__lbl" }, "等分子网 "), kIn = X.el("input", { type: "number", class: "x-lab__sel x-sn-num", min: 1, max: 4096, step: 1, value: 4 });
          kl.appendChild(kIn); K.opts.appendChild(kl);
          go.addEventListener("click", K.restart);
          kIn.addEventListener("change", K.restart);
          [inp, kIn].forEach(function (x) { x.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); K.restart(); } }); });
          var svg = X.svg("svg", { viewBox: "0 0 640 164", role: "img" }, K.stage);
          K.out.innerHTML = '<div class="x-lab__stats" data-k="st"></div><p class="x-lab__seq" data-k="msg"></p><div data-k="res"></div><p class="x-lab__seq" data-k="note"></p><div data-k="split"></div>';
          var out = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { out[x.dataset.k] = x; });
          var X0 = 60, CW = 17;
          function xb(i) { return X0 + i * CW + Math.floor(i / 8) * 8; }
          function bit(u, i) { return (u >>> (31 - i)) & 1; }
          function txt(cls, x, y, s) { var n = X.svg("text", { class: cls, x: x, y: y }, svg); n.textContent = s; return n; }
          function dim(x1, x2, y, label, net) {
            var c = net ? " is-net" : "";
            X.svg("path", { class: "x-sn-dim" + c, d: "M" + x1 + "," + (y - 5) + " V" + (y + 5) + " M" + x1 + "," + y + " H" + x2 + " M" + x2 + "," + (y - 5) + " V" + (y + 5) }, svg);
            var w = 10; for (var i = 0; i < label.length; i++) w += label.charCodeAt(i) > 255 ? 12 : 7.4;
            X.svg("rect", { class: "x-sn-dbg", x: (x1 + x2) / 2 - w / 2, y: y - 9, width: w, height: 18 }, svg);
            txt("x-sn-dt" + c, (x1 + x2) / 2, y, label);
          }
          function draw() {
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            if (err) { svg.setAttribute("aria-label", "输入无效"); return; }
            var n = P.n, end = xb(31) + CW, bx = n === 0 ? X0 : n === 32 ? end : n % 8 ? xb(n) : xb(n) - 4;
            if (n > 0) dim(X0, bx, 16, "网络号 " + n + " 位", true);
            if (n < 32) dim(bx, end, 16, "主机号 " + (32 - n) + " 位", false);
            var rows = [["地址", P.ip, 34], ["掩码", C.mask, 64], ["AND", C.net, 104]];
            rows.forEach(function (rw, ri) {
              txt("x-sn-row", 4, rw[2] + 12, rw[0]);
              for (var i = 0; i < 32; i++) {
                if (ri === 2 && i >= pos) { X.svg("rect", { class: "x-sn-b", x: xb(i), y: rw[2], width: CW, height: 24 }, svg); continue; }
                var v = bit(rw[1], i), net = (ri === 0 || ri === 2) && i < n, cls = net ? " is-net" : ri === 1 && v ? " is-one" : "";
                X.svg("rect", { class: "x-sn-b" + cls + (i === pos - 1 ? " is-cur" : ""), x: xb(i), y: rw[2], width: CW, height: 24 }, svg);
                txt("x-sn-t" + (net ? " is-net" : ""), xb(i) + CW / 2, rw[2] + 12, v);
              }
            });
            X.svg("line", { class: "x-sn-dim", x1: X0, y1: 96, x2: end, y2: 96 }, svg);
            if (n > 0 && n < 32) X.svg("line", { class: "x-sn-cut", x1: bx, y1: 28, x2: bx, y2: 134 }, svg);
            for (var o = 0; o < 4; o++) txt("x-sn-dec", xb(o * 8) + 4 * CW, 154, pos >= (o + 1) * 8 ? (C.net >>> (24 - o * 8)) & 255 : "·");
            svg.setAttribute("aria-label", "地址 " + S.bin(P.ip) + " 与掩码 " + S.bin(C.mask) + " 逐位相与，前 " + n + " 位是网络号" + (pos === 32 ? "，结果 " + S.ip(C.net) : ""));
          }
          function render() {
            draw();
            if (err) { out.st.innerHTML = ""; out.msg.innerHTML = '<span class="x-lab__err">' + err + "</span>"; return; }
            out.st.innerHTML = "<span>已算 <b>" + pos + "</b> / 32 位</span><span>前缀 <b>/" + P.n + "</b></span>" + (pos === 32 ? '<span class="x-lab__badge">网络地址 ' + S.ip(C.net) + "</span>" : "");
            if (!pos) out.msg.textContent = "地址与掩码逐位相与（AND）得到网络地址：掩码为 1 的位保留，为 0 的位清零。单步一次算一位。";
            else {
              var i = pos - 1, a = bit(P.ip, i), m = bit(C.mask, i);
              out.msg.textContent = "第 " + pos + " 位（第 " + (Math.floor(i / 8) + 1) + " 字节）：" + a + " AND " + m + " = " + (a & m) + "，" + (i < P.n ? "网络号位，原样保留" : "主机号位，清零") +
                (pos === 32 ? "。完成：网络地址 " + S.ip(C.net) + "/" + P.n + "。" : "。");
            }
          }
          function tables() {
            var row = function (k, d, b) { return '<tr><th scope="row">' + k + "</th><td>" + d + "</td><td>" + b + "</td></tr>"; };
            var fml = P.n <= 30 ? "2^(32−" + P.n + ") − 2 = 2^" + (32 - P.n) + " − 2" : "见下方说明";
            out.res.innerHTML = '<div class="x-tbl"><table><thead><tr><th scope="col">项目</th><th scope="col">点分十进制</th><th scope="col">二进制</th></tr></thead><tbody>' +
              row("网络地址", S.ip(C.net), S.bin(C.net)) + row("广播地址", S.ip(C.bc), S.bin(C.bc)) + row("子网掩码", S.ip(C.mask), S.bin(C.mask)) +
              row("第一个可用主机", S.ip(C.first), S.bin(C.first)) + row("最后一个可用主机", S.ip(C.last), S.bin(C.last)) +
              '<tr class="is-cur"><th scope="row">可用主机数</th><td>' + C.hosts.toLocaleString("en-US") + " 台</td><td>" + fml + "</td></tr></tbody></table></div>";
            out.note.textContent = C.note || ""; out.note.hidden = !C.note;
            var k = Math.round(+kIn.value);
            if (isNaN(k) || k < 1 || k > 4096) { out.split.innerHTML = '<p class="x-lab__seq x-lab__err">等分子网数应为 1–4096 的整数</p>'; return; }
            var D = S.split(P.ip, P.n, k);
            if (D.err) { out.split.innerHTML = '<p class="x-lab__seq x-lab__err">' + D.err + "</p>"; return; }
            var h0 = D.n2 <= 30 ? D.size - 2 : D.n2 === 31 ? 2 : 1;
            var h = '<div class="x-tbl"><table><caption>等分为 ' + k + " 个子网：借 " + D.b + " 位子网号，前缀 /" + D.n2 + "，每个 " + D.size.toLocaleString("en-US") + " 个地址、可用 " + h0.toLocaleString("en-US") + " 台" +
              (D.count !== k ? "（2^" + D.b + " = " + D.count + " 个，多出的留作备用）" : "") + (D.count > 64 ? "；只列前 64 个" : "") +
              '</caption><thead><tr><th scope="col">#</th><th scope="col">子网</th><th scope="col">可用范围</th><th scope="col">广播地址</th></tr></thead><tbody>';
            D.list.forEach(function (c, i) {
              var on = P.ip >= c.net && P.ip <= c.bc;
              h += "<tr" + (on ? ' class="is-cur"' : "") + '><th scope="row">' + (i + 1) + "</th><td>" + S.ip(c.net) + "/" + D.n2 + "</td><td>" + S.ip(c.first) + " – " + S.ip(c.last) + (on ? "（含 " + S.ip(P.ip) + "）" : "") + "</td><td>" + S.ip(c.bc) + "</td></tr>";
            });
            out.split.innerHTML = h + "</tbody></table></div>";
          }
          function reset() {
            P = S.parse(inp.value); err = P.err || null;
            if (err) { pos = 32; out.res.innerHTML = out.split.innerHTML = ""; out.note.hidden = true; render(); return; }
            C = S.calc(P.ip, P.n); pos = 0; tables(); render();
          }
          function step() { if (pos < 32) { pos++; render(); } return pos < 32; }
          reset();
          return { step: step, reset: reset, done: function () { return pos >= 32; } };
        }
      };
      LAB.push(LAB_SN);

      /* demo 11: TCP three-way handshake / four-way teardown */
      var LAB_TW = {
        id: "tcpconn", name: "TCP 三次握手 / 四次挥手", color: "var(--x-cn)", toc: "TCP 握手与挥手",
        note: "SYN、FIN 各消耗一个序号；TIME-WAIT 等 2MSL 防止最后的 ACK 丢失",
        /* st: [side 0 客户端 / 1 服务器, "s" at send time | "r" at receive time | "t" after 2MSL, state] */
        MODES: [
          { name: "握手", h: 284, init: ["CLOSED", "LISTEN"],
            m0: "服务器被动打开，处于 LISTEN；客户端 CLOSED，准备主动打开。客户端 ISN x=100，服务器 ISN y=300。",
            steps: [
              { d: 1, lab: "SYN=1, seq=100", st: [[0, "s", "SYN-SENT"]],
                msg: "① 客户端发 SYN，初始序号 x=100，CLOSED→SYN-SENT；服务器仍在 LISTEN。SYN 不携带数据，但消耗一个序号。" },
              { d: -1, lab: "SYN=1, ACK=1, seq=300, ack=101", st: [[1, "s", "SYN-RCVD"]],
                msg: "② 服务器确认 ack=x+1=101，同时发自己的 SYN，初始序号 y=300，LISTEN→SYN-RCVD。" },
              { d: 1, lab: "ACK=1, seq=101, ack=301", st: [[0, "s", "ESTABLISHED"], [1, "r", "ESTABLISHED"]],
                msg: "③ 客户端 seq=x+1=101，确认 ack=y+1=301，进入 ESTABLISHED；服务器收到后也进入 ESTABLISHED。连接建立。" }
            ] },
          { name: "挥手", h: 404, init: ["ESTABLISHED", "ESTABLISHED"],
            m0: "双方处于 ESTABLISHED，客户端主动关闭。客户端当前序号 u=500，服务器当前序号 v=800。",
            steps: [
              { d: 1, lab: "FIN=1, seq=500", st: [[0, "s", "FIN-WAIT-1"]],
                msg: "① 客户端发 FIN，seq=u=500，进入 FIN-WAIT-1。FIN 不带数据也消耗一个序号。" },
              { d: -1, lab: "ACK=1, seq=800, ack=501", st: [[1, "s", "CLOSE-WAIT"], [0, "r", "FIN-WAIT-2"]],
                msg: "② 服务器确认 ack=u+1=501，seq=v=800，进入 CLOSE-WAIT；客户端收到后进入 FIN-WAIT-2。连接半关闭，服务器仍可发数据。" },
              { d: -1, lab: "FIN=1, ACK=1, seq=w, ack=501", st: [[1, "s", "LAST-ACK"]],
                msg: "③ 服务器数据发完，发 FIN，seq=w（半关闭期间可能又发过数据，所以记作 w），ack 仍为 501，进入 LAST-ACK。" },
              { d: 1, lab: "ACK=1, seq=501, ack=w+1", st: [[0, "s", "TIME-WAIT"], [1, "r", "CLOSED"], [0, "t", "CLOSED"]], tw: true,
                msg: "④ 客户端 seq=u+1=501，确认 ack=w+1，进入 TIME-WAIT，等待 2MSL 后 CLOSED；服务器收到 ACK 立即 CLOSED。" }
            ] }
        ],
        mount: function (panel, K) {
          var S = LAB_TW, mode = S.MODES[0], pos;
          var XS = [170, 470], Y0 = 96, GAP = 62, D = 40, NUM = "①②③④";
          var btns = S.MODES.map(function (m) {
            var b = X.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": m === mode ? "true" : "false" }, m.name);
            b.addEventListener("click", function () { mode = m; btns.forEach(function (x, i) { x.setAttribute("aria-pressed", S.MODES[i] === m ? "true" : "false"); }); K.restart(); });
            K.opts.appendChild(b); return b;
          });
          var svg = X.svg("svg", { role: "img" }, K.stage);
          K.out.innerHTML = '<div class="x-lab__stats" data-k="st"></div><p class="x-lab__seq" data-k="msg"></p>';
          var out = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { out[x.dataset.k] = x; });
          function txt(cls, x, y, s, anchor) { var n = X.svg("text", { class: cls, x: x, y: y }, svg); if (anchor) n.setAttribute("text-anchor", anchor); n.textContent = s; return n; }
          function tw(s) { var w = 0; for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 255 ? 13 : 7.3; return w; }
          function events() {
            var ev = [[0, 78, mode.init[0], 0], [1, 78, mode.init[1], 0]];
            mode.steps.forEach(function (s, i) {
              var y0 = Y0 + i * GAP;
              s.st.forEach(function (e) { ev.push([e[0], e[1] === "s" ? y0 : e[1] === "r" ? y0 + D : y0 + 100, e[2], i + 1]); });
            });
            return ev.filter(function (e) { return e[3] <= pos; });
          }
          function draw() {
            while (svg.firstChild) svg.removeChild(svg.firstChild);
            var H = mode.h, ev = events(), cur = [mode.init[0], mode.init[1]], isNew = [false, false];
            ev.forEach(function (e) { cur[e[0]] = e[2]; if (e[3] === pos && pos > 0) isNew[e[0]] = true; });
            svg.setAttribute("viewBox", "0 0 640 " + H);
            var defs = X.svg("defs", {}, svg);
            ["old", "cur"].forEach(function (k) {
              var m = X.svg("marker", { id: "x-tw-" + k, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 10, markerHeight: 10, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
              X.svg("path", { d: "M0,0 L10,5 L0,10 z", class: "x-tw-ah" + (k === "cur" ? " is-cur" : "") }, m);
            });
            ["客户端", "服务器"].forEach(function (who, k) {
              var x = XS[k];
              txt("x-tw-who", x, 18, who);
              X.svg("rect", { class: "x-tw-box" + (isNew[k] ? " is-new" : ""), x: x - 62, y: 28, width: 124, height: 24 }, svg);
              txt("x-tw-boxt" + (isNew[k] ? " is-new" : ""), x, 40, cur[k]);
              X.svg("line", { class: "x-tw-tl", x1: x, y1: 60, x2: x, y2: H - 8 }, svg);
            });
            for (var i = 0; i < pos; i++) {
              var s = mode.steps[i], y0 = Y0 + i * GAP, on = i === pos - 1, x1 = XS[s.d > 0 ? 0 : 1], x2 = XS[s.d > 0 ? 1 : 0];
              X.svg("line", { class: "x-tw-ar" + (on ? " is-cur" : ""), x1: x1, y1: y0, x2: x2, y2: y0 + D, "marker-end": "url(#x-tw-" + (on ? "cur" : "old") + ")" }, svg);
              var lab = NUM.charAt(i) + " " + s.lab, w = tw(lab) + 12;
              X.svg("rect", { class: "x-tw-lbg", x: 320 - w / 2, y: y0 + D / 2 - 10, width: w, height: 20 }, svg);
              txt("x-tw-lab" + (on ? " is-cur" : ""), 320, y0 + D / 2, lab);
              if (s.tw) {
                X.svg("path", { class: "x-tw-msl", d: "M178," + (y0 + 12) + " H190 M184," + (y0 + 12) + " V" + (y0 + 100) + " M178," + (y0 + 100) + " H190" }, svg);
                txt("x-tw-mslt", 194, y0 + 56, "等待 2MSL", "start");
              }
            }
            ev.forEach(function (e) {
              var x = XS[e[0]], now = e[3] === pos && pos > 0;
              X.svg("circle", { class: "x-tw-dot" + (now ? " is-now" : ""), cx: x, cy: e[1], r: 4 }, svg);
              txt("x-tw-st" + (now ? " is-now" : ""), e[0] ? x + 10 : x - 10, e[1], e[2], e[0] ? "start" : "end");
            });
            svg.setAttribute("aria-label", "TCP " + mode.name + "时序图：已发 " + pos + " / " + mode.steps.length + " 个报文段，客户端 " + cur[0] + "，服务器 " + cur[1]);
            return cur;
          }
          function render() {
            var cur = draw();
            out.st.innerHTML = "<span>报文段 <b>" + pos + "</b> / " + mode.steps.length + "</span><span>客户端 <b>" + cur[0] + "</b></span><span>服务器 <b>" + cur[1] + "</b></span>";
            out.msg.textContent = pos ? mode.steps[pos - 1].msg : mode.m0;
          }
          function reset() { pos = 0; render(); }
          function step() { if (pos < mode.steps.length) { pos++; render(); } return pos < mode.steps.length; }
          reset();
          return { step: step, reset: reset, done: function () { return pos >= mode.steps.length; } };
        }
      };
      LAB.push(LAB_TW);
    
