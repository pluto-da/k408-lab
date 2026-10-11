/* 性质与公式 · 数据结构（14 条）：二叉树叶子数、结点数上界、完全二叉树、空指针、卡特兰数、树与森林、哈夫曼树、
   图的度、连通性与边数、AVL 最少结点、B 树关键字与高度、红黑树、折半查找与堆、比较排序下界与稳定性。
   约定写在每条性质的 cond（适用条件）里。注册格式见 23-prop-core.js：PROP.push({ id, sub, ch, name, def, stmt, cond, proof, traps, ex, links, demo })。
   纯计算函数挂在 window.PROPU.ds 上，便于单元测试；顶层不访问 DOM，demo(box) 只在卡片打开时调用，返回 { destroy }。 */
(function () {
  var PROP = window.PROP = window.PROP || [];
  var PROPU = window.PROPU = window.PROPU || {};
  var DS = PROPU.ds = PROPU.ds || {};

  /* ===================== 纯计算函数 ===================== */
  /* 可复现的伪随机数（mulberry32），测试里用固定种子 */
  DS.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul ? Math.imul(t ^ (t >>> 15), t | 1) : (t ^ (t >>> 15)) * (t | 1);
      t ^= t + (Math.imul ? Math.imul(t ^ (t >>> 7), t | 61) : (t ^ (t >>> 7)) * (t | 61));
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  function rint(rnd, a, b) { return a + Math.floor((rnd || Math.random)() * (b - a + 1)); }
  DS.randInt = rint;
  /* ⌈log₂x⌉（x ≥ 1，整数运算） */
  DS.ceilLog2 = function (x) { var k = 0, p = 1; while (p < x) { p *= 2; k++; } return k; };
  /* ⌊log₂x⌋（x ≥ 1） */
  DS.floorLog2 = function (x) { var k = 0, p = 2; while (p <= x) { p *= 2; k++; } return k; };

  /* ---- 二叉树：结点数组 [{ l, r, p }]，-1 表示空，0 号为根 ---- */
  DS.addRandomNode = function (nodes, rnd) {
    if (!nodes.length) { nodes.push({ l: -1, r: -1, p: -1 }); return 0; }
    var free = [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].l < 0) free.push([i, "l"]);
      if (nodes[i].r < 0) free.push([i, "r"]);
    }
    var s = free[rint(rnd, 0, free.length - 1)];
    nodes.push({ l: -1, r: -1, p: s[0] });
    nodes[s[0]][s[1]] = nodes.length - 1;
    return nodes.length - 1;
  };
  DS.randomBinaryTree = function (n, rnd) {
    var nodes = [];
    for (var i = 0; i < n; i++) DS.addRandomNode(nodes, rnd);
    return nodes;
  };
  DS.binaryCounts = function (nodes) {
    var c = { n: nodes.length, n0: 0, n1: 0, n2: 0, branches: 0, nullPtr: 0 };
    for (var i = 0; i < nodes.length; i++) {
      var d = (nodes[i].l >= 0 ? 1 : 0) + (nodes[i].r >= 0 ? 1 : 0);
      c["n" + d]++;
      c.branches += d;
      c.nullPtr += 2 - d;
    }
    return c;
  };
  DS.treeHeight = function (nodes, root) {
    if (root == null) root = nodes.length ? 0 : -1;
    if (root < 0) return 0;
    return 1 + Math.max(DS.treeHeight(nodes, nodes[root].l), DS.treeHeight(nodes, nodes[root].r));
  };

  /* ---- 二叉树结点数上界 ---- */
  DS.levelMax = function (i) { return Math.pow(2, i - 1); };
  DS.heightMax = function (h) { return Math.pow(2, h) - 1; };

  /* ---- 完全二叉树 ---- */
  DS.completeHeight = function (n) { return DS.ceilLog2(n + 1); };
  DS.completeInfo = function (n) {
    return { h: DS.ceilLog2(n + 1), h2: DS.floorLog2(n) + 1, leaves: Math.ceil(n / 2), lastInternal: Math.floor(n / 2), n1: n % 2 === 0 ? 1 : 0 };
  };
  DS.completeRel = function (n, i) {
    return { parent: i > 1 ? Math.floor(i / 2) : null, left: 2 * i <= n ? 2 * i : null, right: 2 * i + 1 <= n ? 2 * i + 1 : null };
  };

  /* ---- 二叉链表空指针 ---- */
  DS.nullPointers = function (n) { return { total: 2 * n, nonNull: n - 1, nul: n + 1 }; };

  /* ---- 卡特兰数与出栈序列 ---- */
  DS.catalan = function (n) {
    var c = 1;
    for (var i = 1; i <= n; i++) c = c * 2 * (2 * i - 1) / (i + 1);
    return Math.round(c);
  };
  DS.binom = function (n, k) {
    if (k < 0 || k > n) return 0;
    var r = 1;
    for (var i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return Math.round(r);
  };
  /* 入栈次序 1,2,…,n，判断 seq 是否为合法出栈序列 */
  DS.isStackSeq = function (seq) {
    var st = [], next = 1;
    for (var i = 0; i < seq.length; i++) {
      var x = seq[i];
      while (next <= x) st.push(next++);
      if (st[st.length - 1] !== x) return false;
      st.pop();
    }
    return true;
  };
  DS.permutations = function (n) {
    var out = [], a = [], used = [];
    (function go() {
      if (a.length === n) { out.push(a.slice()); return; }
      for (var v = 1; v <= n; v++) if (!used[v]) { used[v] = true; a.push(v); go(); a.pop(); used[v] = false; }
    })();
    return out;
  };
  DS.stackSeqs = function (n) {
    return DS.permutations(n).filter(DS.isStackSeq);
  };
  DS.parseSeq = function (s, n) {
    var t = String(s == null ? "" : s).trim();
    if (!t) return { err: "请输入一个出栈序列，例如 3 2 1 4" };
    var a = t.split(/[\s,，、;；]+/).filter(function (x) { return x !== ""; });
    if (a.length !== n) return { err: "当前 n = " + n + "，序列要有 " + n + " 个数，你输入了 " + a.length + " 个" };
    var seen = {}, seq = [];
    for (var i = 0; i < a.length; i++) {
      if (!/^\d+$/.test(a[i])) return { err: "“" + a[i] + "”不是正整数" };
      var v = Number(a[i]);
      if (v < 1 || v > n) return { err: "序列里的数要在 1 ~ " + n + " 之间，“" + a[i] + "”超出范围" };
      if (seen[v]) return { err: v + " 出现了两次，每个元素只能出栈一次" };
      seen[v] = true;
      seq.push(v);
    }
    return { seq: seq };
  };

  /* ---- 树与森林：结点 [{ p, ch:[] }] ---- */
  DS.randomForest = function (n, k, m, rnd) {
    if (k > n) k = n;
    var nodes = [], i, open;
    for (i = 0; i < k; i++) nodes.push({ p: -1, ch: [] });
    for (i = k; i < n; i++) {
      open = [];
      for (var j = 0; j < nodes.length; j++) if (nodes[j].ch.length < m) open.push(j);
      var par = open[rint(rnd, 0, open.length - 1)];
      nodes.push({ p: par, ch: [] });
      nodes[par].ch.push(nodes.length - 1);
    }
    return nodes;
  };
  DS.forestCounts = function (nodes) {
    var c = { n: nodes.length, k: 0, edges: 0, degSum: 0, cnt: [], maxDeg: 0, n0: 0, rhs: 0 };
    for (var i = 0; i < nodes.length; i++) {
      var d = nodes[i].ch.length;
      if (nodes[i].p < 0) c.k++; else c.edges++;
      c.degSum += d;
      c.cnt[d] = (c.cnt[d] || 0) + 1;
      if (d > c.maxDeg) c.maxDeg = d;
    }
    for (var d2 = 0; d2 <= c.maxDeg; d2++) c.cnt[d2] = c.cnt[d2] || 0;
    c.n0 = c.cnt[0];
    c.rhs = c.k;
    for (var d3 = 2; d3 <= c.maxDeg; d3++) c.rhs += (d3 - 1) * c.cnt[d3];
    return c;
  };
  DS.mLevelMax = function (m, i) { return Math.pow(m, i - 1); };

  /* ---- 哈夫曼树（m 叉，必要时补权值为 0 的虚结点） ---- */
  DS.huffmanDummy = function (n, m) {
    if (m < 2 || n < 1) return 0;
    var r = (n - 1) % (m - 1);
    return r === 0 ? 0 : (m - 1) - r;
  };
  DS.huffman = function (weights, m) {
    m = m || 2;
    var nodes = [], q = [], i;
    for (i = 0; i < weights.length; i++) { nodes.push({ w: weights[i], ch: [], leaf: true, dummy: false }); q.push(i); }
    var dummy = weights.length > 1 ? DS.huffmanDummy(weights.length, m) : 0;
    for (i = 0; i < dummy; i++) { nodes.push({ w: 0, ch: [], leaf: true, dummy: true }); q.push(nodes.length - 1); }
    function take() {
      var b = 0;
      for (var j = 1; j < q.length; j++) if (nodes[q[j]].w < nodes[q[b]].w) b = j;
      return q.splice(b, 1)[0];
    }
    while (q.length > 1) {
      var ch = [], w = 0;
      for (i = 0; i < m && q.length; i++) { var t = take(); ch.push(t); w += nodes[t].w; }
      nodes.push({ w: w, ch: ch, leaf: false, dummy: false });
      q.push(nodes.length - 1);
    }
    var root = q[0], wpl = 0, n1 = 0;
    (function walk(v, d) {
      if (nodes[v].leaf) { wpl += nodes[v].w * d; return; }
      if (nodes[v].ch.length === 1) n1++;
      for (var j = 0; j < nodes[v].ch.length; j++) walk(nodes[v].ch[j], d + 1);
    })(root, 0);
    return { nodes: nodes, root: root, dummy: dummy, total: nodes.length, wpl: wpl, n1: n1, n: weights.length };
  };
  DS.parseWeights = function (s) {
    var t = String(s == null ? "" : s).trim();
    if (!t) return { err: "请输入权值，用空格或逗号分隔，例如 2 3 5 7" };
    var a = t.split(/[\s,，、;；]+/).filter(function (x) { return x !== ""; });
    if (a.length < 2) return { err: "至少要有 2 个权值才能构造哈夫曼树" };
    if (a.length > 10) return { err: "最多 10 个权值，图里放不下更多" };
    var w = [];
    for (var i = 0; i < a.length; i++) {
      if (!/^\d{1,3}$/.test(a[i]) || Number(a[i]) < 1) return { err: "“" + a[i] + "”不是 1 ~ 999 之间的整数" };
      w.push(Number(a[i]));
    }
    return { w: w };
  };

  /* ---- 图 ---- */
  DS.randomGraph = function (n, e, directed, rnd) {
    var all = [], u, v;
    for (u = 0; u < n; u++) for (v = 0; v < n; v++) {
      if (u === v) continue;
      if (!directed && v < u) continue;
      all.push([u, v]);
    }
    if (e > all.length) e = all.length;
    for (var i = all.length - 1; i > 0; i--) { var j = rint(rnd, 0, i), t = all[i]; all[i] = all[j]; all[j] = t; }
    return { n: n, directed: !!directed, edges: all.slice(0, e) };
  };
  DS.degreeSum = function (g) {
    var deg = [], ind = [], outd = [], i;
    for (i = 0; i < g.n; i++) { deg[i] = 0; ind[i] = 0; outd[i] = 0; }
    for (i = 0; i < g.edges.length; i++) {
      var a = g.edges[i][0], b = g.edges[i][1];
      deg[a]++; deg[b]++; outd[a]++; ind[b]++;
    }
    function sum(x) { var s = 0; for (var k = 0; k < x.length; k++) s += x[k]; return s; }
    return { deg: deg, indeg: ind, outdeg: outd, sum: sum(deg), inSum: sum(ind), outSum: sum(outd), e: g.edges.length };
  };
  DS.edgeBounds = function (n) {
    var md = (n - 1) * (n - 2) / 2;
    return { complete: n * (n - 1) / 2, dcomplete: n * (n - 1), minConnected: n - 1, maxDisconnected: md, guarantee: md + 1, strongMin: n > 1 ? n : 0 };
  };
  DS.isConnected = function (n, edges) {
    if (n <= 1) return true;
    var par = [], i;
    for (i = 0; i < n; i++) par[i] = i;
    function f(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
    var comp = n;
    for (i = 0; i < edges.length; i++) {
      var a = f(edges[i][0]), b = f(edges[i][1]);
      if (a !== b) { par[a] = b; comp--; }
    }
    return comp === 1;
  };
  /* “最坏”放法：先把边全放进前 n−1 个顶点构成的完全图里，放满了才连到最后一个顶点 */
  DS.worstGraph = function (n, e) {
    var edges = [], u, v;
    for (u = 0; u < n - 1; u++) for (v = u + 1; v < n - 1; v++) if (edges.length < e) edges.push([u, v]);
    for (u = 0; u < n - 1; u++) if (edges.length < e) edges.push([u, n - 1]);
    return edges;
  };

  /* ---- 平衡二叉树最少结点 ---- */
  DS.avlMin = function (h) {
    if (h <= 0) return 0;
    if (h === 1) return 1;
    var a = 0, b = 1;
    for (var i = 2; i <= h; i++) { var c = a + b + 1; a = b; b = c; }
    return b;
  };
  /* “最瘦”平衡二叉树：左子树高 h−1，右子树高 h−2；键按中序编号 */
  DS.avlMinTree = function (h) {
    var nodes = [];
    function build(hh, p) {
      if (hh <= 0) return -1;
      var id = nodes.length;
      nodes.push({ l: -1, r: -1, p: p, k: 0 });
      nodes[id].l = build(hh - 1, id);
      nodes[id].r = build(hh - 2, id);
      return id;
    }
    build(h, -1);
    var k = 0;
    (function ino(v) { if (v < 0) return; ino(nodes[v].l); nodes[v].k = ++k; ino(nodes[v].r); })(nodes.length ? 0 : -1);
    return nodes;
  };
  DS.balanceFactors = function (nodes) {
    return nodes.map(function (nd) { return DS.treeHeight(nodes, nd.l) - DS.treeHeight(nodes, nd.r); });
  };

  /* ---- B 树 ---- */
  DS.btreeKeys = function (m) { return { rootMin: 1, min: Math.ceil(m / 2) - 1, max: m - 1, minCh: Math.ceil(m / 2), maxCh: m }; };
  /* 高度 h（不含失败结点层）的 m 阶 B 树最少 / 最多关键字数 */
  DS.btreeLevelKeys = function (m, h) {
    var t = Math.ceil(m / 2);
    return { min: h <= 0 ? 0 : 2 * Math.pow(t, h - 1) - 1, max: Math.pow(m, h) - 1 };
  };
  DS.btreeHeight = function (m, n) {
    var hMin = 0;
    while (Math.pow(m, hMin) - 1 < n) hMin++;
    var hMax = 1;
    while (DS.btreeLevelKeys(m, hMax + 1).min <= n) hMax++;
    var t = Math.ceil(m / 2);
    return { hMin: hMin, hMax: hMax, fail: n + 1, lo: Math.log(n + 1) / Math.log(m), hi: Math.log((n + 1) / 2) / Math.log(t) + 1 };
  };

  /* ---- 红黑树（CLRS 插入，-1 表示 NIL） ---- */
  DS.rbInsertAll = function (keys) {
    var T = { nodes: [], root: -1 }, N = T.nodes;
    function rot(x, left) {
      var a = left ? "r" : "l", b = left ? "l" : "r";
      var y = N[x][a];
      N[x][a] = N[y][b];
      if (N[y][b] >= 0) N[N[y][b]].p = x;
      N[y].p = N[x].p;
      if (N[x].p < 0) T.root = y;
      else if (N[N[x].p].l === x) N[N[x].p].l = y;
      else N[N[x].p].r = y;
      N[y][b] = x;
      N[x].p = y;
    }
    function red(x) { return x >= 0 && N[x].c === "R"; }
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], y = -1, x = T.root, dup = false;
      while (x >= 0) { y = x; if (k === N[x].k) { dup = true; break; } x = k < N[x].k ? N[x].l : N[x].r; }
      if (dup) continue;
      var z = N.length;
      N.push({ k: k, c: "R", l: -1, r: -1, p: y });
      if (y < 0) T.root = z; else if (k < N[y].k) N[y].l = z; else N[y].r = z;
      while (red(N[z].p)) {
        var p = N[z].p, g = N[p].p, leftSide = N[g].l === p;
        var u = leftSide ? N[g].r : N[g].l;
        if (red(u)) { N[p].c = "B"; N[u].c = "B"; N[g].c = "R"; z = g; }
        else {
          if (leftSide && z === N[p].r) { z = p; rot(z, true); }
          else if (!leftSide && z === N[p].l) { z = p; rot(z, false); }
          p = N[z].p; g = N[p].p;
          N[p].c = "B"; N[g].c = "R";
          rot(g, !leftSide);
        }
      }
      N[T.root].c = "B";
    }
    return T;
  };
  DS.rbStats = function (T) {
    var N = T.nodes, ok = true;
    function h(v) { return v < 0 ? 0 : 1 + Math.max(h(N[v].l), h(N[v].r)); }
    function sh(v) { return v < 0 ? 0 : 1 + Math.min(sh(N[v].l), sh(N[v].r)); }
    function bh(v) {
      if (v < 0) return 1;
      var a = bh(N[v].l), b = bh(N[v].r);
      if (a !== b) ok = false;
      if (N[v].c === "R" && ((N[v].l >= 0 && N[N[v].l].c === "R") || (N[v].r >= 0 && N[N[v].r].c === "R"))) ok = false;
      return a + (N[v].c === "B" ? 1 : 0);
    }
    var n = N.length, r = T.root;
    var b = r < 0 ? 0 : bh(r) - 1; /* 黑高不含根结点自身，含 NIL：根为黑，所以 = 路径上内部黑结点数 */
    if (r >= 0 && N[r].c !== "B") ok = false;
    return { n: n, h: h(r), shortest: sh(r), longest: h(r), bh: b, bound: 2 * Math.log(n + 1) / Math.LN2, minInternal: Math.pow(2, b) - 1, valid: ok };
  };

  /* ---- 折半查找判定树与建堆 ---- */
  DS.bsearchHeight = function (n) { return DS.ceilLog2(n + 1); };
  DS.bsearchTree = function (n) {
    var nodes = [];
    function build(lo, hi, p) {
      if (lo > hi) return -1;
      var mid = Math.floor((lo + hi) / 2), id = nodes.length;
      nodes.push({ l: -1, r: -1, p: p, k: mid });
      nodes[id].l = build(lo, mid - 1, id);
      nodes[id].r = build(mid + 1, hi, id);
      return id;
    }
    build(1, n, -1);
    return nodes;
  };
  /* 实际跑折半查找：查找表中每个元素（成功）和每个间隙（失败）的比较次数最大值 */
  DS.bsearchMaxCmp = function (n) {
    function run(x) {
      var lo = 1, hi = n, c = 0;
      while (lo <= hi) {
        var mid = Math.floor((lo + hi) / 2);
        c++;
        if (x === mid) return c;
        if (x < mid) hi = mid - 1; else lo = mid + 1;
      }
      return c;
    }
    var succ = 0, fail = 0, i;
    for (i = 1; i <= n; i++) succ = Math.max(succ, run(i));
    for (i = 0; i <= n; i++) fail = Math.max(fail, run(i + 0.5));
    return { succ: succ, fail: fail };
  };
  /* 自下而上建大根堆，统计关键字比较次数（下沉时两个孩子先比 1 次、再与较大者比 1 次；建堆比较次数不超过 4n） */
  DS.buildHeapCmp = function (arr) {
    var a = arr.slice(), n = a.length, cmp = 0;
    for (var s = Math.floor(n / 2) - 1; s >= 0; s--) {
      var i = s, x = a[i];
      for (var j = 2 * i + 1; j < n; j = 2 * j + 1) {
        if (j + 1 < n) { cmp++; if (a[j] < a[j + 1]) j++; }
        cmp++;
        if (x >= a[j]) break;
        a[i] = a[j]; i = j;
      }
      a[i] = x;
    }
    return { heap: a, cmp: cmp };
  };

  /* ---- 比较排序下界 ---- */
  DS.fact = function (n) { var f = 1; for (var i = 2; i <= n; i++) f *= i; return f; };
  DS.log2Fact = function (n) { return DS.ceilLog2(DS.fact(n)); };
  DS.sortCmp = function (a0, alg) {
    var a = a0.slice(), c = 0, i, j;
    if (alg === "insert") {
      for (i = 1; i < a.length; i++) {
        var x = a[i];
        for (j = i - 1; j >= 0; j--) { c++; if (a[j] > x) a[j + 1] = a[j]; else break; }
        a[j + 1] = x;
      }
    } else if (alg === "binsert") {
      for (i = 1; i < a.length; i++) {
        var y = a[i], lo = 0, hi = i - 1;
        while (lo <= hi) { var mid = Math.floor((lo + hi) / 2); c++; if (a[mid] > y) hi = mid - 1; else lo = mid + 1; }
        for (j = i - 1; j >= lo; j--) a[j + 1] = a[j];
        a[lo] = y;
      }
    } else if (alg === "merge") {
      var ms = function (lo2, hi2) {
        if (lo2 >= hi2) return;
        var m2 = Math.floor((lo2 + hi2) / 2);
        ms(lo2, m2); ms(m2 + 1, hi2);
        var b = [], p = lo2, q = m2 + 1;
        while (p <= m2 && q <= hi2) { c++; b.push(a[p] <= a[q] ? a[p++] : a[q++]); }
        while (p <= m2) b.push(a[p++]);
        while (q <= hi2) b.push(a[q++]);
        for (var k = 0; k < b.length; k++) a[lo2 + k] = b[k];
      };
      ms(0, a.length - 1);
    } else if (alg === "select") {
      for (i = 0; i < a.length - 1; i++) {
        var mn = i;
        for (j = i + 1; j < a.length; j++) { c++; if (a[j] < a[mn]) mn = j; }
        var t = a[i]; a[i] = a[mn]; a[mn] = t;
      }
    }
    return { sorted: a, cmp: c };
  };
  DS.sortWorstCmp = function (n, alg) {
    var ps = DS.permutations(n), w = 0;
    for (var i = 0; i < ps.length; i++) w = Math.max(w, DS.sortCmp(ps[i], alg).cmp);
    return w;
  };
  DS.SORTS = [
    { name: "直接插入排序", best: "O(n)", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: true, nlogn: false, o1: true },
    { name: "折半插入排序", best: "O(n log n)", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: true, nlogn: false, o1: true, note: "比较 O(n log n)，移动仍 O(n²)" },
    { name: "希尔排序", best: "—", avg: "约 O(n^1.3)", worst: "O(n²)", space: "O(1)", stable: false, nlogn: false, o1: true, note: "依增量序列而定" },
    { name: "冒泡排序", best: "O(n)", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: true, nlogn: false, o1: true },
    { name: "快速排序", best: "O(n log n)", avg: "O(n log n)", worst: "O(n²)", space: "O(log n)", stable: false, nlogn: false, o1: false, note: "递归栈最坏 O(n)" },
    { name: "简单选择排序", best: "O(n²)", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: false, nlogn: false, o1: true },
    { name: "堆排序", best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(1)", stable: false, nlogn: true, o1: true },
    { name: "二路归并排序", best: "O(n log n)", avg: "O(n log n)", worst: "O(n log n)", space: "O(n)", stable: true, nlogn: true, o1: false },
    { name: "基数排序", best: "O(d(n+r))", avg: "O(d(n+r))", worst: "O(d(n+r))", space: "O(r)", stable: true, nlogn: false, o1: false, note: "不基于比较" },
    { name: "计数排序", best: "O(n+k)", avg: "O(n+k)", worst: "O(n+k)", space: "O(n+k)", stable: true, nlogn: false, o1: false, note: "不基于比较" }
  ];

  /* ===================== demo 公用：DOM、SVG、布局 ===================== */
  var NS = "http://www.w3.org/2000/svg";
  function kit(box) {
    var doc = box.ownerDocument || document;
    var offs = [], timers = [];
    var K = {
      doc: doc,
      el: function (tag, attrs, text, parent) {
        var n = doc.createElement(tag);
        for (var k in attrs || {}) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
        if (text != null) n.textContent = text;
        if (parent) parent.appendChild(n);
        return n;
      },
      svg: function (tag, attrs, parent, text) {
        var n = doc.createElementNS(NS, tag);
        for (var k in attrs || {}) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
        if (text != null) n.textContent = text;
        if (parent) parent.appendChild(n);
        return n;
      },
      on: function (el, type, fn) { el.addEventListener(type, fn); offs.push([el, type, fn]); },
      later: function (fn, ms) { var t = setTimeout(function () { timers.splice(timers.indexOf(t), 1); fn(); }, ms); timers.push(t); return t; },
      stop: function () { while (timers.length) clearTimeout(timers.pop()); },
      clear: function (n) { while (n.firstChild) n.removeChild(n.firstChild); }
    };
    K.root = K.el("div", { class: "x-pd" }, null, box);
    K.ctrl = K.el("div", { class: "x-pd__ctrl" }, null, K.root);
    K.stage = K.el("div", { class: "x-pd__stage" }, null, K.root);
    K.out = K.el("div", { class: "x-pd__out", "aria-live": "polite" }, null, K.root);
    K.btn = function (text, fn, main, parent) {
      var b = K.el("button", { type: "button", class: "x-lab__btn" + (main ? " x-lab__btn--main" : "") }, text, parent || K.ctrl);
      K.on(b, "click", fn);
      return b;
    };
    /* 一组互斥按钮，aria-pressed 表示当前项 */
    K.seg = function (label, items, cur, fn, parent) {
      var g = K.el("div", { class: "x-pd__seg", role: "group", "aria-label": label }, null, parent || K.ctrl);
      K.el("span", { class: "x-pd__lbl" }, label, g);
      var bs = items.map(function (it) {
        var b = K.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": String(it[0] === cur) }, it[1], g);
        K.on(b, "click", function () { set(it[0]); fn(it[0]); });
        return b;
      });
      function set(v) { bs.forEach(function (b, i) { b.setAttribute("aria-pressed", String(items[i][0] === v)); }); }
      return { set: set, buttons: bs };
    };
    /* 滑块 + 数值 */
    K.range = function (label, min, max, val, fn, parent) {
      var w = K.el("label", { class: "x-pd__rng" }, null, parent || K.ctrl);
      K.el("span", { class: "x-pd__lbl" }, label, w);
      var r = K.el("input", { type: "range", min: String(min), max: String(max), step: "1", value: String(val) }, null, w);
      var o = K.el("b", { class: "x-pd__val" }, String(val), w);
      K.on(r, "input", function () { o.textContent = r.value; fn(Number(r.value)); });
      return { input: r, set: function (v) { r.value = String(v); o.textContent = String(v); }, get: function () { return Number(r.value); }, setMax: function (m) { r.max = String(m); if (Number(r.value) > m) { r.value = String(m); o.textContent = String(m); } } };
    };
    K.text = function (label, val, parent, wide) {
      var w = K.el("label", { class: "x-pd__fld" + (wide ? " x-pd__fld--w" : "") }, null, parent || K.ctrl);
      K.el("span", { class: "x-pd__lbl" }, label, w);
      return K.el("input", { type: "text", class: "x-lab__in x-pd__in", value: val, spellcheck: "false", autocomplete: "off" }, null, w);
    };
    K.br = function (parent) { return K.el("div", { class: "x-pd__br" }, null, parent || K.ctrl); };
    /* 画布：viewBox 宽 720 */
    K.canvas = function (h, label) {
      K.clear(K.stage);
      var s = K.svg("svg", { viewBox: "0 0 720 " + h, class: "x-pd__svg", role: "img", "aria-label": label || "验证图" }, K.stage);
      return s;
    };
    /* 读数：rows = [[名称, 值], …]；eqs = [[左边文字, 右边文字, 是否成立], …] */
    K.show = function (rows, eqs, note, err) {
      K.clear(K.out);
      if (err) { K.el("p", { class: "x-pd__err", role: "alert" }, err, K.out); return; }
      if (rows && rows.length) {
        var dl = K.el("dl", { class: "x-pd__kv" }, null, K.out);
        rows.forEach(function (r) {
          var d = K.el("div", null, null, dl);
          K.el("dt", null, r[0], d);
          K.el("dd", null, String(r[1]), d);
        });
      }
      (eqs || []).forEach(function (e) {
        var p = K.el("p", { class: "x-pd__eq" + (e[2] ? " is-ok" : " is-bad") }, null, K.out);
        K.el("span", { class: "x-pd__side" }, e[0], p);
        K.el("span", { class: "x-pd__rel" }, e[2] ? "✓" : "✗", p);
        K.el("span", { class: "x-pd__side" }, e[1], p);
      });
      if (note) K.el("p", { class: "x-pd__note" }, note, K.out);
    };
    K.destroy = function () {
      K.stop();
      while (offs.length) { var o = offs.pop(); o[0].removeEventListener(o[1], o[2]); }
      if (K.root.parentNode) K.root.parentNode.removeChild(K.root);
    };
    return K;
  }

  /* 二叉树布局：x 按中序序号，y 按深度。返回 { pos: [[x,y]], depth } */
  function layoutBinary(nodes, root, W, top, dy) {
    var order = [], dep = [], maxD = 0;
    (function ino(v, d) {
      if (v < 0) return;
      ino(nodes[v].l, d + 1);
      order.push(v); dep[v] = d; if (d > maxD) maxD = d;
      ino(nodes[v].r, d + 1);
    })(root, 0);
    var pos = [], N = order.length, pad = 26;
    order.forEach(function (v, i) { pos[v] = [pad + (i + 0.5) * (W - 2 * pad) / Math.max(N, 1), top + dep[v] * dy]; });
    return { pos: pos, depth: maxD + 1 };
  }
  /* 多叉树 / 森林布局：叶子依次占位，内部结点居中 */
  function layoutForest(nodes, roots, W, top, dy, childOf) {
    var slot = 0, pos = [], maxD = 0, tmp = [];
    function go(v, d) {
      if (d > maxD) maxD = d;
      var ch = childOf(v);
      if (!ch.length) { tmp[v] = [slot++, d]; return; }
      ch.forEach(function (c) { go(c, d + 1); });
      tmp[v] = [(tmp[ch[0]][0] + tmp[ch[ch.length - 1]][0]) / 2, d];
    }
    roots.forEach(function (r, i) { if (i) slot += 0.6; go(r, 0); });
    var span = Math.max(slot - 1, 1), pad = 30;
    for (var v = 0; v < nodes.length; v++) if (tmp[v]) pos[v] = [slot <= 1 ? W / 2 : pad + tmp[v][0] * (W - 2 * pad) / span, top + tmp[v][1] * dy];
    return { pos: pos, depth: maxD + 1 };
  }
  function drawEdge(K, g, a, b, cls) { return K.svg("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "x-pd-edge" + (cls ? " " + cls : "") }, g); }
  function drawNode(K, g, p, label, cls, r) {
    var gg = K.svg("g", { class: "x-pd-node" + (cls ? " " + cls : ""), transform: "translate(" + p[0].toFixed(1) + "," + p[1].toFixed(1) + ")" }, g);
    K.svg("circle", { r: r || 15 }, gg);
    if (label != null && label !== "") K.svg("text", { "text-anchor": "middle", dy: "0.35em" }, gg, String(label));
    return gg;
  }
  function drawBinary(K, svg, nodes, root, o) {
    o = o || {};
    var L = layoutBinary(nodes, root, 720, o.top || 30, o.dy || 52);
    var ge = K.svg("g", null, svg), gn = K.svg("g", null, svg), els = [];
    for (var v = 0; v < nodes.length; v++) {
      if (!L.pos[v]) continue;
      ["l", "r"].forEach(function (s) {
        var c = nodes[v][s];
        if (c >= 0) drawEdge(K, ge, L.pos[v], L.pos[c], o.edgeCls ? o.edgeCls(v, c) : "");
        else if (o.nulls) {
          var p = L.pos[v], q = [p[0] + (s === "l" ? -16 : 16), p[1] + 30];
          drawEdge(K, ge, p, q, "is-null");
          K.svg("rect", { x: q[0] - 5, y: q[1], width: 10, height: 10, class: "x-pd-nil" }, ge);
        }
      });
    }
    for (v = 0; v < nodes.length; v++) {
      if (!L.pos[v]) continue;
      els[v] = drawNode(K, gn, L.pos[v], o.label ? o.label(v) : "", o.cls ? o.cls(v) : "", o.r);
    }
    return { pos: L.pos, depth: L.depth, els: els };
  }
  function fmt(x, d) { return Number(x).toFixed(d == null ? 2 : d).replace(/\.?0+$/, ""); }
  function sup(n) {
    var m = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
    return String(n).split("").map(function (c) { return m[c] || c; }).join("");
  }

  /* ===================== 1. 二叉树叶子结点数 ===================== */
  PROP.push({
    id: "ds-leaf", sub: "ds", ch: "第 4 章 树与二叉树", name: "二叉树叶子结点数：n₀ = n₂ + 1", toc: "叶子数 n₀ = n₂ + 1",
    def: "结点的度：结点拥有的子树（孩子）个数。n₀、n₁、n₂ 分别表示度为 0（叶子）、1、2 的结点个数。",
    stmt: ["任意非空二叉树中：**n₀ = n₂ + 1**", "推广到度为 m 的树：n₀ = 1 + n₂ + 2n₃ + … + (m−1)nₘ"],
    cond: "对任意非空二叉树成立，与形态无关，也不要求是完全二叉树；m 叉树（或度为 m 的树）要换成推广式 n₀ = 1 + Σ(i−1)nᵢ；森林中把开头的 1 换成树的棵数 k。",
    proof: [
      "设度为 0、1、2 的结点数分别为 n₀、n₁、n₂，结点总数 n = n₀ + n₁ + n₂。",
      "除根结点外，每个结点都恰有一个分支（来自双亲）指向它，所以分支数 B = n − 1。",
      "分支都由度为 1 或 2 的结点发出：度为 1 的发出 1 个，度为 2 的发出 2 个，所以 B = n₁ + 2n₂。",
      "联立：n₀ + n₁ + n₂ − 1 = n₁ + 2n₂。",
      "化简得 **n₀ = n₂ + 1**，n₁ 被消去，所以叶子数与度为 1 的结点多少无关。",
      "推广：度为 m 的树中 B = n₁ + 2n₂ + … + m·nₘ = n − 1，同样消去可得 n₀ = 1 + n₂ + 2n₃ + … + (m−1)nₘ。"
    ],
    traps: [
      "n₁ 不参与公式：已知 n₁ 和 n₂ 求 n₀ 时 n₁ 是干扰条件；但求结点总数 n 时 n₁ 必须加上。",
      "度为 m 的树不能直接套 n₀ = n₂ + 1，要用 n₀ = 1 + Σ(i−1)nᵢ，度为 3 的结点要乘 2、度为 4 的乘 3。",
      "完全二叉树给出总数 n 时，先由 n 的奇偶确定 n₁（0 或 1），再用 n₀ = n₂ + 1 联立求解。"
    ],
    ex: {
      q: "一棵二叉树共有 50 个度为 2 的结点和 30 个度为 1 的结点，则该二叉树的结点总数是（ ）。",
      opts: ["101", "130", "131", "81"],
      a: 2,
      why: "n₀ = n₂ + 1 = 51，总数 n = n₀ + n₁ + n₂ = 51 + 30 + 50 = 131。选 A 是只算了 n₀ + n₂；选 B 是把 n₀ 当成 n₂ 忘了 +1。",
      src: "典型题"
    },
    links: { lab: ["tree"], proc: ["forest"] },
    demo: function (box) {
      var K = kit(box), rnd = Math.random, nodes = [], hl = -1;
      var rg = K.range("结点数 n", 1, 20, 9, function (v) { nodes = DS.randomBinaryTree(v, rnd); hl = -1; draw(); });
      K.btn("随机生成", function () { nodes = DS.randomBinaryTree(rg.get(), rnd); hl = -1; draw(); }, true);
      var add = K.btn("加一个结点", function () {
        if (nodes.length >= 20) { draw("最多 20 个结点，图里放不下更多，可以点“随机生成”重来"); return; }
        hl = DS.addRandomNode(nodes, rnd); rg.set(nodes.length); draw();
      });
      function draw(err) {
        var c = DS.binaryCounts(nodes), h = DS.treeHeight(nodes);
        var svg = K.canvas(Math.max(150, 40 + h * 50), "随机二叉树，叶子、度为 1、度为 2 的结点用不同样式标出");
        drawBinary(K, svg, nodes, 0, {
          dy: 50,
          cls: function (v) {
            var d = (nodes[v].l >= 0 ? 1 : 0) + (nodes[v].r >= 0 ? 1 : 0);
            return "is-d" + d + (v === hl ? " is-new" : "");
          },
          label: function (v) { return (nodes[v].l >= 0 ? 1 : 0) + (nodes[v].r >= 0 ? 1 : 0); }
        });
        add.disabled = nodes.length >= 20;
        K.show([["结点总数 n", c.n], ["n₀（叶子）", c.n0], ["n₁", c.n1], ["n₂", c.n2], ["分支数 B = n − 1", c.n - 1], ["n₁ + 2n₂", c.n1 + 2 * c.n2]],
          [["n₀ = " + c.n0, "n₂ + 1 = " + (c.n2 + 1), c.n0 === c.n2 + 1], ["B = n − 1 = " + (c.n - 1), "n₁ + 2n₂ = " + (c.n1 + 2 * c.n2), c.n - 1 === c.n1 + 2 * c.n2]],
          (err ? err + "。" : "") + "结点里的数字是它的度。不管怎么加结点，n₀ 总比 n₂ 多 1：给叶子加孩子，n₀ 不变、n₂ 不变或同时各加 1。");
      }
      nodes = DS.randomBinaryTree(9, rnd); draw();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 2. 二叉树结点数上界 ===================== */
  PROP.push({
    id: "ds-maxnodes", sub: "ds", ch: "第 4 章 树与二叉树", name: "二叉树的结点数上界：2^(i−1) 与 2^h − 1", toc: "二叉树结点上界",
    def: "层次：根为第 1 层；高度（深度）h：树中结点的最大层数。满二叉树：每一层都放满的二叉树。",
    stmt: ["第 i 层最多有 **2^(i−1)** 个结点（i ≥ 1）", "高度为 h 的二叉树最多有 **2^h − 1** 个结点，此时为满二叉树", "高度为 h 的二叉树最少有 h 个结点（每层一个）"],
    cond: "以根为第 1 层计。若题目规定根在第 0 层，则第 i 层最多 2^i 个、高度 h 最多 2^(h+1) − 1 个；m 叉树对应为 m^(i−1) 和 (m^h − 1)/(m − 1)。",
    proof: [
      "第 1 层只有根，1 = 2⁰ 个。",
      "每个结点最多 2 个孩子，所以第 i + 1 层的结点数最多是第 i 层的 2 倍。",
      "归纳得第 i 层最多 2^(i−1) 个结点。",
      "高度为 h 时各层都取最大值相加：1 + 2 + 4 + … + 2^(h−1)。",
      "等比数列求和得 2^h − 1，所有层都放满时取到，即满二叉树。"
    ],
    traps: [
      "先确认题目把根算作第 0 层还是第 1 层，层号差 1，后面所有结果都跟着错一位。",
      "“第 i 层最多 2^(i−1)”是单层，“高度 h 最多 2^h − 1”是累计，别混用。",
      "反过来求高度：n 个结点的二叉树高度至少 ⌈log₂(n+1)⌉，最多 n。"
    ],
    ex: {
      q: "一棵高度为 5 的二叉树（根在第 1 层），其结点数最多和最少分别是（ ）。",
      opts: ["31 和 5", "32 和 5", "31 和 6", "16 和 5"],
      a: 0,
      why: "最多为满二叉树 2⁵ − 1 = 31；最少每层只有一个结点，共 5 个。选 D 是把第 5 层最多 2⁴ = 16 个误当成总数。",
      src: "典型题"
    },
    links: { lab: ["tree"], proc: [] },
    demo: function (box) {
      var K = kit(box), h = 4, filled = 0, playing = false;
      var rg = K.range("高度 h", 1, 5, h, function (v) { h = v; filled = 0; K.stop(); playing = false; draw(); });
      var play = K.btn("逐层填满", function () {
        K.stop(); filled = 0; playing = true; draw();
        (function next() { if (filled >= h) { playing = false; draw(); return; } filled++; draw(); K.later(next, 650); })();
      }, true);
      K.btn("下一层", function () { K.stop(); playing = false; if (filled < h) filled++; draw(); });
      K.btn("清空", function () { K.stop(); playing = false; filled = 0; draw(); });
      function draw() {
        var svg = K.canvas(40 + h * 56, "满二叉树逐层填满");
        var ge = K.svg("g", null, svg), gn = K.svg("g", null, svg), total = 0, rows = [];
        for (var i = 1; i <= h; i++) {
          var cnt = DS.levelMax(i), y = 30 + (i - 1) * 56;
          for (var j = 0; j < cnt; j++) {
            var x = 64 + (j + 0.5) * 640 / cnt;
            if (i > 1) { var px = 64 + (Math.floor(j / 2) + 0.5) * 640 / (cnt / 2); drawEdge(K, ge, [px, y - 56], [x, y], i <= filled ? "" : "is-ghost"); }
            drawNode(K, gn, [x, y], null, i <= filled ? "is-on" : "is-ghost", 15);
          }
          K.svg("text", { x: 4, y: y + 5, class: "x-pd-txt" }, gn, "第" + i + "层");
          if (i <= filled) total += cnt;
          rows.push(["第 " + i + " 层", (i <= filled ? cnt : 0) + " / 最多 2" + sup(i - 1) + " = " + cnt]);
        }
        rg.input.disabled = playing;
        play.disabled = playing;
        K.show(rows.slice(0, Math.max(filled, 1)).concat([["已放结点", total]]),
          filled ? [["已填 " + filled + " 层共 " + total + " 个", "2" + sup(filled) + " − 1 = " + (DS.heightMax(filled)), total === DS.heightMax(filled)]] : [],
          "高度 h = " + h + " 的二叉树最多 2" + sup(h) + " − 1 = " + DS.heightMax(h) + " 个结点（满二叉树），最少 " + h + " 个。");
      }
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 3. 完全二叉树的高度与编号 ===================== */
  PROP.push({
    id: "ds-complete", sub: "ds", ch: "第 4 章 树与二叉树", name: "完全二叉树的高度与编号", toc: "完全二叉树高度",
    def: "完全二叉树：高度为 h、有 n 个结点，每个结点都与同高度满二叉树中编号 1 ~ n 的结点一一对应（按层从左到右编号）。",
    stmt: [
      "高度 **h = ⌈log₂(n+1)⌉ = ⌊log₂n⌋ + 1**",
      "编号 i 的结点：父结点 ⌊i/2⌋（i > 1），左孩子 2i（2i ≤ n），右孩子 2i + 1（2i + 1 ≤ n）",
      "叶子数 ⌈n/2⌉，最后一个非叶结点编号 ⌊n/2⌋；度为 1 的结点至多 1 个（n 为偶数时恰有 1 个）"
    ],
    cond: "编号从 1 开始。若数组下标从 0 开始（如堆的顺序存储），父结点为 ⌊(i−1)/2⌋、左孩子 2i + 1、右孩子 2i + 2。两种高度写法等价，按题目选项给出的形式对照即可。",
    proof: [
      "高度为 h 的完全二叉树，前 h − 1 层是满的，第 h 层至少 1 个：2^(h−1) − 1 < n ≤ 2^h − 1。",
      "即 2^(h−1) < n + 1 ≤ 2^h，取对数得 h = ⌈log₂(n+1)⌉；同理 2^(h−1) ≤ n < 2^h 得 h = ⌊log₂n⌋ + 1。",
      "按层编号时第 k 层第一个结点编号 2^(k−1)，第 j 个结点的孩子在下一层第 2j − 1、2j 个位置，换算成编号即 2i、2i + 1。",
      "所以 i 的父结点为 ⌊i/2⌋；当 2i > n 时 i 没有左孩子，即 i > ⌊n/2⌋ 的结点都是叶子。",
      "非叶结点编号 1 ~ ⌊n/2⌋，叶子数 n − ⌊n/2⌋ = ⌈n/2⌉。",
      "只有编号 n/2 的结点可能只有左孩子（n 为偶数时），所以 n₁ = 0 或 1。"
    ],
    traps: [
      "下标从 0 还是从 1 开始，孩子和父结点公式不同。",
      "⌈log₂(n+1)⌉ 与 ⌈log₂n⌉ 不同：n = 8 时前者是 4，后者是 3（错）。",
      "已知某层叶子数求“最多结点数”时，要考虑叶子在倒数第二层、最后一层还能再放的情况。"
    ],
    ex: {
      q: "一棵完全二叉树（根在第 1 层）的第 6 层上有 8 个叶结点。这棵树最多能有多少个结点？（ ）",
      opts: ["39", "52", "111", "119"],
      a: 2,
      why: "结点最多时树高为 7：前 6 层满共 63 个；第 6 层 32 个结点中 8 个是叶子，其余 24 个各有 2 个孩子，第 7 层 48 个，共 63 + 48 = 111。选 A 是把第 6 层当成最后一层（31 + 8）。",
      src: "2009 年真题"
    },
    links: { lab: ["tree"], proc: ["heapop"] },
    demo: function (box) {
      var K = kit(box), n = 12, sel = 5;
      var rg = K.range("结点数 n", 1, 31, n, function (v) { n = v; if (sel > n) sel = n; draw(); });
      var inp = K.text("查看编号 i", String(sel));
      K.btn("高亮", function () {
        var t = inp.value.trim();
        if (!/^\d+$/.test(t)) { draw("编号要是正整数"); return; }
        var v = Number(t);
        if (v < 1 || v > n) { draw("编号要在 1 ~ " + n + " 之间"); return; }
        sel = v; draw();
      }, true);
      function draw(err) {
        var info = DS.completeInfo(n), rel = DS.completeRel(n, sel);
        var svg = K.canvas(40 + info.h * 58, "完全二叉树按层编号，点击结点查看父结点与孩子");
        var ge = K.svg("g", null, svg), gn = K.svg("g", null, svg), pos = [];
        for (var i = 1; i <= n; i++) {
          var d = DS.floorLog2(i), first = Math.pow(2, d), cnt = Math.pow(2, d);
          pos[i] = [30 + (i - first + 0.5) * 660 / cnt, 30 + d * 58];
        }
        for (i = 2; i <= n; i++) drawEdge(K, ge, pos[Math.floor(i / 2)], pos[i], (i === sel || Math.floor(i / 2) === sel) ? "is-hl" : "");
        for (i = 1; i <= n; i++) {
          var c = i === sel ? "is-sel" : i === rel.parent ? "is-par" : (i === rel.left || i === rel.right) ? "is-kid" : i > info.lastInternal ? "is-leaf" : "";
          var g = drawNode(K, gn, pos[i], i, c, 15);
          g.setAttribute("tabindex", "0");
          g.setAttribute("role", "button");
          g.setAttribute("aria-label", "结点 " + i);
          (function (v, el) {
            K.on(el, "click", function () { sel = v; inp.value = String(v); draw(); });
            K.on(el, "keydown", function (e) { if (e.key === "Enter" || e.key === " ") { sel = v; inp.value = String(v); draw(); } });
          })(i, g);
        }
        var real = 0, leaves = 0, n1 = 0;
        for (i = 1; i <= n; i++) { var kids = (2 * i <= n ? 1 : 0) + (2 * i + 1 <= n ? 1 : 0); if (!kids) leaves++; if (kids === 1) n1++; real = Math.max(real, DS.floorLog2(i) + 1); }
        K.show([
          ["选中结点 i", sel],
          ["父结点 ⌊i/2⌋", rel.parent == null ? "无（根）" : rel.parent],
          ["左孩子 2i", rel.left == null ? "无（2i > n）" : rel.left],
          ["右孩子 2i+1", rel.right == null ? "无" : rel.right]
        ], [
          ["实际高度 " + real, "⌈log₂(n+1)⌉ = " + info.h + "，⌊log₂n⌋+1 = " + info.h2, real === info.h && info.h === info.h2],
          ["数出的叶子 " + leaves, "⌈n/2⌉ = " + info.leaves, leaves === info.leaves],
          ["数出的 n₁ = " + n1, n % 2 ? "n 为奇数，n₁ = 0" : "n 为偶数，n₁ = 1", n1 === info.n1]
        ], "最后一个非叶结点编号 ⌊n/2⌋ = " + info.lastInternal + "，比它大的都是叶子（浅色）。");
        if (err) K.el("p", { class: "x-pd__err", role: "alert" }, err, K.out);
      }
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 4. 空指针数 ===================== */
  PROP.push({
    id: "ds-nullptr", sub: "ds", ch: "第 4 章 树与二叉树", name: "二叉链表的空指针数：n + 1", toc: "空指针数 n + 1",
    def: "二叉链表：每个结点有 lchild、rchild 两个指针域。线索二叉树：把空指针改为指向遍历序列中前驱、后继的“线索”。",
    stmt: ["n 个结点的二叉链表共有 **2n** 个指针域", "其中非空指针 **n − 1** 个，空指针 **n + 1** 个", "线索化后 n + 1 个空指针都变成线索（中序线索树中只剩第一个结点的左线索和最后一个结点的右线索指向 NULL 或头结点）"],
    cond: "对任意 n ≥ 1 个结点的二叉链表成立；三叉链表（多一个 parent 指针）有 3n 个指针域，空指针数为 n + 2（根的 parent 也为空）。孩子兄弟表示法存树时同样是二叉链表，空指针也是 n + 1。",
    proof: [
      "每个结点 2 个指针域，n 个结点共 2n 个。",
      "非空指针恰好对应树的分支，每个非根结点被唯一一个分支指向，所以非空指针数 = n − 1。",
      "空指针数 = 2n − (n − 1) = n + 1。",
      "另一种算法：空指针 = 2n₀ + n₁ = n₀ + n₁ + (n₂ + 1) = n + 1，与 n₀ = n₂ + 1 一致。",
      "线索二叉树正是利用这 n + 1 个空链域存放前驱和后继，用 ltag、rtag 区分孩子与线索。"
    ],
    traps: [
      "空指针是 n + 1，不是 n − 1（那是非空指针数），也不是 n。",
      "三叉链表多一个 parent 域，空指针变为 n + 2。",
      "中序线索化后仍有 2 个指针为 NULL（若无头结点），不是全部线索都有指向。"
    ],
    ex: {
      q: "在一棵有 n 个结点的二叉树的二叉链表中，用于存放线索的空链域有（ ）个。",
      opts: ["n − 1", "n", "n + 1", "2n"],
      a: 2,
      why: "共 2n 个链域，n − 1 个用于连接孩子（每个非根结点一个），剩下 n + 1 个为空，可以存放线索。",
      src: "典型题"
    },
    links: { lab: ["tree"], proc: ["thread"] },
    demo: function (box) {
      var K = kit(box), rnd = Math.random, nodes = [];
      var rg = K.range("结点数 n", 1, 16, 7, function (v) { nodes = DS.randomBinaryTree(v, rnd); draw(); });
      K.btn("随机生成", function () { nodes = DS.randomBinaryTree(rg.get(), rnd); draw(); }, true);
      var add = K.btn("加一个结点", function () { if (nodes.length < 16) { DS.addRandomNode(nodes, rnd); rg.set(nodes.length); } draw(); });
      function draw() {
        var c = DS.binaryCounts(nodes), h = DS.treeHeight(nodes);
        var svg = K.canvas(80 + h * 54, "二叉链表，小方块表示空指针");
        drawBinary(K, svg, nodes, 0, { dy: 54, nulls: true, label: function () { return ""; } });
        add.disabled = nodes.length >= 16;
        var np = DS.nullPointers(c.n);
        K.show([["指针域 2n", 2 * c.n], ["非空指针（实线）", c.branches], ["空指针（小方块）", c.nullPtr], ["2n₀ + n₁", 2 * c.n0 + c.n1]],
          [["空指针 " + c.nullPtr, "n + 1 = " + np.nul, c.nullPtr === np.nul], ["非空指针 " + c.branches, "n − 1 = " + np.nonNull, c.branches === np.nonNull]],
          "这 n + 1 个空指针就是中序线索化时可以用来存放前驱、后继的位置。");
      }
      nodes = DS.randomBinaryTree(7, rnd); draw();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 5. 卡特兰数 ===================== */
  PROP.push({
    id: "ds-catalan", sub: "ds", ch: "第 3 章 栈、队列和数组", name: "卡特兰数：C(2n, n)/(n+1)", toc: "卡特兰数",
    def: "卡特兰数 Cₙ = C(2n, n)/(n+1)，C₀ … C₆ 依次为 1、1、2、5、14、42、132。",
    stmt: ["n 个不同元素按固定次序进栈，合法出栈序列有 **C(2n, n)/(n+1)** 种", "n 个结点能构成的不同形态二叉树有 C(2n, n)/(n+1) 种", "先序序列固定时，不同二叉树的个数也是 C(2n, n)/(n+1)（先序看作进栈次序，中序看作出栈次序）"],
    cond: "进栈次序固定、出栈可在任意时刻进行；元素互不相同。若问“n 个结点的不同二叉排序树”也是卡特兰数，但若问“n 个带标号结点的不同二叉树”要再乘 n!。",
    proof: [
      "把一次进栈记作 +1、一次出栈记作 −1，一个出栈序列对应一个由 n 个 +1 和 n 个 −1 组成的操作串。",
      "操作串合法当且仅当任一前缀中 +1 的个数不少于 −1 的个数（栈空时不能出栈）。",
      "全部操作串共 C(2n, n) 个；不合法的串在第一次前缀和为 −1 处之后把 +1、−1 互换，得到含 n + 1 个 −1 的串，这是一一对应。",
      "所以不合法的有 C(2n, n+1) 个，合法的有 C(2n, n) − C(2n, n+1) = C(2n, n)/(n+1)。",
      "先序 + 中序唯一确定二叉树，先序序列相当于进栈次序、中序序列相当于出栈次序，所以不同二叉树的个数也是卡特兰数。"
    ],
    traps: [
      "是 C(2n, n)/(n+1)，不是 C(2n, n)/n，也不是 n!。n = 4 时是 14 而不是 24。",
      "判断单个出栈序列是否合法：出栈元素后面比它小的元素必须按递减顺序出现（不能出现“3 1 2”模式）。",
      "“n 个结点的不同形态二叉树”是卡特兰数；“n 个结点能组成多少棵不同的树（一般树）”是 C(n−1)。"
    ],
    ex: {
      q: "若一棵二叉树的先序序列是 a、b、c、d，满足这个条件的二叉树一共有几种不同形态？（ ）",
      opts: ["13", "14", "15", "16"],
      a: 1,
      why: "先序序列固定，相当于进栈次序为 a、b、c、d，中序序列对应出栈序列，不同二叉树个数 = C(8, 4)/5 = 70/5 = 14。",
      src: "2015 年真题"
    },
    links: { lab: ["infix", "tree"], proc: ["recursion"] },
    demo: function (box) {
      var K = kit(box), n = 4;
      K.seg("元素个数 n", [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"]], n, function (v) { n = v; draw(); });
      K.br();
      var inp = K.text("判断序列", "3 2 4 1", null, true);
      K.btn("判断", function () { draw(true); }, true);
      function draw(check) {
        var all = DS.permutations(n), ok = all.filter(DS.isStackSeq), cat = DS.catalan(n);
        var svg = K.canvas(150, "全部排列中合法出栈序列所占比例");
        var W = 660, bw = W * ok.length / all.length;
        K.svg("rect", { x: 30, y: 40, width: W, height: 34, class: "x-pd-bar is-ghost" }, svg);
        K.svg("rect", { x: 30, y: 40, width: Math.max(bw, 2), height: 34, class: "x-pd-bar is-on" }, svg);
        K.svg("text", { x: 30, y: 28, class: "x-pd-txt" }, svg, "合法 " + ok.length + " 个 / 全部排列 " + all.length + " 个（n! = " + all.length + "）");
        K.svg("text", { x: 30, y: 104, class: "x-pd-txt" }, svg, "C(2n, n)/(n+1) = C(" + 2 * n + ", " + n + ")/" + (n + 1) + " = " + DS.binom(2 * n, n) + "/" + (n + 1) + " = " + cat);
        K.svg("text", { x: 30, y: 130, class: "x-pd-txt x-pd-txt--mute" }, svg, "进栈次序 1, 2, …, " + n + "；逐个模拟每个排列能否用一个栈得到。");
        var msg = null, err = null;
        if (check) {
          var p = DS.parseSeq(inp.value, n);
          if (p.err) err = p.err;
          else msg = "序列 " + p.seq.join(" ") + (DS.isStackSeq(p.seq) ? " 是合法出栈序列" : " 不合法：某个元素出栈后，比它小且还没出栈的元素没有按递减顺序出栈");
        }
        K.show([["n", n], ["枚举得到的合法序列", ok.length], ["公式 C(2n,n)/(n+1)", cat]],
          [["枚举 " + ok.length + " 个", "公式 " + cat + " 个", ok.length === cat]], msg);
        if (err) K.el("p", { class: "x-pd__err", role: "alert" }, err, K.out);
        var list = K.el("ol", { class: "x-pd__list", "aria-label": "全部合法出栈序列" }, null, K.out);
        ok.forEach(function (s) { K.el("li", null, s.join(" "), list); });
      }
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 6. 树与森林 ===================== */
  PROP.push({
    id: "ds-forest", sub: "ds", ch: "第 4 章 树与二叉树", name: "树与森林的结点、度与边", toc: "树的结点、度与边",
    def: "树的度：树中结点的最大度数。森林：m（m ≥ 0）棵互不相交的树的集合。",
    stmt: ["树的结点数 = 所有结点的度之和 + 1", "度为 m 的树第 i 层最多 **m^(i−1)** 个结点；高度为 h 的 m 叉树最多 (m^h − 1)/(m − 1) 个结点", "n 个结点、k 棵树的森林有 **n − k** 条边；叶子数 n₀ = k + n₂ + 2n₃ + …"],
    cond: "“度为 m 的树”要求至少有一个结点度为 m；“m 叉树”只要求每个结点度不超过 m，可以为空树。高度为 h 的度为 m 的树最少有 h + m − 1 个结点。",
    proof: [
      "树中除根外每个结点有且只有一条边指向它，所以边数 = n − 1。",
      "每条边由双亲发出，边数也等于所有结点的度之和，所以 n = Σ度 + 1。",
      "度为 m 的树每个结点至多 m 个孩子，第 i 层结点数至多是第 i − 1 层的 m 倍，归纳得 m^(i−1)。",
      "森林中每棵树边数比结点数少 1，k 棵树共少 k，所以边数 = n − k。",
      "由 n = n₀ + n₁ + … 与 边数 = n₁ + 2n₂ + … = n − k 联立，得 n₀ = k + Σ(i−1)nᵢ；k = 1 时就是树的推广式。"
    ],
    traps: [
      "度为 m 的树与 m 叉树不同：前者至少有一个度为 m 的结点且非空。",
      "森林转二叉树后，森林的叶子数等于二叉树中左指针为空的结点数，不是二叉树的叶子数。",
      "已知结点数和边数求森林中树的棵数：k = n − 边数。"
    ],
    ex: {
      q: "某森林 F 共有 25 个结点、15 条边，它由几棵树组成？（ ）",
      opts: ["8", "9", "10", "11"],
      a: 2,
      why: "每棵树的结点数比边数多 1，森林的结点数比边数多的数目就是树的棵数：25 − 15 = 10。",
      src: "2016 年真题"
    },
    links: { lab: ["tree"], proc: ["forest"] },
    demo: function (box) {
      var K = kit(box), rnd = Math.random, nodes = [];
      var rn = K.range("结点数 n", 1, 18, 12, function () { gen(); });
      var rk = K.range("树的棵数 k", 1, 4, 2, function () { gen(); });
      var rm = K.range("最大度 m", 2, 4, 3, function () { gen(); });
      K.btn("随机生成", function () { gen(); }, true);
      function gen() {
        var n = rn.get(), k = rk.get();
        if (k > n) { draw("棵数 k 不能超过结点数 n，已改为 k = " + n); rk.set(n); k = n; }
        nodes = DS.randomForest(n, k, rm.get(), rnd);
        draw();
      }
      function draw(err) {
        var roots = [];
        nodes.forEach(function (nd, i) { if (nd.p < 0) roots.push(i); });
        var L = layoutForest(nodes, roots, 720, 30, 52, function (v) { return nodes[v].ch; });
        var svg = K.canvas(40 + L.depth * 52, "随机森林，结点中的数字为度");
        var ge = K.svg("g", null, svg), gn = K.svg("g", null, svg);
        nodes.forEach(function (nd, v) { nd.ch.forEach(function (c) { drawEdge(K, ge, L.pos[v], L.pos[c]); }); });
        nodes.forEach(function (nd, v) { drawNode(K, gn, L.pos[v], nd.ch.length, nd.p < 0 ? "is-root" : nd.ch.length ? "" : "is-leaf", 15); });
        var c = DS.forestCounts(nodes), parts = [];
        for (var d = 2; d <= c.maxDeg; d++) parts.push((d - 1) + "×" + c.cnt[d]);
        K.show([["结点数 n", c.n], ["棵数 k", c.k], ["边数", c.edges], ["度之和", c.degSum], ["各度结点数", c.cnt.map(function (x, i) { return "n" + i + "=" + x; }).join("，")]],
          [["边数 " + c.edges, "n − k = " + (c.n - c.k), c.edges === c.n - c.k],
           ["n = " + c.n, "Σ度 + k = " + (c.degSum + c.k), c.n === c.degSum + c.k],
           ["n₀ = " + c.n0, "k + " + (parts.length ? parts.join(" + ") : "0") + " = " + c.rhs, c.n0 === c.rhs]],
          (err ? err + "。" : "") + "深色为各棵树的根。k = 1 时就是一棵树：n = Σ度 + 1。");
      }
      gen();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 7. 哈夫曼树 ===================== */
  PROP.push({
    id: "ds-huffman", sub: "ds", ch: "第 4 章 树与二叉树", name: "哈夫曼树的结点数与虚结点", toc: "哈夫曼树结点数",
    def: "哈夫曼树：n 个带权叶子构成的所有二叉树中，带权路径长度 WPL 最小的二叉树，又称最优二叉树。",
    stmt: ["n 个叶子的哈夫曼树共 **2n − 1** 个结点，新建的 n − 1 个结点都是度为 2 的结点", "哈夫曼树中**没有度为 1 的结点**（严格二叉树）", "m 叉哈夫曼树：若 (n − 1) % (m − 1) ≠ 0，需补 **(m − 1) − (n − 1) % (m − 1)** 个权值为 0 的虚结点"],
    cond: "n ≥ 2。哈夫曼树形态不唯一（权值相同时选择不同），但 WPL 唯一；它不一定是完全二叉树。m 叉的补虚结点规则也用于外部排序中的最佳归并树。",
    proof: [
      "构造过程每次取两个权值最小的结点合并成一个新结点，森林中树的棵数减 1。",
      "从 n 棵树合并成 1 棵需要 n − 1 次，新建 n − 1 个结点。",
      "每个新结点恰好有 2 个孩子，所以总结点数 n + (n − 1) = 2n − 1，且没有度为 1 的结点（与 n₀ = n₂ + 1 一致）。",
      "m 叉时每次合并 m 棵树、减少 m − 1 棵，要从 n 棵正好减到 1 棵，必须 (n − 1) 是 m − 1 的倍数。",
      "不是倍数时补 (m − 1) − (n − 1) % (m − 1) 个权值为 0 的虚结点，放在最下层不增加 WPL。"
    ],
    traps: [
      "结点总数是 2n − 1，不是 2n 或 2n + 1；已知总数求 n 时 n = (总数 + 1)/2。",
      "哈夫曼树不一定是完全二叉树；权值最小的两个结点一定是兄弟，但层次最深的叶子不一定权值最小（只保证不大于更浅的叶子）。",
      "m 叉补虚结点时余数为 0 不用补；补的个数是 (m−1) − 余数，不是余数本身。"
    ],
    ex: {
      q: "给 n 个互不相同的符号做哈夫曼编码，得到的哈夫曼树一共 115 个结点，n 等于多少？（ ）",
      opts: ["56", "57", "58", "60"],
      a: 2,
      why: "哈夫曼树结点总数 2n − 1 = 115，解得 n = 58。选 B 是误用 2n + 1；选 A 是误用 2n + 3。",
      src: "2019 年真题"
    },
    links: { lab: ["huffman"], proc: ["extsort"] },
    demo: function (box) {
      var K = kit(box), m = 2;
      var inp = K.text("权值", "2 3 5 7 11 13", null, true);
      K.btn("构造", function () { draw(); }, true);
      K.btn("随机权值", function () {
        var c = 3 + Math.floor(Math.random() * 6), a = [];
        for (var i = 0; i < c; i++) a.push(1 + Math.floor(Math.random() * 30));
        inp.value = a.join(" "); draw();
      });
      K.br();
      K.seg("叉数 m", [[2, "二叉"], [3, "三叉"], [4, "四叉"]], m, function (v) { m = v; draw(); });
      function draw() {
        var p = DS.parseWeights(inp.value);
        if (p.err) { K.canvas(60, "输入有误"); K.show(null, null, null, p.err); return; }
        var H = DS.huffman(p.w, m), N = H.nodes;
        var L = layoutForest(N, [H.root], 720, 28, 54, function (v) { return N[v].ch; });
        var svg = K.canvas(40 + L.depth * 54, m + " 叉哈夫曼树");
        var ge = K.svg("g", null, svg), gn = K.svg("g", null, svg);
        N.forEach(function (nd, v) { nd.ch.forEach(function (c) { drawEdge(K, ge, L.pos[v], L.pos[c], N[c].dummy ? "is-null" : ""); }); });
        N.forEach(function (nd, v) { drawNode(K, gn, L.pos[v], nd.w, nd.dummy ? "is-dummy" : nd.leaf ? "is-leaf" : "", 16); });
        var leaves = H.n + H.dummy, internal = H.total - leaves;
        var eqs = [["度为 1 的结点 " + H.n1 + " 个", "应为 0", H.n1 === 0]];
        if (m === 2) eqs.unshift(["结点总数 " + H.total, "2n − 1 = " + (2 * H.n - 1), H.total === 2 * H.n - 1]);
        else eqs.unshift(["补虚结点 " + H.dummy + " 个", "(m−1) − (n−1)%(m−1) = " + ((H.n - 1) % (m - 1) ? (m - 1) - (H.n - 1) % (m - 1) : "0（余数为 0 不补）"), H.dummy === DS.huffmanDummy(H.n, m)],
          ["内部结点 " + internal + " 个", "(n + 虚结点 − 1)/(m − 1) = " + (leaves - 1) / (m - 1), internal === (leaves - 1) / (m - 1)]);
        K.show([["叶子数 n", H.n], ["虚结点", H.dummy], ["新建结点", internal], ["结点总数", H.total], ["WPL", H.wpl]], eqs,
          m === 2 ? "每合并一次新建一个度为 2 的结点，共 n − 1 次。" : "虚线连接的 0 是补上的虚结点，它们在最深层，不影响 WPL。");
      }
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 8. 图的度与边 ===================== */
  function circlePos(n, cx, cy, R) {
    var p = [];
    for (var i = 0; i < n; i++) { var a = -Math.PI / 2 + 2 * Math.PI * i / n; p.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
    return p;
  }
  function drawGraph(K, svg, n, edges, directed, o) {
    o = o || {};
    var P = o.pos || circlePos(n, 360, 150, 115), ge = K.svg("g", null, svg), gn = K.svg("g", null, svg);
    if (directed && !svg.querySelector("marker")) {
      var defs = K.svg("defs", null, svg), mk = K.svg("marker", { id: o.mid || "x-pd-arr", viewBox: "0 0 10 10", refX: "10", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" }, defs);
      K.svg("path", { d: "M0,0 L10,5 L0,10 z", class: "x-pd-arrow" }, mk);
    }
    edges.forEach(function (e) {
      var a = P[e[0]], b = P[e[1]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1, r = 17;
      var hasBack = directed && edges.some(function (f) { return f[0] === e[1] && f[1] === e[0]; });
      var ox = hasBack ? -dy / L * 5 : 0, oy = hasBack ? dx / L * 5 : 0;
      var ln = K.svg("line", { x1: a[0] + dx / L * r + ox, y1: a[1] + dy / L * r + oy, x2: b[0] - dx / L * r + ox, y2: b[1] - dy / L * r + oy, class: "x-pd-edge" + (o.edgeCls ? " " + o.edgeCls(e) : "") }, ge);
      if (directed) ln.setAttribute("marker-end", "url(#" + (o.mid || "x-pd-arr") + ")");
    });
    for (var i = 0; i < n; i++) drawNode(K, gn, P[i], o.label ? o.label(i) : String.fromCharCode(65 + i), o.cls ? o.cls(i) : "", 16);
    return P;
  }
  PROP.push({
    id: "ds-degree", sub: "ds", ch: "第 5 章 图", name: "图的度之和与边数", toc: "度之和 = 2e",
    def: "无向图中顶点的度：依附于该顶点的边数。有向图中入度：以该顶点为终点的弧数；出度：以该顶点为起点的弧数。",
    stmt: ["无向图：所有顶点的度之和 = **2e**，所以度为奇数的顶点有偶数个", "有向图：入度之和 = 出度之和 = **e**，顶点的度 = 入度 + 出度"],
    cond: "对任意无向图 / 有向图成立（含不连通图）；408 中默认讨论简单图（无自环、无重边），若允许自环，一个自环给该顶点的度加 2。",
    proof: [
      "无向图中每条边 (u, v) 恰好依附两个顶点，给 u 和 v 的度各加 1。",
      "所以把所有顶点的度相加，每条边被数了两次，度之和 = 2e。",
      "2e 是偶数，奇数度的顶点个数必须为偶数，否则和为奇数。",
      "有向图中每条弧 <u, v> 给 u 的出度加 1、给 v 的入度加 1。",
      "所以入度之和 = 出度之和 = 弧数 e，全部顶点的度之和 = 2e。"
    ],
    traps: [
      "用度之和求顶点数的最小值时，剩余顶点要按允许的最大度去分配，才能让顶点最少。",
      "有向图中“度”是入度加出度；邻接矩阵第 i 行之和是出度、第 i 列之和是入度。",
      "无向图邻接矩阵中 1 的个数是 2e，有向图是 e。"
    ],
    ex: {
      q: "无向图 G 有 16 条边，其中 3 个顶点的度为 4，4 个顶点的度为 3，其余顶点的度都小于 3。G 至少有几个顶点？（ ）",
      opts: ["10", "11", "13", "15"],
      a: 1,
      why: "度之和 = 2 × 16 = 32。已知顶点贡献 3×4 + 4×3 = 24，剩余 8 由度不超过 2 的顶点提供，至少需要 4 个，所以顶点至少 3 + 4 + 4 = 11 个。",
      src: "2017 年真题"
    },
    links: { lab: ["graphtrav"], proc: [] },
    demo: function (box) {
      var K = kit(box), rnd = Math.random, dir = false, g = null;
      var rn = K.range("顶点数 n", 2, 8, 6, function () { rebuild(); });
      var re = K.range("边数 e", 0, 15, 7, function () { rebuild(); });
      K.btn("随机生成", function () { rebuild(); }, true);
      K.seg("图的类型", [[false, "无向图"], [true, "有向图"]], dir, function (v) { dir = v; rebuild(); });
      function rebuild() {
        var n = rn.get(), mx = dir ? n * (n - 1) : n * (n - 1) / 2;
        re.setMax(mx);
        g = DS.randomGraph(n, re.get(), dir, rnd);
        draw();
      }
      function draw() {
        var s = DS.degreeSum(g), svg = K.canvas(300, dir ? "随机有向图" : "随机无向图");
        drawGraph(K, svg, g.n, g.edges, dir, { label: function (i) { return dir ? s.indeg[i] + "/" + s.outdeg[i] : s.deg[i]; } });
        K.svg("text", { x: 12, y: 22, class: "x-pd-txt x-pd-txt--mute" }, svg, dir ? "结点中为 入度/出度" : "结点中为该顶点的度");
        var odd = s.deg.filter(function (d) { return d % 2; }).length;
        if (dir) K.show([["弧数 e", s.e], ["入度之和", s.inSum], ["出度之和", s.outSum]],
          [["入度之和 " + s.inSum, "e = " + s.e, s.inSum === s.e], ["出度之和 " + s.outSum, "e = " + s.e, s.outSum === s.e]], "每条弧给起点出度 +1、终点入度 +1。");
        else K.show([["边数 e", s.e], ["度之和", s.sum], ["度为奇数的顶点", odd + " 个"], ["各顶点的度", s.deg.join("，")]],
          [["度之和 " + s.sum, "2e = " + 2 * s.e, s.sum === 2 * s.e], ["奇数度顶点 " + odd + " 个", "必为偶数个", odd % 2 === 0]], "每条边让两端顶点的度各加 1。");
      }
      rebuild();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 9. 连通性与边数 ===================== */
  PROP.push({
    id: "ds-connect", sub: "ds", ch: "第 5 章 图", name: "连通性与边数的界", toc: "连通图边数界",
    def: "连通图：任意两个顶点之间都有路径。强连通图：有向图中任意两个顶点互相可达。完全图：任意两个顶点之间都有边（弧）。",
    stmt: [
      "n 个顶点：无向完全图 **n(n−1)/2** 条边，有向完全图 **n(n−1)** 条弧",
      "连通图至少 **n − 1** 条边（生成树）；强连通有向图至少 **n** 条弧（一个环）",
      "非连通无向图最多 **C(n−1, 2) = (n−1)(n−2)/2** 条边；保证一定连通至少需要 **(n−1)(n−2)/2 + 1** 条边"
    ],
    cond: "讨论简单图（无重边、无自环）。“至少 n − 1 条边”是连通的必要条件而非充分条件；“保证任何情况下都连通”问的是最坏情况，答案是 C(n−1, 2) + 1。",
    proof: [
      "无向完全图中每对顶点一条边，共 C(n, 2) = n(n−1)/2 条；有向完全图每对顶点两条方向相反的弧，共 n(n−1) 条。",
      "连通图有生成树，生成树有 n − 1 条边，所以至少 n − 1 条；有向图要强连通，每个顶点出度、入度都至少为 1，至少 n 条，n 个顶点构成一个有向环正好取到。",
      "要让边尽量多却不连通，最“坏”的放法是把 n − 1 个顶点连成完全图，剩下 1 个顶点孤立，共 C(n−1, 2) 条边。",
      "可以验证把顶点分成大小为 a、n − a 的两部分时，C(a,2) + C(n−a,2) 在 a = 1 时最大。",
      "再多 1 条边，这条边只能连到孤立顶点上，图必然连通，所以保证连通至少需要 C(n−1, 2) + 1 条边。"
    ],
    traps: [
      "“连通至少几条边”是 n − 1，“保证一定连通至少几条边”是 C(n−1,2)+1，两种问法别混。",
      "强连通至少 n 条弧，不是 n − 1；有向完全图是 n(n−1)，不是 n(n−1)/2。",
      "边数大于 n − 1 不能推出连通；边数小于 n − 1 一定不连通。"
    ],
    ex: {
      q: "无向图 G 有 7 个顶点。不管边怎么连，都要保证 G 一定连通，至少需要多少条边？（ ）",
      opts: ["6", "15", "16", "21"],
      a: 2,
      why: "最坏情况：6 个顶点构成完全图共 C(6,2) = 15 条边，第 7 个顶点孤立，仍不连通；再加 1 条边必然连通，所以至少 16 条。选 A 是连通的最少边数，问法不同。",
      src: "2010 年真题"
    },
    links: { lab: ["graphtrav", "mst"], proc: [] },
    demo: function (box) {
      var K = kit(box), rnd = Math.random, mode = "worst";
      var rn = K.range("顶点数 n", 3, 8, 6, function (n) { re.setMax(n * (n - 1) / 2); draw(); });
      var re = K.range("边数 e", 0, 15, 10, function () { draw(); });
      var sg = K.seg("放边方式", [["worst", "最坏放法"], ["rand", "随机放法"]], mode, function (v) { mode = v; draw(); });
      K.btn("再随机一次", function () { mode = "rand"; sg.set("rand"); draw(); });
      function draw() {
        var n = rn.get(), e = re.get(), B = DS.edgeBounds(n);
        var edges = mode === "worst" ? DS.worstGraph(n, e) : DS.randomGraph(n, e, false, rnd).edges;
        var conn = DS.isConnected(n, edges), svg = K.canvas(300, "n 个顶点、e 条边的图");
        var deg = DS.degreeSum({ n: n, edges: edges }).deg;
        drawGraph(K, svg, n, edges, false, { cls: function (i) { return deg[i] === 0 ? "is-iso" : ""; }, edgeCls: function (ed) { return ed[1] === n - 1 && mode === "worst" ? "is-hl" : ""; } });
        K.svg("text", { x: 12, y: 22, class: "x-pd-txt " + (conn ? "x-pd-txt--ok" : "x-pd-txt--bad") }, svg, conn ? "连通" : "不连通");
        var canDis = e <= B.maxDisconnected;
        K.show([["完全图边数 n(n−1)/2", B.complete], ["连通至少 n − 1", B.minConnected], ["不连通最多 C(n−1,2)", B.maxDisconnected], ["保证连通 C(n−1,2)+1", B.guarantee]],
          [["e = " + e + (canDis ? " ≤ " : " > ") + "C(n−1,2) = " + B.maxDisconnected, canDis ? "还能放成不连通" : "无论怎么放都连通", mode === "worst" ? conn === !canDis : (!canDis ? conn : true)]],
          mode === "worst" ? "最坏放法：先把边放满前 n − 1 个顶点构成的完全图，最后一个顶点（浅色）孤立；放满后的下一条边只能连向它。" : "随机放法下边数不超过 C(n−1,2) 时可能连通也可能不连通；超过后一定连通。");
      }
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 10. 平衡二叉树最少结点数 ===================== */
  PROP.push({
    id: "ds-avlmin", sub: "ds", ch: "第 6 章 查找", name: "平衡二叉树最少结点数 N(h)", toc: "AVL 最少结点 N(h)",
    def: "平衡二叉树（AVL 树）：任一结点左、右子树高度差（平衡因子）的绝对值不超过 1 的二叉排序树。",
    stmt: ["高度为 h 的 AVL 树最少结点数 **N(h) = N(h−1) + N(h−2) + 1**，N(0) = 0、N(1) = 1、N(2) = 2", "N(3) = 4、**N(4) = 7**、**N(5) = 12**、N(6) = 20、N(7) = 33", "n 个结点的 AVL 树最大高度 h 满足 N(h) ≤ n < N(h+1)，高度为 O(log n)"],
    cond: "高度以结点层数计（只有根时 h = 1）。若题目规定空树高度为 −1、单结点高度为 0，序列整体平移一位。“所有非叶结点平衡因子均为 1”的 AVL 树正好是最少结点的情形。",
    proof: [
      "要让高度为 h 的 AVL 树结点最少，根的一棵子树高度必须是 h − 1（否则树高不到 h）。",
      "另一棵子树高度可以是 h − 1 或 h − 2，取更矮的 h − 2 结点更少，且仍满足平衡。",
      "两棵子树本身也要结点最少，所以 N(h) = N(h−1) + N(h−2) + 1（+1 是根）。",
      "初值 N(0) = 0（空树）、N(1) = 1，依次得 2、4、7、12、20、33。",
      "N(h) + 1 是斐波那契数，按指数增长，所以 n 个结点的 AVL 树高度为 O(log n)。"
    ],
    traps: [
      "递推式末尾的 +1 不能漏，漏了就变成斐波那契数（N(5) 会算成 5）。",
      "初值 N(2) = 2，不是 3；h 从 1 开始计。",
      "反问“n 个结点的 AVL 树最大高度”：找最大的 h 使 N(h) ≤ n，例如 20 个结点最大高度为 6。"
    ],
    ex: {
      q: "一棵平衡二叉树高度为 6，并且每个非叶结点的平衡因子都是 1，这棵树一共有多少个结点？（ ）",
      opts: ["10", "20", "32", "33"],
      a: 1,
      why: "所有非叶结点平衡因子均为 1，正是高度为 h 的 AVL 树结点最少的情形：N(1..6) = 1, 2, 4, 7, 12, 20，所以为 20。选 C 是满二叉树 2⁵ 附近的误算，选 D 是 N(7)。",
      src: "2012 年真题"
    },
    links: { lab: ["bst"], proc: [] },
    demo: function (box) {
      var K = kit(box), h = 5;
      K.seg("高度 h", [[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"]], h, function (v) { h = v; draw(); });
      function draw() {
        var T = DS.avlMinTree(h), bf = DS.balanceFactors(T), ht = DS.treeHeight(T);
        var svg = K.canvas(40 + h * 50, "高度为 " + h + " 的最瘦平衡二叉树");
        drawBinary(K, svg, T, 0, { dy: 50, label: function (v) { return bf[v] === 0 ? "0" : String(bf[v]); }, cls: function (v) { return T[v].l < 0 && T[v].r < 0 ? "is-leaf" : "is-d2"; } });
        var seq = [];
        for (var i = 0; i <= h; i++) seq.push("N(" + i + ")=" + DS.avlMin(i));
        var allOne = T.every(function (nd, v) { return (nd.l < 0 && nd.r < 0) || bf[v] === 1; });
        K.show([["数出的结点数", T.length], ["树高", ht], ["递推", seq.join("，")]],
          [["结点数 " + T.length, h >= 2 ? "N(" + (h - 1) + ") + N(" + (h - 2) + ") + 1 = " + DS.avlMin(h - 1) + " + " + DS.avlMin(h - 2) + " + 1 = " + DS.avlMin(h) : "N(1) = 1", T.length === DS.avlMin(h)],
           ["非叶结点平衡因子", "全为 1", allOne]],
          "结点里的数字是平衡因子（左高 − 右高）。左子树是高度 h − 1 的最瘦树，右子树是高度 h − 2 的最瘦树。");
      }
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 11. B 树的关键字数与高度 ===================== */
  PROP.push({
    id: "ds-btree", sub: "ds", ch: "第 6 章 查找", name: "B 树的关键字数与高度", toc: "B 树关键字与高度",
    def: "m 阶 B 树：每个结点至多 m 棵子树；根至少 2 棵子树（若不是叶结点）；其他非叶结点至少 ⌈m/2⌉ 棵子树；所有叶结点（失败结点）在同一层。",
    stmt: [
      "根结点关键字数 1 ~ m − 1；非根结点关键字数 **⌈m/2⌉ − 1 ~ m − 1**",
      "n 个关键字、高度 h（不含失败结点层）：**log_m(n+1) ≤ h ≤ log_⌈m/2⌉((n+1)/2) + 1**",
      "失败结点（叶结点）数 = **n + 1**"
    ],
    cond: "高度不计失败结点那一层（常见约定）；若题目把失败结点层算入高度，上下界都要加 1。B+ 树中非根结点的关键字数与子树数相等，范围是 ⌈m/2⌉ ~ m，与 B 树不同。",
    proof: [
      "高度最小时每个结点都放满 m − 1 个关键字、m 棵子树：n ≤ (m − 1)(1 + m + … + m^(h−1)) = m^h − 1，得 h ≥ log_m(n+1)。",
      "高度最大时结点尽量空：第 1 层 1 个结点，第 2 层至少 2 个，第 3 层至少 2⌈m/2⌉ 个，第 h + 1 层（失败结点）至少 2⌈m/2⌉^(h−1) 个。",
      "失败结点数 = n + 1（n 个关键字把数轴分成 n + 1 个区间），所以 n + 1 ≥ 2⌈m/2⌉^(h−1)。",
      "取对数得 h ≤ log_⌈m/2⌉((n+1)/2) + 1。",
      "等价写法：高度为 h 的 B 树至少有 2⌈m/2⌉^(h−1) − 1 个关键字，至多 m^h − 1 个。"
    ],
    traps: [
      "根结点最少 1 个关键字（2 棵子树），不受 ⌈m/2⌉ − 1 限制，算最少关键字数时根要单独算。",
      "高度是否包含失败结点层，题目口径不同答案差 1。",
      "关键字数 ≠ 子树数：B 树结点有 k 个关键字就有 k + 1 棵子树。"
    ],
    ex: {
      q: "高度为 2 的 5 阶 B 树，最少能装下多少个关键字？（ ）",
      opts: ["5", "7", "8", "14"],
      a: 0,
      why: "根至少 1 个关键字、2 棵子树；第 2 层两个结点各至少 ⌈5/2⌉ − 1 = 2 个关键字，共 1 + 2 + 2 = 5（即 2⌈m/2⌉^(h−1) − 1 = 2×3 − 1 = 5）。选 D 是把根也按 2 个算后再翻倍的误算。",
      src: "2013 年真题"
    },
    links: { lab: ["btree"], proc: [] },
    demo: function (box) {
      var K = kit(box);
      var im = K.text("阶数 m", "5"), inn = K.text("关键字数 n", "100");
      K.btn("计算", function () { draw(); }, true);
      K.btn("m = 3", function () { im.value = "3"; draw(); });
      K.btn("m = 5，n = 5", function () { im.value = "5"; inn.value = "5"; draw(); });
      function draw() {
        var ms = im.value.trim(), ns = inn.value.trim();
        if (!/^\d+$/.test(ms) || Number(ms) < 3 || Number(ms) > 20) { K.canvas(60, "输入有误"); K.show(null, null, null, "阶数 m 请输入 3 ~ 20 之间的整数"); return; }
        if (!/^\d+$/.test(ns) || Number(ns) < 1 || Number(ns) > 1000000) { K.canvas(60, "输入有误"); K.show(null, null, null, "关键字数 n 请输入 1 ~ 1000000 之间的整数"); return; }
        var m = Number(ms), n = Number(ns), B = DS.btreeHeight(m, n), kk = DS.btreeKeys(m);
        var H = Math.max(B.hMax + 1, 3), rows = [];
        var svg = K.canvas(46 + H * 34, "各高度 B 树的关键字数范围（对数坐标）");
        var maxV = DS.btreeLevelKeys(m, H).max, lg = function (x) { return Math.log(x + 1) / Math.log(maxV + 1); };
        var x0 = 110, W = 580;
        for (var h = 1; h <= H; h++) {
          var r = DS.btreeLevelKeys(m, h), y = 30 + (h - 1) * 34, inR = r.min <= n && n <= r.max;
          K.svg("text", { x: 10, y: y + 17, class: "x-pd-txt" }, svg, "h = " + h);
          K.svg("rect", { x: x0 + W * lg(r.min), y: y + 4, width: Math.max(4, W * (lg(r.max) - lg(r.min))), height: 20, class: "x-pd-bar" + (inR ? " is-on" : " is-ghost") }, svg);
          rows.push(["h = " + h, r.min + " ~ " + r.max + (inR ? "  ← 包含 n" : "")]);
        }
        var xn = x0 + W * lg(n);
        K.svg("line", { x1: xn, y1: 18, x2: xn, y2: 30 + H * 34, class: "x-pd-edge is-hl" }, svg);
        K.svg("text", { x: Math.min(xn + 4, 640), y: 16, class: "x-pd-txt" }, svg, "n = " + n);
        var possible = [];
        for (h = 1; h <= H; h++) { var r2 = DS.btreeLevelKeys(m, h); if (r2.min <= n && n <= r2.max) possible.push(h); }
        K.show([["根结点关键字", "1 ~ " + kk.max], ["非根结点关键字", kk.min + " ~ " + kk.max], ["失败结点数 n + 1", B.fail]].concat(rows),
          [["log_" + m + "(n+1) = " + fmt(B.lo) + " ≤ h ≤ " + fmt(B.hi), "整数高度 " + B.hMin + " ~ " + B.hMax, possible[0] === B.hMin && possible[possible.length - 1] === B.hMax]],
          "每一条横条是高度 h 的 " + m + " 阶 B 树能容纳的关键字数范围（最少 2⌈m/2⌉^(h−1) − 1，最多 m^h − 1），竖线穿过的横条就是 n 个关键字可能的高度。");
      }
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 12. 红黑树 ===================== */
  PROP.push({
    id: "ds-rbtree", sub: "ds", ch: "第 6 章 查找", name: "红黑树的高度上界", toc: "红黑树高度上界",
    def: "红黑树：每个结点非红即黑；根和叶（NIL）是黑色；红结点的孩子都是黑色（红结点不相邻）；任一结点到其每个 NIL 的路径上黑结点数相同（各路径黑结点数相等）。黑高 bh：从某结点出发（不含该结点）到 NIL 的任一路径上黑结点数。",
    stmt: ["从根到叶的最长路径不超过最短路径的 **2 倍**", "黑高为 bh 的子树至少有 **2^bh − 1** 个内部结点", "n 个内部结点的红黑树高度 **h ≤ 2log₂(n+1)**"],
    cond: "高度只计内部结点（不计 NIL）。红黑树是“适度平衡”：不要求左右子树高度差不超过 1，所以 AVL 树一定可以染成红黑树，红黑树不一定是 AVL 树。",
    proof: [
      "由“各路径黑结点数相等”，从根出发的每条路径黑结点数相同，都等于根的黑高 bh。",
      "最短路径最好全是黑结点，长度 bh；由“红结点不相邻”，最长路径红黑相间，红结点不超过黑结点，长度不超过 2bh，所以最长 ≤ 2 × 最短。",
      "对高度归纳：黑高为 bh 的结点，两个孩子的黑高至少为 bh − 1，所以内部结点数 ≥ 2(2^(bh−1) − 1) + 1 = 2^bh − 1。",
      "根到叶的路径上至少一半结点是黑色，所以根的黑高 bh ≥ h/2。",
      "n ≥ 2^(h/2) − 1，取对数得 h ≤ 2log₂(n+1)，查找、插入、删除都是 O(log n)。"
    ],
    traps: [
      "是“最长 ≤ 2 × 最短”，可以取等号（最短路径全黑、最长路径红黑相间时）；不是“高度差不超过 1”，那是 AVL 树的条件。",
      "黑高不计起点结点自身，但计 NIL 叶结点；不同资料的定义略有差别，按题目定义算。",
      "新插入结点总是红色；插入后若父结点是黑色无需调整。"
    ],
    ex: {
      q: "一棵含有 n 个内部结点的红黑树，其高度 h（不计 NIL 结点）满足（ ）。",
      opts: ["h ≤ log₂(n+1)", "h ≤ 2log₂(n+1)", "h ≤ ⌈log₂(n+1)⌉ + 1", "h ≤ n/2"],
      a: 1,
      why: "根的黑高 bh ≥ h/2，且黑高为 bh 的红黑树至少有 2^bh − 1 个内部结点，所以 n ≥ 2^(h/2) − 1，即 h ≤ 2log₂(n+1)。选 A 是满二叉树的高度下界，红黑树不保证这么矮。",
      src: "典型题"
    },
    links: { lab: ["bst"], proc: ["rbtree"] },
    demo: function (box) {
      var K = kit(box), keys = [];
      function randKeys(n) { var a = []; while (a.length < n) { var k = 1 + Math.floor(Math.random() * 99); if (a.indexOf(k) < 0) a.push(k); } return a; }
      var rg = K.range("结点数 n", 1, 20, 10, function (v) { keys = randKeys(v); draw(); });
      K.btn("随机插入", function () { keys = randKeys(rg.get()); draw(); }, true);
      K.btn("顺序插入 1..n", function () { keys = []; for (var i = 1; i <= rg.get(); i++) keys.push(i); draw(); });
      var add = K.btn("再插一个", function () {
        if (keys.length >= 20) return;
        var k; do { k = 1 + Math.floor(Math.random() * 99); } while (keys.indexOf(k) >= 0);
        keys.push(k); rg.set(keys.length); draw();
      });
      function draw() {
        var T = DS.rbInsertAll(keys), S = DS.rbStats(T);
        var svg = K.canvas(40 + S.h * 48, "红黑树，深色为黑结点、红色为红结点");
        drawBinary(K, svg, T.nodes, T.root, { dy: 48, label: function (v) { return T.nodes[v].k; }, cls: function (v) { return T.nodes[v].c === "R" ? "is-red" : "is-black"; } });
        add.disabled = keys.length >= 20;
        K.show([["插入序列", keys.join(" ")], ["内部结点 n", S.n], ["高度 h", S.h], ["根的黑高 bh", S.bh], ["最短 / 最长路径", S.shortest + " / " + S.longest]],
          [["最长路径 " + S.longest, "2 × 最短 = " + 2 * S.shortest, S.longest <= 2 * S.shortest],
           ["h = " + S.h, "2log₂(n+1) = " + fmt(S.bound), S.h <= S.bound + 1e-9],
           ["n = " + S.n, "2^bh − 1 = " + S.minInternal, S.n >= S.minInternal]],
          S.valid ? "路径长度按内部结点个数计。顺序插入 1..n 时普通二叉排序树会退化成链，红黑树仍保持矮胖。" : "红黑性质校验失败");
      }
      keys = randKeys(10); draw();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 13. 折半查找与堆 ===================== */
  PROP.push({
    id: "ds-bsearch", sub: "ds", ch: "第 6 章 查找", name: "折半查找判定树与建堆代价", toc: "判定树与建堆代价",
    def: "折半查找判定树：以每次比较的 mid 为结点构成的二叉树，内部结点代表查找成功，外部（失败）结点代表查找失败。",
    stmt: [
      "n 个元素的判定树高度 **⌈log₂(n+1)⌉**（不含失败结点），它是平衡二叉树",
      "查找成功、查找失败时关键字比较次数**最多都是 ⌈log₂(n+1)⌉**",
      "建堆时间 **O(n)**（比较次数不超过 4n）；堆排序 O(n log n)，空间 O(1)，**不稳定**"
    ],
    cond: "mid = ⌊(low + high)/2⌋ 时判定树中每个结点的右子树结点数比左子树多 0 或 1；取上整则相反。只适用于有序顺序表，链表不能折半查找。",
    proof: [
      "判定树中任意结点左右子树的结点数之差不超过 1，所以除最后一层外是满的，高度与 n 个结点的完全二叉树相同：⌈log₂(n+1)⌉。",
      "查找成功比较次数 = 该结点所在层数，最多为树高；失败结点挂在最后一层或倒数第二层内部结点下，比较次数等于其父结点层数，最多也是树高。",
      "建堆时第 k 层结点下沉最多 h − k 层，每层比较 2 次；总代价 Σ 2(h − k)2^(k−1) ≤ 4n，即 O(n)。",
      "堆排序：建堆 O(n)，再 n − 1 次“交换堆顶 + 下沉”各 O(log n)，共 O(n log n)。",
      "交换堆顶与末尾元素会打乱相同关键字的相对次序，所以堆排序不稳定。"
    ],
    traps: [
      "查找失败的最多比较次数也是 ⌈log₂(n+1)⌉，不是树高 + 1（失败结点本身不比较）。",
      "建堆是 O(n) 而不是 O(n log n)；整个堆排序才是 O(n log n)。",
      "判定树高度用 ⌈log₂(n+1)⌉，n = 16 时为 5，不是 ⌈log₂16⌉ = 4。"
    ],
    ex: {
      q: "对长度为 16 的有序顺序表做折半查找，查一个表中不存在的关键字，最多要比较几次？（ ）",
      opts: ["4", "5", "6", "7"],
      a: 1,
      why: "判定树高度 ⌈log₂(16+1)⌉ = 5，查找失败时最多比较 5 次。选 A 是误用 log₂16。",
      src: "2010 年真题"
    },
    links: { lab: ["bsearch", "sort"], proc: ["heapop"] },
    demo: function (box) {
      var K = kit(box), sel = 0;
      var rg = K.range("表长 n", 1, 40, 16, function () { sel = 0; draw(); });
      var inp = K.text("查找关键字（1~n，可填 x.5 表示失败）", "");
      K.btn("模拟查找", function () { draw(true); }, true);
      function draw(run) {
        var n = rg.get(), H = DS.bsearchHeight(n), M = DS.bsearchMaxCmp(n), path = [], err = null;
        if (run) {
          var t = inp.value.trim();
          if (!/^\d+(\.5)?$/.test(t)) err = "请输入 1 ~ " + n + " 之间的整数，或像 3.5 这样的数表示一次失败查找";
          else {
            var x = Number(t);
            if (x < 0.5 || x > n + 0.5) err = "关键字要在 0.5 ~ " + (n + 0.5) + " 之间";
            else { var lo = 1, hi = n; while (lo <= hi) { var mid = Math.floor((lo + hi) / 2); path.push(mid); if (x === mid) break; if (x < mid) hi = mid - 1; else lo = mid + 1; } sel = x; }
          }
        }
        var heapArr = [];
        for (var i = 0; i < n; i++) heapArr.push(Math.floor(Math.random() * 100));
        var hc = DS.buildHeapCmp(heapArr).cmp;
        if (n <= 20) {
          var T = DS.bsearchTree(n), svg = K.canvas(40 + H * 52, "折半查找判定树");
          drawBinary(K, svg, T, 0, { dy: 52, label: function (v) { return T[v].k; }, cls: function (v) { return path.indexOf(T[v].k) >= 0 ? "is-sel" : ""; } });
        } else {
          var s2 = K.canvas(70, "判定树结点太多，只显示数值");
          K.svg("text", { x: 20, y: 40, class: "x-pd-txt" }, s2, "n > 20 时判定树放不下，只显示计算结果。");
        }
        K.show([["表长 n", n], ["判定树高度", H], ["本次查找比较", path.length ? path.join(" → ") + "（" + path.length + " 次）" : "—"], ["随机 " + n + " 个数建堆比较", hc + " 次"]],
          [["成功最多 " + M.succ + " 次", "⌈log₂(n+1)⌉ = " + H, M.succ === H], ["失败最多 " + M.fail + " 次", "⌈log₂(n+1)⌉ = " + H, M.fail === H], ["建堆比较 " + hc, "4n = " + 4 * n, hc <= 4 * n]],
          "成功、失败的最多比较次数是把每个关键字和每个间隙都实际查一遍得到的。");
        if (err) K.el("p", { class: "x-pd__err", role: "alert" }, err, K.out);
      }
      draw();
      return { destroy: K.destroy };
    }
  });

  /* ===================== 14. 比较排序的下界与稳定性 ===================== */
  PROP.push({
    id: "ds-sortbound", sub: "ds", ch: "第 7 章 排序", name: "比较排序的下界与稳定性总表", toc: "排序下界与稳定性",
    def: "基于比较的排序：只通过比较两个关键字的大小来决定元素次序。决策树：每个内部结点是一次比较、每个叶子是一种排列结果的二叉树。稳定：关键字相同的元素排序后相对次序不变。",
    stmt: ["基于比较的排序在最坏情况下至少需要 **⌈log₂(n!)⌉** 次比较，即 Ω(n log n)", "最坏 O(n log n) 的比较排序：堆排序、归并排序；快速排序最坏 O(n²)", "稳定的：插入（直接、折半）、冒泡、归并、基数、计数；不稳定的：希尔、快速、简单选择、堆"],
    cond: "下界只针对基于比较的排序；基数排序、计数排序不基于比较，不受此限。“稳定性”针对算法的标准写法，改动比较条件（如 > 改为 ≥）可能改变稳定性。",
    proof: [
      "n 个互不相同的元素有 n! 种排列，正确的排序算法必须能区分每一种，决策树至少有 n! 个叶子。",
      "每次比较只有两种结果，决策树是二叉树，高度为 h 时最多 2^h 个叶子。",
      "所以 2^h ≥ n!，h ≥ ⌈log₂(n!)⌉，最坏情况比较次数至少为此值。",
      "由斯特林公式 log₂(n!) ≈ n log₂n − 1.44n，所以下界是 Ω(n log n)。",
      "堆排序、归并排序最坏 O(n log n)，已经达到渐近下界。"
    ],
    traps: [
      "⌈log₂(n!)⌉ 是最坏情况下界，不是平均或最好情况；最好情况下直接插入排序只需 n − 1 次比较。",
      "简单选择排序不稳定：把最小值换到前面时，可能把一个相等的关键字甩到后面去。用 5、8、5*、2 试一下就能看到。",
      "快速排序平均 O(n log n) 但最坏 O(n²)，空间 O(log n) ~ O(n)；归并排序空间 O(n)。"
    ],
    ex: {
      q: "对 5 个互不相同的元素进行基于比较的排序，最坏情况下至少需要的比较次数是（ ）。",
      opts: ["5", "6", "7", "10"],
      a: 2,
      why: "5! = 120，2⁶ = 64 < 120 ≤ 128 = 2⁷，所以至少 ⌈log₂120⌉ = 7 次。选 D 是 C(5,2) 两两都比较；选 A 误以为 n 次就够。",
      src: "典型题"
    },
    links: { lab: ["sort", "sort2"], proc: [] },
    demo: function (box) {
      var K = kit(box), n = 4, view = "bar", filt = "all";
      K.seg("元素个数 n", [[2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"]], n, function (v) { n = v; draw(); });
      K.seg("图", [["bar", "实测比较次数"], ["tree", "决策树（n = 3）"]], view, function (v) { view = v; draw(); });
      var tblBox = K.el("div", { class: "x-pd__tblbox" }, null, K.root);
      var fg = K.el("div", { class: "x-pd__ctrl" }, null, tblBox);
      K.seg("筛选", [["all", "全部"], ["stable", "稳定"], ["unstable", "不稳定"], ["nlogn", "最坏 O(n log n)"], ["o1", "空间 O(1)"]], filt, function (v) { filt = v; table(); }, fg);
      var tbl = K.el("table", { class: "x-pd__tbl" }, null, tblBox);
      function table() {
        K.clear(tbl);
        var hd = K.el("tr", null, null, K.el("thead", null, null, tbl));
        ["算法", "最好", "平均", "最坏", "空间", "稳定"].forEach(function (t) { K.el("th", { scope: "col" }, t, hd); });
        var tb = K.el("tbody", null, null, tbl);
        DS.SORTS.filter(function (s) {
          return filt === "all" || (filt === "stable" && s.stable) || (filt === "unstable" && !s.stable) || (filt === "nlogn" && s.nlogn) || (filt === "o1" && s.o1);
        }).forEach(function (s) {
          var tr = K.el("tr", null, null, tb);
          K.el("th", { scope: "row", title: s.note || "" }, s.name, tr);
          [s.best, s.avg, s.worst, s.space].forEach(function (v) { K.el("td", null, v, tr); });
          K.el("td", { class: s.stable ? "is-ok" : "is-bad" }, s.stable ? "稳定" : "不稳定", tr);
        });
      }
      function draw() {
        var lb = DS.log2Fact(n), f = DS.fact(n);
        var algs = [["insert", "直接插入"], ["binsert", "折半插入"], ["merge", "二路归并"], ["select", "简单选择"]];
        var res = algs.map(function (a) { return [a[1], DS.sortWorstCmp(n, a[0])]; });
        if (view === "tree") {
          var svg = K.canvas(260, "3 个元素的决策树");
          var T = [["a:b", 360, 30], ["b:c", 190, 95], ["a:c", 530, 95], ["a<b<c", 100, 165], ["a:c", 280, 165], ["b<a<c", 440, 165], ["b:c", 620, 165], ["a<c<b", 210, 230], ["c<a<b", 350, 230], ["b<c<a", 560, 230], ["c<b<a", 680, 230]];
          var E = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6], [4, 7], [4, 8], [6, 9], [6, 10]];
          var ge = K.svg("g", null, svg), gn = K.svg("g", null, svg);
          E.forEach(function (e) { drawEdge(K, ge, [T[e[0]][1], T[e[0]][2]], [T[e[1]][1], T[e[1]][2]]); });
          T.forEach(function (t) {
            if (t[0].indexOf("<") >= 0) {
              K.svg("rect", { x: t[1] - 34, y: t[2] - 13, width: 68, height: 26, rx: 6, class: "x-pd-leafbox" }, gn);
              K.svg("text", { x: t[1], y: t[2] + 5, "text-anchor": "middle", class: "x-pd-txt" }, gn, t[0]);
            } else drawNode(K, gn, [t[1], t[2]], t[0], "", 20);
          });
          K.svg("text", { x: 12, y: 22, class: "x-pd-txt x-pd-txt--mute" }, svg, "左分支“<”，右分支“>”");
          K.show([["叶子数", "3! = 6"], ["决策树高度（比较层数）", 3]], [["高度 3", "⌈log₂6⌉ = 3", true]], "6 个叶子的二叉树高度至少 3，所以 3 个元素最坏至少比较 3 次。");
        } else {
          var svg2 = K.canvas(50 + algs.length * 46, "各排序算法最坏比较次数与下界");
          var mx = Math.max.apply(null, res.map(function (r) { return r[1]; }).concat([lb, 1])), W = 470, x0 = 130;
          res.forEach(function (r, i) {
            var y = 30 + i * 46;
            K.svg("text", { x: 10, y: y + 18, class: "x-pd-txt" }, svg2, r[0]);
            K.svg("rect", { x: x0, y: y + 2, width: Math.max(2, W * r[1] / mx), height: 24, class: "x-pd-bar is-on" }, svg2);
            K.svg("text", { x: x0 + W * r[1] / mx + 8, y: y + 19, class: "x-pd-txt" }, svg2, String(r[1]));
          });
          var xl = x0 + W * lb / mx;
          K.svg("line", { x1: xl, y1: 20, x2: xl, y2: 34 + algs.length * 46, class: "x-pd-edge is-hl" }, svg2);
          K.svg("text", { x: Math.min(xl + 4, 600), y: 16, class: "x-pd-txt" }, svg2, "下界 " + lb);
          K.show([["排列数 n!", f], ["下界 ⌈log₂(n!)⌉", lb]].concat(res.map(function (r) { return [r[0] + " 最坏", r[1] + " 次"]; })),
            res.map(function (r) { return [r[0] + " 最坏 " + r[1], "≥ ⌈log₂" + f + "⌉ = " + lb, r[1] >= lb]; }),
            "把 n 个数的全部 " + f + " 种排列都排一遍，取比较次数的最大值。没有任何比较排序能低于竖线。");
        }
      }
      draw(); table();
      return { destroy: K.destroy };
    }
  });
})();
