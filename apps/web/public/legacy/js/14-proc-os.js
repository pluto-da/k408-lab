      /* 过程图解 · 操作系统：进程状态、进程切换、系统调用、二级页表、混合索引、设备分配、引导过程 */
      (function () {
        var PROC = window.PROC = window.PROC || [], U = window.PROCU, hx = U.hex;

        /* ===================== 进程状态转换 ===================== */
        function five() {
          var nodes = [
            { id: "new", k: "term", x: 30, y: 190, w: 120, h: 50, t: "创建态" },
            { id: "ready", k: "box", x: 240, y: 70, w: 140, h: 60, t: "就绪态" },
            { id: "run", k: "box", x: 540, y: 70, w: 140, h: 60, t: "运行态" },
            { id: "block", k: "box", x: 390, y: 300, w: 140, h: 60, t: "阻塞态" },
            { id: "exit", k: "term", x: 770, y: 190, w: 120, h: 50, t: "终止态" }
          ];
          var edges = [
            { id: "n_r", a: "new", as: "t", b: "ready", bs: "l", t: "创建完成·资源就绪" },
            { id: "r_u", a: "ready", as: "r", ao: -12, b: "run", bs: "l", bo: -12, t: "被调度（分到 CPU）" },
            { id: "u_r", a: "run", as: "l", ao: 12, b: "ready", bs: "r", bo: 12, t: "时间片到 / 被抢占" },
            { id: "u_b", a: "run", as: "b", b: "block", bs: "r", t: "请求 I/O、wait(P)" },
            { id: "b_r", a: "block", as: "l", b: "ready", bs: "b", t: "I/O 完成、被唤醒" },
            { id: "u_x", a: "run", as: "r", b: "exit", bs: "t", t: "运行结束 / 出错" }
          ];
          var S = [
            { t: "五状态模型", d: "进程在“就绪—运行—阻塞”三个基本状态之间转换，再加上创建和终止两个过渡状态。下面跟着一个进程 P 走完它的一生。", kv: { "P 的状态": "—" } },
            { t: "创建 → 就绪", d: "OS 为 P 申请空白 PCB、分配内存等资源、初始化 PCB，资源齐备后插入就绪队列。", on: ["new", "ready"], go: ["n_r"], kv: { "P 的状态": "就绪" } },
            { t: "就绪 → 运行：被调度", d: "进程调度程序从就绪队列选中 P，把 CPU 分给它。", on: ["ready", "run"], go: ["r_u"], kv: { "P 的状态": "运行" } },
            { t: "运行 → 就绪：时间片到", d: "时钟中断发现 P 的时间片用完（或有更高优先级进程到来被抢占），P 回到就绪队列末尾，它什么都不缺，只缺 CPU。", on: ["run", "ready"], go: ["u_r"], kv: { "P 的状态": "就绪" } },
            { t: "再次被调度", d: "轮到 P，重新上 CPU。", on: ["ready", "run"], go: ["r_u"], kv: { "P 的状态": "运行" } },
            { t: "运行 → 阻塞：请求 I/O", d: "P 请求读磁盘（或执行 wait 得不到资源），主动放弃 CPU 进入阻塞队列。", on: ["run", "block"], go: ["u_b"], kv: { "P 的状态": "阻塞" }, tip: "运行 → 阻塞是进程自己的主动行为（执行系统调用）；阻塞 → 就绪是被动行为（被别人唤醒）。" },
            { t: "阻塞 → 就绪：I/O 完成", d: "磁盘读完产生中断，中断处理程序唤醒 P，P 从阻塞队列移到就绪队列。注意它不会直接回到运行态。", on: ["block", "ready"], go: ["b_r"], kv: { "P 的状态": "就绪" }, tip: "不存在 阻塞 → 运行 和 就绪 → 阻塞 两种转换。" },
            { t: "被调度，继续运行", d: "P 再次获得 CPU。", on: ["ready", "run"], go: ["r_u"], kv: { "P 的状态": "运行" } },
            { t: "运行 → 终止", d: "P 执行完毕（或出现无法恢复的错误、被父进程终止），OS 回收资源，最后撤销 PCB。", on: ["run", "exit"], go: ["u_x"], kv: { "P 的状态": "终止" } }
          ];
          return { w: 920, h: 400, nodes: nodes, edges: edges, steps: S };
        }
        function seven() {
          var nodes = [
            { id: "ready", k: "box", x: 200, y: 60, w: 150, h: 56, t: "就绪态" },
            { id: "run", k: "box", x: 560, y: 60, w: 150, h: 56, t: "运行态" },
            { id: "block", k: "box", x: 560, y: 210, w: 150, h: 56, t: "阻塞态" },
            { id: "rs", k: "box", x: 200, y: 360, w: 150, h: 56, t: "就绪挂起\n（外存）", sm: 1 },
            { id: "bs", k: "box", x: 560, y: 360, w: 150, h: 56, t: "阻塞挂起\n（外存）", sm: 1 }
          ];
          var edges = [
            { id: "r_u", a: "ready", as: "r", ao: -10, b: "run", bs: "l", bo: -10, t: "调度" },
            { id: "u_r", a: "run", as: "l", ao: 10, b: "ready", bs: "r", bo: 10, t: "时间片到" },
            { id: "u_b", a: "run", as: "b", b: "block", bs: "t", t: "等待事件" },
            { id: "b_r", a: "block", as: "l", b: "ready", bs: "b", bo: 30, t: "事件发生" },
            { id: "r_rs", a: "ready", as: "b", ao: -40, b: "rs", bs: "t", bo: -40, t: "挂起" },
            { id: "rs_r", a: "rs", as: "t", ao: 0, b: "ready", bs: "b", bo: 0, t: "激活" },
            { id: "b_bs", a: "block", as: "b", ao: -30, b: "bs", bs: "t", bo: -30, t: "挂起" },
            { id: "bs_b", a: "bs", as: "t", ao: 30, b: "block", bs: "b", bo: 30, t: "激活" },
            { id: "bs_rs", a: "bs", as: "l", b: "rs", bs: "r", t: "事件发生" }
          ];
          var S = [
            { t: "引入挂起", d: "内存紧张时，OS 把暂时不能运行的进程整个换出到外存，称为挂起。被挂起的进程即使就绪也不能被调度，必须先激活（换入）。", kv: { "P 的状态": "运行", "所在位置": "内存" } },
            { t: "运行 → 阻塞", d: "P 请求 I/O，进入阻塞态，仍在内存。", on: ["run", "block"], go: ["u_b"], kv: { "P 的状态": "阻塞" } },
            { t: "阻塞 → 阻塞挂起", d: "内存不够用了，OS 把阻塞中的 P 换出到外存（中级调度 / 内存调度）。", on: ["block", "bs"], go: ["b_bs"], kv: { "P 的状态": "阻塞挂起", "所在位置": "外存" }, tip: "中级调度决定哪个进程换出 / 换入，提高内存利用率。" },
            { t: "阻塞挂起 → 就绪挂起", d: "P 等待的 I/O 完成了，但它还在外存，所以变成就绪挂起，而不是就绪。", on: ["bs", "rs"], go: ["bs_rs"], kv: { "P 的状态": "就绪挂起" } },
            { t: "就绪挂起 → 就绪：激活", d: "内存有空闲了，OS 把 P 换入内存。", on: ["rs", "ready"], go: ["rs_r"], kv: { "P 的状态": "就绪", "所在位置": "内存" } },
            { t: "就绪 → 运行", d: "进程调度选中 P。", on: ["ready", "run"], go: ["r_u"], kv: { "P 的状态": "运行" } },
            { t: "就绪 → 就绪挂起（另一条路）", d: "就绪进程也可能被挂起，例如用户请求暂停、或内存实在不够要换出一个就绪进程。", on: ["ready", "rs"], go: ["r_rs"], kv: { "P 的状态": "就绪挂起", "所在位置": "外存" }, tip: "挂起与阻塞的区别：挂起是“不在内存”，阻塞是“在等事件”；两者独立，组合出四种状态。" }
          ];
          return { w: 920, h: 440, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "pstate", name: "进程状态的相互转换", sub: "os",
          lead: "跟着一个进程从创建到终止，看每一次状态变化由什么事件引起。",
          note: ["就绪：万事俱备只欠 CPU；阻塞：在等某个事件（I/O、信号量）。", "运行 → 阻塞 主动；阻塞 → 就绪 被动；运行 → 就绪 多由时钟中断或抢占引起。", "不可能的转换：就绪 → 阻塞，阻塞 → 运行。", "单 CPU 时任一时刻至多一个进程处于运行态。", "挂起状态由中级调度管理，进程映像在外存。"],
          modes: [{ name: "五状态模型", make: five }, { name: "七状态模型（含挂起）", make: seven }]
        });

        /* ===================== 系统调用 ===================== */
        PROC.push({
          id: "syscall", name: "系统调用执行过程", sub: "os",
          lead: "以 write(fd, buf, n) 为例：用户程序如何借一条陷入指令进入内核，又如何回到用户态。",
          note: ["系统调用 = 用户程序请求 OS 服务的唯一接口。", "陷入（trap / 访管）指令在用户态执行，执行后 CPU 进入核心态。", "陷入属于内中断（自愿中断），由指令本身引起。", "参数通过寄存器或栈传递；系统调用号用来查系统调用表。", "库函数可能封装系统调用（如 printf 调用 write），但库函数本身运行在用户态。"],
          modes: [{
            name: "write 调用",
            make: function () {
              var nodes = [
                { id: "zu", k: "zone", x: 20, y: 20, w: 320, h: 470, t: "用户态" },
                { id: "zk", k: "zone", x: 370, y: 20, w: 530, h: 470, t: "核心态（内核）" },
                { id: "prep", k: "box", x: 45, y: 60, w: 270, h: 56, t: "准备参数：调用号→寄存器\nfd、buf、n → 寄存器/栈", sm: 1 },
                { id: "trap", k: "box", x: 45, y: 160, w: 270, h: 50, t: "执行陷入指令（trap / int 0x80）", sm: 1 },
                { id: "hw", k: "box", x: 400, y: 60, w: 470, h: 50, t: "硬件：用户态 → 核心态，保存 PC、PSW", sm: 1 },
                { id: "entry", k: "box", x: 400, y: 140, w: 220, h: 50, t: "系统调用总入口\n（中断向量表）", sm: 1 },
                { id: "save", k: "box", x: 650, y: 140, w: 220, h: 50, t: "保存现场\n（通用寄存器）", sm: 1 },
                { id: "tab", k: "table", x: 400, y: 222, w: 220, h: 126, rh: 20, t: "系统调用表", cols: [0.22], rows: [["0", "sys_read"], ["1", "sys_write"], ["2", "sys_open"], ["3", "sys_close"], ["…", "…"]] },
                { id: "svc", k: "box", x: 650, y: 250, w: 220, h: 60, t: "内核服务例程\nsys_write", sm: 1 },
                { id: "ret", k: "box", x: 400, y: 400, w: 470, h: 56, t: "返回值 → 寄存器；恢复现场\n执行返回指令（iret / sysret），回到用户态", sm: 1 },
                { id: "resume", k: "box", x: 45, y: 400, w: 270, h: 56, t: "从陷入指令的下一条继续\n取返回值（写了多少字节）", sm: 1 }
              ];
              var edges = [
                { id: "p_t", a: "prep", as: "b", b: "trap", bs: "t" },
                { id: "t_h", a: "trap", as: "r", b: "hw", bs: "l", t: "陷入" },
                { id: "h_e", a: "hw", as: "b", ao: -125, b: "entry", bs: "t" },
                { id: "e_s", a: "entry", b: "save" },
                { id: "s_t", a: "save", as: "b", b: "tab", bs: "r", bo: -40, pts: [[760, 245]], t: "按调用号 1 查表", lp: [700, 220] },
                { id: "t_v", a: "tab", as: "r", bo: 0, b: "svc", bs: "l", t: "转入" },
                { id: "v_r", a: "svc", as: "b", b: "ret", bs: "t", bo: 125 },
                { id: "r_u", a: "ret", as: "l", b: "resume", bs: "r", t: "返回用户态" }
              ];
              var S = [
                { t: "用户程序要写文件", d: "用户态程序不能直接操作磁盘、也不能执行特权指令，必须请求 OS 代劳。C 库函数 write() 内部会发起系统调用。", kv: { "CPU 模式": "用户态" } },
                { t: "准备参数", d: "把系统调用号（write 设为 1）放入约定寄存器，把 fd、buf、n 等参数放入寄存器或压栈。", on: ["prep"] },
                { t: "执行陷入指令", d: "执行 trap（x86 上是 int 0x80 或 syscall）。这是一条用户态可以执行的非特权指令，作用就是主动引发中断。", on: ["trap"], go: ["p_t"], tip: "陷入指令本身在用户态执行；它引起的处理程序在核心态执行。" },
                { t: "硬件切换到核心态", d: "CPU 响应这个内中断：把 PSW 的模式位改为核心态，保存断点 PC 和 PSW（压入内核栈），按中断号查中断向量表。", on: ["hw"], go: ["t_h"], kv: { "CPU 模式": "核心态" } },
                { t: "进入系统调用总入口", d: "所有系统调用共用一个中断号，进入同一个处理入口。", on: ["entry"], go: ["h_e"] },
                { t: "保存现场", d: "入口程序把用户程序的通用寄存器保存到内核栈，避免内核代码覆盖它们。", on: ["save"], go: ["e_s"] },
                { t: "按调用号查系统调用表", d: "用寄存器里的调用号 1 作为下标查系统调用表，找到 sys_write 的入口地址。", on: ["tab"], go: ["s_t"], set: { tab: { hi: 1 } } },
                { t: "执行内核服务例程", d: "sys_write 检查参数合法性，通过文件系统和设备驱动把 buf 中的 n 个字节写出。若要等待磁盘，进程可能在这里被阻塞，CPU 转去调度别的进程。", on: ["svc"], go: ["t_v"] },
                { t: "返回值放寄存器，恢复现场", d: "把实际写入的字节数（或错误码）放入约定寄存器；恢复用户寄存器；执行中断返回指令，恢复 PC 和 PSW。", on: ["ret"], go: ["v_r"] },
                { t: "回到用户态继续执行", d: "PSW 模式位恢复为用户态，程序从陷入指令的下一条继续，读取返回值。", on: ["resume"], go: ["r_u"], kv: { "CPU 模式": "用户态" }, tip: "用户态 → 核心态只能通过中断（含陷入、异常）；核心态 → 用户态通过一条特权指令（修改 PSW / 中断返回）。" }
              ];
              return { w: 920, h: 510, nodes: nodes, edges: edges, steps: S };
            }
          }]
        });

        /* ===================== 进程切换 ===================== */
        PROC.push({
          id: "pswitch", name: "进程切换过程", sub: "os",
          lead: "时钟中断到来，进程 A 的时间片用完：内核保存 A、选中 B、切换地址空间、恢复 B。",
          note: ["进程切换一定发生在核心态。", "调度是“选谁”，切换是“换过去”；先调度后切换。", "切换开销：保存恢复上下文、更新 PCB 与队列、切换页表、TLB 和 Cache 失效。", "不能进行调度与切换的情况：处理中断过程中、原子操作（原语）中、临界区内（访问内核临界资源时）。"],
          modes: [{
            name: "A → B",
            make: function () {
              var pcb = function (n, st, pc, pt) { return [["状态", st], ["PC", pc], ["PSW / 寄存器", n === "A" ? "已保存" : "已保存"], ["页表基址", pt]]; };
              var nodes = [
                { id: "PA", k: "table", x: 20, y: 40, w: 240, h: 112, rh: 20, t: "PCB(A)", cols: [0.42], rows: pcb("A", "运行", "—", "0x3000") },
                { id: "CPU", k: "table", x: 370, y: 40, w: 240, h: 112, rh: 20, t: "CPU 寄存器", cols: [0.42], rows: [["PC", "A: 0x0420"], ["PSW", "用户态"], ["通用寄存器", "A 的值"], ["页表基址寄存器", "0x3000"]] },
                { id: "PB", k: "table", x: 720, y: 40, w: 240, h: 112, rh: 20, t: "PCB(B)", cols: [0.42], rows: pcb("B", "就绪", "0x0800", "0x7000") },
                { id: "INT", k: "term", x: 370, y: 200, w: 240, h: 44, t: "时钟中断 → 进入内核", sm: 1 },
                { id: "SCH", k: "box", x: 370, y: 300, w: 240, h: 50, t: "进程调度程序" },
                { id: "RQ", k: "box", x: 20, y: 300, w: 240, h: 50, t: "就绪队列", v: "B → C" },
                { id: "MMU", k: "box", x: 720, y: 300, w: 240, h: 50, t: "MMU：页表基址寄存器、TLB", sm: 1 }
              ];
              var edges = [
                { id: "c_i", a: "CPU", as: "b", b: "INT", bs: "t", t: "时间片到" },
                { id: "c_a", a: "CPU", as: "l", b: "PA", bs: "r", t: "保存上下文" },
                { id: "a_q", a: "PA", as: "b", b: "RQ", bs: "t", t: "插入队尾" },
                { id: "q_s", a: "RQ", b: "SCH", t: "选中 B" },
                { id: "s_b", a: "SCH", as: "r", b: "PB", bs: "b", pts: [[840, 325]], dash: 1 },
                { id: "b_m", a: "PB", as: "b", ao: 60, b: "MMU", bs: "t", bo: 60, t: "页表基址" },
                { id: "b_c", a: "PB", as: "l", b: "CPU", bs: "r", t: "恢复上下文" }
              ];
              var S = [
                { t: "A 正在运行", d: "CPU 正在执行进程 A，PC = 0x0420，页表基址寄存器指向 A 的页表 0x3000。B 在就绪队列中等待。", on: ["CPU"], kv: { "当前进程": "A", "CPU 模式": "用户态" } },
                { t: "时钟中断，进入内核", d: "时钟中断到来，硬件保存 A 的断点和 PSW，切到核心态；时钟中断处理程序发现 A 的时间片用完，置“需要调度”标志。", on: ["CPU", "INT"], go: ["c_i"], set: { CPU: { rows: [["PC", "内核代码"], ["PSW", "核心态"], ["通用寄存器", "A 的值"], ["页表基址寄存器", "0x3000"]] } }, kv: { "CPU 模式": "核心态" } },
                { t: "保存 A 的上下文到 PCB(A)", d: "把 A 的 PC（断点 0x0420）、PSW 和通用寄存器存入 PCB(A)。", on: ["CPU", "PA"], go: ["c_a"], set: { PA: { rows: pcb("A", "运行", "0x0420", "0x3000"), hi: 1 } } },
                { t: "修改 A 的状态，移入就绪队列", d: "A 只是时间片到，不缺资源，所以状态 运行 → 就绪，插入就绪队列队尾。", on: ["PA", "RQ"], go: ["a_q"], set: { PA: { rows: pcb("A", "就绪", "0x0420", "0x3000"), hi: 0 }, RQ: { v: "B → C → A" } } },
                { t: "调度程序选中 B", d: "按调度算法（这里是时间片轮转，取队首）选中 B，并把 B 移出就绪队列。", on: ["RQ", "SCH"], go: ["q_s"], set: { RQ: { v: "C → A" } } },
                { t: "修改 B 的状态为运行", d: "更新 PCB(B)：状态 就绪 → 运行。", on: ["SCH", "PB"], go: ["s_b"], set: { PB: { rows: pcb("B", "运行", "0x0800", "0x7000"), hi: 0 } }, kv: { "当前进程": "B" } },
                { t: "切换地址空间", d: "把 B 的页表基址 0x7000 装入页表基址寄存器；A 的 TLB 项对 B 无效，需要刷新 TLB（或用地址空间标识 ASID 区分）。", on: ["PB", "MMU"], go: ["b_m"], set: { CPU: { rows: [["PC", "内核代码"], ["PSW", "核心态"], ["通用寄存器", "A 的值"], ["页表基址寄存器", "0x7000"]] }, MMU: { badge: "TLB 已刷新" } }, tip: "同一进程内的线程切换不需要切换页表，所以比进程切换开销小。" },
                { t: "恢复 B 的上下文", d: "从 PCB(B) 恢复通用寄存器、PSW 和 PC。", on: ["PB", "CPU"], go: ["b_c"], set: { CPU: { rows: [["PC", "B: 0x0800"], ["PSW", "用户态"], ["通用寄存器", "B 的值"], ["页表基址寄存器", "0x7000"]] }, PB: { hi: 1 } } },
                { t: "返回用户态，B 开始运行", d: "中断返回，CPU 回到用户态，从 B 上次被打断的地方 0x0800 继续执行。", on: ["CPU"], kv: { "CPU 模式": "用户态" }, tip: "进程切换后 Cache、TLB 中的内容大多失效，B 刚开始运行时命中率会下降，这是切换的隐性开销。" }
              ];
              return { w: 980, h: 380, nodes: nodes, edges: edges, steps: S };
            }
          }]
        });

        /* ===================== 二级页表（可输入） ===================== */
        function twoLevel(inp) {
          var va = U.parseHex(inp.va);
          if (va == null) throw new Error("请输入 32 位十六进制虚拟地址，例如 00403A7C");
          var fault = inp.pte === "fault";
          var dir = va >>> 22, tbl = (va >>> 12) & 0x3FF, off = va & 0xFFF, PDBR = 0x00100000;
          var ptFrame = (0x200 + (U.mix(dir, 1) & 0xFF)) >>> 0;
          var frame = ((U.mix(dir, tbl) % 0x3F000) + 0x1000) >>> 0;
          var pdeAddr = (PDBR + dir * 4) >>> 0, pteAddr = ((ptFrame << 12) + tbl * 4) >>> 0, pa = ((frame << 12) | off) >>> 0;
          function near(i, max, fn) {
            var r = [], hi = 0;
            for (var k = i - 1; k <= i + 1; k++) { if (k < 0 || k > max) continue; if (k === i) hi = r.length; r.push(fn(k)); }
            return { rows: r, hi: hi };
          }
          var pd = near(dir, 1023, function (k) { return ["#" + k, k === dir ? "页框 " + hx(ptFrame, 3) + "  V=1" : "页框 " + hx(0x200 + (U.mix(k, 1) & 0xFF), 3) + "  V=1"]; });
          var pt = near(tbl, 1023, function (k) { return ["#" + k, k === tbl ? (fault ? "—  V=0" : "页框 " + hx(frame, 5) + "  V=1") : "页框 " + hx(((U.mix(dir, k) % 0x3F000) + 0x1000) >>> 0, 5) + "  V=1"]; });
          var vaSegs = function (on) { return [{ t: "页目录号", b: 10, v: on ? dir + "（" + hx(dir, 3) + "）" : "" }, { t: "页表索引", b: 10, v: on ? tbl + "（" + hx(tbl, 3) + "）" : "" }, { t: "页内偏移", b: 12, v: on ? hx(off, 3) : "" }]; };
          var paSegs = function (k) { return [{ t: "物理页框号", b: 20, v: k ? hx(frame, 5) : "" }, { t: "页内偏移", b: 12, v: k > 1 ? hx(off, 3) : "" }]; };
          var nodes = [
            { id: "VA", k: "fields", x: 40, y: 50, w: 540, h: 60, t: "虚拟地址 " + hx(va, 8), segs: vaSegs(0) },
            { id: "PDBR", k: "reg", x: 40, y: 175, w: 150, h: 50, t: "页目录基址 PDBR", v: hx(PDBR, 8) },
            { id: "PD", k: "table", x: 240, y: 160, w: 210, h: 90, rh: 20, t: "页目录（1024 项）", cols: [0.26], rows: pd.rows },
            { id: "PT", k: "table", x: 540, y: 160, w: 210, h: 90, rh: 20, t: "二级页表（1024 项）", cols: [0.26], rows: pt.rows },
            { id: "PF", k: "box", x: 800, y: 168, w: 140, h: 74, t: "缺页中断\nOS 从外存调入\n更新页表项", sm: 1 },
            { id: "PA", k: "fields", x: 240, y: 360, w: 440, h: 60, t: "物理地址", segs: paSegs(0) },
            { id: "MEM", k: "box", x: 760, y: 360, w: 170, h: 60, t: "主存中的数据" }
          ];
          var edges = [
            { id: "pdbr_pd", a: "PDBR", b: "PD", t: "基址" },
            { id: "va_pd", a: "VA", as: "b", ao: -180, b: "PD", bs: "t", bo: -15, pts: [[90, 135], [330, 135]], t: "×4", lp: [200, 135] },
            { id: "pd_pt", a: "PD", b: "PT", t: "页框号" },
            { id: "va_pt", a: "VA", as: "b", ao: -10, b: "PT", bs: "t", bo: -50, pts: [[300, 125], [595, 125]], t: "×4", lp: [470, 125] },
            { id: "pt_pf", a: "PT", b: "PF", t: "V=0" },
            { id: "pt_pa", a: "PT", as: "b", b: "PA", bs: "t", bo: 0, pts: [[645, 300], [460, 300]], t: "页框号", lp: [535, 300] },
            { id: "va_pa", a: "VA", as: "r", b: "PA", bs: "t", bo: 190, pts: [[775, 80], [775, 320], [650, 320]], dash: 1, t: "偏移不变", lp: [775, 120] },
            { id: "pa_m", a: "PA", b: "MEM", t: "访存" }
          ];
          var mem = 0, disk = 0, S = [];
          S.push({ t: "已知条件", d: "32 位虚拟地址，页大小 4KB → 页内偏移 12 位；页表项 4B → 一页能放 4KB / 4B = 1024 项 → 每级索引 10 位。所以虚拟地址 = 10 位页目录号 ‖ 10 位页表索引 ‖ 12 位偏移。PDBR 指向页目录 " + hx(PDBR, 8) + "。", kv: { "访存次数": "0" } });
          S.push({ t: "拆分虚拟地址", d: hx(va, 8) + " = " + U.bin(dir, 10) + " | " + U.bin(tbl, 10) + " | " + U.bin(off, 12) + "，即页目录号 " + dir + "、页表索引 " + tbl + "、页内偏移 " + hx(off, 3) + "。", on: ["VA"], set: { VA: { segs: vaSegs(1) } }, kv: { "页目录号": String(dir), "页表索引": String(tbl), "页内偏移": hx(off, 3) } });
          S.push({ t: "计算页目录项地址", d: "页目录项地址 = PDBR + 页目录号 × 4 = " + hx(PDBR, 8) + " + " + dir + " × 4 = " + hx(pdeAddr, 8) + "。", on: ["PDBR", "VA"], kv: { "页目录项地址": hx(pdeAddr, 8) }, tip: "乘的是页表项大小（4B），因为主存按字节编址。" });
          S.push({ t: "第 1 次访存：读页目录项", d: "读出第 " + dir + " 项：有效位 1，二级页表存放在页框 " + hx(ptFrame, 3) + "。", on: ["PDBR", "PD"], go: ["pdbr_pd", "va_pd"], set: { PD: { hi: pd.hi } }, kv: { "访存次数": String(++mem) } });
          S.push({ t: "计算页表项地址", d: "二级页表起始地址 = 页框号 × 4KB = " + hx(ptFrame << 12, 8) + "；页表项地址 = " + hx(ptFrame << 12, 8) + " + " + tbl + " × 4 = " + hx(pteAddr, 8) + "。", on: ["PD", "VA"], kv: { "页表项地址": hx(pteAddr, 8) } });
          if (fault) {
            S.push({ t: "第 2 次访存：页表项无效", d: "读出第 " + tbl + " 项，有效位 V = 0，该页不在主存。", on: ["PD", "PT"], go: ["pd_pt", "va_pt"], set: { PT: { hi: pt.hi, bad: pt.hi } }, kv: { "访存次数": String(++mem) } });
            S.push({ t: "缺页中断，OS 调页", d: "产生缺页异常，OS 选页框（必要时置换）、从外存读入该页，把页框号 " + hx(frame, 5) + " 和 V=1 写入页表项，然后重新执行该指令。", on: ["PT", "PF"], go: ["pt_pf"], set: { PT: { rows: near(tbl, 1023, function (k) { return ["#" + k, k === tbl ? "页框 " + hx(frame, 5) + "  V=1" : "页框 " + hx(((U.mix(dir, k) % 0x3F000) + 0x1000) >>> 0, 5) + "  V=1"]; }).rows, bad: -1 } }, kv: { "访问磁盘": String(++disk) } });
            S.push({ t: "重新执行：再查两级页表", d: "指令重新执行，再访存 2 次（页目录项、页表项），这次页表项有效，得到页框号 " + hx(frame, 5) + "。", on: ["PD", "PT"], go: ["pdbr_pd", "pd_pt"], set: { PT: { hi: pt.hi } }, kv: { "访存次数": String(mem += 2) } });
          } else {
            S.push({ t: "第 2 次访存：读页表项", d: "读出第 " + tbl + " 项：有效位 1，页框号 " + hx(frame, 5) + "。", on: ["PD", "PT"], go: ["pd_pt", "va_pt"], set: { PT: { hi: pt.hi } }, kv: { "访存次数": String(++mem) } });
          }
          S.push({ t: "拼出物理地址", d: "物理地址 = 页框号 ‖ 页内偏移 = " + hx(frame, 5) + " ‖ " + hx(off, 3) + " = " + hx(pa, 8) + "。", on: ["PT", "PA", "VA"], go: ["pt_pa", "va_pa"], set: { PA: { segs: paSegs(2), t: "物理地址 " + hx(pa, 8) } }, kv: { "物理地址": hx(pa, 8) } });
          S.push({ t: "第 " + (mem + 1) + " 次访存：取数据", d: "用物理地址访问主存，取得真正要的数据。", on: ["PA", "MEM"], go: ["pa_m"], kv: { "访存次数": String(++mem) } });
          S.push({ t: "小结", d: fault ? "缺页时共访存 " + mem + " 次、访问磁盘 1 次。" : "没有快表时，二级页表一次取数据要访存 3 次：页目录 1 次 + 页表 1 次 + 数据 1 次。有 TLB 且命中时只需 1 次。", kv: { "访存次数": String(mem) }, tip: "二级页表的好处：页目录常驻内存即可，二级页表按需调入，不必为整个 4GB 地址空间连续存放 4MB 的页表。" });
          return { w: 960, h: 450, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "twolevel", name: "二级页表地址转换", sub: "os",
          lead: "输入一个 32 位虚拟地址，看它怎样经过页目录、二级页表变成物理地址，以及一共访存几次。",
          note: ["每级页表项数 = 页大小 / 页表项大小；索引位数 = log2(项数)。", "页表项地址 = 页表起始地址 + 索引 × 页表项大小。", "n 级页表、无 TLB：取一次数据访存 n + 1 次。", "顶级页表（页目录）最多只能占一页，常用来反推级数。", "多级页表省的是内存空间，代价是访存次数增加，所以要配 TLB。"],
          inputs: [
            { k: "va", label: "虚拟地址（十六进制）", value: "00403A7C", ph: "例如 00403A7C" },
            { k: "pte", label: "页表项", type: "select", value: "ok", opts: [["ok", "有效（页在主存）"], ["fault", "无效（缺页）"]] }
          ],
          modes: [{ name: "地址转换", make: twoLevel, presets: [{ label: "0x00403A7C", v: { va: "00403A7C", pte: "ok" } }, { label: "0xC0001234", v: { va: "C0001234", pte: "ok" } }, { label: "缺页", v: { va: "08048ABC", pte: "fault" } }] }]
        });

        /* ===================== 混合索引分配（可输入） ===================== */
        function mixIndex(inp) {
          var off = U.parseInt10(inp.off), B = Number(inp.bs) || 1024;
          if (off == null) throw new Error("请输入文件内的字节偏移（十进制整数），例如 10240");
          var NP = B / 4, D = 10;
          var maxB = D + NP + NP * NP + NP * NP * NP;
          var lbn = Math.floor(off / B), inb = off % B;
          if (lbn >= maxB) throw new Error("超出最大文件长度：块号上限 " + (maxB - 1) + "（约 " + fmtBytes(maxB * B) + "）");
          var level, idx = [], r = lbn;
          if (r < D) { level = 0; idx = [r]; }
          else if ((r -= D) < NP) { level = 1; idx = [r]; }
          else if ((r -= NP) < NP * NP) { level = 2; idx = [Math.floor(r / NP), r % NP]; }
          else { r -= NP * NP; level = 3; idx = [Math.floor(r / (NP * NP)), Math.floor(r / NP) % NP, r % NP]; }
          var LV = ["直接地址", "一次间接", "二次间接", "三次间接"];
          var blk = function (a, b) { return 100 + (U.mix(a * 977 + 13, b) % 90000); };
          var inodeRows = [["i_addr[0]", "块 " + blk(0, 0)], ["i_addr[1]", "块 " + blk(1, 0)], ["…", "…"], ["i_addr[9]", "块 " + blk(9, 0)], ["i_addr[10]", "一次间接 → 块 " + blk(10, 1)], ["i_addr[11]", "二次间接 → 块 " + blk(11, 2)], ["i_addr[12]", "三次间接 → 块 " + blk(12, 3)]];
          var inodeHi = level === 0 ? (lbn === 0 ? 0 : lbn === 1 ? 1 : lbn === 9 ? 3 : 2) : 3 + level;
          if (level === 0 && lbn > 1 && lbn < 9) inodeRows[2] = ["i_addr[" + lbn + "]", "块 " + blk(lbn, 0)];
          var chain = [blk(10 + level - 1, level)];
          for (var k = 0; k < idx.length; k++) chain.push(blk(chain[k], idx[k]));
          var dataBlock = level === 0 ? blk(lbn, 0) : chain[chain.length - 1];
          function idxRows(i, sel, blkNo) {
            var rows = [], hi = 0;
            for (var j = sel - 1; j <= sel + 1; j++) { if (j < 0 || j >= NP) continue; if (j === sel) hi = rows.length; rows.push(["[" + j + "]", "块 " + blk(blkNo, j)]); }
            return { rows: rows, hi: hi, title: "索引块 " + blkNo };
          }
          var nodes = [
            { id: "IN", k: "table", x: 30, y: 40, w: 230, h: 172, rh: 20, t: "索引结点（inode，已在内存）", cols: [0.36], rows: inodeRows },
            { id: "L1", k: "table", x: 300, y: 60, w: 190, h: 90, rh: 20, t: "第 1 级索引块", cols: [0.3], rows: [["—"]] },
            { id: "L2", k: "table", x: 520, y: 60, w: 190, h: 90, rh: 20, t: "第 2 级索引块", cols: [0.3], rows: [["—"]] },
            { id: "L3", k: "table", x: 740, y: 60, w: 190, h: 90, rh: 20, t: "第 3 级索引块", cols: [0.3], rows: [["—"]] },
            { id: "DATA", k: "box", x: 740, y: 300, w: 190, h: 70, t: "数据块", v: "—" }
          ];
          var edges = [
            { id: "in_l1", a: "IN", as: "r", ao: 50, b: "L1", bs: "l", t: "" },
            { id: "l1_l2", a: "L1", b: "L2" },
            { id: "l2_l3", a: "L2", b: "L3" },
            { id: "in_d", a: "IN", as: "b", b: "DATA", bs: "l", bo: 18, t: "直接地址" },
            { id: "l1_d", a: "L1", as: "b", b: "DATA", bs: "l", bo: 2 },
            { id: "l2_d", a: "L2", as: "b", b: "DATA", bs: "l", bo: -14 },
            { id: "l3_d", a: "L3", as: "b", b: "DATA", bs: "t" }
          ];
          var disk = 0, S = [], ranges = "直接 0–" + (D - 1) + "；一次间接 " + D + "–" + (D + NP - 1) + "；二次间接 " + (D + NP) + "–" + (D + NP + NP * NP - 1) + "；三次间接 " + (D + NP + NP * NP) + " 起";
          S.push({ t: "已知条件", d: "索引结点含 10 个直接地址、1 个一次间接、1 个二次间接、1 个三次间接地址；块大小 " + B + "B，地址项 4B，所以一个索引块能放 " + B + " / 4 = " + NP + " 个地址。", kv: { "每块地址数": String(NP), "最大文件": fmtBytes(maxB * B), "读盘次数": "0" } });
          S.push({ t: "计算逻辑块号", d: "逻辑块号 = ⌊" + off + " / " + B + "⌋ = " + lbn + "，块内偏移 = " + off + " mod " + B + " = " + inb + "。", kv: { "逻辑块号": String(lbn), "块内偏移": String(inb) } });
          S.push({ t: "判断落在哪一级：" + LV[level], d: "各级覆盖的逻辑块号：" + ranges + "。块号 " + lbn + " 落在" + LV[level] + (level ? "，在该级内的序号是 " + (lbn - (level === 1 ? D : level === 2 ? D + NP : D + NP + NP * NP)) + (level >= 2 ? "，拆成各级下标 " + idx.join(" / ") : "") : "") + "。", kv: { "所在级别": LV[level] } , tip: level >= 2 ? "二次间接内序号 r：第 1 级下标 = ⌊r / " + NP + "⌋，第 2 级下标 = r mod " + NP + "。三次间接同理再除一次。" : null });
          S.push({ t: "查索引结点", d: level === 0 ? "直接读出 i_addr[" + lbn + "]，就是数据块号 " + dataBlock + "。文件打开后索引结点已在内存，不需要读盘。" : "读出 i_addr[" + (9 + level) + "]，得到第 1 级索引块号 " + chain[0] + "。索引结点已在内存，不读盘。", on: ["IN"], set: { IN: { hi: inodeHi } } });
          var Ls = ["L1", "L2", "L3"], E = ["in_l1", "l1_l2", "l2_l3"];
          for (var lv = 0; lv < level; lv++) {
            var ir = idxRows(lv, idx[lv], chain[lv]), set = {};
            set[Ls[lv]] = { rows: ir.rows, hi: ir.hi, t: "第 " + (lv + 1) + " 级 · " + ir.title };
            S.push({ t: "读盘：第 " + (lv + 1) + " 级索引块 " + chain[lv], d: "把索引块 " + chain[lv] + " 读入内存，取第 " + idx[lv] + " 项，得到 " + (lv === level - 1 ? "数据块号 " + chain[lv + 1] : "下一级索引块号 " + chain[lv + 1]) + "。", on: [lv ? Ls[lv - 1] : "IN", Ls[lv]], go: [E[lv]], set: set, kv: { "读盘次数": String(++disk) } });
          }
          S.push({ t: "读盘：数据块 " + dataBlock, d: "读入数据块，块内偏移 " + inb + " 处就是要访问的字节。", on: ["DATA", level ? Ls[level - 1] : "IN"], go: [level === 0 ? "in_d" : ["l1_d", "l2_d", "l3_d"][level - 1]], set: { DATA: { v: "块 " + dataBlock + " · 偏移 " + inb } }, kv: { "读盘次数": String(++disk) } });
          S.push({ t: "小结", d: "访问该字节共读盘 " + disk + " 次（" + (level ? level + " 次读索引块 + " : "") + "1 次读数据块）。", kv: { "读盘次数": String(disk) }, tip: "若题目说索引结点不在内存，要再加 1 次；最大文件长度 = (10 + N + N² + N³) × 块大小，N = 块大小 / 地址项大小。" });
          return { w: 960, h: 400, nodes: nodes, edges: edges, steps: S };
        }
        function fmtBytes(n) {
          if (n >= Math.pow(2, 40)) return (n / Math.pow(2, 40)).toFixed(2).replace(/\.?0+$/, "") + " TB";
          if (n >= Math.pow(2, 30)) return (n / Math.pow(2, 30)).toFixed(2).replace(/\.?0+$/, "") + " GB";
          if (n >= Math.pow(2, 20)) return (n / Math.pow(2, 20)).toFixed(2).replace(/\.?0+$/, "") + " MB";
          return (n / 1024).toFixed(2).replace(/\.?0+$/, "") + " KB";
        }
        PROC.push({
          id: "mixidx", name: "混合索引分配", sub: "os",
          lead: "UNIX 式索引结点：10 个直接地址 + 一、二、三次间接。输入文件内的字节偏移，看要读几次盘。",
          note: ["逻辑块号 = ⌊偏移 / 块大小⌋，块内偏移 = 偏移 mod 块大小。", "每块地址数 N = 块大小 / 地址项大小。", "范围：直接 10 块，一次间接 N 块，二次间接 N² 块，三次间接 N³ 块。", "访问 k 次间接的块：读 k 个索引块 + 1 个数据块。", "小文件只用直接地址，访问快；大文件才用多级间接。"],
          inputs: [
            { k: "off", label: "文件内字节偏移（十进制）", value: "300000", ph: "例如 300000", num: 1 },
            { k: "bs", label: "块大小", type: "select", value: "1024", opts: [["1024", "1KB"], ["4096", "4KB"]] }
          ],
          modes: [{ name: "按偏移查找", make: mixIndex, presets: [{ label: "直接（5000）", v: { off: "5000", bs: "1024" } }, { label: "一次间接（10240）", v: { off: "10240", bs: "1024" } }, { label: "二次间接（300000）", v: { off: "300000", bs: "1024" } }, { label: "三次间接（80000000）", v: { off: "80000000", bs: "1024" } }] }]
        });
        PROCU.mixIndexCalc = function (off, B) { var NP = B / 4, D = 10, lbn = Math.floor(off / B), r = lbn; if (r < D) return [0, [r]]; if ((r -= D) < NP) return [1, [r]]; if ((r -= NP) < NP * NP) return [2, [Math.floor(r / NP), r % NP]]; r -= NP * NP; return [3, [Math.floor(r / (NP * NP)), Math.floor(r / NP) % NP, r % NP]]; };

        /* ===================== 设备分配 ===================== */
        function devAlloc(busy) {
          var dct = function (st) { return [["设备", "打印机 #2"], ["状态", st], ["等待队列", "空"], ["→ COCT", "控制器 1"]]; };
          var coct = function (st, q) { return [["控制器", "1"], ["状态", st], ["等待队列", q], ["→ CHCT", "通道 0"]]; };
          var chct = function (st) { return [["通道", "0"], ["状态", st], ["等待队列", "空"]]; };
          var nodes = [
            { id: "REQ", k: "term", x: 20, y: 60, w: 160, h: 46, t: "进程 P 请求\n逻辑设备“打印机”", sm: 1 },
            { id: "LUT", k: "table", x: 240, y: 30, w: 180, h: 90, rh: 20, t: "逻辑设备表 LUT", cols: [0.45], rows: [["逻辑名", "物理设备"], ["打印机", "#2"], ["磁带", "#5"]] },
            { id: "SDT", k: "table", x: 490, y: 30, w: 200, h: 110, rh: 20, t: "系统设备表 SDT", cols: [0.3], rows: [["#1", "打印机 → DCT1"], ["#2", "打印机 → DCT2"], ["#3", "磁盘 → DCT3"], ["…", "…"]] },
            { id: "DCT", k: "table", x: 760, y: 30, w: 200, h: 110, rh: 20, t: "设备控制表 DCT2", cols: [0.4], rows: dct("空闲") },
            { id: "COCT", k: "table", x: 490, y: 220, w: 200, h: 110, rh: 20, t: "控制器控制表 COCT", cols: [0.4], rows: coct(busy ? "忙（P2 使用中）" : "空闲", "空") },
            { id: "CHCT", k: "table", x: 240, y: 220, w: 180, h: 90, rh: 20, t: "通道控制表 CHCT", cols: [0.4], rows: chct("空闲") },
            { id: "GO", k: "term", x: 20, y: 240, w: 160, h: 50, t: "启动 I/O", sm: 1 },
            { id: "Q", k: "box", x: 490, y: 380, w: 200, h: 50, t: "控制器等待队列", v: "空" }
          ];
          var edges = [
            { id: "r_l", a: "REQ", b: "LUT", t: "逻辑名" },
            { id: "l_s", a: "LUT", b: "SDT", t: "设备号" },
            { id: "s_d", a: "SDT", b: "DCT", t: "DCT" },
            { id: "d_c", a: "DCT", as: "b", b: "COCT", bs: "r", pts: [[860, 275]], t: "COCT 指针", lp: [860, 200] },
            { id: "c_h", a: "COCT", as: "l", b: "CHCT", bs: "r", bo: 10, t: "CHCT" },
            { id: "h_g", a: "CHCT", as: "l", b: "GO", bs: "r", bo: 0 },
            { id: "c_q", a: "COCT", as: "b", b: "Q", bs: "t", t: "忙：P 阻塞排队" }
          ];
          var S = [
            { t: "进程用逻辑名申请设备", d: "P 只说要一台“打印机”，不指定是哪一台。这体现了设备独立性：程序与具体物理设备无关。", on: ["REQ"] },
            { t: "查 LUT：逻辑名 → 物理设备", d: "逻辑设备表把逻辑名映射到实际分配的物理设备 #2（第一次申请时由系统选一台空闲的并登记到 LUT）。", on: ["REQ", "LUT"], go: ["r_l"], set: { LUT: { hi: 1 } } },
            { t: "查 SDT：找到设备控制表", d: "系统设备表整个系统一张，每台设备一项，记录设备类型、标识符和它的 DCT 指针。", on: ["LUT", "SDT"], go: ["l_s"], set: { SDT: { hi: 1 } } },
            { t: "查 DCT：设备空闲 → 分配设备", d: "DCT2 中设备状态为“空闲”，且分配是安全的（不会导致死锁），把设备分配给 P。若设备忙，P 会插入设备等待队列。", on: ["SDT", "DCT"], go: ["s_d"], set: { DCT: { rows: dct("忙（已分配给 P）"), hi: 1 } } },
            { t: "由 DCT 找到 COCT", d: "设备要通过控制器才能工作，DCT 里有指向它所连控制器的 COCT 指针。", on: ["DCT", "COCT"], go: ["d_c"], set: { COCT: { hi: 1 } } }
          ];
          if (busy) {
            S.push({ t: "控制器忙：P 进入控制器等待队列", d: "控制器 1 正被 P2 使用，P 插入 COCT 的等待队列并阻塞。已经分到的设备仍然保留给 P。", on: ["COCT", "Q"], go: ["c_q"], set: { Q: { v: "P" }, COCT: { rows: coct("忙（P2 使用中）", "P"), bad: 1 } }, tip: "设备、控制器、通道三者任何一个忙，进程都要在对应的等待队列中阻塞。" });
            S.push({ t: "P2 释放控制器，唤醒 P", d: "P2 的 I/O 完成后释放控制器，系统从等待队列中唤醒 P，把控制器分给它。", on: ["COCT", "Q"], set: { Q: { v: "空" }, COCT: { rows: coct("忙（已分配给 P）", "空"), hi: 1, bad: -1 } } });
          } else {
            S.push({ t: "控制器空闲 → 分配控制器", d: "COCT 状态为空闲，分配给 P。", on: ["COCT"], set: { COCT: { rows: coct("忙（已分配给 P）", "空"), hi: 1 } } });
          }
          S.push({ t: "由 COCT 找到 CHCT，分配通道", d: "控制器连接在通道上，查通道控制表；通道空闲，分配给 P。", on: ["COCT", "CHCT"], go: ["c_h"], set: { CHCT: { rows: chct("忙（已分配给 P）"), hi: 1 } } });
          S.push({ t: "三者都分配成功，启动 I/O", d: "设备、控制器、通道全部到手，才能启动这次 I/O 传送。", on: ["CHCT", "GO"], go: ["h_g"], tip: "四张表：SDT 系统唯一；DCT 每设备一张；COCT 每控制器一张；CHCT 每通道一张。分配顺序：设备 → 控制器 → 通道。" });
          return { w: 980, h: 450, nodes: nodes, edges: edges, steps: S };
        }
        PROC.push({
          id: "devalloc", name: "设备分配过程", sub: "os",
          lead: "进程用逻辑名申请一台打印机，系统依次查 LUT、SDT、DCT、COCT、CHCT，分配设备、控制器和通道。",
          note: ["数据结构：SDT → DCT → COCT → CHCT，逐级指针相连。", "分配顺序：设备 → 控制器 → 通道，任一忙则在对应队列等待。", "设备独立性：用户用逻辑设备名，系统用 LUT 映射到物理设备。", "安全分配：进程发出 I/O 请求后阻塞，不会“请求并保持”；不安全分配可能死锁。", "独占设备、共享设备、虚拟设备（SPOOLing 把独占设备改造成共享设备）。"],
          modes: [{ name: "全部空闲", make: function () { return devAlloc(false); } }, { name: "控制器忙", make: function () { return devAlloc(true); } }]
        });

        /* ===================== 操作系统引导 ===================== */
        PROC.push({
          id: "boot", name: "操作系统的引导过程", sub: "os",
          lead: "从按下电源到出现登录界面：固件、主引导记录、分区引导记录、内核依次接力。",
          note: ["引导程序（自举程序）固化在 ROM（BIOS / UEFI 固件）中。", "MBR 位于磁盘 0 号扇区：引导程序 + 分区表（+ 结束标志 55AA）。", "活动分区（引导分区）的第一个扇区是分区引导记录 PBR。", "顺序：BIOS → MBR → PBR → 启动管理程序 → 内核 → init 进程。", "现代计算机多用 UEFI + GPT，但“固件 → 引导程序 → 内核”的思路相同。"],
          modes: [{
            name: "BIOS + MBR",
            make: function () {
              var steps = [
                ["power", "加电，CPU 复位"], ["bios", "执行 ROM 中的 BIOS"], ["post", "硬件自检 POST"], ["find", "按启动顺序找引导设备"],
                ["mbr", "读磁盘 0 号扇区 MBR\n执行主引导程序"], ["part", "扫描分区表\n找到活动分区"], ["pbr", "读活动分区的引导记录 PBR"],
                ["mgr", "PBR 加载启动管理程序"], ["kern", "启动管理程序把内核\n装入内存并跳转执行"], ["init", "内核初始化\n（中断、内存、设备、文件系统）"], ["user", "创建第一个用户进程\ninit → 登录 / Shell"]
              ];
              var nodes = [], edges = [];
              steps.forEach(function (s, i) {
                var col = i < 6 ? 0 : 1, row = col ? i - 6 : i;
                nodes.push({ id: s[0], k: i === 0 || i === steps.length - 1 ? "term" : "box", x: col ? 330 : 40, y: 30 + row * 62, w: 240, h: 46, t: s[1], sm: 1 });
                if (i) edges.push({ id: "e" + i, a: steps[i - 1][0], as: i === 6 ? "r" : "b", b: s[0], bs: i === 6 ? "l" : "t", pts: i === 6 ? [[300, 363], [300, 53]] : undefined });
              });
              var disk = function (on) { return { segs: [{ t: "MBR", b: 1, w: 6, v: "扇区 0", on: on === 0 }, { t: "分区 1（活动）", b: 1, w: 7, v: "PBR", on: on === 1 }, { t: "分区 1 文件系统", b: 1, w: 14, v: on === 2 ? "内核文件" : "", on: on === 2 }, { t: "分区 2", b: 1, w: 8, v: "" }] }; };
              nodes.push({ id: "DISK", k: "fields", x: 40, y: 430, w: 820, h: 56, t: "磁盘布局", segs: disk(-1).segs, unit: 1 });
              nodes.push({ id: "MEM", k: "table", x: 620, y: 30, w: 240, h: 120, rh: 20, t: "内存中有什么", cols: [0.36], rows: [["ROM", "BIOS 固件"], ["0x7C00", "—"], ["…", "—"], ["1MB 以上", "—"]] });
              var memRows = function (a, b, c) { return [["ROM", "BIOS 固件"], ["0x7C00", a || "—"], ["…", b || "—"], ["1MB 以上", c || "—"]]; };
              var D = [
                ["按下电源，电源稳定后 CPU 复位，PC 被硬件置为一个固定地址（x86 为 0xFFFFFFF0），指向 ROM 中的固件。", null],
                ["CPU 执行 BIOS（基本输入输出系统）。此时内存（RAM）里还什么都没有，所以第一段程序只能放在断电不丢失的 ROM 里。", { MEM: { hi: 0 } }],
                ["上电自检（POST）：检查 CPU、内存、显卡、键盘等是否正常，初始化硬件。", null],
                ["按 BIOS 设置的启动顺序（硬盘、U 盘、光盘、网络）找到第一个可引导的设备。", null],
                ["把引导磁盘 0 号扇区（512B）的主引导记录 MBR 读入内存 0x7C00 并执行其中的主引导程序。", { DISK: disk(0), MEM: { rows: memRows("MBR 主引导程序"), hi: 1 } }],
                ["主引导程序检查 MBR 中的分区表（最多 4 个主分区），找到标记为“活动”的分区。", { DISK: disk(0) }],
                ["读入活动分区的第一个扇区——分区引导记录 PBR，并把控制权交给它。", { DISK: disk(1), MEM: { rows: memRows("PBR 分区引导程序"), hi: 1 } }],
                ["PBR 中的程序在本分区的文件系统里找到启动管理程序（如 Windows 的 bootmgr、Linux 的 GRUB）并加载。", { MEM: { rows: memRows("PBR", "启动管理程序"), hi: 2 } }],
                ["启动管理程序把操作系统内核从文件系统装入内存，跳转到内核入口。", { DISK: disk(2), MEM: { rows: memRows("PBR", "启动管理程序", "OS 内核"), hi: 3 } }],
                ["内核初始化：建立中断向量表、开启分页、初始化各类内核数据结构和设备驱动、挂载根文件系统。", null],
                ["内核创建第一个进程（Linux 的 init / systemd），由它再创建登录、Shell 等用户进程，系统启动完成。", null]
              ];
              var S = steps.map(function (s, i) {
                var st = { t: s[1].replace(/\n/g, ""), d: D[i][0], on: [s[0]].concat(i >= 4 && i <= 8 ? ["DISK"] : []).concat(D[i][1] && D[i][1].MEM ? ["MEM"] : []), go: i ? ["e" + i] : [], set: D[i][1] || undefined };
                if (i === 1) st.tip = "这段固化在 ROM 中的程序叫自举程序（bootstrap），也就是“引导程序”。";
                if (i === 4) st.tip = "MBR 只有 512B：446B 引导代码 + 64B 分区表（4 项 × 16B）+ 2B 结束标志 0x55AA。";
                if (i === 10) st.tip = "操作系统最终常驻内存的是内核；引导程序完成任务后就不再需要了。";
                return st;
              });
              return { w: 900, h: 500, nodes: nodes, edges: edges, steps: S };
            }
          }]
        });
      })();
