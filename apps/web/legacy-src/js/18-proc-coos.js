      /* 过程图解 · 补充：Cache 读写流程（组成原理）、文件的打开与读取（操作系统）、SPOOLing 假脱机（操作系统） */
      (function () {
        var PROC = window.PROC = window.PROC || [];

        /* ===================== Cache 读写流程 ===================== */
        /* 主存地址 16 位：Tag 8 位 | 组号 2 位 | 块内地址 6 位；块 64B，2 路组相联共 4 组 8 行；访问地址 0x1A7C → Tag 1A、组 1、块内 3C */
        function cacheFlow(mode) {
          var write = mode.charAt(0) === "w", hit = mode === "rh" || mode === "wbk" || mode === "wth", wt = mode === "wth" || mode === "wna";
          var D = function (x) { return wt ? "—" : x; };
          var HEAD = ["组·行", "V", "D", "Tag", "数据块"];
          var S0 = [["组0·行0", "1", D("0"), "05", "块 05·0"], ["组0·行1", "0", D("0"), "—", "—"]];
          var S1 = hit
            ? [["组1·行0", "1", D("0"), "1A", "块 1A·1"], ["组1·行1", "1", D(wt ? "0" : "1"), "07", "块 07·1"]]
            : [["组1·行0", "1", D("1"), "07", wt ? "块 07·1" : "块 07·1（已改）"], ["组1·行1", "1", D("0"), "3B", "块 3B·1"]];
          var crows = function (l0, l1) { return [HEAD].concat(S0, [l0 || S1[0], l1 || S1[1]]); };
          var mrows = function (a, b) { return [["主存块", "内容"], ["Tag 1A·组1", a || "旧值"], ["Tag 07·组1", b || "旧版本"], ["Tag 3B·组1", "…"]]; };
          var aSegs = function (on) { return [{ t: "标记 Tag", b: 8, v: on ? "1A" : "" }, { t: "组号", b: 2, v: on ? "01" : "" }, { t: "块内地址", b: 6, v: on ? "11 1100" : "" }]; };
          var nodes = [
            { id: "CPU", k: "box", x: 30, y: 50, w: 130, h: 58, t: "CPU", v: write ? "写 0x1A7C" : "读 0x1A7C" },
            { id: "ADDR", k: "fields", x: 230, y: 50, w: 420, h: 58, t: "主存地址 0x1A7C（16 位）", segs: aSegs(0) },
            { id: "CACHE", k: "table", x: 230, y: 160, w: 420, h: 132, rh: 20, t: wt ? "Cache（2 路组相联，全写法无需脏位）" : "Cache（2 路组相联）", cols: [0.2, 0.1, 0.1, 0.16], rows: crows() },
            { id: "MEM", k: "table", x: 760, y: 160, w: 180, h: 132, rh: 20, t: "主存", cols: [0.52], rows: mrows() },
            { id: "DEC", k: "dec", x: 20, y: 330, w: 150, h: 90, t: "Tag 比较\n命中？" },
            { id: "REP", k: "box", x: 250, y: 345, w: 180, h: 60, t: "替换算法（LRU）", sm: 1 },
            { id: "WB", k: "box", x: 520, y: 345, w: 150, h: 60, t: "写缓冲（FIFO）", v: "空" }
          ];
          var edges = [
            { id: "cpu_addr", a: "CPU", b: "ADDR", t: "地址" },
            { id: "addr_c", a: "ADDR", as: "b", ao: 26, b: "CACHE", bs: "t", bo: 26, t: "选组" },
            { id: "c_cpu", a: "CACHE", as: "l", ao: -20, b: "CPU", bs: "b", bo: 30, t: "数据", lp: [180, 206] },
            { id: "cpu_c", a: "CPU", as: "b", ao: -30, b: "CACHE", bs: "l", bo: 30, t: "写入", lp: [185, 256] },
            { id: "c_dec", a: "CACHE", as: "l", ao: 50, b: "DEC", bs: "t", t: "比较", lp: [95, 303] },
            { id: "dec_rep", a: "DEC", b: "REP", t: "缺失" },
            { id: "m_c", a: "MEM", as: "l", ao: -20, b: "CACHE", bs: "r", bo: -20, t: "调入块" },
            { id: "c_m", a: "CACHE", as: "r", ao: 30, b: "MEM", bs: "l", bo: 30, t: "写回" },
            { id: "c_wb", a: "CACHE", as: "b", ao: 155, b: "WB", bs: "t", t: "同时写" },
            { id: "wb_m", a: "WB", as: "r", b: "MEM", bs: "b", t: "写主存" },
            { id: "cpu_m", a: "CPU", as: "t", b: "MEM", bs: "t", pts: [[95, 22], [850, 22]], t: "直接写主存", lp: [700, 22] }
          ];
          var S = [];
          S.push({ t: write ? "CPU 发出写请求" : "CPU 发出读请求", d: (write ? "CPU 要把一个数据写到主存地址 0x1A7C。" : "CPU 要读主存地址 0x1A7C 处的数据。") + "Cache 为 2 路组相联、共 4 组，块大小 64B，主存地址 16 位。", on: ["CPU", "ADDR"], go: ["cpu_addr"], kv: { "访问主存次数": "0", "结果": "—" } });
          S.push({ t: "拆分主存地址", d: "块内地址 log2(64) = 6 位，组号 log2(4) = 2 位，其余 8 位是标记。0x1A7C = 0001 1010 | 01 | 11 1100，即 Tag = 1A、组号 1、块内地址 3C。", on: ["ADDR"], set: { ADDR: { segs: aSegs(1) } }, kv: { "Tag": "1A", "组号": "1" } });
          S.push({ t: "按组号选中第 1 组", d: "组号直接选出 Cache 的第 1 组，组内的 2 行都可能存放这个块。", on: ["ADDR", "CACHE"], go: ["addr_c"], set: { CACHE: { hi: [3, 4] } } });
          if (hit) {
            S.push({ t: "比较 Tag：命中", d: "同时比较组内 2 行的标记：行 0 的 V = 1 且 Tag = 1A，与地址的标记相等，命中。", on: ["CACHE", "DEC"], go: ["c_dec"], set: { CACHE: { hi: 3 }, DEC: { t: "命中 ✓" } }, kv: { "结果": "命中" }, tip: "命中的条件是有效位 V = 1 且标记相等，两者缺一不可。" });
          } else {
            S.push({ t: "比较 Tag：缺失", d: "组内两行的标记是 07 和 3B，都不等于 1A，缺失（Cache miss）。", on: ["CACHE", "DEC"], go: ["c_dec"], set: { DEC: { t: "缺失 ✗" } }, kv: { "结果": "缺失" } });
          }
          var repl = function () {
            S.push({ t: "组已满，按 LRU 选替换行", d: "第 1 组两行都有效，没有空行，只能替换。LRU 选中最久没有被访问的行 0（Tag 07）。", on: ["DEC", "REP", "CACHE"], go: ["dec_rep"], set: { CACHE: { hi: -1, bad: 3 }, REP: { v: "选中 组1·行0" } }, tip: "替换只在组内进行；组内有空行（V = 0）时直接装入，不需要替换算法。" });
            S.push({ t: "被替换行脏位为 1：先写回", d: "行 0 的 D = 1，说明它在 Cache 中被改过、和主存不一致，必须先把整块写回主存，才能被覆盖。", on: ["CACHE", "MEM"], go: ["c_m"], set: { MEM: { rows: mrows(null, "已更新（写回）"), hi: 2 } }, kv: { "访问主存次数": "1" }, tip: "脏位为 0 的行与主存一致，直接覆盖即可，不用写回。" });
            S.push({ t: "从主存调入新块", d: "把主存中 Tag 1A·组 1 这一整块（64B）读入行 0，置 V = 1、D = 0、Tag = 1A。", on: ["MEM", "CACHE"], go: ["m_c"], set: { MEM: { hi: 1 }, CACHE: { rows: crows(["组1·行0", "1", D("0"), "1A", "块 1A·1"]), hi: 3, bad: -1 }, REP: { v: "" } }, kv: { "访问主存次数": "2" } });
          };
          if (mode === "rh") {
            S.push({ t: "按块内地址取数据送 CPU", d: "用块内地址 3C 从行 0 的数据块中选出所要的字，经数据通路送 CPU。整个过程不访问主存。", on: ["CACHE", "CPU"], go: ["c_cpu"], set: { CPU: { v: "得到数据" } }, kv: { "访问主存次数": "0" } });
            S.push({ t: "小结：读命中", d: "读命中只访问 Cache，速度最快。命中率越高，平均访问时间越接近 Cache 的存取时间。", kv: { "访问主存次数": "0" }, tip: "平均访问时间 = H × tc + (1 − H) × (tc + tm)（先查 Cache 再访存）；或 H × tc + (1 − H) × tm（同时访问）。" });
          } else if (mode === "rm") {
            repl();
            S.push({ t: "把所需的字送 CPU", d: "块装入后按块内地址 3C 取出数据送 CPU。也可以在调块的同时把所需的字直接送 CPU（读直达），减少等待。", on: ["CACHE", "CPU"], go: ["c_cpu"], set: { CPU: { v: "得到数据" } } });
            S.push({ t: "小结：读缺失", d: "这次读缺失共访问主存 2 次：写回脏块 1 次 + 调入新块 1 次。若被替换行不脏，只需调块 1 次。", kv: { "访问主存次数": "2" }, tip: "读缺失必然调块（以块为单位），这是利用空间局部性：同一块里的其他字很快也会被访问。" });
          } else if (mode === "wbk") {
            S.push({ t: "写回法：只写 Cache，置脏位", d: "把数据写入行 0 的对应位置，同时把该行的脏位 D 置 1。本次写操作不访问主存。", on: ["CPU", "CACHE"], go: ["cpu_c"], set: { CACHE: { rows: crows(["组1·行0", "1", "1", "1A", "块 1A·1（已改）"]), hi: 3 } }, kv: { "访问主存次数": "0", "D 位": "0 → 1" }, tip: "写回法必须给每行配一个脏位（修改位），记录这一行是否被改过。" });
            S.push({ t: "此时主存是旧数据", d: "主存中的这一块还是旧值，Cache 与主存暂时不一致。只要以后访问都先查 Cache，CPU 读到的就是新值。", on: ["MEM", "CACHE"], set: { MEM: { bad: 1 } } });
            S.push({ t: "以后被替换时才写回", d: "等到行 0 因缺失被替换时，发现 D = 1，才把整块写回主存。同一块被多次写，也只写回 1 次。", on: ["CACHE", "MEM"], go: ["c_m"], set: { MEM: { rows: mrows("新值（替换时写回）"), bad: -1, hi: 1 } }, kv: { "日后写回": "被替换时 1 次" } });
            S.push({ t: "小结：写命中 · 写回法", d: "写命中时只写 Cache，大大减少了访存次数；代价是要维护脏位，并且存在一段时间的不一致。", kv: { "访问主存次数": "0" }, tip: "写回法减少访存次数但要维护脏位；全写法保证一致性但写操作频繁访存。" });
          } else if (mode === "wth") {
            S.push({ t: "全写法：先写 Cache", d: "把数据写入行 0。全写法（写直达）下 Cache 与主存始终保持一致，所以行里不需要脏位。", on: ["CPU", "CACHE"], go: ["cpu_c"], set: { CACHE: { rows: crows(["组1·行0", "1", "—", "1A", "块 1A·1（已改）"]), hi: 3 } } });
            S.push({ t: "同时写入写缓冲", d: "数据同时写进写缓冲（一个小的 FIFO 队列）。写缓冲比主存快得多，CPU 写完缓冲就继续执行，不必等主存。", on: ["CACHE", "WB"], go: ["c_wb"], set: { WB: { v: "1A7C ← 新值" } }, tip: "写缓冲满时 CPU 仍要停下来等待，写操作频繁时会发生“写缓冲饱和”。" });
            S.push({ t: "写缓冲把数据写入主存", d: "由存储控制电路在后台把写缓冲中的内容依次写入主存，写完后清空。", on: ["WB", "MEM"], go: ["wb_m"], set: { WB: { v: "空" }, MEM: { rows: mrows("新值"), hi: 1 } }, kv: { "访问主存次数": "1" } });
            S.push({ t: "小结：写命中 · 全写法", d: "每次写都要写主存（经写缓冲），Cache 与主存始终一致，替换时不用写回。", kv: { "访问主存次数": "1" }, tip: "全写法：Cache 行无脏位，替换时直接覆盖；写回法：有脏位，脏行替换时才写回。" });
          } else if (mode === "wal") {
            repl();
            S.push({ t: "在 Cache 中写入并置脏位", d: "块已调入，再按写命中处理：写入行 0，置 D = 1。之后对同一块的写都在 Cache 中完成。", on: ["CPU", "CACHE"], go: ["cpu_c"], set: { CACHE: { rows: crows(["组1·行0", "1", "1", "1A", "块 1A·1（已改）"]), hi: 3 } }, kv: { "D 位": "0 → 1" } });
            S.push({ t: "小结：写缺失 · 写分配法", d: "写分配法先把块调入 Cache 再写，本次访问主存 2 次（写回脏块 + 调块）。它利用了空间局部性，通常与写回法搭配。", kv: { "访问主存次数": "2" }, tip: "写分配 ↔ 写回法；非写分配 ↔ 全写法。这是最常见的两种搭配。" });
          } else {
            S.push({ t: "非写分配法：直接写主存", d: "不调块，直接把数据写入主存。", on: ["CPU", "MEM"], go: ["cpu_m"], set: { MEM: { rows: mrows("新值"), hi: 1 } }, kv: { "访问主存次数": "1" } });
            S.push({ t: "Cache 内容不变", d: "第 1 组仍是 Tag 07 和 3B 两行，没有发生替换。下次再读这个块仍然会缺失。", on: ["CACHE"], set: { CACHE: { hi: [3, 4] } } });
            S.push({ t: "小结：写缺失 · 非写分配法", d: "只写主存、不调块，本次访问主存 1 次。它通常与全写法搭配：反正每次写都要写主存，没必要把块调进来。", kv: { "访问主存次数": "1" }, tip: "非写分配法只在读缺失时调块；写分配法读、写缺失都调块。" });
          }
          return { w: 960, h: 440, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "cachewrite", name: "Cache 读写流程", sub: "co",
          lead: "同一个地址 0x1A7C，分别走读命中、读缺失（含替换与脏块写回）、写命中的两种策略和写缺失的两种策略。",
          note: ["命中：有效位 V = 1 且标记相等；组相联只在组内比较、组内替换。", "读缺失要调块；组满按替换算法选行，脏位为 1 的行先写回主存。", "写命中：全写法同时写 Cache 和主存（常配写缓冲），不需要脏位；写回法只写 Cache 并置脏位，替换时才写回。", "写缺失：写分配法先调块再写，常配写回法；非写分配法直接写主存，常配全写法。", "写回法减少访存次数但要维护脏位，全写法保证一致性但写操作频繁访存。"],
          modes: [
            { name: "读命中", make: function () { return cacheFlow("rh"); } },
            { name: "读缺失", make: function () { return cacheFlow("rm"); } },
            { name: "写命中·写回法", make: function () { return cacheFlow("wbk"); } },
            { name: "写命中·全写法", make: function () { return cacheFlow("wth"); } },
            { name: "写缺失·写分配", make: function () { return cacheFlow("wal"); } },
            { name: "写缺失·非写分配", make: function () { return cacheFlow("wna"); } }
          ]
        });

        /* ===================== 文件的打开与读取 ===================== */
        function fileFlow(mode) {
          var PH = ["fd", "→ 系统表项", "读写指针", "权限"];
          var pft = function (r3) { return [PH, ["0", "终端（stdin）", "—", "r"], ["1", "终端（stdout）", "—", "w"], ["2", "终端（stderr）", "—", "w"], r3 || ["3", "空", "", ""]]; };
          var SH = ["项", "内存中的索引结点", "打开计数"];
          var sft = function (r1) { return [SH, ["0", "inode 9（/etc/passwd）", "2"], r1 || ["1", "空", ""]]; };
          var CALL = { open: "open(\"/home/a.txt\")", read: "read(3, buf, 500)", close: "close(3)" }[mode];
          var opened = mode !== "open";
          var nodes = [
            { id: "zu", k: "zone", x: 20, y: 20, w: 190, h: 560, t: "用户进程 P" },
            { id: "zk", k: "zone", x: 240, y: 20, w: 420, h: 560, t: "内核（内存）" },
            { id: "zd", k: "zone", x: 690, y: 20, w: 270, h: 560, t: "磁盘" },
            { id: "CALL", k: "box", x: 35, y: 56, w: 160, h: 56, t: CALL, sm: 1 },
            { id: "FD", k: "reg", x: 35, y: 191, w: 160, h: 50, t: "文件描述符 fd", v: opened ? "3" : "—" },
            { id: "BUF", k: "box", x: 35, y: 490, w: 160, h: 56, t: "用户缓冲区 buf", v: "—" },
            { id: "NAMEI", k: "box", x: 270, y: 56, w: 380, h: 56, t: "文件系统：按路径逐级检索目录", sm: 1 },
            { id: "PFT", k: "table", x: 270, y: 150, w: 380, h: 132, rh: 20, t: "进程 P 的打开文件表", cols: [0.12, 0.36, 0.26], rows: pft(opened ? ["3", "→ 系统表项 1", mode === "read" ? "1500" : "2000", "r"] : null) },
            { id: "SFT", k: "table", x: 270, y: 330, w: 380, h: 112, rh: 20, t: "系统打开文件表", cols: [0.14, 0.6], rows: sft(opened ? ["1", "inode 47（a.txt）", mode === "close" ? "2" : "1"] : null) },
            { id: "ADDR", k: "box", x: 270, y: 490, w: 180, h: 56, t: "逻辑块号 → 物理块号", v: "—" },
            { id: "CACHE", k: "box", x: 520, y: 490, w: 130, h: 56, t: "磁盘高速缓存", v: "—" },
            { id: "ROOT", k: "table", x: 710, y: 56, w: 230, h: 92, rh: 20, t: "根目录文件（inode 2）", cols: [0.5], rows: [["bin", "inode 5"], ["home", "inode 12"], ["etc", "inode 9"]] },
            { id: "HOME", k: "table", x: 710, y: 196, w: 230, h: 92, rh: 20, t: "home 目录文件（inode 12）", cols: [0.5], rows: [["b.c", "inode 30"], ["a.txt", "inode 47"], ["docs", "inode 51"]] },
            { id: "INODE", k: "table", x: 710, y: 336, w: 230, h: 112, rh: 20, t: "a.txt 的索引结点（47）", cols: [0.46], rows: [["文件长度", "3000 B"], ["i_addr[0]", "块 210"], ["i_addr[1]", "块 377"], ["i_addr[2]", "块 512"]] },
            { id: "DATA", k: "box", x: 710, y: 490, w: 230, h: 56, t: "磁盘块 377", v: "a.txt 第 1 块" }
          ];
          var edges = [
            { id: "call_n", a: "CALL", b: "NAMEI", t: "陷入" },
            { id: "n_root", a: "NAMEI", as: "r", ao: 18, b: "ROOT", bs: "l", t: "读目录" },
            { id: "root_home", a: "ROOT", as: "b", b: "HOME", bs: "t", t: "home → 12" },
            { id: "home_ino", a: "HOME", as: "b", b: "INODE", bs: "t", t: "a.txt → 47" },
            { id: "ino_sft", a: "INODE", as: "l", ao: -6, b: "SFT", bs: "r", t: "读入" },
            { id: "sft_ino", a: "SFT", as: "r", ao: 30, b: "INODE", bs: "l", bo: 24, t: "写回" },
            { id: "sft_pft", a: "SFT", as: "t", ao: -60, b: "PFT", bs: "b", bo: -60, t: "建表项" },
            { id: "pft_sft", a: "PFT", as: "b", ao: 60, b: "SFT", bs: "t", bo: 60, t: "找表项" },
            { id: "pft_fd", a: "PFT", as: "l", ao: -12, b: "FD", bs: "r", bo: -12, t: "返回 fd" },
            { id: "fd_pft", a: "FD", as: "r", ao: 12, b: "PFT", bs: "l", bo: 12, t: "查表" },
            { id: "call_fd", a: "CALL", as: "b", b: "FD", bs: "t", t: "fd = 3" },
            { id: "sft_addr", a: "SFT", as: "b", ao: -100, b: "ADDR", bs: "t", t: "i_addr" },
            { id: "addr_cache", a: "ADDR", b: "CACHE", t: "块 377" },
            { id: "data_c", a: "DATA", as: "l", b: "CACHE", bs: "r", t: "读盘" },
            { id: "c_buf", a: "CACHE", as: "b", b: "BUF", bs: "b", pts: [[585, 568], [115, 568]], t: "复制到用户区", lp: [330, 568] }
          ];
          var S = [];
          if (mode === "open") {
            S.push({ t: "进程调用 open", d: "进程 P 以只读方式打开 /home/a.txt。open 只做“找到文件、建立联系”，并不读文件内容。", on: ["CALL"], kv: { "读盘次数": "0", "打开计数": "—" } });
            S.push({ t: "陷入内核，解析路径", d: "通过系统调用进入核心态，文件系统把路径按“/”拆成 home、a.txt，从根目录开始逐级检索。", on: ["CALL", "NAMEI"], go: ["call_n"] });
            S.push({ t: "查根目录：找到 home", d: "根目录的索引结点（inode 2）常驻内存。按它读入根目录文件，顺序比较目录项的文件名，查到 home 的索引结点号 12。", on: ["NAMEI", "ROOT"], go: ["n_root"], set: { ROOT: { hi: 1 } }, kv: { "读盘次数": "1" } });
            S.push({ t: "查 home 目录：找到 a.txt", d: "读入 inode 12 及其指向的 home 目录文件，查到 a.txt 的索引结点号 47。", on: ["ROOT", "HOME"], go: ["root_home"], set: { HOME: { hi: 1 } }, kv: { "读盘次数": "2" }, tip: "检索目录时只需要文件名和索引结点号，所以 UNIX 把目录项精简为“文件名 + inode 号”，一个盘块能放更多目录项。" });
            S.push({ t: "找到 a.txt 的索引结点", d: "按 inode 号 47 定位到磁盘上 a.txt 的索引结点（FCB 中除文件名外的信息）。", on: ["HOME", "INODE"], go: ["home_ino"], kv: { "读盘次数": "3" } });
            S.push({ t: "索引结点读入系统打开文件表", d: "把 inode 47 读入内存，在系统打开文件表中新建表项 1，打开计数置 1。若别的进程已打开该文件，就不再重复读入，只把计数加 1。", on: ["INODE", "SFT"], go: ["ino_sft"], set: { SFT: { rows: sft(["1", "inode 47（a.txt）", "1"]), hi: 2 } }, kv: { "打开计数": "1" }, tip: "系统打开文件表整个系统只有一张，同一文件只占一个表项，用打开计数记录有几个进程在用它。" });
            S.push({ t: "在进程打开文件表中建表项", d: "在 P 自己的打开文件表中找一个空项（fd 3），让它指向系统表项 1，并记录读写指针 0 和访问权限“只读”。", on: ["SFT", "PFT"], go: ["sft_pft"], set: { PFT: { rows: pft(["3", "→ 系统表项 1", "0", "r"]), hi: 4 }, SFT: { hi: -1 } } });
            S.push({ t: "返回文件描述符 fd = 3", d: "open 返回进程打开文件表的下标 3，这就是文件描述符。以后 read、write、close 都只用 fd，不再给出路径。", on: ["PFT", "FD"], go: ["pft_fd"], set: { FD: { v: "3" } }, tip: "open 之后读写文件不再需要查目录，所以打开文件能减少检索目录的次数。" });
          } else if (mode === "read") {
            S.push({ t: "进程调用 read(3, buf, 500)", d: "文件已打开，fd = 3，当前读写指针为 1500。要从这里读 500 字节到 buf。盘块大小 1KB。", on: ["CALL", "FD"], kv: { "读盘次数": "0", "读写指针": "1500" } });
            S.push({ t: "用 fd 查进程打开文件表", d: "以 fd 3 为下标查 P 的打开文件表，检查访问权限（只读，允许读），取出读写指针 1500 和指向系统表项的指针。", on: ["FD", "PFT"], go: ["call_fd", "fd_pft"], set: { PFT: { hi: 4 } } });
            S.push({ t: "找到系统打开文件表中的 inode", d: "顺着指针找到系统打开文件表项 1，里面就是已在内存中的 a.txt 的索引结点。整个过程不查目录。", on: ["PFT", "SFT"], go: ["pft_sft"], set: { SFT: { hi: 2 } }, tip: "读写指针放在进程打开文件表里：不同进程打开同一文件，各有各的读写位置。" });
            S.push({ t: "读写指针 → 逻辑块号", d: "逻辑块号 = ⌊1500 / 1024⌋ = 1，块内偏移 = 1500 mod 1024 = 476。读 500 字节到 1999 为止，仍在第 1 块内。", on: ["ADDR"], set: { ADDR: { v: "逻辑块 1 · 偏移 476" } }, kv: { "逻辑块号": "1", "块内偏移": "476" } });
            S.push({ t: "逻辑块号 → 物理块号", d: "查内存中索引结点的地址项 i_addr[1]，得到物理块号 377。", on: ["SFT", "ADDR"], go: ["sft_addr"], set: { ADDR: { v: "物理块 377" }, INODE: { hi: 2 } }, kv: { "物理块号": "377" } });
            S.push({ t: "先查磁盘高速缓存", d: "内存中的磁盘高速缓存保存最近用过的盘块。这里没有块 377，需要读盘。", on: ["ADDR", "CACHE"], go: ["addr_cache"], set: { CACHE: { v: "未命中", badge: "miss" } }, tip: "磁盘高速缓存在逻辑上属于磁盘，物理上是驻留在内存中的盘块缓冲区。" });
            S.push({ t: "读盘：块 377 读入缓存", d: "启动磁盘 I/O，把块 377 读入磁盘高速缓存（缓冲区）。进程在等待期间阻塞。", on: ["DATA", "CACHE"], go: ["data_c"], set: { CACHE: { v: "块 377", badge: "" } }, kv: { "读盘次数": "1" } });
            S.push({ t: "复制到用户缓冲区", d: "把缓冲区中偏移 476 起的 500 字节复制到用户区 buf，read 返回实际读到的字节数 500。", on: ["CACHE", "BUF"], go: ["c_buf"], set: { BUF: { v: "500 B" } } });
            S.push({ t: "移动读写指针", d: "进程打开文件表中的读写指针加 500，变为 2000，下次 read 从这里继续。", on: ["PFT"], set: { PFT: { rows: pft(["3", "→ 系统表项 1", "2000", "r"]), hi: 4 }, SFT: { hi: -1 } }, kv: { "读写指针": "2000" }, tip: "读文件的链条：fd → 进程打开文件表 → 系统打开文件表 → 索引结点 → 物理块。" });
          } else {
            S.push({ t: "进程调用 close(3)", d: "P 用完 a.txt，关闭 fd 3。此时另一个进程 Q 也打开着 a.txt，所以系统表项的打开计数是 2。", on: ["CALL", "FD"], kv: { "打开计数": "2", "写盘次数": "0" } });
            S.push({ t: "用 fd 找到进程打开文件表项", d: "以 fd 3 为下标找到 P 的表项，从中得到它指向的系统打开文件表项 1。", on: ["FD", "PFT"], go: ["call_fd", "fd_pft"], set: { PFT: { hi: 4 } } });
            S.push({ t: "释放进程打开文件表项", d: "清空 P 的表项 3，fd 3 失效，以后可以被 P 再次打开的文件复用。", on: ["PFT", "FD"], set: { PFT: { rows: pft(), hi: 4 }, FD: { v: "已失效" } } });
            S.push({ t: "系统表项打开计数减 1", d: "系统打开文件表项 1 的打开计数 2 → 1。计数不为 0，说明还有进程（Q）在用，表项和内存 inode 都保留。", on: ["PFT", "SFT"], go: ["pft_sft"], set: { SFT: { rows: sft(["1", "inode 47（a.txt）", "1"]), hi: 2 }, PFT: { hi: -1 } }, kv: { "打开计数": "1" }, tip: "close 一定会让打开计数减 1，但只有减到 0 才删除系统打开文件表项。" });
            S.push({ t: "Q 也关闭：计数减为 0", d: "进程 Q 随后执行 close，同样释放自己的表项，系统表项的打开计数 1 → 0。", on: ["SFT"], set: { SFT: { rows: sft(["1", "inode 47（a.txt）", "0"]), hi: 2 } }, kv: { "打开计数": "0" } });
            S.push({ t: "写回 inode，删除系统表项", d: "若内存中的索引结点被修改过（如文件长度、修改时间），先写回磁盘；然后删除系统打开文件表项 1。", on: ["SFT", "INODE"], go: ["sft_ino"], set: { SFT: { rows: sft(), hi: -1 } }, kv: { "写盘次数": "1" } });
            S.push({ t: "小结", d: "close 与 open 相反：先释放进程打开文件表项，再把系统打开文件表项的计数减 1，减到 0 时写回并释放。", tip: "close 不删除文件，也不修改目录；删除文件是另一个操作。" });
          }
          return { w: 980, h: 600, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "fileopen", name: "文件的打开与读取", sub: "os",
          lead: "open 按路径逐级查目录、建立两张打开文件表的表项并返回 fd；read 只凭 fd 找到索引结点和物理块；close 让打开计数减 1。",
          note: ["open：逐级检索目录 → inode 读入系统打开文件表 → 进程打开文件表建项 → 返回 fd。", "系统打开文件表全系统一张，含打开计数；进程打开文件表每进程一张，含读写指针和访问权限。", "打开后读写只用 fd，不再查目录，减少了检索目录的次数。", "read：读写指针 → 逻辑块号 → 索引结点地址项 → 物理块号 → 磁盘高速缓存 / 读盘 → 复制到用户区。", "close：释放进程表项，打开计数减 1，减到 0 才写回 inode 并删除系统表项。"],
          modes: [
            { name: "open 打开", make: function () { return fileFlow("open"); } },
            { name: "read 读取", make: function () { return fileFlow("read"); } },
            { name: "close 关闭", make: function () { return fileFlow("close"); } }
          ]
        });

        /* ===================== SPOOLing 假脱机 ===================== */
        PROC.push({
          id: "spooling", name: "SPOOLing 假脱机技术", sub: "os", toc: "SPOOLing",
          lead: "进程 A、B、C 先后请求打印：数据先进磁盘上的输出井、请求表挂上队列，输出进程再按队列逐个送打印机。",
          note: ["SPOOLing 把独占设备改造成共享设备（虚拟设备），是以空间换时间的技术。", "组成：磁盘上的输入井 / 输出井，内存中的输入缓冲区 / 输出缓冲区，常驻的输入进程 / 输出进程。", "输入进程、输出进程模拟脱机输入输出时的外围控制机。", "共享打印机：为每个请求在输出井中申请区域、建立打印请求表并排入队列，并不是真正把打印机分给进程。", "必须有高速大容量的磁盘作为井；它缓和了 CPU 与慢速 I/O 设备的速度矛盾。"],
          modes: [{
            name: "共享打印机",
            make: function () {
              var QH = ["请求表", "进程", "井中位置", "长度"];
              var queue = function (list) { return list.length ? [QH].concat(list) : [QH, ["（空）"]]; };
              var RA = ["表 1", "A", "区域 1", "2 页"], RB = ["表 2", "B", "区域 2", "5 页"], RC = ["表 3", "C", "区域 3", "1 页"];
              var well = function (a, b, c) { return [["区域 1", a || "空闲"], ["区域 2", b || "空闲"], ["区域 3", c || "空闲"]]; };
              var nodes = [
                { id: "zm", k: "zone", x: 15, y: 20, w: 625, h: 480, t: "内存" },
                { id: "zdk", k: "zone", x: 660, y: 20, w: 300, h: 270, t: "磁盘" },
                { id: "zp", k: "zone", x: 660, y: 310, w: 300, h: 190, t: "外设" },
                { id: "A", k: "box", x: 30, y: 70, w: 130, h: 46, t: "进程 A", v: "运行" },
                { id: "B", k: "box", x: 30, y: 140, w: 130, h: 46, t: "进程 B", v: "运行" },
                { id: "C", k: "box", x: 30, y: 210, w: 130, h: 46, t: "进程 C", v: "运行" },
                { id: "OUTP", k: "box", x: 230, y: 100, w: 150, h: 70, t: "输出进程", v: "常驻" },
                { id: "OBUF", k: "box", x: 450, y: 100, w: 150, h: 70, t: "输出缓冲区", v: "空" },
                { id: "QUEUE", k: "table", x: 230, y: 280, w: 300, h: 112, rh: 20, t: "打印请求队列", cols: [0.22, 0.24, 0.28], rows: queue([]) },
                { id: "IPROC", k: "box", x: 30, y: 420, w: 150, h: 56, t: "输入进程", v: "常驻" },
                { id: "WELL", k: "table", x: 680, y: 70, w: 260, h: 92, rh: 20, t: "输出井", cols: [0.3], rows: well() },
                { id: "INW", k: "box", x: 680, y: 200, w: 260, h: 56, t: "输入井", v: "暂存输入设备送来的数据" },
                { id: "PR", k: "box", x: 700, y: 380, w: 220, h: 70, t: "打印机（独占设备）", v: "空闲" }
              ];
              var edges = [
                { id: "a_o", a: "A", b: "OUTP", bo: -20, mx: 195 },
                { id: "b_o", a: "B", b: "OUTP", bo: 0, mx: 195 },
                { id: "c_o", a: "C", b: "OUTP", bo: 20, mx: 195 },
                { id: "o_b", a: "OUTP", b: "OBUF", t: "送缓冲" },
                { id: "b_w", a: "OBUF", as: "r", ao: -14, b: "WELL", bs: "l", bo: 5, t: "写入井" },
                { id: "w_b", a: "WELL", as: "l", ao: 33, b: "OBUF", bs: "r", bo: 14, t: "读出" },
                { id: "o_q", a: "OUTP", as: "b", ao: -40, b: "QUEUE", bs: "t", bo: -115, t: "挂请求表" },
                { id: "q_o", a: "QUEUE", as: "t", ao: -35, b: "OUTP", bs: "b", bo: 40, t: "取队首" },
                { id: "b_p", a: "OBUF", as: "b", ao: 55, b: "PR", bs: "l", t: "送打印机" }
              ];
              var S = [
                { t: "独占的打印机", d: "打印机是独占设备，一次只能给一个进程用。SPOOLing 在系统中常驻输入进程和输出进程，模拟脱机输入输出时的外围控制机，并在磁盘上开辟输入井和输出井。", on: ["OUTP", "IPROC", "WELL", "INW"], kv: { "请求数": "0", "打印机": "空闲" } },
                { t: "进程 A 请求打印", d: "A 调用打印输出，请求并不交给打印机，而是交给 SPOOLing 系统的输出进程。", on: ["A", "OUTP"], go: ["a_o"], set: { A: { v: "请求打印" } } },
                { t: "A 的数据送入输出缓冲区", d: "输出进程把 A 要打印的数据从 A 的内存区送入输出缓冲区。", on: ["OUTP", "OBUF"], go: ["o_b"], set: { OBUF: { v: "A 的数据" } } },
                { t: "写入输出井", d: "系统在磁盘输出井中为 A 申请一块空闲区域（区域 1），把输出缓冲区的数据写进去。", on: ["OBUF", "WELL"], go: ["b_w"], set: { WELL: { rows: well("A 的数据（2 页）"), hi: 0 }, OBUF: { v: "空" } } },
                { t: "填写打印请求表，挂入队列", d: "输出进程为 A 填一张打印请求表（用户、数据在井中的位置、长度），挂到打印请求队列上。A 的“打印”到此完成，立即继续运行。", on: ["OUTP", "QUEUE", "A"], go: ["o_q"], set: { QUEUE: { rows: queue([RA]), hi: 1 }, A: { v: "继续运行" }, WELL: { hi: -1 } }, kv: { "请求数": "1" }, tip: "进程不必等待打印机：输出到磁盘的速度远快于打印机，这就是“以空间换时间”。" },
                { t: "进程 B、C 也请求打印", d: "B、C 同样经输出缓冲区写入输出井的区域 2、3，各填一张请求表排在队尾。三个进程都以为自己独占了一台打印机。", on: ["B", "C", "OUTP", "WELL", "QUEUE"], go: ["b_o", "c_o"], set: { B: { v: "继续运行" }, C: { v: "继续运行" }, WELL: { rows: well("A 的数据（2 页）", "B 的数据（5 页）", "C 的数据（1 页）"), hi: [1, 2] }, QUEUE: { rows: queue([RA, RB, RC]), hi: [2, 3] } }, kv: { "请求数": "3" } },
                { t: "打印机空闲：取队首请求表", d: "打印机空闲时，输出进程从打印请求队列队首取出表 1（进程 A）。", on: ["QUEUE", "OUTP"], go: ["q_o"], set: { QUEUE: { hi: 1 }, WELL: { hi: -1 }, PR: { v: "准备打印 A" } } },
                { t: "从输出井读出 A 的数据", d: "按请求表记录的位置，把输出井区域 1 中的数据读入输出缓冲区。", on: ["WELL", "OBUF"], go: ["w_b"], set: { WELL: { hi: 0 }, OBUF: { v: "A 的数据" } } },
                { t: "送打印机打印", d: "输出缓冲区的数据送打印机打印。A 的任务完成后，删除表 1，释放输出井区域 1。", on: ["OBUF", "PR"], go: ["b_p"], set: { PR: { v: "打印 A" }, QUEUE: { rows: queue([RB, RC]), hi: -1 }, WELL: { rows: well(null, "B 的数据（5 页）", "C 的数据（1 页）"), hi: -1 } }, kv: { "请求数": "2", "打印机": "忙" } },
                { t: "依次打印 B、C", d: "输出进程按队列顺序重复“取请求表 → 读输出井 → 送打印机”，直到队列为空，打印机重新空闲。", on: ["QUEUE", "WELL", "OBUF", "PR"], go: ["q_o", "w_b", "b_p"], set: { QUEUE: { rows: queue([]) }, WELL: { rows: well() }, OBUF: { v: "空" }, PR: { v: "空闲" } }, kv: { "请求数": "0", "打印机": "空闲" } },
                { t: "小结：独占设备变共享设备", d: "物理上只有一台打印机，逻辑上每个进程都像拥有一台（虚拟设备）。输入一侧同理：输入进程把输入设备的数据先送进输入井，进程需要时再从输入井读取。", on: ["PR", "IPROC", "INW"], tip: "SPOOLing 把独占设备改造成共享设备，提高了 I/O 速度，需要磁盘作为输入井和输出井，是以空间换时间的技术。" }
              ];
              return { w: 980, h: 520, nodes: nodes, edges: edges, steps: S };
            }
          }]
        });
      })();
