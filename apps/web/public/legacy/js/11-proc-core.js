      /* 过程图解：数据通路 / 流程 / 电路的单步交互图解。
         注册：PROC.push({ id, name, sub: "co"|"os", note: [..], inputs?: [..], modes: [{ name, make(inp) -> spec } | { name, circuit(api) }] })
         spec = { w, h, nodes: [...], edges: [...], steps: [{ t, d, tip, on, go, set, kv }] }  见下方 draw()。 */
      (function () {
        var PROC = window.PROC = window.PROC || [];
        var NUMS = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
        var SUBJ = { co: { name: "组成原理", c: "var(--x-co)" }, os: { name: "操作系统", c: "var(--x-os)" }, cn: { name: "计算机网络", c: "var(--x-cn)" } };

        /* ---------- 小工具，供各图解数据使用 ---------- */
        var P = window.PROCU = {
          hex: function (n, w) { var s = (n >>> 0).toString(16).toUpperCase(); while (s.length < (w || 1)) s = "0" + s; return "0x" + s; },
          bin: function (n, w) { var s = (n >>> 0).toString(2); while (s.length < w) s = "0" + s; return s; },
          parseHex: function (s) {
            s = String(s || "").trim().replace(/^0x/i, "").replace(/[\s_]/g, "");
            if (!/^[0-9a-f]{1,8}$/i.test(s)) return null;
            return parseInt(s, 16) >>> 0;
          },
          parseInt10: function (s) {
            s = String(s || "").trim().replace(/[\s,_]/g, "");
            if (!/^\d{1,13}$/.test(s)) return null;
            return Number(s);
          },
          /* 确定性的“伪随机”：同一输入总得到同一张表 */
          mix: function (a, b) { var x = (Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x27d4eb2f, 0xc2b2ae35)) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; return (x ^ (x >>> 12)) >>> 0; }
        };

        function el(tag, attrs, html) { return X.el(tag, attrs, html); }
        function sv(tag, attrs, parent) { return X.svg(tag, attrs, parent); }
        function text(parent, x, y, s, cls, anchor) {
          var t = sv("text", { x: x, y: y, class: cls || "" }, parent);
          if (anchor) t.setAttribute("text-anchor", anchor);
          var lines = String(s).split("\n");
          if (lines.length === 1) { t.textContent = s; return t; }
          var lh = /--sm/.test(cls || "") ? 17 : 19, y0 = y - ((lines.length - 1) * lh) / 2;
          lines.forEach(function (ln, i) { var sp = sv("tspan", { x: x, y: y0 + i * lh }, t); sp.textContent = ln; });
          return t;
        }
        function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

        /* ---------- 流程图渲染 ---------- */
        function anchor(n, side, off) {
          off = off || 0;
          switch (side) {
            case "l": return [n.x, n.y + n.h / 2 + off];
            case "r": return [n.x + n.w, n.y + n.h / 2 + off];
            case "t": return [n.x + n.w / 2 + off, n.y];
            default: return [n.x + n.w / 2 + off, n.y + n.h];
          }
        }
        function route(e, N) {
          var A = N[e.a], B = N[e.b];
          var as = e.as || "r", bs = e.bs || "l";
          var p0 = anchor(A, as, e.ao), p1 = anchor(B, bs, e.bo), pts = [p0];
          if (e.pts) pts = pts.concat(e.pts);
          else {
            var hA = as === "l" || as === "r", hB = bs === "l" || bs === "r";
            if (hA && hB) { if (p0[1] !== p1[1]) { var mx = e.mx != null ? e.mx : (p0[0] + p1[0]) / 2; pts.push([mx, p0[1]], [mx, p1[1]]); } }
            else if (!hA && !hB) { if (p0[0] !== p1[0]) { var my = e.my != null ? e.my : (p0[1] + p1[1]) / 2; pts.push([p0[0], my], [p1[0], my]); } }
            else if (hA) pts.push([p1[0], p0[1]]);
            else pts.push([p0[0], p1[1]]);
          }
          pts.push(p1);
          return pts;
        }
        function labelPos(pts, e) {
          if (e.lp) return e.lp;
          var best = 0, bi = 0;
          for (var i = 0; i < pts.length - 1; i++) { var d = Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]); if (d > best) { best = d; bi = i; } }
          return [(pts[bi][0] + pts[bi + 1][0]) / 2, (pts[bi][1] + pts[bi + 1][1]) / 2];
        }
        function tw(s) { var w = 0; for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 255 ? 12.5 : 6.9; return w; }

        function drawNode(g, n, st, cls) {
          var k = n.k || "box";
          var grp = sv("g", { class: "x-pn x-pn--" + k + cls, "data-id": n.id }, g);
          if (k === "zone") {
            sv("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: 12, class: "x-pn__zone" }, grp);
            text(grp, n.x + 12, n.y + 18, n.t, "x-pn__zt", "start");
            return grp;
          }
          if (k === "dec") {
            var cx = n.x + n.w / 2, cy = n.y + n.h / 2;
            sv("polygon", { points: [cx, n.y, n.x + n.w, cy, cx, n.y + n.h, n.x, cy].join(" "), class: "x-pn__box" }, grp);
            text(grp, cx, cy, st.t || n.t, "x-pn__t x-pn__t--sm", "middle");
            return grp;
          }
          if (k === "table") {
            sv("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: 8, class: "x-pn__box" }, grp);
            text(grp, n.x + n.w / 2, n.y + 15, st.t || n.t, "x-pn__th", "middle");
            var rows = st.rows || n.rows || [], rh = n.rh || 19, y0 = n.y + 26, cols = n.cols || [0.42];
            rows.forEach(function (r, i) {
              var y = y0 + i * rh, on = st.hi === i || (st.hi && st.hi.indexOf && st.hi.indexOf(i) >= 0);
              var bad = st.bad === i;
              sv("rect", { x: n.x + 4, y: y, width: n.w - 8, height: rh - 2, rx: 4, class: "x-pn__row" + (on ? " is-hi" : "") + (bad ? " is-bad" : "") }, grp);
              if (r.length === 1) { text(grp, n.x + n.w / 2, y + rh / 2, r[0], "x-pn__cell x-pn__cell--dim", "middle"); return; }
              var xs = [n.x + 10], acc = 0;
              cols.forEach(function (c) { acc += c; xs.push(n.x + n.w * acc); });
              r.forEach(function (c, j) { text(grp, xs[j] + (j ? 4 : 0), y + rh / 2, c, "x-pn__cell" + (j ? "" : " x-pn__cell--k"), "start"); });
            });
            return grp;
          }
          if (k === "fields") {
            var segs = st.segs || n.segs, tot = 0;
            segs.forEach(function (s) { tot += s.w || s.b; });
            text(grp, n.x, n.y - 8, st.t || n.t, "x-pn__ft", "start");
            var x = n.x;
            segs.forEach(function (s, i) {
              var w = n.w * (s.w || s.b) / tot;
              sv("rect", { x: x, y: n.y, width: w, height: n.h, class: "x-pn__seg" + (s.on ? " is-on" : "") + (i === 0 ? " is-first" : "") }, grp);
              text(grp, x + w / 2, n.y + 14, s.t, "x-pn__st", "middle");
              text(grp, x + w / 2, n.y + n.h / 2 + 5, s.v == null ? "" : s.v, "x-pn__sv", "middle");
              if (!n.unit) text(grp, x + w / 2, n.y + n.h - 7, s.b + " 位", "x-pn__sb", "middle");
              x += w;
            });
            return grp;
          }
          var rx = k === "term" ? n.h / 2 : k === "reg" ? 4 : 8;
          sv("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: rx, class: "x-pn__box" }, grp);
          var v = st.v != null ? st.v : n.v;
          if (v != null && v !== "") {
            text(grp, n.x + n.w / 2, n.y + n.h / 2 - 8, st.t || n.t, "x-pn__t x-pn__t--sm", "middle");
            text(grp, n.x + n.w / 2, n.y + n.h / 2 + 10, v, "x-pn__v", "middle");
          } else text(grp, n.x + n.w / 2, n.y + n.h / 2, st.t || n.t, "x-pn__t" + (n.sm ? " x-pn__t--sm" : ""), "middle");
          if (st.badge || n.badge) {
            var bt = st.badge || n.badge, bw = tw(bt) + 10;
            sv("rect", { x: n.x + n.w - bw + 6, y: n.y - 9, width: bw, height: 18, rx: 9, class: "x-pn__badge" }, grp);
            text(grp, n.x + n.w - bw / 2 + 6, n.y, bt, "x-pn__bt", "middle");
          }
          return grp;
        }

        function Flow(stage, spec, onScroll) {
          var N = {}, E = {};
          spec.nodes.forEach(function (n) { N[n.id] = n; });
          var wrap = el("div", { class: "x-proc__canvas" });
          stage.appendChild(wrap);
          var svg = sv("svg", { viewBox: "0 0 " + spec.w + " " + spec.h, role: "img", class: "x-proc__svg" }, wrap);
          svg.style.minWidth = Math.round(spec.w * (spec.minScale || 0.82)) + "px";
          var defs = sv("defs", {}, svg);
          ["n", "s", "a"].forEach(function (k) {
            var m = sv("marker", { id: "x-pr-mk-" + k, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: "userSpaceOnUse", orient: "auto" }, defs);
            sv("path", { d: "M0,0 L10,5 L0,10 z", class: "x-pe__ah x-pe__ah--" + k }, m);
          });
          var gz = sv("g", {}, svg), ge = sv("g", {}, svg), gn = sv("g", {}, svg), gl = sv("g", {}, svg), gt = sv("g", {}, svg);
          spec.edges.forEach(function (e) { E[e.id] = { e: e, pts: route(e, N) }; });

          function render(i) {
            var st = {}, kv = {}, kvNew = {}, seenN = {}, seenE = {}, s = spec.steps[i];
            for (var j = 0; j <= i; j++) {
              var sj = spec.steps[j];
              for (var id in sj.set || {}) st[id] = merge(st[id] || {}, sj.set[id]);
              for (var kk in sj.kv || {}) { kv[kk] = sj.kv[kk]; if (j === i) kvNew[kk] = 1; }
              if (j < i) { (sj.on || []).forEach(function (x) { seenN[x] = 1; }); (sj.go || []).forEach(function (x) { seenE[x] = 1; }); }
            }
            var on = {}, act = {};
            (s.on || []).forEach(function (x) { on[x] = 1; });
            (s.go || []).forEach(function (x) { act[x] = 1; });
            [gz, ge, gn, gl].forEach(function (g) { while (g.firstChild) g.removeChild(g.firstChild); });
            spec.nodes.forEach(function (n) {
              var c = on[n.id] ? " is-on" : seenN[n.id] ? " is-seen" : "";
              drawNode(n.k === "zone" ? gz : gn, n, st[n.id] || {}, c);
            });
            spec.edges.forEach(function (e) {
              var r = E[e.id], k = act[e.id] ? "a" : seenE[e.id] ? "s" : "n";
              var d = "M" + r.pts.map(function (p) { return p[0] + "," + p[1]; }).join(" L");
              r.path = sv("path", { d: d, class: "x-pe x-pe--" + k + (e.dash ? " x-pe--dash" : "") + (e.bus ? " x-pe--bus" : ""), "marker-end": e.noArrow ? "" : "url(#x-pr-mk-" + k + ")" }, ge);
              if (e.both) r.path.setAttribute("marker-start", "url(#x-pr-mk-" + k + ")");
              if (e.t) {
                var lp = labelPos(r.pts, e), w = tw(e.t) + 10;
                sv("rect", { x: lp[0] - w / 2, y: lp[1] - 9, width: w, height: 18, rx: 4, class: "x-pe__lbg" + (k === "a" ? " is-a" : "") }, gl);
                text(gl, lp[0], lp[1], e.t, "x-pe__lt x-pe__lt--" + k, "middle");
              }
            });
            svg.setAttribute("aria-label", "第 " + (i + 1) + " 步，共 " + spec.steps.length + " 步：" + (s.t || ""));
            /* 窄屏：把当前部件滚到可视范围 */
            if (onScroll && s.on && s.on.length) {
              var xs = s.on.map(function (id) { return N[id]; }).filter(Boolean);
              if (xs.length) {
                var lo = Math.min.apply(null, xs.map(function (n) { return n.x; })), hi = Math.max.apply(null, xs.map(function (n) { return n.x + n.w; }));
                onScroll(wrap, svg, (lo + hi) / 2 / spec.w);
              }
            }
            return { kv: kv, kvNew: kvNew };
          }
          var anim = 0;
          function animate(i, dur) {
            cancelAnimationFrame(anim);
            while (gt.firstChild) gt.removeChild(gt.firstChild);
            var go = (spec.steps[i].go || []).filter(function (id) { return E[id] && E[id].path; });
            if (!go.length || X.reduced) return;
            var paths = go.map(function (id) { return E[id].path; }), lens = paths.map(function (p) { return p.getTotalLength(); });
            var dot = sv("circle", { r: 6, class: "x-pe__dot" }, gt), halo = sv("circle", { r: 12, class: "x-pe__halo" }, gt);
            var t0 = performance.now(), each = dur / paths.length;
            (function tick(now) {
              var t = Math.max(0, now - t0) / each, k = Math.min(paths.length - 1, Math.floor(t)), f = Math.min(1, t - k);
              if (t >= paths.length) { gt.removeChild(dot); gt.removeChild(halo); return; }
              f = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
              var p = paths[k].getPointAtLength(lens[k] * f);
              dot.setAttribute("cx", p.x); dot.setAttribute("cy", p.y); halo.setAttribute("cx", p.x); halo.setAttribute("cy", p.y);
              anim = requestAnimationFrame(tick);
            })(t0);
          }
          return { render: render, animate: animate, n: spec.steps.length, step: function (i) { return spec.steps[i]; }, destroy: function () { cancelAnimationFrame(anim); } };
        }

        /* ---------- 外壳 ---------- */
        function build() {
          var root = document.getElementById("x-proc");
          if (!root || root.dataset.built || !PROC.length) return;
          root.dataset.built = "1";
          var ORDER = ["gates", "adder", "decoder", "icycle", "micro", "tlbflow", "tlbcache", "cachewrite", "intr", "dma", "boot", "syscall", "pstate", "pswitch", "twolevel", "mixidx", "fileopen", "devalloc", "spooling", "encap", "webvisit", "dns", "arp", "dhcp", "nat", "switch", "icmp", "email"];
          var SO = { co: 0, os: 1, cn: 2 }, reg = PROC.slice();
          PROC.sort(function (a, b) { var i = ORDER.indexOf(a.id), j = ORDER.indexOf(b.id); return (SO[a.sub] - SO[b.sub]) || ((i < 0 ? 99 : i) - (j < 0 ? 99 : j)) || (reg.indexOf(a) - reg.indexOf(b)); });
          var tabs = el("div", { class: "x-proc__tabs", role: "tablist", "aria-label": "过程图解" });
          ["co", "os", "cn"].forEach(function (sub) {
            if (!PROC.some(function (d) { return d.sub === sub; })) return;
            var grp = el("div", { class: "x-proc__grp", role: "presentation" }, '<span class="x-proc__gl" style="--c:' + SUBJ[sub].c + '">' + SUBJ[sub].name + "</span>");
            PROC.forEach(function (d, i) {
              if (d.sub !== sub) return;
              var b = el("button", { type: "button", role: "tab", class: "x-proc__tab", id: "ptab-" + d.id, "aria-controls": "x-proc-body", "aria-selected": "false", tabindex: "-1", style: "--c:" + SUBJ[sub].c });
              b.textContent = d.name;
              b.addEventListener("click", function () { open(i, true); });
              d._tab = b;
              grp.appendChild(b);
            });
            tabs.appendChild(grp);
          });
          var body = el("div", { class: "x-proc__body", id: "x-proc-body", role: "tabpanel" },
            '<div class="x-proc__main">' +
            '<div class="x-proc__opts"></div>' +
            '<div class="x-proc__stage"></div>' +
            '<div class="x-proc__ctrl">' +
            '<button type="button" class="x-lab__btn" data-a="prev" aria-label="上一步">上一步</button>' +
            '<button type="button" class="x-lab__btn x-lab__btn--main" data-a="play" aria-pressed="false">播放</button>' +
            '<button type="button" class="x-lab__btn" data-a="next" aria-label="下一步">下一步</button>' +
            '<button type="button" class="x-lab__btn" data-a="reset">重置</button>' +
            '<label class="x-lab__speed">速度 <input type="range" min="1" max="10" value="5" aria-label="播放速度"></label>' +
            '<span class="x-proc__count" aria-hidden="true"></span></div>' +
            '<div class="x-proc__card" aria-live="polite"><p class="x-proc__meta"></p><h4 class="x-proc__t"></h4><p class="x-proc__d"></p><p class="x-proc__tip"></p></div>' +
            '<div class="x-proc__kv"></div>' +
            '<details class="x-proc__all" open><summary>全部步骤</summary><ol class="x-proc__steps"></ol></details>' +
            '</div><aside class="x-proc__note"><b>考点</b><ul></ul></aside>');
          root.appendChild(tabs);
          root.appendChild(body);
          var q = function (s) { return body.querySelector(s); };
          var opts = q(".x-proc__opts"), stage = q(".x-proc__stage"), ctrl = q(".x-proc__ctrl"), card = q(".x-proc__card"), kvBox = q(".x-proc__kv"), list = q(".x-proc__steps"), all = q(".x-proc__all");
          var play = q('[data-a="play"]'), speed = q(".x-lab__speed input"), count = q(".x-proc__count");
          var cur = null, mode = 0, inp = {}, flow = null, circ = null, pos = 0, timer = null;

          function dur() { return 1500 - speed.value * 110; }
          function stop() { clearTimeout(timer); timer = null; play.textContent = "播放"; play.setAttribute("aria-pressed", "false"); }
          function scrollTo(wrap, svg, f) {
            if (wrap.scrollWidth <= wrap.clientWidth + 2) return;
            var x = f * svg.clientWidth - wrap.clientWidth / 2;
            wrap.scrollTo({ left: Math.max(0, x), behavior: X.reduced ? "auto" : "smooth" });
          }
          function total() { return flow ? flow.n : circ && circ.n ? circ.n : 0; }
          function showStep(i, animate) {
            var n = total();
            if (!n) return;
            pos = Math.max(0, Math.min(n - 1, i));
            var s, kv, kvNew;
            if (flow) { var r = flow.render(pos); kv = r.kv; kvNew = r.kvNew; s = flow.step(pos); if (animate) flow.animate(pos, dur() * 0.9); }
            else { s = circ.go(pos) || {}; kv = s.kv || {}; kvNew = s.kvNew || {}; }
            card.querySelector(".x-proc__meta").textContent = "第 " + (pos + 1) + " / " + n + " 步";
            card.querySelector(".x-proc__t").textContent = s.t || "";
            card.querySelector(".x-proc__d").textContent = s.d || "";
            var tip = card.querySelector(".x-proc__tip");
            tip.textContent = s.tip ? "考点：" + s.tip : "";
            tip.hidden = !s.tip;
            renderKv(kv, kvNew);
            count.textContent = (pos + 1) + " / " + n;
            q('[data-a="prev"]').disabled = pos === 0;
            q('[data-a="next"]').disabled = pos >= n - 1;
            Array.prototype.forEach.call(list.children, function (li, k) {
              var on = k === pos;
              li.classList.toggle("is-cur", on);
              li.classList.toggle("is-done", k < pos);
              var b = li.querySelector("button");
              if (on) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
            });
          }
          function renderKv(kv, kvNew) {
            kvBox.innerHTML = "";
            var ks = Object.keys(kv || {});
            kvBox.hidden = !ks.length;
            ks.forEach(function (k) {
              var d = el("div", { class: "x-proc__kvi" + (kvNew && kvNew[k] ? " is-new" : "") });
              d.appendChild(el("span", {}, "")).textContent = k;
              d.appendChild(el("b", {}, "")).textContent = kv[k];
              kvBox.appendChild(d);
            });
          }
          function buildList(getT) {
            list.innerHTML = "";
            var n = total();
            all.hidden = n <= 1;
            for (var k = 0; k < n; k++) {
              var li = el("li", {}), b = el("button", { type: "button" });
              b.textContent = (k < NUMS.length ? NUMS.charAt(k) : k + 1 + ".") + " " + getT(k);
              (function (k) { b.addEventListener("click", function () { stop(); showStep(k, false); }); })(k);
              li.appendChild(b);
              list.appendChild(li);
            }
          }
          function load(keepPos) {
            stop();
            if (flow) flow.destroy();
            flow = null; circ = null;
            stage.innerHTML = "";
            var m = cur.modes[mode], err = null;
            if (m.circuit) {
              circ = m.circuit(stage, inp) || {};
              circ._r = function (i) { if (circ.n) showStep(i == null ? pos : i, false); else refreshCirc(); };
              ctrl.hidden = !circ.n;
              card.hidden = false;
              if (circ.n) { buildList(function (k) { return (circ.go(k, true) || {}).t || ""; }); showStep(keepPos ? pos : circ.start || 0, false); }
              else { all.hidden = true; refreshCirc(); }
              return;
            }
            ctrl.hidden = false;
            var spec;
            try { spec = m.make(inp); } catch (e) { err = e && e.message ? e.message : String(e); }
            if (!spec || err) {
              stage.appendChild(el("p", { class: "x-proc__err", role: "alert" }, "")).textContent = err || "输入有误";
              card.hidden = true; kvBox.hidden = true; all.hidden = true; ctrl.hidden = true;
              return;
            }
            card.hidden = false;
            flow = Flow(stage, spec, scrollTo);
            buildList(function (k) { return spec.steps[k].t; });
            showStep(keepPos ? Math.min(pos, flow.n - 1) : 0, false);
          }
          function refreshCirc() {
            var s = circ && circ.info ? circ.info() : {};
            card.querySelector(".x-proc__meta").textContent = s.meta || "拨动开关试试";
            card.querySelector(".x-proc__t").textContent = s.t || "";
            card.querySelector(".x-proc__d").textContent = s.d || "";
            var tip = card.querySelector(".x-proc__tip");
            tip.textContent = s.tip ? "考点：" + s.tip : ""; tip.hidden = !s.tip;
            renderKv(s.kv || {}, s.kvNew || {});
          }
          function buildOpts() {
            opts.innerHTML = "";
            var head = el("div", { class: "x-proc__head" });
            head.appendChild(el("h3", {}, "")).textContent = cur.name;
            if (cur.lead) head.appendChild(el("p", {}, "")).textContent = cur.lead;
            opts.appendChild(head);
            if (cur.modes.length > 1) {
              var row = el("div", { class: "x-proc__modes", role: "group", "aria-label": "模式" });
              cur.modes.forEach(function (m, i) {
                var b = el("button", { type: "button", class: "x-lab__btn", "aria-pressed": i === mode ? "true" : "false" });
                b.textContent = m.name;
                b.addEventListener("click", function () {
                  mode = i;
                  Array.prototype.forEach.call(row.children, function (x, k) { x.setAttribute("aria-pressed", k === i ? "true" : "false"); });
                  buildInputs();
                  load();
                });
                row.appendChild(b);
              });
              opts.appendChild(row);
            }
            var inBox = el("div", { class: "x-proc__inputs" });
            opts.appendChild(inBox);
            buildInputs();
            function buildInputs() {
              inBox.innerHTML = "";
              var list = (cur.inputs || []).concat(cur.modes[mode].inputs || []);
              inBox.hidden = !list.length;
              list.forEach(function (f) {
                if (!(f.k in inp)) inp[f.k] = f.value;
                var lab = el("label", { class: "x-proc__in" });
                lab.appendChild(el("span", {}, "")).textContent = f.label;
                var c;
                if (f.type === "select") {
                  c = el("select", {});
                  f.opts.forEach(function (o) { var op = el("option", { value: o[0] }); op.textContent = o[1]; c.appendChild(op); });
                  c.value = inp[f.k];
                  c.addEventListener("change", function () { inp[f.k] = c.value; load(); });
                } else {
                  c = el("input", { type: "text", inputmode: f.num ? "numeric" : "text", autocomplete: "off", spellcheck: "false", value: inp[f.k] });
                  if (f.ph) c.placeholder = f.ph;
                  var t = null;
                  c.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { inp[f.k] = c.value; load(); }, 350); });
                  c.addEventListener("keydown", function (e) { if (e.key === "Enter") { clearTimeout(t); inp[f.k] = c.value; load(); } });
                }
                lab.appendChild(c);
                inBox.appendChild(lab);
              });
              if (cur.modes[mode].presets) {
                var pr = el("div", { class: "x-proc__presets" });
                pr.appendChild(el("span", {}, "试试："));
                cur.modes[mode].presets.forEach(function (p) {
                  var b = el("button", { type: "button", class: "x-proc__preset" });
                  b.textContent = p.label;
                  b.addEventListener("click", function () { for (var k in p.v) inp[k] = p.v[k]; buildInputs(); load(); });
                  pr.appendChild(b);
                });
                inBox.appendChild(pr);
                inBox.hidden = false;
              }
            }
          }
          function open(i, user) {
            stop();
            PROC.forEach(function (d, k) { d._tab.setAttribute("aria-selected", k === i ? "true" : "false"); d._tab.tabIndex = k === i ? 0 : -1; });
            cur = PROC[i]; mode = 0; inp = {};
            body.setAttribute("aria-labelledby", "ptab-" + cur.id);
            body.style.setProperty("--c", SUBJ[cur.sub].c);
            var ul = body.querySelector(".x-proc__note ul");
            ul.innerHTML = "";
            (cur.note || []).forEach(function (t) { ul.appendChild(el("li", {}, "")).textContent = t; });
            buildOpts();
            load();
            if (user && history.replaceState) history.replaceState(null, "", "#proc-" + cur.id);
          }
          q('[data-a="next"]').addEventListener("click", function () { stop(); showStep(pos + 1, true); });
          q('[data-a="prev"]').addEventListener("click", function () { stop(); showStep(pos - 1, false); });
          q('[data-a="reset"]').addEventListener("click", function () { stop(); showStep(0, false); });
          play.addEventListener("click", function () {
            if (timer) return stop();
            if (pos >= total() - 1) showStep(0, false);
            play.textContent = "暂停"; play.setAttribute("aria-pressed", "true");
            (function loop() {
              timer = setTimeout(function () {
                if (pos >= total() - 1) return stop();
                showStep(pos + 1, true);
                if (pos >= total() - 1) return stop();
                loop();
              }, dur());
            })();
          });
          body.addEventListener("keydown", function (e) {
            var t = e.target.tagName;
            if (t === "INPUT" || t === "SELECT" || t === "TEXTAREA") return;
            if (e.key === "ArrowRight") { e.preventDefault(); stop(); showStep(pos + 1, true); }
            if (e.key === "ArrowLeft") { e.preventDefault(); stop(); showStep(pos - 1, false); }
          });
          tabs.addEventListener("keydown", function (e) {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            var k = PROC.indexOf(cur), order = ["co", "os", "cn"].reduce(function (a, sb) { return a.concat(PROC.filter(function (d) { return d.sub === sb; })); }, []);
            var j = order.indexOf(cur) + (e.key === "ArrowRight" ? 1 : -1);
            j = (j + order.length) % order.length;
            open(PROC.indexOf(order[j]), true);
            order[j]._tab.focus();
            void k;
          });
          window.X_OPEN_PROC = function (id) {
            var i = PROC.findIndex(function (d) { return d.id === id; });
            if (i >= 0) { open(i, false); return true; }
            return false;
          };
          var first = PROC.findIndex(function (d) { return d.sub === "co"; });
          open(first < 0 ? 0 : first, false);
        }
        if (window.__LEGACY_LOADER__) window.addEventListener("legacy:ready", build);
        else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
        else setTimeout(build, 0);
      })();
