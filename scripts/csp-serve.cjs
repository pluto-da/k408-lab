// Static server for apps/web/dist that sends the same CSP header as deploy/caddy/Caddyfile.
// usage: node csp-serve.cjs <dist> <port>
const http = require("http");
const fs = require("fs");
const path = require("path");
const [dist, port] = [process.argv[2], Number(process.argv[3] || 4180)];
const caddy = fs.readFileSync("/workspace/fullstack-408/deploy/caddy/Caddyfile", "utf8");
const csp = process.env.CSP || /Content-Security-Policy "([^"]+)"/.exec(caddy)[1];
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".sog": "application/octet-stream", ".png": "image/png" };
http
  .createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    if (u.startsWith("/api/")) { res.writeHead(401, { "content-type": "application/json" }); return res.end('{"error":"unauthorized"}'); }
    let f = path.join(dist, u);
    if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html");
    res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream", "content-security-policy": csp });
    fs.createReadStream(f).pipe(res);
  })
  .listen(port, () => console.log("csp server on", port, "\n", csp));
