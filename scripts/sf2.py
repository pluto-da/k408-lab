import json,urllib.request,urllib.parse
seen={}
qs=[]
for a in ["gaussian splat","splat","3dgs","gaussian splatting","scaniverse","polycam splat","luma"]:
  for b in ["computer","pc","gpu","graphics card","motherboard","cpu","processor","ram","ssd","hard drive","hdd","power supply","electronics","circuit board","pcb","keyboard","server","laptop"]:
    qs.append(a+" "+b)
for q in qs:
  u="https://api.sketchfab.com/v3/search?"+urllib.parse.urlencode({"type":"models","q":q,"count":24})
  try: d=json.load(urllib.request.urlopen(u,timeout=30))
  except Exception as e: print("ERR",q,e); continue
  for m in d.get("results",[]):
    if m["uid"] in seen: continue
    seen[m["uid"]]=m
    lic=m.get("license"); lic=lic.get("label") if isinstance(lic,dict) else lic
    txt=(m["name"]+" "+(m.get("description") or "")+" "+" ".join(t["name"] for t in m.get("tags",[]))).lower()
    if not any(k in txt for k in ["splat","3dgs","gaussian","scaniverse","nerf","luma","polycam"]): continue
    print(f'{q!r:30} {m["uid"]} | {m["name"][:55]} | {m["user"]["username"]} | {lic} | dl {m.get("isDownloadable")} | v{m.get("vertexCount")} f{m.get("faceCount")}')
json.dump(seen,open("sf_results.json","w"))
