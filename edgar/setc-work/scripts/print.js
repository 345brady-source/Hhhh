// usage: node print.js jobs.json ; jobs: [{src, out, landscape, background, headerFooter, url, date}]
const { chromium } = require('playwright');
const fs = require('fs');
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
(async () => {
  const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  for (const j of jobs) {
    const page = await ctx.newPage();
    try {
      await page.route('**/*', r => {
        const u = r.request().url();
        if (u.startsWith('file:') || u.startsWith('data:')) return r.continue();
        return r.abort();
      });
      await page.goto('file://' + j.src, { waitUntil: 'load', timeout: 90000 });
      const opts = { path: j.out, format: 'Letter', landscape: !!j.landscape, printBackground: !!j.background,
        margin: { top: '0.4in', bottom: '0.4in', left: '0.4in', right: '0.4in' } };
      if (j.headerFooter) {
        const title = await page.title();
        const st = 'font-size:8px;font-family:Arial,sans-serif;width:100%;padding:0 0.4in;display:flex;justify-content:space-between;';
        opts.displayHeaderFooter = true;
        opts.headerTemplate = `<div style="${st}"><span>${esc(j.date)}</span><span>${esc(title || j.url.split('/').pop())}</span><span></span></div>`;
        opts.footerTemplate = `<div style="${st}"><span>${esc(j.url)}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`;
        opts.margin = { top: '0.5in', bottom: '0.5in', left: '0.4in', right: '0.4in' };
      }
      await page.pdf(opts);
      console.log('ok', j.out);
    } catch (e) { console.log('err', j.out, e.message); }
    await page.close();
  }
  await browser.close();
})();
