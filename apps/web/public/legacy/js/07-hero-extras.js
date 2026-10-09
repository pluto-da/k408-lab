      /* 立体图附加：部件热点（可点按）。走线、浮尘、光斑与入场运镜已停用 */
      (function () {
        var H = window.HERO; if (!H || !window.THREE) return;
        var THREE = H.THREE, V3 = THREE.Vector3, cam = H.camera, ctl = H.controls, root = H.root, stage = H.stage, reduced = H.reduced;
        var UP = new V3(0, 1, 0);
        function grp(id) { return H.slabs.filter(function (s) { return s.userData.id === id; })[0]; }
        function flowOn() { return !!(window.FLOW && FLOW.on && FLOW.on()); }
        function busy() { return !!H.focusKey() || flowOn(); }
        function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

        /* ---------- 1. hotspot chips ---------- */
        var SPOTS = [
          { id: "cpu", name: "CPU", off: [0, 0, 0] },
          { id: "ram1", name: "内存", off: [0.224, 0, 0] },
          { id: "bus", name: "总线插槽", off: [0, 0, 0] },
          { id: "io", name: "I/O 与 DMA", off: [0, 0, 0] },
          { id: "nic", name: "网络接口", off: [0, 0, 0] },
          { id: "disk", name: "存储接口", off: [0, 0, 0] },
          { id: "os", name: "操作系统层", off: [2.0, 0, 2.0] }
        ];
        var NS = "http://www.w3.org/2000/svg";
        var layer = document.createElement("div"); layer.className = "x-hots";
        var svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "x-hots__lines"); svg.setAttribute("aria-hidden", "true");
        layer.appendChild(svg); stage.appendChild(layer);
        SPOTS.forEach(function (s) {
          s.g = grp(s.id); if (!s.g) return;
          var el = s.el = document.createElement("button");
          el.type = "button"; el.className = "x-hot is-off"; el.tabIndex = -1; el.setAttribute("aria-label", "查看" + s.name); el.dataset.part = s.id;
          el.innerHTML = '<i class="x-hot__dot" aria-hidden="true"></i><span class="x-hot__name"></span>';
          el.querySelector(".x-hot__name").textContent = s.name;
          s.ln = document.createElementNS(NS, "line"); s.ln.setAttribute("class", "is-off"); svg.appendChild(s.ln);
          s.on = false; s.a = -1; s.held = false;
          el.addEventListener("pointerdown", function (e) {
            if (e.pointerType === "mouse") return;
            s.held = false; clearTimeout(s.ht);
            s.ht = setTimeout(function () { s.held = true; el.classList.add("is-peek"); }, 380);
          });
          function release() { clearTimeout(s.ht); if (s.held) setTimeout(function () { el.classList.remove("is-peek"); }, 1400); }
          el.addEventListener("pointerup", release); el.addEventListener("pointercancel", release);
          el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
          el.addEventListener("click", function (e) {
            if (s.held) { s.held = false; e.preventDefault(); return; }
            var k = H.keyOf(s.g); if (k) H.focus(k);
          });
          layer.appendChild(el);
        });
        SPOTS = SPOTS.filter(function (s) { return s.g; });

        var P = new V3(), Q = new V3(), D = new V3(), N = new V3(), C = new V3();
        var introAlpha = function () { return 1; };
        function updateChips() {
          var w = stage.clientWidth, h = stage.clientHeight, fk = H.focusKey(), fl = flowOn();
          root.localToWorld(C.set(0, H.boardTopY(), 0));
          SPOTS.forEach(function (s, i) {
            var show = H.ready && !fl && (!fk || H.keyOf(s.g) === fk);
            s.g.localToWorld(P.set(s.off[0], s.off[1], s.off[2]));
            /* facing: the part's outward normal (up, leaning off the board's centre) against the view */
            N.set((P.x - C.x) * 0.35 / 2.8, 1, (P.z - C.z) * 0.35 / 2.8).normalize();
            D.copy(cam.position).sub(P).normalize();
            if (!fk && D.dot(N) < 0) show = false;
            Q.copy(P).addScaledVector(UP, 0.55);
            P.project(cam); Q.project(cam);
            var px = (P.x * 0.5 + 0.5) * w, py = (-P.y * 0.5 + 0.5) * h, ax = (Q.x * 0.5 + 0.5) * w, ay = (-Q.y * 0.5 + 0.5) * h;
            if (P.z > 1 || Q.z > 1 || ax < 0 || ax > w || ay < 30 || ay > h) show = false;
            if (show !== s.on) {
              s.on = show; s.el.classList.toggle("is-off", !show); s.ln.setAttribute("class", show ? "" : "is-off");
              s.el.tabIndex = show ? 0 : -1;
              if (!show) s.el.classList.remove("is-peek");
            }
            var a = introAlpha(i);
            if (a !== s.a) { s.a = a; s.el.style.setProperty("--in", a); s.ln.style.setProperty("--in", a); }
            if (show) {
              s.el.style.transform = "translate(" + ax.toFixed(1) + "px," + ay.toFixed(1) + "px) translate(-50%,-100%)";
              s.ln.setAttribute("x1", ax.toFixed(1)); s.ln.setAttribute("y1", ay.toFixed(1));
              s.ln.setAttribute("x2", px.toFixed(1)); s.ln.setAttribute("y2", py.toFixed(1));
            }
          });
        }

        /* soft round sprite texture */
        function radialTex(stops) {
          var n = 128, c = document.createElement("canvas"); c.width = c.height = n;
          var g = c.getContext("2d"), r = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
          stops.forEach(function (s) { r.addColorStop(s[0], "rgba(255,255,255," + s[1] + ")"); });
          g.fillStyle = r; g.fillRect(0, 0, n, n);
          var t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
        }
        function quiet(m) { m.userData.nofade = true; return m; }

        /* ---------- 2. signal traces ---------- */
        var traces = [], DL = 0.32, DS = 8;
        function buildTraces() {
          var y = H.boardTopY() + 0.02, COB = new THREE.Color(0x6f8fe0), OCH = new THREE.Color(0xf0c35a);
          function at(id) { var b = grp(id).userData.base; return new V3(b.x, y, b.z); }
          [["cpu", "ram1", COB, 3], ["cpu", "bus", OCH, 2], ["bus", "io", COB, 2], ["io", "nic", OCH, 3], ["io", "disk", COB, 2]].forEach(function (r, ri) {
            if (!grp(r[0]) || !grp(r[1])) return;
            var A = at(r[0]), B = at(r[1]), m = (A.z + B.z) / 2;
            var raw = [A, new V3(A.x, y, m), new V3(B.x, y, m), B], pts = [raw[0]];
            for (var i = 1; i < raw.length; i++) if (raw[i].distanceTo(pts[pts.length - 1]) > 1e-4) pts.push(raw[i]);
            var cum = [0]; for (i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
            var L = cum[cum.length - 1]; if (L < 0.05) return;
            var faint = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
              quiet(new THREE.LineBasicMaterial({ color: 0xf2efe8, transparent: true, opacity: 0.12, depthWrite: false })));
            faint.renderOrder = 2; root.add(faint);
            var tr = { pts: pts, cum: cum, L: L, s: 0, sp: 0.35 + ((ri * 37) % 10) / 18, dashes: [] };
            for (var k = 0; k < r[3]; k++) {
              var pos = new Float32Array(DS * 3), col = new Float32Array(DS * 3);
              for (var j = 0; j < DS; j++) { var f = Math.pow(j / (DS - 1), 1.6); col[j * 3] = r[2].r * f; col[j * 3 + 1] = r[2].g * f; col[j * 3 + 2] = r[2].b * f; }
              var geo = new THREE.BufferGeometry();
              geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
              var line = new THREE.Line(geo, quiet(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
              line.frustumCulled = false; line.renderOrder = 3; root.add(line);
              tr.dashes.push({ line: line, pos: pos, ph: (k / r[3]) * (L + DL) + ri * 0.17 });
            }
            traces.push(tr);
          });
        }
        function pointAt(tr, d, out) {
          d = Math.max(0, Math.min(tr.L, d));
          for (var i = 1; i < tr.cum.length; i++) if (d <= tr.cum[i] || i === tr.cum.length - 1) {
            var seg = tr.cum[i] - tr.cum[i - 1], u = seg > 0 ? (d - tr.cum[i - 1]) / seg : 0;
            return out.lerpVectors(tr.pts[i - 1], tr.pts[i], u);
          }
          return out.copy(tr.pts[0]);
        }
        var TP = new V3();
        function updateTraces(dt) {
          var run = !reduced && !busy();
          traces.forEach(function (tr) {
            if (run) tr.s += dt * tr.sp;
            tr.dashes.forEach(function (d) {
              var head = (tr.s + d.ph) % (tr.L + DL);
              for (var j = 0; j < DS; j++) {
                pointAt(tr, head - DL + (DL * j) / (DS - 1), TP);
                d.pos[j * 3] = TP.x; d.pos[j * 3 + 1] = TP.y; d.pos[j * 3 + 2] = TP.z;
              }
              d.line.geometry.attributes.position.needsUpdate = true;
            });
          });
        }

        /* ---------- 3. dust motes and light pool ---------- */
        var dust = null, MOTES = 250, HGT = 3.2, SHX = -0.376, SHZ = -0.82;
        function buildAtmosphere() {
          var y0 = H.boardTopY() + 0.15, seed = [], pos = new Float32Array(MOTES * 3);
          for (var i = 0; i < MOTES; i++) seed.push({ x: (Math.random() - 0.5) * 4.6, z: (Math.random() - 0.5) * 4.6, h: Math.random() * HGT, p: Math.random() * 6.28, v: 0.03 + Math.random() * 0.04 });
          var geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          var pts = new THREE.Points(geo, quiet(new THREE.PointsMaterial({
            color: 0xfff0dc, size: 0.045, sizeAttenuation: true, map: radialTex([[0, 1], [0.4, 0.6], [1, 0]]),
            transparent: true, opacity: 0.25, depthWrite: false
          })));
          pts.frustumCulled = false; root.add(pts);
          dust = { pts: pts, pos: pos, seed: seed, y0: y0 };
          moveDust(0);
          var pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), quiet(new THREE.MeshBasicMaterial({
            color: 0xffe2bf, map: radialTex([[0, 1], [0.45, 0.5], [1, 0]]), transparent: true, opacity: 0.25,
            blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
          })));
          pool.rotation.x = -Math.PI / 2; pool.scale.set(8.6, 6.2, 1);
          pool.position.set(0, H.ground.position.y + 0.004, 0); pool.renderOrder = 1; root.add(pool);
        }
        function moveDust(t) {
          var s = dust.seed, p = dust.pos;
          for (var i = 0; i < MOTES; i++) {
            var m = s[i], h = (m.h + t * m.v) % HGT;
            p[i * 3] = m.x + SHX * h + Math.sin(t * 0.13 + m.p) * 0.12;
            p[i * 3 + 1] = dust.y0 + h;
            p[i * 3 + 2] = m.z + SHZ * h + Math.cos(t * 0.11 + m.p * 1.3) * 0.12;
          }
          dust.pts.geometry.attributes.position.needsUpdate = true;
        }

        /* ---------- 5. intro move ---------- */
        var intro = null, introDone = true /* 不播放入场运镜 */, introT = 0, EV = ["pointerdown", "wheel", "keydown", "touchstart"];
        function ioc(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
        introAlpha = function (i) {
          if (introDone) return 1;
          if (!intro) return 0;
          return Math.round(clamp01((performance.now() - intro.t0 - 900 - i * 260) / 500) * 100) / 100;
        };
        function skip() { endIntro(true); }
        function startIntro() {
          var cpu = grp("cpu"); if (!cpu) { introDone = true; return; }
          var c = cpu.getWorldPosition(new V3());
          intro = { t0: performance.now(), c0: c.clone(), p0: c.clone().add(new V3(-2.2, 1.05, -1.2)) }; /* low but inside the orbit's polar limit */
          ctl.minDistance = 0.5; ctl.autoRotate = false;
          cam.position.copy(intro.p0); ctl.target.copy(intro.c0);
          EV.forEach(function (e) { window.addEventListener(e, skip, { capture: true, passive: true }); });
        }
        function endIntro() {
          if (!intro) return;
          intro = null; introDone = true;
          EV.forEach(function (e) { window.removeEventListener(e, skip, { capture: true }); });
          if (!H.focusKey()) {
            cam.position.copy(H.HOME_POS); ctl.target.copy(H.HOME_TGT);
            ctl.minDistance = H.MIN_D; ctl.autoRotate = !reduced;
          }
        }
        H.pre.push(function () {
          if (!introDone && !intro && H.ready) startIntro();
          if (!intro) return;
          var p = Math.min(1, (performance.now() - intro.t0) / 3200), e = ioc(p);
          cam.position.lerpVectors(intro.p0, H.HOME_POS, e);
          ctl.target.lerpVectors(intro.c0, H.HOME_TGT, e);
          if (p === 1) endIntro();
        });

        /* ---------- per frame ---------- */
        var built = false, last = 0;
        H.post.push(function (t) {
          if (H.ready && !built) { built = true; /* 信号走线、浮尘与光斑属于装饰，已去掉，只保留部件热点 */ }
          var dt = Math.min(0.1, Math.max(0, t - last)); last = t;
          if (built && traces.length) updateTraces(dt);
          updateChips();
        });
      })();
    
