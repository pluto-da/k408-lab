import json,sys,collections
d=json.load(open(sys.argv[1]))['results']
agg=collections.defaultdict(lambda:[0,0,0])
for r in d:
    a=agg[r['route']]; a[0]+=r.get('tiny',0); a[1]+=r.get('small',0) if r['touch'] else 0; a[2]+=1 if r.get('overflow') else 0
print('route tiny smallTouch overflow'); [print(k,*v) for k,v in agg.items()]
print('pc scene:', {r['vp']:r.get('scene') for r in d if r['route']=='/pc'})
print('home content%:', {r['vp']:round(r['content']/r['W']*100) for r in d if r['route']=='/' and r['W']>=1366})
print('legal line:', {r['vp']:r.get('line') for r in d if r['route']=='/terms'})
print('rootFs/bodyFs:', {r['vp']:(r.get('rootFs'),r.get('bodyFs')) for r in d if r['route']=='/'})
