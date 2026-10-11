      /* 跨科连线立体图（滚动到附近才加载）；下方文字列表始终可用 */
      (function () {
        var wrap = document.getElementById("x-graph"), stage = document.getElementById("x-graph-stage");
        var labelsEl = document.getElementById("x-graph-labels"), card = document.getElementById("x-gcard");
        try {
          var test = document.createElement("canvas");
          if (!(test.getContext("webgl2") || test.getContext("webgl"))) return;
        } catch (e) { return; }
        if (typeof window.THREE === "undefined" || typeof THREE.OrbitControls !== "function") return;

        var SUBJ = {
          ds: { hex: 0x3a8475, css: "#3A8475", tag: "数据结构" },
          co: { hex: 0xc0603e, css: "#C0603E", tag: "组成" },
          os: { hex: 0xc49431, css: "#C49431", tag: "操作系统" },
          cn: { hex: 0x4766b3, css: "#4766B3", tag: "网络" }
        };
        var NODES = [
          ["栈", "ds"], ["队列", "ds"], ["循环队列", "ds"], ["图·Dijkstra", "ds"], ["Bellman-Ford思想", "ds"], ["拓扑排序/环检测", "ds"],
          ["B+树", "ds"], ["散列表", "ds"], ["外部排序", "ds"],
          ["Cache映射", "co"], ["虚拟存储器", "co"], ["中断系统", "co"], ["DMA", "co"], ["补码与二进制运算", "co"], ["指令流水线", "co"], ["函数调用与现场保存", "co"],
          ["页式存储/TLB", "os"], ["虚拟内存", "os"], ["中断异常与系统调用", "os"], ["I/O控制方式", "os"], ["进程调度/就绪队列", "os"], ["缓冲区", "os"],
          ["生产者-消费者", "os"], ["死锁·资源分配图", "os"], ["文件索引分配", "os"], ["多级页表", "os"], ["磁盘调度", "os"], ["进程同步", "os"],
          ["滑动窗口GBN/SR", "cn"], ["TCP流量控制", "cn"], ["OSPF", "cn"], ["RIP", "cn"], ["路由器输出队列", "cn"], ["交换机MAC表", "cn"], ["CRC校验", "cn"], ["子网掩码", "cn"]
        ];
        var idx = {}, nodes = NODES.map(function (n, i) { idx[n[0]] = i; return { name: n[0], s: n[1], links: [] }; });
        var links = [];
        Array.prototype.forEach.call(document.querySelectorAll("#x-links li[data-a]"), function (li) {
          var a = idx[li.getAttribute("data-a")], b = idx[li.getAttribute("data-b")];
          if (a == null || b == null) return;
          var L = { a: a, b: b, why: li.querySelector(".x-lwhy").textContent };
          links.push(L); nodes[a].links.push(L); nodes[b].links.push(L);
        });

        /* force layout, run once: repulsion + springs + a weak pull toward each subject's corner */
        function layout() {
          var anch = { ds: [1, 1, 1], co: [-1, -1, 1], os: [-1, 1, -1], cn: [1, -1, -1] }, n = nodes.length;
          var P = nodes.map(function (nd, i) {
            var a = anch[nd.s], k = i * 2.399963, y = 1 - 2 * ((i + 0.5) / n), r = Math.sqrt(1 - y * y);
            return [a[0] * 4 + Math.cos(k) * r * 2, a[1] * 4 + y * 2, a[2] * 4 + Math.sin(k) * r * 2];
          });
          for (var it = 0; it < 220; it++) {
            var F = P.map(function () { return [0, 0, 0]; }), i, j, c;
            for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
              var d = [P[i][0] - P[j][0], P[i][1] - P[j][1], P[i][2] - P[j][2]];
              var d2 = Math.max(d[0] * d[0] + d[1] * d[1] + d[2] * d[2], 0.01), dist = Math.sqrt(d2), f = 6 / d2;
              for (c = 0; c < 3; c++) { F[i][c] += d[c] / dist * f; F[j][c] -= d[c] / dist * f; }
            }
            links.forEach(function (L) {
              var d = [P[L.b][0] - P[L.a][0], P[L.b][1] - P[L.a][1], P[L.b][2] - P[L.a][2]];
              var dist = Math.max(Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]), 0.01), f = (dist - 3) * 0.08;
              for (var c = 0; c < 3; c++) { F[L.a][c] += d[c] / dist * f; F[L.b][c] -= d[c] / dist * f; }
            });
            var step = 0.9 * (1 - it / 240);
            for (i = 0; i < n; i++) {
              var a = anch[nodes[i].s];
              for (c = 0; c < 3; c++) F[i][c] += (a[c] * 4 - P[i][c]) * 0.015;
              var m = Math.sqrt(F[i][0] * F[i][0] + F[i][1] * F[i][1] + F[i][2] * F[i][2]), s = m > 1 ? 1 / m : 1;
              for (c = 0; c < 3; c++) P[i][c] += F[i][c] * s * step;
            }
          }
          var mean = [0, 0, 0], R = 0;
          P.forEach(function (p) { for (var c = 0; c < 3; c++) mean[c] += p[c] / n; });
          P.forEach(function (p) { for (var c = 0; c < 3; c++) p[c] -= mean[c]; R = Math.max(R, Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2])); });
          return P.map(function (p) { return [p[0] * 8 / R, p[1] * 8 / R, p[2] * 8 / R]; });
        }

        try { wrap.hidden = false; build(layout()); }
        catch (e) { if (window.console) console.error(e); wrap.hidden = true; stage.innerHTML = ""; labelsEl.innerHTML = ""; }

        function build(P) {
          var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
          var isPhone = window.matchMedia && window.matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 600;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isPhone ? 1.5 : 2));
          stage.appendChild(renderer.domElement);
          var cv = renderer.domElement;
          cv.style.touchAction = "pan-y";
          cv.setAttribute("aria-hidden", "true");
          var scene = new THREE.Scene();
          var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
          camera.position.set(0, 5, 26);
          scene.add(new THREE.HemisphereLight(0xffffff, 0xb8ae9c, 0.8));
          var sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(6, 12, 9); scene.add(sun);

          var geo = new THREE.SphereGeometry(1, 28, 18), spheres = [];
          nodes.forEach(function (nd, i) {
            nd.mat = new THREE.MeshStandardMaterial({ color: SUBJ[nd.s].hex, roughness: 0.92, metalness: 0, transparent: true, opacity: 1 });
            var m = new THREE.Mesh(geo, nd.mat), r = 0.38 + 0.08 * nd.links.length;
            m.scale.setScalar(r); m.position.set(P[i][0], P[i][1], P[i][2]); m.userData.i = i;
            scene.add(m); spheres.push(m); nd.mesh = m; nd.r = r;
            nd.label = X.el("span", { class: "x-gl" }, nd.name);
            labelsEl.appendChild(nd.label);
          });
          links.forEach(function (L) {
            var g = new THREE.BufferGeometry().setFromPoints([spheres[L.a].position, spheres[L.b].position]);
            L.mat = new THREE.LineBasicMaterial({ color: 0x9aa0aa, transparent: true, opacity: 0.6 });
            scene.add(new THREE.Line(g, L.mat));
          });

          var controls = new THREE.OrbitControls(camera, cv);
          controls.enableDamping = true; controls.enablePan = false;
          controls.minDistance = 12; controls.maxDistance = 48;
          controls.autoRotate = false; controls.autoRotateSpeed = 0.5;

          var sel = null;
          function tagHTML(s) { return '<span class="x-ltag" data-s="' + s + '">' + SUBJ[s].tag + "</span>"; }
          function select(i) {
            sel = i;
            controls.autoRotate = false;
            var near = {};
            if (i != null) { near[i] = 1; nodes[i].links.forEach(function (L) { near[L.a] = 1; near[L.b] = 1; }); }
            nodes.forEach(function (nd, k) {
              var on = i == null || near[k];
              nd.mat.opacity = on ? 1 : 0.16;
              nd.mat.depthWrite = on;
              nd.label.classList.toggle("is-dim", !on);
              nd.label.classList.toggle("is-sel", k === i);
            });
            links.forEach(function (L) {
              var hit = i != null && (L.a === i || L.b === i);
              L.mat.opacity = i == null ? 0.6 : (hit ? 1 : 0.07);
              L.mat.color.setHex(hit ? 0x2f5bea : 0x9aa0aa);
            });
            if (i == null) { card.hidden = true; card.innerHTML = ""; return; }
            var nd = nodes[i];
            card.style.setProperty("--c", SUBJ[nd.s].css);
            card.innerHTML =
              '<div class="x-gcard__top"><div>' + tagHTML(nd.s) + "<h3>" + nd.name + '</h3><p class="x-gcard__n">' + nd.links.length + " 条连线</p></div>" +
              '<button type="button" class="x-gcard__x" aria-label="关闭">×</button></div><ul>' +
              nd.links.map(function (L) {
                var o = nodes[L.a === i ? L.b : L.a];
                return "<li>" + tagHTML(o.s) + "<b>" + o.name + "</b><p>" + L.why + "</p></li>";
              }).join("") + "</ul>";
            card.hidden = false;
            card.querySelector(".x-gcard__x").addEventListener("click", function () { select(null); });
          }

          var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), down = null;
          function pick(ev) {
            var r = cv.getBoundingClientRect();
            ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
            ray.setFromCamera(ptr, camera);
            var hit = ray.intersectObjects(spheres, false)[0];
            return hit ? hit.object.userData.i : null;
          }
          cv.addEventListener("pointerdown", function (ev) { down = { x: ev.clientX, y: ev.clientY }; });
          cv.addEventListener("pointerup", function (ev) {
            if (!down) return;
            var moved = Math.abs(ev.clientX - down.x) + Math.abs(ev.clientY - down.y) > 8; down = null;
            if (!moved) select(pick(ev));
          });
          cv.addEventListener("pointermove", function (ev) {
            if (ev.pointerType === "mouse" && !down) cv.style.cursor = pick(ev) != null ? "pointer" : "grab";
          });
          document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && sel != null) select(null); });

          function resize() {
            var w = stage.clientWidth, h = stage.clientHeight;
            if (!w || !h) return;
            renderer.setSize(w, h, false);
            camera.aspect = w / h; camera.fov = w < 640 ? 50 : 40; camera.updateProjectionMatrix();
            var want = Math.min(Math.max(26 / Math.min(Math.max(camera.aspect, 0.55), 1) * (w < 640 ? 0.8 : 1), controls.minDistance), controls.maxDistance);
            camera.position.setLength(want);
          }
          window.addEventListener("resize", resize); resize();
          if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(stage);
          window.addEventListener("orientationchange", function () { requestAnimationFrame(resize); });

          var visible = true, v = new THREE.Vector3();
          new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(wrap);
          function tick() {
            requestAnimationFrame(tick);
            if (!visible || document.hidden) return;
            controls.update();
            renderer.render(scene, camera);
            var w = stage.clientWidth, h = stage.clientHeight;
            nodes.forEach(function (nd) {
              v.copy(nd.mesh.position).project(camera);
              if (v.z > 1) { nd.label.style.visibility = "hidden"; return; }
              nd.label.style.visibility = "";
              var x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
              nd.label.style.transform = "translate(" + x.toFixed(1) + "px," + (y + 10).toFixed(1) + "px) translate(-50%,0)";
            });
          }
          tick();
        }
      })();
    
