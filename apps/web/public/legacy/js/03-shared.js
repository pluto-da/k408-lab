      /* shared helpers for all phases */
      window.X = (function () {
        var NS = "http://www.w3.org/2000/svg";
        var subjects = [
          { id: "ds", name: "数据结构", short: "DS", score: 45, color: "#1F7A6D", mcq: [1, 11] },
          { id: "co", name: "计算机组成原理", short: "CO", score: 45, color: "#C2512B", mcq: [12, 22] },
          { id: "os", name: "操作系统", short: "OS", score: 35, color: "#D9A21B", mcq: [23, 32] },
          { id: "cn", name: "计算机网络", short: "CN", score: 25, color: "#2D4FA3", mcq: [33, 40] }
        ];
        function svg(tag, attrs, parent) {
          var n = document.createElementNS(NS, tag);
          for (var k in attrs) n.setAttribute(k, attrs[k]);
          if (parent) parent.appendChild(n);
          return n;
        }
        function el(tag, attrs, html) {
          var n = document.createElement(tag);
          for (var k in attrs || {}) n.setAttribute(k, attrs[k]);
          if (html != null) n.innerHTML = html;
          return n;
        }
        /* dimension line: thin line + end ticks + mono label, horizontal */
        function dim(parent, x1, x2, y, label, opts) {
          opts = opts || {};
          var g = svg("g", { stroke: opts.color || "#16181D", "stroke-width": 1, fill: "none" }, parent);
          svg("line", { x1: x1, y1: y, x2: x2, y2: y }, g);
          svg("line", { x1: x1, y1: y - 5, x2: x1, y2: y + 5 }, g);
          svg("line", { x1: x2, y1: y - 5, x2: x2, y2: y + 5 }, g);
          if (label) {
            var w = label.length * 7.4 + 8, cx = (x1 + x2) / 2;
            svg("rect", { x: cx - w / 2, y: y - 8, width: w, height: 16, fill: "#F2EFE8", stroke: "none" }, g);
            var t = svg("text", { x: cx, y: y + 4, "text-anchor": "middle", fill: opts.color || "#16181D", stroke: "none",
              "font-family": "Menlo,monospace", "font-size": opts.size || 12 }, g);
            t.textContent = label;
          }
          return g;
        }
        function bySubject(id) { return subjects.filter(function (s) { return s.id === id; })[0]; }
        function go(id) { var t = document.getElementById(id); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); }
        var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        return { subjects: subjects, svg: svg, el: el, dim: dim, bySubject: bySubject, go: go, reduced: reduced, ink: "#16181D", paper: "#F2EFE8" };
      })();

      /* §02 score bar + question cells */
      (function () {
        var s = document.getElementById("scorebar"), W = 600, x = 0;
        X.dim(s, 0, W, 12, "150 分");
        X.subjects.forEach(function (sub) {
          var w = (sub.score / 150) * W;
          X.svg("rect", { x: x, y: 32, width: w, height: 32, fill: sub.color, stroke: X.ink, "stroke-width": 1 }, s);
          X.dim(s, x + 2, x + w - 2, 80, String(sub.score), { size: 13 });
          x += w;
        });
        var box = document.getElementById("mcq");
        for (var i = 1; i <= 40; i++) {
          var sub = X.subjects.filter(function (t) { return i >= t.mcq[0] && i <= t.mcq[1]; })[0];
          var c = X.el("div", { class: "x-cell" + (sub.id === "os" ? " is-os" : ""), style: "--c:" + sub.color }, String(i));
          box.appendChild(c);
        }
      })();
    
