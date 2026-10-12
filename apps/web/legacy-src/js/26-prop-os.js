      /* 性质与公式 · 操作系统（14 条）
         注册到 window.PROP；纯计算函数挂在 window.PROPU.os 上（可在 node 里单测）。
         demo(box) 只在卡片打开时调用，返回 { destroy }；不在加载时访问 DOM。 */
      (function () {
        var PROP = window.PROP = window.PROP || [];
        var PROPU = window.PROPU = window.PROPU || {};

        /* ================= 纯函数 ================= */
        function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
        function round(x, d) { var p = Math.pow(10, d == null ? 2 : d); return Math.round(x * p) / p; }
        function fmt(x, d) {
          if (x === Infinity) return "∞";
          if (typeof x !== "number" || isNaN(x)) return "—";
          var r = round(x, d == null ? 2 : d);
          return String(r);
        }
        function isPow2(x) {
          if (!(x > 0) || Math.floor(x) !== x) return false;
          return Math.pow(2, Math.round(Math.log(x) / Math.LN2)) === x;
        }
        function log2i(x) { return Math.round(Math.log(x) / Math.LN2); }

        /* 解析一个数：允许全角数字、中文负号；opt: {min, max, int, name} */
        function num(s, opt) {
          opt = opt || {};
          var name = opt.name || "数值";
          var t = String(s == null ? "" : s).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248); })
            .replace(/[−－]/g, "-").replace(/．/g, ".").replace(/\s+/g, "");
          if (t === "") return { err: "请输入" + name };
          if (!/^-?(\d+(\.\d*)?|\.\d+)(e[-+]?\d+)?$/i.test(t)) return { err: name + "“" + s + "”不是合法的数" };
          var v = parseFloat(t);
          if (opt.int && Math.floor(v) !== v) return { err: name + "必须是整数" };
          if (opt.min != null && v < opt.min) return { err: name + "不能小于 " + opt.min };
          if (opt.max != null && v > opt.max) return { err: name + "不能大于 " + opt.max };
          return { v: v };
        }
        /* 解析容量：4096、4K、4KB、1M、2^12 */
        function size(s, name) {
          var t = String(s == null ? "" : s).replace(/\s+/g, "").toUpperCase();
          if (t === "") return { err: "请输入" + name };
          var m = /^2\^(\d+)$/.exec(t);
          if (m) return { v: Math.pow(2, +m[1]) };
          m = /^(\d+(?:\.\d+)?)([KMGT]?)I?B?$/.exec(t);
          if (!m) return { err: name + "“" + s + "”格式不对，可写 4096、4K、4KB 或 2^12" };
          var mul = { "": 1, K: 1024, M: 1048576, G: 1073741824, T: 1099511627776 }[m[2]];
          var v = parseFloat(m[1]) * mul;
          if (Math.floor(v) !== v || v <= 0) return { err: name + "必须是正整数字节" };
          return { v: v };
        }
        function nums(s, opt) {
          opt = opt || {};
          var name = opt.name || "序列";
          var t = String(s == null ? "" : s).trim();
          if (t === "") return { err: "请输入" + name };
          var parts = t.split(/[\s,，、;；]+/).filter(function (x) { return x !== ""; }), out = [];
          for (var i = 0; i < parts.length; i++) {
            var r = num(parts[i], { name: name + "第 " + (i + 1) + " 项", int: opt.int, min: opt.min, max: opt.max });
            if (r.err) return r;
            out.push(r.v);
          }
          if (opt.maxLen && out.length > opt.maxLen) return { err: name + "最多 " + opt.maxLen + " 项" };
          return { v: out };
        }
        /* 矩阵：每行一个进程，行内用空格或逗号分隔 */
        function matrix(s, name) {
          var t = String(s == null ? "" : s).trim();
          if (t === "") return { err: "请输入" + name };
          var rows = t.split(/[\n;；]+/).map(function (r) { return r.trim(); }).filter(function (r) { return r !== ""; }), out = [];
          for (var i = 0; i < rows.length; i++) {
            var r = nums(rows[i].replace(/^P\d+\s*[:：]?/i, ""), { name: name + "第 " + (i + 1) + " 行", int: true, min: 0, max: 99 });
            if (r.err) return r;
            if (out.length && r.v.length !== out[0].length) return { err: name + "第 " + (i + 1) + " 行的资源种类数与第 1 行不同" };
            out.push(r.v);
          }
          return { v: out };
        }
        function le(a, b) { for (var i = 0; i < a.length; i++) if (a[i] > b[i]) return false; return true; }
        function vadd(a, b) { return a.map(function (x, i) { return x + b[i]; }); }

        var STATES = [["new", "创建"], ["ready", "就绪"], ["run", "运行"], ["block", "阻塞"], ["exit", "终止"]];
        var TRANS = {
          "new>ready": "创建完成、资源就绪后进入就绪队列（被系统“接纳”）。",
          "ready>run": "被调度程序选中，分到 CPU。",
          "run>ready": "时间片用完或被更高优先级进程抢占，仍具备运行条件。",
          "run>block": "进程主动请求 I/O、执行 wait 等，等待某事件（主动行为）。",
          "block>ready": "等待的事件发生（如 I/O 完成、被 signal 唤醒），被动地回到就绪。",
          "run>exit": "运行结束或出现无法处理的错误，撤销进程。"
        };
        var WHY_NOT = {
          "block>run": "阻塞进程等到事件后只是具备了运行条件，必须先进入就绪队列，再由调度程序分配 CPU。",
          "ready>block": "就绪进程没有占用 CPU、不执行指令，不可能主动发出 I/O 请求或 wait 而阻塞。",
          "new>run": "新建进程必须先被接纳进入就绪队列，才能被调度运行。",
          "new>block": "新建进程还没运行过，不可能因等待事件而阻塞。",
          "exit>new": "终止的进程已被撤销，不会重新进入任何状态。"
        };

        var U = PROPU.os = {
          num: num, size: size, nums: nums, matrix: matrix, fmt: fmt,
          /* 1 死锁下限 */
          deadlockMin: function (n, k) { return n * (k - 1) + 1; },
          deadlockMinMulti: function (ks) { return sum(ks.map(function (k) { return k - 1; })) + 1; },
          deadlockMaxSafeM: function (n, k) { return n * (k - 1); },
          maxProcs: function (m, k) { return k <= 1 ? Infinity : Math.floor((m - 1) / (k - 1)); },
          deadlockPossible: function (n, k, m) { return k > 1 && m <= n * (k - 1); },
          /* 最坏分配：先轮流给每个进程最多 k−1 个；还有剩余才让 P1 凑满 k 个 */
          worstAlloc: function (n, k, m) {
            var a = [], left = m, i;
            for (i = 0; i < n; i++) a.push(0);
            var gave = true;
            while (left > 0 && gave) {
              gave = false;
              for (i = 0; i < n && left > 0; i++) if (a[i] < k - 1) { a[i]++; left--; gave = true; }
            }
            var finish = -1;
            if (left > 0) { var add = Math.min(left, k - a[0]); a[0] += add; left -= add; if (a[0] === k) finish = 0; }
            return { alloc: a, free: left, finish: finish, deadlock: k > 1 && m <= n * (k - 1) };
          },
          /* 2 银行家安全性算法（每轮从 P0 开始找第一个 Need ≤ Work 的进程） */
          needFromMax: function (max, alloc) {
            if (max.length !== alloc.length) return { err: "Max 与 Allocation 的进程数不同" };
            var need = [];
            for (var i = 0; i < max.length; i++) {
              if (max[i].length !== alloc[i].length) return { err: "P" + i + " 的 Max 与 Allocation 资源种类数不同" };
              var row = [];
              for (var j = 0; j < max[i].length; j++) {
                if (max[i][j] < alloc[i][j]) return { err: "P" + i + " 的 Max 小于 Allocation（第 " + (j + 1) + " 类资源）" };
                row.push(max[i][j] - alloc[i][j]);
              }
              need.push(row);
            }
            return { v: need };
          },
          bankerCheck: function (alloc, need, avail) {
            if (!alloc.length) return { err: "至少要有 1 个进程" };
            if (alloc.length > 8) return { err: "最多 8 个进程" };
            if (alloc.length !== need.length) return { err: "Allocation 有 " + alloc.length + " 行，Need 有 " + need.length + " 行，进程数不一致" };
            var r = avail.length;
            if (r > 5) return { err: "最多 5 类资源" };
            for (var i = 0; i < alloc.length; i++) {
              if (alloc[i].length !== r) return { err: "Allocation 第 " + (i + 1) + " 行应有 " + r + " 个数（与 Available 一致）" };
              if (need[i].length !== r) return { err: "Need 第 " + (i + 1) + " 行应有 " + r + " 个数（与 Available 一致）" };
            }
            return {};
          },
          bankerSafe: function (alloc, need, avail) {
            var n = alloc.length, work = avail.slice(), fin = [], seq = [], steps = [], i;
            for (i = 0; i < n; i++) fin.push(false);
            var found = true;
            while (found) {
              found = false;
              for (i = 0; i < n; i++) {
                if (!fin[i] && le(need[i], work)) {
                  var before = work.slice();
                  work = vadd(work, alloc[i]); fin[i] = true; seq.push(i);
                  steps.push({ i: i, before: before, after: work.slice() });
                  found = true; break;
                }
              }
            }
            var left = []; for (i = 0; i < n; i++) if (!fin[i]) left.push(i);
            return { safe: seq.length === n, seq: seq, steps: steps, work: work, left: left };
          },
          /* 枚举全部安全序列（n ≤ 8） */
          bankerAll: function (alloc, need, avail, limit) {
            var n = alloc.length, out = [], count = 0, fin = [], cap = limit || 40;
            for (var i = 0; i < n; i++) fin.push(false);
            (function dfs(work, seq) {
              if (seq.length === n) { count++; if (out.length < cap) out.push(seq.slice()); return; }
              for (var j = 0; j < n; j++) if (!fin[j] && le(need[j], work)) {
                fin[j] = true; seq.push(j); dfs(vadd(work, alloc[j]), seq); seq.pop(); fin[j] = false;
              }
            })(avail.slice(), []);
            return { count: count, list: out };
          },
          /* 3 记录型信号量 */
          semInit: function (v) { return { init: v, v: v, holders: [], queue: [], next: 1, msg: "初值 S.value = " + v + "。" }; },
          semWait: function (s) {
            var t = { init: s.init, v: s.v - 1, holders: s.holders.slice(), queue: s.queue.slice(), next: s.next + 1 }, p = "P" + s.next;
            if (t.v < 0) { t.queue.push(p); t.msg = p + " 执行 wait：value 减为 " + t.v + " < 0，" + p + " 阻塞，进入等待队列。"; }
            else { t.holders.push(p); t.msg = p + " 执行 wait：value 减为 " + t.v + " ≥ 0，" + p + " 拿到资源继续运行。"; }
            return t;
          },
          semSignal: function (s) {
            var t = { init: s.init, v: s.v + 1, holders: s.holders.slice(), queue: s.queue.slice(), next: s.next };
            var who = t.holders.length ? t.holders.shift() : null;
            var m = (who ? who + " 用完资源执行 signal" : "某进程执行 signal") + "：value 加为 " + t.v;
            if (t.v <= 0) { var w = t.queue.shift(); t.holders.push(w); m += " ≤ 0，说明有进程在等，唤醒队首 " + w + "（阻塞 → 就绪）。"; }
            else m += " > 0，没有进程在等，不唤醒。";
            t.msg = m;
            return t;
          },
          semMeaning: function (v) {
            if (v > 0) return "S.value = " + v + " > 0：还有 " + v + " 个可用资源，没有进程等待。";
            if (v === 0) return "S.value = 0：资源恰好用完，没有进程等待。";
            return "S.value = " + v + " < 0：没有可用资源，等待队列中有 |" + v + "| = " + (-v) + " 个进程。";
          },
          /* 4 非抢占调度：fcfs / sjf / hrrn */
          schedule: function (jobs, alg) {
            var n = jobs.length, done = [], rows = [], gantt = [], order = [], t = 0, i, left = n;
            for (i = 0; i < n; i++) { done.push(false); rows.push(null); }
            while (left) {
              var cand = [];
              for (i = 0; i < n; i++) if (!done[i] && jobs[i].a <= t) cand.push(i);
              if (!cand.length) {
                var nx = Infinity; for (i = 0; i < n; i++) if (!done[i]) nx = Math.min(nx, jobs[i].a);
                gantt.push({ i: -1, s: t, e: nx }); t = nx; continue;
              }
              var rr = {};
              cand.forEach(function (j) { rr[j] = (t - jobs[j].a + jobs[j].b) / jobs[j].b; });
              cand.sort(function (x, y) {
                if (alg === "sjf") return jobs[x].b - jobs[y].b || jobs[x].a - jobs[y].a || x - y;
                if (alg === "hrrn") return rr[y] - rr[x] || jobs[x].a - jobs[y].a || x - y;
                return jobs[x].a - jobs[y].a || x - y;
              });
              var c = cand[0], st = t, fi = t + jobs[c].b;
              var tat = fi - jobs[c].a;
              rows[c] = { name: jobs[c].name, a: jobs[c].a, b: jobs[c].b, start: st, finish: fi, tat: tat, wtat: tat / jobs[c].b, wait: tat - jobs[c].b, rr: rr[c], rrAll: cand.map(function (j) { return { i: j, rr: rr[j] }; }) };
              gantt.push({ i: c, s: st, e: fi }); order.push(c);
              done[c] = true; left--; t = fi;
            }
            var avg = function (k) { return sum(rows.map(function (r) { return r[k]; })) / n; };
            return { rows: rows, gantt: gantt, order: order, avgTat: avg("tat"), avgWtat: avg("wtat"), avgWait: avg("wait"), end: t };
          },
          parseJobs: function (s) {
            var t = String(s == null ? "" : s).trim();
            if (t === "") return { err: "请输入作业（每行：名称 到达时间 运行时间）" };
            var lines = t.split(/[\n;；]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x; }), out = [];
            if (lines.length > 8) return { err: "最多 8 个作业" };
            for (var i = 0; i < lines.length; i++) {
              var p = lines[i].split(/[\s,，、]+/).filter(function (x) { return x !== ""; }), name = "J" + (i + 1);
              if (p.length === 3) name = p.shift();
              if (p.length !== 2) return { err: "第 " + (i + 1) + " 行应为“名称 到达时间 运行时间”或“到达时间 运行时间”" };
              var a = num(p[0], { name: "第 " + (i + 1) + " 行到达时间", min: 0, max: 999 }); if (a.err) return a;
              var b = num(p[1], { name: "第 " + (i + 1) + " 行运行时间", min: 0.01, max: 999 }); if (b.err) return b;
              out.push({ name: name.slice(0, 6), a: a.v, b: b.v });
            }
            return { v: out };
          },
          /* 5 有效访问时间（单位一致即可，演示里用 ns） */
          eat: function (o) {
            var none = 2 * o.t;
            var seq = o.a * (o.lam + o.t) + (1 - o.a) * (o.lam + 2 * o.t);
            var par = o.a * (o.lam + o.t) + (1 - o.a) * (2 * o.t);
            var base = o.mode === "par" ? par : seq, p = o.p || 0;
            return { none: none, seq: seq, par: par, base: base, total: (1 - p) * base + p * (o.fault || 0) };
          },
          /* 6 多级页表级数 */
          pageLevels: function (L, pageBytes, E) {
            if (!isPow2(pageBytes)) return { err: "页大小必须是 2 的整数次幂" };
            var P = log2i(pageBytes);
            if (L <= P) return { err: "逻辑地址位数必须大于页内偏移位数 " + P };
            if (E >= pageBytes) return { err: "页表项大小必须小于页大小" };
            var per = Math.floor(pageBytes / E), bits = Math.floor(Math.log(per) / Math.LN2 + 1e-9);
            if (bits < 1) return { err: "一页放不下 2 个页表项" };
            var vpn = L - P, levels = Math.ceil(vpn / bits), split = [];
            for (var i = 0; i < levels; i++) split.push(bits);
            split[0] = vpn - bits * (levels - 1);
            return { P: P, per: per, bits: bits, vpn: vpn, levels: levels, split: split, topEntries: Math.pow(2, split[0]) };
          },
          /* 7 页表大小 */
          pageTableSize: function (L, pageBytes, E) {
            if (!isPow2(pageBytes)) return { err: "页大小必须是 2 的整数次幂" };
            var P = log2i(pageBytes);
            if (L <= P) return { err: "逻辑地址位数必须大于页内偏移位数 " + P };
            var entries = Math.pow(2, L - P), bytes = entries * E;
            return { P: P, vpn: L - P, entries: entries, bytes: bytes, pages: Math.ceil(bytes / pageBytes) };
          },
          /* 8 页面置换 */
          replace: function (refs, frames, alg) {
            var mem = [], load = [], last = [], faults = 0, trace = [];
            for (var t = 0; t < refs.length; t++) {
              var r = refs[t], pos = mem.indexOf(r), out = null, fault = false;
              if (pos >= 0) { last[pos] = t; }
              else {
                fault = true; faults++;
                if (mem.length < frames) { mem.push(r); load.push(t); last.push(t); }
                else {
                  var v = 0, k;
                  if (alg === "lru") { for (k = 1; k < mem.length; k++) if (last[k] < last[v]) v = k; }
                  else if (alg === "opt") {
                    var far = -1;
                    for (k = 0; k < mem.length; k++) {
                      var nx = refs.indexOf(mem[k], t + 1); if (nx < 0) nx = Infinity;
                      if (nx > far || (nx === far && load[k] < load[v])) { far = nx; v = k; }
                    }
                  } else { for (k = 1; k < mem.length; k++) if (load[k] < load[v]) v = k; }
                  out = mem[v]; mem[v] = r; load[v] = t; last[v] = t;
                }
              }
              trace.push({ ref: r, mem: mem.slice(), fault: fault, out: out });
            }
            return { faults: faults, trace: trace };
          },
          beladyCurve: function (refs, maxF) {
            var res = { fifo: [], lru: [], opt: [] };
            for (var f = 1; f <= maxF; f++) {
              res.fifo.push(U.replace(refs, f, "fifo").faults);
              res.lru.push(U.replace(refs, f, "lru").faults);
              res.opt.push(U.replace(refs, f, "opt").faults);
            }
            return res;
          },
          /* 返回出现“块数 +1 缺页反而增加”的块数（下标从 1 起的块数） */
          anomalies: function (arr) { var a = []; for (var i = 1; i < arr.length; i++) if (arr[i] > arr[i - 1]) a.push(i + 1); return a; },
          /* 9 磁盘访问时间（ms） */
          diskTime: function (Ts, rpm, b, N) {
            var rev = 60000 / rpm;
            var rot = rev / 2, xfer = rev * b / N;
            return { rev: rev, seek: Ts, rot: rot, xfer: xfer, total: Ts + rot + xfer };
          },
          /* 10 混合索引最大文件长度 */
          maxFileSize: function (o) {
            var per = Math.floor(o.B / o.d);
            var bl = { direct: o.a, one: o.b * per, two: o.c * per * per, three: (o.t || 0) * per * per * per };
            var total = bl.direct + bl.one + bl.two + bl.three;
            return { per: per, blocks: bl, totalBlocks: total, bytes: total * o.B };
          },
          fmtBytes: function (x) {
            var u = ["B", "KB", "MB", "GB", "TB", "PB", "EB"], k = 0, v = x;
            while (v >= 1024 && k < u.length - 1) { v /= 1024; k++; }
            var s = (Math.floor(v) === v ? String(v) : String(round(v, 2))) + " " + u[k];
            if (k >= 2 && x % 1024 === 0 && Math.floor(v) !== v) {
              var kb = x / 1024, kk = 1;
              while (kb % 1024 === 0 && kk < k) { kb /= 1024; kk++; }
              s = kb + " " + u[kk] + " ≈ " + s;
            }
            return s;
          },
          /* 11 位示图 */
          bitmapToBlock: function (i, j, n, base) {
            if (i < base) return { err: "字号最小为 " + base };
            if (j < base || j > n - 1 + base) return { err: "位号应在 " + base + " ~ " + (n - 1 + base) + " 之间" };
            return { v: base ? n * (i - 1) + j : n * i + j };
          },
          bitmapFromBlock: function (b, n, base) {
            if (b < base) return { err: "盘块号最小为 " + base };
            if (base) return { i: Math.floor((b - 1) / n) + 1, j: (b - 1) % n + 1 };
            return { i: Math.floor(b / n), j: b % n };
          },
          bitmapBytes: function (blocks) { return Math.ceil(blocks / 8); },
          /* 12 碎片 */
          pagingFrag: function (sz, page) { var p = Math.ceil(sz / page); return { pages: p, waste: p * page - sz }; },
          fixedFrag: function (parts, jobs) {
            var used = parts.map(function () { return null; }), res = [];
            for (var i = 0; i < jobs.length; i++) {
              var k = -1;
              for (var j = 0; j < parts.length; j++) if (used[j] === null && parts[j] >= jobs[i]) { k = j; break; }
              if (k >= 0) used[k] = i;
              res.push(k);
            }
            var waste = 0;
            used.forEach(function (u, j) { if (u !== null) waste += parts[j] - jobs[u]; });
            return { place: res, used: used, waste: waste };
          },
          externalFrag: function (holes, req) {
            var total = sum(holes), max = holes.length ? Math.max.apply(null, holes) : 0;
            return { total: total, max: max, fits: max >= req, frag: total >= req && max < req };
          },
          /* 13 进程状态 */
          STATES: STATES,
          transition: function (from, to) {
            if (from === to) return { ok: false, why: "同一个状态，不构成转换。" };
            var k = from + ">" + to;
            if (TRANS[k]) return { ok: true, why: TRANS[k] };
            if (WHY_NOT[k]) return { ok: false, why: WHY_NOT[k] };
            if (from === "exit") return { ok: false, why: "终止态的进程已被撤销，不会再转换。" };
            if (to === "new") return { ok: false, why: "创建态只能由创建原语产生，其他状态不会回到创建态。" };
            if (to === "exit") return { ok: false, why: "五状态模型中只有运行态的进程结束后进入终止态（若题目允许父进程直接撤销就绪或阻塞的子进程，那是另一种画法，以题目为准）。" };
            return { ok: false, why: "五状态模型中没有这条直接转换。" };
          },
          /* 14 Bernstein 条件 */
          vars: function (s, name) {
            var t = String(s == null ? "" : s).trim();
            if (t === "") return { err: "请输入" + name + "（空集请填 ∅）" };
            if (/^(∅|空|空集|\{\s*\}|φ|Φ)$/.test(t)) return { v: [] };
            var parts = t.replace(/[{}｛｝]/g, "").split(/[\s,，、;；]+/).filter(function (x) { return x !== ""; }), out = [];
            for (var i = 0; i < parts.length; i++) {
              if (!/^[A-Za-z_\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5\[\]]*$/.test(parts[i])) return { err: name + "中的“" + parts[i] + "”不是合法的变量名" };
              if (out.indexOf(parts[i]) < 0) out.push(parts[i]);
            }
            return { v: out };
          },
          inter: function (a, b) { return a.filter(function (x) { return b.indexOf(x) >= 0; }); },
          bernstein: function (R1, W1, R2, W2) {
            var rw = U.inter(R1, W2), wr = U.inter(W1, R2), ww = U.inter(W1, W2);
            return { rw: rw, wr: wr, ww: ww, rr: U.inter(R1, R2), ok: !rw.length && !wr.length && !ww.length };
          },
          /* 赋值语句 → 读写集：a = x + y */
          rwOf: function (stmt) {
            var m = /^\s*([A-Za-z_]\w*)\s*=\s*(.+)$/.exec(stmt || "");
            if (!m) return { err: "语句应形如 a = x + y" };
            var R = [];
            (m[2].match(/[A-Za-z_]\w*/g) || []).forEach(function (v) { if (R.indexOf(v) < 0) R.push(v); });
            return { R: R, W: [m[1]] };
          }
        };

        /* ================= DOM 小工具（只在 demo 被调用时使用） ================= */
        var NS = "http://www.w3.org/2000/svg";
        function E(tag, cls, text) {
          var n = document.createElement(tag);
          if (cls) n.className = cls;
          if (text != null) n.textContent = text;
          return n;
        }
        function S(tag, attrs, parent) {
          var n = document.createElementNS(NS, tag);
          for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
          if (parent) parent.appendChild(n);
          return n;
        }
        function T(parent, x, y, str, attrs) {
          var a = { x: x, y: y, "font-size": 14, class: "x-po-t" };
          for (var k in attrs || {}) a[k] = attrs[k];
          var t = S("text", a, parent); t.textContent = str; return t;
        }
        function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

        function kit(box) {
          var L = [], timers = [], root = E("div", "x-po");
          box.appendChild(root);
          var K = {
            root: root,
            on: function (el, ev, fn) { el.addEventListener(ev, fn); L.push([el, ev, fn]); return el; },
            row: function (parent) { var r = E("div", "x-lab__opts x-po-row"); (parent || root).appendChild(r); return r; },
            btn: function (parent, label, fn, pressed, cls) {
              var b = E("button", "x-lab__btn" + (cls ? " " + cls : ""), label); b.type = "button";
              if (pressed != null) b.setAttribute("aria-pressed", pressed ? "true" : "false");
              K.on(b, "click", fn); parent.appendChild(b); return b;
            },
            seg: function (parent, items, cur, fn) {
              var g = E("div", "x-po-seg"); g.setAttribute("role", "group"); parent.appendChild(g);
              var bs = items.map(function (it) {
                return K.btn(g, it[1], function () { bs.forEach(function (b, k) { b.setAttribute("aria-pressed", items[k][0] === it[0] ? "true" : "false"); }); fn(it[0]); }, it[0] === cur);
              });
              return { set: function (v) { bs.forEach(function (b, k) { b.setAttribute("aria-pressed", items[k][0] === v ? "true" : "false"); }); } };
            },
            field: function (parent, label, val, fn, o) {
              o = o || {};
              var w = E("label", "x-po-f" + (o.wide ? " x-po-f--wide" : ""));
              w.appendChild(E("span", "x-po-fl", label));
              var inp;
              if (o.area) { inp = E("textarea", "x-lab__in x-po-area"); inp.rows = o.rows || 3; inp.spellcheck = false; }
              else { inp = E("input", "x-lab__in x-po-in" + (o.wide ? "" : " x-po-in--s")); inp.type = o.type || "text"; if (!o.type || o.type === "text") inp.setAttribute("inputmode", o.mode || "decimal"); }
              if (o.type === "range") { inp.className = "x-po-range"; inp.min = o.min; inp.max = o.max; inp.step = o.step || 1; }
              inp.value = String(val);
              inp.setAttribute("autocomplete", "off");
              w.appendChild(inp); parent.appendChild(w);
              K.on(inp, "input", fn); K.on(inp, "change", fn);
              return inp;
            },
            svg: function (w, h, label) {
              var st = E("div", "x-lab__stage x-po-stage"); root.appendChild(st);
              var s = S("svg", { viewBox: "0 0 " + w + " " + h, class: "x-po-svg", role: "img", "aria-label": label || "示意图", preserveAspectRatio: "xMidYMid meet" }, st);
              return s;
            },
            out: function () { var o = E("div", "x-po-out"); o.setAttribute("aria-live", "polite"); root.appendChild(o); return o; },
            err: function () { var o = E("div", "x-po-err"); o.setAttribute("role", "alert"); root.appendChild(o); return o; },
            timer: function (fn, ms) { var id = setTimeout(fn, ms); timers.push(id); return id; },
            destroy: function () {
              L.forEach(function (x) { x[0].removeEventListener(x[1], x[2]); });
              L = [];
              timers.forEach(function (id) { clearTimeout(id); });
              timers = [];
              if (root.parentNode) root.parentNode.removeChild(root);
            }
          };
          return K;
        }
        /* 输出：若干行 [标签, 值, 强调?] */
        function readout(out, lines) {
          clear(out);
          lines.forEach(function (l) {
            if (typeof l === "string") { out.appendChild(E("p", "x-po-line", l)); return; }
            var p = E("p", "x-po-line" + (l[2] ? " is-" + l[2] : ""));
            p.appendChild(E("span", "x-po-k", l[0]));
            p.appendChild(E("b", "x-po-v", l[1]));
            out.appendChild(p);
          });
        }
        function showErr(errBox, msg) { errBox.textContent = msg || ""; errBox.hidden = !msg; }
        function getv(r, errs) { if (r.err) errs.push(r.err); return r.v; }

        /* ================= 14 条性质 ================= */
        var CH2 = "第 2 章 进程管理", CH3 = "第 3 章 内存管理", CH4 = "第 4 章 文件管理", CH5 = "第 5 章 输入/输出（I/O）管理";

        /* ---------- 1 死锁的资源下限 ---------- */
        PROP.push({
          id: "os-deadlock-min", sub: "os", ch: CH2, name: "死锁的资源下限", toc: "死锁资源下限",
          def: "n 个进程竞争同一类资源，每个进程最多需要 k 个，系统共有 m 个。死锁：每个进程都占着一部分资源，又都在等别人释放，谁也无法推进。",
          stmt: [
            "**m ≥ n(k − 1) + 1** 时一定不会死锁",
            "m ≤ n(k − 1) 时可能死锁，可能死锁的最大资源数是 **n(k − 1)**",
            "已知 m、k（k > 1），保证不死锁最多允许 **⌊(m − 1)/(k − 1)⌋** 个进程"
          ],
          cond: "资源是同一类、可重复使用的，进程拿齐 k 个才能运行完并一次性释放。各进程需求不同（k₁、k₂、…、kₙ）时下限改为 Σ(kᵢ − 1) + 1。k = 1 时每个进程只要 1 个资源，不会因这类资源死锁。",
          proof: [
            "第一步：最坏情况是每个进程都已经拿到 k − 1 个资源，还差 1 个，谁也无法完成。",
            "第二步：这时一共用掉 n(k − 1) 个资源；若 m 恰好等于它，资源已分光，所有进程永远等下去，即可能死锁。",
            "第三步：只要再多 1 个资源，就能分给某一个进程让它凑满 k 个，运行完后释放全部 k 个资源。",
            "第四步：释放的资源又能让其他进程依次凑满，所有进程都能完成。",
            "第五步：所以不发生死锁的最少资源数为 n(k − 1) + 1；反解 n(k − 1) + 1 ≤ m 得 n ≤ (m − 1)/(k − 1)，取整即最多进程数。"
          ],
          traps: [
            "问“一定不会死锁的最少资源数”答 n(k − 1) + 1，问“可能死锁的最大资源数”答 n(k − 1)，两者差 1，别看反",
            "问“可能发生死锁的最少进程数”（2009 年真题）要解 n(k − 1) ≥ m 的最小整数 n，不是 ⌊(m − 1)/(k − 1)⌋",
            "需求不相等时不能套 n(k − 1) + 1，要逐个减 1 再求和（2014 年真题：需要 3、4、5 台 → 至少 10 台）"
          ],
          ex: {
            q: "系统有 8 台打印机，K 个进程竞争，每个进程最多要 3 台。K 最小为多少时系统就可能死锁？（ ）",
            opts: ["2", "3", "4", "5"], a: 2,
            why: "最坏情况每个进程各拿 2 台、都差 1 台。K = 3 时最坏只占 6 台，还剩 2 台，一定有进程能凑满 3 台，不会死锁（2×3 + 1 = 7 ≤ 8）。K = 4 时 8 台恰好每个进程分 2 台，全都差 1 台，可能死锁。所以 K 最小为 4，选 C。",
            src: "2009 年真题"
          },
          links: { lab: ["banker"], proc: [] },
          demo: function (box) {
            var K = kit(box), st = { n: 3, k: 3, m: 6 };
            var r1 = K.row();
            var inN = K.field(r1, "进程数 n", st.n, upd, { type: "range", min: 1, max: 6 });
            var inK = K.field(r1, "每个进程最多需要 k", st.k, upd, { type: "range", min: 2, max: 6 });
            var r2 = K.row();
            var inM = K.field(r2, "系统资源数 m", st.m, function () { st.m = +inM.value; draw(); }, { type: "range", min: 1, max: 31, wide: true });
            var r3 = K.row();
            K.btn(r3, "m = n(k−1)", function () { st.m = st.n * (st.k - 1); inM.value = st.m; draw(); });
            K.btn(r3, "m = n(k−1)+1", function () { st.m = st.n * (st.k - 1) + 1; inM.value = st.m; draw(); });
            var svg = K.svg(720, 300, "最坏分配下各进程占有的资源"), out = K.out();
            function upd() {
              st.n = +inN.value; st.k = +inK.value;
              inM.max = st.n * st.k + 1;
              if (st.m > +inM.max) { st.m = +inM.max; }
              inM.value = st.m; st.m = +inM.value;
              draw();
            }
            function draw() {
              var w = U.worstAlloc(st.n, st.k, st.m), bound = U.deadlockMin(st.n, st.k);
              clear(svg);
              svg.setAttribute("viewBox", "0 0 720 " + (70 + st.n * 36 + 46));
              T(svg, 20, 30, w.deadlock ? "最坏分配：每个进程都差 1 个，资源已分光 → 可能死锁" : "最坏分配后仍有资源可分 → 一定不死锁", { class: "x-po-t x-po-t--h " + (w.deadlock ? "is-bad" : "is-ok"), "font-size": 16 });
              var cw = Math.min(56, Math.floor(420 / st.k));
              for (var i = 0; i < st.n; i++) {
                var y = 50 + i * 36;
                T(svg, 20, y + 21, "P" + (i + 1), { "font-size": 15 });
                for (var c = 0; c < st.k; c++) {
                  var on = c < w.alloc[i];
                  S("rect", { x: 70 + c * cw, y: y, width: cw - 6, height: 28, rx: 4, class: "x-po-cell" + (on ? (w.finish === i ? " is-done" : " is-on") : (c === st.k - 1 ? " is-need" : "")) }, svg);
                }
                T(svg, 80 + st.k * cw, y + 20, "占 " + w.alloc[i] + " / 需 " + st.k + (w.finish === i ? "：凑满，可运行完并释放" : (w.alloc[i] < st.k ? "：差 " + (st.k - w.alloc[i]) + " 个" : "")), { "font-size": 14 });
              }
              var fy = 56 + st.n * 36;
              T(svg, 20, fy + 20, "空闲", { "font-size": 15 });
              for (var f = 0; f < w.free; f++) S("circle", { cx: 86 + f * 26, cy: fy + 14, r: 9, class: "x-po-tok" }, svg);
              T(svg, 86 + Math.max(w.free, 0) * 26 + 4, fy + 20, w.free ? w.free + " 个" : "0 个", { "font-size": 14 });
              readout(out, [
                ["n(k − 1) + 1 = ", st.n + "×(" + st.k + "−1) + 1 = " + bound],
                ["当前 m = " + st.m + "：", st.m >= bound ? "m ≥ " + bound + "，一定不死锁" : "m ≤ " + (bound - 1) + "，可能死锁", st.m >= bound ? "ok" : "bad"],
                ["m 个资源、每个需 k 个时最多允许进程数 ⌊(m−1)/(k−1)⌋ = ", String(U.maxProcs(st.m, st.k))]
              ]);
            }
            upd();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 2 银行家算法的安全性 ---------- */
        PROP.push({
          id: "os-banker-safe", sub: "os", ch: CH2, name: "银行家算法的安全性", toc: "银行家安全性",
          def: "Max：进程对各类资源的最大需求；Allocation：已分配数；Need：还需要数；Available（演算时记作 Work）：系统当前可用数。安全序列：按这个顺序逐个满足，每个进程都能运行完。",
          stmt: [
            "**Need = Max − Allocation**",
            "能找到安全序列 ⇔ 系统处于安全状态；找序列时要求 **Need ≤ Work**，进程完成后 **Work = Work + Allocation**",
            "安全状态一定不死锁；不安全状态**不一定**死锁，只是有可能进入死锁"
          ],
          cond: "进程必须事先声明最大需求 Max。Need ≤ Work 是向量比较，每一类资源都要满足。银行家算法属于死锁避免：每次分配前先试探分配，再做安全性检查，不安全就撤销这次分配。",
          proof: [
            "第一步：由 Need = Max − Allocation 算出每个进程还差多少，Work 初值取 Available。",
            "第二步：在未完成的进程中找一个 Need ≤ Work（每类都满足）的进程，假设把它还需要的资源全部给它。",
            "第三步：它一定能运行完并释放全部已分配资源，所以 Work = Work + Allocation，标记 Finish = true。",
            "第四步：重复第二、三步。所有进程都能标记完成时，记下的顺序就是一个安全序列，系统安全。",
            "第五步：某一轮找不到 Need ≤ Work 的进程而仍有进程未完成，说明不存在安全序列，系统不安全。",
            "第六步：完成的进程只会让 Work 变大，先满足谁不影响最终能否全部完成，所以安全与否的结论唯一；但安全序列可以不止一个。"
          ],
          traps: [
            "Work 加上的是**已分配量 Allocation**，不是 Need，也不是 Max",
            "安全序列可能不唯一，问“安全序列的个数”时每一步的所有可选分支都要数（2022 年真题）",
            "不安全 ≠ 死锁：进程可能不会真的提出最大需求，或提前释放资源"
          ],
          ex: {
            q: "三个进程 P0、P1、P2 共享三类资源 A、B、C。当前已分配：P0 (2, 0, 1)、P1 (0, 2, 0)、P2 (1, 0, 1)；还需要：P0 (0, 2, 1)、P1 (1, 2, 3)、P2 (0, 1, 3)；可用 (1, 3, 2)。此刻一共有几个安全序列？（ ）",
            opts: ["1", "2", "3", "4"], a: 1,
            why: "可用 (1, 3, 2) 只能满足 P0 的 (0, 2, 1)（P1、P2 的 C 类都要 3 个），所以第一个只能是 P0。P0 完成后 Work = (1, 3, 2) + (2, 0, 1) = (3, 3, 3)，P1、P2 都能满足，先谁都行。安全序列为 P0→P1→P2 和 P0→P2→P1，共 2 个，选 B。",
            src: "2022 年真题"
          },
          links: { lab: ["banker"], proc: [] },
          demo: function (box) {
            var K = kit(box), mode = "need", stepAt = 0, res = null, data = null;
            var r0 = K.row();
            var sg = K.seg(r0, [["need", "第二个矩阵是 Need"], ["max", "第二个矩阵是 Max"]], mode, function (v) { mode = v; parse(); });
            var r1 = K.row();
            var inA = K.field(r1, "Allocation（每行一个进程）", "2 0 1\n0 2 0\n1 0 1", parse, { area: true, rows: 4, mode: "text" });
            var inN = K.field(r1, "Need / Max", "0 2 1\n1 2 3\n0 1 3", parse, { area: true, rows: 4, mode: "text" });
            var r2 = K.row();
            var inV = K.field(r2, "Available", "1 3 2", parse, { wide: true });
            var r3 = K.row();
            var bPrev = K.btn(r3, "上一步", function () { if (stepAt > 0) { stepAt--; draw(); } });
            var bNext = K.btn(r3, "下一步", function () { if (res && stepAt < res.steps.length) { stepAt++; draw(); } }, null, "x-lab__btn--main");
            K.btn(r3, "全部", function () { if (res) { stepAt = res.steps.length; draw(); } });
            K.btn(r3, "重置", function () { stepAt = 0; draw(); });
            K.btn(r3, "换成不安全的例子", function () { inA.value = "0 1 0\n2 0 0\n3 0 2"; inN.value = "7 4 3\n1 2 2\n6 0 0"; inV.value = "1 1 1"; mode = "need"; sg.set("need"); parse(); });
            var err = K.err(), tb = E("div", "x-po-tablewrap"); K.root.appendChild(tb);
            var out = K.out();
            function parse() {
              var errs = [];
              var A = getv(U.matrix(inA.value, "Allocation"), errs), N = getv(U.matrix(inN.value, mode === "max" ? "Max" : "Need"), errs), V = getv(U.nums(inV.value, { name: "Available", int: true, min: 0, max: 99 }), errs);
              if (!errs.length && mode === "max") { var nd = U.needFromMax(N, A); if (nd.err) errs.push(nd.err); else N = nd.v; }
              if (!errs.length) { var c = U.bankerCheck(A, N, V); if (c.err) errs.push(c.err); }
              if (errs.length) { showErr(err, errs[0]); res = null; data = null; clear(tb); clear(out); bNext.disabled = true; bPrev.disabled = true; return; }
              showErr(err, "");
              data = { A: A, N: N, V: V };
              res = U.bankerSafe(A, N, V); stepAt = 0; draw();
            }
            function draw() {
              if (!res) return;
              bPrev.disabled = stepAt === 0; bNext.disabled = stepAt >= res.steps.length;
              clear(tb);
              var t = E("table", "x-po-table"), hd = E("tr");
              ["进程", "Allocation", "Need", "Need ≤ Work？", "完成顺序"].forEach(function (h) { hd.appendChild(E("th", "", h)); });
              var thead = E("thead"); thead.appendChild(hd); t.appendChild(thead);
              var tbody = E("tbody"), done = {}, work = stepAt ? res.steps[stepAt - 1].after : data.V;
              for (var s = 0; s < stepAt; s++) done[res.steps[s].i] = s + 1;
              var nextI = stepAt < res.steps.length ? res.steps[stepAt].i : -1;
              data.A.forEach(function (row, i) {
                var tr = E("tr", done[i] ? "is-done" : (i === nextI ? "is-cur" : ""));
                tr.appendChild(E("td", "", "P" + i));
                tr.appendChild(E("td", "x-po-mono", "(" + row.join(", ") + ")"));
                tr.appendChild(E("td", "x-po-mono", "(" + data.N[i].join(", ") + ")"));
                tr.appendChild(E("td", "", done[i] ? "已完成" : (le(data.N[i], work) ? "是" : "否")));
                tr.appendChild(E("td", "", done[i] ? "第 " + done[i] + " 个" : ""));
                tbody.appendChild(tr);
              });
              t.appendChild(tbody); tb.appendChild(t);
              var lines = [["当前 Work = ", "(" + work.join(", ") + ")"]];
              if (stepAt > 0) {
                var sp = res.steps[stepAt - 1];
                lines.push(["上一步：", "P" + sp.i + " 的 Need ≤ Work，运行完后 Work = (" + sp.before.join(", ") + ") + (" + data.A[sp.i].join(", ") + ") = (" + sp.after.join(", ") + ")"]);
              }
              if (stepAt >= res.steps.length) {
                if (res.safe) {
                  var all = U.bankerAll(data.A, data.N, data.V, 12);
                  lines.push(["结论：", "安全，安全序列 " + res.seq.map(function (i) { return "P" + i; }).join(" → "), "ok"]);
                  lines.push(["全部安全序列共 " + all.count + " 个：", all.list.map(function (q) { return q.map(function (i) { return "P" + i; }).join("→"); }).join("；") + (all.count > all.list.length ? "；…" : "")]);
                } else {
                  lines.push(["结论：", "不安全：剩下 " + res.left.map(function (i) { return "P" + i; }).join("、") + " 的 Need 都不 ≤ Work，找不到安全序列", "bad"]);
                }
              } else lines.push(["下一步：", "从 P0 起找第一个未完成且 Need ≤ Work 的进程：P" + nextI]);
              readout(out, lines);
            }
            parse();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 3 信号量的含义 ---------- */
        PROP.push({
          id: "os-semaphore", sub: "os", ch: CH2, name: "信号量的含义", toc: "信号量的含义",
          def: "记录型信号量 S 包含整数 S.value 和等待队列 S.L。wait(S)：value 减 1，若 value < 0 则调用进程阻塞并进入 S.L；signal(S)：value 加 1，若 value ≤ 0 则唤醒 S.L 的队首进程。",
          stmt: [
            "S.value > 0：表示**还有 value 个可用资源**，没有进程在等",
            "S.value < 0：**|S.value|** 等于等待队列中的进程数；S.value = 0：资源恰好用完、无人等待",
            "互斥信号量初值为 **1**；同步信号量初值一般为 **0**；资源信号量初值为资源个数"
          ],
          cond: "针对记录型信号量（408 默认讨论的就是这一种）。整型信号量没有等待队列，wait 时“忙等”，value 不会小于 0，也就没有“负值表示等待进程数”的说法。",
          proof: [
            "第一步：设初值为 S₀（资源总数），已执行 x 次 wait、y 次 signal，则 value = S₀ − x + y。",
            "第二步：每次 wait 申请一个资源、每次 signal 归还一个资源，所以 x − y 是“正在占用 + 正在等待”的进程数。",
            "第三步：若 x − y ≤ S₀，资源够分、没人等待，可用资源数 = S₀ − (x − y) = value ≥ 0。",
            "第四步：若 x − y > S₀，S₀ 个资源都被占着，多出来的 x − y − S₀ = −value 个进程在队列中阻塞。",
            "第五步：signal 后若 value ≤ 0，说明加 1 之前 value < 0、有人在等，必须唤醒一个，这正是 signal 的判断条件。"
          ],
          traps: [
            "signal 唤醒的条件是加 1 **之后** value ≤ 0，不是 < 0",
            "value = 0 时等待进程数是 0，不是 1",
            "已知初值和当前值：可用数看当前值（为负时可用数是 0），占用数 = 初值 − max(当前值, 0)"
          ],
          ex: {
            q: "某资源对应的信号量初值为 3，现在的值是 1。用 M 表示该资源当前可用数、N 表示正在等它的进程数，M、N 分别是（ ）。",
            opts: ["0、1", "1、0", "1、2", "2、0"], a: 1,
            why: "信号量当前值为 1 > 0，表示还有 1 个可用资源；资源有剩余就不会有进程等待，等待数为 0。初值 3 只说明已占用 3 − 1 = 2 个。选 B。",
            src: "2010 年真题"
          },
          links: { lab: ["prodcons"], proc: [] },
          demo: function (box) {
            var K = kit(box), s;
            var r1 = K.row();
            var inI = K.field(r1, "初值", 2, reset, {});
            var r2 = K.row();
            var bW = K.btn(r2, "wait(S)", function () { if (s) { s = U.semWait(s); draw(); } }, null, "x-lab__btn--main");
            var bS = K.btn(r2, "signal(S)", function () { if (s) { s = U.semSignal(s); draw(); } });
            K.btn(r2, "重置", reset);
            var err = K.err(), svg = K.svg(720, 230, "信号量值、占用者与等待队列"), out = K.out();
            function reset() {
              var r = U.num(inI.value, { name: "初值", int: true, min: 0, max: 6 });
              if (r.err) { showErr(err, r.err); s = null; bW.disabled = bS.disabled = true; clear(svg); clear(out); return; }
              showErr(err, ""); bW.disabled = bS.disabled = false;
              s = U.semInit(r.v); draw();
            }
            function draw() {
              clear(svg);
              bW.disabled = s.queue.length >= 8; bS.disabled = s.v >= 8;
              S("rect", { x: 20, y: 20, width: 190, height: 90, rx: 10, class: "x-po-box" + (s.v < 0 ? " is-bad" : "") }, svg);
              T(svg, 115, 52, "S.value", { "text-anchor": "middle", "font-size": 15 });
              T(svg, 115, 92, String(s.v), { "text-anchor": "middle", "font-size": 30, class: "x-po-t x-po-t--big" });
              T(svg, 240, 40, "可用资源", { "font-size": 15 });
              var avail = Math.max(s.v, 0);
              for (var i = 0; i < avail; i++) S("circle", { cx: 252 + i * 30, cy: 64, r: 11, class: "x-po-tok" }, svg);
              if (!avail) T(svg, 240, 70, "无", { "font-size": 14 });
              T(svg, 240, 104, "占用中（临界区 / 使用资源）：" + (s.holders.length ? s.holders.join("、") : "无"), { "font-size": 14 });
              T(svg, 20, 150, "等待队列 S.L", { "font-size": 15 });
              s.queue.forEach(function (p, k) {
                S("rect", { x: 130 + k * 70, y: 130, width: 58, height: 32, rx: 6, class: "x-po-box is-wait" }, svg);
                T(svg, 159 + k * 70, 151, p, { "text-anchor": "middle", "font-size": 14 });
              });
              if (!s.queue.length) T(svg, 130, 151, "空", { "font-size": 14 });
              T(svg, 20, 205, s.v < 0 ? "|S.value| = " + (-s.v) + " = 等待队列长度 " + s.queue.length : "S.value ≥ 0 时等待队列一定为空", { "font-size": 14, class: "x-po-t x-po-t--note" });
              readout(out, [s.msg, ["含义：", U.semMeaning(s.v), s.v < 0 ? "bad" : "ok"]]);
            }
            reset();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 4 调度指标 ---------- */
        PROP.push({
          id: "os-sched-metrics", sub: "os", ch: CH2, name: "调度指标：周转时间与带权周转时间", toc: "周转与带权周转",
          def: "周转时间：作业从到达（提交）到完成所经历的时间；带权周转时间：周转时间与实际运行时间之比；等待时间：在就绪队列中等待的总时间。响应比 = (等待时间 + 要求服务时间) / 要求服务时间。",
          stmt: [
            "周转时间 = 完成时间 − 到达时间；**带权周转时间 = 周转时间 / 运行时间**（≥ 1）",
            "等待时间 = 周转时间 − 运行时间（不考虑 I/O 时）",
            "作业同时到达时，非抢占调度中 **SJF 的平均周转时间最短**；HRRN 兼顾短作业和等待久的作业，不会饥饿"
          ],
          cond: "三个公式对任何调度算法都成立。“SJF 平均周转时间最短”严格成立的条件是作业同时到达（或调度前都已到达）且只计 CPU 时间；作业陆续到达时，抢占式的最短剩余时间优先（SRTF）才能得到最短平均周转时间。",
          proof: [
            "第一步：同时到达的 n 个作业按某个顺序执行，第 i 个执行的作业完成时间是前 i 个运行时间之和。",
            "第二步：总周转时间 = Σ 完成时间 = n·t₁ + (n − 1)·t₂ + … + 1·tₙ，越靠前的运行时间被重复加的次数越多。",
            "第三步：若较长的作业排在较短作业之前，交换二者后总和只减不增（排序不等式）。",
            "第四步：所以按运行时间从小到大执行（SJF）时总周转时间最小，平均周转时间也最小。",
            "第五步：HRRN 的响应比随等待时间增长而变大，长作业等久了也会被选中；运行时间相同时退化为 FCFS，等待时间相同时退化为 SJF。"
          ],
          traps: [
            "带权周转时间除以的是**运行时间**，不是周转时间也不是等待时间",
            "非抢占 SJF 只在当前作业完成时才重新比较，已开始运行的长作业不会被新到的短作业打断",
            "HRRN 的响应比要在**每个调度时刻**重新计算，等待时间随时刻变化"
          ],
          ex: {
            q: "作业 J1、J2、J3 在 0 时刻同时到达，运行时间分别为 6 h、3 h、1 h，单道非抢占运行。采用短作业优先（SJF）调度时，平均周转时间是（ ）。",
            opts: ["5 h", "约 1.67 h", "约 8.33 h", "15 h"], a: 0,
            why: "SJF 次序为 J3 → J2 → J1，完成时间依次为 1、4、10，周转时间就是完成时间（到达为 0），平均 (1 + 4 + 10)/3 = 5 h。约 1.67 h 是平均等待时间 (0 + 1 + 4)/3；约 8.33 h 是按 FCFS 次序 (6 + 9 + 10)/3；15 h 是总周转时间。选 A。",
            src: "典型题"
          },
          links: { lab: ["gantt"], proc: [] },
          demo: function (box) {
            var K = kit(box), alg = "sjf", jobs = null;
            var r0 = K.row();
            K.seg(r0, [["fcfs", "FCFS"], ["sjf", "SJF（非抢占）"], ["hrrn", "HRRN（高响应比）"]], alg, function (v) { alg = v; draw(); });
            var r1 = K.row();
            var inJ = K.field(r1, "作业（每行：名称 到达时间 运行时间）", "A 0 7\nB 2 4\nC 4 1\nD 5 4", parse, { area: true, rows: 4, wide: true, mode: "text" });
            var err = K.err(), svg = K.svg(720, 110, "甘特图"), tb = E("div", "x-po-tablewrap"); K.root.appendChild(tb);
            var out = K.out();
            function parse() {
              var r = U.parseJobs(inJ.value);
              if (r.err) { showErr(err, r.err); jobs = null; clear(svg); clear(tb); clear(out); return; }
              showErr(err, ""); jobs = r.v; draw();
            }
            function draw() {
              if (!jobs) return;
              var R = U.schedule(jobs, alg);
              clear(svg);
              var x0 = 40, wd = 640, sc = wd / Math.max(R.end, 1);
              T(svg, x0, 22, "甘特图（" + { fcfs: "FCFS", sjf: "SJF", hrrn: "HRRN" }[alg] + "）", { "font-size": 15 });
              var ticks = [0];
              R.gantt.forEach(function (g) {
                var x = x0 + g.s * sc, w = (g.e - g.s) * sc;
                S("rect", { x: x, y: 34, width: Math.max(w, 1), height: 38, class: "x-po-gseg" + (g.i < 0 ? " is-idle" : " c" + (g.i % 6)) }, svg);
                if (w >= 18) T(svg, x + w / 2, 58, g.i < 0 ? "空闲" : jobs[g.i].name, { "text-anchor": "middle", "font-size": 14, class: "x-po-t x-po-t--in" });
                ticks.push(g.e);
              });
              var lastX = -99;
              ticks.forEach(function (tk) {
                var x = x0 + tk * sc;
                S("line", { x1: x, y1: 72, x2: x, y2: 80, class: "x-po-axis" }, svg);
                if (x - lastX >= 22) { T(svg, x, 98, fmt(tk), { "text-anchor": "middle", "font-size": 13 }); lastX = x; }
              });
              clear(tb);
              var t = E("table", "x-po-table"), hr = E("tr");
              ["作业", "到达", "运行", "开始", "完成", "周转", "带权周转", "等待"].concat(alg === "hrrn" ? ["选中时响应比"] : []).forEach(function (h) { hr.appendChild(E("th", "", h)); });
              var th = E("thead"); th.appendChild(hr); t.appendChild(th);
              var tbd = E("tbody");
              R.rows.forEach(function (r) {
                var tr = E("tr");
                [r.name, fmt(r.a), fmt(r.b), fmt(r.start), fmt(r.finish), fmt(r.tat), fmt(r.wtat), fmt(r.wait)].concat(alg === "hrrn" ? [fmt(r.rr)] : []).forEach(function (v) { tr.appendChild(E("td", "x-po-mono", v)); });
                tbd.appendChild(tr);
              });
              t.appendChild(tbd); tb.appendChild(t);
              var cmp = ["fcfs", "sjf", "hrrn"].map(function (a) { var x = U.schedule(jobs, a); return { fcfs: "FCFS", sjf: "SJF", hrrn: "HRRN" }[a] + " " + fmt(x.avgTat); }).join(" · ");
              readout(out, [
                ["平均周转时间 = ", fmt(R.avgTat) + "　平均带权周转 = " + fmt(R.avgWtat) + "　平均等待 = " + fmt(R.avgWait)],
                ["三种算法平均周转时间：", cmp],
                "周转 = 完成 − 到达；带权周转 = 周转 / 运行；等待 = 周转 − 运行。"
              ]);
            }
            parse();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 5 有效访问时间 ---------- */
        PROP.push({
          id: "os-eat", sub: "os", ch: CH3, name: "有效访问时间（快表与缺页）", toc: "有效访问时间 EAT",
          def: "有效访问时间 EAT：从给出逻辑地址到取得数据的平均时间。t：访问一次内存的时间；λ：查一次快表（TLB）的时间；a：快表命中率；p：缺页率。",
          stmt: [
            "无快表：**EAT = 2t**（访问页表一次 + 访问数据一次）",
            "有快表、先查快表：**EAT = a(λ + t) + (1 − a)(λ + 2t)**；快表与页表同时查找：EAT = a(λ + t) + (1 − a)·2t",
            "考虑缺页：**EAT = (1 − p) × 不缺页时的访存时间 + p × 缺页处理时间**"
          ],
          cond: "单级页表、页表常驻内存。n 级页表无快表时 EAT = (n + 1)t，快表未命中时同样要多访问 n 次内存。缺页公式把缺页处理（含调页后重新访问）看成一个整体时间；题目若另说明“缺页处理后重新执行访存”，要按题意把重新访问的时间加上。",
          proof: [
            "第一步：无快表时，先访问内存中的页表取得页框号（t），再拼出物理地址访问数据（t），共 2t。",
            "第二步：先查快表的口径：命中时用 λ 拿到页框号再访存，花 λ + t。",
            "第三步：未命中时已经查了一次快表（λ），再访问页表（t），再访问数据（t），花 λ + 2t。",
            "第四步：按命中率加权：EAT = a(λ + t) + (1 − a)(λ + 2t) = λ + t + (1 − a)t。",
            "第五步：同时查找的口径：查页表与查快表并行，未命中时 λ 被页表访问掩盖，只花 2t，故 EAT = a(λ + t) + (1 − a)·2t。",
            "第六步：再计缺页：以 1 − p 的概率按上面的时间完成，以 p 的概率要经历缺页处理，加权即得。"
          ],
          traps: [
            "题目说快表与内存页表“同时查找”时，未命中只算 2t，不再加 λ",
            "a 是快表命中率，不是 Cache 命中率；若还有 Cache，每次“访存”的 t 要先换成 Cache 的平均访问时间",
            "缺页处理时间常以 ms 给出，访存时间以 ns 给出，代入前先统一单位"
          ],
          ex: {
            q: "某分页系统访问一次内存需 100 ns，查一次快表需 20 ns，快表命中率为 90%，先查快表、未命中再访问内存中的页表。不考虑缺页，有效访问时间为（ ）。",
            opts: ["130 ns", "128 ns", "200 ns", "120 ns"], a: 0,
            why: "EAT = 0.9 × (20 + 100) + 0.1 × (20 + 200) = 108 + 22 = 130 ns。128 ns 是“快表与页表同时查找”的口径 0.9 × 120 + 0.1 × 200；200 ns 是无快表的 2t；120 ns 只算了命中的情况。选 A。",
            src: "典型题"
          },
          links: { lab: [], proc: ["tlbflow", "twolevel"] },
          demo: function (box) {
            var K = kit(box), mode = "seq";
            var r0 = K.row();
            K.seg(r0, [["seq", "先查快表，未命中再查页表"], ["par", "快表与页表同时查找"]], mode, function (v) { mode = v; draw(); });
            var r1 = K.row();
            var inT = K.field(r1, "访存 t（ns）", 100, draw);
            var inL = K.field(r1, "查快表 λ（ns）", 20, draw);
            var inA = K.field(r1, "快表命中率 a", 0.9, draw);
            var r2 = K.row();
            var inP = K.field(r2, "缺页率 p", 0, draw);
            var inF = K.field(r2, "缺页处理时间（ms）", 8, draw);
            var err = K.err(), svg = K.svg(720, 190, "三种口径的访存时间对比"), out = K.out();
            function draw() {
              var errs = [];
              var t = getv(U.num(inT.value, { name: "访存时间 t", min: 0.001, max: 1e6 }), errs);
              var l = getv(U.num(inL.value, { name: "快表时间 λ", min: 0, max: 1e6 }), errs);
              var a = getv(U.num(inA.value, { name: "命中率 a", min: 0, max: 1 }), errs);
              var p = getv(U.num(inP.value, { name: "缺页率 p", min: 0, max: 1 }), errs);
              var f = getv(U.num(inF.value, { name: "缺页处理时间", min: 0, max: 1e5 }), errs);
              if (errs.length) { showErr(err, errs[0]); clear(svg); clear(out); return; }
              showErr(err, "");
              var R = U.eat({ t: t, lam: l, a: a, mode: mode, p: p, fault: f * 1e6 });
              clear(svg);
              var bars = [["无快表 2t", R.none, ""], ["先查快表", R.seq, mode === "seq" ? "is-on" : ""], ["同时查找", R.par, mode === "par" ? "is-on" : ""]];
              var mx = Math.max(R.none, R.seq, R.par), sc = 440 / mx;
              T(svg, 20, 24, "不缺页时的平均访存时间（ns）", { "font-size": 15 });
              bars.forEach(function (b, k) {
                var y = 40 + k * 46;
                T(svg, 20, y + 22, b[0], { "font-size": 14 });
                S("rect", { x: 130, y: y, width: Math.max(b[1] * sc, 2), height: 30, rx: 4, class: "x-po-bar " + b[2] }, svg);
                T(svg, 138 + b[1] * sc, y + 21, fmt(b[1]) + " ns", { "font-size": 14 });
              });
              var base = mode === "par" ? R.par : R.seq;
              readout(out, [
                ["代入：", mode === "par"
                  ? a + "×(" + l + "+" + t + ") + " + fmt(1 - a, 4) + "×2×" + t + " = " + fmt(R.par) + " ns"
                  : a + "×(" + l + "+" + t + ") + " + fmt(1 - a, 4) + "×(" + l + "+2×" + t + ") = " + fmt(R.seq) + " ns"],
                ["计缺页：", "(1 − " + p + ")×" + fmt(base) + " + " + p + "×" + f + " ms = " + fmt(R.total) + " ns" + (p > 0 ? "（≈ " + fmt(R.total / 1000, 3) + " μs）" : ""), p > 0 ? "bad" : ""],
                p > 0 ? "缺页处理以毫秒计，哪怕缺页率很小也会让平均访问时间暴涨，所以要减少缺页。" : "把缺页率调大一点，看看平均访问时间怎样被缺页处理时间主导。"
              ]);
            }
            draw();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 6 多级页表级数 ---------- */
        PROP.push({
          id: "os-pt-levels", sub: "os", ch: CH3, name: "多级页表的级数", toc: "多级页表级数",
          def: "多级页表：把很大的页表再分页，用页目录（外层页表）记录各个页表页所在的页框。通常要求每一级页表都不超过一页。",
          stmt: [
            "页内偏移 P 位，页号 L − P 位；每页可放 **2^P / E** 个页表项，每级页号最多 **log₂(2^P/E)** 位",
            "级数 = **⌈(L − P) / log₂(2^P/E)⌉**",
            "32 位逻辑地址、4 KB 页、4 B 页表项：每级 10 位，(32 − 12)/10 = **2 级**"
          ],
          cond: "前提是每一级页表（包括顶级页目录）都要装进一个页面。不能整除时，多出来的位数分给最高一级，顶级页表的项数少于一页能放的项数。若题目直接给出地址结构或允许顶级页表超过一页，按题目给定的位数划分。",
          proof: [
            "第一步：页大小 2^P 字节，页内偏移占 P 位，页号占 L − P 位。",
            "第二步：每个页表项 E 字节，一页可以放 2^P/E 个页表项，对应 log₂(2^P/E) 位页号。",
            "第三步：一张页表不能超过一页，所以每一级最多只能用 log₂(2^P/E) 位页号去索引。",
            "第四步：L − P 位页号要分成若干段，每段不超过这个位数，段数就是 ⌈(L − P)/log₂(2^P/E)⌉。",
            "第五步：示例：32 位逻辑地址、4 KB 页、4 B 页表项，每页 1024 项、每段 10 位，(32 − 12)/10 = 2 级。"
          ],
          traps: [
            "页表项大小 E 决定一页能放几项，不能直接拿页大小 2^P 当项数",
            "(L − P) 不是每级位数的整数倍时要向上取整，级数加 1 而不是舍去",
            "问页目录表项数“至少”多少（2010 年真题）：总页数 ÷ 每个二级页表能管的页数，不是一页能放的项数"
          ],
          ex: {
            q: "二级页表，按字节编址，页大小 2¹⁰ B，页表项 2 B，逻辑地址分为“页目录号 | 页号 | 页内偏移”，逻辑地址空间共 2¹⁶ 页。页目录表至少要有多少个表项？（ ）",
            opts: ["64", "128", "256", "512"], a: 1,
            why: "一页可放 2¹⁰ / 2 = 2⁹ 个页表项，即每个二级页表管 2⁹ 页。2¹⁶ 页需要 2¹⁶ / 2⁹ = 2⁷ = 128 个二级页表，所以页目录至少 128 项。选 B。",
            src: "2010 年真题"
          },
          links: { lab: [], proc: ["twolevel", "tlbflow"] },
          demo: function (box) {
            var K = kit(box);
            var r0 = K.row();
            K.btn(r0, "32 位 / 4 KB / 4 B", function () { set(32, "4K", 4); });
            K.btn(r0, "48 位 / 4 KB / 8 B", function () { set(48, "4K", 8); });
            K.btn(r0, "26 位 / 1 KB / 2 B", function () { set(26, "1K", 2); });
            var r1 = K.row();
            var inL = K.field(r1, "逻辑地址位数 L", 32, draw);
            var inP = K.field(r1, "页大小（如 4K）", "4K", draw, { mode: "text" });
            var inE = K.field(r1, "页表项 E（B）", 4, draw);
            var err = K.err(), svg = K.svg(720, 160, "逻辑地址的分段"), out = K.out();
            function set(L, P, E2) { inL.value = L; inP.value = P; inE.value = E2; draw(); }
            function draw() {
              var errs = [];
              var L = getv(U.num(inL.value, { name: "逻辑地址位数", int: true, min: 2, max: 64 }), errs);
              var P = getv(U.size(inP.value, "页大小"), errs);
              var e = getv(U.num(inE.value, { name: "页表项大小", int: true, min: 1, max: 64 }), errs);
              var R = errs.length ? null : U.pageLevels(L, P, e);
              if (R && R.err) errs.push(R.err);
              if (errs.length) { showErr(err, errs[0]); clear(svg); clear(out); return; }
              showErr(err, "");
              clear(svg);
              var segs = R.split.map(function (b, k) { return [R.levels === 1 ? "页号" : (k === 0 ? "1 级页号（页目录）" : (k + 1) + " 级页号"), b]; });
              segs.push(["页内偏移", R.P]);
              var x = 20, sc = 680 / L;
              T(svg, 20, 24, "逻辑地址 " + L + " 位（高位 → 低位）", { "font-size": 15 });
              segs.forEach(function (sg, k) {
                var w = sg[1] * sc;
                S("rect", { x: x, y: 40, width: w, height: 46, class: "x-po-seg2 " + (k === segs.length - 1 ? "is-off" : "c" + (k % 6)) }, svg);
                if (w >= 40) T(svg, x + w / 2, 68, sg[1] + " 位", { "text-anchor": "middle", "font-size": 14, class: "x-po-t x-po-t--in" });
                T(svg, x + w / 2, 108 + (k % 2) * 22, sg[0], { "text-anchor": "middle", "font-size": 13 });
                x += w;
              });
              readout(out, [
                ["每页可放页表项 = ", P + " / " + e + " = " + R.per + " 项 → 每级最多 " + R.bits + " 位"],
                ["级数 = ⌈(L − P) / 每级位数⌉ = ", "⌈(" + L + " − " + R.P + ") / " + R.bits + "⌉ = ⌈" + fmt(R.vpn / R.bits, 3) + "⌉ = " + R.levels + " 级", "ok"],
                ["顶级页表项数 = ", "2^" + R.split[0] + " = " + R.topEntries + (R.split[0] < R.bits ? "（不满一页）" : "")]
              ]);
            }
            draw();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 7 页表大小 ---------- */
        PROP.push({
          id: "os-pt-size", sub: "os", ch: CH3, name: "页表大小", toc: "页表大小",
          def: "页表为逻辑地址空间中的每一页设一个页表项，记录该页所在的页框号以及存在位、修改位等标志。",
          stmt: [
            "页表项个数 = **2^(逻辑地址位数 − 页内偏移位数)**",
            "**页表大小 = 页表项个数 × 页表项字节数**",
            "页表占用的页数 = ⌈页表大小 / 页大小⌉"
          ],
          cond: "指单级页表、按整个逻辑地址空间计算的最大页表；进程实际只用了部分空间时，题目可能按进程的页数计算。页表项字节数常由“页框号位数 + 标志位”向上取整到整字节。",
          proof: [
            "第一步：页大小 2^P 字节、按字节编址，所以页内偏移占 P 位。",
            "第二步：L 位逻辑地址中剩下 L − P 位是页号，能表示 2^(L − P) 个页。",
            "第三步：页表为每一页设一项，所以页表项个数 = 2^(L − P)。",
            "第四步：每项 E 字节，页表大小 = 2^(L − P) × E 字节。",
            "第五步：例如 32 位地址、4 KB 页、4 B 页表项：2²⁰ × 4 B = 4 MB，要占 1024 个页，这正是引入多级页表的原因。"
          ],
          traps: [
            "按字编址时页内偏移按“字”数计算，位数会比按字节编址少",
            "由物理地址推页表项大小：页框号位数 = 物理地址位数 − 页内偏移位数，加上标志位后向上取整到字节",
            "问“页表占几页”要向上取整"
          ],
          ex: {
            q: "某系统按字节编址，逻辑地址 32 位，页大小 4 KB，页表项 4 B，采用单级页表，则一个进程的页表最大为（ ）。",
            opts: ["4 MB", "4 KB", "1 MB", "16 MB"], a: 0,
            why: "页内偏移 12 位，页号 20 位，页表项 2²⁰ 个，页表大小 2²⁰ × 4 B = 4 MB。1 MB 是把页表项个数 2²⁰ 误当成字节数；4 KB 是一页的大小；16 MB 是把页号算成 22 位。选 A。",
            src: "典型题"
          },
          links: { lab: [], proc: ["twolevel"] },
          demo: function (box) {
            var K = kit(box);
            var r1 = K.row();
            var inL = K.field(r1, "逻辑地址位数", 32, draw);
            var inP = K.field(r1, "页大小（如 4K）", "4K", draw, { mode: "text" });
            var inE = K.field(r1, "页表项（B）", 4, draw);
            var err = K.err(), svg = K.svg(720, 170, "页号与页表"), out = K.out();
            function draw() {
              var errs = [];
              var L = getv(U.num(inL.value, { name: "逻辑地址位数", int: true, min: 2, max: 64 }), errs);
              var P = getv(U.size(inP.value, "页大小"), errs);
              var e = getv(U.num(inE.value, { name: "页表项大小", int: true, min: 1, max: 64 }), errs);
              var R = errs.length ? null : U.pageTableSize(L, P, e);
              if (R && R.err) errs.push(R.err);
              if (errs.length) { showErr(err, errs[0]); clear(svg); clear(out); return; }
              showErr(err, "");
              clear(svg);
              var sc = 680 / L, w1 = R.vpn * sc;
              S("rect", { x: 20, y: 20, width: w1, height: 40, class: "x-po-seg2 c0" }, svg);
              S("rect", { x: 20 + w1, y: 20, width: R.P * sc, height: 40, class: "x-po-seg2 is-off" }, svg);
              T(svg, 20 + w1 / 2, 45, "页号 " + R.vpn + " 位", { "text-anchor": "middle", "font-size": 14, class: "x-po-t x-po-t--in" });
              T(svg, 20 + w1 + R.P * sc / 2, 45, R.P * sc > 70 ? "偏移 " + R.P + " 位" : R.P + "", { "text-anchor": "middle", "font-size": 14 });
              /* 页表示意：最多画 8 行，中间省略 */
              S("rect", { x: 20, y: 76, width: 260, height: 84, rx: 6, class: "x-po-box" }, svg);
              T(svg, 30, 98, "页表：" + R.entries.toLocaleString("en-US") + " 项", { "font-size": 14 });
              T(svg, 30, 122, "每项 " + e + " B", { "font-size": 14 });
              T(svg, 30, 146, "共 " + U.fmtBytes(R.bytes), { "font-size": 14 });
              T(svg, 300, 110, "占 ⌈" + U.fmtBytes(R.bytes) + " / " + U.fmtBytes(P) + "⌉ = " + R.pages.toLocaleString("en-US") + " 页", { "font-size": 15 });
              T(svg, 300, 140, R.pages > 1 ? "超过一页 → 需要多级页表才能让每张表都放进一页" : "一页就放得下", { "font-size": 14, class: "x-po-t x-po-t--note" });
              readout(out, [
                ["页表项个数 = ", "2^(" + L + " − " + R.P + ") = 2^" + R.vpn + " = " + R.entries.toLocaleString("en-US")],
                ["页表大小 = ", "2^" + R.vpn + " × " + e + " B = " + U.fmtBytes(R.bytes), "ok"]
              ]);
            }
            draw();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 8 Belady 异常 ---------- */
        PROP.push({
          id: "os-belady", sub: "os", ch: CH3, name: "Belady 异常", toc: "Belady 异常",
          def: "Belady 异常：分配给进程的物理块数增加，缺页次数反而增加的现象。栈式算法：n 个块时内存中的页面集合总是 n + 1 个块时页面集合的子集。",
          stmt: [
            "**FIFO** 置换算法可能出现 Belady 异常",
            "**LRU、OPT** 是栈式算法，物理块增加时缺页次数不会增加",
            "经典串 1,2,3,4,1,2,5,1,2,3,4,5 用 FIFO：3 块缺页 **9** 次、4 块缺页 **10** 次"
          ],
          cond: "是“可能”出现：FIFO 并非对每个访问串都异常，多数情况下块数越多缺页越少。缺页次数包括开始时把页面装入空闲块的那几次（常见约定，真题一般也这样计）。",
          proof: [
            "第一步：FIFO 只看页面进入内存的先后，不看最近是否被访问；块数一变，页面进出的节拍就跟着变。",
            "第二步：经典串 3 块时：1、2、3、4、1、2、5 共缺 7 次，接着 1、2 命中，3、4 缺页，5 命中，共 9 次。",
            "第三步：4 块时：1、2、3、4 缺 4 次，1、2 命中，5 缺页淘汰 1，随后 1、2、3、4、5 依次缺页，共 10 次。",
            "第四步：LRU 在 n 块时保留最近用过的 n 个页面，它一定包含在 n + 1 块保留的最近 n + 1 个页面之中（栈性质）。",
            "第五步：所以凡是 n + 1 块时缺页的访问，n 块时也一定缺页，块数增加缺页次数不增；OPT 同理。FIFO 没有栈性质，于是可能异常。"
          ],
          traps: [
            "只有 FIFO 一类算法会异常；CLOCK 在访问位全为 1 时退化成 FIFO，也不保证没有异常，题目问“一定不会”只选 LRU、OPT",
            "Belady 异常说的是“块数增加、缺页增加”，不是“缺页率高”",
            "数缺页次数时别漏掉开头填满空闲块的那几次"
          ],
          ex: {
            q: "Belady 异常指分配给进程的页框变多、缺页次数反而增加。下列置换算法中，可能出现这种现象的是（ ）。Ⅰ. LRU　Ⅱ. FIFO　Ⅲ. OPT",
            opts: ["仅Ⅱ", "仅Ⅰ、Ⅱ", "仅Ⅰ、Ⅲ", "仅Ⅱ、Ⅲ"], a: 0,
            why: "LRU 和 OPT 都是栈式算法，块数增加时内存中的页面集合只会扩大，缺页不会增加；只有 FIFO 可能出现 Belady 异常。选 A。",
            src: "2014 年真题"
          },
          links: { lab: ["paging"], proc: [] },
          demo: function (box) {
            var K = kit(box), alg = "fifo", frames = 3, refs = null;
            var r1 = K.row();
            var inR = K.field(r1, "页面访问串", "1,2,3,4,1,2,5,1,2,3,4,5", parse, { wide: true, mode: "text" });
            var r2 = K.row();
            K.seg(r2, [["fifo", "FIFO"], ["lru", "LRU"], ["opt", "OPT"]], alg, function (v) { alg = v; draw(); });
            var fs = K.seg(r2, [[1, "1 块"], [2, "2 块"], [3, "3 块"], [4, "4 块"], [5, "5 块"], [6, "6 块"]], frames, function (v) { frames = v; draw(); });
            var err = K.err(), svg = K.svg(720, 260, "缺页次数随物理块数的变化"), tb = E("div", "x-po-tablewrap"); K.root.appendChild(tb);
            var out = K.out();
            function parse() {
              var r = U.nums(inR.value, { name: "访问串", int: true, min: 0, max: 99, maxLen: 30 });
              if (!r.err && r.v.length < 2) r = { err: "访问串至少 2 项" };
              if (r.err) { showErr(err, r.err); refs = null; clear(svg); clear(tb); clear(out); return; }
              showErr(err, ""); refs = r.v; draw();
            }
            function draw() {
              if (!refs) return;
              fs.set(frames);
              var maxF = 6, C = U.beladyCurve(refs, maxF), mx = Math.max.apply(null, C.fifo.concat(C.lru, C.opt));
              clear(svg);
              var x0 = 60, y0 = 210, w = 600, h = 170, sx = w / (maxF - 1), sy = h / Math.max(mx, 1);
              S("line", { x1: x0, y1: y0, x2: x0 + w, y2: y0, class: "x-po-axis" }, svg);
              S("line", { x1: x0, y1: y0, x2: x0, y2: y0 - h - 10, class: "x-po-axis" }, svg);
              T(svg, x0 + w, y0 + 40, "物理块数", { "text-anchor": "end", "font-size": 13 });
              T(svg, 14, 24, "缺页次数", { "font-size": 13 });
              for (var f = 1; f <= maxF; f++) T(svg, x0 + (f - 1) * sx, y0 + 20, String(f), { "text-anchor": "middle", "font-size": 13 });
              for (var g = 0; g <= mx; g += Math.max(1, Math.ceil(mx / 5))) {
                T(svg, x0 - 10, y0 - g * sy + 5, String(g), { "text-anchor": "end", "font-size": 13 });
                S("line", { x1: x0, y1: y0 - g * sy, x2: x0 + w, y2: y0 - g * sy, class: "x-po-grid" }, svg);
              }
              [["opt", "OPT"], ["lru", "LRU"], ["fifo", "FIFO"]].forEach(function (a, k) {
                var pts = C[a[0]].map(function (v, i) { return (x0 + i * sx) + "," + (y0 - v * sy); }).join(" ");
                S("polyline", { points: pts, class: "x-po-line2 is-" + a[0] + (alg === a[0] ? " is-sel" : "") }, svg);
                C[a[0]].forEach(function (v, i) { S("circle", { cx: x0 + i * sx, cy: y0 - v * sy, r: a[0] === "fifo" ? 5 : 4, class: "x-po-dot is-" + a[0] }, svg); });
                T(svg, 560, 24 + k * 20, a[1], { "font-size": 13, class: "x-po-t x-po-lg is-" + a[0] });
              });
              var an = U.anomalies(C.fifo);
              an.forEach(function (fv) {
                var cx = x0 + (fv - 1) * sx, cy = y0 - C.fifo[fv - 1] * sy;
                S("circle", { cx: cx, cy: cy, r: 11, class: "x-po-ring" }, svg);
                T(svg, cx, cy - 16, "异常", { "text-anchor": "middle", "font-size": 13, class: "x-po-t is-bad" });
              });
              var R = U.replace(refs, frames, alg);
              clear(tb);
              var t = E("table", "x-po-table x-po-table--trace"), tbd = E("tbody"), hr = E("tr");
              hr.appendChild(E("th", "", "访问"));
              R.trace.forEach(function (s) { hr.appendChild(E("th", "x-po-mono", String(s.ref))); });
              var th = E("thead"); th.appendChild(hr); t.appendChild(th);
              for (var fr = 0; fr < frames; fr++) {
                var tr = E("tr"); tr.appendChild(E("th", "", "块 " + (fr + 1)));
                R.trace.forEach(function (s) { tr.appendChild(E("td", "x-po-mono" + (s.fault && s.mem[fr] === s.ref ? " is-in" : ""), s.mem[fr] == null ? "" : String(s.mem[fr]))); });
                tbd.appendChild(tr);
              }
              var fr2 = E("tr"); fr2.appendChild(E("th", "", "缺页"));
              R.trace.forEach(function (s) { fr2.appendChild(E("td", s.fault ? "is-fault" : "", s.fault ? "×" : "")); });
              tbd.appendChild(fr2); t.appendChild(tbd); tb.appendChild(t);
              readout(out, [
                ["FIFO 各块数缺页：", C.fifo.map(function (v, i) { return (i + 1) + " 块 " + v; }).join("，")],
                ["LRU / OPT：", C.lru.join("、") + " / " + C.opt.join("、") + "（块数增加只减不增）"],
                an.length ? ["FIFO 出现 Belady 异常：", an.map(function (fv) { return (fv - 1) + " 块 → " + fv + " 块：" + C.fifo[fv - 2] + " → " + C.fifo[fv - 1]; }).join("；"), "bad"]
                  : ["这个访问串：", "FIFO 没有出现 Belady 异常", "ok"],
                ["当前 " + alg.toUpperCase() + "、" + frames + " 块：", "缺页 " + R.faults + " 次，缺页率 " + fmt(R.faults / refs.length * 100, 1) + "%"]
              ]);
            }
            parse();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 9 磁盘访问时间 ---------- */
        PROP.push({
          id: "os-disk-time", sub: "os", ch: CH5, name: "磁盘访问时间", toc: "磁盘访问时间",
          def: "寻道时间 Ts：磁头移动到目标磁道的时间；旋转延迟：目标扇区转到磁头下的时间，平均为转半圈；传输时间：读写 b 字节所需转过的时间。",
          stmt: [
            "**Ta = Ts + 1/(2r) + b/(rN)**",
            "r 为转速（转/秒），N 为每道字节数；1/(2r) 是平均旋转延迟，b/(rN) 是传输时间",
            "7200 转/分时转一圈约 8.33 ms，平均旋转延迟约 4.17 ms"
          ],
          cond: "这是平均值口径：寻道取平均寻道时间，旋转延迟取半圈。读一个扇区时传输时间 = 转一圈的时间 / 每道扇区数。顺序读同一磁道上的连续扇区只需一次寻道和一次旋转延迟；随机读取每次都要重新寻道。",
          proof: [
            "第一步：访问一次磁盘要先把磁头移到目标磁道，用时 Ts。",
            "第二步：转速 r 转/秒，转一圈 1/r 秒；目标扇区可能在任意位置，平均要等半圈，旋转延迟为 1/(2r)。",
            "第三步：每道 N 字节，转一圈读 N 字节；读 b 字节要转 b/N 圈，用时 b/(rN)。",
            "第四步：三段依次发生、互不重叠，所以 Ta = Ts + 1/(2r) + b/(rN)。",
            "第五步：寻道时间占大头且与请求顺序有关，所以磁盘调度算法（SSTF、SCAN 等）的目标是减少寻道时间。"
          ],
          traps: [
            "转速常给“转/分”，代入 r 前先换成“转/秒”，或直接算转一圈的毫秒数",
            "平均旋转延迟是半圈，不是一圈",
            "磁盘调度算法只能减少寻道时间，不能减少旋转延迟和传输时间"
          ],
          ex: {
            q: "某磁盘转速为 7200 转/分，平均寻道时间为 5 ms，每个磁道有 500 个扇区。读取一个扇区的平均访问时间约为（ ）。",
            opts: ["9.18 ms", "13.35 ms", "5.02 ms", "4.18 ms"], a: 0,
            why: "转一圈 60 000 / 7200 ≈ 8.33 ms；平均旋转延迟 8.33 / 2 ≈ 4.17 ms；传输一个扇区 8.33 / 500 ≈ 0.017 ms。Ta ≈ 5 + 4.17 + 0.017 ≈ 9.18 ms。13.35 ms 把旋转延迟算成了一整圈；5.02 ms 漏了旋转延迟；4.18 ms 漏了寻道时间。（数据取自 2022 年综合题，改编为选择题）选 A。",
            src: "典型题"
          },
          links: { lab: ["disk"], proc: [] },
          demo: function (box) {
            var K = kit(box);
            var r1 = K.row();
            var inS = K.field(r1, "平均寻道 Ts（ms）", 5, draw);
            var inR = K.field(r1, "转速（转/分）", 7200, draw);
            var r2 = K.row();
            var inB = K.field(r2, "读取字节数 b", 512, draw);
            var inN = K.field(r2, "每道字节数 N", 256000, draw);
            var err = K.err(), svg = K.svg(720, 150, "访问时间的三段组成"), out = K.out();
            function draw() {
              var errs = [];
              var ts = getv(U.num(inS.value, { name: "寻道时间", min: 0, max: 1000 }), errs);
              var rpm = getv(U.num(inR.value, { name: "转速", min: 1, max: 100000 }), errs);
              var b = getv(U.num(inB.value, { name: "读取字节数", min: 0, max: 1e9 }), errs);
              var N = getv(U.num(inN.value, { name: "每道字节数", min: 1, max: 1e9 }), errs);
              if (errs.length) { showErr(err, errs[0]); clear(svg); clear(out); return; }
              showErr(err, "");
              var R = U.diskTime(ts, rpm, b, N);
              clear(svg);
              var sc = 660 / Math.max(R.total, 1e-9), x = 30;
              T(svg, 30, 24, "Ta = " + fmt(R.total, 3) + " ms", { "font-size": 16 });
              [["寻道", R.seek, "c0"], ["旋转延迟", R.rot, "c1"], ["传输", R.xfer, "c2"]].forEach(function (p, k) {
                var w = p[1] * sc;
                S("rect", { x: x, y: 40, width: Math.max(w, 1), height: 40, class: "x-po-seg2 " + p[2] }, svg);
                T(svg, 30 + k * 230, 112, p[0] + " " + fmt(p[1], 3) + " ms", { "font-size": 14, class: "x-po-t x-po-lg " + p[2] });
                S("rect", { x: 30 + k * 230 - 2, y: 124, width: 30, height: 8, class: "x-po-seg2 " + p[2] }, svg);
                x += w;
              });
              readout(out, [
                ["转一圈 = 60000 / " + rpm + " = ", fmt(R.rev, 3) + " ms"],
                ["平均旋转延迟 1/(2r) = ", fmt(R.rot, 3) + " ms；传输时间 b/(rN) = " + fmt(R.rev, 3) + "×" + b + "/" + N + " = " + fmt(R.xfer, 4) + " ms"],
                ["Ta = Ts + 1/(2r) + b/(rN) = ", fmt(R.total, 3) + " ms", "ok"]
              ]);
            }
            draw();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 10 混合索引最大文件长度 ---------- */
        PROP.push({
          id: "os-mixed-index", sub: "os", ch: CH4, name: "混合索引的最大文件长度", toc: "混合索引文件长度",
          def: "混合索引：索引结点中既有直接地址项（直接指向数据块），也有一级、二级、三级间接地址项（指向存放盘块地址的索引块）。",
          stmt: [
            "每个索引块可放 **B/d** 个地址（B 为盘块大小，d 为地址项字节数）",
            "最大文件长度 = **(a + b·(B/d) + c·(B/d)² + t·(B/d)³) × B**",
            "a、b、c、t 分别是直接、一级、二级、三级间接地址项的个数"
          ],
          cond: "前提是索引块与数据块大小相同（都是 B）。地址项 d 字节还要能表示全部盘块号；若磁盘可寻址的总容量更小，最大文件长度要和它取较小值。",
          proof: [
            "第一步：一个直接地址项指向 1 个数据块，a 个直接项共 a 个数据块。",
            "第二步：一个一级间接项指向一个索引块，索引块里有 B/d 个地址，各指向一个数据块，共 B/d 个数据块。",
            "第三步：二级间接项指向的索引块里每个地址又指向一个索引块，共 (B/d)² 个数据块；三级间接同理为 (B/d)³ 个。",
            "第四步：把各级数据块数相加，再乘以块大小 B，就是最大文件长度。",
            "第五步：例：4 个直接、2 个一级、1 个二级，d = 4 B，B = 256 B：每块 64 个地址，(4 + 2×64 + 64²) × 256 B = 4228 × 256 B = 1057 KB。"
          ],
          traps: [
            "二级间接是 (B/d)² 个块，不是 2·(B/d)",
            "先算块数再乘块大小，最后换算单位（1057 KB 这类答案）",
            "问访问某个逻辑块要读几次磁盘：直接项 1 次，一级 2 次，二级 3 次（索引结点不在内存时再加 1 次）"
          ],
          ex: {
            q: "索引结点有 7 个地址项：4 个直接、2 个一级间接、1 个二级间接，每项 4 B；索引块和数据块都是 256 B。单个文件最大能有多长？（ ）",
            opts: ["33 KB", "519 KB", "1057 KB", "16513 KB"], a: 2,
            why: "每个索引块放 256 / 4 = 64 个地址。最大块数 4 + 2×64 + 64² = 4228，乘以 256 B 得 1 082 368 B = 1057 KB。选 C。",
            src: "2010 年真题"
          },
          links: { lab: [], proc: ["mixidx", "fileopen"] },
          demo: function (box) {
            var K = kit(box);
            var r0 = K.row();
            K.btn(r0, "2010 年真题参数", function () { set(4, 2, 1, 0, "256", 4); });
            K.btn(r0, "10 直接 + 一/二/三级各 1、4 KB 块", function () { set(10, 1, 1, 1, "4K", 4); });
            var r1 = K.row();
            var inA = K.field(r1, "直接 a", 4, draw);
            var inB = K.field(r1, "一级 b", 2, draw);
            var inC = K.field(r1, "二级 c", 1, draw);
            var inT = K.field(r1, "三级 t", 0, draw);
            var r2 = K.row();
            var inBs = K.field(r2, "盘块大小 B", "256", draw, { mode: "text" });
            var inD = K.field(r2, "地址项 d（B）", 4, draw);
            var err = K.err(), svg = K.svg(720, 250, "混合索引结构"), out = K.out();
            function set(a, b, c, t, B, d) { inA.value = a; inB.value = b; inC.value = c; inT.value = t; inBs.value = B; inD.value = d; draw(); }
            function draw() {
              var errs = [];
              var a = getv(U.num(inA.value, { name: "直接地址项个数", int: true, min: 0, max: 64 }), errs);
              var b = getv(U.num(inB.value, { name: "一级间接项个数", int: true, min: 0, max: 8 }), errs);
              var c = getv(U.num(inC.value, { name: "二级间接项个数", int: true, min: 0, max: 8 }), errs);
              var t = getv(U.num(inT.value, { name: "三级间接项个数", int: true, min: 0, max: 4 }), errs);
              var B = getv(U.size(inBs.value, "盘块大小"), errs);
              var d = getv(U.num(inD.value, { name: "地址项大小", int: true, min: 1, max: 16 }), errs);
              if (!errs.length && d >= B) errs.push("地址项大小必须小于盘块大小");
              if (errs.length) { showErr(err, errs[0]); clear(svg); clear(out); return; }
              showErr(err, "");
              var R = U.maxFileSize({ a: a, b: b, c: c, t: t, B: B, d: d });
              clear(svg);
              S("rect", { x: 20, y: 20, width: 150, height: 210, rx: 8, class: "x-po-box" }, svg);
              T(svg, 95, 44, "索引结点", { "text-anchor": "middle", "font-size": 15 });
              var rows = [["直接 × " + a, a, "数据块 × " + a, String(a)], ["一级 × " + b, b, "索引块 → 数据块", b + "×" + R.per], ["二级 × " + c, c, "索引块 → 索引块 → 数据块", c + "×" + R.per + "²"], ["三级 × " + t, t, "三层索引块 → 数据块", t + "×" + R.per + "³"]];
              var vals = [R.blocks.direct, R.blocks.one, R.blocks.two, R.blocks.three];
              rows.forEach(function (rw, k) {
                var y = 60 + k * 42;
                S("rect", { x: 32, y: y, width: 126, height: 32, rx: 4, class: "x-po-cell" + (rw[1] ? " is-on" : "") }, svg);
                T(svg, 95, y + 21, rw[0], { "text-anchor": "middle", "font-size": 14 });
                if (rw[1]) {
                  S("line", { x1: 158, y1: y + 16, x2: 200, y2: y + 16, class: "x-po-arrow" }, svg);
                  for (var q = 0; q <= k && q < 3; q++) S("rect", { x: 204 + q * 26, y: y + 4, width: 20, height: 24, rx: 3, class: "x-po-cell " + (q === k || k === 0 ? "is-done" : "is-idx") }, svg);
                  T(svg, 300, y + 21, rw[2], { "font-size": 13 });
                  T(svg, 700, y + 21, rw[3] + " = " + vals[k].toLocaleString("en-US") + " 块", { "text-anchor": "end", "font-size": 14 });
                }
              });
              T(svg, 200, 236, "每个索引块放 B/d = " + B + "/" + d + " = " + R.per + " 个地址", { "font-size": 14, class: "x-po-t x-po-t--note" });
              readout(out, [
                ["总块数 = ", vals.map(function (v) { return v.toLocaleString("en-US"); }).join(" + ") + " = " + R.totalBlocks.toLocaleString("en-US") + " 块"],
                ["最大文件长度 = ", R.totalBlocks.toLocaleString("en-US") + " × " + B + " B = " + R.bytes.toLocaleString("en-US") + " B = " + U.fmtBytes(R.bytes), "ok"]
              ]);
            }
            draw();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 11 位示图换算 ---------- */
        PROP.push({
          id: "os-bitmap", sub: "os", ch: CH4, name: "位示图换算", toc: "位示图换算",
          def: "位示图：用一个二进制位表示一个盘块是否空闲（常见约定：0 表示空闲、1 表示已分配；也有题目反过来，以题目为准），按字长 n 位组织成若干个字。",
          stmt: [
            "从 0 编号：**b = n·i + j**；反过来 **i = ⌊b / n⌋，j = b mod n**",
            "从 1 编号（字号、位号、盘块号都从 1 开始）：**b = n(i − 1) + j**；i = ⌊(b − 1)/n⌋ + 1，j = (b − 1) mod n + 1",
            "位示图大小 = 盘块总数（位）= 盘块总数 / 8（字节）"
          ],
          cond: "行号（字号）、列号（位号）有从 0 开始和从 1 开始两种约定，近年真题多从 0 开始，做题时以题目给出的为准；若字号从 0、位号从 1 这样混合编号，要按题意逐项调整。",
          proof: [
            "第一步：每个字有 n 位；第 i 个字（从 0 开始）前面共有 i 个完整的字，即 n·i 个盘块。",
            "第二步：再加上本字内的位号 j，得到盘块号 b = n·i + j。",
            "第三步：反过来，b 除以 n 的商是前面完整字的个数，即字号 i = ⌊b/n⌋；余数是字内位置，即位号 j = b mod n。",
            "第四步：从 1 开始编号时，先把三者都减 1 转成从 0 开始：b − 1 = n(i − 1) + (j − 1)，整理得 b = n(i − 1) + j。",
            "第五步：反算时同样先减 1 再除：i = ⌊(b − 1)/n⌋ + 1，j = (b − 1) mod n + 1。"
          ],
          traps: [
            "从 1 编号时反算要先 b − 1 再除，直接用 ⌊b/n⌋ 在 b 是 n 的倍数时会错",
            "位示图占几个“块”：位数 ÷ 8 ÷ 块大小，再向上取整（2014 年真题：10 GB 分区、4 KB 簇 → 80 个簇）",
            "0 和 1 哪个表示空闲由题目规定，不要想当然"
          ],
          ex: {
            q: "一个 10 GB 的磁盘分区以 4 KB 的簇为分配单位，用位图管理空闲空间（每簇 1 位）。位图本身要占多少个簇？（ ）",
            opts: ["80", "320", "80K", "320K"], a: 0,
            why: "簇数 = 10 GB / 4 KB = 2.5 M 个，位图要 2.5 M 位 = 2.5 M / 8 B = 320 KB，占 320 KB / 4 KB = 80 个簇。320 是 KB 数不是簇数。选 A。",
            src: "2014 年真题"
          },
          links: { lab: [], proc: [] },
          demo: function (box) {
            var K = kit(box), base = 0, dir = "ij";
            var r0 = K.row();
            K.seg(r0, [[0, "从 0 编号"], [1, "从 1 编号"]], base, function (v) { base = v; draw(); });
            K.seg(r0, [["ij", "（字号 i, 位号 j）→ 盘块号 b"], ["b", "盘块号 b →（i, j）"]], dir, function (v) { dir = v; sync(); draw(); });
            var r1 = K.row();
            var inN = K.field(r1, "字长 n", 16, draw);
            var inI = K.field(r1, "字号 i", 2, draw);
            var inJ = K.field(r1, "位号 j", 5, draw);
            var inB = K.field(r1, "盘块号 b", 37, draw);
            var err = K.err(), svg = K.svg(720, 210, "位示图"), out = K.out();
            function sync() { inI.disabled = inJ.disabled = dir !== "ij"; inB.disabled = dir === "ij"; }
            function draw() {
              var errs = [];
              var n = getv(U.num(inN.value, { name: "字长", int: true, min: 2, max: 32 }), errs), i, j, b, R;
              if (dir === "ij") {
                i = getv(U.num(inI.value, { name: "字号", int: true, min: 0, max: 9999 }), errs);
                j = getv(U.num(inJ.value, { name: "位号", int: true, min: 0, max: 99 }), errs);
                if (!errs.length) { R = U.bitmapToBlock(i, j, n, base); if (R.err) errs.push(R.err); else b = R.v; }
              } else {
                b = getv(U.num(inB.value, { name: "盘块号", int: true, min: 0, max: 999999 }), errs);
                if (!errs.length) { R = U.bitmapFromBlock(b, n, base); if (R.err) errs.push(R.err); else { i = R.i; j = R.j; } }
              }
              if (errs.length) { showErr(err, errs[0]); clear(svg); clear(out); return; }
              showErr(err, "");
              clear(svg);
              var cw = Math.min(36, Math.floor(620 / n)), x0 = 80, top = Math.max(base, i - 1), rows = 4;
              for (var c = 0; c < n; c++) if (cw >= 18 || c % 2 === 0) T(svg, x0 + c * cw + cw / 2, 26, String(c + base), { "text-anchor": "middle", "font-size": 13 });
              T(svg, 10, 26, "位号 →", { "font-size": 13 });
              for (var r = 0; r < rows; r++) {
                var wi = top + r, y = 38 + r * 38;
                T(svg, 10, y + 22, "字 " + wi, { "font-size": 14 });
                for (c = 0; c < n; c++) {
                  var hit = wi === i && c + base === j;
                  S("rect", { x: x0 + c * cw, y: y, width: cw - 3, height: 30, rx: 3, class: "x-po-cell" + (hit ? " is-done" : ((wi * 7 + c * 3) % 5 === 0 ? " is-on" : "")) }, svg);
                }
              }
              T(svg, 10, 200, "深色格 = 要找的位；浅色格示意已分配（1），白格示意空闲（0）", { "font-size": 13, class: "x-po-t x-po-t--note" });
              readout(out, [
                dir === "ij"
                  ? ["b = ", (base ? n + "×(" + i + " − 1) + " + j : n + "×" + i + " + " + j) + " = " + b, "ok"]
                  : ["i, j = ", base ? "⌊(" + b + " − 1)/" + n + "⌋ + 1 = " + i + "，(" + b + " − 1) mod " + n + " + 1 = " + j : "⌊" + b + "/" + n + "⌋ = " + i + "，" + b + " mod " + n + " = " + j, "ok"],
                ["另一种编号下同一位置：", base ? "从 0 编号是 i = " + (i - 1) + "、j = " + (j - 1) + "、b = " + (b - 1) : "从 1 编号是 i = " + (i + 1) + "、j = " + (j + 1) + "、b = " + (b + 1)]
              ]);
            }
            sync(); draw();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 12 动态分区与碎片 ---------- */
        PROP.push({
          id: "os-fragment", sub: "os", ch: CH3, name: "内部碎片与外部碎片", toc: "内部与外部碎片",
          def: "内部碎片：分配给进程的区域内部没有用上的空间；外部碎片：分区之外、因为太小而分配不出去的空闲小块。",
          stmt: [
            "**固定分区、分页**产生**内部碎片**；**动态分区、分段**产生**外部碎片**",
            "分页的内部碎片只出现在每个进程的最后一页，平均约为**半页**",
            "外部碎片可用紧凑（拼接）技术消除，但要求程序可以动态重定位"
          ],
          cond: "“分页没有外部碎片”是因为任何空闲页框都能分给任何页；段页式只有内部碎片（每段的最后一页）。紧凑需要重定位寄存器等动态重定位支持。",
          proof: [
            "第一步：固定分区的大小事先定好，进程装入后剩下的部分别的进程用不了，是分区内部的浪费。",
            "第二步：分页时进程按页大小切分，只有最后一页可能装不满，浪费 0 ~ 页大小 − 1 字节。",
            "第三步：若进程大小在页内的位置是均匀的，最后一页的浪费平均约为半页。",
            "第四步：动态分区按需切出恰好大小的分区，没有内部浪费；但反复分配、回收后，空闲区被切成许多不相邻的小块。",
            "第五步：这些小块加起来可能足够大，却没有一块放得下新进程，这就是外部碎片。最佳适应算法每次都留下最小的边角，最容易产生碎片（2019 年真题）。"
          ],
          traps: [
            "分页有内部碎片、没有外部碎片；分段正好相反",
            "最佳适应的“最佳”指大小最接近，留下的外部碎片反而最多",
            "页越大，页内碎片越大但页表越小，二者此消彼长"
          ],
          ex: {
            q: "下面几种动态分区分配算法里，最容易留下很多小碎片的是（ ）。",
            opts: ["首次适应算法", "最坏适应算法", "最佳适应算法", "循环首次适应算法"], a: 2,
            why: "最佳适应算法每次选与请求大小最接近的空闲分区，切剩的部分往往很小、难以再利用，所以最容易产生外部碎片。选 C。",
            src: "2019 年真题"
          },
          links: { lab: ["partition"], proc: [] },
          demo: function (box) {
            var K = kit(box), mode = "dyn";
            var r0 = K.row();
            K.seg(r0, [["dyn", "动态分区（外部碎片）"], ["page", "分页（内部碎片）"], ["fixed", "固定分区（内部碎片）"]], mode, function (v) { mode = v; build(); });
            var fr = K.row(), err = K.err(), svg = K.svg(720, 200, "内存示意"), out = K.out(), ins = {};
            function build() {
              clear(fr); ins = {};
              if (mode === "dyn") {
                ins.h = K.field(fr, "空闲分区大小（KB）", "12, 8, 15", draw, { wide: true, mode: "text" });
                ins.r = K.field(fr, "新请求（KB）", 20, draw);
              } else if (mode === "page") {
                ins.s = K.field(fr, "进程大小（B）", 10000, draw);
                ins.p = K.field(fr, "页大小（如 4K）", "4K", draw, { mode: "text" });
              } else {
                ins.parts = K.field(fr, "分区大小（KB）", "8, 8, 16, 32", draw, { mode: "text" });
                ins.jobs = K.field(fr, "进程大小（KB，依次装入）", "5, 12, 20", draw, { mode: "text" });
              }
              draw();
            }
            function draw() {
              var errs = [];
              clear(svg);
              if (mode === "dyn") {
                var H = getv(U.nums(ins.h.value, { name: "空闲分区大小", min: 1, max: 999, maxLen: 8 }), errs);
                var rq = getv(U.num(ins.r.value, { name: "请求大小", min: 1, max: 9999 }), errs);
                if (errs.length) { showErr(err, errs[0]); clear(out); return; }
                showErr(err, "");
                var R = U.externalFrag(H, rq), used = 10, tot = sum(H) + used * (H.length + 1), sc = 680 / tot, x = 20;
                T(svg, 20, 24, "内存：灰色为已分配，白色为空闲分区", { "font-size": 14 });
                for (var k = 0; k <= H.length; k++) {
                  S("rect", { x: x, y: 40, width: used * sc, height: 60, class: "x-po-mem is-used" }, svg); x += used * sc;
                  if (k < H.length) {
                    S("rect", { x: x, y: 40, width: H[k] * sc, height: 60, class: "x-po-mem is-free" + (H[k] >= rq ? " is-fit" : "") }, svg);
                    T(svg, x + H[k] * sc / 2, 76, fmt(H[k]), { "text-anchor": "middle", "font-size": 14 });
                    x += H[k] * sc;
                  }
                }
                T(svg, 20, 140, "空闲总量 " + fmt(R.total) + " KB，最大空闲分区 " + fmt(R.max) + " KB，请求 " + fmt(rq) + " KB", { "font-size": 15 });
                T(svg, 20, 170, R.fits ? "有分区放得下，可以分配" : (R.frag ? "总量够、但没有一块放得下 → 外部碎片" : "空闲总量本身就不够"), { "font-size": 15, class: "x-po-t " + (R.fits ? "is-ok" : "is-bad") });
                readout(out, [
                  ["结论：", R.fits ? "能分配（最大空闲分区 ≥ 请求）" : R.frag ? "外部碎片：空闲总和 " + fmt(R.total) + " ≥ " + fmt(rq) + "，但最大分区只有 " + fmt(R.max) + "；紧凑后才能分配" : "内存不足", R.fits ? "ok" : "bad"]
                ]);
              } else if (mode === "page") {
                var s = getv(U.num(ins.s.value, { name: "进程大小", int: true, min: 1, max: 1e9 }), errs);
                var p = getv(U.size(ins.p.value, "页大小"), errs);
                if (errs.length) { showErr(err, errs[0]); clear(out); return; }
                showErr(err, "");
                var F = U.pagingFrag(s, p), show = Math.min(F.pages, 12), pw = Math.min(54, Math.floor(660 / show));
                T(svg, 20, 24, "进程被切成 " + F.pages + " 页" + (F.pages > show ? "（只画最后 " + show + " 页）" : ""), { "font-size": 14 });
                for (var q = 0; q < show; q++) {
                  var last = q === show - 1, fill = last ? (p - F.waste) / p : 1;
                  S("rect", { x: 20 + q * pw, y: 40, width: pw - 4, height: 80, class: "x-po-mem is-free" }, svg);
                  S("rect", { x: 20 + q * pw, y: 40 + 80 * (1 - fill), width: pw - 4, height: 80 * fill, class: "x-po-mem is-used" }, svg);
                }
                T(svg, 20, 150, "最后一页用了 " + (p - F.waste) + " B，浪费 " + F.waste + " B（内部碎片）", { "font-size": 15, class: "x-po-t " + (F.waste ? "is-bad" : "is-ok") });
                T(svg, 20, 178, "平均每个进程浪费约半页 = " + fmt(p / 2) + " B", { "font-size": 14, class: "x-po-t x-po-t--note" });
                readout(out, [["页数 = ⌈" + s + " / " + p + "⌉ = ", F.pages + " 页"], ["内部碎片 = ", F.pages + "×" + p + " − " + s + " = " + F.waste + " B", F.waste ? "bad" : "ok"]]);
              } else {
                var P = getv(U.nums(ins.parts.value, { name: "分区大小", min: 1, max: 999, maxLen: 8 }), errs);
                var J = getv(U.nums(ins.jobs.value, { name: "进程大小", min: 1, max: 999, maxLen: 8 }), errs);
                if (errs.length) { showErr(err, errs[0]); clear(out); return; }
                showErr(err, "");
                var X = U.fixedFrag(P, J), tt = sum(P), sc2 = 680 / tt, xx = 20;
                T(svg, 20, 24, "固定分区：深色为进程占用，斜线为分区内浪费", { "font-size": 14 });
                P.forEach(function (sz, k2) {
                  var w = sz * sc2, u = X.used[k2];
                  S("rect", { x: xx, y: 40, width: w, height: 70, class: "x-po-mem is-free" }, svg);
                  if (u !== null) {
                    S("rect", { x: xx, y: 40, width: J[u] * sc2, height: 70, class: "x-po-mem is-used" }, svg);
                    S("rect", { x: xx + J[u] * sc2, y: 40, width: (sz - J[u]) * sc2, height: 70, class: "x-po-mem is-waste" }, svg);
                  }
                  if (w >= 30) T(svg, xx + w / 2, 132, fmt(sz) + (u !== null ? "（进程 " + fmt(J[u]) + "）" : ""), { "text-anchor": "middle", "font-size": 13 });
                  xx += w;
                });
                var miss = X.place.map(function (pl, k3) { return pl < 0 ? fmt(J[k3]) : null; }).filter(function (v) { return v; });
                T(svg, 20, 170, "内部碎片合计 " + fmt(X.waste) + " KB" + (miss.length ? "；装不下的进程：" + miss.join("、") + " KB" : ""), { "font-size": 15, class: "x-po-t is-bad" });
                readout(out, [["内部碎片 = Σ(分区大小 − 进程大小) = ", fmt(X.waste) + " KB", "bad"], "按顺序把每个进程放进第一个够大的空闲分区。"]);
              }
            }
            build();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 13 进程状态转换 ---------- */
        PROP.push({
          id: "os-pstate", sub: "os", ch: CH2, name: "进程状态转换", toc: "进程状态转换",
          def: "进程的三种基本状态：就绪（只缺 CPU）、运行（占有 CPU）、阻塞（等待某个事件，即使给它 CPU 也无法运行）；另有创建态和终止态。",
          stmt: [
            "就绪 → 运行（被调度）；运行 → 就绪（时间片用完或被抢占）",
            "运行 → 阻塞（**主动**：请求 I/O、执行 wait 等）；阻塞 → 就绪（**被动**：事件发生、被唤醒）",
            "**不存在** 阻塞 → 运行 和 就绪 → 阻塞 的直接转换"
          ],
          cond: "五状态模型。引入挂起后还有就绪挂起、阻塞挂起等状态，转换关系更多。单 CPU 系统中任一时刻至多一个进程处于运行态。",
          proof: [
            "第一步：进程要运行必须先拿到 CPU，而 CPU 只能由调度程序从就绪队列中分配，所以进入运行态只有“就绪 → 运行”一条路。",
            "第二步：阻塞的进程即使等到了事件，也只是具备了运行条件，要先进入就绪队列排队，所以没有阻塞 → 运行。",
            "第三步：进程只有在运行时才能执行 I/O 请求或 wait 这类主动操作，所以进入阻塞的只有“运行 → 阻塞”。",
            "第四步：就绪进程没有在执行指令，不可能主动请求资源，所以没有就绪 → 阻塞。",
            "第五步：运行 → 就绪 是被剥夺 CPU（时间片用完、被更高优先级抢占），进程本身仍具备运行条件。"
          ],
          traps: [
            "时间片用完是运行 → 就绪，不是运行 → 阻塞（2022 年真题）",
            "阻塞 → 就绪 是被动的，由别的进程或中断处理程序唤醒",
            "读磁盘完成后进程变为就绪，而不是直接运行（2014 年真题）"
          ],
          ex: {
            q: "下列哪些事件或操作可能让进程 P 从执行态进入阻塞态？（ ）Ⅰ. P 读文件　Ⅱ. P 的时间片用完　Ⅲ. P 申请外设　Ⅳ. P 对信号量执行 wait()",
            opts: ["仅Ⅰ、Ⅳ", "仅Ⅱ、Ⅲ", "仅Ⅲ、Ⅳ", "仅Ⅰ、Ⅲ、Ⅳ"], a: 3,
            why: "读文件要等磁盘 I/O，阻塞；申请外设时设备若被占用要等待，阻塞；wait() 时信号量不够，阻塞。时间片用完是运行 → 就绪。选 D。",
            src: "2022 年真题"
          },
          links: { lab: [], proc: ["pstate", "pswitch"] },
          demo: function (box) {
            var K = kit(box), from = null, to = null, btns = {};
            var POS = { "new": [80, 120], ready: [250, 50], run: [470, 50], block: [360, 190], exit: [640, 120] };
            var r0 = K.row(); r0.appendChild(E("span", "x-po-fl", "先点起点，再点终点："));
            U.STATES.forEach(function (s) { btns[s[0]] = K.btn(r0, s[1], function () { pick(s[0]); }, false); });
            var svg = K.svg(720, 250, "五状态转换图"), out = K.out();
            function pick(s) {
              if (!from || to) { from = s; to = null; } else to = s;
              U.STATES.forEach(function (x) { btns[x[0]].setAttribute("aria-pressed", x[0] === from || x[0] === to ? "true" : "false"); });
              draw();
            }
            function name(s) { for (var i = 0; i < U.STATES.length; i++) if (U.STATES[i][0] === s) return U.STATES[i][1]; return s; }
            function draw() {
              clear(svg);
              var res = from && to ? U.transition(from, to) : null;
              ["new>ready", "ready>run", "run>ready", "run>block", "block>ready", "run>exit"].forEach(function (k) {
                var p = k.split(">"), a = POS[p[0]], b = POS[p[1]], off = (k === "ready>run" ? -8 : (k === "run>ready" ? 8 : 0));
                var hl = from === p[0] && to === p[1];
                var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
                S("line", { x1: a[0] + ux * 52, y1: a[1] + uy * 26 + off, x2: b[0] - ux * 56, y2: b[1] - uy * 28 + off, class: "x-po-edge" + (hl ? " is-ok" : ""), "marker-end": null }, svg);
                S("circle", { cx: b[0] - ux * 56, cy: b[1] - uy * 28 + off, r: 4, class: "x-po-head" + (hl ? " is-ok" : "") }, svg);
              });
              if (res && !res.ok && from !== to) {
                var a2 = POS[from], b2 = POS[to];
                S("line", { x1: a2[0], y1: a2[1], x2: b2[0], y2: b2[1], class: "x-po-edge is-bad" }, svg);
                T(svg, (a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2 - 6, "×", { "text-anchor": "middle", "font-size": 22, class: "x-po-t is-bad" });
              }
              U.STATES.forEach(function (s) {
                var p = POS[s[0]];
                S("rect", { x: p[0] - 50, y: p[1] - 24, width: 100, height: 48, rx: 24, class: "x-po-node" + (s[0] === from ? " is-from" : "") + (s[0] === to ? " is-to" : "") }, svg);
                T(svg, p[0], p[1] + 6, s[1], { "text-anchor": "middle", "font-size": 16 });
              });
              if (!from) readout(out, ["点两个状态，判断能否直接转换。"]);
              else if (!to) readout(out, ["起点：" + name(from) + "，再点一个终点。"]);
              else readout(out, [[name(from) + " → " + name(to) + "：", res.ok ? "可以直接转换" : "不能直接转换", res.ok ? "ok" : "bad"], res.why]);
            }
            draw();
            return { destroy: K.destroy };
          }
        });

        /* ---------- 14 Bernstein 条件 ---------- */
        PROP.push({
          id: "os-bernstein", sub: "os", ch: CH2, name: "程序并发执行的条件（Bernstein 条件）", toc: "Bernstein 条件",
          def: "R(Pᵢ)：程序段 Pᵢ 执行时要读的变量集合（读集）；W(Pᵢ)：要写的变量集合（写集）。赋值语句右边出现的变量进读集，左边的变量进写集。",
          stmt: [
            "**R(P1) ∩ W(P2) = ∅**、**W(P1) ∩ R(P2) = ∅**、**W(P1) ∩ W(P2) = ∅** 同时成立时，P1 与 P2 可以并发执行且结果确定（可再现）",
            "读集与读集相交（R(P1) ∩ R(P2) ≠ ∅）不影响并发",
            "任一条件不满足，结果可能与执行次序有关，需要同步"
          ],
          cond: "Bernstein 条件只看变量的读写关系，用来判断两段程序能否不加同步地并发；它不考虑 I/O 设备等其他共享资源。不满足条件并不是不能并发，而是需要同步互斥。",
          proof: [
            "第一步：若 P2 写了 P1 要读的变量（R(P1) ∩ W(P2) ≠ ∅），P1 读到旧值还是新值取决于谁先执行。",
            "第二步：同理，W(P1) ∩ R(P2) ≠ ∅ 时，P2 读到的值依赖执行次序。",
            "第三步：两者写同一个变量（W(P1) ∩ W(P2) ≠ ∅）时，最终留下的是后写者的值，同样依赖次序。",
            "第四步：三个交集都为空时，一方读的变量对方都不写，一方写的变量对方既不读也不写，任何交错次序结果都相同。",
            "第五步：两段都只读同一个变量不会改变它，所以读集之间的交集不在条件之中。"
          ],
          traps: [
            "条件里没有 R(P1) ∩ R(P2)，选项出现“读集互不相交”要排除（2026 年真题）",
            "x = x + 1 中 x 同时属于读集和写集",
            "满足条件才能“不加同步”并发；不满足时加上同步互斥照样可以并发"
          ],
          ex: {
            q: "进程 P 的读集、写集为 R(P)、W(P)，进程 Q 的为 R(Q)、W(Q)。P 与 Q 并发执行不出错的充要条件由下面哪几条组成？（ ）Ⅰ. R(Q) ∩ W(P) = ∅　Ⅱ. R(P) ∩ R(Q) = ∅　Ⅲ. W(P) ∩ W(Q) = ∅　Ⅳ. R(P) ∩ W(Q) = ∅",
            opts: ["Ⅰ、Ⅱ", "Ⅰ、Ⅱ、Ⅲ", "Ⅰ、Ⅲ、Ⅳ", "Ⅱ、Ⅲ"], a: 2,
            why: "按 Bernstein 条件，要求 W(P) ∩ R(Q)、R(P) ∩ W(Q)、W(P) ∩ W(Q) 都为空，对应Ⅰ、Ⅳ、Ⅲ。两个读集相交（Ⅱ）不会造成结果不确定，不是必要条件。选 C。",
            src: "2026 年真题"
          },
          links: { lab: [], proc: [] },
          demo: function (box) {
            var K = kit(box);
            var r0 = K.row();
            K.btn(r0, "a = x + y ∥ b = z + 1", function () { preset("a = x + y", "b = z + 1"); });
            K.btn(r0, "a = x + y ∥ c = a − b", function () { preset("a = x + y", "c = a - b"); });
            K.btn(r0, "x = x + 1 ∥ x = 2 * y", function () { preset("x = x + 1", "x = 2 * y"); });
            K.btn(r0, "c = x + y ∥ d = x * y", function () { preset("c = x + y", "d = x * y"); });
            var r1 = K.row();
            var R1 = K.field(r1, "R(P1)", "x, y", draw, { mode: "text" });
            var W1 = K.field(r1, "W(P1)", "a", draw, { mode: "text" });
            var r2 = K.row();
            var R2 = K.field(r2, "R(P2)", "z", draw, { mode: "text" });
            var W2 = K.field(r2, "W(P2)", "b", draw, { mode: "text" });
            var err = K.err(), svg = K.svg(720, 190, "三个交集"), out = K.out();
            function setStr(a) { return a.length ? a.join(", ") : "∅"; }
            function preset(s1, s2) {
              var a = U.rwOf(s1), b = U.rwOf(s2);
              R1.value = setStr(a.R); W1.value = setStr(a.W); R2.value = setStr(b.R); W2.value = setStr(b.W);
              draw();
            }
            function draw() {
              var errs = [];
              var r1v = getv(U.vars(R1.value, "R(P1)"), errs), w1v = getv(U.vars(W1.value, "W(P1)"), errs), r2v = getv(U.vars(R2.value, "R(P2)"), errs), w2v = getv(U.vars(W2.value, "W(P2)"), errs);
              if (errs.length) { showErr(err, errs[0]); clear(svg); clear(out); return; }
              showErr(err, "");
              var B = U.bernstein(r1v, w1v, r2v, w2v);
              clear(svg);
              [["R(P1) ∩ W(P2)", B.rw, "P2 改了 P1 要读的变量"], ["W(P1) ∩ R(P2)", B.wr, "P1 改了 P2 要读的变量"], ["W(P1) ∩ W(P2)", B.ww, "两者写同一变量"]].forEach(function (c, k) {
                var y = 14 + k * 50, ok = !c[1].length;
                S("rect", { x: 20, y: y, width: 680, height: 40, rx: 6, class: "x-po-box " + (ok ? "is-ok" : "is-bad") }, svg);
                T(svg, 36, y + 26, c[0] + " = " + (ok ? "∅" : "{ " + c[1].join(", ") + " }"), { "font-size": 15 });
                T(svg, 690, y + 26, ok ? "✓" : "✗ " + c[2], { "text-anchor": "end", "font-size": 14, class: "x-po-t " + (ok ? "is-ok" : "is-bad") });
              });
              T(svg, 20, 180, "R(P1) ∩ R(P2) = " + (B.rr.length ? "{ " + B.rr.join(", ") + " }" : "∅") + "（只读共享，不影响结论）", { "font-size": 14, class: "x-po-t x-po-t--note" });
              readout(out, [["结论：", B.ok ? "三个交集都为空，P1、P2 可以并发执行且结果确定" : "不满足 Bernstein 条件，并发结果可能与执行次序有关，需要同步", B.ok ? "ok" : "bad"]]);
            }
            draw();
            return { destroy: K.destroy };
          }
        });
      })();
