import json,urllib.request,urllib.parse,sys,time
seen={}
def run(params):
  u="https://api.sketchfab.com/v3/search?"+urllib.parse.urlencode(params)
  try: d=json.load(urllib.request.urlopen(u,timeout=30))
  except Exception as e: print("ERR",params,e); return
  for m in d.get("results",[]):
    if m["uid"] in seen: continue
    seen[m["uid"]]=m
    lic=m.get("license"); lic=lic.get("label") if isinstance(lic,dict) else lic
    arch=m.get("archives") or {}
    print(f'{params.get("q","")!r:14} {params.get("tags","")!s:18} {m["uid"]} | {m["name"][:55]} | {m["user"]["username"]} | {lic} | dl {m.get("isDownloadable")} | v{m.get("vertexCount")} f{m.get("faceCount")} | arch {list(arch.keys())}')
for tag in ["gaussian-splatting","gaussiansplatting","3dgs","gaussian-splat","splat","gaussiansplat","gaussian"]:
  for q in ["computer","pc","gpu","graphics card","motherboard","cpu","ram","ssd","hard drive","power supply","electronics","circuit"]:
    run({"type":"models","q":q,"tags":tag,"count":24})
json.dump(seen,open("sf_results.json","w"))
