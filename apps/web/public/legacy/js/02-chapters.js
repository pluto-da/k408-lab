      /* §03–§06 chapter list + 核心考点卡 */
      (function () {
        function stars(n) {
          var s = "";
          for (var i = 1; i <= 3; i++) s += i <= n ? "★" : "<i>★</i>";
          return s;
        }
        function pad(n) { return (n < 10 ? "0" : "") + n; }
        function tableHTML(t) {
          var h = '<div class="x-tbl"><table><caption>' + t.caption + "</caption><thead><tr>";
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
        function cardHTML(subj, ch) {
          var h = '<p class="x-card__tag"><span>§' + subj.no + "." + pad(ch.no) + " · 第 " + ch.no + ' 章</span><span aria-label="考频 ' + ch.freq + ' / 3">考频 ' + stars(ch.freq) + "</span></p>";
          h += "<h3>" + ch.title + "</h3>";
          h += '<div class="x-dim">核心考点 × ' + ch.points.length + "</div>";
          h += '<ul class="x-pts">' + ch.points.map(function (p) { return "<li><span>" + p + "</span></li>"; }).join("") + "</ul>";
          h += '<p class="x-trap"><b>易错</b>' + ch.trap + "</p>";
          if (ch.table) h += tableHTML(ch.table);
          return h;
        }
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
            card.innerHTML = cardHTML(subj, subj.chapters[i]);
            if (user && list.scrollWidth > list.clientWidth) {
              var b = btns[i];
              list.scrollTo({ left: b.parentNode.offsetLeft - list.offsetLeft - 10, behavior: "smooth" });
            }
          }
          el.appendChild(list); el.appendChild(card);
          select(0, false);
        }
        var els = document.querySelectorAll(".x-study[data-subject]");
        for (var i = 0; i < els.length; i++) mount(els[i]);
      })();
    
