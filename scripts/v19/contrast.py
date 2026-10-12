def L(h):
    h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    f=lambda c: c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    a,b=L(a),L(b); return (max(a,b)+0.05)/(min(a,b)+0.05)
import sys
bgs={'bg':'#0b0d12','panel':'#12151c','card':'#181c25','hover':'#1f2430'}
fgs={'ink':'#e8eaf0','ink2':'#a3a9b7','ink3a':'#737a89','ink3b':'#80879a','ink3c':'#858c9c','link':'#8aa2ff','tag':'#e0a43a','set':'#3fb5a0','off':'#5aa9e6','frame':'#9b8cff','ok':'#3fbf7f','bad':'#e5534b','badl':'#f0716a','accent':'#5b7cff'}
for fn,f in fgs.items():
    print(fn, ' '.join(f"{bn}:{cr(f,b):.2f}" for bn,b in bgs.items()))
for a in ['#5b7cff','#4f6ff7','#4a6af2','#4766ee','#4462ea','#3f5ee6']:
    print('white on',a,round(cr('#ffffff',a),2),'dark on',round(cr('#0b0d12',a),2))
