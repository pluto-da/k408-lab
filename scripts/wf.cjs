// CSP-safe replacement for page.waitForFunction (which needs 'unsafe-eval' in the page)
module.exports = async function wf(page, fn, arg, opts = {}) {
  const timeout = (opts && opts.timeout) || 30000;
  const t0 = Date.now();
  for (;;) {
    let ok = false;
    try { ok = await page.evaluate(fn, arg); } catch (e) { if (!/context was destroyed|navigation/i.test(e.message)) throw e; }
    if (ok) return ok;
    if (Date.now() - t0 > timeout) throw new Error("wf timeout");
    await new Promise((r) => setTimeout(r, (opts && opts.polling) || 500));
  }
};
