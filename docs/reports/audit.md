# 考研408动画实验室：审计与修复（2026-10-09）

Repo: `/workspace/fullstack-408`. Live checks used http://154.8.183.93 (curl only, since the sandbox browser could not reach the IP). UI checks ran headless Chromium against the freshly built `apps/web/dist`, served by the real `deploy/caddy/Caddyfile` (Caddy 2.10, local :8099, now stopped). Devices were Pixel 7 and iPad Pro 11 landscape. Tap tests passed with no JS errors: chapter tabs, lab "单步", quiz answer, and 3D hotspots.
Final gates: `pnpm typecheck` ✅ `pnpm lint` ✅ `pnpm test` ✅ (api 19, web 9; was 14 + 6) `pnpm --filter web build` ✅. `caddy validate` ✅.
I did not edit `src/pc/**`, `pages/Pc.tsx` or `tools/pc-model/**`. Those already show uncommitted changes from the other engineer, and the build includes their in-progress code.

## Findings

| Sev | Finding | Where | Status |
|---|---|---|---|
| High | Login was rate-limited **per IP only**, so one account could be brute-forced from many IPs. | `api/routes/auth.ts` | **Fixed**: per-account lock after 10 failures in 15 min (in-memory, capped at 50k entries). Lock returns 429 `ACCOUNT_LOCKED`. |
| High | Production started fine with the `.env.example` JWT secret (`change-me…` is 32+ chars, so it passed). | `api/env.ts` | **Fixed**: refused when `NODE_ENV=production`. |
| Med | API responses (`/api/me` etc.) had no `Cache-Control`, so proxies or browsers could cache user data. | `api/app.ts` | **Fixed**: `no-store` on every `/api/*` response. |
| Med | `/robots.txt`, `/sitemap.xml`, `/favicon.ico`, `/manifest.webmanifest` and any typo URL returned **200 + index.html** (soft 404s, bad for SEO). | Caddyfile | **Fixed**: known SPA routes give 200. Unknown paths give a **real 404** that still renders the React 404 page. Missing static files give 404. |
| Med | Every page had the same `<title>`. No per-page description, no noindex on login/register/profile/404. | web | **Fixed**: `lib/seo.ts` + Layout effect (title, description, og:*, robots). |
| Med | No PWA manifest, apple-touch-icon, PNG or ICO icons ("add to home screen" on Android/iPad showed a blank icon). | `public/` | **Fixed**: manifest, 192/512/maskable PNGs, apple-touch-icon, favicon.ico. The `.webmanifest` MIME type is set in Caddy. |
| Med | If `/lab` failed to boot (weak mobile network), the spinner stayed forever. A failed fetch also blocked retrying. | `pages/Lab.tsx`, `legacy/loadLegacy.ts` | **Fixed**: checks HTTP status, shows an error card with a "重新加载" button, and allows retry if no legacy script has run yet. The GLB still downloads in parallel. |
| Low | Phone portrait: the lab's sticky subject bar wrapped "网络" onto a second row. The hero title broke as "考研408动 / 画实验室". Chips showed a stray gap ("数据 结构"). | `public/legacy/css/legacy-03.css`, `body.html` | **Fixed**. |
| Low | 3D hotspot hit areas were about 42×30 px on touch. | legacy-03.css | **Fixed** (about 44×44 on coarse pointers). |
| Low | Auth forms: iOS auto-capitalised usernames, there was no show-password toggle, client checks didn't match server rules, and errors weren't announced to screen readers. | Login/Register/Profile | **Fixed**: `autoCapitalize=none`, `PasswordInput` toggle, username/email/length checks matching zod, `role=alert`. |
| Low | `safeNext` accepted `/\evil.com`, which browsers treat as `//evil.com` (pushState then throws). | `lib/format.ts` | **Fixed** + unit test. The profile 注册时间 now also shows the year. |
| Low | No skip link and no consistent `:focus-visible` style. Header login/register buttons were about 31 px tall. | Layout / app.css | **Fixed**. |
| Low | `<head>`: no `renderer=webkit` (360/QQ/Sogou dual-core browsers can fall back to IE mode), no `format-detection`, no `viewport-fit`, no og:type/site_name. | `index.html` | **Fixed**. |
| Low | The footer had no ICP 备案号 slot (legally required once the domain is filed). | Layout | **Added**: `ICP_BEIAN` → `VITE_ICP_BEIAN` build arg renders a link to beian.miit.gov.cn. The footer also gained nav links. |
| Low | CSP had no `object-src 'none'` or `manifest-src`. There was no COOP header. Permissions-Policy was minimal. | Caddyfile | **Fixed**. |
| Low | Home copy: "DMA 写内存 · 不占用 CPU" is imprecise (cycle stealing does take bus cycles). "执行写回" mixed up the pipeline WB stage with cache write-back. | `pages/Home.tsx` | **Fixed**: "不经 CPU 搬运数据" and "写 Cache · 写回法 · 脏位". |
| Info | 408 content spot-check found nothing wrong: score split 45/45/35/25, chapter lists, sorting table, IEEE754 bias 127, GBN/SR windows, CSMA/CD min frame, IP fragment units, TCP Reno, buffering formulas, and all 8 quiz items (FIFO Belady = 9 faults, /26 = 62 hosts, Cache tag 18 bits, etc.). | legacy data, seed-questions.json | OK |
| Info | China-friendliness: no Google Fonts or foreign CDNs. Fonts, three.js and models are all self-hosted. | — | OK |
| Info | Compression: zstd/gzip are active. Hashed assets are `immutable`. Main JS is 221 kB (73 kB gz). `three` is 647 kB (165 kB gz) and lazy-loaded. Spoofed `X-Forwarded-For` does **not** bypass rate limits (Caddy overwrites it). Cross-site `text/plain` POSTs are rejected. | — | OK |

## Files changed / added
- API: `apps/api/src/app.ts`, `src/env.ts`, `src/routes/auth.ts`, **new** `src/lib/login-guard.ts`, **new** `test/hardening.test.ts`
- Web: `apps/web/index.html`, `vite.config.ts` (emits `robots.txt`; also `sitemap.xml` when `SITE_URL` is set), `src/components/Layout.tsx`, **new** `src/components/PasswordInput.tsx`, **new** `src/lib/seo.ts` + `seo.test.ts`, `src/lib/format.ts`, `src/env.d.ts`, `src/legacy/loadLegacy.ts`, `src/pages/{Home,Lab,Login,Register,Profile,NotFound}.tsx`, `src/styles/app.css`
- Static: **new** `public/manifest.webmanifest`, `public/icons/{icon-192,icon-512,maskable-512}.png`, `public/apple-touch-icon.png`, `public/favicon.ico`. Edited `public/legacy/body.html` (h1 only) and `public/legacy/css/legacy-03.css`.
- Deploy: `deploy/caddy/Caddyfile`, `deploy/caddy/Dockerfile` (args `SITE_URL`, `VITE_ICP_BEIAN`), `docker-compose.yml`, `.env.example` (`SITE_URL`, `ICP_BEIAN`)
- `apps/web/dist` was rebuilt (now includes the other engineer's in-progress /pc code).

## Needs the owner
1. **HTTPS**: the site is plain HTTP on a bare IP, so passwords and session cookies travel in cleartext and the cookie isn't `Secure`. This needs the ICP-filed domain. Then set `DOMAIN` (Caddy gets certs automatically and cookies turn Secure), `SITE_URL=https://…`, and `ICP_BEIAN`, then redeploy. After HTTPS is confirmed, add `Strict-Transport-Security` in the Caddyfile (I left it out because it can't be sent over plain HTTP).
2. **Redeploy** to pick up all of this. Nothing was deployed. Note: when you add a new front-end route, also add it to the `@spa` regex in the Caddyfile, or it will be served with status 404.
3. **Mobile data cost**: `/lab` downloads `motherboard.glb` at 2.6 MB (2.3 MB with zstd; GLB barely compresses), plus three.min.js at 600 kB. `/pc` loads several 1–2.3 MB GLBs. Recommend meshopt/Draco + KTX2 compression (likely 3–5× smaller) and moving legacy `three.min.js` onto the bundled `three` chunk. That's a decision for the /pc engineer.
4. **Shared NAT**: the auth limit of 10/min per IP (and 300/min global) can trip for whole campus or dorm networks behind one public IP. Consider raising `AUTH_RATE_LIMIT_MAX` now that the per-account lock exists. Also, the per-account lock lets someone deliberately lock a known username for 15 minutes; that's the usual trade-off, and a CAPTCHA would be the next step if it becomes an issue.
5. **Sessions**: logout only clears the cookie. The JWT stays valid until it expires (30 days) unless `tokenVersion` is bumped. Consider a "退出所有设备" action and/or a shorter session with refresh.
6. **Legal/product**: add 用户协议 / 隐私政策 pages (expected under China's PIPL for any site with registration), plus 百度站长/360 verification meta once there's a domain. Statistics (e.g. 百度统计) would need a CSP update.
7. **SPA SEO**: content is client-rendered. Baidu renders JS poorly, so pre-rendering `/` and `/lab` (static HTML snapshots) would help discovery.
