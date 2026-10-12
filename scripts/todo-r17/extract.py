import re,os,csv,json,sys
D='/workspace/fullstack-408/apps/web/public/legacy/js'
files=[f for f in sorted(os.listdir(D)) if f.endswith('.js')]
strre=re.compile(r'"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'')
cjk=re.compile(r'[\u4e00-\u9fff]')
RISK=[
 ('口诀/押韵', re.compile(r'口诀|顺口溜|记忆法|速记|一句话记')),
 ('栏目式开头', re.compile(r'(^|[>：:\s])(注意|特别提醒|特别注意|命题陷阱|考点提示|提示：|易错提醒|考查重点|高频考点|重点提示|技巧|秒杀|必背|必考)')),
 ('编号结论', re.compile(r'结论[一二三四五六七八九十]|推论[一二三]|性质[一二三四五]|[①②③④⑤]')),
 ('教材腔', re.compile(r'教材|课本|书上|本书|本章|本节|习题|例题\d|参考答案|答案与|解析：|【')),
 ('长句', None),
]
rows=[]
for f in files:
    if f in ('03-shared.js','28-rwd.js'): pass
    for ln,line in enumerate(open(os.path.join(D,f),encoding='utf8'),1):
        if line.strip().startswith('//') or line.strip().startswith('/*') or line.strip().startswith('*'): continue
        for m in strre.finditer(line):
            s=m.group(1) if m.group(1) is not None else m.group(2)
            if len(cjk.findall(s))<4: continue
            tags=[n for n,r in RISK if r and r.search(s)]
            plain=re.sub(r'<[^>]+>','',s)
            if len(plain)>110 and plain.count('，')>=4: tags.append('长句')
            rows.append([f,ln,plain,';'.join(tags)])
with open('texts.csv','w',newline='',encoding='utf-8-sig') as fp:
    w=csv.writer(fp); w.writerow(['文件','行','原文','风险标记']); w.writerows(rows)
from collections import Counter
print(len(rows)); c=Counter()
for r in rows:
    for t in r[3].split(';'):
        if t:c[t]+=1
print(c)
print(Counter(r[0] for r in rows))
