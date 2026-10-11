      /* 实验室目录：可折叠分组（“下拉式”）。
         顶层组：概览 / 四门课（展开为章节）/ 动画实验 · 过程图解 · 性质与公式（展开为按课程分的二级组）/ 3D 主板 / 知识图谱。
         window.TOCU 是不碰 DOM 的纯状态函数（单元测试直接调用）；DOM 层只根据状态渲染 aria-expanded、hidden / inert 与高亮。
         联动：各模块切换条目时派发 document 上的 CustomEvent("x:active", { detail: { kind, id, user } })，
         kind = "lab" | "proc" | "prop" | "ch"（章节 id 为 "ds:2"）；09-tool.js 的区块侦测派发 "x:section"。 */
      (function () {
        var COURSES = ["ds", "co", "os", "cn"];
        var COURSE_NAME = { ds: "数据结构", co: "组成原理", os: "操作系统", cn: "计算机网络" };
        var TOP = ["overview", "ds", "co", "os", "cn", "lab", "proc", "prop", "board", "links"];
        var KINDS = ["lab", "proc", "prop"];
        var KEY = "x408.toc.open";

        /* ---------- 纯函数 ---------- */
        var SUBS = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
          "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
          "₊": "+", "₋": "-", "⁺": "+", "⁻": "-", "−": "-", "–": "-", "ᵢ": "i", "ⁱ": "i", "ₙ": "n", "ⁿ": "n", "ₖ": "k", "ₘ": "m", "ₓ": "x", "×": "x" };
        /* 归一化：大小写、全角、上下标、空白不敏感 */
        function norm(s) {
          return String(s == null ? "" : s)
            .replace(/[\uFF01-\uFF5E]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
            .replace(/[₀-₉⁰-⁹₊₋⁺⁻−–ᵢⁱₙⁿₖₘₓ×]/g, function (c) { return SUBS[c] || c; })
            .toLowerCase()
            .replace(/\s+/g, "");
        }
        function uniq(a) { var o = []; (a || []).forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o; }
        /* 某条目所属的组：[顶层组, 二级组]；章节只有顶层（课程）组 */
        function groupsOf(item) {
          if (!item) return [];
          if (item.kind === "ch") return [item.course || String(item.id).split(":")[0]];
          if (KINDS.indexOf(item.kind) >= 0) return item.course ? [item.kind, item.kind + ":" + item.course] : [item.kind];
          return [];
        }
        function toggle(open, id) {
          open = uniq(open);
          var i = open.indexOf(id);
          if (i >= 0) open.splice(i, 1); else open.push(id);
          return open;
        }
        /* 返回包含 active 所属顶层组与二级组的新集合；active 没有 course 时到 items 里查 */
        function ensureOpenFor(open, active, items) {
          open = uniq(open);
          if (!active) return open;
          var it = active;
          if (!it.course && it.kind !== "ch" && items) {
            it = items.filter(function (x) { return x.kind === active.kind && x.id === active.id; })[0] || active;
          }
          groupsOf(it).forEach(function (g) { if (open.indexOf(g) < 0) open.push(g); });
          return open;
        }
        /* 筛选：返回匹配条目、需要展开的组（含二级组）、有匹配的顶层组 */
        function matchItems(items, filter, labels) {
          var t = norm(filter);
          if (!t) return { items: (items || []).slice(), open: [], groups: [], active: false };
          var hit = (items || []).filter(function (x) { return norm(x.label).indexOf(t) >= 0 || (x.full && norm(x.full).indexOf(t) >= 0); });
          var open = [], groups = [];
          hit.forEach(function (x) {
            groupsOf(x).forEach(function (g) { if (open.indexOf(g) < 0) open.push(g); });
          });
          open.forEach(function (g) { if (g.indexOf(":") < 0 && groups.indexOf(g) < 0) groups.push(g); });
          /* 顶层组名本身匹配（如“主板”“图谱”）：显示该组，但不展开 */
          Object.keys(labels || {}).forEach(function (g) { if (norm(labels[g]).indexOf(t) >= 0 && groups.indexOf(g) < 0) groups.push(g); });
          return { items: hit, open: open, groups: groups, active: true };
        }
        function serialize(open) {
          return JSON.stringify(uniq(open).filter(function (x) { return typeof x === "string"; }));
        }
        /* 解析失败、类型不对返回空集合；给了 valid 时丢掉已不存在的组 id */
        function parse(str, valid) {
          var a;
          try { a = JSON.parse(str); } catch (e) { return []; }
          if (!Array.isArray(a)) return [];
          a = uniq(a.filter(function (x) { return typeof x === "string" && x.length < 64; }));
          return valid ? a.filter(function (x) { return valid.indexOf(x) >= 0; }) : a;
        }
        /* 区块侦测联动：收起之前自动展开、用户没碰过的组，展开当前区块需要的组（不收起用户自己展开的组） */
        function follow(state, need) {
          var auto = uniq(state.auto), open = uniq(state.open), na = [];
          need = uniq(need);
          open = open.filter(function (g) { return auto.indexOf(g) < 0 || need.indexOf(g) >= 0; });
          need.forEach(function (g) {
            if (open.indexOf(g) < 0) { open.push(g); na.push(g); }
            else if (auto.indexOf(g) >= 0) na.push(g);
          });
          return { open: open, auto: na, pin: uniq(state.pin) };
        }
        /* 用户手动切换：从“自动展开”里拿掉，记入持久状态 */
        function manual(state, id) {
          var not = function (g) { return g !== id; };
          return { open: toggle(state.open, id), auto: uniq(state.auto).filter(not), pin: uniq(state.pin).filter(not) };
        }
        /* 写入 localStorage 的只有用户手动展开的组：去掉自动展开（auto）与锚点展开（pin） */
        function persisted(state) {
          var skip = uniq(state.auto).concat(uniq(state.pin));
          return uniq(state.open).filter(function (g) { return skip.indexOf(g) < 0; });
        }
        /* 锚点：#prop-<id> / #lab-<id> / #proc-<id> → active */
        function fromHash(hash) {
          var h = String(hash || "").replace(/^#/, ""), m;
          try { h = decodeURIComponent(h); } catch (e) { /* 原样 */ }
          if ((m = /^(lab|proc|prop)-(.+)$/.exec(h))) return { kind: m[1], id: m[2] };
          return null;
        }
        /* 实验课程：颜色变量 var(--x-ds) → ds */
        function courseOfColor(c) {
          var m = /--x-(ds|co|os|cn)\b/.exec(String(c || ""));
          return m ? m[1] : null;
        }

        var U = window.TOCU = {
          COURSES: COURSES, TOP: TOP, KEY: KEY, norm: norm, groupsOf: groupsOf, toggle: toggle, ensureOpenFor: ensureOpenFor,
          matchItems: matchItems, serialize: serialize, parse: parse, follow: follow, manual: manual, persisted: persisted,
          fromHash: fromHash, courseOfColor: courseOfColor
        };
        if (typeof document === "undefined") return;

        /* ---------- DOM ---------- */
        var toc = document.getElementById("x-toc");
        if (!toc) return;
        var root = document.documentElement;
        var reduced = function () { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); };
        var DUR = 200;
        var TOP_LABEL = { overview: "概览", ds: "数据结构", co: "组成原理", os: "操作系统", cn: "计算机网络", lab: "动画实验", proc: "过程图解", prop: "性质与公式", board: "3D 主板", links: "知识图谱" };

        var state = { open: [], auto: [], pin: [] }, filterOpen = [], filterTerm = "";
        var items = [], byKey = {}, groupsEl = {}, built = false, section = null, pending = null;
        var cur = {}; /* kind（章节为 "ch:ds"）→ 当前条目 id */
        var lastUser = null; /* 最近一次由用户或锚点激活的条目：面板打开时优先滚到它 */

        function load() {
          try { return parse(window.localStorage.getItem(KEY)); } catch (e) { return []; }
        }
        function save() {
          try { window.localStorage.setItem(KEY, serialize(persisted(state))); } catch (e) { /* 隐私模式：静默忽略 */ }
        }
        function el(tag, attrs, text) {
          var n = document.createElement(tag);
          for (var k in attrs || {}) n.setAttribute(k, attrs[k]);
          if (text != null) n.textContent = text;
          return n;
        }
        function badge(n) {
          var b = el("span", { class: "x-toc__n" });
          b.appendChild(el("span", { "aria-hidden": "true" }, String(n)));
          b.appendChild(el("span", { class: "x-vh" }, n + " 项"));
          return b;
        }
        function chev() { return el("span", { class: "x-toc__chev", "aria-hidden": "true" }); }
        function wrapText(a) {
          /* 把链接里的文字包进 span，单行省略 */
          if (a.querySelector(".x-toc__t")) return;
          var t = el("span", { class: "x-toc__t" });
          Array.prototype.slice.call(a.childNodes).forEach(function (n) { if (n.nodeType === 3 || (n.nodeType === 1 && n.tagName !== "I")) t.appendChild(n); });
          a.appendChild(t);
          a.title = t.textContent.trim();
        }
        function key(kind, id) { return kind + "|" + id; }

        /* 收集条目：标签页文字 + 注册数据里的课程 */
        function collect() {
          var out = [];
          var LAB = window.LAB || [];
          Array.prototype.forEach.call(document.querySelectorAll("#x-lab .x-lab__tab"), function (t) {
            var id = t.id.replace(/^tab-/, ""), d = LAB.filter(function (x) { return x.id === id; })[0];
            var c = courseOfColor(d && d.color) || courseOfColor(t.getAttribute("style"));
            out.push({ kind: "lab", id: id, course: c, label: (d && d.toc) || t.textContent.trim(), full: t.textContent.trim() });
          });
          var PROC = window.PROC || [];
          Array.prototype.forEach.call(document.querySelectorAll("#x-proc .x-proc__tab"), function (t) {
            var id = t.id.replace(/^ptab-/, ""), d = PROC.filter(function (x) { return x.id === id; })[0];
            out.push({ kind: "proc", id: id, course: (d && d.sub) || courseOfColor(t.getAttribute("style")), label: (d && d.toc) || t.textContent.trim(), full: t.textContent.trim() });
          });
          var PROP = window.PROP || [];
          Array.prototype.forEach.call(document.querySelectorAll("#x-prop .x-prop__item"), function (t) {
            var id = t.getAttribute("data-id"), d = PROP.filter(function (x) { return x.id === id; })[0];
            var tin = t.querySelector(".x-prop__in"), full = (d && d.name) || (tin ? tin.textContent : t.textContent).trim();
            out.push({ kind: "prop", id: id, course: (d && d.sub) || courseOfColor(t.getAttribute("style")), label: (d && (d.toc || d.short)) || full, full: full });
          });
          COURSES.forEach(function (c) {
            var s = window.X408 && window.X408[c];
            ((s && s.chapters) || []).forEach(function (ch, i) {
              out.push({ kind: "ch", id: c + ":" + i, course: c, label: String(ch.title).replace(/<[^>]+>/g, ""), no: ch.no });
            });
          });
          return out;
        }

        /* 一个可折叠区：wrap（grid 0fr ↔ 1fr）> ol */
        function makeWrap(id, ol) {
          var w = el("div", { class: "x-toc__wrap", id: id });
          ol.classList.add("x-toc__list");
          ol.setAttribute("role", "list");
          w.appendChild(ol);
          return w;
        }
        function topToggle(g, n) {
          var b = el("button", { type: "button", class: "x-toc__tg", "aria-expanded": "false", "aria-controls": "x-toc-w-" + g, "data-g": g });
          b.appendChild(badge(n));
          b.appendChild(chev());
          b.appendChild(el("span", { class: "x-vh x-toc__say" }, "展开" + TOP_LABEL[g]));
          return b;
        }

        function build() {
          if (built) return;
          var rootOl = toc.querySelector(":scope > ol");
          if (!rootOl) return;
          built = true;
          items = collect();
          items.forEach(function (x) { byKey[key(x.kind, x.id)] = x; });
          toc.classList.add("x-toc--grp");
          rootOl.classList.add("x-toc__root");

          /* 顶栏：跳到区块 / 筛选目录 / 全部收起 */
          var bar = el("div", { class: "x-toc__bar" });
          var jump = el("button", { type: "button", class: "x-toc__jump", "aria-haspopup": "menu", "aria-expanded": "false", "aria-controls": "x-toc-menu", title: "跳到区块" });
          jump.appendChild(el("span", { class: "x-vh" }, "跳到区块"));
          var menu = el("div", { class: "x-toc__menu", id: "x-toc-menu", role: "menu", "aria-label": "跳到区块", hidden: "" });
          TOP.forEach(function (g) {
            var a = el("a", { href: "#" + g, role: "menuitem", tabindex: "-1", "data-g": g }, TOP_LABEL[g]);
            menu.appendChild(a);
          });
          var lab = el("label", { class: "x-toc__qw" });
          lab.appendChild(el("span", { class: "x-vh" }, "筛选目录"));
          var q = el("input", { type: "search", class: "x-toc__q", placeholder: "筛选目录", autocomplete: "off", enterkeyhint: "search" });
          lab.appendChild(q);
          var all = el("button", { type: "button", class: "x-toc__all" }, "全部收起");
          bar.appendChild(jump); bar.appendChild(lab); bar.appendChild(all); bar.appendChild(menu);
          toc.insertBefore(bar, rootOl);
          var empty = el("p", { class: "x-toc__empty", hidden: "" });
          empty.appendChild(el("span", {}, "没有匹配的条目"));
          var clr = el("button", { type: "button", class: "x-toc__clr" }, "清空筛选");
          empty.appendChild(clr);
          toc.insertBefore(empty, rootOl.nextSibling);

          /* 顶层组 */
          Array.prototype.forEach.call(rootOl.children, function (li) {
            var a = li.querySelector(":scope > a"); if (!a) return;
            var g = (a.getAttribute("href") || "").slice(1);
            if (TOP.indexOf(g) < 0) return;
            li.classList.add("x-toc__g");
            li.setAttribute("data-g", g);
            wrapText(a);
            var t = a.querySelector(".x-toc__t"); if (t && TOP_LABEL[g]) { t.textContent = TOP_LABEL[g]; a.title = TOP_LABEL[g]; }
            groupsEl[g] = { li: li, a: a };
            var ol = li.querySelector(":scope > ol");
            if (COURSES.indexOf(g) >= 0) {
              var chs = items.filter(function (x) { return x.kind === "ch" && x.course === g; });
              if (!chs.length) return;
              ol = ol || el("ol");
              ol.id = ol.id || "x-toc-ch-" + g;
              ol.classList.add("x-toc__sub");
              chs.forEach(function (x) { ol.appendChild(leaf(x, "#" + g)); });
              mountGroup(li, g, ol, chs.length);
            } else if (KINDS.indexOf(g) >= 0 && ol) {
              var list = items.filter(function (x) { return x.kind === g; });
              if (!list.length) { li.classList.add("x-toc__g--leaf"); return; }
              ol.textContent = "";
              ol.classList.add("x-toc__sub");
              COURSES.concat([null]).forEach(function (c) {
                var sub = list.filter(function (x) { return (x.course || null) === c || (!c && COURSES.indexOf(x.course) < 0); });
                if (!sub.length) return;
                var sid = g + ":" + (c || "other");
                var sli = el("li", { class: "x-toc__sg", "data-g": sid });
                var sh = el("button", { type: "button", class: "x-toc__sh", "aria-expanded": "false", "aria-controls": "x-toc-w-" + sid.replace(":", "-"), "data-g": sid });
                sh.appendChild(el("span", { class: "x-vh x-toc__say" }, "展开"));
                if (c) sh.appendChild(el("i", { class: "x-dot", style: "--c: var(--x-" + c + ")", "aria-hidden": "true" }));
                sh.appendChild(el("span", { class: "x-toc__t" }, c ? COURSE_NAME[c] : "其他"));
                sh.appendChild(badge(sub.length));
                sh.appendChild(chev());
                sli.appendChild(sh);
                var iol = el("ol", { class: "x-toc__items" });
                sub.forEach(function (x) { iol.appendChild(leaf(x, g === "prop" ? "#prop-" + x.id : "#" + g)); });
                var w = makeWrap("x-toc-w-" + sid.replace(":", "-"), iol);
                sli.appendChild(w);
                ol.appendChild(sli);
                groupsEl[sid] = { li: sli, btn: sh, wrap: w, sub: true };
                setOpenDom(sid, false, true);
              });
              mountGroup(li, g, ol, list.length);
            } else {
              li.classList.add("x-toc__g--leaf");
            }
          });

          /* 初始状态：已保存的手动展开 + 当前区块 + 锚点 */
          var valid = Object.keys(groupsEl);
          state = { open: parse(serialize(load()), valid), auto: [], pin: [] };
          COURSES.forEach(function (c) {
            var b = document.querySelector("#" + c + " .x-ch button[aria-pressed=\"true\"]");
            if (b) cur["ch:" + c] = c + ":" + chIndex(b);
          });
          KINDS.forEach(function (k) { if (cur[k] == null) cur[k] = currentFromPage(k); });
          var curA = toc.querySelector(".x-toc__root > li > a[aria-current=\"true\"]");
          if (curA) section = curA.getAttribute("href").slice(1);
          if (section) state = follow(state, needFor(section));
          var h = fromHash(location.hash);
          if (h && byKey[key(h.kind, h.id)]) { cur[h.kind] = h.id; pending = h; }
          if (pending && !byKey[key(pending.kind, pending.id)]) pending = null;
          /* 锚点展开的组（pin）：区块侦测不会收回它们，也不写入 localStorage */
          if (pending) {
            lastUser = byKey[key(pending.kind, pending.id)];
            var px = byKey[key(pending.kind, pending.id)], before = state.open;
            state.open = ensureOpenFor(state.open, px);
            state.pin = state.open.filter(function (g) { return before.indexOf(g) < 0; });
          }
          renderAll(true);
          markActive();
          /* 小屏：筛选框收成放大镜按钮，点开后展开 */
          var qbtn = el("button", { type: "button", class: "x-toc__qbtn", "aria-label": "筛选目录", "aria-expanded": "false" });
          bar.insertBefore(qbtn, lab);
          qbtn.addEventListener("click", function () {
            var on = !bar.classList.contains("is-q");
            bar.classList.toggle("is-q", on);
            qbtn.setAttribute("aria-expanded", on ? "true" : "false");
            if (on) q.focus(); else if (q.value) { q.value = ""; setFilter(""); }
          });
          var cmq = compactMq();
          if (cmq) {
            setCompact(cmq.matches);
            var onMq = function () { setCompact(cmq.matches); };
            if (cmq.addEventListener) cmq.addEventListener("change", onMq); else if (cmq.addListener) cmq.addListener(onMq);
          }
          if (pending) reveal(byKey[key(pending.kind, pending.id)], true);
          pending = null;

          /* ---------- 交互 ---------- */
          toc.addEventListener("click", function (e) {
            var b = e.target.closest(".x-toc__tg, .x-toc__sh");
            if (b && toc.contains(b)) { e.preventDefault(); userToggle(b.getAttribute("data-g")); return; }
            var a = e.target.closest("a");
            if (!a || !toc.contains(a)) return;
            if (a.closest(".x-toc__menu")) closeMenu(false);
            var g = a.getAttribute("data-g") || (a.parentNode && a.parentNode.classList.contains("x-toc__g") ? a.parentNode.getAttribute("data-g") : null);
            /* 点组标题文字：跳转并展开（手动展开，记住） */
            if (g && groupsEl[g] && groupsEl[g].btn && !isOpen(g)) { if (filterTerm) filterOpen = toggle(filterOpen, g); else { state = manual(state, g); save(); } renderAll(false); }
          });
          toc.addEventListener("keydown", function (e) {
            var t = e.target;
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            if (t.tagName === "INPUT") return;
            var g = t.getAttribute("data-g") || (t.parentNode && t.parentNode.getAttribute && t.parentNode.getAttribute("data-g"));
            if (!g || !groupsEl[g] || !groupsEl[g].btn || t.closest(".x-toc__menu")) return;
            var want = e.key === "ArrowRight";
            if (want !== isOpen(g)) { e.preventDefault(); userToggle(g); }
          });
          all.addEventListener("click", function () {
            state = { open: [], auto: [], pin: [] }; filterOpen = []; save(); renderAll(false);
          });
          var ft = null;
          q.addEventListener("input", function () { clearTimeout(ft); ft = setTimeout(function () { setFilter(q.value); }, 80); });
          q.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && q.value) { e.preventDefault(); e.stopPropagation(); q.value = ""; setFilter(""); }
            if (e.key === "Enter") e.preventDefault();
          });
          clr.addEventListener("click", function () { q.value = ""; setFilter(""); q.focus(); });

          /* 跳到区块菜单：自定义弹出层，上下键选择，Esc 关闭 */
          function menuItems() { return Array.prototype.slice.call(menu.querySelectorAll("a")).filter(function (a) { return !a.hidden; }); }
          function openMenu() {
            Array.prototype.forEach.call(menu.querySelectorAll("a"), function (a) {
              var ge = groupsEl[a.getAttribute("data-g")];
              a.hidden = !ge || ge.li.hidden && !filterTerm;
              if (a.getAttribute("data-g") === section) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
            });
            menu.hidden = false; jump.setAttribute("aria-expanded", "true");
            var f = menu.querySelector("a[aria-current]:not([hidden])") || menuItems()[0]; if (f) f.focus();
          }
          function closeMenu(focus) {
            if (menu.hidden) return;
            menu.hidden = true; jump.setAttribute("aria-expanded", "false");
            if (focus) jump.focus();
          }
          jump.addEventListener("click", function (e) { e.stopPropagation(); if (menu.hidden) openMenu(); else closeMenu(true); });
          menu.addEventListener("keydown", function (e) {
            var list = menuItems(), i = list.indexOf(document.activeElement);
            if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); i = (i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length; list[i].focus(); }
            else if (e.key === "Home") { e.preventDefault(); list[0].focus(); }
            else if (e.key === "End") { e.preventDefault(); list[list.length - 1].focus(); }
            else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
            else if (e.key === "Tab") closeMenu(false);
          });
          document.addEventListener("click", function (e) { if (!menu.hidden && !menu.contains(e.target) && e.target !== jump) closeMenu(false); });

          /* 区块被搜索隐藏时，目录组也隐藏 */
          if ("MutationObserver" in window) {
            var mo = new MutationObserver(syncHidden);
            TOP.forEach(function (g) { var s = document.getElementById(g); if (s) mo.observe(s, { attributes: true, attributeFilter: ["hidden"] }); });
          }
          syncHidden();
          window.addEventListener("hashchange", function () {
            var h2 = fromHash(location.hash);
            if (h2 && byKey[key(h2.kind, h2.id)]) { cur[h2.kind] = h2.id; activate(byKey[key(h2.kind, h2.id)], true); }
          });
        }

        function chIndex(b) {
          var li = b.closest("li"), ol = li && li.parentNode;
          return ol ? Array.prototype.indexOf.call(ol.children, li) : 0;
        }
        function currentFromPage(k) {
          var s = k === "lab" ? "#x-lab .x-lab__tab[aria-selected=\"true\"]" : k === "proc" ? "#x-proc .x-proc__tab[aria-selected=\"true\"]" : "#x-prop .x-prop__item[aria-selected=\"true\"]";
          var t = document.querySelector(s);
          if (!t) return null;
          return k === "prop" ? t.getAttribute("data-id") : t.id.replace(/^p?tab-/, "");
        }
        function leaf(x, href) {
          var li = el("li");
          var a = el("a", { href: href, title: x.full || x.label, "data-k": x.kind });
          if (x.kind === "ch") a.setAttribute("data-ch", x.id);
          else a.setAttribute("data-" + x.kind, x.id);
          if (x.kind === "ch") a.appendChild(el("span", { class: "x-toc__no", "aria-hidden": "true" }, (x.no < 10 ? "0" : "") + x.no));
          a.appendChild(el("span", { class: "x-toc__t" }, x.label));
          li.appendChild(a);
          x.a = a;
          return li;
        }
        function mountGroup(li, g, ol, n) {
          var btn = topToggle(g, n);
          li.insertBefore(btn, ol);
          var w = makeWrap("x-toc-w-" + g, ol);
          li.appendChild(w);
          groupsEl[g].btn = btn; groupsEl[g].wrap = w;
          setOpenDom(g, false, true);
        }
        function isOpen(g) { return (filterTerm ? filterOpen : state.open).indexOf(g) >= 0; }
        function userToggle(g) {
          if (filterTerm) filterOpen = toggle(filterOpen, g);
          else { state = manual(state, g); save(); }
          renderAll(false);
        }
        /* 渲染一个组的展开状态：动画结束后再 hidden，展开时先去掉 hidden 再过渡 */
        function setOpenDom(g, on, instant) {
          var ge = groupsEl[g]; if (!ge || !ge.wrap) return;
          var w = ge.wrap, btn = ge.btn;
          if (btn.getAttribute("aria-expanded") === (on ? "true" : "false") && !instant) return;
          btn.setAttribute("aria-expanded", on ? "true" : "false");
          var say = btn.querySelector(".x-toc__say");
          if (say) say.textContent = (on ? "收起" : "展开") + (ge.sub ? "" : TOP_LABEL[g] || "");
          ge.li.classList.toggle("is-open", on);
          clearTimeout(w._t);
          var still = instant || reduced() || !toc.offsetParent && getComputedStyle(toc).position !== "fixed";
          if (on) {
            w.hidden = false; w.removeAttribute("inert");
            if (still) { w.classList.add("is-open"); return; }
            void w.offsetHeight;
            w.classList.add("is-open");
          } else {
            w.setAttribute("inert", "");
            w.classList.remove("is-open");
            if (still) { w.hidden = true; return; }
            w._t = setTimeout(function () { if (!w.classList.contains("is-open")) w.hidden = true; }, DUR + 40);
          }
        }
        var lastMatch = null;
        function renderAll(instant) {
          var open = filterTerm ? filterOpen : state.open;
          Object.keys(groupsEl).forEach(function (g) { if (groupsEl[g].wrap) setOpenDom(g, open.indexOf(g) >= 0, instant); });
          /* 筛选：隐藏不匹配的条目、二级组、顶层组 */
          var m = lastMatch;
          items.forEach(function (x) { if (x.a) x.a.parentNode.hidden = !!(m && m.active && m.items.indexOf(x) < 0); });
          Object.keys(groupsEl).forEach(function (g) {
            var ge = groupsEl[g];
            var hideByFilter = !!(m && m.active) && (ge.sub ? m.open.indexOf(g) < 0 : m.groups.indexOf(g) < 0);
            ge.filtered = hideByFilter;
            ge.li.hidden = hideByFilter || !!ge.secHidden;
          });
          var empty = toc.querySelector(".x-toc__empty");
          if (empty) empty.hidden = !(m && m.active && !m.items.length && !m.groups.length);
          toc.classList.toggle("is-filtering", !!filterTerm);
          syncSupers(instant);
        }

        /* ---------- 小屏（320 宽、横屏手机）：收起状态一屏放下 ----------
           四门课合成“四门课”组、3D 主板与知识图谱合成“更多”组，筛选框收成放大镜按钮；其他尺寸不变。
           合并组只在 DOM 层包一层，不进入持久化状态；其中任一子组展开或有筛选结果时自动展开。 */
        var COMPACT_Q = "(max-width: 340px), (orientation: landscape) and (max-height: 500px)";
        var SUPERS = [["courses", "四门课", COURSES], ["more", "更多", ["board", "links"]]];
        var supers = {}, superOpen = {}, compactOn = false;
        function compactMq() { return window.matchMedia ? window.matchMedia(COMPACT_Q) : null; }
        function setCompact(on) {
          if (on === compactOn || !built) return;
          compactOn = on;
          var rootOl = toc.querySelector(".x-toc__root"), bar = toc.querySelector(".x-toc__bar");
          toc.classList.toggle("x-toc--compact", on);
          if (bar) bar.classList.remove("is-q");
          SUPERS.forEach(function (sp) {
            var id = sp[0], kids = sp[2].map(function (g) { return groupsEl[g] && groupsEl[g].li; }).filter(Boolean);
            if (!kids.length) return;
            if (on) {
              var li = el("li", { class: "x-toc__g x-toc__g--sup", "data-sup": id });
              var b = el("button", { type: "button", class: "x-toc__sup", "aria-expanded": "false", "aria-controls": "x-toc-sup-" + id });
              b.appendChild(el("span", { class: "x-toc__t" }, sp[1]));
              b.appendChild(badge(kids.length));
              b.appendChild(chev());
              var ol = el("ol", { class: "x-toc__supl", role: "list" });
              var w = el("div", { class: "x-toc__wrap", id: "x-toc-sup-" + id, hidden: "" });
              w.appendChild(ol);
              rootOl.insertBefore(li, kids[0]);
              kids.forEach(function (k) { ol.appendChild(k); });
              li.appendChild(b); li.appendChild(w);
              b.addEventListener("click", function () {
                var want = b.getAttribute("aria-expanded") !== "true";
                superOpen[id] = want;
                /* 收起合并组时一并收起其中展开的子组，否则子组会让它立刻重新展开 */
                if (!want && !filterTerm) { kids.forEach(function (k) { var g = k.getAttribute("data-g"); if (state.open.indexOf(g) >= 0) state = manual(state, g); }); save(); renderAll(false); }
                else syncSupers(false);
              });
              supers[id] = { li: li, btn: b, wrap: w, kids: kids };
            } else if (supers[id]) {
              var sl = supers[id].li;
              supers[id].kids.forEach(function (k) { rootOl.insertBefore(k, sl); });
              sl.parentNode.removeChild(sl);
              delete supers[id];
            }
          });
          syncSupers(true);
        }
        function syncSupers(instant) {
          Object.keys(supers).forEach(function (id) {
            var sp = supers[id], open = filterTerm ? filterOpen : state.open;
            var shown = sp.kids.filter(function (k) { return !k.hidden; });
            sp.li.hidden = !shown.length;
            var childOpen = sp.kids.some(function (k) { return open.indexOf(k.getAttribute("data-g")) >= 0; });
            var on = filterTerm ? shown.length > 0 : !!superOpen[id] || childOpen;
            sp.btn.setAttribute("aria-expanded", on ? "true" : "false");
            sp.li.classList.toggle("is-open", on);
            if (on) { sp.wrap.hidden = false; sp.wrap.removeAttribute("inert"); if (instant || reduced()) sp.wrap.classList.add("is-open"); else { void sp.wrap.offsetHeight; sp.wrap.classList.add("is-open"); } }
            else { sp.wrap.setAttribute("inert", ""); sp.wrap.classList.remove("is-open"); sp.wrap.hidden = true; }
          });
        }
        function setFilter(v) {
          var t = String(v || "").trim();
          if (t === filterTerm) return;
          filterTerm = t;
          var labels = {}; Object.keys(groupsEl).forEach(function (g) { if (!groupsEl[g].sub) labels[g] = TOP_LABEL[g]; });
          lastMatch = t ? matchItems(items, t, labels) : null;
          filterOpen = lastMatch ? lastMatch.open.slice() : [];
          renderAll(true);
          toc.scrollTop = 0;
        }
        function syncHidden() {
          TOP.forEach(function (g) {
            var ge = groupsEl[g], s = document.getElementById(g);
            if (!ge) return;
            ge.secHidden = !!(s && s.hidden);
            ge.li.hidden = ge.secHidden || !!ge.filtered;
          });
        }
        function needFor(sec) {
          var need = [];
          if (!groupsEl[sec] || !groupsEl[sec].wrap) return need;
          need.push(sec);
          if (KINDS.indexOf(sec) >= 0 && cur[sec] != null) {
            var x = byKey[key(sec, cur[sec])];
            if (x) need = ensureOpenFor(need, x);
          }
          return need;
        }
        /* 高亮：每类当前条目 aria-current；章节按课程各一条 */
        function markActive() {
          items.forEach(function (x) {
            if (!x.a) return;
            var on = x.kind === "ch" ? cur["ch:" + x.course] === x.id : cur[x.kind] === x.id;
            if (on) x.a.setAttribute("aria-current", "true"); else x.a.removeAttribute("aria-current");
          });
        }
        /* 只滚动目录容器本身（不用 scrollIntoView，避免带动整页） */
        function reveal(x, now) {
          if (!x || !x.a) return;
          function go() {
            var a = x.a;
            if (!a.offsetParent) return;
            var cs = getComputedStyle(toc);
            if (!/(auto|scroll)/.test(cs.overflowY)) return;
            var tr = toc.getBoundingClientRect(), ar = a.getBoundingClientRect();
            var bar = toc.querySelector(".x-toc__bar"), top = tr.top + (bar ? bar.offsetHeight : 0) + 8, bottom = tr.bottom - 8;
            var d = ar.top < top ? ar.top - top : ar.bottom > bottom ? ar.bottom - bottom : 0;
            if (d) toc.scrollTop += d;
          }
          go();
          if (!now || !reduced()) setTimeout(go, DUR + 60);
        }
        /* 自动展开条目所在的组（记为“自动”，不写入 localStorage，离开区块时可收回） */
        function autoOpen(x) {
          var before = state.open;
          state.open = ensureOpenFor(state.open, x);
          state.open.forEach(function (g) { if (before.indexOf(g) < 0 && state.auto.indexOf(g) < 0) state.auto.push(g); });
        }
        function activate(x, user) {
          if (!built) return;
          markActive();
          if (user && !filterTerm) { autoOpen(x); renderAll(false); }
          if (user) { lastUser = x; reveal(x); }
        }

        /* 各模块切换条目：在 build 之前也记下来（React 页面在 legacy:ready 后立即处理锚点） */
        document.addEventListener("x:active", function (e) {
          var d = e.detail || {};
          if (!d.kind || d.id == null) return;
          var k = d.kind === "ch" ? "ch:" + String(d.id).split(":")[0] : d.kind;
          cur[k] = String(d.id);
          if (!built) { if (d.user) pending = { kind: d.kind, id: String(d.id) }; return; }
          var x = byKey[key(d.kind, String(d.id))];
          if (x) activate(x, !!d.user); else markActive();
        });
        /* 区块侦测（09-tool.js）：进入新区块时展开它的组，收起之前自动展开的组 */
        document.addEventListener("x:section", function (e) {
          var s = e.detail && e.detail.id;
          if (!s || s === section) return;
          section = s;
          if (!built || filterTerm) return;
          state = follow(state, needFor(s));
          renderAll(false);
          if (KINDS.indexOf(s) >= 0 && cur[s] != null) reveal(byKey[key(s, cur[s])]);
          else if (groupsEl[s]) revealEl(groupsEl[s].a);
        });
        function revealEl(a) {
          if (!a || !a.offsetParent) return;
          if (!/(auto|scroll)/.test(getComputedStyle(toc).overflowY)) return;
          var tr = toc.getBoundingClientRect(), ar = a.getBoundingClientRect(), bar = toc.querySelector(".x-toc__bar");
          var top = tr.top + (bar ? bar.offsetHeight : 0) + 8;
          if (ar.top < top) toc.scrollTop += ar.top - top; else if (ar.bottom > tr.bottom - 8) toc.scrollTop += ar.bottom - tr.bottom + 8;
        }
        /* 四门课的章节切换：页面上的章节按钮（02-chapters.js）点击后派发 x:active */
        document.addEventListener("click", function (e) {
          var b = e.target.closest && e.target.closest(".x-study .x-ch button");
          if (!b) return;
          var st = b.closest(".x-study"), c = st && st.getAttribute("data-subject");
          if (!c) return;
          document.dispatchEvent(new CustomEvent("x:active", { detail: { kind: "ch", id: c + ":" + chIndex(b), user: true } }));
        });
        /* 从目录打开某章：切到该章并滚到课程区块 */
        window.X_OPEN_CHAPTER = function (course, index) {
          var lis = document.querySelectorAll("#" + course + " .x-ch > li");
          var li = lis[index]; if (!li) return false;
          li.hidden = false;
          var b = li.querySelector("button"); if (b) b.click();
          if (window.X) X.go(course);
          return true;
        };
        /* 底部面板 / 浮动面板打开时：把当前条目滚到可见处 */
        window.X_TOC = {
          reveal: function () {
            if (!built) return;
            var x = section && KINDS.indexOf(section) >= 0 && cur[section] != null ? byKey[key(section, cur[section])] : null;
            if (!x && lastUser && lastUser.a && lastUser.a.offsetParent !== null) x = lastUser;
            if (x) reveal(x, true); else if (section && groupsEl[section]) revealEl(groupsEl[section].a);
          },
          state: function () { return { open: state.open.slice(), auto: state.auto.slice(), pin: state.pin.slice(), filter: filterTerm, cur: JSON.parse(JSON.stringify(cur)) }; },
          build: build
        };

        if (window.__LEGACY_LOADER__) window.addEventListener("legacy:ready", function () { setTimeout(build, 0); });
        else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(build, 0); });
        else setTimeout(build, 0);
        U._build = build;
      })();
