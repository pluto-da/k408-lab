import sys, asyncio, importlib
import edge_tts.constants as c
maj=sys.argv[1]; full=f"{maj}.0.{sys.argv[2]}"
c.CHROMIUM_FULL_VERSION=full; c.CHROMIUM_MAJOR_VERSION=maj; c.SEC_MS_GEC_VERSION=f"1-{full}"
for d in (c.BASE_HEADERS,c.WSS_HEADERS,c.VOICE_HEADERS):
    for k,v in list(d.items()):
        d[k]=v.replace("143.0.3650.75",full).replace("143",maj)
import edge_tts.communicate as cm, edge_tts.drm as drm
for mod in (cm,drm):
    for n in ("SEC_MS_GEC_VERSION","WSS_HEADERS","CHROMIUM_FULL_VERSION"):
        if hasattr(mod,n): setattr(mod,n,getattr(c,n))
async def m():
    await edge_tts.Communicate("测试一下声音。","zh-CN-YunxiNeural").save("tts/probe.mp3")
import edge_tts
asyncio.run(m()); print("OK",full)
