      /* §01 three.js exploded computer, SVG fallback on failure */
      (function () {
        var hero = document.getElementById("hero"), stage = document.getElementById("stage");
        function fail() { hero.classList.add("is-fallback"); stage.innerHTML = ""; document.getElementById("hint").textContent = "示意图"; }
        try {
          var test = document.createElement("canvas");
          if (!(test.getContext("webgl2") || test.getContext("webgl"))) return fail();
        } catch (e) { return fail(); }
        if (typeof window.THREE === "undefined" || typeof THREE.OrbitControls !== "function") return fail();
        try { build(window.THREE, THREE.OrbitControls); } catch (e) { if (window.console) console.error(e); fail(); }

        function build(THREE, OrbitControls) {
          var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.outputEncoding = THREE.sRGBEncoding;
          renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
          renderer.physicallyCorrectLights = true;
          renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          renderer.setClearColor(0x000000, 0);
          stage.appendChild(renderer.domElement);
          var scene = new THREE.Scene();
          var pmrem = new THREE.PMREMGenerator(renderer);
          scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
          var camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
          /* low 3/4 view, cooler front-left */
          var HOME_POS = new THREE.Vector3(-9.6, 5.4, -4.4), HOME_TGT = new THREE.Vector3(0, 0, 0);
          camera.position.copy(HOME_POS);

          scene.add(new THREE.HemisphereLight(0xcfd8ea, 0x1a1c20, 0.35));
          var sun = new THREE.DirectionalLight(0xffe2bf, 2.2); sun.position.set(-3.2, 8.5, -7);
          sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
          var sc = sun.shadow.camera; sc.left = -4.4; sc.right = 4.4; sc.top = 4.4; sc.bottom = -4.4; sc.near = 2; sc.far = 22;
          sun.shadow.bias = -0.0004; sun.shadow.radius = 4;
          scene.add(sun); scene.add(sun.target);
          var rim = new THREE.DirectionalLight(0xa9c4ff, 1.2); rim.position.set(3.4, 4.5, 8); scene.add(rim);

          function clay(hex) { return new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25 }); }
          var edgeMat = (function (m) { m.userData = { o: 0.35, tr: true, dw: true }; return m; })(new THREE.LineBasicMaterial({ color: 0x16181d, transparent: true, opacity: 0.35 }));
          function mesh(geo, mat, parent, x, y, z) {
            var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0);
            m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat));
            parent.add(m); return m;
          }
          var root = new THREE.Group(); scene.add(root);
          var paperMat = clay(0xf2efe8), inkMat = clay(0x2a2d33);
          var slabs = window.PARTS = [];
          var BRICK = 0xc2512b, OCHRE = 0xd9a21b, COBALT = 0x2d4fa3, TEAL = 0x1f7a6d;
          var caseMat = clay(0xdcd6c8), boardMat = clay(0xe6e0d2);
          function V(x, y, z) { return new THREE.Vector3(x, y, z); }
          function part(id, name, subject, x, y, z, dir, bob) {
            var g = new THREE.Group(); g.position.set(x, y, z);
            g.userData = { id: id, name: name, subject: subject, base: g.position.clone(), dir: dir || V(0, 0, 0.35), bob: !!bob, lift: 0 };
            root.add(g); slabs.push(g); return g;
          }
          function B(w, h, d) { return new THREE.BoxGeometry(w, h, d); }

          /* open case, side panel removed: back, floor, top */
          var shell = new THREE.Group(); root.add(shell);
          mesh(B(6.4, 5.2, 0.12), caseMat, shell, 0, 0, -1.6);
          mesh(B(6.4, 0.12, 3.4), caseMat, shell, 0, -2.6, 0.1);
          mesh(B(6.4, 0.12, 3.4), caseMat, shell, 0, 2.6, 0.1);

          /* 主板 standing against the back */
          var board = part("board", "主板", "co", 0, 0.1, -1.48, V(0, 0, 0));
          mesh(B(5.2, 4.4, 0.1), boardMat, board);

          /* CPU on socket */
          var cpu = part("cpu", "CPU", "co", -0.9, 0.9, -1.3);
          mesh(B(1.2, 1.2, 0.16), inkMat, cpu);
          mesh(B(0.85, 0.85, 0.18), clay(BRICK), cpu, 0, 0, 0.17);

          /* 2 内存条 */
          [0.75, 1.1].forEach(function (x, n) {
            var r = part("ram" + (n + 1), "内存条 " + (n + 1), "co", x, 0.9, -1.2);
            mesh(B(0.22, 2.3, 0.1), inkMat, r, 0, 0, -0.18);
            mesh(B(0.14, 2.2, 0.4), clay(BRICK), r, 0, 0, 0.06);
          });

          /* I/O + DMA chip */
          var io = part("io", "I/O + DMA 芯片", "co", -0.9, -0.8, -1.32);
          mesh(B(0.75, 0.75, 0.2), clay(BRICK), io);

          /* 数据结构: teal blocks on the bus between memory and CPU */
          var bus = part("bus", "数据结构 · 总线", "ds", 0.15, 0.9, -1.38, V(0, 0, 0.2));
          mesh(B(0.9, 0.36, 0.04), clay(0x9fc7bf), bus);
          var bits = [], bg = B(0.14, 0.14, 0.14);
          for (var b = 0; b < 3; b++) bits.push(mesh(bg, clay(TEAL), bus, 0, 0, 0.1));

          /* 硬盘 in a drive bay */
          var disk = part("disk", "硬盘", "os", 1.9, -2.1, 0.4, V(0, 0, 0.5));
          mesh(B(0.08, 0.8, 2.0), caseMat, disk, -0.75, 0, 0);
          mesh(B(0.08, 0.8, 2.0), caseMat, disk, 0.75, 0, 0);
          mesh(B(1.58, 0.06, 2.0), caseMat, disk, 0, 0.4, 0);
          mesh(B(1.3, 0.45, 1.7), clay(OCHRE), disk, 0, -0.1, 0);

          /* 网卡 slot card, short cable out the back with packets */
          var nic = part("nic", "网卡", "cn", -1.7, -1.75, -0.9, V(0, 0.35, 0));
          mesh(B(0.2, 0.12, 1.2), inkMat, nic, 0, -0.42, 0);
          mesh(B(0.08, 0.75, 1.1), clay(COBALT), nic);
          var curve = new THREE.CatmullRomCurve3([
            V(0, -0.2, -0.55), V(0, -0.25, -0.95), V(-0.6, -0.5, -1.4), V(-1.6, -0.7, -1.3)
          ]);
          nic.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.06, 8), clay(COBALT)));
          mesh(B(0.3, 0.24, 0.24), clay(COBALT), nic, -1.7, -0.7, -1.3);
          var pkts = [], pg = B(0.16, 0.16, 0.16);
          for (var q = 0; q < 4; q++) pkts.push(mesh(pg, paperMat, nic));

          /* 操作系统: thin ochre frame floating above the board, PCB queue toward the CPU */
          var os = part("os", "操作系统", "os", 0, 0.9, -0.55, V(0, 0, 0.4), true);
          mesh(B(4.4, 0.1, 0.06), clay(OCHRE), os, 0, 1.25, 0);
          mesh(B(4.4, 0.1, 0.06), clay(OCHRE), os, 0, -1.25, 0);
          mesh(B(0.1, 2.6, 0.06), clay(OCHRE), os, -2.2, 0, 0);
          mesh(B(0.1, 2.6, 0.06), clay(OCHRE), os, 2.2, 0, 0);
          var pcbGeo = B(0.32, 0.24, 0.3), pcbs = [];
          for (var i = 0; i < 3; i++) pcbs.push(mesh(pcbGeo, i === 0 ? inkMat : paperMat, os, 0, 1.42, 0));

          root.position.y = 0.4;
          /* board spans ~5.65 units: these distances keep it at ~95% (near) to ~40% (far) of the view */
          var MIN_D = 9.2, MAX_D = 21.5;
          var controls = new OrbitControls(camera, renderer.domElement);
          controls.enableDamping = true; controls.dampingFactor = 0.06; controls.enablePan = false;
          controls.minDistance = MIN_D; controls.maxDistance = MAX_D;
          controls.minPolarAngle = 0.25; controls.maxPolarAngle = 1.25;
          controls.autoRotate = !X.reduced; controls.autoRotateSpeed = 0.25; /* 2.0 = 2 rpm, so 0.25 = 0.25 rpm */
          controls.target.copy(HOME_TGT);
          renderer.domElement.style.touchAction = "pan-y"; /* vertical swipe scrolls the page on touch; horizontal drag orbits */

          var info = {
            ds: { name: "数据结构", score: 45 }, co: { name: "计算机组成原理", score: 45 },
            os: { name: "操作系统", score: 35 }, cn: { name: "计算机网络", score: 25 }
          };
          var callout = document.getElementById("callout"), active = null;
          function setActive(g) {
            if (active === g) return;
            active = g;
            if (!g) { callout.classList.remove("is-on"); return; }
            var id = g.userData.subject, s = X.bySubject(id);
            callout.style.setProperty("--c", s.color);
            callout.innerHTML = "<span>" + s.short + " · §0" + (["ds", "co", "os", "cn"].indexOf(id) + 3) + "</span><strong>" + g.userData.name +
              "</strong><span>" + info[id].name + " · 分值 " + info[id].score + " / 150</span><br><a href=\"#" + id + "\">跳转到该科 →</a>";
            callout.classList.add("is-on");
          }
          var ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
          function pick(ev) {
            var r = renderer.domElement.getBoundingClientRect();
            ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
            ray.setFromCamera(ptr, camera);
            var hits = ray.intersectObjects(slabs, true), fallback = null;
            for (var i = 0; i < hits.length; i++) {
              var o = hits[i].object, shown = true;
              if (!o.userData.proxy) for (var p = o; p; p = p.parent) if (!p.visible) { shown = false; break; }
              if (!shown || o.isLine) continue;
              while (o && slabs.indexOf(o) < 0) o = o.parent;
              if (!o) continue;
              if (o.userData.id === "board") { if (!fallback) fallback = o; continue; } /* board: lowest priority */
              return o;
            }
            return fallback;
          }
          var cv = renderer.domElement, down = null;
          cv.addEventListener("pointermove", function (ev) {
            if (ev.pointerType === "mouse" && !down) { var g = pick(ev); setActive(g); cv.style.cursor = g ? "pointer" : "grab"; }
          });
          cv.addEventListener("pointerleave", function (ev) { if (ev.pointerType === "mouse") setActive(null); });
          cv.addEventListener("pointerdown", function (ev) { down = { x: ev.clientX, y: ev.clientY }; });
          cv.addEventListener("pointerup", function (ev) {
            if (!down) return;
            var moved = Math.abs(ev.clientX - down.x) + Math.abs(ev.clientY - down.y) > 8; down = null;
            if (moved) return;
            var g = pick(ev);
            if (!g) { setActive(null); if (focusKey) unfocus(); return; }
            if (ev.pointerType === "mouse" || active === g || focusKey) { setActive(null); focus(keyOf(g)); } /* touch: first tap shows, second tap focuses */
            else setActive(g);
          });

          /* focus mode: frame one part, fade the rest, open the detail panel */
          var FOCUS = [
            { key: "cpu", label: "CPU", ids: ["cpu"], lab: "流水线", pts: ["CPU = 运算器 + 控制器：ALU、通用寄存器、PSW 与 PC、IR、CU 的分工", "性能指标：CPI、MIPS，CPU 时间 = 指令条数 × CPI ÷ 主频", "指令流水线：结构冒险、数据冒险（RAW）、控制冒险，及转发、阻塞、分支预测", "指令周期 = 取指 → 间址 → 执行 → 中断，每个周期含若干机器周期"] },
            { key: "ram", label: "内存条", ids: ["ram1", "ram2"], lab: "Cache 地址映射", pts: ["存储器扩展：位扩展、字扩展、字位同时扩展；线选法与译码片选", "Cache 映射：直接映射、全相联、组相联，主存地址划分为 Tag / 组号 / 块内地址", "虚拟存储：页表与地址变换、TLB（快表）命中流程、缺页处理"] },
            { key: "disk", label: "硬盘", ids: ["disk"], pts: ["磁盘访问时间 = 寻道时间 + 旋转延迟（转半圈）+ 传输时间", "磁盘调度：FCFS、SSTF、SCAN、C-SCAN、LOOK / C-LOOK", "文件分配方式：连续分配、链接分配（隐式 / FAT）、索引分配（多级索引）"] },
            { key: "nic", label: "网卡", ids: ["nic"], lab: "TCP 拥塞控制", pts: ["五层模型：物理层、数据链路层、网络层、传输层、应用层，网卡工作在物理层与链路层", "MAC 地址与 ARP：IP 地址 → MAC 地址，同网段直接解析，跨网段解析网关", "CSMA/CD：先听后发、边发边听、冲突停发、二进制指数退避，最短帧长 = 2 × 传播时延 × 速率", "以太网帧格式：目的 MAC、源 MAC、类型、数据 46–1500 B、FCS"] },
            { key: "io", label: "I/O + DMA", ids: ["io"], pts: ["程序查询、中断、DMA：CPU 是否等待、数据经不经过 CPU", "DMA 与 CPU 争用主存：停止 CPU 访存、周期挪用、交替访存", "中断屏蔽字：设置为 1 屏蔽对应中断，用来改变中断处理优先级（多重中断）"] },
            { key: "os", label: "操作系统", ids: ["os"], lab: "CPU 调度", pts: ["进程状态：创建、就绪、运行、阻塞、终止及其转换条件", "调度算法：FCFS、SJF、优先级、时间片轮转、多级反馈队列", "PV 同步与互斥：生产者-消费者、读者-写者、哲学家进餐", "死锁：四个必要条件，预防、避免（银行家算法）、检测与解除"] },
            { key: "ds", label: "数据结构", ids: ["bus"], lab: "排序", pts: ["线性表：顺序表与链表的插入、删除、查找代价", "栈与队列：表达式求值、括号匹配、循环队列判空判满", "树与图：遍历、哈夫曼树、最小生成树、最短路径、拓扑排序", "查找与排序：二分、B 树、散列；各排序算法的复杂度与稳定性"] },
            { key: "board", label: "主板", ids: ["board"], pts: ["总线带宽 = 总线宽度 × 总线频率（÷ 每次传输所需周期数）", "总线仲裁：集中式（链式查询、计数器定时查询、独立请求）与分布式", "冯·诺依曼结构：存储程序、五大部件、指令和数据同等地存于存储器，以运算器为中心"] }
          ];
          function keyOf(g) { var id = g.userData.id; for (var i = 0; i < FOCUS.length; i++) if (FOCUS[i].ids.indexOf(id) >= 0) return FOCUS[i].key; return null; }
          function byKey(k) { return FOCUS.filter(function (f) { return f.key === k; })[0]; }
          function groupsOf(f) { return slabs.filter(function (s) { return f.ids.indexOf(s.userData.id) >= 0; }); }
          /* give every material its own copy so each part can fade alone */
          root.traverse(function (o) { if (o.material) { o.material = o.material.clone(); o.material.userData.o = 1; } });

          /* detailed motherboard replaces the clay machine; PARTS groups stay as hotspots */
          var GS = 14, V3 = THREE.Vector3;
          shell.visible = false;
          slabs.forEach(function (g) { g.children.forEach(function (c) { c.visible = false; }); });
          var HOT = {
            cpu: { p: [-0.063, 0.072, -0.09], s: [0.13, 0.07, 0.13], below: true },
            ram1: { p: [0.110, 0.064, -0.08], s: [0.025, 0.06, 0.19], below: true },
            ram2: { p: [0.142, 0.064, -0.08], s: [0.025, 0.06, 0.19], below: true },
            board: { p: [0, 0.004, 0], s: [0.40, 0.008, 0.40] },
            bus: { p: [0.09, 0.02, 0.12], s: [0.20, 0.02, 0.02] },
            io: { p: [0.02, 0.01, 0.04], s: [0.04, 0.01, 0.04] },
            nic: { p: [-0.20, 0.025, -0.08], s: [0.03, 0.03, 0.10] },
            disk: { p: [0.15, 0.012, 0.19], s: [0.08, 0.015, 0.02] },
            os: { p: [0, 0.12, 0], s: [0.30, 0.003, 0.30] }
          };
          var proxyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
          proxyMat.userData.nofade = true;
          slabs.forEach(function (g) {
            var h = HOT[g.userData.id], d = g.userData; if (!h) return;
            if (g.userData.id !== "os") {
              var px = new THREE.Mesh(new THREE.BoxGeometry(h.s[0] * GS, h.s[1] * GS, h.s[2] * GS), proxyMat);
              px.position.y = h.below ? -h.s[1] * GS / 2 : 0; px.userData.proxy = true; g.add(px);
            }
            /* board lies flat now: parts lift straight up when picked */
            var len = d.dir.length(); if (len > 0) d.dir = new V3(0, len, 0);
          });
          /* 操作系统层: smoked-glass plate above the board */
          var osG = slabs.filter(function (s) { return s.userData.id === "os"; })[0];
          var glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fb3d9, transparent: true, opacity: 0.18, roughness: 0.1, metalness: 0, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
          glassMat.userData = { o: 0.18, tr: true, dw: false };
          var plate = new THREE.Mesh(new THREE.BoxGeometry(HOT.os.s[0] * GS, HOT.os.s[1] * GS, HOT.os.s[2] * GS), glassMat);
          plate.userData.proxy = true; osG.add(plate);
          var edgeGlow = new THREE.LineBasicMaterial({ color: 0x4f74d6, transparent: true, opacity: 0.55 });
          edgeGlow.userData = { o: 0.55, tr: true, dw: true };
          plate.add(new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), edgeGlow));
          /* soft contact shadow catcher */
          var groundMat = new THREE.ShadowMaterial({ opacity: 0.45 }); groundMat.userData.nofade = true;
          var ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), groundMat);
          ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; ground.receiveShadow = true; root.add(ground);

          var boardTopY = -0.42;
          /* hooks for the scene extras block */
          window.HERO = {
            THREE: THREE, scene: scene, camera: camera, controls: controls, root: root, stage: stage, hero: hero, slabs: slabs, ground: ground,
            HOME_POS: HOME_POS, HOME_TGT: HOME_TGT, MIN_D: MIN_D, reduced: X.reduced, ready: false, pre: [], post: [],
            focus: function (k) { setActive(null); focus(k); }, keyOf: function (g) { return keyOf(g); },
            focusKey: function () { return focusKey; }, boardTopY: function () { return boardTopY; }, pick: function (ev) { return pick(ev); }
          };
          if (!(window.MB_GLB_BUF || window.MB_GLB_B64) || typeof THREE.GLTFLoader !== "function") throw new Error("board unavailable");
          function b64buf(s) { var bin = atob(s), n = bin.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
          var gltfLoader = new THREE.GLTFLoader();
          /* 模型几何体用 meshopt 压缩（EXT_meshopt_compression），解码器为本地 vendor/meshopt_decoder.js */
          if (window.MeshoptDecoder && typeof gltfLoader.setMeshoptDecoder === "function") gltfLoader.setMeshoptDecoder(window.MeshoptDecoder);
          gltfLoader.parse(window.MB_GLB_BUF || b64buf(window.MB_GLB_B64), "", function (gltf) {
            try {
              var mb = gltf.scene; mb.scale.setScalar(GS); root.add(mb);
              root.updateMatrixWorld(true);
              var c = new THREE.Box3().setFromObject(mb).getCenter(new V3());
              mb.position.sub(root.worldToLocal(c));
              mb.traverse(function (o) {
                if (!o.isMesh) return;
                o.castShadow = true; o.receiveShadow = true;
                (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
                  m.envMapIntensity = 1.0;
                  m.userData.glb = true; m.userData.o = 1; m.userData.tr = m.transparent; m.userData.dw = m.depthWrite;
                  m.needsUpdate = true;
                });
              });
              root.updateMatrixWorld(true);
              function toRoot(p) { return root.worldToLocal(mb.localToWorld(new V3(p[0], p[1], p[2]))); }
              slabs.forEach(function (g) {
                var h = HOT[g.userData.id]; if (!h) return;
                var q = toRoot(h.p); g.userData.base.copy(q); g.position.copy(q);
              });
              var lo = new THREE.Box3().setFromObject(mb).min.clone();
              ground.position.y = root.worldToLocal(lo).y - 0.002;
              boardTopY = toRoot([0, 0.004, 0]).y;
              window.HERO.ready = true;
            } catch (err) { if (window.console) console.error(err); fail(); }
          }, function (err) { if (window.console) console.error(err); fail(); });

          /* explode sub-parts: lift a part's sub-part root +0.6 when its open layout would cut into the board */
          function prepExplode(k) {
            var e = window.EXPLODE && window.EXPLODE[k];
            if (!e || typeof e.build !== "function" || e.build._lifted) return;
            var orig = e.build;
            e.build = function (group) {
              var before = group ? group.children.slice() : [];
              var ok = orig.apply(this, arguments);
              if (!ok || !group) return ok;
              var fresh = group.children.filter(function (c) { return before.indexOf(c) < 0; });
              if (!fresh.length) return ok;
              var sub = new THREE.Group(); fresh.forEach(function (c) { sub.add(c); }); group.add(sub);
              if (typeof this.fit === "function") {
                var keep = group.children, box = new THREE.Box3();
                group.children = [sub];
                try { this.fit(box); } catch (err) {}
                group.children = keep; group.updateMatrixWorld(true);
                var top = root.localToWorld(new V3(0, boardTopY, 0)).y;
                if (!box.isEmpty() && box.min.y < top + 0.02) { sub.position.y = 0.6; group.updateMatrixWorld(true); }
              }
              return ok;
            };
            e.build._lifted = true;
          }

          var focusKey = null, focusSet = [], home = null, tw = null, idleT = null, panelT = null;
          var panel = document.getElementById("xpanel"), crumb = document.getElementById("crumb"), partsRow = document.getElementById("xparts");
          var labBtn = document.getElementById("xp-lab");
          function ease(p) { return 1 - Math.pow(1 - p, 3); }
          function tweenTo(pos, tgt, fade, done) {
            var mats = [];
            root.traverse(function (o) {
              if (!o.material) return;
              var p = o, inFocus = false;
              while (p) { if (fade.indexOf(p) >= 0) { inFocus = true; break; } p = p.parent; }
              var m = o.material;
              if (!m || m.userData.nofade || Array.isArray(m)) return;
              var base = m.userData.o != null ? m.userData.o : 1, glb = !!m.userData.glb;
              var to = fade.length && !inFocus ? base * (glb ? 0.4 : 0.15) : base;
              if (to < 1) { m.transparent = true; if (!glb) m.depthWrite = false; }
              mats.push({ m: m, from: m.opacity, to: to });
            });
            tw = { t0: performance.now(), dur: X.reduced ? 1 : 700, p0: camera.position.clone(), p1: pos, c0: controls.target.clone(), c1: tgt, mats: mats, done: done };
          }
          function stepTween() {
            if (!tw) return;
            var p = Math.min(1, (performance.now() - tw.t0) / tw.dur), e = ease(p);
            camera.position.lerpVectors(tw.p0, tw.p1, e);
            controls.target.lerpVectors(tw.c0, tw.c1, e);
            tw.mats.forEach(function (x) {
              x.m.opacity = x.from + (x.to - x.from) * e;
              if (p === 1 && x.to === 1) { x.m.transparent = !!x.m.userData.tr; x.m.depthWrite = x.m.userData.dw !== false; }
              x.m.needsUpdate = p === 1;
            });
            if (p === 1) { var d = tw.done; tw = null; if (d) d(); }
          }
          function focus(k) {
            var f = byKey(k); if (!f) return;
            clearTimeout(idleT);
            controls.autoRotate = false;
            if (!focusKey) home = { pos: camera.position.clone(), tgt: controls.target.clone() };
            var EX = window.EXPLODE || {}; EX.ctx = { camera: camera, canvas: cv }; if (focusKey && focusKey !== k && EX[focusKey]) EX[focusKey].close();
            prepExplode(k);
            focusKey = k; focusSet = groupsOf(f); if (EX[k]) EX[k].open();
            controls.minDistance = 1.5;
            /* frame the part at its full lift plus its sub-parts at their open targets, 15% margin */
            var saved = focusSet.map(function (g) { return g.position.clone(); });
            focusSet.forEach(function (g) { g.position.copy(g.userData.base).add(g.userData.dir); g.updateMatrixWorld(true); });
            var box = new THREE.Box3();
            focusSet.forEach(function (g) { box.expandByObject(g); });
            if (EX[k] && EX[k].fit) EX[k].fit(box);
            focusSet.forEach(function (g, i) { g.position.copy(saved[i]); g.updateMatrixWorld(true); });
            var c = box.getCenter(new THREE.Vector3()), r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.6);
            var dir = camera.position.clone().sub(controls.target).normalize().add(V(0.3, 0.25, 1).normalize()).normalize();
            var wide = window.innerWidth >= 1024, halfV = (camera.fov * Math.PI / 180) / 2, halfH = Math.atan(Math.tan(halfV) * camera.aspect);
            var dist = Math.max((r * 1.15 + (wide ? r * 0.45 : 0)) / Math.sin(halfH), (r * 1.15 + (wide ? 0 : r * 0.35)) / Math.sin(halfV));
            if (wide) { c.addScaledVector(new THREE.Vector3().crossVectors(camera.up, dir).normalize(), r * 0.45); }
            else c.y -= r * 0.35;
            tweenTo(c.clone().addScaledVector(dir, dist), c, focusSet);
            /* panel */
            var s = X.bySubject(focusSet[0].userData.subject);
            panel.style.setProperty("--c", s.color);
            document.getElementById("xp-tag").textContent = s.name + " · " + s.short;
            document.getElementById("xp-name").textContent = f.label;
            var ul = document.getElementById("xp-list"); ul.innerHTML = "";
            f.pts.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
            labBtn.hidden = !f.lab;
            clearTimeout(panelT);
            if (panel.hidden) { panel.hidden = false; void panel.offsetWidth; }
            panel.classList.add("is-on");
            crumb.innerHTML = "整机 / <b></b>"; crumb.querySelector("b").textContent = f.label;
            syncParts();
          }
          function unfocus() {
            if (!focusKey) return;
            if (window.EXPLODE && EXPLODE[focusKey]) EXPLODE[focusKey].close(); focusKey = null; focusSet = [];
            panel.classList.remove("is-on");
            clearTimeout(panelT);
            panelT = setTimeout(function () { if (!focusKey) panel.hidden = true; }, 340);
            crumb.innerHTML = "<b>整机</b>";
            syncParts();
            var h = home || { pos: HOME_POS.clone(), tgt: HOME_TGT.clone() };
            tweenTo(h.pos.clone(), h.tgt.clone(), [], function () { controls.minDistance = MIN_D; });
            idle();
          }
          function idle() {
            clearTimeout(idleT);
            if (focusKey || X.reduced) return;
            idleT = setTimeout(function () { if (!focusKey) controls.autoRotate = true; }, 8000);
          }
          controls.addEventListener("start", function () { controls.autoRotate = false; idle(); });
          function syncParts() {
            partsRow.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.k === focusKey ? "true" : "false"); });
          }
          FOCUS.forEach(function (f) {
            var b = document.createElement("button");
            b.type = "button"; b.dataset.k = f.key; b.textContent = f.label; b.setAttribute("aria-pressed", "false");
            b.addEventListener("click", function () {
              if (focusKey === f.key) unfocus(); else focus(f.key);
            });
            partsRow.appendChild(b);
          });
          document.getElementById("xp-back").addEventListener("click", unfocus);
          document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && focusKey) unfocus(); });
          document.getElementById("xp-ch").addEventListener("click", function () { if (focusSet[0]) X.go(focusSet[0].userData.subject); });
          labBtn.addEventListener("click", function () {
            var f = byKey(focusKey); if (!f || !f.lab) return;
            var tabs = document.querySelectorAll("#x-lab .x-lab__tab");
            for (var i = 0; i < tabs.length; i++) if (tabs[i].textContent.indexOf(f.lab) >= 0) { tabs[i].click(); break; }
            X.go("lab");
          });

          function resize() {
            var w = stage.clientWidth, h = stage.clientHeight;
            renderer.setSize(w, h, false); camera.aspect = w / h;
            camera.fov = w < 600 ? 48 : 36; camera.updateProjectionMatrix();
            /* shift model right on wide screens, up on narrow, to clear the title */
            root.position.x = 0; root.position.y = w < 600 ? 0.9 : 0.2;
          }
          window.addEventListener("resize", resize); resize();

          var v = new THREE.Vector3(), clock = new THREE.Clock(), visible = true;
          new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(hero);
          function tick() {
            requestAnimationFrame(tick);
            if (!visible) return;
            var t = clock.getElapsedTime(), m = X.reduced ? 0 : 1;
            slabs.forEach(function (g, i) {
              var d = g.userData, target = g === active || focusSet.indexOf(g) >= 0 ? 1 : 0;
              d.lift += (target - d.lift) * 0.12;
              g.position.copy(d.base).addScaledVector(d.dir, d.lift);
              if (d.bob) g.position.y += Math.sin(t * 0.9 + i) * 0.06 * m;
            });
            pcbs.forEach(function (p, i) {
              var u = ((t * 0.2 * m + i / 3) % 1); p.position.x = 2.0 - u * 2.9;
              p.scale.setScalar(Math.max(0.01, Math.min(1, u * 6, (1 - u) * 6)));
            });
            bits.forEach(function (p, i) { var u = ((t * 0.35 * m + i / 3) % 1); p.position.x = 0.4 - u * 0.8; });
            pkts.forEach(function (p, i) { var u = ((t * 0.3 * m + i / 4) % 1); p.position.copy(curve.getPointAt(u)); p.rotation.y = t; });
            stepTween();
            window.HERO.pre.forEach(function (f) { f(t); });
            controls.update();
            renderer.render(scene, camera);
            window.HERO.post.forEach(function (f) { f(t); });
            if (active) {
              active.getWorldPosition(v); v.y += 0.6; v.project(camera);
              var w = stage.clientWidth, h = stage.clientHeight;
              var x = Math.min(Math.max((v.x * 0.5 + 0.5) * w + 24, 0), w - callout.offsetWidth);
              var y = Math.min(Math.max((-v.y * 0.5 + 0.5) * h - callout.offsetHeight / 2, 50), h - callout.offsetHeight);
              callout.style.transform = "translate(" + x + "px," + y + "px)";
            }
          }
          tick();
        }
      })();
    
