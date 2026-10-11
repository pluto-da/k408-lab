      /* 实验室工具栏：科目切换、搜索过滤、目录（手机上是下拉面板）；立体结构图与跨科连线立体图按需加载 */
      (function () {
        var $ = function (id) { return document.getElementById(id); };
        var tool = $("x-tool"), toc = $("x-toc"), tocBtn = $("x-tocbtn"), q = $("x-q"), sum = $("x-q-sum");
        if (!tool) return;
        var root = document.documentElement;
        var load = window.__LEGACY_LOAD__ || function () { return Promise.reject(new Error("按需加载不可用")); };

        /* ---------- 吸顶高度：锚点跳转时给工具栏留出位置 ---------- */
        function stickyH() {
          var top = parseFloat(getComputedStyle(tool).top) || 0;
          return Math.max(0, tool.offsetHeight + Math.min(0, top));
        }
        function syncH() { root.style.setProperty("--x-sticky", stickyH() + "px"); }
        syncH();
        window.addEventListener("resize", syncH, { passive: true });

        /* ---------- 目录（手机：下拉面板） ---------- */
        function setToc(open) {
          toc.classList.toggle("is-open", open);
          tocBtn.setAttribute("aria-expanded", open ? "true" : "false");
          if (open) {
            root.style.setProperty("--x-tool-bottom", Math.max(0, tool.getBoundingClientRect().bottom) + "px");
            var first = toc.querySelector("a"); if (first) first.focus();
          }
        }
        tocBtn.addEventListener("click", function () { setToc(!toc.classList.contains("is-open")); });
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape" && toc.classList.contains("is-open")) { setToc(false); tocBtn.focus(); }
        });
        document.addEventListener("click", function (e) {
          if (toc.classList.contains("is-open") && !toc.contains(e.target) && !tocBtn.contains(e.target)) setToc(false);
        });
        toc.addEventListener("click", function (e) {
          var a = e.target.closest("a"); if (!a) return;
          var lab = a.getAttribute("data-lab");
          if (lab && window.X_OPEN_LAB) { e.preventDefault(); window.X_OPEN_LAB(lab); }
          var pr = a.getAttribute("data-proc");
          if (pr && window.X_OPEN_PROC) { e.preventDefault(); window.X_OPEN_PROC(pr); if (window.X) X.go("proc"); }
          setToc(false);
        });

        /* ---------- 当前所在区块：工具栏与目录同步高亮 ---------- */
        var IDS = ["overview", "ds", "co", "os", "cn", "lab", "proc", "board", "links"];
        var secs = IDS.map(function (id) { return $(id); });
        var cur = null;
        function spy() {
          var line = stickyH() + 48, k = null;
          secs.forEach(function (s, i) { if (s && !s.hidden && s.getBoundingClientRect().top <= line) k = IDS[i]; });
          if (!k) k = "overview";
          if (k === cur) return;
          cur = k;
          Array.prototype.forEach.call(document.querySelectorAll(".x-chip, .x-toc > ol > li > a"), function (a) {
            if (a.getAttribute("href") === "#" + k) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
          });
        }
        var ticking = false;
        window.addEventListener("scroll", function () {
          if (ticking) return; ticking = true;
          requestAnimationFrame(function () { ticking = false; spy(); });
        }, { passive: true });
        spy();

        /* ---------- 搜索：按考点或实验名过滤，纯前端 ---------- */
        function plain(html) { return String(html || "").replace(/<[^>]+>/g, "").toLowerCase(); }
        var chapterText = {};
        Object.keys(window.X408 || {}).forEach(function (k) {
          chapterText[k] = (X408[k].chapters || []).map(function (c) {
            return plain(c.title + " " + (c.points || []).join(" ") + " " + c.trap + " " + (c.table ? JSON.stringify(c.table) : ""));
          });
        });
        function filter() {
          var term = q.value.trim().toLowerCase(), nCh = 0, nLab = 0, nLink = 0, nProc = 0;
          root.classList.toggle("is-searching", !!term);
          /* 章节 */
          Array.prototype.forEach.call(document.querySelectorAll(".x-subj"), function (sec) {
            var key = sec.id, lis = sec.querySelectorAll(".x-ch > li"), texts = chapterText[key] || [], shown = 0, curHidden = false, firstBtn = null;
            Array.prototype.forEach.call(lis, function (li, i) {
              var hit = !term || (texts[i] || li.textContent.toLowerCase()).indexOf(term) >= 0;
              li.hidden = !hit;
              var b = li.querySelector("button");
              if (hit) { shown++; if (!firstBtn) firstBtn = b; }
              else if (b && b.getAttribute("aria-pressed") === "true") curHidden = true;
            });
            if (curHidden && firstBtn) firstBtn.click();
            nCh += term ? shown : 0;
            sec.hidden = !!term && !shown; /* 没有匹配的科目整块收起，结果更集中 */
          });
          /* 实验 */
          var tabs = document.querySelectorAll("#x-lab .x-lab__tab"), lab = window.LAB || [], firstTab = null, selHidden = false;
          Array.prototype.forEach.call(tabs, function (t, i) {
            var d = lab[i] || {}, txt = (t.textContent + " " + (d.note || "")).toLowerCase();
            var hit = !term || txt.indexOf(term) >= 0;
            t.hidden = !hit;
            if (hit) { nLab++; if (!firstTab) firstTab = t; }
            else if (t.getAttribute("aria-selected") === "true") selHidden = true;
          });
          Array.prototype.forEach.call(document.querySelectorAll("#x-lab .x-lab__grp"), function (g) { g.hidden = !g.querySelector(".x-lab__tab:not([hidden])"); });
          if (selHidden && firstTab) firstTab.click();
          var labNone = !!term && !firstTab;
          $("lab").hidden = labNone;
          /* 过程图解 */
          var ptabs = document.querySelectorAll("#x-proc .x-proc__tab"), procs = window.PROC || [], firstP = null, pSelHidden = false;
          Array.prototype.forEach.call(ptabs, function (t) {
            var d = procs.filter(function (x) { return "ptab-" + x.id === t.id; })[0] || {};
            var txt = (t.textContent + " " + (d.lead || "") + " " + (d.note || []).join(" ")).toLowerCase();
            var hit = !term || txt.indexOf(term) >= 0;
            t.hidden = !hit;
            if (hit) { nProc++; if (!firstP) firstP = t; }
            else if (t.getAttribute("aria-selected") === "true") pSelHidden = true;
          });
          Array.prototype.forEach.call(document.querySelectorAll("#x-proc .x-proc__grp"), function (g) { g.hidden = !g.querySelector(".x-proc__tab:not([hidden])"); });
          if (pSelHidden && firstP) firstP.click();
          if ($("proc")) $("proc").hidden = !!term && !firstP;
          /* 跨科连线（文字版） */
          Array.prototype.forEach.call(document.querySelectorAll("#x-links .x-lgrp"), function (g) {
            var any = 0;
            Array.prototype.forEach.call(g.querySelectorAll("li"), function (li) {
              var hit = !term || li.textContent.toLowerCase().indexOf(term) >= 0;
              li.hidden = !hit; if (hit) any++;
            });
            g.hidden = !any; nLink += any;
          });
          $("links").hidden = !!term && !nLink;
          sum.textContent = term ? (nCh + nLab + nLink + nProc ? "找到 " + nCh + " 个章节 · " + (labNone ? 0 : nLab) + " 个实验 · " + nProc + " 个图解 · " + nLink + " 条连线" : "没有找到“" + q.value.trim() + "”，换个关键词试试") : "";
          spy();
        }
        var ft = null;
        q.addEventListener("input", function () { clearTimeout(ft); ft = setTimeout(filter, 120); });
        q.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault(); filter();
            var t = Array.prototype.filter.call(document.querySelectorAll(".x-subj, #lab, #proc, #links"), function (s) { return !s.hidden; })[0];
            if (t && window.X) X.go(t.id);
          }
        });

        /* ---------- 立体结构图：默认收起，点开才下载模型 ---------- */
        var tgl = $("x-3d-toggle"), body = $("x-3d-body"), busyEl = $("x-3d-load"), prog = $("x-3d-prog"), flows = $("xflows");
        var opened = false, loaded = null;
        function heroReady() {
          return new Promise(function (resolve) {
            var t0 = performance.now();
            (function wait() {
              var H = window.HERO, hero = $("hero");
              if ((H && H.ready) || (hero && hero.classList.contains("is-fallback")) || !H || performance.now() - t0 > 10000) return resolve();
              requestAnimationFrame(wait);
            })();
          });
        }
        function setOpen(on) {
          opened = on;
          body.hidden = !on;
          tgl.setAttribute("aria-expanded", on ? "true" : "false");
          tgl.textContent = on ? "收起立体图" : "展开立体图";
          if (on) window.dispatchEvent(new Event("resize"));
        }
        function openBoard() {
          if (!opened) setOpen(true);
          if (!loaded) {
            busyEl.hidden = false; prog.style.width = "4%";
            loaded = load("board", function (f) { prog.style.width = Math.round(4 + 96 * f) + "%"; })
              .then(heroReady)
              .then(function () { busyEl.hidden = true; window.dispatchEvent(new Event("resize")); })
              .catch(function (e) {
                if (window.console) console.error(e);
                loaded = null; busyEl.querySelector("p").textContent = "立体图没能加载出来，请检查网络后再点一次“展开立体图”。";
                prog.style.width = "0";
                setOpen(false); busyEl.hidden = false;
                throw e;
              });
          }
          return loaded;
        }
        function closeBoard() {
          if (window.FLOW && FLOW.on && FLOW.on()) FLOW.stop();
          var panel = $("xpanel"); if (panel && panel.classList.contains("is-on")) $("xp-back").click();
          setOpen(false);
        }
        tgl.addEventListener("click", function () {
          if (opened) closeBoard();
          else openBoard().catch(function () {});
        });
        /* 用户点“看演示”时：自动展开、加载，再开始演示 */
        flows.addEventListener("click", function (ev) {
          var b = ev.target.closest("button[data-flow]"); if (!b) return;
          if (window.FLOW && opened) return; /* 已加载：交给流程演示脚本自己处理 */
          var id = b.getAttribute("data-flow"), pending = !window.FLOW;
          var go = function () {
            if (pending && window.FLOW) FLOW.start(id);
            var hero = $("hero"); if (hero) hero.scrollIntoView({ behavior: window.X && X.reduced ? "auto" : "smooth", block: "center" });
          };
          if (!pending) { setOpen(true); go(); return; }
          openBoard().then(go, function () {});
        });
        window.X_BOARD = { open: openBoard, close: closeBoard, isOpen: function () { return opened; } };

        /* ---------- 跨科连线立体图：滚到附近再加载 ---------- */
        var links = $("links"), graphAsked = false;
        function askGraph() {
          if (graphAsked) return; graphAsked = true;
          load("graph").catch(function (e) { if (window.console) console.error(e); });
        }
        if (links && "IntersectionObserver" in window) {
          var io = new IntersectionObserver(function (es) {
            if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); askGraph(); }
          }, { rootMargin: "600px 0px" });
          io.observe(links);
        } else askGraph();

        /* ---------- 实验标签页搭好后：目录里列出全部实验 ---------- */
        function fillToc() {
          var ol = $("x-toc-labs"); if (!ol || ol.children.length) return;
          Array.prototype.forEach.call(document.querySelectorAll("#x-lab .x-lab__tab"), function (t) {
            var li = document.createElement("li"), a = document.createElement("a");
            a.href = "#lab"; a.textContent = t.textContent; a.setAttribute("data-lab", t.id.replace(/^tab-/, ""));
            li.appendChild(a); ol.appendChild(li);
          });
        }
        function fillProcToc() {
          var ol = $("x-toc-procs"); if (!ol || ol.children.length) return;
          Array.prototype.forEach.call(document.querySelectorAll("#x-proc .x-proc__tab"), function (t) {
            var li = document.createElement("li"), a = document.createElement("a");
            a.href = "#proc"; a.textContent = t.textContent; a.setAttribute("data-proc", t.id.replace(/^ptab-/, ""));
            li.appendChild(a); ol.appendChild(li);
          });
        }
        if (window.__LEGACY_LOADER__) window.addEventListener("legacy:ready", function () { setTimeout(function () { fillToc(); fillProcToc(); }, 0); });
        else setTimeout(function () { fillToc(); fillProcToc(); }, 0);
      })();
