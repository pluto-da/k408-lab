# local CONNECT/HTTP proxy on 127.0.0.1:18080 that forwards to upstream $HTTP_PROXY with auth header
import asyncio, os, base64, urllib.parse
u = urllib.parse.urlsplit(os.environ["HTTP_PROXY"])
UP_HOST, UP_PORT = u.hostname, u.port
auth = base64.b64encode(f"{urllib.parse.unquote(u.username)}:{urllib.parse.unquote(u.password)}".encode()).decode()

async def pipe(r, w):
    try:
        while True:
            d = await r.read(65536)
            if not d: break
            w.write(d); await w.drain()
    except Exception: pass
    finally:
        try: w.close()
        except Exception: pass

async def handle(cr, cw):
    try:
        head = await cr.readuntil(b"\r\n\r\n")
    except Exception:
        cw.close(); return
    lines = head.split(b"\r\n")
    new = [lines[0]] + [l for l in lines[1:] if l and not l.lower().startswith(b"proxy-authorization")]
    new.append(b"Proxy-Authorization: Basic " + auth.encode())
    ur, uw = await asyncio.open_connection(UP_HOST, UP_PORT)
    uw.write(b"\r\n".join(new) + b"\r\n\r\n"); await uw.drain()
    await asyncio.gather(pipe(cr, uw), pipe(ur, cw))

async def main():
    s = await asyncio.start_server(handle, "127.0.0.1", 18080)
    async with s: await s.serve_forever()
asyncio.run(main())
