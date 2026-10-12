import re,os
T={
'ds-leaf':'叶子数 n₀ = n₂ + 1','ds-maxnodes':'二叉树结点上界','ds-complete':'完全二叉树高度','ds-nullptr':'空指针数 n + 1',
'ds-catalan':'卡特兰数','ds-forest':'树的结点、度与边','ds-huffman':'哈夫曼树结点数','ds-degree':'度之和 = 2e',
'ds-connect':'连通图边数界','ds-avlmin':'AVL 最少结点 N(h)','ds-btree':'B 树关键字与高度','ds-rbtree':'红黑树高度上界',
'ds-bsearch':'判定树与建堆代价','ds-sortbound':'排序下界与稳定性',
'co-fixed-range':'定点数表示范围','co-overflow':'补码溢出判断','co-ieee754':'IEEE 754 单精度','co-hamming':'海明码校验位数',
'co-mem-expand':'字扩展与位扩展','co-interleave':'低位交叉存储器','co-cache-addr':'Cache 地址划分','co-cache-ta':'Cache 平均访问时间',
'co-cpu-perf':'CPU 时间与 MIPS','co-amdahl':'Amdahl 定律','co-pipeline':'流水线性能指标','co-opcode':'扩展操作码',
'co-bus-bw':'总线带宽','co-io-overhead':'I/O 方式 CPU 占用',
'os-deadlock-min':'死锁资源下限','os-banker-safe':'银行家安全性','os-semaphore':'信号量的含义','os-sched-metrics':'周转与带权周转',
'os-eat':'有效访问时间 EAT','os-pt-levels':'多级页表级数','os-pt-size':'页表大小','os-belady':'Belady 异常',
'os-disk-time':'磁盘访问时间','os-mixed-index':'混合索引文件长度','os-bitmap':'位示图换算','os-fragment':'内部与外部碎片',
'os-pstate':'进程状态转换','os-bernstein':'Bernstein 条件',
'cn-nyquist':'奈奎斯特定理','cn-shannon':'香农定理','cn-delay':'时延带宽积','cn-arqu':'ARQ 信道利用率',
'cn-window':'GBN / SR 窗口上限','cn-csmacd':'CSMA/CD 最短帧长','cn-encoding':'编码与码元速率','cn-subnet':'子网与可用主机数',
'cn-aggregate':'路由聚合','cn-ipfrag':'IP 分片','cn-cwnd':'TCP 拥塞窗口','cn-tcpthru':'TCP 最大吞吐量',
'cn-tcpseq':'TCP 序号与确认号','cn-ether':'冲突域与广播域',
}
assert len(T)==56
for k,v in T.items(): assert len(v.replace(" ",""))<=14,(k,v,len(v))
done=0
for f in ['24-prop-ds.js','25-prop-co.js','26-prop-os.js','27-prop-cn.js']:
    s=open(f,encoding='utf8').read()
    def rep(m):
        global done
        i=m.group(2)
        if i not in T: return m.group(0)
        done+=1
        return m.group(0)+' toc: "'+T[i]+'",'
    s=re.sub(r'(id: "([a-z]+-[a-z0-9-]+)", sub: "[a-z]+", ch: [^,]+, name: "[^"]+",)',rep,s)
    open(f,'w',encoding='utf8').write(s)
print(done)
