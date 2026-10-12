import json,urllib.request,urllib.parse,sys,re
qs=sys.argv[1:]
seen=json.load(open("ss_results.json"))
kw=re.compile(r'(pc\b|computer|mother|mainboard|gpu|graphic|rtx|gtx|radeon|nvidia|cpu|processor|xeon|ryzen|intel|amd\b|die\b|ram\b|memory|dimm|ddr|ssd|nvme|m\.2|hard ?drive|hdd|disk|platter|psu|power supply|network|ethernet|nic\b|pcb|circuit|chip|cooler|heatsink|fan\b|server|tower|case|electronic|board|wafer|silicon|keyboard|laptop|itx|atx|raspberry|arduino)',re.I)
for q in qs:
  for skip in (0,50,100):
    u="https://playcanvas.com/api/splats/explore?"+urllib.parse.urlencode({"search":q,"limit":50,"skip":skip})
    try: d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"Accept":"application/json","User-Agent":"Mozilla/5.0"}),timeout=30))
    except Exception as e: print("ERR",q,e); break
    r=d.get("result",[])
    for s in r:
      h=s["hash"]
      if h in seen: continue
      seen[h]=s
      if not kw.search(s["title"]): continue
      dl=s.get("downloads") or {}
      print(f'{q!r:16} {h} | {s["title"][:60]} | {s["user"]["username"]} | {s.get("format")} {round((s.get("size") or 0)/1e6,1)}MB | lod {s.get("lodCounts")} | dl={dl.get("enabled")} {dl.get("license")} | {(s.get("description") or "")[:100]!r}')
    if len(r)<50: break
json.dump(seen,open("ss_results.json","w"))
