import json,urllib.request,urllib.parse,sys,time
qs=sys.argv[1:]
seen={}
for q in qs:
  for skip in (0,50):
    u="https://playcanvas.com/api/splats/explore?"+urllib.parse.urlencode({"search":q,"limit":50,"skip":skip})
    try:
      d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"Accept":"application/json","User-Agent":"Mozilla/5.0"}),timeout=30))
    except Exception as e: print("ERR",q,e); break
    r=d.get("result",[])
    for s in r:
      h=s["hash"]
      if h in seen: continue
      seen[h]=s
      dl=s.get("downloads") or {}
      print(f'{q!r:18} {h} | {s["title"][:60]} | {s["user"]["username"]} | {s.get("format")} {round((s.get("size") or 0)/1e6,1)}MB | lod {s.get("lodCounts")} | dl={dl.get("enabled")} {dl.get("license")} | views {s.get("views")}')
    if len(r)<50: break
json.dump(seen,open("ss_results.json","w"))
