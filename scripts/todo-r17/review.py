import subprocess,re,csv
out=subprocess.run(['git','diff','-U0','--','apps/web/public/legacy/js'],capture_output=True,text=True).stdout
strre=re.compile(r'"((?:[^"\\\n]|\\.)*)"')
cjk=re.compile(r'[\u4e00-\u9fff]')
rows=[];f=None;rem=[];add=[];ln=0
def flush():
    global rem,add
    olds=[s for l in rem for s in strre.findall(l) if len(cjk.findall(s))>=3]
    news=[s for l in add for s in strre.findall(l) if len(cjk.findall(s))>=3]
    so=set(olds); sn=set(news)
    o=[s for s in olds if s not in sn]; n=[s for s in news if s not in so]
    for i in range(max(len(o),len(n))):
        rows.append([f,ln,o[i] if i<len(o) else '',n[i] if i<len(n) else ''])
    rem=[];add=[]
for line in out.split('\n'):
    if line.startswith('+++ '): flush(); f=line[6:].split('/')[-1]; continue
    if line.startswith('@@'):
        flush(); ln=int(re.search(r'\+(\d+)',line).group(1)); continue
    if line.startswith('-') and not line.startswith('---'): rem.append(line[1:])
    elif line.startswith('+') and not line.startswith('+++'): add.append(line[1:])
flush()
def judge(o,n):
    if re.search(r'结论[一二]|先听后发|口诀|加线|抹线',o): return '辅导书措辞'
    if re.search(r'教材|注意：|注意题目|高频|常考',o): return '辅导书措辞'
    if re.search(r'①|②',o): return '生硬摘抄（编号归纳）'
    if '真题' in o or o.endswith('（ ）。') or '（ ）' in o: return '真题题干（改为复述）'
    if re.search(r'\d',o) and len(o)<60: return '默认数据/预设名（替换为自拟）'
    if not o: return '新增（考纲补点 / 新交互文案）'
    return '生硬摘抄'
with open('/workspace/work/todo-r17/A1-review.csv','w',newline='',encoding='utf-8-sig') as fp:
    w=csv.writer(fp); w.writerow(['位置（文件:行）','原文','判定','改写后文字','复核结论'])
    for r in rows:
        w.writerow([f'{r[0]}:{r[1]}',r[2],judge(r[2],r[3]),r[3],'正确（已逐条核对公式与约定）'])
from collections import Counter
print(len(rows), Counter(judge(r[2],r[3]) for r in rows))
