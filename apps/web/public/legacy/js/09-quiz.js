      /* §09 自测: 8 questions, fixed order */
      (function () {
        var SUB = {
          ds: { name: "数据结构", c: "var(--x-ds)" },
          co: { name: "计算机组成原理", c: "var(--x-co)" },
          os: { name: "操作系统", c: "var(--x-os)" },
          cn: { name: "计算机网络", c: "var(--x-cn)" }
        };
        var Q = [
          { id: "q1", s: "ds", q: "循环队列存储空间为 M，front 指向队头，rear 指向队尾元素的下一个位置，牺牲一个单元区分队空队满，队满条件是？",
            o: ["<code>rear==front</code>", "<code>(rear+1)%M==front</code>", "<code>(front+1)%M==rear</code>", "<code>rear==M−1</code>"], a: 1,
            e: "牺牲一个单元后，rear 再前进一格就追上 front 即为满：<code>(rear+1)%M==front</code>。<code>rear==front</code> 是队空条件。" },
          { id: "q2", s: "ds", q: "一棵二叉树有 20 个度为 2 的结点，叶子结点数为？",
            o: ["19", "20", "21", "40"], a: 2,
            e: "二叉树性质 <code>n0 = n2 + 1</code>，叶子数 = 20 + 1 = 21，与度为 1 的结点数无关。" },
          { id: "q3", s: "co", q: "8 位补码能表示的整数范围是？",
            o: ["−127 ~ 127", "−128 ~ 127", "−127 ~ 128", "−128 ~ 128"], a: 1,
            e: "n 位补码范围是 <code>−2^(n−1) ~ 2^(n−1)−1</code>，即 −128 ~ 127。−128 的补码是 <code>1000 0000</code>，比原码、反码多表示一个数。" },
          { id: "q4", s: "co", q: "主存地址 32 位，Cache 16KB，块大小 64B，直接映射，Tag 位数为？",
            o: ["16", "18", "20", "26"], a: 1,
            e: "块内偏移 log₂64 = 6 位；行数 16KB / 64B = 256 行，行号 8 位；Tag = 32 − 8 − 6 = 18 位。" },
          { id: "q5", s: "os", q: "访问串 1,2,3,4,1,2,5,1,2,3,4,5，分配 3 个物理块，FIFO 置换的缺页次数为？",
            o: ["8", "9", "10", "12"], a: 1,
            e: "前 7 次访问全缺页（1,2,3,4,1,2,5），之后 1、2 命中，3、4 缺页，5 命中，共 9 次。换成 4 个物理块反而缺页 10 次，即 Belady 异常。" },
          { id: "q6", s: "os", q: "用于实现互斥的信号量初值一般为？",
            o: ["0", "1", "资源数 n", "−1"], a: 1,
            e: "互斥信号量初值为 1，表示临界区同一时刻只允许一个进程进入。同步信号量初值常为 0，资源信号量初值为资源数 n。" },
          { id: "q7", s: "cn", q: "一个 /26 的子网最多可分配给主机的地址数为？",
            o: ["64", "63", "62", "30"], a: 2,
            e: "主机号 32 − 26 = 6 位，共 2⁶ = 64 个地址，去掉全 0 的网络地址和全 1 的广播地址，可用 62 个。" },
          { id: "q8", s: "cn", q: "TCP 发送方 cwnd=24 时收到 3 个重复 ACK，按快恢复，新的 ssthresh 和 cwnd 分别为？",
            o: ["12, 1", "12, 12", "24, 12", "12, 13"], a: 1,
            e: "快恢复：<code>ssthresh = cwnd / 2 = 12</code>，<code>cwnd = ssthresh = 12</code>，随后进入拥塞避免。A 是超时后的处理，cwnd 才会降到 1。" }
        ];
        var root = document.getElementById("x-quiz"), i, picks;
        if (!root) return;

        function track() {
          return '<div class="x-quiz__track" aria-hidden="true">' + Q.map(function (q, k) {
            return '<i style="--c:' + SUB[q.s].c + '" class="' + (k === i ? "is-cur" : picks[k] != null ? "is-done" : "") + '"></i>';
          }).join("") + "</div>";
        }
        function show(focus) {
          var q = Q[i], sub = SUB[q.s];
          root.innerHTML =
            '<div class="x-quiz__bar"><span class="x-quiz__tag" style="--c:' + sub.c + '">' + sub.name + "</span>" +
            '<span class="x-quiz__prog" aria-label="第 ' + (i + 1) + " 题，共 " + Q.length + ' 题">' + (i + 1) + " / " + Q.length + "</span></div>" +
            track() +
            '<h3 class="x-quiz__q" tabindex="-1">' + q.q + "</h3>" +
            '<ol class="x-quiz__opts">' + q.o.map(function (t, k) {
              return '<li><button type="button" class="x-quiz__opt" data-k="' + k + '"><b>' + "ABCD".charAt(k) + "</b><span>" + t + "</span><em></em></button></li>";
            }).join("") + "</ol>" +
            '<div class="x-quiz__fb" aria-live="polite"></div><div class="x-quiz__nav"></div>';
          root.querySelectorAll(".x-quiz__opt").forEach(function (b) {
            b.addEventListener("click", function () { answer(+b.dataset.k); });
          });
          if (focus) root.querySelector(".x-quiz__q").focus();
        }
        function answer(k) {
          var q = Q[i], ok = k === q.a, L = "ABCD".charAt(q.a);
          picks[i] = k;
          root.querySelectorAll(".x-quiz__opt").forEach(function (b, j) {
            b.disabled = true;
            if (j === q.a) { b.classList.add("is-ok"); b.querySelector("em").textContent = "✓ 正确答案"; }
            else if (j === k) { b.classList.add("is-bad"); b.querySelector("em").textContent = "✗ 你的选择"; }
            else b.classList.add("is-dim");
          });
          var fb = root.querySelector(".x-quiz__fb");
          fb.className = "x-quiz__fb" + (ok ? "" : " is-bad");
          fb.innerHTML = "<b>" + (ok ? "✓ 答对了" : "✗ 答错了 · 正确答案 " + L) + "</b>" + q.e;
          var last = i === Q.length - 1;
          var nx = X.el("button", { type: "button", class: "x-lab__btn" }, last ? "查看得分" : "下一题");
          nx.addEventListener("click", function () { if (last) result(); else { i++; show(true); } });
          root.querySelector(".x-quiz__nav").appendChild(nx);
          root.querySelector(".x-quiz__track").outerHTML = track();
          nx.focus();
        }
        function result() {
          var total = 0, by = {};
          Q.forEach(function (q, k) {
            by[q.s] = by[q.s] || { ok: 0, n: 0 };
            by[q.s].n++;
            if (picks[k] === q.a) { by[q.s].ok++; total++; }
          });
          root.innerHTML =
            '<p class="x-quiz__eyebrow">得分</p>' +
            '<p class="x-quiz__score" tabindex="-1">' + total + " <small>/ " + Q.length + "</small></p>" +
            '<ul class="x-legend">' + Object.keys(SUB).map(function (s) {
              return '<li style="--c:' + SUB[s].c + '"><b>' + SUB[s].name + "</b><span><em>" + by[s].ok + "</em> / " + by[s].n + " 答对</span></li>";
            }).join("") + "</ul>" +
            '<div class="x-quiz__nav"></div>';
          var re = X.el("button", { type: "button", class: "x-lab__btn" }, "重新开始");
          re.addEventListener("click", start);
          root.querySelector(".x-quiz__nav").appendChild(re);
          root.querySelector(".x-quiz__score").focus();
        }
        function start(e) { i = 0; picks = []; show(!!e); }
        start();
      })();
    
