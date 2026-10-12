// preload: make playwright's chromium.launch use the sandbox HTTP proxy (with auth) from env
const u = new URL(process.env.HTTP_PROXY);
const pw = require("/tmp/pw/node_modules/playwright");
const orig = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = (opts = {}) =>
  orig({ ...opts, executablePath: opts.executablePath || "/usr/bin/chromium", proxy: { server: `${u.protocol}//${u.host}`, username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) } });
