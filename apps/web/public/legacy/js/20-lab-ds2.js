/* 数据结构动画实验 · 图（4 个）：图的遍历 DFS / BFS、最小生成树 Prim / Kruskal、拓扑排序与关键路径、Floyd 最短路径。
   沿用 08-lab.js 的实验壳：LAB.push({ id, name, color, note, mount: function (panel, K) { ... return { step, reset, done }; } })
   纯计算函数挂在 window.LABU 上并以 ds 前缀命名（dsParseVerts / dsParseEdges / dsAdj / dsDfs / dsBfs / dsPrim / dsKruskal /
   dsTopo / dsCritical / dsFloyd / dsFloydPath / dsConnected），由 src/legacy/labds2.test.ts 做单元测试。
   约定：mount 之外不访问 document / X，保证脚本能在 node:vm 沙箱里加载。类名前缀 x-d2-。 */
(function () {
  var LAB = window.LAB = window.LAB || [];
  var LABU = window.LABU = window.LABU || {};
  var DS = "var(--x-ds)";
  var INF = 1 / 0;
  var MAXV = 10, MAXE = 30;

  /* ================= 通用小工具 ================= */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function E(msg) { return { err: msg }; }
  function fill(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(v); return a; }
  function mat(n, v) { var a = []; for (var i = 0; i < n; i++) a.push(fill(n, v)); return a; }
  function copyM(m) { return m.map(function (r) { return r.slice(); }); }
  /* 数值显示：∞、负号写成 “−” */
  function wf(v) { return v === INF ? "∞" : v === -INF ? "−∞" : String(v).replace(/^-/, "−"); }
  function pw(v) { return v < 0 ? "(" + wf(v) + ")" : wf(v); }
  LABU.dsFmt = wf;

  /* ================= 输入解析 ================= */
  var VNAME = /^[A-Za-z0-9]{1,3}$/;
  /* 顶点表：空格 / 逗号分隔，或区间 “1-8”、“A-F”。空串得 { V: null }（由边表推断） */
  LABU.dsParseVerts = function (s) {
    var t = String(s == null ? "" : s).trim();
    if (!t) return { V: null };
    var V = [], m = /^([0-9]{1,2})\s*[-~～—]\s*([0-9]{1,2})$/.exec(t), m2 = /^([A-Za-z])\s*[-~～—]\s*([A-Za-z])$/.exec(t), i;
    if (m) {
      var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      if (b < a) return E("顶点区间 “" + t + "” 写反了，应从小到大，例如 1-8");
      for (i = a; i <= b; i++) V.push(String(i));
    } else if (m2) {
      var c1 = m2[1].charCodeAt(0), c2 = m2[2].charCodeAt(0);
      if (c2 < c1) return E("顶点区间 “" + t + "” 写反了，应从小到大，例如 A-F");
      for (i = c1; i <= c2; i++) V.push(String.fromCharCode(i));
    } else {
      var parts = t.split(/[\s,，、;；]+/);
      for (i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        if (!VNAME.test(parts[i])) return E("顶点名 “" + parts[i] + "” 不合法：只能用 1–3 位字母或数字");
        if (V.indexOf(parts[i]) >= 0) return E("顶点 “" + parts[i] + "” 重复了");
        V.push(parts[i]);
      }
    }
    if (V.length < 2) return E("至少需要 2 个顶点");
    if (V.length > MAXV) return E("顶点太多：最多 " + MAXV + " 个（考试一般 6–8 个）");
    return { V: V };
  };

  /* 边表：“1-2:6, 1-3:1, …”，也认 “1->2”“1→2”；权值写在冒号后。
     o = { directed, weighted（true 必须有权值）, allowNeg（允许负权）}
     返回 { n, V, E: [{ u, v, w, s }], directed } 或 { err } */
  LABU.dsParseEdges = function (vs, es, o) {
    o = o || {};
    var pv = LABU.dsParseVerts(vs);
    if (pv.err) return pv;
    var txt = String(es == null ? "" : es).replace(/[−–]/g, "-").replace(/：/g, ":");
    var toks = txt.split(/[,，、;；\n\r]+/), raw = [], i;
    for (i = 0; i < toks.length; i++) {
      var tk = toks[i].replace(/\s+/g, "");
      if (!tk) continue;
      var m = /^[<(]?([A-Za-z0-9]{1,3})(->|→|-|—)([A-Za-z0-9]{1,3})[>)]?(?:[:=](-?\d+(?:\.\d+)?))?$/.exec(tk);
      if (!m) return E("无法识别 “" + toks[i].trim() + "”：边的格式是 起点-终点:权值，例如 1-2:6（多条边用逗号或换行分隔）");
      raw.push({ a: m[1], b: m[3], w: m[4], s: toks[i].trim() });
    }
    if (!raw.length) return E("边表为空：请按 “1-2:6, 1-3:1” 的格式输入");
    if (raw.length > MAXE) return E("边太多：最多 " + MAXE + " 条");
    var V = pv.V;
    if (!V) {
      V = [];
      raw.forEach(function (r) { if (V.indexOf(r.a) < 0) V.push(r.a); if (V.indexOf(r.b) < 0) V.push(r.b); });
      var allNum = V.every(function (x) { return /^\d+$/.test(x); });
      V.sort(function (x, y) { return allNum ? +x - +y : (x < y ? -1 : x > y ? 1 : 0); });
      if (V.length > MAXV) return E("顶点太多：最多 " + MAXV + " 个（考试一般 6–8 个）");
    }
    var idx = {};
    V.forEach(function (x, j) { idx[x] = j; });
    var Es = [], seen = {}, dir = !!o.directed, arrow = dir ? "→" : "-";
    for (i = 0; i < raw.length; i++) {
      var r = raw[i], nm = r.a + arrow + r.b;
      if (!(r.a in idx)) return E("边 “" + r.s + "” 中的顶点 " + r.a + " 不存在（顶点：" + V.join(" ") + "）");
      if (!(r.b in idx)) return E("边 “" + r.s + "” 中的顶点 " + r.b + " 不存在（顶点：" + V.join(" ") + "）");
      if (r.a === r.b) return E("边 “" + r.s + "” 是自环：408 考的简单图不允许自环");
      var u = idx[r.a], v = idx[r.b], key = dir ? u + ">" + v : Math.min(u, v) + "-" + Math.max(u, v);
      if (key in seen) return E((dir ? "有向边 “" : "边 “") + nm + "” 与前面的 “" + seen[key] + "” 重复" + (dir ? "" : "（无向图中 1-2 与 2-1 是同一条边）"));
      seen[key] = nm;
      var w = null;
      if (r.w != null) {
        if (!/^-?\d+$/.test(r.w)) return E("边 “" + r.s + "” 的权值请用整数");
        w = parseInt(r.w, 10);
        if (Math.abs(w) > 999) return E("边 “" + r.s + "” 的权值请在 −999 到 999 之间");
        if (w < 0 && !o.allowNeg) return E("边 “" + r.s + "” 的权值为负：本实验要求非负权值");
      } else if (o.weighted) return E("边 “" + r.s + "” 缺少权值（写成 " + r.a + "-" + r.b + ":6 这样）");
      Es.push({ u: u, v: v, w: w == null ? 1 : w, s: nm, hasW: w != null });
    }
    return { n: V.length, V: V, E: Es, directed: dir };
  };

  /* 邻接表：ord = "num"（邻接点按顶点编号从小到大，默认）或 "input"（按边表输入顺序，尾插法建表） */
  LABU.dsAdj = function (g, ord) {
    var adj = [], i;
    for (i = 0; i < g.n; i++) adj.push([]);
    g.E.forEach(function (e, k) {
      adj[e.u].push({ v: e.v, w: e.w, k: k });
      if (!g.directed) adj[e.v].push({ v: e.u, w: e.w, k: k });
    });
    if (ord !== "input") adj.forEach(function (l) { l.sort(function (a, b) { return a.v - b.v; }); });
    return adj;
  };
  /* 无向连通性（有向图按基础无向图判断） */
  LABU.dsConnected = function (g) {
    var adj = LABU.dsAdj({ n: g.n, E: g.E, directed: false }), vis = fill(g.n, false), st = [0], c = 0;
    vis[0] = true;
    while (st.length) { var v = st.pop(); c++; adj[v].forEach(function (a) { if (!vis[a.v]) { vis[a.v] = true; st.push(a.v); } }); }
    return c === g.n;
  };
  function vname(g, i) { return g.V[i]; }
  function ename(g, k) { var e = g.E[k]; return g.directed ? "<" + g.V[e.u] + "," + g.V[e.v] + ">" : "(" + g.V[e.u] + "," + g.V[e.v] + ")"; }

  /* ================= DFS ================= */
  LABU.dsDfs = function (g, s, ord) {
    var n = g.n, adj = LABU.dsAdj(g, ord), vis = fill(n, false), order = [], tree = [], stack = [], frames = [], roots = [];
    s = s || 0;
    function snap(t, cur, k, d) { frames.push({ t: t, cur: cur, k: k, d: d, stack: stack.slice(), vis: vis.slice(), order: order.slice(), tree: tree.slice() }); }
    function nm(i) { return vname(g, i); }
    snap("init", -1, -1, "初始化：visited[] 全为 false，从顶点 " + nm(s) + " 出发做深度优先搜索（递归，用栈保存回溯路径）。");
    function dfs(v, p, k, again) {
      vis[v] = true; order.push(v); stack.push(v);
      if (p >= 0) tree.push([p, v, k]); else roots.push(v);
      snap("visit", v, k, p < 0
        ? (again ? "从 " + nm(s) + " 出发能到达的顶点都已访问，图" + (g.directed ? "不是强连通的" : "不连通") + "，从编号最小的未访问顶点 " + nm(v) + " 再调用一次 DFS：" : "") +
          "访问 " + nm(v) + "，visited[" + nm(v) + "] = true，" + nm(v) + " 入栈。"
        : "检查 " + nm(p) + " 的邻接点 " + nm(v) + "：未访问，沿边 " + ename(g, k) + " 深入，访问 " + nm(v) + " 并入栈，这条边成为深度优先生成树的边。");
      adj[v].forEach(function (a) {
        if (vis[a.v]) { snap("skip", v, a.k, "检查 " + nm(v) + " 的邻接点 " + nm(a.v) + "：visited[" + nm(a.v) + "] = true，已访问，跳过。"); return; }
        dfs(a.v, v, a.k, false);
      });
      stack.pop();
      snap("back", v, -1, nm(v) + " 的邻接点都已检查完，" + nm(v) + " 出栈" + (stack.length ? "，回溯到 " + nm(stack[stack.length - 1]) + "。" : "，栈空，本次 DFS 结束。"));
    }
    dfs(s, -1, -1, false);
    for (var i = 0; i < n; i++) if (!vis[i]) dfs(i, -1, -1, true);
    snap("end", -1, -1, "遍历结束：DFS 序列为 " + order.map(nm).join(" ") + "，粗边构成深度优先生成" + (roots.length > 1 ? "森林（" + roots.length + " 棵树）" : "树") + "。");
    return { order: order, tree: tree, roots: roots, frames: frames };
  };

  /* ================= BFS ================= */
  LABU.dsBfs = function (g, s, ord) {
    var n = g.n, adj = LABU.dsAdj(g, ord), vis = fill(n, false), order = [], tree = [], q = [], frames = [], roots = [];
    s = s || 0;
    function snap(t, cur, at, k, d) { frames.push({ t: t, cur: cur, at: at, k: k, d: d, queue: q.slice(), vis: vis.slice(), order: order.slice(), tree: tree.slice() }); }
    function nm(i) { return vname(g, i); }
    snap("init", -1, -1, -1, "初始化：visited[] 全为 false，队列为空，从顶点 " + nm(s) + " 出发做广度优先搜索。");
    function bfs(s0, again) {
      vis[s0] = true; order.push(s0); q.push(s0); roots.push(s0);
      snap("visit", s0, -1, -1, (again ? "从 " + nm(s) + " 出发能到达的顶点都已访问，图" + (g.directed ? "不是强连通的" : "不连通") + "，从编号最小的未访问顶点 " + nm(s0) + " 再做一次 BFS：" : "") +
        "访问 " + nm(s0) + "，visited[" + nm(s0) + "] = true，" + nm(s0) + " 入队。");
      while (q.length) {
        var v = q.shift();
        snap("deq", v, v, -1, "队头 " + nm(v) + " 出队，按邻接表顺序检查它的邻接点" + (adj[v].length ? "（" + adj[v].map(function (a) { return nm(a.v); }).join(" ") + "）。" : "：它没有邻接点。"));
        adj[v].forEach(function (a) {
          if (vis[a.v]) { snap("skip", v, v, a.k, "检查 " + nm(v) + " 的邻接点 " + nm(a.v) + "：已访问，跳过。"); return; }
          vis[a.v] = true; order.push(a.v); q.push(a.v); tree.push([v, a.v, a.k]);
          snap("visit", a.v, v, a.k, "检查 " + nm(v) + " 的邻接点 " + nm(a.v) + "：未访问，访问它并入队，边 " + ename(g, a.k) + " 成为广度优先生成树的边。");
        });
      }
    }
    bfs(s, false);
    for (var i = 0; i < n; i++) if (!vis[i]) bfs(i, true);
    snap("end", -1, -1, -1, "遍历结束：BFS 序列为 " + order.map(nm).join(" ") + "，粗边构成广度优先生成" + (roots.length > 1 ? "森林（" + roots.length + " 棵树）" : "树") + "。");
    return { order: order, tree: tree, roots: roots, frames: frames };
  };

  /* ================= Prim ================= */
  function weightM(g) {
    var W = mat(g.n, INF), Kx = mat(g.n, -1);
    g.E.forEach(function (e, k) { W[e.u][e.v] = e.w; Kx[e.u][e.v] = k; if (!g.directed) { W[e.v][e.u] = e.w; Kx[e.v][e.u] = k; } });
    return { W: W, K: Kx };
  }
  LABU.dsPrim = function (g, s) {
    var n = g.n, M = weightM(g), W = M.W, inT = fill(n, false), low = fill(n, INF), adjv = fill(n, -1), edges = [], total = 0, frames = [], join = [], i;
    s = s || 0;
    function nm(x) { return vname(g, x); }
    function snap(t, cur, k, ch, d) { frames.push({ t: t, cur: cur, k: k, ch: ch || [], d: d, low: low.slice(), adjv: adjv.slice(), inT: inT.slice(), tree: edges.map(function (e) { return e[3]; }), total: total }); }
    inT[s] = true; low[s] = 0; join.push(s);
    for (i = 0; i < n; i++) if (i !== s && W[s][i] < INF) { low[i] = W[s][i]; adjv[i] = s; }
    snap("init", s, -1, [], "从顶点 " + nm(s) + " 出发，" + nm(s) + " 加入生成树；lowcost[i] 取边 (" + nm(s) + ",i) 的权值，没有边记 ∞，adjvex[i] 记下这条边在树中的端点 " + nm(s) + "。");
    for (var step = 1; step < n; step++) {
      var j = -1;
      for (i = 0; i < n; i++) if (!inT[i] && (j < 0 || low[i] < low[j])) j = i;
      if (low[j] === INF) {
        var rest = []; for (i = 0; i < n; i++) if (!inT[i]) rest.push(nm(i));
        return { err: "图不连通：顶点 " + rest.join("、") + " 无法与生成树相连，不存在最小生成树（只能求最小生成森林）。", frames: frames };
      }
      inT[j] = true; join.push(j);
      var k = M.K[adjv[j]][j];
      edges.push([adjv[j], j, low[j], k]); total += low[j];
      snap("pick", j, k, [], "第 " + step + " 步：未加入的顶点中 lowcost 最小的是 " + nm(j) + "（lowcost = " + wf(low[j]) + "），把边 (" + nm(adjv[j]) + "," + nm(j) + ") 加入生成树，" + nm(j) + " 并入树中。");
      var ch = [];
      for (i = 0; i < n; i++) if (!inT[i] && W[j][i] < low[i]) { ch.push([i, low[i], W[j][i]]); low[i] = W[j][i]; adjv[i] = j; }
      if (step < n - 1) snap("upd", j, -1, ch, ch.length
        ? "用新加入的 " + nm(j) + " 更新 lowcost：" + ch.map(function (c) { return "lowcost[" + nm(c[0]) + "] 由 " + wf(c[1]) + " 变为 " + wf(c[2]) + "（adjvex = " + nm(j) + "）"; }).join("，") + "。"
        : "用新加入的 " + nm(j) + " 检查未加入的顶点：没有比原 lowcost 更小的边，lowcost 不变。");
    }
    snap("end", -1, -1, [], "Prim 结束：共加入 " + (n - 1) + " 条边，加边顺序 " + edges.map(function (e) { return "(" + nm(e[0]) + "," + nm(e[1]) + ")"; }).join(" ") + "，最小生成树权值和 = " + wf(total) + "。");
    return { edges: edges, total: total, join: join, frames: frames };
  };

  /* ================= Kruskal（并查集判回路） ================= */
  LABU.dsKruskal = function (g) {
    var n = g.n, parent = fill(n, -1), edges = [], total = 0, frames = [];
    var sorted = g.E.map(function (e, k) { return k; }).sort(function (a, b) { return (g.E[a].w - g.E[b].w) || (a - b); });
    function nm(x) { return vname(g, x); }
    function find(x) { while (parent[x] >= 0) x = parent[x]; return x; }
    function snap(t, k, pos, d) { frames.push({ t: t, k: k, pos: pos, d: d, parent: parent.slice(), tree: edges.map(function (e) { return e[3]; }), rej: rej.slice(), total: total }); }
    var rej = [];
    snap("init", -1, -1, "把 " + g.E.length + " 条边按权值从小到大排序（权值相同按输入顺序）；parent[] 全为 −1，每个顶点自成一个连通分量。");
    for (var p = 0; p < sorted.length && edges.length < n - 1; p++) {
      var k = sorted[p], e = g.E[k], ru = find(e.u), rv = find(e.v), en = "(" + nm(e.u) + "," + nm(e.v) + ")";
      if (ru !== rv) {
        parent[rv] = ru; edges.push([e.u, e.v, e.w, k]); total += e.w;
        snap("take", k, p, "取第 " + (p + 1) + " 小的边 " + en + "，权 " + wf(e.w) + "：Find(" + nm(e.u) + ") = " + nm(ru) + "，Find(" + nm(e.v) + ") = " + nm(rv) + "，不在同一连通分量，加入生成树并 Union（parent[" + nm(rv) + "] = " + nm(ru) + "）。");
      } else {
        rej.push(k);
        snap("skip", k, p, "取第 " + (p + 1) + " 小的边 " + en + "，权 " + wf(e.w) + "：Find(" + nm(e.u) + ") = Find(" + nm(e.v) + ") = " + nm(ru) + "，两端已经连通，加入会构成回路，舍弃。");
      }
    }
    if (edges.length < n - 1) return { err: "图不连通：所有边都检查完只选出 " + edges.length + " 条边（需要 " + (n - 1) + " 条），不存在最小生成树。", frames: frames };
    var left = sorted.length - p;
    snap("end", -1, p, "Kruskal 结束：已选够 " + (n - 1) + " 条边" + (left ? "，剩下 " + left + " 条边不必再看" : "") + "；加边顺序 " + edges.map(function (x) { return "(" + nm(x[0]) + "," + nm(x[1]) + ")"; }).join(" ") + "，权值和 = " + wf(total) + "。");
    return { edges: edges, total: total, sorted: sorted, frames: frames };
  };

  /* ================= 拓扑排序 ================= */
  LABU.dsTopo = function (g, useQueue) {
    var n = g.n, adj = LABU.dsAdj({ n: n, E: g.E, directed: true }), indeg = fill(n, 0), box = [], order = [], out = fill(n, false), frames = [], i;
    var C = useQueue ? "队列" : "栈", IN = useQueue ? "入队" : "入栈";
    function nm(x) { return vname(g, x); }
    function snap(t, cur, ks, d) { frames.push({ t: t, cur: cur, ks: ks || [], d: d, indeg: indeg.slice(), box: box.slice(), order: order.slice(), out: out.slice() }); }
    g.E.forEach(function (e) { indeg[e.v]++; });
    for (i = 0; i < n; i++) if (!indeg[i]) box.push(i);
    snap("init", -1, [], "统计各顶点的入度；入度为 0 的顶点 " + (box.length ? box.map(nm).join("、") + " 依次" + IN : "一个也没有") + "（用" + C + "保存，" + (useQueue ? "先进先出" : "后进先出") + "）。");
    while (box.length) {
      var v = useQueue ? box.shift() : box.pop(), dec = [], ks = [];
      order.push(v); out[v] = true;
      adj[v].forEach(function (a) { indeg[a.v]--; ks.push(a.k); dec.push(a.v); if (!indeg[a.v]) box.push(a.v); });
      snap("out", v, ks, (useQueue ? "队头 " : "栈顶 ") + nm(v) + " 出" + (useQueue ? "队" : "栈") + "并输出（第 " + order.length + " 个）；" +
        (dec.length ? "删去它的出边：" + dec.map(function (w) { return "indeg[" + nm(w) + "] 减为 " + indeg[w] + (indeg[w] ? "" : "，" + IN); }).join("；") + "。" : "它没有出边。"));
    }
    var rest = [];
    for (i = 0; i < n; i++) if (!out[i]) rest.push(i);
    if (rest.length) snap("cycle", -1, [], C + "已空，但还有 " + rest.length + " 个顶点（" + rest.map(nm).join("、") + "）未输出且入度都不为 0：图中存在回路，不存在拓扑序列。");
    else snap("end", -1, [], "全部 " + n + " 个顶点已输出，拓扑序列为 " + order.map(nm).join(" ") + "（用" + (useQueue ? "栈" : "队列") + "可能得到另一个同样正确的序列）。");
    return { order: order, cycle: rest.length > 0, rest: rest, frames: frames };
  };

  /* ================= 关键路径（AOE 网） ================= */
  LABU.dsCritical = function (g, useQueue) {
    var n = g.n, t = LABU.dsTopo(g, useQueue), i;
    function nm(x) { return vname(g, x); }
    if (t.cycle) return { err: "存在回路（顶点 " + t.rest.map(nm).join("、") + " 无法输出）：AOE 网必须是有向无环图，不能求关键路径。", topo: t };
    var indeg = fill(n, 0), outd = fill(n, 0);
    g.E.forEach(function (e) { indeg[e.v]++; outd[e.u]++; });
    var src = [], snk = [];
    for (i = 0; i < n; i++) { if (!indeg[i]) src.push(i); if (!outd[i]) snk.push(i); }
    if (src.length !== 1) return { err: "AOE 网只能有一个源点（入度为 0 的顶点），现在有 " + src.length + " 个：" + src.map(nm).join("、") + "。", topo: t };
    if (snk.length !== 1) return { err: "AOE 网只能有一个汇点（出度为 0 的顶点），现在有 " + snk.length + " 个：" + snk.map(nm).join("、") + "。", topo: t };
    var S = src[0], T = snk[0], ve = fill(n, null), vl = fill(n, null), acts = [], frames = [], order = t.order;
    function an(k) { return "a" + (k + 1); }
    function snap(ph, cur, ks, d) { frames.push({ ph: ph, cur: cur, ks: ks || [], d: d, ve: ve.slice(), vl: vl.slice(), acts: acts.slice() }); }
    snap("topo", -1, [], "先求拓扑序列：" + order.map(nm).join(" ") + "；源点 " + nm(S) + "，汇点 " + nm(T) + "。下面按拓扑序求 ve，按逆拓扑序求 vl。");
    order.forEach(function (v) {
      var ins = [];
      g.E.forEach(function (e, k) { if (e.v === v) ins.push(k); });
      if (!ins.length) { ve[v] = 0; snap("ve", v, [], "ve(" + nm(v) + ") = 0：源点的最早发生时间为 0。"); return; }
      var terms = ins.map(function (k) { return ve[g.E[k].u] + g.E[k].w; }), mx = Math.max.apply(null, terms);
      ve[v] = mx;
      snap("ve", v, ins, "ve(" + nm(v) + ") = max{" + ins.map(function (k) { return "ve(" + nm(g.E[k].u) + ")+" + wf(g.E[k].w); }).join(", ") + "}" +
        (ins.length > 1 ? " = max{" + terms.map(wf).join(", ") + "}" : "") + " = " + wf(mx) + "：所有指向它的活动都完成，事件 " + nm(v) + " 才能发生。");
    });
    order.slice().reverse().forEach(function (v) {
      var outs = [];
      g.E.forEach(function (e, k) { if (e.u === v) outs.push(k); });
      if (!outs.length) { vl[v] = ve[v]; snap("vl", v, [], "vl(" + nm(v) + ") = ve(" + nm(v) + ") = " + wf(ve[v]) + "：汇点的最迟发生时间等于它的最早发生时间。"); return; }
      var terms = outs.map(function (k) { return vl[g.E[k].v] - g.E[k].w; }), mn = Math.min.apply(null, terms);
      vl[v] = mn;
      snap("vl", v, outs, "vl(" + nm(v) + ") = min{" + outs.map(function (k) { return "vl(" + nm(g.E[k].v) + ")−" + pw(g.E[k].w); }).join(", ") + "}" +
        (outs.length > 1 ? " = min{" + terms.map(wf).join(", ") + "}" : "") + " = " + wf(mn) + "：不推迟整个工程的前提下，事件 " + nm(v) + " 最晚的发生时间。");
    });
    g.E.forEach(function (e, k) {
      var ee = ve[e.u], ll = vl[e.v] - e.w;
      acts.push({ k: k, u: e.u, v: e.v, w: e.w, e: ee, l: ll, d: ll - ee });
      snap("act", -1, [k], "活动 " + an(k) + " = <" + nm(e.u) + "," + nm(e.v) + ">（持续 " + wf(e.w) + "）：e = ve(" + nm(e.u) + ") = " + wf(ee) + "，l = vl(" + nm(e.v) + ") − " + pw(e.w) + " = " + wf(ll) +
        "，l − e = " + wf(ll - ee) + (ll === ee ? "，是关键活动。" : "，可以拖延 " + wf(ll - ee) + "。"));
    });
    var crit = acts.filter(function (a) { return a.d === 0; }).map(function (a) { return a.k; });
    /* 枚举关键路径（只走关键活动，最多 8 条） */
    var paths = [];
    (function walk(v, p) {
      if (paths.length >= 8) return;
      if (v === T) { paths.push(p.slice()); return; }
      crit.forEach(function (k) { if (g.E[k].u === v) { p.push(g.E[k].v); walk(g.E[k].v, p); p.pop(); } });
    })(S, [S]);
    var res = { order: order, ve: ve, vl: vl, acts: acts, crit: crit, paths: paths, len: ve[T], src: S, sink: T, frames: frames };
    snap("end", -1, crit, "关键活动（l − e = 0）：" + crit.map(an).join("、") + "；关键路径" + (paths.length > 1 ? "有 " + paths.length + " 条：" : "：") +
      paths.map(function (p) { return p.map(nm).join("→"); }).join("，") + "，长度 = ve(" + nm(T) + ") = " + wf(ve[T]) + "，即完成整个工程的最短时间。");
    return res;
  };

  /* ================= Floyd ================= */
  LABU.dsFloyd = function (g) {
    var n = g.n, A = mat(n, INF), path = mat(n, -1), frames = [], i, j, k;
    function nm(x) { return vname(g, x); }
    for (i = 0; i < n; i++) A[i][i] = 0;
    g.E.forEach(function (e) { A[e.u][e.v] = e.w; if (!g.directed) A[e.v][e.u] = e.w; });
    frames.push({ k: -1, A: copyM(A), path: copyM(path), ch: [], d: "初始化 A(−1)：A[i][j] 为边 <i,j> 的权值，无边记 ∞，对角线为 0；path[i][j] 全为 −1（表示 i 到 j 没有中间顶点）。" });
    for (k = 0; k < n; k++) {
      var ch = [];
      for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
        if (A[i][k] === INF || A[k][j] === INF) continue;
        var nv = A[i][k] + A[k][j];
        if (nv < A[i][j]) { ch.push([i, j, A[i][j], nv, A[i][k], A[k][j]]); A[i][j] = nv; path[i][j] = k; }
      }
      frames.push({ k: k, A: copyM(A), path: copyM(path), ch: ch, d: ch.length
        ? "第 " + (k + 1) + " 轮，以 " + nm(k) + " 为中间顶点：有 " + ch.length + " 个格子满足 A[i][" + nm(k) + "] + A[" + nm(k) + "][j] < A[i][j]，更新距离并令 path[i][j] = " + k + "（见下方更新依据）。"
        : "第 " + (k + 1) + " 轮，以 " + nm(k) + " 为中间顶点：没有任何一对 i、j 满足 A[i][" + nm(k) + "] + A[" + nm(k) + "][j] < A[i][j]，A(" + k + ") 与上一轮相同。" });
    }
    var neg = [];
    for (i = 0; i < n; i++) if (A[i][i] < 0) neg.push(i);
    if (neg.length) return { err: "存在负权回路（经过 " + neg.map(nm).join("、") + "，A[i][i] < 0）：最短路径不存在，Floyd 不适用。", frames: frames, A: A, path: path };
    return { A: A, path: path, frames: frames };
  };
  /* 由 path 矩阵递归还原 i→j 的路径（顶点下标数组）；不可达返回 [] */
  LABU.dsFloydPath = function (A, path, i, j) {
    if (A[i][j] === INF) return [];
    if (i === j) return [i];
    var guard = 0;
    function rec(a, b) {
      if (++guard > 400) return [a, b];
      var k = path[a][b];
      if (k < 0) return [a, b];
      return rec(a, k).concat(rec(k, b).slice(1));
    }
    return rec(i, j);
  };

  /* ================= 界面小工具（只在 mount 里调用） ================= */
  function outs(K, keys) {
    var h = "";
    keys.forEach(function (k) {
      if (k === "st") h += '<div class="x-lab__stats" data-k="st"></div>';
      else if (k === "msg") h += '<p class="x-lab__seq x-d2-msg" data-k="msg" aria-live="polite"></p>';
      else h += '<div class="x-d2-' + k + '" data-k="' + k + '"></div>';
    });
    K.out.innerHTML = h;
    var o = {};
    K.out.querySelectorAll("[data-k]").forEach(function (x) { o[x.getAttribute("data-k")] = x; });
    return o;
  }
  function field(K, label, val, size) {
    var l = X.el("label", { class: "x-lab__lbl x-d2-f" }, esc(label) + " ");
    var inp = X.el("input", { type: "text", class: "x-lab__sel x-d2-in x-d2-in--" + (size || "s"), value: val, spellcheck: "false", autocomplete: "off", autocapitalize: "off", "aria-label": label });
    inp.addEventListener("change", function () { K.restart(); });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); K.restart(); } });
    l.appendChild(inp); K.opts.appendChild(l);
    return inp;
  }
  function area(K, label, val) {
    var l = X.el("label", { class: "x-lab__lbl x-d2-f x-d2-f--ta" }, esc(label));
    var ta = X.el("textarea", { class: "x-d2-ta", rows: 3, spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-label": label });
    ta.value = val;
    ta.addEventListener("change", function () { K.restart(); });
    l.appendChild(ta); K.opts.appendChild(l);
    return ta;
  }
  function br(K) { K.opts.appendChild(X.el("span", { class: "x-lab__br" })); }
  function tag(K, s) { K.opts.appendChild(X.el("span", { class: "x-lab__lbl x-d2-tag" }, esc(s))); }
  function group(K, items, cur, onPick) {
    var btns = items.map(function (it) {
      var b = X.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": it[0] === cur ? "true" : "false" }, esc(it[1]));
      b.addEventListener("click", function () { set(it[0]); onPick(it[0]); });
      K.opts.appendChild(b); return b;
    });
    function set(id) { btns.forEach(function (b, i) { b.setAttribute("aria-pressed", items[i][0] === id ? "true" : "false"); }); }
    return set;
  }
  function preset(K, label, fn) {
    var b = X.el("button", { type: "button", class: "x-lab__btn x-lab__btn--ghost" }, esc(label));
    b.addEventListener("click", function () { fn(); K.restart(); });
    K.opts.appendChild(b); return b;
  }
  function rerun(K) {
    var b = X.el("button", { type: "button", class: "x-lab__btn" }, "按新数据重算");
    b.addEventListener("click", function () { K.restart(); });
    K.opts.appendChild(b);
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function T(p, cls, x, y, s, anchor) { var t = X.svg("text", { class: cls, x: x, y: y }, p); if (anchor) t.setAttribute("text-anchor", anchor); t.textContent = s; return t; }
  function stat(label, v, unit) { return "<span>" + label + " <b>" + esc(v) + "</b>" + (unit ? " " + unit : "") + "</span>"; }
  function badge(s, bad) { return '<span class="x-lab__badge' + (bad ? " is-bad" : "") + '">' + esc(s) + "</span>"; }
  function showErr(o, svg, msg) {
    clear(svg);
    var vb = (svg.getAttribute("viewBox") || "0 0 720 120").split(" ");
    T(svg, "x-d2-ph", +vb[2] / 2, Math.min(+vb[3] / 2, 90), "输入有误，请按下方提示修改", "middle");
    svg.setAttribute("aria-label", "输入有误");
    for (var k in o) if (k !== "msg") o[k].innerHTML = "";
    o.msg.innerHTML = '<span class="x-lab__err">' + esc(msg) + "</span>";
  }
  function cells(arr, cls) { return arr.map(function (x, i) { return '<span class="x-d2-cell' + (cls && cls[i] ? " " + cls[i] : "") + '">' + esc(x) + "</span>"; }).join(""); }
  /* 一行数组表：表头为顶点名 */
  function arrTable(g, rows, curCol) {
    var h = '<div class="x-tbl x-d2-tbl"><table><thead><tr><th scope="col"></th>';
    g.V.forEach(function (v, i) { h += '<th scope="col"' + (i === curCol ? ' class="x-d2-hc"' : "") + ">" + esc(v) + "</th>"; });
    h += "</tr></thead><tbody>";
    rows.forEach(function (r) {
      h += '<tr><th scope="row">' + esc(r[0]) + "</th>";
      r[1].forEach(function (c, i) { h += "<td" + (r[2] && r[2][i] ? ' class="' + r[2][i] + '"' : "") + ">" + esc(c) + "</td>"; });
      h += "</tr>";
    });
    return h + "</tbody></table></div>";
  }

  /* 顶点坐标：预设布局的顶点集与当前一致就用预设，否则排成一圈 */
  function layout(g, pre, W, H) {
    if (pre && pre.V.length === g.n && g.V.every(function (v) { return pre.V.indexOf(v) >= 0; })) return g.V.map(function (v) { return pre.P[pre.V.indexOf(v)]; });
    var cx = W / 2, cy = H / 2, R = Math.min(H / 2 - 32, 260), P = [];
    for (var i = 0; i < g.n; i++) { var a = -Math.PI / 2 + 2 * Math.PI * i / g.n; P.push([Math.round(cx + R * 1.55 * Math.cos(a)), Math.round(cy + R * Math.sin(a))]); }
    return P;
  }
  var RN = 19;
  /* 画图：返回 { arcs, nodes, aux, wts }。o = { weights: bool, id: 标记前缀, cy: 中线（决定辅助文字放上方还是下方）} */
  function drawGraph(par, g, P, o) {
    var svgRoot = par.ownerSVGElement || par;
    var defs = svgRoot.querySelector("defs") || X.svg("defs", {}, svgRoot);
    if (g.directed && !svgRoot.querySelector("#" + o.id + "-n")) {
      ["n", "c", "t", "r"].forEach(function (m) {
        var mk = X.svg("marker", { id: o.id + "-" + m, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 11, markerHeight: 11, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
        X.svg("path", { d: "M0,0 L10,5 L0,10 z", class: m === "r" ? "x-d2-mk--r" : "x-lab-mk--" + m }, mk);
      });
    }
    var has = {};
    g.E.forEach(function (e) { has[e.u + ">" + e.v] = 1; });
    var arcs = [], wpos = [];
    g.E.forEach(function (e) {
      var p = P[e.u], q = P[e.v], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L, d, mx, my;
      var tail = g.directed ? RN + 3 : RN;
      if (g.directed && has[e.v + ">" + e.u]) {
        var nx = -uy, ny = ux, off = 26, cx = (p[0] + q[0]) / 2 + nx * off, cy = (p[1] + q[1]) / 2 + ny * off;
        var a1x = cx - p[0], a1y = cy - p[1], l1 = Math.sqrt(a1x * a1x + a1y * a1y), b1x = q[0] - cx, b1y = q[1] - cy, l2 = Math.sqrt(b1x * b1x + b1y * b1y);
        var sx = p[0] + a1x / l1 * RN, sy = p[1] + a1y / l1 * RN, ex = q[0] - b1x / l2 * tail, ey = q[1] - b1y / l2 * tail;
        d = "M" + r1(sx) + "," + r1(sy) + " Q" + r1(cx) + "," + r1(cy) + " " + r1(ex) + "," + r1(ey);
        mx = 0.25 * p[0] + 0.5 * cx + 0.25 * q[0]; my = 0.25 * p[1] + 0.5 * cy + 0.25 * q[1];
      } else {
        d = "M" + r1(p[0] + ux * RN) + "," + r1(p[1] + uy * RN) + " L" + r1(q[0] - ux * tail) + "," + r1(q[1] - uy * tail);
        mx = (p[0] + q[0]) / 2; my = (p[1] + q[1]) / 2;
      }
      var a = { class: "x-lab-arc", d: d };
      if (g.directed) a["marker-end"] = "url(#" + o.id + "-n)";
      arcs.push(X.svg("path", a, par));
      wpos.push([mx, my]);
    });
    var wts = [];
    if (o.weights) g.E.forEach(function (e, k) {
      var s = (o.wlabel ? o.wlabel(k) : "") + wf(e.w), w = 10 + s.length * 8.2, gg = X.svg("g", { class: "x-lab-w" }, par);
      X.svg("rect", { x: r1(wpos[k][0] - w / 2), y: r1(wpos[k][1] - 10), width: r1(w), height: 20, rx: 2 }, gg);
      X.svg("text", { x: r1(wpos[k][0]), y: r1(wpos[k][1]) }, gg).textContent = s;
      wts.push(gg);
    });
    var nodes = [], aux = [];
    P.forEach(function (p, i) {
      var gg = X.svg("g", { class: "x-lab-node" }, par);
      X.svg("circle", { cx: p[0], cy: p[1], r: RN }, gg);
      var t = X.svg("text", { x: p[0], y: p[1] }, gg);
      t.textContent = g.V[i];
      if (g.V[i].length > 2) t.setAttribute("class", "x-d2-sm");
      nodes.push(gg);
      var up = p[1] <= (o.cy || 150);
      aux.push(T(par, "x-d2-aux", p[0], up ? p[1] - RN - 8 : p[1] + RN + 18, "", "middle"));
    });
    return { arcs: arcs, nodes: nodes, aux: aux, wts: wts };
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function setArc(G, k, cls, mk, id, directed) {
    var el = G.arcs[k];
    el.setAttribute("class", "x-lab-arc" + (cls ? " " + cls : ""));
    if (directed) el.setAttribute("marker-end", "url(#" + id + "-" + (mk || "n") + ")");
  }
  function setNode(G, i, cls) { G.nodes[i].setAttribute("class", "x-lab-node" + (cls ? " " + cls : "")); }
  function idxOf(g, s) { s = String(s == null ? "" : s).trim(); return g.V.indexOf(s); }

  /* ================= 实验 8：图的遍历 DFS / BFS ================= */
  var TRAV_PRE = [
    { name: "示例一·8 顶点无向图", dir: false, start: "1", vs: "1-8", es: "1-2, 1-3, 1-4, 2-5, 3-5, 3-6, 4-7, 5-8, 6-8, 7-8",
      L: { V: ["1", "2", "3", "4", "5", "6", "7", "8"], P: [[90, 135], [250, 50], [250, 135], [250, 220], [430, 50], [430, 135], [430, 220], [610, 135]] } },
    { name: "有向图", dir: true, start: "1", vs: "1-6", es: "1->2, 1->4, 2->5, 3->5, 3->6, 4->2, 5->4, 6->3",
      L: { V: ["1", "2", "3", "4", "5", "6"], P: [[120, 60], [360, 60], [600, 60], [120, 210], [360, 210], [600, 210]] } },
    { name: "非连通图", dir: false, start: "A", vs: "A B C D E F G", es: "A-B, A-C, B-D, C-D, E-F, F-G, E-G",
      L: { V: ["A", "B", "C", "D", "E", "F", "G"], P: [[100, 135], [220, 55], [220, 215], [340, 135], [480, 70], [640, 70], [560, 210]] } }
  ];
  LAB.push({
    id: "graphtrav", name: "图的遍历 DFS / BFS", color: DS,
    note: "DFS 一条路走到底再回头，靠递归（或显式栈）记住回退点，访问次序像树的先序；BFS 一圈一圈向外扩，靠队列，顶点入队时就打上 visited 标记，避免同一顶点进队两次。时间：邻接矩阵要扫整行，O(|V|²)；邻接表每条边看常数次，O(|V|+|E|)。同一个图的邻接矩阵只有一种，邻接表里邻接点的先后却可以不同，所以用邻接表时遍历序列和生成树都随邻接点次序变化——切换上方“按边表顺序”看看序列怎么变（默认按编号从小到大）。无向图不连通时，一次遍历只走完一个连通分量，外层要调用的次数就是连通分量个数。",
    mount: function (panel, K) {
      var mode = "dfs", dir = false, ord = "num", R, OTHER, g, P, G, pos, err, TH = 0;
      var setMode = group(K, [["dfs", "DFS 深度优先"], ["bfs", "BFS 广度优先"]], mode, function (m) { mode = m; K.restart(); });
      br(K);
      var setDir = group(K, [[false, "无向图"], [true, "有向图"]], dir, function (d) { dir = d; swapPre(TRAV_PRE, d); K.restart(); });
      var setOrd = group(K, [["num", "邻接点按编号"], ["input", "按边表顺序"]], ord, function (d) { ord = d; K.restart(); });
      br(K);
      var fs = field(K, "起点", "1"), fv = field(K, "顶点", "1-8", "m");
      var fe = area(K, "边表（无向写 1-2，有向写 1->2，逗号或换行分隔）", TRAV_PRE[0].es);
      rerun(K);
      tag(K, "例题");
      var preCur = TRAV_PRE[0];
      /* 切换有向 / 无向时，若边表还是另一种图的例题，就换成同类型的例题（否则 1->2 与 2->1 在无向图中算重复边） */
      function swapPre(list, d) {
        var cur = list.filter(function (p) { return p.es === fe.value && p.dir !== d; })[0], to = list.filter(function (p) { return p.dir === d; })[0];
        if (cur && to) { preCur = to; fv.value = to.vs; fe.value = to.es; if (to.start) fs.value = to.start; }
      }
      TRAV_PRE.forEach(function (p) {
        preset(K, p.name, function () { preCur = p; dir = p.dir; setDir(dir); fs.value = p.start; fv.value = p.vs; fe.value = p.es; });
      });
      var GW = 720, GH = 270;
      var svg = X.svg("svg", { viewBox: "0 0 720 270", role: "img", class: "x-d2-svg" }, K.stage);
      var o = outs(K, ["st", "msg", "box", "tip"]);
      function treeLayout() {
        /* 生成树（森林）按层布局：叶子依次占位，父结点在孩子中间 */
        var ch = {}, depth = {}, x = {}, slot = 0, maxD = 0;
        R.tree.forEach(function (t) { (ch[t[0]] = ch[t[0]] || []).push(t[1]); });
        function place(v, d) {
          depth[v] = d; if (d > maxD) maxD = d;
          var c = ch[v] || [];
          if (!c.length) { x[v] = slot++; return; }
          c.forEach(function (w) { place(w, d + 1); });
          x[v] = (x[c[0]] + x[c[c.length - 1]]) / 2;
        }
        R.roots.forEach(function (r) { place(r, 0); slot += 0.6; });
        var sw = Math.min(84, (GW - 80) / Math.max(1, slot - 0.6)), used = (slot - 0.6 - 1) * sw, x0 = (GW - used) / 2;
        var pos2 = {};
        Object.keys(x).forEach(function (v) { pos2[v] = [r1(x0 + x[v] * sw), GH + 54 + depth[v] * 56]; });
        return { pos: pos2, h: GH + 54 + maxD * 56 + 34 };
      }
      var TL, tg;
      function drawTree(f) {
        clear(tg);
        T(tg, "x-d2-ttl", 16, GH + 20, (mode === "dfs" ? "深度优先生成" : "广度优先生成") + (R.roots.length > 1 ? "森林" : "树") + "（随遍历逐步长出）");
        X.svg("line", { class: "x-d2-sep", x1: 10, y1: GH + 2, x2: GW - 10, y2: GH + 2 }, tg);
        f.tree.forEach(function (t) {
          var a = TL.pos[t[0]], b = TL.pos[t[1]];
          X.svg("line", { class: "x-lab-edge" + (t[1] === f.cur && f.t === "visit" ? " x-d2-enew" : ""), x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, tg);
        });
        f.order.forEach(function (v) {
          var p = TL.pos[v], gg = X.svg("g", { class: "x-lab-node" + (v === f.cur ? " is-cur" : " is-done") }, tg);
          X.svg("circle", { cx: p[0], cy: p[1], r: 17 }, gg);
          var t = X.svg("text", { x: p[0], y: p[1] }, gg); t.textContent = g.V[v];
          if (g.V[v].length > 2) t.setAttribute("class", "x-d2-sm");
        });
      }
      function render() {
        var f = R.frames[pos], last = pos === R.frames.length - 1, inTree = {}, i;
        f.tree.forEach(function (t) { inTree[t[2]] = 1; });
        for (i = 0; i < g.E.length; i++) {
          var cls = "", mk = "n";
          if (i === f.k && f.t === "visit") { cls = "is-relax"; mk = "c"; }
          else if (i === f.k && f.t === "skip") { cls = "is-try"; mk = "t"; }
          else if (inTree[i]) { cls = "is-tree"; mk = "c"; }
          else if (last) cls = "is-off";
          setArc(G, i, cls, mk, "x-d2-tv", g.directed);
        }
        for (i = 0; i < g.n; i++) {
          setNode(G, i, i === f.cur ? "is-cur" : (mode === "bfs" && i === f.at) ? "is-cur" : f.vis[i] ? "is-done" : "");
          var oi = f.order.indexOf(i);
          G.aux[i].textContent = oi < 0 ? "" : "#" + (oi + 1);
        }
        drawTree(f);
        var box = mode === "dfs" ? f.stack : f.queue;
        o.st.innerHTML = stat("已访问", f.order.length + " / " + g.n) + stat(mode === "dfs" ? "栈深" : "队长", box.length) +
          stat("生成树边", f.tree.length) + badge((mode === "dfs" ? "DFS" : "BFS") + (g.directed ? " · 有向图" : " · 无向图") + (last ? " · 完成" : ""));
        o.msg.textContent = (pos ? "第 " + pos + " 步：" : "") + f.d;
        var vis = f.vis.map(function (b) { return b ? "T" : "F"; }), vcls = f.vis.map(function (b) { return b ? "is-ok" : ""; });
        o.box.innerHTML =
          '<div class="x-d2-row"><span class="x-d2-k">' + (mode === "dfs" ? "栈（底→顶）" : "队列（头→尾）") + '</span><span class="x-d2-cells">' +
          (box.length ? cells(box.map(function (v) { return g.V[v]; }), box.map(function (v, j) { return (mode === "dfs" ? j === box.length - 1 : j === 0) ? "is-top" : ""; })) : '<span class="x-d2-empty">空</span>') + "</span></div>" +
          '<div class="x-d2-row"><span class="x-d2-k">访问序列</span><span class="x-d2-cells">' + (f.order.length ? cells(f.order.map(function (v) { return g.V[v]; })) : '<span class="x-d2-empty">—</span>') + "</span></div>" +
          arrTable(g, [["visited", vis, vcls]], f.cur) +
          (last ? '<p class="x-d2-cmp">同一邻接表的对比：DFS 序列 <b>' + esc((mode === "dfs" ? R : OTHER).order.map(function (v) { return g.V[v]; }).join(" ")) +
            "</b>；BFS 序列 <b>" + esc((mode === "dfs" ? OTHER : R).order.map(function (v) { return g.V[v]; }).join(" ")) + "</b>。</p>" : "");
        svg.setAttribute("aria-label", (mode === "dfs" ? "深度" : "广度") + "优先遍历，第 " + pos + " 步，已访问 " + f.order.map(function (v) { return g.V[v]; }).join(" "));
      }
      function reset() {
        pos = 0; err = null;
        g = LABU.dsParseEdges(fv.value, fe.value, { directed: dir, weighted: false, allowNeg: true });
        svg.setAttribute("viewBox", "0 0 720 270");
        if (g.err) { err = g.err; showErr(o, svg, err); return; }
        var s = idxOf(g, fs.value);
        if (s < 0) { err = "起点 “" + String(fs.value).trim() + "” 不在顶点表中（顶点：" + g.V.join(" ") + "）"; showErr(o, svg, err); return; }
        R = mode === "dfs" ? LABU.dsDfs(g, s, ord) : LABU.dsBfs(g, s, ord);
        OTHER = mode === "dfs" ? LABU.dsBfs(g, s, ord) : LABU.dsDfs(g, s, ord);
        TL = treeLayout(); TH = TL.h;
        clear(svg);
        svg.setAttribute("viewBox", "0 0 720 " + Math.round(TH));
        P = layout(g, preCur && preCur.L, GW, GH);
        G = drawGraph(X.svg("g", {}, svg), g, P, { weights: false, id: "x-d2-tv", cy: GH / 2 });
        tg = X.svg("g", {}, svg);
        var adj = LABU.dsAdj(g, ord);
        o.tip.innerHTML = "邻接表（" + (ord === "num" ? "邻接点按编号从小到大" : "按边表输入顺序") + "）：" + g.V.map(function (v, i) { return "<code>" + esc(v) + " → " + esc(adj[i].map(function (a) { return g.V[a.v]; }).join(" ") || "∧") + "</code>"; }).join(" ") +
          "。顶点旁的 #k 是访问次序；邻接点顺序不同，遍历序列和生成树就可能不同。";
        render();
      }
      function step() { if (err) return false; if (pos < R.frames.length - 1) { pos++; render(); } return pos < R.frames.length - 1; }
      setMode(mode); setOrd(ord);
      reset();
      return { step: step, reset: reset, done: function () { return !!err || pos >= R.frames.length - 1; } };
    }
  });

  /* ================= 实验 9：最小生成树 Prim / Kruskal ================= */
  var MST_PRE = [
    { name: "示例一·6 顶点（权值和 14）", start: "1", vs: "1-6", es: "1-2:4, 1-3:2, 2-3:3, 2-4:5, 3-4:6, 3-5:4, 4-5:3, 4-6:2, 5-6:5",
      L: { V: ["1", "2", "3", "4", "5", "6"], P: [[100, 150], [270, 55], [270, 245], [470, 55], [470, 245], [630, 150]] } },
    { name: "7 顶点 A–G（权值和 39）", start: "A", vs: "A-G", es: "A-B:7, A-D:5, B-C:8, B-D:9, B-E:7, C-E:5, D-E:15, D-F:6, E-F:8, E-G:9, F-G:11",
      L: { V: ["A", "B", "C", "D", "E", "F", "G"], P: [[110, 60], [330, 60], [560, 60], [170, 170], [430, 170], [250, 270], [560, 270]] } },
    { name: "等权边：MST 不唯一", start: "1", vs: "1-5", es: "1-2:2, 1-3:2, 2-3:2, 2-4:3, 3-4:3, 3-5:1, 4-5:4",
      L: { V: ["1", "2", "3", "4", "5"], P: [[120, 150], [300, 55], [300, 245], [520, 55], [520, 245]] } }
  ];
  LAB.push({
    id: "mst", name: "最小生成树 Prim / Kruskal", color: DS,
    note: "Prim 是“长树”：从一个顶点出发，每轮把离当前树最近的顶点连进来，用邻接矩阵实现为 O(|V|²)，和边数无关，稠密图划算；Kruskal 是“挑边”：边按权值从小到大逐条考察，用并查集判断两端是否已连通，连通就跳过（否则成环），O(|E|log|E|)，稀疏图划算。有等权边时 MST 可能不止一棵，但最小权值和只有一个；所有边权互不相同则 MST 唯一。n 个顶点的生成树恰好 n−1 条边，多加任何一条都会出现回路。切换 Prim / Kruskal 对照加边顺序：边集合可以相同，加入的先后往往不同。",
    mount: function (panel, K) {
      var mode = "prim", R, OTHER, g, P, G, pos, err;
      group(K, [["prim", "Prim（加点）"], ["kruskal", "Kruskal（加边）"]], mode, function (m) { mode = m; K.restart(); });
      br(K);
      var fs = field(K, "Prim 起点", "1"), fv = field(K, "顶点", "1-6", "m");
      var fe = area(K, "边表（带权无向图，写成 1-2:6，逗号或换行分隔）", MST_PRE[0].es);
      rerun(K);
      tag(K, "例题");
      var preCur = MST_PRE[0];
      MST_PRE.forEach(function (p) { preset(K, p.name, function () { preCur = p; fs.value = p.start; fv.value = p.vs; fe.value = p.es; }); });
      var svg = X.svg("svg", { viewBox: "0 0 720 300", role: "img", class: "x-d2-svg" }, K.stage);
      var o = outs(K, ["st", "msg", "box", "tip"]);
      function render() {
        var f = R.frames[pos], last = pos === R.frames.length - 1, inT = {}, i;
        f.tree.forEach(function (k) { inT[k] = 1; });
        var rej = {}; (f.rej || []).forEach(function (k) { rej[k] = 1; });
        for (i = 0; i < g.E.length; i++) {
          var cls = "";
          if (i === f.k && (f.t === "pick" || f.t === "take")) cls = "is-relax";
          else if (i === f.k && f.t === "skip") cls = "x-d2-rej";
          else if (inT[i]) cls = "is-tree";
          else if (rej[i]) cls = "x-d2-rejd";
          else if (last) cls = "is-off";
          setArc(G, i, cls);
          G.wts[i].setAttribute("class", "x-lab-w" + (inT[i] ? " x-d2-won" : ""));
        }
        var box = "";
        if (mode === "prim") {
          var ch = {}; f.ch.forEach(function (c) { ch[c[0]] = 1; });
          for (i = 0; i < g.n; i++) {
            setNode(G, i, i === f.cur ? "is-cur" : f.inT[i] ? "is-done" : "");
            G.aux[i].textContent = f.inT[i] ? "" : "low=" + wf(f.low[i]);
            G.aux[i].setAttribute("class", "x-d2-aux" + (ch[i] ? " is-upd" : ""));
          }
          var lw = [], lc = [], av = [], ic = [];
          for (i = 0; i < g.n; i++) {
            lw.push(f.inT[i] ? "0" : wf(f.low[i])); lc.push(ch[i] ? "x-d2-ch" : f.inT[i] ? "x-d2-dim" : "");
            av.push(f.adjv[i] < 0 ? "—" : g.V[f.adjv[i]]); ic.push(f.inT[i] ? "✓" : "");
          }
          box = arrTable(g, [["lowcost", lw, lc], ["adjvex", av, lc], ["已加入", ic, ic.map(function (x) { return x ? "is-ok" : ""; })]], f.cur);
        } else {
          var cur = f.k >= 0 ? g.E[f.k] : null, comp = {};
          for (i = 0; i < g.n; i++) {
            var r = i; while (f.parent[r] >= 0) r = f.parent[r];
            comp[i] = r;
          }
          for (i = 0; i < g.n; i++) {
            setNode(G, i, cur && (i === cur.u || i === cur.v) ? "is-cur" : f.tree.some(function (k) { return g.E[k].u === i || g.E[k].v === i; }) ? "is-done" : "");
            G.aux[i].textContent = "根 " + g.V[comp[i]];
            G.aux[i].setAttribute("class", "x-d2-aux");
          }
          var srt = R.sorted.map(function (k, j) {
            var e = g.E[k], c = j === f.pos && f.t !== "end" ? (f.t === "take" ? " is-take" : " is-skip") : inT[k] ? " is-in" : rej[k] ? " is-rej" : j < f.pos ? "" : " is-wait";
            return '<span class="x-d2-edge' + c + '">(' + esc(g.V[e.u]) + "," + esc(g.V[e.v]) + ")<i>" + esc(wf(e.w)) + "</i></span>";
          }).join("");
          box = '<div class="x-d2-row"><span class="x-d2-k">按权排序</span><span class="x-d2-cells">' + srt + "</span></div>" +
            arrTable(g, [["parent", f.parent.map(function (p) { return p < 0 ? "−1" : g.V[p]; }), f.parent.map(function (p, j) { return cur && (j === cur.u || j === cur.v) ? "x-d2-ch" : ""; })]]);
        }
        var seq = R.edges.slice(0, f.tree.length).map(function (e) { return "(" + g.V[e[0]] + "," + g.V[e[1]] + ")"; });
        o.st.innerHTML = stat("已选边", f.tree.length + " / " + (g.n - 1)) + stat("当前权值和", wf(f.total)) + badge((mode === "prim" ? "Prim" : "Kruskal") + (last ? " · 完成" : ""));
        o.msg.textContent = (pos ? "第 " + pos + " 步：" : "") + f.d;
        o.box.innerHTML = '<div class="x-d2-row"><span class="x-d2-k">加边顺序</span><span class="x-d2-cells">' + (seq.length ? cells(seq) : '<span class="x-d2-empty">—</span>') + "</span></div>" + box +
          (last ? '<p class="x-d2-cmp">对比：Prim 加边顺序 <b>' + esc(edgesStr(mode === "prim" ? R : OTHER)) + "</b>，Kruskal 加边顺序 <b>" + esc(edgesStr(mode === "prim" ? OTHER : R)) +
            "</b>；两者权值和都是 <b>" + esc(wf(R.total)) + "</b>" + (R.total === OTHER.total ? "" : "（不相等，说明程序有误）") + "。</p>" : "");
        svg.setAttribute("aria-label", (mode === "prim" ? "Prim" : "Kruskal") + " 第 " + pos + " 步，已选边 " + (seq.join(" ") || "无"));
      }
      function edgesStr(r) { return r.edges.map(function (e) { return "(" + g.V[e[0]] + "," + g.V[e[1]] + ")"; }).join(" "); }
      function reset() {
        pos = 0; err = null;
        g = LABU.dsParseEdges(fv.value, fe.value, { directed: false, weighted: true, allowNeg: false });
        if (g.err) { err = g.err; showErr(o, svg, err); return; }
        var s = idxOf(g, fs.value);
        if (mode === "prim" && s < 0) { err = "起点 “" + String(fs.value).trim() + "” 不在顶点表中（顶点：" + g.V.join(" ") + "）"; showErr(o, svg, err); return; }
        if (s < 0) s = 0;
        if (!LABU.dsConnected(g)) { err = "图不连通：最小生成树只对连通图有定义，请补上缺的边。"; showErr(o, svg, err); return; }
        R = mode === "prim" ? LABU.dsPrim(g, s) : LABU.dsKruskal(g);
        OTHER = mode === "prim" ? LABU.dsKruskal(g) : LABU.dsPrim(g, s);
        if (R.err) { err = R.err; showErr(o, svg, err); return; }
        clear(svg);
        P = layout(g, preCur && preCur.L, 720, 300);
        G = drawGraph(X.svg("g", {}, svg), g, P, { weights: true, id: "x-d2-ms", cy: 150 });
        o.tip.textContent = mode === "prim"
          ? "lowcost[i]：未加入的顶点 i 到当前生成树的最短边权，adjvex[i] 是这条边在树内的端点；每步选 lowcost 最小者（相同取编号小的），再用它更新其余顶点。"
          : "并查集 parent[i] = −1 表示 i 是根；Find 沿 parent 找根，两端根相同就说明已连通、再加这条边会成回路。本实验 Union 让后一端的根指向前一端的根。";
        render();
      }
      function step() { if (err) return false; if (pos < R.frames.length - 1) { pos++; render(); } return pos < R.frames.length - 1; }
      reset();
      return { step: step, reset: reset, done: function () { return !!err || pos >= R.frames.length - 1; } };
    }
  });

  /* ================= 实验 10：拓扑排序与关键路径 ================= */
  var TOPO_PRE = [
    { name: "示例 AOV（6 顶点·两个入度为 0）", mode: "topo", vs: "1-6", es: "1->3, 1->4, 2->4, 2->5, 3->6, 4->6, 5->6",
      L: { V: ["1", "2", "3", "4", "5", "6"], P: [[100, 80], [100, 230], [320, 50], [320, 155], [320, 260], [580, 155]] } },
    { name: "有回路的 AOV", mode: "topo", vs: "1-6", es: "1->2, 2->3, 3->4, 4->2, 1->5, 5->6",
      L: { V: ["1", "2", "3", "4", "5", "6"], P: [[100, 150], [280, 60], [500, 60], [390, 230], [280, 250], [560, 250]] } },
    { name: "示例 AOE（7 事件 9 活动·3 条关键路径）", mode: "aoe", vs: "1-7", es: "1->2:3, 1->3:4, 1->4:2, 2->5:4, 3->5:3, 3->6:5, 4->6:4, 5->7:4, 6->7:2",
      L: { V: ["1", "2", "3", "4", "5", "6", "7"], P: [[70, 150], [240, 50], [240, 150], [240, 250], [440, 90], [440, 230], [630, 150]] } },
    { name: "经典 AOE（9 事件 11 活动）", mode: "aoe", vs: "1-9", es: "1->2:6, 1->3:4, 1->4:5, 2->5:1, 3->5:1, 4->6:2, 5->7:9, 5->8:7, 6->8:4, 7->9:2, 8->9:4",
      L: { V: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], P: [[56, 150], [180, 50], [180, 150], [180, 250], [340, 120], [340, 250], [500, 50], [500, 210], [654, 140]] } }
  ];
  LAB.push({
    id: "topo", name: "拓扑排序与关键路径", color: DS,
    note: "拓扑排序：反复找一个入度为 0 的顶点输出，并删掉它发出的边。暂存入度为 0 的顶点可以用栈也可以用队列，得到的序列可能不一样，但都满足所有边的先后关系；若顶点没输出完就找不到入度为 0 的顶点，说明图中有回路。邻接表实现为 O(|V|+|E|)。关键路径：沿拓扑序算事件最早时间 ve（取各前驱的最大值），沿逆拓扑序算最迟时间 vl（取各后继的最小值）；活动 a = ⟨u, v⟩ 的 e = ve(u)，l = vl(v) − 持续时间，余量 l − e 为 0 的就是关键活动。源点到汇点的最长路径长度就是整个工程的最短工期。关键路径可能有好几条，只压缩其中一条上的活动未必能让工期变短；压缩过头时，这个活动还会从关键活动变成非关键活动。",
    mount: function (panel, K) {
      var mode = "topo", useQ = false, R, g, P, G, pos, err;
      var setMode = group(K, [["topo", "拓扑排序（AOV 网）"], ["aoe", "关键路径（AOE 网）"]], mode, function (m) {
        mode = m; var p = TOPO_PRE[m === "aoe" ? 2 : 0]; preCur = p; fv.value = p.vs; fe.value = p.es; K.restart();
      });
      br(K);
      var setQ = group(K, [[false, "用栈"], [true, "用队列"]], useQ, function (q) { useQ = q; K.restart(); });
      var fv = field(K, "顶点", TOPO_PRE[0].vs, "m");
      var fe = area(K, "边表（有向边写 1->2；AOE 网写持续时间 1->2:3，活动 a1、a2… 按输入顺序编号）", TOPO_PRE[0].es);
      rerun(K);
      tag(K, "例题");
      var preCur = TOPO_PRE[0];
      TOPO_PRE.forEach(function (p) { preset(K, p.name, function () { preCur = p; mode = p.mode; setMode(mode); fv.value = p.vs; fe.value = p.es; }); });
      var svg = X.svg("svg", { viewBox: "0 0 720 300", role: "img", class: "x-d2-svg" }, K.stage);
      var o = outs(K, ["st", "msg", "box", "tip"]);
      function vv(v) { return v == null ? "" : wf(v); }
      function renderTopo() {
        var f = R.frames[pos], last = pos === R.frames.length - 1, gone = {}, i, fin = f.t === "end";
        f.ks.forEach(function (k) { gone[k] = 2; });
        if (!fin) g.E.forEach(function (e, k) { if (f.out[e.u] && gone[k] !== 2) gone[k] = 1; });
        for (i = 0; i < g.E.length; i++) setArc(G, i, gone[i] === 2 ? "is-try" : gone[i] ? "is-off" : (f.t === "cycle" && !f.out[g.E[i].u] ? "x-d2-rej" : ""), gone[i] === 2 ? "t" : (f.t === "cycle" && !f.out[g.E[i].u] && !gone[i]) ? "r" : "n", "x-d2-tp", true);
        for (i = 0; i < g.n; i++) {
          setNode(G, i, fin ? "is-done" : i === f.cur ? "is-cur" : f.out[i] ? "x-d2-gone" : f.box.indexOf(i) >= 0 ? "is-done" : (f.t === "cycle" ? "x-d2-bad" : ""));
          G.aux[i].textContent = f.out[i] ? "#" + (f.order.indexOf(i) + 1) : "入度 " + f.indeg[i];
          G.aux[i].setAttribute("class", "x-d2-aux" + (!f.out[i] && f.indeg[i] === 0 ? " is-upd" : ""));
        }
        o.st.innerHTML = stat("已输出", f.order.length + " / " + g.n) + stat(useQ ? "队长" : "栈深", f.box.length) +
          badge(f.t === "cycle" ? "存在回路" : last ? "拓扑排序完成" : "拓扑排序 · " + (useQ ? "队列" : "栈"), f.t === "cycle");
        o.msg.textContent = (pos ? "第 " + pos + " 步：" : "") + f.d;
        o.box.innerHTML = '<div class="x-d2-row"><span class="x-d2-k">' + (useQ ? "队列（头→尾）" : "栈（底→顶）") + '</span><span class="x-d2-cells">' +
          (f.box.length ? cells(f.box.map(function (v) { return g.V[v]; }), f.box.map(function (v, j) { return (useQ ? j === 0 : j === f.box.length - 1) ? "is-top" : ""; })) : '<span class="x-d2-empty">空</span>') + "</span></div>" +
          '<div class="x-d2-row"><span class="x-d2-k">拓扑序列</span><span class="x-d2-cells">' + (f.order.length ? cells(f.order.map(function (v) { return g.V[v]; })) : '<span class="x-d2-empty">—</span>') + "</span></div>" +
          arrTable(g, [["indegree", f.indeg.map(function (d, j) { return f.out[j] ? "—" : String(d); }), f.indeg.map(function (d, j) { return f.out[j] ? "x-d2-dim" : d === 0 ? "is-ok" : ""; })]], f.cur);
        svg.setAttribute("aria-label", "拓扑排序第 " + pos + " 步，已输出 " + f.order.map(function (v) { return g.V[v]; }).join(" "));
      }
      function renderAoe() {
        var f = R.frames[pos], last = pos === R.frames.length - 1, hl = {}, i;
        f.ks.forEach(function (k) { hl[k] = 1; });
        var crit = {}; if (last) R.crit.forEach(function (k) { crit[k] = 1; });
        for (i = 0; i < g.E.length; i++) setArc(G, i, last ? (crit[i] ? "x-d2-crit" : "is-off") : hl[i] ? "is-relax" : "", last ? (crit[i] ? "r" : "n") : hl[i] ? "c" : "n", "x-d2-tp", true);
        for (i = 0; i < g.n; i++) {
          var onC = last && R.crit.some(function (k) { return g.E[k].u === i || g.E[k].v === i; });
          setNode(G, i, i === f.cur ? "is-cur" : onC ? "x-d2-cn" : (f.ve[i] != null ? "is-done" : ""));
          G.aux[i].textContent = f.ve[i] == null ? "" : vv(f.ve[i]) + " / " + (f.vl[i] == null ? "?" : vv(f.vl[i]));
          G.aux[i].setAttribute("class", "x-d2-aux" + (i === f.cur ? " is-upd" : ""));
        }
        o.st.innerHTML = stat("事件", g.n) + stat("活动", g.E.length) + (last ? stat("工期", wf(R.len)) + stat("关键活动", R.crit.length) : "") +
          badge(f.ph === "ve" ? "求 ve（拓扑序）" : f.ph === "vl" ? "求 vl（逆拓扑序）" : f.ph === "act" ? "求 e、l" : last ? "关键路径" : "准备");
        o.msg.textContent = (pos ? "第 " + pos + " 步：" : "") + f.d;
        var vtab = arrTable(g, [["ve", f.ve.map(vv), f.ve.map(function (x, j) { return j === f.cur && f.ph === "ve" ? "x-d2-ch" : ""; })],
          ["vl", f.vl.map(vv), f.vl.map(function (x, j) { return j === f.cur && f.ph === "vl" ? "x-d2-ch" : ""; })]], f.cur);
        var h = '<div class="x-tbl x-d2-tbl"><table><thead><tr><th scope="col">活动</th><th scope="col">弧</th><th scope="col">持续</th><th scope="col">e</th><th scope="col">l</th><th scope="col">l − e</th></tr></thead><tbody>';
        g.E.forEach(function (e, k) {
          var a = f.acts.filter(function (x) { return x.k === k; })[0], c = a && a.d === 0, cur = hl[k] && f.ph === "act";
          h += "<tr" + (cur ? ' class="is-cur"' : last && c ? ' class="x-d2-crow"' : "") + '><th scope="row">a' + (k + 1) + "</th><td>&lt;" + esc(g.V[e.u]) + "," + esc(g.V[e.v]) + "&gt;</td><td>" + esc(wf(e.w)) + "</td><td>" +
            (a ? esc(wf(a.e)) : "") + "</td><td>" + (a ? esc(wf(a.l)) : "") + "</td><td" + (a && c ? ' class="is-ok"' : "") + ">" + (a ? esc(wf(a.d)) + (c ? " 关键" : "") : "") + "</td></tr>";
        });
        h += "</tbody></table></div>";
        o.box.innerHTML = '<div class="x-d2-row"><span class="x-d2-k">拓扑序列</span><span class="x-d2-cells">' + cells(R.order.map(function (v) { return g.V[v]; })) + "</span></div>" + vtab + h +
          (last ? '<p class="x-d2-cmp">关键路径：<b>' + esc(R.paths.map(function (p) { return p.map(function (v) { return g.V[v]; }).join("→"); }).join("，")) + "</b>，长度 <b>" + esc(wf(R.len)) + "</b>。</p>" : "");
        svg.setAttribute("aria-label", "关键路径第 " + pos + " 步");
      }
      function render() { if (mode === "aoe") renderAoe(); else renderTopo(); }
      function reset() {
        pos = 0; err = null;
        g = LABU.dsParseEdges(fv.value, fe.value, { directed: true, weighted: mode === "aoe", allowNeg: false });
        if (g.err) { err = g.err; showErr(o, svg, err); return; }
        R = mode === "aoe" ? LABU.dsCritical(g, useQ) : LABU.dsTopo(g, useQ);
        if (R.err) {
          /* 有回路时改为演示拓扑排序过程，让学生看到卡住的地方 */
          if (R.topo && R.topo.cycle) { mode = "topo"; setMode("topo"); R = R.topo; }
          else { err = R.err; showErr(o, svg, err); return; }
        }
        clear(svg);
        P = layout(g, preCur && preCur.L, 720, 300);
        G = drawGraph(X.svg("g", {}, svg), g, P, { weights: mode === "aoe", id: "x-d2-tp", cy: 150, wlabel: function (k) { return "a" + (k + 1) + "="; } });
        o.tip.textContent = mode === "aoe"
          ? "顶点旁标的是 ve / vl；最后粗红边是关键活动。约定：活动按边表输入顺序编号为 a1、a2…；AOE 网只能有一个源点和一个汇点。"
          : "顶点旁标的是当前入度，出栈后改标输出次序 #k。用栈和用队列得到的拓扑序列可能不同，但都正确；若某步栈 / 队列空了而还有顶点没输出，就说明有回路。";
        render();
      }
      function step() { if (err) return false; if (pos < R.frames.length - 1) { pos++; render(); } return pos < R.frames.length - 1; }
      setQ(useQ);
      reset();
      return { step: step, reset: reset, done: function () { return !!err || pos >= R.frames.length - 1; } };
    }
  });

  /* ================= 实验 11：Floyd ================= */
  var FL_PRE = [
    { name: "4 顶点有向图", dir: true, vs: "0-3", es: "0->1:1, 0->3:4, 1->2:9, 1->3:2, 2->0:3, 2->1:5, 2->3:8, 3->2:6",
      L: { V: ["0", "1", "2", "3"], P: [[150, 60], [570, 60], [570, 220], [150, 220]] } },
    { name: "示例二·4 顶点（多次中转）", dir: true, vs: "0-3", es: "0->1:2, 0->2:9, 1->2:3, 1->3:8, 2->0:4, 2->3:1, 3->0:6",
      L: { V: ["0", "1", "2", "3"], P: [[110, 240], [360, 150], [610, 240], [360, 45]] } },
    { name: "5 顶点无向图", dir: false, vs: "0-4", es: "0-1:4, 0-2:1, 2-1:2, 1-3:5, 2-3:8, 3-4:3, 2-4:10",
      L: { V: ["0", "1", "2", "3", "4"], P: [[90, 150], [290, 55], [290, 245], [500, 150], [650, 245]] } },
    { name: "含负权边（无负回路）", dir: true, vs: "0-3", es: "0->1:3, 0->2:8, 1->2:-2, 2->3:1, 3->0:2, 1->3:7",
      L: { V: ["0", "1", "2", "3"], P: [[150, 60], [570, 60], [570, 220], [150, 220]] } }
  ];
  LAB.push({
    id: "floyd", name: "Floyd 最短路径", color: DS,
    note: "Floyd 轮流把 V0、V1 … Vn−1 当作“允许经过的中转点”：第 k 轮检查 A[i][k] + A[k][j] 是否比 A[i][j] 更短，更短就改写，并记 path[i][j] = k。三重循环，时间 O(|V|³)、空间 O(|V|²)，一次得到任意两点间的最短路径。边权可以为负，但不能有负权回路（Dijkstra 连负权边都不行）。对每个顶点各跑一次 Dijkstra 也能求全部最短路径，总时间同为 O(|V|³)。还原路径时沿 path 递归：path[i][j] = −1 表示 i 到 j 直接走那条边。单步观察每一轮哪些格子变黄，就能看出中转点 k 帮哪些顶点对抄了近路。",
    mount: function (panel, K) {
      var dir = true, R, g, P, G, pos, err;
      var setDir = group(K, [[true, "有向图"], [false, "无向图"]], dir, function (d) { dir = d; swapPre(FL_PRE, d); K.restart(); });
      br(K);
      var fv = field(K, "顶点", "0-3", "m");
      var fe = area(K, "边表（有向写 0->1:5，无向写 0-1:5；可以有负权，但不能有负权回路）", FL_PRE[0].es);
      rerun(K);
      tag(K, "例题");
      var preCur = FL_PRE[0];
      function swapPre(list, d) {
        var cur = list.filter(function (p) { return p.es === fe.value && p.dir !== d; })[0], to = list.filter(function (p) { return p.dir === d; })[0];
        if (cur && to) { preCur = to; fv.value = to.vs; fe.value = to.es; }
      }
      FL_PRE.forEach(function (p) { preset(K, p.name, function () { preCur = p; dir = p.dir; setDir(dir); fv.value = p.vs; fe.value = p.es; }); });
      var svg = X.svg("svg", { viewBox: "0 0 720 280", role: "img", class: "x-d2-svg" }, K.stage);
      var o = outs(K, ["st", "msg", "box", "tip"]);
      function matTable(cap, M, f, isPath) {
        var ch = {}; f.ch.forEach(function (c) { ch[c[0] + "," + c[1]] = 1; });
        var h = '<div class="x-tbl x-d2-tbl x-d2-mat"><table><caption>' + esc(cap) + '</caption><thead><tr><th scope="col"></th>';
        g.V.forEach(function (v, j) { h += '<th scope="col"' + (j === f.k ? ' class="x-d2-hc"' : "") + ">" + esc(v) + "</th>"; });
        h += "</tr></thead><tbody>";
        M.forEach(function (row, i) {
          h += '<tr><th scope="row"' + (i === f.k ? ' class="x-d2-hc"' : "") + ">" + esc(g.V[i]) + "</th>";
          row.forEach(function (x, j) {
            var c = ch[i + "," + j] ? "x-d2-ch" : (i === f.k || j === f.k) ? "x-d2-kk" : "";
            h += "<td" + (c ? ' class="' + c + '"' : "") + ">" + esc(isPath ? (x < 0 ? "−1" : g.V[x]) : wf(x)) + "</td>";
          });
          h += "</tr>";
        });
        return h + "</tbody></table></div>";
      }
      function render() {
        var f = R.frames[pos], last = pos === R.frames.length - 1, i;
        for (i = 0; i < g.n; i++) { setNode(G, i, i === f.k ? "is-cur" : f.k > i || last ? "is-done" : ""); G.aux[i].textContent = i === f.k ? "k" : ""; }
        for (i = 0; i < g.E.length; i++) { var e = g.E[i], on = f.k >= 0 && (e.u === f.k || e.v === f.k); setArc(G, i, on ? "is-relax" : "", on ? "c" : "n", "x-d2-fl", g.directed); }
        var lbl = f.k < 0 ? "−1" : String(f.k);
        o.st.innerHTML = stat("轮次", f.k < 0 ? "初始" : (f.k + 1) + " / " + g.n) + stat("本轮更新", f.ch.length, "格") + badge(f.k < 0 ? "A(−1)" : "中间顶点 " + g.V[f.k] + (last ? " · 完成" : ""));
        o.msg.textContent = (pos ? "第 " + pos + " 步：" : "") + f.d;
        var why = f.ch.length ? '<ul class="x-d2-why">' + f.ch.map(function (c) {
          return "<li>A[" + esc(g.V[c[0]]) + "][" + esc(g.V[c[1]]) + "]：A[" + esc(g.V[c[0]]) + "][" + esc(g.V[f.k]) + "] + A[" + esc(g.V[f.k]) + "][" + esc(g.V[c[1]]) + "] = " +
            esc(pw(c[4])) + " + " + esc(pw(c[5])) + " = " + esc(wf(c[3])) + " &lt; " + esc(wf(c[2])) + "，更新为 " + esc(wf(c[3])) + "，path = " + esc(g.V[f.k]) + "</li>";
        }).join("") + "</ul>" : "";
        var fin = "";
        if (last) {
          var rows = [];
          for (var a = 0; a < g.n; a++) for (var b = 0; b < g.n; b++) if (a !== b) {
            var p = LABU.dsFloydPath(f.A, f.path, a, b);
            rows.push("<tr><td>" + esc(g.V[a]) + "→" + esc(g.V[b]) + "</td><td>" + esc(wf(f.A[a][b])) + "</td><td>" + (p.length ? esc(p.map(function (v) { return g.V[v]; }).join("→")) : "不可达") + "</td></tr>");
          }
          fin = '<div class="x-tbl x-d2-tbl"><table><caption>由 path 还原的最短路径</caption><thead><tr><th scope="col">顶点对</th><th scope="col">长度</th><th scope="col">路径</th></tr></thead><tbody>' + rows.join("") + "</tbody></table></div>";
        }
        o.box.innerHTML = '<div class="x-d2-mats">' + matTable("A(" + lbl + ")", f.A, f, false) + matTable("path(" + lbl + ")", f.path, f, true) + "</div>" + why + fin;
        svg.setAttribute("aria-label", "Floyd 第 " + pos + " 步");
      }
      function reset() {
        pos = 0; err = null;
        g = LABU.dsParseEdges(fv.value, fe.value, { directed: dir, weighted: true, allowNeg: true });
        if (g.err) { err = g.err; showErr(o, svg, err); return; }
        if (g.n > 8) { err = "Floyd 演示最多 8 个顶点（矩阵太大在手机上看不清），考试一般 4–5 个"; showErr(o, svg, err); return; }
        R = LABU.dsFloyd(g);
        if (R.err) { err = R.err; showErr(o, svg, err); return; }
        clear(svg);
        P = layout(g, preCur && preCur.L, 720, 280);
        G = drawGraph(X.svg("g", {}, svg), g, P, { weights: true, id: "x-d2-fl", cy: 140 });
        o.tip.textContent = "黄色格子是本轮被更新的值，浅色十字是第 k 行、第 k 列（本轮不会变）。path 约定：初值 −1，更新时记中间顶点 k（近年真题常用）；另一种常见约定是 path 记录路径上的前驱顶点，做题以题目给出的为准。";
        render();
      }
      function step() { if (err) return false; if (pos < R.frames.length - 1) { pos++; render(); } return pos < R.frames.length - 1; }
      reset();
      return { step: step, reset: reset, done: function () { return !!err || pos >= R.frames.length - 1; } };
    }
  });
})();
