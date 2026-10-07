      /* 流程演示 · 我来操作: answer each step to move the data token. window.PLAY.setup(id) / exit() / on() */
      (function () {
        var H = window.HERO, F = window.FLOW, THREE = window.THREE;
        var flowsRow = document.getElementById("xflows"), hero = document.getElementById("hero");
        if (!flowsRow) return;
        var playBtns = flowsRow.querySelectorAll("button[data-play]");
        if (!H || !F || !THREE || !hero || !H.root) { playBtns.forEach(function (b) { b.hidden = true; }); return; }
        var root = H.root, cam = H.camera, ctl = H.controls, stage = H.stage, reduced = H.reduced;
        var V3 = THREE.Vector3;

        var NAMES = { cpu: "CPU", ram: "内存", bus: "总线插槽", io: "I/O 与 DMA", nic: "网络接口", disk: "存储接口", os: "操作系统层", board: "主板" };
        var SPOT = { cpu: "ALU", ram: "RAM", bus: "BUS", io: "DMA", disk: "DISK", nic: "NIC", os: "OS", board: "BUS" };
        function norm(id) { return id === "ram1" || id === "ram2" ? "ram" : id === "ds" ? "bus" : id; }

        /* ---------- games ---------- */
        var GAMES = {
          life: {
            name: "一条指令的一生", start: "PC",
            opts: [
              { k: "hit", label: "Cache", ch: [["hit", "命中"], ["miss", "不命中"]], def: "miss" },
              { k: "kind", label: "指令类型", ch: [["add", "ADD 寄存器"], ["load", "LOAD 访存"]], def: "add" }
            ],
            steps: function (o) {
              var miss = o.hit === "miss", load = o.kind === "load", s = [];
              s.push({ q: "PC 中的指令地址先送到哪？", type: "card", cards: [["MAR", 1], ["MDR", 0, "MDR 存放数据，地址进 MAR"], ["IR", 0, "IR 存的是指令本身"]],
                path: ["MAR"], at: "cpu", cap: "PC → MAR：指令地址就位", rec: "PC 把指令地址送入 MAR" });
              s.push({ q: "地址先查哪里？", type: "part", part: "cpu", why: { ram: "先查更快的 Cache" }, miss: "Cache 就在 CPU 里，比主存快得多，先查它",
                path: ["CACHE"], at: "cpu", cap: miss ? "查 Cache：未命中" : "命中，直接从 Cache 取",
                rec: miss ? "查 CPU 内的 Cache：未命中" : "查 CPU 内的 Cache：命中，直接从 Cache 取" });
              if (miss) {
                s.push({ q: "Cache 未命中，去哪取？", type: "part", part: "ram", why: { cpu: "Cache 里没有这条指令，要经总线去主存" }, miss: "指令在主存里，经总线去内存取",
                  path: ["BUSLO", "BUS", "RAM"], at: "ram", cap: "经总线访问主存", rec: "经总线访问内存" });
                s.push({ q: "调入多少？", type: "card", cards: [["整块", 1], ["只调这一条指令", 0, "按块调入，利用局部性"]],
                  path: ["BUS", "BUSLO", "CACHE"], at: "cpu", cap: "指令所在的整块调入 Cache", rec: "整块调入 Cache" });
              }
              s.push({ q: "取出的指令送到哪个寄存器？", type: "card", cards: [["IR", 1], ["PC", 0, "PC 存的是下一条指令的地址"], ["ACC", 0, "ACC 存操作数和运算结果"]],
                path: ["MDR", "IR"], at: "cpu", cap: "经 MDR 送入 IR", rec: "指令经 MDR 送入 IR" });
              s.push({ q: "谁来译码？", type: "card", cards: [["CU 控制器", 1], ["ALU", 0, "ALU 只运算"]],
                path: ["CU"], at: "cpu", cap: "CU 译码，发出控制信号", rec: "CU 译码，产生控制信号" });
              if (load) s.push({ q: "操作数在哪？", type: "part", part: "ram", why: { cpu: "LOAD 的操作数在主存里，要再访存一次" }, miss: "LOAD 要访存：操作数在内存",
                path: ["MAR", "BUSHI", "BUS", "RAM", "BUS", "MDR", "ALU"], at: "ram", cap: "访存取回操作数，经 MDR 送 ALU", rec: "再次访存：从内存取回操作数，经 MDR 送 ALU" });
              else s.push({ q: "操作数来自？", type: "card", cards: [["通用寄存器", 1], ["主存", 0, "ADD 寄存器型：操作数已在寄存器，不用访存"]],
                path: ["REG", "ALU"], at: "cpu", cap: "从通用寄存器读操作数送 ALU", rec: "从通用寄存器读操作数送 ALU" });
              s.push({ q: "ALU 运算后结果写回？", type: "card", cards: [["寄存器", 1], ["Cache", 0, "运算结果写回通用寄存器，不直接写 Cache"]],
                path: ["REG"], at: "cpu", cap: "ALU 运算，结果写回寄存器", rec: "ALU 运算，结果写回寄存器" });
              s.push({ q: "下一条指令地址？", type: "card", cards: [["PC+1", 1], ["PC−1", 0, "顺序执行，PC 自增，指向下一条"]],
                path: ["PC"], at: "cpu", cap: "PC+1，准备取下一条指令", rec: "PC+1，指向下一条指令" });
              return s;
            }
          },
          pagefault: {
            name: "缺页中断", start: "PROC",
            opts: [
              { k: "tlb", label: "TLB", ch: [["hit", "命中"], ["miss", "未命中"]], def: "miss" },
              { k: "page", label: "页面", ch: [["in", "在内存"], ["out", "不在内存"]], def: "out" },
              { k: "mem", label: "内存", ch: [["free", "有空闲页框"], ["full", "已满"]], def: "full" },
              { k: "alg", label: "置换算法", ch: [["lru", "LRU"], ["fifo", "FIFO"]], def: "lru" }
            ],
            steps: function (o) {
              var hit = o.tlb === "hit", s = [];
              s.push({ q: "CPU 给出逻辑地址后先拆成？", type: "card", cards: [["页号 + 页内偏移", 1], ["段号 + 段内偏移", 0, "这是分段；分页系统拆成页号 + 页内偏移"]],
                path: ["CU", "MAR"], at: "cpu", cap: "逻辑地址 = 页号 + 页内偏移", rec: "逻辑地址拆成页号 + 页内偏移" });
              s.push({ q: "先查哪里？", type: "card", cards: [["TLB 快表", 1], ["页表", 0, "先查更快的快表，未命中再查页表"]],
                path: ["TLB"], at: "cpu", cap: hit ? "查 TLB：命中，得到物理块号" : "查 TLB：未命中", rec: hit ? "查 TLB：命中，得到物理块号" : "查 TLB：未命中" });
              if (hit) {
                s.push({ q: "得到物理块号后？", type: "card", cards: [["拼接偏移访问内存", 1], ["产生缺页中断", 0, "TLB 命中说明该页就在内存，不会缺页"]],
                  path: ["MAR"], at: "cpu", cap: "物理块号 + 页内偏移 = 物理地址", rec: "物理块号拼接页内偏移，得到物理地址" });
                s.push({ q: "按物理地址访存，去哪？", type: "part", part: "ram", why: { cpu: "数据在主存，要经总线去内存" }, miss: "按物理地址访问主存",
                  path: ["BUSLO", "BUS", "RAM"], at: "ram", cap: "访问内存，取得数据", rec: "经总线访问内存" });
                return s;
              }
              s.push({ q: "快表未命中，去哪查页表？", type: "part", part: "ram", why: { cpu: "页表存放在主存，不在 CPU 里", disk: "页表常驻主存，不在硬盘" }, miss: "页表在主存",
                path: ["BUSLO", "BUS", "RAM"], at: "ram", cap: o.page === "in" ? "查页表：状态位 = 1，页在内存" : "查页表：状态位 = 0，页不在内存",
                rec: o.page === "in" ? "去主存查页表：状态位 = 1" : "去主存查页表：状态位 = 0" });
              if (o.page === "in") {
                s.push({ q: "接下来？", type: "card", cards: [["更新 TLB 并访存", 1], ["产生缺页中断", 0, "状态位 = 1，页在内存，不缺页"]],
                  path: ["BUS", "BUSLO", "TLB"], at: "cpu", cap: "表项写入 TLB，拼出物理地址", rec: "页表项写入 TLB，拼出物理地址" });
                s.push({ q: "按物理地址访存，去哪？", type: "part", part: "ram", why: { cpu: "数据在主存，要经总线去内存" }, miss: "按物理地址访问主存",
                  path: ["BUSLO", "BUS", "RAM"], at: "ram", cap: "访问内存，取得数据", rec: "经总线访问内存" });
                return s;
              }
              s.push({ q: "状态位 = 0，CPU 会？", type: "card", cards: [["产生缺页中断，陷入内核", 1], ["直接报错终止", 0, "缺页是可恢复的内中断，处理完继续执行"]],
                path: ["BUS", "BUSLO", "CU"], at: "cpu", cap: "产生缺页中断，陷入内核", rec: "产生缺页中断（内中断），陷入内核" });
              s.push({ q: "谁来处理缺页中断？", type: "part", part: "os", why: { cpu: "CPU 陷入内核后，由操作系统的缺页处理程序接手" }, miss: "缺页由操作系统处理",
                path: ["OS"], at: "os", cap: "操作系统接手缺页处理", rec: "操作系统的缺页处理程序接手" });
              s.push({ q: "此时进程状态？", type: "card", cards: [["阻塞", 1], ["就绪", 0, "进程要等调页 I/O 完成，进入阻塞态"]],
                path: ["PROC", "OS"], at: "os", cap: "进程阻塞，等待调页", rec: "进程进入阻塞态" });
              if (o.mem === "full") {
                var lru = o.alg === "lru";
                s.push({ q: "内存已满，按 " + (lru ? "LRU" : "FIFO") + " 淘汰哪页？", type: "card", cards: [
                    ["页 A · 最早调入、最近刚访问", lru ? 0 : 1, "A 最近刚访问过；LRU 淘汰最久未访问的 B"],
                    ["页 B · 第二调入、最久未访问", lru ? 1 : 0, "FIFO 只看调入先后，最早调入的是 A"],
                    ["页 C · 最后调入", 0, lru ? "C 不是最久未访问的；LRU 淘汰 B" : "C 最后调入，FIFO 最晚淘汰它"]],
                  path: ["OS", "OSR", "RAM"], at: "ram", cap: lru ? "LRU：淘汰最久未访问的页 B" : "FIFO：淘汰最早调入的页 A",
                  rec: lru ? "按 LRU 淘汰最久未访问的页 B" : "按 FIFO 淘汰最早调入的页 A" });
                s.push({ q: "被淘汰页被修改过怎么办？", type: "card", cards: [["先写回磁盘", 1], ["直接丢弃", 0, "脏页直接丢弃会丢失修改，须先写回"]],
                  path: ["DMA", "DISK"], at: "disk", cap: "脏页先写回磁盘", rec: "脏页先写回磁盘" });
              }
              s.push({ q: "从哪调入缺失的页？", type: "part", part: "disk", why: { ram: "页不在内存，要从外存调入", io: "DMA 只负责搬运，页存放在硬盘" }, miss: "缺失的页在硬盘（外存）",
                path: ["DISK"], at: "disk", cap: "启动磁盘 I/O，读出缺失页", rec: "从硬盘读出缺失页" });
              s.push({ q: "谁负责搬运整页？", type: "part", part: "io", why: { cpu: "DMA 直接与内存交换，不经 CPU" }, miss: "DMA 直接与内存交换，不经 CPU",
                path: ["DMA", "RAM"], at: "ram", cap: "DMA 将整页送入内存页框", rec: "DMA 将整页直接送入页框" });
              s.push({ q: "调入后要做？", type: "card", cards: [["修改页表与 TLB", 1], ["什么也不做", 0, "不改页表，状态位仍为 0，再访问还会缺页"]],
                path: ["OSR", "OS"], at: "os", cap: "修改页表与 TLB，状态位置 1", rec: "修改页表与 TLB，状态位置 1" });
              s.push({ q: "进程恢复后？", type: "card", cards: [["重新执行引起缺页的那条指令", 1], ["执行下一条指令", 0, "缺页在指令执行中产生，需重执行"]],
                path: ["PROC", "CU", "MAR"], at: "cpu", cap: "进程唤醒，重新执行那条指令", rec: "进程唤醒，重新执行引起缺页的指令" });
              return s;
            }
          },
          web: {
            name: "访问一个网页", start: "PROC",
            opts: [
              { k: "dns", label: "本地 DNS 缓存", ch: [["yes", "有"], ["no", "无"]], def: "no" },
              { k: "conn", label: "传输", ch: [["new", "首次连接"], ["open", "已建立连接"]], def: "new" }
            ],
            steps: function (o) {
              var cached = o.dns === "yes", s = [];
              s.push({ q: "浏览器进程运行在哪个部件上？", type: "part", part: "cpu", why: { os: "操作系统调度进程，真正执行指令的是 CPU" }, miss: "浏览器进程在 CPU 上执行",
                path: ["CU"], at: "cpu", cap: "浏览器进程在 CPU 上发起请求", rec: "浏览器进程在 CPU 上发起请求" });
              s.push({ q: "浏览器拿到域名，首先需要？", type: "card", cards: [["解析出 IP 地址", 1], ["直接发 HTTP", 0, "没有 IP 地址，无法建立连接"]],
                path: ["ALU"], at: "cpu", cap: cached ? "命中本地缓存，直接得到 IP" : "本地无缓存，要发 DNS 查询",
                rec: cached ? "域名解析：命中本地 DNS 缓存" : "域名解析：本地无缓存" });
              if (!cached) {
                s.push({ q: "DNS 查询用？", type: "card", cards: [["UDP 53", 1], ["TCP 80", 0, "DNS 查询一般用 UDP，端口 53；80 是 HTTP"]],
                  path: ["CU"], at: "cpu", cap: "封装 UDP 53 查询报文", rec: "DNS 查询走 UDP 53" });
                s.push({ q: "DNS 查询从哪发出？", type: "part", part: "nic", why: { bus: "总线只在主机内传，出主机要经网络接口" }, miss: "出主机要经网络接口",
                  path: ["BUS", "NIC", "CABLE", "NET", "CABLE", "NIC"], at: "nic", cap: "DNS 请求发出，拿回 IP 地址", rec: "经网卡发 DNS 查询，拿回 IP" });
              }
              if (o.conn === "new") {
                s.push({ q: "TCP 三次握手：按顺序依次点", type: "order", seq: ["SYN", "SYN+ACK", "ACK"], why: "三次握手顺序：客户端 SYN → 服务器 SYN+ACK → 客户端 ACK",
                  path: ["NIC", "CABLE", "NET", "CABLE", "NIC"], at: "nic", cap: "SYN → SYN+ACK → ACK，连接建立", rec: "三次握手：SYN → SYN+ACK → ACK" });
              }
              s.push({ q: "HTTP 请求向下封装，正确顺序？", type: "order", seq: ["报文段(TCP)", "分组(IP)", "帧(链路)"], why: "封装自上而下：传输层报文段 → 网络层分组 → 链路层帧",
                path: ["CU"], at: "cpu", cap: "HTTP → 报文段 → 分组 → 帧", rec: "HTTP 请求逐层封装：报文段 → 分组 → 帧" });
              s.push({ q: "帧从哪里发出？", type: "part", part: "nic", why: { bus: "总线只在主机内传，帧经网络接口发出" }, miss: "帧经网络接口发出",
                path: ["BUS", "NIC"], at: "nic", cap: "帧到达网卡，以比特流发出", rec: "帧经网卡发出" });
              s.push({ q: "跨网段时目的 MAC 是？", type: "card", cards: [["默认网关", 1], ["服务器", 0, "MAC 只在本网段有效，跨网段先交给网关"]],
                path: ["CABLE", "NET"], at: "nic", cap: "帧先发往默认网关，逐跳转发", rec: "目的 MAC 填默认网关，逐跳转发" });
              s.push({ q: "响应很大，发送窗口初始如何增长？", type: "card", cards: [["慢启动 · 指数增长", 1], ["一开始就线性", 0, "先慢启动指数增长，到门限后才线性增长"]],
                path: ["CABLE", "NIC"], at: "nic", cap: "响应返回；窗口按慢启动增长", rec: "响应返回，窗口按慢启动增长" });
              s.push({ q: "网卡收到帧后，谁把数据写进内存？", type: "part", part: "io", why: { cpu: "DMA 直接写内存，不占用 CPU", nic: "网卡只收帧，写内存靠 DMA" }, miss: "DMA 把数据直接写进内存",
                path: ["DMA", "BUS", "RAM"], at: "ram", cap: "DMA 写入内存，逐层解封装", rec: "DMA 把数据写入内存" });
              s.push({ q: "按什么交给浏览器进程？", type: "card", cards: [["端口号", 1], ["MAC 地址", 0, "MAC 只到主机；交给哪个进程看端口号"]],
                path: ["BUS", "CU"], at: "cpu", cap: "按端口号交给浏览器进程，页面显示", rec: "按端口号交给浏览器进程" });
              return s;
            }
          }
        };

        /* ---------- UI ---------- */
        function mk(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
        function btn(cls, text, fn) { var b = mk("button", cls, text); b.type = "button"; b.addEventListener("click", fn); return b; }

        var hud = mk("dl", "x-play-hud"); hud.hidden = true; hud.setAttribute("aria-label", "得分板");
        var hudN = mk("dd"), hudS = mk("dd"), hudE = mk("dd");
        [["步数", hudN], ["得分", hudS], ["失误", hudE]].forEach(function (r) { var d = mk("div"); d.appendChild(mk("dt", "", r[0])); d.appendChild(r[1]); hud.appendChild(d); });

        var bar = mk("div", "x-flowbar x-playbar"); bar.hidden = true; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "我来操作");
        var bText = mk("div", "x-flowbar__text"); bText.setAttribute("aria-live", "polite");
        var bMeta = mk("p", "x-flowbar__meta"), bQ = mk("p", "x-flowbar__title"), bLine = mk("p", "x-flowbar__line");
        bText.appendChild(bMeta); bText.appendChild(bQ); bText.appendChild(bLine);
        var bAns = mk("div", "x-play-ans"); bAns.setAttribute("role", "group"); bAns.setAttribute("aria-label", "答案");
        var bBtns = mk("div", "x-flowbar__btns");
        bBtns.appendChild(btn("x-panel__btn", "退出", function () { exit(); }));
        bar.appendChild(bText); bar.appendChild(bAns); bar.appendChild(bBtns);

        var setCard = mk("aside", "x-play-card"); setCard.hidden = true; setCard.setAttribute("role", "dialog"); setCard.setAttribute("aria-label", "选择情境");
        var endCard = mk("aside", "x-play-card"); endCard.hidden = true; endCard.setAttribute("role", "dialog"); endCard.setAttribute("aria-label", "通关结算");
        [hud, bar, setCard, endCard].forEach(function (e) { hero.appendChild(e); });

        /* ---------- state ---------- */
        var gid = null, game = null, opts = {}, steps = [], si = 0, score = 0, errs = 0, t0 = 0, mode = null;
        var tok = null, curA = null, flight = null, pulses = [], homing = false, timers = [];
        function later(fn, ms) { timers.push(setTimeout(fn, reduced ? Math.min(ms, 150) : ms)); }
        function clearLater() { timers.forEach(clearTimeout); timers = []; }

        /* ---------- token: a soft blob cloud with a short trail ---------- */
        function breathe(g, t) {
          g.children.forEach(function (s) {
            var d = s.userData; if (!d.o) return;
            var b = reduced ? 1 : 1 + 0.18 * Math.sin(t * 2.4 + d.ph);
            s.position.copy(d.o).multiplyScalar(b); s.scale.setScalar(d.sc * (reduced ? 1 : 1 + 0.12 * Math.sin(t * 3.1 + d.ph)));
          });
        }
        function makeTok() {
          var hex = F.palette.cobalt, lead = F.cloud(hex, 0.9), gh = [];
          for (var i = 0; i < 5; i++) { var c = F.cloud(hex, 0.4 * (1 - i / 5.5)); c.scale.setScalar(1 - i * 0.1); c.visible = false; root.add(c); gh.push(c); }
          root.add(lead); return { lead: lead, gh: gh };
        }
        function dropTok() {
          if (tok) { root.remove(tok.lead); tok.gh.forEach(function (c) { root.remove(c); }); tok = null; }
          pulses.forEach(function (p) { root.remove(p.g); }); pulses = []; flight = null;
        }
        function easeIO(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }
        function along(f, u) {
          var e = easeIO(Math.max(0, Math.min(1, u)));
          return f.curve ? f.curve.getPointAt(e) : f.pts[0].clone().lerp(f.pts[f.pts.length - 1], e);
        }
        function fly(path, done) {
          var a = F.anchors(), pts = [tok.lead.position.clone()].concat(path.map(function (n) { return a[n].clone(); }));
          flight = {
            pts: pts, curve: pts.length > 2 ? new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5) : null,
            t0: performance.now(), dur: Math.min(2800, 750 * (pts.length - 1)), done: done
          };
          curA = path[path.length - 1];
        }
        function pulse(part, good) {
          var a = F.anchors()[SPOT[part] || "BUS"]; if (!a) return;
          var g = F.cloud(good ? F.palette.sage : F.palette.brick, 0.75);
          g.position.copy(a); root.add(g); pulses.push({ g: g, t0: performance.now() });
          stage.querySelectorAll(".x-hot[data-part]").forEach(function (c) {
            if (norm(c.dataset.part) !== part) return;
            var cls = good ? "is-good" : "is-bad";
            c.classList.remove(cls); void c.offsetWidth; c.classList.add(cls);
            setTimeout(function () { c.classList.remove(cls); }, 800);
          });
        }

        var W = new V3(), D = new V3();
        H.pre.push(function (t) {
          if (homing) {
            cam.position.lerp(H.HOME_POS, 0.06); ctl.target.lerp(H.HOME_TGT, 0.06);
            if (cam.position.distanceTo(H.HOME_POS) < 0.02) homing = false;
          }
          if (!mode) return;
          var now = performance.now();
          if (tok) {
            if (flight) {
              var f = flight, u = reduced ? 1 : Math.min(1, (now - f.t0) / f.dur);
              tok.lead.position.copy(along(f, u));
              tok.gh.forEach(function (c, i) {
                var gu = u - (i + 1) * 0.045; c.visible = !reduced && gu > 0 && u < 1;
                if (c.visible) { c.position.copy(along(f, gu)); breathe(c, t + i * 0.3); }
              });
              if (u >= 1) { flight = null; f.done(); }
            } else if (curA) {
              var a = F.anchors()[curA]; if (a) tok.lead.position.lerp(a, 0.25);
            }
            breathe(tok.lead, t);
          }
          pulses = pulses.filter(function (p) {
            var k = (now - p.t0) / 750;
            if (k >= 1 || reduced && k > 0.4) { root.remove(p.g); return false; }
            p.g.scale.setScalar(1 + 1.8 * k); p.g.userData.mat.opacity = 0.75 * (1 - k); breathe(p.g, t);
            return true;
          });
          if (mode === "play" || mode === "busy") {
            ctl.autoRotate = false;
            if (tok && !reduced) {
              root.localToWorld(W.copy(tok.lead.position));
              D.copy(W).sub(ctl.target).multiplyScalar(0.025);
              ctl.target.add(D); cam.position.add(D);
            }
          }
        });

        /* ---------- flow of a round ---------- */
        function syncBtns() { playBtns.forEach(function (b) { b.setAttribute("aria-pressed", mode && b.dataset.play === gid ? "true" : "false"); }); }
        function enter() {
          if (F.on()) F.stop();
          var panel = document.getElementById("xpanel"); if (panel && panel.classList.contains("is-on")) document.getElementById("xp-back").click();
          homing = false; hero.classList.add("is-play");
        }
        function setup(id) {
          var g = GAMES[id]; if (!g) return;
          enter(); clearLater();
          if (gid !== id) { opts = {}; g.opts.forEach(function (o) { opts[o.k] = o.def; }); }
          gid = id; game = g; mode = "setup";
          if (!tok) tok = makeTok();
          curA = g.start; tok.lead.position.copy(F.anchors()[g.start]); flight = null;
          bar.hidden = true; endCard.hidden = true; hud.hidden = true;
          setCard.textContent = "";
          setCard.appendChild(mk("p", "x-play-card__tag", "我来操作 · " + g.name));
          setCard.appendChild(mk("h3", "", "先定情境"));
          setCard.appendChild(mk("p", "x-play-card__sub", "情境决定数据走哪条路。每答对一步 +10 分。"));
          var first = null;
          g.opts.forEach(function (o) {
            var fs = mk("fieldset", "x-play-opt"), pills = mk("div", "x-play-pills");
            fs.appendChild(mk("legend", "", o.label));
            o.ch.forEach(function (c) {
              var p = btn("x-play-pill", c[1], function () {
                opts[o.k] = c[0];
                pills.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === p ? "true" : "false"); });
              });
              p.setAttribute("aria-pressed", opts[o.k] === c[0] ? "true" : "false");
              pills.appendChild(p); if (!first) first = p;
            });
            fs.appendChild(pills); setCard.appendChild(fs);
          });
          var bs = mk("div", "x-panel__btns");
          var go = btn("x-panel__btn x-panel__btn--main", "开始", begin);
          bs.appendChild(go); bs.appendChild(btn("x-panel__btn", "取消", function () { exit(); }));
          setCard.appendChild(bs);
          setCard.hidden = false; syncBtns();
          go.focus({ preventScroll: true });
        }
        function begin() {
          clearLater();
          steps = game.steps(opts); si = 0; score = 0; errs = 0; t0 = performance.now(); mode = "play";
          curA = game.start; flight = null; tok.lead.position.copy(F.anchors()[game.start]);
          setCard.hidden = true; endCard.hidden = true; hud.hidden = false; bar.hidden = false;
          showStep(true);
        }
        function updHud() { hudN.textContent = Math.min(si + 1, steps.length) + "/" + steps.length; hudS.textContent = score; hudE.textContent = errs; }
        function setLine(text, cls) { bLine.textContent = text; bLine.className = "x-flowbar__line" + (cls ? " " + cls : ""); }
        function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
        function showStep(focus) {
          var s = steps[si]; mode = "play";
          bMeta.textContent = game.name + " · 第 " + (si + 1) + "/" + steps.length + " 步";
          bQ.textContent = s.q;
          setLine(s.type === "part" ? "在板上点选部件，或点它的标签" : s.type === "order" ? "按顺序依次点选" : "选一个答案", "");
          bAns.textContent = "";
          if (s.type === "card") shuffle(s.cards).forEach(function (c) {
            var b = btn("", c[0], function () { answerCard(b, c); }); bAns.appendChild(b);
          });
          if (s.type === "order") { s._k = 0; shuffle(s.seq).forEach(function (l) {
            var b = btn("", l, function () { answerOrder(b, l); }); bAns.appendChild(b);
          }); }
          updHud();
          if (focus) { var f = bAns.querySelector("button"); if (f) f.focus({ preventScroll: true }); }
        }
        function shake() { bar.classList.remove("is-shake"); void bar.offsetWidth; bar.classList.add("is-shake"); }
        function correctOf(s) {
          if (s.type === "card") return s.cards.filter(function (c) { return c[1]; }).map(function (c) { return c[0]; }).join(" / ");
          if (s.type === "order") return s.seq.join(" → ");
          return NAMES[s.part] || s.part;
        }
        function optionsOf(s) {
          if (s.type === "card") return s.cards.map(function (c) { return c[0]; });
          if (s.type === "order") return s.seq.slice();
          return Object.keys(NAMES).filter(function (k) { return k !== "board"; }).map(function (k) { return NAMES[k]; });
        }
        function wrong(why, part, chosen) {
          var st = steps[si];
          if (st && window.LAB_EMIT) LAB_EMIT("flow_mistake", {
            flowId: gid, stepIndex: si, stepType: st.type === "order" ? "order" : "single", question: st.q,
            chosen: String(chosen == null ? "" : chosen), correct: correctOf(st), explanation: why, options: optionsOf(st)
          });
          errs++; updHud(); shake();
          setLine("✗ 解析：" + why, "is-why");
          if (part) pulse(part, false);
        }
        function right() {
          var s = steps[si], focusIn = bar.contains(document.activeElement);
          mode = "busy"; score += 10; updHud();
          bAns.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
          setLine("✓ " + s.cap + "　+10 分", "is-ok");
          fly(s.path, function () {
            pulse(s.at, true);
            later(function () {
              if (mode !== "busy") return;
              si++;
              if (si >= steps.length) finish(); else showStep(focusIn);
            }, 750);
          });
        }
        function answerCard(b, c) {
          if (mode !== "play") return;
          if (c[1]) { b.classList.add("is-good"); right(); }
          else { b.classList.add("is-bad"); b.disabled = true; wrong(c[2], null, c[0]); var n = bAns.querySelector("button:not(:disabled)"); if (n) n.focus({ preventScroll: true }); }
        }
        function answerOrder(b, l) {
          if (mode !== "play") return;
          var s = steps[si];
          if (l === s.seq[s._k]) {
            b.classList.add("is-good"); b.disabled = true; s._k++;
            if (s._k >= s.seq.length) right();
            else { setLine("✓ " + s.seq.slice(0, s._k).join(" → ") + " → …", "is-ok"); var n = bAns.querySelector("button:not(:disabled)"); if (n) n.focus({ preventScroll: true }); }
          } else wrong(s.why, null, (s._k ? s.seq.slice(0, s._k).join(" → ") + " → " : "") + l);
        }
        function answerPart(id) {
          if (mode !== "play" || !id) return;
          var s = steps[si];
          if (s.type !== "part") { setLine("这一步请在下方选一个答案", ""); shake(); return; }
          if (id === s.part) { pulse(id, true); right(); }
          else wrong((s.why && s.why[id]) || ((NAMES[id] || id) + " 不对。" + s.miss), id, NAMES[id] || id);
        }
        function finish() {
          mode = "end"; bar.hidden = true;
          var ms = performance.now() - t0, sec = Math.round(ms / 1000), stars = errs === 0 ? 3 : errs <= 2 ? 2 : 1;
          if (window.LAB_EMIT) LAB_EMIT("flow_finished", { flowId: gid, stars: stars, mistakes: errs, timeMs: Math.round(ms), score: score, steps: steps.length, options: JSON.parse(JSON.stringify(opts)) });
          var o = game.opts.map(function (x) { var c = x.ch.filter(function (c) { return c[0] === opts[x.k]; })[0]; return x.label + " " + (c ? c[1] : ""); }).join(" · ");
          endCard.textContent = "";
          endCard.appendChild(mk("p", "x-play-card__tag", game.name + " · " + o));
          endCard.appendChild(mk("h3", "", errs === 0 ? "一次走通！" : "走通了"));
          var st = mk("p", "x-play-stars"); st.setAttribute("aria-label", stars + " 星（满分 3 星）");
          st.innerHTML = "★★★".slice(0, stars) + "<i>" + "★★★".slice(stars) + "</i>";
          endCard.appendChild(st);
          var dl = mk("dl", "x-play-stats");
          [["用时", Math.floor(sec / 60) + ":" + ("0" + sec % 60).slice(-2)], ["失误", errs], ["得分", score]].forEach(function (r) {
            var d = mk("div"); d.appendChild(mk("dt", "", r[0])); d.appendChild(mk("dd", "", String(r[1]))); dl.appendChild(d);
          });
          endCard.appendChild(dl);
          endCard.appendChild(mk("h4", "", "正确路径"));
          var ol = mk("ol"); steps.forEach(function (s) { ol.appendChild(mk("li", "", s.rec)); }); endCard.appendChild(ol);
          var bs = mk("div", "x-panel__btns"), again = btn("x-panel__btn x-panel__btn--main", "再玩一次", begin);
          bs.appendChild(again);
          bs.appendChild(btn("x-panel__btn", "换个情境", function () { setup(gid); }));
          bs.appendChild(btn("x-panel__btn", "看演示", function () { var id = gid; exit(); F.start(id); }));
          endCard.appendChild(bs);
          endCard.hidden = false; updHud(); hudN.textContent = steps.length + "/" + steps.length;
          again.focus({ preventScroll: true });
        }
        function exit() {
          if (!mode) return;
          var was = gid;
          mode = null; clearLater(); dropTok(); curA = null;
          bar.hidden = true; hud.hidden = true; setCard.hidden = true; endCard.hidden = true;
          hero.classList.remove("is-play"); syncBtns();
          if (!F.on()) { homing = !reduced; if (reduced) { cam.position.copy(H.HOME_POS); ctl.target.copy(H.HOME_TGT); } ctl.autoRotate = !reduced && !H.focusKey(); }
          var b = flowsRow.querySelector('button[data-play="' + was + '"]'), ae = document.activeElement;
          if (b && !F.on() && (!ae || ae === document.body || hero.contains(ae))) b.focus({ preventScroll: true });
        }

        /* ---------- input ---------- */
        flowsRow.addEventListener("click", function (ev) {
          var p = ev.target.closest("button[data-play]");
          if (p) { if (p.disabled) return; if (mode && gid === p.dataset.play) exit(); else setup(p.dataset.play); return; }
          if (ev.target.closest("button[data-flow]") && mode) exit(); /* 看演示 takes over */
        });
        document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && mode) { ev.preventDefault(); exit(); } });
        ctl.addEventListener("start", function () { homing = false; });
        /* hotspot chips answer instead of focusing */
        var layer = stage.querySelector(".x-hots");
        if (layer) layer.addEventListener("click", function (ev) {
          var c = ev.target.closest(".x-hot[data-part]"); if (!c || !mode) return;
          ev.stopPropagation(); ev.preventDefault(); answerPart(norm(c.dataset.part));
        }, true);
        /* the parts row too */
        var partsRow = document.getElementById("xparts");
        if (partsRow) partsRow.addEventListener("click", function (ev) {
          var b = ev.target.closest("button[data-k]"); if (!b || !mode) return;
          ev.stopPropagation(); ev.preventDefault(); answerPart(norm(b.dataset.k));
        }, true);
        /* parts on the board */
        var cv = stage.querySelector("canvas"), down = null;
        if (cv) {
          cv.addEventListener("pointerdown", function (ev) { down = { x: ev.clientX, y: ev.clientY }; });
          cv.addEventListener("pointerup", function (ev) {
            if (!down || !mode) { down = null; return; }
            var moved = Math.abs(ev.clientX - down.x) + Math.abs(ev.clientY - down.y) > 8; down = null;
            if (moved || mode !== "play") return;
            var g = H.pick && H.pick(ev); if (g && g.userData.id !== "board") answerPart(norm(g.userData.id));
          });
        }

        window.PLAY = { games: GAMES, setup: setup, begin: begin, exit: exit, on: function () { return !!mode; } };
      })();
    
