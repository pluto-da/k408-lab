      /* shared helpers for all phases */
      window.X = (function () {
        var NS = "http://www.w3.org/2000/svg";
        var subjects = [
          { id: "ds", name: "数据结构", short: "DS", score: 45, color: "#3A8475", mcq: [1, 11] },
          { id: "co", name: "计算机组成原理", short: "CO", score: 45, color: "#C0603E", mcq: [12, 22] },
          { id: "os", name: "操作系统", short: "OS", score: 35, color: "#C49431", mcq: [23, 32] },
          { id: "cn", name: "计算机网络", short: "CN", score: 25, color: "#4766B3", mcq: [33, 40] }
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
          var g = svg("g", { stroke: opts.color || "#5B606B", "stroke-width": 1, fill: "none" }, parent);
          svg("line", { x1: x1, y1: y, x2: x2, y2: y }, g);
          svg("line", { x1: x1, y1: y - 5, x2: x1, y2: y + 5 }, g);
          svg("line", { x1: x2, y1: y - 5, x2: x2, y2: y + 5 }, g);
          if (label) {
            var w = label.length * 7.4 + 8, cx = (x1 + x2) / 2;
            svg("rect", { x: cx - w / 2, y: y - 8, width: w, height: 16, fill: "#FFFFFF", stroke: "none" }, g);
            var t = svg("text", { x: cx, y: y + 4, "text-anchor": "middle", fill: opts.color || "#1A1C20", stroke: "none",
              "font-family": "Geist Mono,Menlo,monospace", "font-size": opts.size || 12 }, g);
            t.textContent = label;
          }
          return g;
        }
        function bySubject(id) { return subjects.filter(function (s) { return s.id === id; })[0]; }
        function go(id) { var t = document.getElementById(id); if (t) t.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); }
        var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        /* 单步到头时的轻提示：在 box（role=status）里显示一句话，约 2.6 秒后消失；btn 轻微抖动一下（减少动态效果时不抖） */
        function hint(box, msg, btn) {
          if (!box) return;
          box.textContent = msg;
          box.hidden = false;
          clearTimeout(box.__t);
          box.__t = setTimeout(function () { box.hidden = true; box.textContent = ""; }, 2600);
          if (btn && !reduced) {
            btn.classList.remove("x-shake");
            void btn.offsetWidth;
            btn.classList.add("x-shake");
            clearTimeout(btn.__t);
            btn.__t = setTimeout(function () { btn.classList.remove("x-shake"); }, 450);
          }
        }
        return { subjects: subjects, svg: svg, el: el, dim: dim, bySubject: bySubject, go: go, hint: hint, reduced: reduced, ink: "#1A1C20", paper: "#FFFFFF" };
      })();
