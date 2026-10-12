import sys,json
for l in sys.stdin:
  try: d=json.loads(l)
  except: print(l[:300].strip()); continue
  print(d['n'],d['vp'],'ov',d['overflow'],'tiny',d['tiny'],d['tiny13'],'small',d['small'],'ratio',d['ratio'],d['layW'],'lab',d['labSplit'],d['stageW'],'x',d['stageH'],'proc',d['procSplit'],'prop',d['propSplit'],'fit',d['fit']['bothVisible'],d['fit']['stTop'],d['fit']['stepBot'],d['errs'][:2],d['tinyEx'][:3],d['smallEx'][:5])
