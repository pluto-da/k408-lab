      /* 流程演示: gaussian data tokens travelling between hero parts. window.FLOW.start(id) / stop() */
      (function () {
        var THREE = window.THREE, PARTS = window.PARTS;
        var bar = document.getElementById("xflowbar"), hero = document.getElementById("hero"), flowsRow = document.getElementById("xflows");
        if (!THREE || !PARTS || !PARTS.length || !bar) { if (flowsRow) flowsRow.hidden = true; return; }
        var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
        var root = PARTS[0].parent;
        var PAL = { brick: 0xc2512b, cobalt: 0x2d4fa3, ochre: 0xd9a21b, sage: 0x5e8c61 };

        /* radial gaussian falloff texture, alpha = exp(-r²) */
        var tex = (function () {
          var n = 64, c = document.createElement("canvas"); c.width = c.height = n;
          var ctx = c.getContext("2d"), img = ctx.createImageData(n, n);
          for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
            var dx = (x + 0.5) / n * 2 - 1, dy = (y + 0.5) / n * 2 - 1, r = Math.sqrt(dx * dx + dy * dy) * 2.6, k = (y * n + x) * 4;
            img.data[k] = img.data[k + 1] = img.data[k + 2] = 255; img.data[k + 3] = Math.round(255 * Math.exp(-r * r));
          }
          ctx.putImageData(img, 0, 0); return new THREE.CanvasTexture(c);
        })();
        function gauss() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
        function cloud(hex, opacity) {
          var g = new THREE.Group(), mat = new THREE.SpriteMaterial({ map: tex, color: hex, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.NormalBlending });
          for (var i = 0; i < 30; i++) {
            var s = new THREE.Sprite(mat), o = new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(0.07);
            s.userData = { o: o, ph: Math.random() * 6.28, sc: 0.12 + Math.random() * 0.1 };
            s.position.copy(o); s.scale.setScalar(s.userData.sc); g.add(s);
          }
          g.userData = { mat: mat, base: opacity }; g.renderOrder = 10; return g;
        }
        function breathe(g, t) {
          g.children.forEach(function (s) {
            var d = s.userData, b = reduced ? 1 : 1 + 0.18 * Math.sin(t * 2.4 + d.ph);
            s.position.copy(d.o).multiplyScalar(b); s.scale.setScalar(d.sc * (reduced ? 1 : 1 + 0.12 * Math.sin(t * 3.1 + d.ph)));
          });
        }
        function easeIO(p) { return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; }

        /* anchor points, root-local, from the real part positions */
        function partById(id) { return PARTS.filter(function (p) { return p.userData.id === id; })[0]; }
        /* live: the group's current world position (it sits on the motherboard now), root-local.
           Offsets keep the old board frame (dx right, dy along the board, dz out of it); the board lies flat, so out = up. */
        function at(id, dx, dy, dz) {
          var p = partById(id); p.updateMatrixWorld(true);
          var w = root.worldToLocal(p.getWorldPosition(new THREE.Vector3()));
          return w.add(new THREE.Vector3(dx || 0, dz || 0, -(dy || 0)));
        }
        function A() {
          var ram = at("ram1").lerp(at("ram2"), 0.5).add(new THREE.Vector3(0, 0, 0.6));
          return {
            PC: at("cpu", -0.32, 0.32, 0.45), MAR: at("cpu", 0.4, 0.32, 0.45), MDR: at("cpu", 0.4, -0.05, 0.45),
            CACHE: at("cpu", 0.32, -0.34, 0.45), IR: at("cpu", -0.3, -0.05, 0.45), CU: at("cpu", -0.05, 0.4, 0.5),
            ALU: at("cpu", 0.15, 0.05, 0.55), REG: at("cpu", -0.32, -0.36, 0.45),
            BUS: at("bus", 0, 0.05, 0.5), BUSHI: at("bus", 0, 0.45, 0.75), BUSLO: at("bus", 0, -0.35, 0.75), RAM: ram,
            TLB: at("cpu", -0.02, -0.38, 0.5), PROC: at("os", 0.6, 1.42, 0.25), OS: at("os", -0.3, 1.25, 0.2),
            OSR: at("os", 1.6, 0.6, 0.2), DMA: at("io", 0, 0, 0.35), DISK: at("disk", 0, 0.3, 0.3),
            NIC: at("nic", 0, 0.15, 0.35), CABLE: at("nic", -1.1, 0, 0.3), NET: at("nic", -2.4, -0.3, 0.6)
          };
        }

        var FLOWS = {
          life: {
            name: "一条指令的一生",
            steps: [
              { t: "PC 发地址", l: "PC 的内容送 MAR，经地址总线发出", parts: ["cpu", "bus"], k: [{ c: "brick", p: ["PC", "MAR", "BUSHI", "BUS"] }] },
              { t: "查 Cache", l: "先查 Cache：命中则直接取，不命中访问主存", parts: ["cpu"], k: [{ c: "brick", p: ["MAR", "ALU", "CACHE"] }] },
              { t: "访问主存", l: "按地址读出指令所在的块", parts: ["bus", "ram1", "ram2"], k: [{ c: "brick", p: ["CACHE", "BUSLO", "BUS", "RAM"] }] },
              { t: "回填 Cache 并送 IR", l: "整块调入 Cache，指令送 MDR→IR", parts: ["ram1", "ram2", "bus", "cpu"], k: [{ c: "ochre", p: ["RAM", "BUS", "BUSLO", "CACHE"] }, { c: "cobalt", d: 0.45, p: ["RAM", "BUS", "MDR", "IR"] }] },
              { t: "译码", l: "控制器 CU 译码，产生控制信号", parts: ["cpu"], k: [{ c: "cobalt", p: ["IR", "CU"] }, { c: "sage", d: 0.5, p: ["CU", "ALU"] }] },
              { t: "执行", l: "ALU 运算；取操作数时可能再次访存", parts: ["cpu", "bus"], k: [{ c: "ochre", p: ["REG", "ALU"] }, { c: "brick", d: 0.5, p: ["ALU", "MAR", "BUSHI"] }] },
              { t: "写回 & PC+1", l: "结果写回寄存器，PC 指向下一条指令", parts: ["cpu"], k: [{ c: "ochre", p: ["ALU", "REG"] }, { c: "brick", d: 0.35, p: ["PC", "CU", "PC"] }] }
            ]
          },
          pagefault: {
            name: "缺页中断",
            steps: [
              { t: "进程访问逻辑地址", l: "CPU 给出逻辑地址：页号 + 页内偏移", parts: ["os", "cpu"], k: [{ c: "brick", p: ["PROC", "CU", "MAR"] }] },
              { t: "查 TLB", l: "快表未命中", parts: ["cpu"], k: [{ c: "brick", p: ["MAR", "ALU", "TLB"] }] },
              { t: "查页表", l: "访问主存中的页表：该页状态位 = 0，不在内存", parts: ["cpu", "bus", "ram1", "ram2"], k: [{ c: "brick", p: ["TLB", "BUSLO", "BUS", "RAM"] }] },
              { t: "缺页中断", l: "产生缺页中断，陷入内核，进程阻塞", parts: ["cpu", "os"], k: [{ c: "sage", p: ["CU", "OS"] }] },
              { t: "选择淘汰页", l: "内存已满：按置换算法（如 LRU）选出淘汰页，脏页先写回", parts: ["os", "ram1", "ram2"], k: [{ c: "ochre", p: ["OS", "OSR", "RAM"] }] },
              { t: "DMA 调页", l: "启动磁盘 I/O，DMA 将整页直接送入页框，不经 CPU", parts: ["disk", "io", "ram1", "ram2"], k: [{ c: "cobalt", p: ["DISK", "DMA", "RAM"] }] },
              { t: "修改页表", l: "更新页表与 TLB，状态位置 1", parts: ["os", "ram1", "ram2"], k: [{ c: "ochre", p: ["OS", "OSR", "RAM"] }] },
              { t: "重新执行", l: "进程唤醒，重新执行引发缺页的那条指令", parts: ["os", "cpu"], k: [{ c: "sage", p: ["OS", "PROC", "CU", "MAR"] }] }
            ]
          },
          web: {
            name: "访问一个网页",
            steps: [
              { t: "输入网址", l: "浏览器进程发起请求", parts: ["os", "cpu"], k: [{ c: "brick", p: ["PROC", "CU"] }] },
              { t: "DNS 查询", l: "UDP 53 端口：域名解析为 IP 地址", parts: ["cpu", "bus", "nic"], w: 3800, k: [{ c: "cobalt", p: ["CU", "BUS", "NIC", "CABLE", "NET"] }, { c: "ochre", d: 1.1, p: ["NET", "CABLE", "NIC", "BUS", "CU"] }] },
              { t: "TCP 三次握手", l: "SYN → SYN+ACK → ACK，连接建立", parts: ["nic"], w: 4400, k: [{ c: "cobalt", p: ["NIC", "CABLE", "NET"] }, { c: "ochre", d: 0.95, p: ["NET", "CABLE", "NIC"] }, { c: "sage", d: 1.9, p: ["NIC", "CABLE", "NET"] }] },
              { t: "HTTP 请求逐层封装", l: "HTTP 报文 → TCP 报文段 → IP 分组 → 帧", parts: ["cpu", "bus", "nic"], w: 2800, k: [{ c: "brick", p: ["CU", "BUS", "NIC"], sc: [0.8, 1.15, 1.5, 1.85] }] },
              { t: "发送出网卡", l: "物理层以比特流发出，经路由器逐跳转发", parts: ["nic"], k: [{ c: "brick", p: ["NIC", "CABLE", "NET"], sc: [1.85] }] },
              { t: "服务器响应", l: "HTTP 响应返回；拥塞窗口按慢启动增长", parts: ["nic"], k: [{ c: "ochre", p: ["NET", "CABLE", "NIC"], sc: [1.85] }] },
              { t: "逐层解封装", l: "网卡收帧，DMA 写入内存，逐层去首部", parts: ["nic", "io", "bus", "ram1", "ram2"], w: 2800, k: [{ c: "ochre", p: ["NIC", "DMA", "BUS", "RAM"], sc: [1.85, 1.5, 1.15, 0.8] }] },
              { t: "交给进程", l: "按端口号交给浏览器进程，页面显示", parts: ["ram1", "ram2", "bus", "os"], k: [{ c: "sage", p: ["RAM", "BUS", "PROC"] }] }
            ]
          }
        };

        var cur = null, idx = 0, playing = false, timer = null, tokens = [], stepT0 = 0, fadeBack = false;
        var TRAVEL = 1500, DWELL = 2200;
        var $ = function (id) { return document.getElementById(id); };

        function clearTokens() { tokens.forEach(function (k) { k.lead.parent && root.remove(k.lead); k.ghosts.forEach(function (g) { root.remove(g); }); }); tokens = []; }
        function buildStep() {
          clearTokens();
          var a = A(), s = cur.steps[idx];
          s.k.forEach(function (spec) {
            var pts = spec.p.map(function (n) { return a[n].clone(); });
            var curve = pts.length > 1 ? new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5) : null;
            var hex = PAL[spec.c], lead = cloud(hex, 0.85), ghosts = [];
            for (var i = 0; i < 6; i++) { var g = cloud(hex, 0.42 * (1 - i / 6.5)); g.scale.setScalar(1 - i * 0.08); ghosts.push(g); root.add(g); }
            root.add(lead);
            tokens.push({ curve: curve, pts: pts, segs: Math.max(1, pts.length - 1), delay: (spec.d || 0) * TRAVEL, lead: lead, ghosts: ghosts, sc: spec.sc || null });
          });
          stepT0 = performance.now();
          $("xf-flow").textContent = cur.name;
          $("xf-num").textContent = (idx + 1) + "/" + cur.steps.length;
          $("xf-title").textContent = s.t; $("xf-line").textContent = s.l;
          $("xf-prev").disabled = idx === 0;
        }
        function posAt(k, u) {
          if (!k.curve) return k.pts[0].clone();
          var x = Math.max(0, Math.min(1, u)) * k.segs, s = Math.min(Math.floor(x), k.segs - 1), p = x - s;
          return k.curve.getPoint((s + easeIO(Math.min(1, p))) / k.segs);
        }

        /* fade + glow on part materials */
        function involved(o) {
          if (!cur) return false;
          var ids = cur.steps[idx].parts;
          for (var p = o; p; p = p.parent) if (PARTS.indexOf(p) >= 0) return ids.indexOf(p.userData.id) >= 0;
          return false;
        }
        function applyMats(t) {
          var done = true;
          root.traverse(function (o) {
            if (!o.material || o.isSprite || Array.isArray(o.material) || o.material.userData.nofade) return;
            var m = o.material, inv = involved(o), ud = m.userData, base = ud.o != null ? ud.o : 1;
            var to = cur ? (inv ? base : base * (ud.glb ? 0.4 : 0.15)) : base;
            if (cur && to < 1) { m.transparent = true; if (!ud.glb) m.depthWrite = false; }
            m.opacity += (to - m.opacity) * (reduced ? 1 : 0.12);
            if (Math.abs(to - m.opacity) > 0.01) done = false; else m.opacity = to;
            if (m.emissive) {
              if (cur && inv) m.emissive.setHex(0xd9a21b).multiplyScalar(0.14 + (reduced ? 0 : 0.06 * Math.sin(t * 3)));
              else m.emissive.setHex(0x000000);
            }
            if (!cur && m.opacity === 1 && m.transparent && !ud.tr) { m.transparent = false; m.depthWrite = ud.dw !== false; m.needsUpdate = true; }
          });
          return done;
        }

        function loop() {
          if (!cur && !fadeBack) return;
          requestAnimationFrame(loop);
          var now = performance.now(), t = now / 1000;
          if (!cur) { if (applyMats(t)) fadeBack = false; return; }
          applyMats(t);
          tokens.forEach(function (k) {
            var u = reduced ? 1 : (now - stepT0 - k.delay) / TRAVEL;
            k.lead.visible = u > 0 || reduced;
            k.lead.position.copy(posAt(k, u)); breathe(k.lead, t);
            var sz = 1;
            if (k.sc) {
              var uc = Math.max(0, Math.min(0.999, u)), n = k.sc.length, si = Math.floor(uc * n), ph = uc * n - si;
              sz = k.sc[si] * (reduced || n < 2 ? 1 : 1 + 0.18 * Math.exp(-ph * 6) * (si > 0 ? 1 : 0));
              if (reduced || u >= 1) sz = k.sc[n - 1];
            }
            k.lead.scale.setScalar(sz);
            k.ghosts.forEach(function (g, i) {
              var gu = u - (i + 1) * 0.045;
              g.visible = !reduced && gu > 0 && u < 1.25;
              if (g.visible) { g.position.copy(posAt(k, gu)); g.scale.setScalar(sz * (1 - i * 0.08)); breathe(g, t + i * 0.3); }
            });
          });
        }

        function schedule() {
          clearTimeout(timer);
          if (!playing || !cur) return;
          timer = setTimeout(function () {
            if (idx < cur.steps.length - 1) { idx++; buildStep(); schedule(); }
            else setPlaying(false);
          }, cur.steps[idx].w || DWELL);
        }
        function setPlaying(p) { playing = p; $("xf-play").textContent = p ? "暂停" : "播放"; $("xf-play").setAttribute("aria-pressed", p ? "true" : "false"); schedule(); }
        function go(i) { if (!cur) return; idx = Math.max(0, Math.min(cur.steps.length - 1, i)); buildStep(); schedule(); }
        function sync(id) { flowsRow.querySelectorAll("button[data-flow]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.flow === id ? "true" : "false"); }); }

        function start(id) {
          var f = FLOWS[id]; if (!f) return;
          var panel = $("xpanel"); if (panel && panel.classList.contains("is-on")) $("xp-back").click();
          var wasRunning = !!cur || fadeBack;
          cur = f; idx = 0; fadeBack = false;
          bar.hidden = false; hero.classList.add("is-flow"); sync(id);
          buildStep(); setPlaying(!reduced);
          if (!wasRunning) requestAnimationFrame(loop);
          if (window.LAB_EMIT) LAB_EMIT("flow_viewed", { flowId: id });
        }
        function stop() {
          if (!cur) return;
          clearTimeout(timer); playing = false; clearTokens(); cur = null; fadeBack = true;
          bar.hidden = true; hero.classList.remove("is-flow"); sync(null);
        }

        $("xf-prev").addEventListener("click", function () { go(idx - 1); });
        $("xf-next").addEventListener("click", function () { if (cur && idx === cur.steps.length - 1) setPlaying(false); else go(idx + 1); });
        $("xf-play").addEventListener("click", function () {
          if (!cur) return;
          if (!playing && idx === cur.steps.length - 1) { idx = 0; buildStep(); }
          setPlaying(!playing);
        });
        $("xf-exit").addEventListener("click", stop);
        document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && cur) stop(); });
        flowsRow.addEventListener("click", function (ev) {
          var b = ev.target.closest("button[data-flow]"); if (!b) return;
          if (cur === FLOWS[b.dataset.flow]) stop(); else start(b.dataset.flow);
        });
        /* picking a part leaves the flow */
        var partsRow = $("xparts"); if (partsRow) partsRow.addEventListener("click", function () { if (cur) stop(); }, true);

        window.FLOW = { flows: FLOWS, palette: PAL, start: start, stop: stop, go: go, cloud: cloud, anchors: A, on: function () { return !!cur; } };
      })();
    
