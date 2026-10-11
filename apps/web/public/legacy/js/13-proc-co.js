      /* 过程图解 · 组成原理流程：指令周期数据流、微程序控制器、TLB 访存、TLB+Cache 地址转换、中断服务、DMA */
      (function () {
        var PROC = window.PROC = window.PROC || [], U = window.PROCU;

        /* ===================== 指令周期的数据流 ===================== */
        function cpuNodes() {
          return [
            { id: "zc", k: "zone", x: 20, y: 24, w: 400, h: 400, t: "CPU" },
            { id: "zb", k: "zone", x: 440, y: 24, w: 170, h: 300, t: "系统总线" },
            { id: "zm", k: "zone", x: 630, y: 24, w: 230, h: 340, t: "主存 M" },
            { id: "PC", k: "reg", x: 50, y: 60, w: 120, h: 46, t: "PC", v: "1000" },
            { id: "IR", k: "reg", x: 50, y: 160, w: 120, h: 46, t: "IR", v: "—" },
            { id: "CU", k: "box", x: 50, y: 255, w: 120, h: 56, t: "CU", v: "控制器" },
            { id: "ALU", k: "reg", x: 50, y: 356, w: 120, h: 50, t: "ALU / ACC", v: "ACC=0003" },
            { id: "MAR", k: "reg", x: 270, y: 60, w: 120, h: 46, t: "MAR", v: "—" },
            { id: "MDR", k: "reg", x: 270, y: 160, w: 120, h: 46, t: "MDR", v: "—" },
            { id: "SP", k: "reg", x: 270, y: 360, w: 120, h: 46, t: "SP", v: "8000" },
            { id: "AB", k: "box", x: 465, y: 60, w: 120, h: 46, t: "地址总线 AB", sm: 1 },
            { id: "DB", k: "box", x: 465, y: 160, w: 120, h: 46, t: "数据总线 DB", sm: 1 },
            { id: "CB", k: "box", x: 465, y: 260, w: 120, h: 46, t: "控制总线 CB", sm: 1 },
            { id: "M", k: "table", x: 655, y: 60, w: 185, h: 290, rh: 28, t: "地址 · 内容", cols: [0.36],
              rows: [["1000", "ADD @2000"], ["1001", "下一条指令"], ["2000", "3000"], ["3000", "0005"], ["7FFF", "—"], ["0040", "5000（向量）"], ["5000", "中断服务程序"]] }
          ];
        }
        function cpuEdges() {
          return [
            { id: "pc_mar", a: "PC", b: "MAR", t: "(PC)→MAR" },
            { id: "mar_ab", a: "MAR", b: "AB", t: "地址" },
            { id: "ab_m", a: "AB", b: "M", bo: -122 },
            { id: "cu_cb", a: "CU", b: "CB", t: "读 / 写命令" },
            { id: "cb_m", a: "CB", b: "M", bo: 78 },
            { id: "m_db", a: "M", as: "l", ao: -27, b: "DB", bs: "r", bo: -6 },
            { id: "db_m", a: "DB", as: "r", ao: 8, b: "M", bs: "l", bo: -13 },
            { id: "db_mdr", a: "DB", as: "l", ao: -6, b: "MDR", bs: "r", bo: -6, t: "数据" },
            { id: "mdr_db", a: "MDR", as: "r", ao: 8, b: "DB", bs: "l", bo: 8 },
            { id: "mdr_ir", a: "MDR", as: "l", ao: -8, b: "IR", bs: "r", bo: -8, t: "(MDR)→IR" },
            { id: "ir_cu", a: "IR", as: "b", b: "CU", bs: "t", t: "OP(IR)" },
            { id: "cu_pc", a: "CU", as: "l", b: "PC", bs: "l", pts: [[32, 283], [32, 83]] },
            { id: "ir_mar", a: "IR", as: "t", ao: 30, b: "MAR", bs: "b", pts: [[140, 130], [330, 130]], t: "Ad(IR)→MAR", lp: [235, 130] },
            { id: "sp_mar", a: "SP", as: "r", b: "MAR", bs: "r", bo: 14, pts: [[412, 383], [412, 97]], t: "(SP)→MAR", lp: [412, 330] },
            { id: "pc_mdr", a: "PC", as: "r", ao: 14, b: "MDR", bs: "l", bo: 12, pts: [[215, 97], [215, 195]], t: "(PC)→MDR", lp: [215, 150] },
            { id: "mdr_alu", a: "MDR", as: "b", b: "ALU", bs: "t", pts: [[330, 334], [110, 334]], t: "(MDR)→ALU" }
          ];
        }
        function memHi(i) { return { M: { hi: i } }; }
        var IC = {
          fetch: [
            { t: "取指周期开始", d: "PC 中存放当前要执行的指令地址 1000。取指周期要把这条指令从主存取到 IR，并让 PC 指向下一条指令。", set: { PC: { v: "1000" } }, kv: { "访存次数": "0" } },
            { t: "(PC) → MAR", d: "把 PC 的内容送入存储器地址寄存器 MAR，准备访问主存。", on: ["PC", "MAR"], go: ["pc_mar"], set: { MAR: { v: "1000" } } },
            { t: "MAR → 地址总线 → 主存", d: "MAR 中的地址经地址总线送到主存，选中 1000 号单元。", on: ["MAR", "AB", "M"], go: ["mar_ab", "ab_m"], set: memHi(0) },
            { t: "CU 发读命令：1 → R", d: "控制器经控制总线向主存发“读”命令。", on: ["CU", "CB", "M"], go: ["cu_cb", "cb_m"] },
            { t: "M(MAR) → MDR", d: "主存把 1000 号单元的内容（指令 ADD @2000）经数据总线送入存储器数据寄存器 MDR。", on: ["M", "DB", "MDR"], go: ["m_db", "db_mdr"], set: { MDR: { v: "ADD @2000" } }, kv: { "访存次数": "1" } },
            { t: "(MDR) → IR", d: "MDR 中的指令送入指令寄存器 IR。", on: ["MDR", "IR"], go: ["mdr_ir"], set: { IR: { v: "ADD @2000" } } },
            { t: "OP(IR) → CU", d: "IR 的操作码字段送控制器 CU 译码，CU 据此决定后面进入间址周期还是执行周期（这里是间接寻址 @，下一步进入间址周期）。", on: ["IR", "CU"], go: ["ir_cu"] },
            { t: "(PC) + 1 → PC", d: "CU 控制 PC 自增，指向下一条指令 1001。", on: ["CU", "PC"], go: ["cu_pc"], set: { PC: { v: "1001" } }, tip: "(PC)+1→PC 不占用总线，可以和 M(MAR)→MDR 同时进行；按字节编址时加的是指令字长。" }
          ],
          ind: [
            { t: "间址周期开始", d: "取指完成后 IR = ADD @2000：地址码 2000 不是操作数地址，而是“操作数地址的地址”。间址周期要再访存一次取出有效地址 EA。", set: { PC: { v: "1001" }, IR: { v: "ADD @2000" }, MDR: { v: "ADD @2000" }, MAR: { v: "1000" } }, kv: { "访存次数": "0" } },
            { t: "Ad(IR) → MAR", d: "把 IR 的地址码 2000 送 MAR（也常写作 Ad(MDR)→MAR，两者等价）。", on: ["IR", "MAR"], go: ["ir_mar"], set: { MAR: { v: "2000" } } },
            { t: "地址上总线，1 → R", d: "地址经地址总线送主存，CU 发读命令。", on: ["MAR", "AB", "CU", "CB", "M"], go: ["mar_ab", "ab_m", "cu_cb", "cb_m"], set: memHi(2) },
            { t: "M(MAR) → MDR", d: "主存 2000 号单元的内容 3000 就是有效地址 EA，经数据总线送入 MDR。", on: ["M", "DB", "MDR"], go: ["m_db", "db_mdr"], set: { MDR: { v: "3000" } }, kv: { "访存次数": "1", "有效地址 EA": "3000" } },
            { t: "(MDR) → Ad(IR)", d: "把 EA = 3000 写回 IR 的地址码字段，IR 变成 ADD 3000，执行周期就可以直接用它。", on: ["MDR", "IR"], go: ["mdr_ir"], set: { IR: { v: "ADD 3000" } }, tip: "一次间址多访存一次；多重间址每多一层就多访存一次。" }
          ],
          exe: [
            { t: "执行周期开始", d: "IR = ADD 3000（有效地址已在间址周期取得），ACC = 0003。执行周期要取操作数并完成 (ACC) + (EA) → ACC。", set: { PC: { v: "1001" }, IR: { v: "ADD 3000" }, MDR: { v: "3000" }, MAR: { v: "2000" } }, kv: { "访存次数": "0" } },
            { t: "Ad(IR) → MAR", d: "有效地址 3000 送 MAR。", on: ["IR", "MAR"], go: ["ir_mar"], set: { MAR: { v: "3000" } } },
            { t: "地址上总线，1 → R", d: "访问主存 3000 号单元。", on: ["MAR", "AB", "CU", "CB", "M"], go: ["mar_ab", "ab_m", "cu_cb", "cb_m"], set: memHi(3) },
            { t: "M(MAR) → MDR", d: "操作数 0005 送入 MDR。", on: ["M", "DB", "MDR"], go: ["m_db", "db_mdr"], set: { MDR: { v: "0005" } }, kv: { "访存次数": "1" } },
            { t: "(ACC) + (MDR) → ACC", d: "MDR 中的操作数送 ALU，与 ACC 相加，结果 0008 写回 ACC。", on: ["MDR", "ALU", "CU"], go: ["mdr_alu"], set: { ALU: { v: "ACC=0008" } }, tip: "执行周期因指令而异：转移指令只改 PC，不一定访存；STORE 是写主存（MDR→M）。" }
          ],
          int: [
            { t: "中断周期开始", d: "当前指令执行完，CPU 检测到中断请求且允许中断（EINT=1），进入中断周期。这一段由硬件完成，称为“中断隐指令”。断点是 PC 中的 1001。", set: { PC: { v: "1001" }, IR: { v: "ADD 3000" }, MAR: { v: "3000" }, MDR: { v: "0005" }, ALU: { v: "ACC=0008" }, CU: { badge: "EINT=1" } }, kv: { "访存次数": "0" } },
            { t: "(SP) − 1 → SP，(SP) → MAR", d: "栈指针减 1 得到栈顶地址 7FFF，送 MAR（也有教材把断点存到固定单元，同理）。", on: ["SP", "MAR"], go: ["sp_mar"], set: { SP: { v: "7FFF" }, MAR: { v: "7FFF" } } },
            { t: "1 → W", d: "CU 发写命令，准备把断点写入栈顶。", on: ["CU", "CB", "M"], go: ["cu_cb", "cb_m"] },
            { t: "(PC) → MDR", d: "断点 1001 送 MDR。", on: ["PC", "MDR"], go: ["pc_mdr"], set: { MDR: { v: "1001" } } },
            { t: "MDR → M(MAR)", d: "MDR 中的断点经数据总线写入主存 7FFF 单元，保存断点。", on: ["MDR", "DB", "M"], go: ["mdr_db", "db_m"], set: { M: { hi: 4, rows: [["1000", "ADD @2000"], ["1001", "下一条指令"], ["2000", "3000"], ["3000", "0005"], ["7FFF", "1001（断点）"], ["0040", "5000（向量）"], ["5000", "中断服务程序"]] } }, kv: { "访存次数": "1" } },
            { t: "向量地址 → PC", d: "中断识别后，硬件把中断服务程序入口（由向量地址 0040 得到 5000）送 PC，下一个取指周期就从服务程序开始。", on: ["CU", "PC"], go: ["cu_pc"], set: { PC: { v: "5000" } } },
            { t: "0 → EINT（关中断）", d: "硬件关中断，防止保存现场时被新的中断打断；中断周期结束。", on: ["CU"], set: { CU: { badge: "EINT=0" } }, tip: "中断隐指令 = 关中断 + 保存断点 + 引出中断服务程序，都是硬件完成，不是一条真正的指令。保护现场（通用寄存器）是服务程序里的软件工作。" }
          ]
        };
        function icMode(name, key) { return { name: name, make: function () { return { w: 880, h: 440, nodes: cpuNodes(), edges: cpuEdges(), steps: IC[key] }; } }; }
        PROC.push({
          id: "icycle", name: "指令周期的数据流", sub: "co",
          lead: "单总线结构下，一条间接寻址的 ADD 指令依次经历取指、间址、执行周期；有中断请求时再进入中断周期。",
          note: ["指令周期 = 取指 + 间址 + 执行 + 中断，各周期都由若干机器周期组成。", "取指：(PC)→MAR，1→R，M(MAR)→MDR，(MDR)→IR，OP(IR)→CU，(PC)+1→PC。", "间址：Ad(IR)→MAR，1→R，M(MAR)→MDR，(MDR)→Ad(IR)。", "中断周期：保存断点、向量地址→PC、0→EINT。", "CPU 用 FE、IND、EX、INT 四个触发器区分当前处于哪个周期。"],
          modes: [icMode("取指周期", "fetch"), icMode("间址周期", "ind"), icMode("执行周期", "exe"), icMode("中断周期", "int")]
        });

        /* ===================== 微程序控制器 ===================== */
        var CMROWS = [["00", "PC→MAR, 1→R │ 01"], ["01", "M(MAR)→MDR, PC+1 │ 02"], ["02", "MDR→IR │ 按 OP 转移"], ["…", "…"], ["20", "Ad(IR)→MAR, 1→R │ 21"], ["21", "M(MAR)→MDR │ 22"], ["22", "ACC+MDR→ACC │ 00"], ["…", "其他指令的微程序"]];
        function cmdr(ctl, test, next) { return { segs: [{ t: "微操作控制字段", b: 18, v: ctl, w: 18, on: !!ctl }, { t: "判别测试", b: 3, v: test, w: 7 }, { t: "下址字段", b: 6, v: next, w: 7 }] }; }
        PROC.push({
          id: "micro", name: "微程序控制器的数据流", sub: "co",
          lead: "以一条 ADD 指令为例：先执行公共的取指微程序，再由操作码找到 ADD 的执行微程序，最后回到取指入口。",
          note: ["机器指令 → 微程序（一段）→ 微指令（若干条）→ 微命令 / 微操作（若干个）。", "控制存储器 CM 用 ROM 实现，在 CPU 内部；CMAR 存微地址，CMDR 存微指令。", "微指令格式：水平型（一次多个微操作，速度快、字长长）与垂直型（类似机器指令，字长短、速度慢）。", "下地址形成：下址字段法（断定法）、计数器法；操作码映射到执行微程序入口靠微地址形成部件。", "微程序控制器比硬布线控制器慢，但易修改、易扩展。"],
          modes: [{
            name: "ADD 指令",
            make: function () {
              var nodes = [
                { id: "IR", k: "reg", x: 40, y: 40, w: 170, h: 50, t: "IR（操作码 OP）", v: "—" },
                { id: "FLAG", k: "box", x: 280, y: 40, w: 170, h: 50, t: "状态标志 / 条件", sm: 1 },
                { id: "UAF", k: "box", x: 40, y: 150, w: 170, h: 60, t: "微地址形成部件\n（OP → 入口地址）", sm: 1 },
                { id: "SEQ", k: "box", x: 280, y: 150, w: 170, h: 60, t: "顺序逻辑\n（选下一微地址）", sm: 1 },
                { id: "CMAR", k: "reg", x: 520, y: 155, w: 120, h: 50, t: "CMAR", v: "—" },
                { id: "DEC", k: "box", x: 520, y: 255, w: 120, h: 44, t: "地址译码", sm: 1 },
                { id: "CM", k: "table", x: 690, y: 40, w: 230, h: 200, rh: 20, t: "控制存储器 CM", cols: [0.16], rows: CMROWS },
                { id: "CMDR", k: "fields", x: 300, y: 380, w: 520, h: 56, t: "CMDR（微指令寄存器）", segs: cmdr("", "", "").segs },
                { id: "EXE", k: "box", x: 40, y: 380, w: 190, h: 56, t: "执行部件\n（PC、MAR、ALU…）", sm: 1 }
              ];
              var edges = [
                { id: "ir_uaf", a: "IR", as: "b", b: "UAF", bs: "t", t: "OP" },
                { id: "uaf_seq", a: "UAF", b: "SEQ", t: "入口" },
                { id: "flag_seq", a: "FLAG", as: "b", b: "SEQ", bs: "t" },
                { id: "seq_cmar", a: "SEQ", b: "CMAR", t: "微地址" },
                { id: "cmar_dec", a: "CMAR", as: "b", b: "DEC", bs: "t" },
                { id: "dec_cm", a: "DEC", as: "r", b: "CM", bs: "b", pts: [[805, 277]] },
                { id: "cm_cmdr", a: "CM", as: "r", b: "CMDR", bs: "r", pts: [[940, 140], [940, 408]], t: "读出微指令", lp: [880, 330] },
                { id: "cmdr_exe", a: "CMDR", as: "l", b: "EXE", bs: "r", t: "微命令" },
                { id: "cmdr_seq", a: "CMDR", as: "t", ao: 200, b: "SEQ", bs: "b", pts: [[760, 336], [365, 336]], t: "下址", lp: [600, 336] }
              ];
              var S = [
                { t: "微程序控制的思路", d: "每条机器指令对应控存里的一段微程序。CPU 每执行一条机器指令，就是依次从控存读出若干条微指令，每条微指令发出一组微命令。取指操作对所有指令都一样，所以是一段公共的取指微程序，入口地址为 00。" },
                { t: "公共入口 00 → CMAR", d: "上一条指令结束（或开机复位），顺序逻辑给出取指微程序入口地址 00，送入 CMAR。", on: ["SEQ", "CMAR"], go: ["seq_cmar"], set: { CMAR: { v: "00" } } },
                { t: "读控存：CM(CMAR) → CMDR", d: "CMAR 经地址译码选中控存 00 号单元，读出微指令送 CMDR。", on: ["CMAR", "DEC", "CM", "CMDR"], go: ["cmar_dec", "dec_cm", "cm_cmdr"], set: { CM: { hi: 0 }, CMDR: cmdr("PC→MAR, 1→R", "无", "01") } },
                { t: "控制字段发出微命令", d: "微操作控制字段的各位直接（或经字段译码）变成控制信号：PC→MAR、1→R，主存开始读。", on: ["CMDR", "EXE"], go: ["cmdr_exe"], kv: { "已发微命令": "PC→MAR, 1→R" } },
                { t: "下址字段 01 → CMAR", d: "顺序控制字段给出下一条微指令地址 01，经顺序逻辑送 CMAR。", on: ["CMDR", "SEQ", "CMAR"], go: ["cmdr_seq", "seq_cmar"], set: { CMAR: { v: "01" } } },
                { t: "执行 01：M(MAR)→MDR，PC+1", d: "读出 01 号微指令并发出微命令：主存数据送 MDR，同时 PC 自增。下址 02。", on: ["CM", "CMDR", "EXE"], go: ["cmar_dec", "dec_cm", "cm_cmdr", "cmdr_exe"], set: { CM: { hi: 1 }, CMDR: cmdr("M(MAR)→MDR, PC+1", "无", "02") }, kv: { "已发微命令": "M(MAR)→MDR, (PC)+1→PC" } },
                { t: "执行 02：MDR → IR", d: "02 号微指令把指令送入 IR。它的判别测试字段表示“按操作码转移”，下一条微地址不由下址字段决定。", on: ["CM", "CMDR", "EXE", "IR"], go: ["cmdr_seq", "seq_cmar", "cmar_dec", "dec_cm", "cm_cmdr", "cmdr_exe"], set: { CMAR: { v: "02" }, CM: { hi: 2 }, CMDR: cmdr("MDR→IR", "按 OP", "——"), IR: { v: "ADD @X → OP=ADD" } }, kv: { "已发微命令": "(MDR)→IR" } },
                { t: "OP → 微地址形成部件 → 入口 20", d: "IR 的操作码送微地址形成部件，映射出 ADD 指令执行微程序的入口地址 20，经顺序逻辑送 CMAR。", on: ["IR", "UAF", "SEQ", "CMAR"], go: ["ir_uaf", "uaf_seq", "seq_cmar"], set: { CMAR: { v: "20" } }, tip: "取指微程序结束后，下一条微指令地址由操作码决定，这是“机器指令 → 微程序”对应关系的关键一步。" },
                { t: "执行 20：Ad(IR)→MAR，1→R", d: "开始执行 ADD 的微程序：送操作数地址，发读命令。", on: ["CMAR", "CM", "CMDR", "EXE"], go: ["cmar_dec", "dec_cm", "cm_cmdr", "cmdr_exe"], set: { CM: { hi: 4 }, CMDR: cmdr("Ad(IR)→MAR, 1→R", "无", "21") }, kv: { "已发微命令": "Ad(IR)→MAR, 1→R" } },
                { t: "执行 21：M(MAR) → MDR", d: "取出操作数。下址 22。", on: ["CM", "CMDR", "EXE"], go: ["cmdr_seq", "seq_cmar", "cmar_dec", "dec_cm", "cm_cmdr", "cmdr_exe"], set: { CMAR: { v: "21" }, CM: { hi: 5 }, CMDR: cmdr("M(MAR)→MDR", "无", "22") }, kv: { "已发微命令": "M(MAR)→MDR" } },
                { t: "执行 22：ACC + MDR → ACC", d: "ALU 相加，结果写回 ACC。这是 ADD 微程序的最后一条，下址字段为 00，回到取指入口。", on: ["CM", "CMDR", "EXE"], go: ["cmdr_seq", "seq_cmar", "cmar_dec", "dec_cm", "cm_cmdr", "cmdr_exe"], set: { CMAR: { v: "22" }, CM: { hi: 6 }, CMDR: cmdr("(ACC)+(MDR)→ACC", "无", "00") }, kv: { "已发微命令": "(ACC)+(MDR)→ACC" } },
                { t: "返回 00，取下一条机器指令", d: "下址 00 送 CMAR，开始下一条机器指令的取指微程序。一条 ADD 指令共执行了 3 条取指微指令 + 3 条执行微指令。", on: ["CMDR", "SEQ", "CMAR"], go: ["cmdr_seq", "seq_cmar"], set: { CMAR: { v: "00" } }, tip: "若题目问“控存容量”：微指令条数 = 公共取指微程序 + 各指令执行微程序 (+ 中断、间址微程序)，下址字段位数 = ⌈log2 条数⌉。" }
              ];
              return { w: 960, h: 460, nodes: nodes, edges: edges, steps: S };
            }
          }]
        });

        /* ===================== 带 TLB 的虚存访问过程 ===================== */
        function tlbFlow(kind) {
          var nodes = [
            { id: "start", k: "term", x: 80, y: 20, w: 220, h: 42, t: "CPU 给出虚拟地址" },
            { id: "tlbq", k: "dec", x: 110, y: 90, w: 160, h: 72, t: "TLB 命中？" },
            { id: "pt", k: "box", x: 400, y: 98, w: 230, h: 56, t: "访问主存中的页表\n（页表基址 + 页号 × 项长）", sm: 1 },
            { id: "vq", k: "dec", x: 435, y: 192, w: 160, h: 72, t: "有效位 = 1？" },
            { id: "upd", k: "box", x: 415, y: 300, w: 200, h: 46, t: "页框号装入 TLB" },
            { id: "pf", k: "box", x: 680, y: 199, w: 160, h: 58, t: "缺页异常\n（内中断）", sm: 1 },
            { id: "os", k: "box", x: 680, y: 290, w: 160, h: 86, t: "OS 缺页处理：\n找空闲页框/置换\n脏页写回·调入该页\n修改页表", sm: 1 },
            { id: "retry", k: "box", x: 680, y: 410, w: 160, h: 44, t: "重新执行该指令", sm: 1 },
            { id: "pa", k: "box", x: 90, y: 300, w: 200, h: 50, t: "得到物理地址\n页框号 ‖ 页内偏移", sm: 1 },
            { id: "cq", k: "dec", x: 110, y: 390, w: 160, h: 72, t: "Cache 命中？" },
            { id: "hit", k: "box", x: 90, y: 500, w: 200, h: 44, t: "从 Cache 读出数据" },
            { id: "miss", k: "box", x: 360, y: 494, w: 230, h: 56, t: "访问主存取数据\n并把该块调入 Cache", sm: 1 },
            { id: "end", k: "term", x: 110, y: 580, w: 160, h: 40, t: "数据送 CPU" }
          ];
          var edges = [
            { id: "s_t", a: "start", as: "b", b: "tlbq", bs: "t" },
            { id: "t_pa", a: "tlbq", as: "b", b: "pa", bs: "t", t: "是" },
            { id: "t_pt", a: "tlbq", as: "r", b: "pt", bs: "l", t: "否" },
            { id: "pt_v", a: "pt", as: "b", b: "vq", bs: "t" },
            { id: "v_u", a: "vq", as: "b", b: "upd", bs: "t", t: "是" },
            { id: "v_pf", a: "vq", as: "r", b: "pf", bs: "l", t: "否" },
            { id: "pf_os", a: "pf", as: "b", b: "os", bs: "t" },
            { id: "os_r", a: "os", as: "b", b: "retry", bs: "t" },
            { id: "r_s", a: "retry", as: "r", b: "start", bs: "r", pts: [[862, 432], [862, 41]] },
            { id: "u_pa", a: "upd", as: "l", b: "pa", bs: "r", bo: 0 },
            { id: "pa_c", a: "pa", as: "b", b: "cq", bs: "t" },
            { id: "c_h", a: "cq", as: "b", b: "hit", bs: "t", t: "是" },
            { id: "c_m", a: "cq", as: "r", b: "miss", bs: "l", pts: [[475, 426]], t: "否" },
            { id: "h_e", a: "hit", as: "b", b: "end", bs: "t" },
            { id: "m_e", a: "miss", as: "b", b: "end", bs: "r", pts: [[475, 600]] }
          ];
          var S = [{ t: "CPU 发出虚拟地址", d: "程序里用的都是虚拟地址（逻辑地址）。CPU 先拿虚页号去查快表 TLB，TLB 是页表的一个小而快的副本，通常由相联存储器实现。", on: ["start"], kv: { "访问主存": "0 次", "访问 Cache": "0 次" } }];
          var mem = 0, cache = 0;
          function add(s) { S.push(s); }
          if (kind === "hit") {
            add({ t: "查 TLB：命中", d: "虚页号与 TLB 中某项的标记相等且有效，直接取出页框号，不用访问主存里的页表。", on: ["tlbq"], go: ["s_t"] });
            add({ t: "拼出物理地址", d: "物理地址 = 页框号 ‖ 页内偏移（页内偏移在虚实地址中相同）。", on: ["pa"], go: ["t_pa"] });
            add({ t: "查 Cache：命中", d: "用物理地址查 Cache，命中。", on: ["cq"], go: ["pa_c"], kv: { "访问 Cache": (++cache) + " 次" } });
            add({ t: "从 Cache 取数据", d: "按块内地址从 Cache 行中取出数据。", on: ["hit"], go: ["c_h"] });
            add({ t: "完成：一次主存都没访问", d: "TLB 命中 + Cache 命中是最好情况：地址转换和取数都在 CPU 内部完成。", on: ["end"], go: ["h_e"], tip: "TLB、页表、Cache 三者可能的命中组合中，“TLB 命中而页表缺失（缺页）”是不可能的：TLB 里有的页一定在主存里。" });
          } else {
            add({ t: "查 TLB：缺失", d: "TLB 中没有这个虚页号的项，只能去主存里查页表。", on: ["tlbq"], go: ["s_t"] });
            add({ t: "访问主存中的页表", d: "页表项地址 = 页表基址寄存器 + 虚页号 × 页表项长度。读页表项要访问一次主存。", on: ["pt"], go: ["t_pt"], kv: { "访问主存": (++mem) + " 次" } });
            if (kind === "pt") {
              add({ t: "有效位 = 1：页在主存", d: "该页已调入主存，页表项中有页框号。", on: ["vq"], go: ["pt_v"] });
              add({ t: "页框号装入 TLB", d: "把这一页表项装入 TLB（TLB 满时按 LRU 等策略替换），下次访问同一页就能命中。", on: ["upd"], go: ["v_u"] });
              add({ t: "拼出物理地址", d: "页框号 ‖ 页内偏移。", on: ["pa"], go: ["u_pa"] });
              add({ t: "查 Cache：缺失", d: "该数据所在的块不在 Cache 中。", on: ["cq"], go: ["pa_c"], kv: { "访问 Cache": (++cache) + " 次" } });
              add({ t: "访问主存取数据并调入 Cache", d: "从主存读出整个块送入 Cache（必要时替换一行），同时把所需的字送 CPU。", on: ["miss"], go: ["c_m"], kv: { "访问主存": (++mem) + " 次" } });
              add({ t: "完成", d: "共访问主存 2 次（1 次查页表 + 1 次取数据块）。", on: ["end"], go: ["m_e"], tip: "页表本身也可能在 Cache 中：若页表项在 Cache 命中，查页表就不必访问主存。" });
            } else {
              add({ t: "有效位 = 0：缺页", d: "该页不在主存，CPU 产生缺页异常。缺页是“故障”类内中断，在指令执行过程中产生，可以在指令执行期间被响应。", on: ["vq"], go: ["pt_v"] });
              add({ t: "进入缺页异常处理", d: "硬件保存断点（就是引起缺页的这条指令的地址）并转到操作系统的缺页处理程序。", on: ["pf"], go: ["v_pf"] });
              add({ t: "OS 调页", d: "找一个空闲页框；没有就按置换算法选一页淘汰，若该页被修改过（脏位=1）先写回外存；再启动磁盘把所需页读入，修改页表项（页框号、有效位=1）。", on: ["os"], go: ["pf_os"], kv: { "访问磁盘": "1 次（脏页写回再 +1）" } });
              add({ t: "返回并重新执行该指令", d: "缺页处理完后回到断点，重新执行刚才没执行完的指令（不是下一条）。", on: ["retry"], go: ["os_r"] });
              add({ t: "重新访存：查 TLB", d: "重新执行时再次查 TLB（多数实现缺页处理不直接写 TLB，这里仍缺失）。", on: ["start", "tlbq"], go: ["r_s", "s_t"] });
              add({ t: "查页表：这次有效", d: "页表项已更新，有效位 = 1。", on: ["pt", "vq"], go: ["t_pt", "pt_v"], kv: { "访问主存": (++mem) + " 次" } });
              add({ t: "装入 TLB，得到物理地址", d: "页框号装入 TLB，拼出物理地址。", on: ["upd", "pa"], go: ["v_u", "u_pa"] });
              add({ t: "查 Cache 缺失，访存取数", d: "刚调入的页一定不在 Cache 中，只能访问主存。", on: ["cq", "miss"], go: ["pa_c", "c_m"], kv: { "访问 Cache": (++cache) + " 次", "访问主存": (++mem) + " 次" } });
              add({ t: "完成", d: "缺页的代价远大于几次访存：一次磁盘访问是毫秒级，访存是几十纳秒级。", on: ["end"], go: ["m_e"], tip: "缺页中断返回后重新执行引起缺页的指令；普通 I/O 中断返回后执行下一条指令。" });
            }
          }
          return { w: 880, h: 640, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "tlbflow", name: "带 TLB 的虚存访问过程", sub: "co",
          lead: "CPU 发出一个虚拟地址后，要依次经过 TLB、页表、Cache、主存，必要时还要请操作系统从磁盘调页。",
          note: ["顺序：先 TLB → 再页表 → 再 Cache → 再主存。", "TLB 命中则页一定在主存；TLB 缺失可能页表命中也可能缺页。", "最好情况访存 0 次（TLB、Cache 都命中）；TLB 缺失至少多访存 1 次。", "缺页由 OS 处理，处理完重新执行该指令。", "TLB 通常用相联存储器，按内容并行查找。"],
          modes: [
            { name: "TLB 命中", make: function () { return tlbFlow("hit"); } },
            { name: "TLB 缺失、页表命中", make: function () { return tlbFlow("pt"); } },
            { name: "缺页", make: function () { return tlbFlow("pf"); } }
          ]
        });

        /* ===================== TLB + Cache 地址转换（可输入） ===================== */
        function tlbCache(inp) {
          var va = U.parseHex(inp.va);
          if (va == null) throw new Error("请输入 32 位十六进制虚拟地址，例如 0x0040A3C8");
          var tlbHit = inp.tlb !== "miss", cHit = inp.cache !== "miss";
          var vpn = va >>> 12, off = va & 0xFFF, ttag = va >>> 15, tset = vpn & 7;
          var pfn = U.mix(vpn, 7) & 0xFFF, pa = ((pfn << 12) | off) >>> 0;
          var ctag = pa >>> 12, cset = (pa >>> 5) & 0x7F, coff = pa & 0x1F;
          var hx = U.hex;
          var way = U.mix(vpn, 3) & 3, rows = [];
          for (var i = 0; i < 4; i++) {
            var other = (ttag ^ ((U.mix(vpn, 11 + i) & 0x1FFFF) | 1)) & 0x1FFFF, tg = (tlbHit && i === way) ? ttag : other;
            var v = (tlbHit && i === way) ? 1 : (U.mix(vpn, 20 + i) & 3 ? 1 : 0);
            rows.push([String(v), hx(tg, 5), (tlbHit && i === way) ? hx(pfn, 3) : hx(U.mix(tg, 5) & 0xFFF, 3)]);
          }
          var cway = U.mix(pa, 2) & 1, crows = [];
          for (var j = 0; j < 2; j++) {
            var ct = (cHit && j === cway) ? ctag : (ctag ^ ((U.mix(pa, 30 + j) & 0xFFF) | 1)) & 0xFFF;
            crows.push(["1", hx(ct, 3), (cHit && j === cway) ? "目标块" : "其他块"]);
          }
          var vaSegs = function (on) { return [{ t: "TLB 标记", b: 17, v: on > 0 ? hx(ttag, 5) : "" }, { t: "TLB 组号", b: 3, v: on > 0 ? String(tset) : "", w: 7 }, { t: "页内偏移", b: 12, v: on > 0 ? hx(off, 3) : "" }]; };
          var paSegs = function (k) { return [{ t: "页框号 = Cache 标记", b: 12, v: k >= 1 ? hx(pfn, 3) : "" }, { t: "Cache 组号", b: 7, v: k >= 2 ? String(cset) : "", w: 8 }, { t: "块内地址", b: 5, v: k >= 2 ? String(coff) : "", w: 6 }]; };
          var nodes = [
            { id: "VA", k: "fields", x: 40, y: 50, w: 520, h: 60, t: "虚拟地址 " + hx(va, 8), segs: vaSegs(0) },
            { id: "TLB", k: "table", x: 40, y: 160, w: 330, h: 112, rh: 20, t: "TLB（4 路组相联，8 组）", cols: [0.18, 0.42], rows: [["有效", "标记", "页框号"]].concat(rows) },
            { id: "CMP", k: "dec", x: 405, y: 176, w: 140, h: 76, t: "标记相等\n且有效？" },
            { id: "PT", k: "box", x: 610, y: 186, w: 200, h: 58, t: "查主存页表\n页表基址 + 虚页号 × 4", sm: 1 },
            { id: "PA", k: "fields", x: 40, y: 350, w: 500, h: 60, t: "物理地址（24 位）", segs: paSegs(0) },
            { id: "CA", k: "table", x: 40, y: 460, w: 330, h: 72, rh: 20, t: "Cache（2 路组相联，128 组）", cols: [0.18, 0.4], rows: [["有效", "标记", "数据"]].concat(crows) },
            { id: "CCMP", k: "dec", x: 405, y: 458, w: 140, h: 76, t: "标记相等\n且有效？" },
            { id: "HIT", k: "box", x: 610, y: 467, w: 200, h: 58, t: "命中：按块内地址\n从行中取出数据", sm: 1 },
            { id: "MEM", k: "box", x: 610, y: 560, w: 200, h: 58, t: "缺失：访问主存\n把该块调入 Cache", sm: 1 }
          ];
          var edges = [
            { id: "va_tlb", a: "VA", as: "b", ao: 35, b: "TLB", bs: "t", bo: 95, t: "组号选组" },
            { id: "tlb_cmp", a: "TLB", b: "CMP", t: "并行比较" },
            { id: "cmp_pa", a: "CMP", as: "b", b: "PA", bs: "t", bo: -135, pts: [[475, 300], [155, 300]], t: "命中：页框号", lp: [270, 300] },
            { id: "cmp_pt", a: "CMP", as: "r", b: "PT", bs: "l", t: "缺失" },
            { id: "pt_pa", a: "PT", as: "b", b: "PA", bs: "r", bo: 14, pts: [[710, 394]], t: "页框号（并装入 TLB）", lp: [710, 330] },
            { id: "off_pa", a: "VA", as: "r", b: "PA", bs: "r", bo: -14, pts: [[585, 80], [585, 366]], dash: 1, t: "页内偏移直接拼接", lp: [585, 140] },
            { id: "pa_ca", a: "PA", as: "b", ao: 100, b: "CA", bs: "t", bo: 125, t: "组号选组" },
            { id: "ca_cmp", a: "CA", b: "CCMP", t: "比较" },
            { id: "ccmp_hit", a: "CCMP", as: "r", b: "HIT", bs: "l", t: "是" },
            { id: "ccmp_mem", a: "CCMP", as: "b", b: "MEM", bs: "l", t: "否" }
          ];
          var mem = 0, S = [];
          S.push({ t: "已知条件", d: "虚拟地址 32 位，页大小 4KB（页内偏移 12 位）；物理地址 24 位（页框号 12 位）。TLB 共 32 项、4 路组相联、8 组；Cache 8KB、2 路组相联、块大小 32B（128 组）。", kv: { "虚拟地址": hx(va, 8), "访问主存": "0 次" } });
          S.push({ t: "拆分虚拟地址", d: "虚页号 = 高 20 位 = " + hx(vpn, 5) + "，页内偏移 = 低 12 位 = " + hx(off, 3) + "。TLB 有 8 组，所以虚页号的低 3 位是 TLB 组号（" + tset + "），高 17 位是 TLB 标记（" + hx(ttag, 5) + "）。", on: ["VA"], set: { VA: { segs: vaSegs(1) } }, kv: { "虚页号": hx(vpn, 5), "TLB 组号": String(tset), "TLB 标记": hx(ttag, 5) }, tip: "TLB 标记位数 = 虚页号位数 − TLB 组号位数 = 20 − 3 = 17。全相联 TLB 没有组号，标记就是整个虚页号。" });
          S.push({ t: "按组号选中 TLB 第 " + tset + " 组", d: "组号 " + tset + " 直接选出一组，组内 4 项同时参与比较。", on: ["VA", "TLB"], go: ["va_tlb"], set: { TLB: { t: "TLB 第 " + tset + " 组（4 路）" } } });
          if (tlbHit) {
            S.push({ t: "4 个标记并行比较：命中", d: "第 " + (way + 1) + " 路的标记等于 " + hx(ttag, 5) + " 且有效位为 1，命中。", on: ["TLB", "CMP"], go: ["tlb_cmp"], set: { TLB: { hi: way + 1 } } });
            S.push({ t: "取出页框号 " + hx(pfn, 3), d: "命中项中的页框号就是物理页号，不需要访问主存页表。", on: ["CMP", "PA"], go: ["cmp_pa"], set: { PA: { segs: paSegs(1) } } });
          } else {
            S.push({ t: "4 个标记并行比较：缺失", d: "该组 4 项中没有标记等于 " + hx(ttag, 5) + " 的有效项，TLB 缺失。", on: ["TLB", "CMP"], go: ["tlb_cmp"], set: { TLB: { bad: -1 } } });
            S.push({ t: "访问主存中的页表", d: "页表项地址 = 页表基址 + " + hx(vpn, 5) + " × 4。读出页表项（设有效位为 1），得到页框号 " + hx(pfn, 3) + "。", on: ["CMP", "PT"], go: ["cmp_pt"], kv: { "访问主存": (++mem) + " 次" } });
            S.push({ t: "页框号装入 TLB，送物理地址", d: "把这项写入 TLB 第 " + tset + " 组（组满则替换一项），同时送出页框号。", on: ["PT", "PA", "TLB"], go: ["pt_pa"], set: { PA: { segs: paSegs(1) }, TLB: { rows: [["有效", "标记", "页框号"], rows[0], rows[1], rows[2], ["1", hx(ttag, 5), hx(pfn, 3)]], hi: 4 } } });
          }
          S.push({ t: "拼接页内偏移", d: "页内偏移不需要转换，原样拼到页框号后面：物理地址 = " + hx(pfn, 3) + " ‖ " + hx(off, 3) + " = " + hx(pa, 6) + "。", on: ["VA", "PA"], go: ["off_pa"], set: { PA: { t: "物理地址 " + hx(pa, 6) + "（24 位）" } }, kv: { "物理地址": hx(pa, 6) } });
          S.push({ t: "按 Cache 格式拆分物理地址", d: "块大小 32B → 块内地址 5 位（" + coff + "）；128 组 → 组号 7 位（" + cset + "）；剩下 24 − 12 = 12 位是 Cache 标记（" + hx(ctag, 3) + "），恰好等于页框号。", on: ["PA"], set: { PA: { segs: paSegs(2) } }, kv: { "Cache 组号": String(cset), "块内地址": String(coff), "Cache 标记": hx(ctag, 3) }, tip: "组号 + 块内地址 = 7 + 5 = 12 位，正好落在页内偏移里，不随地址转换改变。所以硬件可以用虚拟地址的低 12 位先选 Cache 组，与查 TLB 同时进行（虚拟索引、物理标记）。" });
          S.push({ t: "按组号选中 Cache 第 " + cset + " 组", d: "组内 2 行同时比较。", on: ["PA", "CA"], go: ["pa_ca"], set: { CA: { t: "Cache 第 " + cset + " 组（2 路）" } } });
          if (cHit) {
            S.push({ t: "标记比较：命中", d: "第 " + (cway + 1) + " 行的标记等于 " + hx(ctag, 3) + " 且有效。", on: ["CA", "CCMP"], go: ["ca_cmp"], set: { CA: { hi: cway + 1 } } });
            S.push({ t: "从 Cache 行中取出数据", d: "按块内地址 " + coff + " 从这一行中取出所需的字节 / 字，送给 CPU。", on: ["CCMP", "HIT"], go: ["ccmp_hit"] });
          } else {
            S.push({ t: "标记比较：缺失", d: "两行都不匹配，Cache 缺失。", on: ["CA", "CCMP"], go: ["ca_cmp"], set: { CA: { bad: -1 } } });
            S.push({ t: "访问主存，调入整块", d: "按物理地址访问主存，把 32B 的整块调入 Cache 第 " + cset + " 组（满则按 LRU 等替换一行，被替换行若是脏的先写回），同时把所需数据送 CPU。", on: ["CCMP", "MEM"], go: ["ccmp_mem"], kv: { "访问主存": (++mem) + " 次" } });
          }
          S.push({ t: "小结", d: "本次访问：TLB " + (tlbHit ? "命中" : "缺失") + "、Cache " + (cHit ? "命中" : "缺失") + "，共访问主存 " + mem + " 次。", on: [], kv: { "访问主存": mem + " 次" }, tip: "综合题常问“哪些情况下需要访问主存”：TLB 缺失要查页表，Cache 缺失要取数据块；两者都命中则 0 次。" });
          return { w: 880, h: 640, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "tlbcache", name: "TLB + Cache 地址转换", sub: "co",
          lead: "输入一个虚拟地址，按“拆字段 → 查 TLB → 拼物理地址 → 查 Cache”逐步算。可以切换 TLB 和 Cache 的命中情况。",
          note: ["虚拟地址 = 虚页号 ‖ 页内偏移；组相联 TLB 再把虚页号拆成 标记 ‖ 组号。", "物理地址 = 页框号 ‖ 页内偏移；Cache 再把它拆成 标记 ‖ 组号 ‖ 块内地址。", "Cache 标记位数 = 物理地址位数 − 组号位数 − 块内地址位数。", "TLB 命中与否只影响地址转换；Cache 命中与否只影响取数据。"],
          inputs: [
            { k: "va", label: "虚拟地址（十六进制）", value: "0040A3C8", ph: "例如 0040A3C8" },
            { k: "tlb", label: "TLB", type: "select", value: "hit", opts: [["hit", "命中"], ["miss", "缺失"]] },
            { k: "cache", label: "Cache", type: "select", value: "hit", opts: [["hit", "命中"], ["miss", "缺失"]] }
          ],
          modes: [{ name: "地址转换", make: tlbCache, presets: [{ label: "都命中", v: { va: "0040A3C8", tlb: "hit", cache: "hit" } }, { label: "TLB 缺失", v: { va: "0040A3C8", tlb: "miss", cache: "hit" } }, { label: "都缺失", v: { va: "12345678", tlb: "miss", cache: "miss" } }] }]
        });

        /* ===================== 单重 / 多重中断 ===================== */
        function intrFlow(multi) {
          var hw = ["关中断（0 → EINT）", "保存断点（PC 入栈）", "送中断服务程序入口 → PC"];
          var sw = multi ? ["保护现场和屏蔽字", "开中断（允许更高级中断）", "执行设备服务", "关中断", "恢复现场和屏蔽字", "开中断", "中断返回"] : ["保护现场", "执行设备服务", "恢复现场", "开中断", "中断返回"];
          var nodes = [
            { id: "zhw", k: "zone", x: 210, y: 76, w: 330, h: 158, t: "硬件：中断隐指令" },
            { id: "zsw", k: "zone", x: 210, y: 250, w: 330, h: sw.length * 52 + 30, t: "软件：中断服务程序" },
            { id: "req", k: "term", x: 245, y: 20, w: 260, h: 40, t: "中断请求（指令周期结束时响应）", sm: 1 }
          ], edges = [], last = "req";
          hw.forEach(function (t, i) { nodes.push({ id: "h" + i, k: "box", x: 245, y: 100 + i * 44, w: 260, h: 34, t: t, sm: 1 }); });
          sw.forEach(function (t, i) { nodes.push({ id: "s" + i, k: "box", x: 245, y: 278 + i * 52, w: 260, h: 38, t: t, sm: 1 }); });
          var ids = ["req", "h0", "h1", "h2"].concat(sw.map(function (t, i) { return "s" + i; }));
          ids.slice(1).forEach(function (id) { edges.push({ id: "e_" + id, a: last, as: "b", b: id, bs: "t" }); last = id; });
          var svcIdx = sw.indexOf("执行设备服务");
          var H = 278 + sw.length * 52 + 20;
          if (multi) {
            var sy = 278 + svcIdx * 52;
            nodes.push({ id: "nest", k: "box", x: 600, y: sy - 4, w: 230, h: 46, t: "更高优先级的中断 B\n（执行 B 的服务程序）", sm: 1 });
            edges.push({ id: "e_in", a: "s" + svcIdx, as: "r", ao: -8, b: "nest", bs: "l", bo: -8, t: "嵌套" });
            edges.push({ id: "e_out", a: "nest", as: "l", ao: 10, b: "s" + svcIdx, bs: "r", bo: 10, t: "返回" });
          }
          nodes.push({ id: "mask", k: "table", x: 20, y: 76, w: 170, h: 96, rh: 20, t: "CPU 状态", cols: [0.5], rows: [["EINT", "1"], ["断点", "—"], ["屏蔽字", "1100"]] });
          var S = [{ t: (multi ? "多重" : "单重") + "中断：请求到来", d: multi ? "多重中断允许在执行一个中断服务程序时，再响应优先级更高的中断（中断嵌套）。" : "单重中断在执行服务程序期间不允许被任何新中断打断。", on: ["req"], set: { mask: { rows: [["EINT", "1"], ["断点", "—"], ["屏蔽字", "1100"]] } } }];
          var st = function (e, b, m) { return { mask: { rows: [["EINT", e], ["断点", b], ["屏蔽字", m]] } }; };
          var D = {
            "关中断（0 → EINT）": ["硬件自动关中断，保证保存断点、保护现场时不被打断。", st("0", "—", "1100")],
            "保存断点（PC 入栈）": ["把 PC 中下一条指令的地址（断点）保存到栈或固定单元。", st("0", "1001", "1100")],
            "送中断服务程序入口 → PC": ["硬件识别中断源（向量中断用向量地址找入口），把入口地址送 PC，下一步开始执行服务程序。", null],
            "保护现场": ["服务程序先把会用到的通用寄存器内容压栈。", null],
            "保护现场和屏蔽字": ["除了通用寄存器，还要保存原来的中断屏蔽字，再设置本中断对应的新屏蔽字（屏蔽同级和低级）。", st("0", "1001", "1110")],
            "开中断（允许更高级中断）": ["在真正开始服务之前开中断。这是多重中断与单重中断的关键区别。", st("1", "1001", "1110")],
            "执行设备服务": ["执行这个中断源要求的处理，例如从接口读数据。", null],
            "关中断": ["服务完准备恢复现场，先关中断，防止恢复到一半被打断。", st("0", "1001", "1110")],
            "恢复现场和屏蔽字": ["从栈中恢复通用寄存器和原屏蔽字。", st("0", "1001", "1100")],
            "恢复现场": ["从栈中恢复通用寄存器。", null],
            "开中断": ["开中断。", st("1", "1001", "1100")],
            "中断返回": ["执行中断返回指令 IRET：断点出栈送 PC，回到被打断的程序继续执行。", st("1", "—", "1100")]
          };
          ids.slice(1).forEach(function (id) {
            var n = nodes.filter(function (x) { return x.id === id; })[0], d = D[n.t];
            var s = { t: n.t, d: d[0], on: [id], go: ["e_" + id], set: d[1] || undefined };
            if (n.t === "开中断（允许更高级中断）") s.tip = "单重中断：开中断在恢复现场之后、中断返回之前；多重中断：开中断在保护现场之后、设备服务之前。";
            if (n.t === "中断返回") s.tip = multi ? "屏蔽字可以改变处理优先级（响应优先级由硬件排队决定，不可改）。" : "单重中断处理期间新的中断请求要等到开中断后才能被响应。";
            if (n.t === "保存断点（PC 入栈）") s.tip = "这三步是硬件完成的“中断隐指令”，不需要程序员写指令。";
            S.push(s);
            if (multi && n.t === "执行设备服务") {
              S.push({ t: "更高优先级中断 B 到来：嵌套", d: "此时 EINT=1，且 B 未被屏蔽字屏蔽，CPU 在当前指令结束后响应 B：再走一遍中断隐指令，转去执行 B 的服务程序。", on: ["nest"], go: ["e_in"] });
              S.push({ t: "B 处理完，返回继续服务", d: "B 的服务程序执行 IRET 后，回到 A 的服务程序被打断处继续。", on: [id], go: ["e_out"] });
            }
          });
          return { w: 860, h: Math.max(H, 520), nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "intr", name: "单重 / 多重中断服务流程", sub: "co",
          lead: "两种流程只差“开中断”放在哪里。切换两个模式对照着走一遍。",
          note: ["中断响应条件：有请求、EINT=1（允许中断）、一条指令执行结束。", "中断隐指令（硬件）：关中断、保存断点、引出服务程序。", "单重：恢复现场后开中断；多重：保护现场和屏蔽字后就开中断。", "屏蔽字 1 表示屏蔽：通常屏蔽自己和更低级的中断。", "中断处理优先级可通过屏蔽字改变，响应优先级由硬件决定。"],
          modes: [{ name: "单重中断", make: function () { return intrFlow(false); } }, { name: "多重中断", make: function () { return intrFlow(true); } }]
        });

        /* ===================== DMA ===================== */
        PROC.push({
          id: "dma", name: "DMA 传送数据", sub: "co",
          lead: "外设与主存直接成块交换数据：CPU 只在开始（预处理）和结束（后处理）时参与，中间只需让出几个总线周期。",
          note: ["DMA 三阶段：预处理（CPU）→ 数据传送（DMA 控制器）→ 后处理（中断，CPU）。", "DMA 请求在每个机器周期结束时响应；中断请求在指令周期结束时响应。", "DMA 优先级高于中断：数据不及时传走会丢失。", "三种方式：停止 CPU 访存、周期挪用（周期窃取）、DMA 与 CPU 交替访存。", "DMA 控制器主要寄存器：主存地址计数器 AR、传送长度计数器 WC、数据缓冲寄存器 DR、设备地址寄存器。"],
          modes: [{
            name: "一次块传送（周期挪用）",
            make: function () {
              var memRows = function (k) { var r = []; for (var i = 0; i < 4; i++) r.push([U.hex(0x2000 + i, 4).slice(2), i < k ? ["A1", "B2", "C3", "D4"][i] : "—"]); return r; };
              var nodes = [
                { id: "CPU", k: "box", x: 40, y: 50, w: 170, h: 70, t: "CPU", v: "执行主程序" },
                { id: "MEM", k: "table", x: 40, y: 270, w: 180, h: 112, rh: 20, t: "主存 M", cols: [0.4], rows: memRows(0) },
                { id: "BUS", k: "box", x: 250, y: 196, w: 320, h: 30, t: "系统总线（地址 / 数据 / 控制）", sm: 1 },
                { id: "zd", k: "zone", x: 610, y: 36, w: 270, h: 220, t: "DMA 控制器" },
                { id: "AR", k: "reg", x: 630, y: 66, w: 110, h: 46, t: "AR 主存地址", v: "—" },
                { id: "WC", k: "reg", x: 755, y: 66, w: 110, h: 46, t: "WC 字计数", v: "—" },
                { id: "DR", k: "reg", x: 630, y: 160, w: 110, h: 46, t: "DR 数据缓冲", v: "—" },
                { id: "CTL", k: "box", x: 755, y: 160, w: 110, h: 46, t: "控制/状态\n逻辑·中断", sm: 1 },
                { id: "DEV", k: "box", x: 630, y: 320, w: 235, h: 56, t: "I/O 设备（如磁盘）", v: "" }
              ];
              var edges = [
                { id: "cpu_ar", a: "CPU", as: "r", ao: -15, b: "AR", bs: "l", bo: -10, mx: 590, t: "预处理：写 AR、WC", lp: [420, 74] },
                { id: "dev_dr", a: "DEV", as: "t", ao: -62, b: "DR", bs: "b", t: "数据" },
                { id: "dev_ctl", a: "DEV", as: "t", ao: 62, b: "CTL", bs: "b", t: "DMA 请求" },
                { id: "hold", a: "CTL", as: "r", b: "CPU", bs: "t", ao: -6, bo: -30, pts: [[896, 177], [896, 16], [95, 16]], both: 1, t: "HRQ 请求 / HLDA 响应", lp: [500, 16] },
                { id: "intr", a: "CTL", as: "r", ao: 12, b: "CPU", bs: "t", bo: 30, pts: [[910, 195], [910, 30], [155, 30]], t: "WC=0：中断请求", lp: [760, 30] },
                { id: "ar_bus", a: "AR", as: "l", ao: 10, b: "BUS", bs: "r", bo: -7, mx: 595, t: "地址" },
                { id: "dr_bus", a: "DR", as: "l", b: "BUS", bs: "r", bo: 7, mx: 605, t: "数据", lp: [605, 196] },
                { id: "bus_mem", a: "BUS", as: "l", b: "MEM", bs: "t", t: "写主存" },
                { id: "cpu_bus", a: "CPU", as: "b", b: "BUS", bs: "t", bo: -100, t: "CPU 访存" }
              ];
              var S = [
                { t: "为什么要 DMA", d: "高速外设（磁盘）若每个字都用中断，CPU 要频繁保存恢复现场，开销太大。DMA 由专门的控制器接管总线，在外设与主存之间直接传送整块数据。", on: ["CPU", "DEV"], kv: { "已传字数": "0 / 4" } },
                { t: "预处理：CPU 初始化 DMA", d: "CPU 执行几条 I/O 指令：把主存起始地址 2000 写入 AR，传送字数 4 写入 WC，设定方向（设备 → 主存）和设备地址，然后启动设备。", on: ["CPU", "AR", "WC"], go: ["cpu_ar"], set: { AR: { v: "2000" }, WC: { v: "4" } } },
                { t: "CPU 继续执行主程序", d: "启动后 CPU 不再管传送细节，继续执行自己的程序；设备开始读数据。CPU 与外设并行工作。", on: ["CPU"], go: ["cpu_bus"], set: { CPU: { v: "执行主程序" } } },
                { t: "设备准备好一个字 → DR", d: "设备读出一个字 A1，送入 DMA 的数据缓冲寄存器 DR。", on: ["DEV", "DR"], go: ["dev_dr"], set: { DR: { v: "A1" } } },
                { t: "DMA 请求 → 向 CPU 申请总线", d: "设备向 DMA 控制器发 DMA 请求，控制器向 CPU 发总线请求 HRQ。", on: ["DEV", "CTL"], go: ["dev_ctl", "hold"] },
                { t: "CPU 让出总线（HLDA）", d: "CPU 在当前机器周期结束后放弃总线控制权，回答 HLDA。这就是“周期挪用”：挪用一个存取周期。", on: ["CPU", "CTL"], go: ["hold"], set: { CPU: { v: "让出 1 个存取周期" } }, tip: "DMA 请求在机器周期（存取周期）结束时就能响应，不必等指令结束；中断要等指令周期结束。" },
                { t: "AR 送地址、DR 送数据，写入主存", d: "DMA 控制器成为总线主设备：AR 中的 2000 送地址总线，DR 中的 A1 送数据总线，写入主存 2000 单元。", on: ["AR", "DR", "BUS", "MEM"], go: ["ar_bus", "dr_bus", "bus_mem"], set: { MEM: { rows: memRows(1), hi: 0 } }, kv: { "已传字数": "1 / 4" } },
                { t: "AR + 1，WC − 1，归还总线", d: "AR 自增指向 2001，WC 减为 3；DMA 撤销请求，CPU 恢复使用总线。WC ≠ 0，继续等待下一个字。", on: ["AR", "WC", "CPU"], set: { AR: { v: "2001" }, WC: { v: "3" }, CPU: { v: "执行主程序" } } },
                { t: "重复传送剩下的 3 个字", d: "每个字都重复“设备 → DR → 申请总线 → 写主存 → AR+1、WC−1”。B2、C3、D4 依次写入 2001–2003。", on: ["DEV", "DR", "AR", "WC", "MEM"], go: ["dev_dr", "dr_bus", "bus_mem"], set: { DR: { v: "D4" }, AR: { v: "2004" }, WC: { v: "0" }, MEM: { rows: memRows(4), hi: [1, 2, 3] } }, kv: { "已传字数": "4 / 4" } },
                { t: "后处理：WC = 0，发中断请求", d: "WC 减到 0 表示整块传完，DMA 控制器向 CPU 发中断请求。", on: ["CTL", "CPU"], go: ["intr"] },
                { t: "CPU 执行中断服务程序", d: "CPU 在指令周期结束时响应中断，做后处理：校验数据、决定是否继续传下一块、释放 DMA。整块 4 个字只引起 1 次中断。", on: ["CPU"], set: { CPU: { v: "中断服务（后处理）" } }, tip: "程序中断方式每传一个字中断一次；DMA 每传一块中断一次。DMA 传送过程本身不需要 CPU 执行指令。" }
              ];
              return { w: 930, h: 410, nodes: nodes, edges: edges, steps: S };
            }
          }]
        });
      })();
