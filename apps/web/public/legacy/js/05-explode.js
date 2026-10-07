      /* hero explode: sub-parts that fan out of a focused part. EXPLODE[id] = { build(group), open(), close() } */
      (function () {
        var EX = window.EXPLODE = window.EXPLODE || {};
        var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
        function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
        /* generic: run each item's progress p toward `to`, staggered; exact reversal from wherever it is */
        function runner(items, apply, done) {
          var raf = null;
          return function (to, stagger, order) {
            if (raf) cancelAnimationFrame(raf);
            var t0 = performance.now(), dur = reduced ? 1 : 600;
            var from = items.map(function (it) { return it.p; });
            (function frame() {
              var now = performance.now(), all = true;
              items.forEach(function (it, i) {
                var k = order[i], q = Math.min(1, Math.max(0, (now - t0 - k * stagger) / dur));
                if (q < 1) all = false;
                it.p = from[i] + (to - from[i]) * easeOut(q);
              });
              apply();
              if (all) { raf = null; if (done) done(to); } else raf = requestAnimationFrame(frame);
            })();
          };
        }
        /* fit(box): grow box by the part with every item at its open target, then put it back */
        function fitter(group, all, apply) {
          return function (box) {
            var s = all.map(function (it) { return it.p; });
            all.forEach(function (it) { it.p = 1; }); apply();
            group.updateMatrixWorld(true); box.expandByObject(group);
            all.forEach(function (it, i) { it.p = s[i]; }); apply();
            group.updateMatrixWorld(true);
          };
        }
        function tint(hex, a) {
          var r = hex >> 16 & 255, g = hex >> 8 & 255, b = hex & 255;
          return (Math.round(r + (255 - r) * a) << 16) | (Math.round(g + (255 - g) * a) << 8) | Math.round(b + (255 - b) * a);
        }
        function labelTex(THREE, text, ink) {
          var c = document.createElement("canvas"); c.width = 256; c.height = 128;
          var x = c.getContext("2d"), fs = text.length > 5 ? 40 : 56;
          x.fillStyle = ink; x.textAlign = "center"; x.textBaseline = "middle";
          x.font = "600 " + fs + "px Geist, system-ui, sans-serif";
          x.fillText(text, 128, 66);
          var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
        }

        var LINES = {
          "运算器 ALU": "算术逻辑运算，加法器是核心",
          "控制器 CU": "取指、译码、发控制信号；硬布线或微程序",
          "寄存器组": "PC、IR、MAR、MDR 与通用寄存器",
          "L1 Cache": "分指令 Cache 和数据 Cache，命中最快",
          "L2 Cache": "容量更大，速度次之",
          "流水线": "五段流水线，理想情况下 CPI = 1"
        };

        var cpu = EX.cpu = { built: false, open: false };
        cpu.build = function (group) {
          var THREE = window.THREE; if (!THREE || !group) return false;
          var BRICK = 0xc2512b, edgeMat = (function (m) { m.userData = { o: 0.35, tr: true, dw: true }; return m; })(new THREE.LineBasicMaterial({ color: 0x16181d, transparent: true, opacity: 0.35 }));
          var lid = group.children[1];
          var lid0 = { pos: lid.position.clone(), rot: lid.rotation.clone() };
          var origin = new THREE.Vector3(0, 0, 0.17);
          var meshes = [];
          function block(parent, w, h, d, hex, text, x, y) {
            var geo = new THREE.BoxGeometry(w, h, d);
            var m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
            m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat));
            var face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, w * 0.47),
              new THREE.MeshBasicMaterial({ map: labelTex(THREE, text, hex === BRICK ? "#f2efe8" : "#16181d"), transparent: true, depthWrite: false }));
            face.position.z = d / 2 + 0.002; m.add(face);
            m.position.set(x || 0, y || 0, 0);
            parent.add(m); meshes.push(m, face);
            return m;
          }
          var defs = [
            { name: "运算器 ALU", text: "ALU", a: 0, to: [-0.62, 0.62, 0.75] },
            { name: "控制器 CU", text: "CU", a: 0.18, to: [0, 0.7, 0.8] },
            { name: "寄存器组", text: "寄存器组", a: 0.32, to: [0.62, 0.62, 0.75] },
            { name: "L1 Cache", text: "L1 Cache", a: 0.46, to: [-0.36, 0.08, 0.95] },
            { name: "L2 Cache", text: "L2 Cache", a: 0.58, to: [0.36, 0.08, 0.95] },
            { name: "流水线", strip: true, to: [0, -0.5, 0.85] }
          ];
          var items = defs.map(function (d, i) {
            var g = new THREE.Group();
            if (d.strip) {
              ["IF", "ID", "EX", "MEM", "WB"].forEach(function (s, n) {
                block(g, 0.22, 0.18, 0.1, tint(BRICK, 0.2 + n * 0.12), s, (n - 2) * 0.25, 0);
              });
            } else block(g, 0.48, 0.32, 0.14, tint(BRICK, d.a), d.text);
            g.visible = false; g.position.copy(origin); g.scale.setScalar(0.2);
            g.userData = { name: d.name, to: new THREE.Vector3(d.to[0], d.to[1], d.to[2]), tilt: (d.to[0]) * -0.25 };
            g.traverse(function (o) { o.userData.sub = g; });
            group.add(g);
            return { g: g, p: 0, sel: 0 };
          });
          var lidItem = { p: 0 };
          var all = [lidItem].concat(items);
          function apply() {
            lid.position.set(lid0.pos.x, lid0.pos.y + 0.95 * lidItem.p, lid0.pos.z + 0.35 * lidItem.p);
            lid.rotation.set(lid0.rot.x - 0.9 * lidItem.p, lid0.rot.y, lid0.rot.z);
            items.forEach(function (it) {
              var g = it.g, u = g.userData;
              g.position.lerpVectors(origin, u.to, it.p);
              g.position.z += 0.14 * it.sel;
              g.scale.setScalar(0.2 + 0.8 * it.p);
              g.rotation.set(0, u.tilt * it.p, 0);
            });
          }
          var run = runner(all, apply, function (to) {
            if (to === 0) {
              lid.position.copy(lid0.pos); lid.rotation.copy(lid0.rot);
              items.forEach(function (it) { it.p = 0; it.sel = 0; var g = it.g; g.visible = false; g.position.copy(origin); g.rotation.set(0, 0, 0); g.scale.setScalar(0.2); });
            }
          });
          cpu.open = function () {
            if (cpu.isOpen) { select(null); return; }
            cpu.isOpen = true;
            items.forEach(function (it) { it.g.visible = true; });
            run(1, 60, all.map(function (_, i) { return i; }));
          };
          cpu.close = function () {
            if (!cpu.isOpen) return;
            cpu.isOpen = false; select(null, true);
            var n = all.length - 1;
            run(0, 60, all.map(function (_, i) { return n - i; }));
          };

          /* lift the picked sub-part a little */
          var selRaf = null;
          function select(g, silent) {
            items.forEach(function (it) { it.target = it.g === g ? 1 : 0; });
            if (selRaf) cancelAnimationFrame(selRaf);
            (function f() {
              var moving = false;
              items.forEach(function (it) { var d = it.target - it.sel; if (Math.abs(d) > 0.002) { it.sel += d * (reduced ? 1 : 0.2); moving = true; } else it.sel = it.target; });
              if (cpu.isOpen || !silent) apply();
              selRaf = moving ? requestAnimationFrame(f) : null;
            })();
          }
          var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), down = null;
          var ctx = EX.ctx, cv = ctx.canvas, host = cv.parentNode;
          host.addEventListener("pointerdown", function (ev) { down = ev.target === cv ? { x: ev.clientX, y: ev.clientY } : null; }, true);
          host.addEventListener("pointerup", function (ev) {
            if (!cpu.isOpen || !down || ev.target !== cv) return;
            var moved = Math.abs(ev.clientX - down.x) + Math.abs(ev.clientY - down.y) > 8; down = null;
            if (moved) return;
            var r = cv.getBoundingClientRect();
            ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
            ray.setFromCamera(ptr, EX.ctx.camera);
            var hit = ray.intersectObjects(meshes, false)[0];
            if (!hit) return;
            ev.stopPropagation();
            var g = hit.object.userData.sub, name = g.userData.name;
            select(g);
            var crumb = document.getElementById("crumb");
            crumb.innerHTML = "整机 / CPU / <b></b>"; crumb.querySelector("b").textContent = name;
            var ul = document.getElementById("xp-list"); ul.innerHTML = "";
            var li = document.createElement("li"); li.textContent = LINES[name]; ul.appendChild(li);
          }, true);
          cpu.fit = fitter(group, all, apply);
          cpu.built = true;
          return true;
        };
        /* build lazily on first open, once the hero scene exists */
        var openFirst = function () {
          var g = (window.PARTS || []).filter(function (s) { return s.userData.id === "cpu"; })[0];
          if (!cpu.built && !(EX.ctx && cpu.build(g))) return;
          cpu.open();
        };
        cpu.open = openFirst;
        cpu.close = function () {};

        /* 内存条 1: 页框 grid, 页表, TLB */
        var MLINES = {
          "页框": "内存按页框划分，大小与页相同",
          "已装入页": "请求分页：只调入用到的页",
          "页表": "逻辑页号 → 物理块号，存在主存中",
          "TLB": "页表的高速缓存，命中可省一次访存"
        };
        var ram = EX.ram1 = { built: false, isOpen: false };
        EX.ram = ram; /* focus mode keys the 内存条 pair as "ram" */
        ram.build = function (group) {
          var THREE = window.THREE; if (!THREE || !group) return false;
          var BRICK = 0xc2512b, OCHRE = 0xd9a21b, edgeMat = (function (m) { m.userData = { o: 0.35, tr: true, dw: true }; return m; })(new THREE.LineBasicMaterial({ color: 0x16181d, transparent: true, opacity: 0.35 }));
          var sticks = group.children.slice(0, 2).map(function (m) { return { m: m, pos: m.position.clone() }; });
          var RISE = 0.3, origin = new THREE.Vector3(0, RISE, 0.06);
          var meshes = [];
          function block(parent, w, h, d, hex, text) {
            var geo = new THREE.BoxGeometry(w, h, d);
            var m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
            m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat));
            parent.add(m); meshes.push(m);
            if (text) {
              var face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, w * 0.47),
                new THREE.MeshBasicMaterial({ map: labelTex(THREE, text, hex === BRICK ? "#f2efe8" : "#16181d"), transparent: true, depthWrite: false }));
              face.position.z = d / 2 + 0.002; m.add(face); meshes.push(face);
            }
            return m;
          }
          var LOADED = [1, 6, 11];
          var defs = [];
          for (var i = 0; i < 16; i++) {
            var col = i % 4, row = Math.floor(i / 4), on = LOADED.indexOf(i) >= 0;
            defs.push({ name: on ? "已装入页" : "页框", tile: true, hex: on ? OCHRE : tint(BRICK, 0.5 + ((col + row) % 2) * 0.15),
              to: [-0.75 + col * 0.18, 1.0 - row * 0.18, 0.28] });
          }
          defs.push({ name: "页表", text: "页表", hex: tint(BRICK, 0.3), to: [-0.48, 0.12, 0.3] });
          defs.push({ name: "TLB", text: "TLB", hex: OCHRE, to: [-0.48, -0.18, 0.34] });
          var items = defs.map(function (d) {
            var g = new THREE.Group();
            if (d.tile) block(g, 0.15, 0.15, 0.03, d.hex);
            else block(g, 0.44, 0.24, 0.12, d.hex, d.text);
            g.visible = false; g.position.copy(origin); g.scale.setScalar(0.2);
            g.userData = { name: d.name, to: new THREE.Vector3(d.to[0], d.to[1], d.to[2]) };
            g.traverse(function (o) { o.userData.sub = g; });
            group.add(g);
            return { g: g, p: 0, sel: 0 };
          });
          var stickItem = { p: 0 };
          var all = [stickItem].concat(items);
          function apply() {
            sticks.forEach(function (s) { s.m.position.set(s.pos.x, s.pos.y + RISE * stickItem.p, s.pos.z); });
            items.forEach(function (it) {
              var g = it.g, u = g.userData;
              g.position.lerpVectors(origin, u.to, it.p);
              g.position.z += 0.1 * it.sel;
              g.scale.setScalar(0.2 + 0.8 * it.p);
            });
          }
          var run = runner(all, apply, function (to) {
            if (to === 0) {
              sticks.forEach(function (s) { s.m.position.copy(s.pos); });
              items.forEach(function (it) { it.p = 0; it.sel = 0; var g = it.g; g.visible = false; g.position.copy(origin); g.rotation.set(0, 0, 0); g.scale.setScalar(0.2); });
            }
          });
          ram.open = function () {
            if (ram.isOpen) { select(null); return; }
            ram.isOpen = true;
            items.forEach(function (it) { it.g.visible = true; });
            run(1, 40, all.map(function (_, i) { return i; }));
          };
          ram.close = function () {
            if (!ram.isOpen) return;
            ram.isOpen = false; select(null, true);
            var n = all.length - 1;
            run(0, 40, all.map(function (_, i) { return n - i; }));
          };

          var selRaf = null;
          function select(g, silent) {
            items.forEach(function (it) { it.target = it.g === g ? 1 : 0; });
            if (selRaf) cancelAnimationFrame(selRaf);
            (function f() {
              var moving = false;
              items.forEach(function (it) { var d = it.target - it.sel; if (Math.abs(d) > 0.002) { it.sel += d * (reduced ? 1 : 0.2); moving = true; } else it.sel = it.target; });
              if (ram.isOpen || !silent) apply();
              selRaf = moving ? requestAnimationFrame(f) : null;
            })();
          }
          var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), down = null;
          var cv = EX.ctx.canvas, host = cv.parentNode;
          host.addEventListener("pointerdown", function (ev) { down = ev.target === cv ? { x: ev.clientX, y: ev.clientY } : null; }, true);
          host.addEventListener("pointerup", function (ev) {
            if (!ram.isOpen || !down || ev.target !== cv) return;
            var moved = Math.abs(ev.clientX - down.x) + Math.abs(ev.clientY - down.y) > 8; down = null;
            if (moved) return;
            var r = cv.getBoundingClientRect();
            ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
            ray.setFromCamera(ptr, EX.ctx.camera);
            var hit = ray.intersectObjects(meshes, false)[0];
            if (!hit) return;
            ev.stopPropagation();
            var g = hit.object.userData.sub, name = g.userData.name;
            select(g);
            var crumb = document.getElementById("crumb");
            crumb.innerHTML = "整机 / 内存条 / <b></b>"; crumb.querySelector("b").textContent = name;
            var ul = document.getElementById("xp-list"); ul.innerHTML = "";
            var li = document.createElement("li"); li.textContent = MLINES[name]; ul.appendChild(li);
          }, true);
          ram.fit = fitter(group, all, apply);
          ram.built = true;
          return true;
        };
        ram.open = function () {
          var g = (window.PARTS || []).filter(function (s) { return s.userData.id === "ram1"; })[0];
          if (!ram.built && !(EX.ctx && ram.build(g))) return;
          ram.open();
        };
        ram.close = function () {};

        /* 硬盘: 盘片 with 磁道 rings and a 扇区 wedge, 磁头臂, 索引块 tree */
        var DLINES = {
          "磁道": "同一半径的圆环；多盘面同半径构成柱面",
          "扇区": "磁盘地址 = 柱面号·磁头号·扇区号",
          "磁头臂": "访问时间 = 寻道时间 + 旋转延迟 + 传输时间",
          "索引块": "索引分配：索引块记录文件各数据块地址"
        };
        var disk = EX.disk = { built: false, isOpen: false };
        disk.build = function (group) {
          var THREE = window.THREE; if (!THREE || !group) return false;
          var OCHRE = 0xd9a21b, edgeMat = (function (m) { m.userData = { o: 0.35, tr: true, dw: true }; return m; })(new THREE.LineBasicMaterial({ color: 0x16181d, transparent: true, opacity: 0.35 }));
          var cover = group.children[2];
          var cover0 = { pos: cover.position.clone(), rot: cover.rotation.clone() };
          var meshes = [];
          function mat(hex) { return new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25, side: THREE.DoubleSide }); }
          function add(parent, geo, hex, name, edges) {
            var m = new THREE.Mesh(geo, mat(hex));
            if (edges) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat));
            m.userData.name = name; parent.add(m); meshes.push(m); return m;
          }
          /* platter */
          var P0 = new THREE.Vector3(0, 0, 0), P1 = new THREE.Vector3(0, 0.3, 0);
          var platter = new THREE.Group();
          add(platter, new THREE.CylinderGeometry(0.55, 0.55, 0.03, 48), tint(OCHRE, 0.6), "磁道", true);
          [0.22, 0.3, 0.38, 0.46].forEach(function (r) {
            var t = add(platter, new THREE.TorusGeometry(r, 0.007, 6, 64), tint(OCHRE, 0.1), "磁道");
            t.rotation.x = -Math.PI / 2; t.position.y = 0.019;
          });
          var wedgeGeo = new THREE.RingGeometry(0.14, 0.53, 16, 1, 0.3, 0.55);
          var wedge = add(platter, wedgeGeo, OCHRE, "扇区", true);
          wedge.rotation.x = -Math.PI / 2; wedge.position.y = 0.017;
          platter.visible = false; platter.position.copy(P0); group.add(platter);
          /* arm, pivoting at the front-right corner */
          var A0 = new THREE.Vector3(0.55, 0, 0.72), A1 = new THREE.Vector3(0.55, 0.36, 0.72);
          var arm = new THREE.Group();
          add(arm, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16), tint(OCHRE, 0.25), "磁头臂", true);
          var beam = add(arm, new THREE.BoxGeometry(0.04, 0.02, 0.72), tint(OCHRE, 0.15), "磁头臂", true);
          beam.position.set(0, 0.01, -0.36);
          var head = add(arm, new THREE.BoxGeometry(0.07, 0.035, 0.07), OCHRE, "磁头臂", true);
          head.position.set(0, -0.005, -0.73);
          arm.visible = false; arm.position.copy(A0); group.add(arm);
          /* 索引块 tree */
          var T0 = new THREE.Vector3(0, 0, 0), T1 = new THREE.Vector3(0, 0.42, 0);
          var tree = new THREE.Group();
          function node(text, hex, x, y) {
            var geo = new THREE.BoxGeometry(0.36, 0.2, 0.08);
            var m = add(tree, geo, hex, "索引块", true);
            var face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17),
              new THREE.MeshBasicMaterial({ map: labelTex(THREE, text, "#16181d"), transparent: true, depthWrite: false }));
            face.position.z = 0.042; face.userData.name = "索引块"; m.add(face); meshes.push(face);
            m.position.set(x, y, 0); return m;
          }
          node("索引块", OCHRE, 0, 0.62);
          node("数据块", tint(OCHRE, 0.5), -0.34, 0.24);
          node("数据块", tint(OCHRE, 0.5), 0.34, 0.24);
          var lg = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0.52, 0), new THREE.Vector3(-0.34, 0.34, 0),
            new THREE.Vector3(0, 0.52, 0), new THREE.Vector3(0.34, 0.34, 0)]);
          tree.add(new THREE.LineSegments(lg, edgeMat));
          tree.visible = false; tree.position.copy(T0); tree.scale.setScalar(0.2); group.add(tree);

          var coverItem = { p: 0 }, platItem = { p: 0, sel: 0, g: platter }, armItem = { p: 0, sel: 0, g: arm }, treeItem = { p: 0, sel: 0, g: tree };
          var all = [coverItem, platItem, armItem, treeItem], subs = [platItem, armItem, treeItem];
          var spin = 0, sweep = 0, wedgeSel = 0;
          function apply() {
            var c = coverItem.p;
            cover.position.set(cover0.pos.x, cover0.pos.y + 0.45 * c, cover0.pos.z - 0.7 * c);
            cover.rotation.set(cover0.rot.x - 0.2 * c, cover0.rot.y, cover0.rot.z);
            platter.position.lerpVectors(P0, P1, platItem.p);
            platter.position.y += 0.06 * platItem.sel;
            platter.rotation.set(0, spin * platItem.p, 0);
            wedge.position.y = 0.017 + 0.05 * wedgeSel;
            arm.position.lerpVectors(A0, A1, armItem.p);
            arm.position.y += 0.06 * armItem.sel;
            arm.rotation.set(0, (0.42 + sweep) * armItem.p, 0);
            tree.position.lerpVectors(T0, T1, treeItem.p);
            tree.position.y += 0.08 * treeItem.sel;
            tree.scale.setScalar(0.2 + 0.8 * treeItem.p);
          }
          /* slow spin and sweep while open */
          var loopRaf = null, lastT = 0;
          function loop(t) {
            if (!disk.isOpen) { loopRaf = null; return; }
            var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0; lastT = t;
            spin += dt * 0.7;
            sweep = 0.16 * Math.sin(t / 1000 * 1.1);
            apply();
            loopRaf = requestAnimationFrame(loop);
          }
          var run = runner(all, apply, function (to) {
            if (to === 0) {
              cover.position.copy(cover0.pos); cover.rotation.copy(cover0.rot);
              spin = 0; sweep = 0; wedgeSel = 0;
              subs.forEach(function (it) { it.p = 0; it.sel = 0; it.g.visible = false; });
              platter.position.copy(P0); platter.rotation.set(0, 0, 0);
              wedge.position.y = 0.017;
              arm.position.copy(A0); arm.rotation.set(0, 0, 0);
              tree.position.copy(T0); tree.rotation.set(0, 0, 0); tree.scale.setScalar(0.2);
            }
          });
          disk.open = function () {
            if (disk.isOpen) { select(null); return; }
            disk.isOpen = true;
            subs.forEach(function (it) { it.g.visible = true; });
            run(1, 60, all.map(function (_, i) { return i; }));
            if (!reduced && !loopRaf) { lastT = 0; loopRaf = requestAnimationFrame(loop); }
          };
          disk.close = function () {
            if (!disk.isOpen) return;
            disk.isOpen = false; select(null, true);
            if (loopRaf) { cancelAnimationFrame(loopRaf); loopRaf = null; }
            var n = all.length - 1;
            run(0, 60, all.map(function (_, i) { return n - i; }));
          };

          var selRaf = null, wedgeTarget = 0;
          function select(name, silent) {
            platItem.target = name === "磁道" ? 1 : 0;
            wedgeTarget = name === "扇区" ? 1 : 0;
            armItem.target = name === "磁头臂" ? 1 : 0;
            treeItem.target = name === "索引块" ? 1 : 0;
            if (selRaf) cancelAnimationFrame(selRaf);
            (function f() {
              var moving = false, k = reduced ? 1 : 0.2;
              subs.forEach(function (it) { var d = it.target - it.sel; if (Math.abs(d) > 0.002) { it.sel += d * k; moving = true; } else it.sel = it.target; });
              var dw = wedgeTarget - wedgeSel; if (Math.abs(dw) > 0.002) { wedgeSel += dw * k; moving = true; } else wedgeSel = wedgeTarget;
              if (disk.isOpen || !silent) apply();
              selRaf = moving ? requestAnimationFrame(f) : null;
            })();
          }
          var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), down = null;
          var cv = EX.ctx.canvas, host = cv.parentNode;
          host.addEventListener("pointerdown", function (ev) { down = ev.target === cv ? { x: ev.clientX, y: ev.clientY } : null; }, true);
          host.addEventListener("pointerup", function (ev) {
            if (!disk.isOpen || !down || ev.target !== cv) return;
            var moved = Math.abs(ev.clientX - down.x) + Math.abs(ev.clientY - down.y) > 8; down = null;
            if (moved) return;
            var r = cv.getBoundingClientRect();
            ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
            ray.setFromCamera(ptr, EX.ctx.camera);
            var hit = ray.intersectObjects(meshes, false)[0];
            if (!hit) return;
            ev.stopPropagation();
            var name = hit.object.userData.name;
            select(name);
            var crumb = document.getElementById("crumb");
            crumb.innerHTML = "整机 / 硬盘 / <b></b>"; crumb.querySelector("b").textContent = name;
            var ul = document.getElementById("xp-list"); ul.innerHTML = "";
            var li = document.createElement("li"); li.textContent = DLINES[name]; ul.appendChild(li);
          }, true);
          disk.fit = fitter(group, all, apply);
          disk.built = true;
          return true;
        };
        disk.open = function () {
          var g = (window.PARTS || []).filter(function (s) { return s.userData.id === "disk"; })[0];
          if (!disk.built && !(EX.ctx && disk.build(g))) return;
          disk.open();
        };
        disk.close = function () {};

        /* 网卡: 五层模型 slabs beside the raised card, one 分组 stepping down the layers and out the cable */
        var NLINES = {
          "应用层": "HTTP / DNS / SMTP，报文",
          "传输层": "TCP / UDP，报文段，端口号",
          "网络层": "IP 分组，路由与转发",
          "数据链路层": "帧，MAC 地址，差错检测 CRC",
          "物理层": "比特流，编码与调制",
          "分组": "自上而下逐层加首部 = 封装"
        };
        var nic = EX.nic = { built: false, isOpen: false };
        nic.build = function (group) {
          var THREE = window.THREE; if (!THREE || !group) return false;
          var COBALT = 0x2d4fa3, edgeMat = (function (m) { m.userData = { o: 0.35, tr: true, dw: true }; return m; })(new THREE.LineBasicMaterial({ color: 0x16181d, transparent: true, opacity: 0.35 }));
          var card = group.children.slice(0, 2).map(function (m) { return { m: m, pos: m.position.clone() }; });
          var curve = group.children[2].geometry.parameters.path;
          var RISE = 0.45, origin = new THREE.Vector3(0, RISE * 0.5, 0);
          var meshes = [];
          function slabTex(text, ink) {
            var c = document.createElement("canvas"); c.width = 512; c.height = 96;
            var x = c.getContext("2d");
            x.fillStyle = ink; x.textAlign = "center"; x.textBaseline = "middle";
            x.font = "600 60px Geist, system-ui, sans-serif";
            x.fillText(text, 256, 50);
            var t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
          }
          var NAMES = ["应用层", "传输层", "网络层", "数据链路层", "物理层"], A = [0.7, 0.55, 0.4, 0.25, 0.1];
          var W = 0.9, H = 0.16, D = 0.5, SX = 0.75, SZ = 0.35;
          var items = NAMES.map(function (n, i) {
            var g = new THREE.Group(), geo = new THREE.BoxGeometry(W, H, D);
            var m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: tint(COBALT, A[i]), roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
            m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat));
            var face = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.94, H * 0.9),
              new THREE.MeshBasicMaterial({ map: slabTex(n, A[i] < 0.35 ? "#f2efe8" : "#16181d"), transparent: true, depthWrite: false }));
            face.position.z = D / 2 + 0.002; m.add(face);
            g.add(m); meshes.push(m, face);
            g.visible = false; g.position.copy(origin); g.scale.setScalar(0.2);
            g.userData = { name: n, to: new THREE.Vector3(SX, 0.25 + (4 - i) * 0.3, SZ) };
            g.traverse(function (o) { o.userData.sub = g; });
            group.add(g);
            return { g: g, p: 0, sel: 0 };
          });
          /* the 分组 cube */
          var pgeo = new THREE.BoxGeometry(0.13, 0.13, 0.13), pk = new THREE.Group();
          var pm = new THREE.Mesh(pgeo, new THREE.MeshPhysicalMaterial({ color: COBALT, roughness: 0.38, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
          pm.add(new THREE.LineSegments(new THREE.EdgesGeometry(pgeo, 20), edgeMat));
          pk.add(pm); meshes.push(pm);
          pk.userData = { name: "分组" };
          pk.traverse(function (o) { o.userData.sub = pk; });
          pk.visible = false; pk.position.copy(origin); pk.scale.setScalar(0.2); group.add(pk);
          var pkItem = { g: pk, p: 0, sel: 0 };
          var subs = items.concat([pkItem]), cardItem = { p: 0 }, all = [cardItem].concat(subs);
          var tA = new THREE.Vector3(), tB = new THREE.Vector3();
          function layerPos(i, out) { var t = items[i].g.userData.to; return out.set(t.x + W / 2 + 0.14, t.y, t.z + 0.05); }
          var loopPos = layerPos(0, new THREE.Vector3()), grow = 1;
          function apply() {
            card.forEach(function (c) { c.m.position.set(c.pos.x, c.pos.y + RISE * cardItem.p, c.pos.z); });
            items.forEach(function (it) {
              var g = it.g, u = g.userData;
              g.position.lerpVectors(origin, u.to, it.p);
              g.position.z += 0.12 * it.sel;
              g.scale.setScalar(0.2 + 0.8 * it.p);
            });
            pk.position.lerpVectors(origin, loopPos, pkItem.p);
            pk.scale.setScalar(Math.max(0.01, (0.2 + 0.8 * pkItem.p) * grow * (1 + 0.25 * pkItem.sel)));
          }
          /* loop: hold at each layer, step down growing (加首部), then out along the cable */
          var STEP = 0.7, CAB = 1.4, CYCLE = 5 * STEP + CAB;
          function place(s) {
            s = s % CYCLE;
            if (s < 5 * STEP) {
              var i = Math.floor(s / STEP), f = (s - i * STEP) / STEP;
              var q = f < 0.55 ? 0 : easeOut((f - 0.55) / 0.45);
              layerPos(i, tA);
              if (i < 4) layerPos(i + 1, tB); else tB.copy(curve.getPointAt(0));
              loopPos.lerpVectors(tA, tB, q);
              grow = 1 + 0.15 * (i + (i < 4 ? q : 0));
            } else {
              var u = (s - 5 * STEP) / CAB;
              loopPos.copy(curve.getPointAt(u));
              grow = 1.6 * Math.min(1, (1 - u) / 0.15);
            }
          }
          var loopRaf = null, loopT0 = 0;
          function loop(t) {
            if (!nic.isOpen) { loopRaf = null; return; }
            if (!loopT0) loopT0 = t;
            place((t - loopT0) / 1000);
            apply();
            loopRaf = requestAnimationFrame(loop);
          }
          var run = runner(all, apply, function (to) {
            if (to === 0) {
              card.forEach(function (c) { c.m.position.copy(c.pos); });
              layerPos(0, loopPos); grow = 1;
              subs.forEach(function (it) { it.p = 0; it.sel = 0; var g = it.g; g.visible = false; g.position.copy(origin); g.rotation.set(0, 0, 0); g.scale.setScalar(0.2); });
            }
          });
          nic.open = function () {
            if (nic.isOpen) { select(null); return; }
            nic.isOpen = true;
            layerPos(0, loopPos); grow = 1;
            subs.forEach(function (it) { it.g.visible = true; });
            run(1, 60, all.map(function (_, i) { return i; }));
            if (!reduced && !loopRaf) { loopT0 = 0; loopRaf = requestAnimationFrame(loop); }
          };
          nic.close = function () {
            if (!nic.isOpen) return;
            nic.isOpen = false; select(null, true);
            if (loopRaf) { cancelAnimationFrame(loopRaf); loopRaf = null; }
            var n = all.length - 1;
            run(0, 60, all.map(function (_, i) { return n - i; }));
          };

          var selRaf = null;
          function select(g, silent) {
            subs.forEach(function (it) { it.target = it.g === g ? 1 : 0; });
            if (selRaf) cancelAnimationFrame(selRaf);
            (function f() {
              var moving = false;
              subs.forEach(function (it) { var d = it.target - it.sel; if (Math.abs(d) > 0.002) { it.sel += d * (reduced ? 1 : 0.2); moving = true; } else it.sel = it.target; });
              if (nic.isOpen || !silent) apply();
              selRaf = moving ? requestAnimationFrame(f) : null;
            })();
          }
          var ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), down = null;
          var cv = EX.ctx.canvas, host = cv.parentNode;
          host.addEventListener("pointerdown", function (ev) { down = ev.target === cv ? { x: ev.clientX, y: ev.clientY } : null; }, true);
          host.addEventListener("pointerup", function (ev) {
            if (!nic.isOpen || !down || ev.target !== cv) return;
            var moved = Math.abs(ev.clientX - down.x) + Math.abs(ev.clientY - down.y) > 8; down = null;
            if (moved) return;
            var r = cv.getBoundingClientRect();
            ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
            ray.setFromCamera(ptr, EX.ctx.camera);
            var hit = ray.intersectObjects(meshes, false)[0];
            if (!hit) return;
            ev.stopPropagation();
            var g = hit.object.userData.sub, name = g.userData.name;
            select(g);
            var crumb = document.getElementById("crumb");
            crumb.innerHTML = "整机 / 网卡 / <b></b>"; crumb.querySelector("b").textContent = name;
            var ul = document.getElementById("xp-list"); ul.innerHTML = "";
            var li = document.createElement("li"); li.textContent = NLINES[name]; ul.appendChild(li);
          }, true);
          nic.fit = fitter(group, all, apply);
          nic.built = true;
          return true;
        };
        nic.open = function () {
          var g = (window.PARTS || []).filter(function (s) { return s.userData.id === "nic"; })[0];
          if (!nic.built && !(EX.ctx && nic.build(g))) return;
          nic.open();
        };
        nic.close = function () {};
      })();
    
