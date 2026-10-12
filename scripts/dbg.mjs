import { chromium } from '/tmp/pw/node_modules/playwright-core/index.mjs';
const b = await chromium.launch({ executablePath: process.env.CH, args: ['--no-sandbox','--no-proxy-server'] });
const p = await b.newPage();
p.on('response', r => console.log(r.status(), r.url()));
await p.goto('http://154.8.183.93/', {timeout:30000}).catch(e=>console.log(e.message));
console.log((await p.content()).slice(0,300));
await b.close();
