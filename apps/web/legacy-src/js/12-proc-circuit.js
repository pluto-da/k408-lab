      /* 过程图解 · 电路：基本逻辑门、加法器、3-8 译码器（拨开关交互） */
      (function () {
        var PROC = window.PROC = window.PROC || [], U = window.PROCU;
        function sv(tag, a, p) { return X.svg(tag, a, p); }
        function tx(p, x, y, s, cls, anc) { var t = sv("text", { x: x, y: y, class: cls || "x-c__t" }, p); if (anc) t.setAttribute("text-anchor", anc); t.textContent = s; return t; }
        function wire(p, pts, v) { return sv("polyline", { points: pts.map(function (q) { return q.join(","); }).join(" "), class: "x-c__w " + (v ? "is-1" : "is-0") }, p); }
        function dot(p, x, y, v) { return sv("circle", { cx: x, cy: y, r: 3.2, class: "x-c__dot " + (v ? "is-1" : "is-0") }, p); }
        function lamp(p, x, y, v, label) {
          sv("circle", { cx: x, cy: y, r: 11, class: "x-c__lamp " + (v ? "is-1" : "is-0") }, p);
          tx(p, x, y + 1, v ? "1" : "0", "x-c__lv", "middle");
          if (label) tx(p, x + 18, y + 1, label, "x-c__t", "start");
        }
        var OUTX = { and: 50, nand: 58, or: 56, nor: 64, xor: 62, xnor: 70, not: 52 };
        var INX = { and: 0, nand: 0, or: 5, nor: 5, xor: 2, xnor: 2, not: 0 };
        /* 门电路符号：左上角 (x,y)，主体 60×40；返回输出端坐标 */
        function gate(p, type, x, y, v, label) {
          var g = sv("g", { transform: "translate(" + x + "," + y + ")", class: "x-c__g " + (v ? "is-1" : "is-0") }, p);
          var base = type.replace(/^n(and|or)$/, "$1").replace("xnor", "xor");
          if (base === "and") sv("path", { d: "M0,0 H30 A20,20 0 0 1 30,40 H0 Z", class: "x-c__body" }, g);
          if (base === "or") sv("path", { d: "M0,0 Q16,20 0,40 Q38,40 56,20 Q38,0 0,0 Z", class: "x-c__body" }, g);
          if (base === "xor") { sv("path", { d: "M6,0 Q22,20 6,40 Q44,40 62,20 Q44,0 6,0 Z", class: "x-c__body" }, g); sv("path", { d: "M0,0 Q16,20 0,40", class: "x-c__body x-c__body--line" }, g); }
          if (type === "not") { sv("path", { d: "M0,2 L44,20 L0,38 Z", class: "x-c__body" }, g); sv("circle", { cx: 48, cy: 20, r: 4, class: "x-c__body" }, g); }
          if (type === "nand") sv("circle", { cx: 54, cy: 20, r: 4, class: "x-c__body" }, g);
          if (type === "nor") sv("circle", { cx: 60, cy: 20, r: 4, class: "x-c__body" }, g);
          if (type === "xnor") sv("circle", { cx: 66, cy: 20, r: 4, class: "x-c__body" }, g);
          if (label) tx(g, 22, 25, label, "x-c__gl", "middle");
          return [x + OUTX[type], y + 20];
        }
        function inPin(type, x, y, k, n) { return [x + INX[type], y + (n === 1 ? 20 : k ? 28 : 12)]; }
        var F = {
          and: function (a, b) { return a & b; }, or: function (a, b) { return a | b; }, not: function (a) { return a ? 0 : 1; },
          nand: function (a, b) { return (a & b) ? 0 : 1; }, nor: function (a, b) { return (a | b) ? 0 : 1; },
          xor: function (a, b) { return a ^ b; }, xnor: function (a, b) { return (a ^ b) ? 0 : 1; }
        };
        /* 一排开关按钮 */
        function switches(host, names, vals, onFlip, cls) {
          var box = X.el("div", { class: "x-c__sw" + (cls ? " " + cls : ""), role: "group", "aria-label": "输入开关" });
          names.forEach(function (n, i) {
            var b = X.el("button", { type: "button", role: "switch", class: "x-c__swb", "aria-checked": vals[i] ? "true" : "false" });
            b.innerHTML = "<span></span><b></b>";
            b.querySelector("span").textContent = n;
            b.querySelector("b").textContent = vals[i] ? "1" : "0";
            b.addEventListener("click", function () { onFlip(i); });
            box.appendChild(b);
          });
          host.appendChild(box);
          return box;
        }
        function table(host, head, rows, hi, caption) {
          var t = X.el("table", { class: "x-c__tt" });
          if (caption) t.appendChild(X.el("caption", {}, "")).textContent = caption;
          var tr = X.el("tr", {});
          head.forEach(function (h) { tr.appendChild(X.el("th", { scope: "col" }, "")).textContent = h; });
          t.appendChild(X.el("thead", {})).appendChild(tr);
          var tb = X.el("tbody", {});
          rows.forEach(function (r, i) {
            var row = X.el("tr", { class: i === hi ? "is-hi" : "" });
            r.forEach(function (c) { row.appendChild(X.el("td", {}, "")).textContent = c; });
            tb.appendChild(row);
          });
          t.appendChild(tb);
          var w = X.el("div", { class: "x-c__ttw" });
          w.appendChild(t);
          host.appendChild(w);
          return t;
        }

        /* ===================== 1. 基本逻辑门 ===================== */
        PROC.push({
          id: "gates", name: "基本逻辑门", sub: "co",
          lead: "七种门共用输入 A、B。拨开关看每个门的输出，真值表里当前这一行会高亮。",
          note: ["与非门、或非门各自都是“功能完备”的：只用一种就能搭出任何逻辑电路。", "异或：相同为 0、不同为 1；是半加器的“和”，也用于奇偶校验与 CRC。", "同或 = 异或取反；A⊙B = 1 表示两位相等，可用作比较器。", "德·摩根律：¬(A·B) = ¬A + ¬B，¬(A+B) = ¬A · ¬B。"],
          modes: [{
            name: "七种门",
            circuit: function (stage, inp) {
              var v = [0, 1];
              var G = [["and", "与 AND", "Y = A·B"], ["or", "或 OR", "Y = A + B"], ["not", "非 NOT", "Y = ¬A"], ["nand", "与非 NAND", "Y = ¬(A·B)"], ["nor", "或非 NOR", "Y = ¬(A + B)"], ["xor", "异或 XOR", "Y = A ⊕ B"], ["xnor", "同或 XNOR", "Y = A ⊙ B"]];
              var api = {};
              function draw() {
                stage.innerHTML = "";
                switches(stage, ["A", "B"], v, function (i) { v[i] ^= 1; draw(); if (api._r) api._r(); });
                var wrap = X.el("div", { class: "x-proc__canvas" }); stage.appendChild(wrap);
                var svg = sv("svg", { viewBox: "0 0 640 470", class: "x-proc__svg x-c", role: "img", "aria-label": "七种逻辑门，A=" + v[0] + "，B=" + v[1] }, wrap);
                svg.style.minWidth = "520px";
                tx(svg, 90, 18, "A", "x-c__in", "middle"); tx(svg, 130, 18, "B", "x-c__in", "middle");
                wire(svg, [[90, 26], [90, 450]], v[0]); wire(svg, [[130, 26], [130, 430]], v[1]);
                G.forEach(function (g, i) {
                  var y = 32 + i * 62, x = 230, out = g[0] === "not" ? F.not(v[0]) : F[g[0]](v[0], v[1]);
                  var pa = inPin(g[0], x, y, 0, g[0] === "not" ? 1 : 2);
                  wire(svg, [[90, pa[1]], pa], v[0]); dot(svg, 90, pa[1], v[0]);
                  if (g[0] !== "not") { var pb = inPin(g[0], x, y, 1, 2); wire(svg, [[130, pb[1]], pb], v[1]); dot(svg, 130, pb[1], v[1]); }
                  var o = gate(svg, g[0], x, y, out);
                  wire(svg, [o, [390, o[1]]], out);
                  lamp(svg, 402, o[1], out);
                  tx(svg, 424, o[1] - 6, g[1], "x-c__t x-c__t--b", "start");
                  tx(svg, 424, o[1] + 12, g[2], "x-c__t x-c__t--m", "start");
                });
                var rows = [], hi = v[0] * 2 + v[1];
                for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) rows.push([a, b, a & b, a | b, a ? 0 : 1, (a & b) ? 0 : 1, (a | b) ? 0 : 1, a ^ b, (a ^ b) ? 0 : 1].map(String));
                table(stage, ["A", "B", "与", "或", "非A", "与非", "或非", "异或", "同或"], rows, hi, "真值表（高亮 = 当前输入）");
              }
              api.info = function () {
                return { meta: "A = " + v[0] + "，B = " + v[1], t: "拨动 A、B，看七个门同时变化",
                  d: "亮色导线表示 1，灰色表示 0。与门“全 1 才 1”，或门“有 1 就 1”，异或“不同才 1”；带小圆圈的是在输出端再取反。",
                  tip: "选择题常让你用与非门或或非门实现其他门：非 = 与非(A,A)，与 = 非(与非)，或 = 与非(非A, 非B)。" };
              };
              draw();
              return api;
            }
          }]
        });

        /* ===================== 2. 加法器 ===================== */
        function halfAdder(stage) {
          var v = [1, 1], api = {};
          function draw() {
            stage.innerHTML = "";
            switches(stage, ["A", "B"], v, function (i) { v[i] ^= 1; draw(); api._r && api._r(); });
            var wrap = X.el("div", { class: "x-proc__canvas" }); stage.appendChild(wrap);
            var s = v[0] ^ v[1], c = v[0] & v[1];
            var svg = sv("svg", { viewBox: "0 0 600 250", class: "x-proc__svg x-c", role: "img", "aria-label": "半加器 A=" + v[0] + " B=" + v[1] + " 和=" + s + " 进位=" + c }, wrap);
            svg.style.minWidth = "480px";
            tx(svg, 70, 22, "A", "x-c__in", "middle"); tx(svg, 120, 22, "B", "x-c__in", "middle");
            wire(svg, [[70, 30], [70, 172]], v[0]); wire(svg, [[120, 30], [120, 188]], v[1]);
            var x1 = 260, y1 = 50, x2 = 260, y2 = 150;
            wire(svg, [[70, 62], [x1 + 2, 62]], v[0]); dot(svg, 70, 62, v[0]);
            wire(svg, [[120, 78], [x1 + 2, 78]], v[1]); dot(svg, 120, 78, v[1]);
            wire(svg, [[70, 162], [x2, 162]], v[0]); dot(svg, 70, 162, v[0]);
            wire(svg, [[120, 178], [x2, 178]], v[1]); dot(svg, 120, 178, v[1]);
            var o1 = gate(svg, "xor", x1, y1, s), o2 = gate(svg, "and", x2, y2, c);
            wire(svg, [o1, [430, o1[1]]], s); lamp(svg, 442, o1[1], s, "S = A ⊕ B（本位和）");
            wire(svg, [o2, [430, o2[1]]], c); lamp(svg, 442, o2[1], c, "C = A · B（进位）");
            table(stage, ["A", "B", "S", "C"], [["0", "0", "0", "0"], ["0", "1", "1", "0"], ["1", "0", "1", "0"], ["1", "1", "0", "1"]], v[0] * 2 + v[1], "半加器真值表");
          }
          api.info = function () {
            return { meta: "A = " + v[0] + "，B = " + v[1], t: "半加器：两个一位数相加", d: "和 S 用一个异或门，进位 C 用一个与门。半加器没有“低位来的进位”输入，所以只能用在最低位。", tip: "全加器 = 两个半加器 + 一个或门。", kv: { "本位和 S": String(v[0] ^ v[1]), "进位 C": String(v[0] & v[1]) } };
          };
          draw();
          return api;
        }
        function fullAdder(stage) {
          var v = [1, 0, 1], api = {};
          function draw() {
            stage.innerHTML = "";
            switches(stage, ["A", "B", "Cin"], v, function (i) { v[i] ^= 1; draw(); api._r && api._r(); });
            var wrap = X.el("div", { class: "x-proc__canvas" }); stage.appendChild(wrap);
            var A = v[0], B = v[1], C = v[2], Pq = A ^ B, S = Pq ^ C, G = A & B, T = Pq & C, Co = G | T;
            var svg = sv("svg", { viewBox: "0 0 720 300", class: "x-proc__svg x-c", role: "img", "aria-label": "一位全加器 S=" + S + " Cout=" + Co }, wrap);
            svg.style.minWidth = "560px";
            [["A", 50, A, 220], ["B", 90, B, 236], ["Cin", 130, C, 250]].forEach(function (q) { tx(svg, q[1], 20, q[0], "x-c__in", "middle"); wire(svg, [[q[1], 28], [q[1], q[3]]], q[2]); });
            // XOR1 (A,B) -> P
            wire(svg, [[50, 52], [202, 52]], A); dot(svg, 50, 52, A);
            wire(svg, [[90, 68], [202, 68]], B); dot(svg, 90, 68, B);
            var p1 = gate(svg, "xor", 200, 40, Pq);
            // AND1 (A,B) -> G
            wire(svg, [[50, 202], [240, 202]], A); dot(svg, 50, 202, A);
            wire(svg, [[90, 218], [240, 218]], B); dot(svg, 90, 218, B);
            var g1 = gate(svg, "and", 240, 190, G);
            // XOR2 (P, Cin) -> S
            wire(svg, [p1, [320, 60], [320, 72], [372, 72]], Pq); dot(svg, 320, 72, Pq);
            wire(svg, [[130, 88], [372, 88]], C); dot(svg, 130, 88, C);
            var s1 = gate(svg, "xor", 370, 60, S);
            // AND2 (P, Cin)
            wire(svg, [[320, 72], [320, 132], [370, 132]], Pq);
            wire(svg, [[130, 148], [370, 148]], C); dot(svg, 130, 148, C);
            var t1 = gate(svg, "and", 370, 120, T);
            // OR (G, T) -> Cout
            wire(svg, [t1, [470, 140], [470, 172], [505, 172]], T);
            wire(svg, [g1, [480, 210], [480, 188], [505, 188]], G);
            var co = gate(svg, "or", 500, 160, Co);
            wire(svg, [s1, [600, 80]], S); lamp(svg, 612, 80, S, "S");
            wire(svg, [co, [600, 180]], Co); lamp(svg, 612, 180, Co, "Cout");
            tx(svg, 330, 40, "P = A⊕B", "x-c__t x-c__t--m", "middle");
            tx(svg, 300, 252, "G = A·B（生成）", "x-c__t x-c__t--m", "middle");
            tx(svg, 420, 112, "P·Cin（传递）", "x-c__t x-c__t--m", "middle");
            var rows = [];
            for (var i = 0; i < 8; i++) { var a = i >> 2 & 1, b = i >> 1 & 1, c = i & 1; rows.push([a, b, c, a ^ b ^ c, (a & b) | ((a ^ b) & c)].map(String)); }
            table(stage, ["A", "B", "Cin", "S", "Cout"], rows, A * 4 + B * 2 + C, "全加器真值表");
          }
          api.info = function () {
            var A = v[0], B = v[1], C = v[2];
            return { meta: "A = " + A + "，B = " + B + "，Cin = " + C, t: "一位全加器", d: "S = A⊕B⊕Cin；Cout = A·B + (A⊕B)·Cin。G = A·B 叫进位生成，P = A⊕B 叫进位传递：本位两个 1 必然产生进位，只有一个 1 时则把低位进位传上去。", tip: "先行进位加法器把 C1、C2、C3、C4 都展开成只含 G、P 和 C0 的表达式，同时算出，所以不再一级一级等。", kv: { "S": String(A ^ B ^ C), "Cout": String((A & B) | ((A ^ B) & C)), "G": String(A & B), "P": String(A ^ B) } };
          };
          draw();
          return api;
        }
        function addSub(stage) {
          var a = [1, 1, 1, 0], b = [1, 0, 0, 0], sub = 0, pos = 5, api = { n: 6, start: 5 }; // a[0] 为最低位
          function num(x) { return x[0] + x[1] * 2 + x[2] * 4 + x[3] * 8; }
          function signed(n) { return n >= 8 ? n - 16 : n; }
          function calc() {
            var bb = b.map(function (x) { return x ^ sub; }), c = [sub], s = [];
            for (var i = 0; i < 4; i++) { s[i] = a[i] ^ bb[i] ^ c[i]; c[i + 1] = (a[i] & bb[i]) | ((a[i] ^ bb[i]) & c[i]); }
            var S = num(s);
            return { bb: bb, c: c, s: s, S: S, OF: c[4] ^ c[3], SF: s[3], ZF: S === 0 ? 1 : 0, CF: c[4] ^ sub };
          }
          var TITLES = ["准备：B 先与 Sub 异或，Sub 同时作为最低位进位 C0", "第 0 位全加器", "第 1 位全加器（等 C1）", "第 2 位全加器（等 C2）", "第 3 位全加器（等 C3）", "得到结果与标志位"];
          function draw() {
            stage.innerHTML = "";
            var r = calc(), bits = X.el("div", { class: "x-c__bits" });
            [["A", a], ["B", b]].forEach(function (q) {
              var row = X.el("div", { class: "x-c__brow", role: "group", "aria-label": q[0] + " 的四位" });
              row.appendChild(X.el("span", { class: "x-c__bl" }, q[0]));
              for (var i = 3; i >= 0; i--) (function (i) {
                var bt = X.el("button", { type: "button", class: "x-c__bit" + (q[1][i] ? " is-1" : ""), "aria-label": q[0] + i + " = " + q[1][i] + "，点击翻转" }, String(q[1][i]));
                bt.addEventListener("click", function () { q[1][i] ^= 1; pos = 5; draw(); api._r && api._r(5); });
                row.appendChild(bt);
              })(i);
              row.appendChild(X.el("span", { class: "x-c__bn" }, "= " + num(q[1]) + "（有符号 " + signed(num(q[1])) + "）"));
              bits.appendChild(row);
            });
            var sb = X.el("button", { type: "button", role: "switch", class: "x-c__swb", "aria-checked": sub ? "true" : "false" }, "<span>Sub</span><b>" + sub + "</b>");
            sb.addEventListener("click", function () { sub ^= 1; pos = 5; draw(); api._r && api._r(5); });
            var sr = X.el("div", { class: "x-c__brow" }); sr.appendChild(X.el("span", { class: "x-c__bl" }, "运算")); sr.appendChild(sb); sr.appendChild(X.el("span", { class: "x-c__bn" }, sub ? "减法 A − B = A + ¬B + 1" : "加法 A + B"));
            bits.appendChild(sr);
            stage.appendChild(bits);
            var wrap = X.el("div", { class: "x-proc__canvas" }); stage.appendChild(wrap);
            var svg = sv("svg", { viewBox: "0 0 780 340", class: "x-proc__svg x-c", role: "img", "aria-label": "4 位补码加减运算器" }, wrap);
            svg.style.minWidth = "620px";
            var known = function (i) { return pos >= 5 || i < pos; };
            wire(svg, [[748, 118], [80, 118]], sub);
            tx(svg, 754, 112, "Sub", "x-c__in", "start");
            wire(svg, [[748, 118], [748, 210], [700, 210]], sub); dot(svg, 748, 118, sub);
            tx(svg, 720, 228, "C0", "x-c__t x-c__t--m", "middle");
            for (var i = 0; i < 4; i++) {
              var x = 600 - i * 160, kn = known(i), cin = pos === 0 && i === 0 ? sub : r.c[i];
              tx(svg, x + 25, 22, "A" + i, "x-c__t x-c__t--m", "middle"); tx(svg, x + 75, 22, "B" + i, "x-c__t x-c__t--m", "middle");
              tx(svg, x + 25, 46, String(a[i]), "x-c__big", "middle"); tx(svg, x + 75, 46, String(b[i]), "x-c__big", "middle");
              wire(svg, [[x + 25, 56], [x + 25, 180]], a[i]);
              wire(svg, [[x + 75, 56], [x + 75, 106]], b[i]);
              dot(svg, x + 75, 118, sub);
              sv("circle", { cx: x + 75, cy: 118, r: 11, class: "x-c__xor " + (r.bb[i] ? "is-1" : "is-0") }, svg);
              tx(svg, x + 75, 119, "⊕", "x-c__lv", "middle");
              wire(svg, [[x + 75, 130], [x + 75, 180]], r.bb[i]);
              sv("rect", { x: x, y: 180, width: 100, height: 64, rx: 8, class: "x-c__fa" + (pos === i + 1 ? " is-cur" : kn ? " is-done" : "") }, svg);
              tx(svg, x + 50, 207, "FA" + i, "x-c__t x-c__t--b", "middle");
              tx(svg, x + 50, 226, "全加器", "x-c__t x-c__t--m", "middle");
              wire(svg, [[x + 50, 244], [x + 50, 290]], kn ? r.s[i] : 0);
              tx(svg, x + 50, 312, kn ? String(r.s[i]) : "?", "x-c__big", "middle");
              tx(svg, x + 50, 332, "S" + i, "x-c__t x-c__t--m", "middle");
              var co = kn ? r.c[i + 1] : 0;
              wire(svg, [[x, 212], [x - 60, 212]], co);
              tx(svg, x - 30, 202, "C" + (i + 1) + (kn ? "=" + r.c[i + 1] : ""), "x-c__t x-c__t--m", "middle");
              void cin;
            }
            tx(svg, 30, 216, "C4", "x-c__t x-c__t--m", "middle");
          }
          api.go = function (i, peek) {
            if (peek) return { t: TITLES[i] };
            pos = i; draw();
            var r = calc(), A = num(a), B = num(b);
            var kv = { "A": U.bin(A, 4) + "（" + signed(A) + "）", "B": U.bin(B, 4) + "（" + signed(B) + "）", "送入加法器的 B'": U.bin(num(r.bb), 4), "C0": String(sub) };
            var d, tip, t = TITLES[i];
            if (i === 0) { d = "减法不需要单独的减法器：A − B = A + (−B)补 = A + ¬B + 1。每一位 Bi 与 Sub 异或，Sub=1 时就得到 ¬B；再让 Sub 作为最低位进位 C0，正好补上那个“+1”。"; tip = "补码加减运算器只用加法器 + 异或门实现，是选择题常客。"; }
            else if (i <= 4) {
              var k = i - 1;
              d = "FA" + k + "：A" + k + "=" + a[k] + "，B'" + k + "=" + r.bb[k] + "，C" + k + "=" + r.c[k] + " → S" + k + "=" + r.s[k] + "，C" + (k + 1) + "=" + r.c[k + 1] + "。" + (k ? "它必须等 FA" + (k - 1) + " 送来 C" + k + " 才能算出正确结果。" : "最低位的进位来自 Sub。");
              tip = k === 3 ? "串行进位：n 位加法的进位要穿过 n 个全加器，每个约 2 级门延迟，总延迟 ≈ 2n 级门，位数越多越慢。" : null;
              for (var j = 0; j < i; j++) kv["S" + j] = String(r.s[j]);
            } else {
              d = "结果 S = " + U.bin(r.S, 4) + "，有符号 " + signed(r.S) + "，无符号 " + r.S + "。" + (r.OF ? "两数符号相同而结果符号不同，发生溢出，有符号结果不可信。" : "没有溢出，有符号结果正确。");
              tip = "OF = C4 ⊕ C3（最高位进位与次高位进位不同即溢出）；SF = 结果最高位；ZF = 结果全 0；CF = C4 ⊕ Sub，表示无符号数加法有进位或减法有借位。";
              kv["结果 S"] = U.bin(r.S, 4) + "（" + signed(r.S) + "）";
              kv["OF"] = String(r.OF); kv["SF"] = String(r.SF); kv["ZF"] = String(r.ZF); kv["CF"] = String(r.CF);
            }
            return { t: t, d: d, tip: tip, kv: kv, kvNew: i === 5 ? { OF: 1, SF: 1, ZF: 1, CF: 1 } : {} };
          };
          return api;
        }
        PROC.push({
          id: "adder", name: "加法器", sub: "co",
          lead: "从半加器、全加器到 4 位补码加减运算器：拨开关、点数位，逐位看进位怎么传上去。",
          note: ["半加器：S = A⊕B，C = AB。", "全加器：S = A⊕B⊕Cin，Cout = AB + (A⊕B)Cin。", "加减运算器：Bi ⊕ Sub 送加法器，Sub 同时作为 C0。", "溢出判断：双符号位、最高位与次高位进位异或、操作数与结果符号比较三种方法。", "标志位：OF 看有符号，CF 看无符号；减法时 CF = C4 ⊕ 1 表示借位。"],
          modes: [
            { name: "半加器", circuit: function (stage) { return halfAdder(stage); } },
            { name: "一位全加器", circuit: function (stage) { return fullAdder(stage); } },
            { name: "4 位加减运算器", circuit: function (stage) { return addSub(stage); }, presets: null }
          ]
        });

        /* ===================== 3. 3-8 译码器 ===================== */
        function chip138(stage) {
          var v = { A: 1, B: 1, C: 0, G1: 1, G2A: 0, G2B: 0 }, api = {};
          function draw() {
            stage.innerHTML = "";
            var names = ["C", "B", "A", "G1", "/G2A", "/G2B"], keys = ["C", "B", "A", "G1", "G2A", "G2B"];
            switches(stage, names, keys.map(function (k) { return v[k]; }), function (i) { v[keys[i]] ^= 1; draw(); api._r && api._r(); });
            var en = v.G1 === 1 && v.G2A === 0 && v.G2B === 0, sel = v.C * 4 + v.B * 2 + v.A;
            var wrap = X.el("div", { class: "x-proc__canvas" }); stage.appendChild(wrap);
            var svg = sv("svg", { viewBox: "0 0 640 400", class: "x-proc__svg x-c", role: "img", "aria-label": "74LS138 译码器，" + (en ? "选中 Y" + sel : "未使能") }, wrap);
            svg.style.minWidth = "500px";
            sv("rect", { x: 230, y: 30, width: 170, height: 340, rx: 10, class: "x-c__chip" + (en ? " is-on" : "") }, svg);
            tx(svg, 315, 200, "74LS138", "x-c__t x-c__t--b", "middle");
            tx(svg, 315, 220, en ? "使能" : "未使能", "x-c__t x-c__t--m", "middle");
            var L = [["A", 70, v.A], ["B", 110, v.B], ["C", 150, v.C], ["G1", 240, v.G1], ["/G2A", 280, v.G2A], ["/G2B", 320, v.G2B]];
            L.forEach(function (q) { tx(svg, 40, q[1] + 1, q[0], "x-c__in", "start"); wire(svg, [[100, q[1]], [230, q[1]]], q[2]); lamp(svg, 110, q[1], q[2]); tx(svg, 240, q[1] + 1, q[0], "x-c__t x-c__t--m", "start"); });
            tx(svg, 160, 196, "地址输入", "x-c__t x-c__t--m", "middle");
            tx(svg, 160, 360, "使能端", "x-c__t x-c__t--m", "middle");
            for (var i = 0; i < 8; i++) {
              var y = 50 + i * 40, out = en && i === sel ? 0 : 1;
              tx(svg, 392, y + 1, "/Y" + i, "x-c__t x-c__t--m", "end");
              sv("circle", { cx: 404, cy: y, r: 4, class: "x-c__body" }, svg);
              wire(svg, [[408, y], [520, y]], out);
              lamp(svg, 532, y, out, out ? "" : "← 选中（低电平有效）");
            }
            var rows = [["0", "×", "×", "×", "×", "×", "全部 1"], ["×", "1", "×", "×", "×", "×", "全部 1"], ["×", "×", "1", "×", "×", "×", "全部 1"]];
            for (var k = 0; k < 8; k++) rows.push(["1", "0", "0", String(k >> 2 & 1), String(k >> 1 & 1), String(k & 1), "/Y" + k + " = 0"]);
            var hi = !v.G1 ? 0 : v.G2A ? 1 : v.G2B ? 2 : 3 + sel;
            table(stage, ["G1", "/G2A", "/G2B", "C", "B", "A", "输出"], rows, hi, "74LS138 功能表");
          }
          api.info = function () {
            var en = v.G1 === 1 && v.G2A === 0 && v.G2B === 0, sel = v.C * 4 + v.B * 2 + v.A;
            return { meta: "CBA = " + v.C + v.B + v.A + "，G1=" + v.G1 + "，/G2A=" + v.G2A + "，/G2B=" + v.G2B,
              t: en ? "选中第 " + sel + " 路：/Y" + sel + " 输出 0" : "使能条件不满足：8 个输出全部为 1",
              d: "3 位输入 CBA 是二进制数 0–7，译码器让对应的那一路输出有效。74LS138 输出低电平有效，所以“选中”的是 0、其余是 1。只有 G1=1 且 /G2A=/G2B=0 时芯片才工作。",
              tip: "做片选时，高位地址接 C、B、A，使能端常接访存控制信号 /MREQ（访存时才选中芯片）；/Yi 接第 i 片存储芯片的片选 /CS。",
              kv: { "使能": en ? "是" : "否", "有效输出": en ? "/Y" + sel : "无" } };
          };
          draw();
          return api;
        }
        function chipSelect(stage, inp) {
          var api = {}, addr = U.parseHex(inp.addr);
          if (addr == null || addr > 0xFFFF) { stage.appendChild(X.el("p", { class: "x-proc__err", role: "alert" }, "请输入 16 位十六进制地址，例如 6000 或 0x9ABC")); api.info = function () { return { t: "地址格式不对" }; }; return api; }
          var hi3 = addr >>> 13, low = addr & 0x1FFF;
          var wrap = X.el("div", { class: "x-proc__canvas" }); stage.appendChild(wrap);
          var svg = sv("svg", { viewBox: "0 0 820 420", class: "x-proc__svg x-c", role: "img", "aria-label": "地址 " + U.hex(addr, 4) + " 选中第 " + hi3 + " 片" }, wrap);
          svg.style.minWidth = "640px";
          sv("rect", { x: 20, y: 40, width: 120, height: 320, rx: 10, class: "x-c__chip is-on" }, svg);
          tx(svg, 80, 66, "CPU", "x-c__t x-c__t--b", "middle");
          tx(svg, 80, 90, U.hex(addr, 4), "x-c__big", "middle");
          var bitsStr = U.bin(addr, 16);
          tx(svg, 80, 118, bitsStr.slice(0, 3) + " " + bitsStr.slice(3, 7), "x-c__t x-c__t--m", "middle");
          tx(svg, 80, 134, bitsStr.slice(7, 11) + " " + bitsStr.slice(11), "x-c__t x-c__t--m", "middle");
          [["A15", 0], ["A14", 1], ["A13", 2]].forEach(function (q, i) {
            var bit = addr >>> (15 - i) & 1, y = 170 + i * 30;
            tx(svg, 132, y - 4, q[0], "x-c__t x-c__t--m", "end");
            wire(svg, [[140, y], [260, y]], bit); lamp(svg, 200, y, bit);
            tx(svg, 268, y + 1, ["C", "B", "A"][i], "x-c__t x-c__t--m", "start");
          });
          tx(svg, 132, 296, "/MREQ", "x-c__t x-c__t--m", "end");
          wire(svg, [[140, 300], [260, 300]], 0); tx(svg, 268, 301, "/G2A", "x-c__t x-c__t--m", "start");
          sv("rect", { x: 260, y: 140, width: 110, height: 190, rx: 8, class: "x-c__chip is-on" }, svg);
          tx(svg, 315, 236, "74LS138", "x-c__t x-c__t--b", "middle");
          tx(svg, 132, 380, "A12–A0（片内地址，接所有芯片）", "x-c__t x-c__t--m", "start");
          wire(svg, [[140, 392], [800, 392]], 1);
          for (var i = 0; i < 8; i++) {
            var y = 30 + i * 44, on = i === hi3, lo = i << 13, hiA = lo | 0x1FFF;
            wire(svg, [[370, 150 + i * 22], [420, 150 + i * 22], [420, y + 18], [520, y + 18]], on ? 1 : 0);
            tx(svg, 376, 146 + i * 22, "/Y" + i, "x-c__t x-c__t--s", "start");
            sv("rect", { x: 520, y: y, width: 260, height: 36, rx: 6, class: "x-c__ram" + (on ? " is-on" : "") }, svg);
            tx(svg, 534, y + 22, "RAM" + i + "  8K×8", "x-c__t x-c__t--b", "start");
            tx(svg, 770, y + 22, U.hex(lo, 4) + "–" + U.hex(hiA, 4), "x-c__t x-c__t--m", "end");
          }
          api.info = function () {
            return { meta: "地址 " + U.hex(addr, 4) + " = " + bitsStr.slice(0, 3) + " | " + bitsStr.slice(3), t: "A15–A13 = " + bitsStr.slice(0, 3) + " → /Y" + hi3 + " 有效，选中 RAM" + hi3,
              d: "64KB 地址空间用 8 片 8K×8 芯片字扩展。8K = 2^13，所以 A12–A0 共 13 位是片内地址，接到每一片；剩下的 A15–A13 共 3 位送 74LS138 译码，产生 8 个片选信号。",
              tip: "求某片的地址范围：高 3 位固定为片号，低 13 位从全 0 到全 1。例如 RAM3 = 011 0 0000 0000 0000 ~ 011 1 1111 1111 1111 = 0x6000–0x7FFF。",
              kv: { "高 3 位（片号）": bitsStr.slice(0, 3) + " = " + hi3, "片内地址 A12–A0": U.hex(low, 4), "选中芯片": "RAM" + hi3, "该片地址范围": U.hex(hi3 << 13, 4) + "–" + U.hex((hi3 << 13) | 0x1FFF, 4) } };
          };
          return api;
        }
        PROC.push({
          id: "decoder", name: "译码器", sub: "co",
          lead: "74LS138：3 位输入选中 8 路输出之一。第二个模式用它给 8 片存储芯片做片选。",
          note: ["n 位输入的译码器有 2^n 个输出，任一时刻只有一路有效。", "74LS138 输出低电平有效；使能条件 G1=1、/G2A=/G2B=0。", "片选方式：线选法（每根高位地址线直接选一片，地址不连续、浪费空间）与译码法。", "芯片数量 = 总容量 / 单片容量；片内地址位数 = log2(单片字数)。"],
          modes: [
            { name: "芯片功能", circuit: function (stage) { return chip138(stage); } },
            { name: "片选译码", inputs: [{ k: "addr", label: "主存地址（16 位，十六进制）", value: "6000", ph: "例如 6000" }],
              presets: [{ label: "0x6000", v: { addr: "6000" } }, { label: "0x1FFF", v: { addr: "1FFF" } }, { label: "0xE123", v: { addr: "E123" } }],
              circuit: function (stage, inp) { return chipSelect(stage, inp); } }
          ]
        });
      })();
