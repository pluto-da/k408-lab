      /* 过程图解 · 计算机网络：封装与解封装、访问网页全过程、DNS、ARP、DHCP、NAT、交换机自学习、电子邮件、ping 与 traceroute
         统一约定（各图解共用）：主机 A 192.168.1.2 / 0A-0A-0A-0A-0A-0A，网关（路由器接口 1）192.168.1.1 / 1A-1A-1A-1A-1A-1A，
         路由器接口 2 192.168.2.1 / 2A-2A-2A-2A-2A-2A，主机 B 192.168.2.8 / 0B-0B-0B-0B-0B-0B。 */
      (function () {
        var PROC = window.PROC = window.PROC || [];
        var MA = "0A-0A-0A-0A-0A-0A", MB = "0B-0B-0B-0B-0B-0B", MC = "0C-0C-0C-0C-0C-0C", MD = "0D-0D-0D-0D-0D-0D", ME = "0E-0E-0E-0E-0E-0E";
        var MR1 = "1A-1A-1A-1A-1A-1A", MR2 = "2A-2A-2A-2A-2A-2A", BC = "FF-FF-FF-FF-FF-FF";
        var NONE = "—";

        /* 一帧 / 一个分组的关键字段。kv 是累积的，所以每次把所有键都写上，没有的写“—” */
        function pk(proto, smac, dmac, sip, dip, sp, dp, info) {
          return { "协议": proto, "源MAC": smac || NONE, "目的MAC": dmac || NONE, "源IP": sip || NONE, "目的IP": dip || NONE, "源端口": sp || NONE, "目的端口": dp || NONE, "内容": info || NONE };
        }
        /* 两个节点之间来回两条平行线：a→b 在上（或左），b→a 在下（或右） */
        function pairH(id, a, b, off, extra) {
          off = off || 10;
          var f = { id: id, a: a, as: "r", ao: -off, b: b, bs: "l", bo: -off }, r = { id: id + "_r", a: b, as: "l", ao: off, b: a, bs: "r", bo: off };
          if (extra) { for (var k in extra.f || {}) f[k] = extra.f[k]; for (var j in extra.r || {}) r[j] = extra.r[j]; }
          return [f, r];
        }
        function pairV(id, a, b, off, base) {
          off = off || 10; base = base || 0;
          return [{ id: id, a: a, as: "b", ao: base - off, b: b, bs: "t", bo: -off }, { id: id + "_r", a: b, as: "t", ao: off, b: a, bs: "b", bo: base + off }];
        }
        function flat(list) { var o = []; list.forEach(function (x) { o = o.concat(x); }); return o; }

        /* ===================== 1. 数据封装与解封装 ===================== */
        function encap() {
          var L5 = ["应用层", "运输层", "网络层", "数据链路层", "物理层"], nodes = [], edges = [];
          var X0 = { A: 30, R: 390, B: 750 }, Y = [40, 104, 168, 232, 296], W = 160, H = 44;
          L5.forEach(function (t, i) {
            nodes.push({ id: "A" + i, k: "box", x: X0.A, y: Y[i], w: W, h: H, t: t });
            nodes.push({ id: "B" + i, k: "box", x: X0.B, y: Y[i], w: W, h: H, t: t });
            if (i >= 2) nodes.push({ id: "R" + i, k: "box", x: X0.R, y: Y[i], w: W, h: H, t: t });
            if (i < 4) {
              edges.push({ id: "ad" + i, a: "A" + i, as: "b", b: "A" + (i + 1), bs: "t" });
              edges.push({ id: "bu" + i, a: "B" + (i + 1), as: "t", b: "B" + i, bs: "b" });
            }
            if (i === 2 || i === 3) {
              edges.push({ id: "ru" + i, a: "R" + (i + 1), as: "t", ao: -40, b: "R" + i, bs: "b", bo: -40 });
              edges.push({ id: "rd" + i, a: "R" + i, as: "b", ao: 40, b: "R" + (i + 1), bs: "t", bo: 40 });
            }
          });
          nodes.push({ id: "tA", k: "term", x: X0.A, y: 352, w: W, h: 30, t: "主机 A（发送方）", sm: 1 });
          nodes.push({ id: "tR", k: "term", x: X0.R, y: 352, w: W, h: 30, t: "路由器 R", sm: 1 });
          nodes.push({ id: "tB", k: "term", x: X0.B, y: 352, w: W, h: 30, t: "主机 B（Web 服务器）", sm: 1 });
          nodes.push({ id: "PDU", k: "fields", x: 30, y: 430, w: 880, h: 56, unit: 1, t: "当前的数据单元", segs: [{ t: "—", v: "", w: 1 }] });
          edges.push({ id: "l1", a: "A4", b: "R4", t: "链路 1：比特流" });
          edges.push({ id: "l2", a: "R4", b: "B4", t: "链路 2：比特流" });

          var D = { t: "数据（HTTP 请求）", v: "GET / HTTP/1.1", w: 4 };
          var T = { t: "TCP 首部", v: "50000→80", w: 3 };
          var I1 = { t: "IP 首部（TTL 64）", v: "192.168.1.2→192.168.2.8", w: 5 };
          var I2 = { t: "IP 首部（TTL 63）", v: "192.168.1.2→192.168.2.8", w: 5 };
          var F1 = { t: "帧首部（源→目的 MAC）", v: "0A-0A-…→1A-1A-…", w: 5 };
          var F2 = { t: "帧首部（源→目的 MAC）", v: "2A-2A-…→0B-0B-…", w: 5 };
          var FCS = { t: "帧尾 FCS", v: "CRC", w: 2 };
          var PRE = { t: "前导码 8B", v: "1010…11", w: 2 };
          function on(s, x) { var o = {}; for (var k in s) o[k] = s[k]; o.on = x; return o; }
          function pdu(name, segs) { return { PDU: { t: "当前的数据单元：" + name, segs: segs } }; }

          var S = [
            { t: "应用层产生报文", d: "主机 A 的浏览器（应用进程）产生 HTTP 请求报文，交给运输层。应用层的数据单元叫报文（message）。", on: ["A0"], set: pdu("报文", [on(D, 1)]), kv: { "数据单元": "报文", "IP 首部 TTL": NONE, "帧的 MAC 地址": NONE } },
            { t: "运输层：加 TCP 首部", d: "TCP 加上首部，其中源端口 50000（客户端临时端口）、目的端口 80（HTTP 熟知端口），形成 TCP 报文段。端口标识的是主机中的应用进程。", on: ["A1"], go: ["ad0"], set: pdu("TCP 报文段", [on(T, 1), D]), kv: { "数据单元": "报文段（segment）" }, tip: "运输层提供进程到进程的逻辑通信，网络层提供主机到主机的逻辑通信。" },
            { t: "网络层：加 IP 首部", d: "IP 加上首部：源 IP 192.168.1.2、目的 IP 192.168.2.8、协议字段 6（表示上层是 TCP）、TTL 64，形成 IP 数据报（分组）。", on: ["A2"], go: ["ad1"], set: pdu("IP 数据报", [on(I1, 1), T, D]), kv: { "数据单元": "IP 数据报（分组）", "IP 首部 TTL": "64" } },
            { t: "数据链路层：加帧首部和帧尾", d: "目的主机不在本网络，所以帧交给默认网关：目的 MAC 写路由器接口 1 的 1A-1A-1A-1A-1A-1A，源 MAC 写 A 的 0A-0A-0A-0A-0A-0A，类型 0x0800（IP）；帧尾是 FCS（CRC 检验）。", on: ["A3"], go: ["ad2"], set: pdu("帧", [on(F1, 1), I1, T, D, on(FCS, 1)]), kv: { "数据单元": "帧（frame）", "帧的 MAC 地址": "0A-… → 1A-…（A → 网关）" }, tip: "数据链路层既加首部又加尾部，其他层只加首部。" },
            { t: "物理层：变成比特流发出", d: "物理层在帧前插入 8 字节前导码（7 字节前同步码 + 1 字节帧开始定界符），把整个帧当作比特流，经链路 1 发往路由器。", on: ["A4", "R4"], go: ["ad3", "l1"], set: pdu("比特流", [on(PRE, 1), F1, I1, T, D, FCS]), kv: { "数据单元": "比特" } },
            { t: "路由器：链路层收帧、去掉帧首尾", d: "路由器接口 1 收到比特流还原成帧，用 FCS 检验无差错、目的 MAC 是自己，于是剥去帧首部和帧尾，把 IP 数据报交给网络层。", on: ["R3", "R2"], go: ["ru3", "ru2"], set: pdu("IP 数据报", [on(I1, 1), T, D]), kv: { "数据单元": "IP 数据报（分组）" } },
            { t: "路由器：网络层查表转发", d: "按目的 IP 192.168.2.8 查路由表，找到出接口 2（直连网络 192.168.2.0/24）；TTL 减 1 变为 63，并重新计算首部检验和。源 IP、目的 IP 都不变。", on: ["R2", "tR"], set: pdu("IP 数据报", [on(I2, 1), T, D]), kv: { "IP 首部 TTL": "63" }, tip: "路由器只解封到网络层（三层设备），不看 TCP 首部和应用数据。" },
            { t: "路由器：重新封装成新帧", d: "在出接口 2 重新封装：源 MAC 变成接口 2 的 2A-2A-2A-2A-2A-2A，目的 MAC 是主机 B 的 0B-0B-0B-0B-0B-0B（由 ARP 得到），重新计算 FCS。", on: ["R3"], go: ["rd2"], set: pdu("新的帧", [on(F2, 1), I2, T, D, on(FCS, 1)]), kv: { "数据单元": "帧（frame）", "帧的 MAC 地址": "2A-… → 0B-…（R → B）" }, tip: "每经过一个路由器，MAC 地址换一次；IP 地址始终不变（没有 NAT 时）；TTL 减 1。" },
            { t: "物理层发往主机 B", d: "新帧加上前导码，以比特流经链路 2 到达主机 B。", on: ["R4", "B4"], go: ["rd3", "l2"], set: pdu("比特流", [on(PRE, 1), F2, I2, T, D, FCS]), kv: { "数据单元": "比特" } },
            { t: "主机 B 链路层：解封帧", d: "B 检验 FCS 无差错、目的 MAC 是自己，去掉帧首部和帧尾，按类型字段 0x0800 把数据交给 IP。", on: ["B3"], go: ["bu3"], set: pdu("IP 数据报", [on(I2, 1), T, D]), kv: { "数据单元": "IP 数据报（分组）" } },
            { t: "主机 B 网络层：解封 IP 首部", d: "目的 IP 是自己，去掉 IP 首部，按协议字段 6 交给 TCP。（若是分片，在这里重组。）", on: ["B2"], go: ["bu2"], set: pdu("TCP 报文段", [on(T, 1), D]), kv: { "数据单元": "报文段（segment）" } },
            { t: "主机 B 运输层：按端口交付", d: "TCP 检验无误后去掉首部，按目的端口 80 把数据交给 Web 服务器进程。", on: ["B1"], go: ["bu1"], set: pdu("报文", [on(D, 1)]), kv: { "数据单元": "报文" } },
            { t: "应用层收到完整报文", d: "Web 服务器进程得到与 A 发出的完全相同的 HTTP 请求报文。对等层之间仿佛直接通信，这就是分层的“虚通信”。", on: ["B0", "tB"], go: ["bu0"], tip: "封装自上而下逐层加首部，解封自下而上逐层去首部；各层 PDU：报文 → 报文段 / 用户数据报 → IP 数据报 → 帧 → 比特。" }
          ];
          return { w: 940, h: 510, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "encap", name: "数据封装与解封装", sub: "cn",
          lead: "一个 HTTP 请求从主机 A 经路由器到主机 B：向下逐层加首部，路由器只拆到网络层再重新封装，到 B 再逐层拆开。",
          note: ["各层 PDU：应用层报文、运输层报文段（TCP）/ 用户数据报（UDP）、网络层 IP 数据报（分组）、链路层帧、物理层比特。", "数据链路层既加首部也加尾部（FCS），其他层只加首部。", "经过路由器：MAC 地址改变，IP 地址不变（无 NAT 时），TTL 减 1，首部检验和重算。", "路由器解封到网络层，交换机解封到数据链路层，集线器只在物理层转发比特。", "前导码（8B）由物理层加在帧前，不计入以太网帧长（最短帧 64B）。"],
          modes: [{ name: "A → 路由器 → B", make: encap }]
        });

        /* ===================== 2. 访问一个网页的全过程 ===================== */
        PROC.push({
          id: "webvisit", name: "访问一个网页的全过程", sub: "cn",
          lead: "主机 A 刚开机，只知道网关 IP 和 DNS 服务器 IP，在浏览器输入 http://www.abc.com：ARP → DNS → TCP 三次握手 → HTTP → 释放连接。",
          note: ["顺序：先 ARP 网关 MAC，再 DNS（DNS 服务器不在本网段，查询帧也交给网关），再 TCP 连接，最后 HTTP。", "DNS 用 UDP，服务器端口 53；HTTP 用 TCP，服务器端口 80（HTTPS 443）；客户端用临时端口（49152–65535）。", "帧的目的 MAC 是下一跳（网关）的 MAC，IP 首部的目的地址始终是最终主机。", "TCP 连接建立后才能发 HTTP 请求；第三次握手的 ACK 报文段可以携带数据。", "HTTP/1.1 默认持续连接，同一 TCP 连接可传多个对象；HTTP/1.0 默认非持续连接，每个对象 2 RTT + 传输时间。"],
          modes: [{
            name: "首次访问",
            make: function () {
              var nodes = [
                { id: "A", k: "box", x: 30, y: 200, w: 150, h: 56, t: "主机 A\n192.168.1.2", sm: 1 },
                { id: "R", k: "box", x: 280, y: 200, w: 150, h: 56, t: "路由器（默认网关）\n192.168.1.1", sm: 1 },
                { id: "NET", k: "box", x: 530, y: 200, w: 120, h: 56, t: "因特网" },
                { id: "DNS", k: "box", x: 770, y: 90, w: 160, h: 56, t: "DNS 服务器\n202.1.1.53", sm: 1 },
                { id: "WEB", k: "box", x: 770, y: 310, w: 160, h: 56, t: "www.abc.com（Web）\n203.0.113.80", sm: 1 },
                { id: "conn", k: "reg", x: 280, y: 60, w: 250, h: 56, t: "TCP 连接（A ↔ Web:80）", v: "未建立" },
                { id: "arpc", k: "table", x: 30, y: 390, w: 250, h: 72, rh: 20, t: "主机 A 的 ARP 缓存", cols: [0.42], rows: [["（空）"]] },
                { id: "dnsc", k: "table", x: 300, y: 390, w: 260, h: 72, rh: 20, t: "主机 A 的 DNS 缓存", cols: [0.46], rows: [["（没有 www.abc.com）"]] }
              ];
              var edges = flat([
                pairH("ar", "A", "R", 10), pairH("rn", "R", "NET", 10),
                [{ id: "nd", a: "NET", as: "t", ao: -10, b: "DNS", bs: "l", bo: -10 }, { id: "nd_r", a: "DNS", as: "l", ao: 10, b: "NET", bs: "t", bo: 10 },
                  { id: "nw", a: "NET", as: "b", ao: 10, b: "WEB", bs: "l", bo: -10 }, { id: "nw_r", a: "WEB", as: "l", ao: 10, b: "NET", bs: "b", bo: -10 }]
              ]);
              var up = ["ar", "rn", "nd"], dn = ["nd_r", "rn_r", "ar_r"], wup = ["ar", "rn", "nw"], wdn = ["nw_r", "rn_r", "ar_r"];
              var S = [
                { t: "准备：先判断要不要经过网关", d: "要访问 www.abc.com，先得到它的 IP，所以要先发 DNS 查询。A 用子网掩码 255.255.255.0 判断 DNS 服务器 202.1.1.53 不在本网络，DNS 查询必须交给默认网关 192.168.1.1；而 ARP 缓存是空的，不知道网关的 MAC。", on: ["A", "arpc", "dnsc"], kv: pk(NONE) },
                { t: "① ARP 请求（广播）", d: "A 广播 ARP 请求：目的 MAC FF-FF-FF-FF-FF-FF，询问“192.168.1.1 的 MAC 是多少？”。ARP 报文直接封装在以太网帧中（类型 0x0806），没有 IP 首部和端口。", on: ["A", "R"], go: ["ar"], kv: pk("ARP 请求", MA, BC, "192.168.1.2（发送方）", "192.168.1.1（目标）", NONE, NONE, "谁是 192.168.1.1？"), tip: "先 ARP 网关，再 DNS：DNS 服务器不在本网段时，A 要解析的是网关的 MAC，而不是 DNS 服务器的 MAC。" },
                { t: "② ARP 响应（单播）", d: "网关单播回答自己的 MAC 1A-1A-1A-1A-1A-1A，A 把“192.168.1.1 ↔ 1A-1A-1A-1A-1A-1A”写入 ARP 缓存。", on: ["R", "A", "arpc"], go: ["ar_r"], set: { arpc: { rows: [["192.168.1.1", MR1]], hi: 0 } }, kv: pk("ARP 响应", MR1, MA, "192.168.1.1（发送方）", "192.168.1.2（目标）", NONE, NONE, "192.168.1.1 在 1A-1A-1A-1A-1A-1A") },
                { t: "③ DNS 查询（UDP，目的端口 53）", d: "A 把 DNS 查询封装成 UDP 用户数据报（源端口 50001，目的端口 53）→ IP 数据报（目的 IP 202.1.1.53）→ 帧（目的 MAC 写网关 1A-1A-1A-1A-1A-1A），经网关和因特网送到 DNS 服务器。", on: ["A", "R", "NET", "DNS"], go: up, set: { arpc: { hi: -1 } }, kv: pk("DNS 查询 / UDP", MA, MR1 + "（网关）", "192.168.1.2", "202.1.1.53", "50001", "53", "www.abc.com 的 A 记录？"), tip: "目的 MAC 是网关，目的 IP 是 DNS 服务器——这是综合题最爱考的填空。表中 MAC 是 A 所在网络里那一段的帧。" },
                { t: "④ DNS 响应", d: "DNS 服务器回答 www.abc.com 的 IP 地址是 203.0.113.80（源端口 53，目的端口 50001）。A 把结果写入 DNS 缓存。", on: ["DNS", "NET", "R", "A", "dnsc"], go: dn, set: { dnsc: { rows: [["www.abc.com", "203.0.113.80"]], hi: 0 } }, kv: pk("DNS 响应 / UDP", MR1, MA, "202.1.1.53", "192.168.1.2", "53", "50001", "203.0.113.80") },
                { t: "⑤ 第一次握手：SYN", d: "A 向 203.0.113.80 的 80 端口发起 TCP 连接：SYN = 1，seq = x，不携带数据但消耗一个序号。帧的目的 MAC 仍是网关（ARP 缓存里已有）。", on: ["A", "R", "NET", "WEB"], go: wup, set: { dnsc: { hi: -1 }, conn: { v: "A：SYN-SENT" } }, kv: pk("TCP", MA, MR1 + "（网关）", "192.168.1.2", "203.0.113.80", "50002", "80", "SYN=1, seq=x") },
                { t: "⑥ 第二次握手：SYN + ACK", d: "服务器同意连接，分配缓存和变量，回 SYN = 1、ACK = 1、seq = y、ack = x + 1，进入 SYN-RCVD。", on: ["WEB", "NET", "R", "A"], go: wdn, set: { conn: { v: "服务器：SYN-RCVD" } }, kv: pk("TCP", MR1, MA, "203.0.113.80", "192.168.1.2", "80", "50002", "SYN=1, ACK=1, seq=y, ack=x+1") },
                { t: "⑦ 第三次握手：ACK", d: "A 回 ACK = 1、seq = x + 1、ack = y + 1，双方进入 ESTABLISHED。这个报文段可以携带数据，不携带数据则不消耗序号。", on: ["A", "R", "NET", "WEB", "conn"], go: wup, set: { conn: { v: "ESTABLISHED" } }, kv: pk("TCP", MA, MR1 + "（网关）", "192.168.1.2", "203.0.113.80", "50002", "80", "ACK=1, seq=x+1, ack=y+1"), tip: "三次握手完成之前不能发 HTTP 请求；建立连接用掉 1 个 RTT。" },
                { t: "⑧ HTTP 请求：GET", d: "连接建立后，浏览器发送 HTTP 请求报文 GET / HTTP/1.1，首部含 Host: www.abc.com，封装在 TCP 报文段中。", on: ["A", "R", "NET", "WEB"], go: wup, kv: pk("HTTP / TCP", MA, MR1 + "（网关）", "192.168.1.2", "203.0.113.80", "50002", "80", "GET / HTTP/1.1  Host: www.abc.com") },
                { t: "⑨ HTTP 响应：200 OK", d: "服务器返回响应报文 HTTP/1.1 200 OK，实体主体是 HTML 文件。浏览器解析 HTML，页面中的图片等对象可在同一连接上继续请求。", on: ["WEB", "NET", "R", "A"], go: wdn, kv: pk("HTTP / TCP", MR1, MA, "203.0.113.80", "192.168.1.2", "80", "50002", "HTTP/1.1 200 OK + HTML"), tip: "请求一个对象：建立连接 1 RTT + 请求响应 1 RTT + 文件传输时间。" },
                { t: "⑩ 释放连接（或保持持续连接）", d: "HTTP/1.1 默认持续连接，服务器发送响应后保持连接一段时间。不再需要时用四次挥手释放：FIN → ACK → FIN → ACK，主动关闭方最后等待 2MSL 才进入 CLOSED。", on: ["A", "WEB", "conn"], go: wup, set: { conn: { v: "CLOSED（经 TIME-WAIT 2MSL）" } }, kv: pk("TCP", MA, MR1 + "（网关）", "192.168.1.2", "203.0.113.80", "50002", "80", "FIN → ACK → FIN → ACK"), tip: "整个过程用到的协议：ARP、UDP/DNS、TCP、HTTP、IP；以太网帧在每段链路重新封装。" }
              ];
              return { w: 960, h: 490, nodes: nodes, edges: edges, steps: S };
            }
          }]
        });

        /* ===================== 3. DNS 递归 / 迭代 ===================== */
        function dnsBase(rec) {
          var nodes = [
            { id: "H", k: "box", x: 30, y: 210, w: 140, h: 56, t: "主机\nm.xyz.com", sm: 1 },
            { id: "L", k: "box", x: 270, y: 210, w: 170, h: 56, t: "本地域名服务器\ndns.xyz.com", sm: 1 },
            { id: "ROOT", k: "box", x: 620, y: 40, w: 200, h: 50, t: "根域名服务器" },
            { id: "TLD", k: "box", x: 620, y: 210, w: 200, h: 56, t: "顶级域名服务器\ndns.com", sm: 1 },
            { id: "AUTH", k: "box", x: 620, y: 380, w: 200, h: 56, t: "权限域名服务器\ndns.abc.com", sm: 1 },
            { id: "cache", k: "table", x: 30, y: 330, w: 230, h: 72, rh: 20, t: "本地域名服务器缓存", cols: [0.48], rows: [["（无 www.abc.com）"]] }
          ];
          var edges = pairH("hl", "H", "L", 10);
          if (!rec) {
            edges = edges.concat([
              { id: "lr", a: "L", as: "t", ao: -20, b: "ROOT", bs: "l", bo: -10, t: "②" }, { id: "lr_r", a: "ROOT", as: "l", ao: 10, b: "L", bs: "t", bo: 20, t: "③" },
              { id: "lt", a: "L", as: "r", ao: -10, b: "TLD", bs: "l", bo: -10, t: "④" }, { id: "lt_r", a: "TLD", as: "l", ao: 10, b: "L", bs: "r", bo: 10, t: "⑤" },
              { id: "la", a: "L", as: "b", ao: 20, b: "AUTH", bs: "l", bo: -10, t: "⑥" }, { id: "la_r", a: "AUTH", as: "l", ao: 10, b: "L", bs: "b", bo: -20, t: "⑦" }
            ]);
            edges[0].t = "①"; edges[1].t = "⑧";
          } else {
            edges = edges.concat([
              { id: "lr", a: "L", as: "t", ao: -20, b: "ROOT", bs: "l", bo: -10, t: "②" }, { id: "lr_r", a: "ROOT", as: "l", ao: 10, b: "L", bs: "t", bo: 20, t: "⑦" },
              { id: "rt", a: "ROOT", as: "b", ao: -30, b: "TLD", bs: "t", bo: -30, t: "③" }, { id: "rt_r", a: "TLD", as: "t", ao: 30, b: "ROOT", bs: "b", bo: 30, t: "⑥" },
              { id: "ta", a: "TLD", as: "b", ao: -30, b: "AUTH", bs: "t", bo: -30, t: "④" }, { id: "ta_r", a: "AUTH", as: "t", ao: 30, b: "TLD", bs: "b", bo: 30, t: "⑤" }
            ]);
            edges[0].t = "①"; edges[1].t = "⑧";
          }
          return { nodes: nodes, edges: edges };
        }
        var DNSC = { cache: { rows: [["www.abc.com", "203.0.113.80"], ["abc.com NS", "dns.abc.com"]], hi: 0 } };
        PROC.push({
          id: "dns", name: "DNS 解析：递归与迭代", sub: "cn",
          lead: "主机 m.xyz.com 要解析 www.abc.com：主机到本地域名服务器用递归查询；本地服务器向外可以迭代，也可以递归。",
          note: ["主机向本地域名服务器的查询一般是递归查询；本地域名服务器向根服务器的查询通常是迭代查询。", "迭代：被问的服务器只回答“下一步去问谁”；递归：被问的服务器替你问到底，把最终结果返回。", "本例两种方式都是 8 个 UDP 报文（各 4 次查询 + 4 次回答）；缓存命中时只需 2 个。", "DNS 报文用 UDP，服务器端口 53；根服务器一般不接受递归查询。", "缓存给出的回答是非权威的；缓存记录有生存时间（TTL），过期删除。"],
          modes: [
            {
              name: "迭代查询",
              make: function () {
                var b = dnsBase(false);
                var S = [
                  { t: "主机查自己的缓存", d: "主机的解析器（DNS 客户）先查本机缓存和 hosts 文件，没有 www.abc.com，于是向本地域名服务器发查询。", on: ["H"], kv: { "查询": "www.abc.com", "报文数": "0", "当前报文": NONE, "运输层": "UDP，服务器端口 53" } },
                  { t: "① 主机 → 本地：递归查询", d: "主机向本地域名服务器 dns.xyz.com 发出递归查询：“请告诉我 www.abc.com 的 IP，查不到也由你去查”。", on: ["H", "L"], go: ["hl"], kv: { "报文数": "1", "当前报文": "递归查询 www.abc.com" } },
                  { t: "本地服务器查缓存：未命中", d: "本地域名服务器先查缓存，没有这条记录，于是从根域名服务器开始迭代查询。", on: ["L", "cache"], set: { cache: { bad: 0 } } },
                  { t: "② 本地 → 根：迭代查询", d: "本地域名服务器以 DNS 客户的身份向根域名服务器查询 www.abc.com。", on: ["L", "ROOT"], go: ["lr"], set: { cache: { bad: -1 } }, kv: { "报文数": "2", "当前报文": "查询 www.abc.com" } },
                  { t: "③ 根 → 本地：去问 dns.com", d: "根服务器不替它往下查，只回答“请去问 .com 顶级域名服务器 dns.com，地址是……”。", on: ["ROOT", "L"], go: ["lr_r"], kv: { "报文数": "3", "当前报文": "下一步问 dns.com" }, tip: "迭代查询的回答是“下一个该问的服务器”的地址，而不是最终结果。" },
                  { t: "④ 本地 → 顶级域：迭代查询", d: "本地域名服务器再向顶级域名服务器 dns.com 查询。", on: ["L", "TLD"], go: ["lt"], kv: { "报文数": "4", "当前报文": "查询 www.abc.com" } },
                  { t: "⑤ 顶级域 → 本地：去问 dns.abc.com", d: "顶级域名服务器回答权限域名服务器 dns.abc.com 的地址。", on: ["TLD", "L"], go: ["lt_r"], kv: { "报文数": "5", "当前报文": "下一步问 dns.abc.com" } },
                  { t: "⑥ 本地 → 权限：迭代查询", d: "本地域名服务器向权限域名服务器 dns.abc.com 查询。", on: ["L", "AUTH"], go: ["la"], kv: { "报文数": "6", "当前报文": "查询 www.abc.com" } },
                  { t: "⑦ 权限 → 本地：给出 IP", d: "权限域名服务器负责 abc.com 这个区，给出权威回答：www.abc.com 的 IP 是 203.0.113.80。", on: ["AUTH", "L"], go: ["la_r"], kv: { "报文数": "7", "当前报文": "203.0.113.80（权威）" } },
                  { t: "⑧ 本地 → 主机：返回结果并缓存", d: "本地域名服务器把结果存入缓存，再回答主机。至此共 8 个 UDP 报文。", on: ["L", "H", "cache"], go: ["hl_r"], set: DNSC, kv: { "报文数": "8", "当前报文": "203.0.113.80" }, tip: "迭代方式下，根和顶级域服务器各只处理 1 次查询，负担小；查询工作主要落在本地域名服务器上。" }
                ];
                return { w: 900, h: 470, nodes: b.nodes, edges: b.edges, steps: S };
              }
            },
            {
              name: "递归查询",
              make: function () {
                var b = dnsBase(true);
                var S = [
                  { t: "主机查自己的缓存", d: "主机本机缓存没有 www.abc.com，向本地域名服务器发查询。", on: ["H"], kv: { "查询": "www.abc.com", "报文数": "0", "当前报文": NONE, "运输层": "UDP，服务器端口 53" } },
                  { t: "① 主机 → 本地：递归查询", d: "主机向本地域名服务器发出递归查询。", on: ["H", "L"], go: ["hl"], kv: { "报文数": "1", "当前报文": "递归查询 www.abc.com" } },
                  { t: "本地服务器查缓存：未命中", d: "本地域名服务器缓存中没有，转而以 DNS 客户身份向根服务器查询。", on: ["L", "cache"], set: { cache: { bad: 0 } } },
                  { t: "② 本地 → 根：递归查询", d: "本地域名服务器请求根服务器“替我查到底”。", on: ["L", "ROOT"], go: ["lr"], set: { cache: { bad: -1 } }, kv: { "报文数": "2", "当前报文": "递归查询 www.abc.com" } },
                  { t: "③ 根 → 顶级域：根替本地去问", d: "根服务器自己不知道，于是替本地服务器去问顶级域名服务器 dns.com。", on: ["ROOT", "TLD"], go: ["rt"], kv: { "报文数": "3", "当前报文": "根代为查询" }, tip: "递归查询中，每一级服务器都“替下一级去问”，自己当一回 DNS 客户。" },
                  { t: "④ 顶级域 → 权限：继续代问", d: "顶级域名服务器再替根去问权限域名服务器 dns.abc.com。", on: ["TLD", "AUTH"], go: ["ta"], kv: { "报文数": "4", "当前报文": "顶级域代为查询" } },
                  { t: "⑤ 权限 → 顶级域：给出 IP", d: "权限域名服务器给出 www.abc.com 的 IP 203.0.113.80。", on: ["AUTH", "TLD"], go: ["ta_r"], kv: { "报文数": "5", "当前报文": "203.0.113.80" } },
                  { t: "⑥ 顶级域 → 根：沿原路返回", d: "结果沿查询的原路逐级返回，先回到根服务器。", on: ["TLD", "ROOT"], go: ["rt_r"], kv: { "报文数": "6", "当前报文": "203.0.113.80" } },
                  { t: "⑦ 根 → 本地", d: "根服务器把结果交给本地域名服务器。", on: ["ROOT", "L"], go: ["lr_r"], kv: { "报文数": "7", "当前报文": "203.0.113.80" } },
                  { t: "⑧ 本地 → 主机：返回结果并缓存", d: "本地域名服务器缓存结果并回答主机，同样是 8 个报文。", on: ["L", "H", "cache"], go: ["hl_r"], set: DNSC, kv: { "报文数": "8", "当前报文": "203.0.113.80" }, tip: "报文数与迭代相同，但负担集中在上层服务器（根要等待并转发），所以根服务器一般不接受递归查询。" }
                ];
                return { w: 900, h: 470, nodes: b.nodes, edges: b.edges, steps: S };
              }
            },
            {
              name: "缓存命中",
              make: function () {
                var b = dnsBase(false);
                b.edges.forEach(function (e) { if (e.id !== "hl" && e.id !== "hl_r") { e.dash = 1; delete e.t; } });
                b.edges[1].t = "②";
                b.nodes[5].rows = DNSC.cache.rows;
                var S = [
                  { t: "缓存里已有记录", d: "不久前有人解析过 www.abc.com，本地域名服务器缓存里还留着这条记录（未超过生存时间 TTL）。", on: ["cache"], kv: { "查询": "www.abc.com", "报文数": "0", "当前报文": NONE, "运输层": "UDP，服务器端口 53" } },
                  { t: "① 主机 → 本地：递归查询", d: "主机照常向本地域名服务器发出递归查询。", on: ["H", "L"], go: ["hl"], kv: { "报文数": "1", "当前报文": "递归查询 www.abc.com" } },
                  { t: "本地服务器查缓存：命中", d: "缓存命中，不必再问根、顶级域和权限域名服务器（图中虚线都不发生）。", on: ["L", "cache"], set: { cache: { hi: 0 } }, tip: "缓存大大减少了根服务器的负担；也可以缓存顶级域服务器地址，跳过根直接问 dns.com。" },
                  { t: "② 本地 → 主机：非权威回答", d: "本地服务器直接回答 203.0.113.80，并标明这是来自缓存的非权威回答。一共只有 2 个报文。", on: ["L", "H"], go: ["hl_r"], kv: { "报文数": "2", "当前报文": "203.0.113.80（非权威）" } }
                ];
                return { w: 900, h: 470, nodes: b.nodes, edges: b.edges, steps: S };
              }
            }
          ]
        });

        /* ===================== 4. ARP ===================== */
        function arpKv(op, smac, dmac, sip, tip, tmac) {
          return { "帧类型": op, "源MAC": smac, "目的MAC": dmac, "发送方IP": sip, "目标IP": tip, "ARP 中目标 MAC": tmac };
        }
        function arpSame() {
          var nodes = [
            { id: "SW", k: "box", x: 380, y: 50, w: 180, h: 50, t: "交换机" },
            { id: "A", k: "box", x: 50, y: 210, w: 180, h: 56, t: "主机 A 192.168.1.2\n0A-0A-0A-0A-0A-0A", sm: 1 },
            { id: "B", k: "box", x: 380, y: 210, w: 180, h: 56, t: "主机 B 192.168.1.3\n0B-0B-0B-0B-0B-0B", sm: 1 },
            { id: "C", k: "box", x: 710, y: 210, w: 180, h: 56, t: "主机 C 192.168.1.4\n0C-0C-0C-0C-0C-0C", sm: 1 },
            { id: "tA", k: "table", x: 40, y: 330, w: 250, h: 52, rh: 20, t: "A 的 ARP 缓存", cols: [0.4], rows: [["（空）"]] },
            { id: "tB", k: "table", x: 345, y: 330, w: 250, h: 52, rh: 20, t: "B 的 ARP 缓存", cols: [0.4], rows: [["（空）"]] },
            { id: "tC", k: "table", x: 650, y: 330, w: 250, h: 52, rh: 20, t: "C 的 ARP 缓存", cols: [0.4], rows: [["（空）"]] }
          ];
          var edges = [
            { id: "as", a: "A", as: "t", ao: -10, b: "SW", bs: "l", bo: -10 }, { id: "sa", a: "SW", as: "l", ao: 10, b: "A", bs: "t", bo: 10 },
            { id: "sb", a: "SW", as: "b", ao: -15, b: "B", bs: "t", bo: -15 }, { id: "bs", a: "B", as: "t", ao: 15, b: "SW", bs: "b", bo: 15 },
            { id: "sc", a: "SW", as: "r", ao: -10, b: "C", bs: "t", bo: 10 }, { id: "cs", a: "C", as: "t", ao: -10, b: "SW", bs: "r", bo: 10 }
          ];
          var S = [
            { t: "A 要给 B 发 IP 数据报", d: "A 要发送 IP 数据报给 192.168.1.3。用子网掩码 255.255.255.0 与目的 IP 相与，得 192.168.1.0，与自己同一网络，可以直接交付；查 ARP 缓存，没有 192.168.1.3 的 MAC。", on: ["A", "tA"], kv: arpKv(NONE, NONE, NONE, NONE, NONE, NONE) },
            { t: "ARP 请求：广播", d: "ARP 请求：广播，目的 MAC FF-FF-FF-FF-FF-FF，询问 192.168.1.3 的 MAC。报文中带上 A 自己的 IP 和 MAC，目标 MAC 字段填 0。交换机把广播帧转发到除入端口外的所有端口。", on: ["A", "SW", "B", "C"], go: ["as", "sb", "sc"], kv: arpKv("ARP 请求（操作码 1）", MA, BC, "192.168.1.2", "192.168.1.3", "00-00-00-00-00-00（未知）"), tip: "ARP 请求是广播帧，ARP 响应是单播帧。" },
            { t: "C：不是问我，丢弃", d: "C 发现目标 IP 192.168.1.3 不是自己，不作回答，丢弃该请求（教材写法：其他主机不理睬）。", on: ["C"], set: { C: { badge: "不响应" } } },
            { t: "B：是问我，先记下 A", d: "B 发现目标 IP 是自己，先把请求中 A 的“IP ↔ MAC”写入自己的 ARP 缓存，因为 B 很快也要给 A 发数据。", on: ["B", "tB"], set: { tB: { rows: [["192.168.1.2", MA]], hi: 0 } } },
            { t: "ARP 响应：单播", d: "B 单播发回 ARP 响应，目的 MAC 是 A 的 0A-0A-0A-0A-0A-0A，报文中给出自己的 MAC 0B-0B-0B-0B-0B-0B。", on: ["B", "SW", "A"], go: ["bs", "sa"], set: { tB: { hi: -1 }, C: { badge: "" } }, kv: arpKv("ARP 响应（操作码 2）", MB, MA, "192.168.1.3", "192.168.1.2", MA) },
            { t: "A 更新 ARP 缓存", d: "A 收到响应，把“192.168.1.3 ↔ 0B-0B-0B-0B-0B-0B”写入 ARP 缓存。", on: ["A", "tA"], set: { tA: { rows: [["192.168.1.3", MB]], hi: 0 } } },
            { t: "用 B 的 MAC 封装并发送", d: "A 把 IP 数据报封装成帧：目的 MAC 0B-0B-0B-0B-0B-0B，类型 0x0800。交换机已学到 B 的位置，只转发给 B。", on: ["A", "SW", "B"], go: ["as", "sb"], set: { tA: { hi: -1 } }, kv: { "帧类型": "IP 数据报（0x0800）", "源MAC": MA, "目的MAC": MB, "发送方IP": "192.168.1.2（源 IP）", "目标IP": "192.168.1.3（目的 IP）", "ARP 中目标 MAC": NONE } },
            { t: "缓存有生存时间", d: "ARP 缓存项有生存时间（一般为十几分钟），超时删除，以适应主机更换网卡、IP 变化。以后 A 再发给 B 时，只要缓存未过期就不必再发 ARP 请求。", on: ["tA", "tB"], tip: "ARP 解决同一局域网内 IP → MAC 的映射；它的报文直接封装在帧里（类型 0x0806），王道把 ARP 归在网络层。" }
          ];
          return { w: 940, h: 410, nodes: nodes, edges: edges, steps: S };
        }
        function arpCross() {
          var nodes = [
            { id: "A", k: "box", x: 30, y: 180, w: 190, h: 56, t: "主机 A 192.168.1.2\n0A-0A-0A-0A-0A-0A", sm: 1 },
            { id: "R", k: "box", x: 380, y: 170, w: 200, h: 76, t: "路由器 R\n接口1 192.168.1.1 / 1A-…\n接口2 192.168.2.1 / 2A-…", sm: 1 },
            { id: "B", k: "box", x: 740, y: 180, w: 190, h: 56, t: "主机 B 192.168.2.8\n0B-0B-0B-0B-0B-0B", sm: 1 },
            { id: "n1", k: "zone", x: 15, y: 40, w: 320, h: 380, t: "网络 1：192.168.1.0/24" },
            { id: "n2", k: "zone", x: 625, y: 40, w: 320, h: 380, t: "网络 2：192.168.2.0/24" },
            { id: "tA", k: "table", x: 30, y: 300, w: 260, h: 52, rh: 20, t: "A 的 ARP 缓存", cols: [0.4], rows: [["（空）"]] },
            { id: "tR", k: "table", x: 340, y: 300, w: 280, h: 72, rh: 20, t: "R 的 ARP 缓存", cols: [0.34], rows: [["（空）"]] },
            { id: "tB", k: "table", x: 670, y: 300, w: 260, h: 52, rh: 20, t: "B 的 ARP 缓存", cols: [0.4], rows: [["（空）"]] }
          ];
          var edges = flat([pairH("ar", "A", "R", 10), pairH("rb", "R", "B", 10)]);
          var ipKv = function (smac, dmac, ttl) { return { "帧类型": "IP 数据报（0x0800）", "源MAC": smac, "目的MAC": dmac, "发送方IP": "192.168.1.2（源 IP）", "目标IP": "192.168.2.8（目的 IP）", "ARP 中目标 MAC": NONE, "TTL": ttl }; };
          var S = [
            { t: "目的主机在别的网络", d: "A 要发 IP 数据报给 192.168.2.8。用掩码 255.255.255.0 相与得 192.168.2.0，不是本网络，所以要交给默认网关 192.168.1.1。A 要解析的是网关的 MAC，而不是 B 的 MAC。", on: ["A", "tA"], kv: { "帧类型": NONE, "源MAC": NONE, "目的MAC": NONE, "发送方IP": NONE, "目标IP": NONE, "ARP 中目标 MAC": NONE, "TTL": NONE }, tip: "ARP 只在一个网络内部工作，ARP 请求（广播）不能穿过路由器。" },
            { t: "网络 1 中 ARP 请求：广播", d: "ARP 请求：广播，目的 MAC FF-FF-FF-FF-FF-FF，询问 192.168.1.1 的 MAC。", on: ["A", "R"], go: ["ar"], kv: arpKv("ARP 请求（操作码 1）", MA, BC, "192.168.1.2", "192.168.1.1（网关）", "00-00-00-00-00-00（未知）") },
            { t: "网关单播响应", d: "路由器接口 1 记下 A 的映射，并单播回答自己的 MAC 1A-1A-1A-1A-1A-1A。", on: ["R", "A", "tR"], go: ["ar_r"], set: { tR: { rows: [["192.168.1.2", MA + " 口1"]], hi: 0 } }, kv: arpKv("ARP 响应（操作码 2）", MR1, MA, "192.168.1.1", "192.168.1.2", MA) },
            { t: "A 把数据报交给网关", d: "A 缓存网关的 MAC，封装帧：目的 MAC 是路由器接口 1 的 1A-1A-1A-1A-1A-1A，但 IP 首部的目的地址始终是最终主机 192.168.2.8。", on: ["A", "R", "tA"], go: ["ar"], set: { tA: { rows: [["192.168.1.1", MR1]], hi: 0 }, tR: { hi: -1 } }, kv: ipKv(MA, MR1 + "（网关）", "64"), tip: "帧的目的 MAC = 下一跳的 MAC；IP 首部的目的 IP = 最终目的主机。" },
            { t: "路由器查路由表", d: "路由器去掉帧首部，按目的 IP 查路由表：192.168.2.0/24 是接口 2 的直连网络，可直接交付；TTL 减为 63。查 ARP 缓存，没有 192.168.2.8。", on: ["R", "tR"], set: { tA: { hi: -1 }, R: { badge: "TTL 64→63" } }, kv: { "TTL": "63" } },
            { t: "网络 2 中 ARP 请求：广播", d: "路由器从接口 2 广播 ARP 请求：源 MAC 2A-2A-2A-2A-2A-2A，目的 MAC FF-FF-FF-FF-FF-FF，询问 192.168.2.8。", on: ["R", "B"], go: ["rb"], kv: arpKv("ARP 请求（操作码 1）", MR2, BC, "192.168.2.1", "192.168.2.8", "00-00-00-00-00-00（未知）") },
            { t: "B 单播响应", d: "B 记下路由器接口 2 的映射，单播回答自己的 MAC 0B-0B-0B-0B-0B-0B。", on: ["B", "R", "tB", "tR"], go: ["rb_r"], set: { tB: { rows: [["192.168.2.1", MR2]], hi: 0 }, tR: { rows: [["192.168.1.2", MA + " 口1"], ["192.168.2.8", MB + " 口2"]], hi: 1 } }, kv: arpKv("ARP 响应（操作码 2）", MB, MR2, "192.168.2.8", "192.168.2.1", MR2) },
            { t: "路由器重新封装、转发给 B", d: "路由器在接口 2 重新封装：源 MAC 2A-2A-2A-2A-2A-2A，目的 MAC 0B-0B-0B-0B-0B-0B；源 IP、目的 IP 不变。", on: ["R", "B"], go: ["rb"], set: { tB: { hi: -1 }, tR: { hi: -1 } }, kv: ipKv(MR2, MB, "63"), tip: "ARP 的四种情况：主机→本网主机（解析目的主机）；主机→别网主机（解析默认网关）；路由器→本网主机（解析目的主机）；路由器→别网主机（解析下一跳路由器）。" }
          ];
          return { w: 960, h: 440, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "arp", name: "ARP 地址解析：同网与跨网", sub: "cn",
          lead: "IP 数据报最终要装进帧里才能发出，ARP 负责在一个局域网内把 IP 地址解析成 MAC 地址。",
          note: ["ARP 请求：广播（目的 MAC FF-FF-FF-FF-FF-FF）；ARP 响应：单播。", "目标主机收到请求后先缓存请求方的映射，再单播回应；其他主机不理睬。", "跨网络时主机只解析默认网关的 MAC，由路由器在下一个网络里再解析。", "ARP 只解决同一网络中的映射问题，ARP 广播不能跨越路由器。", "ARP 缓存项有生存时间；ARP 报文直接封装在以太网帧中（类型 0x0806）。"],
          modes: [{ name: "同一网络", make: arpSame }, { name: "跨网络", make: arpCross }]
        });

        /* ===================== 5. DHCP ===================== */
        PROC.push({
          id: "dhcp", name: "DHCP 获取 IP 地址", sub: "cn",
          lead: "新接入的主机没有 IP 地址：Discover → Offer → Request → ACK 四个报文拿到地址、掩码、网关和 DNS，租期过半续租。",
          note: ["DHCP 报文都用 UDP：客户端端口 68，服务器端口 67；DHCP 属于应用层协议。", "Discover：源 IP 0.0.0.0，目的 IP 255.255.255.255，广播帧（目的 MAC 全 F）。", "Request 仍是广播：通知所有提供了 Offer 的服务器自己选了谁，未被选中的收回地址。", "地址有租期：用到 50%（T1）单播续租，87.5%（T2）仍无回应则广播重新请求。", "DHCP 服务器与客户不在同一网络时，需要 DHCP 中继代理（通常由路由器担任）转发。"],
          modes: [{
            name: "四步获取 + 续租",
            make: function () {
              var nodes = [
                { id: "C", k: "box", x: 40, y: 195, w: 190, h: 56, t: "新主机（DHCP 客户）\n0C-0C-0C-0C-0C-0C", sm: 1 },
                { id: "SW", k: "box", x: 360, y: 198, w: 140, h: 50, t: "交换机" },
                { id: "S1", k: "box", x: 700, y: 80, w: 210, h: 56, t: "DHCP 服务器 S1\n192.168.1.254", sm: 1 },
                { id: "S2", k: "box", x: 700, y: 310, w: 210, h: 56, t: "DHCP 服务器 S2\n192.168.1.253", sm: 1 },
                { id: "cfg", k: "table", x: 40, y: 300, w: 260, h: 132, rh: 20, t: "客户的网络配置", cols: [0.36], rows: [["IP 地址", "0.0.0.0（无）"], ["子网掩码", NONE], ["默认网关", NONE], ["DNS 服务器", NONE], ["租期", NONE]] }
              ];
              var edges = flat([pairH("cs", "C", "SW", 10), [
                { id: "s1", a: "SW", as: "t", ao: -10, b: "S1", bs: "l", bo: -10 }, { id: "s1_r", a: "S1", as: "l", ao: 10, b: "SW", bs: "t", bo: 10 },
                { id: "s2", a: "SW", as: "b", ao: -10, b: "S2", bs: "l", bo: 10 }, { id: "s2_r", a: "S2", as: "l", ao: -10, b: "SW", bs: "b", bo: 10 }
              ]]);
              var CFG = [["IP 地址", "192.168.1.100"], ["子网掩码", "255.255.255.0"], ["默认网关", "192.168.1.1"], ["DNS 服务器", "202.1.1.53"], ["租期", "8 小时"]];
              var S = [
                { t: "新主机接入，没有 IP 地址", d: "主机开机接入网络，只知道自己的 MAC，不知道自己的 IP、子网掩码、网关和 DNS 服务器，也不知道 DHCP 服务器在哪里。", on: ["C", "cfg"], kv: pk(NONE) },
                { t: "① DHCP Discover（广播）", d: "客户广播 DHCP 发现报文：源 IP 0.0.0.0（还没有地址），目的 IP 255.255.255.255，UDP 源端口 68、目的端口 67，帧的目的 MAC 全 F。本网所有 DHCP 服务器都会收到。", on: ["C", "SW", "S1", "S2"], go: ["cs", "s1", "s2"], kv: pk("DHCP Discover / UDP", MC, BC, "0.0.0.0", "255.255.255.255", "68", "67", "谁能给我分配地址？"), tip: "源 IP 0.0.0.0、目的 IP 255.255.255.255 是选择题高频考点。" },
                { t: "② DHCP Offer（S1）", d: "S1 从地址池取出 192.168.1.100，连同掩码、网关、DNS、租期一起放进提供报文（UDP 67 → 68）。客户此时还没有 IP，教材中按广播发送。", on: ["S1", "SW", "C"], go: ["s1_r", "cs_r"], kv: pk("DHCP Offer / UDP", "S1 的 MAC", BC, "192.168.1.254", "255.255.255.255", "67", "68", "提供 192.168.1.100，租期 8 小时") },
                { t: "② DHCP Offer（S2）", d: "S2 也收到了发现报文，同样发出提供报文，提供 192.168.1.200。客户可能收到多个 Offer，一般选最先到达的那个。", on: ["S2", "SW", "C"], go: ["s2_r", "cs_r"], kv: pk("DHCP Offer / UDP", "S2 的 MAC", BC, "192.168.1.253", "255.255.255.255", "67", "68", "提供 192.168.1.200") },
                { t: "③ DHCP Request（仍为广播）", d: "客户选中 S1，广播 DHCP 请求报文：源 IP 仍是 0.0.0.0（地址还没确认），报文中写明“服务器标识 192.168.1.254，请求 192.168.1.100”。", on: ["C", "SW", "S1", "S2"], go: ["cs", "s1", "s2"], kv: pk("DHCP Request / UDP", MC, BC, "0.0.0.0", "255.255.255.255", "68", "67", "我选 S1 的 192.168.1.100"), tip: "Request 用广播，是为了通知所有提供了 Offer 的服务器它选择了谁。" },
                { t: "S2 收回自己的提供", d: "S2 从请求报文中看到客户选的不是自己，把 192.168.1.200 放回地址池。", on: ["S2"], set: { S2: { badge: "收回 .200" } } },
                { t: "④ DHCP ACK", d: "S1 发送确认报文，地址正式分配，租期开始计时。客户收到后配置 IP 192.168.1.100、掩码、默认网关和 DNS 服务器，开始正常通信。", on: ["S1", "SW", "C", "cfg"], go: ["s1_r", "cs_r"], set: { cfg: { rows: CFG, hi: [0, 1, 2, 3, 4] } }, kv: pk("DHCP ACK / UDP", "S1 的 MAC", BC, "192.168.1.254", "255.255.255.255", "67", "68", "确认：192.168.1.100，租期 8 小时") },
                { t: "续租：租期过半单播请求", d: "租期用到一半（T1 = 50%）时，客户用已有地址单播 DHCP Request 给 S1 请求续租；S1 回 ACK 则租期重新计算，回 NACK 则必须停用该地址、重新申请。", on: ["C", "SW", "S1", "cfg"], go: ["cs", "s1"], set: { cfg: { hi: 4 }, S2: { badge: "" } }, kv: pk("DHCP Request / UDP", MC, "S1 的 MAC", "192.168.1.100", "192.168.1.254", "68", "67", "请求续租"), tip: "T1 = 0.5 租期单播续租；到 T2 = 0.875 仍无回应，就广播请求任意服务器；租期到了还不成功就放弃该地址。" },
                { t: "提前结束：DHCP Release", d: "客户不再使用时可随时发送 DHCP 释放报文，服务器收回地址；客户回到没有 IP 的状态。", on: ["C", "S1", "cfg"], go: ["cs", "s1"], set: { cfg: { rows: [["IP 地址", "0.0.0.0（无）"], ["子网掩码", NONE], ["默认网关", NONE], ["DNS 服务器", NONE], ["租期", NONE]], hi: -1 } }, kv: pk("DHCP Release / UDP", MC, "S1 的 MAC", "192.168.1.100", "192.168.1.254", "68", "67", "释放 192.168.1.100") }
              ];
              return { w: 940, h: 460, nodes: nodes, edges: edges, steps: S };
            }
          }]
        });

        /* ===================== 6. NAT ===================== */
        PROC.push({
          id: "nat", name: "NAT 地址转换", sub: "cn",
          lead: "内网主机使用私有地址，经 NAT 路由器（NAPT）访问外网服务器：出去改源地址和端口，回来按转换表改目的地址和端口。",
          note: ["私有地址：10.0.0.0/8、172.16.0.0/12、192.168.0.0/16，因特网上的路由器不转发以它们为目的地址的分组。", "NAPT 出方向改写源 IP:端口，入方向改写目的 IP:端口，同时重算 IP 首部检验和与 TCP/UDP 检验和。", "转换表一项：内网 IP:端口 ↔ 公网 IP:端口；靠不同端口区分共用一个公网 IP 的多台内网主机。", "外网主机看到的永远是公网地址；内网主机不能被外网主动访问，除非事先配置端口映射（静态表项）。", "NAPT 要查看和修改运输层端口，因此严格说违反了“网络层设备只处理到网络层”的原则。"],
          modes: [{
            name: "NAPT",
            make: function () {
              var nodes = [
                { id: "zin", k: "zone", x: 15, y: 30, w: 315, h: 400, t: "内网 192.168.1.0/24" },
                { id: "zout", k: "zone", x: 620, y: 30, w: 325, h: 400, t: "外网（因特网）" },
                { id: "H1", k: "box", x: 40, y: 90, w: 160, h: 56, t: "主机 H1\n192.168.1.2", sm: 1 },
                { id: "H2", k: "box", x: 40, y: 300, w: 160, h: 56, t: "主机 H2\n192.168.1.3", sm: 1 },
                { id: "NAT", k: "box", x: 380, y: 195, w: 180, h: 70, t: "NAT 路由器\n内网口 192.168.1.1\n外网口 202.1.1.1", sm: 1 },
                { id: "SV", k: "box", x: 760, y: 202, w: 170, h: 56, t: "Web 服务器\n203.0.113.80:80", sm: 1 },
                { id: "tab", k: "table", x: 640, y: 300, w: 290, h: 92, rh: 20, t: "NAT 转换表", cols: [0.52], rows: [["（空）"]] }
              ];
              var edges = [
                { id: "h1", a: "H1", as: "r", ao: -10, b: "NAT", bs: "t", bo: 20 }, { id: "h1_r", a: "NAT", as: "t", ao: -40, b: "H1", bs: "r", bo: 10 },
                { id: "h2", a: "H2", as: "r", ao: 10, b: "NAT", bs: "b", bo: 20 }, { id: "h2_r", a: "NAT", as: "b", ao: -40, b: "H2", bs: "r", bo: -10 }
              ].concat(pairH("ns", "NAT", "SV", 10));
              var R1 = ["192.168.1.2:5000", "202.1.1.1:6001"], R2 = ["192.168.1.3:5000", "202.1.1.1:6002"];
              var k4 = function (proto, sip, sp, dip, dp, info) { return { "协议": proto, "源IP": sip, "源端口": sp, "目的IP": dip, "目的端口": dp, "说明": info || NONE }; };
              var S = [
                { t: "内网用私有地址", d: "内网主机用私有地址 192.168.1.x，它们不能直接出现在因特网上。NAT 路由器至少有一个全球 IP 地址 202.1.1.1，转换表初始为空。", on: ["NAT", "tab"], kv: k4(NONE, NONE, NONE, NONE, NONE) },
                { t: "H1 发出请求", d: "H1 访问 Web 服务器：源 192.168.1.2:5000，目的 203.0.113.80:80，分组先到达 NAT 路由器（H1 的默认网关）。", on: ["H1", "NAT"], go: ["h1"], kv: k4("TCP", "192.168.1.2", "5000", "203.0.113.80", "80", "内网侧，转换前") },
                { t: "NAT 改写源地址和端口，登记表项", d: "NAPT 把源地址改成公网地址 202.1.1.1，源端口换成 6001，在转换表中登记“192.168.1.2:5000 ↔ 202.1.1.1:6001”，并重算检验和。", on: ["NAT", "tab"], set: { tab: { rows: [R1], hi: 0 } }, kv: k4("TCP", "202.1.1.1", "6001", "203.0.113.80", "80", "源地址:端口已改写") },
                { t: "转发到因特网", d: "改写后的分组发往服务器。服务器看到的源地址是 202.1.1.1:6001，并不知道内网主机的存在。", on: ["NAT", "SV"], go: ["ns"], set: { tab: { hi: -1 } }, tip: "外网主机看到的永远是公网地址。" },
                { t: "服务器响应", d: "服务器回送响应：源 203.0.113.80:80，目的 202.1.1.1:6001。", on: ["SV", "NAT"], go: ["ns_r"], kv: k4("TCP", "203.0.113.80", "80", "202.1.1.1", "6001", "外网侧，转换前") },
                { t: "按表改写目的地址，交给 H1", d: "NAT 用目的端口 6001 查转换表，把目的地址改回 192.168.1.2:5000，转发给 H1。", on: ["NAT", "tab", "H1"], go: ["h1_r"], set: { tab: { hi: 0 } }, kv: k4("TCP", "203.0.113.80", "80", "192.168.1.2", "5000", "目的地址:端口已改回") },
                { t: "H2 也用端口 5000 访问", d: "H2 恰好也用源端口 5000 访问同一服务器。NAT 给它分配另一个端口 6002，登记新表项，于是两台主机共用一个公网 IP 也能区分开。", on: ["H2", "NAT", "tab", "SV"], go: ["h2", "ns"], set: { tab: { rows: [R1, R2], hi: 1 } }, kv: k4("TCP", "202.1.1.1", "6002", "203.0.113.80", "80", "H2 的 192.168.1.3:5000 已改写"), tip: "NAPT 靠端口号区分内网主机，一个公网 IP 可供很多主机同时上网。" },
                { t: "回给 6002 的响应送到 H2", d: "目的为 202.1.1.1:6002 的响应按第二项改回 192.168.1.3:5000，交给 H2。", on: ["SV", "NAT", "tab", "H2"], go: ["ns_r", "h2_r"], set: { tab: { hi: 1 } }, kv: k4("TCP", "203.0.113.80", "80", "192.168.1.3", "5000", "目的地址:端口已改回") },
                { t: "外网主动访问：表中无项，丢弃", d: "若外网主机主动发分组到 202.1.1.1:7000，转换表中没有对应表项，NAT 不知道该交给谁，只能丢弃。要让外网访问内网服务器，必须事先配置静态端口映射。", on: ["SV", "NAT"], go: ["ns_r"], set: { tab: { hi: -1, bad: -1 }, NAT: { badge: "无表项·丢弃" } }, kv: k4("TCP", "203.0.113.80", "80", "202.1.1.1", "7000", "外网主动发起") }
              ];
              return { w: 960, h: 450, nodes: nodes, edges: edges, steps: S };
            }
          }]
        });

        /* ===================== 7. 交换机自学习与转发 ===================== */
        PROC.push({
          id: "switch", name: "以太网交换机自学习与转发", sub: "cn",
          lead: "交换表开始为空：交换机记录每个帧的“源 MAC + 入端口”，查目的 MAC 决定泛洪、单端口转发还是丢弃。端口 4 接了一个集线器（D、E）。",
          note: ["自学习：收到帧就把“源 MAC ↔ 入端口”写入交换表（已有则更新时间）。", "转发：目的 MAC 不在表中 → 向除入端口外的所有端口泛洪；在表中且端口不同 → 只从该端口转发；端口相同 → 丢弃（过滤）。", "广播帧（目的 MAC 全 F）总是泛洪：交换机隔离冲突域，不隔离广播域。", "表项有有效时间，超时删除，以适应主机移动和拓扑变化。", "交换机工作在数据链路层，对主机透明，不改变帧的 MAC 地址。"],
          modes: [{
            name: "A、B、C + 集线器（D、E）",
            make: function () {
              var X = [200, 360, 520, 740];
              var nodes = [
                { id: "SW", k: "box", x: 130, y: 40, w: 720, h: 56, t: "以太网交换机（存储转发）" },
                { id: "A", k: "box", x: 140, y: 260, w: 120, h: 50, t: "A  0A-…", sm: 1 },
                { id: "B", k: "box", x: 300, y: 260, w: 120, h: 50, t: "B  0B-…", sm: 1 },
                { id: "C", k: "box", x: 460, y: 260, w: 120, h: 50, t: "C  0C-…", sm: 1 },
                { id: "HUB", k: "box", x: 630, y: 260, w: 220, h: 50, t: "集线器（物理层）" },
                { id: "D", k: "box", x: 610, y: 400, w: 110, h: 50, t: "D  0D-…", sm: 1 },
                { id: "E", k: "box", x: 770, y: 400, w: 110, h: 50, t: "E  0E-…", sm: 1 },
                { id: "tab", k: "table", x: 30, y: 360, w: 360, h: 132, rh: 20, t: "交换表（MAC 地址 → 端口）", cols: [0.6], rows: [["（空）"]] }
              ];
              var edges = [], hosts = ["A", "B", "C", "HUB"];
              X.forEach(function (x, i) {
                var p = "P" + (i + 1);
                nodes.push({ id: p, k: "reg", x: x - 30, y: 104, w: 60, h: 26, t: "端口" + (i + 1), sm: 1 });
                edges.push({ id: "d" + (i + 1), a: p, as: "b", ao: -10, b: hosts[i], bs: "t", bo: x - (nodes[i + 1].x + nodes[i + 1].w / 2) - 10 });
                edges.push({ id: "u" + (i + 1), a: hosts[i], as: "t", ao: x - (nodes[i + 1].x + nodes[i + 1].w / 2) + 10, b: p, bs: "b", bo: 10 });
              });
              edges.push({ id: "hd", a: "HUB", as: "b", ao: -85, b: "D", bs: "t", bo: -10 }, { id: "dh", a: "D", as: "t", ao: 10, b: "HUB", bs: "b", bo: -65 });
              edges.push({ id: "he", a: "HUB", as: "b", ao: 75, b: "E", bs: "t", bo: -10 }, { id: "eh", a: "E", as: "t", ao: 10, b: "HUB", bs: "b", bo: 95 });
              var k = function (s, d, port, act) { return { "源MAC": s, "目的MAC": d, "入端口": port, "动作": act }; };
              var T1 = [MA, "1"], T2 = [MB, "2"], T3 = [ME, "4"], T4 = [MD, "4"], T5 = [MC, "3"];
              var S = [
                { t: "交换表为空", d: "交换机刚上电，交换表为空。A、B、C 分别接端口 1、2、3；端口 4 接集线器，D、E 共享这个端口。", on: ["SW", "tab"], kv: k(NONE, NONE, NONE, NONE) },
                { t: "A → B：学习 A 在端口 1", d: "A 发给 B 的帧从端口 1 进入。交换机先自学习：把“0A-0A-0A-0A-0A-0A ↔ 端口 1”写入交换表。", on: ["A", "P1", "SW", "tab"], go: ["u1"], set: { tab: { rows: [T1], hi: 0 } }, kv: k(MA, MB, "1", "学习 A") },
                { t: "B 不在表中：泛洪", d: "再查目的 MAC 0B-0B-0B-0B-0B-0B，表中没有，于是向除入端口 1 外的所有端口（2、3、4）泛洪。B 接收；C、D、E 发现目的 MAC 不是自己，丢弃。", on: ["SW", "P2", "P3", "P4", "B", "C", "HUB", "D", "E"], go: ["d2", "d3", "d4", "hd", "he"], set: { tab: { hi: -1 } }, kv: { "动作": "泛洪到端口 2、3、4" }, tip: "未知单播帧也要泛洪（不只是广播帧）。" },
                { t: "B → A：学习 B 在端口 2", d: "B 回帧给 A，从端口 2 进入，交换机记下“0B-0B-0B-0B-0B-0B ↔ 端口 2”。", on: ["B", "P2", "SW", "tab"], go: ["u2"], set: { tab: { rows: [T1, T2], hi: 1 } }, kv: k(MB, MA, "2", "学习 B") },
                { t: "A 在表中：只从端口 1 转发", d: "目的 MAC 0A-0A-0A-0A-0A-0A 在表中，对应端口 1，与入端口不同，只从端口 1 转发。C、D、E 收不到这个帧。", on: ["SW", "P1", "A", "tab"], go: ["d1"], set: { tab: { hi: 0 } }, kv: { "动作": "只转发到端口 1" } },
                { t: "A → B 再次通信", d: "此后 A 与 B 之间的帧都只在端口 1 和端口 2 之间转发，其他端口上的主机不受打扰。", on: ["A", "P1", "SW", "P2", "B", "tab"], go: ["u1", "d2"], set: { tab: { hi: 1 } }, kv: k(MA, MB, "1", "只转发到端口 2") },
                { t: "E → A：学习 E 在端口 4", d: "E 发给 A。集线器在物理层把信号转发到其他所有口，所以 D 也收到（D 丢弃）。帧从端口 4 进入，交换机记下“E ↔ 端口 4”，再按表只转发到端口 1。", on: ["E", "HUB", "D", "P4", "SW", "P1", "A", "tab"], go: ["eh", "hd", "u4", "d1"], set: { tab: { rows: [T1, T2, T3], hi: [0, 2] } }, kv: k(ME, MA, "4", "学习 E，转发到端口 1") },
                { t: "D → E：目的端口 = 入端口，丢弃", d: "D 发给 E，集线器已把帧直接送到 E，同时也送到交换机端口 4。交换机记下“D ↔ 端口 4”；查表发现 E 也在端口 4，与入端口相同，不再转发，直接丢弃（过滤）。", on: ["D", "HUB", "E", "P4", "SW", "tab"], go: ["dh", "he", "u4"], set: { tab: { rows: [T1, T2, T3, T4], hi: 3, bad: 2 }, SW: { badge: "丢弃" } }, kv: k(MD, ME, "4", "同一端口，丢弃"), tip: "目的 MAC 对应的端口就是入端口时丢弃——这是交换机“过滤”的含义。" },
                { t: "C 发广播帧：总是泛洪", d: "C 发送目的 MAC 为 FF-FF-FF-FF-FF-FF 的广播帧（比如 ARP 请求）。交换机记下“C ↔ 端口 3”，广播帧向除端口 3 外的所有端口转发。", on: ["C", "P3", "SW", "P1", "P2", "P4", "A", "B", "HUB", "D", "E", "tab"], go: ["u3", "d1", "d2", "d4", "hd", "he"], set: { tab: { rows: [T1, T2, T3, T4, T5], hi: 4, bad: -1 }, SW: { badge: "" } }, kv: k(MC, BC, "3", "广播：泛洪到 1、2、4"), tip: "交换机的每个端口是一个冲突域，但所有端口仍在同一个广播域中。" },
                { t: "表项老化", d: "每个表项都记有写入时间，超过有效时间（如 300 秒）没有刷新就删除。若 A 换到别的端口，它一发帧，交换机就会更新 A 的端口号。", on: ["tab"], set: { tab: { rows: [T2, T3, T4, T5], hi: -1 } }, kv: k(NONE, NONE, NONE, "A 的表项超时删除") }
              ];
              return { w: 900, h: 510, nodes: nodes, edges: edges, steps: S };
            }
          }]
        });

        /* ===================== 8. 电子邮件 ===================== */
        function mailNodes(web) {
          return [
            { id: "UA1", k: "box", x: 20, y: 130, w: 150, h: 56, t: web ? "发件人浏览器\nxiao@abc.com" : "发件人用户代理\nxiao@abc.com", sm: 1 },
            { id: "MS1", k: "box", x: 270, y: 130, w: 160, h: 56, t: "发送方邮件服务器\nmail.abc.com", sm: 1 },
            { id: "MS2", k: "box", x: 530, y: 130, w: 160, h: 56, t: "接收方邮件服务器\nmail.xyz.com", sm: 1 },
            { id: "UA2", k: "box", x: 790, y: 130, w: 150, h: 56, t: web ? "收件人浏览器\nwang@xyz.com" : "收件人用户代理\nwang@xyz.com", sm: 1 },
            { id: "q", k: "table", x: 230, y: 260, w: 240, h: 52, rh: 20, t: "发送队列", cols: [0.68], rows: [["（空）"]] },
            { id: "box", k: "table", x: 490, y: 260, w: 240, h: 52, rh: 20, t: "wang 的邮箱", cols: [0.68], rows: [["（空）"]] }
          ];
        }
        function mailEdges(web) {
          var up = web ? "HTTP" : "SMTP", dn = web ? "HTTP" : "POP3/IMAP";
          return [
            { id: "um", a: "UA1", b: "MS1", t: up },
            { id: "mm", a: "MS1", as: "r", ao: -10, b: "MS2", bs: "l", bo: -10, t: "SMTP" }, { id: "mm_r", a: "MS2", as: "l", ao: 10, b: "MS1", bs: "r", bo: 10, dash: 1 },
            { id: "um2", a: "UA2", as: "l", ao: -10, b: "MS2", bs: "r", bo: -10, t: dn }, { id: "um2_r", a: "MS2", as: "r", ao: 10, b: "UA2", bs: "l", bo: 10 }
          ];
        }
        var MAIL = [["来自 xiao@abc.com", "1 封"]];
        PROC.push({
          id: "email", name: "电子邮件的发送与读取", sub: "cn",
          lead: "xiao@abc.com 给 wang@xyz.com 发一封带附件的邮件：SMTP 推送两次，POP3 / IMAP 拉取一次。",
          note: ["发送用 SMTP（TCP 25）：用户代理 → 发送方邮件服务器，发送方邮件服务器 → 接收方邮件服务器，都是“推”。", "读取用 POP3（TCP 110）或 IMAP（TCP 143），是“拉”；POP3 一般下载后删除，IMAP 在服务器上管理邮件。", "SMTP 只能传送 7 位 ASCII 码，非 ASCII 内容（中文、附件）用 MIME 编码（如 Base64）。", "基于万维网的电子邮件：浏览器与邮件服务器之间用 HTTP，邮件服务器之间仍用 SMTP。", "SMTP 通信三阶段：连接建立、邮件传送、连接释放；邮件服务器之间直接建立 TCP 连接，不经中间邮件服务器。"],
          modes: [
            {
              name: "SMTP + POP3",
              make: function () {
                var S = [
                  { t: "撰写邮件", d: "发件人在用户代理中写信：首部有 To、From、Subject，主体包括正文和一个附件。中文和附件不是 7 位 ASCII，用户代理用 MIME 编码（如 Base64）。", on: ["UA1"], kv: { "协议": NONE, "端口": NONE, "方向": NONE, "说明": "MIME 编码附件" }, tip: "MIME 并没有取代 SMTP，而是在其基础上增加邮件主体的结构和编码规则。" },
                  { t: "用户代理用 SMTP 推送", d: "用户代理作为 SMTP 客户，与发送方邮件服务器的 25 端口建立 TCP 连接，把邮件发送过去。", on: ["UA1", "MS1"], go: ["um"], kv: { "协议": "SMTP / TCP", "端口": "25", "方向": "推（push）", "说明": "用户代理 → mail.abc.com" } },
                  { t: "邮件进入发送队列", d: "发送方邮件服务器把邮件放入发送队列，等待发送。", on: ["MS1", "q"], set: { q: { rows: MAIL, hi: 0 } } },
                  { t: "服务器之间用 SMTP 传送", d: "发送方邮件服务器作为 SMTP 客户，与接收方邮件服务器的 25 端口建立 TCP 连接：服务器先发 220 服务就绪，客户依次发 HELO、MAIL FROM、RCPT TO、DATA 传送邮件，最后 QUIT 释放连接。", on: ["MS1", "MS2", "q"], go: ["mm"], set: { q: { hi: -1 } }, kv: { "协议": "SMTP / TCP", "端口": "25", "方向": "推（push）", "说明": "mail.abc.com → mail.xyz.com" }, tip: "若接收方服务器暂时连不上，邮件留在发送队列里，过一段时间再试；SMTP 不使用中间邮件服务器。" },
                  { t: "接收方存入收件人邮箱", d: "接收方服务器回 250 OK，把邮件存入 wang 的邮箱；发送方把邮件移出发送队列。", on: ["MS2", "box", "q"], go: ["mm_r"], set: { q: { rows: [["（空）"]] }, box: { rows: MAIL, hi: 0 } }, kv: { "说明": "250 OK，邮件已投递到邮箱" } },
                  { t: "收件人用 POP3 拉取", d: "收件人的用户代理作为 POP3 客户，与接收方服务器的 110 端口建立 TCP 连接，先用用户名和口令鉴别，再请求读取邮件。", on: ["UA2", "MS2"], go: ["um2"], set: { box: { hi: -1 } }, kv: { "协议": "POP3 / TCP", "端口": "110", "方向": "拉（pull）", "说明": "用户代理 → mail.xyz.com" }, tip: "用户代理到服务器发信用 SMTP，读信用 POP3 / IMAP，不能混淆方向。" },
                  { t: "邮件下载到用户代理", d: "服务器把邮件传给用户代理。POP3 通常采用“下载并删除”方式（也可“下载并保留”）；若用 IMAP（143 端口），邮件留在服务器上，可在服务器上建文件夹、只先读取首部。", on: ["MS2", "UA2", "box"], go: ["um2_r"], set: { box: { rows: [["（已下载并删除）"]] } }, kv: { "说明": "邮件交给收件人用户代理" } },
                  { t: "MIME 解码并显示", d: "收件人的用户代理按 MIME 首部（Content-Type、Content-Transfer-Encoding）解码正文和附件并显示。整个过程：SMTP 推两次，POP3 拉一次。", on: ["UA2"], kv: { "协议": NONE, "端口": NONE, "方向": NONE, "说明": "MIME 解码" } }
                ];
                return { w: 960, h: 390, nodes: mailNodes(false), edges: mailEdges(false), steps: S };
              }
            },
            {
              name: "基于万维网（HTTP）",
              make: function () {
                var S = [
                  { t: "浏览器登录网页邮箱", d: "发件人在浏览器中打开网页邮箱，写好邮件后点击发送：浏览器用 HTTP（POST）把邮件交给发送方邮件服务器。", on: ["UA1", "MS1"], go: ["um"], kv: { "协议": "HTTP / TCP", "端口": "80（HTTPS 443）", "方向": "浏览器 → 服务器", "说明": "不再用 SMTP" } },
                  { t: "邮件进入发送队列", d: "发送方服务器把邮件放入发送队列。", on: ["MS1", "q"], set: { q: { rows: MAIL, hi: 0 } } },
                  { t: "服务器之间仍用 SMTP", d: "两个邮件服务器之间的传送与传统方式完全相同：SMTP，TCP 25 端口。", on: ["MS1", "MS2"], go: ["mm"], set: { q: { hi: -1 } }, kv: { "协议": "SMTP / TCP", "端口": "25", "方向": "推（push）", "说明": "mail.abc.com → mail.xyz.com" }, tip: "网页邮件只把“用户 ↔ 服务器”这一段换成 HTTP，服务器之间还是 SMTP。" },
                  { t: "存入收件人邮箱", d: "接收方服务器确认（250 OK）后把邮件存入 wang 的邮箱。", on: ["MS2", "box", "q"], go: ["mm_r"], set: { q: { rows: [["（空）"]] }, box: { rows: MAIL, hi: 0 } }, kv: { "说明": "250 OK" } },
                  { t: "收件人用浏览器读信", d: "收件人用浏览器访问网页邮箱，用 HTTP 请求（GET）读取邮件，服务器把邮件内容放在网页里返回。这一段用 HTTP，而不是 POP3。", on: ["UA2", "MS2", "box"], go: ["um2", "um2_r"], set: { box: { hi: -1 } }, kv: { "协议": "HTTP / TCP", "端口": "80（HTTPS 443）", "方向": "浏览器 ↔ 服务器", "说明": "不再用 POP3 / IMAP" } }
                ];
                return { w: 960, h: 390, nodes: mailNodes(true), edges: mailEdges(true), steps: S };
              }
            }
          ]
        });

        /* ===================== 9. ping 与 traceroute ===================== */
        function icmpNodes(title) {
          return [
            { id: "H1", k: "box", x: 20, y: 120, w: 150, h: 56, t: "源主机 H1\n192.168.1.2", sm: 1 },
            { id: "R1", k: "box", x: 260, y: 120, w: 150, h: 56, t: "路由器 R1\n192.168.1.1", sm: 1 },
            { id: "R2", k: "box", x: 500, y: 120, w: 150, h: 56, t: "路由器 R2\n10.0.0.2", sm: 1 },
            { id: "H2", k: "box", x: 740, y: 120, w: 160, h: 56, t: "目的主机 H2\n202.1.1.8", sm: 1 },
            { id: "out", k: "table", x: 20, y: 250, w: 600, h: 132, rh: 20, t: title, cols: [0.16], rows: [["（尚无输出）"]] }
          ];
        }
        function icmpEdges() { return flat([pairH("a", "H1", "R1", 12), pairH("b", "R1", "R2", 12), pairH("c", "R2", "H2", 12)]); }
        function ik(proto, type, ttl, sip, dip, info) { return { "协议": proto, "ICMP 类型": type, "TTL": ttl, "源IP": sip, "目的IP": dip, "说明": info || NONE }; }
        PROC.push({
          id: "icmp", name: "ping 与 traceroute（ICMP）", sub: "cn",
          lead: "两个直接使用 ICMP 的应用：ping 测试连通性和往返时间，traceroute 利用 TTL 逐跳“探路”。",
          note: ["ICMP 报文封装在 IP 数据报中（协议字段 1），属于网络层；ping 不经过 TCP/UDP，是应用层直接使用网络层 ICMP 的例子。", "ping：ICMP 回送请求（类型 8）与回送回答（类型 0），属于询问报文。", "traceroute：依次发 TTL = 1、2、3… 的数据报，路由器把 TTL 减到 0 时丢弃并回送“时间超过”（类型 11）。", "到达目的主机时，因 UDP 端口不可用而回送“目的不可达·端口不可达”（类型 3，代码 3）；Windows 的 tracert 改用回送请求，以回送回答结束。", "不发送 ICMP 差错报文：对 ICMP 差错报文、分片的非第一片、多播地址、特殊地址（127.0.0.0、0.0.0.0）。"],
          modes: [
            {
              name: "ping",
              make: function () {
                var S = [
                  { t: "执行 ping 202.1.1.8", d: "ping 程序构造 ICMP 回送请求报文（类型 8，代码 0，带标识符和序号），直接封装在 IP 数据报中（协议字段 1），不使用 TCP 或 UDP，所以没有端口号。", on: ["H1"], kv: ik("ICMP", "8（回送请求）", "64", "192.168.1.2", "202.1.1.8", "序号 1") },
                  { t: "回送请求逐跳转发", d: "R1、R2 把它当作普通 IP 数据报转发，每经过一个路由器 TTL 减 1，到达 H2 时 TTL = 62。", on: ["H1", "R1", "R2", "H2"], go: ["a", "b", "c"], kv: { "TTL": "64 → 62（到达 H2）" } },
                  { t: "H2 回送回答", d: "H2 收到回送请求，回一个 ICMP 回送回答报文（类型 0），标识符和序号与请求相同，数据原样带回。", on: ["H2", "R2", "R1", "H1"], go: ["c_r", "b_r", "a_r"], kv: ik("ICMP", "0（回送回答）", "64 → 62（到达 H1）", "202.1.1.8", "192.168.1.2", "序号 1") },
                  { t: "计算往返时间", d: "H1 用发出时间和收到时间之差得到往返时间 RTT，打印一行结果。", on: ["H1", "out"], set: { out: { rows: [["#1", "来自 202.1.1.8 的回复：字节=32 时间=12ms TTL=62"]], hi: 0 } }, kv: { "说明": "RTT = 12 ms" } },
                  { t: "连续发送并统计", d: "默认连发 4 个（Windows）或持续发送（Linux），最后统计发送数、接收数、丢包率和最小 / 平均 / 最大 RTT。若某次超时没有回答，就记为丢失。", on: ["H1", "out"], go: ["a", "b", "c", "c_r", "b_r", "a_r"], set: { out: { rows: [["#1", "来自 202.1.1.8 的回复：字节=32 时间=12ms TTL=62"], ["#2", "来自 202.1.1.8 的回复：字节=32 时间=11ms TTL=62"], ["#3", "来自 202.1.1.8 的回复：字节=32 时间=13ms TTL=62"], ["#4", "来自 202.1.1.8 的回复：字节=32 时间=12ms TTL=62"], ["统计", "已发送 4，已接收 4，丢失 0（0% 丢失）"]], hi: 4 } }, kv: ik("ICMP", "8 / 0", "—", "192.168.1.2", "202.1.1.8", "丢包率 0%"), tip: "回送请求和回送回答是 ICMP 询问报文，不是差错报文。" }
                ];
                return { w: 920, h: 390, nodes: icmpNodes("ping 输出"), edges: icmpEdges(), steps: S };
              }
            },
            {
              name: "traceroute",
              make: function () {
                var r1 = ["1", "192.168.1.1   1 ms"], r2 = ["2", "10.0.0.2   6 ms"], r3 = ["3", "202.1.1.8   12 ms（到达）"];
                var S = [
                  { t: "原理：用 TTL 逼出每一跳", d: "traceroute（Unix）发送封装 UDP 的数据报，目的端口选一个不可能使用的值（如 33434 起）。第一次把 TTL 设为 1，之后逐次加 1。", on: ["H1"], kv: ik("UDP（探测）", NONE, NONE, "192.168.1.2", "202.1.1.8", "目的端口 33434（不可用）") },
                  { t: "TTL = 1：到达 R1", d: "数据报到达 R1，R1 把 TTL 减为 0，丢弃该数据报。", on: ["H1", "R1"], go: ["a"], set: { R1: { badge: "TTL 1→0 丢弃" } }, kv: { "TTL": "1", "说明": "第 1 轮探测" } },
                  { t: "R1 回送“时间超过”", d: "R1 向源主机发送 ICMP 时间超过报文（类型 11，代码 0），源地址是 R1 的接口地址，于是 H1 得知第一跳是 192.168.1.1。", on: ["R1", "H1", "out"], go: ["a_r"], set: { R1: { badge: "" }, out: { rows: [r1], hi: 0 } }, kv: ik("ICMP", "11（时间超过）", "—", "192.168.1.1", "192.168.1.2", "第 1 跳：R1"), tip: "时间超过属于 ICMP 差错报告报文，数据部分带回原数据报的首部和前 8 字节。" },
                  { t: "TTL = 2：到达 R2", d: "第二轮 TTL = 2：经过 R1 时减为 1，到达 R2 时减为 0，R2 丢弃。", on: ["H1", "R1", "R2"], go: ["a", "b"], set: { R2: { badge: "TTL 1→0 丢弃" } }, kv: ik("UDP（探测）", NONE, "2", "192.168.1.2", "202.1.1.8", "第 2 轮探测") },
                  { t: "R2 回送“时间超过”", d: "R2 回送 ICMP 时间超过报文（类型 11），H1 得知第二跳是 10.0.0.2。", on: ["R2", "R1", "H1", "out"], go: ["b_r", "a_r"], set: { R2: { badge: "" }, out: { rows: [r1, r2], hi: 1 } }, kv: ik("ICMP", "11（时间超过）", "—", "10.0.0.2", "192.168.1.2", "第 2 跳：R2") },
                  { t: "TTL = 3：到达目的主机", d: "第三轮 TTL = 3，数据报到达 H2 时 TTL 还剩 1，H2 正常接收，交给 UDP；但目的端口没有进程在用。", on: ["H1", "R1", "R2", "H2"], go: ["a", "b", "c"], set: { H2: { badge: "端口不可用" } }, kv: ik("UDP（探测）", NONE, "3", "192.168.1.2", "202.1.1.8", "第 3 轮探测") },
                  { t: "H2 回送“端口不可达”", d: "H2 回送 ICMP 目的不可达报文（类型 3，代码 3：端口不可达）。H1 收到它，知道已经到达终点，停止探测。", on: ["H2", "R2", "R1", "H1", "out"], go: ["c_r", "b_r", "a_r"], set: { H2: { badge: "" }, out: { rows: [r1, r2, r3], hi: 2 } }, kv: ik("ICMP", "3（目的不可达·端口不可达）", "—", "202.1.1.8", "192.168.1.2", "到达终点"), tip: "终点不是靠“时间超过”判断的，而是靠端口不可达（Windows tracert 用回送请求，则靠回送回答类型 0）。" },
                  { t: "得到完整路径", d: "每个 TTL 值通常连发 3 个探测报文，输出 3 个往返时间；某跳不回应时显示 *。把各跳地址按顺序排起来就是从 H1 到 H2 的路径。", on: ["out"], set: { out: { hi: [0, 1, 2] } }, kv: { "说明": "共 3 跳" } }
                ];
                return { w: 920, h: 390, nodes: icmpNodes("traceroute 输出"), edges: icmpEdges(), steps: S };
              }
            }
          ]
        });
      })();
