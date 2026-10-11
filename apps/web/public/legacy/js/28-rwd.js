      /* 多设备适配的交互补充（样式在 legacy-15.css）：
         1. 横向滚动行（科目切换、实验 / 图解标签、性质列表、宽画布）两端渐隐 + “左右滑动查看”提示，首次进入轻推一下；
         2. 实验输出区在侧栏里放不下（大表格）时移到画布下方整宽显示；
         3. 键盘：← → 单步、空格播放 / 暂停、R 重置（焦点在页面空白处时作用于视口中的实验或图解；到头时只提示，不重置）；
         4. 过程图解“放大查看”：全屏、双指缩放、拖动，可在全屏里单步。 */
      (function () {
        if (typeof document === "undefined" || !document.getElementById || !document.getElementById("x-tool")) return;
        var reduced = !!(window.X && X.reduced);
        var mm = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false, addEventListener: function () {} }; };
        var coarse = mm("(pointer: coarse)");
        var wideMq = mm("(min-width: 1024px), (orientation: landscape) and (max-height: 520px) and (min-width: 640px)");
        var raf = window.requestAnimationFrame || function (f) { return setTimeout(f, 16); };

        /* ---------- 1. 横向滚动提示 ---------- */
        var SX = ".x-chips, .x-lab__grp, .x-proc__grp, .x-prop__subs, .x-prop__list, .x-ch, .x-lab__stage, .x-proc__canvas, .x-tbl, .x-prop__box, .x-c__ttw";
        var HINT = { "x-lab__stage": 1, "x-proc__canvas": 1 };
        var NUDGE = ".x-chips, .x-lab__grp, .x-proc__grp, .x-prop__list";
        var seen = [], ro = window.ResizeObserver ? new ResizeObserver(function (es) { es.forEach(function (e) { var t = e.target.__sx || e.target; upd(t); }); }) : null;
        function hintOf(el) {
          var key = el.classList.contains("x-lab__stage") ? "x-lab__stage" : el.classList.contains("x-proc__canvas") ? "x-proc__canvas" : null;
          if (!key || !HINT[key]) return null;
          if (!el.__hint) {
            var p = el.parentElement; if (!p) return null;
            p.classList.add("x-sxp");
            var h = document.createElement("span");
            h.className = "x-swipe"; h.setAttribute("aria-hidden", "true"); h.textContent = "左右滑动查看"; h.hidden = true;
            p.appendChild(h); el.__hint = h;
          }
          return el.__hint;
        }
        function upd(el) {
          if (!el.isConnected) return;
          var cw = el.clientWidth, sw = el.scrollWidth, sl = el.scrollLeft;
          var can = cw > 0 && sw > cw + 2;
          el.classList.toggle("x-sx", can);
          if (can && sl > 2) el.setAttribute("data-l", ""); else el.removeAttribute("data-l");
          if (can && sl + cw < sw - 2) el.setAttribute("data-r", ""); else el.removeAttribute("data-r");
          var h = hintOf(el);
          if (h) {
            var show = can && !el.__used;
            h.hidden = !show;
            if (show) {
              h.style.right = "auto"; h.style.bottom = "auto";
              h.style.top = Math.max(0, el.offsetTop + el.offsetHeight - h.offsetHeight - 10) + "px";
              h.style.left = Math.max(0, el.offsetLeft + el.offsetWidth - h.offsetWidth - 10) + "px";
            }
          }
        }
        function attach(el) {
          if (el.__sxOn) return;
          el.__sxOn = true; seen.push(el);
          el.addEventListener("scroll", function () {
            if (el.scrollLeft > 8 && !el.__used) el.__used = true;
            if (!el.__t) { el.__t = true; raf(function () { el.__t = false; upd(el); }); }
          }, { passive: true });
          if (ro) { ro.observe(el); var c = el.firstElementChild; if (c) { c.__sx = el; ro.observe(c); } }
          upd(el);
        }
        function scan() {
          seen = seen.filter(function (e) { return e.isConnected; });
          Array.prototype.forEach.call(document.querySelectorAll(SX), attach);
          seen.forEach(upd);
          nudgeScan();
        }
        var pend = false;
        function soon() { if (pend) return; pend = true; setTimeout(function () { pend = false; scan(); wideCheck(); }, 60); }

        /* 首次进入视口时轻推一下，提示还能横向滑动（减少动态效果时不做） */
        var nudged = {}, io = window.IntersectionObserver ? new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (!e.isIntersecting) return;
            var el = e.target; io.unobserve(el);
            if (el.scrollWidth <= el.clientWidth + 8 || el.scrollLeft > 0) return;
            setTimeout(function () {
              if (!el.scrollTo) return;
              el.scrollTo({ left: 56, behavior: "smooth" });
              setTimeout(function () { el.scrollTo({ left: 0, behavior: "smooth" }); el.__used = false; }, 520);
            }, 400);
          });
        }, { threshold: 0.9 }) : null;
        function nudgeScan() {
          if (!io || reduced || !coarse.matches) return;
          Array.prototype.forEach.call(document.querySelectorAll(NUDGE), function (el) {
            var k = el.classList[0];
            if (nudged[k] || el.offsetParent === null || el.scrollWidth <= el.clientWidth + 8) return;
            nudged[k] = true; io.observe(el);
          });
        }

        /* ---------- 2. 实验输出区太宽：移到画布下方 ---------- */
        /* 单步过程中会出现宽表格（最小宽度 420–685px）的实验：一开始就用“输出在画布下方”的布局，避免中途跳动；其余按实际宽度判断 */
        var WIDE = ["dijkstra", "infix", "cqueue", "btree", "hash", "bsearch", "sort2", "cache", "pipeline", "ieee754", "booth", "hamming", "addressing", "gantt", "disk", "partition", "prodcons", "subnet", "ipfrag", "lpm", "rip"];
        function visPanel() { return Array.prototype.filter.call(document.querySelectorAll("#x-lab .x-lab__panel"), function (p) { return !p.hidden; })[0]; }
        function tooWide(out) {
          if (!out || !out.clientWidth) return false;
          if (out.scrollWidth > out.clientWidth + 4) return true;
          return Array.prototype.some.call(out.querySelectorAll(".x-tbl, .x-pr-grids, [data-k]"), function (t) { return t.clientWidth && t.scrollWidth > t.clientWidth + 4; });
        }
        function unwide(p) {
          var out = p.querySelector(".x-lab__out"), side = p.querySelector(".x-lab__side"), note = p.querySelector(".x-lab__note");
          p.classList.remove("is-wideout");
          if (out && side && out.parentNode !== side) side.insertBefore(out, note && note.parentNode === side ? note : null);
        }
        /* 平板竖屏（768–1023）：画布下方分两列；输出表格较宽的实验（WIDE 名单或实际放不下）输出区仍整宽 */
        var tabMq = mm("(min-width: 768px) and (max-width: 1023px)");
        function tabCheck(p) {
          var on = tabMq.matches && !wideMq.matches;
          var id = p.id.replace(/^lab-/, "");
          p.classList.toggle("is-tab2", on);
          if (!on) { p.classList.remove("is-wide2"); return; }
          if (WIDE.indexOf(id) >= 0) p.classList.add("is-wide2");
          else if (!p.classList.contains("is-wide2") && tooWide(p.querySelector(".x-lab__out"))) p.classList.add("is-wide2");
        }
        function wideCheck() {
          var p = visPanel(); if (!p) return;
          tabCheck(p);
          compactCheck(p);
          if (!wideMq.matches) { if (p.classList.contains("is-wideout")) unwide(p); return; }
          if (p.classList.contains("is-wideout")) return;
          var out = p.querySelector(".x-lab__side .x-lab__out");
          if (WIDE.indexOf(p.id.replace(/^lab-/, "")) >= 0 || tooWide(out)) { p.classList.add("is-wideout"); p.appendChild(out); }
        }
        function resetWide() {
          Array.prototype.forEach.call(document.querySelectorAll("#x-lab .x-lab__panel.is-wideout"), unwide);
          Array.prototype.forEach.call(document.querySelectorAll("#x-lab .x-lab__panel.is-wide2"), function (p) { p.classList.remove("is-wide2"); });
          wideCheck();
        }
        if (tabMq.addEventListener) tabMq.addEventListener("change", resetWide);

        /* ---------- 2b. 横屏手机：实验选项收进“设置”按钮，点开从右侧滑出浮层 ---------- */
        var landMq = mm("(orientation: landscape) and (max-height: 500px)");
        var sheet = null;
        function sheetUi() {
          if (sheet) return sheet;
          var mask = document.createElement("div");
          mask.className = "x-sheet__mask"; mask.hidden = true;
          var box = document.createElement("div");
          box.className = "x-sheet"; box.hidden = true;
          box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "x-sheet-t");
          box.innerHTML = '<div class="x-sheet__head"><h3 class="x-sheet__t" id="x-sheet-t">实验设置</h3>' +
            '<button type="button" class="x-lab__btn x-lab__btn--ghost" data-s="close" aria-label="关闭">关闭</button></div>' +
            '<div class="x-sheet__body"></div>' +
            '<div class="x-sheet__foot"><button type="button" class="x-lab__btn x-lab__btn--main" data-s="apply">应用</button></div>';
          var host = document.getElementById("top") || document.body;
          host.appendChild(mask); host.appendChild(box);
          sheet = { box: box, mask: mask, body: box.querySelector(".x-sheet__body"), panel: null, opts: null, back: null };
          mask.addEventListener("click", function () { sheetClose(false); });
          box.addEventListener("click", function (e) {
            var b = e.target.closest("[data-s]"); if (!b) return;
            sheetClose(b.getAttribute("data-s") === "apply");
          });
          box.addEventListener("keydown", function (e) {
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); sheetClose(false); return; }
            if (e.key !== "Tab") return;
            var f = Array.prototype.filter.call(box.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (x) { return !x.disabled && x.offsetParent !== null; });
            if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
          });
          return sheet;
        }
        function sheetOpen(p, btn) {
          var S = sheetUi(), opts = p.querySelector(".x-lab__main > .x-lab__opts");
          if (!opts) return;
          var tab = document.getElementById(p.id.replace(/^lab-/, "tab-"));
          S.box.querySelector(".x-sheet__t").textContent = (tab ? tab.textContent : "实验") + " · 设置";
          S.panel = p; S.opts = opts; S.back = btn; S.home = opts.nextSibling;
          S.body.appendChild(opts);
          S.mask.hidden = false; S.box.hidden = false;
          document.documentElement.classList.add("x-sheet-open");
          void S.box.offsetWidth;
          S.box.classList.add("is-open"); S.mask.classList.add("is-open");
          var f = S.body.querySelector("input, select, textarea, button") || S.box.querySelector("[data-s=apply]");
          if (f) f.focus();
        }
        function sheetClose(apply) {
          var S = sheet; if (!S || S.box.hidden) return;
          var main = S.panel && S.panel.querySelector(".x-lab__main");
          if (main && S.opts) main.insertBefore(S.opts, main.firstChild);
          S.box.classList.remove("is-open"); S.mask.classList.remove("is-open");
          S.box.hidden = true; S.mask.hidden = true;
          document.documentElement.classList.remove("x-sheet-open");
          /* 输入框的修改多在 change 时生效；“应用”再重新生成一次动画 */
          if (apply && window.X_LAB_ACT) window.X_LAB_ACT("reset");
          if (S.back && S.back.isConnected) S.back.focus();
          S.panel = S.opts = null;
          soon();
        }
        function compactCheck(p) {
          var on = landMq.matches;
          var main = p.querySelector(".x-lab__main"); if (!main) return;
          var btn = main.querySelector(":scope > .x-setbtn");
          p.classList.toggle("is-compact", on);
          if (!on) { if (sheet && !sheet.box.hidden) sheetClose(false); if (btn) btn.hidden = true; return; }
          var opts = main.querySelector(":scope > .x-lab__opts");
          var has = opts && opts.children.length;
          if (!btn) {
            btn = document.createElement("button");
            btn.type = "button"; btn.className = "x-lab__btn x-setbtn"; btn.textContent = "设置";
            btn.setAttribute("aria-haspopup", "dialog");
            btn.addEventListener("click", function () { sheetOpen(p, btn); });
            main.appendChild(btn);
          }
          btn.hidden = !has;
        }
        if (landMq.addEventListener) landMq.addEventListener("change", function () { wideCheck(); });
        if (wideMq.addEventListener) wideMq.addEventListener("change", resetWide);
        var lastW = window.innerWidth;
        window.addEventListener("resize", function () {
          if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; resetWide(); }
          soon();
        }, { passive: true });

        /* ---------- 3. 键盘快捷键 ---------- */
        function inView(el) {
          if (!el || el.hidden || !el.getClientRects().length) return 0;
          var r = el.getBoundingClientRect(), H = window.innerHeight;
          return Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)) / Math.max(1, Math.min(r.height, H));
        }
        document.addEventListener("keydown", function (e) {
          if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
          var k = e.key, t = e.target || document.body, tag = t.tagName;
          var isSp = k === " " || k === "Spacebar", isR = k === "r" || k === "R";
          if (k !== "ArrowRight" && k !== "ArrowLeft" && !isSp && !isR) return;
          if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || t.isContentEditable) return;
          if (document.documentElement.classList.contains("x-zoom-open")) return;
          var interactive = tag === "BUTTON" || tag === "A" || tag === "SUMMARY" || tag === "LABEL";
          var ctx = null;
          if (t.closest && t.closest("#x-lab")) {
            if (t.closest('[role="tablist"]')) return; /* 标签行自己处理 ← → */
            ctx = "lab";
          } else if (t.closest && t.closest("#x-proc")) {
            return; /* 图解区域内由 11-proc-core.js 处理 */
          } else if (t === document.body || t === document.documentElement || !t.closest || !t.closest("button, a, summary, [tabindex]")) {
            var lv = inView(visPanel()), pv = inView(document.getElementById("x-proc-body"));
            if (Math.max(lv, pv) < 0.35) return;
            ctx = lv >= pv ? "lab" : "proc";
            interactive = false;
          }
          if (!ctx) return;
          if (isSp && interactive) return; /* 空格在按钮上保持原生“点击” */
          var ok = false;
          if (ctx === "lab" && window.X_LAB_ACT) ok = X_LAB_ACT(isR ? "reset" : k === "ArrowRight" ? "step" : k === "ArrowLeft" ? "back" : "play");
          if (ctx === "proc" && window.X_PROC_ACT) ok = X_PROC_ACT(isR ? "reset" : k === "ArrowRight" ? "next" : k === "ArrowLeft" ? "prev" : "play");
          if (ok) e.preventDefault();
        });

        /* ---------- 4. 过程图解“放大查看” ---------- */
        var Z = null;
        function zoomUi() {
          if (Z) return Z;
          var box = document.createElement("div");
          box.className = "x-zoom"; box.hidden = true;
          box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "放大查看图解");
          box.innerHTML = '<div class="x-zoom__bar"><span class="x-zoom__t"></span>' +
            '<button type="button" class="x-lab__btn" data-z="out" aria-label="缩小">−</button>' +
            '<button type="button" class="x-lab__btn" data-z="in" aria-label="放大">＋</button>' +
            '<button type="button" class="x-lab__btn" data-z="fit">适应</button>' +
            '<button type="button" class="x-lab__btn" data-z="prev">上一步</button>' +
            '<button type="button" class="x-lab__btn x-lab__btn--main" data-z="next">下一步</button>' +
            '<button type="button" class="x-lab__btn" data-z="close">关闭</button></div>' +
            '<div class="x-zoom__view"></div><div class="x-zoom__step" aria-live="polite"></div>';
          (document.getElementById("top") || document.body).appendChild(box);
          Z = { box: box, view: box.querySelector(".x-zoom__view"), step: box.querySelector(".x-zoom__step"), title: box.querySelector(".x-zoom__t"), s: 1, canvas: null, home: null, next: null, btn: null };
          box.addEventListener("click", function (e) {
            var b = e.target.closest("[data-z]"); if (!b) return;
            var a = b.getAttribute("data-z");
            if (a === "close") return zoomClose();
            if (a === "in") return zoomTo(Z.s * 1.25);
            if (a === "out") return zoomTo(Z.s / 1.25);
            if (a === "fit") return zoomTo(1);
            if (window.X_PROC_ACT) { X_PROC_ACT(a); zoomStep(); }
          });
          box.addEventListener("keydown", function (e) {
            if (e.key === "Escape") { e.preventDefault(); zoomClose(); }
            else if (e.key === "ArrowRight" && window.X_PROC_ACT) { e.preventDefault(); X_PROC_ACT("next"); zoomStep(); }
            else if (e.key === "ArrowLeft" && window.X_PROC_ACT) { e.preventDefault(); X_PROC_ACT("prev"); zoomStep(); }
            else if (e.key === "Tab") { /* 焦点留在对话框内 */
              var f = box.querySelectorAll("button"), first = f[0], last = f[f.length - 1];
              if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
              else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
          });
          /* 双指缩放 + 单指拖动（自己实现，避免浏览器把整页放大） */
          var pts = {}, start = null;
          var v = Z.view;
          v.style.touchAction = "none";
          v.addEventListener("pointerdown", function (e) { pts[e.pointerId] = { x: e.clientX, y: e.clientY }; try { v.setPointerCapture(e.pointerId); } catch (x) { void x; } start = null; });
          v.addEventListener("pointermove", function (e) {
            var p = pts[e.pointerId]; if (!p) return;
            var ids = Object.keys(pts);
            if (ids.length === 1) { v.scrollLeft -= e.clientX - p.x; v.scrollTop -= e.clientY - p.y; }
            else if (ids.length === 2) {
              var o = pts[ids[0] === String(e.pointerId) ? ids[1] : ids[0]];
              var d = Math.hypot(e.clientX - o.x, e.clientY - o.y) || 1;
              if (!start) start = { d: d, s: Z.s };
              var r = v.getBoundingClientRect();
              zoomTo(start.s * d / start.d, (e.clientX + o.x) / 2 - r.left, (e.clientY + o.y) / 2 - r.top);
            }
            p.x = e.clientX; p.y = e.clientY;
          });
          var up = function (e) { delete pts[e.pointerId]; start = null; };
          v.addEventListener("pointerup", up); v.addEventListener("pointercancel", up);
          v.addEventListener("wheel", function (e) { if (!e.ctrlKey) return; e.preventDefault(); var r = v.getBoundingClientRect(); zoomTo(Z.s * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
          return Z;
        }
        function zoomTo(s, fx, fy) {
          var svg = Z.canvas && Z.canvas.querySelector("svg"); if (!svg) return;
          var v = Z.view, old = Z.s;
          s = Math.max(1, Math.min(5, s));
          if (fx == null) { fx = v.clientWidth / 2; fy = v.clientHeight / 2; }
          var cx = (v.scrollLeft + fx) / old, cy = (v.scrollTop + fy) / old;
          Z.s = s;
          svg.style.width = Math.round(Z.fit * s) + "px";
          v.scrollLeft = cx * s - fx; v.scrollTop = cy * s - fy;
        }
        function zoomStep() {
          var body = document.getElementById("x-proc-body"); if (!body) return;
          var meta = body.querySelector(".x-proc__meta"), t = body.querySelector(".x-proc__t"), d = body.querySelector(".x-proc__d");
          Z.step.innerHTML = "";
          var b = document.createElement("b"); b.textContent = (meta ? meta.textContent + "　" : "") + (t ? t.textContent : "");
          var p = document.createElement("span"); p.textContent = d ? d.textContent : "";
          Z.step.appendChild(b); Z.step.appendChild(p);
          var prev = body.querySelector('[data-a="prev"]'), next = body.querySelector('[data-a="next"]'), ctrlHidden = body.querySelector(".x-proc__ctrl").hidden;
          Z.box.querySelector('[data-z="prev"]').disabled = ctrlHidden || !prev || prev.disabled;
          Z.box.querySelector('[data-z="next"]').disabled = ctrlHidden || !next || next.disabled;
        }
        function zoomOpen(canvas, btn) {
          zoomUi();
          var svg = canvas.querySelector("svg"); if (!svg) return;
          Z.canvas = canvas; Z.home = canvas.parentNode; Z.next = canvas.nextSibling; Z.btn = btn; Z.s = 1;
          var h = document.querySelector("#x-proc-body .x-proc__head h3");
          Z.title.textContent = h ? h.textContent : "过程图解";
          Z.box.hidden = false;
          document.documentElement.classList.add("x-zoom-open");
          Z.view.appendChild(canvas);
          var vb = (svg.getAttribute("viewBox") || "0 0 800 400").split(/\s+/).map(Number);
          /* 适应：整张图放进可视区（宽或高先到为准），再按需放大 */
          Z.fit = Math.max(200, Math.min(Z.view.clientWidth, Z.view.clientHeight * vb[2] / vb[3]));
          svg.style.width = Math.round(Z.fit) + "px";
          svg.style.height = "auto";
          zoomStep();
          Z.box.querySelector('[data-z="close"]').focus();
        }
        function zoomClose() {
          if (!Z || Z.box.hidden) return;
          var svg = Z.canvas && Z.canvas.querySelector("svg");
          if (svg) { svg.style.width = ""; svg.style.height = ""; }
          if (Z.canvas && Z.home && Z.home.isConnected) Z.home.insertBefore(Z.canvas, Z.next && Z.next.parentNode === Z.home ? Z.next : null);
          Z.box.hidden = true;
          document.documentElement.classList.remove("x-zoom-open");
          if (Z.btn && Z.btn.isConnected) Z.btn.focus();
          Z.canvas = null;
          soon();
        }
        function addZoomBtn() {
          var stage = document.querySelector("#x-proc-body .x-proc__stage"); if (!stage) return;
          var canvas = stage.querySelector(".x-proc__canvas");
          var btn = stage.querySelector(".x-zoombtn");
          if (!canvas) { if (btn) btn.hidden = true; return; }
          stage.style.position = "relative";
          if (!btn) {
            btn = document.createElement("button");
            btn.type = "button"; btn.className = "x-zoombtn"; btn.textContent = "放大查看";
            btn.addEventListener("click", function () { var c = stage.querySelector(".x-proc__canvas"); if (c) zoomOpen(c, btn); });
            stage.appendChild(btn);
          }
          btn.hidden = false;
          btn.style.top = (canvas.offsetTop + 8) + "px";
        }

        function init() {
          scan(); wideCheck(); addZoomBtn();
          var page = document.getElementById("top");
          if (page) page.addEventListener("click", function (e) {
            if (e.target.closest && e.target.closest(".x-zoom")) return;
            soon(); setTimeout(addZoomBtn, 80);
          });
          var ps = document.querySelector("#x-proc-body .x-proc__stage");
          if (ps && window.MutationObserver) new MutationObserver(function () { setTimeout(function () { addZoomBtn(); scan(); }, 0); }).observe(ps, { childList: true });
          if (document.fonts && document.fonts.ready) document.fonts.ready.then(soon);
          setTimeout(soon, 800);
        }
        if (window.__LEGACY_LOADER__) window.addEventListener("legacy:ready", function () { setTimeout(init, 30); });
        else setTimeout(init, 60);
      })();
