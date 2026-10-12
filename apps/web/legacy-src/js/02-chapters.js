      /* 四门课：章节目录 + 核心考点卡（考点、易错点、对应实验） */
      (function () {
        function stars(n) {
          var s = "";
          for (var i = 1; i <= 3; i++) s += i <= n ? "★" : "<i>★</i>";
          return s;
        }
        function pad(n) { return (n < 10 ? "0" : "") + n; }
        function tableHTML(t) {
          var h = '<div class="x-tbl" tabindex="0"><table><caption>' + t.caption + "</caption><thead><tr>";
          t.cols.forEach(function (c) { h += '<th scope="col">' + c + "</th>"; });
          h += "</tr></thead><tbody>";
          t.rows.forEach(function (r) {
            h += '<tr><th scope="row">' + r[0] + "</th>";
            for (var i = 1; i < r.length; i++) {
              var cls = r[i] === "不稳定" ? ' class="is-bad"' : r[i] === "稳定" ? ' class="is-ok"' : "";
              h += "<td" + cls + ">" + r[i] + "</td>";
            }
            h += "</tr>";
          });
          return h + "</tbody></table></div>";
        }
        /* 章节 → 实验室里对应的实验（tab id） */
        var LABS_OF = {
          "ds-4": ["tree"], "ds-5": ["dijkstra"], "ds-7": ["sort"],
          "co-3": ["cache"], "co-5": ["pipeline"],
          "os-2": ["gantt", "banker"], "os-3": ["paging"],
          "cn-4": ["subnet"], "cn-5": ["tcp", "tcpconn"]
        };
        function cardHTML(key, subj, ch) {
          var h = '<p class="x-card__tag"><span>第 ' + ch.no + ' 章</span><span aria-label="考频 ' + ch.freq + ' / 3">考频 ' + stars(ch.freq) + "</span></p>";
          h += "<h3>" + ch.title + "</h3>";
          h += '<p class="x-card__sub">核心考点</p>';
          h += '<ul class="x-pts">' + ch.points.map(function (p) { return "<li><span>" + p + "</span></li>"; }).join("") + "</ul>";
          h += '<div class="x-trap" role="note"><b><span aria-hidden="true">!</span>易错</b><p>' + ch.trap + "</p></div>";
          if (ch.table) h += tableHTML(ch.table);
          var labs = LABS_OF[key + "-" + ch.no];
          if (labs) h += '<div class="x-card__labs">' + labs.map(function (id) {
            return '<button type="button" class="x-card__lab" data-lab="' + id + '">打开实验：<span data-lab-name="' + id + '">' + id + "</span> →</button>";
          }).join("") + "</div>";
          return h;
        }
        /* 打开实验室里的某个实验：切到对应标签页并滚过去 */
        window.X_OPEN_LAB = function (id) {
          var tab = document.getElementById("tab-" + id);
          if (tab) { tab.hidden = false; tab.click(); }
          X.go("lab");
        };
        function labName(id) { var t = document.getElementById("tab-" + id); return t ? t.textContent : null; }
        function mount(el) {
          var key = el.getAttribute("data-subject"), subj = X408[key];
          if (!subj) return;
          var list = document.createElement("ul");
          list.className = "x-ch";
          list.setAttribute("aria-label", subj.name + " 章节");
          var card = document.createElement("div");
          card.className = "x-card";
          card.id = "card-" + key;
          card.setAttribute("aria-live", "polite");
          var btns = [];
          subj.chapters.forEach(function (ch, i) {
            var li = document.createElement("li"), b = document.createElement("button");
            b.type = "button";
            b.setAttribute("aria-controls", card.id);
            b.innerHTML = '<span class="x-ch__no">' + pad(ch.no) + "</span><span>" + ch.title + '</span><span class="x-ch__star" aria-label="考频 ' + ch.freq + ' / 3">' + stars(ch.freq) + "</span>";
            b.addEventListener("click", function () { select(i, true); });
            li.appendChild(b); list.appendChild(li); btns.push(b);
          });
          var cur = 0;
          function select(i, user) {
            cur = i;
            btns.forEach(function (b, j) { b.setAttribute("aria-pressed", j === i ? "true" : "false"); });
            card.innerHTML = cardHTML(key, subj, subj.chapters[i]);
            Array.prototype.forEach.call(card.querySelectorAll("[data-lab-name]"), function (n) { var t = labName(n.getAttribute("data-lab-name")); if (t) n.textContent = t; });
            if (user && list.scrollWidth > list.clientWidth) {
              var b = btns[i];
              list.scrollTo({ left: b.parentNode.offsetLeft - list.offsetLeft - 10, behavior: "smooth" });
            }
          }
          card.addEventListener("click", function (ev) {
            var b = ev.target.closest("[data-lab]"); if (b) window.X_OPEN_LAB(b.getAttribute("data-lab"));
          });
          /* 实验标签页搭好之后，把卡片里的实验名补全 */
          window.addEventListener("legacy:ready", function () { setTimeout(function () { select(cur, false); }, 0); });
          el.appendChild(list); el.appendChild(card);
          select(0, false);
        }
        var els = document.querySelectorAll(".x-study[data-subject]");
        for (var i = 0; i < els.length; i++) mount(els[i]);
      })();
    
