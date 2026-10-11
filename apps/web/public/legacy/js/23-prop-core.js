      /* 性质与公式：四门课高频性质、定理与计算公式的卡片（定义 / 结论 / 条件 / 推导单步 / 动手验证 / 易错点 / 例题 / 相关链接）。
         注册（见 24–27-prop-*.js）：
           PROP.push({ id, sub: "ds"|"co"|"os"|"cn", ch, name, def, stmt: [..], cond, proof: [..], traps: [..],
                       ex: { q, opts: [4 项], a: 0–3, why, src: "20xx 年真题" | "典型题" },
                       links: { lab: [实验 id], proc: [图解 id] },
                       demo: function (box) { …; return { destroy: function () {} }; } });
         文本一律按纯文本转义，只支持 **加粗** 与换行。demo 只在卡片打开时调用，切换时调用 destroy。
         PROPU.validate(PROP, { labIds, procIds }) 返回错误列表（不依赖 DOM，可在 node 里跑）。 */
      (function () {
        var PROP = window.PROP = window.PROP || [];
        var U = window.PROPU = window.PROPU || {};
        var SUBS = ["ds", "co", "os", "cn"];
        var SUBJ = {
          ds: { name: "数据结构", c: "var(--x-ds)" },
          co: { name: "组成原理", c: "var(--x-co)" },
          os: { name: "操作系统", c: "var(--x-os)" },
          cn: { name: "计算机网络", c: "var(--x-cn)" }
        };
        var LETTERS = "ABCD";
        U.SUBJ = SUBJ;

        /* ---------- 纯函数（node 可用） ---------- */
        function esc(s) {
          return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        }
        /* 纯文本 → 安全 HTML：先转义，再把 **x** 换成 <b>x</b>、换行换成 <br> */
        function md(s) {
          return esc(s).replace(/\*\*([^*]+?)\*\*/g, "<b>$1</b>").replace(/\r?\n/g, "<br>");
        }
        var SUBD = "₀₁₂₃₄₅₆₇₈₉", SUPD = "⁰¹²³⁴⁵⁶⁷⁸⁹";
        /* 搜索归一化：小写、上下标数字转普通数字、去空白与 ** 记号，"n0=n2+1" 能搜到 "n₀ = n₂ + 1" */
        function norm(s) {
          return String(s == null ? "" : s).toLowerCase().replace(/\*\*/g, "").replace(/[₀-₉⁰-⁹]/g, function (c) {
            var i = SUBD.indexOf(c); return String(i >= 0 ? i : SUPD.indexOf(c));
          }).replace(/[−–]/g, "-").replace(/\s+/g, "");
        }
        function haystack(p) {
          return norm([p.name, p.toc || "", p.ch, (p.stmt || []).join(" "), p.def].join(" | "));
        }
        function matches(p, term) {
          var t = norm(term);
          return !t || haystack(p).indexOf(t) >= 0;
        }
        function nonEmpty(s) { return typeof s === "string" && s.trim().length > 0; }

        /* 内容校验：返回 ["<id>: 问题", …]；opt.labIds / opt.procIds 给出时检查链接是否存在 */
        function validate(list, opt) {
          opt = opt || {};
          var errs = [], seen = {};
          var labSet = opt.labIds ? toSet(opt.labIds) : null, procSet = opt.procIds ? toSet(opt.procIds) : null;
          function toSet(a) { var o = {}; (a || []).forEach(function (x) { o[x] = 1; }); return o; }
          if (!list || typeof list.length !== "number") return ["PROP 不是数组"];
          for (var i = 0; i < list.length; i++) {
            var p = list[i], who = (p && nonEmpty(p.id) ? p.id : "#" + i);
            var err = function (m) { errs.push(who + ": " + m); };
            if (!p || typeof p !== "object") { err("不是对象"); continue; }
            if (!nonEmpty(p.id)) err("缺少 id");
            else {
              if (!/^[a-z0-9][a-z0-9-]*$/.test(p.id)) err("id 只能用小写字母、数字和连字符");
              if (seen[p.id]) err("id 重复"); seen[p.id] = 1;
            }
            if (SUBS.indexOf(p.sub) < 0) err("sub 必须是 ds/co/os/cn");
            ["ch", "name", "def", "cond"].forEach(function (k) { if (!nonEmpty(p[k])) err("缺少 " + k); });
            if (!Array.isArray(p.stmt) || !p.stmt.length) err("stmt 至少 1 条");
            else if (!p.stmt.every(nonEmpty)) err("stmt 有空条目");
            if (!Array.isArray(p.proof) || p.proof.length < 3) err("proof 少于 3 步");
            else {
              if (p.proof.length > 8) err("proof 超过 8 步");
              if (!p.proof.every(nonEmpty)) err("proof 有空步骤");
            }
            if (!Array.isArray(p.traps) || p.traps.length < 2) err("traps 少于 2 条");
            else if (!p.traps.every(nonEmpty)) err("traps 有空条目");
            var ex = p.ex;
            if (!ex || typeof ex !== "object") err("缺少 ex");
            else {
              if (!nonEmpty(ex.q)) err("ex.q 为空");
              if (!Array.isArray(ex.opts) || ex.opts.length !== 4) err("ex.opts 必须正好 4 项");
              else if (!ex.opts.every(nonEmpty)) err("ex.opts 有空选项");
              if (typeof ex.a !== "number" || ex.a % 1 !== 0 || ex.a < 0 || ex.a > 3) err("ex.a 必须是 0–3 的整数");
              if (!nonEmpty(ex.why)) err("ex.why 为空");
              if (!nonEmpty(ex.src)) err("ex.src 为空");
              else if (!/^(20\d{2} ?年.*真题.*|典型题)$/.test(ex.src.trim())) err("ex.src 应为“20xx 年真题”或“典型题”");
            }
            var ln = p.links;
            if (ln != null) {
              if (typeof ln !== "object") err("links 必须是对象");
              else {
                ["lab", "proc"].forEach(function (k) {
                  if (ln[k] == null) return;
                  if (!Array.isArray(ln[k])) { err("links." + k + " 必须是数组"); return; }
                  var set = k === "lab" ? labSet : procSet;
                  ln[k].forEach(function (id) { if (set && !set[id]) err("links." + k + " 引用了不存在的 id：" + id); });
                });
              }
            }
            if (typeof p.demo !== "function") err("缺少 demo 函数");
          }
          return errs;
        }

        /* 排序：按科目 ds→co→os→cn，科目内保持注册顺序 */
        function ordered(list) {
          var reg = list.slice();
          return reg.slice().sort(function (a, b) { return (SUBS.indexOf(a.sub) - SUBS.indexOf(b.sub)) || (reg.indexOf(a) - reg.indexOf(b)); });
        }
        function chapters(list, sub) {
          var out = [];
          list.forEach(function (p) { if ((!sub || sub === "all" || p.sub === sub) && out.indexOf(p.ch) < 0) out.push(p.ch); });
          return out;
        }

        U.esc = esc;
        U.md = md;
        U.norm = norm;
        U.matches = matches;
        U.validate = validate;
        U.ordered = ordered;
        U.chapters = chapters;

        /* ---------- 界面 ---------- */
        function el(tag, attrs, html) {
          var n = document.createElement(tag);
          for (var k in attrs || {}) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
          if (html != null) n.innerHTML = html;
          return n;
        }
        function reduced() { return !!(window.X && window.X.reduced); }
        function narrow() { return !!(window.matchMedia && window.matchMedia("(max-width: 640px)").matches); }
        function scrollTo(node) {
          if (node && node.scrollIntoView) node.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
        }
        function labName(id) { var t = document.getElementById("tab-" + id); return t ? t.textContent : id; }
        function procName(id) {
          var d = (window.PROC || []).filter(function (x) { return x.id === id; })[0];
          return d ? d.name : id;
        }

        function mount(root, list) {
          list = ordered(list || PROP);
          var st = { sub: "all", ch: "", q: "", g: "" }, cur = null, shown = null, demoInst = null, pos = 0;
          root.innerHTML = "";
          root.classList.add("x-prop");

          /* 筛选栏 */
          var bar = el("div", { class: "x-prop__bar" });
          var chips = el("div", { class: "x-prop__subs", role: "group", "aria-label": "科目" });
          [["all", "全部", "var(--x-ink-2)"]].concat(SUBS.filter(function (s) { return list.some(function (p) { return p.sub === s; }); }).map(function (s) { return [s, SUBJ[s].name, SUBJ[s].c]; })).forEach(function (s) {
            var b = el("button", { type: "button", class: "x-prop__sub", "data-sub": s[0], "aria-pressed": s[0] === st.sub ? "true" : "false", style: "--c:" + s[2] });
            b.textContent = s[1];
            b.addEventListener("click", function () { setSub(s[0]); });
            chips.appendChild(b);
          });
          var chLab = el("label", { class: "x-prop__chl" });
          chLab.appendChild(el("span", { class: "x-vh" })).textContent = "章节";
          var chSel = el("select", { class: "x-lab__sel x-prop__ch", "aria-label": "章节" });
          chLab.appendChild(chSel);
          var qLab = el("label", { class: "x-prop__ql" });
          qLab.appendChild(el("span", { class: "x-vh" })).textContent = "搜索性质";
          var qIn = el("input", { type: "search", class: "x-lab__in x-prop__q", placeholder: "搜索性质或公式，例如 n₀、香农、补码", autocomplete: "off", spellcheck: "false", "aria-label": "搜索性质或公式" });
          qLab.appendChild(qIn);
          bar.appendChild(chips); bar.appendChild(chLab); bar.appendChild(qLab);
          root.appendChild(bar);

          var wrap = el("div", { class: "x-prop__wrap" });
          var nav = el("div", { class: "x-prop__list", role: "tablist", "aria-label": "性质列表", "aria-orientation": "vertical" });
          var empty = el("p", { class: "x-prop__empty", role: "status" });
          empty.hidden = true;
          var card = el("article", { class: "x-prop__card", role: "tabpanel", tabindex: "-1" });
          wrap.appendChild(nav); wrap.appendChild(card);
          root.appendChild(wrap);
          nav.appendChild(empty);

          /* 列表 */
          var items = [], groups = {};
          list.forEach(function (p) {
            if (!groups[p.sub]) {
              var gl = el("p", { class: "x-prop__gl", role: "presentation", style: "--c:" + (SUBJ[p.sub] ? SUBJ[p.sub].c : "#888") });
              gl.textContent = SUBJ[p.sub] ? SUBJ[p.sub].name : p.sub;
              groups[p.sub] = gl;
              nav.appendChild(gl);
            }
            var b = el("button", { type: "button", role: "tab", class: "x-prop__item", id: "prtab-" + p.id, "data-id": p.id, "aria-selected": "false", tabindex: "-1", style: "--c:" + (SUBJ[p.sub] ? SUBJ[p.sub].c : "#888") });
            b.appendChild(el("span", { class: "x-prop__in" })).textContent = p.name;
            /* 窄屏横向标签用短名，宽屏列表与卡片标题仍用完整名称 */
            if (p.toc && p.toc !== p.name) { b.classList.add("x-prop__item--s"); b.appendChild(el("span", { class: "x-prop__ins", "aria-hidden": "true" })).textContent = p.toc; b.title = p.name; b.setAttribute("aria-label", p.name); }
            b.addEventListener("click", function () { open(p.id, { user: true }); });
            nav.appendChild(b);
            items.push({ p: p, b: b });
          });
          nav.addEventListener("keydown", function (e) {
            var k = e.key, d = k === "ArrowDown" || k === "ArrowRight" ? 1 : k === "ArrowUp" || k === "ArrowLeft" ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            var vis = items.filter(function (o) { return !o.b.hidden; });
            if (!vis.length) return;
            var j = vis.findIndex(function (o) { return o.p === cur; });
            j = (j + d + vis.length) % vis.length;
            open(vis[j].p.id, { user: true });
            vis[j].b.focus();
          });

          function fillChapters() {
            chSel.innerHTML = "";
            var o = el("option", { value: "" }); o.textContent = "全部章节"; chSel.appendChild(o);
            var subs = st.sub === "all" ? SUBS : [st.sub];
            subs.forEach(function (s) {
              var chs = chapters(list, s);
              if (!chs.length) return;
              var parent = chSel;
              if (st.sub === "all") { parent = el("optgroup", { label: SUBJ[s].name }); chSel.appendChild(parent); }
              chs.forEach(function (c) { var op = el("option", { value: c }); op.textContent = c; parent.appendChild(op); });
            });
            chSel.value = st.ch;
          }
          function visible(p) {
            return (st.sub === "all" || p.sub === st.sub) && (!st.ch || p.ch === st.ch) && matches(p, st.q) && matches(p, st.g);
          }
          function apply() {
            var n = 0, first = null;
            items.forEach(function (o) {
              var v = visible(o.p);
              o.b.hidden = !v;
              if (v) { n++; if (!first) first = o.p; }
            });
            Object.keys(groups).forEach(function (s) {
              groups[s].hidden = st.sub !== "all" || !items.some(function (o) { return o.p.sub === s && !o.b.hidden; });
            });
            empty.hidden = n > 0;
            empty.textContent = n ? "" : "没有匹配的性质，换个关键词或科目试试";
            Array.prototype.forEach.call(chips.children, function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-sub") === st.sub ? "true" : "false"); });
            if (first && (!cur || !visible(cur))) open(first.id, {});
            return n;
          }
          function setSub(s) {
            st.sub = s; st.ch = "";
            fillChapters();
            return apply();
          }
          chSel.addEventListener("change", function () { st.ch = chSel.value; apply(); });
          var qt = null;
          qIn.addEventListener("input", function () { clearTimeout(qt); qt = setTimeout(function () { st.q = qIn.value.trim(); apply(); }, 120); });
          qIn.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); clearTimeout(qt); st.q = qIn.value.trim(); apply(); } });

          /* 卡片 */
          function fold(cls, title, openByDefault) {
            var d = el("details", { class: "x-prop__fold " + cls });
            if (openByDefault) d.open = true;
            d.appendChild(el("summary", { class: "x-prop__h" })).textContent = title;
            return d;
          }
          function killDemo() {
            if (demoInst && typeof demoInst.destroy === "function") {
              try { demoInst.destroy(); } catch (e) { if (window.console) console.error(e); }
            }
            demoInst = null;
          }
          function render(p) {
            killDemo();
            card.innerHTML = "";
            card.id = "prop-" + p.id;
            card.setAttribute("aria-labelledby", "prtab-" + p.id);
            card.style.setProperty("--c", SUBJ[p.sub] ? SUBJ[p.sub].c : "var(--x-primary)");
            var openFold = !narrow();

            var head = el("header", { class: "x-prop__head" });
            head.appendChild(el("p", { class: "x-prop__meta" }, '<span class="x-prop__tag">' + esc(SUBJ[p.sub] ? SUBJ[p.sub].name : p.sub) + "</span>" + esc(p.ch)));
            head.appendChild(el("h3", { class: "x-prop__name" })).textContent = p.name;
            card.appendChild(head);
            if (p.def) card.appendChild(el("p", { class: "x-prop__def" }, '<b class="x-prop__k">定义</b>' + md(p.def)));

            var stmt = el("div", { class: "x-prop__stmt", role: "note", "aria-label": "结论" });
            stmt.appendChild(el("b", { class: "x-prop__k" })).textContent = "结论";
            var ul = el("ul");
            (p.stmt || []).forEach(function (s) { ul.appendChild(el("li", {}, md(s))); });
            stmt.appendChild(ul);
            card.appendChild(stmt);
            if (p.cond) card.appendChild(el("p", { class: "x-prop__cond" }, '<b class="x-prop__k">适用条件</b>' + md(p.cond)));

            /* 动手验证 */
            var demoWrap = el("section", { class: "x-prop__demo", "aria-label": "动手验证" });
            demoWrap.appendChild(el("h4", { class: "x-prop__h" })).textContent = "动手验证";
            var box = el("div", { class: "x-prop__box" });
            demoWrap.appendChild(box);
            card.appendChild(demoWrap);

            /* 推导 */
            var proof = p.proof || [];
            if (proof.length) {
              var pf = fold("x-prop__proof", "推导", openFold);
              var ctrl = el("div", { class: "x-prop__ctrl" },
                '<button type="button" class="x-lab__btn" data-a="prev">上一步</button>' +
                '<button type="button" class="x-lab__btn x-lab__btn--main" data-a="next">下一步</button>' +
                '<button type="button" class="x-lab__btn" data-a="all">全部展开</button>' +
                '<span class="x-prop__count" aria-live="polite"></span>');
              var ol = el("ol", { class: "x-prop__steps" });
              proof.forEach(function (s, k) { var li = el("li", { "data-k": k }, md(s)); ol.appendChild(li); });
              pf.appendChild(ctrl); pf.appendChild(ol);
              card.appendChild(pf);
              var bPrev = ctrl.querySelector('[data-a="prev"]'), bNext = ctrl.querySelector('[data-a="next"]'), bAll = ctrl.querySelector('[data-a="all"]'), cnt = ctrl.querySelector(".x-prop__count");
              var showStep = function (i) {
                pos = Math.max(0, Math.min(proof.length - 1, i));
                Array.prototype.forEach.call(ol.children, function (li, k) {
                  li.hidden = k > pos;
                  li.classList.toggle("is-cur", k === pos);
                  if (k === pos) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
                });
                cnt.textContent = (pos + 1) + " / " + proof.length;
                bPrev.disabled = pos === 0;
                bNext.disabled = pos >= proof.length - 1;
                bAll.textContent = pos >= proof.length - 1 ? "从头看" : "全部展开";
              };
              bPrev.addEventListener("click", function () { showStep(pos - 1); });
              bNext.addEventListener("click", function () { showStep(pos + 1); });
              bAll.addEventListener("click", function () { showStep(pos >= proof.length - 1 ? 0 : proof.length - 1); });
              showStep(0);
            }

            /* 易错点 */
            if ((p.traps || []).length) {
              var tf = fold("x-prop__traps", "易错点", openFold), tl = el("ul");
              p.traps.forEach(function (t) { tl.appendChild(el("li", {}, md(t))); });
              tf.appendChild(tl);
              card.appendChild(tf);
            }

            /* 例题 */
            var ex = p.ex;
            if (ex && ex.opts) {
              var xf = fold("x-prop__ex", "例题", openFold);
              var q = el("p", { class: "x-prop__q" }, (ex.src ? '<span class="x-prop__src">' + esc(ex.src) + "</span>" : "") + md(ex.q));
              var opts = el("div", { class: "x-prop__opts", role: "group", "aria-label": "选项" });
              var res = el("div", { class: "x-prop__res", "aria-live": "polite" });
              res.hidden = true;
              ex.opts.forEach(function (o, k) {
                var b = el("button", { type: "button", class: "x-prop__opt", "data-k": k }, '<b class="x-prop__ol">' + LETTERS.charAt(k) + "</b><span>" + md(o) + "</span>");
                b.addEventListener("click", function () { judge(k); });
                opts.appendChild(b);
              });
              var judge = function (k) {
                var ok = k === ex.a;
                Array.prototype.forEach.call(opts.children, function (b, j) {
                  b.disabled = true;
                  b.classList.toggle("is-right", j === ex.a);
                  b.classList.toggle("is-wrong", j === k && !ok);
                  if (j === k) b.setAttribute("aria-pressed", "true"); else b.removeAttribute("aria-pressed");
                });
                res.hidden = false;
                res.className = "x-prop__res " + (ok ? "is-ok" : "is-bad");
                res.innerHTML = '<p class="x-prop__verdict">' + (ok ? "✓ 答对了" : "✗ 答错了，正确答案是 " + LETTERS.charAt(ex.a)) + "</p>" +
                  '<p class="x-prop__why"><b>解析</b>' + md(ex.why) + "</p>" +
                  '<button type="button" class="x-lab__btn x-prop__redo">再做一次</button>';
                res.querySelector(".x-prop__redo").addEventListener("click", function () {
                  Array.prototype.forEach.call(opts.children, function (b) { b.disabled = false; b.classList.remove("is-right", "is-wrong"); b.removeAttribute("aria-pressed"); });
                  res.hidden = true; res.innerHTML = "";
                });
              };
              xf.appendChild(q); xf.appendChild(opts); xf.appendChild(res);
              card.appendChild(xf);
            }

            /* 相关链接 */
            var ln = p.links || {}, labs = ln.lab || [], procs = ln.proc || [];
            if (labs.length || procs.length) {
              var rel = el("nav", { class: "x-prop__rel", "aria-label": "相关实验与图解" });
              rel.appendChild(el("b", { class: "x-prop__k" })).textContent = "相关";
              labs.forEach(function (id) {
                var a = el("a", { class: "x-prop__link", href: "#lab-" + id, "data-lab": id });
                a.textContent = "动画实验：" + labName(id) + " →";
                rel.appendChild(a);
              });
              procs.forEach(function (id) {
                var a = el("a", { class: "x-prop__link", href: "#proc-" + id, "data-proc": id });
                a.textContent = "过程图解：" + procName(id) + " →";
                rel.appendChild(a);
              });
              card.appendChild(rel);
            }

            /* 最后启动验证动画：出错只影响这一块 */
            if (typeof p.demo === "function") {
              try {
                demoInst = p.demo(box) || null;
              } catch (e) {
                if (window.console) console.error(e);
                demoInst = null;
                box.innerHTML = "";
                box.appendChild(el("p", { class: "x-prop__err", role: "alert" })).textContent = "验证动画出错了：" + (e && e.message ? e.message : String(e));
              }
            } else demoWrap.hidden = true;
          }
          card.addEventListener("click", function (e) {
            var a = e.target.closest && e.target.closest("a[data-lab], a[data-proc]");
            if (!a) return;
            var lab = a.getAttribute("data-lab"), pr = a.getAttribute("data-proc");
            if (lab && window.X_OPEN_LAB && document.getElementById("tab-" + lab)) {
              e.preventDefault();
              window.X_OPEN_LAB(lab);
              if (history.replaceState) history.replaceState(null, "", "#lab-" + lab);
            } else if (pr && window.X_OPEN_PROC && window.X_OPEN_PROC(pr)) {
              e.preventDefault();
              scrollTo(document.getElementById("proc"));
              if (history.replaceState) history.replaceState(null, "", "#proc-" + pr);
            }
            /* 其余情况走默认锚点跳转，由 hashchange 处理 */
          });

          /* 打开：o.user 时写入 #prop-<id>；o.scroll 时滚到卡片；目标被筛掉时放宽筛选 */
          function open(id, o) {
            o = o || {};
            var it = items.filter(function (x) { return x.p.id === id; })[0];
            if (!it) return false;
            if (!visible(it.p)) {
              st.q = ""; qIn.value = ""; st.g = "";
              if (st.sub !== "all" && st.sub !== it.p.sub) st.sub = it.p.sub;
              if (st.ch && st.ch !== it.p.ch) st.ch = "";
              fillChapters();
              cur = it.p; /* 先占位，避免 apply 去打开第一条 */
              apply();
            }
            cur = it.p;
            items.forEach(function (x) {
              var on = x === it;
              x.b.setAttribute("aria-selected", on ? "true" : "false");
              x.b.tabIndex = on ? 0 : -1;
            });
            if (shown !== it.p) { shown = it.p; render(it.p); }
            if (o.user && nav.scrollWidth > nav.clientWidth + 2 && it.b.offsetLeft != null) {
              try { nav.scrollTo({ left: Math.max(0, it.b.offsetLeft - nav.offsetLeft - 12), behavior: reduced() ? "auto" : "smooth" }); } catch (e) { /* 旧浏览器 */ }
            }
            if (o.user && history.replaceState) history.replaceState(null, "", "#prop-" + it.p.id);
            if (o.scroll) scrollTo(card);
            if (typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("x:active", { detail: { kind: "prop", id: it.p.id, user: !!(o.user || o.scroll) } }));
            return true;
          }

          fillChapters();
          apply();
          var api = {
            open: function (id, scroll) { return open(id, { scroll: !!scroll }); },
            current: function () { return cur ? cur.id : null; },
            setSub: setSub,
            setChapter: function (c) { st.ch = c || ""; chSel.value = st.ch; return apply(); },
            search: function (t) { st.q = String(t || "").trim(); qIn.value = st.q; return apply(); },
            /* 页内搜索（09-tool.js）：与本节自己的搜索叠加；有关键词时放开科目与章节筛选 */
            setGlobal: function (t) {
              st.g = String(t || "").trim();
              if (st.g && (st.sub !== "all" || st.ch)) { st.sub = "all"; st.ch = ""; fillChapters(); }
              return apply();
            },
            count: function () { return items.filter(function (o) { return !o.b.hidden; }).length; },
            destroy: function () { killDemo(); shown = null; root.innerHTML = ""; }
          };
          return api;
        }
        U.mount = mount;

        /* ---------- hash 直达：#prop-<id>，以及 #lab-<id> / #proc-<id> 的页内跳转 ---------- */
        function onHash(scroll) {
          var h = "";
          try { h = decodeURIComponent((location.hash || "").slice(1)); } catch (e) { h = (location.hash || "").slice(1); }
          var m;
          if ((m = /^prop-(.+)$/.exec(h)) && window.X_PROP) return window.X_PROP.open(m[1], scroll);
          if ((m = /^lab-(.+)$/.exec(h)) && window.X_OPEN_LAB && document.getElementById("tab-" + m[1])) { window.X_OPEN_LAB(m[1]); return true; }
          if ((m = /^proc-(.+)$/.exec(h)) && window.X_OPEN_PROC && window.X_OPEN_PROC(m[1])) { if (scroll) scrollTo(document.getElementById("proc")); return true; }
          return false;
        }
        U.onHash = onHash;

        function build() {
          var root = document.getElementById("x-prop");
          if (!root || root.dataset.built) return;
          root.dataset.built = "1";
          var api = mount(root, PROP);
          window.X_PROP = api;
          window.X_OPEN_PROP = function (id, scroll) { return api.open(id, scroll); };
          window.addEventListener("hashchange", function () { onHash(true); });
          if (/^#prop-/.test(location.hash || "")) {
            onHash(false);
            /* 等 React 去掉加载层、版面稳定后再滚动 */
            setTimeout(function () { onHash(true); }, 120);
          }
        }
        U.build = build;
        if (typeof document === "undefined") return;
        if (window.__LEGACY_LOADER__) window.addEventListener("legacy:ready", build);
        else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
        else setTimeout(build, 0);
      })();
