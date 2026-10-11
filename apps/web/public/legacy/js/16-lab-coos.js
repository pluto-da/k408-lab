      /* 组成原理 + 操作系统动画实验：IEEE 754、Booth 乘法、海明码、寻址方式、磁盘调度、动态分区、生产者—消费者。
         纯计算函数挂在 window.LABU 上（ieee754Encode / ieee754Decode / booth / hammingEncode / hammingCheck / addressing /
         diskSchedule / partitionParse / partitionSim / pcSim），界面通过 LAB.push 注册，顶层不访问 DOM。 */
      (function () {
        var LAB = window.LAB = window.LAB || [];
        var LABU = window.LABU = window.LABU || {};
        var INF = 1 / 0, NAN = 0 / 0;

        /* ======================= 小工具 ======================= */
        function pad(s, w, c) { s = String(s); while (s.length < w) s = (c || "0") + s; return s; }
        function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
        function grp(s, k) { var o = []; for (var i = 0; i < s.length; i += k) o.push(s.slice(i, i + k)); return o.join(" "); }
        function tc(v, w) { var m = Math.pow(2, w); return pad((((v % m) + m) % m).toString(2), w); }
        function hx(v) { return pad((((v % 65536) + 65536) % 65536).toString(16).toUpperCase(), 4) + "H"; }
        function minus(s) { return String(s).replace(/^-/, "−"); }
        function pm(v) { return v < 0 ? "(" + minus(v) + ")" : String(v); }
        /* 说明文字里的负号统一写成 “−” */
        function fixNeg(list) { list.forEach(function (o) { ["v", "r", "d"].forEach(function (k) { if (typeof o[k] === "string") o[k] = o[k].replace(/(^|[\s=(^×（])-(?=\d)/g, "$1−"); }); }); return list; }
        function rep(s, k) { var o = []; for (var i = 0; i < k; i++) o.push(s); return o; }

        /* ======================= IEEE 754 ======================= */
        function normNum(s) { return String(s == null ? "" : s).replace(/[\s_]/g, "").replace(/[−–—－]/g, "-").replace(/＋/g, "+").replace(/。/g, "."); }
        function div2(d) { var q = "", r = 0; for (var i = 0; i < d.length; i++) { var c = r * 10 + (d.charCodeAt(i) - 48); q += String(c >> 1); r = c & 1; } return { q: q.replace(/^0+/, ""), r: r }; }
        function intBin(d) { d = d.replace(/^0+/, ""); if (!d) return "0"; var b = ""; while (d) { var x = div2(d); b = x.r + b; d = x.q; } return b; }
        function fracX2(a) { var c = 0; for (var i = a.length - 1; i >= 0; i--) { var v = a[i] * 2 + c; a[i] = v % 10; c = v >= 10 ? 1 : 0; } return c; }
        function fracZero(a) { for (var i = 0; i < a.length; i++) if (a[i]) return false; return true; }
        function fracStr(a) { var s = a.join("").replace(/0+$/, ""); return "0." + (s || "0"); }
        function cut(s, n) { return s.length > n ? s.slice(0, n) + "…" : s; }
        /* M × 2^k 的精确十进制（M 为非负整数） */
        function exactDec(M, k) {
          var a = String(M).split("").map(Number), i, j, c, v;
          if (k >= 0) {
            for (i = 0; i < k; i++) { c = 0; for (j = a.length - 1; j >= 0; j--) { v = a[j] * 2 + c; a[j] = v % 10; c = v >= 10 ? 1 : 0; } if (c) a.unshift(c); }
            return a.join("");
          }
          for (i = 0; i < -k; i++) { c = 0; for (j = a.length - 1; j >= 0; j--) { v = a[j] * 5 + c; a[j] = v % 10; c = Math.floor(v / 10); } while (c) { a.unshift(c % 10); c = Math.floor(c / 10); } }
          var s = a.join(""), p = -k;
          while (s.length <= p) s = "0" + s;
          return (s.slice(0, s.length - p) + "." + s.slice(s.length - p)).replace(/0+$/, "").replace(/\.$/, "");
        }
        function bitsHex(b) { var h = ""; for (var i = 0; i < 32; i += 4) h += parseInt(b.slice(i, i + 4), 2).toString(16).toUpperCase(); return h; }
        function fieldStr(b) { return b.charAt(0) + " | " + b.slice(1, 9) + " | " + b.slice(9); }
        LABU.IEEE_RANGE = "最大正规格化数 7F7FFFFF = (2 − 2^−23) × 2^127 ≈ 3.4028235 × 10^38；最小正规格化数 00800000 = 2^−126 ≈ 1.1754944 × 10^−38；最小正非规格化数 00000001 = 2^−149 ≈ 1.4 × 10^−45。";

        LABU.ieee754Encode = function (input) {
          var s = normNum(input), low = s.toLowerCase(), steps = [];
          if (!s) return { err: "请输入一个十进制数，例如 −0.75" };
          if (s.length > 60) return { err: "输入太长：最多 60 个字符" };
          var sp = /^([+-]?)(inf|infinity|∞|nan)$/.exec(low);
          if (sp) {
            var sg = sp[1] === "-" ? 1 : 0, nan = sp[2] === "nan", b0 = nan ? "0" + "11111111" + "1" + rep("0", 22).join("") : sg + "11111111" + rep("0", 23).join("");
            steps.push({ k: "特殊值", v: nan ? "NaN：阶码全 1、尾数不为 0（这里取最高位为 1 的“安静 NaN”）" : (sg ? "−∞" : "+∞") + "：阶码全 1、尾数全 0", r: fieldStr(b0), d: "无穷大和 NaN 用全 1 的阶码表示，不按普通数转换。", f: ["s", "e", "m"] });
            steps.push({ k: "十六进制", v: "4 位一组：" + grp(b0, 4), r: bitsHex(b0), d: "按 4 位一组写成十六进制。", f: ["hex"] });
            return { hex: bitsHex(b0), bits: b0, sign: +b0.charAt(0), exp: 255, frac: parseInt(b0.slice(9), 2), kind: nan ? "nan" : "inf", value: nan ? NAN : (sg ? -INF : INF), text: nan ? "NaN" : (sg ? "−∞" : "+∞"), steps: steps };
          }
          var m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d{1,3}))?$/i.exec(s);
          if (!m || !((m[2] || "") + (m[3] || "")).length) return { err: "“" + String(input) + "”不是合法的十进制数（例：−0.75、12.375、1e-3）" };
          var sign = m[1] === "-" ? 1 : 0, ip = m[2] || "", fp = m[3] || "", e10 = m[4] ? parseInt(m[4], 10) : 0;
          if (Math.abs(e10) > 60) return { err: "科学计数法的指数超出范围（|e| ≤ 60）" };
          if (e10 > 0) { while (fp.length < e10) fp += "0"; ip += fp.slice(0, e10); fp = fp.slice(e10); }
          else if (e10 < 0) { var kk = -e10; while (ip.length < kk) ip = "0" + ip; fp = ip.slice(ip.length - kk) + fp; ip = ip.slice(0, ip.length - kk); }
          ip = ip.replace(/^0+/, ""); fp = fp.replace(/0+$/, "");
          var absTxt = (ip || "0") + (fp ? "." + fp : "");
          steps.push({ k: "① 符号位", v: (sign ? "负数" : "正数或零") + "，取绝对值 " + absTxt, r: "S = " + sign, d: "先确定符号：" + (sign ? "负数 S = 1" : "非负数 S = 0") + "，之后只转换绝对值。", f: ["s"] });
          var I = intBin(ip), fa = fp.split("").map(Number), FB = [], prods = [], term = -1, t;
          for (t = 0; t < 152; t++) {
            if (fracZero(fa)) { term = t; break; }
            var before = fracStr(fa), b = fracX2(fa); FB.push(b);
            if (prods.length < 6) prods.push(cut(before, 14) + "×2 = " + b + cut(fracZero(fa) ? ".0" : fracStr(fa).slice(1), 13) + " → " + b);
          }
          var resid = term < 0 && !fracZero(fa), fbs = FB.join(""), shown = fbs.slice(0, 30);
          steps.push({ k: "② 整数部分", v: ip ? cut(ip, 20) + " 除 2 取余、倒序排列" : "整数部分为 0", r: cut(I, 40) + "₂", d: ip ? "整数部分 " + cut(ip, 20) + " 用“除 2 取余，余数倒排”得到 " + cut(I, 40) + "。" : "整数部分是 0，二进制也是 0。" });
          var fracMore = FB.length > 30 || resid;
          steps.push({ k: "③ 小数部分", v: fp ? prods.join("；") + (FB.length > prods.length ? "；……" : "") : "小数部分为 0",
            r: "0." + (shown || "0") + (fracMore ? "…" : ""),
            d: !fp ? "没有小数部分。" : term >= 0 ? "小数部分“乘 2 取整，顺序排列”，乘到小数部分为 0 就结束。" : "小数部分乘 2 取整永远乘不尽（无限循环），只能截断，这就是 " + absTxt + " 不能用浮点数精确表示的原因。" });
          var binStr = cut(I, 40) + "." + (shown || "0") + (fracMore ? "…" : "");
          var p1 = FB.indexOf(1), E, all, keep, guard, sticky, mant, up, expF, fracF, denorm = false, kind = "normal";
          var res = { sign: sign, steps: steps };
          function finish(bits, kd, extraD) {
            res.bits = bits; res.hex = bitsHex(bits); res.kind = kd; fixNeg(steps);
            var dd = LABU.ieee754Decode(res.hex);
            res.exp = dd.exp; res.frac = dd.frac; res.value = dd.value; res.text = dd.text; res.exact = dd.exact;
            steps.push({ k: "⑦ 拼接", v: "S | 阶码 | 尾数 = " + fieldStr(bits) + "，4 位一组：" + grp(bits, 4), r: res.hex,
              d: "把符号、阶码、尾数拼成 32 位，按 4 位一组写成十六进制 " + res.hex + "。" + (extraD || ""), f: ["hex"] });
            fixNeg(steps);
            return res;
          }
          if (I === "0" && p1 < 0) {
            steps.push({ k: "④ 零", v: resid ? "数值小于 2^−152，远小于最小非规格化数，下溢为 0" : "数值为 0", r: "阶码全 0、尾数全 0", d: resid ? "数太小，舍入后为 0（下溢）。" : "0 是特殊值：阶码和尾数都为 0，符号位区分 +0 和 −0。", f: ["e", "m"] });
            return finish(sign + rep("0", 31).join(""), "zero");
          }
          E = I !== "0" ? I.length - 1 : -(p1 + 1);
          if (E > 127) {
            steps.push({ k: "④ 上溢", v: "规格化后指数 E = " + E + " > 127", r: "±∞", d: "指数超过 127，超出单精度表示范围，上溢为无穷大。", f: ["e", "m"] });
            return finish(sign + "11111111" + rep("0", 23).join(""), "inf");
          }
          if (E >= -126) {
            all = I !== "0" ? I + fbs : fbs.slice(p1);
            while (all.length < 26) all += "0";
            keep = all.slice(0, 24); guard = all.charAt(24) === "1"; sticky = all.slice(25).indexOf("1") >= 0 || resid;
            steps.push({ k: "④ 规格化", v: binStr + " = 1." + cut(all.slice(1).replace(/0+$/, "") || "0", 30) + " × 2^" + E, r: "E = " + E,
              d: "移动小数点，使最高位的 1 在小数点前，得到 1.xxx × 2^" + E + "，指数 E = " + E + "。" });
            mant = parseInt(keep, 2);
            if (guard || sticky) {
              up = guard && (sticky || (mant & 1) === 1);
              if (up) mant++;
              steps.push({ k: "⑤ 舍入", v: "保留 24 位有效位 1." + grp(keep.slice(1), 4) + "，第 25 位 = " + (guard ? 1 : 0) + "，其后" + (sticky ? "还有 1" : "全为 0"),
                r: up ? "末位 +1" : "舍去", d: "有效位超过 24 位，按“舍入到最近，恰好一半时取偶”" + (up ? "向上进 1" : "直接舍去") + "，存进去的已不是原数，只是最接近它的单精度数。" });
              if (mant === 16777216) { mant = 8388608; E++; }
              if (E > 127) { steps.push({ k: "上溢", v: "舍入进位后 E = 128", r: "±∞", d: "舍入后指数超过 127，上溢为无穷大。" }); return finish(sign + "11111111" + rep("0", 23).join(""), "inf"); }
            }
            expF = E + 127; fracF = mant - 8388608;
            steps.push({ k: "⑥ 阶码", v: "阶码 = E + 127 = " + E + " + 127 = " + expF, r: pad(expF.toString(2), 8), d: "阶码用移码，偏置 127：" + E + " + 127 = " + expF + "，写成 8 位二进制。", f: ["e"] });
            var fstr = pad(fracF.toString(2), 23);
            steps.push({ k: "⑥ 尾数", v: "去掉隐藏的最高位 1，取小数点后 23 位（不足补 0）", r: grp(fstr, 4), d: "规格化尾数最高位一定是 1，不必存储（隐藏位），只存小数点后的 23 位。", f: ["m"] });
            return finish(sign + pad(expF.toString(2), 8) + fstr, "normal", (guard || sticky) ? "实际存储的值是 " + minus((sign ? "-" : "") + exactDec(mant, E - 23)) + "。" : "");
          }
          /* 非规格化 */
          denorm = true; kind = "denormal";
          var F = fbs; while (F.length < 152) F += "0";
          keep = F.slice(126, 149); guard = F.charAt(149) === "1"; sticky = F.slice(150).indexOf("1") >= 0 || resid;
          mant = parseInt(keep, 2);
          steps.push({ k: "④ 非规格化", v: binStr + " = 1.xxx × 2^" + E + "，E < −126", r: "0." + grp(keep, 4) + " × 2^−126",
            d: "指数小于 −126，无法规格化，按非规格化数存：阶码全 0（视为 E = −126），尾数没有隐藏位。" });
          if (guard || sticky) {
            up = guard && (sticky || (mant & 1) === 1); if (up) mant++;
            steps.push({ k: "⑤ 舍入", v: "第 24 位 = " + (guard ? 1 : 0) + "，其后" + (sticky ? "还有 1" : "全为 0"), r: up ? "末位 +1" : "舍去", d: "按“舍入到最近，恰好一半取偶”舍入。" });
          }
          if (mant === 8388608) { expF = 1; fracF = 0; kind = "normal"; } else { expF = 0; fracF = mant; }
          if (mant === 0) { steps.push({ k: "下溢", v: "舍入后尾数为 0", r: "0", d: "数值太小，下溢为 0。", f: ["e", "m"] }); return finish(sign + rep("0", 31).join(""), "zero"); }
          steps.push({ k: "⑥ 阶码", v: expF ? "舍入进位后变成最小规格化数，阶码 = 1" : "非规格化数阶码全 0", r: pad(expF.toString(2), 8), d: "非规格化数阶码字段为 0。", f: ["e"] });
          steps.push({ k: "⑥ 尾数", v: "2^−126 之后的 23 位直接作尾数（无隐藏位）", r: grp(pad(fracF.toString(2), 23), 4), d: "非规格化数尾数不隐藏最高位。", f: ["m"] });
          return finish(sign + pad(expF.toString(2), 8) + pad(fracF.toString(2), 23), kind);
        };

        LABU.ieee754Decode = function (input) {
          var s = String(input == null ? "" : input).replace(/\s+/g, "").replace(/^0x/i, "").replace(/H$/i, "");
          if (!/^[0-9a-fA-F]{8}$/.test(s)) return { err: "请输入 8 位十六进制数，例如 C1480000" };
          s = s.toUpperCase();
          var bits = "", i, steps = [];
          for (i = 0; i < 8; i++) bits += pad(parseInt(s.charAt(i), 16).toString(2), 4);
          var S = +bits.charAt(0), eb = bits.slice(1, 9), e = parseInt(eb, 2), fb = bits.slice(9), f = parseInt(fb, 2), sg = S ? -1 : 1;
          steps.push({ k: "① 转二进制", v: s.split("").join(" ") + " → " + grp(bits, 4), r: grp(bits, 4), d: "每个十六进制位展开成 4 位二进制。", f: ["s", "e", "m", "hex"] });
          steps.push({ k: "② 拆字段", v: "S = " + S + "，阶码 = " + eb + "（= " + e + "），尾数 = " + grp(fb, 4), r: fieldStr(bits), d: "按 1 | 8 | 23 拆出符号位、阶码、尾数。" });
          var kind, E, M, k, value, text, exact, ft = fb.replace(/0+$/, "");
          if (e === 255) {
            kind = f ? "nan" : "inf"; value = f ? NAN : sg * INF; text = f ? "NaN" : (S ? "−∞" : "+∞");
            steps.push({ k: "③ 判断类别", v: "阶码全 1，尾数" + (f ? "不为 0" : "全 0"), r: text, d: "阶码全 1 是特殊值：尾数为 0 表示 ±∞，否则是 NaN（非数）。" });
            return { hex: s, bits: bits, sign: S, exp: e, frac: f, kind: kind, value: value, text: text, exact: text, steps: steps };
          }
          if (e === 0 && f === 0) {
            kind = "zero"; value = S ? -0 : 0; text = S ? "−0" : "0";
            steps.push({ k: "③ 判断类别", v: "阶码全 0，尾数全 0", r: text, d: "阶码与尾数都为 0 表示 ±0。" });
            return { hex: s, bits: bits, sign: S, exp: e, frac: f, kind: kind, value: value, text: text, exact: text, steps: steps };
          }
          if (e === 0) { kind = "denormal"; E = -126; M = f; k = -149; }
          else { kind = "normal"; E = e - 127; M = 8388608 + f; k = E - 23; }
          value = sg * M * Math.pow(2, k);
          exact = (S ? "-" : "") + exactDec(M, k);
          text = String(value);
          steps.push({ k: "③ 判断类别", v: kind === "normal" ? "阶码不全 0 也不全 1" : "阶码全 0、尾数不为 0", r: kind === "normal" ? "规格化数" : "非规格化数",
            d: kind === "normal" ? "这是规格化数，尾数前有隐藏位 1。" : "这是非规格化数：指数固定为 −126，尾数没有隐藏位。" });
          steps.push({ k: "④ 指数", v: kind === "normal" ? "E = 阶码 − 127 = " + e + " − 127 = " + E : "E = 1 − 127 = −126（固定）", r: "E = " + E, d: "阶码减去偏置 127 得到真正的指数。" });
          var mtxt = (kind === "normal" ? "1." : "0.") + (ft || "0");
          steps.push({ k: "⑤ 尾数", v: (kind === "normal" ? "补上隐藏位 1：" : "无隐藏位：") + mtxt, r: mtxt + "₂", d: kind === "normal" ? "在 23 位尾数前补上隐藏的 1。" : "非规格化数尾数就是 0.xxx。" });
          var bin = "";
          if (kind === "normal" && E >= -24 && E <= 30) {
            var digs = "1" + ft, pt = 1 + E;
            if (pt <= 0) bin = "0." + rep("0", -pt).join("") + digs;
            else if (pt >= digs.length) bin = digs + rep("0", pt - digs.length).join("");
            else bin = digs.slice(0, pt) + "." + digs.slice(pt);
            bin = " = " + (S ? "−" : "") + bin + "₂";
          }
          var dec = exact.length > 40 ? Number(value).toPrecision(9) + "（精确值 " + cut(minus(exact), 40) + "）" : minus(exact);
          steps.push({ k: "⑥ 求值", v: "(−1)^" + S + " × " + mtxt + " × 2^" + E + bin, r: dec, d: "按 (−1)^S × 尾数 × 2^E 求值，得 " + (exact.length > 40 ? Number(value).toPrecision(9) : minus(exact)) + "。" });
          fixNeg(steps);
          return { hex: s, bits: bits, sign: S, exp: e, frac: f, kind: kind, value: value, text: text, exact: exact, steps: steps };
        };

        /* ======================= Booth 补码一位乘法 ======================= */
        LABU.booth = function (x, y, n) {
          n = n || 4;
          if ([4, 6, 8].indexOf(n) < 0) return { err: "位数只能选 4、6 或 8" };
          var lo = -Math.pow(2, n - 1), hi = -lo - 1;
          function chk(v, nm) {
            if (typeof v !== "number" || isNaN(v) || v % 1 !== 0) return nm + " 必须是整数";
            if (v < lo || v > hi) return nm + " = " + minus(v) + " 超出 " + n + " 位补码范围 [" + minus(lo) + ", " + hi + "]";
            return "";
          }
          var e1 = chk(x, "X") || chk(y, "Y");
          if (e1) return { err: e1 };
          function A2(v) { var b = tc(v, n + 2); return b.slice(0, 2) + " " + b.slice(2); }
          var A = 0, Q = parseInt(tc(y, n), 2), q1 = 0, rows = [], yc = tc(y, n);
          rows.push({ no: "初值", cond: "", op: "", a: A2(0), q: yc, q1: "0", d: "部分积清 0（双符号位），乘数寄存器放 [Y]补 = " + yc + "，附加位 Yₙ₊₁ = 0。" });
          for (var i = 1; i <= n; i++) {
            var pr = String(Q & 1) + String(q1), op, add = 0;
            if (pr === "01") { add = x; op = "+[X]补 " + A2(x); }
            else if (pr === "10") { add = -x; op = "+[−X]补 " + A2(-x); }
            else op = "+0";
            A += add;
            rows.push({ no: String(i), cond: pr, op: op, a: A2(A), q: tc(Q, n), q1: String(q1), hl: true,
              d: "第 " + i + " 次判断：YₙYₙ₊₁ = " + pr + "，" + (pr === "01" ? "部分积加 [X]补" : pr === "10" ? "部分积加 [−X]补" : "不加（只移位）") + "，部分积变为 " + A2(A) + (i === n ? "；这是最后一步，只加不移。" : "。") });
            if (i < n) {
              q1 = Q & 1;
              Q = (Q >> 1) | ((A & 1) << (n - 1));
              A = Math.floor(A / 2);
              rows.push({ no: "", cond: "", op: "→1", a: A2(A), q: tc(Q, n), q1: String(q1),
                d: "部分积与乘数一起算术右移 1 位（符号位不变），乘数最低位移入附加位。" });
            }
          }
          var P = A * Math.pow(2, n - 1) + (Q >> 1), pb = tc(P, 2 * n);
          var nx = -x <= hi ? tc(-x, n) : null;
          return { n: n, x: x, y: y, xc: tc(x, n), nxc: A2(-x), nxn: nx, yc: yc, rows: rows, product: pb, value: P, ok: P === x * y,
            pa: tc(A, n + 2).slice(1), pq: tc(Q, n).slice(0, n - 1) };
        };

        /* ======================= 海明码 ======================= */
        function isPow2(v) { return v > 0 && (v & (v - 1)) === 0; }
        LABU.hammingEncode = function (data, parity) {
          data = String(data == null ? "" : data).replace(/\s+/g, "");
          if (!data) return { err: "请输入信息位，例如 1010" };
          if (!/^[01]+$/.test(data)) return { err: "信息位只能由 0 和 1 组成" };
          if (data.length > 16) return { err: "信息位最多 16 位" };
          var odd = parity === "odd", n = data.length, k = 0, tries = [], ok = false;
          while (!ok) { k++; ok = Math.pow(2, k) >= n + k + 1; tries.push({ k: k, l: Math.pow(2, k), r: n + k + 1, ok: ok }); }
          var m = n + k, layout = [], di = 0, bit = {}, pos;
          for (pos = 1; pos <= m; pos++) {
            if (isPow2(pos)) layout.push({ pos: pos, kind: "P", name: "P" + pos });
            else { di++; bit[pos] = +data.charAt(di - 1); layout.push({ pos: pos, kind: "D", name: "D" + di, bit: bit[pos] }); }
          }
          var groups = [];
          for (var p = 1; p <= m; p *= 2) {
            var cov = [], bs = [], x = 0;
            for (pos = 1; pos <= m; pos++) if ((pos & p) && pos !== p) { cov.push(pos); bs.push(bit[pos]); x ^= bit[pos]; }
            var v = odd ? 1 - x : x;
            bit[p] = v;
            groups.push({ p: p, name: "P" + p, covers: cov, bits: bs, x: x, v: v, names: cov.map(function (q) { return layout[q - 1].name; }) });
          }
          layout.forEach(function (l) { l.bit = bit[l.pos]; });
          var code = layout.map(function (l) { return l.bit; }).join("");
          return { n: n, k: k, m: m, odd: odd, tries: tries, layout: layout, groups: groups, code: code };
        };
        LABU.hammingCheck = function (code, parity) {
          code = String(code == null ? "" : code).replace(/\s+/g, "");
          if (!/^[01]+$/.test(code)) return { err: "接收码字只能由 0 和 1 组成" };
          if (code.length < 3 || code.length > 21) return { err: "接收码字长度应在 3–21 位之间" };
          var odd = parity === "odd", m = code.length, groups = [], S = 0, syn = "";
          for (var p = 1; p <= m; p *= 2) {
            var cov = [], bs = [], x = 0;
            for (var pos = 1; pos <= m; pos++) if (pos & p) { cov.push(pos); bs.push(+code.charAt(pos - 1)); x ^= +code.charAt(pos - 1); }
            var s = odd ? 1 - x : x;
            S += s * p; syn = s + syn;
            groups.push({ p: p, name: "S" + p, covers: cov, bits: bs, x: x, s: s });
          }
          var corrected = code, multi = S > m;
          if (S && !multi) corrected = code.slice(0, S - 1) + (code.charAt(S - 1) === "1" ? "0" : "1") + code.slice(S);
          var data = "";
          for (var q = 1; q <= m; q++) if (!isPow2(q)) data += corrected.charAt(q - 1);
          return { m: m, groups: groups, syn: syn, S: S, pos: multi ? -1 : S, multi: multi, corrected: corrected, data: data };
        };

        /* ======================= 寻址方式 ======================= */
        LABU.ADDR_MODES = [["imm", "立即寻址"], ["direct", "直接寻址"], ["indirect", "间接寻址"], ["reg", "寄存器寻址"], ["regind", "寄存器间接"], ["base", "基址寻址"], ["index", "变址寻址"], ["rel", "相对寻址"]];
        LABU.ADDR_DEF = { A: 0x0200, r: 1, regs: { PC: 0x1000, R0: 0x0010, R1: 0x2000, R2: 0x0300, R3: 0x0004, BR: 0x3000, IX: 0x0100 },
          mem: { 0x0200: 0x2500, 0x2500: 0x7777, 0x2000: 0x1234, 0x3200: 0x5678, 0x0300: 0x9ABC, 0x1200: 0x4321 } };
        LABU.addressing = function (o) {
          o = o || {};
          var D = LABU.ADDR_DEF, mode = o.mode || "direct", A = o.A == null ? D.A : o.A, r = o.r == null ? D.r : o.r, regs = o.regs || D.regs, mem = o.mem || D.mem;
          var name = null;
          LABU.ADDR_MODES.forEach(function (m) { if (m[0] === mode) name = m[1]; });
          if (!name) return { err: "未知的寻址方式：" + mode };
          if (typeof A !== "number" || isNaN(A) || A < 0 || A > 0xffff) return { err: "形式地址 A 应为 0000H–FFFFH 的十六进制数" };
          if ([0, 1, 2, 3].indexOf(r) < 0) return { err: "寄存器编号只能是 R0–R3" };
          function rg(k) { return regs[k] == null ? 0 : regs[k]; }
          function rd(a) { return mem[a] == null ? 0 : mem[a]; }
          var Rn = "R" + r, steps = [], acc = [], ea = null, opd, expr = "";
          var inst = "OP | " + name + " | A = " + hx(A);
          steps.push({ t: "取指", d: "指令 " + inst + " 已取入 IR，PC 已自增为 " + hx(rg("PC")) + "（取指不计入下面的访存次数）。", hl: { inst: true } });
          function load(a, why) { var v = rd(a); acc.push({ addr: a, val: v, why: why }); return v; }
          switch (mode) {
            case "imm":
              opd = A;
              steps.push({ t: "取操作数", d: "立即寻址：形式地址字段本身就是操作数 " + hx(A) + "，不计算 EA，也不访存。", hl: { inst: true, opd: true } });
              break;
            case "direct":
              ea = A; expr = "EA = A";
              steps.push({ t: "求 EA", d: "直接寻址：EA = A = " + hx(A) + "。", hl: { inst: true, ea: true } });
              opd = load(ea, "取操作数");
              steps.push({ t: "访存 1", d: "访存 1 次：读 M[" + hx(ea) + "] = " + hx(opd) + "，即操作数。", hl: { ea: true, mem: [ea], opd: true } });
              break;
            case "indirect":
              expr = "EA = (A)";
              steps.push({ t: "分析", d: "间接寻址：A = " + hx(A) + " 是“操作数地址”所在的单元，要先访存取出 EA。", hl: { inst: true } });
              ea = load(A, "取 EA");
              steps.push({ t: "访存 1", d: "第 1 次访存：读 M[" + hx(A) + "] = " + hx(ea) + "，得到 EA = (A) = " + hx(ea) + "。", hl: { mem: [A], ea: true } });
              opd = load(ea, "取操作数");
              steps.push({ t: "访存 2", d: "第 2 次访存：读 M[" + hx(ea) + "] = " + hx(opd) + "，取到操作数，共访存 2 次。", hl: { ea: true, mem: [ea], opd: true } });
              break;
            case "reg":
              opd = rg(Rn);
              steps.push({ t: "取操作数", d: "寄存器寻址：地址字段给出寄存器号 " + Rn + "，操作数就在 " + Rn + " 中 = " + hx(opd) + "，不访存。", hl: { regs: [Rn], opd: true } });
              break;
            case "regind":
              ea = rg(Rn); expr = "EA = (" + Rn + ")";
              steps.push({ t: "求 EA", d: "寄存器间接：EA = (" + Rn + ") = " + hx(ea) + "。", hl: { regs: [Rn], ea: true } });
              opd = load(ea, "取操作数");
              steps.push({ t: "访存 1", d: "访存 1 次：读 M[" + hx(ea) + "] = " + hx(opd) + "，即操作数。", hl: { ea: true, mem: [ea], opd: true } });
              break;
            case "base":
            case "index":
              var rk = mode === "base" ? "BR" : "IX";
              ea = (rg(rk) + A) % 65536; expr = "EA = (" + rk + ") + A";
              steps.push({ t: "求 EA", d: (mode === "base" ? "基址寻址" : "变址寻址") + "：EA = (" + rk + ") + A = " + hx(rg(rk)) + " + " + hx(A) + " = " + hx(ea) + "。", hl: { regs: [rk], inst: true, ea: true } });
              opd = load(ea, "取操作数");
              steps.push({ t: "访存 1", d: "访存 1 次：读 M[" + hx(ea) + "] = " + hx(opd) + "，即操作数。", hl: { ea: true, mem: [ea], opd: true } });
              break;
            case "rel":
              var disp = A >= 0x8000 ? A - 0x10000 : A;
              ea = ((rg("PC") + disp) % 65536 + 65536) % 65536; expr = "EA = (PC) + A";
              steps.push({ t: "求 EA", d: "相对寻址：EA = (PC) + A，PC 是取指后已加上指令长度的值 " + hx(rg("PC")) + "；A = " + hx(A) + (disp < 0 ? " 是补码位移 " + minus(disp) : "") + "，EA = " + hx(ea) + "。", hl: { regs: ["PC"], inst: true, ea: true } });
              opd = load(ea, "取操作数");
              steps.push({ t: "访存 1", d: "访存 1 次：读 M[" + hx(ea) + "] = " + hx(opd) + "，即操作数。", hl: { ea: true, mem: [ea], opd: true } });
              break;
          }
          return { mode: mode, name: name, A: A, r: r, ea: ea, expr: expr, operand: opd, accesses: acc, count: acc.length, steps: steps, inst: inst };
        };
        LABU.addrParse = function (regStr, memStr) {
          var regs = {}, mem = {}, i, m, it;
          var ri = String(regStr || "").split(/[，,;；\s]+/).filter(function (x) { return x; });
          for (i = 0; i < ri.length; i++) {
            m = /^(PC|R[0-3]|BR|IX)[=:：]([0-9A-Fa-f]{1,4})H?$/i.exec(ri[i]);
            if (!m) return { err: "寄存器“" + ri[i] + "”格式不对，应写成 R1=2000（十六进制）" };
            regs[m[1].toUpperCase()] = parseInt(m[2], 16);
          }
          var mi = String(memStr || "").split(/[，,;；\s]+/).filter(function (x) { return x; });
          if (mi.length > 12) return { err: "主存单元最多列 12 个" };
          for (i = 0; i < mi.length; i++) {
            it = mi[i];
            m = /^([0-9A-Fa-f]{1,4})H?[=:：]([0-9A-Fa-f]{1,4})H?$/.exec(it);
            if (!m) return { err: "主存单元“" + it + "”格式不对，应写成 0200=2500（十六进制）" };
            mem[parseInt(m[1], 16)] = parseInt(m[2], 16);
          }
          return { regs: regs, mem: mem };
        };

        /* ======================= 磁盘调度 ======================= */
        LABU.DISK_ALGS = [["fcfs", "FCFS"], ["sstf", "SSTF"], ["scan", "SCAN"], ["cscan", "C-SCAN"], ["look", "LOOK"], ["clook", "C-LOOK"]];
        LABU.diskSchedule = function (o) {
          o = o || {};
          var req = o.req || [], h = o.start, lo = o.min == null ? 0 : o.min, hi = o.max == null ? 199 : o.max, up = o.dir !== "down", alg = o.alg || "fcfs", i;
          function isInt(v) { return typeof v === "number" && !isNaN(v) && v % 1 === 0; }
          if (!isInt(lo) || !isInt(hi) || lo < 0 || hi <= lo || hi > 9999) return { err: "磁道范围不合法：应满足 0 ≤ 最小磁道 < 最大磁道 ≤ 9999" };
          if (!isInt(h) || h < lo || h > hi) return { err: "磁头初始位置应在 " + lo + "–" + hi + " 之间" };
          if (!req.length) return { err: "请求序列为空" };
          if (req.length > 30) return { err: "请求最多 30 个" };
          for (i = 0; i < req.length; i++) if (!isInt(req[i]) || req[i] < lo || req[i] > hi) return { err: "请求“" + req[i] + "”不在磁道范围 " + lo + "–" + hi + " 内" };
          var known = false; LABU.DISK_ALGS.forEach(function (a) { if (a[0] === alg) known = true; });
          if (!known) return { err: "未知算法：" + alg };
          var path = [{ t: h }], cur = h, tie = false;
          function go(t, kind) { path.push({ t: t, kind: kind || "req" }); cur = t; }
          var rest = req.slice();
          if (alg === "fcfs") rest.forEach(function (t) { go(t); });
          else if (alg === "sstf") {
            var dirUp = up;
            while (rest.length) {
              var bi = -1, bd = INF;
              for (i = 0; i < rest.length; i++) {
                var d = Math.abs(rest[i] - cur);
                if (d < bd || (d === bd && d > 0 && (dirUp ? rest[i] > cur : rest[i] < cur))) { if (d === bd) tie = true; bd = d; bi = i; }
              }
              var t = rest.splice(bi, 1)[0];
              if (t !== cur) dirUp = t > cur;
              go(t);
            }
          } else {
            var asc = req.slice().sort(function (a, b) { return a - b; });
            var ahead = asc.filter(function (t) { return up ? t >= h : t <= h; }), behind = asc.filter(function (t) { return up ? t < h : t > h; });
            if (!up) ahead.reverse();
            ahead.forEach(function (t) { go(t); });
            if (behind.length) {
              var end = up ? hi : lo, other = up ? lo : hi;
              if (alg === "scan") { if (cur !== end) go(end, "end"); (up ? behind.reverse() : behind).forEach(function (t) { go(t); }); }
              else if (alg === "look") (up ? behind.reverse() : behind).forEach(function (t) { go(t); });
              else if (alg === "cscan") {
                if (cur !== end) go(end, "end");
                go(other, "jump");
                (up ? behind : behind.reverse()).forEach(function (t) { go(t); });
              } else {
                var seq = up ? behind : behind.reverse();
                path.push({ t: seq[0], kind: "jumpreq" }); cur = seq[0];
                seq.slice(1).forEach(function (t) { go(t); });
              }
            }
          }
          var moves = [], total = 0, order = [];
          for (i = 1; i < path.length; i++) {
            var dd = Math.abs(path[i].t - path[i - 1].t); total += dd;
            var isReq = path[i].kind === "req" || path[i].kind === "jumpreq";
            if (isReq) order.push(path[i].t);
            moves.push({ from: path[i - 1].t, to: path[i].t, dist: dd, total: total, kind: path[i].kind, req: isReq });
          }
          return { path: path, moves: moves, total: total, avg: total / req.length, order: order, n: req.length, tie: tie, alg: alg };
        };
        function parseNums(s, nm) {
          var a = String(s == null ? "" : s).split(/[\s,，、;；]+/).filter(function (x) { return x !== ""; });
          for (var i = 0; i < a.length; i++) if (!/^\d{1,4}$/.test(a[i])) return { err: nm + "中“" + a[i] + "”不是非负整数" };
          return { v: a.map(Number) };
        }
        LABU.parseNums = parseNums;

        /* ======================= 动态分区分配 ======================= */
        LABU.PART_ALGS = [["ff", "首次适应"], ["nf", "邻近适应"], ["bf", "最佳适应"], ["wf", "最坏适应"]];
        LABU.PART_DEF = "A 申请 130，B 申请 60，C 申请 100，B 释放，D 申请 200，C 释放，E 申请 140，A 释放，F 申请 100，F 释放，E 释放，G 申请 300";
        LABU.partitionParse = function (str) {
          var items = String(str == null ? "" : str).split(/[，,;；、\n]+/).map(function (x) { return x.replace(/^\s+|\s+$/g, ""); }).filter(function (x) { return x; });
          if (!items.length) return { err: "作业序列为空" };
          if (items.length > 30) return { err: "作业序列最多 30 项" };
          var live = {}, ops = [];
          for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var m = /^([A-Za-z][A-Za-z0-9]{0,3})\s*(?:申请|分配|请求|\+)\s*(\d+)\s*(?:KB|K)?$/i.exec(it);
            var f = /^([A-Za-z][A-Za-z0-9]{0,3})\s*(?:释放|回收|结束|-)$/i.exec(it);
            if (m) {
              var j = m[1].toUpperCase(), z = parseInt(m[2], 10);
              if (j === "OS") return { err: "OS 是保留名，作业请换个名字" };
              if (!z) return { err: "作业 " + j + " 申请的大小必须大于 0" };
              if (z > 100000) return { err: "作业 " + j + " 申请的大小太大" };
              if (live[j]) return { err: "作业 " + j + " 已经在内存中，不能重复申请" };
              live[j] = 1; ops.push({ j: j, size: z });
            } else if (f) {
              var jf = f[1].toUpperCase();
              if (!live[jf]) return { err: "释放不存在的作业 " + jf + "：它还没有申请或已经释放" };
              live[jf] = 0; ops.push({ j: jf, free: true });
            } else return { err: "无法识别“" + it + "”，请写成“A 申请 130”或“A 释放”" };
          }
          return { ops: ops };
        };
        function orderFree(blocks, alg) {
          var fr = blocks.filter(function (b) { return !b.j; }).map(function (b) { return { s: b.s, z: b.z }; });
          if (alg === "bf") fr.sort(function (a, b) { return a.z - b.z || a.s - b.s; });
          else if (alg === "wf") fr.sort(function (a, b) { return b.z - a.z || a.s - b.s; });
          else fr.sort(function (a, b) { return a.s - b.s; });
          return fr;
        }
        LABU.partitionSim = function (ops, alg, total, osz) {
          total = total == null ? 640 : total; osz = osz == null ? 40 : osz; alg = alg || "ff";
          if (typeof total !== "number" || isNaN(total) || total % 1 || total < 16 || total > 100000) return { err: "内存总量应为 16–100000 之间的整数（KB）" };
          if (typeof osz !== "number" || isNaN(osz) || osz % 1 || osz < 0 || osz >= total) return { err: "OS 占用应为 0 到内存总量之间的整数（KB）" };
          var an = null; LABU.PART_ALGS.forEach(function (a) { if (a[0] === alg) an = a[1]; });
          if (!an) return { err: "未知算法：" + alg };
          var blocks = [], ptr = osz, frames = [];
          if (osz) blocks.push({ s: 0, z: osz, j: "OS" });
          blocks.push({ s: osz, z: total - osz, j: null });
          function cp() { return blocks.map(function (b) { return { s: b.s, z: b.z, j: b.j }; }); }
          function snap(f) { f.blocks = cp(); f.free = orderFree(blocks, alg); f.ptr = ptr; frames.push(f); return f; }
          function rg(s, z) { return s + "–" + (s + z) + "K"; }
          snap({ op: null, d: "初始：OS 占 " + rg(0, osz) + "，空闲区 " + rg(osz, total - osz) + "（" + (total - osz) + "K）。算法：" + an + "。" });
          (ops || []).forEach(function (op) {
            var i, b;
            if (!op.free) {
              var fr = orderFree(blocks, alg), pick = null;
              if (alg === "nf") {
                var st = 0; while (st < fr.length && fr[st].s + fr[st].z <= ptr) st++;
                for (i = 0; i < fr.length; i++) { b = fr[(st + i) % fr.length]; if (b.z >= op.size) { pick = b; break; } }
              } else for (i = 0; i < fr.length; i++) if (fr[i].z >= op.size) { pick = fr[i]; break; }
              if (!pick) {
                var sum = fr.reduce(function (a, x) { return a + x.z; }, 0), mx = fr.reduce(function (a, x) { return Math.max(a, x.z); }, 0);
                snap({ op: op, fail: true, frag: sum >= op.size, d: op.j + " 申请 " + op.size + "K 失败：最大空闲区只有 " + mx + "K。" +
                  (sum >= op.size ? "空闲区总和 " + sum + "K 足够，但都不连续——这就是外部碎片（可用紧凑技术拼接）。" : "空闲区总和 " + sum + "K 也不够。") });
                return;
              }
              for (i = 0; i < blocks.length; i++) if (blocks[i].s === pick.s) break;
              b = blocks[i];
              var rem = b.z - op.size, nb = [{ s: b.s, z: op.size, j: op.j }];
              if (rem) nb.push({ s: b.s + op.size, z: rem, j: null });
              blocks.splice.apply(blocks, [i, 1].concat(nb));
              var why = alg === "ff" ? "从低地址起找到第一个够大的空闲区" : alg === "nf" ? "从上次分配结束处（" + ptr + "K）往后循环查找，第一个够大的空闲区" :
                alg === "bf" ? "空闲链按大小递增排列，取第一个能满足的（最小的够用分区）" : "空闲链按大小递减排列，取最大的空闲区";
              ptr = b.s + op.size;
              snap({ op: op, ok: true, chosen: { s: b.s, z: op.size }, from: { s: pick.s, z: pick.z },
                d: op.j + " 申请 " + op.size + "K：" + why + " " + rg(pick.s, pick.z) + "，分配 " + rg(b.s, op.size) + (rem ? "，剩余 " + rg(b.s + op.size, rem) + " 仍空闲。" : "，正好用完。") });
            } else {
              for (i = 0; i < blocks.length; i++) if (blocks[i].j === op.j) break;
              if (i >= blocks.length) { snap({ op: op, skip: true, d: "作业 " + op.j + " 之前分配失败、不在内存中，无需释放。" }); return; }
              b = blocks[i];
              var s0 = b.s, z0 = b.z, pv = i > 0 && !blocks[i - 1].j ? blocks[i - 1] : null, nx = i + 1 < blocks.length && !blocks[i + 1].j ? blocks[i + 1] : null;
              var ns = pv ? pv.s : b.s, nz = (pv ? pv.z : 0) + b.z + (nx ? nx.z : 0), mc = pv && nx ? "both" : pv ? "up" : nx ? "down" : "none";
              blocks.splice(pv ? i - 1 : i, 1 + (pv ? 1 : 0) + (nx ? 1 : 0), { s: ns, z: nz, j: null });
              var txt = { none: "上下相邻都是已分配区，不合并，作为新空闲区按算法要求的顺序插入空闲链。",
                up: "只与上邻空闲区 " + (pv ? rg(pv.s, pv.z) : "") + " 相邻，合并后起址取上邻起址，大小相加。",
                down: "只与下邻空闲区 " + (nx ? rg(nx.s, nx.z) : "") + " 相邻，合并后起址取回收区起址，大小相加。",
                both: "上下都与空闲区相邻，三块合为一块，空闲区数量减一。" }[mc];
              snap({ op: op, ok: true, merge: mc, chosen: { s: ns, z: nz }, d: op.j + " 释放 " + rg(s0, z0) + "：" + txt + (mc !== "none" ? "合并为 " + rg(ns, nz) + "（" + nz + "K）。" : "") });
            }
          });
          return { frames: frames, alg: alg, total: total, os: osz };
        };

        /* ======================= 生产者—消费者 ======================= */
        LABU.PC_PROCS = ["P1", "P2", "C1", "C2"];
        LABU.PC_PROG = { ok: ["P(empty)", "P(mutex)", "放入", "V(mutex)", "V(full)"], bad: ["P(mutex)", "P(empty)", "放入", "V(mutex)", "V(full)"], cons: ["P(full)", "P(mutex)", "取出", "V(mutex)", "V(empty)"] };
        (function () {
          function r(p, k) { return rep(p, k); }
          LABU.PC_SCRIPT = [].concat(r("P1", 5), r("P2", 5), r("P1", 5), ["P2"], r("C1", 5), r("P2", 4));
          LABU.PC_SCRIPT_BAD = [].concat(r("P1", 5), r("P2", 5), r("P1", 5), ["P2", "P2", "C1", "C1", "P1", "C2", "C2"]);
        })();
        LABU.pcSim = function (o) {
          o = o || {};
          var n = o.n == null ? 3 : o.n, wrong = !!o.wrong, seq = o.seq || [];
          if (typeof n !== "number" || isNaN(n) || n % 1 || n < 1 || n > 6) return { err: "缓冲区个数应为 1–6 的整数" };
          var PRODP = wrong ? LABU.PC_PROG.bad : LABU.PC_PROG.ok, CONSP = LABU.PC_PROG.cons;
          var sem = { mutex: 1, empty: n, full: 0 }, q = { mutex: [], empty: [], full: [] }, buf = [], inp = 0, outp = 0, holder = null, cnt = {}, procs = {}, frames = [];
          for (var i = 0; i < n; i++) buf.push(null);
          LABU.PC_PROCS.forEach(function (p) { procs[p] = { pc: 0, state: "ready", on: null }; cnt[p] = 0; });
          function prog(p) { return p.charAt(0) === "P" ? PRODP : CONSP; }
          function snap(f) {
            f.sem = { mutex: sem.mutex, empty: sem.empty, full: sem.full };
            f.q = { mutex: q.mutex.slice(), empty: q.empty.slice(), full: q.full.slice() };
            f.buf = buf.slice(); f.inp = inp; f.outp = outp; f.holder = holder; f.procs = {};
            var allB = true;
            LABU.PC_PROCS.forEach(function (p) { var x = procs[p]; f.procs[p] = { pc: x.pc, state: x.state, on: x.on, next: prog(p)[x.pc] }; if (x.state !== "blocked") allB = false; });
            f.deadlock = allB;
            f.stuck = !!(holder && procs[holder].state === "blocked");
            frames.push(f);
          }
          snap({ pid: null, d: "初始：mutex = 1，empty = " + n + "，full = 0，缓冲区为空，in = out = 0，四个进程都就绪。" });
          seq.forEach(function (pid) {
            var p = procs[pid];
            if (!p) { snap({ pid: pid, skip: true, d: "没有进程 " + pid + "。" }); return; }
            if (p.state === "blocked") { snap({ pid: pid, skip: true, d: pid + " 正阻塞在 " + p.on + " 的队列中，不能执行，必须等别的进程对 " + p.on + " 做 V 操作。" }); return; }
            var st = prog(pid)[p.pc], d = "", m, ch = null;
            p.pc = (p.pc + 1) % 5;
            if ((m = /^P\((\w+)\)$/.exec(st))) {
              var s = m[1], v0 = sem[s], v = --sem[s]; ch = s;
              if (v < 0) {
                p.state = "blocked"; p.on = s; q[s].push(pid);
                d = pid + " 执行 P(" + s + ")：" + s + " 由 " + v0 + " 减为 " + v + "，小于 0，" + pid + " 阻塞，进入 " + s + " 的等待队列" +
                  (holder === pid ? "，而且它还占着 mutex！" : "。");
              } else {
                if (s === "mutex") holder = pid;
                d = pid + " 执行 P(" + s + ")：" + s + " 由 " + v0 + " 减为 " + v + "，不阻塞" + (s === "mutex" ? "，进入临界区。" : "，继续执行。");
              }
            } else if ((m = /^V\((\w+)\)$/.exec(st))) {
              var s2 = m[1], u0 = sem[s2], u = ++sem[s2], w = null; ch = s2;
              if (u <= 0) { w = q[s2].shift(); procs[w].state = "ready"; procs[w].on = null; }
              if (s2 === "mutex") holder = w;
              d = pid + " 执行 V(" + s2 + ")：" + s2 + " 由 " + u0 + " 增为 " + u + (w ? "，≤ 0 说明有进程在等，唤醒队首 " + w + "，它回到就绪态" + (s2 === "mutex" ? "并进入临界区。" : "。") : (s2 === "mutex" ? "，离开临界区。" : "，没有进程在等。"));
            } else if (st === "放入") {
              var item = pid + "·" + (++cnt[pid]);
              buf[inp] = item;
              d = pid + " 把产品 " + item + " 放入 buffer[" + inp + "]，in = (" + inp + " + 1) mod " + n + " = " + ((inp + 1) % n) + "。";
              inp = (inp + 1) % n;
            } else {
              var got = buf[outp]; buf[outp] = null;
              d = pid + " 从 buffer[" + outp + "] 取出产品 " + got + "，out = (" + outp + " + 1) mod " + n + " = " + ((outp + 1) % n) + "。";
              outp = (outp + 1) % n;
            }
            snap({ pid: pid, stmt: st, d: d.replace(/(\s)-(?=\d)/g, "$1−"), ch: ch });
          });
          var last = frames[frames.length - 1];
          if (last && last.deadlock) last.d += " 四个进程全部阻塞，互相等待——死锁！";
          return { frames: frames, n: n, wrong: wrong, prod: PRODP, cons: CONSP };
        };
        LABU.pcReady = function (f) { return LABU.PC_PROCS.filter(function (p) { return f.procs[p].state !== "blocked"; }); };

        /* ======================= 界面公共部分 ======================= */
        function ui(K) {
          K.out.innerHTML = '<div class="x-lab__stats" data-k="st"></div><p class="x-lx-say" data-k="say" aria-live="polite"></p><div data-k="tb"></div><p class="x-lx-tip" data-k="tip"></p>';
          var o = {}; K.out.querySelectorAll("[data-k]").forEach(function (x) { o[x.getAttribute("data-k")] = x; });
          return o;
        }
        function br(K) { K.opts.appendChild(X.el("span", { class: "x-lab__br" })); }
        function btnGroup(parent, list, cur, cb, lab) {
          var wrap = X.el("div", { class: "x-lx-grp", role: "group", "aria-label": lab || "选项" });
          parent.appendChild(wrap);
          var bs = list.map(function (it) {
            var b = X.el("button", { type: "button", class: "x-lab__btn", "aria-pressed": it[0] === cur ? "true" : "false" }, esc(it[1]));
            b.addEventListener("click", function () { set(it[0]); cb(it[0]); });
            wrap.appendChild(b); return b;
          });
          function set(v) { bs.forEach(function (b, i) { b.setAttribute("aria-pressed", list[i][0] === v ? "true" : "false"); }); }
          return { set: set };
        }
        function field(parent, label, val, attrs, cb, small) {
          var l = X.el("label", { class: "x-lab__lbl x-lx-f" + (small ? " x-lx-f--s" : "") }, esc(label) + " ");
          var a = { type: "text", class: "x-lab__in", value: val, spellcheck: "false", autocomplete: "off" };
          for (var k in attrs || {}) a[k] = attrs[k];
          var i = X.el("input", a); l.appendChild(i); parent.appendChild(l);
          i.addEventListener("change", function () { cb(i.value); });
          i.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); cb(i.value); } });
          return i;
        }
        function presets(K, list) {
          var w = X.el("div", { class: "x-lx-grp x-lx-try", role: "group", "aria-label": "试试" }, '<span class="x-lab__lbl">试试</span>');
          list.forEach(function (p) {
            var b = X.el("button", { type: "button", class: "x-lab__btn x-lab__btn--ghost" }, esc(p[0]));
            b.addEventListener("click", p[1]); w.appendChild(b);
          });
          K.opts.appendChild(w);
        }
        function player(compute, render) {
          var S = { f: [], cur: 0, err: "", r: null };
          function reset() {
            var r;
            try { r = compute(); } catch (e) { r = { err: "计算出错：" + (e && e.message ? e.message : e) }; }
            S.r = r; S.err = r.err || ""; S.f = r.frames || []; S.cur = 0; render(S);
          }
          function step() { if (S.err || S.cur >= S.f.length - 1) return false; S.cur++; render(S); return S.cur < S.f.length - 1; }
          return { S: S, end: function () { if (!S.err) { S.cur = Math.max(0, S.f.length - 1); render(S); } },
            api: { step: step, reset: reset, done: function () { return !!S.err || S.cur >= S.f.length - 1; } } };
        }
        function showErr(K, o, err) {
          K.stage.innerHTML = ""; o.st.innerHTML = ""; o.tb.innerHTML = "";
          o.say.innerHTML = '<span class="x-lab__err">' + esc(err) + "</span>";
        }
        function newSvg(K, w, h, label) {
          K.stage.innerHTML = "";
          return X.svg("svg", { viewBox: "0 0 " + w + " " + h, role: "img", "aria-label": label, class: "x-lx-svg" }, K.stage);
        }
        function T(svg, x, y, s, cls, anchor, size) {
          var t = X.svg("text", { x: x, y: y, class: "x-lx-t" + (cls ? " " + cls : ""), "text-anchor": anchor || "middle", "font-size": size || 13 }, svg);
          t.textContent = s; return t;
        }
        function R(svg, x, y, w, h, cls) { return X.svg("rect", { x: x, y: y, width: Math.max(0, w), height: h, rx: 3, class: cls || "x-lx-box" }, svg); }
        function L(svg, x1, y1, x2, y2, cls) { return X.svg("line", { x1: x1, y1: y1, x2: x2, y2: y2, class: cls || "x-lx-ln" }, svg); }
        /* 表格：rows 为单元格 html 数组，cur 为高亮行下标 */
        function tbl(cap, head, rows, cur, cls) {
          var h = '<div class="x-tbl x-lx-tbl' + (cls ? " " + cls : "") + '" tabindex="0"><table>' + (cap ? "<caption>" + cap + "</caption>" : "") + "<thead><tr>" +
            head.map(function (c) { return '<th scope="col">' + c + "</th>"; }).join("") + "</tr></thead><tbody>";
          rows.forEach(function (r, i) { h += "<tr" + (i === cur ? ' class="is-cur"' : "") + ">" + r.map(function (c) { return "<td>" + c + "</td>"; }).join("") + "</tr>"; });
          return h + "</tbody></table></div>";
        }
        function stat(k, v) { return "<span>" + k + " <b>" + v + "</b></span>"; }

        /* ======================= 实验 1：IEEE 754 ======================= */
        LAB.push({
          id: "ieee754", name: "IEEE 754 浮点数", color: "var(--x-co)",
          note: "单精度 = 1 位符号 + 8 位阶码（移码，偏置 127）+ 23 位尾数（隐藏最高位 1）。规格化尾数最高位一定是 1，所以可以隐藏；阶码用移码便于比较大小。阶码全 0：±0 与非规格化数（E 视为 −126，无隐藏位）；阶码全 1：±∞ 与 NaN。单精度正数范围约 1.18 × 10^−38 到 3.4 × 10^38。0.1 的二进制无限循环，存储时舍入到最近，所以不能精确表示。",
          mount: function (panel, K) {
            var mode = "enc", val = "-0.75", inp;
            var mg = btnGroup(K.opts, [["enc", "十进制 → IEEE 754"], ["dec", "IEEE 754 → 十进制"]], mode, function (v) {
              mode = v; val = v === "enc" ? "-0.75" : "C1480000"; inp.value = val; K.restart();
            }, "转换方向");
            br(K);
            inp = field(K.opts, "输入", val, { "aria-label": "十进制数或 8 位十六进制" }, function (v) { val = v; K.restart(); });
            br(K);
            presets(K, [["−0.75", "enc", "-0.75"], ["12.375", "enc", "12.375"], ["0.1", "enc", "0.1"], ["C1480000", "dec", "C1480000"], ["7F800000", "dec", "7F800000"]].map(function (p) {
              return [p[0], function () { mode = p[1]; mg.set(mode); val = p[2]; inp.value = val; K.restart(); }];
            }));
            var o = ui(K);
            var P = player(function () {
              var r = mode === "enc" ? LABU.ieee754Encode(val) : LABU.ieee754Decode(val);
              if (r.err) return r;
              r.frames = [{ k: "", d: mode === "enc" ? "把十进制数 " + minus(normNum(val)) + " 转成 IEEE 754 单精度。按“下一步”逐步计算。" : "把 IEEE 754 单精度 " + r.hex + " 还原成十进制。按“下一步”逐步计算。" }].concat(r.steps);
              return r;
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var r = S.r, f = S.f, cur = S.cur, rev = {}, i;
              for (i = 1; i <= cur; i++) (f[i].f || []).forEach(function (x) { rev[x] = 1; });
              var svg = newSvg(K, 720, 150, "IEEE 754 单精度 32 位字段：" + fieldStr(r.bits));
              var x0 = 40, cw = 20, y = 50, hh = 34;
              T(svg, x0 + cw / 2, 30, "S", "x-lx-b");
              T(svg, x0 + cw * 5, 30, "阶码（8 位）", "x-lx-b");
              T(svg, x0 + cw * 20.5, 30, "尾数（23 位，隐藏最高位 1）", "x-lx-b");
              for (i = 0; i < 32; i++) {
                var fd = i === 0 ? "s" : i < 9 ? "e" : "m";
                R(svg, x0 + i * cw, y, cw, hh, "x-lx-bit x-lx-bit--" + fd + (rev[fd] ? " is-on" : ""));
                if (rev[fd]) T(svg, x0 + i * cw + cw / 2, y + hh / 2 + 5, r.bits.charAt(i), "x-lx-mono", "middle", 14);
              }
              for (i = 0; i < 8; i++) {
                var gx = x0 + i * 4 * cw;
                L(svg, gx + 2, 96, gx + 4 * cw - 2, 96, "x-lx-ln");
                if (rev.hex) T(svg, gx + 2 * cw, 120, r.hex.charAt(i), "x-lx-mono x-lx-b", "middle", 16);
              }
              var done = cur === f.length - 1;
              o.st.innerHTML = stat("S", rev.s ? r.bits.charAt(0) : "—") + stat("阶码", rev.e ? r.bits.slice(1, 9) : "—") +
                stat("十六进制", rev.hex ? r.hex : "—") + (done ? stat("值", esc(r.kind === "normal" || r.kind === "denormal" ? (r.exact.length > 24 ? Number(r.value).toPrecision(9) : minus(r.exact)) : r.text)) : "");
              o.say.textContent = f[cur].d;
              var rows = [];
              for (i = 1; i <= cur; i++) rows.push([esc(f[i].k), esc(f[i].v), '<span class="x-lx-mono">' + esc(f[i].r) + "</span>"]);
              o.tb.innerHTML = cur ? tbl("转换过程（答题格式）", ["步骤", "计算过程", "结果"], rows, cur - 1, "x-lx-wrap") : "";
              o.tip.textContent = "表示范围：" + LABU.IEEE_RANGE;
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 2：Booth ======================= */
        LAB.push({
          id: "booth", name: "Booth 补码乘法", color: "var(--x-co)",
          note: "看乘数末两位 YₙYₙ₊₁：00 / 11 只右移，01 加 [X]补后右移，10 加 [−X]补后右移；共 n 次判断，最后一步只加不移（补码一位乘的常见约定）。乘数的符号位也参与运算，所以补码乘法不必单独处理符号；部分积用双符号位是为了防止加法溢出导致右移出错（如 [−(−8)]补 在 4 位内放不下）。",
          mount: function (panel, K) {
            var xs = "5", ys = "-3", n = 4, ix, iy;
            ix = field(K.opts, "X =", xs, { inputmode: "text", "aria-label": "被乘数 X" }, function (v) { xs = v; K.restart(); }, true);
            iy = field(K.opts, "Y =", ys, { inputmode: "text", "aria-label": "乘数 Y" }, function (v) { ys = v; K.restart(); }, true);
            var ng = btnGroup(K.opts, [[4, "4 位"], [6, "6 位"], [8, "8 位"]], n, function (v) { n = v; K.restart(); }, "位数");
            br(K);
            presets(K, [["5 × (−3)", 5, -3, 4], ["(−8) × (−8)", -8, -8, 4], ["(−13) × 11（6 位）", -13, 11, 6]].map(function (p) {
              return [p[0], function () { xs = String(p[1]); ys = String(p[2]); n = p[3]; ix.value = xs; iy.value = ys; ng.set(n); K.restart(); }];
            }));
            var o = ui(K);
            function num(s, nm) {
              var t = normNum(s);
              if (!/^[+-]?\d{1,4}$/.test(t)) return { err: nm + " 应输入整数，例如 −3" };
              return { v: parseInt(t, 10) };
            }
            var P = player(function () {
              var a = num(xs, "X"); if (a.err) return a;
              var b = num(ys, "Y"); if (b.err) return b;
              var r = LABU.booth(a.v, b.v, n);
              if (r.err) return r;
              r.frames = [{ d: "[X]补 = " + r.xc + "，[−X]补 = " + r.nxc + (r.nxn ? "" : "（" + n + " 位放不下，需双符号位）") + "，[Y]补 = " + r.yc + "。按“下一步”逐行计算。" }]
                .concat(r.rows.map(function (x) { return x; }))
                .concat([{ fin: true, d: "乘积 = 部分积（去掉最高的符号位）拼上乘数高 " + (n - 1) + " 位 = " + grp(r.product, 4) + " = " + minus(r.value) + "，核对 " + pm(r.x) + " × " + pm(r.y) + " = " + minus(r.x * r.y) + "。" }]);
              return r;
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var r = S.r, f = S.f, cur = S.cur, i, n2 = r.n, fr = f[cur], row = fr.a ? fr : null;
              if (!row) for (i = cur; i >= 0; i--) if (f[i].a) { row = f[i]; break; }
              var cw = 28, W = (n2 + 2) * cw, x0 = 30, xq = x0 + W + 30, xp = xq + n2 * cw + 30;
              var svg = newSvg(K, 720, 150, "部分积 " + (row ? row.a : "") + "，乘数 " + (row ? row.q : "") + "，附加位 " + (row ? row.q1 : ""));
              T(svg, x0 + W / 2, 28, "部分积（双符号位）", "x-lx-b");
              T(svg, xq + n2 * cw / 2, 28, "乘数 [Y]补", "x-lx-b");
              T(svg, xp + cw / 2, 28, "附加位", "x-lx-b");
              var ab = row ? row.a.replace(" ", "") : "", qb = row ? row.q : "", hl = fr.hl;
              for (i = 0; i < n2 + 2; i++) { R(svg, x0 + i * cw, 44, cw, 36, "x-lx-bit" + (i < 2 ? " x-lx-bit--sgn" : "")); T(svg, x0 + i * cw + cw / 2, 68, ab.charAt(i), "x-lx-mono", "middle", 15); }
              for (i = 0; i < n2; i++) { R(svg, xq + i * cw, 44, cw, 36, "x-lx-bit" + (hl && i === n2 - 1 ? " is-hl" : "")); T(svg, xq + i * cw + cw / 2, 68, qb.charAt(i), "x-lx-mono", "middle", 15); }
              R(svg, xp, 44, cw, 36, "x-lx-bit" + (hl ? " is-hl" : "")); T(svg, xp + cw / 2, 68, row ? row.q1 : "", "x-lx-mono", "middle", 15);
              var msg = fr.fin ? "乘积 [X·Y]补 = " + grp(r.product, 4) + " = " + minus(r.value) : fr.cond ? "YₙYₙ₊₁ = " + fr.cond + " → " + (fr.cond === "01" ? "+[X]补" : fr.cond === "10" ? "+[−X]补" : "+0") : fr.op === "→1" ? "整体算术右移 1 位" : "初值";
              T(svg, 360, 118, msg, "x-lx-b", "middle", 15);
              o.st.innerHTML = stat("[X]补", r.xc) + stat("[−X]补", r.nxc.replace(" ", "")) + stat("[Y]补", r.yc) + (fr.fin ? stat("乘积", r.product + " = " + minus(r.value)) : "");
              o.say.textContent = fr.d;
              var rows = [];
              for (i = 1; i <= cur && i < f.length; i++) {
                var x = f[i];
                if (x.fin) rows.push(["结果", "", "", '<span class="x-lx-mono">' + esc(r.pa.slice(0, 1) + " " + r.pa.slice(1)) + "</span>", '<span class="x-lx-mono">' + r.pq + "</span>", "乘积 " + grp(r.product, 4) + " = " + minus(r.value)]);
                else rows.push([x.no, x.cond, esc(x.op), '<span class="x-lx-mono">' + x.a + "</span>", '<span class="x-lx-mono">' + x.q + "</span>", x.q1]);
              }
              o.tb.innerHTML = tbl("Booth 运算过程（答题格式）", ["步骤", "条件 YₙYₙ₊₁", "操作", "部分积", "乘数", "附加位"], rows, cur - 1, "x-lx-wrap");
              o.tip.textContent = "说明：这里采用补码一位乘最常见的约定：n 次判断、n − 1 次右移，最后一步只加不移；若采用“每步都右移”的写法（n 次加、n 次移），乘积取部分积低 n 位与乘数 n 位拼接，结果相同。";
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 3：海明码 ======================= */
        LAB.push({
          id: "hamming", name: "海明码", color: "var(--x-co)",
          note: "校验位个数 k 满足 2^k ≥ n + k + 1（k 位校验和要表示“无错”和 n + k 个出错位置）；校验位放在 1、2、4、8… 位置；Pi 负责位置编号二进制中对应位为 1 的所有位；接收端重算得到的校验和 S 就是出错位置。海明码能纠一位错，再加一位总校验位可以“纠一位、检两位”。",
          mount: function (panel, K) {
            var data = "1010", par = "even", ep = "5", recv = "", idd, iep, irc;
            idd = field(K.opts, "信息位", data, { inputmode: "numeric", "aria-label": "信息位" }, function (v) { data = v; K.restart(); });
            var pg = btnGroup(K.opts, [["even", "偶校验"], ["odd", "奇校验"]], par, function (v) { par = v; K.restart(); }, "校验方式");
            br(K);
            iep = field(K.opts, "出错位置", ep, { inputmode: "numeric", "aria-label": "出错位置，0 表示无错" }, function (v) { ep = v; K.restart(); }, true);
            irc = field(K.opts, "或接收码字", recv, { inputmode: "numeric", placeholder: "可留空", "aria-label": "接收到的码字，可留空" }, function (v) { recv = v; K.restart(); });
            br(K);
            presets(K, [["1010 第 5 位错", "1010", "even", "5"], ["1101 奇校验 无错", "1101", "odd", "0"], ["10011010 第 9 位错", "10011010", "even", "9"]].map(function (p) {
              return [p[0], function () { data = p[1]; par = p[2]; ep = p[3]; recv = ""; idd.value = data; iep.value = ep; irc.value = ""; pg.set(par); K.restart(); }];
            }));
            var o = ui(K);
            var P = player(function () {
              var e = LABU.hammingEncode(data, par); if (e.err) return e;
              var rc = String(recv).replace(/\s+/g, ""), pos = 0;
              if (rc) { if (rc.length !== e.m) return { err: "接收码字应为 " + e.m + " 位（n + k = " + e.n + " + " + e.k + "）" }; }
              else {
                if (!/^\d{1,2}$/.test(String(ep).replace(/\s+/g, ""))) return { err: "出错位置应为 0–" + e.m + " 的整数（0 表示无错）" };
                pos = parseInt(ep, 10);
                if (pos > e.m) return { err: "出错位置应在 0–" + e.m + " 之间（0 表示无错）" };
                rc = e.code;
                if (pos) rc = rc.slice(0, pos - 1) + (rc.charAt(pos - 1) === "1" ? "0" : "1") + rc.slice(pos);
              }
              var c = LABU.hammingCheck(rc, par); if (c.err) return c;
              var fr = [{ d: "信息位 n = " + e.n + "，" + (par === "odd" ? "奇" : "偶") + "校验。按“下一步”先编码，再模拟接收端纠错。" }];
              fr.push({ ph: "k", d: "试 k：" + e.tries.map(function (t) { return "k = " + t.k + " 时 2^" + t.k + " = " + t.l + (t.ok ? " ≥ " : " < ") + t.r; }).join("；") + "，取 k = " + e.k + "，码长 " + e.m + "。" });
              fr.push({ ph: "lay", d: "校验位放在 2 的幂位置 " + e.layout.filter(function (l) { return l.kind === "P"; }).map(function (l) { return l.pos; }).join("、") + "，其余位置依次放 D1–D" + e.n + "。" });
              e.groups.forEach(function (g, i) {
                fr.push({ ph: "g", g: i, d: g.name + " 负责位置 " + [g.p].concat(g.covers).join("、") + "：" + g.name + " = " + (g.names.length ? g.names.join(" ⊕ ") + " = " + g.bits.join(" ⊕ ") + " = " + g.x : "0") + (par === "odd" ? "，奇校验取反得 " + g.v : "") + "。" });
              });
              fr.push({ ph: "code", d: "按位置 1–" + e.m + " 拼成海明码 " + e.code + "。" });
              fr.push({ ph: "rx", d: "接收端收到 " + rc + (rc === e.code ? "（与发送相同）。" : "（第 " + (function () { var d = []; for (var i = 0; i < rc.length; i++) if (rc.charAt(i) !== e.code.charAt(i)) d.push(i + 1); return d.join("、"); })() + " 位与发送不同）。") + "重新计算各校验和。" });
              c.groups.forEach(function (g, i) {
                fr.push({ ph: "s", g: i, d: g.name + " = 位置 " + g.covers.join("、") + " 的异或 = " + g.bits.join(" ⊕ ") + " = " + g.x + (par === "odd" ? "，奇校验取反得 " + g.s : "") + "。" });
              });
              fr.push({ ph: "fix", d: "校验和 S = " + c.groups.slice().reverse().map(function (g) { return g.name; }).join(" ") + " = " + c.syn + " = " + c.S + "，" +
                (c.S === 0 ? "无错。" : c.multi ? "S 超出码长，说明不止一位出错，无法纠正。" : "指出第 " + c.S + " 位出错，取反纠正为 " + c.corrected + "，信息位为 " + c.data + "。") });
              return { frames: fr, e: e, c: c, rc: rc };
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var e = S.r.e, c = S.r.c, rc = S.r.rc, f = S.f, cur = S.cur, fr = f[cur], i, m = e.m, ph = fr.ph || "";
              var reached = {}; for (i = 0; i <= cur; i++) if (f[i].ph) reached[f[i].ph] = 1;
              var encG = 0, chkG = 0; for (i = 0; i <= cur; i++) { if (f[i].ph === "g") encG = f[i].g + 1; if (f[i].ph === "s") chkG = f[i].g + 1; }
              var cw = Math.min(46, Math.floor(640 / m)), x0 = (720 - cw * m) / 2;
              var svg = newSvg(K, 720, 210, "海明码 " + e.code);
              var cov = null;
              if (ph === "g") cov = [e.groups[fr.g].p].concat(e.groups[fr.g].covers);
              if (ph === "s") cov = c.groups[fr.g].covers;
              T(svg, x0 - 6, 34, "位置", "", "end", 12); T(svg, x0 - 6, 62, "名称", "", "end", 12); T(svg, x0 - 6, 100, "发送", "", "end", 12); if (reached.rx) T(svg, x0 - 6, 150, "接收", "", "end", 12);
              for (i = 1; i <= m; i++) {
                var l = e.layout[i - 1], x = x0 + (i - 1) * cw, inC = cov && cov.indexOf(i) >= 0;
                if (inC) R(svg, x + 1, 16, cw - 2, 166, "x-lx-cov");
                T(svg, x + cw / 2, 34, String(i), "x-lx-mono", "middle", 12);
                if (reached.lay) T(svg, x + cw / 2, 62, l.name, l.kind === "P" ? "x-lx-p" : "", "middle", 12);
                var showB = reached.lay && (l.kind === "D" || e.groups.some(function (g, gi) { return g.p === i && gi < encG; }));
                R(svg, x + 3, 80, cw - 6, 30, "x-lx-bit" + (l.kind === "P" ? " x-lx-bit--p" : ""));
                if (showB) T(svg, x + cw / 2, 101, String(l.bit), "x-lx-mono", "middle", 15);
                if (reached.rx) {
                  var bad = rc.charAt(i - 1) !== e.code.charAt(i - 1), fixd = ph === "fix" && c.S === i && !c.multi;
                  R(svg, x + 3, 130, cw - 6, 30, "x-lx-bit" + (bad ? " is-bad" : "") + (fixd ? " is-hl" : ""));
                  T(svg, x + cw / 2, 151, rc.charAt(i - 1), "x-lx-mono", "middle", 15);
                }
              }
              if (ph === "fix") T(svg, 360, 200, c.S === 0 ? "S = " + c.syn + " = 0，无错" : c.multi ? "S = " + c.syn + "，多位错误" : "S = " + c.syn + " = " + c.S + " → 第 " + c.S + " 位取反纠正", "x-lx-b", "middle", 14);
              o.st.innerHTML = stat("n", e.n) + (reached.k ? stat("k", e.k) : "") + (reached.code ? stat("海明码", e.code) : "") + (ph === "fix" ? stat("S", c.syn + " = " + c.S) : "");
              o.say.textContent = fr.d;
              var h = "";
              if (encG) {
                var rows = [];
                for (i = 0; i < encG; i++) { var g = e.groups[i]; rows.push([g.name, [g.p].concat(g.covers).join(","), esc(g.names.join(" ⊕ ") || "—"), g.bits.join(" ⊕ ") || "0", "<b>" + g.v + "</b>"]); }
                h += tbl("编码：各校验位", ["校验位", "负责位置", "参与异或", "取值", "结果"], rows, ph === "g" ? fr.g : -1, "x-lx-wrap");
              }
              if (chkG) {
                var rows2 = [];
                for (i = 0; i < chkG; i++) { var gg = c.groups[i]; rows2.push([gg.name, gg.covers.join(","), gg.bits.join(" ⊕ "), String(gg.x), "<b>" + gg.s + "</b>"]); }
                h += tbl("纠错：重算校验和", ["校验和", "负责位置", "接收位异或", "异或结果", "Si"], rows2, ph === "s" ? fr.g : -1, "x-lx-wrap");
              }
              o.tb.innerHTML = h;
              o.tip.textContent = "排列顺序：位置 1 在左，" + e.layout.map(function (l) { return l.name; }).join(" ") + "。";
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 4：寻址方式 ======================= */
        LAB.push({
          id: "addressing", name: "寻址方式与有效地址", color: "var(--x-co)",
          note: "立即寻址最快但操作数大小受形式地址位数限制；间接寻址扩大寻址范围但多访存（2 次）；寄存器寻址不访存、速度快；相对寻址 EA = (PC) + A，PC 是取指后已自增的值，位移量是补码可正可负，便于程序浮动、用于转移指令。基址寄存器由操作系统管理、面向系统，适合多道程序；变址寄存器由用户使用、面向用户，适合数组和循环。",
          mount: function (panel, K) {
            var D = LABU.ADDR_DEF, mode = "indirect", As = "0200", r = 1, ia, ir, im;
            var regTxt = "PC=1000, R0=0010, R1=2000, R2=0300, R3=0004, BR=3000, IX=0100", memTxt = "0200=2500, 2500=7777, 2000=1234, 3200=5678, 0300=9ABC, 1200=4321";
            btnGroup(K.opts, LABU.ADDR_MODES, mode, function (v) { mode = v; K.restart(); }, "寻址方式");
            br(K);
            ia = field(K.opts, "形式地址 A", As, { "aria-label": "形式地址 A（十六进制）" }, function (v) { As = v; K.restart(); }, true);
            var rgp = btnGroup(K.opts, [[0, "R0"], [1, "R1"], [2, "R2"], [3, "R3"]], r, function (v) { r = v; K.restart(); }, "寄存器（寄存器 / 寄存器间接寻址用）");
            br(K);
            ir = field(K.opts, "寄存器", regTxt, { "aria-label": "寄存器内容（十六进制）" }, function (v) { regTxt = v; K.restart(); });
            im = field(K.opts, "主存", memTxt, { "aria-label": "主存单元：地址=内容（十六进制）" }, function (v) { memTxt = v; K.restart(); });
            br(K);
            presets(K, [["A = 0200H", "0200"], ["A = FF00H（负位移）", "FF00"], ["A = 2000H", "2000"]].map(function (p) { return [p[0], function () { As = p[1]; ia.value = As; K.restart(); }]; }));
            var o = ui(K), mach;
            var P = player(function () {
              var a = String(As).replace(/\s+/g, "").replace(/H$/i, "");
              if (!/^[0-9A-Fa-f]{1,4}$/.test(a)) return { err: "形式地址 A 应为 1–4 位十六进制数，例如 0200" };
              var m = LABU.addrParse(regTxt, memTxt); if (m.err) return m;
              mach = m;
              var res = LABU.addressing({ mode: mode, A: parseInt(a, 16), r: r, regs: m.regs, mem: m.mem });
              if (res.err) return res;
              res.frames = res.steps.concat([{ t: "结果", fin: true, d: res.name + "：" + (res.ea == null ? "无 EA" : "EA = " + hx(res.ea)) + "，操作数 = " + hx(res.operand) + "，取操作数访存 " + res.count + " 次。", hl: { opd: true, ea: res.ea != null } }]);
              res.all = LABU.ADDR_MODES.map(function (md) { return LABU.addressing({ mode: md[0], A: res.A, r: r, regs: m.regs, mem: m.mem }); });
              return res;
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var res = S.r, f = S.f, cur = S.cur, fr = f[cur], hl = fr.hl || {}, i, regs = mach.regs, mem = mach.mem;
              var acc = {}; for (i = 0; i <= cur; i++) (f[i].hl && f[i].hl.mem || []).forEach(function (a) { acc[a] = 1; });
              var addrs = Object.keys(mem).map(Number); res.accesses.forEach(function (a) { if (addrs.indexOf(a.addr) < 0) addrs.push(a.addr); });
              addrs.sort(function (a, b) { return a - b; });
              var RN = ["PC", "R0", "R1", "R2", "R3", "BR", "IX"], H = Math.max(300, 76 + addrs.length * 26 + 10);
              var svg = newSvg(K, 720, H, res.name + " 示意图");
              R(svg, 16, 10, 688, 34, "x-lx-box" + (hl.inst ? " is-hl" : ""));
              T(svg, 360, 32, "指令：" + res.inst, "x-lx-mono", "middle", 14);
              T(svg, 16, 66, "寄存器", "x-lx-b", "start", 12);
              var ry = {};
              RN.forEach(function (k, j) {
                var y = 74 + j * 30, on = (hl.regs || []).indexOf(k) >= 0; ry[k] = y + 13;
                R(svg, 16, y, 190, 26, "x-lx-box" + (on ? " is-hl" : ""));
                T(svg, 26, y + 18, k, "x-lx-b", "start", 13); T(svg, 196, y + 18, hx(regs[k] == null ? 0 : regs[k]), "x-lx-mono", "end", 13);
              });
              T(svg, 470, 66, "主存（地址 / 内容）", "x-lx-b", "start", 12);
              var my = {};
              addrs.forEach(function (a, j) {
                var y = 74 + j * 26, now = (hl.mem || []).indexOf(a) >= 0; my[a] = y + 12;
                R(svg, 470, y, 234, 24, "x-lx-box" + (now ? " is-hl" : acc[a] ? " is-was" : ""));
                T(svg, 480, y + 17, hx(a), "x-lx-mono", "start", 13); T(svg, 694, y + 17, hx(mem[a] == null ? 0 : mem[a]), "x-lx-mono", "end", 13);
              });
              var eaShow = false; for (i = 0; i <= cur; i++) if (f[i].hl && f[i].hl.ea) eaShow = true;
              R(svg, 240, 130, 200, 64, "x-lx-box" + (hl.ea ? " is-hl" : ""));
              T(svg, 340, 156, res.ea == null ? (res.mode === "imm" ? "无 EA（A 即操作数）" : "无 EA（操作数在 R" + res.r + "）") : res.expr, "x-lx-b", "middle", 13);
              if (res.ea != null && eaShow) T(svg, 340, 180, "= " + hx(res.ea), "x-lx-mono", "middle", 15);
              (hl.regs || []).forEach(function (k) { if (ry[k]) L(svg, 206, ry[k], 240, 162, "x-lx-ln is-hl"); });
              if (hl.inst && hl.ea) L(svg, 340, 44, 340, 130, "x-lx-ln is-hl");
              (hl.mem || []).forEach(function (a) { if (my[a]) L(svg, 440, 162, 470, my[a], "x-lx-ln is-hl"); });
              if (hl.opd) { R(svg, 240, 222, 200, 40, "x-lx-box is-ok"); T(svg, 340, 247, "操作数 = " + hx(res.operand), "x-lx-mono x-lx-b", "middle", 14); }
              o.st.innerHTML = stat("方式", res.name) + stat("EA", res.ea == null ? "—" : eaShow ? hx(res.ea) : "?") + stat("访存", (fr.fin ? res.count : Object.keys(acc).length) + " 次") + (hl.opd ? stat("操作数", hx(res.operand)) : "");
              o.say.textContent = fr.d;
              var rows = [];
              for (i = 0; i <= cur; i++) rows.push([esc(f[i].t), esc(f[i].d)]);
              var h = tbl("计算过程", ["步骤", "说明"], rows, cur, "x-lx-wrap");
              if (fr.fin) {
                h += tbl("同一 A = " + hx(res.A) + " 下八种寻址方式对比（不含取指）", ["寻址方式", "EA", "操作数", "访存次数"], res.all.map(function (x) {
                  return [esc(x.name), x.ea == null ? "—" : hx(x.ea), hx(x.operand), String(x.count)];
                }), LABU.ADDR_MODES.map(function (m) { return m[0]; }).indexOf(res.mode));
              }
              o.tb.innerHTML = h;
              o.tip.textContent = "数值均为十六进制；本条指令位于 PC − 1 处、长 1 个字，取指后 PC 已自增；未列出的主存单元内容视为 0000H。";
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 5：磁盘调度 ======================= */
        var DISK_DESC = {
          fcfs: "FCFS 按请求到达顺序访问，公平但效率低。",
          sstf: "SSTF 每次选离磁头最近的请求，平均寻道短但可能“饥饿”，且不保证总寻道长度最优；距离相同时取当前移动方向上的那个。",
          scan: "SCAN（电梯算法）沿当前方向访问，到达磁道端点后才折返；对两端磁道不公平。",
          cscan: "C-SCAN 只在一个方向上服务，到端点后直接返回另一端（回程不服务），等待时间更均匀；本实验计入回程距离。",
          look: "LOOK 与 SCAN 相同，但只走到最远的请求就折返，不到端点。",
          clook: "C-LOOK 走到最远请求后直接跳到另一侧最远的请求，回程不服务；本实验计入回程距离。"
        };
        LAB.push({
          id: "disk", name: "磁盘调度", color: "var(--x-os)",
          note: "一次磁盘访问时间 = 寻道时间 + 旋转延迟 + 传输时间，调度算法只能优化寻道时间。FCFS 公平但效率低；SSTF 平均寻道最短但可能饥饿，而且不保证总寻道长度最优；SCAN 又叫电梯算法，C-SCAN 消除了对两端磁道的不公平。C-SCAN / C-LOOK 是否计回程以题目为准，本实验默认计入。",
          mount: function (panel, K) {
            var reqS = "98, 183, 37, 122, 14, 124, 65, 67", stS = "53", rgS = "0-199", dir = "up", alg = "sstf", irq, ist, irg;
            btnGroup(K.opts, LABU.DISK_ALGS, alg, function (v) { alg = v; K.restart(); }, "算法");
            br(K);
            irq = field(K.opts, "请求序列", reqS, { inputmode: "numeric", "aria-label": "请求序列，逗号分隔" }, function (v) { reqS = v; K.restart(); });
            ist = field(K.opts, "磁头", stS, { inputmode: "numeric", "aria-label": "磁头初始位置" }, function (v) { stS = v; K.restart(); }, true);
            irg = field(K.opts, "磁道范围", rgS, { "aria-label": "磁道范围，如 0-199" }, function (v) { rgS = v; K.restart(); }, true);
            var dg = btnGroup(K.opts, [["up", "向磁道号增大"], ["down", "向磁道号减小"]], dir, function (v) { dir = v; K.restart(); }, "初始方向");
            br(K);
            presets(K, [["经典示例（53）", "98, 183, 37, 122, 14, 124, 65, 67", "53", "0-199", "up"], ["示例二（140·向小）", "86, 147, 91, 177, 94, 150, 102, 175, 130", "140", "0-199", "down"], ["经典示例·向小", "98, 183, 37, 122, 14, 124, 65, 67", "53", "0-199", "down"]].map(function (p) {
              return [p[0], function () { reqS = p[1]; stS = p[2]; rgS = p[3]; dir = p[4]; irq.value = reqS; ist.value = stS; irg.value = rgS; dg.set(dir); K.restart(); }];
            }));
            var o = ui(K);
            var P = player(function () {
              var a = parseNums(reqS, "请求序列"); if (a.err) return a;
              var st = String(stS).replace(/\s+/g, "");
              if (!/^\d{1,4}$/.test(st)) return { err: "磁头初始位置应为非负整数" };
              var mm = /^(\d{1,4})\s*[-–~～—,，]\s*(\d{1,4})$/.exec(String(rgS).replace(/\s+/g, ""));
              if (!mm) return { err: "磁道范围应写成“0-199”" };
              var o2 = { req: a.v, start: +st, min: +mm[1], max: +mm[2], dir: dir };
              var r = LABU.diskSchedule({ req: o2.req, start: o2.start, min: o2.min, max: o2.max, dir: dir, alg: alg });
              if (r.err) return r;
              r.cmp = LABU.DISK_ALGS.map(function (x) { return LABU.diskSchedule({ req: o2.req, start: o2.start, min: o2.min, max: o2.max, dir: dir, alg: x[0] }); });
              r.lo = o2.min; r.hi = o2.max; r.req = o2.req;
              r.frames = [{ d: DISK_DESC[alg] + " 磁头从 " + o2.start + " 出发，方向" + (dir === "up" ? "增大" : "减小") + "。" }].concat(r.moves.map(function (mv, i) {
                var k = mv.kind;
                return { d: "第 " + (i + 1) + " 段：" + mv.from + " → " + mv.to + "，移动 " + mv.dist + "，累计 " + mv.total + "。" +
                  (k === "end" ? "到达端点 " + mv.to + "，" + (alg === "scan" ? "折返。" : "准备返回。") : k === "jump" ? "回程：直接返回另一端（不服务请求），计入距离。" : k === "jumpreq" ? "回程：直接跳到另一侧最远的请求 " + mv.to + "，计入距离。" : "访问磁道 " + mv.to + "。") };
              }));
              return r;
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var r = S.r, cur = S.cur, i, lo = r.lo, hi = r.hi, path = r.path, n = path.length;
              var dy = n > 16 ? 18 : 24, H = 70 + (n - 1) * dy + 24;
              function X0(t) { return 40 + (t - lo) / (hi - lo) * 640; }
              var svg = newSvg(K, 720, H, "磁头移动轨迹：" + path.slice(0, cur + 1).map(function (p) { return p.t; }).join(" → "));
              L(svg, 40, 30, 680, 30, "x-lx-axis");
              var span = hi - lo, stp = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].filter(function (s) { return span / s <= 8; })[0] || 5000;
              for (var t0 = Math.ceil(lo / stp) * stp; t0 <= hi; t0 += stp) { L(svg, X0(t0), 26, X0(t0), 34, "x-lx-axis"); T(svg, X0(t0), 20, String(t0), "x-lx-mono", "middle", 12); }
              if (hi % stp) { L(svg, X0(hi), 26, X0(hi), 34, "x-lx-axis"); T(svg, X0(hi), 20, String(hi), "x-lx-mono", "middle", 12); }
              r.req.forEach(function (t) { X.svg("circle", { cx: X0(t), cy: 30, r: 3.5, class: "x-lx-req" }, svg); });
              T(svg, 20, 54, "时间", "", "middle", 12);
              L(svg, 20, 60, 20, H - 10, "x-lx-axis");
              var Y0 = function (k) { return 50 + k * dy; };
              for (i = 1; i <= cur; i++) {
                var k = path[i].kind;
                L(svg, X0(path[i - 1].t), Y0(i - 1), X0(path[i].t), Y0(i), "x-lx-trk" + (k === "jump" || k === "jumpreq" ? " is-jump" : "") + (i === cur ? " is-cur" : ""));
              }
              for (i = 0; i <= cur; i++) {
                var px = X0(path[i].t), isR = i > 0 && (path[i].kind === "req" || path[i].kind === "jumpreq");
                X.svg("circle", { cx: px, cy: Y0(i), r: i === cur ? 5.5 : 4, class: i === 0 ? "x-lx-dot0" : isR ? "x-lx-dot" : "x-lx-dot2" }, svg);
                var right = px < 640;
                T(svg, px + (right ? 8 : -8), Y0(i) + 4, String(path[i].t), "x-lx-mono", right ? "start" : "end", 12);
              }
              var mv = r.moves.slice(0, cur), tot = cur ? mv[cur - 1].total : 0, served = mv.filter(function (x) { return x.req; }).length, done = cur === S.f.length - 1;
              o.st.innerHTML = stat("已访问", served + " / " + r.n) + stat("总寻道长度", tot) + (done ? stat("平均寻道长度", (Math.round(r.avg * 100) / 100) + "") : "");
              o.say.textContent = S.f[cur].d;
              var rows = mv.map(function (x, j) {
                return [String(j + 1), String(x.from), String(x.to) + (x.kind === "end" ? "（端点）" : x.kind === "jump" || x.kind === "jumpreq" ? "（回程）" : ""), String(x.dist), String(x.total)];
              });
              var h = tbl("访问过程", ["序号", "当前位置", "下一磁道", "移动距离", "累计距离"], rows, cur - 1, "x-lx-wrap");
              if (done) h += '<p class="x-lx-tip">访问顺序：' + r.order.join(" → ") + "；总寻道长度 " + r.total + "，平均 " + r.total + " / " + r.n + " = " + (Math.round(r.avg * 100) / 100) + "。" + (r.tie ? "（出现距离相同的请求，已按当前移动方向选择）" : "") + "</p>";
              h += tbl("同一组数据六种算法对比", ["算法", "总寻道长度", "平均寻道长度"], r.cmp.map(function (c, j) {
                return [LABU.DISK_ALGS[j][1], String(c.total), String(Math.round(c.avg * 100) / 100)];
              }), LABU.DISK_ALGS.map(function (x) { return x[0]; }).indexOf(alg));
              o.tb.innerHTML = h;
              o.tip.textContent = "实心点 = 请求磁道，空心点 = 端点；虚线 = 回程。SCAN / C-SCAN 若反方向已无请求则不再走到端点。";
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 6：动态分区分配 ======================= */
        LAB.push({
          id: "partition", name: "动态分区分配", color: "var(--x-os)",
          note: "首次适应综合性能最好、开销小，低地址容易留下小碎片；邻近适应（循环首次）从上次分配结束处继续找，碎片分布均匀，但大分区容易被用完；最佳适应空闲链按大小递增，会产生大量难以利用的小碎片；最坏适应按大小递减，很快耗尽大分区，不利于大作业。回收时有四种情况：与上邻合并、与下邻合并、上下都合并、都不相邻（新增一个空闲区）。",
          mount: function (panel, K) {
            var seqS = LABU.PART_DEF, totS = "640", osS = "40", alg = "ff", isq, itt, ios;
            btnGroup(K.opts, LABU.PART_ALGS, alg, function (v) { alg = v; K.restart(); }, "算法");
            br(K);
            itt = field(K.opts, "内存 KB", totS, { inputmode: "numeric" }, function (v) { totS = v; K.restart(); }, true);
            ios = field(K.opts, "OS 占 KB", osS, { inputmode: "numeric" }, function (v) { osS = v; K.restart(); }, true);
            br(K);
            isq = field(K.opts, "作业序列", seqS, { "aria-label": "作业序列，如 A 申请 130，B 释放" }, function (v) { seqS = v; K.restart(); });
            br(K);
            presets(K, [["默认序列", LABU.PART_DEF], ["外部碎片导致失败", "A 申请 200，B 申请 100，C 申请 200，D 申请 100，A 释放，C 释放，E 申请 300"], ["邻近适应对比", "A 申请 100，B 申请 100，C 申请 100，A 释放，D 申请 50，E 申请 80"]].map(function (p) {
              return [p[0], function () { seqS = p[1]; totS = "640"; osS = "40"; isq.value = seqS; itt.value = totS; ios.value = osS; K.restart(); }];
            }));
            var o = ui(K);
            var PAL = ["#e3b6a3", "#b9cfe8", "#c8dfb4", "#ecd59a", "#d7c0e6", "#a9d8cf", "#f0c4cf", "#cfd3a0"];
            var P = player(function () {
              var tt = String(totS).replace(/\s+/g, ""), oo = String(osS).replace(/\s+/g, "");
              if (!/^\d{1,6}$/.test(tt)) return { err: "内存总量应为正整数（KB）" };
              if (!/^\d{1,6}$/.test(oo)) return { err: "OS 占用应为非负整数（KB）" };
              var p = LABU.partitionParse(seqS); if (p.err) return p;
              var r = LABU.partitionSim(p.ops, alg, +tt, +oo);
              return r;
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var r = S.r, f = S.f, cur = S.cur, fr = f[cur], i, tot = r.total;
              function X0(a) { return 20 + a / tot * 680; }
              var svg = newSvg(K, 720, 150, "内存分布：" + fr.blocks.map(function (b) { return (b.j || "空闲") + " " + b.s + "–" + (b.s + b.z) + "K"; }).join("，"));
              var jobs = []; f.forEach(function (x) { if (x.op && !x.op.free && jobs.indexOf(x.op.j) < 0) jobs.push(x.op.j); });
              var lastX = [-99, -99];
              fr.blocks.forEach(function (b) {
                var x = X0(b.s), w = X0(b.s + b.z) - x, hit = fr.chosen && fr.chosen.s === b.s && fr.chosen.z === b.z;
                var rc = R(svg, x, 40, w, 50, b.j === "OS" ? "x-lx-os" : b.j ? "x-lx-job" : "x-lx-free");
                if (b.j && b.j !== "OS") rc.setAttribute("style", "fill:" + PAL[jobs.indexOf(b.j) % PAL.length]);
                if (hit) R(svg, x, 40, w, 50, "x-lx-hit");
                if (w >= 22) T(svg, x + w / 2, 62, b.j || (w >= 40 ? "空闲" : ""), b.j ? "x-lx-b" : "x-lx-dim", "middle", 12);
                if (w >= 40) T(svg, x + w / 2, 80, b.z + "K", "x-lx-mono", "middle", 12);
              });
              var bounds = []; fr.blocks.forEach(function (b) { bounds.push(b.s); }); bounds.push(tot);
              bounds.forEach(function (a) {
                var x = X0(a), row = x - lastX[0] >= 30 ? 0 : x - lastX[1] >= 30 ? 1 : 0;
                lastX[row] = x;
                L(svg, x, 90, x, 96 + row * 16, "x-lx-axis");
                T(svg, x, 108 + row * 16, String(a), "x-lx-mono", a === 0 ? "start" : a === tot ? "end" : "middle", 12);
              });
              if (r.alg === "nf") { var px = X0(fr.ptr); X.svg("path", { d: "M" + (px - 6) + " 24 L" + (px + 6) + " 24 L" + px + " 36 Z", class: "x-lx-ptr" }, svg); T(svg, px > 600 ? px - 9 : px + 9, 32, "指针 " + fr.ptr + "K", "", px > 600 ? "end" : "start", 12); }
              T(svg, 20, 146, "单位 KB；地址按比例绘制", "x-lx-dim", "start", 12);
              var free = fr.free, fsum = free.reduce(function (a, x) { return a + x.z; }, 0);
              o.st.innerHTML = stat("空闲区", free.length + " 个") + stat("空闲总量", fsum + "K") + stat("最大空闲区", free.reduce(function (a, x) { return Math.max(a, x.z); }, 0) + "K") +
                (fr.fail ? '<span class="x-lab__badge is-bad">分配失败' + (fr.frag ? "：外部碎片" : "") + "</span>" : fr.merge ? '<span class="x-lab__badge">' + { none: "不合并", up: "与上邻合并", down: "与下邻合并", both: "上下三块合并" }[fr.merge] + "</span>" : "");
              o.say.textContent = fr.d;
              var ord = { ff: "按起址递增", nf: "按起址递增", bf: "按大小递增", wf: "按大小递减" }[r.alg];
              var hi = -1; free.forEach(function (x, j) { if (fr.chosen && x.s === fr.chosen.s && fr.merge) hi = j; if (fr.from && fr.ok && !fr.merge && x.s === fr.from.s + fr.chosen.z) hi = j; });
              var h = tbl("空闲分区链（" + ord + "）", ["序号", "起址", "大小", "末址"], free.map(function (x, j) { return [String(j + 1), x.s + "K", x.z + "K", (x.s + x.z) + "K"]; }), hi);
              var log = [];
              for (i = 1; i <= cur; i++) {
                var x = f[i];
                log.push([String(i), esc(x.op.j + (x.op.free ? " 释放" : " 申请 " + x.op.size + "K")),
                  x.fail ? '<span class="is-bad">失败</span>' : x.skip ? "无需释放" : x.merge ? { none: "回收，不合并", up: "与上邻合并", down: "与下邻合并", both: "三块合并" }[x.merge] + " → " + x.chosen.s + "–" + (x.chosen.s + x.chosen.z) + "K" : "分配 " + x.chosen.s + "–" + (x.chosen.s + x.chosen.z) + "K"]);
              }
              if (log.length) h += tbl("操作记录", ["序号", "操作", "结果"], log, cur - 1, "x-lx-wrap");
              o.tb.innerHTML = h;
              o.tip.textContent = "格式：“A 申请 130”或“A 释放”，逗号分隔；也可写“A+130”“A-”。";
            }
            P.api.reset();
            return P.api;
          }
        });

        /* ======================= 实验 7：生产者—消费者 ======================= */
        LAB.push({
          id: "prodcons", name: "生产者—消费者（PV）", color: "var(--x-os)",
          note: "P 操作 S − 1 后 < 0 则阻塞；V 操作 S + 1 后 ≤ 0 则唤醒一个；信号量为负时，其绝对值等于阻塞进程数。互斥信号量的 P 操作必须放在同步信号量的 P 操作之后，否则可能死锁；V 操作的顺序可以交换；实现互斥的 P、V 在同一进程中成对出现，实现同步的 P、V 在不同进程中成对出现。",
          mount: function (panel, K) {
            var wrong = false, nS = "3", seq = LABU.PC_SCRIPT.slice(), inn;
            var mg = btnGroup(K.opts, [[false, "正确顺序"], [true, "错误顺序（演示死锁）"]], wrong, function (v) { wrong = v; seq = (wrong ? LABU.PC_SCRIPT_BAD : LABU.PC_SCRIPT).slice(); K.restart(); }, "P 操作顺序");
            inn = field(K.opts, "缓冲区 n", nS, { inputmode: "numeric" }, function (v) { nS = v; seq = (wrong ? LABU.PC_SCRIPT_BAD : LABU.PC_SCRIPT).slice(); K.restart(); }, true);
            br(K);
            var w = X.el("div", { class: "x-lx-grp", role: "group", "aria-label": "手动执行" }, '<span class="x-lab__lbl">手动</span>');
            K.opts.appendChild(w);
            var pbs = {};
            LABU.PC_PROCS.forEach(function (p) {
              var b = X.el("button", { type: "button", class: "x-lab__btn" }, p + " 走一步");
              b.addEventListener("click", function () {
                if (P.S.err) return;
                var base = P.S.f.slice(0, P.S.cur + 1).length - 1;
                seq = seq.slice(0, base); seq.push(p); K.restart(); P.end();
              });
              w.appendChild(b); pbs[p] = b;
            });
            br(K);
            presets(K, [["默认脚本", function () { seq = (wrong ? LABU.PC_SCRIPT_BAD : LABU.PC_SCRIPT).slice(); K.restart(); }],
              ["随机一组", function () {
                var s = [], n = parseInt(nS, 10) || 3, r = LABU.pcSim({ n: n, wrong: wrong, seq: [] });
                if (r.err) { K.restart(); return; }
                for (var i = 0; i < 24; i++) {
                  var last = LABU.pcSim({ n: n, wrong: wrong, seq: s }).frames, rd = LABU.pcReady(last[last.length - 1]);
                  if (!rd.length) break;
                  s.push(rd[Math.floor(Math.random() * rd.length)]);
                }
                seq = s; K.restart();
              }], ["清空，手动从头走", function () { seq = []; K.restart(); }]]);
            var o = ui(K);
            var P = player(function () {
              var ns = String(nS).replace(/\s+/g, "");
              if (!/^\d{1,2}$/.test(ns)) return { err: "缓冲区个数应为 1–6 的整数" };
              return LABU.pcSim({ n: parseInt(ns, 10), wrong: wrong, seq: seq });
            }, render);
            function render(S) {
              if (S.err) return showErr(K, o, S.err);
              var r = S.r, f = S.f, cur = S.cur, fr = f[cur], i, n = r.n;
              var svg = newSvg(K, 720, 300, "信号量 mutex=" + fr.sem.mutex + " empty=" + fr.sem.empty + " full=" + fr.sem.full + (fr.deadlock ? "，死锁" : ""));
              ["mutex", "empty", "full"].forEach(function (s, j) {
                var x = 16 + j * 236;
                R(svg, x, 12, 216, 74, "x-lx-box" + (fr.ch === s ? " is-hl" : ""));
                T(svg, x + 108, 40, s + " = " + fr.sem[s], "x-lx-mono x-lx-b" + (fr.sem[s] < 0 ? " x-lx-neg" : ""), "middle", 18);
                T(svg, x + 108, 68, "等待队列：" + (fr.q[s].length ? fr.q[s].join(" → ") : "空"), "", "middle", 12);
              });
              var cw = Math.min(100, Math.floor(560 / n)), bx = (720 - cw * n) / 2;
              T(svg, 360, 110, "缓冲区（循环队列，n = " + n + "）", "x-lx-b", "middle", 12);
              for (i = 0; i < n; i++) {
                var x = bx + i * cw;
                R(svg, x + 2, 124, cw - 4, 40, "x-lx-slot" + (fr.buf[i] ? " is-full" : ""));
                T(svg, x + cw / 2, 149, fr.buf[i] || "", "x-lx-mono", "middle", 12);
                T(svg, x + cw / 2, 178, "[" + i + "]", "x-lx-dim", "middle", 12);
              }
              var ix = bx + fr.inp * cw + cw / 2, ox = bx + fr.outp * cw + cw / 2;
              X.svg("path", { d: "M" + (ix - 6) + " 112 L" + (ix + 6) + " 112 L" + ix + " 122 Z", class: "x-lx-ptr" }, svg);
              T(svg, ix - 9, 112, "in", "x-lx-b", "end", 12);
              X.svg("path", { d: "M" + (ox - 6) + " 194 L" + (ox + 6) + " 194 L" + ox + " 184 Z", class: "x-lx-ptr2" }, svg);
              T(svg, ox, 208, "out", "x-lx-b", "middle", 12);
              LABU.PC_PROCS.forEach(function (p, j) {
                var x = 16 + j * 176, pr = fr.procs[p], bl = pr.state === "blocked";
                R(svg, x, 222, 160, 58, "x-lx-proc" + (bl ? " is-blk" : "") + (fr.pid === p ? " is-hl" : ""));
                T(svg, x + 80, 244, p + (p.charAt(0) === "P" ? " 生产者" : " 消费者"), "x-lx-b", "middle", 13);
                T(svg, x + 80, 266, bl ? "阻塞于 " + pr.on : "就绪 · " + pr.next, bl ? "x-lx-neg" : "", "middle", 12);
              });
              if (fr.deadlock) T(svg, 360, 296, "死锁：所有进程都在等待", "x-lx-neg x-lx-b", "middle", 13);
              else if (fr.stuck) T(svg, 360, 296, fr.holder + " 占着 mutex 却阻塞了", "x-lx-neg", "middle", 12);
              o.st.innerHTML = stat("mutex", fr.sem.mutex) + stat("empty", fr.sem.empty) + stat("full", fr.sem.full) + stat("in / out", fr.inp + " / " + fr.outp) +
                (fr.deadlock ? '<span class="x-lab__badge is-bad">死锁</span>' : "");
              o.say.textContent = fr.d;
              LABU.PC_PROCS.forEach(function (p) { pbs[p].disabled = !!S.f[cur].procs[p] && S.f[cur].procs[p].state === "blocked"; });
              var rows = [];
              for (i = 1; i <= cur; i++) rows.push([String(i), f[i].pid || "", f[i].skip ? "—" : esc(f[i].stmt), esc(f[i].d)]);
              o.tb.innerHTML = rows.length ? '<div class="x-lx-scroll">' + tbl("执行记录（每步一条语句）", ["步", "进程", "语句", "说明"], rows, cur - 1, "x-lx-wrap") + "</div>" : "";
              o.tip.textContent = "生产者：" + r.prod.join("; ") + "　消费者：" + r.cons.join("; ") + (r.wrong ? "　（生产者先 P(mutex) 再 P(empty)，是错误写法）" : "");
            }
            P.api.reset();
            return P.api;
          }
        });
      })();
